//! Development-only WAT packager. The product worker only accepts digest-pinned binary Wasm.
use ouroboros_contracts::auth_module::{AUTH_ABI, AuthModulePackage, AuthModuleSelection};
use sha2::{Digest, Sha256};
fn main() -> anyhow::Result<()> {
    let source = std::env::args_os()
        .nth(1)
        .ok_or_else(|| anyhow::anyhow!("WAT path required"))?;
    let bytes = wat::parse_file(source)?;
    let package = AuthModulePackage {
        selection: AuthModuleSelection {
            abi: AUTH_ABI.into(),
            wasm_sha256: hex::encode(Sha256::digest(&bytes)),
        },
        wasm_hex: hex::encode(bytes),
    };
    package.decode()?;
    println!("{}", serde_json::to_string(&package)?);
    Ok(())
}
