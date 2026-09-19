mod service_call;
mod service_continuation;
use serde::{Deserialize, Serialize};
use serde_json::Value;
pub use service_call::*;
pub use service_continuation::*;
use uuid::Uuid;
mod program;
pub use program::*;
mod owner_binding;
pub use owner_binding::*;
mod runtime_claim;
pub use runtime_claim::*;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IntentState {
    Accepted,
    Claimed,
    Succeeded,
    Unresolved,
    Restricted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorkRequest {
    pub delegation_id: Uuid,
    pub purpose: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_work_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExecutionRequest {
    pub work_id: Uuid,
    pub delegation_id: Uuid,
    pub profile_id: String,
    pub units: i64,
    pub lifetime_seconds: i64,
    pub predecessor_execution_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_delegation_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub program: Option<ProgramRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RevisionRequest {
    pub expected_revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Accepted {
    pub intent_id: Uuid,
    pub resource_id: Uuid,
    pub state: IntentState,
    pub replayed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusEvent {
    pub sequence: i64,
    pub source: String,
    pub kind: String,
    pub resource_id: Uuid,
    pub data: Value,
}

pub fn request_key(value: &str) -> anyhow::Result<&str> {
    anyhow::ensure!(
        !value.is_empty() && value.len() <= 128 && value.bytes().all(|b| b.is_ascii_graphic()),
        "invalid request key"
    );
    Ok(value)
}

/// Trusted Runtime reports; never accepted from a private request body.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct BridgeIdentity {
    pub pid: i32,
    pub uid: u32,
    pub start_ticks: u64,
    pub boot_id: String,
}
/// Kernel allocation captured by the assigned Runtime before private release.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct AllocationIdentity {
    pub boot_id: Uuid,
    pub device: u64,
    pub inode: u64,
    pub events_inode: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RuntimeBinding {
    /// Absent only in historical records; new binding admission requires it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allocation: Option<AllocationIdentity>,
    pub container_id: String,
    pub peer: BridgeIdentity,
    pub deadline_boottime_ns: u64,
}
/// Reports from the assigned external Runtime, not private payload completion.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AllocationClosure {
    Empty,
    Deactivated,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ComputeReturnReceipt {
    pub instance_id: Uuid,
    pub generation: Uuid,
    pub binding: RuntimeBinding,
    pub cgroup: AllocationClosure,
    pub container_terminated: bool,
    pub bridge_terminated: bool,
    pub guard_terminated: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RuntimeTicket {
    pub execution_id: Uuid,
    pub intent_id: Uuid,
    pub attempt_id: Uuid,
    pub instance_id: Uuid,
    pub generation: Uuid,
    pub input: ExecutionRequest,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub program: Option<ProgramTicket>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResourceRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service_request_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effect_slot: Option<String>,
    pub target: String,
    pub operation: String,
    pub request_key: String,
    pub input: Value,
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ResourceReply {
    pub status: u16,
    pub content_type: String,
    pub body: String,
    pub receipt: Value,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceAdmission {
    pub operation: String,
    pub intent_id: Uuid,
    pub state: String,
    pub target: String,
    pub reply: Option<ResourceReply>,
    /// Fixed upload metadata, never proof that bytes have arrived or a new dispatch grant.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upload: Option<UploadDescriptor>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace: Option<WorkspaceBinding>,
}
/// Server-assigned allocation identity, separate from frozen target configuration.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct WorkspaceBinding {
    pub workspace_id: Uuid,
    pub namespace_id: Uuid,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorkspaceQuery {
    pub target_id: String,
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub cursor: Option<String>,
}
/// An explicit registered policy for ordinary material-reference retirement.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RetirementPolicy {
    pub id: Uuid,
    pub revision: u64,
    pub min_retention_seconds: u64,
    pub allowed: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum RetirementTarget {
    Upload {
        upload_id: Uuid,
    },
    Revision {
        workspace_id: Uuid,
        revision: i64,
    },
    WorkspaceClose {
        workspace_id: Uuid,
        expected_revision: i64,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RetirementRequest {
    pub target: RetirementTarget,
    pub reason: String,
    pub policy_id: Uuid,
    pub policy_revision: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RetirementRecord {
    pub intent_id: Uuid,
    pub target: RetirementTarget,
    pub policy_id: Uuid,
    pub policy_revision: u64,
    pub disposition: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct CollectionRequest {
    pub upload_id: Uuid,
    pub reason: String,
    pub policy_id: Uuid,
    pub policy_revision: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct CollectionBinding {
    pub upload_id: Uuid,
    pub object_id: Uuid,
    pub store_id: Uuid,
    pub generation: Uuid,
    pub sha256: String,
    pub size: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct CollectionRecord {
    pub intent_id: Uuid,
    pub binding: CollectionBinding,
    pub policy_id: Uuid,
    pub policy_revision: u64,
    /// Either removed or observed_absence, never a claim of which process performed an unknown unlink.
    pub confirmation: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectionAdvanceRequest {
    pub request_key: String,
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectionAdvance {
    pub intent_id: Uuid,
    pub step_id: Uuid,
    pub sequence: i64,
    pub target: String,
    pub state: String,
    /// Only the newly issued response may initiate its one worker claim.
    pub dispatch_allowed: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectionTicket {
    pub resource: ResourceTicket,
    pub step_id: Uuid,
    pub sequence: i64,
    pub binding: CollectionBinding,
    pub policy: RetirementPolicy,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectionStepResult {
    pub intent_id: Uuid,
    pub step_id: Uuid,
    pub state: String,
    pub reply: Option<ResourceReply>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UploadDescriptor {
    pub sha256: String,
    pub size: u64,
    /// Local transfer cap; Core separately checks the original absolute admission expiry.
    pub timeout_seconds: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceTicket {
    pub firm_id: Uuid,
    pub intent_id: Uuid,
    pub attempt_id: Uuid,
    pub work_id: Uuid,
    pub target: String,
    pub operation: String,
    pub input: Value,
    pub configuration: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace: Option<WorkspaceBinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "operation", content = "selector", deny_unknown_fields)]
pub enum CredentialRecoveryTicket {
    #[serde(rename = "credential.enroll")]
    Enrollment(EnrollmentRecoveryTicket),
    #[serde(rename = "credential.disable")]
    Disable(CredentialDisableTicket),
}

/// A fixed-provider credential-version proposal, not activation or permission to use it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConnectionCandidateRequest {
    pub target: String,
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub expected_credential_version: u64,
    pub enrollment_intent_id: Uuid,
}

/// An attributable review recommendation, never operating acceptance or activation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConnectionReviewRequest {
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub recommendation: String,
    pub rationale: String,
    pub evidence_intent_ids: Vec<Uuid>,
}

/// Explicit bounded verification scope, not an operating qualification.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConnectionAcceptanceRequest {
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub review_id: Uuid,
    pub max_calls: u32,
    pub lifetime_seconds: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConnectionActivationRequest {
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub acceptance_id: Uuid,
}

/// Restrict one exact activation; never implicitly stop its successor.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConnectionStopRequest {
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub activation_id: Uuid,
}

/// Register retained contained program material; no tool exposure or execution authority.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AdapterSubmissionRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service_operation: Option<ServiceOperationPlan>,
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub target: String,
    pub source_execution_id: Uuid,
}

/// Attributed assessment of one observed verification; never grants tool use.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AdapterEvaluationRequest {
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub verification_execution_id: Uuid,
    pub conclusion: String,
    pub criteria: String,
    pub rationale: String,
    pub limitations: String,
}

/// Explicit bounded acceptance of a frozen adapter and an attributed evaluation.
/// This record alone does not activate the adapter or delegate invocation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AdapterAcceptanceRequest {
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub evaluation_id: Uuid,
    pub max_calls: u32,
    pub lifetime_seconds: u32,
    pub rationale: String,
    pub independence_basis: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AdapterActivationRequest {
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub acceptance_id: Uuid,
    pub expected_activation_id: Option<Uuid>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AdapterInvocationRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service: Option<ServiceInvocation>,
    pub activation_id: Uuid,
    pub execution: ExecutionRequest,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AdapterStopRequest {
    pub work_id: Option<Uuid>,
    pub delegation_id: Option<Uuid>,
    pub activation_id: Uuid,
}

/// Complete output and exit observation from the assigned external Runtime.
/// This does not certify work success, adapter acceptance, or settled effects.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RuntimeProgramObservation {
    pub instance_id: Uuid,
    pub generation: Uuid,
    pub manifest_digest: String,
    pub exec_id: String,
    pub exit_code: i64,
    pub stdout_bytes: u64,
    pub stderr_bytes: u64,
    pub stdout_sha256: String,
    pub stderr_sha256: String,
}

/// Receipt observation for one credential-version disable; never authority to disable again.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct CredentialDisableTicket {
    pub firm_id: Uuid,
    pub intent_id: Uuid,
    pub original_attempt_id: Uuid,
    pub credential_id: Uuid,
    pub version: u64,
}

/// Observation identity for one admitted enrollment; contains no secret or execution authority.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct EnrollmentRecoveryTicket {
    pub firm_id: Uuid,
    pub intent_id: Uuid,
    pub original_attempt_id: Uuid,
    pub enrollment_id: Uuid,
    pub credential_id: Uuid,
    pub version: u64,
}

/// Read-only selector for a saved native provider reply, never a dispatch ticket.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ProviderRecoveryTicket {
    pub firm_id: Uuid,
    pub intent_id: Uuid,
    pub original_attempt_id: Uuid,
    pub ticket_sha256: String,
}
impl ResourceTicket {
    pub fn provider_recovery_selector(&self) -> Result<ProviderRecoveryTicket, serde_json::Error> {
        use sha2::{Digest, Sha256};
        Ok(ProviderRecoveryTicket {
            firm_id: self.firm_id,
            intent_id: self.intent_id,
            original_attempt_id: self.attempt_id,
            ticket_sha256: hex::encode(Sha256::digest(serde_json::to_vec(self)?)),
        })
    }
}

/// A worker describes its already verified binding; Core compares it with admitted configuration.
/// This request never enrolls, activates or expands access to a storage target.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StorageClaim {
    pub firm_id: Uuid,
    pub store_id: Uuid,
    pub generation: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResourceClaimRequest {
    pub storage: Option<StorageClaim>,
}

/// Recheck one existing transfer attempt. This cannot claim, retry or change its input.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResourceLiveRequest {
    pub attempt_id: Uuid,
    pub storage: Option<StorageClaim>,
}

/// Receipt observation of a previously dispatched effect. This is deliberately not an
/// execution ticket: it contains no execution input/configuration or new attempt identity.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReceiptRecoveryTicket {
    pub firm_id: Uuid,
    pub intent_id: Uuid,
    pub original_attempt_id: Uuid,
    pub storage: StorageClaim,
    pub selector: ReceiptSelector,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "operation", deny_unknown_fields)]
pub enum ReceiptSelector {
    #[serde(rename = "file.collect")]
    Collection {
        work_id: Uuid,
        namespace_id: Uuid,
        request: CollectionRequest,
        binding: CollectionBinding,
        policy: RetirementPolicy,
    },
    #[serde(rename = "file.retire")]
    Retirement {
        work_id: Uuid,
        namespace_id: Uuid,
        request: RetirementRequest,
        policy: RetirementPolicy,
    },
    #[serde(rename = "workspace.create")]
    WorkspaceCreation {
        workspace_id: Uuid,
        namespace_id: Uuid,
        work_id: Uuid,
        label: String,
    },
    #[serde(rename = "file.upload")]
    Upload { sha256: String, size: u64 },
    #[serde(rename = "file.publish")]
    Publication {
        workspace_id: Uuid,
        expected_revision: i64,
        files: std::collections::BTreeMap<String, Uuid>,
    },
}

/// Native IDs are scoped to the Runtime's already-bound execution.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct NativeTurnReport {
    pub thread_id: String,
    pub turn_id: String,
    pub status: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum NativeInstruction {
    Steer { text: String },
    Interrupt,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeControlRequest {
    pub delegation_id: Uuid,
    pub thread_id: String,
    pub turn_id: String,
    pub instruction: NativeInstruction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeControlTicket {
    pub intent_id: Uuid,
    pub attempt_id: Uuid,
    pub execution_id: Uuid,
    pub instance_id: Uuid,
    pub generation: Uuid,
    pub request: NativeControlRequest,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct NativeControlAck {
    pub attempt_id: Uuid,
    pub native_request_id: u64,
    pub accepted: bool,
}

/// A single future occurrence with exact caller-selected execution input.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WakeRequest {
    pub due_at_seconds: i64,
    pub expires_at_seconds: i64,
    pub execution: ExecutionRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WakeCancelRequest {
    pub delegation_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConversationRequest {
    pub work_id: Uuid,
    pub delegation_id: Uuid,
    pub responsible_agent_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MessageRequest {
    pub delegation_id: Uuid,
    pub text: String,
    #[serde(default)]
    pub reply_to: Option<Uuid>,
}

/// Explicit delivery of existing message content to one currently active native turn.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MessageDeliveryRequest {
    pub delegation_id: Uuid,
    pub execution_id: Uuid,
    pub thread_id: String,
    pub turn_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConversationParticipantRequest {
    pub delegation_id: Uuid,
    pub principal_id: Uuid,
    pub active: bool,
}

/// Observation of one originally dispatched company transaction, never execution authority.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CompanyRecoveryTicket {
    pub firm_id: Uuid,
    pub intent_id: Uuid,
    pub original_attempt_id: Uuid,
    pub parameters: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AdmissionControlRequest {
    pub delegation_id: Uuid,
    pub expected_revision: i64,
    pub paused: bool,
    pub reason: String,
}
