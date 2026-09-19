//! Trusted caller identity and its optional human-selected resource scope.
use axum::http::HeaderMap;
use serde::Serialize;
use uuid::Uuid;

#[derive(Clone)]
pub(crate) enum Actor {
    Human(String),
    BoundHuman(String, ouroboros_contracts::OwnerBinding),
    #[cfg(target_os = "linux")]
    Instance(ouroboros_contracts::BridgeIdentity),
}
pub(crate) fn context(req: reqwest::RequestBuilder, actor: &Actor) -> reqwest::RequestBuilder {
    match actor {
        Actor::Human(f) => req.header("x-ouro-client-fingerprint", f),
        Actor::BoundHuman(f, binding) => req.header("x-ouro-client-fingerprint", f).header(
            ouroboros_contracts::OWNER_BINDING_HEADER,
            serde_json::to_string(binding).expect("binding serializable"),
        ),
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
    /// The optional header can restrict an authenticated human; it never selects that human.
    pub(crate) fn with_owner_binding(
        self,
        headers: &HeaderMap,
    ) -> Result<Self, axum::http::StatusCode> {
        use axum::http::StatusCode;
        let name = ouroboros_contracts::OWNER_BINDING_HEADER;
        if headers.get_all(name).iter().count() > 1 {
            return Err(StatusCode::BAD_REQUEST);
        }
        let Some(value) = headers.get(name) else {
            return Ok(self);
        };
        if value.as_bytes().len() > 1024 {
            return Err(StatusCode::BAD_REQUEST);
        }
        let Self::Human(fingerprint) = self else {
            return Err(StatusCode::FORBIDDEN);
        };
        let binding =
            serde_json::from_slice(value.as_bytes()).map_err(|_| StatusCode::BAD_REQUEST)?;
        Ok(Self::BoundHuman(fingerprint, binding))
    }

    pub(crate) fn is_instance(&self) -> bool {
        match self {
            Self::Human(_) | Self::BoundHuman(_, _) => false,
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

#[cfg(test)]
mod owner_binding_tests {
    use super::*;
    use ouroboros_contracts::{OWNER_BINDING_HEADER, OwnerBinding};
    fn binding() -> OwnerBinding {
        OwnerBinding {
            environment_id: Uuid::new_v4(),
            firm_id: Uuid::new_v4(),
            principal_id: Uuid::new_v4(),
            serving_generation: Uuid::new_v4(),
        }
    }
    #[test]
    fn binding_preserves_transport_identity_and_is_forwarded_to_core() {
        let binding = binding();
        let mut incoming = HeaderMap::new();
        incoming.insert(
            OWNER_BINDING_HEADER,
            serde_json::to_string(&binding).unwrap().parse().unwrap(),
        );
        incoming.insert("x-ouro-client-fingerprint", "forged".parse().unwrap());
        let actor = Actor::Human("authenticated".into())
            .with_owner_binding(&incoming)
            .unwrap();
        let request = context(
            reqwest::Client::new().get("https://core.example/conditions"),
            &actor,
        )
        .build()
        .unwrap();
        assert_eq!(
            request.headers()["x-ouro-client-fingerprint"],
            "authenticated"
        );
        let observed: OwnerBinding =
            serde_json::from_slice(request.headers()[OWNER_BINDING_HEADER].as_bytes()).unwrap();
        assert_eq!(observed, binding);
        assert!(!actor.is_instance());
    }
    #[test]
    fn ambiguous_malformed_or_extended_bindings_fail_closed() {
        let mut incoming = HeaderMap::new();
        for value in [
            "{}",
            "not-json",
            &format!("{}x", serde_json::to_string(&binding()).unwrap()),
        ] {
            incoming.insert(OWNER_BINDING_HEADER, value.parse().unwrap());
            assert!(
                Actor::Human("authenticated".into())
                    .with_owner_binding(&incoming)
                    .is_err()
            );
        }
        let encoded = serde_json::to_string(&binding()).unwrap();
        incoming.insert(OWNER_BINDING_HEADER, encoded.parse().unwrap());
        incoming.append(OWNER_BINDING_HEADER, encoded.parse().unwrap());
        assert!(
            Actor::Human("authenticated".into())
                .with_owner_binding(&incoming)
                .is_err()
        );
    }
}
