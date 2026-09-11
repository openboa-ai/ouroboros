//! One explicit, bounded configuration input. Loading never activates authority or discovers peers.
use anyhow::{Context, Result, ensure};
use serde::{
    Deserialize,
    de::{self, DeserializeOwned, MapAccess, SeqAccess, Visitor},
};
use serde_json::Value;
use std::{
    fmt,
    io::Read,
    path::{Component, Path, PathBuf},
};

const MAX_CONFIG_BYTES: u64 = 1024 * 1024;

#[derive(Debug)]
pub struct ConfigRoot(PathBuf);

impl ConfigRoot {
    /// Resolve deployment locators once, before a service accesses dependencies. This is not
    /// a storage identity/ownership check; the owning backend still enforces that boundary.
    pub fn resolve(&self, path: &mut PathBuf) -> Result<()> {
        ensure!(!path.as_os_str().is_empty(), "empty configuration path");
        // Parent traversal across a symlink cannot be normalized lexically without changing
        // its meaning. Use an explicit absolute locator for roots outside this directory.
        ensure!(
            !path.components().any(|c| matches!(c, Component::ParentDir)),
            "configuration paths cannot contain parent traversal"
        );
        let joined = if path.is_absolute() {
            path.clone()
        } else {
            self.0.join(&*path)
        };
        *path = joined.components().collect();
        ensure!(
            path.is_absolute(),
            "absolute resolved configuration path required"
        );
        Ok(())
    }
}

pub fn load<T: DeserializeOwned>(path: &Path) -> Result<(T, ConfigRoot)> {
    let selected = path
        .canonicalize()
        .context("configuration file unavailable")?;
    let bytes = read_regular(&selected, MAX_CONFIG_BYTES)?;
    // serde_json::Value normally discards duplicate keys. Reject them at every nesting level
    // before typed validation, including dynamic maps such as worker target bindings.
    let strict: UniqueValue = serde_json::from_slice(&bytes)
        .map_err(|_| anyhow::anyhow!("invalid or duplicate configuration fields"))?;
    let config = serde_json::from_value(strict.0)
        .map_err(|_| anyhow::anyhow!("invalid configuration structure"))?;
    let parent = selected
        .parent()
        .context("configuration directory required")?
        .to_path_buf();
    Ok((config, ConfigRoot(parent)))
}

/// A FIFO, device or directory is not a configuration/credential file. In particular, opening a
/// FIFO must not wait for a writer before the file-type check can run.
pub fn read_regular(path: &Path, max_bytes: u64) -> Result<Vec<u8>> {
    let mut options = std::fs::OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NONBLOCK);
    }
    let file = options.open(path).context("input file unavailable")?;
    ensure!(file.metadata()?.is_file(), "regular input file required");
    let mut bytes = Vec::new();
    file.take(max_bytes.saturating_add(1))
        .read_to_end(&mut bytes)?;
    ensure!(
        bytes.len() as u64 <= max_bytes,
        "input file size limit exceeded"
    );
    Ok(bytes)
}

/// SQLx's DSN parser inherits PG* values and can consult .pgpass. Reject ambient connection
/// settings and require complete credentials/target/TLS policy before the parser sees the URL.
/// No global process environment is mutated, and invalid values are never included in errors.
pub fn postgres_url_file(path: &Path) -> Result<String> {
    ensure!(
        !std::env::vars_os().any(|(key, _)| key.to_string_lossy().starts_with("PG")),
        "ambient PostgreSQL settings are not accepted; use the explicit deployment binding"
    );
    let bytes = read_regular(path, 65536)?;
    let value = std::str::from_utf8(&bytes)
        .context("database configuration must be UTF-8")?
        .trim();
    validate_postgres_url(value)?;
    Ok(value.to_owned())
}

