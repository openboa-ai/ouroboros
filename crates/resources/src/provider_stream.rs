//! Bounded literal-secret exclusion across arbitrary transport chunk boundaries.
use crate::credential_envelope::CustodyError;

pub(crate) struct SafeChunks<'a> {
    secret: &'a [u8],
    pending: Vec<u8>,
    seen: usize,
    limit: usize,
}
impl<'a> SafeChunks<'a> {
    pub(crate) fn new(secret: &'a [u8], limit: usize) -> Result<Self, CustodyError> {
        if secret.is_empty() || limit == 0 {
            return Err(CustodyError);
        }
        Ok(Self {
            secret,
            pending: Vec::new(),
            seen: 0,
            limit,
        })
    }
    pub(crate) fn push(&mut self, chunk: &[u8]) -> Result<Vec<u8>, CustodyError> {
        self.seen = self.seen.checked_add(chunk.len()).ok_or(CustodyError)?;
        if self.seen > self.limit {
            return Err(CustodyError);
        }
        self.pending.extend_from_slice(chunk);
        if self
            .pending
            .windows(self.secret.len())
            .any(|part| part == self.secret)
        {
            return Err(CustodyError);
        }
        // Retain every byte that could still begin a credential crossing the next boundary.
        let ready = self.pending.len().saturating_sub(self.secret.len() - 1);
        Ok(self.pending.drain(..ready).collect())
    }
    pub(crate) fn finish(self) -> Vec<u8> {
        self.pending
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_reflection_split_is_rejected_before_credential_bytes_escape() {
        let secret = b"synthetic-bearer";
        let mut body = b"safe prefix\n".to_vec();
        body.extend(secret);
        body.extend(b"suffix");
        for width in 1..=body.len() {
            let mut guard = SafeChunks::new(secret, body.len()).unwrap();
            let mut output = Vec::new();
            let mut rejected = false;
            for chunk in body.chunks(width) {
                match guard.push(chunk) {
                    Ok(bytes) => output.extend(bytes),
                    Err(_) => {
                        rejected = true;
                        break;
                    }
                }
            }
            assert!(rejected);
            assert!(b"safe prefix\n".starts_with(&output));
        }
    }
    #[test]
    fn native_bytes_survive_all_splits_and_exact_bound() {
        let body = "data: {\"text\":\"안녕\"}\n\n".as_bytes();
        for width in 1..=body.len() {
            let mut guard = SafeChunks::new(b"synthetic-bearer", body.len()).unwrap();
            let mut output = Vec::new();
            for chunk in body.chunks(width) {
                output.extend(guard.push(chunk).unwrap());
            }
            output.extend(guard.finish());
            assert_eq!(output, body);
        }
        let mut guard = SafeChunks::new(b"x", 2).unwrap();
        assert_eq!(guard.push(b"ab").unwrap(), b"ab");
        assert!(guard.push(b"c").is_err());
    }
}

/// Preserve SSE bytes, but withhold the terminal event and anything following it until the
/// trusted worker has persisted its reply and Core completion. Not a model protocol translator.
pub struct CompletionGate {
    pending: Vec<u8>,
    terminal: bool,
}
impl Default for CompletionGate {
    fn default() -> Self {
        Self::new()
    }
}
impl CompletionGate {
    pub fn new() -> Self {
        Self {
            pending: Vec::new(),
            terminal: false,
        }
    }
    pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<u8>, CustodyError> {
        if self.pending.len().saturating_add(bytes.len()) > 2097152 {
            return Err(CustodyError);
        }
        self.pending.extend_from_slice(bytes);
        let mut ready = Vec::new();
        while !self.terminal {
            let lf = self
                .pending
                .windows(2)
                .position(|v| v == b"\n\n")
                .map(|i| i + 2);
            let crlf = self
                .pending
                .windows(4)
                .position(|v| v == b"\r\n\r\n")
                .map(|i| i + 4);
            let end = match (lf, crlf) {
                (Some(a), Some(b)) => a.min(b),
                (Some(a), None) | (None, Some(a)) => a,
                (None, None) => break,
            };
            let event = std::str::from_utf8(&self.pending[..end]).map_err(|_| CustodyError)?;
            let data = event
                .lines()
                .filter_map(|line| {
                    line.strip_prefix("data:")
                        .map(|v| v.strip_prefix(' ').unwrap_or(v))
                })
                .collect::<Vec<_>>()
                .join("\n");
            let terminal = |kind: &str| {
                matches!(
                    kind,
                    "response.completed" | "response.failed" | "response.incomplete"
                )
            };
            self.terminal = event.lines().any(|line| {
                line.strip_prefix("event:")
                    .is_some_and(|v| terminal(v.trim()))
            }) || serde_json::from_str::<serde_json::Value>(&data)
                .ok()
                .and_then(|v| v.get("type").and_then(|v| v.as_str()).map(terminal))
                .unwrap_or(false);
            if !self.terminal {
                ready.extend(self.pending.drain(..end));
            }
        }
        Ok(ready)
    }
    pub fn finish(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.pending)
    }
}
#[cfg(test)]
mod completion_tests {
    use super::*;
    #[test]
    fn terminal_and_trailing_events_wait_for_completion_at_every_split() {
        for ending in ["\n", "\r\n"] {
            let prefix = format!("data: {{\"type\":\"response.created\"}}{ending}{ending}");
            let tail = format!(
                "data: {{\"type\":\"response.completed\"}}{ending}{ending}: trailer{ending}{ending}"
            );
            let body = format!("{prefix}{tail}");
            for width in 1..=body.len() {
                let mut gate = CompletionGate::new();
                let mut sent = Vec::new();
                for chunk in body.as_bytes().chunks(width) {
                    sent.extend(gate.push(chunk).unwrap());
                }
                assert_eq!(sent, prefix.as_bytes());
                assert_eq!(gate.finish(), tail.as_bytes());
            }
        }
    }
}
