//! Capability-free Wasm worker. This module is called only by the separate Runtime binary.
//! The custody process never links this interpreter or executes package code.
use anyhow::{Context, Result, ensure};
use ouroboros_contracts::auth_module::{
    AUTH_FUEL, AUTH_OUTPUT_OFFSET, AuthModulePackage, MAX_TOKEN_BYTES,
};
use std::io::{Read, Write};
use wasmi::{Config, Engine, Linker, Module, Store, StoreLimits, StoreLimitsBuilder};
use zeroize::{Zeroize, Zeroizing};

fn frame(input: &mut impl Read, limit: usize) -> Result<Zeroizing<Vec<u8>>> {
    let mut size = [0; 4];
    input.read_exact(&mut size)?;
    let size = u32::from_be_bytes(size) as usize;
    ensure!(size > 0 && size <= limit, "invalid frame size");
    let mut bytes = Zeroizing::new(vec![0; size]);
    input.read_exact(&mut bytes)?;
    Ok(bytes)
}

pub fn run(input: &mut impl Read, output: &mut impl Write) -> Result<()> {
    let package: AuthModulePackage = serde_json::from_slice(&frame(input, 140_000)?)?;
    let bytes = package.decode()?;
    let mut config = Config::default();
    config
        .consume_fuel(true)
        .enforced_limits(wasmi::EnforcedLimits::strict());
    let engine = Engine::new(&config);
    let module = Module::new(&engine, bytes)?;
    ensure!(
        module.imports().next().is_none(),
        "module imports are forbidden"
    );
    let limits = StoreLimitsBuilder::new()
        .memory_size(65_536)
        .memories(1)
        .tables(0)
        .instances(1)
        .trap_on_grow_failure(true)
        .build();
    let mut store = Store::new(&engine, limits);
    store.limiter(|limit| limit);
    store.set_fuel(AUTH_FUEL)?;
    let instance =
        Linker::<StoreLimits>::new(&engine).instantiate_and_start(&mut store, &module)?;
    let memory = instance
        .get_memory(&store, "memory")
        .context("memory export required")?;
    ensure!(
        memory.data(&store).len() == 65_536,
        "one memory page required"
    );
    let authenticate = instance.get_typed_func::<i32, i32>(&store, "authenticate")?;
    // No credential is sent until the bounded module has been loaded and its ABI checked.
    output.write_all(b"READY\n")?;
    output.flush()?;
    let secret = frame(input, MAX_TOKEN_BYTES)?;
    ensure!(
        secret.iter().all(u8::is_ascii_graphic),
        "invalid token encoding"
    );
    memory.write(&mut store, 0, &secret)?;
    let result = (|| -> Result<Zeroizing<Vec<u8>>> {
        let size = authenticate.call(&mut store, secret.len() as i32)?;
        ensure!(
            (1..=(MAX_TOKEN_BYTES + 7) as i32).contains(&size),
            "invalid output size"
        );
        let mut bytes = Zeroizing::new(vec![0; size as usize]);
        memory.read(&store, AUTH_OUTPUT_OFFSET, &mut bytes)?;
        // v1 independently enforces the entire permissible transformation. Private code
        // cannot add another header, choose a recipient or encode an alternative payload.
        ensure!(
            bytes.len() == secret.len() + 7
                && bytes.starts_with(b"Bearer ")
                && bytes[7..] == secret[..],
            "invalid authentication result"
        );
        Ok(bytes)
    })();
    memory.data_mut(&mut store).zeroize();
    let bytes = result?;
    output.write_all(&(bytes.len() as u32).to_be_bytes())?;
    output.write_all(&bytes)?;
    output.flush()?;
    Ok(())
}
