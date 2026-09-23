use ouroboros_contracts::auth_module::{AUTH_ABI, AuthModulePackage, AuthModuleSelection};
use sha2::{Digest, Sha256};
use std::io::Cursor;

fn package(wat: &str) -> AuthModulePackage {
    let bytes = wat::parse_str(wat).unwrap();
    AuthModulePackage {
        selection: AuthModuleSelection {
            abi: AUTH_ABI.into(),
            wasm_sha256: hex::encode(Sha256::digest(&bytes)),
        },
        wasm_hex: hex::encode(bytes),
    }
}
fn execute(package: AuthModulePackage, secret: &[u8]) -> (anyhow::Result<()>, Vec<u8>) {
    let mut input = Vec::new();
    for bytes in [serde_json::to_vec(&package).unwrap(), secret.to_vec()] {
        input.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
        input.extend_from_slice(&bytes);
    }
    let mut output = Vec::new();
    let result = ouroboros_runtime::auth_module::run(&mut Cursor::new(input), &mut output);
    (result, output)
}
#[test]
fn package_executes_exact_bearer_slot_at_both_input_bounds() {
    for secret in [b"x".to_vec(), vec![b'z'; 8192]] {
        let (result, output) = execute(
            package(include_str!("../../../tests/fixtures/auth-bearer-v1.wat")),
            &secret,
        );
        assert!(result.is_ok());
        assert_eq!(&output[..6], b"READY\n");
        assert_eq!(&output[10..17], b"Bearer ");
        assert_eq!(&output[17..], &secret);
    }
}
#[test]
fn import_growth_loop_and_alternative_output_are_denied() {
    let bad = [
        "(module (import \"wasi_snapshot_preview1\" \"fd_write\" (func)))",
        "(module (memory (export \"memory\") 2) (func (export \"authenticate\") (param i32) (result i32) i32.const 1))",
        "(module (memory (export \"memory\") 1 2) (func (export \"authenticate\") (param i32) (result i32) i32.const 1 memory.grow))",
        "(module (memory (export \"memory\") 1) (func (export \"authenticate\") (param i32) (result i32) (loop $again br $again) i32.const 0))",
        "(module (memory (export \"memory\") 1) (func (export \"authenticate\") (param i32) (result i32) i32.const 5))",
    ];
    for wat in bad {
        let (result, output) = execute(package(wat), b"synthetic-value");
        assert!(result.is_err());
        assert!(output.is_empty() || output == b"READY\n");
    }
}
#[test]
fn changed_package_cannot_receive_credential() {
    let mut p = package(include_str!("../../../tests/fixtures/auth-bearer-v1.wat"));
    p.selection.wasm_sha256 = "0".repeat(64);
    let (result, output) = execute(p, b"synthetic-value");
    assert!(result.is_err());
    assert!(output.is_empty());
}

#[test]
fn distributed_package_matches_reviewable_wat_source() {
    let actual: AuthModulePackage =
        serde_json::from_str(include_str!("../../../tests/fixtures/auth-bearer-v1.json")).unwrap();
    let expected = package(include_str!("../../../tests/fixtures/auth-bearer-v1.wat"));
    assert_eq!(actual.selection, expected.selection);
    assert_eq!(actual.decode().unwrap(), expected.decode().unwrap());
}
