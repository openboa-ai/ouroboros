//! Trusted caller identity and its optional human-selected resource scope.
use axum::http::HeaderMap;
use serde::Serialize;
use uuid::Uuid;

#[derive(Clone)]
pub(crate) enum Actor {
    Human(String),
    #[cfg(target_os = "linux")]
    Instance(ouroboros_contracts::BridgeIdentity),
}
pub(crate) fn context(req: reqwest::RequestBuilder, actor: &Actor) -> reqwest::RequestBuilder {
    match actor {
        Actor::Human(f) => req.header("x-ouro-client-fingerprint", f),
        #[cfg(target_os = "linux")]
        Actor::Instance(p) => req.header(
            "x-ouro-bridge-peer",
            serde_json::to_string(p).expect("peer serializable"),
        ),
    }
}

#[derive(Clone)]
pub(crate) struct ManagementCaller {
    pub(crate) actor: Actor,
    #[cfg(target_os = "linux")]
    pub(crate) peer: Option<ouroboros_transport::InstancePeer>,
}
impl ManagementCaller {
    pub(crate) fn alive(&self) -> bool {
        #[cfg(target_os = "linux")]
        if let Some(peer) = &self.peer {
            return peer.alive();
        }
        true
    }

    pub(crate) async fn ended(&self) {
        #[cfg(target_os = "linux")]
        if let Some(peer) = &self.peer {
            while peer.alive() {
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
            return;
        }
        std::future::pending::<()>().await;
    }
}

/// Instances derive their work/delegation from the verified bridge in Core.
/// Caller-supplied scope is meaningful only for an already authenticated human.
#[derive(Clone, Copy, Serialize)]
pub(crate) struct ResourceScope {
    pub(crate) work_id: Option<Uuid>,
    pub(crate) delegation_id: Option<Uuid>,
}
impl Actor {
    pub(crate) fn is_instance(&self) -> bool {
        match self {
            Self::Human(_) => false,
            #[cfg(target_os = "linux")]
            Self::Instance(_) => true,
        }
    }
    pub(crate) fn scope(&self, headers: &HeaderMap) -> ResourceScope {
        let read = |name| {
            headers
                .get(name)
                .and_then(|v| v.to_str().ok())
                .and_then(|v| Uuid::parse_str(v).ok())
        };
        if self.is_instance() {
            ResourceScope {
                work_id: None,
                delegation_id: None,
            }
        } else {
            ResourceScope {
                work_id: read("x-ouro-work-id"),
                delegation_id: read("x-ouro-delegation-id"),
            }
        }
    }
}