fn validate_postgres_url(value: &str) -> Result<()> {
    let url =
        reqwest::Url::parse(value).map_err(|_| anyhow::anyhow!("invalid database binding"))?;
    let host = url.host_str().unwrap_or_default();
    let db = url.path().strip_prefix('/').unwrap_or_default();
    ensure!(
        matches!(url.scheme(), "postgres" | "postgresql")
            && !host.is_empty()
            && !host.contains(['%', '/', '\\'])
            && url.port().is_some_and(|p| p > 0)
            && !url.username().is_empty()
            && url.password().is_some_and(|p| !p.is_empty())
            && !db.is_empty()
            && db.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_')
            && url.fragment().is_none(),
        "complete explicit database binding required"
    );
    let mut query = std::collections::HashMap::new();
    for (key, val) in url.query_pairs() {
        ensure!(
            matches!(key.as_ref(), "sslmode" | "sslrootcert")
                && query.insert(key.into_owned(), val.into_owned()).is_none(),
            "unsupported or duplicate database option"
        );
    }
    match query.get("sslmode").map(String::as_str) {
        Some("disable") => ensure!(
            matches!(host, "localhost" | "127.0.0.1" | "[::1]") && query.len() == 1,
            "unencrypted database binding is limited to the explicit local profile"
        ),
        Some("verify-full") => {
            let cert = query
                .get("sslrootcert")
                .context("explicit database TLS trust required")?;
            ensure!(
                Path::new(cert).is_absolute(),
                "database trust path must be absolute"
            );
            read_regular(Path::new(cert), MAX_CONFIG_BYTES)?;
        }
        _ => anyhow::bail!("explicit non-fallback database TLS mode required"),
    }
    Ok(())
}

