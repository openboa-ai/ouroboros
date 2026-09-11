//! Trusted-worker-only cryptographic building block; not a reveal API or durable store.
use ring::{
    aead,
    rand::{SecureRandom, SystemRandom},
};
use uuid::Uuid;
use zeroize::Zeroizing;

const HEADER: &[u8] = b"ouroboros-credential-aes256gcm-1";
const MAX_SECRET: usize = 16 * 1024;

/// Exact custody identity supplied by trusted connection state, never by private input.
#[derive(Clone, Copy)]
pub struct Binding {
    pub owner: Uuid,
    pub credential: Uuid,
    pub version: u64,
}
impl Binding {
    fn aad(self) -> Result<Vec<u8>, CustodyError> {
        if self.owner.is_nil() || self.credential.is_nil() || self.version == 0 {
            return Err(CustodyError);
        }
        let mut bytes = HEADER.to_vec();
        bytes.extend_from_slice(self.owner.as_bytes());
        bytes.extend_from_slice(self.credential.as_bytes());
        bytes.extend_from_slice(&self.version.to_be_bytes());
        Ok(bytes)
    }
}

/// Deliberately contains no upstream error, value, path or cryptographic material.
#[derive(Debug, PartialEq, Eq)]
pub struct CustodyError;
impl std::fmt::Display for CustodyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("credential custody operation failed")
    }
}
impl std::error::Error for CustodyError {}

/// Has no Debug, Serialize or plaintext-export method. Only trusted worker code may hold it.
pub struct EnvelopeKey(aead::LessSafeKey);
impl EnvelopeKey {
    pub fn new(key: Zeroizing<[u8; 32]>) -> Result<Self, CustodyError> {
        aead::UnboundKey::new(&aead::AES_256_GCM, key.as_ref())
            .map(|key| Self(aead::LessSafeKey::new(key)))
            .map_err(|_| CustodyError)
    }

    /// Input and intermediate plaintext are wiped on drop. Caller must not retain input copies.
    pub fn seal(
        &self,
        binding: Binding,
        plaintext: Zeroizing<Vec<u8>>,
    ) -> Result<Vec<u8>, CustodyError> {
        if plaintext.is_empty() || plaintext.len() > MAX_SECRET {
            return Err(CustodyError);
        }
        let aad = binding.aad()?;
        let mut nonce = [0u8; 12];
        SystemRandom::new()
            .fill(&mut nonce)
            .map_err(|_| CustodyError)?;
        let mut buffer = plaintext;
        self.0
            .seal_in_place_append_tag(
                aead::Nonce::assume_unique_for_key(nonce),
                aead::Aad::from(aad),
                &mut *buffer,
            )
            .map_err(|_| CustodyError)?;
        let mut envelope = HEADER.to_vec();
        envelope.extend_from_slice(&nonce);
        envelope.extend_from_slice(&buffer);
        Ok(envelope)
    }

    /// In-process trusted consumer only. The callback is not a sandbox: it must never return
    /// credentials, signatures, authenticated requests or secret-bearing errors to a caller.
    pub fn consume<T>(
        &self,
        binding: Binding,
        envelope: &[u8],
        operation: impl FnOnce(&[u8]) -> Result<T, CustodyError>,
    ) -> Result<T, CustodyError> {
        let offset = HEADER.len() + 12;
        if !envelope.starts_with(HEADER)
            || envelope.len() <= offset + 16
            || envelope.len() > offset + MAX_SECRET + 16
        {
            return Err(CustodyError);
        }
        let nonce: [u8; 12] = envelope[HEADER.len()..offset]
            .try_into()
            .map_err(|_| CustodyError)?;
        let mut buffer = Zeroizing::new(envelope[offset..].to_vec());
        let plaintext = self
            .0
            .open_in_place(
                aead::Nonce::assume_unique_for_key(nonce),
                aead::Aad::from(binding.aad()?),
                &mut buffer,
            )
            .map_err(|_| CustodyError)?;
        operation(plaintext)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ciphertext_is_bound_and_tampering_never_calls_consumer() {
        let key = EnvelopeKey::new(Zeroizing::new([7; 32])).unwrap();
        let binding = Binding {
            owner: Uuid::new_v4(),
            credential: Uuid::new_v4(),
            version: 1,
        };
        let blob = key
            .seal(
                binding,
                Zeroizing::new(b"synthetic-test-credential".to_vec()),
            )
            .unwrap();
        key.consume(binding, &blob, |secret| {
            assert_eq!(secret, b"synthetic-test-credential");
            Ok(())
        })
        .unwrap();
        for bad in [
            Binding {
                owner: Uuid::new_v4(),
                ..binding
            },
            Binding {
                credential: Uuid::new_v4(),
                ..binding
            },
            Binding {
                version: 2,
                ..binding
            },
        ] {
            assert_eq!(
                key.consume(bad, &blob, |_| -> Result<(), CustodyError> {
                    panic!("unauthenticated plaintext")
                }),
                Err(CustodyError)
            );
        }
        for index in 0..blob.len() {
            let mut altered = blob.clone();
            altered[index] ^= 1;
            assert_eq!(
                key.consume(binding, &altered, |_| -> Result<(), CustodyError> {
                    panic!("tampering accepted")
                }),
                Err(CustodyError)
            );
        }
        let wrong = EnvelopeKey::new(Zeroizing::new([8; 32])).unwrap();
        assert_eq!(wrong.consume(binding, &blob, |_| Ok(())), Err(CustodyError));
        assert!(
            key.seal(binding, Zeroizing::new(vec![0; MAX_SECRET + 1]))
                .is_err()
        );
        assert!(
            key.consume(binding, &blob[..blob.len() - 1], |_| Ok(()))
                .is_err()
        );
    }
}
