//! Protected authentication v1: a single Bearer slot, no transport or ambient host imports.
use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const AUTH_ABI: &str = "ouroboros.auth.bearer/1";
pub const MAX_MODULE_BYTES: usize = 65_536;
pub const MAX_TOKEN_BYTES: usize = 8_192;
pub const AUTH_OUTPUT_OFFSET: usize = 32_768;
pub const AUTH_FUEL: u64 = 200_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct AuthModuleSelection {
    pub abi: String,
    pub wasm_sha256: String,
}
impl AuthModuleSelection {
    pub fn validate(&self) -> Result<()> {
        ensure!(self.abi == AUTH_ABI, "unsupported authentication ABI");
        ensure!(
            self.wasm_sha256.len() == 64
                && self
                    .wasm_sha256
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
            "invalid module digest"
        );
        Ok(())
    }
    pub fn verify(&self, wasm: &[u8]) -> Result<()> {
        self.validate()?;
        ensure!(
            (8..=MAX_MODULE_BYTES).contains(&wasm.len()) && wasm.starts_with(b"\0asm\x01\0\0\0"),
            "bounded binary module required"
        );
        ensure!(
            hex::encode(Sha256::digest(wasm)) == self.wasm_sha256,
            "module digest mismatch"
        );
        Ok(())
    }
}

/// Portable package bytes. Installation conveys neither acceptance nor connection selection.
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AuthModulePackage {
    pub selection: AuthModuleSelection,
    pub wasm_hex: String,
}
impl AuthModulePackage {
    pub fn decode(&self) -> Result<Vec<u8>> {
        ensure!(
            self.wasm_hex.len() <= MAX_MODULE_BYTES * 2,
            "module exceeds bound"
        );
        let bytes = hex::decode(&self.wasm_hex)?;
        self.selection.verify(&bytes)?;
        Ok(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn package_is_exact_binary_and_supported_abi() {
        let bytes = b"\0asm\x01\0\0\0";
        let mut selection = AuthModuleSelection {
            abi: AUTH_ABI.into(),
            wasm_sha256: hex::encode(Sha256::digest(bytes)),
        };
        assert!(selection.verify(bytes).is_ok());
        assert!(selection.verify(b"different").is_err());
        selection.abi = "unknown".into();
        assert!(selection.verify(bytes).is_err());
    }
}