struct UniqueValue(Value);
impl<'de> Deserialize<'de> for UniqueValue {
    fn deserialize<D: de::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct Strict;
        impl<'de> Visitor<'de> for Strict {
            type Value = UniqueValue;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("unique-key JSON")
            }
            fn visit_bool<E: de::Error>(self, v: bool) -> Result<UniqueValue, E> {
                Ok(UniqueValue(v.into()))
            }
            fn visit_i64<E: de::Error>(self, v: i64) -> Result<UniqueValue, E> {
                Ok(UniqueValue(v.into()))
            }
            fn visit_u64<E: de::Error>(self, v: u64) -> Result<UniqueValue, E> {
                Ok(UniqueValue(v.into()))
            }
            fn visit_f64<E: de::Error>(self, v: f64) -> Result<UniqueValue, E> {
                serde_json::Number::from_f64(v)
                    .map(|n| UniqueValue(n.into()))
                    .ok_or_else(|| E::custom("non-finite number"))
            }
            fn visit_str<E: de::Error>(self, v: &str) -> Result<UniqueValue, E> {
                Ok(UniqueValue(v.into()))
            }
            fn visit_string<E: de::Error>(self, v: String) -> Result<UniqueValue, E> {
                Ok(UniqueValue(v.into()))
            }
            fn visit_unit<E: de::Error>(self) -> Result<UniqueValue, E> {
                Ok(UniqueValue(Value::Null))
            }
            fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<UniqueValue, A::Error> {
                let mut values = Vec::new();
                while let Some(v) = a.next_element::<UniqueValue>()? {
                    values.push(v.0);
                }
                Ok(UniqueValue(Value::Array(values)))
            }
            fn visit_map<A: MapAccess<'de>>(self, mut a: A) -> Result<UniqueValue, A::Error> {
                let mut values = serde_json::Map::new();
                while let Some(key) = a.next_key::<String>()? {
                    if values.contains_key(&key) {
                        return Err(de::Error::custom("duplicate field"));
                    }
                    values.insert(key, a.next_value::<UniqueValue>()?.0);
                }
                Ok(UniqueValue(Value::Object(values)))
            }
        }
        deserializer.deserialize_any(Strict)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Example {
        path: PathBuf,
        targets: HashMap<String, String>,
    }
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
            let p = std::env::temp_dir().join(format!(
                "ouro-config-{}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            ));
            std::fs::create_dir(&p).unwrap();
            Self(p)
        }
        fn write(&self, text: &str) -> PathBuf {
            let p = self.0.join("candidate.json");
            std::fs::write(&p, text).unwrap();
            p
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    #[test]
    fn independent_config_roots_resolve_without_cwd_or_home_discovery() {
        for f in [Fixture::new(), Fixture::new()] {
            let p =
                f.write(r#"{"path":"data/receipt","targets":{"core":"https://localhost:1234"}}"#);
            let (mut cfg, base) = load::<Example>(&p).unwrap();
            base.resolve(&mut cfg.path).unwrap();
            assert_eq!(cfg.path, f.0.canonicalize().unwrap().join("data/receipt"));
            assert_eq!(cfg.targets.len(), 1);
            assert!(!cfg.path.exists(), "resolution must not create storage");
        }
    }
    #[test]
    fn ambiguous_missing_unknown_and_secret_bearing_invalid_inputs_fail() {
        let f = Fixture::new();
        for value in [
            r#"{"path":"a","path":"b","targets":{}}"#,
            r#"{"path":"a","targets":{"core":"first","core":"second"}}"#,
            r#"{"targets":{}}"#,
            r#"{"path":"a","targets":{},"override":"secret-canary"}"#,
            r#"{"path":123,"targets":{}}"#,
        ] {
            let error = load::<Example>(&f.write(value)).err().unwrap().to_string();
            assert!(!error.contains("secret-canary"));
        }
        assert!(load::<Example>(&f.0.join("absent")).is_err());
        assert_eq!(std::fs::read_dir(&f.0).unwrap().count(), 1);
    }
    #[test]
    fn bounded_input_and_unambiguous_paths() {
        let f = Fixture::new();
        assert!(load::<Example>(&f.write(&" ".repeat(MAX_CONFIG_BYTES as usize + 1))).is_err());
        let base = ConfigRoot(f.0.clone());
        for invalid in ["", "../data", "data/../elsewhere", "/data/../elsewhere"] {
            assert!(base.resolve(&mut PathBuf::from(invalid)).is_err());
        }
        let mut absolute = f.0.join("other");
        base.resolve(&mut absolute).unwrap();
        assert_eq!(absolute, f.0.join("other"));
    }

    #[cfg(unix)]
    #[test]
    fn fifo_is_rejected_without_waiting_for_a_writer() {
        use std::os::unix::ffi::OsStrExt;
        let f = Fixture::new();
        let path = f.0.join("fifo");
        let name = std::ffi::CString::new(path.as_os_str().as_bytes()).unwrap();
        assert_eq!(unsafe { libc::mkfifo(name.as_ptr(), 0o600) }, 0);
        assert!(read_regular(&path, 128).is_err());
        assert!(load::<Example>(&path).is_err());
    }

    #[test]
    fn database_binding_rejects_defaults_overrides_and_tls_fallback() {
        assert!(
            validate_postgres_url(
                "postgresql://worker:explicit@127.0.0.1:5438/catalog?sslmode=disable"
            )
            .is_ok()
        );
        for value in [
            "postgresql:///catalog",
            "postgresql://worker@127.0.0.1:5438/catalog?sslmode=disable",
            "postgresql://worker:explicit@127.0.0.1/catalog?sslmode=disable",
            "postgresql://worker:explicit@127.0.0.1:5438/catalog",
            "postgresql://worker:explicit@127.0.0.1:5438/catalog?sslmode=prefer",
            "postgresql://worker:explicit@127.0.0.1:5438/catalog?sslmode=disable&host=elsewhere",
            "postgresql://worker:explicit@127.0.0.1:5438/catalog?sslmode=disable&sslmode=disable",
            "postgresql://worker:explicit@database.invalid:5438/catalog?sslmode=disable",
        ] {
            assert!(validate_postgres_url(value).is_err());
        }
    }
}
