//! Additional host-selected restrictions; never authenticates or grants application access.
use anyhow::{Result, ensure};
use serde::Deserialize;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InspectionConfig {
    pub observer_fingerprints: Vec<String>,
    pub expires_unix_seconds: u64,
}
#[derive(Clone)]
pub struct InspectionGate {
    fingerprints: Vec<String>,
    deadline: Instant,
    expires: u64,
}
impl InspectionConfig {
    pub fn activate(self) -> Result<InspectionGate> {
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let remaining = self.expires_unix_seconds.saturating_sub(now);
        ensure!(
            (1..=3600).contains(&remaining),
            "explicit inspection expiry within one hour required"
        );
        ensure!(
            !self.observer_fingerprints.is_empty()
                && self.observer_fingerprints.len() <= 8
                && self.observer_fingerprints.iter().all(|f| f.len() == 64
                    && f.bytes()
                        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))),
            "bounded observer fingerprints required"
        );
        Ok(InspectionGate {
            fingerprints: self.observer_fingerprints,
            deadline: Instant::now() + Duration::from_secs(remaining),
            expires: self.expires_unix_seconds,
        })
    }
}
impl InspectionGate {
    pub fn permits(&self, fingerprint: &str, method: &str, path: &str, has_query: bool) -> bool {
        let unexpired = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .is_ok_and(|n| n.as_secs() < self.expires)
            && Instant::now() < self.deadline;
        unexpired
            && self.fingerprints.iter().any(|f| f == fingerprint)
            && method == "GET"
            && path == "/conditions"
            && !has_query
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn inspection_is_an_expiring_allowlist_not_a_general_read_route() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let mut gate = InspectionConfig {
            observer_fingerprints: vec!["a".repeat(64)],
            expires_unix_seconds: now + 60,
        }
        .activate()
        .unwrap();
        assert!(gate.permits(&"a".repeat(64), "GET", "/conditions", false));
        for (method, path, query) in [
            ("POST", "/conditions", false),
            ("GET", "/events", false),
            ("GET", "/conditions", true),
            ("POST", "/executions", false),
            ("GET", "/conditions/", false),
        ] {
            assert!(!gate.permits(&"a".repeat(64), method, path, query));
        }
        assert!(!gate.permits(&"b".repeat(64), "GET", "/conditions", false));
        gate.deadline = Instant::now();
        assert!(!gate.permits(&"a".repeat(64), "GET", "/conditions", false));
    }
}
