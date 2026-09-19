use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// An observed connection precondition, never a grant of authority or caller identity.
/// Core authenticates the human and checks this inside its serialized transaction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OwnerBinding {
    pub environment_id: Uuid,
    pub firm_id: Uuid,
    pub principal_id: Uuid,
    pub serving_generation: Uuid,
}

pub const OWNER_BINDING_HEADER: &str = "x-ouro-owner-binding";
