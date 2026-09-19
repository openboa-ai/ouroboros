//! A Runtime claim precondition and read-only recovery record, never execution authority.
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const RUNTIME_CLAIM_HEADER: &str = "x-ouro-runtime-claim";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RuntimeClaimContext {
    pub environment_id: Uuid,
    pub firm_id: Uuid,
    pub serving_generation: Uuid,
    pub worker_id: String,
    pub intent_id: Uuid,
    pub execution_id: Uuid,
    pub profile_id: String,
}
impl RuntimeClaimContext {
    /// An ordinary Core restart changes the admission precondition, not historical identity.
    pub fn same_record(&self, other: &Self) -> bool {
        self.environment_id == other.environment_id
            && self.firm_id == other.firm_id
            && self.worker_id == other.worker_id
            && self.intent_id == other.intent_id
            && self.execution_id == other.execution_id
            && self.profile_id == other.profile_id
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RuntimeClaimObservation {
    pub context: RuntimeClaimContext,
    pub intent_state: String,
    pub claim: Option<RuntimeClaimAssignment>,
    /// Core proved that this original execution was canceled before any dispatch and
    /// settled its compute reservation. An absent assignment alone is not proof.
    #[serde(default)]
    pub never_dispatched: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RuntimeClaimAssignment {
    pub attempt_id: Uuid,
    pub instance_id: Uuid,
    pub generation: Uuid,
    pub phase: String,
    pub terminated: bool,
    /// Core has accepted the assigned Runtime's exact compute-return receipt.
    /// This says nothing about company results or external obligations.
    pub capacity_returned: bool,
}
impl RuntimeClaimObservation {
    pub fn slot_released(&self) -> bool {
        self.claim.as_ref().is_some_and(|claim| {
            claim.phase == "terminated" && claim.terminated && claim.capacity_returned
        })
    }
}
