//! Serialized fingerprints must remain compatible across digest-library upgrades.
use ouroboros_transport::fingerprint;

#[test]
fn fingerprints_preserve_lowercase_fixed_width_sha256() {
    for (bytes, expected) in [
        (
            &b""[..],
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        ),
        (
            &b"abc"[..],
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        ),
        (
            &b"hello"[..],
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        ),
    ] {
        assert_eq!(fingerprint(bytes), expected);
    }
}
