//! Bounded JSONL adapter for an already-contained native App Server channel.
//! It does not launch a host process, grant permissions, or replace the native agent loop.
use anyhow::{Result, ensure};
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader};
const FRAME_LIMIT: usize = 1_048_576;
#[derive(Clone, Copy, PartialEq, Eq)]
enum Handshake {
    New,
    Awaiting(u64),
    Acknowledged,
    Ready,
    Failed,
}
pub struct Channel<R, W> {
    reader: BufReader<R>,
    writer: W,
    next_id: u64,
    handshake: Handshake,
    partial: Vec<u8>,
}
impl<R: AsyncRead + Unpin, W: AsyncWrite + Unpin> Channel<R, W> {
    pub fn new(reader: R, writer: W) -> Self {
        Self {
            reader: BufReader::new(reader),
            writer,
            next_id: 1,
            handshake: Handshake::New,
            partial: Vec::new(),
        }
    }
    pub async fn request(&mut self, method: &str, params: Value) -> Result<u64> {
        ensure!(
            super::native_method_allowed(method) && method != "initialized",
            "native control method is not allowed"
        );
        ensure!(
            if method == "initialize" {
                self.handshake == Handshake::New
            } else {
                self.handshake == Handshake::Ready
            },
            "native handshake is not ready or initialization was already attempted"
        );
        let id = self.next_id;
        self.next_id = self
            .next_id
            .checked_add(1)
            .ok_or_else(|| anyhow::anyhow!("native request sequence exhausted"))?;
        // A partial write is uncertain: never reuse this connection for another initialization.
        if method == "initialize" {
            self.handshake = Handshake::Awaiting(id);
        }
        if let Err(error) = self
            .write_frame(json!({"id":id,"method":method,"params":params}))
            .await
        {
            self.handshake = Handshake::Failed;
            return Err(error);
        }
        Ok(id)
    }
    pub async fn initialized(&mut self) -> Result<()> {
        ensure!(
            self.handshake == Handshake::Acknowledged,
            "initialization success not confirmed"
        );
        self.handshake = Handshake::Failed;
        self.write_frame(json!({"method":"initialized"})).await?;
        self.handshake = Handshake::Ready;
        Ok(())
    }
    async fn write_frame(&mut self, frame: Value) -> Result<()> {
        let mut bytes = serde_json::to_vec(&frame)?;
        ensure!(bytes.len() < FRAME_LIMIT, "native frame exceeds bound");
        bytes.push(b'\n');
        self.writer.write_all(&bytes).await?;
        self.writer.flush().await?;
        Ok(())
    }
    pub async fn receive(&mut self) -> Result<Value> {
        ensure!(
            self.partial.len() <= FRAME_LIMIT,
            "native partial frame exceeds bound"
        );
        (&mut self.reader)
            .take((FRAME_LIMIT + 1 - self.partial.len()) as u64)
            .read_until(b'\n', &mut self.partial)
            .await?;
        let bytes = std::mem::take(&mut self.partial);
        ensure!(
            !bytes.is_empty() && bytes.len() <= FRAME_LIMIT && bytes.last() == Some(&b'\n'),
            "native channel closed or frame exceeds bound"
        );
        let frame: Value = serde_json::from_slice(&bytes)?;
        if let Handshake::Awaiting(id) = self.handshake
            && frame.get("id").and_then(Value::as_u64) == Some(id)
            && frame.get("method").is_none()
        {
            self.handshake = if frame.get("error").is_none()
                && frame.get("result").is_some_and(Value::is_object)
            {
                Handshake::Acknowledged
            } else {
                Handshake::Failed
            };
        }
        Ok(frame)
    }
}
/// Native identity is evidence inside one already-authorized execution, not authority itself.
pub struct ActiveTurn {
    thread: String,
    turn: String,
    terminal: Option<String>,
}
impl ActiveTurn {
    pub fn new(thread: &str, response: &Value) -> Result<Self> {
        let turn = response["turn"]["id"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("native turn identity missing"))?;
        ensure!(
            !thread.is_empty() && thread.len() <= 512 && !turn.is_empty() && turn.len() <= 512,
            "invalid native identity"
        );
        Ok(Self {
            thread: thread.into(),
            turn: turn.into(),
            terminal: None,
        })
    }
    pub fn observe(&mut self, frame: &Value) -> Result<Option<&str>> {
        if frame["method"] == "turn/completed" {
            let params = &frame["params"];
            ensure!(
                params["threadId"].is_string() && params["turn"]["id"].is_string(),
                "completion identity missing"
            );
            if params["threadId"] == self.thread && params["turn"]["id"] == self.turn {
                let status = params["turn"]["status"]
                    .as_str()
                    .ok_or_else(|| anyhow::anyhow!("completion status missing"))?;
                ensure!(
                    matches!(status, "completed" | "interrupted" | "failed"),
                    "unknown native terminal status"
                );
                ensure!(
                    self.terminal.as_deref().is_none_or(|old| old == status),
                    "conflicting native completion"
                );
                self.terminal = Some(status.into());
            }
        }
        Ok(self.terminal.as_deref())
    }
    pub async fn steer<R: AsyncRead + Unpin, W: AsyncWrite + Unpin>(
        &self,
        channel: &mut Channel<R, W>,
        text: &str,
    ) -> Result<u64> {
        ensure!(
            self.terminal.is_none() && !text.is_empty() && text.len() <= 65536,
            "inactive turn or invalid steering input"
        );
        channel
            .request(
                "turn/steer",
                json!({"threadId":self.thread,"expectedTurnId":self.turn,
            "input":[{"type":"text","text":text}]}),
            )
            .await
    }
    pub async fn interrupt<R: AsyncRead + Unpin, W: AsyncWrite + Unpin>(
        &self,
        channel: &mut Channel<R, W>,
    ) -> Result<u64> {
        ensure!(self.terminal.is_none(), "native turn already terminal");
        channel
            .request(
                "turn/interrupt",
                json!({"threadId":self.thread,"turnId":self.turn}),
            )
            .await
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn cancelled_receive_preserves_partial_jsonl() {
        let (a, mut b) = tokio::io::duplex(4096);
        let (ar, aw) = tokio::io::split(a);
        let mut channel = Channel::new(ar, aw);
        b.write_all(b"{\"method\":\"turn/").await.unwrap();
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(10), channel.receive())
                .await
                .is_err()
        );
        b.write_all(b"completed\",\"params\":{}}\n").await.unwrap();
        assert_eq!(channel.receive().await.unwrap()["method"], "turn/completed");
    }
    #[tokio::test]
    async fn turn_controls_and_completion_stay_on_original_identity() {
        let (a, b) = tokio::io::duplex(4096);
        let (ar, aw) = tokio::io::split(a);
        let (br, bw) = tokio::io::split(b);
        let mut channel = Channel::new(ar, aw);
        channel.handshake = Handshake::Ready;
        let mut peer = Channel::new(br, bw);
        let mut turn = ActiveTurn::new("thread-a", &json!({"turn":{"id":"turn-a"}})).unwrap();
        turn.steer(&mut channel, "continue").await.unwrap();
        let steer = peer.receive().await.unwrap();
        assert_eq!(steer["params"]["expectedTurnId"], "turn-a");
        assert_eq!(steer["params"]["threadId"], "thread-a");
        turn.interrupt(&mut channel).await.unwrap();
        assert_eq!(peer.receive().await.unwrap()["params"]["turnId"], "turn-a");
        assert!(
            turn.observe(&json!({"id":2,"result":{}}))
                .unwrap()
                .is_none()
        );
        let mut event = json!({"method":"turn/completed","params":{"threadId":"thread-b","turn":{"id":"turn-a","status":"completed"}}});
        assert!(turn.observe(&event).unwrap().is_none());
        event["params"]["threadId"] = json!("thread-a");
        event["params"]["turn"]["id"] = json!("turn-b");
        assert!(turn.observe(&event).unwrap().is_none());
        event["params"]["turn"]["id"] = json!("turn-a");
        event["params"]["turn"]["status"] = json!("interrupted");
        assert_eq!(turn.observe(&event).unwrap(), Some("interrupted"));
        assert!(turn.interrupt(&mut channel).await.is_err());
        assert!(turn.steer(&mut channel, "again").await.is_err());
        event["params"]["turn"]["status"] = json!("completed");
        assert!(turn.observe(&event).is_err());
        assert!(ActiveTurn::new("thread-a", &json!({"turn":{}})).is_err());
    }
    #[tokio::test]
    async fn native_channel_preserves_ids_events_and_denies_login() {
        let (a, b) = tokio::io::duplex(4096);
        let (ar, aw) = tokio::io::split(a);
        let (br, bw) = tokio::io::split(b);
        let mut outer = Channel::new(ar, aw);
        let mut fixture = Channel::new(br, bw);
        assert!(
            outer
                .request("account/login/start", json!({"type":"chatgpt"}))
                .await
                .is_err()
        );
        let id = outer
            .request(
                "initialize",
                json!({"clientInfo":{"name":"ouroboros","version":"0.1.0"}}),
            )
            .await
            .unwrap();
        let input = fixture.receive().await.unwrap();
        assert_eq!(input["id"], id);
        assert_eq!(input["method"], "initialize");
        fixture
            .write_frame(json!({"id":id,"result":{"userAgent":"fixture"}}))
            .await
            .unwrap();
        assert_eq!(
            outer.receive().await.unwrap()["result"]["userAgent"],
            "fixture"
        );
        outer.initialized().await.unwrap();
        assert_eq!(fixture.receive().await.unwrap()["method"], "initialized");
        assert!(outer.initialized().await.is_err());
        assert!(outer.request("initialize", json!({})).await.is_err());
        outer.request("thread/start", json!({})).await.unwrap();
        assert_eq!(fixture.receive().await.unwrap()["method"], "thread/start");
        fixture
            .write_frame(
                json!({"method":"turn/completed","params":{"turn":{"status":"interrupted"}}}),
            )
            .await
            .unwrap();
        assert_eq!(
            outer.receive().await.unwrap()["params"]["turn"]["status"],
            "interrupted"
        );
    }
    #[tokio::test]
    async fn handshake_rejects_early_calls_and_failed_or_unrelated_acknowledgements() {
        let (a, b) = tokio::io::duplex(4096);
        let (ar, aw) = tokio::io::split(a);
        let (br, bw) = tokio::io::split(b);
        let mut outer = Channel::new(ar, aw);
        let mut fixture = Channel::new(br, bw);
        assert!(outer.request("thread/start", json!({})).await.is_err());
        assert!(outer.initialized().await.is_err());
        let id = outer.request("initialize", json!({})).await.unwrap();
        fixture.receive().await.unwrap();
        fixture
            .write_frame(json!({"id":id+1,"result":{}}))
            .await
            .unwrap();
        outer.receive().await.unwrap();
        assert!(outer.initialized().await.is_err());
        fixture
            .write_frame(json!({"id":id,"error":{"code":-1,"message":"rejected"}}))
            .await
            .unwrap();
        outer.receive().await.unwrap();
        assert!(outer.initialized().await.is_err());
        assert!(outer.request("initialize", json!({})).await.is_err());
        assert!(outer.request("thread/start", json!({})).await.is_err());
    }
}
