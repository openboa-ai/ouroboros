import {
  access,
  link,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { decideResearchMemoryControlPairOutcome } from
  "@ouroboros/application/candidate/research-memory-control-study-outcome";
import type {
  PaperTradingComparisonWindowClosureGraphSnapshot,
  ResearchMemoryControlPairOutcomePersistenceInput
} from "@ouroboros/application/ports/store";
import {
  comparePrivateReadinessPostures,
  isCompletePrivateReadinessPostureRecord,
  isPrivateReadinessPostureRecord,
  isPrivateReadinessPostureWriteInput,
  matchesPrivateReadinessPostureQuery,
  toPrivateReadinessPostureReadModel
} from "./private-readiness-postures";
import type { PrivateReadinessPostureQueryInput } from "./private-readiness-postures";
import { createBinanceBtcusdtTradingSubstrateFixtureItems } from "./trading-substrate-fixtures";
import { buildLatestBinanceBtcusdtTradingSubstrateProjection } from "./trading-substrate-projection";
export * from "./research-control-study-execution-lease-store";
import {
  compareAccountPositionRiskMirrorSurfaces,
  compareOrderFillSurfaces,
  comparePrivateReadinessPreflightSurfaces,
  comparePublicMarketLivenessSurfaces,
  isAccountPositionRiskMirrorSurfaceRecord,
  isOrderFillSurfaceRecord,
  isPrivateReadinessPreflightSurfaceRecord,
  isPublicMarketLivenessSurfaceRecord,
  matchesAccountPositionRiskMirrorSurfaceQuery,
  matchesOrderFillSurfaceQuery,
  matchesPrivateReadinessPreflightSurfaceQuery,
  matchesPublicMarketLivenessSurfaceQuery,
  toAccountPositionRiskMirrorSurfaceReadModel,
  toOrderFillSurfaceReadModel,
  toPrivateReadinessPreflightSurfaceReadModel,
  toPublicMarketLivenessSurfaceReadModel
} from "./trading-substrate-surfaces";
import type {
  AccountPositionRiskMirrorSurfaceQueryInput,
  OrderFillSurfaceQueryInput,
  PrivateReadinessPreflightSurfaceQueryInput,
  PublicMarketLivenessSurfaceQueryInput
} from "./trading-substrate-surfaces";
import {
  buildImprovementReadModel,
  buildLedgerReadModel,
  candidateArenaResearchAllocationDigestInput,
  candidateArenaResearchAllocationHasRuntimeShape,
  decidePaperTradingQualification,
  isCandidateAdmissionDecisionConsistent,
  paperTradingComparisonActivationDigestInput,
  paperTradingComparisonActivationHasRuntimeShape,
  paperTradingComparisonActivationAttemptDigestInput,
  paperTradingComparisonActivationAttemptHasRuntimeShape,
  paperTradingComparisonActivationOutcomeDigestInput,
  paperTradingComparisonActivationOutcomeHasRuntimeShape,
  paperTradingComparisonActivationPolicyFor,
  paperTradingComparisonActivationSideResultDigestInput,
  paperTradingComparisonActivationSideResultHasRuntimeShape,
  paperTradingComparisonCheckpointAttemptDigestInput,
  paperTradingComparisonCheckpointAttemptHasRuntimeShape,
  paperTradingComparisonCheckpointOutcomeDigestInput,
  paperTradingComparisonCheckpointOutcomeHasRuntimeShape,
  paperTradingComparisonCheckpointWriteContextHasRuntimeShape,
  paperTradingComparisonAdmissionDecisionDigestInput,
  paperTradingComparisonCandidateVersionDigestInput,
  paperTradingComparisonCandidateVersionPairKey,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignDigestInput,
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignOutcomeDigestInput,
  paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape,
  paperTradingComparisonResearchReleaseDigestInput,
  paperTradingComparisonResearchReleaseHasRuntimeShape,
  paperTradingComparisonEvaluationCommitmentRecordDigestInput,
  paperTradingComparisonEvaluationHasZeroEvidenceActivationState,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingHandoffConformanceDigestInput,
  paperTradingHandoffConformanceHasRuntimeShape,
  researchAllocationPolicyDecisionDigestInput,
  researchAllocationPolicyDecisionHasRuntimeShape,
  researchBehaviorFingerprintDigestInput,
  researchBehaviorFingerprintHasRuntimeShape,
  researchControlCampaignArmIntentDigestInput,
  researchControlCampaignArmIntentHasRuntimeShape,
  researchControlCampaignDigestInput,
  researchControlCampaignHasRuntimeShape,
  researchControlCampaignOutcomeDigestInput,
  researchControlCampaignOutcomeHasRuntimeShape,
  researchControlCampaignPaperEvaluationProtocolDigestInput,
  researchControlCampaignPaperScheduleDigestInput,
  researchControlCampaignPaperScheduleHasRuntimeShape,
  researchControlCampaignPaperStartBatchDigestInput,
  researchControlCampaignPaperStartBatchHasRuntimeShape,
  researchControlCampaignPaperSlotOutcomeDigestInput,
  researchControlCampaignPaperSlotOutcomeHasRuntimeShape,
  researchControlCampaignReportDigestInput,
  researchControlCampaignReportHasRuntimeShape,
  researchControlStudyConditionDigestInput,
  researchControlStudyDigestInput,
  researchControlStudyGeneralizationAssignmentDigestInput,
  researchControlStudyHasRuntimeShape,
  researchControlStudyOutcomeDigestInput,
  researchControlStudyOutcomeHasRuntimeShape,
  researchGeneralizationOutcomeDigestInput,
  researchGeneralizationOutcomeHasRuntimeShape,
  researchGeneralizationPolicyDecisionDigestInput,
  researchGeneralizationPolicyDecisionHasRuntimeShape,
  researchGeneralizationMarketClassifierPolicyDigestInput,
  researchGeneralizationMarketConditionDigestInput,
  researchGeneralizationProtocolDigestInput,
  researchGeneralizationProtocolHasRuntimeShape,
  researchGeneralizationPublicKlineWindowDigestInput,
  researchMemoryControlPairOutcomeDigestInput,
  researchMemoryControlPairOutcomeHasRuntimeShape,
  researchMemoryControlStudyDigestInput,
  researchMemoryControlStudyHasRuntimeShape,
  researchMemoryControlStudyOutcomeDigestInput,
  researchMemoryControlStudyOutcomeHasRuntimeShape,
  researchPreflightCommitmentDigestInput,
  researchPreflightCommitmentHasRuntimeShape,
  researchWorkerCheckpointDigestInput,
  researchWorkerCheckpointHasRuntimeShape,
  paperTradingComparisonPreparationDigestInput,
  paperTradingComparisonPreparationHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonRuntimeControlIdempotencyKey,
  paperTradingComparisonRuntimeWriteContextHasRuntimeShape,
  paperTradingComparisonSideRecordsHaveInertShape,
  paperTradingComparisonStoppedQualificationClosureHasRuntimeShape,
  paperTradingComparisonSystemCodeRecordDigestInput,
  paperTradingComparisonTickAcknowledgementDigestInput,
  paperTradingComparisonTickAcknowledgementHasRuntimeShape,
  paperTradingComparisonTickCaptureWriteContextHasRuntimeShape,
  paperTradingComparisonTickDeliveryDigestInput,
  paperTradingComparisonTickDeliveryHasRuntimeShape,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  paperTradingComparisonTickIOWriteContextHasRuntimeShape,
  paperTradingComparisonTradingPromotionDigestInput,
  paperTradingComparisonTradingPromotionHasRuntimeShape,
  paperTradingComparisonQualificationResultDigestInput,
  paperTradingComparisonVerdictDigestInput,
  paperTradingComparisonVerdictHasRuntimeShape,
  paperTradingComparisonBaselineEvaluation,
  paperTradingEvaluationCommitmentDigestInput,
  tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape
} from "@ouroboros/domain";
export type { PrivateReadinessPostureQueryInput } from "./private-readiness-postures";
export type {
  AccountPositionRiskMirrorSurfaceQueryInput,
  OrderFillSurfaceQueryInput,
  PrivateReadinessPreflightSurfaceQueryInput,
  PublicMarketLivenessSurfaceQueryInput
} from "./trading-substrate-surfaces";
import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  AccountPositionRiskMirrorSurfaceRecord,
  ImprovementReadModel,
  AgentEventRecord,
  AgentProfileRecord,
  AgentRunRecord,
  AgentSessionRecord,
  ExperimentRunRecord,
  ArtifactLineageRecord,
  CandidateAdmissionDecisionRecord,
  ImprovementProposalRecord,
  ResearchFindingRecord,
  ResearchDirectionRecord,
  ResearchBehaviorFingerprintRecord,
  ResearchControlCampaignArmIntentRecord,
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperScheduleSlot,
  ResearchControlCampaignPaperStartBatchRecord,
  ResearchControlCampaignPaperSlotOutcomeRecord,
  ResearchControlCampaignRecord,
  ResearchControlCampaignReportRecord,
  ResearchAllocationPolicyDecisionRecord,
  ResearchControlStudyCondition,
  ResearchControlStudyOutcomeRecord,
  ResearchControlStudyRecord,
  ResearchGeneralizationOutcomeRecord,
  ResearchGeneralizationPolicyDecisionRecord,
  ResearchGeneralizationProtocolRecord,
  ResearchMemoryControlPairOutcomeRecord,
  ResearchMemoryControlStudyOutcomeRecord,
  ResearchMemoryControlStudyRecord,
  ResearchOrchestrationRunRecord,
  ResearchPreflightCommitmentRecord,
  ResearchWorkerRecord,
  ResearchWorkerCheckpointRecord,
  ArtifactRuntimeContractRecord,
  AgentSpecRecord,
  ImprovementProposalMaterializationAttemptRecord,
  ImprovementProposalMaterializationFailureReason,
  ImprovementProposalMaterializationInput,
  ImprovementProposalMaterializationOutcome,
  ImprovementProposalProviderAttribution,
  ImprovementProposalProviderFailureInput,
  ImprovementProposalProviderOutput,
  CandidateMaterializationAttemptIndexProjection,
  CandidateMaterializationAttemptReadModel,
  CandidateMaterializationAttemptRecord,
  CandidateMaterializationFailureInput,
  CandidateMaterializationFailureReason,
  CandidateMaterializationInput,
  CandidateMaterializationOutcome,
  CandidateIndexProjection,
  CandidateEvaluationErrorState,
  CandidateEvaluationReadModel,
  CandidateArenaResearchAllocationRecord,
  CandidateArenaTickRecord,
  LedgerInput,
  LedgerSourceChainReadModel,
  LedgerSourceRecordsReadModel,
  LedgerReadModel,
  LedgerWriteOutcome,
  RunControlReadModel,
  CandidateInspectReadModel,
  CandidateSummaryReadModel,
  CandidateEvaluationRunInput,
  CandidateEvaluationRunOutcome,
  CandidateVersionRecord,
  CapabilityGrantRecord,
  CapabilityManifestRecord,
  CapabilityMountRecord,
  CapabilityPackageAdmissionRecord,
  CapabilityPackageRecord,
  EvaluationComparisonSetRecord,
  ExecutionResultAuthorityStatus,
  ExecutionResultRecord,
  ExecutionResultStatus,
  EvidenceClassificationKind,
  EvidenceClassificationRecord,
  EvidenceClassificationStatus,
  EvidenceDisposition,
  EvidenceDispositionReason,
  EvidenceSealingDecisionInput,
  EvaluationRunRecord,
  EvidenceSealingDecisionRecord,
  FixtureNotice,
  FixtureRecord,
  GatewayResultRecord,
  GatewayResultAuthorityStatus,
  GatewayResultOutcome,
  GatewayResultReason,
  HandsEnvironmentRecord,
  OrderFillSurfaceReadModel,
  OuroborosCommandRecord,
  OrderFillSurfaceRecord,
  PrivateReadinessPostureReadModel,
  PrivateReadinessPostureRecord,
  ResearcherProviderSelectionRecord,
  PrivateReadinessPostureWriteInput,
  PrivateReadinessPreflightSurfaceReadModel,
  PrivateReadinessPreflightSurfaceRecord,
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationRecord,
  PaperTradingHandoffConformanceRecord,
  PaperTradingEvidencePurpose,
  PaperTradingObservationRecord,
  PaperTradingComparisonActivationRecord,
  PaperTradingComparisonActivationAttemptRecord,
  PaperTradingComparisonActivationOutcomeRecord,
  PaperTradingComparisonActivationSideResultRecord,
  PaperTradingComparisonCheckpointAttemptRecord,
  PaperTradingComparisonCheckpointOutcomeRecord,
  PaperTradingComparisonCheckpointSideEvidence,
  PaperTradingComparisonCheckpointWriteContext,
  PaperTradingComparisonRuntimeWriteContext,
  PaperTradingComparisonCandidateSide,
  PaperTradingComparisonConfirmationCampaignRecord,
  PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  PaperTradingComparisonResearchReleaseKind,
  PaperTradingComparisonResearchReleaseRecord,
  PaperTradingComparisonCommitmentRecord,
  PaperTradingComparisonPreparationRecord,
  PaperTradingComparisonSide,
  PaperTradingComparisonTickAcknowledgementRecord,
  PaperTradingComparisonTickCaptureWriteContext,
  PaperTradingComparisonTickDeliveryRecord,
  PaperTradingComparisonTickIOOperation,
  PaperTradingComparisonTickIOWriteContext,
  PaperTradingComparisonTickRecord,
  PaperTradingComparisonVerdictRecord,
  PublicMarketLivenessSurfaceReadModel,
  PublicMarketLivenessSurfaceRecord,
  OrderRequestRecord,
  PlaceholderSummary,
  ProgramManifestRecord,
  ProgramValidationRecord,
  ProviderKind,
  ProviderProbeAttemptRecord,
  ProviderReadinessRecord,
  Ref,
  SystemCodeRecord,
  RuntimeAuditEventKind,
  RuntimeAuditEventRecord,
  RuntimeHeartbeatRecord,
  RunControlAction,
  RunControlActorKind,
  RunControlAuditInput,
  RunControlAuditOutcome,
  RunControlAuthorityStatus,
  RunControlCommandReason,
  RunControlCommandRecord,
  RunControlDecisionOutcome,
  RunControlDecisionReason,
  RunControlDecisionRecord,
  SandboxHeartbeatReadModel,
  SandboxIndexProjection,
  SandboxLogReadModel,
  SandboxLogRecord,
  SandboxLogsOutcome,
  RuntimeMemorySurfaceRecord,
  SandboxPlacementRecord,
  SandboxCommandEvidenceReadModel,
  SandboxCommandEvidenceRecord,
  SandboxRecord,
  SandboxDetailReadModel,
  SandboxReadModel,
  StartSandboxOutcome,
  StopSandboxInput,
  StageBindingRecord,
  TracePlaceholderRecord,
  TradingSystemCandidateRecord,
  TradingEvaluationResultRecord,
  TradingPromotionRecord,
  TradingSystemProgramRecord,
  TradingRunTranscriptItemReadModel,
  TradingRunTranscriptReadModel,
  TradingRunLifecycleStatus,
  TradingRunRecord,
  TradingSystemSpecRecord
} from "@ouroboros/domain";

export const DEFAULT_STORE_ROOT = ".ouroboros/dev-store";
export const FIXTURE_CANDIDATE_ID = "fixture-candidate-sealed-replay-001";
export const FIXTURE_SYSTEM_CODE_ID = "fixture-system-code-clock-python-001";

export type LocalStoreErrorCode =
  | "invalid_evaluation_input"
  | "candidate_not_found"
  | "candidate_version_not_found"
  | "candidate_version_mismatch"
  | "unsupported_evaluation_stage"
  | "evaluation_run_incomplete"
  | "evaluation_run_not_found"
  | "evaluation_run_reload_failed"
  | "invalid_evidence_sealing_input"
  | "invalid_ledger_input"
  | "invalid_run_control_input"
  | "invalid_sandbox_input"
  | "invalid_order_fill_surface_input"
  | "invalid_public_market_liveness_surface_input"
  | "invalid_private_readiness_preflight_surface_input"
  | "invalid_private_readiness_posture_input"
  | "invalid_account_position_risk_mirror_surface_input"
  | "invalid_system_code_input"
  | "invalid_paper_trading_handoff_conformance_input"
  | "paper_trading_handoff_conformance_digest_mismatch"
  | "paper_trading_handoff_conformance_reference_not_found"
  | "paper_trading_handoff_conformance_reference_mismatch"
  | "paper_trading_handoff_conformance_conflict"
  | "invalid_persisted_paper_trading_handoff_conformance"
  | "persisted_paper_trading_handoff_conformance_digest_mismatch"
  | "runtime_not_found"
  | "runtime_mismatch"
  | "invalid_paper_trading_run_input"
  | "paper_trading_run_conflict"
  | "system_code_not_found"
  | "sandbox_not_found"
  | "ledger_reload_failed"
  | "run_control_reload_failed"
  | "sandbox_reload_failed"
  | "invalid_research_finding_input"
  | "invalid_candidate_admission_decision_input"
  | "candidate_admission_decision_reload_failed"
  | "invalid_artifact_lineage_input"
  | "invalid_improvement_proposal_input"
  | "invalid_research_orchestration_run_input"
  | "invalid_experiment_run_input"
  | "invalid_trading_evaluation_result_input"
  | "invalid_research_direction_input"
  | "research_direction_conflict"
  | "research_direction_reload_failed"
  | "invalid_research_worker_input"
  | "research_worker_reference_not_found"
  | "research_worker_reference_mismatch"
  | "research_worker_conflict"
  | "research_worker_reload_failed"
  | "invalid_research_preflight_commitment_input"
  | "research_preflight_commitment_digest_mismatch"
  | "research_preflight_commitment_conflict"
  | "research_preflight_commitment_reload_failed"
  | "research_preflight_commitment_reference_not_found"
  | "research_preflight_commitment_memory_checkpoint_not_found"
  | "research_preflight_commitment_memory_checkpoint_mismatch"
  | "research_preflight_commitment_graph_mismatch"
  | "research_preflight_commitment_rotation_reuse"
  | "research_preflight_terminal_graph_mismatch"
  | "research_preflight_terminal_reuse"
  | "invalid_research_worker_checkpoint_input"
  | "research_worker_checkpoint_digest_mismatch"
  | "research_worker_checkpoint_conflict"
  | "research_worker_checkpoint_commitment_reuse"
  | "research_worker_checkpoint_reload_failed"
  | "research_worker_checkpoint_reference_not_found"
  | "research_worker_checkpoint_lifecycle_required"
  | "research_worker_checkpoint_previous_mismatch"
  | "research_worker_checkpoint_budget_mismatch"
  | "research_worker_checkpoint_notebook_mismatch"
  | "research_worker_checkpoint_graph_mismatch"
  | "invalid_research_behavior_fingerprint_input"
  | "research_behavior_fingerprint_digest_mismatch"
  | "research_behavior_fingerprint_conflict"
  | "research_behavior_fingerprint_reload_failed"
  | "research_behavior_fingerprint_reference_not_found"
  | "research_behavior_fingerprint_reference_mismatch"
  | "candidate_admission_behavior_comparison_mismatch"
  | "invalid_candidate_arena_research_allocation_input"
  | "candidate_arena_research_allocation_digest_mismatch"
  | "candidate_arena_research_allocation_conflict"
  | "candidate_arena_research_allocation_reload_failed"
  | "candidate_arena_research_allocation_policy_decision_not_found"
  | "candidate_arena_research_allocation_policy_decision_mismatch"
  | "candidate_arena_research_allocation_reference_not_found"
  | "candidate_arena_research_allocation_tick_graph_mismatch"
  | "invalid_research_control_campaign_input"
  | "research_control_campaign_digest_mismatch"
  | "research_control_campaign_paper_protocol_digest_mismatch"
  | "research_control_campaign_comparator_reference_not_found"
  | "research_control_campaign_comparator_reference_mismatch"
  | "research_control_campaign_conflict"
  | "research_control_campaign_reload_failed"
  | "invalid_research_control_campaign_arm_intent_input"
  | "research_control_campaign_arm_intent_digest_mismatch"
  | "research_control_campaign_arm_intent_reference_not_found"
  | "research_control_campaign_arm_intent_reference_mismatch"
  | "research_control_campaign_arm_intent_conflict"
  | "research_control_campaign_arm_intent_reload_failed"
  | "invalid_research_control_campaign_report_input"
  | "research_control_campaign_report_digest_mismatch"
  | "research_control_campaign_report_reference_not_found"
  | "research_control_campaign_report_reference_mismatch"
  | "research_control_campaign_report_conflict"
  | "research_control_campaign_report_reload_failed"
  | "invalid_research_control_campaign_paper_schedule_input"
  | "research_control_campaign_paper_schedule_digest_mismatch"
  | "research_control_campaign_paper_schedule_reference_not_found"
  | "research_control_campaign_paper_schedule_reference_mismatch"
  | "research_control_campaign_paper_schedule_conflict"
  | "research_control_campaign_paper_schedule_reload_failed"
  | "research_control_campaign_paper_schedule_graph_invalid"
  | "research_control_campaign_paper_schedule_source_conflict"
  | "research_control_campaign_paper_schedule_slot_not_ready"
  | "invalid_research_control_campaign_paper_start_batch_input"
  | "research_control_campaign_paper_start_batch_digest_mismatch"
  | "research_control_campaign_paper_start_batch_reference_not_found"
  | "research_control_campaign_paper_start_batch_reference_mismatch"
  | "research_control_campaign_paper_start_batch_local_source_not_found"
  | "research_control_campaign_paper_start_batch_local_source_mismatch"
  | "research_control_campaign_paper_start_batch_conflict"
  | "research_control_campaign_paper_start_batch_reload_failed"
  | "research_control_campaign_confirmation_precommit_deadline_missed"
  | "invalid_research_control_campaign_paper_slot_outcome_input"
  | "research_control_campaign_paper_slot_outcome_digest_mismatch"
  | "research_control_campaign_paper_slot_outcome_reference_not_found"
  | "research_control_campaign_paper_slot_outcome_reference_mismatch"
  | "research_control_campaign_paper_slot_outcome_evidence_reference_not_found"
  | "research_control_campaign_paper_slot_outcome_evidence_graph_invalid"
  | "research_control_campaign_paper_slot_outcome_conflict"
  | "research_control_campaign_paper_slot_outcome_reload_failed"
  | "invalid_research_control_campaign_outcome_input"
  | "research_control_campaign_outcome_digest_mismatch"
  | "research_control_campaign_outcome_reference_not_found"
  | "research_control_campaign_outcome_reference_mismatch"
  | "research_control_campaign_outcome_conflict"
  | "research_control_campaign_outcome_reload_failed"
  | "invalid_research_control_study_input"
  | "research_control_study_condition_digest_mismatch"
  | "research_control_study_digest_mismatch"
  | "research_control_study_identity_mismatch"
  | "research_control_study_conflict"
  | "research_control_study_campaign_already_exists"
  | "research_control_study_generalization_assignment_digest_mismatch"
  | "research_control_study_generalization_market_digest_mismatch"
  | "research_control_study_generalization_protocol_not_found"
  | "research_control_study_generalization_protocol_mismatch"
  | "research_control_study_generalization_slot_mismatch"
  | "research_control_study_generalization_condition_mismatch"
  | "research_control_study_generalization_time_mismatch"
  | "research_control_study_generalization_spacing_not_elapsed"
  | "research_control_study_generalization_source_reused"
  | "research_control_study_reload_failed"
  | "research_control_study_campaign_ownership_ambiguous"
  | "research_control_study_campaign_mismatch"
  | "invalid_research_generalization_protocol_input"
  | "research_generalization_protocol_allocation_digest_mismatch"
  | "research_generalization_protocol_paper_digest_mismatch"
  | "research_generalization_protocol_classifier_digest_mismatch"
  | "research_generalization_protocol_digest_mismatch"
  | "research_generalization_protocol_identity_mismatch"
  | "research_generalization_protocol_conflict"
  | "research_generalization_protocol_study_already_exists"
  | "research_generalization_protocol_reload_failed"
  | "invalid_research_control_study_outcome_input"
  | "research_control_study_outcome_digest_mismatch"
  | "research_control_study_outcome_identity_mismatch"
  | "research_control_study_outcome_reference_not_found"
  | "research_control_study_outcome_reference_mismatch"
  | "research_control_study_outcome_conflict"
  | "research_control_study_outcome_reload_failed"
  | "invalid_research_memory_control_study_input"
  | "research_memory_control_study_digest_mismatch"
  | "research_memory_control_study_identity_mismatch"
  | "research_memory_control_study_conflict"
  | "research_memory_control_study_effect_already_exists"
  | "research_memory_control_study_effect_graph_corrupt"
  | "research_memory_control_study_reload_failed"
  | "research_memory_control_publication_lock_corrupt"
  | "research_memory_control_publication_lock_unavailable"
  | "invalid_research_memory_control_pair_outcome_input"
  | "research_memory_control_pair_outcome_digest_mismatch"
  | "research_memory_control_pair_outcome_identity_mismatch"
  | "research_memory_control_pair_outcome_reference_not_found"
  | "research_memory_control_pair_outcome_reference_mismatch"
  | "research_memory_control_pair_outcome_source_graph_mismatch"
  | "research_memory_control_pair_outcome_conflict"
  | "research_memory_control_pair_outcome_reload_failed"
  | "invalid_research_memory_control_study_outcome_input"
  | "research_memory_control_study_outcome_digest_mismatch"
  | "research_memory_control_study_outcome_identity_mismatch"
  | "research_memory_control_study_outcome_reference_not_found"
  | "research_memory_control_study_outcome_reference_mismatch"
  | "research_memory_control_study_outcome_conflict"
  | "research_memory_control_study_outcome_reload_failed"
  | "research_preflight_memory_control_study_not_found"
  | "research_preflight_memory_control_study_mismatch"
  | "invalid_research_generalization_outcome_input"
  | "research_generalization_outcome_digest_mismatch"
  | "research_generalization_outcome_identity_mismatch"
  | "research_generalization_outcome_reference_not_found"
  | "research_generalization_outcome_reference_mismatch"
  | "research_generalization_outcome_conflict"
  | "research_generalization_outcome_reload_failed"
  | "invalid_research_generalization_policy_decision_input"
  | "research_generalization_policy_decision_digest_mismatch"
  | "research_generalization_policy_decision_identity_mismatch"
  | "research_generalization_policy_decision_reference_not_found"
  | "research_generalization_policy_decision_reference_mismatch"
  | "research_generalization_policy_decision_conflict"
  | "research_generalization_policy_decision_reload_failed"
  | "invalid_research_allocation_policy_decision_input"
  | "research_allocation_policy_decision_digest_mismatch"
  | "research_allocation_policy_decision_identity_mismatch"
  | "research_allocation_policy_decision_reference_not_found"
  | "research_allocation_policy_decision_reference_mismatch"
  | "research_allocation_policy_decision_conflict"
  | "research_allocation_policy_decision_reload_failed"
  | "invalid_candidate_arena_tick_input"
  | "improvement_proposal_materialization_reload_failed"
  | "research_finding_not_found"
  | "improvement_proposal_not_found"
  | "artifact_lineage_not_found"
  | "candidate_admission_reference_not_found"
  | "candidate_admission_reference_mismatch"
  | "candidate_admission_research_preflight_required"
  | "candidate_admission_research_preflight_mismatch"
  | "invalid_paper_trading_evaluation_commitment_input"
  | "paper_trading_evaluation_commitment_digest_mismatch"
  | "paper_trading_evaluation_commitment_conflict"
  | "paper_trading_evaluation_commitment_reference_not_found"
  | "paper_trading_evaluation_commitment_reference_mismatch"
  | "paper_trading_evaluation_commitment_required"
  | "paper_trading_evaluation_commitment_mismatch"
  | "paper_trading_evaluation_identity_mismatch"
  | "paper_trading_evaluation_invalidation_terminal"
  | "paper_trading_observation_commitment_required"
  | "paper_trading_observation_commitment_mismatch"
  | "paper_trading_observation_evaluation_mismatch"
  | "paper_trading_observation_sequence_mismatch"
  | "paper_trading_observation_after_invalidation"
  | "paper_trading_observation_account_lineage_mismatch"
  | "invalid_paper_trading_comparison_preparation_input"
  | "paper_trading_comparison_preparation_digest_mismatch"
  | "paper_trading_comparison_preparation_conflict"
  | "paper_trading_comparison_preparation_reference_not_found"
  | "paper_trading_comparison_frozen_record_digest_mismatch"
  | "paper_trading_comparison_candidate_not_admitted"
  | "paper_trading_comparison_duplicate_executable"
  | "paper_trading_comparison_champion_selection_mismatch"
  | "paper_trading_comparison_preparation_mismatch"
  | "invalid_paper_trading_comparison_commitment_input"
  | "paper_trading_comparison_commitment_digest_mismatch"
  | "paper_trading_comparison_commitment_conflict"
  | "paper_trading_comparison_commitment_reference_not_found"
  | "paper_trading_comparison_commitment_reference_mismatch"
  | "paper_trading_comparison_active_pair_conflict"
  | "paper_trading_comparison_frozen_authority_write_conflict"
  | "paper_trading_comparison_inert_graph_mutation_forbidden"
  | "invalid_paper_trading_comparison_tick_input"
  | "paper_trading_comparison_tick_digest_mismatch"
  | "paper_trading_comparison_tick_conflict"
  | "paper_trading_comparison_tick_reload_failed"
  | "paper_trading_comparison_tick_reference_not_found"
  | "paper_trading_comparison_tick_reference_mismatch"
  | "paper_trading_comparison_first_tick_conflict"
  | "paper_trading_comparison_tick_graph_invalid"
  | "invalid_paper_trading_comparison_tick_capture_context"
  | "paper_trading_comparison_tick_capture_reference_mismatch"
  | "paper_trading_comparison_tick_capture_state_conflict"
  | "paper_trading_comparison_tick_sequence_conflict"
  | "invalid_paper_trading_comparison_tick_delivery_input"
  | "paper_trading_comparison_tick_delivery_digest_mismatch"
  | "paper_trading_comparison_tick_delivery_conflict"
  | "paper_trading_comparison_tick_delivery_reload_failed"
  | "paper_trading_comparison_tick_delivery_reference_not_found"
  | "paper_trading_comparison_tick_delivery_reference_mismatch"
  | "paper_trading_comparison_tick_delivery_state_conflict"
  | "paper_trading_comparison_tick_delivery_graph_invalid"
  | "invalid_paper_trading_comparison_tick_acknowledgement_input"
  | "paper_trading_comparison_tick_acknowledgement_digest_mismatch"
  | "paper_trading_comparison_tick_acknowledgement_conflict"
  | "paper_trading_comparison_tick_acknowledgement_reload_failed"
  | "paper_trading_comparison_tick_acknowledgement_reference_not_found"
  | "paper_trading_comparison_tick_acknowledgement_reference_mismatch"
  | "paper_trading_comparison_tick_acknowledgement_state_conflict"
  | "paper_trading_comparison_tick_acknowledgement_graph_invalid"
  | "invalid_paper_trading_comparison_activation_input"
  | "paper_trading_comparison_activation_digest_mismatch"
  | "paper_trading_comparison_activation_conflict"
  | "paper_trading_comparison_activation_pair_conflict"
  | "paper_trading_comparison_activation_reload_failed"
  | "paper_trading_comparison_activation_reference_not_found"
  | "paper_trading_comparison_activation_reference_mismatch"
  | "paper_trading_comparison_activation_policy_mismatch"
  | "paper_trading_comparison_activation_time_mismatch"
  | "paper_trading_comparison_activation_graph_invalid"
  | "invalid_paper_trading_comparison_activation_attempt_input"
  | "paper_trading_comparison_activation_attempt_digest_mismatch"
  | "paper_trading_comparison_activation_attempt_conflict"
  | "paper_trading_comparison_activation_attempt_reload_failed"
  | "paper_trading_comparison_activation_attempt_reference_not_found"
  | "paper_trading_comparison_activation_attempt_reference_mismatch"
  | "paper_trading_comparison_activation_attempt_policy_mismatch"
  | "paper_trading_comparison_activation_attempt_time_mismatch"
  | "paper_trading_comparison_activation_attempt_sequence_mismatch"
  | "paper_trading_comparison_activation_attempt_state_conflict"
  | "paper_trading_comparison_activation_attempt_graph_invalid"
  | "invalid_paper_trading_comparison_activation_side_result_input"
  | "paper_trading_comparison_activation_side_result_digest_mismatch"
  | "paper_trading_comparison_activation_side_result_conflict"
  | "paper_trading_comparison_activation_side_result_reload_failed"
  | "paper_trading_comparison_activation_side_result_reference_not_found"
  | "paper_trading_comparison_activation_side_result_reference_mismatch"
  | "paper_trading_comparison_activation_side_result_policy_mismatch"
  | "paper_trading_comparison_activation_side_result_sequence_mismatch"
  | "paper_trading_comparison_activation_side_result_state_mismatch"
  | "paper_trading_comparison_activation_side_result_graph_invalid"
  | "invalid_paper_trading_comparison_activation_outcome_input"
  | "paper_trading_comparison_activation_outcome_digest_mismatch"
  | "paper_trading_comparison_activation_outcome_conflict"
  | "paper_trading_comparison_activation_outcome_reload_failed"
  | "paper_trading_comparison_activation_outcome_reference_not_found"
  | "paper_trading_comparison_activation_outcome_reference_mismatch"
  | "paper_trading_comparison_activation_outcome_sequence_mismatch"
  | "paper_trading_comparison_activation_outcome_state_mismatch"
  | "paper_trading_comparison_activation_outcome_graph_invalid"
  | "invalid_paper_trading_comparison_checkpoint_attempt_input"
  | "paper_trading_comparison_checkpoint_attempt_digest_mismatch"
  | "paper_trading_comparison_checkpoint_attempt_conflict"
  | "paper_trading_comparison_checkpoint_attempt_reload_failed"
  | "paper_trading_comparison_checkpoint_attempt_reference_not_found"
  | "paper_trading_comparison_checkpoint_attempt_reference_mismatch"
  | "paper_trading_comparison_checkpoint_attempt_state_mismatch"
  | "paper_trading_comparison_checkpoint_attempt_state_conflict"
  | "paper_trading_comparison_checkpoint_attempt_graph_invalid"
  | "invalid_paper_trading_comparison_checkpoint_outcome_input"
  | "paper_trading_comparison_checkpoint_outcome_digest_mismatch"
  | "paper_trading_comparison_checkpoint_outcome_conflict"
  | "paper_trading_comparison_checkpoint_outcome_reload_failed"
  | "paper_trading_comparison_checkpoint_outcome_reference_not_found"
  | "paper_trading_comparison_checkpoint_outcome_reference_mismatch"
  | "paper_trading_comparison_checkpoint_outcome_state_conflict"
  | "paper_trading_comparison_paired_checkpoint_transaction_required"
  | "invalid_paper_trading_comparison_paired_checkpoint_input"
  | "paper_trading_comparison_paired_checkpoint_digest_mismatch"
  | "paper_trading_comparison_paired_checkpoint_reference_mismatch"
  | "paper_trading_comparison_paired_checkpoint_state_conflict"
  | "paper_trading_comparison_paired_checkpoint_transaction_conflict"
  | "paper_trading_comparison_paired_checkpoint_transaction_reload_failed"
  | "paper_trading_comparison_paired_checkpoint_materialization_conflict"
  | "invalid_paper_trading_comparison_verdict_input"
  | "paper_trading_comparison_verdict_digest_mismatch"
  | "paper_trading_comparison_verdict_conflict"
  | "paper_trading_comparison_verdict_graph_invalid"
  | "invalid_trading_promotion_input"
  | "trading_promotion_conflict"
  | "trading_promotion_reference_not_found"
  | "trading_promotion_graph_invalid"
  | "trading_promotion_stale_champion"
  | "trading_promotion_reload_failed"
  | "invalid_paper_trading_comparison_confirmation_campaign_input"
  | "paper_trading_comparison_confirmation_campaign_digest_mismatch"
  | "paper_trading_comparison_confirmation_campaign_conflict"
  | "paper_trading_comparison_confirmation_campaign_reload_failed"
  | "paper_trading_comparison_confirmation_campaign_reference_not_found"
  | "paper_trading_comparison_confirmation_campaign_graph_invalid"
  | "paper_trading_comparison_confirmation_campaign_source_conflict"
  | "paper_trading_comparison_active_campaign_pair_conflict"
  | "paper_trading_comparison_confirmation_slot_not_ready"
  | "paper_trading_comparison_confirmation_first_tick_time_mismatch"
  | "paper_trading_comparison_confirmation_campaign_terminal"
  | "invalid_paper_trading_comparison_confirmation_campaign_outcome_input"
  | "paper_trading_comparison_confirmation_campaign_outcome_digest_mismatch"
  | "paper_trading_comparison_confirmation_campaign_outcome_conflict"
  | "paper_trading_comparison_confirmation_campaign_outcome_reload_failed"
  | "paper_trading_comparison_confirmation_campaign_outcome_reference_not_found"
  | "paper_trading_comparison_confirmation_campaign_outcome_graph_invalid"
  | "invalid_paper_trading_comparison_research_release_input"
  | "paper_trading_comparison_research_release_digest_mismatch"
  | "paper_trading_comparison_research_release_conflict"
  | "paper_trading_comparison_research_release_outcome_conflict"
  | "paper_trading_comparison_research_release_reload_failed"
  | "paper_trading_comparison_research_release_reference_not_found"
  | "paper_trading_comparison_research_release_graph_invalid"
  | "paper_trading_comparison_research_release_materialization_conflict"
  | "paper_trading_comparison_research_release_bound_record_conflict"
  | "invalid_paper_trading_comparison_checkpoint_write_context"
  | "paper_trading_comparison_checkpoint_write_context_reference_not_found"
  | "paper_trading_comparison_checkpoint_write_context_reference_mismatch"
  | "paper_trading_comparison_checkpoint_write_state_conflict"
  | "invalid_paper_trading_comparison_runtime_write_context"
  | "paper_trading_comparison_runtime_write_context_reference_not_found"
  | "paper_trading_comparison_runtime_write_context_reference_mismatch"
  | "paper_trading_comparison_runtime_write_context_writer_mismatch"
  | "paper_trading_comparison_runtime_write_transition_mismatch"
  | "paper_trading_comparison_runtime_write_state_conflict"
  | "paper_trading_comparison_runtime_write_graph_invalid"
  | "authority_evidence_identity_conflict";

export class LocalStoreError extends Error {
  readonly code: LocalStoreErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: LocalStoreErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "LocalStoreError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface CandidateEvaluationRunIdentityInput {
  candidate_id: string;
  candidate_version_id: string;
  idempotency_key: string;
}

export function candidateEvaluationRunRecordId(input: CandidateEvaluationRunIdentityInput): string {
  return `evaluation-run-${stableSuffix(`${input.candidate_id}:${input.candidate_version_id}:${input.idempotency_key}`)}`;
}

type Collection =
  | "artifact-runtime-contracts"
  | "system-codes"
  | "candidates"
  | "candidate-materialization-attempts"
  | "candidate-versions"
  | "trading-system-specs"
  | "trading-system-programs"
  | "program-manifests"
  | "program-validations"
  | "capability-packages"
  | "capability-manifests"
  | "capability-admissions"
  | "capability-grants"
  | "capability-mounts"
  | "agent-specs"
  | "agent-sessions"
  | "agent-runs"
  | "agent-events"
  | "agent-profiles"
  | "researcher-provider-selections"
  | "trading-promotions"
  | "ouroboros-commands"
  | "provider-readiness-records"
  | "provider-probe-attempts"
  | "trading-runs"
  | "sandbox-placements"
  | "hands-environments"
  | "runtime-memory-surfaces"
  | "stage-bindings"
  | "traces"
  | "evaluation-runs"
  | "evaluation-comparison-sets"
  | "evidence-sealing-decisions"
  | "evidence-classifications"
  | "order-requests"
  | "gateway-results"
  | "execution-results"
  | "run-control-commands"
  | "run-control-decisions"
  | "runtime-audit-events"
  | "paper-trading-evaluation-commitments"
  | "paper-trading-evaluations"
  | "paper-trading-observations"
  | "paper-trading-comparison-preparations"
  | "paper-trading-comparison-commitments"
  | "paper-trading-comparison-ticks"
  | "paper-trading-comparison-tick-deliveries"
  | "paper-trading-comparison-tick-acknowledgements"
  | "paper-trading-comparison-activations"
  | "paper-trading-comparison-activation-attempts"
  | "paper-trading-comparison-activation-side-results"
  | "paper-trading-comparison-activation-outcomes"
  | "paper-trading-comparison-checkpoint-attempts"
  | "paper-trading-comparison-checkpoint-outcomes"
  | "paper-trading-comparison-checkpoint-transactions"
  | "paper-trading-comparison-verdicts"
  | "paper-trading-comparison-confirmation-campaigns"
  | "paper-trading-comparison-confirmation-campaign-outcomes"
  | "paper-trading-comparison-research-releases"
  | "substrate-state-surfaces"
  | "private-readiness-postures"
  | "sandboxes"
  | "sandbox-logs"
  | "runtime-heartbeats"
  | "sandbox-command-evidence"
  | "research-findings"
  | "artifact-lineages"
  | "improvement-proposals"
  | "improvement-proposal-materialization-attempts"
  | "research-orchestration-runs"
  | "research-directions"
  | "research-workers"
  | "research-preflight-commitments"
  | "research-worker-checkpoints"
  | "research-behavior-fingerprints"
  | "experiment-runs"
  | "paper-trading-handoff-conformances"
  | "candidate-admission-decisions"
  | "candidate-arena-research-allocations"
  | "research-control-campaigns"
  | "research-control-campaign-arm-intents"
  | "research-control-campaign-reports"
  | "research-control-campaign-paper-schedules"
  | "research-control-campaign-paper-start-batches"
  | "research-control-campaign-paper-slot-outcomes"
  | "research-control-campaign-outcomes"
  | "research-control-studies"
  | "research-control-study-outcomes"
  | "research-memory-control-studies"
  | "research-memory-control-pair-outcomes"
  | "research-memory-control-study-outcomes"
  | "research-generalization-protocols"
  | "research-generalization-outcomes"
  | "research-generalization-policy-decisions"
  | "research-allocation-policy-decisions"
  | "candidate-arena-ticks"
  | "trading-evaluation-results";

interface FixtureItem {
  collection: Collection;
  id: string;
  record: FixtureRecord;
  itemDir?: "items" | "placeholders" | "source-graphs";
}

export interface SandboxObservationInput {
  instance: SandboxRecord;
  placement?: SandboxPlacementRecord;
  lifecycle_status?: SandboxRecord["lifecycle_status"];
  stopped_at?: string;
  removed_at?: string;
  logs?: SandboxLogRecord[];
  heartbeats?: RuntimeHeartbeatRecord[];
  command_evidence?: SandboxCommandEvidenceRecord[];
}

export interface PreparedPaperTradingComparisonCheckpointSideInput {
  role: "champion" | "challenger";
  ledger_inputs: LedgerInput[];
  ledger_outcomes: LedgerWriteOutcome[];
  observation: PaperTradingObservationRecord;
  evaluation: PaperTradingEvaluationRecord;
  consumed_event_count: number;
  provider_request_count_after: number;
  preparation_digest: string;
}

export interface RecordPaperTradingComparisonPairedCheckpointInput {
  attempt: PaperTradingComparisonCheckpointAttemptRecord;
  outcome: PaperTradingComparisonCheckpointOutcomeRecord;
  champion: PreparedPaperTradingComparisonCheckpointSideInput;
  challenger: PreparedPaperTradingComparisonCheckpointSideInput;
}

interface LocalLedgerWritePlan {
  outcome: LedgerWriteOutcome;
  previousRuntime: TradingRunRecord;
  updatedRuntime: TradingRunRecord;
  immutableRecords: FixtureItem[];
  existing: boolean;
}

interface LocalPaperTradingComparisonCheckpointTransactionSide {
  prepared: PreparedPaperTradingComparisonCheckpointSideInput;
  previous_evaluation: PaperTradingEvaluationRecord;
  ledger_plans: LocalLedgerWritePlan[];
}

interface LocalPaperTradingComparisonCheckpointTransaction {
  record_kind: "local_paper_trading_comparison_checkpoint_transaction";
  version: 1;
  transaction_id: string;
  checkpoint_attempt_ref: Ref;
  checkpoint_attempt_digest: string;
  outcome: PaperTradingComparisonCheckpointOutcomeRecord;
  champion: LocalPaperTradingComparisonCheckpointTransactionSide;
  challenger: LocalPaperTradingComparisonCheckpointTransactionSide;
  transaction_digest: string;
}

interface LoadedPaperTradingComparisonSideGraph {
  input: PaperTradingComparisonSide;
  candidate: CandidateInspectReadModel;
  candidateVersion: CandidateVersionRecord;
  admission: CandidateAdmissionDecisionRecord;
  run: TradingRunRecord;
  systemCode: SystemCodeRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
}

interface PaperTradingComparisonRuntimeSideState {
  comparisonSide: PaperTradingComparisonSide;
  run: TradingRunRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  baseline: PaperTradingEvaluationRecord;
  evidenceState: "zero" | "paired_checkpoint";
  sandbox?: SandboxDetailReadModel;
}

interface PaperTradingComparisonTickAttributionState {
  attempt: PaperTradingComparisonActivationAttemptRecord;
  comparison: PaperTradingComparisonCommitmentRecord;
  tick: PaperTradingComparisonTickRecord;
  checkpointAttempt: PaperTradingComparisonCheckpointAttemptRecord;
  checkpointOutcome: PaperTradingComparisonCheckpointOutcomeRecord;
  checkpointEvidence: PaperTradingComparisonCheckpointSideEvidence;
  providerRequestCountBefore: number;
  deliveryNotBefore: string;
  sideState: PaperTradingComparisonRuntimeSideState;
}

interface PaperTradingComparisonTickAttributionErrorCodes {
  invalid: LocalStoreErrorCode;
  referenceNotFound: LocalStoreErrorCode;
  referenceMismatch: LocalStoreErrorCode;
  stateConflict: LocalStoreErrorCode;
  graphInvalid: LocalStoreErrorCode;
}

const PAPER_TRADING_COMPARISON_TICK_ATTRIBUTION_ERRORS = {
  delivery: {
    invalid: "invalid_paper_trading_comparison_tick_delivery_input",
    referenceNotFound:
      "paper_trading_comparison_tick_delivery_reference_not_found",
    referenceMismatch:
      "paper_trading_comparison_tick_delivery_reference_mismatch",
    stateConflict: "paper_trading_comparison_tick_delivery_state_conflict",
    graphInvalid: "paper_trading_comparison_tick_delivery_graph_invalid"
  },
  acknowledgement: {
    invalid: "invalid_paper_trading_comparison_tick_acknowledgement_input",
    referenceNotFound:
      "paper_trading_comparison_tick_acknowledgement_reference_not_found",
    referenceMismatch:
      "paper_trading_comparison_tick_acknowledgement_reference_mismatch",
    stateConflict:
      "paper_trading_comparison_tick_acknowledgement_state_conflict",
    graphInvalid: "paper_trading_comparison_tick_acknowledgement_graph_invalid"
  }
} as const satisfies Record<
  "delivery" | "acknowledgement",
  PaperTradingComparisonTickAttributionErrorCodes
>;

type PaperTradingComparisonBoundSideWrite =
  | { writer: "sandbox_start"; input: SandboxObservationInput }
  | {
      writer: "sandbox_stop";
      sandbox: SandboxRecord;
      observations: Omit<SandboxObservationInput, "instance">;
    }
  | { writer: "run_control"; input: RunControlAuditInput }
  | {
      writer: "paper_trading_evaluation";
      evaluation: PaperTradingEvaluationRecord;
      existing?: PaperTradingEvaluationRecord;
    };

const fixtureNotice: FixtureNotice = {
  mode: "fixture_convenience_mode",
  label: "Fixture / convenience mode",
  statements: [
    "No provider has run.",
    "No trading-system program has executed.",
    "No package has been scanned, granted, or mounted for real.",
    "No evaluator has run and no evidence has counted.",
    "No promotion, live gate, marketplace, or runtime action authority exists."
  ]
};

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

const ids = {
  candidate: FIXTURE_CANDIDATE_ID,
  version: "fixture-candidate-version-001",
  artifactRuntimeContract: "fixture-artifact-runtime-contract-clock-python-001",
  systemCode: FIXTURE_SYSTEM_CODE_ID,
  spec: "fixture-trading-system-spec-sealed-replay-001",
  program: "fixture-trading-system-program-001",
  programManifest: "fixture-program-manifest-001",
  programValidation: "fixture-program-validation-001",
  capabilityPackage: "fixture-capability-package-001",
  capabilityManifest: "fixture-capability-manifest-001",
  capabilityAdmission: "fixture-capability-admission-001",
  capabilityGrant: "fixture-capability-grant-001",
  capabilityMount: "fixture-capability-mount-001",
  agentSpec: "fixture-agent-spec-001",
  agentSession: "fixture-agent-session-001",
  agentRun: "fixture-agent-run-001",
  agentEvent: "fixture-agent-event-001",
  providerReadiness: "fixture-provider-readiness-001",
  providerProbe: "fixture-provider-probe-001",
  runtime: "fixture-trading-run-001",
  placement: "fixture-sandbox-placement-001",
  handsEnvironment: "fixture-hands-environment-001",
  memorySurface: "fixture-runtime-memory-surface-001",
  trace: "fixture-trace-placeholder-001",
  stageBinding: "fixture-stage-binding-backtest-001",
  evaluationRun: "fixture-evaluation-run-001",
  evaluationComparisonSet: "fixture-evaluation-comparison-set-001",
  evidenceSealingDecision: "fixture-evidence-sealing-decision-001",
  evidenceClassificationTrace: "fixture-evidence-classification-trace-001",
  evidenceClassificationCandidate: "fixture-evidence-classification-candidate-001",
  evidenceClassificationNonCounted: "fixture-evidence-classification-non-counted-001",
  evidenceClassificationSealedDecision: "fixture-evidence-classification-sealed-decision-001",
  orderFillSurface: "fixture-binance-btcusdt-order-fill-surface-001",
  publicMarketLivenessSurface: "fixture-binance-btcusdt-public-market-liveness-surface-001",
  privateReadinessPreflightSurface: "fixture-binance-btcusdt-private-readiness-preflight-surface-001",
  privateReadinessPosture: "fixture-binance-btcusdt-private-readiness-posture-001",
  accountPositionRiskMirrorSurface: "fixture-binance-btcusdt-account-position-risk-mirror-surface-001"
};

const fixtureEvaluationCreatedAt = "2026-05-05T00:00:00.000Z";

export function createFixtureRecords(): FixtureItem[] {
  const artifactRuntimeContract: ArtifactRuntimeContractRecord = {
    record_kind: "artifact_runtime_contract",
    version: 1,
    artifact_runtime_contract_id: ids.artifactRuntimeContract,
    runtime_kind: "python",
    entrypoint: ["python3", "fixtures/trading-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "order_request"],
      event_envelope_ref: ref("program_event_contract", "opaque-clock-program-event-v1"),
      log_contract_ref: ref("runtime_log_contract", "opaque-clock-log-v1"),
      heartbeat_contract_ref: ref("runtime_heartbeat_contract", "opaque-clock-heartbeat-v1")
    },
    secret_policy_ref: ref("secret_policy", "secret-policy-no-raw-values-v1"),
    capability_policy_ref: ref("capability_policy", "capability-policy-clock-fixture-v1"),
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "contract_only"
  };
  const systemCode: SystemCodeRecord = {
    record_kind: "system_code",
    version: 1,
    system_code_id: ids.systemCode,
    artifact_kind: "python_file",
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_digest: "sha256:fixture-clock-python-artifact-v1",
    artifact_runtime_contract_ref: ref(
      "artifact_runtime_contract",
      artifactRuntimeContract.artifact_runtime_contract_id
    ),
    runtime_kind: artifactRuntimeContract.runtime_kind,
    entrypoint: artifactRuntimeContract.entrypoint,
    declared_output_contract: artifactRuntimeContract.declared_output_contract,
    secret_policy_ref: artifactRuntimeContract.secret_policy_ref,
    capability_policy_ref: artifactRuntimeContract.capability_policy_ref,
    provenance_refs: [ref("agent_run", ids.agentRun)],
    status: "registered",
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "not_live"
  };
  const candidate: TradingSystemCandidateRecord = {
    record_kind: "trading_system_candidate",
    version: 1,
    candidate_id: ids.candidate,
    display_name: "Fixture generic trading-system candidate",
    status: "fixture_only",
    active_version_id: ids.version,
    provenance_refs: [
      ref("agent_run", ids.agentRun),
      ref("provider_readiness_record", ids.providerReadiness)
    ],
    active_system_code_ref: ref("system_code", ids.systemCode)
  };
  const candidateVersion: CandidateVersionRecord = {
    record_kind: "candidate_version",
    version: 1,
    candidate_version_id: ids.version,
    candidate_id: ids.candidate,
    version_label: "fixture-v1",
    spec_ref: ref("trading_system_spec", ids.spec),
    program_ref: ref("trading_system_program", ids.program),
    capability_package_refs: [ref("capability_package", ids.capabilityPackage)],
    runtime_ref: ref("trading_run", ids.runtime),
    trace_placeholder_ref: ref("trace_placeholder", ids.trace),
    evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
    system_code_ref: ref("system_code", ids.systemCode)
  };
  const spec: TradingSystemSpecRecord = {
    record_kind: "trading_system_spec",
    version: 1,
    trading_system_spec_id: ids.spec,
    summary: "generic trading instruments trading-system fixture spec for inspect-only bootstrap.",
    market: "ExternalTradingApiProvider",
    instrument: "generic trading instruments",
    supported_stage_binding_profiles: ["backtest", "paper", "live"]
  };
  const program: TradingSystemProgramRecord = {
    record_kind: "trading_system_program",
    version: 1,
    trading_system_program_id: ids.program,
    summary: "Agent-authored program placeholder; no code has executed.",
    manifest_ref: ref("program_manifest", ids.programManifest),
    validation_record_ref: ref("program_validation_record", ids.programValidation)
  };
  const programManifest: ProgramManifestRecord = {
    record_kind: "program_manifest",
    version: 1,
    program_manifest_id: ids.programManifest,
    declared_runtime: "fixture-sandbox-placeholder",
    declared_outputs: ["OrderRequest placeholder", "Trace placeholder"]
  };
  const programValidation: ProgramValidationRecord = {
    record_kind: "program_validation_record",
    version: 1,
    program_validation_record_id: ids.programValidation,
    status: "fixture_placeholder",
    authority_status: "not_executable"
  };
  const capabilityPackage: CapabilityPackageRecord = {
    record_kind: "capability_package",
    version: 1,
    capability_package_id: ids.capabilityPackage,
    summary: "Inspect-only capability package placeholder.",
    manifest_ref: ref("capability_manifest", ids.capabilityManifest),
    admission_record_ref: ref("capability_package_admission_record", ids.capabilityAdmission),
    grant_ref: ref("capability_grant", ids.capabilityGrant),
    mount_record_ref: ref("capability_mount_record", ids.capabilityMount)
  };
  const capabilityManifest: CapabilityManifestRecord = {
    record_kind: "capability_manifest",
    version: 1,
    capability_manifest_id: ids.capabilityManifest,
    allowed_stages: ["backtest", "paper"],
    declared_permissions: ["read_fixture_market_context"],
    forbidden_contents: ["exchange_credentials", "live_order_authority"]
  };
  const capabilityAdmission: CapabilityPackageAdmissionRecord = {
    record_kind: "capability_package_admission_record",
    version: 1,
    capability_package_admission_record_id: ids.capabilityAdmission,
    status: "fixture_placeholder",
    authority_status: "not_scanned"
  };
  const capabilityGrant: CapabilityGrantRecord = {
    record_kind: "capability_grant",
    version: 1,
    capability_grant_id: ids.capabilityGrant,
    status: "fixture_placeholder",
    authority_status: "not_granted"
  };
  const capabilityMount: CapabilityMountRecord = {
    record_kind: "capability_mount_record",
    version: 1,
    capability_mount_record_id: ids.capabilityMount,
    status: "fixture_placeholder",
    authority_status: "not_mounted"
  };
  const agentSpec: AgentSpecRecord = {
    record_kind: "agent_spec",
    version: 1,
    agent_spec_id: ids.agentSpec,
    purpose: "candidate_generation_placeholder",
    provider_kind: "fixture_only"
  };
  const agentSession: AgentSessionRecord = {
    record_kind: "agent_session",
    version: 1,
    agent_session_id: ids.agentSession,
    agent_spec_ref: ref("agent_spec", ids.agentSpec),
    authority_status: "not_executed"
  };
  const agentRun: AgentRunRecord = {
    record_kind: "agent_run",
    version: 1,
    agent_run_id: ids.agentRun,
    agent_session_ref: ref("agent_session", ids.agentSession),
    purpose: "candidate_generation_placeholder",
    authority_status: "not_executed"
  };
  const agentEvent: AgentEventRecord = {
    record_kind: "agent_event",
    version: 1,
    agent_event_id: ids.agentEvent,
    agent_run_ref: ref("agent_run", ids.agentRun),
    status: "fixture_placeholder"
  };
  const providerReadiness: ProviderReadinessRecord = {
    record_kind: "provider_readiness_record",
    version: 1,
    provider_readiness_record_id: ids.providerReadiness,
    provider_kind: "fixture_only",
    authority_status: "not_ready"
  };
  const providerProbe: ProviderProbeAttemptRecord = {
    record_kind: "provider_probe_attempt",
    version: 1,
    provider_probe_attempt_id: ids.providerProbe,
    provider_readiness_record_ref: ref("provider_readiness_record", ids.providerReadiness),
    authority_status: "not_probed"
  };
  const runtime: TradingRunRecord = {
    record_kind: "trading_run",
    version: 1,
    trading_run_id: ids.runtime,
    stage_binding_profile: "paper",
    runtime_lifecycle_status: "fixture_placeholder",
    placement_ref: ref("sandbox_placement", ids.placement),
    hands_environment_ref: ref("hands_environment", ids.handsEnvironment),
    memory_surface_ref: ref("runtime_memory_surface", ids.memorySurface),
    system_code_ref: ref("system_code", ids.systemCode),
    authority_status: "not_live"
  };
  const placement: SandboxPlacementRecord = {
    record_kind: "sandbox_placement",
    version: 1,
    sandbox_placement_id: ids.placement,
    placement_kind: "fixture_local_placeholder",
    tooling_kind: "fixture_only",
    authority_status: "not_launched"
  };
  const handsEnvironment: HandsEnvironmentRecord = {
    record_kind: "hands_environment",
    version: 1,
    hands_environment_id: ids.handsEnvironment,
    environment_kind: "fixture_no_tools",
    authority_status: "not_mounted"
  };
  const memorySurface: RuntimeMemorySurfaceRecord = {
    record_kind: "runtime_memory_surface",
    version: 1,
    runtime_memory_surface_id: ids.memorySurface,
    trust_class: "fixture_context",
    access_mode: "read_only",
    surface_version: "fixture-v1",
    visibility: "operator_visible",
    quarantine_status: "not_quarantined",
    authority_status: "not_evidence"
  };
  const trace: TracePlaceholderRecord = {
    record_kind: "trace_placeholder",
    version: 1,
    trace_id: ids.trace,
    authority_status: "not_counted"
  };
  const stageBinding: StageBindingRecord = {
    record_kind: "stage_binding",
    version: 1,
    stage_binding_id: ids.stageBinding,
    candidate_ref: ref("trading_system_candidate", ids.candidate),
    candidate_version_ref: ref("candidate_version", ids.version),
    stage: "backtest",
    profile: "backtest",
    execution_mode: "host_local",
    sandbox_placement_ref: ref("sandbox_placement", ids.placement),
    hands_environment_ref: ref("hands_environment", ids.handsEnvironment),
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "not_live"
  };
  const evaluationRun: EvaluationRunRecord = {
    record_kind: "evaluation_run_record",
    version: 1,
    evaluation_run_record_id: ids.evaluationRun,
    candidate_ref: ref("trading_system_candidate", ids.candidate),
    candidate_version_ref: ref("candidate_version", ids.version),
    stage_binding_ref: ref("stage_binding", ids.stageBinding),
    trace_ref: ref("trace_placeholder", ids.trace),
    status: "created",
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "not_counted"
  };
  const comparisonSet: EvaluationComparisonSetRecord = {
    record_kind: "evaluation_comparison_set",
    version: 1,
    evaluation_comparison_set_id: ids.evaluationComparisonSet,
    candidate_ref: ref("trading_system_candidate", ids.candidate),
    candidate_version_ref: ref("candidate_version", ids.version),
    stage_binding_ref: ref("stage_binding", ids.stageBinding),
    evaluation_run_refs: [ref("evaluation_run_record", ids.evaluationRun)],
    comparability_status: "not_evaluated",
    comparability_reason: "no_external_evaluator",
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "not_counted"
  };
  const sealingDecision: EvidenceSealingDecisionRecord = {
    record_kind: "evidence_sealing_decision",
    version: 1,
    evidence_sealing_decision_id: ids.evidenceSealingDecision,
    evaluation_comparison_set_ref: ref("evaluation_comparison_set", ids.evaluationComparisonSet),
    evaluation_run_refs: [ref("evaluation_run_record", ids.evaluationRun)],
    evidence_disposition: "not_counted",
    disposition_reason: "no_external_evaluator",
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "not_counted"
  };
  const evidenceClassifications: EvidenceClassificationRecord[] = [
    {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: ids.evidenceClassificationTrace,
      candidate_ref: ref("trading_system_candidate", ids.candidate),
      candidate_version_ref: ref("candidate_version", ids.version),
      evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
      classified_ref: ref("trace_placeholder", ids.trace),
      classification_kind: "trace_debug_material",
      classification_status: "trace_only",
      classification_reason: "no_external_evaluator",
      created_at: fixtureEvaluationCreatedAt,
      authority_status: "not_counted"
    },
    {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: ids.evidenceClassificationCandidate,
      candidate_ref: ref("trading_system_candidate", ids.candidate),
      candidate_version_ref: ref("candidate_version", ids.version),
      evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
      classified_ref: ref("evaluation_run_record", ids.evaluationRun),
      classification_kind: "candidate_evidence",
      classification_status: "candidate",
      classification_reason: "no_external_evaluator",
      created_at: fixtureEvaluationCreatedAt,
      authority_status: "not_counted"
    },
    {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: ids.evidenceClassificationNonCounted,
      candidate_ref: ref("trading_system_candidate", ids.candidate),
      candidate_version_ref: ref("candidate_version", ids.version),
      evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
      classified_ref: ref("evaluation_run_record", ids.evaluationRun),
      classification_kind: "non_counted_evidence",
      classification_status: "not_counted",
      classification_reason: "no_external_evaluator",
      created_at: fixtureEvaluationCreatedAt,
      sealed_by_decision_ref: ref("evidence_sealing_decision", ids.evidenceSealingDecision),
      authority_status: "not_counted"
    },
    {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: ids.evidenceClassificationSealedDecision,
      candidate_ref: ref("trading_system_candidate", ids.candidate),
      candidate_version_ref: ref("candidate_version", ids.version),
      evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
      classified_ref: ref("evidence_sealing_decision", ids.evidenceSealingDecision),
      classification_kind: "sealed_decision",
      classification_status: "sealed",
      classification_reason: "no_external_evaluator",
      created_at: fixtureEvaluationCreatedAt,
      sealed_by_decision_ref: ref("evidence_sealing_decision", ids.evidenceSealingDecision),
      authority_status: "not_counted"
    }
  ];

  return [
    { collection: "artifact-runtime-contracts", id: ids.artifactRuntimeContract, record: artifactRuntimeContract },
    { collection: "system-codes", id: ids.systemCode, record: systemCode },
    { collection: "candidates", id: ids.candidate, record: candidate },
    { collection: "candidate-versions", id: ids.version, record: candidateVersion },
    { collection: "trading-system-specs", id: ids.spec, record: spec },
    { collection: "trading-system-programs", id: ids.program, record: program },
    { collection: "program-manifests", id: ids.programManifest, record: programManifest },
    { collection: "program-validations", id: ids.programValidation, record: programValidation },
    { collection: "capability-packages", id: ids.capabilityPackage, record: capabilityPackage },
    { collection: "capability-manifests", id: ids.capabilityManifest, record: capabilityManifest },
    { collection: "capability-admissions", id: ids.capabilityAdmission, record: capabilityAdmission },
    { collection: "capability-grants", id: ids.capabilityGrant, record: capabilityGrant },
    { collection: "capability-mounts", id: ids.capabilityMount, record: capabilityMount },
    { collection: "agent-specs", id: ids.agentSpec, record: agentSpec },
    { collection: "agent-sessions", id: ids.agentSession, record: agentSession },
    { collection: "agent-runs", id: ids.agentRun, record: agentRun },
    { collection: "agent-events", id: ids.agentEvent, record: agentEvent },
    { collection: "provider-readiness-records", id: ids.providerReadiness, record: providerReadiness },
    { collection: "provider-probe-attempts", id: ids.providerProbe, record: providerProbe },
    { collection: "trading-runs", id: ids.runtime, record: runtime },
    { collection: "sandbox-placements", id: ids.placement, record: placement },
    { collection: "hands-environments", id: ids.handsEnvironment, record: handsEnvironment },
    { collection: "runtime-memory-surfaces", id: ids.memorySurface, record: memorySurface },
    { collection: "traces", id: ids.trace, record: trace, itemDir: "placeholders" },
    { collection: "stage-bindings", id: ids.stageBinding, record: stageBinding },
    { collection: "evaluation-runs", id: ids.evaluationRun, record: evaluationRun },
    ...createBinanceBtcusdtTradingSubstrateFixtureItems({
      ids: {
        orderFillSurface: ids.orderFillSurface,
        publicMarketLivenessSurface: ids.publicMarketLivenessSurface,
        privateReadinessPreflightSurface: ids.privateReadinessPreflightSurface,
        privateReadinessPosture: ids.privateReadinessPosture,
        accountPositionRiskMirrorSurface: ids.accountPositionRiskMirrorSurface,
        runtime: ids.runtime,
        candidate: ids.candidate,
        stageBinding: ids.stageBinding
      },
      ref
    }),
    { collection: "evaluation-comparison-sets", id: ids.evaluationComparisonSet, record: comparisonSet },
    { collection: "evidence-sealing-decisions", id: ids.evidenceSealingDecision, record: sealingDecision },
    ...evidenceClassifications.map((classification) => ({
      collection: "evidence-classifications" as const,
      id: classification.evidence_classification_id,
      record: classification
    }))
  ];
}

interface ResearchMemoryControlPublicationLockOwner {
  token: string;
  pid: number;
  acquired_at: string;
}

interface ResearchMemoryControlPairSourceGraphRecord {
  record_kind: "research_memory_control_pair_source_graph";
  version: 1;
  research_memory_control_pair_source_graph_id: string;
  pair_outcome_ref: Ref;
  pair_outcome_digest: string;
  source_graph: ResearchMemoryControlPairOutcomePersistenceInput["source_graph"];
  source_graph_digest: string;
  authority_status: "research_evidence_only";
}

const RESEARCH_MEMORY_CONTROL_PUBLICATION_LOCK_ATTEMPTS = 5_000;
const RESEARCH_MEMORY_CONTROL_PUBLICATION_LOCK_RETRY_MS = 2;

export class LocalStore {
  private candidateProjectionSelfHealPromise?: Promise<void>;
  private projectionRebuildQueue: Promise<void> = Promise.resolve();
  private comparisonEvidenceWriteQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storeRoot = process.env.OUROBOROS_STORE_ROOT ?? DEFAULT_STORE_ROOT) {}

  root(): string {
    return this.storeRoot;
  }

  private withComparisonEvidenceWriteTransaction<T>(task: () => Promise<T>): Promise<T> {
    const queued = this.comparisonEvidenceWriteQueue.then(task);
    this.comparisonEvidenceWriteQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued;
  }

  private async withResearchMemoryControlPublicationTransaction<T>(
    task: () => Promise<T>
  ): Promise<T> {
    const owner = await this.acquireResearchMemoryControlPublicationLock();
    try {
      return await task();
    } finally {
      await this.releaseResearchMemoryControlPublicationLock(owner);
    }
  }

  private assertPersistedComparisonPreparationShape(
    value: unknown
  ): asserts value is PaperTradingComparisonPreparationRecord {
    if (!paperTradingComparisonPreparationHasRuntimeShape(value)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_preparation_input",
        "persisted paper comparison preparation has invalid runtime shape"
      );
    }
  }

  private assertPersistedComparisonCommitmentShape(
    value: unknown
  ): asserts value is PaperTradingComparisonCommitmentRecord {
    if (!paperTradingComparisonCommitmentHasRuntimeShape(value)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_commitment_input",
        "persisted paper comparison commitment has invalid runtime shape"
      );
    }
  }

  private assertPersistedComparisonTickShape(
    value: unknown,
    errorCode: LocalStoreErrorCode = "invalid_paper_trading_comparison_tick_input"
  ): asserts value is PaperTradingComparisonTickRecord {
    if (!paperTradingComparisonTickHasRuntimeShape(value)) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison tick has invalid runtime shape"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = `sha256:${createHash("sha256")
        .update(paperTradingComparisonTickDigestInput(value))
        .digest("hex")}`;
    } catch {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison tick is not canonically digestible"
      );
    }
    if (value.tick_digest !== expectedDigest) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison tick digest does not match canonical content"
      );
    }
  }

  private assertPersistedComparisonActivationShape(
    value: unknown,
    errorCode: LocalStoreErrorCode =
      "invalid_paper_trading_comparison_activation_input"
  ): asserts value is PaperTradingComparisonActivationRecord {
    if (!paperTradingComparisonActivationHasRuntimeShape(value)) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation has invalid runtime shape"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonActivationDigestInput(value)
      );
    } catch {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation is not canonically digestible"
      );
    }
    if (value.activation_digest !== expectedDigest) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation digest does not match canonical content"
      );
    }
  }

  private assertPersistedComparisonActivationAttemptShape(
    value: unknown,
    errorCode: LocalStoreErrorCode =
      "invalid_paper_trading_comparison_activation_attempt_input"
  ): asserts value is PaperTradingComparisonActivationAttemptRecord {
    if (!paperTradingComparisonActivationAttemptHasRuntimeShape(value)) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation attempt has invalid runtime shape"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonActivationAttemptDigestInput(value)
      );
    } catch {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation attempt is not canonically digestible"
      );
    }
    if (value.attempt_digest !== expectedDigest) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation attempt digest does not match canonical content"
      );
    }
  }

  private assertPersistedComparisonActivationSideResultShape(
    value: unknown,
    errorCode: LocalStoreErrorCode =
      "invalid_paper_trading_comparison_activation_side_result_input"
  ): asserts value is PaperTradingComparisonActivationSideResultRecord {
    if (!paperTradingComparisonActivationSideResultHasRuntimeShape(value)) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation side result has invalid runtime shape"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonActivationSideResultDigestInput(value)
      );
    } catch {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation side result is not canonically digestible"
      );
    }
    if (value.side_result_digest !== expectedDigest) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation side result digest does not match canonical content"
      );
    }
  }

  private assertPersistedComparisonActivationOutcomeShape(
    value: unknown,
    errorCode: LocalStoreErrorCode =
      "invalid_paper_trading_comparison_activation_outcome_input"
  ): asserts value is PaperTradingComparisonActivationOutcomeRecord {
    if (!paperTradingComparisonActivationOutcomeHasRuntimeShape(value)) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation outcome has invalid runtime shape"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonActivationOutcomeDigestInput(value)
      );
    } catch {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation outcome is not canonically digestible"
      );
    }
    if (value.outcome_digest !== expectedDigest) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison activation outcome digest does not match canonical content"
      );
    }
  }

  private assertPersistedComparisonCheckpointAttemptShape(
    value: unknown,
    errorCode: LocalStoreErrorCode =
      "invalid_paper_trading_comparison_checkpoint_attempt_input"
  ): asserts value is PaperTradingComparisonCheckpointAttemptRecord {
    if (!paperTradingComparisonCheckpointAttemptHasRuntimeShape(value)) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison checkpoint attempt has invalid runtime shape"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonCheckpointAttemptDigestInput(value)
      );
    } catch {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison checkpoint attempt is not canonically digestible"
      );
    }
    if (value.attempt_digest !== expectedDigest) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison checkpoint attempt digest does not match canonical content"
      );
    }
  }

  private assertPersistedComparisonCheckpointOutcomeShape(
    value: unknown,
    errorCode: LocalStoreErrorCode =
      "invalid_paper_trading_comparison_checkpoint_outcome_input"
  ): asserts value is PaperTradingComparisonCheckpointOutcomeRecord {
    if (!paperTradingComparisonCheckpointOutcomeHasRuntimeShape(value)) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison checkpoint outcome has invalid runtime shape"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonCheckpointOutcomeDigestInput(value)
      );
    } catch {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison checkpoint outcome is not canonically digestible"
      );
    }
    if (value.outcome_digest !== expectedDigest) {
      throw new LocalStoreError(
        errorCode,
        "persisted paper comparison checkpoint outcome digest does not match canonical content"
      );
    }
  }

  private async assertFrozenAuthorityWriteAllowed(input:
    | { recordKind: "candidate_version"; id: string; digest: string }
    | { recordKind: "system_code"; id: string; digest: string }
    | { recordKind: "candidate_admission_decision"; id: string; digest: string }
    | { recordKind: "trading_promotion"; id: string; digest: string }
  ): Promise<void> {
    for (const preparation of await this.listPaperTradingComparisonPreparations()) {
      this.assertPersistedComparisonPreparationShape(preparation);
      const expected = this.frozenComparisonAuthorityDigest(
        preparation,
        input.recordKind,
        input.id
      );
      if (expected !== undefined && expected !== input.digest) {
        throw new LocalStoreError(
          "paper_trading_comparison_frozen_authority_write_conflict",
          `active paper comparison preparation freezes ${input.recordKind}:${input.id}`
        );
      }
    }
  }

  private frozenComparisonAuthorityDigest(
    preparation: PaperTradingComparisonPreparationRecord,
    recordKind: "candidate_version" | "system_code" |
      "candidate_admission_decision" | "trading_promotion",
    id: string
  ): string | undefined {
    for (const side of [preparation.champion, preparation.challenger]) {
      if (recordKind === "candidate_version" &&
        side.candidate_version_ref.record_kind === recordKind &&
        side.candidate_version_ref.id === id) {
        return side.candidate_version_digest;
      }
      if (recordKind === "system_code" &&
        side.system_code_ref.record_kind === recordKind &&
        side.system_code_ref.id === id) {
        return side.system_code_record_digest;
      }
      if (recordKind === "candidate_admission_decision" &&
        side.candidate_admission_decision_ref.record_kind === recordKind &&
        side.candidate_admission_decision_ref.id === id) {
        return side.admission_decision_digest;
      }
    }
    const selection = preparation.champion_selection;
    return recordKind === "trading_promotion" &&
      selection.selection_kind === "trading_review" &&
      selection.trading_promotion_ref.record_kind === recordKind &&
      selection.trading_promotion_ref.id === id
      ? selection.trading_promotion_digest
      : undefined;
  }

  private async assertExactAuthorityIdentity<T extends FixtureRecord>(input: {
    collection: "candidate-versions" | "system-codes" | "candidate-admission-decisions";
    id: string;
    recordKind: "candidate_version" | "system_code" | "candidate_admission_decision";
    next: T;
    digestInput: (record: T) => string;
  }): Promise<"append" | "exact_replay"> {
    const digest = comparisonExactRecordDigest(input.digestInput(input.next));
    const existing = await this.readOptionalRecord<T>(input.collection, input.id);
    if (existing && !sameJson(existing, input.next)) {
      await this.assertFrozenAuthorityWriteAllowed({
        recordKind: input.recordKind,
        id: input.id,
        digest
      });
      throw new LocalStoreError(
        "authority_evidence_identity_conflict",
        `${input.recordKind}:${input.id} is immutable under its deterministic identity`
      );
    }
    await this.assertFrozenAuthorityWriteAllowed({
      recordKind: input.recordKind,
      id: input.id,
      digest
    });
    return existing ? "exact_replay" : "append";
  }

  private async assertNoPairBoundSideMutation(input: {
    runId?: string;
    commitmentId?: string;
    evaluationId?: string;
  }, authority?: PaperTradingComparisonRuntimeWriteContext,
  write?: PaperTradingComparisonBoundSideWrite): Promise<void> {
    const freezesPromotionEvidence = (await this.listPaperTradingComparisonPreparations())
      .some((preparation) => {
        this.assertPersistedComparisonPreparationShape(preparation);
        const selection = preparation.champion_selection;
        return selection.selection_kind === "trading_review" && (
          (input.commitmentId !== undefined && paperTradingComparisonRefsEqual(
            selection.paper_trading_evaluation_commitment_ref,
            { record_kind: "paper_trading_evaluation_commitment", id: input.commitmentId }
          )) ||
          (input.evaluationId !== undefined && paperTradingComparisonRefsEqual(
            selection.paper_trading_evaluation_ref,
            { record_kind: "paper_trading_evaluation", id: input.evaluationId }
          ))
        );
      });
    if (freezesPromotionEvidence) {
      throw new LocalStoreError(
        "paper_trading_comparison_frozen_authority_write_conflict",
        "active paper comparison preparation freezes champion promotion evidence"
      );
    }
    const boundSides = (await this.listPaperTradingComparisonCommitments()).flatMap((pair) => {
      this.assertPersistedComparisonCommitmentShape(pair);
      return [pair.champion, pair.challenger]
        .filter((side) =>
        (input.runId !== undefined && paperTradingComparisonRefsEqual(
          side.trading_run_ref,
          { record_kind: "trading_run", id: input.runId }
        )) ||
        (input.commitmentId !== undefined && paperTradingComparisonRefsEqual(
          side.paper_trading_evaluation_commitment_ref,
          { record_kind: "paper_trading_evaluation_commitment", id: input.commitmentId }
        )) ||
        (input.evaluationId !== undefined && paperTradingComparisonRefsEqual(
          side.paper_trading_evaluation_ref,
          { record_kind: "paper_trading_evaluation", id: input.evaluationId }
        ))
        )
        .map((side) => ({ pair, side }));
    });
    if (boundSides.length === 0) {
      if (authority !== undefined || write !== undefined) {
        throw new LocalStoreError(
          "paper_trading_comparison_runtime_write_context_reference_mismatch",
          "paper comparison runtime write context does not target a bound side"
        );
      }
      return;
    }
    if (boundSides.length !== 1) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_graph_invalid",
        "paper comparison runtime writer matched more than one bound side"
      );
    }
    if (authority === undefined || write === undefined) {
      throw new LocalStoreError(
        "paper_trading_comparison_inert_graph_mutation_forbidden",
        "persisted paper comparison side graph requires exact runtime activation context"
      );
    }
    await this.assertPaperTradingComparisonRuntimeWriteAllowed({
      ...boundSides[0]!,
      authority,
      write
    });
  }

  private async assertPaperTradingComparisonRuntimeWriteAllowed(input: {
    pair: PaperTradingComparisonCommitmentRecord;
    side: PaperTradingComparisonSide;
    authority: PaperTradingComparisonRuntimeWriteContext;
    write: PaperTradingComparisonBoundSideWrite;
  }): Promise<void> {
    if (!paperTradingComparisonRuntimeWriteContextHasRuntimeShape(input.authority)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_runtime_write_context",
        "paper comparison runtime write context has invalid shape"
      );
    }
    const expectedOperation = input.write.writer === "sandbox_start"
      ? "start"
      : input.write.writer === "sandbox_stop"
        ? "stop"
        : input.write.writer === "run_control"
          ? input.write.input.command.action === "start" ||
            input.write.input.command.action === "stop"
            ? input.write.input.command.action
            : input.authority.operation
          : input.authority.operation;
    if ((expectedOperation !== "start" && expectedOperation !== "stop") ||
      input.authority.operation !== expectedOperation) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_context_writer_mismatch",
        "paper comparison runtime write context operation does not match its writer"
      );
    }

    let activation: PaperTradingComparisonActivationRecord | undefined;
    let attempt: PaperTradingComparisonActivationAttemptRecord | undefined;
    try {
      [activation, attempt] = await Promise.all([
        this.getPaperTradingComparisonActivation(
          input.authority.paper_trading_comparison_activation_ref.id
        ),
        this.getPaperTradingComparisonActivationAttempt(
          input.authority.paper_trading_comparison_activation_attempt_ref.id
        )
      ]);
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_graph_invalid",
        "paper comparison runtime write context references unreadable evidence"
      );
    }
    if (!activation || !attempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_context_reference_not_found",
        "paper comparison runtime write context evidence was not found"
      );
    }
    const activationSide = activation[input.authority.role];
    if (
      input.authority.paper_trading_comparison_activation_digest !==
        activation.activation_digest ||
      input.authority.paper_trading_comparison_activation_attempt_digest !==
        attempt.attempt_digest ||
      !paperTradingComparisonRefsEqual(
        attempt.paper_trading_comparison_activation_ref,
        input.authority.paper_trading_comparison_activation_ref
      ) ||
      attempt.paper_trading_comparison_activation_digest !==
        input.authority.paper_trading_comparison_activation_digest ||
      input.pair.paper_trading_comparison_commitment_id !==
        activation.paper_trading_comparison_commitment_ref.id ||
      input.pair.commitment_digest !==
        activation.paper_trading_comparison_commitment_digest ||
      input.side.role !== input.authority.role ||
      !samePersistedComparisonRecord(input.side, input.pair[input.authority.role]) ||
      !paperTradingComparisonRefsEqual(
        input.side.trading_run_ref,
        activationSide.trading_run_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        input.side.paper_trading_evaluation_commitment_ref,
        activationSide.paper_trading_evaluation_commitment_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        input.side.paper_trading_evaluation_ref,
        activationSide.paper_trading_evaluation_ref
      )
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_context_reference_mismatch",
        "paper comparison runtime write context does not match its frozen side"
      );
    }

    const closure = await this.loadPaperTradingComparisonActivationAttemptClosure(attempt);
    const attempts = await this.listPaperTradingComparisonActivationAttempts(
      activation.paper_trading_comparison_activation_id
    );
    if (attempts.at(-1)?.paper_trading_comparison_activation_attempt_id !==
      attempt.paper_trading_comparison_activation_attempt_id) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_state_conflict",
        "paper comparison runtime write context does not reference the latest attempt"
      );
    }
    const outcomes = await this.listPaperTradingComparisonActivationOutcomes(
      attempt.paper_trading_comparison_activation_attempt_id
    );
    const latestOutcome = outcomes.at(-1);
    const results = await this.listPaperTradingComparisonActivationSideResults(
      attempt.paper_trading_comparison_activation_attempt_id
    );
    const roleResults = results.filter((result) => result.role === input.authority.role);
    if (latestOutcome?.outcome_status === "stopped_cleanly" ||
      input.authority.operation === "start" &&
        (latestOutcome !== undefined || roleResults.some((result) => result.operation === "start"))) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_state_conflict",
        "paper comparison runtime write context is not open for this side operation"
      );
    }

    const state = await this.loadPaperTradingComparisonRuntimeSideState(
      attempt,
      input.authority.role,
      closure.comparison,
      "paper_trading_comparison_runtime_write_graph_invalid",
      { allowCommittedCheckpoint: input.authority.operation === "stop" }
    );
    if ((input.write.writer === "sandbox_stop" ||
      input.write.writer === "paper_trading_evaluation") &&
      !await this.paperTradingComparisonRuntimeControlAuditIsPersisted(
        attempt,
        state,
        input.authority
      )) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_state_conflict",
        "paper comparison runtime transition requires its exact control audit"
      );
    }
    if (input.write.writer === "sandbox_start") {
      this.assertPaperTradingComparisonSandboxStartTransition(
        attempt,
        state,
        input.write.input
      );
      return;
    }
    if (input.write.writer === "sandbox_stop") {
      this.assertPaperTradingComparisonSandboxStopTransition(
        attempt,
        state,
        input.write.sandbox,
        input.write.observations
      );
      return;
    }
    if (input.write.writer === "run_control") {
      this.assertPaperTradingComparisonRunControlTransition(
        attempt,
        state,
        input.authority,
        input.write.input
      );
      return;
    }
    this.assertPaperTradingComparisonEvaluationTransition(
      attempt,
      state,
      input.authority.operation,
      input.write.evaluation,
      input.write.existing
    );
  }

  private async paperTradingComparisonRuntimeControlAuditIsPersisted(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    state: PaperTradingComparisonRuntimeSideState,
    authority: PaperTradingComparisonRuntimeWriteContext
  ): Promise<boolean> {
    const recordIds = runtimeControlAuditRecordIds({
      candidate_id: state.commitment.candidate_ref.id,
      candidate_version_id: state.commitment.candidate_version_ref.id,
      runtime_id: state.run.trading_run_id,
      idempotency_key: paperTradingComparisonRuntimeControlIdempotencyKey(authority)
    });
    const outcome = await this.readRunControlAuditOutcome(
      state.commitment.candidate_ref.id,
      state.commitment.candidate_version_ref.id,
      state.run.trading_run_id,
      recordIds
    );
    if (!outcome) return false;
    const expectedStatus = authority.operation === "start" ? "running" : "stopped";
    const relatedEvidence = [
      outcome.command.related_order_request_refs,
      outcome.command.related_gateway_result_refs,
      outcome.command.related_execution_result_refs,
      outcome.decision.related_order_request_refs,
      outcome.decision.related_gateway_result_refs,
      outcome.decision.related_execution_result_refs,
      outcome.audit_event.related_order_request_refs,
      outcome.audit_event.related_gateway_result_refs,
      outcome.audit_event.related_execution_result_refs
    ];
    return paperTradingComparisonRefsEqual(outcome.command.runtime_ref, state.comparisonSide.trading_run_ref) &&
      outcome.command.action === authority.operation &&
      outcome.command.requested_lifecycle_status === expectedStatus &&
      outcome.command.idempotency_key ===
        paperTradingComparisonRuntimeControlIdempotencyKey(authority) &&
      outcome.command.authority_status === "control_only" &&
      isIsoTimestamp(outcome.command.requested_at) &&
      Date.parse(outcome.command.requested_at) >= Date.parse(attempt.attempted_at) &&
      (authority.operation !== "start" || Date.parse(outcome.command.requested_at) <=
        Date.parse(attempt.start_deadline_at)) &&
      relatedEvidence.every((refs) => (refs?.length ?? 0) === 0) &&
      paperTradingComparisonRefsEqual(outcome.decision.runtime_ref, state.comparisonSide.trading_run_ref) &&
      outcome.decision.command_ref.id === outcome.command.run_control_command_id &&
      outcome.decision.decision_outcome === "allowed" &&
      outcome.decision.resulting_lifecycle_status === expectedStatus &&
      outcome.decision.authority_status === "control_only" &&
      isIsoTimestamp(outcome.decision.decided_at) &&
      outcome.decision.decided_at === outcome.command.requested_at &&
      paperTradingComparisonRefsEqual(outcome.audit_event.runtime_ref, state.comparisonSide.trading_run_ref) &&
      outcome.audit_event.command_ref?.id === outcome.command.run_control_command_id &&
      outcome.audit_event.decision_ref?.id === outcome.decision.run_control_decision_id &&
      outcome.audit_event.event_kind === "runtime_lifecycle_transitioned" &&
      outcome.audit_event.runtime_lifecycle_status === expectedStatus &&
      outcome.audit_event.authority_status === "audit_only" &&
      isIsoTimestamp(outcome.audit_event.created_at) &&
      outcome.audit_event.created_at === outcome.command.requested_at &&
      Boolean(state.run.run_control_command_refs?.some((record) =>
        record.id === outcome.command.run_control_command_id)) &&
      Boolean(state.run.run_control_decision_refs?.some((record) =>
        record.id === outcome.decision.run_control_decision_id)) &&
      Boolean(state.run.runtime_audit_event_refs?.some((record) =>
        record.id === outcome.audit_event.runtime_audit_event_id));
  }

  private assertPaperTradingComparisonSandboxStartTransition(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    state: PaperTradingComparisonRuntimeSideState,
    input: SandboxObservationInput
  ): void {
    const sandbox = input.instance;
    if (
      (state.run.runtime_lifecycle_status !== "registered" &&
        state.run.runtime_lifecycle_status !== "stopped") ||
      (state.evaluation.status !== "not_started" && state.evaluation.status !== "stopped") ||
      sandbox.record_kind !== "sandbox" ||
      sandbox.version !== 1 ||
      sandbox.lifecycle_status !== "running" ||
      !paperTradingComparisonRefsEqual(sandbox.runtime_ref, state.comparisonSide.trading_run_ref) ||
      !paperTradingComparisonRefsEqual(sandbox.system_code_ref, state.commitment.system_code_ref) ||
      !paperTradingComparisonRefsEqual(sandbox.sandbox_placement_ref, state.run.placement_ref) ||
      input.placement !== undefined ||
      !isIsoTimestamp(sandbox.started_at) ||
      Date.parse(sandbox.started_at) < Date.parse(attempt.attempted_at) ||
      Date.parse(sandbox.started_at) > Date.parse(attempt.start_deadline_at) ||
      sandbox.stopped_at !== undefined ||
      sandbox.removed_at !== undefined ||
      sandbox.authority_status !== "not_live" ||
      state.sandbox !== undefined &&
        state.sandbox.lifecycle_status !== "stopped" &&
        state.sandbox.lifecycle_status !== "removed"
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_transition_mismatch",
        "paper comparison runtime sandbox start is outside the bound zero-evidence transition"
      );
    }
  }

  private assertPaperTradingComparisonSandboxStopTransition(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    state: PaperTradingComparisonRuntimeSideState,
    sandbox: SandboxRecord,
    observations: Omit<SandboxObservationInput, "instance">
  ): void {
    const current = state.sandbox;
    if (
      !current ||
      sandbox.sandbox_id !== current.sandbox_id ||
      (sandbox.lifecycle_status !== "stopped" && sandbox.lifecycle_status !== "removed") ||
      !paperTradingComparisonRefsEqual(sandbox.runtime_ref, state.comparisonSide.trading_run_ref) ||
      !paperTradingComparisonRefsEqual(sandbox.system_code_ref, state.commitment.system_code_ref) ||
      !paperTradingComparisonRefsEqual(
        sandbox.sandbox_placement_ref,
        current.sandbox_placement_ref
      ) ||
      sandbox.adapter_kind !== current.adapter_kind ||
      sandbox.sandbox_name !== current.sandbox_name ||
      sandbox.created_at !== current.created_at ||
      sandbox.started_at !== current.started_at ||
      observations.placement !== undefined ||
      !isIsoTimestamp(sandbox.stopped_at) ||
      Date.parse(sandbox.stopped_at) < Date.parse(attempt.attempted_at) ||
      sandbox.authority_status !== "not_live" ||
      ![
        "deployed",
        "starting",
        "running",
        "paused",
        "stopping",
        "stopped",
        "failed",
        "killed",
        "human_review_required"
      ].includes(state.run.runtime_lifecycle_status ?? "registered") ||
      (state.evaluation.status !== "running" &&
        state.evaluation.status !== "not_started" &&
        state.evaluation.status !== "stopped")
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_transition_mismatch",
        "paper comparison runtime sandbox stop is outside the bound cleanup transition"
      );
    }
  }

  private assertPaperTradingComparisonRunControlTransition(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    state: PaperTradingComparisonRuntimeSideState,
    authority: PaperTradingComparisonRuntimeWriteContext,
    input: RunControlAuditInput
  ): void {
    const operation = authority.operation;
    const lifecycleStatus = operation === "start" ? "running" : "stopped";
    const relatedEvidence = [
      input.command.related_order_request_refs,
      input.command.related_gateway_result_refs,
      input.command.related_execution_result_refs,
      input.decision.related_order_request_refs,
      input.decision.related_gateway_result_refs,
      input.decision.related_execution_result_refs,
      input.audit_event.related_order_request_refs,
      input.audit_event.related_gateway_result_refs,
      input.audit_event.related_execution_result_refs
    ];
    if (
      input.idempotency_key !==
        paperTradingComparisonRuntimeControlIdempotencyKey(authority) ||
      input.runtime_id !== state.run.trading_run_id ||
      input.candidate_id !== state.commitment.candidate_ref.id ||
      input.candidate_version_id !== state.commitment.candidate_version_ref.id ||
      input.command.action !== operation ||
      input.command.requested_lifecycle_status !== lifecycleStatus ||
      input.command.actor_kind !== "human_operator" ||
      input.command.actor_ref?.record_kind !== "operator" ||
      input.command.actor_ref.id !== "runtime-activation-coordinator" ||
      input.command.runtime_operating_policy_ref?.record_kind !==
        "runtime_operating_policy" ||
      input.command.runtime_operating_policy_ref.id !==
        "runtime-operating-policy-paper-v1" ||
      input.command.reason !== "operator_request" ||
      input.decision.decision_outcome !== "allowed" ||
      input.decision.decision_reason !== "policy_allows_control" ||
      input.decision.decided_by_actor_kind !== "policy_engine" ||
      input.decision.decided_by_actor_ref?.record_kind !== "runtime_policy_engine" ||
      input.decision.runtime_operating_policy_ref?.record_kind !==
        "runtime_operating_policy" ||
      input.decision.runtime_operating_policy_ref.id !==
        "runtime-operating-policy-paper-v1" ||
      input.decision.resulting_lifecycle_status !== lifecycleStatus ||
      input.audit_event.event_kind !== "runtime_lifecycle_transitioned" ||
      input.audit_event.actor_kind !== "human_operator" ||
      input.audit_event.actor_ref?.record_kind !== "operator" ||
      input.audit_event.actor_ref.id !== "runtime-activation-coordinator" ||
      input.audit_event.runtime_lifecycle_status !== lifecycleStatus ||
      relatedEvidence.some((refs) => (refs?.length ?? 0) > 0) ||
      !isIsoTimestamp(input.created_at) ||
      Date.parse(input.created_at) < Date.parse(attempt.attempted_at) ||
      operation === "start" && Date.parse(input.created_at) >
        Date.parse(attempt.start_deadline_at) ||
      operation === "start" && state.run.runtime_lifecycle_status !== "running" ||
      operation === "start" && state.sandbox?.lifecycle_status !== "running" ||
      operation === "stop" && ![
        "deployed",
        "starting",
        "running",
        "paused",
        "stopping",
        "stopped",
        "failed",
        "killed",
        "human_review_required"
      ].includes(state.run.runtime_lifecycle_status ?? "registered")
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_transition_mismatch",
        "paper comparison runtime control audit is not the exact bound lifecycle transition"
      );
    }
  }

  private paperTradingComparisonRunControlReplayMatches(
    input: RunControlAuditInput,
    outcome: RunControlAuditOutcome
  ): boolean {
    const command = outcome.command;
    const decision = outcome.decision;
    const audit = outcome.audit_event;
    return outcome.candidate_id === input.candidate_id &&
      outcome.candidate_version_id === input.candidate_version_id &&
      outcome.runtime_id === input.runtime_id &&
      command.idempotency_key === input.idempotency_key &&
      command.action === input.command.action &&
      command.requested_lifecycle_status === input.command.requested_lifecycle_status &&
      command.actor_kind === input.command.actor_kind &&
      sameOptionalRef(command.actor_ref, input.command.actor_ref) &&
      sameOptionalRef(
        command.runtime_operating_policy_ref,
        input.command.runtime_operating_policy_ref
      ) &&
      command.reason === input.command.reason &&
      command.reason_summary === input.command.reason_summary &&
      sameOptionalRef(command.trace_ref, input.command.trace_ref) &&
      sameOptionalPersistedComparisonValue(
        command.related_order_request_refs,
        input.command.related_order_request_refs
      ) &&
      sameOptionalPersistedComparisonValue(
        command.related_gateway_result_refs,
        input.command.related_gateway_result_refs
      ) &&
      sameOptionalPersistedComparisonValue(
        command.related_execution_result_refs,
        input.command.related_execution_result_refs
      ) &&
      command.requested_at === input.created_at &&
      decision.decision_outcome === input.decision.decision_outcome &&
      decision.decision_reason === input.decision.decision_reason &&
      decision.decided_by_actor_kind === input.decision.decided_by_actor_kind &&
      sameOptionalRef(decision.decided_by_actor_ref, input.decision.decided_by_actor_ref) &&
      sameOptionalRef(
        decision.runtime_operating_policy_ref,
        input.decision.runtime_operating_policy_ref ??
          input.command.runtime_operating_policy_ref
      ) &&
      decision.resulting_lifecycle_status === input.decision.resulting_lifecycle_status &&
      sameOptionalRef(
        decision.trace_ref,
        input.decision.trace_ref ?? input.command.trace_ref
      ) &&
      decision.decided_at === input.created_at &&
      audit.event_kind === input.audit_event.event_kind &&
      audit.actor_kind === (input.audit_event.actor_kind ?? input.command.actor_kind) &&
      sameOptionalRef(
        audit.actor_ref,
        input.audit_event.actor_ref ?? input.command.actor_ref
      ) &&
      audit.runtime_lifecycle_status ===
        (input.audit_event.runtime_lifecycle_status ??
          input.decision.resulting_lifecycle_status) &&
      audit.message === input.audit_event.message &&
      sameOptionalRef(
        audit.trace_ref,
        input.audit_event.trace_ref ??
          input.decision.trace_ref ??
          input.command.trace_ref
      ) &&
      audit.created_at === input.created_at;
  }

  private assertPaperTradingComparisonEvaluationTransition(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    state: PaperTradingComparisonRuntimeSideState,
    operation: "start" | "stop",
    evaluation: PaperTradingEvaluationRecord,
    existing?: PaperTradingEvaluationRecord
  ): void {
    if (!existing || !samePersistedComparisonRecord(existing, state.evaluation)) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_state_conflict",
        "paper comparison runtime evaluation current state changed before write"
      );
    }
    if (operation === "start") {
      const transitionAt = Date.parse(evaluation.next_observation_at ?? "") -
        evaluation.interval_ms;
      if (
        state.run.runtime_lifecycle_status !== "running" ||
        state.sandbox?.lifecycle_status !== "running" ||
        (existing.status !== "not_started" && existing.status !== "stopped") ||
        !paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
          evaluation,
          state.baseline,
          "running"
        ) ||
        !Number.isFinite(transitionAt) ||
        transitionAt < Date.parse(attempt.attempted_at) ||
        transitionAt > Date.parse(attempt.start_deadline_at)
      ) {
        throw new LocalStoreError(
          "paper_trading_comparison_runtime_write_transition_mismatch",
          "paper comparison runtime evaluation start is not zero-evidence and bounded"
        );
      }
      return;
    }
    if (
      state.run.runtime_lifecycle_status !== "stopped" ||
      (existing.status !== "running" && existing.status !== "not_started") ||
      existing.status === "running" && state.sandbox !== undefined &&
        state.sandbox.lifecycle_status !== "stopped" &&
        state.sandbox.lifecycle_status !== "removed" ||
      (state.evidenceState === "zero"
        ? !paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
            evaluation,
            state.baseline,
            "stopped"
          )
        : !samePersistedComparisonRecord(
            evaluation,
            stripUndefined({
              ...existing,
              status: "stopped" as const,
              next_observation_at: undefined,
              stopped_at: evaluation.stopped_at
            })
          )) ||
      Date.parse(evaluation.stopped_at ?? "") < Date.parse(attempt.attempted_at)
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_runtime_write_transition_mismatch",
        "paper comparison runtime evaluation stop is not zero-evidence and bounded"
      );
    }
  }

  private async assertPaperTradingCommitmentWriteDoesNotMutateBoundGraph(
    commitment: PaperTradingEvaluationCommitmentRecord
  ): Promise<void> {
    await this.assertNoPairBoundSideMutation({
      runId: commitment.trading_run_ref.id,
      commitmentId: commitment.paper_trading_evaluation_commitment_id
    });
  }

  async reset(): Promise<void> {
    await rm(this.storeRoot, { recursive: true, force: true });
  }

  async seedFixture(): Promise<void> {
    for (const item of createFixtureRecords()) {
      const targetPath = this.itemPath(item.collection, item.id, item.itemDir);
      if (await pathExists(targetPath)) {
        continue;
      }
      await this.writeJson(targetPath, item.record);
    }
  }

  async rebuildProjections(): Promise<void> {
    const queuedRebuild = this.projectionRebuildQueue.then(async () => {
      await this.rebuildProjectionsUnlocked();
    });
    this.projectionRebuildQueue = queuedRebuild.catch(() => {});
    await queuedRebuild;
  }

  private async rebuildProjectionsUnlocked(): Promise<void> {
    const candidates = await this.readCollection<TradingSystemCandidateRecord>("candidates");
    const summaries = candidates
      .map((candidate) => this.toCandidateSummary(candidate))
      .sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));

    const index: CandidateIndexProjection = {
      record_kind: "candidate_index_projection",
      version: 1,
      candidates: summaries
    };
    await this.writeJson(this.collectionIndexPath("candidates"), index);
    await this.writeJson(path.join(this.storeRoot, "read-models/candidates/index.json"), index);

    for (const candidate of candidates) {
      const readModel = await this.buildCandidateInspectReadModel(candidate.candidate_id);
      await this.writeJson(
        path.join(this.storeRoot, "read-models/candidates/items", storeJsonFileName(candidate.candidate_id)),
        readModel
      );
      await this.writeJson(
        path.join(this.storeRoot, "read-models/candidate-evaluations/items", storeJsonFileName(candidate.candidate_id)),
        readModel.evaluation
      );
    }

    const attempts = await this.readCollection<CandidateMaterializationAttemptRecord>(
      "candidate-materialization-attempts"
    );
    const attemptReadModels = attempts
      .map(toCandidateMaterializationAttemptReadModel)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const attemptIndex: CandidateMaterializationAttemptIndexProjection = {
      record_kind: "candidate_materialization_attempt_index_projection",
      version: 1,
      attempts: attemptReadModels
    };
    await this.writeJson(
      path.join(this.storeRoot, "read-models/candidate-materialization-attempts/index.json"),
      attemptIndex
    );
    for (const attempt of attemptReadModels) {
      await this.writeJson(
        path.join(
          this.storeRoot,
          "read-models/candidate-materialization-attempts/items",
          storeJsonFileName(attempt.attempt_id)
        ),
        attempt
      );
    }

    const sandboxes = await this.readCollection<SandboxRecord>(
      "sandboxes"
    );
    const sandboxReadModels = sandboxes
      .map(toSandboxReadModel)
      .sort(compareSandboxReadModels);
    const sandboxIndex: SandboxIndexProjection = {
      record_kind: "sandbox_index_projection",
      version: 1,
      sandboxes: sandboxReadModels
    };
    await this.writeJson(
      path.join(this.storeRoot, "read-models/sandboxes/index.json"),
      sandboxIndex
    );
    for (const sandbox of sandboxReadModels) {
      const sandboxDetail = await this.buildSandboxDetailReadModel(sandbox.sandbox_id);
      await this.writeJson(
        path.join(this.storeRoot, "read-models/sandboxes/items", storeJsonFileName(sandbox.sandbox_id)),
        sandboxDetail
      );
    }
  }

  async initialize(): Promise<void> {
    await this.seedFixture();
    await this.recoverPaperTradingComparisonResearchReleases();
    await this.rebuildProjections();
  }

  async listCandidates(): Promise<CandidateSummaryReadModel[]> {
    const indexPath = path.join(this.storeRoot, "read-models/candidates/index.json");
    try {
      const index = await this.readJson<CandidateIndexProjection>(indexPath);
      return index.candidates;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    await this.selfHealCandidateProjectionIndex();
    try {
      const index = await this.readJson<CandidateIndexProjection>(indexPath);
      return index.candidates;
    } catch (error) {
      if (isMissingFileError(error)) {
        return [];
      }
      throw error;
    }
  }

  private async selfHealCandidateProjectionIndex(): Promise<void> {
    if (!this.candidateProjectionSelfHealPromise) {
      this.candidateProjectionSelfHealPromise = this.rebuildProjections();
    }

    try {
      await this.candidateProjectionSelfHealPromise;
    } finally {
      this.candidateProjectionSelfHealPromise = undefined;
    }
  }

  async getCandidate(candidateId: string): Promise<CandidateInspectReadModel | undefined> {
    try {
      return await this.readJson<CandidateInspectReadModel>(
        path.join(this.storeRoot, "read-models/candidates/items", storeJsonFileName(candidateId))
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async getCandidateVersion(
    candidateVersionId: string
  ): Promise<CandidateVersionRecord | undefined> {
    return this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidateVersionId
    );
  }

  async getTradingRun(tradingRunId: string): Promise<TradingRunRecord | undefined> {
    return this.readOptionalRecord<TradingRunRecord>("trading-runs", tradingRunId);
  }

  async createPaperTradingRun(input: {
    idempotency_key: string;
    candidate_id: string;
    candidate_version_id: string;
    evidence_purpose: PaperTradingEvidencePurpose;
    created_at?: string;
  }): Promise<TradingRunRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.createPaperTradingRunUnlocked(input)
    );
  }

  private async createPaperTradingRunUnlocked(input: {
    idempotency_key: string;
    candidate_id: string;
    candidate_version_id: string;
    evidence_purpose: PaperTradingEvidencePurpose;
    created_at?: string;
  }): Promise<TradingRunRecord> {
    if (
      !nonEmpty(input.idempotency_key) ||
      !nonEmpty(input.candidate_id) ||
      !nonEmpty(input.candidate_version_id) ||
      (input.evidence_purpose !== "research_feedback" && input.evidence_purpose !== "qualification")
    ) {
      throw new LocalStoreError(
        "invalid_paper_trading_run_input",
        "paper TradingRun input is invalid"
      );
    }
    const candidate = await this.readOptionalRecord<TradingSystemCandidateRecord>(
      "candidates",
      input.candidate_id
    );
    if (!candidate) {
      throw new LocalStoreError("candidate_not_found", "paper TradingRun candidate was not found", {
        candidate_id: input.candidate_id
      });
    }
    const version = await this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      input.candidate_version_id
    );
    if (!version) {
      throw new LocalStoreError(
        "candidate_version_not_found",
        "paper TradingRun candidate version was not found",
        { candidate_version_id: input.candidate_version_id }
      );
    }
    if (version.candidate_id !== candidate.candidate_id) {
      throw new LocalStoreError(
        "candidate_version_mismatch",
        "paper TradingRun candidate version belongs to another candidate",
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: version.candidate_version_id
        }
      );
    }
    const systemCodeRef = version.system_code_ref ?? candidate.active_system_code_ref;
    const systemCode = systemCodeRef
      ? await this.getSystemCode(systemCodeRef.id)
      : undefined;
    if (!systemCodeRef || !systemCode) {
      throw new LocalStoreError("system_code_not_found", "paper TradingRun SystemCode was not found", {
        candidate_version_id: version.candidate_version_id
      });
    }

    const suffix = stableSuffix([
      candidate.candidate_id,
      version.candidate_version_id,
      input.evidence_purpose,
      input.idempotency_key
    ].join(":"));
    const runId = `trading-run-paper-session-${suffix}`;
    const placementId = `sandbox-placement-paper-session-${suffix}`;
    const handsEnvironmentId = `hands-environment-paper-session-${suffix}`;
    const memorySurfaceId = `runtime-memory-surface-paper-session-${suffix}`;
    const existingRun = await this.getTradingRun(runId);
    const createdAt = existingRun?.created_at ?? input.created_at ?? new Date().toISOString();
    const run: TradingRunRecord = {
      record_kind: "trading_run",
      version: 1,
      trading_run_id: runId,
      stage_binding_profile: "paper",
      runtime_lifecycle_status: "registered",
      paper_evidence_purpose: input.evidence_purpose,
      candidate_ref: ref("trading_system_candidate", candidate.candidate_id),
      candidate_version_ref: ref("candidate_version", version.candidate_version_id),
      placement_ref: ref("sandbox_placement", placementId),
      hands_environment_ref: ref("hands_environment", handsEnvironmentId),
      memory_surface_ref: ref("runtime_memory_surface", memorySurfaceId),
      system_code_ref: { ...systemCodeRef },
      created_at: createdAt,
      authority_status: "not_live"
    };
    const placement: SandboxPlacementRecord = {
      record_kind: "sandbox_placement",
      version: 1,
      sandbox_placement_id: placementId,
      placement_kind: "fixture_local_placeholder",
      tooling_kind: "fixture_only",
      authority_status: "not_launched"
    };
    const handsEnvironment: HandsEnvironmentRecord = {
      record_kind: "hands_environment",
      version: 1,
      hands_environment_id: handsEnvironmentId,
      environment_kind: "fixture_no_tools",
      authority_status: "not_mounted"
    };
    const memorySurface: RuntimeMemorySurfaceRecord = {
      record_kind: "runtime_memory_surface",
      version: 1,
      runtime_memory_surface_id: memorySurfaceId,
      trust_class: "fixture_context",
      access_mode: "read_only",
      surface_version: "paper-session-v1",
      visibility: "operator_visible",
      quarantine_status: "not_quarantined",
      authority_status: "not_evidence"
    };
    const records = [
      { collection: "sandbox-placements", id: placementId, record: placement },
      { collection: "hands-environments", id: handsEnvironmentId, record: handsEnvironment },
      { collection: "runtime-memory-surfaces", id: memorySurfaceId, record: memorySurface },
      { collection: "trading-runs", id: runId, record: run }
    ] as const;
    const existingRecords = await Promise.all(records.map((item) =>
      this.readOptionalRecord(item.collection, item.id)
    ));
    for (const [index, item] of records.entries()) {
      const existing = existingRecords[index];
      if (existing && !sameJson(existing, item.record)) {
        throw new LocalStoreError(
          "paper_trading_run_conflict",
          "paper TradingRun deterministic record conflicts with persisted content",
          { record_id: item.id }
        );
      }
    }
    if (existingRecords.every(Boolean)) {
      return run;
    }
    await this.assertNoPairBoundSideMutation({ runId });
    for (const [index, item] of records.entries()) {
      if (!existingRecords[index]) {
        await this.writeJson(this.itemPath(item.collection, item.id), item.record);
      }
    }
    return run;
  }

  async listTradingRunsForCandidateVersion(
    candidateVersionId: string
  ): Promise<TradingRunRecord[]> {
    const version = await this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidateVersionId
    );
    if (!version) {
      return [];
    }
    return (await this.readCollection<TradingRunRecord>("trading-runs"))
      .filter((run) =>
        run.candidate_version_ref?.id === candidateVersionId ||
        run.trading_run_id === version.runtime_ref.id
      )
      .sort((left, right) =>
        (left.created_at ?? "").localeCompare(right.created_at ?? "") ||
        left.trading_run_id.localeCompare(right.trading_run_id)
      );
  }

  async getCandidateForTradingRun(tradingRunId: string): Promise<CandidateInspectReadModel | undefined> {
    const run = await this.getTradingRun(tradingRunId);
    if (run?.candidate_ref && run.candidate_version_ref) {
      const candidate = await this.readOptionalRecord<TradingSystemCandidateRecord>(
        "candidates",
        run.candidate_ref.id
      );
      const version = await this.readOptionalRecord<CandidateVersionRecord>(
        "candidate-versions",
        run.candidate_version_ref.id
      );
      if (
        !candidate ||
        !version ||
        version.candidate_id !== candidate.candidate_id ||
        !tradingRunOwnsCandidateVersion(run, candidate, version)
      ) {
        return undefined;
      }
      return this.buildCandidateInspectReadModel(
        candidate.candidate_id,
        version.candidate_version_id,
        run.trading_run_id
      );
    }
    const versions = await this.readCollection<CandidateVersionRecord>("candidate-versions");
    const version = versions.find((candidateVersion) => candidateVersion.runtime_ref.id === tradingRunId);
    return version ? this.getCandidate(version.candidate_id) : undefined;
  }

  async recordOrderFillSurface(surface: OrderFillSurfaceRecord): Promise<OrderFillSurfaceReadModel> {
    if (!isOrderFillSurfaceRecord(surface)) {
      throw new LocalStoreError(
        "invalid_order_fill_surface_input",
        "invalid order-fill substrate surface input",
        { order_fill_surface_id: (surface as Partial<OrderFillSurfaceRecord> | undefined)?.order_fill_surface_id }
      );
    }
    await this.writeJson(
      this.itemPath("substrate-state-surfaces", surface.order_fill_surface_id),
      surface
    );
    await this.rebuildProjections();
    return toOrderFillSurfaceReadModel(surface);
  }

  async listOrderFillSurfaces(
    query: OrderFillSurfaceQueryInput = {}
  ): Promise<OrderFillSurfaceReadModel[]> {
    return (await this.readCollection<FixtureRecord>("substrate-state-surfaces"))
      .filter(isOrderFillSurfaceRecord)
      .filter((surface) => matchesOrderFillSurfaceQuery(surface, query))
      .sort(compareOrderFillSurfaces)
      .map(toOrderFillSurfaceReadModel);
  }

  async getLatestOrderFillSurface(
    query: OrderFillSurfaceQueryInput = {}
  ): Promise<OrderFillSurfaceReadModel | undefined> {
    return (await this.listOrderFillSurfaces(query)).at(-1);
  }

  async recordPublicMarketLivenessSurface(
    surface: PublicMarketLivenessSurfaceRecord
  ): Promise<PublicMarketLivenessSurfaceReadModel> {
    if (!isPublicMarketLivenessSurfaceRecord(surface)) {
      throw new LocalStoreError(
        "invalid_public_market_liveness_surface_input",
        "invalid public market liveness substrate surface input",
        {
          public_market_liveness_surface_id:
            (surface as Partial<PublicMarketLivenessSurfaceRecord> | undefined)
              ?.public_market_liveness_surface_id
        }
      );
    }
    await this.writeJson(
      this.itemPath("substrate-state-surfaces", surface.public_market_liveness_surface_id),
      surface
    );
    await this.rebuildProjections();
    return toPublicMarketLivenessSurfaceReadModel(surface);
  }

  async listPublicMarketLivenessSurfaces(
    query: PublicMarketLivenessSurfaceQueryInput = {}
  ): Promise<PublicMarketLivenessSurfaceReadModel[]> {
    return (await this.readCollection<FixtureRecord>("substrate-state-surfaces"))
      .filter(isPublicMarketLivenessSurfaceRecord)
      .filter((surface) => matchesPublicMarketLivenessSurfaceQuery(surface, query))
      .sort(comparePublicMarketLivenessSurfaces)
      .map(toPublicMarketLivenessSurfaceReadModel);
  }

  async getLatestPublicMarketLivenessSurface(
    query: PublicMarketLivenessSurfaceQueryInput = {}
  ): Promise<PublicMarketLivenessSurfaceReadModel | undefined> {
    return (await this.listPublicMarketLivenessSurfaces(query)).at(-1);
  }

  async recordPrivateReadinessPreflightSurface(
    surface: PrivateReadinessPreflightSurfaceRecord
  ): Promise<PrivateReadinessPreflightSurfaceReadModel> {
    if (!isPrivateReadinessPreflightSurfaceRecord(surface)) {
      throw new LocalStoreError(
        "invalid_private_readiness_preflight_surface_input",
        "invalid private-readiness preflight substrate surface input",
        {
          private_readiness_preflight_surface_id:
            (surface as Partial<PrivateReadinessPreflightSurfaceRecord> | undefined)
              ?.private_readiness_preflight_surface_id
        }
      );
    }
    await this.writeJson(
      this.itemPath(
        "substrate-state-surfaces",
        surface.private_readiness_preflight_surface_id
      ),
      surface
    );
    await this.rebuildProjections();
    return toPrivateReadinessPreflightSurfaceReadModel(surface);
  }

  async listPrivateReadinessPreflightSurfaces(
    query: PrivateReadinessPreflightSurfaceQueryInput = {}
  ): Promise<PrivateReadinessPreflightSurfaceReadModel[]> {
    return (await this.readCollection<FixtureRecord>("substrate-state-surfaces"))
      .filter(isPrivateReadinessPreflightSurfaceRecord)
      .filter((surface) => matchesPrivateReadinessPreflightSurfaceQuery(surface, query))
      .sort(comparePrivateReadinessPreflightSurfaces)
      .map(toPrivateReadinessPreflightSurfaceReadModel);
  }

  async getLatestPrivateReadinessPreflightSurface(
    query: PrivateReadinessPreflightSurfaceQueryInput = {}
  ): Promise<PrivateReadinessPreflightSurfaceReadModel | undefined> {
    return (await this.listPrivateReadinessPreflightSurfaces(query)).at(-1);
  }

  async recordPrivateReadinessPosture(
    posture: PrivateReadinessPostureRecord
  ): Promise<PrivateReadinessPostureReadModel> {
    if (!isCompletePrivateReadinessPostureRecord(posture)) {
      throw new LocalStoreError(
        "invalid_private_readiness_posture_input",
        "invalid private-readiness posture input",
        {
          private_readiness_posture_id:
            (posture as Partial<PrivateReadinessPostureRecord> | undefined)
              ?.private_readiness_posture_id
        }
      );
    }
    await this.writeJson(
      this.itemPath("private-readiness-postures", posture.private_readiness_posture_id),
      posture
    );
    await this.rebuildProjections();
    return toPrivateReadinessPostureReadModel(posture);
  }

  async recordLocalPrivateReadinessPosture(
    input: PrivateReadinessPostureWriteInput
  ): Promise<PrivateReadinessPostureReadModel> {
    if (!isPrivateReadinessPostureWriteInput(input)) {
      throw new LocalStoreError(
        "invalid_private_readiness_posture_input",
        "invalid private-readiness posture write input",
        {
          idempotency_key: (input as Partial<PrivateReadinessPostureWriteInput> | undefined)
            ?.idempotency_key
        }
      );
    }

    const postureId = privateReadinessPostureRecordId(input.idempotency_key);
    const existing = await this.readOptionalRecord<PrivateReadinessPostureRecord>(
      "private-readiness-postures",
      postureId
    );
    if (existing && isPrivateReadinessPostureRecord(existing)) {
      return toPrivateReadinessPostureReadModel(existing);
    }

    const observedAt = input.observed_at ?? new Date().toISOString();
    const posture: PrivateReadinessPostureRecord = stripUndefined({
      record_kind: "private_readiness_posture",
      version: 1,
      private_readiness_posture_id: postureId,
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      product_category: "perpetual_futures",
      operator_approval_gate: input.operator_approval_gate,
      jurisdiction_risk_gate: input.jurisdiction_risk_gate,
      live_binding_gate: input.live_binding_gate,
      secret_handling_gate: input.secret_handling_gate,
      stop_behavior_gate: input.stop_behavior_gate,
      secret_reference_configured: input.secret_reference_configured,
      secret_reference_ref: input.secret_reference_ref,
      raw_secret_material_present: false,
      source_timestamp: observedAt,
      observed_at: observedAt,
      updated_at: observedAt,
      source_kind: "local_config",
      source_ref: input.source_ref ?? ref("local_config", postureId),
      fixture_backed: false,
      simulated: true,
      no_authority: {
        live_exchange: false,
        order_submission: false,
        credentials: false
      },
      authority_status: "not_live"
    } satisfies PrivateReadinessPostureRecord);

    return this.recordPrivateReadinessPosture(posture);
  }

  async listPrivateReadinessPostures(
    query: PrivateReadinessPostureQueryInput = {}
  ): Promise<PrivateReadinessPostureReadModel[]> {
    return (await this.readCollection<FixtureRecord>("private-readiness-postures"))
      .filter(isPrivateReadinessPostureRecord)
      .filter((posture) => matchesPrivateReadinessPostureQuery(posture, query))
      .sort(comparePrivateReadinessPostures)
      .map(toPrivateReadinessPostureReadModel);
  }

  async getLatestPrivateReadinessPosture(
    query: PrivateReadinessPostureQueryInput = {}
  ): Promise<PrivateReadinessPostureReadModel | undefined> {
    return (await this.listPrivateReadinessPostures(query)).at(-1);
  }

  async recordAccountPositionRiskMirrorSurface(
    surface: AccountPositionRiskMirrorSurfaceRecord
  ): Promise<AccountPositionRiskMirrorSurfaceReadModel> {
    if (!isAccountPositionRiskMirrorSurfaceRecord(surface)) {
      throw new LocalStoreError(
        "invalid_account_position_risk_mirror_surface_input",
        "invalid account-position-risk mirror substrate surface input",
        {
          account_position_risk_mirror_surface_id:
            (surface as Partial<AccountPositionRiskMirrorSurfaceRecord> | undefined)
              ?.account_position_risk_mirror_surface_id
        }
      );
    }
    await this.writeJson(
      this.itemPath(
        "substrate-state-surfaces",
        surface.account_position_risk_mirror_surface_id
      ),
      surface
    );
    await this.rebuildProjections();
    return toAccountPositionRiskMirrorSurfaceReadModel(surface);
  }

  async listAccountPositionRiskMirrorSurfaces(
    query: AccountPositionRiskMirrorSurfaceQueryInput = {}
  ): Promise<AccountPositionRiskMirrorSurfaceReadModel[]> {
    return (await this.readCollection<FixtureRecord>("substrate-state-surfaces"))
      .filter(isAccountPositionRiskMirrorSurfaceRecord)
      .filter((surface) => matchesAccountPositionRiskMirrorSurfaceQuery(surface, query))
      .sort(compareAccountPositionRiskMirrorSurfaces)
      .map(toAccountPositionRiskMirrorSurfaceReadModel);
  }

  async getLatestAccountPositionRiskMirrorSurface(
    query: AccountPositionRiskMirrorSurfaceQueryInput = {}
  ): Promise<AccountPositionRiskMirrorSurfaceReadModel | undefined> {
    return (await this.listAccountPositionRiskMirrorSurfaces(query)).at(-1);
  }

  async getCandidateEvaluationRun(
    evaluationRunRecordId: string
  ): Promise<CandidateEvaluationRunOutcome | undefined> {
    const evaluationRun = await this.readOptionalRecord<EvaluationRunRecord>(
      "evaluation-runs",
      evaluationRunRecordId
    );
    if (!evaluationRun) {
      return undefined;
    }
    return this.toCandidateEvaluationRunOutcome(evaluationRun);
  }

  async getSystemCode(systemCodeId: string): Promise<SystemCodeRecord | undefined> {
    return this.readOptionalRecord<SystemCodeRecord>("system-codes", systemCodeId);
  }

  async recordSystemCode(systemCode: SystemCodeRecord): Promise<SystemCodeRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordSystemCodeUnlocked(systemCode)
    );
  }

  private async recordSystemCodeUnlocked(systemCode: SystemCodeRecord): Promise<SystemCodeRecord> {
    if (!isSystemCodeRecord(systemCode)) {
      throw new LocalStoreError(
        "invalid_system_code_input",
        "invalid system code input",
        { system_code_id: (systemCode as Partial<SystemCodeRecord> | undefined)?.system_code_id }
      );
    }
    const identity = await this.assertExactAuthorityIdentity({
      collection: "system-codes",
      id: systemCode.system_code_id,
      recordKind: "system_code",
      next: systemCode,
      digestInput: paperTradingComparisonSystemCodeRecordDigestInput
    });
    if (identity === "exact_replay") {
      return systemCode;
    }
    await this.writeJson(this.itemPath("system-codes", systemCode.system_code_id), systemCode);
    return systemCode;
  }

  async recordCandidateAdmissionDecision(
    decision: CandidateAdmissionDecisionRecord
  ): Promise<CandidateAdmissionDecisionRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordCandidateAdmissionDecisionUnlocked(decision)
    );
  }

  private async recordCandidateAdmissionDecisionUnlocked(
    decision: CandidateAdmissionDecisionRecord
  ): Promise<CandidateAdmissionDecisionRecord> {
    await this.assertCandidateAdmissionDecisionIntegrity(
      decision,
      "invalid_candidate_admission_decision_input"
    );
    const identity = await this.assertExactAuthorityIdentity({
      collection: "candidate-admission-decisions",
      id: decision.candidate_admission_decision_id,
      recordKind: "candidate_admission_decision",
      next: decision,
      digestInput: paperTradingComparisonAdmissionDecisionDigestInput
    });
    if (identity === "exact_replay") {
      return decision;
    }
    await this.writeJson(
      this.itemPath(
        "candidate-admission-decisions",
        decision.candidate_admission_decision_id
      ),
      decision
    );
    return decision;
  }

  private async assertCandidateAdmissionDecisionIntegrity(
    decision: CandidateAdmissionDecisionRecord,
    invalidShapeErrorCode:
      | "invalid_candidate_admission_decision_input"
      | "candidate_admission_decision_reload_failed"
  ): Promise<void> {
    if (!isCandidateAdmissionDecisionRecord(decision)) {
      throw new LocalStoreError(
        invalidShapeErrorCode,
        invalidShapeErrorCode === "candidate_admission_decision_reload_failed"
          ? "persisted candidate admission decision has invalid runtime shape"
          : "invalid candidate admission decision input",
        {
          candidate_admission_decision_id:
            (decision as Partial<CandidateAdmissionDecisionRecord> | undefined)
              ?.candidate_admission_decision_id
        }
      );
    }
    const [
      preflightCommitment,
      sourceSystemCode,
      systemCode,
      experiment,
      evaluation,
      finding,
      conformance,
      behaviorFingerprint,
      matchingBehaviorFingerprint
    ] = await Promise.all([
      decision.research_preflight_commitment_ref
        ? this.getResearchPreflightCommitment(
            decision.research_preflight_commitment_ref.id
          )
        : Promise.resolve(undefined),
      this.readOptionalRecord<SystemCodeRecord>(
        "system-codes",
        decision.source_system_code_ref.id
      ),
      this.readOptionalRecord<SystemCodeRecord>("system-codes", decision.system_code_ref.id),
      this.readOptionalRecord<ExperimentRunRecord>(
        "experiment-runs",
        decision.experiment_run_ref.id
      ),
      this.readOptionalRecord<TradingEvaluationResultRecord>(
        "trading-evaluation-results",
        decision.trading_evaluation_result_ref.id
      ),
      this.readOptionalRecord<ResearchFindingRecord>(
        "research-findings",
        decision.research_finding_ref.id
      ),
      decision.paper_trading_handoff_conformance_ref
        ? this.readOptionalRecord<PaperTradingHandoffConformanceRecord>(
            "paper-trading-handoff-conformances",
            decision.paper_trading_handoff_conformance_ref.id
          )
        : Promise.resolve(undefined),
      decision.research_behavior_fingerprint_ref
        ? this.getResearchBehaviorFingerprint(
            decision.research_behavior_fingerprint_ref.id
          )
        : Promise.resolve(undefined),
      decision.matching_research_behavior_fingerprint_ref
        ? this.getResearchBehaviorFingerprint(
            decision.matching_research_behavior_fingerprint_ref.id
          )
        : Promise.resolve(undefined)
    ]);
    const referencedRecords: Array<{
      ref: NonNullable<CandidateAdmissionDecisionRecord[
        | "source_system_code_ref"
        | "research_preflight_commitment_ref"
        | "system_code_ref"
        | "experiment_run_ref"
        | "trading_evaluation_result_ref"
        | "research_finding_ref"
        | "paper_trading_handoff_conformance_ref"
        | "research_behavior_fingerprint_ref"
        | "matching_research_behavior_fingerprint_ref"
      ]>;
      record: FixtureRecord | undefined;
    }> = [
      ...(decision.research_preflight_commitment_ref
        ? [{
            ref: decision.research_preflight_commitment_ref,
            record: preflightCommitment
          }]
        : []),
      {
        ref: decision.source_system_code_ref,
        record: sourceSystemCode
      },
      {
        ref: decision.system_code_ref,
        record: systemCode
      },
      {
        ref: decision.experiment_run_ref,
        record: experiment
      },
      {
        ref: decision.trading_evaluation_result_ref,
        record: evaluation
      },
      {
        ref: decision.research_finding_ref,
        record: finding
      },
      ...(decision.paper_trading_handoff_conformance_ref
        ? [{
            ref: decision.paper_trading_handoff_conformance_ref,
            record: conformance
        }]
        : []),
      ...(decision.research_behavior_fingerprint_ref
        ? [{
            ref: decision.research_behavior_fingerprint_ref,
            record: behaviorFingerprint
          }]
        : []),
      ...(decision.matching_research_behavior_fingerprint_ref
        ? [{
            ref: decision.matching_research_behavior_fingerprint_ref,
            record: matchingBehaviorFingerprint
          }]
        : [])
    ];
    for (const reference of referencedRecords) {
      if (!reference.record || reference.record.record_kind !== reference.ref.record_kind) {
        throw new LocalStoreError(
          "candidate_admission_reference_not_found",
          `candidate admission reference ${reference.ref.record_kind}:${reference.ref.id} not found`,
          {
            candidate_admission_decision_id: decision.candidate_admission_decision_id,
            referenced_record_kind: reference.ref.record_kind,
            referenced_record_id: reference.ref.id
          }
        );
      }
    }
    if (!sourceSystemCode || !systemCode || !experiment || !evaluation || !finding) {
      throw new LocalStoreError(
        "candidate_admission_reference_not_found",
        "candidate admission reference not found",
        { candidate_admission_decision_id: decision.candidate_admission_decision_id }
      );
    }
    if (conformance) {
      this.assertPersistedPaperTradingHandoffConformance(conformance);
    }
    const mismatchFields = [
      preflightCommitment && preflightCommitment.commitment_digest !==
        decision.research_preflight_commitment_digest
        ? "research_preflight_commitment.commitment_digest"
        : undefined,
      preflightCommitment && preflightCommitment.source_system_code_ref.id !==
        decision.source_system_code_ref.id
        ? "research_preflight_commitment.source_system_code_ref"
        : undefined,
      preflightCommitment && preflightCommitment.source_artifact_digest !==
        decision.source_artifact_digest
        ? "research_preflight_commitment.source_artifact_digest"
        : undefined,
      preflightCommitment && preflightCommitment.research_worker_ref.id !==
        experiment?.research_worker_ref.id
        ? "research_preflight_commitment.research_worker_ref"
        : undefined,
      preflightCommitment && preflightCommitment.research_direction_ref.id !==
        experiment?.research_direction_ref.id
        ? "research_preflight_commitment.research_direction_ref"
        : undefined,
      preflightCommitment && Date.parse(preflightCommitment.committed_at) >
        Date.parse(decision.decided_at)
        ? "research_preflight_commitment.committed_at"
        : undefined,
      sourceSystemCode.artifact_digest !== decision.source_artifact_digest &&
          preflightCommitment?.memory_policy?.control_assignment === undefined
        ? "source_system_code.artifact_digest"
        : undefined,
      systemCode.artifact_digest !== decision.submitted_artifact_digest
        ? "system_code.artifact_digest"
        : undefined,
      experiment.system_code_ref.id !== decision.system_code_ref.id
        ? "experiment_run.system_code_ref"
        : undefined,
      experiment.status !== decision.experiment_status
        ? "experiment_run.status"
        : undefined,
      evaluation.experiment_run_ref.id !== decision.experiment_run_ref.id
        ? "trading_evaluation_result.experiment_run_ref"
        : undefined,
      evaluation.trading_evaluation_task_ref.id !== experiment.trading_evaluation_task_ref.id
        ? "trading_evaluation_result.trading_evaluation_task_ref"
        : undefined,
      evaluation.result_status !== decision.evaluation_status
        ? "trading_evaluation_result.result_status"
        : undefined,
      evaluation.evidence_disposition !== decision.evidence_disposition
        ? "trading_evaluation_result.evidence_disposition"
        : undefined,
      finding.experiment_run_ref.id !== decision.experiment_run_ref.id
        ? "research_finding.experiment_run_ref"
        : undefined,
      finding.trading_evaluation_result_ref.id !== decision.trading_evaluation_result_ref.id
        ? "research_finding.trading_evaluation_result_ref"
        : undefined,
      conformance && conformance.system_code_ref.id !== decision.system_code_ref.id
        ? "paper_trading_handoff_conformance.system_code_ref"
        : undefined,
      conformance && conformance.experiment_run_ref.id !== decision.experiment_run_ref.id
        ? "paper_trading_handoff_conformance.experiment_run_ref"
        : undefined,
      conformance &&
        conformance.trading_evaluation_task_ref.id !== evaluation.trading_evaluation_task_ref.id
        ? "paper_trading_handoff_conformance.trading_evaluation_task_ref"
        : undefined,
      conformance &&
        conformance.status !== decision.paper_handoff_conformance_status
        ? "paper_trading_handoff_conformance.status"
        : undefined,
      conformance &&
        conformance.evidence_digest !== decision.paper_trading_handoff_conformance_digest
        ? "paper_trading_handoff_conformance.evidence_digest"
        : undefined,
      conformance && decision.runnable_paper_handoff &&
        (conformance.status !== "passed" || !conformance.runnable_paper_handoff)
        ? "paper_trading_handoff_conformance.runnable_paper_handoff"
        : undefined,
      behaviorFingerprint &&
        behaviorFingerprint.system_code_ref.id !== decision.system_code_ref.id
        ? "research_behavior_fingerprint.system_code_ref"
        : undefined,
      behaviorFingerprint &&
        behaviorFingerprint.system_code_artifact_digest !==
          decision.submitted_artifact_digest
        ? "research_behavior_fingerprint.system_code_artifact_digest"
        : undefined,
      behaviorFingerprint &&
        behaviorFingerprint.fingerprint_digest !==
          decision.research_behavior_fingerprint_digest
        ? "research_behavior_fingerprint.fingerprint_digest"
        : undefined,
      behaviorFingerprint && evaluation.research_preflight_commitment_ref &&
        behaviorFingerprint.research_preflight_commitment_ref.id !==
          evaluation.research_preflight_commitment_ref.id
        ? "research_behavior_fingerprint.research_preflight_commitment_ref"
        : undefined,
      behaviorFingerprint && preflightCommitment &&
        behaviorFingerprint.research_preflight_commitment_ref.id !==
          preflightCommitment.research_preflight_commitment_id
        ? "research_behavior_fingerprint.admission_preflight_ref"
        : undefined,
      evaluation.research_preflight_commitment_ref && preflightCommitment &&
        evaluation.research_preflight_commitment_ref.id !==
          preflightCommitment.research_preflight_commitment_id
        ? "trading_evaluation_result.admission_preflight_ref"
        : undefined,
      behaviorFingerprint &&
        Date.parse(behaviorFingerprint.created_at) > Date.parse(decision.decided_at)
        ? "research_behavior_fingerprint.created_at"
        : undefined,
      behaviorFingerprint && !finding.supporting_record_refs.some((supportingRef) =>
        supportingRef.record_kind === "research_behavior_fingerprint" &&
        supportingRef.id === behaviorFingerprint.research_behavior_fingerprint_id
      )
        ? "research_finding.research_behavior_fingerprint_ref"
        : undefined,
      matchingBehaviorFingerprint &&
        matchingBehaviorFingerprint.protocol_version !==
          behaviorFingerprint?.protocol_version
        ? "matching_research_behavior_fingerprint.protocol_version"
        : undefined
    ].filter((field): field is string => Boolean(field));
    if (mismatchFields.length > 0) {
      throw new LocalStoreError(
        "candidate_admission_reference_mismatch",
        "candidate admission references do not match persisted evidence",
        {
          candidate_admission_decision_id: decision.candidate_admission_decision_id,
          mismatch_fields: mismatchFields
        }
      );
    }
    if (decision.status === "admitted" &&
      (preflightCommitment || evaluation.research_preflight_commitment_ref)) {
      if (!conformance ||
        !decision.paper_trading_handoff_conformance_ref ||
        !decision.paper_trading_handoff_conformance_digest ||
        !evaluation.research_preflight_commitment_ref ||
        !evaluation.research_preflight_commitment_digest ||
        !evaluation.submitted_system_code_ref ||
        !evaluation.submitted_artifact_digest ||
        !evaluation.sealed_admission_suite_digest ||
        evaluation.evaluation_phase !== "sealed_admission" ||
        evaluation.submission_sequence !== 1 ||
        !Number.isInteger(evaluation.selected_development_submission_sequence) ||
        Number(evaluation.selected_development_submission_sequence) < 1) {
        throw new LocalStoreError(
          "candidate_admission_research_preflight_required",
          "new admitted decisions require a complete sealed ResearchPreflight chain",
          {
            candidate_admission_decision_id:
              decision.candidate_admission_decision_id
          }
        );
      }
      const commitment = await this.getResearchPreflightCommitment(
        evaluation.research_preflight_commitment_ref.id
      );
      const preflightMismatchFields = [
        !commitment ? "research_preflight_commitment_ref" : undefined,
        commitment && commitment.commitment_digest !==
          evaluation.research_preflight_commitment_digest
          ? "research_preflight_commitment_digest"
          : undefined,
        commitment && commitment.source_system_code_ref.id !==
          decision.source_system_code_ref.id
          ? "source_system_code_ref"
          : undefined,
        commitment && commitment.source_artifact_digest !==
          decision.source_artifact_digest
          ? "source_artifact_digest"
          : undefined,
        commitment && commitment.research_worker_ref.id !==
          experiment.research_worker_ref.id
          ? "research_worker_ref"
          : undefined,
        commitment && commitment.research_direction_ref.id !==
          experiment.research_direction_ref.id
          ? "research_direction_ref"
          : undefined,
        commitment && commitment.sealed_admission_policy.suite_digest !==
          evaluation.sealed_admission_suite_digest
          ? "sealed_admission_suite_digest"
          : undefined,
        commitment && Number(evaluation.selected_development_submission_sequence) >
          commitment.development_policy.submission_limit
          ? "selected_development_submission_sequence"
          : undefined,
        evaluation.submitted_system_code_ref.id !== decision.system_code_ref.id
          ? "submitted_system_code_ref"
          : undefined,
        evaluation.submitted_artifact_digest !== decision.submitted_artifact_digest
          ? "submitted_artifact_digest"
          : undefined,
        conformance.system_code_ref.id !== evaluation.submitted_system_code_ref.id
          ? "paper_handoff.system_code_ref"
          : undefined,
        conformance.system_code_artifact_digest !==
          evaluation.submitted_artifact_digest
          ? "paper_handoff.system_code_artifact_digest"
          : undefined,
        Date.parse(decision.decided_at) < Date.parse(evaluation.completed_at)
          ? "decided_at.before_evaluation"
          : undefined,
        Date.parse(decision.decided_at) < Date.parse(conformance.completed_at)
          ? "decided_at.before_paper_handoff"
          : undefined
      ].filter((field): field is string => Boolean(field));
      if (preflightMismatchFields.length > 0) {
        throw new LocalStoreError(
          "candidate_admission_research_preflight_mismatch",
          "candidate admission does not match the sealed ResearchPreflight graph",
          {
            candidate_admission_decision_id:
              decision.candidate_admission_decision_id,
            mismatch_fields: preflightMismatchFields
          }
        );
      }
    }
    await this.assertCandidateAdmissionBehaviorComparison({
      decision,
      evaluation,
      behaviorFingerprint,
      matchingBehaviorFingerprint
    });
  }

  async getCandidateAdmissionDecision(
    decisionId: string
  ): Promise<CandidateAdmissionDecisionRecord | undefined> {
    const decision = await this.readOptionalRecord<CandidateAdmissionDecisionRecord>(
      "candidate-admission-decisions",
      decisionId
    );
    if (decision) {
      await this.assertCandidateAdmissionDecisionIntegrity(
        decision,
        "candidate_admission_decision_reload_failed"
      );
    }
    return decision;
  }

  async recordPaperTradingHandoffConformance(
    record: PaperTradingHandoffConformanceRecord
  ): Promise<PaperTradingHandoffConformanceRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingHandoffConformanceUnlocked(record)
    );
  }

  private async recordPaperTradingHandoffConformanceUnlocked(
    record: PaperTradingHandoffConformanceRecord
  ): Promise<PaperTradingHandoffConformanceRecord> {
    if (!paperTradingHandoffConformanceHasRuntimeShape(record)) {
      throw new LocalStoreError(
        "invalid_paper_trading_handoff_conformance_input",
        "invalid paper trading handoff conformance input",
        {
          paper_trading_handoff_conformance_id:
            (record as Partial<PaperTradingHandoffConformanceRecord> | undefined)
              ?.paper_trading_handoff_conformance_id
        }
      );
    }
    const expectedDigest = comparisonExactRecordDigest(
      paperTradingHandoffConformanceDigestInput(record)
    );
    if (record.evidence_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_handoff_conformance_digest_mismatch",
        "paper trading handoff conformance digest does not match canonical content",
        { paper_trading_handoff_conformance_id: record.paper_trading_handoff_conformance_id }
      );
    }
    const [systemCode, experiment] = await Promise.all([
      this.readOptionalRecord<SystemCodeRecord>("system-codes", record.system_code_ref.id),
      this.readOptionalRecord<ExperimentRunRecord>(
        "experiment-runs",
        record.experiment_run_ref.id
      )
    ]);
    if (!systemCode || !experiment) {
      throw new LocalStoreError(
        "paper_trading_handoff_conformance_reference_not_found",
        "paper trading handoff conformance reference not found",
        {
          paper_trading_handoff_conformance_id: record.paper_trading_handoff_conformance_id,
          missing_record_kind: !systemCode ? "system_code" : "experiment_run"
        }
      );
    }
    const mismatchFields = [
      systemCode.artifact_digest !== record.system_code_artifact_digest
        ? "system_code.artifact_digest"
        : undefined,
      experiment.system_code_ref.id !== record.system_code_ref.id
        ? "experiment_run.system_code_ref"
        : undefined,
      experiment.trading_evaluation_task_ref.id !== record.trading_evaluation_task_ref.id
        ? "experiment_run.trading_evaluation_task_ref"
        : undefined
    ].filter((field): field is string => Boolean(field));
    if (mismatchFields.length > 0) {
      throw new LocalStoreError(
        "paper_trading_handoff_conformance_reference_mismatch",
        "paper trading handoff conformance references do not match persisted evidence",
        {
          paper_trading_handoff_conformance_id: record.paper_trading_handoff_conformance_id,
          mismatch_fields: mismatchFields
        }
      );
    }
    const existing = await this.readOptionalRecord<PaperTradingHandoffConformanceRecord>(
      "paper-trading-handoff-conformances",
      record.paper_trading_handoff_conformance_id
    );
    if (existing && !sameJson(existing, record)) {
      throw new LocalStoreError(
        "paper_trading_handoff_conformance_conflict",
        "paper trading handoff conformance is immutable under its deterministic identity",
        { paper_trading_handoff_conformance_id: record.paper_trading_handoff_conformance_id }
      );
    }
    if (!existing) {
      await this.writeJson(
        this.itemPath(
          "paper-trading-handoff-conformances",
          record.paper_trading_handoff_conformance_id
        ),
        record
      );
    }
    return record;
  }

  async getPaperTradingHandoffConformance(
    conformanceId: string
  ): Promise<PaperTradingHandoffConformanceRecord | undefined> {
    const record = await this.readOptionalRecord<PaperTradingHandoffConformanceRecord>(
      "paper-trading-handoff-conformances",
      conformanceId
    );
    if (record) this.assertPersistedPaperTradingHandoffConformance(record);
    return record;
  }

  async listPaperTradingHandoffConformances(): Promise<PaperTradingHandoffConformanceRecord[]> {
    const records = await this.readCollection<PaperTradingHandoffConformanceRecord>(
      "paper-trading-handoff-conformances"
    );
    records.forEach((record) => this.assertPersistedPaperTradingHandoffConformance(record));
    return records.sort(comparePaperTradingHandoffConformances);
  }

  private assertPersistedPaperTradingHandoffConformance(
    record: PaperTradingHandoffConformanceRecord
  ): void {
    if (!paperTradingHandoffConformanceHasRuntimeShape(record)) {
      throw new LocalStoreError(
        "invalid_persisted_paper_trading_handoff_conformance",
        "persisted paper trading handoff conformance has invalid runtime shape"
      );
    }
    if (record.evidence_digest !== comparisonExactRecordDigest(
      paperTradingHandoffConformanceDigestInput(record)
    )) {
      throw new LocalStoreError(
        "persisted_paper_trading_handoff_conformance_digest_mismatch",
        "persisted paper trading handoff conformance digest does not match canonical content"
      );
    }
  }

  async listCandidateAdmissionDecisions(): Promise<CandidateAdmissionDecisionRecord[]> {
    const decisions = await this.readCollection<CandidateAdmissionDecisionRecord>(
      "candidate-admission-decisions"
    );
    await Promise.all(decisions.map((decision) =>
      this.assertCandidateAdmissionDecisionIntegrity(
        decision,
        "candidate_admission_decision_reload_failed"
      )));
    return decisions.sort(compareCandidateAdmissionDecisions);
  }

  async recordResearchFinding(finding: ResearchFindingRecord): Promise<ResearchFindingRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordResearchFindingUnlocked(finding)
    );
  }

  private async recordResearchFindingUnlocked(
    finding: ResearchFindingRecord
  ): Promise<ResearchFindingRecord> {
    if (!isResearchFindingRecord(finding)) {
      throw new LocalStoreError(
        "invalid_research_finding_input",
        "invalid automated research finding input",
        { research_finding_id: (finding as Partial<ResearchFindingRecord> | undefined)?.research_finding_id }
      );
    }
    await this.assertPaperTradingComparisonResearchReleaseBoundWriteAllowed(
      "research_finding",
      finding.research_finding_id,
      finding
    );
    await this.writeJson(this.itemPath("research-findings", finding.research_finding_id), finding);
    return finding;
  }

  async listResearchFindings(): Promise<ResearchFindingRecord[]> {
    return (await this.readCollection<ResearchFindingRecord>("research-findings")).sort(compareResearchFindings);
  }

  async listResearchFindingsForExperiment(researchExperimentId: string): Promise<ResearchFindingRecord[]> {
    return (await this.listResearchFindings()).filter(
      (finding) => finding.experiment_run_ref.id === researchExperimentId
    );
  }

  async recordCandidateArenaResearchAllocation(
    allocation: CandidateArenaResearchAllocationRecord
  ): Promise<CandidateArenaResearchAllocationRecord> {
    return this.withResearchMemoryControlPublicationTransaction(
      () => this.recordCandidateArenaResearchAllocationUnlocked(allocation)
    );
  }

  private async recordCandidateArenaResearchAllocationUnlocked(
    allocation: CandidateArenaResearchAllocationRecord
  ): Promise<CandidateArenaResearchAllocationRecord> {
    if (!candidateArenaResearchAllocationHasRuntimeShape(allocation)) {
      throw new LocalStoreError(
        "invalid_candidate_arena_research_allocation_input",
        "invalid CandidateArena research allocation input"
      );
    }
    const expectedDigest = comparisonExactRecordDigest(
      candidateArenaResearchAllocationDigestInput(allocation)
    );
    if (allocation.allocation_digest !== expectedDigest) {
      throw new LocalStoreError(
        "candidate_arena_research_allocation_digest_mismatch",
        "CandidateArena research allocation digest does not match its content"
      );
    }
    if (allocation.allocation_policy_basis.basis_kind ===
        "research_allocation_policy_decision") {
      const basis = allocation.allocation_policy_basis;
      const decision = await this.getResearchAllocationPolicyDecision(
        basis.policy_decision_ref.id
      );
      if (!decision) {
        throw new LocalStoreError(
          "candidate_arena_research_allocation_policy_decision_not_found",
          "CandidateArena allocation policy decision was not found"
        );
      }
      const currentPolicyDigest = comparisonExactRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(allocation.policy)
      );
      if (!researchAllocationPolicyDecisionHasRuntimeShape(decision) ||
        decision.policy_decision_digest !== comparisonExactRecordDigest(
          researchAllocationPolicyDecisionDigestInput(decision)
        ) || decision.research_allocation_policy_decision_id !==
          basis.policy_decision_ref.id || decision.policy_decision_digest !==
          basis.policy_decision_digest || decision.study_outcome_ref.id !==
          basis.study_outcome_ref.id || decision.study_outcome_digest !==
          basis.study_outcome_digest || decision.decision_status !== "approved" ||
        decision.effective_default_mode !== allocation.allocation_mode ||
        decision.decision_policy.target_allocation_mode !==
          allocation.allocation_mode || decision.target_allocation_policy_digest !==
          currentPolicyDigest || Date.parse(decision.decided_at) >=
          Date.parse(allocation.allocated_at)) {
        throw new LocalStoreError(
          "candidate_arena_research_allocation_policy_decision_mismatch",
          "CandidateArena allocation policy decision is forged or stale"
        );
      }
    } else if (allocation.allocation_policy_basis.basis_kind ===
        "research_generalization_policy_decision") {
      const basis = allocation.allocation_policy_basis;
      const decision = await this.getResearchGeneralizationPolicyDecision(
        basis.policy_decision_ref.id
      );
      if (!decision) {
        throw new LocalStoreError(
          "candidate_arena_research_allocation_policy_decision_not_found",
          "CandidateArena generalization policy decision was not found"
        );
      }
      const currentPolicyDigest = comparisonExactRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(allocation.policy)
      );
      if (!researchGeneralizationPolicyDecisionHasRuntimeShape(decision) ||
        decision.policy_decision_digest !== comparisonExactRecordDigest(
          researchGeneralizationPolicyDecisionDigestInput(decision)
        ) || decision.research_generalization_policy_decision_id !==
          basis.policy_decision_ref.id || decision.policy_decision_digest !==
          basis.policy_decision_digest ||
        decision.generalization_outcome_ref.id !==
          basis.generalization_outcome_ref.id ||
        decision.generalization_outcome_digest !==
          basis.generalization_outcome_digest ||
        decision.decision_status !== "approved" ||
        decision.effective_default_mode !== allocation.allocation_mode ||
        decision.decision_policy.target_allocation_mode !==
          allocation.allocation_mode ||
        decision.target_allocation_policy_digest !== currentPolicyDigest ||
        Date.parse(decision.decided_at) >= Date.parse(allocation.allocated_at)) {
        throw new LocalStoreError(
          "candidate_arena_research_allocation_policy_decision_mismatch",
          "CandidateArena generalization policy decision is forged or stale"
        );
      }
    }
    const existing = await this.getCandidateArenaResearchAllocation(
      allocation.candidate_arena_research_allocation_id
    );
    if (existing) {
      if (!sameJson(existing, allocation)) {
        throw new LocalStoreError(
          "candidate_arena_research_allocation_conflict",
          "CandidateArena research allocation is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(this.itemPath(
      "candidate-arena-research-allocations",
      allocation.candidate_arena_research_allocation_id
    ), allocation);
    return allocation;
  }

  async getCandidateArenaResearchAllocation(
    allocationId: string
  ): Promise<CandidateArenaResearchAllocationRecord | undefined> {
    const allocation = await this.readOptionalRecord<unknown>(
      "candidate-arena-research-allocations",
      allocationId
    );
    if (allocation === undefined) return undefined;
    return this.assertPersistedCandidateArenaResearchAllocation(allocation);
  }

  async listCandidateArenaResearchAllocations(): Promise<
    CandidateArenaResearchAllocationRecord[]
  > {
    return (await this.readCollection<unknown>(
      "candidate-arena-research-allocations"
    ))
      .map((allocation) =>
        this.assertPersistedCandidateArenaResearchAllocation(allocation)
      )
      .sort(compareCandidateArenaResearchAllocations);
  }

  private assertPersistedCandidateArenaResearchAllocation(
    value: unknown
  ): CandidateArenaResearchAllocationRecord {
    if (!candidateArenaResearchAllocationHasRuntimeShape(value) ||
      value.allocation_digest !== comparisonExactRecordDigest(
        candidateArenaResearchAllocationDigestInput(value)
      )) {
      throw new LocalStoreError(
        "candidate_arena_research_allocation_reload_failed",
        "persisted CandidateArena research allocation is unreadable or corrupt"
      );
    }
    return value;
  }

  async recordResearchGeneralizationProtocol(
    protocol: ResearchGeneralizationProtocolRecord
  ): Promise<ResearchGeneralizationProtocolRecord> {
    if (!researchGeneralizationProtocolHasRuntimeShape(protocol)) {
      throw new LocalStoreError(
        "invalid_research_generalization_protocol_input",
        "invalid ResearchGeneralizationProtocol input"
      );
    }
    if (protocol.target_allocation_policy_digest !==
      comparisonExactRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(
          protocol.target_allocation_policy
        )
      )) {
      throw new LocalStoreError(
        "research_generalization_protocol_allocation_digest_mismatch",
        "ResearchGeneralizationProtocol allocation digest does not match"
      );
    }
    if (protocol.paper_evaluation_protocol.protocol_digest !==
      comparisonExactRecordDigest(
        researchControlCampaignPaperEvaluationProtocolDigestInput(
          protocol.paper_evaluation_protocol
        )
      )) {
      throw new LocalStoreError(
        "research_generalization_protocol_paper_digest_mismatch",
        "ResearchGeneralizationProtocol paper protocol digest does not match"
      );
    }
    if (protocol.market_classifier_policy.classifier_digest !==
      comparisonExactRecordDigest(
        researchGeneralizationMarketClassifierPolicyDigestInput(
          protocol.market_classifier_policy
        )
      )) {
      throw new LocalStoreError(
        "research_generalization_protocol_classifier_digest_mismatch",
        "ResearchGeneralizationProtocol classifier digest does not match"
      );
    }
    if (protocol.protocol_digest !== comparisonExactRecordDigest(
      researchGeneralizationProtocolDigestInput(protocol)
    )) {
      throw new LocalStoreError(
        "research_generalization_protocol_digest_mismatch",
        "ResearchGeneralizationProtocol digest does not match its content"
      );
    }
    if (!researchGeneralizationProtocolHasDeterministicIdentities(protocol)) {
      throw new LocalStoreError(
        "research_generalization_protocol_identity_mismatch",
        "ResearchGeneralizationProtocol identities are not deterministic"
      );
    }
    const existing = await this.getResearchGeneralizationProtocol(
      protocol.research_generalization_protocol_id
    );
    if (existing) {
      if (!sameJson(existing, protocol)) {
        throw new LocalStoreError(
          "research_generalization_protocol_conflict",
          "ResearchGeneralizationProtocol is append-only"
        );
      }
      return existing;
    }
    for (const slot of protocol.study_slots) {
      if (await this.getResearchControlStudy(slot.study_ref.id)) {
        throw new LocalStoreError(
          "research_generalization_protocol_study_already_exists",
          "ResearchGeneralizationProtocol must precede every planned study"
        );
      }
    }
    const publication = await this.writeJsonCreateOnly(this.itemPath(
      "research-generalization-protocols",
      protocol.research_generalization_protocol_id
    ), protocol);
    if (publication === "exists") {
      const winner = await this.getResearchGeneralizationProtocol(
        protocol.research_generalization_protocol_id
      );
      if (!winner || !sameJson(winner, protocol)) {
        throw new LocalStoreError(
          "research_generalization_protocol_conflict",
          "ResearchGeneralizationProtocol is append-only"
        );
      }
      return winner;
    }
    return protocol;
  }

  async getResearchGeneralizationProtocol(
    protocolId: string
  ): Promise<ResearchGeneralizationProtocolRecord | undefined> {
    const protocol = await this.readOptionalRecord<unknown>(
      "research-generalization-protocols",
      protocolId
    );
    return protocol === undefined
      ? undefined
      : this.assertPersistedResearchGeneralizationProtocol(protocol);
  }

  async listResearchGeneralizationProtocols(): Promise<
    ResearchGeneralizationProtocolRecord[]
  > {
    return (await this.readCollection<unknown>(
      "research-generalization-protocols"
    ))
      .map((protocol) =>
        this.assertPersistedResearchGeneralizationProtocol(protocol)
      )
      .sort((left, right) =>
        left.committed_at.localeCompare(right.committed_at) ||
        left.research_generalization_protocol_id.localeCompare(
          right.research_generalization_protocol_id
        )
      );
  }

  private assertPersistedResearchGeneralizationProtocol(
    value: unknown
  ): ResearchGeneralizationProtocolRecord {
    if (!researchGeneralizationProtocolHasRuntimeShape(value) ||
      value.target_allocation_policy_digest !==
        comparisonExactRecordDigest(
          paperTradingComparisonPersistedRecordDigestInput(
            value.target_allocation_policy
          )
        ) ||
      value.paper_evaluation_protocol.protocol_digest !==
        comparisonExactRecordDigest(
          researchControlCampaignPaperEvaluationProtocolDigestInput(
            value.paper_evaluation_protocol
          )
        ) || value.market_classifier_policy.classifier_digest !==
        comparisonExactRecordDigest(
          researchGeneralizationMarketClassifierPolicyDigestInput(
            value.market_classifier_policy
          )
        ) || value.protocol_digest !== comparisonExactRecordDigest(
          researchGeneralizationProtocolDigestInput(value)
        ) || !researchGeneralizationProtocolHasDeterministicIdentities(value)) {
      throw new LocalStoreError(
        "research_generalization_protocol_reload_failed",
        "persisted ResearchGeneralizationProtocol is unreadable or corrupt"
      );
    }
    return value;
  }

  async recordResearchControlStudy(
    study: ResearchControlStudyRecord
  ): Promise<ResearchControlStudyRecord> {
    if (!researchControlStudyHasRuntimeShape(study)) {
      throw new LocalStoreError(
        "invalid_research_control_study_input",
        "invalid ResearchControlStudy input"
      );
    }
    if (study.condition.condition_digest !== comparisonExactRecordDigest(
      researchControlStudyConditionDigestInput(study.condition)
    )) {
      throw new LocalStoreError(
        "research_control_study_condition_digest_mismatch",
        "ResearchControlStudy condition digest does not match its content"
      );
    }
    this.assertResearchControlStudyGeneralizationDigests(study);
    if (study.study_digest !== comparisonExactRecordDigest(
      researchControlStudyDigestInput(study)
    )) {
      throw new LocalStoreError(
        "research_control_study_digest_mismatch",
        "ResearchControlStudy digest does not match its content"
      );
    }
    if (study.research_control_study_id !== researchControlStudyIdForKey(
      study.idempotency_key
    ) || study.replications.some((replication) =>
      replication.campaign_ref.id !== researchControlCampaignIdForStudyKey(
        replication.campaign_idempotency_key
      )
    )) {
      throw new LocalStoreError(
        "research_control_study_identity_mismatch",
        "ResearchControlStudy identities are not deterministic"
      );
    }
    const existing = await this.getResearchControlStudy(
      study.research_control_study_id
    );
    if (existing) {
      if (!sameJson(existing, study)) {
        throw new LocalStoreError(
          "research_control_study_conflict",
          "ResearchControlStudy is append-only"
        );
      }
      return existing;
    }
    await this.assertResearchControlStudyGeneralizationGraph(study);
    await this.assertResearchControlStudyGeneralizationSetAdmission(study);
    for (const replication of study.replications) {
      if (await this.getResearchControlCampaign(replication.campaign_ref.id)) {
        throw new LocalStoreError(
          "research_control_study_campaign_already_exists",
          "ResearchControlStudy must precede every planned campaign"
        );
      }
    }
    const publication = await this.writeJsonCreateOnly(this.itemPath(
      "research-control-studies",
      study.research_control_study_id
    ), study);
    if (publication === "exists") {
      const winner = await this.getResearchControlStudy(
        study.research_control_study_id
      );
      if (!winner || !sameJson(winner, study)) {
        throw new LocalStoreError(
          "research_control_study_conflict",
          "ResearchControlStudy is append-only"
        );
      }
      return winner;
    }
    return study;
  }

  async getResearchControlStudy(
    studyId: string
  ): Promise<ResearchControlStudyRecord | undefined> {
    const study = await this.readOptionalRecord<unknown>(
      "research-control-studies",
      studyId
    );
    if (study === undefined) return undefined;
    const persisted = this.assertPersistedResearchControlStudy(study);
    await this.assertResearchControlStudyGeneralizationGraph(persisted);
    return persisted;
  }

  async listResearchControlStudies(): Promise<ResearchControlStudyRecord[]> {
    const studies = (await this.readCollection<unknown>(
      "research-control-studies"
    )).map((study) => this.assertPersistedResearchControlStudy(study));
    await Promise.all(studies.map((study) =>
      this.assertResearchControlStudyGeneralizationGraph(study)
    ));
    this.assertResearchControlStudyGeneralizationSet(studies);
    return studies.sort((left, right) =>
        left.committed_at.localeCompare(right.committed_at) ||
        left.research_control_study_id.localeCompare(
          right.research_control_study_id
        )
      );
  }

  private assertPersistedResearchControlStudy(
    value: unknown
  ): ResearchControlStudyRecord {
    if (!researchControlStudyHasRuntimeShape(value) ||
      value.condition.condition_digest !== comparisonExactRecordDigest(
        researchControlStudyConditionDigestInput(value.condition)
      ) || value.study_digest !== comparisonExactRecordDigest(
        researchControlStudyDigestInput(value)
      ) || value.research_control_study_id !== researchControlStudyIdForKey(
        value.idempotency_key
      ) || value.replications.some((replication) =>
        replication.campaign_ref.id !== researchControlCampaignIdForStudyKey(
          replication.campaign_idempotency_key
        )
      )) {
      throw new LocalStoreError(
        "research_control_study_reload_failed",
        "persisted ResearchControlStudy is unreadable or corrupt"
      );
    }
    this.assertResearchControlStudyGeneralizationDigests(value, true);
    return value;
  }

  private assertResearchControlStudyGeneralizationDigests(
    study: ResearchControlStudyRecord,
    reloading = false
  ): void {
    const assignment = study.generalization_assignment;
    if (!assignment) return;
    const fail = (
      code: Extract<LocalStoreErrorCode,
        | "research_control_study_generalization_assignment_digest_mismatch"
        | "research_control_study_generalization_market_digest_mismatch"
      >,
      message: string
    ): never => {
      throw new LocalStoreError(
        reloading ? "research_control_study_reload_failed" : code,
        message
      );
    };
    if (assignment.assignment_digest !== comparisonExactRecordDigest(
      researchControlStudyGeneralizationAssignmentDigestInput(assignment)
    )) {
      fail(
        "research_control_study_generalization_assignment_digest_mismatch",
        "ResearchControlStudy generalization assignment digest does not match"
      );
    }
    const marketCondition = assignment.market_condition;
    if (marketCondition.classification_digest !== comparisonExactRecordDigest(
      researchGeneralizationMarketConditionDigestInput(marketCondition)
    ) || marketCondition.public_kline_window.window_digest !==
      comparisonExactRecordDigest(
        researchGeneralizationPublicKlineWindowDigestInput(
          marketCondition.public_kline_window
        )
      ) || marketCondition.classifier_policy.classifier_digest !==
      comparisonExactRecordDigest(
        researchGeneralizationMarketClassifierPolicyDigestInput(
          marketCondition.classifier_policy
        )
      )) {
      fail(
        "research_control_study_generalization_market_digest_mismatch",
        "ResearchControlStudy market-condition evidence digest does not match"
      );
    }
  }

  private async assertResearchControlStudyGeneralizationGraph(
    study: ResearchControlStudyRecord
  ): Promise<void> {
    const assignment = study.generalization_assignment;
    if (!assignment) return;
    const protocol = await this.getResearchGeneralizationProtocol(
      assignment.protocol_ref.id
    );
    if (!protocol) {
      throw new LocalStoreError(
        "research_control_study_generalization_protocol_not_found",
        "ResearchControlStudy generalization protocol was not found"
      );
    }
    if (assignment.protocol_digest !== protocol.protocol_digest) {
      throw new LocalStoreError(
        "research_control_study_generalization_protocol_mismatch",
        "ResearchControlStudy generalization protocol does not match"
      );
    }
    const slot = protocol.study_slots[assignment.slot_index - 1];
    if (!slot || slot.slot_index !== assignment.slot_index ||
      slot.condition_block !== assignment.condition_block ||
      slot.condition_block_study_index !==
        assignment.condition_block_study_index ||
      slot.study_idempotency_key !== study.idempotency_key ||
      slot.study_ref.id !== study.research_control_study_id ||
      !sameJson(
        slot.replication_idempotency_keys,
        study.replications.map((replication) =>
          replication.campaign_idempotency_key
        )
      )) {
      throw new LocalStoreError(
        "research_control_study_generalization_slot_mismatch",
        "ResearchControlStudy does not match its generalization slot"
      );
    }
    if (!sameJson(
      protocol.target_allocation_policy,
      study.condition.allocation_policy
    ) || protocol.target_allocation_policy_digest !==
      study.condition.allocation_policy_digest ||
      !sameJson(protocol.research_agent, study.condition.research_agent) ||
      !sameJson(
        protocol.paper_evaluation_protocol,
        study.condition.paper_evaluation_protocol
      ) || !sameJson(protocol.campaign_policy, study.condition.campaign_policy) ||
      !sameJson(
        protocol.market_classifier_policy,
        assignment.market_condition.classifier_policy
      ) || assignment.source_system_code_artifact_digest !==
        study.condition.source.system_code_artifact_digest) {
      throw new LocalStoreError(
        "research_control_study_generalization_condition_mismatch",
        "ResearchControlStudy condition differs from its protocol"
      );
    }
    if (Date.parse(protocol.committed_at) >= Date.parse(assignment.assigned_at) ||
      Date.parse(assignment.assigned_at) >
        Date.parse(protocol.timing_policy.collection_deadline_at) ||
      Date.parse(assignment.market_condition.classified_at) >
        Date.parse(assignment.assigned_at)) {
      throw new LocalStoreError(
        "research_control_study_generalization_time_mismatch",
        "ResearchControlStudy assignment is outside its prospective window"
      );
    }
  }

  private async assertResearchControlStudyGeneralizationSetAdmission(
    study: ResearchControlStudyRecord
  ): Promise<void> {
    if (!study.generalization_assignment) return;
    const existing = (await this.readCollection<unknown>(
      "research-control-studies"
    )).map((value) => this.assertPersistedResearchControlStudy(value));
    this.assertResearchControlStudyGeneralizationSet([...existing, study]);
  }

  private assertResearchControlStudyGeneralizationSet(
    studies: ResearchControlStudyRecord[]
  ): void {
    const grouped = new Map<string, ResearchControlStudyRecord[]>();
    for (const study of studies) {
      const assignment = study.generalization_assignment;
      if (!assignment) continue;
      const group = grouped.get(assignment.protocol_ref.id) ?? [];
      group.push(study);
      grouped.set(assignment.protocol_ref.id, group);
    }
    for (const group of grouped.values()) {
      const ordered = group.sort((left, right) =>
        left.committed_at.localeCompare(right.committed_at) ||
        left.research_control_study_id.localeCompare(
          right.research_control_study_id
        )
      );
      for (let index = 1; index < ordered.length; index += 1) {
        if (Date.parse(ordered[index]!.committed_at) -
          Date.parse(ordered[index - 1]!.committed_at) < 86_400_000) {
          throw new LocalStoreError(
            "research_control_study_generalization_spacing_not_elapsed",
            "ResearchControlStudy generalization spacing has not elapsed"
          );
        }
      }
      const sourceKeys = ordered.map((study) => {
        const assignment = study.generalization_assignment!;
        return `${assignment.condition_block}:${
          assignment.source_system_code_artifact_digest
        }`;
      });
      if (new Set(sourceKeys).size !== sourceKeys.length) {
        throw new LocalStoreError(
          "research_control_study_generalization_source_reused",
          "ResearchControlStudy source was reused inside one condition block"
        );
      }
    }
  }

  async recordResearchControlStudyOutcome(
    outcome: ResearchControlStudyOutcomeRecord
  ): Promise<ResearchControlStudyOutcomeRecord> {
    if (!researchControlStudyOutcomeHasRuntimeShape(outcome)) {
      throw new LocalStoreError(
        "invalid_research_control_study_outcome_input",
        "invalid ResearchControlStudyOutcome input"
      );
    }
    if (outcome.study_outcome_digest !== comparisonExactRecordDigest(
      researchControlStudyOutcomeDigestInput(outcome)
    )) {
      throw new LocalStoreError(
        "research_control_study_outcome_digest_mismatch",
        "ResearchControlStudyOutcome digest does not match its content"
      );
    }
    if (outcome.research_control_study_outcome_id !==
        researchControlStudyOutcomeIdForStudy(outcome.study_ref.id)) {
      throw new LocalStoreError(
        "research_control_study_outcome_identity_mismatch",
        "ResearchControlStudyOutcome identity is not deterministic"
      );
    }
    const study = await this.getResearchControlStudy(outcome.study_ref.id);
    if (!study) {
      throw new LocalStoreError(
        "research_control_study_outcome_reference_not_found",
        "ResearchControlStudyOutcome study was not found"
      );
    }
    if (outcome.study_digest !== study.study_digest ||
      outcome.replication_results.length !== study.replications.length) {
      throw new LocalStoreError(
        "research_control_study_outcome_reference_mismatch",
        "ResearchControlStudyOutcome does not match its study"
      );
    }
    for (let index = 0; index < study.replications.length; index += 1) {
      const planned = study.replications[index]!;
      const result = outcome.replication_results[index]!;
      const [campaign, campaignOutcome] = await Promise.all([
        this.getResearchControlCampaign(result.campaign_ref.id),
        this.getResearchControlCampaignOutcome(result.campaign_outcome_ref.id)
      ]);
      if (!campaign || !campaignOutcome) {
        throw new LocalStoreError(
          "research_control_study_outcome_reference_not_found",
          "ResearchControlStudyOutcome campaign graph is incomplete"
        );
      }
      const condition = researchControlStudyConditionForCampaign(campaign);
      if (result.replication_index !== planned.replication_index ||
        result.campaign_ref.id !== planned.campaign_ref.id ||
        result.campaign_digest !== campaign.campaign_digest ||
        campaign.idempotency_key !== planned.campaign_idempotency_key ||
        campaign.baseline.snapshot_digest !==
          planned.expected_baseline_snapshot_digest ||
        Date.parse(campaign.committed_at) <= Date.parse(study.committed_at) ||
        !sameJson(condition, study.condition) ||
        campaignOutcome.campaign_ref.id !==
          campaign.research_control_campaign_id ||
        campaignOutcome.campaign_digest !== campaign.campaign_digest ||
        result.campaign_outcome_ref.id !==
          campaignOutcome.research_control_campaign_outcome_id ||
        result.campaign_outcome_digest !== campaignOutcome.outcome_digest ||
        result.observed_rate_difference !==
          campaignOutcome.observed_rate_difference ||
        Date.parse(campaignOutcome.adjudicated_at) <
          Date.parse(campaign.committed_at) ||
        Date.parse(campaignOutcome.adjudicated_at) >
          Date.parse(outcome.adjudicated_at)) {
        throw new LocalStoreError(
          "research_control_study_outcome_reference_mismatch",
          "ResearchControlStudyOutcome campaign graph differs from its plan"
        );
      }
    }
    const existing = await this.getResearchControlStudyOutcome(
      outcome.research_control_study_outcome_id
    );
    if (existing) {
      if (!sameJson(existing, outcome)) {
        throw new LocalStoreError(
          "research_control_study_outcome_conflict",
          "ResearchControlStudyOutcome is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(this.itemPath(
      "research-control-study-outcomes",
      outcome.research_control_study_outcome_id
    ), outcome);
    return outcome;
  }

  async getResearchControlStudyOutcome(
    outcomeId: string
  ): Promise<ResearchControlStudyOutcomeRecord | undefined> {
    const outcome = await this.readOptionalRecord<unknown>(
      "research-control-study-outcomes",
      outcomeId
    );
    return outcome === undefined
      ? undefined
      : this.assertPersistedResearchControlStudyOutcome(outcome);
  }

  async listResearchControlStudyOutcomes(): Promise<
    ResearchControlStudyOutcomeRecord[]
  > {
    return (await this.readCollection<unknown>(
      "research-control-study-outcomes"
    )).map((outcome) =>
      this.assertPersistedResearchControlStudyOutcome(outcome)
    ).sort((left, right) =>
      left.adjudicated_at.localeCompare(right.adjudicated_at) ||
      left.research_control_study_outcome_id.localeCompare(
        right.research_control_study_outcome_id
      )
    );
  }

  private assertPersistedResearchControlStudyOutcome(
    value: unknown
  ): ResearchControlStudyOutcomeRecord {
    if (!researchControlStudyOutcomeHasRuntimeShape(value) ||
      value.study_outcome_digest !== comparisonExactRecordDigest(
        researchControlStudyOutcomeDigestInput(value)
      ) || value.research_control_study_outcome_id !==
        researchControlStudyOutcomeIdForStudy(value.study_ref.id)) {
      throw new LocalStoreError(
        "research_control_study_outcome_reload_failed",
        "persisted ResearchControlStudyOutcome is unreadable or corrupt"
      );
    }
    return value;
  }

  async recordResearchMemoryControlStudy(
    study: ResearchMemoryControlStudyRecord
  ): Promise<ResearchMemoryControlStudyRecord> {
    return this.withResearchMemoryControlPublicationTransaction(
      () => this.recordResearchMemoryControlStudyUnlocked(study)
    );
  }

  private async recordResearchMemoryControlStudyUnlocked(
    study: ResearchMemoryControlStudyRecord
  ): Promise<ResearchMemoryControlStudyRecord> {
    if (!researchMemoryControlStudyHasRuntimeShape(study)) {
      throw new LocalStoreError(
        "invalid_research_memory_control_study_input",
        "invalid ResearchMemoryControlStudy input"
      );
    }
    if (study.study_digest !== comparisonExactRecordDigest(
      researchMemoryControlStudyDigestInput(study)
    )) {
      throw new LocalStoreError(
        "research_memory_control_study_digest_mismatch",
        "ResearchMemoryControlStudy digest does not match its content"
      );
    }
    if (study.research_memory_control_study_id !==
      researchMemoryControlStudyIdForKey(study.idempotency_key)) {
      throw new LocalStoreError(
        "research_memory_control_study_identity_mismatch",
        "ResearchMemoryControlStudy identity is not deterministic"
      );
    }
    const existing = await this.getResearchMemoryControlStudy(
      study.research_memory_control_study_id
    );
    if (existing) {
      if (!sameJson(existing, study)) {
        throw new LocalStoreError(
          "research_memory_control_study_conflict",
          "ResearchMemoryControlStudy is append-only"
        );
      }
      return existing;
    }
    await this.assertResearchMemoryControlStudyPrecedesEffects(study);
    const publication = await this.writeJsonCreateOnly(this.itemPath(
      "research-memory-control-studies",
      study.research_memory_control_study_id
    ), study);
    if (publication === "exists") {
      const winner = await this.getResearchMemoryControlStudy(
        study.research_memory_control_study_id
      );
      if (!winner || !sameJson(winner, study)) {
        throw new LocalStoreError(
          "research_memory_control_study_conflict",
          "ResearchMemoryControlStudy is append-only"
        );
      }
      return winner;
    }
    return study;
  }

  async getResearchMemoryControlStudy(
    studyId: string
  ): Promise<ResearchMemoryControlStudyRecord | undefined> {
    const study = await this.readOptionalRecord<unknown>(
      "research-memory-control-studies",
      studyId
    );
    return study === undefined
      ? undefined
      : this.assertPersistedResearchMemoryControlStudy(study);
  }

  async listResearchMemoryControlStudies(): Promise<
    ResearchMemoryControlStudyRecord[]
  > {
    return (await this.readCollection<unknown>(
      "research-memory-control-studies"
    )).map((study) =>
      this.assertPersistedResearchMemoryControlStudy(study)
    ).sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.research_memory_control_study_id.localeCompare(
        right.research_memory_control_study_id
      )
    );
  }

  private assertPersistedResearchMemoryControlStudy(
    value: unknown
  ): ResearchMemoryControlStudyRecord {
    if (!researchMemoryControlStudyHasRuntimeShape(value) ||
      value.study_digest !== comparisonExactRecordDigest(
        researchMemoryControlStudyDigestInput(value)
      ) || value.research_memory_control_study_id !==
        researchMemoryControlStudyIdForKey(value.idempotency_key)) {
      throw new LocalStoreError(
        "research_memory_control_study_reload_failed",
        "persisted ResearchMemoryControlStudy is unreadable or corrupt"
      );
    }
    return value;
  }

  private async assertResearchMemoryControlStudyPrecedesEffects(
    study: ResearchMemoryControlStudyRecord
  ): Promise<void> {
    const plannedTickIds = new Set(study.pair_plans.flatMap((pair) => [
      pair.released_memory_treatment.tick_id,
      pair.memory_masked_control.tick_id
    ]));
    const [allocations, preflights, ticks] = await Promise.all([
      this.readCollection<unknown>("candidate-arena-research-allocations"),
      this.readCollection<unknown>("research-preflight-commitments"),
      this.readCollection<unknown>("candidate-arena-ticks")
    ]);
    const allocationEffect = allocations.some((value) => {
      const allocation = this.assertPersistedCandidateArenaResearchAllocation(
        value
      );
      return plannedTickIds.has(allocation.tick_id);
    });
    const preflightEffect = preflights.some((value) => {
      const preflight = this.assertPersistedResearchPreflightCommitment(value);
      return plannedTickIds.has(preflight.candidate_arena_tick_id);
    });
    const tickEffect = ticks.some((tick) => {
      if (!isCandidateArenaTickRecord(tick)) {
        throw new LocalStoreError(
          "research_memory_control_study_effect_graph_corrupt",
          "CandidateArena tick effect graph is corrupt"
        );
      }
      return plannedTickIds.has(tick.tick_id);
    });
    if (allocationEffect || preflightEffect || tickEffect) {
      throw new LocalStoreError(
        "research_memory_control_study_effect_already_exists",
        "ResearchMemoryControlStudy must precede every planned effect"
      );
    }
  }

  async recordResearchMemoryControlPairOutcome(
    input: ResearchMemoryControlPairOutcomePersistenceInput
  ): Promise<ResearchMemoryControlPairOutcomeRecord> {
    const outcome = input?.outcome;
    if (!researchMemoryControlPairOutcomeHasRuntimeShape(outcome)) {
      throw new LocalStoreError(
        "invalid_research_memory_control_pair_outcome_input",
        "invalid ResearchMemoryControlPairOutcome input"
      );
    }
    if (outcome.pair_outcome_digest !== comparisonExactRecordDigest(
      researchMemoryControlPairOutcomeDigestInput(outcome)
    )) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_digest_mismatch",
        "ResearchMemoryControlPairOutcome digest does not match its content"
      );
    }
    if (outcome.research_memory_control_pair_outcome_id !==
      researchMemoryControlPairOutcomeIdForPair(
        outcome.study_ref.id,
        outcome.pair_index
      )) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_identity_mismatch",
        "ResearchMemoryControlPairOutcome identity is not deterministic"
      );
    }
    await this.assertResearchMemoryControlPairOutcomeGraph(outcome);
    const existing = await this.getResearchMemoryControlPairOutcome(
      outcome.research_memory_control_pair_outcome_id
    );
    if (existing) {
      if (!sameJson(existing, outcome)) {
        throw new LocalStoreError(
          "research_memory_control_pair_outcome_conflict",
          "ResearchMemoryControlPairOutcome is append-only"
        );
      }
      await this.recordResearchMemoryControlPairOutcomeSourceGraph(input);
      return existing;
    }
    await this.recordResearchMemoryControlPairOutcomeSourceGraph(input);
    const publication = await this.writeJsonCreateOnly(this.itemPath(
      "research-memory-control-pair-outcomes",
      outcome.research_memory_control_pair_outcome_id
    ), outcome);
    if (publication === "exists") {
      const winner = await this.getResearchMemoryControlPairOutcome(
        outcome.research_memory_control_pair_outcome_id
      );
      if (!winner || !sameJson(winner, outcome)) {
        throw new LocalStoreError(
          "research_memory_control_pair_outcome_conflict",
          "ResearchMemoryControlPairOutcome is append-only"
        );
      }
      return winner;
    }
    return outcome;
  }

  async getResearchMemoryControlPairOutcome(
    outcomeId: string
  ): Promise<ResearchMemoryControlPairOutcomeRecord | undefined> {
    const outcomeValue = await this.readOptionalRecord<unknown>(
      "research-memory-control-pair-outcomes",
      outcomeId
    );
    const persisted = outcomeValue === undefined
      ? await this.recoverResearchMemoryControlPairOutcomeFromSourceGraph(
          outcomeId
        )
      : this.assertPersistedResearchMemoryControlPairOutcome(outcomeValue);
    if (!persisted) return undefined;
    await this.assertResearchMemoryControlPairOutcomeGraph(persisted);
    await this.assertPersistedResearchMemoryControlPairOutcomeSourceGraph(
      persisted
    );
    return persisted;
  }

  async listResearchMemoryControlPairOutcomes(
    studyId?: string
  ): Promise<ResearchMemoryControlPairOutcomeRecord[]> {
    await this.recoverResearchMemoryControlPairOutcomesFromSourceGraphs();
    const outcomes = (await this.readCollection<unknown>(
      "research-memory-control-pair-outcomes"
    )).map((outcome) =>
      this.assertPersistedResearchMemoryControlPairOutcome(outcome)
    );
    await Promise.all(outcomes.flatMap((outcome) => [
      this.assertResearchMemoryControlPairOutcomeGraph(outcome),
      this.assertPersistedResearchMemoryControlPairOutcomeSourceGraph(outcome)
    ]));
    return outcomes.filter((outcome) =>
      !studyId || outcome.study_ref.id === studyId
    ).sort((left, right) =>
        left.study_ref.id.localeCompare(right.study_ref.id) ||
        left.pair_index - right.pair_index ||
        left.research_memory_control_pair_outcome_id.localeCompare(
          right.research_memory_control_pair_outcome_id
        )
      );
  }

  private assertPersistedResearchMemoryControlPairOutcome(
    value: unknown
  ): ResearchMemoryControlPairOutcomeRecord {
    if (!researchMemoryControlPairOutcomeHasRuntimeShape(value) ||
      value.pair_outcome_digest !== comparisonExactRecordDigest(
        researchMemoryControlPairOutcomeDigestInput(value)
      ) || value.research_memory_control_pair_outcome_id !==
        researchMemoryControlPairOutcomeIdForPair(
          value.study_ref.id,
          value.pair_index
        )) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_reload_failed",
        "persisted ResearchMemoryControlPairOutcome is unreadable or corrupt"
      );
    }
    return value;
  }

  private async assertResearchMemoryControlPairOutcomeGraph(
    outcome: ResearchMemoryControlPairOutcomeRecord
  ): Promise<void> {
    const study = await this.getResearchMemoryControlStudy(
      outcome.study_ref.id
    );
    if (!study) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_reference_not_found",
        "ResearchMemoryControlPairOutcome study was not found"
      );
    }
    if (!researchMemoryControlPairMatchesStudy(outcome, study)) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_reference_mismatch",
        "ResearchMemoryControlPairOutcome does not match its study"
      );
    }
  }

  private async recordResearchMemoryControlPairOutcomeSourceGraph(
    input: ResearchMemoryControlPairOutcomePersistenceInput
  ): Promise<void> {
    const study = await this.getResearchMemoryControlStudy(
      input.outcome.study_ref.id
    );
    if (!study || !sameJson(input.source_graph?.study, study)) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_source_graph_mismatch",
        "ResearchMemoryControlPairOutcome source study is invalid"
      );
    }
    const record = this.buildResearchMemoryControlPairSourceGraphRecord(input);
    const existingValue = await this.readOptionalRecord<unknown>(
      "research-memory-control-pair-outcomes",
      record.research_memory_control_pair_source_graph_id,
      "source-graphs"
    );
    if (existingValue !== undefined) {
      let existing: ResearchMemoryControlPairSourceGraphRecord;
      try {
        existing = this.assertResearchMemoryControlPairSourceGraphRecord(
          existingValue,
          input.outcome
        );
      } catch (error) {
        throw new LocalStoreError(
          "research_memory_control_pair_outcome_source_graph_mismatch",
          "ResearchMemoryControlPairOutcome source graph conflicts",
          { cause: error }
        );
      }
      if (!sameJson(existing, record)) {
        throw new LocalStoreError(
          "research_memory_control_pair_outcome_source_graph_mismatch",
          "ResearchMemoryControlPairOutcome source graph is append-only"
        );
      }
      return;
    }
    const publication = await this.writeJsonCreateOnly(this.itemPath(
      "research-memory-control-pair-outcomes",
      record.research_memory_control_pair_source_graph_id,
      "source-graphs"
    ), record);
    if (publication === "exists") {
      const winnerValue = await this.readOptionalRecord<unknown>(
        "research-memory-control-pair-outcomes",
        record.research_memory_control_pair_source_graph_id,
        "source-graphs"
      );
      let winner: ResearchMemoryControlPairSourceGraphRecord | undefined;
      try {
        winner = winnerValue === undefined
          ? undefined
          : this.assertResearchMemoryControlPairSourceGraphRecord(
              winnerValue,
              input.outcome
            );
      } catch (error) {
        throw new LocalStoreError(
          "research_memory_control_pair_outcome_source_graph_mismatch",
          "ResearchMemoryControlPairOutcome source graph conflicts",
          { cause: error }
        );
      }
      if (!winner || !sameJson(winner, record)) {
        throw new LocalStoreError(
          "research_memory_control_pair_outcome_source_graph_mismatch",
          "ResearchMemoryControlPairOutcome source graph is append-only"
        );
      }
    }
  }

  private async assertPersistedResearchMemoryControlPairOutcomeSourceGraph(
    outcome: ResearchMemoryControlPairOutcomeRecord
  ): Promise<void> {
    const sourceGraphId = researchMemoryControlPairSourceGraphId(
      outcome.research_memory_control_pair_outcome_id
    );
    const value = await this.readOptionalRecord<unknown>(
      "research-memory-control-pair-outcomes",
      sourceGraphId,
      "source-graphs"
    );
    if (value === undefined) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_reload_failed",
        "persisted ResearchMemoryControlPairOutcome source graph is missing"
      );
    }
    this.assertResearchMemoryControlPairSourceGraphRecord(value, outcome);
  }

  private async recoverResearchMemoryControlPairOutcomeFromSourceGraph(
    outcomeId: string
  ): Promise<ResearchMemoryControlPairOutcomeRecord | undefined> {
    const sourceGraphId = researchMemoryControlPairSourceGraphId(outcomeId);
    const value = await this.readOptionalRecord<unknown>(
      "research-memory-control-pair-outcomes",
      sourceGraphId,
      "source-graphs"
    );
    if (value === undefined) return undefined;
    const { outcome } = this.deriveResearchMemoryControlPairSourceGraph(value);
    if (outcome.research_memory_control_pair_outcome_id !== outcomeId) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_reload_failed",
        "persisted ResearchMemoryControlPairOutcome source identity is corrupt"
      );
    }
    await this.assertResearchMemoryControlPairOutcomeGraph(outcome);
    const publication = await this.writeJsonCreateOnly(this.itemPath(
      "research-memory-control-pair-outcomes",
      outcomeId
    ), outcome);
    if (publication === "exists") {
      const winnerValue = await this.readOptionalRecord<unknown>(
        "research-memory-control-pair-outcomes",
        outcomeId
      );
      const winner = winnerValue === undefined
        ? undefined
        : this.assertPersistedResearchMemoryControlPairOutcome(winnerValue);
      if (!winner || !sameJson(winner, outcome)) {
        throw new LocalStoreError(
          "research_memory_control_pair_outcome_reload_failed",
          "persisted ResearchMemoryControlPairOutcome recovery conflicts"
        );
      }
      return winner;
    }
    return outcome;
  }

  private async recoverResearchMemoryControlPairOutcomesFromSourceGraphs():
    Promise<void> {
    const values = await this.readCollection<unknown>(
      "research-memory-control-pair-outcomes",
      "source-graphs"
    );
    for (const value of values) {
      const { outcome } = this.deriveResearchMemoryControlPairSourceGraph(value);
      await this.recoverResearchMemoryControlPairOutcomeFromSourceGraph(
        outcome.research_memory_control_pair_outcome_id
      );
    }
  }

  private deriveResearchMemoryControlPairSourceGraph(value: unknown): {
    record: ResearchMemoryControlPairSourceGraphRecord;
    outcome: ResearchMemoryControlPairOutcomeRecord;
  } {
    if (!isPlainObject(value) || !Object.hasOwn(value, "source_graph")) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_reload_failed",
        "persisted ResearchMemoryControlPairOutcome source graph is corrupt"
      );
    }
    let outcome: ResearchMemoryControlPairOutcomeRecord;
    try {
      outcome = decideResearchMemoryControlPairOutcome(
        value.source_graph as ResearchMemoryControlPairOutcomePersistenceInput[
          "source_graph"
        ]
      );
    } catch (error) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_reload_failed",
        "persisted ResearchMemoryControlPairOutcome source graph is invalid",
        { cause: error }
      );
    }
    return {
      record: this.assertResearchMemoryControlPairSourceGraphRecord(
        value,
        outcome
      ),
      outcome
    };
  }

  private buildResearchMemoryControlPairSourceGraphRecord(
    input: ResearchMemoryControlPairOutcomePersistenceInput
  ): ResearchMemoryControlPairSourceGraphRecord {
    let sourceGraph: ResearchMemoryControlPairOutcomePersistenceInput[
      "source_graph"
    ];
    let expected: ResearchMemoryControlPairOutcomeRecord;
    try {
      sourceGraph = JSON.parse(JSON.stringify(input.source_graph)) as
        ResearchMemoryControlPairOutcomePersistenceInput["source_graph"];
      expected = decideResearchMemoryControlPairOutcome(sourceGraph);
    } catch (error) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_source_graph_mismatch",
        "ResearchMemoryControlPairOutcome source graph is invalid",
        { cause: error }
      );
    }
    if (!sameJson(expected, input.outcome)) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_source_graph_mismatch",
        "ResearchMemoryControlPairOutcome differs from its source graph"
      );
    }
    const record: ResearchMemoryControlPairSourceGraphRecord = {
      record_kind: "research_memory_control_pair_source_graph",
      version: 1,
      research_memory_control_pair_source_graph_id:
        researchMemoryControlPairSourceGraphId(
          input.outcome.research_memory_control_pair_outcome_id
        ),
      pair_outcome_ref: {
        record_kind: "research_memory_control_pair_outcome",
        id: input.outcome.research_memory_control_pair_outcome_id
      },
      pair_outcome_digest: input.outcome.pair_outcome_digest,
      source_graph: sourceGraph,
      source_graph_digest: "sha256:pending",
      authority_status: "research_evidence_only"
    };
    record.source_graph_digest = comparisonExactRecordDigest(
      researchMemoryControlPairSourceGraphDigestInput(record)
    );
    return record;
  }

  private assertResearchMemoryControlPairSourceGraphRecord(
    value: unknown,
    outcome: ResearchMemoryControlPairOutcomeRecord
  ): ResearchMemoryControlPairSourceGraphRecord {
    if (!isPlainObject(value) || !hasOnlyKeys(value, [
      "record_kind",
      "version",
      "research_memory_control_pair_source_graph_id",
      "pair_outcome_ref",
      "pair_outcome_digest",
      "source_graph",
      "source_graph_digest",
      "authority_status"
    ])) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_reload_failed",
        "persisted ResearchMemoryControlPairOutcome source graph is corrupt"
      );
    }
    const record = value as unknown as ResearchMemoryControlPairSourceGraphRecord;
    let expected: ResearchMemoryControlPairOutcomeRecord;
    try {
      expected = decideResearchMemoryControlPairOutcome(record.source_graph);
    } catch (error) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_reload_failed",
        "persisted ResearchMemoryControlPairOutcome source graph is invalid",
        { cause: error }
      );
    }
    if (record.record_kind !== "research_memory_control_pair_source_graph" ||
      record.version !== 1 || record.authority_status !==
        "research_evidence_only" || record.pair_outcome_ref.record_kind !==
        "research_memory_control_pair_outcome" ||
      record.pair_outcome_ref.id !==
        outcome.research_memory_control_pair_outcome_id ||
      record.pair_outcome_digest !== outcome.pair_outcome_digest ||
      record.research_memory_control_pair_source_graph_id !==
        researchMemoryControlPairSourceGraphId(
          outcome.research_memory_control_pair_outcome_id
        ) || record.source_graph_digest !== comparisonExactRecordDigest(
          researchMemoryControlPairSourceGraphDigestInput(record)
        ) || !sameJson(expected, outcome)) {
      throw new LocalStoreError(
        "research_memory_control_pair_outcome_reload_failed",
        "persisted ResearchMemoryControlPairOutcome source graph is corrupt"
      );
    }
    return record;
  }

  async recordResearchMemoryControlStudyOutcome(
    outcome: ResearchMemoryControlStudyOutcomeRecord
  ): Promise<ResearchMemoryControlStudyOutcomeRecord> {
    if (!researchMemoryControlStudyOutcomeHasRuntimeShape(outcome)) {
      throw new LocalStoreError(
        "invalid_research_memory_control_study_outcome_input",
        "invalid ResearchMemoryControlStudyOutcome input"
      );
    }
    if (outcome.study_outcome_digest !== comparisonExactRecordDigest(
      researchMemoryControlStudyOutcomeDigestInput(outcome)
    )) {
      throw new LocalStoreError(
        "research_memory_control_study_outcome_digest_mismatch",
        "ResearchMemoryControlStudyOutcome digest does not match its content"
      );
    }
    if (outcome.research_memory_control_study_outcome_id !==
      researchMemoryControlStudyOutcomeIdForStudy(outcome.study_ref.id)) {
      throw new LocalStoreError(
        "research_memory_control_study_outcome_identity_mismatch",
        "ResearchMemoryControlStudyOutcome identity is not deterministic"
      );
    }
    await this.assertResearchMemoryControlStudyOutcomeGraph(outcome);
    const existing = await this.getResearchMemoryControlStudyOutcome(
      outcome.research_memory_control_study_outcome_id
    );
    if (existing) {
      if (!sameJson(existing, outcome)) {
        throw new LocalStoreError(
          "research_memory_control_study_outcome_conflict",
          "ResearchMemoryControlStudyOutcome is append-only"
        );
      }
      return existing;
    }
    const publication = await this.writeJsonCreateOnly(this.itemPath(
      "research-memory-control-study-outcomes",
      outcome.research_memory_control_study_outcome_id
    ), outcome);
    if (publication === "exists") {
      const winner = await this.getResearchMemoryControlStudyOutcome(
        outcome.research_memory_control_study_outcome_id
      );
      if (!winner || !sameJson(winner, outcome)) {
        throw new LocalStoreError(
          "research_memory_control_study_outcome_conflict",
          "ResearchMemoryControlStudyOutcome is append-only"
        );
      }
      return winner;
    }
    return outcome;
  }

  async getResearchMemoryControlStudyOutcome(
    outcomeId: string
  ): Promise<ResearchMemoryControlStudyOutcomeRecord | undefined> {
    const outcome = await this.readOptionalRecord<unknown>(
      "research-memory-control-study-outcomes",
      outcomeId
    );
    if (outcome === undefined) return undefined;
    const persisted = this.assertPersistedResearchMemoryControlStudyOutcome(
      outcome
    );
    await this.assertResearchMemoryControlStudyOutcomeGraph(persisted);
    return persisted;
  }

  async listResearchMemoryControlStudyOutcomes(): Promise<
    ResearchMemoryControlStudyOutcomeRecord[]
  > {
    const outcomes = (await this.readCollection<unknown>(
      "research-memory-control-study-outcomes"
    )).map((outcome) =>
      this.assertPersistedResearchMemoryControlStudyOutcome(outcome)
    );
    await Promise.all(outcomes.map((outcome) =>
      this.assertResearchMemoryControlStudyOutcomeGraph(outcome)
    ));
    return outcomes.sort((left, right) =>
      left.adjudicated_at.localeCompare(right.adjudicated_at) ||
      left.research_memory_control_study_outcome_id.localeCompare(
        right.research_memory_control_study_outcome_id
      )
    );
  }

  private assertPersistedResearchMemoryControlStudyOutcome(
    value: unknown
  ): ResearchMemoryControlStudyOutcomeRecord {
    if (!researchMemoryControlStudyOutcomeHasRuntimeShape(value) ||
      value.study_outcome_digest !== comparisonExactRecordDigest(
        researchMemoryControlStudyOutcomeDigestInput(value)
      ) || value.research_memory_control_study_outcome_id !==
        researchMemoryControlStudyOutcomeIdForStudy(value.study_ref.id)) {
      throw new LocalStoreError(
        "research_memory_control_study_outcome_reload_failed",
        "persisted ResearchMemoryControlStudyOutcome is unreadable or corrupt"
      );
    }
    return value;
  }

  private async assertResearchMemoryControlStudyOutcomeGraph(
    outcome: ResearchMemoryControlStudyOutcomeRecord
  ): Promise<void> {
    const study = await this.getResearchMemoryControlStudy(
      outcome.study_ref.id
    );
    if (!study) {
      throw new LocalStoreError(
        "research_memory_control_study_outcome_reference_not_found",
        "ResearchMemoryControlStudyOutcome study was not found"
      );
    }
    if (outcome.study_digest !== study.study_digest ||
      outcome.pair_results.length !== study.pair_plans.length) {
      throw new LocalStoreError(
        "research_memory_control_study_outcome_reference_mismatch",
        "ResearchMemoryControlStudyOutcome does not match its study"
      );
    }
    for (let index = 0; index < study.pair_plans.length; index += 1) {
      const plan = study.pair_plans[index]!;
      const result = outcome.pair_results[index]!;
      const pair = await this.getResearchMemoryControlPairOutcome(
        result.pair_outcome_ref.id
      );
      if (!pair) {
        throw new LocalStoreError(
          "research_memory_control_study_outcome_reference_not_found",
          "ResearchMemoryControlStudyOutcome pair graph is incomplete"
        );
      }
      if (result.pair_index !== plan.pair_index ||
        pair.study_ref.id !== study.research_memory_control_study_id ||
        pair.study_digest !== study.study_digest ||
        pair.pair_index !== plan.pair_index ||
        pair.pair_plan_digest !== comparisonExactRecordDigest(
          paperTradingComparisonPersistedRecordDigestInput(plan)
        ) || result.pair_outcome_ref.id !==
          pair.research_memory_control_pair_outcome_id ||
        result.pair_outcome_digest !== pair.pair_outcome_digest ||
        result.eligibility_status !== pair.eligibility_status ||
        result.ineligibility_reason !== pair.ineligibility_reason ||
        result.paired_difference !== pair.paired_difference ||
        Date.parse(pair.terminal_at) > Date.parse(outcome.adjudicated_at)) {
        throw new LocalStoreError(
          "research_memory_control_study_outcome_reference_mismatch",
          "ResearchMemoryControlStudyOutcome pair graph differs from its plan"
        );
      }
    }
  }

  async recordResearchGeneralizationOutcome(
    outcome: ResearchGeneralizationOutcomeRecord
  ): Promise<ResearchGeneralizationOutcomeRecord> {
    if (!researchGeneralizationOutcomeHasRuntimeShape(outcome)) {
      throw new LocalStoreError(
        "invalid_research_generalization_outcome_input",
        "invalid ResearchGeneralizationOutcome input"
      );
    }
    if (outcome.outcome_digest !== comparisonExactRecordDigest(
      researchGeneralizationOutcomeDigestInput(outcome)
    )) {
      throw new LocalStoreError(
        "research_generalization_outcome_digest_mismatch",
        "ResearchGeneralizationOutcome digest does not match its content"
      );
    }
    if (outcome.research_generalization_outcome_id !==
      researchGeneralizationOutcomeIdForProtocol(outcome.protocol_ref.id)) {
      throw new LocalStoreError(
        "research_generalization_outcome_identity_mismatch",
        "ResearchGeneralizationOutcome identity is not deterministic"
      );
    }
    await this.assertResearchGeneralizationOutcomeGraph(outcome);
    const existing = await this.getResearchGeneralizationOutcome(
      outcome.research_generalization_outcome_id
    );
    if (existing) {
      if (!sameJson(existing, outcome)) {
        throw new LocalStoreError(
          "research_generalization_outcome_conflict",
          "ResearchGeneralizationOutcome is append-only"
        );
      }
      return existing;
    }
    const publication = await this.writeJsonCreateOnly(this.itemPath(
      "research-generalization-outcomes",
      outcome.research_generalization_outcome_id
    ), outcome);
    if (publication === "exists") {
      const winner = await this.getResearchGeneralizationOutcome(
        outcome.research_generalization_outcome_id
      );
      if (!winner || !sameJson(winner, outcome)) {
        throw new LocalStoreError(
          "research_generalization_outcome_conflict",
          "ResearchGeneralizationOutcome is append-only"
        );
      }
      return winner;
    }
    return outcome;
  }

  async getResearchGeneralizationOutcome(
    outcomeId: string
  ): Promise<ResearchGeneralizationOutcomeRecord | undefined> {
    const value = await this.readOptionalRecord<unknown>(
      "research-generalization-outcomes",
      outcomeId
    );
    if (value === undefined) return undefined;
    const outcome = this.assertPersistedResearchGeneralizationOutcome(value);
    await this.assertResearchGeneralizationOutcomeGraph(outcome, true);
    return outcome;
  }

  async listResearchGeneralizationOutcomes(): Promise<
    ResearchGeneralizationOutcomeRecord[]
  > {
    const outcomes = (await this.readCollection<unknown>(
      "research-generalization-outcomes"
    )).map((value) =>
      this.assertPersistedResearchGeneralizationOutcome(value)
    );
    await Promise.all(outcomes.map((outcome) =>
      this.assertResearchGeneralizationOutcomeGraph(outcome, true)
    ));
    return outcomes.sort((left, right) =>
      left.adjudicated_at.localeCompare(right.adjudicated_at) ||
      left.research_generalization_outcome_id.localeCompare(
        right.research_generalization_outcome_id
      )
    );
  }

  private assertPersistedResearchGeneralizationOutcome(
    value: unknown
  ): ResearchGeneralizationOutcomeRecord {
    if (!researchGeneralizationOutcomeHasRuntimeShape(value) ||
      value.outcome_digest !== comparisonExactRecordDigest(
        researchGeneralizationOutcomeDigestInput(value)
      ) || value.research_generalization_outcome_id !==
        researchGeneralizationOutcomeIdForProtocol(value.protocol_ref.id)) {
      throw new LocalStoreError(
        "research_generalization_outcome_reload_failed",
        "persisted ResearchGeneralizationOutcome is unreadable or corrupt"
      );
    }
    return value;
  }

  private async assertResearchGeneralizationOutcomeGraph(
    outcome: ResearchGeneralizationOutcomeRecord,
    reloading = false
  ): Promise<void> {
    const fail = (
      code: Extract<LocalStoreErrorCode,
        | "research_generalization_outcome_reference_not_found"
        | "research_generalization_outcome_reference_mismatch"
      >,
      message: string
    ): never => {
      throw new LocalStoreError(
        reloading ? "research_generalization_outcome_reload_failed" : code,
        message
      );
    };
    const protocol = await this.getResearchGeneralizationProtocol(
      outcome.protocol_ref.id
    );
    if (!protocol) {
      return fail(
        "research_generalization_outcome_reference_not_found",
        "ResearchGeneralizationOutcome protocol was not found"
      );
    }
    if (outcome.protocol_digest !== protocol.protocol_digest ||
      outcome.target_allocation_policy_digest !==
        protocol.target_allocation_policy_digest ||
      Date.parse(outcome.adjudicated_at) < Date.parse(protocol.committed_at)) {
      fail(
        "research_generalization_outcome_reference_mismatch",
        "ResearchGeneralizationOutcome protocol differs from its source"
      );
    }
    const usedSources = new Map<string, Set<string>>([
      ["long", new Set()],
      ["short", new Set()],
      ["flat", new Set()]
    ]);
    const plannedStudies = await Promise.all(protocol.study_slots.map((slot) =>
      this.getResearchControlStudy(slot.study_ref.id)
    ));
    const spacingViolations = researchGeneralizationStudySpacingViolations(
      protocol,
      plannedStudies.filter((study): study is ResearchControlStudyRecord =>
        Boolean(study)
      )
    );
    for (let index = 0; index < protocol.study_slots.length; index += 1) {
      const planned = protocol.study_slots[index]!;
      const result = outcome.slot_results[index]!;
      if (result.slot_index !== planned.slot_index ||
        result.condition_block !== planned.condition_block ||
        result.condition_block_study_index !==
          planned.condition_block_study_index ||
        !sameJson(result.planned_study_ref, planned.study_ref)) {
        fail(
          "research_generalization_outcome_reference_mismatch",
          "ResearchGeneralizationOutcome slot differs from its protocol"
        );
      }
      const study = plannedStudies[index];
      if (!study) {
        if (result.slot_status !== "missing_study") {
          fail(
            "research_generalization_outcome_reference_not_found",
            "ResearchGeneralizationOutcome planned study was not found"
          );
        }
        continue;
      }
      if (!result.study_ref || result.study_ref.id !==
          study.research_control_study_id || result.study_digest !==
          study.study_digest || result.baseline_snapshot_digest !==
          study.baseline_snapshot_digest ||
        result.source_system_code_artifact_digest !==
          study.condition.source.system_code_artifact_digest) {
        fail(
          "research_generalization_outcome_reference_mismatch",
          "ResearchGeneralizationOutcome study differs from its source"
        );
      }
      const expectedOutcomeId = researchControlStudyOutcomeIdForStudy(
        study.research_control_study_id
      );
      if (result.study_outcome_ref && result.study_outcome_ref.id !==
          expectedOutcomeId) {
        const referenced = await this.getResearchControlStudyOutcome(
          result.study_outcome_ref.id
        );
        if (!referenced) {
          fail(
            "research_generalization_outcome_reference_not_found",
            "ResearchGeneralizationOutcome study outcome was not found"
          );
        }
        fail(
          "research_generalization_outcome_reference_mismatch",
          "ResearchGeneralizationOutcome study outcome identity differs"
        );
      }
      const studyOutcome = await this.getResearchControlStudyOutcome(
        expectedOutcomeId
      );
      if (!studyOutcome) {
        if (result.slot_status !== "missing_outcome") {
          fail(
            "research_generalization_outcome_reference_not_found",
            "ResearchGeneralizationOutcome terminal study outcome was not found"
          );
        }
        continue;
      }
      if (!result.study_outcome_ref || result.study_outcome_ref.id !==
          studyOutcome.research_control_study_outcome_id ||
        result.study_outcome_digest !== studyOutcome.study_outcome_digest ||
        studyOutcome.study_digest !== study.study_digest ||
        result.observed_rate_difference !==
          studyOutcome.mean_rate_difference ||
        Date.parse(studyOutcome.adjudicated_at) >
          Date.parse(outcome.adjudicated_at)) {
        fail(
          "research_generalization_outcome_reference_mismatch",
          "ResearchGeneralizationOutcome terminal evidence differs"
        );
      }
      let reason:
        | "protocol_assignment_mismatch"
        | "protocol_condition_mismatch"
        | "study_commitment_outside_protocol_window"
        | "study_spacing_not_elapsed"
        | "source_baseline_reused_within_condition_block"
        | undefined = this.researchGeneralizationStudyIneligibilityReason(
          protocol,
          planned,
          study,
          spacingViolations.has(study.research_control_study_id)
      );
      const blockSources = usedSources.get(planned.condition_block)!;
      if (!reason) {
        const sourceDigest = study.generalization_assignment!
          .source_system_code_artifact_digest;
        if (blockSources.has(sourceDigest)) {
          reason = "source_baseline_reused_within_condition_block";
        } else {
          blockSources.add(sourceDigest);
        }
      }
      const expectedStatus = reason ? "ineligible" : "completed";
      const expectedReason = reason ?? "eligible_terminal_study";
      if (result.slot_status !== expectedStatus ||
        result.status_reason !== expectedReason) {
        fail(
          "research_generalization_outcome_reference_mismatch",
          "ResearchGeneralizationOutcome eligibility differs from its graph"
        );
      }
    }
    if (outcome.missing_study_count > 0 &&
      Date.parse(outcome.adjudicated_at) <
        Date.parse(protocol.timing_policy.collection_deadline_at)) {
      fail(
        "research_generalization_outcome_reference_mismatch",
        "ResearchGeneralizationOutcome closed before its collection deadline"
      );
    }
  }

  private researchGeneralizationStudyIneligibilityReason(
    protocol: ResearchGeneralizationProtocolRecord,
    slot: ResearchGeneralizationProtocolRecord["study_slots"][number],
    study: ResearchControlStudyRecord,
    spacingViolated: boolean
  ):
    | "protocol_assignment_mismatch"
    | "protocol_condition_mismatch"
    | "study_commitment_outside_protocol_window"
    | "study_spacing_not_elapsed"
    | undefined {
    const assignment = study.generalization_assignment;
    if (!assignment || assignment.protocol_ref.id !==
        protocol.research_generalization_protocol_id ||
      assignment.protocol_digest !== protocol.protocol_digest ||
      assignment.slot_index !== slot.slot_index ||
      assignment.condition_block !== slot.condition_block ||
      assignment.condition_block_study_index !==
        slot.condition_block_study_index) {
      return "protocol_assignment_mismatch";
    }
    if (Date.parse(study.committed_at) <= Date.parse(protocol.committed_at) ||
      Date.parse(study.committed_at) >
        Date.parse(protocol.timing_policy.collection_deadline_at)) {
      return "study_commitment_outside_protocol_window";
    }
    if (spacingViolated) return "study_spacing_not_elapsed";
    if (study.idempotency_key !== slot.study_idempotency_key ||
      !sameJson(study.replications.map((replication) =>
        replication.campaign_idempotency_key
      ), slot.replication_idempotency_keys) || !sameJson(
        study.condition.research_agent,
        protocol.research_agent
      ) || !sameJson(
        study.condition.paper_evaluation_protocol,
        protocol.paper_evaluation_protocol
      ) || !sameJson(study.condition.campaign_policy, protocol.campaign_policy) ||
      !sameJson(
        study.condition.allocation_policy,
        protocol.target_allocation_policy
      ) || study.condition.allocation_policy_digest !==
        protocol.target_allocation_policy_digest || !sameJson(
          assignment.market_condition.classifier_policy,
          protocol.market_classifier_policy
        ) || assignment.market_condition.condition_block !==
          slot.condition_block || assignment.source_system_code_artifact_digest !==
          study.condition.source.system_code_artifact_digest) {
      return "protocol_condition_mismatch";
    }
    return undefined;
  }

  async recordResearchGeneralizationPolicyDecision(
    decision: ResearchGeneralizationPolicyDecisionRecord
  ): Promise<ResearchGeneralizationPolicyDecisionRecord> {
    if (!researchGeneralizationPolicyDecisionHasRuntimeShape(decision)) {
      throw new LocalStoreError(
        "invalid_research_generalization_policy_decision_input",
        "invalid ResearchGeneralizationPolicyDecision input"
      );
    }
    if (decision.policy_decision_digest !== comparisonExactRecordDigest(
      researchGeneralizationPolicyDecisionDigestInput(decision)
    )) {
      throw new LocalStoreError(
        "research_generalization_policy_decision_digest_mismatch",
        "ResearchGeneralizationPolicyDecision digest does not match its content"
      );
    }
    if (decision.research_generalization_policy_decision_id !==
      researchGeneralizationPolicyDecisionIdForOutcome(
        decision.generalization_outcome_ref.id
      )) {
      throw new LocalStoreError(
        "research_generalization_policy_decision_identity_mismatch",
        "ResearchGeneralizationPolicyDecision identity is not deterministic"
      );
    }
    await this.assertResearchGeneralizationPolicyDecisionGraph(decision);
    const existing = await this.getResearchGeneralizationPolicyDecision(
      decision.research_generalization_policy_decision_id
    );
    if (existing) {
      if (!sameJson(existing, decision)) {
        throw new LocalStoreError(
          "research_generalization_policy_decision_conflict",
          "ResearchGeneralizationPolicyDecision is append-only"
        );
      }
      return existing;
    }
    const publication = await this.writeJsonCreateOnly(this.itemPath(
      "research-generalization-policy-decisions",
      decision.research_generalization_policy_decision_id
    ), decision);
    if (publication === "exists") {
      const winner = await this.getResearchGeneralizationPolicyDecision(
        decision.research_generalization_policy_decision_id
      );
      if (!winner || !sameJson(winner, decision)) {
        throw new LocalStoreError(
          "research_generalization_policy_decision_conflict",
          "ResearchGeneralizationPolicyDecision is append-only"
        );
      }
      return winner;
    }
    return decision;
  }

  async getResearchGeneralizationPolicyDecision(
    decisionId: string
  ): Promise<ResearchGeneralizationPolicyDecisionRecord | undefined> {
    const value = await this.readOptionalRecord<unknown>(
      "research-generalization-policy-decisions",
      decisionId
    );
    if (value === undefined) return undefined;
    const decision = this.assertPersistedResearchGeneralizationPolicyDecision(
      value
    );
    await this.assertResearchGeneralizationPolicyDecisionGraph(decision, true);
    return decision;
  }

  async listResearchGeneralizationPolicyDecisions(): Promise<
    ResearchGeneralizationPolicyDecisionRecord[]
  > {
    const decisions = (await this.readCollection<unknown>(
      "research-generalization-policy-decisions"
    )).map((value) =>
      this.assertPersistedResearchGeneralizationPolicyDecision(value)
    );
    await Promise.all(decisions.map((decision) =>
      this.assertResearchGeneralizationPolicyDecisionGraph(decision, true)
    ));
    return decisions.sort((left, right) =>
      left.decided_at.localeCompare(right.decided_at) ||
      left.research_generalization_policy_decision_id.localeCompare(
        right.research_generalization_policy_decision_id
      )
    );
  }

  private assertPersistedResearchGeneralizationPolicyDecision(
    value: unknown
  ): ResearchGeneralizationPolicyDecisionRecord {
    if (!researchGeneralizationPolicyDecisionHasRuntimeShape(value) ||
      value.policy_decision_digest !== comparisonExactRecordDigest(
        researchGeneralizationPolicyDecisionDigestInput(value)
      ) || value.research_generalization_policy_decision_id !==
        researchGeneralizationPolicyDecisionIdForOutcome(
          value.generalization_outcome_ref.id
        )) {
      throw new LocalStoreError(
        "research_generalization_policy_decision_reload_failed",
        "persisted ResearchGeneralizationPolicyDecision is unreadable or corrupt"
      );
    }
    return value;
  }

  private async assertResearchGeneralizationPolicyDecisionGraph(
    decision: ResearchGeneralizationPolicyDecisionRecord,
    reloading = false
  ): Promise<void> {
    const fail = (
      code: Extract<LocalStoreErrorCode,
        | "research_generalization_policy_decision_reference_not_found"
        | "research_generalization_policy_decision_reference_mismatch"
      >,
      message: string
    ): never => {
      throw new LocalStoreError(
        reloading ? "research_generalization_policy_decision_reload_failed" :
          code,
        message
      );
    };
    const [protocol, outcome] = await Promise.all([
      this.getResearchGeneralizationProtocol(decision.protocol_ref.id),
      this.getResearchGeneralizationOutcome(
        decision.generalization_outcome_ref.id
      )
    ]);
    if (!protocol || !outcome) {
      return fail(
        "research_generalization_policy_decision_reference_not_found",
        "ResearchGeneralizationPolicyDecision source graph was not found"
      );
    }
    const targetPolicyDigest = comparisonExactRecordDigest(
      paperTradingComparisonPersistedRecordDigestInput(
        protocol.target_allocation_policy
      )
    );
    const approved = researchGeneralizationPolicyDecisionIsApproved(
      protocol,
      outcome
    );
    if (!researchGeneralizationProtocolHasRuntimeShape(protocol) ||
      protocol.protocol_digest !== comparisonExactRecordDigest(
        researchGeneralizationProtocolDigestInput(protocol)
      ) || protocol.target_allocation_policy_digest !== targetPolicyDigest ||
      !researchGeneralizationOutcomeHasRuntimeShape(outcome) ||
      outcome.outcome_digest !== comparisonExactRecordDigest(
        researchGeneralizationOutcomeDigestInput(outcome)
      ) || outcome.research_generalization_outcome_id !==
        researchGeneralizationOutcomeIdForProtocol(
          protocol.research_generalization_protocol_id
        ) || outcome.protocol_ref.id !==
          protocol.research_generalization_protocol_id ||
      outcome.protocol_digest !== protocol.protocol_digest ||
      outcome.target_allocation_policy_digest !== targetPolicyDigest ||
      Date.parse(outcome.adjudicated_at) < Date.parse(protocol.committed_at) ||
      decision.protocol_ref.id !==
        protocol.research_generalization_protocol_id ||
      decision.protocol_digest !== protocol.protocol_digest ||
      decision.generalization_outcome_ref.id !==
        outcome.research_generalization_outcome_id ||
      decision.generalization_outcome_digest !== outcome.outcome_digest ||
      decision.target_allocation_policy_digest !== targetPolicyDigest ||
      Date.parse(decision.decided_at) <= Date.parse(outcome.adjudicated_at) ||
      approved !== (decision.decision_status === "approved") ||
      decision.decision_reason !== (approved
        ? "supported_cross_condition_adaptive_effect"
        : "generalization_outcome_not_eligible") ||
      decision.effective_default_mode !== (approved
        ? "adaptive_default"
        : null)) {
      fail(
        "research_generalization_policy_decision_reference_mismatch",
        "ResearchGeneralizationPolicyDecision differs from its source graph"
      );
    }
  }

  async recordResearchAllocationPolicyDecision(
    decision: ResearchAllocationPolicyDecisionRecord
  ): Promise<ResearchAllocationPolicyDecisionRecord> {
    if (!researchAllocationPolicyDecisionHasRuntimeShape(decision)) {
      throw new LocalStoreError(
        "invalid_research_allocation_policy_decision_input",
        "invalid ResearchAllocationPolicyDecision input"
      );
    }
    if (decision.policy_decision_digest !== comparisonExactRecordDigest(
      researchAllocationPolicyDecisionDigestInput(decision)
    )) {
      throw new LocalStoreError(
        "research_allocation_policy_decision_digest_mismatch",
        "ResearchAllocationPolicyDecision digest does not match its content"
      );
    }
    if (decision.research_allocation_policy_decision_id !==
        researchAllocationPolicyDecisionIdForOutcome(
          decision.study_outcome_ref.id
        )) {
      throw new LocalStoreError(
        "research_allocation_policy_decision_identity_mismatch",
        "ResearchAllocationPolicyDecision identity is not deterministic"
      );
    }
    const [study, outcome] = await Promise.all([
      this.getResearchControlStudy(decision.study_ref.id),
      this.getResearchControlStudyOutcome(decision.study_outcome_ref.id)
    ]);
    if (!study || !outcome) {
      throw new LocalStoreError(
        "research_allocation_policy_decision_reference_not_found",
        "ResearchAllocationPolicyDecision source graph was not found"
      );
    }
    const targetPolicyDigest = comparisonExactRecordDigest(
      paperTradingComparisonPersistedRecordDigestInput(
        study.condition.allocation_policy
      )
    );
    const approved = researchAllocationPolicyDecisionIsApproved(
      study,
      outcome
    );
    if (!researchControlStudyHasRuntimeShape(study) ||
      study.condition.condition_digest !== comparisonExactRecordDigest(
        researchControlStudyConditionDigestInput(study.condition)
      ) || study.study_digest !== comparisonExactRecordDigest(
        researchControlStudyDigestInput(study)
      ) || !researchControlStudyOutcomeHasRuntimeShape(outcome) ||
      outcome.study_outcome_digest !== comparisonExactRecordDigest(
        researchControlStudyOutcomeDigestInput(outcome)
      ) || outcome.research_control_study_outcome_id !==
        researchControlStudyOutcomeIdForStudy(study.research_control_study_id) ||
      outcome.study_ref.id !== study.research_control_study_id ||
      outcome.study_digest !== study.study_digest ||
      outcome.replication_results.length !== study.replications.length ||
      outcome.replication_results.some((result, index) =>
        result.replication_index !== index + 1 ||
        result.campaign_ref.id !== study.replications[index]!.campaign_ref.id
      ) || decision.study_ref.id !== study.research_control_study_id ||
      decision.study_digest !== study.study_digest ||
      decision.study_outcome_ref.id !==
        outcome.research_control_study_outcome_id ||
      decision.study_outcome_digest !== outcome.study_outcome_digest ||
      decision.target_allocation_policy_digest !==
        study.condition.allocation_policy_digest ||
      decision.target_allocation_policy_digest !== targetPolicyDigest ||
      Date.parse(decision.decided_at) <= Date.parse(outcome.adjudicated_at) ||
      approved !== (decision.decision_status === "approved") ||
      decision.decision_reason !== (approved
        ? "supported_same_baseline_adaptive_effect"
        : "study_outcome_not_eligible") ||
      decision.effective_default_mode !== (approved
        ? "adaptive_default"
        : null)) {
      throw new LocalStoreError(
        "research_allocation_policy_decision_reference_mismatch",
        "ResearchAllocationPolicyDecision differs from its source graph"
      );
    }
    const existing = await this.getResearchAllocationPolicyDecision(
      decision.research_allocation_policy_decision_id
    );
    if (existing) {
      if (!sameJson(existing, decision)) {
        throw new LocalStoreError(
          "research_allocation_policy_decision_conflict",
          "ResearchAllocationPolicyDecision is append-only"
        );
      }
      return existing;
    }
    const publication = await this.writeJsonCreateOnly(this.itemPath(
      "research-allocation-policy-decisions",
      decision.research_allocation_policy_decision_id
    ), decision);
    if (publication === "exists") {
      const winner = await this.getResearchAllocationPolicyDecision(
        decision.research_allocation_policy_decision_id
      );
      if (!winner || !sameJson(winner, decision)) {
        throw new LocalStoreError(
          "research_allocation_policy_decision_conflict",
          "ResearchAllocationPolicyDecision is append-only"
        );
      }
      return winner;
    }
    return decision;
  }

  async getResearchAllocationPolicyDecision(
    decisionId: string
  ): Promise<ResearchAllocationPolicyDecisionRecord | undefined> {
    const decision = await this.readOptionalRecord<unknown>(
      "research-allocation-policy-decisions",
      decisionId
    );
    return decision === undefined
      ? undefined
      : this.assertPersistedResearchAllocationPolicyDecision(decision);
  }

  async listResearchAllocationPolicyDecisions(): Promise<
    ResearchAllocationPolicyDecisionRecord[]
  > {
    return (await this.readCollection<unknown>(
      "research-allocation-policy-decisions"
    )).map((decision) =>
      this.assertPersistedResearchAllocationPolicyDecision(decision)
    ).sort((left, right) =>
      left.decided_at.localeCompare(right.decided_at) ||
      left.research_allocation_policy_decision_id.localeCompare(
        right.research_allocation_policy_decision_id
      )
    );
  }

  private assertPersistedResearchAllocationPolicyDecision(
    value: unknown
  ): ResearchAllocationPolicyDecisionRecord {
    if (!researchAllocationPolicyDecisionHasRuntimeShape(value) ||
      value.policy_decision_digest !== comparisonExactRecordDigest(
        researchAllocationPolicyDecisionDigestInput(value)
      ) || value.research_allocation_policy_decision_id !==
        researchAllocationPolicyDecisionIdForOutcome(
          value.study_outcome_ref.id
        )) {
      throw new LocalStoreError(
        "research_allocation_policy_decision_reload_failed",
        "persisted ResearchAllocationPolicyDecision is unreadable or corrupt"
      );
    }
    return value;
  }

  async recordResearchControlCampaign(
    campaign: ResearchControlCampaignRecord
  ): Promise<ResearchControlCampaignRecord> {
    if (!researchControlCampaignHasRuntimeShape(campaign)) {
      throw new LocalStoreError(
        "invalid_research_control_campaign_input",
        "invalid ResearchControlCampaign input"
      );
    }
    if (campaign.campaign_digest !== comparisonExactRecordDigest(
      researchControlCampaignDigestInput(campaign)
    )) {
      throw new LocalStoreError(
        "research_control_campaign_digest_mismatch",
        "ResearchControlCampaign digest does not match its content"
      );
    }
    if (campaign.paper_evaluation_protocol.protocol_status === "bound" &&
      campaign.paper_evaluation_protocol.protocol_digest !==
        comparisonExactRecordDigest(
          researchControlCampaignPaperEvaluationProtocolDigestInput(
            campaign.paper_evaluation_protocol
          )
        )) {
      throw new LocalStoreError(
        "research_control_campaign_paper_protocol_digest_mismatch",
        "ResearchControlCampaign paper protocol digest does not match its content"
      );
    }
    await this.assertPlannedResearchControlCampaign(campaign);
    if (campaign.paper_comparator.comparator_status === "trading_review") {
      const comparator = campaign.paper_comparator;
      const promotion = await this.getTradingPromotion(
        comparator.trading_promotion_ref.id
      );
      if (!promotion) {
        throw new LocalStoreError(
          "research_control_campaign_comparator_reference_not_found",
          "ResearchControlCampaign Trading review comparator was not found"
        );
      }
      const promotionDigest = comparisonExactRecordDigest(
        paperTradingComparisonTradingPromotionDigestInput(promotion)
      );
      if (comparator.trading_promotion_ref.record_kind !== "trading_promotion" ||
        comparator.trading_promotion_digest !== promotionDigest ||
        comparator.candidate_ref.record_kind !== "trading_system_candidate" ||
        comparator.candidate_ref.id !== promotion.candidate_ref.id ||
        comparator.candidate_version_ref.record_kind !== "candidate_version" ||
        comparator.candidate_version_ref.id !== promotion.candidate_version_ref.id ||
        comparator.paper_trading_evaluation_ref.record_kind !==
          "paper_trading_evaluation" ||
        comparator.paper_trading_evaluation_ref.id !==
          promotion.paper_trading_evaluation_ref.id ||
        Date.parse(promotion.promoted_at) > Date.parse(campaign.committed_at)) {
        throw new LocalStoreError(
          "research_control_campaign_comparator_reference_mismatch",
          "ResearchControlCampaign comparator does not match pre-effect Trading review"
        );
      }
    }
    const existing = await this.getResearchControlCampaign(
      campaign.research_control_campaign_id
    );
    if (existing) {
      if (!sameJson(existing, campaign)) {
        throw new LocalStoreError(
          "research_control_campaign_conflict",
          "ResearchControlCampaign is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(this.itemPath(
      "research-control-campaigns",
      campaign.research_control_campaign_id
    ), campaign);
    return campaign;
  }

  async getResearchControlCampaign(
    campaignId: string
  ): Promise<ResearchControlCampaignRecord | undefined> {
    const campaign = await this.readOptionalRecord<unknown>(
      "research-control-campaigns",
      campaignId
    );
    return campaign === undefined
      ? undefined
      : this.assertPersistedResearchControlCampaign(campaign);
  }

  async listResearchControlCampaigns(): Promise<ResearchControlCampaignRecord[]> {
    return (await this.readCollection<unknown>("research-control-campaigns"))
      .map((campaign) => this.assertPersistedResearchControlCampaign(campaign))
      .sort((left, right) =>
        left.committed_at.localeCompare(right.committed_at) ||
        left.research_control_campaign_id.localeCompare(
          right.research_control_campaign_id
        )
      );
  }

  private assertPersistedResearchControlCampaign(
    value: unknown
  ): ResearchControlCampaignRecord {
    if (!researchControlCampaignHasRuntimeShape(value) ||
      value.campaign_digest !== comparisonExactRecordDigest(
        researchControlCampaignDigestInput(value)
      ) || value.paper_evaluation_protocol.protocol_status === "bound" &&
      value.paper_evaluation_protocol.protocol_digest !==
        comparisonExactRecordDigest(
          researchControlCampaignPaperEvaluationProtocolDigestInput(
            value.paper_evaluation_protocol
          )
        )) {
      throw new LocalStoreError(
        "research_control_campaign_reload_failed",
        "persisted ResearchControlCampaign is unreadable or corrupt"
      );
    }
    return value;
  }

  private async assertPlannedResearchControlCampaign(
    campaign: ResearchControlCampaignRecord
  ): Promise<void> {
    const owners = (await this.listResearchControlStudies()).flatMap((study) =>
      study.replications.some((replication) =>
        replication.campaign_ref.id === campaign.research_control_campaign_id
      ) ? [study] : []
    );
    if (owners.length > 1) {
      throw new LocalStoreError(
        "research_control_study_campaign_ownership_ambiguous",
        "ResearchControlCampaign is planned by multiple studies"
      );
    }
    const study = owners[0];
    if (!study) return;
    const replication = study.replications.find((candidate) =>
      candidate.campaign_ref.id === campaign.research_control_campaign_id
    )!;
    const condition = researchControlStudyConditionForCampaign(campaign);
    if (campaign.idempotency_key !== replication.campaign_idempotency_key ||
      campaign.baseline.snapshot_digest !==
        replication.expected_baseline_snapshot_digest ||
      campaign.baseline.snapshot_digest !== study.baseline_snapshot_digest ||
      Date.parse(campaign.committed_at) <= Date.parse(study.committed_at) ||
      !sameJson(condition, study.condition)) {
      throw new LocalStoreError(
        "research_control_study_campaign_mismatch",
        "ResearchControlCampaign differs from its precommitted study"
      );
    }
  }

  async recordResearchControlCampaignArmIntent(
    intent: ResearchControlCampaignArmIntentRecord
  ): Promise<ResearchControlCampaignArmIntentRecord> {
    if (!researchControlCampaignArmIntentHasRuntimeShape(intent)) {
      throw new LocalStoreError(
        "invalid_research_control_campaign_arm_intent_input",
        "invalid ResearchControlCampaign arm intent input"
      );
    }
    if (intent.intent_digest !== comparisonExactRecordDigest(
      researchControlCampaignArmIntentDigestInput(intent)
    )) {
      throw new LocalStoreError(
        "research_control_campaign_arm_intent_digest_mismatch",
        "ResearchControlCampaign arm intent digest does not match its content"
      );
    }
    const campaign = await this.getResearchControlCampaign(intent.campaign_ref.id);
    if (!campaign) {
      throw new LocalStoreError(
        "research_control_campaign_arm_intent_reference_not_found",
        "ResearchControlCampaign arm intent campaign was not found"
      );
    }
    const arm = campaign.arms.find((candidate) =>
      candidate.research_control_campaign_arm_intent_id ===
        intent.research_control_campaign_arm_intent_id
    );
    if (!arm || intent.campaign_ref.record_kind !== "research_control_campaign" ||
      intent.campaign_ref.id !== campaign.research_control_campaign_id ||
      intent.campaign_digest !== campaign.campaign_digest ||
      intent.arm_kind !== arm.arm_kind ||
      intent.allocation_mode !== arm.allocation_mode ||
      intent.baseline_snapshot_digest !== campaign.baseline.snapshot_digest ||
      !sameJson(intent.tick_ids, arm.tick_ids) ||
      Date.parse(intent.committed_at) < Date.parse(campaign.committed_at)) {
      throw new LocalStoreError(
        "research_control_campaign_arm_intent_reference_mismatch",
        "ResearchControlCampaign arm intent does not match campaign evidence"
      );
    }
    const existing = await this.getResearchControlCampaignArmIntent(
      intent.research_control_campaign_arm_intent_id
    );
    if (existing) {
      if (!sameJson(existing, intent)) {
        throw new LocalStoreError(
          "research_control_campaign_arm_intent_conflict",
          "ResearchControlCampaign arm intent is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(this.itemPath(
      "research-control-campaign-arm-intents",
      intent.research_control_campaign_arm_intent_id
    ), intent);
    return intent;
  }

  async getResearchControlCampaignArmIntent(
    intentId: string
  ): Promise<ResearchControlCampaignArmIntentRecord | undefined> {
    const intent = await this.readOptionalRecord<unknown>(
      "research-control-campaign-arm-intents",
      intentId
    );
    return intent === undefined
      ? undefined
      : this.assertPersistedResearchControlCampaignArmIntent(intent);
  }

  async listResearchControlCampaignArmIntents(): Promise<
    ResearchControlCampaignArmIntentRecord[]
  > {
    return (await this.readCollection<unknown>(
      "research-control-campaign-arm-intents"
    )).map((intent) =>
      this.assertPersistedResearchControlCampaignArmIntent(intent)
    ).sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.research_control_campaign_arm_intent_id.localeCompare(
        right.research_control_campaign_arm_intent_id
      )
    );
  }

  private assertPersistedResearchControlCampaignArmIntent(
    value: unknown
  ): ResearchControlCampaignArmIntentRecord {
    if (!researchControlCampaignArmIntentHasRuntimeShape(value) ||
      value.intent_digest !== comparisonExactRecordDigest(
        researchControlCampaignArmIntentDigestInput(value)
      )) {
      throw new LocalStoreError(
        "research_control_campaign_arm_intent_reload_failed",
        "persisted ResearchControlCampaign arm intent is unreadable or corrupt"
      );
    }
    return value;
  }

  async recordResearchControlCampaignReport(
    report: ResearchControlCampaignReportRecord
  ): Promise<ResearchControlCampaignReportRecord> {
    if (!researchControlCampaignReportHasRuntimeShape(report)) {
      throw new LocalStoreError(
        "invalid_research_control_campaign_report_input",
        "invalid ResearchControlCampaign report input"
      );
    }
    if (report.report_digest !== comparisonExactRecordDigest(
      researchControlCampaignReportDigestInput(report)
    )) {
      throw new LocalStoreError(
        "research_control_campaign_report_digest_mismatch",
        "ResearchControlCampaign report digest does not match its content"
      );
    }
    const campaign = await this.getResearchControlCampaign(report.campaign_ref.id);
    const intents = await Promise.all(report.arms.map((arm) =>
      this.getResearchControlCampaignArmIntent(arm.arm_intent_ref.id)
    ));
    if (!campaign || intents.some((intent) => intent === undefined)) {
      throw new LocalStoreError(
        "research_control_campaign_report_reference_not_found",
        "ResearchControlCampaign report campaign or arm intent was not found"
      );
    }
    if (!this.researchControlCampaignReportGraphMatches(
      report,
      campaign,
      intents as [
        ResearchControlCampaignArmIntentRecord,
        ResearchControlCampaignArmIntentRecord
      ]
    )) {
      throw new LocalStoreError(
        "research_control_campaign_report_reference_mismatch",
        "ResearchControlCampaign report does not match campaign evidence"
      );
    }
    const existing = await this.getResearchControlCampaignReport(
      report.research_control_campaign_report_id
    );
    if (existing) {
      if (!sameJson(existing, report)) {
        throw new LocalStoreError(
          "research_control_campaign_report_conflict",
          "ResearchControlCampaign report is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(this.itemPath(
      "research-control-campaign-reports",
      report.research_control_campaign_report_id
    ), report);
    return report;
  }

  async getResearchControlCampaignReport(
    reportId: string
  ): Promise<ResearchControlCampaignReportRecord | undefined> {
    const report = await this.readOptionalRecord<unknown>(
      "research-control-campaign-reports",
      reportId
    );
    return report === undefined
      ? undefined
      : this.assertPersistedResearchControlCampaignReport(report);
  }

  async listResearchControlCampaignReports(): Promise<
    ResearchControlCampaignReportRecord[]
  > {
    return (await this.readCollection<unknown>(
      "research-control-campaign-reports"
    )).map((report) =>
      this.assertPersistedResearchControlCampaignReport(report)
    ).sort((left, right) =>
      left.completed_at.localeCompare(right.completed_at) ||
      left.research_control_campaign_report_id.localeCompare(
        right.research_control_campaign_report_id
      )
    );
  }

  private assertPersistedResearchControlCampaignReport(
    value: unknown
  ): ResearchControlCampaignReportRecord {
    if (!researchControlCampaignReportHasRuntimeShape(value) ||
      value.report_digest !== comparisonExactRecordDigest(
        researchControlCampaignReportDigestInput(value)
      )) {
      throw new LocalStoreError(
        "research_control_campaign_report_reload_failed",
        "persisted ResearchControlCampaign report is unreadable or corrupt"
      );
    }
    return value;
  }

  private researchControlCampaignReportGraphMatches(
    report: ResearchControlCampaignReportRecord,
    campaign: ResearchControlCampaignRecord,
    intents: [
      ResearchControlCampaignArmIntentRecord,
      ResearchControlCampaignArmIntentRecord
    ]
  ): boolean {
    if (report.campaign_ref.record_kind !== "research_control_campaign" ||
      report.campaign_ref.id !== campaign.research_control_campaign_id ||
      report.campaign_digest !== campaign.campaign_digest) {
      return false;
    }
    return report.arms.every((armReport, index) => {
      const campaignArm = campaign.arms[index]!;
      const intent = intents[index]!;
      const tickIds = armReport.population_diversity.tick_series.map(
        (tick) => tick.tick_id
      );
      return armReport.arm_kind === campaignArm.arm_kind &&
        armReport.allocation_mode === campaignArm.allocation_mode &&
        armReport.arm_intent_ref.record_kind ===
          "research_control_campaign_arm_intent" &&
        armReport.arm_intent_ref.id ===
          campaignArm.research_control_campaign_arm_intent_id &&
        intent.research_control_campaign_arm_intent_id ===
          armReport.arm_intent_ref.id &&
        intent.intent_digest === armReport.arm_intent_digest &&
        intent.campaign_ref.id === campaign.research_control_campaign_id &&
        intent.campaign_digest === campaign.campaign_digest &&
        intent.arm_kind === campaignArm.arm_kind &&
        intent.allocation_mode === campaignArm.allocation_mode &&
        sameJson(intent.tick_ids, campaignArm.tick_ids) &&
        tickIds.length === campaignArm.tick_ids.length &&
        campaignArm.tick_ids.every((tickId) => tickIds.includes(tickId)) &&
        armReport.tick_refs.every((tickRef, tickIndex) =>
          tickRef.id === `candidate-arena-tick-${campaignArm.tick_ids[tickIndex]}`
        ) && armReport.allocation_refs.every((allocationRef, tickIndex) =>
          allocationRef.id ===
            `candidate-arena-research-allocation-${campaignArm.tick_ids[tickIndex]}`
        );
    });
  }

  async recordResearchControlCampaignPaperSchedule(
    schedule: ResearchControlCampaignPaperScheduleRecord
  ): Promise<ResearchControlCampaignPaperScheduleRecord> {
    if (!researchControlCampaignPaperScheduleHasRuntimeShape(schedule)) {
      throw new LocalStoreError(
        "invalid_research_control_campaign_paper_schedule_input",
        "invalid ResearchControlCampaign paper schedule input"
      );
    }
    if (schedule.schedule_digest !== comparisonExactRecordDigest(
      researchControlCampaignPaperScheduleDigestInput(schedule)
    )) {
      throw new LocalStoreError(
        "research_control_campaign_paper_schedule_digest_mismatch",
        "ResearchControlCampaign paper schedule digest does not match its content"
      );
    }
    const [campaign, report] = await Promise.all([
      this.getResearchControlCampaign(schedule.campaign_ref.id),
      this.getResearchControlCampaignReport(schedule.report_ref.id)
    ]);
    if (!campaign || !report) {
      throw new LocalStoreError(
        "research_control_campaign_paper_schedule_reference_not_found",
        "ResearchControlCampaign paper schedule source evidence was not found"
      );
    }
    if (!this.researchControlCampaignPaperScheduleGraphMatches(
      schedule,
      campaign,
      report
    )) {
      throw new LocalStoreError(
        "research_control_campaign_paper_schedule_reference_mismatch",
        "ResearchControlCampaign paper schedule does not match frozen source evidence"
      );
    }
    const existing = await this.getResearchControlCampaignPaperSchedule(
      schedule.research_control_campaign_paper_schedule_id
    );
    if (existing) {
      if (!sameJson(existing, schedule)) {
        throw new LocalStoreError(
          "research_control_campaign_paper_schedule_conflict",
          "ResearchControlCampaign paper schedule is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(this.itemPath(
      "research-control-campaign-paper-schedules",
      schedule.research_control_campaign_paper_schedule_id
    ), schedule);
    return schedule;
  }

  async getResearchControlCampaignPaperSchedule(
    scheduleId: string
  ): Promise<ResearchControlCampaignPaperScheduleRecord | undefined> {
    const schedule = await this.readOptionalRecord<unknown>(
      "research-control-campaign-paper-schedules",
      scheduleId
    );
    return schedule === undefined
      ? undefined
      : this.assertPersistedResearchControlCampaignPaperSchedule(schedule);
  }

  async listResearchControlCampaignPaperSchedules(): Promise<
    ResearchControlCampaignPaperScheduleRecord[]
  > {
    return (await this.readCollection<unknown>(
      "research-control-campaign-paper-schedules"
    )).map((schedule) =>
      this.assertPersistedResearchControlCampaignPaperSchedule(schedule)
    ).sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.research_control_campaign_paper_schedule_id.localeCompare(
        right.research_control_campaign_paper_schedule_id
      )
    );
  }

  private assertPersistedResearchControlCampaignPaperSchedule(
    value: unknown
  ): ResearchControlCampaignPaperScheduleRecord {
    if (!researchControlCampaignPaperScheduleHasRuntimeShape(value) ||
      value.schedule_digest !== comparisonExactRecordDigest(
        researchControlCampaignPaperScheduleDigestInput(value)
      )) {
      throw new LocalStoreError(
        "research_control_campaign_paper_schedule_reload_failed",
        "persisted ResearchControlCampaign paper schedule is unreadable or corrupt"
      );
    }
    return value;
  }

  private researchControlCampaignPaperScheduleGraphMatches(
    schedule: ResearchControlCampaignPaperScheduleRecord,
    campaign: ResearchControlCampaignRecord,
    report: ResearchControlCampaignReportRecord
  ): boolean {
    const paperProtocol = campaign.paper_evaluation_protocol;
    if (campaign.paper_comparator.comparator_status !== "trading_review" ||
      paperProtocol.protocol_status !== "bound" ||
      schedule.research_control_campaign_paper_schedule_id !==
        researchControlCampaignPaperScheduleIdForReport(report) ||
      schedule.campaign_ref.record_kind !== "research_control_campaign" ||
      schedule.campaign_ref.id !== campaign.research_control_campaign_id ||
      schedule.campaign_digest !== campaign.campaign_digest ||
      schedule.report_ref.record_kind !== "research_control_campaign_report" ||
      schedule.report_ref.id !== report.research_control_campaign_report_id ||
      schedule.report_digest !== report.report_digest ||
      report.campaign_ref.id !== campaign.research_control_campaign_id ||
      report.campaign_digest !== campaign.campaign_digest ||
      !sameJson(schedule.paper_comparator, campaign.paper_comparator) ||
      schedule.paper_evaluation_protocol_digest !==
        paperProtocol.protocol_digest ||
      Date.parse(schedule.committed_at) < Date.parse(report.completed_at)) {
      return false;
    }

    return schedule.arms.every((scheduleArm, armIndex) => {
      const reportArm = report.arms[armIndex]!;
      const armToken = armIndex === 0 ? "adaptive" : "static";
      return scheduleArm.arm_kind === reportArm.arm_kind &&
        scheduleArm.slots.length === reportArm.paper_candidate_slots.length &&
        scheduleArm.slots.every((slot, slotIndex) => {
          const reportSlot = reportArm.paper_candidate_slots[slotIndex]!;
          if (slot.sequence !== reportSlot.sequence ||
            !paperTradingComparisonRefsEqual(slot.tick_ref, reportSlot.tick_ref) ||
            slot.slot_status === "no_admitted_candidate" ||
            reportSlot.status === "no_admitted_candidate") {
            return slot.slot_status === "no_admitted_candidate" &&
              reportSlot.status === "no_admitted_candidate";
          }
          const idempotencyKey = `research-control-paper:${
            campaign.research_control_campaign_id
          }:${armToken}:slot:${slot.sequence}:source`;
          const ids = paperTradingComparisonIdsForIdempotencyKey(idempotencyKey);
          return paperTradingComparisonRefsEqual(
            slot.candidate_ref,
            reportSlot.candidate_ref
          ) && paperTradingComparisonRefsEqual(
            slot.candidate_version_ref,
            reportSlot.candidate_version_ref
          ) && paperTradingComparisonRefsEqual(
            slot.system_code_ref,
            reportSlot.system_code_ref
          ) && slot.system_code_artifact_digest ===
            reportSlot.system_code_artifact_digest &&
            paperTradingComparisonRefsEqual(
              slot.admission_decision_ref,
              reportSlot.admission_decision_ref
            ) && slot.source_comparison_idempotency_key === idempotencyKey &&
            slot.source_preparation_id === ids.preparationId &&
            slot.source_comparison_commitment_id ===
              ids.comparisonId &&
            slot.maximum_source_start_delay_ms ===
              paperProtocol.comparison_policy.maximum_elapsed_ms;
        });
    });
  }

  async recordResearchControlCampaignPaperStartBatch(
    batch: ResearchControlCampaignPaperStartBatchRecord
  ): Promise<ResearchControlCampaignPaperStartBatchRecord> {
    return this.persistResearchControlCampaignPaperStartBatch(batch, false);
  }

  async replicateResearchControlCampaignPaperStartBatch(
    batch: ResearchControlCampaignPaperStartBatchRecord
  ): Promise<ResearchControlCampaignPaperStartBatchRecord> {
    return this.persistResearchControlCampaignPaperStartBatch(batch, true);
  }

  private async persistResearchControlCampaignPaperStartBatch(
    batch: ResearchControlCampaignPaperStartBatchRecord,
    validateLocalSource: boolean
  ): Promise<ResearchControlCampaignPaperStartBatchRecord> {
    if (!researchControlCampaignPaperStartBatchHasRuntimeShape(batch)) {
      throw new LocalStoreError(
        "invalid_research_control_campaign_paper_start_batch_input",
        "invalid ResearchControlCampaign paper start batch input"
      );
    }
    if (batch.start_batch_digest !== comparisonExactRecordDigest(
      researchControlCampaignPaperStartBatchDigestInput(batch)
    )) {
      throw new LocalStoreError(
        "research_control_campaign_paper_start_batch_digest_mismatch",
        "ResearchControlCampaign paper start batch digest does not match its content"
      );
    }
    const schedule = await this.getResearchControlCampaignPaperSchedule(
      batch.schedule_ref.id
    );
    if (!schedule) {
      throw new LocalStoreError(
        "research_control_campaign_paper_start_batch_reference_not_found",
        "ResearchControlCampaign paper start batch schedule was not found"
      );
    }
    if (!await this.researchControlCampaignPaperStartBatchGraphMatches(
      batch,
      schedule
    )) {
      throw new LocalStoreError(
        "research_control_campaign_paper_start_batch_reference_mismatch",
        "ResearchControlCampaign paper start batch does not match its schedule"
      );
    }
    if (validateLocalSource) {
      await this.validateResearchControlCampaignPaperStartBatchLocalSource(batch);
    }
    const existing = await this.getResearchControlCampaignPaperStartBatch(
      batch.research_control_campaign_paper_start_batch_id
    );
    if (existing) {
      if (!sameJson(existing, batch)) {
        throw new LocalStoreError(
          "research_control_campaign_paper_start_batch_conflict",
          "ResearchControlCampaign paper start batch is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(this.itemPath(
      "research-control-campaign-paper-start-batches",
      batch.research_control_campaign_paper_start_batch_id
    ), batch);
    return batch;
  }

  async getResearchControlCampaignPaperStartBatch(
    batchId: string
  ): Promise<ResearchControlCampaignPaperStartBatchRecord | undefined> {
    const batch = await this.readOptionalRecord<unknown>(
      "research-control-campaign-paper-start-batches",
      batchId
    );
    return batch === undefined
      ? undefined
      : this.assertPersistedResearchControlCampaignPaperStartBatch(batch);
  }

  async listResearchControlCampaignPaperStartBatches(
    scheduleId?: string
  ): Promise<ResearchControlCampaignPaperStartBatchRecord[]> {
    return (await this.readCollection<unknown>(
      "research-control-campaign-paper-start-batches"
    )).map((batch) =>
      this.assertPersistedResearchControlCampaignPaperStartBatch(batch)
    ).filter((batch) => scheduleId === undefined ||
      batch.schedule_ref.id === scheduleId
    ).sort((left, right) =>
      left.sequence - right.sequence ||
      left.evaluated_at.localeCompare(right.evaluated_at) ||
      left.research_control_campaign_paper_start_batch_id.localeCompare(
        right.research_control_campaign_paper_start_batch_id
      )
    );
  }

  private assertPersistedResearchControlCampaignPaperStartBatch(
    value: unknown
  ): ResearchControlCampaignPaperStartBatchRecord {
    if (!researchControlCampaignPaperStartBatchHasRuntimeShape(value) ||
      value.start_batch_digest !== comparisonExactRecordDigest(
        researchControlCampaignPaperStartBatchDigestInput(value)
      )) {
      throw new LocalStoreError(
        "research_control_campaign_paper_start_batch_reload_failed",
        "persisted ResearchControlCampaign paper start batch is unreadable or corrupt"
      );
    }
    return value;
  }

  private async researchControlCampaignPaperStartBatchGraphMatches(
    batch: ResearchControlCampaignPaperStartBatchRecord,
    schedule: ResearchControlCampaignPaperScheduleRecord
  ): Promise<boolean> {
    const candidateSlots = schedule.arms.flatMap((arm) => {
      const slot = arm.slots.find((candidate) =>
        candidate.sequence === batch.sequence
      );
      return slot?.slot_status === "candidate_scheduled"
        ? [{ armKind: arm.arm_kind, slot }]
        : [];
    });
    if (batch.research_control_campaign_paper_start_batch_id !==
        researchControlCampaignPaperStartBatchIdFor(schedule, batch.sequence) ||
      batch.schedule_ref.record_kind !==
        "research_control_campaign_paper_schedule" ||
      batch.schedule_ref.id !==
        schedule.research_control_campaign_paper_schedule_id ||
      batch.schedule_digest !== schedule.schedule_digest ||
      candidateSlots.length < 1 || candidateSlots.length !== batch.sides.length ||
      batch.sides.some((side, index) =>
        side.arm_kind !== candidateSlots[index]!.armKind ||
        side.source_comparison_ref.id !==
          candidateSlots[index]!.slot.source_comparison_commitment_id
      )) {
      return false;
    }
    const applicableStartMs =
      await this.researchControlCampaignPaperSlotApplicableStartMs(
        schedule,
        batch.sequence
      );
    const maximumDelayMs = Math.max(...candidateSlots.map(({ slot }) =>
      slot.maximum_source_start_delay_ms
    ));
    return batch.source_start_deadline_at === new Date(
      applicableStartMs + maximumDelayMs
    ).toISOString();
  }

  private async validateResearchControlCampaignPaperStartBatchLocalSource(
    batch: ResearchControlCampaignPaperStartBatchRecord
  ): Promise<void> {
    let localSourceCount = 0;
    for (const side of batch.sides) {
      const comparison = await this.getPaperTradingComparisonCommitment(
        side.source_comparison_ref.id
      );
      if (!comparison) {
        const unexpectedTick = side.first_tick_ref
          ? await this.getPaperTradingComparisonTick(side.first_tick_ref.id)
          : undefined;
        if (unexpectedTick) {
          throw new LocalStoreError(
            "research_control_campaign_paper_start_batch_local_source_mismatch",
            "paper start batch local tick exists without its source comparison"
          );
        }
        continue;
      }
      localSourceCount += 1;
      if (!paperTradingComparisonCommitmentHasRuntimeShape(comparison) ||
        comparison.commitment_digest !== comparisonExactRecordDigest(
          paperTradingComparisonCommitmentDigestInput(comparison)
        ) || comparison.commitment_digest !== side.source_comparison_digest) {
        throw new LocalStoreError(
          "research_control_campaign_paper_start_batch_local_source_mismatch",
          "paper start batch local source comparison is not exact"
        );
      }
      const firstTicks = (
        await this.listPaperTradingComparisonTicks(
          comparison.paper_trading_comparison_commitment_id
        )
      ).filter((tick) => tick.sequence === 1);
      if (!side.first_tick_ref) {
        if (firstTicks.length !== 0) {
          throw new LocalStoreError(
            "research_control_campaign_paper_start_batch_local_source_mismatch",
            "paper start batch omits a persisted local first tick"
          );
        }
        continue;
      }
      const tick = firstTicks[0];
      if (firstTicks.length !== 1 || !tick ||
        !paperTradingComparisonTickHasRuntimeShape(tick) ||
        tick.paper_trading_comparison_tick_id !== side.first_tick_ref.id ||
        tick.tick_digest !== side.first_tick_digest ||
        tick.observed_at !== side.first_tick_observed_at ||
        tick.paper_trading_comparison_commitment_ref.id !==
          comparison.paper_trading_comparison_commitment_id ||
        tick.paper_trading_comparison_commitment_digest !==
          comparison.commitment_digest || tick.tick_digest !==
          comparisonExactRecordDigest(paperTradingComparisonTickDigestInput(tick))) {
        throw new LocalStoreError(
          "research_control_campaign_paper_start_batch_local_source_mismatch",
          "paper start batch local first tick is not exact"
        );
      }
    }
    if (localSourceCount === 0) {
      throw new LocalStoreError(
        "research_control_campaign_paper_start_batch_local_source_not_found",
        "paper start batch has no source comparison in this arm store"
      );
    }
  }

  async recordResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord> {
    return this.persistResearchControlCampaignPaperSlotOutcome(outcome, true);
  }

  async replicateResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord> {
    return this.persistResearchControlCampaignPaperSlotOutcome(outcome, false);
  }

  private async persistResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord,
    validateTerminalEvidence: boolean
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord> {
    if (!researchControlCampaignPaperSlotOutcomeHasRuntimeShape(outcome)) {
      throw new LocalStoreError(
        "invalid_research_control_campaign_paper_slot_outcome_input",
        "invalid ResearchControlCampaign paper slot outcome input"
      );
    }
    if (outcome.slot_outcome_digest !== comparisonExactRecordDigest(
      researchControlCampaignPaperSlotOutcomeDigestInput(outcome)
    )) {
      throw new LocalStoreError(
        "research_control_campaign_paper_slot_outcome_digest_mismatch",
        "ResearchControlCampaign paper slot outcome digest does not match its content"
      );
    }
    const schedule = await this.getResearchControlCampaignPaperSchedule(
      outcome.schedule_ref.id
    );
    if (!schedule) {
      throw new LocalStoreError(
        "research_control_campaign_paper_slot_outcome_reference_not_found",
        "ResearchControlCampaign paper slot outcome schedule was not found"
      );
    }
    if (!this.researchControlCampaignPaperSlotOutcomeGraphMatches(
      outcome,
      schedule
    )) {
      throw new LocalStoreError(
        "research_control_campaign_paper_slot_outcome_reference_mismatch",
        "ResearchControlCampaign paper slot outcome does not match its schedule"
      );
    }
    if (validateTerminalEvidence) {
      await this.validateResearchControlCampaignPaperSlotTerminalEvidence(
        outcome,
        schedule
      );
    }
    const existing = await this.getResearchControlCampaignPaperSlotOutcome(
      outcome.research_control_campaign_paper_slot_outcome_id
    );
    if (existing) {
      if (!sameJson(existing, outcome)) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_conflict",
          "ResearchControlCampaign paper slot outcome is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(this.itemPath(
      "research-control-campaign-paper-slot-outcomes",
      outcome.research_control_campaign_paper_slot_outcome_id
    ), outcome);
    return outcome;
  }

  async getResearchControlCampaignPaperSlotOutcome(
    outcomeId: string
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord | undefined> {
    const outcome = await this.readOptionalRecord<unknown>(
      "research-control-campaign-paper-slot-outcomes",
      outcomeId
    );
    return outcome === undefined
      ? undefined
      : this.assertPersistedResearchControlCampaignPaperSlotOutcome(outcome);
  }

  async listResearchControlCampaignPaperSlotOutcomes(
    scheduleId?: string
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord[]> {
    return (await this.readCollection<unknown>(
      "research-control-campaign-paper-slot-outcomes"
    )).map((outcome) =>
      this.assertPersistedResearchControlCampaignPaperSlotOutcome(outcome)
    ).filter((outcome) => scheduleId === undefined ||
      outcome.schedule_ref.id === scheduleId
    ).sort((left, right) =>
      left.terminal_at.localeCompare(right.terminal_at) ||
      left.research_control_campaign_paper_slot_outcome_id.localeCompare(
        right.research_control_campaign_paper_slot_outcome_id
      )
    );
  }

  private assertPersistedResearchControlCampaignPaperSlotOutcome(
    value: unknown
  ): ResearchControlCampaignPaperSlotOutcomeRecord {
    if (!researchControlCampaignPaperSlotOutcomeHasRuntimeShape(value) ||
      value.slot_outcome_digest !== comparisonExactRecordDigest(
        researchControlCampaignPaperSlotOutcomeDigestInput(value)
      )) {
      throw new LocalStoreError(
        "research_control_campaign_paper_slot_outcome_reload_failed",
        "persisted ResearchControlCampaign paper slot outcome is unreadable or corrupt"
      );
    }
    return value;
  }

  private researchControlCampaignPaperSlotOutcomeGraphMatches(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord,
    schedule: ResearchControlCampaignPaperScheduleRecord
  ): boolean {
    const arm = schedule.arms.find((candidate) =>
      candidate.arm_kind === outcome.arm_kind
    );
    const slot = arm?.slots.find((candidate) =>
      candidate.sequence === outcome.sequence
    );
    return outcome.research_control_campaign_paper_slot_outcome_id ===
      researchControlCampaignPaperSlotOutcomeIdFor(
        schedule,
        outcome.arm_kind,
        outcome.sequence
      ) && outcome.schedule_ref.record_kind ===
        "research_control_campaign_paper_schedule" &&
      outcome.schedule_ref.id ===
        schedule.research_control_campaign_paper_schedule_id &&
      outcome.schedule_digest === schedule.schedule_digest &&
      slot?.slot_status === "candidate_scheduled" &&
      paperTradingComparisonRefsEqual(outcome.tick_ref, slot.tick_ref) &&
      paperTradingComparisonRefsEqual(
        outcome.candidate_ref,
        slot.candidate_ref
      ) && paperTradingComparisonRefsEqual(
        outcome.candidate_version_ref,
        slot.candidate_version_ref
      ) && paperTradingComparisonRefsEqual(
        outcome.system_code_ref,
        slot.system_code_ref
      ) && outcome.system_code_artifact_digest ===
        slot.system_code_artifact_digest &&
      paperTradingComparisonRefsEqual(
        outcome.admission_decision_ref,
        slot.admission_decision_ref
      ) && outcome.source_comparison_idempotency_key ===
        slot.source_comparison_idempotency_key &&
      outcome.source_preparation_id === slot.source_preparation_id &&
      outcome.source_comparison_commitment_id ===
        slot.source_comparison_commitment_id &&
      Date.parse(outcome.terminal_at) >= Date.parse(schedule.committed_at);
  }

  private async validateResearchControlCampaignPaperSlotTerminalEvidence(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord,
    schedule: ResearchControlCampaignPaperScheduleRecord
  ): Promise<void> {
    const evidence = outcome.terminal_evidence;
    if (evidence.evidence_kind === "source_slot_expired") {
      const [preparation, commitment, ticks, startBatch, applicableStartMs] =
        await Promise.all([
        this.getPaperTradingComparisonPreparation(outcome.source_preparation_id),
        this.getPaperTradingComparisonCommitment(
          outcome.source_comparison_commitment_id
        ),
        this.listPaperTradingComparisonTicks(
          outcome.source_comparison_commitment_id
        ),
        this.getResearchControlCampaignPaperStartBatch(
          researchControlCampaignPaperStartBatchIdFor(
            schedule,
            outcome.sequence
          )
        ),
        this.researchControlCampaignPaperSlotApplicableStartMs(
          schedule,
          outcome.sequence
        )
      ]);
      const slot = schedule.arms.flatMap((arm) => arm.slots).find((candidate) =>
        candidate.slot_status === "candidate_scheduled" &&
        candidate.source_preparation_id === outcome.source_preparation_id
      );
      const preparationMismatch = preparation && slot?.slot_status ===
        "candidate_scheduled" && (
        preparation.paper_trading_comparison_preparation_id !==
          slot.source_preparation_id ||
        preparation.paper_trading_comparison_commitment_id !==
          slot.source_comparison_commitment_id
      );
      const commitmentMismatch = commitment && (!preparation ||
        slot?.slot_status !== "candidate_scheduled" ||
        commitment.paper_trading_comparison_commitment_id !==
          slot.source_comparison_commitment_id ||
        commitment.preparation_ref.id !== slot.source_preparation_id
      );
      if (!slot || slot.slot_status !== "candidate_scheduled" ||
        preparationMismatch || commitmentMismatch || ticks.length > 0 ||
        startBatch || Date.parse(outcome.terminal_at) <
          applicableStartMs + slot.maximum_source_start_delay_ms) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_graph_invalid",
          "source slot expiry lacks a closed missed-start deadline graph"
        );
      }
      return;
    }

    if (evidence.evidence_kind === "source_verdict") {
      const [commitment, verdict] = await Promise.all([
        this.getPaperTradingComparisonCommitment(
          evidence.source_comparison_ref.id
        ),
        this.getPaperTradingComparisonVerdict(evidence.source_verdict_ref.id)
      ]);
      if (!commitment || !verdict) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_reference_not_found",
          "source comparison or verdict evidence was not found"
        );
      }
      const expectedStatus = verdict.verdict_outcome === "challenger_not_improved"
        ? "source_not_improved"
        : verdict.verdict_outcome === "comparison_ineligible"
        ? "evidence_ineligible"
        : undefined;
      if (!await this.researchControlCampaignSourceCommitmentMatchesSlot(
        commitment,
        outcome,
        schedule
      ) || !paperTradingComparisonVerdictHasRuntimeShape(verdict) ||
        verdict.verdict_digest !== comparisonExactRecordDigest(
          paperTradingComparisonVerdictDigestInput(verdict)
        ) || evidence.source_comparison_ref.id !==
          commitment.paper_trading_comparison_commitment_id ||
        evidence.source_comparison_digest !== commitment.commitment_digest ||
        evidence.source_verdict_ref.id !==
          verdict.paper_trading_comparison_verdict_id ||
        evidence.source_verdict_digest !== verdict.verdict_digest ||
        verdict.paper_trading_comparison_commitment_ref.id !==
          commitment.paper_trading_comparison_commitment_id ||
        verdict.paper_trading_comparison_commitment_digest !==
          commitment.commitment_digest || !expectedStatus ||
        evidence.terminal_status !== expectedStatus ||
        outcome.terminal_at !== verdict.evaluated_at) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_graph_invalid",
          "source verdict does not close the exact scheduled comparison"
        );
      }
      return;
    }

    if (evidence.evidence_kind === "confirmation_precommit_expired") {
      const [commitment, verdict, campaigns] = await Promise.all([
        this.getPaperTradingComparisonCommitment(
          evidence.source_comparison_ref.id
        ),
        this.getPaperTradingComparisonVerdict(evidence.source_verdict_ref.id),
        this.listPaperTradingComparisonConfirmationCampaigns()
      ]);
      if (!commitment || !verdict) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_reference_not_found",
          "improved source comparison or verdict evidence was not found"
        );
      }
      const campaign = await this.getResearchControlCampaign(
        schedule.campaign_ref.id
      );
      if (!campaign || campaign.paper_evaluation_protocol.protocol_status !==
          "bound" || !await this.researchControlCampaignSourceCommitmentMatchesSlot(
            commitment,
            outcome,
            schedule
          ) || !paperTradingComparisonVerdictHasRuntimeShape(verdict) ||
        verdict.verdict_digest !== comparisonExactRecordDigest(
          paperTradingComparisonVerdictDigestInput(verdict)
        ) || evidence.source_comparison_ref.id !==
          commitment.paper_trading_comparison_commitment_id ||
        evidence.source_comparison_digest !== commitment.commitment_digest ||
        evidence.source_verdict_ref.id !==
          verdict.paper_trading_comparison_verdict_id ||
        evidence.source_verdict_digest !== verdict.verdict_digest ||
        verdict.paper_trading_comparison_commitment_ref.id !==
          commitment.paper_trading_comparison_commitment_id ||
        verdict.paper_trading_comparison_commitment_digest !==
          commitment.commitment_digest ||
        verdict.verdict_outcome !== "challenger_improved" ||
        verdict.confirmation_disposition !==
          "requires_precommitted_campaign" ||
        campaigns.some((candidate) =>
          candidate.source_verdict_ref.id ===
            verdict.paper_trading_comparison_verdict_id
        ) || Date.parse(outcome.terminal_at) < Date.parse(verdict.evaluated_at) +
          campaign.paper_evaluation_protocol.schedule_policy
            .confirmation_precommit_deadline_ms) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_graph_invalid",
          "confirmation precommit expiry lacks an improved unclaimed source verdict deadline"
        );
      }
      return;
    }

    if (evidence.evidence_kind === "confirmation_release") {
      const [campaign, campaignOutcome, release] = await Promise.all([
        this.getPaperTradingComparisonConfirmationCampaign(
          evidence.confirmation_campaign_ref.id
        ),
        this.getPaperTradingComparisonConfirmationCampaignOutcome(
          evidence.confirmation_outcome_ref.id
        ),
        this.getPaperTradingComparisonResearchRelease(
          evidence.research_release_ref.id
        )
      ]);
      if (!campaign || !campaignOutcome || !release) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_reference_not_found",
          "confirmation campaign, outcome, or ResearchRelease was not found"
        );
      }
      await this.assertResearchControlCampaignConfirmationPrecommitDeadline(
        campaign
      );
      try {
        await this.validatePaperTradingComparisonConfirmationCampaignGraph(campaign);
      } catch {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_graph_invalid",
          "confirmation campaign source graph is invalid"
        );
      }
      const terminalByRelease = {
        confirmed_improvement: "qualified_improvement",
        challenger_not_reproduced: "not_reproduced",
        comparison_evidence_ineligible: "evidence_ineligible",
        campaign_slot_expired: "paper_slot_expired"
      } as const;
      if (!paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(
        campaignOutcome
      ) || campaignOutcome.outcome_digest !== comparisonExactRecordDigest(
        paperTradingComparisonConfirmationCampaignOutcomeDigestInput(
          campaignOutcome
        )
      ) || !paperTradingComparisonResearchReleaseHasRuntimeShape(release) ||
        release.release_digest !== comparisonExactRecordDigest(
          paperTradingComparisonResearchReleaseDigestInput(release)
        ) || evidence.confirmation_campaign_ref.id !==
          campaign.paper_trading_comparison_confirmation_campaign_id ||
        evidence.confirmation_campaign_digest !== campaign.campaign_digest ||
        evidence.confirmation_outcome_ref.id !==
          campaignOutcome.paper_trading_comparison_confirmation_campaign_outcome_id ||
        evidence.confirmation_outcome_digest !== campaignOutcome.outcome_digest ||
        evidence.research_release_ref.id !==
          release.paper_trading_comparison_research_release_id ||
        evidence.research_release_digest !== release.release_digest ||
        campaign.source_comparison_ref.id !==
          outcome.source_comparison_commitment_id ||
        campaignOutcome.campaign_ref.id !==
          campaign.paper_trading_comparison_confirmation_campaign_id ||
        campaignOutcome.campaign_digest !== campaign.campaign_digest ||
        release.campaign_ref.id !==
          campaign.paper_trading_comparison_confirmation_campaign_id ||
        release.campaign_digest !== campaign.campaign_digest ||
        release.campaign_outcome_ref.id !==
          campaignOutcome.paper_trading_comparison_confirmation_campaign_outcome_id ||
        release.campaign_outcome_digest !== campaignOutcome.outcome_digest ||
        !paperTradingComparisonRefsEqual(
          release.candidate_ref,
          outcome.candidate_ref
        ) || !paperTradingComparisonRefsEqual(
          release.candidate_version_ref,
          outcome.candidate_version_ref
        ) || !paperTradingComparisonRefsEqual(
          release.system_code_ref,
          outcome.system_code_ref
        ) || release.system_code_artifact_digest !==
          outcome.system_code_artifact_digest ||
        evidence.release_kind !== release.release_kind ||
        evidence.terminal_status !== terminalByRelease[release.release_kind] ||
        outcome.terminal_at !== release.released_at) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_graph_invalid",
          "confirmation ResearchRelease does not close the exact scheduled slot"
        );
      }
      return;
    }

    if (evidence.evidence_kind === "source_start_ineligible") {
      const batch = await this.getResearchControlCampaignPaperStartBatch(
        evidence.start_batch_ref.id
      );
      if (!batch || !await this.researchControlCampaignPaperStartBatchGraphMatches(
        batch,
        schedule
      )) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_reference_not_found",
          "source start batch evidence was not found or does not match the schedule"
        );
      }
      await this.validateResearchControlCampaignPaperStartBatchLocalSource(batch);
      const side = batch.sides.find((candidate) =>
        candidate.arm_kind === outcome.arm_kind
      );
      const tickSides = batch.sides.filter((candidate) =>
        candidate.first_tick_ref !== undefined
      );
      if (batch.batch_status !== "ineligible" || !batch.ineligible_reason ||
        evidence.start_batch_ref.record_kind !==
          "research_control_campaign_paper_start_batch" ||
        evidence.start_batch_ref.id !==
          batch.research_control_campaign_paper_start_batch_id ||
        evidence.start_batch_digest !== batch.start_batch_digest ||
        batch.sequence !== outcome.sequence || !side ||
        side.source_comparison_ref.id !==
          outcome.source_comparison_commitment_id ||
        evidence.reason !== batch.ineligible_reason ||
        evidence.evaluated_at !== batch.evaluated_at ||
        outcome.terminal_at !== batch.evaluated_at || !sameJson(
          evidence.persisted_first_tick_refs,
          tickSides.map((candidate) => ({ ...candidate.first_tick_ref! }))
        ) || !sameJson(
          evidence.persisted_first_tick_digests,
          tickSides.map((candidate) => candidate.first_tick_digest!)
        )) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_graph_invalid",
          "source start terminal outcome does not match its sealed batch"
        );
      }
      return;
    }

    throw new LocalStoreError(
      "research_control_campaign_paper_slot_outcome_evidence_graph_invalid",
      "paper slot terminal evidence graph is not yet valid for this source path"
    );
  }

  private async researchControlCampaignPaperSlotApplicableStartMs(
    schedule: ResearchControlCampaignPaperScheduleRecord,
    sequence: number
  ): Promise<number> {
    if (sequence === 1) return Date.parse(schedule.committed_at);
    const previousSequence = sequence - 1;
    const terminalTimes: number[] = [];
    for (const arm of schedule.arms) {
      const slot = arm.slots.find((candidate) =>
        candidate.sequence === previousSequence
      );
      if (!slot) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_graph_invalid",
          "previous paper slot is missing from the frozen schedule"
        );
      }
      if (slot.slot_status === "no_admitted_candidate") {
        terminalTimes.push(Date.parse(schedule.committed_at));
        continue;
      }
      const prior = await this.getResearchControlCampaignPaperSlotOutcome(
        researchControlCampaignPaperSlotOutcomeIdFor(
          schedule,
          arm.arm_kind,
          previousSequence
        )
      );
      if (!prior || !this.researchControlCampaignPaperSlotOutcomeGraphMatches(
        prior,
        schedule
      )) {
        throw new LocalStoreError(
          "research_control_campaign_paper_slot_outcome_evidence_graph_invalid",
          "previous paper slot outcome is not terminal"
        );
      }
      terminalTimes.push(Date.parse(prior.terminal_at));
    }
    return Math.max(...terminalTimes);
  }

  private async researchControlCampaignSourceCommitmentMatchesSlot(
    commitment: PaperTradingComparisonCommitmentRecord,
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord,
    schedule: ResearchControlCampaignPaperScheduleRecord
  ): Promise<boolean> {
    if (!paperTradingComparisonCommitmentHasRuntimeShape(commitment) ||
      commitment.commitment_digest !== comparisonExactRecordDigest(
        paperTradingComparisonCommitmentDigestInput(commitment)
      )) {
      return false;
    }
    const campaign = await this.getResearchControlCampaign(
      schedule.campaign_ref.id
    );
    if (!campaign || campaign.paper_comparator.comparator_status !==
        "trading_review" ||
      campaign.paper_evaluation_protocol.protocol_status !== "bound") {
      return false;
    }
    const comparator = campaign.paper_comparator;
    const protocol = campaign.paper_evaluation_protocol;
    const selection = commitment.champion_selection;
    return commitment.paper_trading_comparison_commitment_id ===
        outcome.source_comparison_commitment_id &&
      commitment.preparation_ref.record_kind ===
        "paper_trading_comparison_preparation" &&
      commitment.preparation_ref.id === outcome.source_preparation_id &&
      paperTradingComparisonRefsEqual(
        commitment.champion.candidate_ref,
        comparator.candidate_ref
      ) && paperTradingComparisonRefsEqual(
        commitment.champion.candidate_version_ref,
        comparator.candidate_version_ref
      ) && selection.selection_kind === "trading_review" &&
      paperTradingComparisonRefsEqual(
        selection.trading_promotion_ref,
        comparator.trading_promotion_ref
      ) && selection.trading_promotion_digest ===
        comparator.trading_promotion_digest &&
      paperTradingComparisonRefsEqual(
        selection.paper_trading_evaluation_ref,
        comparator.paper_trading_evaluation_ref
      ) && paperTradingComparisonRefsEqual(
        commitment.challenger.candidate_ref,
        outcome.candidate_ref
      ) && paperTradingComparisonRefsEqual(
        commitment.challenger.candidate_version_ref,
        outcome.candidate_version_ref
      ) && paperTradingComparisonRefsEqual(
        commitment.challenger.system_code_ref,
        outcome.system_code_ref
      ) && commitment.challenger.system_code_artifact_digest ===
        outcome.system_code_artifact_digest &&
      paperTradingComparisonRefsEqual(
        commitment.challenger.candidate_admission_decision_ref,
        outcome.admission_decision_ref
      ) && sameJson(commitment.comparison_policy, protocol.comparison_policy) &&
      commitment.market_data_configuration_digest ===
        protocol.market_data_configuration_digest &&
      sameJson(commitment.paper_policy_identity, protocol.paper_policy_identity) &&
      Date.parse(commitment.committed_at) > Date.parse(schedule.committed_at);
  }

  async recordResearchControlCampaignOutcome(
    outcome: ResearchControlCampaignOutcomeRecord
  ): Promise<ResearchControlCampaignOutcomeRecord> {
    if (!researchControlCampaignOutcomeHasRuntimeShape(outcome)) {
      throw new LocalStoreError(
        "invalid_research_control_campaign_outcome_input",
        "invalid ResearchControlCampaign outcome input"
      );
    }
    if (outcome.outcome_digest !== comparisonExactRecordDigest(
      researchControlCampaignOutcomeDigestInput(outcome)
    )) {
      throw new LocalStoreError(
        "research_control_campaign_outcome_digest_mismatch",
        "ResearchControlCampaign outcome digest does not match its content"
      );
    }
    const slotOutcomeRefs = outcome.arms.flatMap((arm) => arm.slot_results)
      .filter((result) => result.terminal_status !== "no_admitted_candidate")
      .map((result) => result.paper_slot_outcome_ref);
    const [campaign, report, schedule, promotion, slotOutcomes] =
      await Promise.all([
      this.getResearchControlCampaign(outcome.campaign_ref.id),
      this.getResearchControlCampaignReport(outcome.report_ref.id),
      this.getResearchControlCampaignPaperSchedule(outcome.schedule_ref.id),
      this.getTradingPromotion(
        outcome.paper_comparator.trading_promotion_ref.id
      ),
      Promise.all(slotOutcomeRefs.map((ref) =>
        this.getResearchControlCampaignPaperSlotOutcome(ref.id)
      ))
    ]);
    if (!campaign || !report || !schedule || !promotion ||
      slotOutcomes.some((slotOutcome) => slotOutcome === undefined)) {
      throw new LocalStoreError(
        "research_control_campaign_outcome_reference_not_found",
        "ResearchControlCampaign outcome source evidence was not found"
      );
    }
    if (!this.researchControlCampaignOutcomeGraphMatches(
      outcome,
      campaign,
      report,
      schedule,
      promotion,
      slotOutcomes as ResearchControlCampaignPaperSlotOutcomeRecord[]
    )) {
      throw new LocalStoreError(
        "research_control_campaign_outcome_reference_mismatch",
        "ResearchControlCampaign outcome does not match frozen source evidence"
      );
    }
    const existing = await this.getResearchControlCampaignOutcome(
      outcome.research_control_campaign_outcome_id
    );
    if (existing) {
      if (!sameJson(existing, outcome)) {
        throw new LocalStoreError(
          "research_control_campaign_outcome_conflict",
          "ResearchControlCampaign outcome is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(this.itemPath(
      "research-control-campaign-outcomes",
      outcome.research_control_campaign_outcome_id
    ), outcome);
    return outcome;
  }

  async getResearchControlCampaignOutcome(
    outcomeId: string
  ): Promise<ResearchControlCampaignOutcomeRecord | undefined> {
    const outcome = await this.readOptionalRecord<unknown>(
      "research-control-campaign-outcomes",
      outcomeId
    );
    return outcome === undefined
      ? undefined
      : this.assertPersistedResearchControlCampaignOutcome(outcome);
  }

  async listResearchControlCampaignOutcomes(): Promise<
    ResearchControlCampaignOutcomeRecord[]
  > {
    return (await this.readCollection<unknown>(
      "research-control-campaign-outcomes"
    )).map((outcome) =>
      this.assertPersistedResearchControlCampaignOutcome(outcome)
    ).sort((left, right) =>
      left.adjudicated_at.localeCompare(right.adjudicated_at) ||
      left.research_control_campaign_outcome_id.localeCompare(
        right.research_control_campaign_outcome_id
      )
    );
  }

  private assertPersistedResearchControlCampaignOutcome(
    value: unknown
  ): ResearchControlCampaignOutcomeRecord {
    if (!researchControlCampaignOutcomeHasRuntimeShape(value) ||
      value.outcome_digest !== comparisonExactRecordDigest(
        researchControlCampaignOutcomeDigestInput(value)
      )) {
      throw new LocalStoreError(
        "research_control_campaign_outcome_reload_failed",
        "persisted ResearchControlCampaign outcome is unreadable or corrupt"
      );
    }
    return value;
  }

  private researchControlCampaignOutcomeGraphMatches(
    outcome: ResearchControlCampaignOutcomeRecord,
    campaign: ResearchControlCampaignRecord,
    report: ResearchControlCampaignReportRecord,
    schedule: ResearchControlCampaignPaperScheduleRecord,
    promotion: TradingPromotionRecord,
    slotOutcomes: ResearchControlCampaignPaperSlotOutcomeRecord[]
  ): boolean {
    if (campaign.paper_comparator.comparator_status !== "trading_review" ||
      campaign.paper_evaluation_protocol.protocol_status !== "bound" ||
      outcome.campaign_ref.record_kind !== "research_control_campaign" ||
      outcome.campaign_ref.id !== campaign.research_control_campaign_id ||
      outcome.campaign_digest !== campaign.campaign_digest ||
      outcome.report_ref.record_kind !== "research_control_campaign_report" ||
      outcome.report_ref.id !== report.research_control_campaign_report_id ||
      outcome.report_digest !== report.report_digest ||
      outcome.schedule_ref.record_kind !==
        "research_control_campaign_paper_schedule" ||
      outcome.schedule_ref.id !==
        schedule.research_control_campaign_paper_schedule_id ||
      outcome.schedule_digest !== schedule.schedule_digest ||
      report.campaign_ref.id !== campaign.research_control_campaign_id ||
      report.campaign_digest !== campaign.campaign_digest ||
      schedule.campaign_ref.id !== campaign.research_control_campaign_id ||
      schedule.campaign_digest !== campaign.campaign_digest ||
      schedule.report_ref.id !== report.research_control_campaign_report_id ||
      schedule.report_digest !== report.report_digest ||
      !sameJson(schedule.paper_comparator, campaign.paper_comparator) ||
      schedule.paper_evaluation_protocol_digest !==
        campaign.paper_evaluation_protocol.protocol_digest ||
      !sameJson(outcome.paper_comparator, campaign.paper_comparator) ||
      outcome.shared_evaluation_policy_status !== "bound" ||
      outcome.shared_evaluation_policy_digest !==
        campaign.paper_evaluation_protocol.protocol_digest ||
      outcome.paper_comparator.trading_promotion_ref.id !==
        promotion.trading_promotion_id ||
      outcome.paper_comparator.trading_promotion_digest !==
        comparisonExactRecordDigest(
          paperTradingComparisonTradingPromotionDigestInput(promotion)
        ) || outcome.paper_comparator.candidate_ref.id !==
        promotion.candidate_ref.id ||
      outcome.paper_comparator.candidate_version_ref.id !==
        promotion.candidate_version_ref.id ||
      outcome.paper_comparator.paper_trading_evaluation_ref.id !==
        promotion.paper_trading_evaluation_ref.id ||
      Date.parse(promotion.promoted_at) > Date.parse(campaign.committed_at) ||
      Date.parse(outcome.adjudicated_at) < Date.parse(schedule.committed_at) ||
      !this.researchControlCampaignPaperScheduleGraphMatches(
        schedule,
        campaign,
        report
      )) {
      return false;
    }
    const slotOutcomeById = new Map(slotOutcomes.map((slotOutcome) => [
      slotOutcome.research_control_campaign_paper_slot_outcome_id,
      slotOutcome
    ]));
    const candidateResultCount = outcome.arms.flatMap((arm) => arm.slot_results)
      .filter((result) => result.terminal_status !== "no_admitted_candidate")
      .length;
    if (slotOutcomeById.size !== slotOutcomes.length ||
      slotOutcomeById.size !== candidateResultCount) {
      return false;
    }
    return outcome.arms.every((outcomeArm, armIndex) => {
      const reportArm = report.arms[armIndex]!;
      const scheduleArm = schedule.arms[armIndex]!;
      return outcomeArm.arm_kind === reportArm.arm_kind &&
        outcomeArm.allocation_mode === reportArm.allocation_mode &&
        scheduleArm.arm_kind === reportArm.arm_kind &&
        outcomeArm.slot_results.length ===
          reportArm.paper_candidate_slots.length &&
        outcomeArm.slot_results.every((result, slotIndex) =>
          researchControlCampaignOutcomeSlotMatchesReport(
            result,
            reportArm.paper_candidate_slots[slotIndex]!,
            scheduleArm.slots[slotIndex]!,
            result.terminal_status === "no_admitted_candidate"
              ? undefined
              : slotOutcomeById.get(result.paper_slot_outcome_ref.id),
            schedule,
            outcomeArm.arm_kind,
            outcome.adjudicated_at
          )
        );
    });
  }

  async recordResearchDirection(
    direction: ResearchDirectionRecord
  ): Promise<ResearchDirectionRecord> {
    if (!isResearchDirectionRecord(direction)) {
      throw new LocalStoreError(
        "invalid_research_direction_input",
        "invalid ResearchDirection input"
      );
    }
    const existing = await this.getResearchDirection(direction.research_direction_id);
    if (existing) {
      if (!sameJson(existing, direction)) {
        throw new LocalStoreError(
          "research_direction_conflict",
          "ResearchDirection is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(
      this.itemPath("research-directions", direction.research_direction_id),
      direction
    );
    return direction;
  }

  async getResearchDirection(
    directionId: string
  ): Promise<ResearchDirectionRecord | undefined> {
    const direction = await this.readOptionalRecord<unknown>(
      "research-directions",
      directionId
    );
    if (direction === undefined) return undefined;
    if (!isResearchDirectionRecord(direction)) {
      throw new LocalStoreError(
        "research_direction_reload_failed",
        "persisted ResearchDirection is unreadable or corrupt"
      );
    }
    return direction;
  }

  async listResearchDirections(): Promise<ResearchDirectionRecord[]> {
    return (await this.readCollection<unknown>("research-directions"))
      .map((direction) => {
        if (!isResearchDirectionRecord(direction)) {
          throw new LocalStoreError(
            "research_direction_reload_failed",
            "persisted ResearchDirection is unreadable or corrupt"
          );
        }
        return direction;
      })
      .sort(compareResearchDirections);
  }

  async recordResearchWorker(worker: ResearchWorkerRecord): Promise<ResearchWorkerRecord> {
    if (!isResearchWorkerRecord(worker)) {
      throw new LocalStoreError(
        "invalid_research_worker_input",
        "invalid ResearchWorker input"
      );
    }
    const direction = await this.getResearchDirection(worker.research_direction_ref.id);
    if (!direction) {
      throw new LocalStoreError(
        "research_worker_reference_not_found",
        "ResearchWorker ResearchDirection was not found"
      );
    }
    if (Date.parse(worker.created_at) < Date.parse(direction.created_at)) {
      throw new LocalStoreError(
        "research_worker_reference_mismatch",
        "ResearchWorker predates its ResearchDirection"
      );
    }
    const existing = await this.getResearchWorker(worker.research_worker_id);
    if (existing) {
      if (!sameJson(existing, worker)) {
        throw new LocalStoreError(
          "research_worker_conflict",
          "ResearchWorker is append-only"
        );
      }
      return existing;
    }
    await this.writeJson(
      this.itemPath("research-workers", worker.research_worker_id),
      worker
    );
    return worker;
  }

  async getResearchWorker(
    workerId: string
  ): Promise<ResearchWorkerRecord | undefined> {
    const worker = await this.readOptionalRecord<unknown>("research-workers", workerId);
    if (worker === undefined) return undefined;
    if (!isResearchWorkerRecord(worker)) {
      throw new LocalStoreError(
        "research_worker_reload_failed",
        "persisted ResearchWorker is unreadable or corrupt"
      );
    }
    return worker;
  }

  async listResearchWorkers(): Promise<ResearchWorkerRecord[]> {
    return (await this.readCollection<unknown>("research-workers"))
      .map((worker) => {
        if (!isResearchWorkerRecord(worker)) {
          throw new LocalStoreError(
            "research_worker_reload_failed",
            "persisted ResearchWorker is unreadable or corrupt"
          );
        }
        return worker;
      })
      .sort(compareResearchWorkers);
  }

  async recordResearchPreflightCommitment(
    commitment: ResearchPreflightCommitmentRecord
  ): Promise<ResearchPreflightCommitmentRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.withResearchMemoryControlPublicationTransaction(
        () => this.recordResearchPreflightCommitmentUnlocked(commitment)
      )
    );
  }

  private async recordResearchPreflightCommitmentUnlocked(
    commitment: ResearchPreflightCommitmentRecord
  ): Promise<ResearchPreflightCommitmentRecord> {
    if (!researchPreflightCommitmentHasRuntimeShape(commitment)) {
      throw new LocalStoreError(
        "invalid_research_preflight_commitment_input",
        "invalid ResearchPreflightCommitment input"
      );
    }
    const expectedDigest = comparisonExactRecordDigest(
      researchPreflightCommitmentDigestInput(commitment)
    );
    if (commitment.commitment_digest !== expectedDigest) {
      throw new LocalStoreError(
        "research_preflight_commitment_digest_mismatch",
        "ResearchPreflightCommitment digest does not match canonical content"
      );
    }
    const existing = await this.getResearchPreflightCommitment(
      commitment.research_preflight_commitment_id
    );
    if (existing) {
      if (!sameJson(existing, commitment)) {
        throw new LocalStoreError(
          "research_preflight_commitment_conflict",
          "ResearchPreflightCommitment is append-only"
        );
      }
      return existing;
    }
    await this.assertResearchPreflightCommitmentGraph(commitment);
    const priorCommitments = (await this.readCollection<unknown>(
      "research-preflight-commitments"
    )).map((value) => this.assertPersistedResearchPreflightCommitment(value));
    const reused = priorCommitments.find((prior) =>
      prior.sealed_admission_policy.rotation_commitment_digest ===
        commitment.sealed_admission_policy.rotation_commitment_digest ||
      prior.sealed_admission_policy.suite_digest ===
        commitment.sealed_admission_policy.suite_digest
    );
    if (reused) {
      throw new LocalStoreError(
        "research_preflight_commitment_rotation_reuse",
        "sealed ResearchPreflight evaluator rotation or suite was already committed",
        {
          research_preflight_commitment_id:
            commitment.research_preflight_commitment_id,
          prior_research_preflight_commitment_id:
            reused.research_preflight_commitment_id
        }
      );
    }
    await this.writeJson(
      this.itemPath(
        "research-preflight-commitments",
        commitment.research_preflight_commitment_id
      ),
      commitment
    );
    return commitment;
  }

  async getResearchPreflightCommitment(
    commitmentId: string
  ): Promise<ResearchPreflightCommitmentRecord | undefined> {
    const value = await this.readOptionalRecord<unknown>(
      "research-preflight-commitments",
      commitmentId
    );
    if (value === undefined) return undefined;
    const commitment = this.assertPersistedResearchPreflightCommitment(value);
    await this.assertResearchPreflightCommitmentGraph(commitment);
    return commitment;
  }

  async listResearchPreflightCommitments(): Promise<
    ResearchPreflightCommitmentRecord[]
  > {
    const commitments = (await this.readCollection<unknown>(
      "research-preflight-commitments"
    )).map((value) => this.assertPersistedResearchPreflightCommitment(value));
    for (const commitment of commitments) {
      await this.assertResearchPreflightCommitmentGraph(commitment);
    }
    return commitments.sort(compareResearchPreflightCommitments);
  }

  async recordResearchWorkerCheckpoint(
    checkpoint: ResearchWorkerCheckpointRecord
  ): Promise<ResearchWorkerCheckpointRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordResearchWorkerCheckpointUnlocked(checkpoint)
    );
  }

  private async recordResearchWorkerCheckpointUnlocked(
    checkpoint: ResearchWorkerCheckpointRecord
  ): Promise<ResearchWorkerCheckpointRecord> {
    if (!researchWorkerCheckpointHasRuntimeShape(checkpoint)) {
      throw new LocalStoreError(
        "invalid_research_worker_checkpoint_input",
        "invalid ResearchWorkerCheckpoint input"
      );
    }
    const expectedDigest = comparisonExactRecordDigest(
      researchWorkerCheckpointDigestInput(checkpoint)
    );
    if (checkpoint.checkpoint_digest !== expectedDigest) {
      throw new LocalStoreError(
        "research_worker_checkpoint_digest_mismatch",
        "ResearchWorkerCheckpoint digest does not match canonical content"
      );
    }
    const checkpoints = (await this.readCollection<unknown>(
      "research-worker-checkpoints"
    )).map((value) => this.assertPersistedResearchWorkerCheckpoint(value));
    const existing = checkpoints.find((candidate) =>
      candidate.research_worker_checkpoint_id ===
        checkpoint.research_worker_checkpoint_id
    );
    if (existing) {
      if (!sameJson(existing, checkpoint)) {
        throw new LocalStoreError(
          "research_worker_checkpoint_conflict",
          "ResearchWorkerCheckpoint is append-only"
        );
      }
      await this.assertResearchWorkerCheckpointGraph(existing, checkpoints);
      return existing;
    }
    if (checkpoints.some((candidate) =>
      candidate.research_preflight_commitment_ref.id ===
        checkpoint.research_preflight_commitment_ref.id
    )) {
      throw new LocalStoreError(
        "research_worker_checkpoint_commitment_reuse",
        "one ResearchPreflightCommitment can have only one ResearchWorkerCheckpoint"
      );
    }
    await this.assertResearchWorkerCheckpointGraph(checkpoint, checkpoints);
    await this.writeJson(
      this.itemPath(
        "research-worker-checkpoints",
        checkpoint.research_worker_checkpoint_id
      ),
      checkpoint
    );
    return checkpoint;
  }

  async getResearchWorkerCheckpoint(
    checkpointId: string
  ): Promise<ResearchWorkerCheckpointRecord | undefined> {
    const value = await this.readOptionalRecord<unknown>(
      "research-worker-checkpoints",
      checkpointId
    );
    if (value === undefined) return undefined;
    const checkpoint = this.assertPersistedResearchWorkerCheckpoint(value);
    const checkpoints = (await this.readCollection<unknown>(
      "research-worker-checkpoints"
    )).map((candidate) => this.assertPersistedResearchWorkerCheckpoint(candidate));
    await this.assertResearchWorkerCheckpointGraph(checkpoint, checkpoints);
    return checkpoint;
  }

  async listResearchWorkerCheckpoints(): Promise<ResearchWorkerCheckpointRecord[]> {
    const checkpoints = (await this.readCollection<unknown>(
      "research-worker-checkpoints"
    )).map((value) => this.assertPersistedResearchWorkerCheckpoint(value));
    for (const checkpoint of checkpoints) {
      await this.assertResearchWorkerCheckpointGraph(checkpoint, checkpoints);
    }
    return checkpoints.sort(compareResearchWorkerCheckpoints);
  }

  async recordResearchBehaviorFingerprint(
    fingerprint: ResearchBehaviorFingerprintRecord
  ): Promise<ResearchBehaviorFingerprintRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordResearchBehaviorFingerprintUnlocked(fingerprint)
    );
  }

  private async recordResearchBehaviorFingerprintUnlocked(
    fingerprint: ResearchBehaviorFingerprintRecord
  ): Promise<ResearchBehaviorFingerprintRecord> {
    if (!researchBehaviorFingerprintHasRuntimeShape(fingerprint)) {
      throw new LocalStoreError(
        "invalid_research_behavior_fingerprint_input",
        "invalid ResearchBehaviorFingerprint input",
        {
          research_behavior_fingerprint_id:
            (fingerprint as Partial<ResearchBehaviorFingerprintRecord> | undefined)
              ?.research_behavior_fingerprint_id
        }
      );
    }
    const expectedDigest = comparisonExactRecordDigest(
      researchBehaviorFingerprintDigestInput(fingerprint)
    );
    if (fingerprint.fingerprint_digest !== expectedDigest) {
      throw new LocalStoreError(
        "research_behavior_fingerprint_digest_mismatch",
        "ResearchBehaviorFingerprint digest does not match canonical observations",
        {
          research_behavior_fingerprint_id:
            fingerprint.research_behavior_fingerprint_id
        }
      );
    }
    const existing = await this.readOptionalRecord<ResearchBehaviorFingerprintRecord>(
      "research-behavior-fingerprints",
      fingerprint.research_behavior_fingerprint_id
    );
    if (existing) {
      this.assertPersistedResearchBehaviorFingerprint(existing);
      await this.assertResearchBehaviorFingerprintGraph(existing);
      if (!sameJson(existing, fingerprint)) {
        throw new LocalStoreError(
          "research_behavior_fingerprint_conflict",
          "ResearchBehaviorFingerprint is append-only",
          {
            research_behavior_fingerprint_id:
              fingerprint.research_behavior_fingerprint_id
          }
        );
      }
      return existing;
    }
    await this.assertResearchBehaviorFingerprintGraph(fingerprint);
    await this.writeJson(
      this.itemPath(
        "research-behavior-fingerprints",
        fingerprint.research_behavior_fingerprint_id
      ),
      fingerprint
    );
    return fingerprint;
  }

  async getResearchBehaviorFingerprint(
    fingerprintId: string
  ): Promise<ResearchBehaviorFingerprintRecord | undefined> {
    const fingerprint = await this.readOptionalRecord<unknown>(
      "research-behavior-fingerprints",
      fingerprintId
    );
    if (fingerprint === undefined) return undefined;
    const persisted = this.assertPersistedResearchBehaviorFingerprint(fingerprint);
    await this.assertResearchBehaviorFingerprintGraph(persisted);
    return persisted;
  }

  async listResearchBehaviorFingerprints(): Promise<ResearchBehaviorFingerprintRecord[]> {
    const fingerprints = (await this.readCollection<unknown>(
      "research-behavior-fingerprints"
    )).map((fingerprint) => this.assertPersistedResearchBehaviorFingerprint(fingerprint));
    for (const fingerprint of fingerprints) {
      await this.assertResearchBehaviorFingerprintGraph(fingerprint);
    }
    return fingerprints.sort(compareResearchBehaviorFingerprints);
  }

  private assertPersistedResearchBehaviorFingerprint(
    value: unknown
  ): ResearchBehaviorFingerprintRecord {
    if (!researchBehaviorFingerprintHasRuntimeShape(value) ||
      value.fingerprint_digest !== comparisonExactRecordDigest(
        researchBehaviorFingerprintDigestInput(value)
      )) {
      throw new LocalStoreError(
        "research_behavior_fingerprint_reload_failed",
        "persisted ResearchBehaviorFingerprint is unreadable or corrupt"
      );
    }
    return value;
  }

  private async assertResearchBehaviorFingerprintGraph(
    fingerprint: ResearchBehaviorFingerprintRecord
  ): Promise<void> {
    const [commitment, systemCode] = await Promise.all([
      this.getResearchPreflightCommitment(
        fingerprint.research_preflight_commitment_ref.id
      ),
      this.getSystemCode(fingerprint.system_code_ref.id)
    ]);
    if (!commitment || !systemCode) {
      throw new LocalStoreError(
        "research_behavior_fingerprint_reference_not_found",
        "ResearchBehaviorFingerprint reference was not found",
        {
          research_behavior_fingerprint_id:
            fingerprint.research_behavior_fingerprint_id,
          missing_record_kind: !commitment
            ? "research_preflight_commitment"
            : "system_code"
        }
      );
    }
    const mismatchFields = [
      commitment.commitment_digest !==
        fingerprint.research_preflight_commitment_digest
        ? "research_preflight_commitment_digest"
        : undefined,
      commitment.development_policy.suite_version !==
        fingerprint.development_suite_version
        ? "development_suite_version"
        : undefined,
      commitment.development_policy.suite_digest !==
        fingerprint.development_suite_digest
        ? "development_suite_digest"
        : undefined,
      systemCode.artifact_digest !== fingerprint.system_code_artifact_digest
        ? "system_code_artifact_digest"
        : undefined,
      Date.parse(fingerprint.created_at) < Date.parse(commitment.committed_at)
        ? "created_at.before_commitment"
        : undefined,
      Date.parse(fingerprint.created_at) < Date.parse(systemCode.created_at)
        ? "created_at.before_system_code"
        : undefined
    ].filter((field): field is string => Boolean(field));
    if (mismatchFields.length > 0) {
      throw new LocalStoreError(
        "research_behavior_fingerprint_reference_mismatch",
        "ResearchBehaviorFingerprint does not match persisted research evidence",
        {
          research_behavior_fingerprint_id:
            fingerprint.research_behavior_fingerprint_id,
          mismatch_fields: mismatchFields
        }
      );
    }
  }

  private async assertCandidateAdmissionBehaviorComparison(input: {
    decision: CandidateAdmissionDecisionRecord;
    evaluation: TradingEvaluationResultRecord;
    behaviorFingerprint?: ResearchBehaviorFingerprintRecord;
    matchingBehaviorFingerprint?: ResearchBehaviorFingerprintRecord;
  }): Promise<void> {
    const status = input.decision.behavior_comparison_status;
    if (status === undefined || status === "unavailable") return;
    if (!input.behaviorFingerprint) {
      throw new LocalStoreError(
        "candidate_admission_behavior_comparison_mismatch",
        "candidate admission behavior fingerprint is unavailable"
      );
    }
    const commitment = await this.getResearchPreflightCommitment(
      input.behaviorFingerprint.research_preflight_commitment_ref.id
    );
    if (!commitment ||
      commitment.source_system_code_ref.id !==
        input.decision.source_system_code_ref.id ||
      commitment.source_artifact_digest !== input.decision.source_artifact_digest) {
      throw new LocalStoreError(
        "candidate_admission_behavior_comparison_mismatch",
        "candidate admission behavior does not match its ResearchPreflight source graph",
        {
          candidate_admission_decision_id:
            input.decision.candidate_admission_decision_id
        }
      );
    }
    if (input.decision.reason !== "evaluation_accepted" &&
      input.decision.reason !== "behavior_duplicate") {
      return;
    }
    if (
      input.evaluation.research_preflight_commitment_ref?.id !==
        commitment.research_preflight_commitment_id ||
      input.evaluation.research_preflight_commitment_digest !==
        commitment.commitment_digest ||
      input.evaluation.submitted_system_code_ref?.id !==
        input.behaviorFingerprint.system_code_ref.id ||
      input.evaluation.submitted_artifact_digest !==
        input.behaviorFingerprint.system_code_artifact_digest ||
      input.evaluation.sealed_admission_suite_digest !==
        commitment.sealed_admission_policy.suite_digest ||
      input.evaluation.evaluation_phase !== "sealed_admission" ||
      input.evaluation.submission_sequence !== 1) {
      throw new LocalStoreError(
        "candidate_admission_behavior_comparison_mismatch",
        "candidate admission behavior does not match its sealed ResearchPreflight graph",
        {
          candidate_admission_decision_id:
            input.decision.candidate_admission_decision_id
        }
      );
    }
    const priorAdmissions = await this.readCollection<CandidateAdmissionDecisionRecord>(
      "candidate-admission-decisions"
    );
    const admittedByFingerprintId = new Map(priorAdmissions
      .filter((admission) =>
        isCandidateAdmissionDecisionRecord(admission) &&
        admission.candidate_admission_decision_id !==
          input.decision.candidate_admission_decision_id &&
        admission.status === "admitted" &&
        admission.research_behavior_fingerprint_ref
      )
      .map((admission) => [
        admission.research_behavior_fingerprint_ref!.id,
        admission
      ]));
    if (status === "duplicate") {
      const matching = input.matchingBehaviorFingerprint;
      const matchingAdmission = matching
        ? admittedByFingerprintId.get(matching.research_behavior_fingerprint_id)
        : undefined;
      if (!matching || !matchingAdmission ||
        Date.parse(matchingAdmission.decided_at) >
          Date.parse(input.decision.decided_at) ||
        matchingAdmission.system_code_ref.id !== matching.system_code_ref.id ||
        matching.created_at > input.behaviorFingerprint.created_at ||
        !sameResearchBehaviorFingerprintKey(input.behaviorFingerprint, matching)) {
        throw new LocalStoreError(
          "candidate_admission_behavior_comparison_mismatch",
          "candidate admission duplicate does not reference an earlier admitted exact match",
          {
            candidate_admission_decision_id:
              input.decision.candidate_admission_decision_id
          }
        );
      }
      return;
    }
    for (const fingerprintId of admittedByFingerprintId.keys()) {
      const prior = await this.getResearchBehaviorFingerprint(fingerprintId);
      if (prior && sameResearchBehaviorFingerprintKey(input.behaviorFingerprint, prior)) {
        throw new LocalStoreError(
          "candidate_admission_behavior_comparison_mismatch",
          "candidate admission claimed distinct behavior already admitted by the Arena",
          {
            candidate_admission_decision_id:
              input.decision.candidate_admission_decision_id,
            prior_research_behavior_fingerprint_id:
              prior.research_behavior_fingerprint_id
          }
        );
      }
    }
  }

  private assertPersistedResearchPreflightCommitment(
    value: unknown
  ): ResearchPreflightCommitmentRecord {
    if (!researchPreflightCommitmentHasRuntimeShape(value) ||
      value.commitment_digest !== comparisonExactRecordDigest(
        researchPreflightCommitmentDigestInput(value)
      )) {
      throw new LocalStoreError(
        "research_preflight_commitment_reload_failed",
        "persisted ResearchPreflightCommitment is unreadable or corrupt"
      );
    }
    return value;
  }

  private async assertResearchPreflightCommitmentGraph(
    commitment: ResearchPreflightCommitmentRecord
  ): Promise<void> {
    const [direction, worker, allocation, sourceSystemCode] = await Promise.all([
      this.getResearchDirection(commitment.research_direction_ref.id),
      this.getResearchWorker(commitment.research_worker_ref.id),
      this.getCandidateArenaResearchAllocation(commitment.research_allocation_ref.id),
      this.getSystemCode(commitment.source_system_code_ref.id)
    ]);
    if (!direction || !worker || !allocation || !sourceSystemCode) {
      throw new LocalStoreError(
        "research_preflight_commitment_reference_not_found",
        "ResearchPreflightCommitment reference was not found",
        {
          research_preflight_commitment_id:
            commitment.research_preflight_commitment_id,
          missing_record_kind: !direction
            ? "research_direction"
            : !worker
              ? "research_worker"
              : !allocation
                ? "candidate_arena_research_allocation"
                : "system_code"
        }
      );
    }
    const memoryPrior = commitment.memory_policy?.prior_checkpoint;
    const memoryCheckpointValue = memoryPrior &&
        memoryPrior.disposition !== "none_available"
      ? await this.readOptionalRecord<unknown>(
          "research-worker-checkpoints",
          memoryPrior.checkpoint_ref.id
        )
      : undefined;
    const memoryCheckpoint = memoryCheckpointValue === undefined
      ? undefined
      : this.assertPersistedResearchWorkerCheckpoint(memoryCheckpointValue);
    if (memoryPrior && memoryPrior.disposition !== "none_available" &&
      !memoryCheckpoint) {
      throw new LocalStoreError(
        "research_preflight_commitment_memory_checkpoint_not_found",
        "ResearchPreflightCommitment memory checkpoint was not found",
        {
          research_preflight_commitment_id:
            commitment.research_preflight_commitment_id,
          research_worker_checkpoint_id: memoryPrior.checkpoint_ref.id
        }
      );
    }
    const workerCommitments = memoryPrior
      ? [
          ...(await this.readCollection<unknown>(
            "research-preflight-commitments"
          )).map((value) =>
            this.assertPersistedResearchPreflightCommitment(value)
          ).filter((candidate) =>
            candidate.research_preflight_commitment_id !==
              commitment.research_preflight_commitment_id &&
            candidate.research_worker_ref.id ===
              commitment.research_worker_ref.id
          ),
          commitment
        ].sort((left, right) =>
          left.committed_at.localeCompare(right.committed_at) ||
          left.research_preflight_commitment_id.localeCompare(
            right.research_preflight_commitment_id
          )
        )
      : [];
    const currentWorkerCommitmentIndex = workerCommitments.findIndex(
      (candidate) => candidate.research_preflight_commitment_id ===
        commitment.research_preflight_commitment_id
    );
    const expectedPriorCommitment = currentWorkerCommitmentIndex > 0
      ? workerCommitments[currentWorkerCommitmentIndex - 1]
      : undefined;
    const selection = allocation.selected_directions.find(
      (candidate) => candidate.direction_kind === direction.direction_kind
    );
    const mismatchFields = [
      worker.research_direction_ref.id !== direction.research_direction_id
        ? "research_worker.research_direction_ref"
        : undefined,
      allocation.allocation_digest !== commitment.research_allocation_digest
        ? "research_allocation.allocation_digest"
        : undefined,
      allocation.tick_id !== commitment.candidate_arena_tick_id
        ? "research_allocation.tick_id"
        : undefined,
      !selection ? "research_allocation.selected_directions" : undefined,
      selection && selection.experiment_budget !==
        commitment.development_policy.submission_limit
        ? "research_allocation.experiment_budget"
        : undefined,
      sourceSystemCode.artifact_digest !== commitment.source_artifact_digest &&
          commitment.memory_policy?.control_assignment === undefined
        ? "source_system_code.artifact_digest"
        : undefined,
      Date.parse(commitment.committed_at) < Date.parse(allocation.allocated_at)
        ? "committed_at.before_allocation"
        : undefined,
      Date.parse(commitment.committed_at) < Date.parse(direction.created_at)
        ? "committed_at.before_direction"
        : undefined,
      Date.parse(commitment.committed_at) < Date.parse(worker.created_at)
        ? "committed_at.before_worker"
        : undefined,
      Date.parse(commitment.committed_at) < Date.parse(sourceSystemCode.created_at)
        ? "committed_at.before_source_system_code"
        : undefined,
      memoryPrior && memoryPrior.disposition !== "none_available" &&
        memoryCheckpoint?.checkpoint_digest !== memoryPrior.checkpoint_digest
        ? "memory_policy.prior_checkpoint_digest"
        : undefined,
      memoryCheckpoint?.research_worker_ref.id !== undefined &&
        memoryCheckpoint.research_worker_ref.id !== worker.research_worker_id
        ? "memory_policy.prior_checkpoint_worker"
        : undefined,
      memoryCheckpoint?.research_direction_ref.id !== undefined &&
        memoryCheckpoint.research_direction_ref.id !==
          direction.research_direction_id
        ? "memory_policy.prior_checkpoint_direction"
        : undefined,
      memoryCheckpoint !== undefined && Date.parse(memoryCheckpoint.closed_at) >
        Date.parse(commitment.committed_at)
        ? "memory_policy.prior_checkpoint_closed_after_commitment"
        : undefined,
      memoryPrior && (memoryPrior.disposition === "none_available"
        ? expectedPriorCommitment !== undefined
        : expectedPriorCommitment === undefined ||
          memoryCheckpoint?.research_preflight_commitment_ref.id !==
            expectedPriorCommitment.research_preflight_commitment_id)
        ? "memory_policy.prior_checkpoint_not_immediate"
        : undefined
    ].filter((field): field is string => Boolean(field));
    if (mismatchFields.length > 0) {
      if (mismatchFields.some((field) => field.startsWith(
        "memory_policy.prior_checkpoint"
      ))) {
        throw new LocalStoreError(
          "research_preflight_commitment_memory_checkpoint_mismatch",
          "ResearchPreflightCommitment memory checkpoint does not match its worker graph",
          {
            research_preflight_commitment_id:
              commitment.research_preflight_commitment_id,
            mismatch_fields: mismatchFields
          }
        );
      }
      throw new LocalStoreError(
        "research_preflight_commitment_graph_mismatch",
        "ResearchPreflightCommitment does not match persisted research inputs",
        {
          research_preflight_commitment_id:
            commitment.research_preflight_commitment_id,
          mismatch_fields: mismatchFields
        }
      );
    }
    await this.assertResearchMemoryControlPreflightAssignment(
      commitment,
      direction,
      worker,
      allocation,
      sourceSystemCode
    );
  }

  private async assertResearchMemoryControlPreflightAssignment(
    commitment: ResearchPreflightCommitmentRecord,
    direction: ResearchDirectionRecord,
    worker: ResearchWorkerRecord,
    allocation: CandidateArenaResearchAllocationRecord,
    sourceSystemCode: SystemCodeRecord
  ): Promise<void> {
    const assignment = commitment.memory_policy?.control_assignment;
    if (!assignment) return;
    const study = await this.getResearchMemoryControlStudy(
      assignment.study_ref.id
    );
    if (!study) {
      throw new LocalStoreError(
        "research_preflight_memory_control_study_not_found",
        "ResearchPreflightCommitment memory-control study was not found"
      );
    }
    const pair = study.pair_plans[assignment.pair_index - 1];
    const arm = pair && assignment.arm_kind === "released_memory_treatment"
      ? pair.released_memory_treatment
      : pair?.memory_masked_control;
    const selection = allocation.selected_directions[0];
    const expectedProviderKind = study.research_agent.provider === "codex"
      ? "codex_cli"
      : study.research_agent.provider === "claude_code"
      ? "claude_code"
      : "fixture_only";
    const mismatchFields = [
      assignment.study_ref.record_kind !== "research_memory_control_study"
        ? "study_ref.record_kind"
        : undefined,
      assignment.study_digest !== study.study_digest
        ? "study_digest"
        : undefined,
      !pair || pair.pair_index !== assignment.pair_index
        ? "pair_index"
        : undefined,
      !arm || arm.arm_kind !== assignment.arm_kind
        ? "arm_kind"
        : undefined,
      arm && arm.memory_mode !== commitment.memory_policy?.memory_mode
        ? "memory_mode"
        : undefined,
      arm && arm.tick_id !== commitment.candidate_arena_tick_id
        ? "candidate_arena_tick_id"
        : undefined,
      pair && pair.research_direction_ref.id !== direction.research_direction_id
        ? "research_direction_ref"
        : undefined,
      pair && pair.direction_kind !== direction.direction_kind
        ? "direction_kind"
        : undefined,
      worker.agent_profile_id !== study.research_agent_profile_id
        ? "research_worker.agent_profile_id"
        : undefined,
      worker.provider_kind !== expectedProviderKind
        ? "research_worker.provider_kind"
        : undefined,
      worker.model !== study.research_agent.model
        ? "research_worker.model"
        : undefined,
      allocation.allocation_mode !== "explicit" ||
          allocation.allocation_policy_basis.basis_kind !== "explicit_request"
        ? "research_allocation.mode"
        : undefined,
      allocation.selected_directions.length !== 1 || !selection ||
          selection.direction_kind !== pair?.direction_kind ||
          selection.selection_kind !== "explicit" ||
          selection.experiment_budget !== 1
        ? "research_allocation.selection"
        : undefined,
      sourceSystemCode.system_code_id !== study.source.system_code_ref.id ||
          sourceSystemCode.artifact_digest !==
            study.source.system_code_artifact_digest
        ? "source_system_code"
        : undefined,
      commitment.source_artifact_digest !==
          study.source.research_artifact_closure_digest
        ? "source_artifact_closure"
        : undefined,
      commitment.development_policy.suite_version !==
          study.opportunity_protocol.development_suite_version ||
          commitment.development_policy.suite_digest !==
            study.opportunity_protocol.development_suite_digest
        ? "development_policy"
        : undefined,
      commitment.sealed_admission_policy.suite_version !==
          study.opportunity_protocol.sealed_suite_version ||
          commitment.sealed_admission_policy.generator_version !==
            study.opportunity_protocol.sealed_generator_version ||
          commitment.sealed_admission_policy.rotation_commitment_digest !==
            study.opportunity_protocol.sealed_rotation_commitment_digest ||
          commitment.sealed_admission_policy.suite_digest !==
            study.opportunity_protocol.sealed_suite_digest
        ? "sealed_admission_policy"
        : undefined,
      commitment.memory_policy?.available_memory_item_count === 0
        ? "memory_policy.available_memory_item_count"
        : undefined,
      Date.parse(allocation.allocated_at) <= Date.parse(study.committed_at)
        ? "allocated_at.before_study"
        : undefined,
      Date.parse(commitment.committed_at) <= Date.parse(study.committed_at)
        ? "committed_at.before_study"
        : undefined
    ].filter((field): field is string => Boolean(field));
    if (mismatchFields.length > 0) {
      throw new LocalStoreError(
        "research_preflight_memory_control_study_mismatch",
        "ResearchPreflightCommitment does not match its memory-control study",
        {
          research_preflight_commitment_id:
            commitment.research_preflight_commitment_id,
          mismatch_fields: mismatchFields
        }
      );
    }
  }

  private assertPersistedResearchWorkerCheckpoint(
    value: unknown
  ): ResearchWorkerCheckpointRecord {
    if (!researchWorkerCheckpointHasRuntimeShape(value) ||
      value.checkpoint_digest !== comparisonExactRecordDigest(
        researchWorkerCheckpointDigestInput(value)
      )) {
      throw new LocalStoreError(
        "research_worker_checkpoint_reload_failed",
        "persisted ResearchWorkerCheckpoint is unreadable or corrupt"
      );
    }
    return value;
  }

  private async assertResearchWorkerCheckpointGraph(
    checkpoint: ResearchWorkerCheckpointRecord,
    persistedCheckpoints: ResearchWorkerCheckpointRecord[]
  ): Promise<void> {
    const [worker, direction, commitment, admission, commitments] = await Promise.all([
      this.getResearchWorker(checkpoint.research_worker_ref.id),
      this.getResearchDirection(checkpoint.research_direction_ref.id),
      this.getResearchPreflightCommitment(
        checkpoint.research_preflight_commitment_ref.id
      ),
      checkpoint.candidate_admission_decision_ref
        ? this.getCandidateAdmissionDecision(
            checkpoint.candidate_admission_decision_ref.id
          )
        : Promise.resolve(undefined),
      this.listResearchPreflightCommitments()
    ]);
    if (!worker || !direction || !commitment ||
      (checkpoint.candidate_admission_decision_ref && !admission)) {
      throw new LocalStoreError(
        "research_worker_checkpoint_reference_not_found",
        "ResearchWorkerCheckpoint reference was not found",
        {
          research_worker_checkpoint_id:
            checkpoint.research_worker_checkpoint_id
        }
      );
    }
    if (worker.lifecycle_protocol !== "research_worker_checkpoint_v1" ||
      !worker.agent_profile_id || !worker.workspace_key) {
      throw new LocalStoreError(
        "research_worker_checkpoint_lifecycle_required",
        "ResearchWorker is not checkpoint-enabled",
        {
          research_worker_checkpoint_id:
            checkpoint.research_worker_checkpoint_id,
          research_worker_id: worker.research_worker_id
        }
      );
    }

    const workerCommitments = commitments
      .filter((candidate) =>
        candidate.research_worker_ref.id === worker.research_worker_id
      )
      .sort((left, right) =>
        left.committed_at.localeCompare(right.committed_at) ||
        left.research_preflight_commitment_id.localeCompare(
          right.research_preflight_commitment_id
        )
      );
    const commitmentIndex = workerCommitments.findIndex((candidate) =>
      candidate.research_preflight_commitment_id ===
        commitment.research_preflight_commitment_id
    );
    const priorCommitment = commitmentIndex > 0
      ? workerCommitments[commitmentIndex - 1]
      : undefined;
    const priorCheckpoint = priorCommitment
      ? persistedCheckpoints.find((candidate) =>
          candidate.research_worker_ref.id === worker.research_worker_id &&
          candidate.research_preflight_commitment_ref.id ===
            priorCommitment.research_preflight_commitment_id
        )
      : undefined;
    const earlierCommitmentsClosed = commitmentIndex >= 0 &&
      workerCommitments.slice(0, commitmentIndex).every((candidate) =>
        persistedCheckpoints.some((persisted) =>
          persisted.research_worker_ref.id === worker.research_worker_id &&
          persisted.research_preflight_commitment_ref.id ===
            candidate.research_preflight_commitment_id
        )
      );
    const previousMatches = priorCheckpoint
      ? checkpoint.previous_checkpoint_ref?.id ===
          priorCheckpoint.research_worker_checkpoint_id &&
        checkpoint.previous_checkpoint_digest === priorCheckpoint.checkpoint_digest
      : checkpoint.previous_checkpoint_ref === undefined &&
        checkpoint.previous_checkpoint_digest === undefined;
    if (!earlierCommitmentsClosed || !previousMatches) {
      throw new LocalStoreError(
        "research_worker_checkpoint_previous_mismatch",
        "ResearchWorkerCheckpoint does not continue the latest closed commitment",
        {
          research_worker_checkpoint_id:
            checkpoint.research_worker_checkpoint_id
        }
      );
    }

    const previousCommitted = priorCheckpoint
      ?.development_budget.cumulative_committed_submission_limit ?? 0;
    const previousRecorded = priorCheckpoint
      ?.development_budget.cumulative_recorded_submission_count ?? 0;
    if (checkpoint.development_budget.cumulative_committed_submission_limit !==
        previousCommitted + checkpoint.development_budget.submission_limit ||
      checkpoint.development_budget.cumulative_recorded_submission_count !==
        previousRecorded + checkpoint.development_budget.recorded_submission_count) {
      throw new LocalStoreError(
        "research_worker_checkpoint_budget_mismatch",
        "ResearchWorkerCheckpoint cumulative budget is not contiguous",
        {
          research_worker_checkpoint_id:
            checkpoint.research_worker_checkpoint_id
        }
      );
    }

    const firstRetainedSequence = checkpoint.notebook.total_entry_count -
      checkpoint.notebook.recent_entries.length + 1;
    const retainedPriorEntries = priorCheckpoint?.notebook.recent_entries.filter((entry) =>
      entry.sequence >= firstRetainedSequence && entry.sequence <= previousRecorded
    ) ?? [];
    const checkpointPriorEntries = checkpoint.notebook.recent_entries.filter((entry) =>
      entry.sequence <= previousRecorded
    );
    const currentEntries = checkpoint.notebook.recent_entries.filter((entry) =>
      entry.sequence > previousRecorded
    );
    const notebookContinues = sameJson(retainedPriorEntries, checkpointPriorEntries) &&
      currentEntries.length === checkpoint.development_budget.recorded_submission_count &&
      currentEntries.every((entry, index) =>
        entry.candidate_arena_tick_id === checkpoint.candidate_arena_tick_id &&
        entry.iteration === index + 1
      );
    if (!notebookContinues) {
      throw new LocalStoreError(
        "research_worker_checkpoint_notebook_mismatch",
        "ResearchWorkerCheckpoint notebook is not a sanitized contiguous tail",
        {
          research_worker_checkpoint_id:
            checkpoint.research_worker_checkpoint_id
        }
      );
    }

    const graphMismatchFields = [
      worker.research_direction_ref.id !== direction.research_direction_id
        ? "research_worker.research_direction_ref"
        : undefined,
      worker.workspace_key !== checkpoint.workspace_key
        ? "research_worker.workspace_key"
        : undefined,
      commitment.commitment_digest !==
        checkpoint.research_preflight_commitment_digest
        ? "research_preflight_commitment.commitment_digest"
        : undefined,
      commitment.research_worker_ref.id !== worker.research_worker_id
        ? "research_preflight_commitment.research_worker_ref"
        : undefined,
      commitment.research_direction_ref.id !== direction.research_direction_id
        ? "research_preflight_commitment.research_direction_ref"
        : undefined,
      commitment.candidate_arena_tick_id !== checkpoint.candidate_arena_tick_id
        ? "research_preflight_commitment.candidate_arena_tick_id"
        : undefined,
      commitment.development_policy.submission_limit !==
        checkpoint.development_budget.submission_limit
        ? "research_preflight_commitment.development_submission_limit"
        : undefined,
      Date.parse(checkpoint.closed_at) < Date.parse(commitment.committed_at)
        ? "closed_at.before_commitment"
        : undefined,
      priorCheckpoint && Date.parse(checkpoint.closed_at) <
        Date.parse(priorCheckpoint.closed_at)
        ? "closed_at.before_previous_checkpoint"
        : undefined,
      admission && admission.research_preflight_commitment_ref?.id !==
        commitment.research_preflight_commitment_id
        ? "candidate_admission_decision.research_preflight_commitment_ref"
        : undefined,
      admission && admission.research_preflight_commitment_digest !==
        commitment.commitment_digest
        ? "candidate_admission_decision.research_preflight_commitment_digest"
        : undefined,
      admission && Date.parse(checkpoint.closed_at) < Date.parse(admission.decided_at)
        ? "closed_at.before_admission"
        : undefined
    ].filter((field): field is string => Boolean(field));
    if (graphMismatchFields.length > 0) {
      throw new LocalStoreError(
        "research_worker_checkpoint_graph_mismatch",
        "ResearchWorkerCheckpoint does not match persisted lifecycle evidence",
        {
          research_worker_checkpoint_id:
            checkpoint.research_worker_checkpoint_id,
          mismatch_fields: graphMismatchFields
        }
      );
    }
  }

  async recordCandidateArenaTick(tick: CandidateArenaTickRecord): Promise<CandidateArenaTickRecord> {
    return this.withResearchMemoryControlPublicationTransaction(
      () => this.recordCandidateArenaTickUnlocked(tick)
    );
  }

  private async recordCandidateArenaTickUnlocked(
    tick: CandidateArenaTickRecord
  ): Promise<CandidateArenaTickRecord> {
    if (!isCandidateArenaTickRecord(tick)) {
      throw new LocalStoreError(
        "invalid_candidate_arena_tick_input",
        "invalid Candidate Arena tick input",
        { candidate_arena_tick_id: (tick as Partial<CandidateArenaTickRecord> | undefined)?.candidate_arena_tick_id }
      );
    }
    if (tick.research_allocation_ref && tick.research_allocation_digest) {
      const allocation = await this.getCandidateArenaResearchAllocation(
        tick.research_allocation_ref.id
      );
      if (!allocation) {
        throw new LocalStoreError(
          "candidate_arena_research_allocation_reference_not_found",
          "CandidateArena tick research allocation was not found"
        );
      }
      const selectedDirections = allocation.selected_directions.map(
        (selection) => selection.direction_kind
      );
      const resultDirections = tick.direction_results.map(
        (result) => result.direction_kind
      );
      if (tick.research_allocation_ref.record_kind !==
          "candidate_arena_research_allocation" ||
        tick.research_allocation_digest !== allocation.allocation_digest ||
        tick.tick_id !== allocation.tick_id ||
        Date.parse(tick.started_at) < Date.parse(allocation.allocated_at) ||
        !sameJson(resultDirections, selectedDirections)) {
        throw new LocalStoreError(
          "candidate_arena_research_allocation_tick_graph_mismatch",
          "CandidateArena tick does not match its research allocation"
        );
      }
    }
    await this.writeJson(this.itemPath("candidate-arena-ticks", tick.candidate_arena_tick_id), tick);
    return tick;
  }

  async listCandidateArenaTicks(): Promise<CandidateArenaTickRecord[]> {
    return (await this.readCollection<CandidateArenaTickRecord>("candidate-arena-ticks"))
      .sort(compareCandidateArenaTicks);
  }

  async recordAgentProfile(profile: AgentProfileRecord): Promise<AgentProfileRecord> {
    await this.writeJson(this.itemPath("agent-profiles", profile.agent_profile_id), profile);
    return profile;
  }

  async getAgentProfile(profileId: string): Promise<AgentProfileRecord | undefined> {
    return this.readOptionalRecord<AgentProfileRecord>("agent-profiles", profileId);
  }

  async listAgentProfiles(): Promise<AgentProfileRecord[]> {
    return (await this.readCollection<AgentProfileRecord>("agent-profiles"))
      .sort((a, b) => a.agent_profile_id.localeCompare(b.agent_profile_id));
  }

  async recordResearcherProviderSelection(
    selection: ResearcherProviderSelectionRecord
  ): Promise<ResearcherProviderSelectionRecord> {
    await this.writeJson(
      this.itemPath("researcher-provider-selections", selection.researcher_provider_selection_id),
      selection
    );
    return selection;
  }

  async getResearcherProviderSelection(): Promise<ResearcherProviderSelectionRecord | undefined> {
    return this.readOptionalRecord<ResearcherProviderSelectionRecord>("researcher-provider-selections", "researcher");
  }

  async recordTradingPromotion(promotion: TradingPromotionRecord): Promise<TradingPromotionRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordTradingPromotionUnlocked(promotion)
    );
  }

  private async recordTradingPromotionUnlocked(
    promotion: TradingPromotionRecord
  ): Promise<TradingPromotionRecord> {
    if (!paperTradingComparisonTradingPromotionHasRuntimeShape(promotion)) {
      throw new LocalStoreError(
        "invalid_trading_promotion_input",
        "invalid comparison-backed TradingPromotion input"
      );
    }
    await this.assertFrozenAuthorityWriteAllowed({
      recordKind: "trading_promotion",
      id: promotion.trading_promotion_id,
      digest: comparisonExactRecordDigest(
        paperTradingComparisonTradingPromotionDigestInput(promotion)
      )
    });
    const existing = await this.getTradingPromotion(
      promotion.trading_promotion_id
    );
    if (existing) {
      if (!sameJson(existing, promotion)) {
        throw new LocalStoreError(
          "trading_promotion_conflict",
          "TradingPromotion is append-only"
        );
      }
      await this.validateTradingPromotionGraph(existing, true);
      return existing;
    }
    await this.validateTradingPromotionGraph(promotion, false);
    await this.writeJson(this.itemPath("trading-promotions", promotion.trading_promotion_id), promotion);
    return promotion;
  }

  async getTradingPromotion(
    promotionId: string
  ): Promise<TradingPromotionRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "trading-promotions",
        promotionId
      );
      if (record === undefined) return undefined;
      if (isLegacyTradingPromotionRecord(record)) return undefined;
      this.assertPersistedTradingPromotion(record);
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "trading_promotion_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "trading_promotion_reload_failed",
        "persisted TradingPromotion is unreadable or corrupt"
      );
    }
  }

  async getLatestTradingPromotion(): Promise<TradingPromotionRecord | undefined> {
    return (await this.listTradingPromotions())
      .sort((a, b) => b.promoted_at.localeCompare(a.promoted_at))
      .at(0);
  }

  private async listTradingPromotions(): Promise<TradingPromotionRecord[]> {
    try {
      return (await this.readCollection<unknown>("trading-promotions"))
        .flatMap((record) => {
          if (isLegacyTradingPromotionRecord(record)) return [];
          this.assertPersistedTradingPromotion(record);
          return [record];
        });
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "trading_promotion_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "trading_promotion_reload_failed",
        "persisted TradingPromotion collection is unreadable or corrupt"
      );
    }
  }

  private assertPersistedTradingPromotion(
    record: unknown
  ): asserts record is TradingPromotionRecord {
    if (!paperTradingComparisonTradingPromotionHasRuntimeShape(record)) {
      throw new LocalStoreError(
        "trading_promotion_reload_failed",
        "persisted TradingPromotion is malformed or corrupt"
      );
    }
  }

  private async validateTradingPromotionGraph(
    promotion: TradingPromotionRecord,
    exactReplay: boolean
  ): Promise<void> {
    const basis = promotion.comparison_confirmation;
    const [campaign, outcome, finalVerdict] = await Promise.all([
      this.getPaperTradingComparisonConfirmationCampaign(basis.campaign_ref.id),
      this.getPaperTradingComparisonConfirmationCampaignOutcome(
        basis.campaign_outcome_ref.id
      ),
      this.getPaperTradingComparisonVerdict(basis.final_verdict_ref.id)
    ]);
    if (!campaign || !outcome || !finalVerdict) {
      throw new LocalStoreError(
        "trading_promotion_reference_not_found",
        "TradingPromotion comparison confirmation evidence was not found"
      );
    }

    const verdicts: PaperTradingComparisonVerdictRecord[] = [];
    try {
      await this.validatePaperTradingComparisonConfirmationCampaignOutcomeGraph(
        outcome
      );
      for (const result of outcome.slot_results) {
        if (!result.verdict_ref) throw new Error("missing confirmation verdict");
        const verdict = await this.getPaperTradingComparisonVerdict(
          result.verdict_ref.id
        );
        if (!verdict) throw new Error("missing confirmation verdict");
        await this.validatePaperTradingComparisonVerdictGraph(verdict);
        verdicts.push(verdict);
      }
    } catch {
      throw new LocalStoreError(
        "trading_promotion_graph_invalid",
        "TradingPromotion confirmation evidence graph is invalid"
      );
    }

    const finalResult = outcome.slot_results.at(-1);
    const validatedFinalVerdict = verdicts.at(-1);
    const graphMatches =
      basis.campaign_ref.id ===
        campaign.paper_trading_comparison_confirmation_campaign_id &&
      basis.campaign_digest === campaign.campaign_digest &&
      basis.campaign_outcome_ref.id ===
        outcome.paper_trading_comparison_confirmation_campaign_outcome_id &&
      basis.campaign_outcome_digest === outcome.outcome_digest &&
      outcome.campaign_ref.id ===
        campaign.paper_trading_comparison_confirmation_campaign_id &&
      outcome.campaign_digest === campaign.campaign_digest &&
      outcome.campaign_outcome === "confirmed_improvement" &&
      outcome.promotion_eligibility === "eligible" &&
      outcome.next_action === "review_for_trading_promotion" &&
      outcome.slot_results.length === campaign.slots.length &&
      outcome.slot_results.every((result) =>
        result.status === "challenger_improved" &&
        result.verdict_ref !== undefined &&
        result.verdict_digest !== undefined
      ) &&
      finalResult?.verdict_ref?.id === basis.final_verdict_ref.id &&
      finalResult?.verdict_digest === basis.final_verdict_digest &&
      validatedFinalVerdict?.paper_trading_comparison_verdict_id ===
        basis.final_verdict_ref.id &&
      validatedFinalVerdict?.verdict_digest === basis.final_verdict_digest &&
      validatedFinalVerdict?.paper_trading_comparison_commitment_ref.id ===
        finalResult?.paper_trading_comparison_commitment_ref.id &&
      validatedFinalVerdict?.verdict_outcome === "challenger_improved" &&
      validatedFinalVerdict?.pair_qualification.qualification_status ===
        "qualified" &&
      paperTradingComparisonRefsEqual(
        promotion.candidate_ref,
        campaign.challenger.candidate_ref
      ) &&
      paperTradingComparisonRefsEqual(
        promotion.candidate_version_ref,
        campaign.challenger.candidate_version_ref
      ) &&
      paperTradingComparisonRefsEqual(
        validatedFinalVerdict?.challenger.candidate_ref,
        campaign.challenger.candidate_ref
      ) &&
      paperTradingComparisonRefsEqual(
        validatedFinalVerdict?.challenger.candidate_version_ref,
        campaign.challenger.candidate_version_ref
      ) &&
      paperTradingComparisonRefsEqual(
        validatedFinalVerdict?.challenger.system_code_ref,
        campaign.challenger.system_code_ref
      ) &&
      validatedFinalVerdict?.challenger.system_code_artifact_digest ===
        campaign.challenger.system_code_artifact_digest &&
      paperTradingComparisonRefsEqual(
        promotion.paper_trading_evaluation_ref,
        validatedFinalVerdict?.challenger.paper_trading_evaluation_ref
      ) &&
      Date.parse(promotion.promoted_at) > Date.parse(outcome.evaluated_at) &&
      Date.parse(promotion.promoted_at) >
        Date.parse(validatedFinalVerdict?.evaluated_at ?? "");
    if (!graphMatches) {
      throw new LocalStoreError(
        "trading_promotion_graph_invalid",
        "TradingPromotion does not match exact confirmed challenger evidence"
      );
    }

    if (exactReplay) return;
    const latest = await this.getLatestTradingPromotion();
    const selection = campaign.champion_selection;
    const current = selection.selection_kind === "bootstrap"
      ? latest === undefined
      : latest !== undefined &&
        selection.trading_promotion_ref.id === latest.trading_promotion_id &&
        selection.trading_promotion_digest === comparisonExactRecordDigest(
          paperTradingComparisonTradingPromotionDigestInput(latest)
        );
    if (!current) {
      throw new LocalStoreError(
        "trading_promotion_stale_champion",
        "TradingPromotion comparison did not challenge the current champion"
      );
    }
  }

  async recordOuroborosCommand(command: OuroborosCommandRecord): Promise<OuroborosCommandRecord> {
    await this.writeJson(this.itemPath("ouroboros-commands", command.ouroboros_command_id), command);
    return command;
  }

  async listOuroborosCommands(): Promise<OuroborosCommandRecord[]> {
    return (await this.readCollection<OuroborosCommandRecord>("ouroboros-commands"))
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  }

  async recordArtifactLineage(
    lineage: ArtifactLineageRecord
  ): Promise<ArtifactLineageRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordArtifactLineageUnlocked(lineage)
    );
  }

  private async recordArtifactLineageUnlocked(
    lineage: ArtifactLineageRecord
  ): Promise<ArtifactLineageRecord> {
    if (!isArtifactLineageRecord(lineage)) {
      throw new LocalStoreError(
        "invalid_artifact_lineage_input",
        "invalid artifact change lineage input",
        {
          artifact_lineage_id: (lineage as Partial<ArtifactLineageRecord> | undefined)
            ?.artifact_lineage_id
        }
      );
    }
    await this.assertPaperTradingComparisonResearchReleaseBoundWriteAllowed(
      "artifact_lineage",
      lineage.artifact_lineage_id,
      lineage
    );
    await this.assertArtifactLineageLinks(lineage);
    await this.writeJson(this.itemPath("artifact-lineages", lineage.artifact_lineage_id), lineage);
    return lineage;
  }

  async listArtifactLineages(): Promise<ArtifactLineageRecord[]> {
    return (await this.readCollection<ArtifactLineageRecord>("artifact-lineages"))
      .sort(compareArtifactLineages);
  }

  async listArtifactLineagesForArtifact(
    systemCodeId: string
  ): Promise<ArtifactLineageRecord[]> {
    return (await this.listArtifactLineages()).filter(
      (lineage) =>
        lineage.child_system_code_ref.id === systemCodeId ||
        lineage.parent_system_code_ref?.id === systemCodeId
    );
  }

  async recordImprovementProposal(
    proposal: ImprovementProposalRecord
  ): Promise<ImprovementProposalRecord> {
    if (!isImprovementProposalRecord(proposal)) {
      throw new LocalStoreError(
        "invalid_improvement_proposal_input",
        "invalid improvement proposal input",
        {
          improvement_proposal_id: (proposal as Partial<ImprovementProposalRecord> | undefined)
            ?.improvement_proposal_id
        }
      );
    }
    await this.assertResearchFindingRefsExist(
      [...proposal.source_finding_refs, ...(proposal.anti_hacking_finding_refs ?? [])],
      proposal.improvement_proposal_id
    );
    await this.writeJson(
      this.itemPath("improvement-proposals", proposal.improvement_proposal_id),
      proposal
    );
    return proposal;
  }

  async listImprovementProposals(): Promise<ImprovementProposalRecord[]> {
    return (await this.readCollection<ImprovementProposalRecord>("improvement-proposals"))
      .sort(compareImprovementProposals);
  }

  async listImprovementProposalsForFinding(researchFindingId: string): Promise<ImprovementProposalRecord[]> {
    return (await this.listImprovementProposals()).filter((proposal) =>
      proposal.source_finding_refs.some((findingRef) => findingRef.id === researchFindingId) ||
      (proposal.anti_hacking_finding_refs ?? []).some((findingRef) => findingRef.id === researchFindingId)
    );
  }

  async recordResearchOrchestrationRun(
    run: ResearchOrchestrationRunRecord
  ): Promise<ResearchOrchestrationRunRecord> {
    if (!isResearchOrchestrationRunRecord(run)) {
      throw new LocalStoreError(
        "invalid_research_orchestration_run_input",
        "invalid automated research orchestration run input",
        {
          research_orchestration_run_id: (run as Partial<ResearchOrchestrationRunRecord> | undefined)
            ?.research_orchestration_run_id
        }
      );
    }
    await this.assertResearchFindingRefsExist(run.input_finding_refs, run.research_orchestration_run_id);
    if (run.output_artifact_proposal_ref) {
      const proposal = await this.readOptionalRecord<ImprovementProposalRecord>(
        "improvement-proposals",
        run.output_artifact_proposal_ref.id
      );
      if (!proposal) {
        throw new LocalStoreError(
          "improvement_proposal_not_found",
          `improvement proposal ${run.output_artifact_proposal_ref.id} not found`,
          {
            improvement_proposal_id: run.output_artifact_proposal_ref.id,
            research_orchestration_run_id: run.research_orchestration_run_id
          }
        );
      }
    }
    for (const lineageRef of run.input_lineage_refs ?? []) {
      const lineage = await this.readOptionalRecord<ArtifactLineageRecord>(
        "artifact-lineages",
        lineageRef.id
      );
      if (!lineage) {
        throw new LocalStoreError(
          "artifact_lineage_not_found",
          `artifact change lineage ${lineageRef.id} not found`,
          {
            artifact_lineage_id: lineageRef.id,
            research_orchestration_run_id: run.research_orchestration_run_id
          }
        );
      }
    }
    await this.writeJson(this.itemPath("research-orchestration-runs", run.research_orchestration_run_id), run);
    return run;
  }

  async listResearchOrchestrationRuns(): Promise<ResearchOrchestrationRunRecord[]> {
    return (await this.readCollection<ResearchOrchestrationRunRecord>("research-orchestration-runs"))
      .sort(compareResearchOrchestrationRuns);
  }

  async recordExperimentRun(experiment: ExperimentRunRecord): Promise<ExperimentRunRecord> {
    if (!isExperimentRunRecord(experiment)) {
      throw new LocalStoreError(
        "invalid_experiment_run_input",
        "invalid automated research experiment record",
        { experiment_run_id: (experiment as Partial<ExperimentRunRecord> | undefined)?.experiment_run_id }
      );
    }
    await this.writeJson(this.itemPath("experiment-runs", experiment.experiment_run_id), experiment);
    return experiment;
  }

  async getExperimentRun(experimentRunId: string): Promise<ExperimentRunRecord | undefined> {
    return this.readOptionalRecord<ExperimentRunRecord>("experiment-runs", experimentRunId);
  }

  async listExperimentRuns(): Promise<ExperimentRunRecord[]> {
    return (await this.readCollection<ExperimentRunRecord>("experiment-runs"))
      .sort(compareExperimentRuns);
  }

  async recordTradingEvaluationResult(
    result: TradingEvaluationResultRecord
  ): Promise<TradingEvaluationResultRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordTradingEvaluationResultUnlocked(result)
    );
  }

  private async recordTradingEvaluationResultUnlocked(
    result: TradingEvaluationResultRecord
  ): Promise<TradingEvaluationResultRecord> {
    if (!isTradingEvaluationResultRecord(result)) {
      throw new LocalStoreError(
        "invalid_trading_evaluation_result_input",
        "invalid trading evaluation result record",
        {
          trading_evaluation_result_id:
            (result as Partial<TradingEvaluationResultRecord> | undefined)?.trading_evaluation_result_id
        }
      );
    }
    if (result.research_preflight_commitment_ref) {
      const [commitment, submittedSystemCode, experiment] = await Promise.all([
        this.getResearchPreflightCommitment(
          result.research_preflight_commitment_ref.id
        ),
        this.getSystemCode(result.submitted_system_code_ref!.id),
        this.getExperimentRun(result.experiment_run_ref.id)
      ]);
      const mismatchFields = [
        !commitment ? "research_preflight_commitment_ref" : undefined,
        !submittedSystemCode ? "submitted_system_code_ref" : undefined,
        !experiment ? "experiment_run_ref" : undefined,
        commitment && commitment.commitment_digest !==
          result.research_preflight_commitment_digest
          ? "research_preflight_commitment_digest"
          : undefined,
        commitment && commitment.sealed_admission_policy.suite_digest !==
          result.sealed_admission_suite_digest
          ? "sealed_admission_suite_digest"
          : undefined,
        !Number.isInteger(result.selected_development_submission_sequence) ||
          Number(result.selected_development_submission_sequence) < 1
          ? "selected_development_submission_sequence"
          : undefined,
        commitment && Number(result.selected_development_submission_sequence) >
          commitment.development_policy.submission_limit
          ? "selected_development_submission_sequence"
          : undefined,
        submittedSystemCode && submittedSystemCode.artifact_digest !==
          result.submitted_artifact_digest
          ? "submitted_artifact_digest"
          : undefined,
        experiment && experiment.system_code_ref.id !==
          result.submitted_system_code_ref!.id
          ? "experiment_run.system_code_ref"
          : undefined,
        experiment && experiment.trading_evaluation_task_ref.id !==
          result.trading_evaluation_task_ref.id
          ? "experiment_run.trading_evaluation_task_ref"
          : undefined,
        commitment && Date.parse(result.completed_at) <
          Date.parse(commitment.committed_at)
          ? "completed_at.before_commitment"
          : undefined
      ].filter((field): field is string => Boolean(field));
      if (mismatchFields.length > 0) {
        throw new LocalStoreError(
          "research_preflight_terminal_graph_mismatch",
          "sealed ResearchPreflight evaluation does not match its frozen graph",
          {
            trading_evaluation_result_id:
              result.trading_evaluation_result_id,
            mismatch_fields: mismatchFields
          }
        );
      }
      const existing = await this.readOptionalRecord<TradingEvaluationResultRecord>(
        "trading-evaluation-results",
        result.trading_evaluation_result_id
      );
      if (existing) {
        if (sameJson(existing, result)) return existing;
        throw new LocalStoreError(
          "research_preflight_terminal_reuse",
          "sealed ResearchPreflight terminal evaluation is append-only"
        );
      }
      const priorTerminal = (await this.readCollection<TradingEvaluationResultRecord>(
        "trading-evaluation-results"
      )).find((candidate) =>
        candidate.research_preflight_commitment_ref?.id ===
          result.research_preflight_commitment_ref!.id
      );
      if (priorTerminal) {
        throw new LocalStoreError(
          "research_preflight_terminal_reuse",
          "ResearchPreflight commitment already has a terminal evaluation",
          {
            research_preflight_commitment_id:
              result.research_preflight_commitment_ref.id,
            prior_trading_evaluation_result_id:
              priorTerminal.trading_evaluation_result_id
          }
        );
      }
    }
    await this.writeJson(
      this.itemPath("trading-evaluation-results", result.trading_evaluation_result_id),
      result
    );
    return result;
  }

  async getTradingEvaluationResult(
    evaluationResultId: string
  ): Promise<TradingEvaluationResultRecord | undefined> {
    return this.readOptionalRecord<TradingEvaluationResultRecord>(
      "trading-evaluation-results",
      evaluationResultId
    );
  }

  async listTradingEvaluationResults(): Promise<TradingEvaluationResultRecord[]> {
    return (await this.readCollection<TradingEvaluationResultRecord>("trading-evaluation-results"))
      .sort(compareTradingEvaluationResults);
  }

  async listImprovementProposalMaterializationAttempts(): Promise<ImprovementProposalMaterializationAttemptRecord[]> {
    return (await this.readCollection<ImprovementProposalMaterializationAttemptRecord>(
      "improvement-proposal-materialization-attempts"
    )).sort(compareImprovementProposalMaterializationAttempts);
  }

  async materializeImprovementProposal(
    input: ImprovementProposalMaterializationInput
  ): Promise<ImprovementProposalMaterializationOutcome> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.materializeImprovementProposalUnlocked(input)
    );
  }

  private async materializeImprovementProposalUnlocked(
    input: ImprovementProposalMaterializationInput
  ): Promise<ImprovementProposalMaterializationOutcome> {
    const existing = await this.findImprovementProposalMaterializationAttemptByIdempotencyKey(
      input.idempotency_key
    );
    if (existing) {
      return this.toImprovementProposalMaterializationOutcome(existing);
    }

    const validationFailure = validateImprovementProposalMaterializationInput(input);
    if (validationFailure) {
      return this.recordImprovementProposalMaterializationFailure(input, validationFailure);
    }

    const providerResult = input.provider_result;
    const output = providerResult.output;
    const sourceFindings: ResearchFindingRecord[] = [];
    for (const findingRef of output.source_finding_refs) {
      const finding = await this.readOptionalRecord<ResearchFindingRecord>("research-findings", findingRef.id);
      if (!finding) {
        return this.recordImprovementProposalMaterializationFailure(
          input,
          "improvement_proposal_source_finding_not_found"
        );
      }
      sourceFindings.push(finding);
    }

    for (const findingRef of output.anti_hacking_finding_refs ?? []) {
      const finding = await this.readOptionalRecord<ResearchFindingRecord>("research-findings", findingRef.id);
      if (!finding) {
        return this.recordImprovementProposalMaterializationFailure(
          input,
          "improvement_proposal_source_finding_not_found"
        );
      }
    }

    const createdAt = input.created_at ?? new Date().toISOString();
    const suffix = stableSuffix(input.idempotency_key);
    const attemptId = `improvement-proposal-materialization-attempt-${suffix}`;
    const proposalRef = ref("improvement_proposal", `improvement-proposal-${suffix}`);
    const systemCodeRef = ref("system_code", `research-system-code-proposal-${suffix}`);
    const lineageRef = ref("artifact_lineage", `artifact-lineage-${suffix}`);
    const sourceFinding = sourceFindings[0];
    const artifactPath = input.artifact_path ?? "fixtures/trading-systems/clock.py";

    const attempt: ImprovementProposalMaterializationAttemptRecord = {
      record_kind: "improvement_proposal_materialization_attempt",
      version: 1,
      improvement_proposal_materialization_attempt_id: attemptId,
      idempotency_key: input.idempotency_key,
      provider: providerResult.provider,
      agent_run_ref: providerResult.agent_run_ref,
      agent_event_refs: providerResult.agent_event_refs,
      trace_ref: providerResult.trace_ref,
      provider_output_artifact_refs: providerResult.provider_output_artifact_refs,
      debug_artifact_refs: providerResult.debug_artifact_refs,
      status: "materialized",
      validation_status: "accepted",
      output_artifact_proposal_ref: proposalRef,
      output_system_code_ref: systemCodeRef,
      output_lineage_ref: lineageRef,
      created_at: createdAt,
      authority_status: "proposal_input_only"
    };
    const proposal: ImprovementProposalRecord = stripUndefined({
      record_kind: "improvement_proposal",
      version: 1,
      improvement_proposal_id: proposalRef.id,
      research_worker_ref: sourceFinding.research_worker_ref,
      research_direction_ref: sourceFinding.research_direction_ref,
      trading_evaluation_task_ref: output.trading_evaluation_task_ref,
      proposed_system_code_ref: systemCodeRef,
      parent_system_code_ref: output.parent_system_code_ref,
      source_finding_refs: output.source_finding_refs,
      anti_hacking_finding_refs: output.anti_hacking_finding_refs,
      proposal_summary: output.proposal_summary,
      requested_change_summary: output.requested_change_summary,
      expected_improvement_summary: output.expected_improvement_summary,
      created_at: createdAt,
      status: "proposed",
      authority_status: "proposal_only"
    } satisfies ImprovementProposalRecord);
    const systemCode: SystemCodeRecord = {
      record_kind: "system_code",
      version: 1,
      system_code_id: systemCodeRef.id,
      artifact_kind: "python_file",
      artifact_path: artifactPath,
      artifact_digest: `sha256:${createHash("sha256").update(input.idempotency_key).digest("hex")}`,
      runtime_kind: "python",
      entrypoint: ["python", artifactPath],
      declared_output_contract: {
        contract_kind: "opaque_runtime_boundary",
        declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "metric_snapshot"]
      },
      artifact_runtime_contract_ref: input.artifact_runtime_contract_ref,
      secret_policy_ref: input.secret_policy_ref ?? ref("secret_policy", "no-raw-secrets"),
      capability_policy_ref: input.capability_policy_ref ?? ref("capability_policy", "provider-improvement-proposal"),
      provenance_refs: [
        proposalRef,
        providerResult.agent_run_ref,
        providerResult.trace_ref,
        ...output.source_finding_refs
      ],
      status: "registered",
      created_at: createdAt,
      authority_status: "not_live"
    };
    const lineage: ArtifactLineageRecord = stripUndefined({
      record_kind: "artifact_lineage",
      version: 1,
      artifact_lineage_id: lineageRef.id,
      child_system_code_ref: systemCodeRef,
      parent_system_code_ref: output.parent_system_code_ref,
      source_finding_refs: output.source_finding_refs,
      created_by_research_worker_ref: sourceFinding.research_worker_ref,
      created_at: createdAt,
      authority_status: "lineage_only"
    } satisfies ArtifactLineageRecord);

    await this.assertExactAuthorityIdentity({
      collection: "system-codes",
      id: systemCode.system_code_id,
      recordKind: "system_code",
      next: systemCode,
      digestInput: paperTradingComparisonSystemCodeRecordDigestInput
    });
    await this.writeJson(this.itemPath("improvement-proposal-materialization-attempts", attemptId), attempt);
    await this.writeJson(this.itemPath("improvement-proposals", proposal.improvement_proposal_id), proposal);
    await this.recordSystemCodeUnlocked(systemCode);
    await this.writeJson(this.itemPath("artifact-lineages", lineage.artifact_lineage_id), lineage);

    return {
      status: "materialized",
      attempt,
      proposal,
      system_code: systemCode,
      lineage
    };
  }

  async recordImprovementProposalProviderFailure(
    input: ImprovementProposalProviderFailureInput
  ): Promise<ImprovementProposalMaterializationOutcome> {
    const existing = await this.findImprovementProposalMaterializationAttemptByIdempotencyKey(
      input.idempotency_key
    );
    if (existing) {
      return this.toImprovementProposalMaterializationOutcome(existing);
    }

    const providerResult = input.provider_result;
    const attemptId = `improvement-proposal-materialization-attempt-${stableSuffix(input.idempotency_key)}`;
    const attempt: ImprovementProposalMaterializationAttemptRecord = {
      record_kind: "improvement_proposal_materialization_attempt",
      version: 1,
      improvement_proposal_materialization_attempt_id: attemptId,
      idempotency_key: input.idempotency_key,
      provider: providerResult.provider,
      agent_run_ref: providerResult.agent_run_ref,
      agent_event_refs: providerResult.agent_event_refs,
      trace_ref: providerResult.trace_ref,
      provider_output_artifact_refs: providerResult.provider_output_artifact_refs,
      debug_artifact_refs: providerResult.debug_artifact_refs,
      status: "failed",
      validation_status: "rejected",
      failure_reason: providerResult.failure_reason,
      created_at: input.created_at ?? new Date().toISOString(),
      authority_status: "proposal_input_only"
    };

    await this.writeJson(this.itemPath("improvement-proposal-materialization-attempts", attemptId), attempt);
    return {
      status: "failed",
      attempt
    };
  }

  async listSandboxes(): Promise<SandboxReadModel[]> {
    try {
      const index = await this.readJson<SandboxIndexProjection>(
        path.join(this.storeRoot, "read-models/sandboxes/index.json")
      );
      return index.sandboxes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async getSandbox(sandboxId: string): Promise<SandboxDetailReadModel | undefined> {
    try {
      return await this.readJson<SandboxDetailReadModel>(
        path.join(this.storeRoot, "read-models/sandboxes/items", storeJsonFileName(sandboxId))
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async recordSandboxStart(
    input: SandboxObservationInput,
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<StartSandboxOutcome> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordSandboxStartUnlocked(input, authority)
    );
  }

  private async recordSandboxStartUnlocked(
    input: SandboxObservationInput,
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<StartSandboxOutcome> {
    await this.assertSandboxLinks(input.instance);
    await this.assertNoPairBoundSideMutation(
      { runId: input.instance.runtime_ref?.id },
      authority,
      authority !== undefined ? { writer: "sandbox_start", input } : undefined
    );
    await this.writeSandboxObservations(input);
    await this.rebuildProjections();

    const sandbox = await this.getSandbox(input.instance.sandbox_id);
    if (!sandbox) {
      throw new LocalStoreError(
        "sandbox_reload_failed",
        `sandbox ${input.instance.sandbox_id} was not reloaded after start`,
        { sandbox_id: input.instance.sandbox_id }
      );
    }
    return { sandbox };
  }

  async recordSandboxObservations(
    sandboxId: string,
    observations: Omit<SandboxObservationInput, "instance"> & {
      lifecycle_status?: SandboxRecord["lifecycle_status"];
      last_heartbeat_at?: string;
    },
    authority?: PaperTradingComparisonCheckpointWriteContext
  ): Promise<SandboxLogsOutcome> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordSandboxObservationsUnlocked(sandboxId, observations, authority)
    );
  }

  private async recordSandboxObservationsUnlocked(
    sandboxId: string,
    observations: Omit<SandboxObservationInput, "instance"> & {
      lifecycle_status?: SandboxRecord["lifecycle_status"];
      last_heartbeat_at?: string;
    },
    authority?: PaperTradingComparisonCheckpointWriteContext
  ): Promise<SandboxLogsOutcome> {
    const instance = await this.readOptionalRecord<SandboxRecord>(
      "sandboxes",
      sandboxId
    );
    if (!instance) {
      throw new LocalStoreError(
        "sandbox_not_found",
        `sandbox ${sandboxId} not found`,
        { sandbox_id: sandboxId }
      );
    }
    if (authority) {
      if (observations.lifecycle_status !== undefined &&
        observations.lifecycle_status !== instance.lifecycle_status ||
        observations.stopped_at !== undefined ||
        observations.removed_at !== undefined) {
        throw new LocalStoreError(
          "paper_trading_comparison_checkpoint_write_state_conflict",
          "paper comparison checkpoint evidence refresh cannot mutate sandbox lifecycle"
        );
      }
      await this.assertPaperTradingComparisonCheckpointSandboxEvidenceWriteAllowed(
        instance,
        authority
      );
    } else {
      await this.assertNoPairBoundSideMutation({ runId: instance.runtime_ref?.id });
    }

    const latestHeartbeatAt = observations.last_heartbeat_at
      ?? latestObservedAt(observations.heartbeats)
      ?? instance.last_heartbeat_at;
    const updatedInstance: SandboxRecord = stripUndefined({
      ...instance,
      lifecycle_status: observations.lifecycle_status ?? instance.lifecycle_status,
      log_refs: appendUniqueRefs(instance.log_refs, refsForLogs(observations.logs)),
      heartbeat_refs: appendUniqueRefs(instance.heartbeat_refs, refsForHeartbeats(observations.heartbeats)),
      command_evidence_refs: appendUniqueRefs(
        instance.command_evidence_refs,
        refsForCommandEvidence(observations.command_evidence)
      ),
      last_heartbeat_at: latestHeartbeatAt
    } satisfies SandboxRecord);

    await this.writeSandboxObservations({
      ...observations,
      instance: updatedInstance
    });
    await this.rebuildProjections();

    const sandbox = await this.getSandbox(sandboxId);
    if (!sandbox) {
      throw new LocalStoreError(
        "sandbox_reload_failed",
        `sandbox ${sandboxId} was not reloaded after observations`,
        { sandbox_id: sandboxId }
      );
    }
    return {
      sandbox,
      logs: sandbox.logs,
      heartbeats: sandbox.heartbeats,
      command_evidence: sandbox.command_evidence
    };
  }

  private async assertPaperTradingComparisonCheckpointSandboxEvidenceWriteAllowed(
    sandbox: SandboxRecord,
    authority: PaperTradingComparisonCheckpointWriteContext
  ): Promise<void> {
    if (!paperTradingComparisonCheckpointWriteContextHasRuntimeShape(authority) ||
      authority.operation !== "refresh_sandbox_evidence") {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_checkpoint_write_context",
        "paper comparison sandbox evidence refresh requires one valid checkpoint context"
      );
    }

    let activation: PaperTradingComparisonActivationRecord | undefined;
    let activationAttempt: PaperTradingComparisonActivationAttemptRecord | undefined;
    let activationOutcome: PaperTradingComparisonActivationOutcomeRecord | undefined;
    let checkpointAttempt: PaperTradingComparisonCheckpointAttemptRecord | undefined;
    try {
      [activation, activationAttempt, activationOutcome, checkpointAttempt] = await Promise.all([
        this.getPaperTradingComparisonActivation(
          authority.paper_trading_comparison_activation_ref.id
        ),
        this.getPaperTradingComparisonActivationAttempt(
          authority.paper_trading_comparison_activation_attempt_ref.id
        ),
        this.getPaperTradingComparisonActivationOutcome(authority.activation_outcome_ref.id),
        this.getPaperTradingComparisonCheckpointAttempt(authority.checkpoint_attempt_ref.id)
      ]);
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_write_state_conflict",
        "paper comparison checkpoint write graph is unreadable"
      );
    }
    if (!activation || !activationAttempt || !activationOutcome || !checkpointAttempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_write_context_reference_not_found",
        "paper comparison checkpoint write context evidence was not found"
      );
    }

    const checkpointSide = checkpointAttempt[authority.role];
    if (
      activation.paper_trading_comparison_activation_id !==
        authority.paper_trading_comparison_activation_ref.id ||
      activation.activation_digest !==
        authority.paper_trading_comparison_activation_digest ||
      activationAttempt.paper_trading_comparison_activation_attempt_id !==
        authority.paper_trading_comparison_activation_attempt_ref.id ||
      activationAttempt.attempt_digest !==
        authority.paper_trading_comparison_activation_attempt_digest ||
      !paperTradingComparisonRefsEqual(
        activationAttempt.paper_trading_comparison_activation_ref,
        authority.paper_trading_comparison_activation_ref
      ) ||
      activationAttempt.paper_trading_comparison_activation_digest !==
        authority.paper_trading_comparison_activation_digest ||
      activationOutcome.paper_trading_comparison_activation_outcome_id !==
        authority.activation_outcome_ref.id ||
      activationOutcome.outcome_digest !== authority.activation_outcome_digest ||
      !paperTradingComparisonRefsEqual(
        activationOutcome.paper_trading_comparison_activation_attempt_ref,
        authority.paper_trading_comparison_activation_attempt_ref
      ) ||
      activationOutcome.paper_trading_comparison_activation_attempt_digest !==
        authority.paper_trading_comparison_activation_attempt_digest ||
      checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id !==
        authority.checkpoint_attempt_ref.id ||
      checkpointAttempt.attempt_digest !== authority.checkpoint_attempt_digest ||
      !paperTradingComparisonRefsEqual(
        checkpointAttempt.paper_trading_comparison_activation_ref,
        authority.paper_trading_comparison_activation_ref
      ) ||
      checkpointAttempt.paper_trading_comparison_activation_digest !==
        authority.paper_trading_comparison_activation_digest ||
      !paperTradingComparisonRefsEqual(
        checkpointAttempt.paper_trading_comparison_activation_attempt_ref,
        authority.paper_trading_comparison_activation_attempt_ref
      ) ||
      checkpointAttempt.paper_trading_comparison_activation_attempt_digest !==
        authority.paper_trading_comparison_activation_attempt_digest ||
      !paperTradingComparisonRefsEqual(
        checkpointAttempt.activation_outcome_ref,
        authority.activation_outcome_ref
      ) ||
      checkpointAttempt.activation_outcome_digest !== authority.activation_outcome_digest ||
      checkpointSide.role !== authority.role ||
      !paperTradingComparisonRefsEqual(sandbox.runtime_ref, checkpointSide.trading_run_ref)
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_write_context_reference_mismatch",
        "paper comparison checkpoint write context does not match the sandbox side"
      );
    }

    let closure: Awaited<ReturnType<
      LocalStore["loadPaperTradingComparisonActivationAttemptClosure"]
    >>;
    let state: PaperTradingComparisonRuntimeSideState;
    let activationAttempts: PaperTradingComparisonActivationAttemptRecord[];
    let activationOutcomes: PaperTradingComparisonActivationOutcomeRecord[];
    let checkpointAttempts: PaperTradingComparisonCheckpointAttemptRecord[];
    let checkpointOutcomes: PaperTradingComparisonCheckpointOutcomeRecord[];
    let observations: PaperTradingObservationRecord[];
    try {
      closure = await this.loadPaperTradingComparisonActivationAttemptClosure(
        activationAttempt
      );
      [state, activationAttempts, activationOutcomes, checkpointAttempts, checkpointOutcomes,
        observations] =
        await Promise.all([
          this.loadPaperTradingComparisonRuntimeSideState(
            activationAttempt,
            authority.role,
            closure.comparison,
            "paper_trading_comparison_checkpoint_write_state_conflict",
            { allowCommittedCheckpoint: true }
          ),
          this.listPaperTradingComparisonActivationAttempts(
            activation.paper_trading_comparison_activation_id
          ),
          this.listPaperTradingComparisonActivationOutcomes(
            activationAttempt.paper_trading_comparison_activation_attempt_id
          ),
          this.listPaperTradingComparisonCheckpointAttempts(
            activationAttempt.paper_trading_comparison_activation_attempt_id
          ),
          this.listPaperTradingComparisonCheckpointOutcomes(
            checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
          ),
          this.listPaperTradingObservations(
            checkpointSide.paper_trading_evaluation_ref.id
          )
        ]);
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_write_state_conflict",
        "paper comparison checkpoint write graph is not open and consistent"
      );
    }
    if (
      activationAttempts.at(-1)?.paper_trading_comparison_activation_attempt_id !==
        activationAttempt.paper_trading_comparison_activation_attempt_id ||
      activationOutcomes.at(-1)?.paper_trading_comparison_activation_outcome_id !==
        activationOutcome.paper_trading_comparison_activation_outcome_id ||
      activationOutcome.outcome_status !== "both_running" ||
      checkpointAttempts.at(-1)?.paper_trading_comparison_checkpoint_attempt_id !==
        checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id ||
      checkpointAttempts.length !== checkpointAttempt.checkpoint_sequence ||
      checkpointOutcomes.length !== 0 ||
      state.run.runtime_lifecycle_status !== "running" ||
      state.evaluation.status !== "running" ||
      state.sandbox?.sandbox_id !== sandbox.sandbox_id ||
      state.sandbox.lifecycle_status !== "running" ||
      checkpointSide.evaluation_record_digest !== comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(state.evaluation)
      ) ||
      observations.length !== checkpointAttempt.checkpoint_sequence - 1 ||
      observations.some((observation, index) => observation.sequence !== index + 1) ||
      checkpointSide.observation_chain_digest !== comparisonExactRecordDigest(
        paperTradingComparisonObservationChainDigestInput(observations)
      )
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_write_state_conflict",
        "paper comparison checkpoint sandbox evidence refresh is no longer open"
      );
    }
  }

  async stopSandbox(
    input: StopSandboxInput,
    observations: Omit<SandboxObservationInput, "instance"> = {},
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<StartSandboxOutcome> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.stopSandboxUnlocked(input, observations, authority)
    );
  }

  private async stopSandboxUnlocked(
    input: StopSandboxInput,
    observations: Omit<SandboxObservationInput, "instance"> = {},
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<StartSandboxOutcome> {
    const instance = await this.readOptionalRecord<SandboxRecord>(
      "sandboxes",
      input.sandbox_id
    );
    if (!instance) {
      throw new LocalStoreError(
        "sandbox_not_found",
        `sandbox ${input.sandbox_id} not found`,
        { sandbox_id: input.sandbox_id }
      );
    }
    const observedLifecycleStatus = observations.lifecycle_status;
    const lifecycleStatus = instance.lifecycle_status === "removed" || input.removed_at
      ? "removed"
      : observedLifecycleStatus ?? "stopped";
    const stoppedAt = lifecycleStatus === "stopped" || lifecycleStatus === "removed"
      ? instance.stopped_at ?? observations.stopped_at ?? input.stopped_at ?? new Date().toISOString()
      : instance.stopped_at ?? observations.stopped_at ?? input.stopped_at;
    const updatedInstance: SandboxRecord = stripUndefined({
      ...instance,
      lifecycle_status: lifecycleStatus,
      stopped_at: stoppedAt,
      removed_at: input.removed_at ?? instance.removed_at,
      log_refs: appendUniqueRefs(instance.log_refs, refsForLogs(observations.logs)),
      heartbeat_refs: appendUniqueRefs(instance.heartbeat_refs, refsForHeartbeats(observations.heartbeats)),
      command_evidence_refs: appendUniqueRefs(
        instance.command_evidence_refs,
        refsForCommandEvidence(observations.command_evidence)
      ),
      last_heartbeat_at: latestObservedAt(observations.heartbeats) ?? instance.last_heartbeat_at
    } satisfies SandboxRecord);

    await this.assertNoPairBoundSideMutation(
      { runId: instance.runtime_ref?.id },
      authority,
      authority !== undefined
        ? { writer: "sandbox_stop", sandbox: updatedInstance, observations }
        : undefined
    );

    await this.writeSandboxObservations({
      ...observations,
      instance: updatedInstance
    });
    await this.rebuildProjections();

    const sandbox = await this.getSandbox(input.sandbox_id);
    if (!sandbox) {
      throw new LocalStoreError(
        "sandbox_reload_failed",
        `sandbox ${input.sandbox_id} was not reloaded after stop`,
        { sandbox_id: input.sandbox_id }
      );
    }
    return { sandbox };
  }

  async listCandidateEvaluationRuns(candidateId: string): Promise<CandidateEvaluationRunOutcome[]> {
    const evaluationRuns = await this.readCollection<EvaluationRunRecord>("evaluation-runs");
    const replayRuns = evaluationRuns
      .filter((run) => run.candidate_ref.id === candidateId)
      .sort(compareEvaluationRuns);

    return Promise.all(
      replayRuns.map((evaluationRun) => this.toCandidateEvaluationRunOutcome(evaluationRun))
    );
  }

  async createEvaluationRunForCandidate(
    input: CandidateEvaluationRunInput
  ): Promise<CandidateEvaluationRunOutcome> {
    const validationFailure = validateCandidateEvaluationRunInput(input);
    if (validationFailure) {
      throw new LocalStoreError(validationFailure, "invalid candidate evaluation run input");
    }

    const stage = input.stage ?? "backtest";
    if (stage !== "backtest") {
      throw new LocalStoreError(
        "unsupported_evaluation_stage",
        `unsupported evaluation stage ${String(stage)}`,
        { stage }
      );
    }

    const candidate = await this.readOptionalRecord<TradingSystemCandidateRecord>(
      "candidates",
      input.candidate_id
    );
    if (!candidate) {
      throw new LocalStoreError(
        "candidate_not_found",
        `candidate ${input.candidate_id} not found`,
        { candidate_id: input.candidate_id }
      );
    }

    const candidateVersionId = input.candidate_version_id ?? candidate.active_version_id;
    const candidateVersion = await this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidateVersionId
    );
    if (!candidateVersion) {
      throw new LocalStoreError(
        "candidate_version_not_found",
        `candidate version ${candidateVersionId} not found`,
        { candidate_id: candidate.candidate_id, candidate_version_id: candidateVersionId }
      );
    }
    if (candidateVersion.candidate_id !== candidate.candidate_id) {
      throw new LocalStoreError(
        "candidate_version_mismatch",
        `candidate version ${candidateVersionId} does not belong to candidate ${candidate.candidate_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersionId,
          actual_candidate_id: candidateVersion.candidate_id
        }
      );
    }

    const evaluationRunId = candidateEvaluationRunRecordId({
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidateVersionId,
      idempotency_key: input.idempotency_key
    });
    const suffix = evaluationRunId.replace(/^evaluation-run-/, "");
    const existing = await this.getCandidateEvaluationRun(evaluationRunId);
    if (existing) {
      return existing;
    }

    const traceRef = input.trace_ref ?? ref("trace_placeholder", `evaluation-trace-${suffix}`);
    const createdAt = new Date().toISOString();
    const stageBindingId = `stage-binding-backtest-${suffix}`;
    const comparisonSetId = `evaluation-comparison-set-${suffix}`;
    const sealingDecisionId = `evidence-sealing-decision-${suffix}`;
    const hasProviderOutput = (input.provider_output_artifact_refs?.length ?? 0) > 0;
    const unsealedReason = hasProviderOutput || input.evaluator_ref
      ? "provider_output_trace_only"
      : "no_external_evaluator";

    const trace: TracePlaceholderRecord = stripUndefined({
      record_kind: "trace_placeholder",
      version: 1,
      trace_id: traceRef.id,
      input_artifact_refs: input.input_artifact_refs,
      provider_output_artifact_refs: input.provider_output_artifact_refs,
      debug_artifact_refs: input.debug_artifact_refs,
      captured_at: createdAt,
      authority_label: "provider_output_not_evidence",
      authority_status: "not_counted"
    } satisfies TracePlaceholderRecord);
    const stageBinding: StageBindingRecord = {
      record_kind: "stage_binding",
      version: 1,
      stage_binding_id: stageBindingId,
      candidate_ref: ref("trading_system_candidate", candidate.candidate_id),
      candidate_version_ref: ref("candidate_version", candidateVersion.candidate_version_id),
      stage: "backtest",
      profile: "backtest",
      execution_mode: input.execution_mode ?? "host_local",
      created_at: createdAt,
      authority_status: "not_live"
    };
    const evaluationRun: EvaluationRunRecord = stripUndefined({
      record_kind: "evaluation_run_record",
      version: 1,
      evaluation_run_record_id: evaluationRunId,
      candidate_ref: ref("trading_system_candidate", candidate.candidate_id),
      candidate_version_ref: ref("candidate_version", candidateVersion.candidate_version_id),
      stage_binding_ref: ref("stage_binding", stageBinding.stage_binding_id),
      trace_ref: traceRef,
      evaluator_ref: input.evaluator_ref,
      status: "created",
      created_at: createdAt,
      authority_status: "not_counted"
    } satisfies EvaluationRunRecord);
    const comparisonSet: EvaluationComparisonSetRecord = {
      record_kind: "evaluation_comparison_set",
      version: 1,
      evaluation_comparison_set_id: comparisonSetId,
      candidate_ref: ref("trading_system_candidate", candidate.candidate_id),
      candidate_version_ref: ref("candidate_version", candidateVersion.candidate_version_id),
      stage_binding_ref: ref("stage_binding", stageBinding.stage_binding_id),
      evaluation_run_refs: [ref("evaluation_run_record", evaluationRun.evaluation_run_record_id)],
      comparability_status: "not_evaluated",
      comparability_reason: unsealedReason,
      created_at: createdAt,
      authority_status: "not_counted"
    };
    const sealingDecision: EvidenceSealingDecisionRecord = {
      record_kind: "evidence_sealing_decision",
      version: 1,
      evidence_sealing_decision_id: sealingDecisionId,
      evaluation_comparison_set_ref: ref(
        "evaluation_comparison_set",
        comparisonSet.evaluation_comparison_set_id
      ),
      evaluation_run_refs: [ref("evaluation_run_record", evaluationRun.evaluation_run_record_id)],
      evidence_disposition: "not_counted",
      disposition_reason: unsealedReason,
      created_at: createdAt,
      authority_status: "not_counted"
    };
    const evidenceClassifications = defaultEvidenceClassificationRecords({
      candidateRef: evaluationRun.candidate_ref,
      candidateVersionRef: evaluationRun.candidate_version_ref,
      evaluationRunRef: ref("evaluation_run_record", evaluationRun.evaluation_run_record_id),
      traceRef: evaluationRun.trace_ref,
      sealingDecisionRef: ref("evidence_sealing_decision", sealingDecision.evidence_sealing_decision_id),
      reason: unsealedReason,
      createdAt
    });

    const records: FixtureItem[] = [
      { collection: "traces", id: trace.trace_id, itemDir: "placeholders", record: trace },
      { collection: "stage-bindings", id: stageBinding.stage_binding_id, record: stageBinding },
      { collection: "evaluation-runs", id: evaluationRun.evaluation_run_record_id, record: evaluationRun },
      {
        collection: "evaluation-comparison-sets",
        id: comparisonSet.evaluation_comparison_set_id,
        record: comparisonSet
      },
      {
        collection: "evidence-sealing-decisions",
        id: sealingDecision.evidence_sealing_decision_id,
        record: sealingDecision
      },
      ...evidenceClassifications.map((classification) => ({
        collection: "evidence-classifications" as const,
        id: classification.evidence_classification_id,
        record: classification
      }))
    ];

    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const outcome = await this.getCandidateEvaluationRun(evaluationRun.evaluation_run_record_id);
    if (!outcome) {
      throw new LocalStoreError(
        "evaluation_run_reload_failed",
        `evaluation run ${evaluationRun.evaluation_run_record_id} was not reloaded after write`,
        { evaluation_run_record_id: evaluationRun.evaluation_run_record_id }
      );
    }
    return outcome;
  }

  async sealEvaluationRunEvidence(
    input: EvidenceSealingDecisionInput
  ): Promise<CandidateEvaluationRunOutcome> {
    const validationFailure = validateEvidenceSealingDecisionInput(input);
    if (validationFailure) {
      throw new LocalStoreError(validationFailure, "invalid evidence sealing input");
    }

    const evaluationRun = await this.readOptionalRecord<EvaluationRunRecord>(
      "evaluation-runs",
      input.evaluation_run_record_id
    );
    if (!evaluationRun) {
      throw new LocalStoreError(
        "evaluation_run_not_found",
        `evaluation run ${input.evaluation_run_record_id} not found`,
        { evaluation_run_record_id: input.evaluation_run_record_id }
      );
    }

    const comparisonSet = await this.findEvaluationComparisonSetForRun(
      evaluationRun.evaluation_run_record_id
    );
    if (!comparisonSet) {
      throw new LocalStoreError(
        "evaluation_run_incomplete",
        `evaluation run ${evaluationRun.evaluation_run_record_id} has no comparison set`,
        { evaluation_run_record_id: evaluationRun.evaluation_run_record_id }
      );
    }

    const sealingDecisionId = evidenceSealingDecisionRecordId({
      evaluation_run_record_id: evaluationRun.evaluation_run_record_id,
      idempotency_key: input.idempotency_key
    });
    const existing = await this.readOptionalRecord<EvidenceSealingDecisionRecord>(
      "evidence-sealing-decisions",
      sealingDecisionId
    );
    if (existing) {
      const existingOutcome = await this.getCandidateEvaluationRun(
        evaluationRun.evaluation_run_record_id
      );
      if (!existingOutcome) {
        throw new LocalStoreError(
          "evaluation_run_reload_failed",
          `evaluation run ${evaluationRun.evaluation_run_record_id} was not reloaded after sealing`,
          { evaluation_run_record_id: evaluationRun.evaluation_run_record_id }
        );
      }
      return existingOutcome;
    }

    const createdAt = new Date().toISOString();
    const sealedAt = input.sealed_at ?? createdAt;
    const sealingDecision = evidenceSealingDecisionRecord({
      evidenceSealingDecisionId: sealingDecisionId,
      comparisonSetRef: ref(
        "evaluation_comparison_set",
        comparisonSet.evaluation_comparison_set_id
      ),
      evaluationRunRef: ref("evaluation_run_record", evaluationRun.evaluation_run_record_id),
      evidenceDisposition: input.evidence_disposition,
      dispositionReason: input.disposition_reason,
      createdAt,
      sealedAt
    });
    const classifiedRefs = input.classified_refs?.length
      ? input.classified_refs
      : [evaluationRun.trace_ref];
    const evidenceClassifications = sealedEvidenceClassificationRecords({
      candidateRef: evaluationRun.candidate_ref,
      candidateVersionRef: evaluationRun.candidate_version_ref,
      evaluationRunRef: ref("evaluation_run_record", evaluationRun.evaluation_run_record_id),
      sealingDecisionRef: ref("evidence_sealing_decision", sealingDecision.evidence_sealing_decision_id),
      evidenceDisposition: sealingDecision.evidence_disposition,
      reason: sealingDecision.disposition_reason,
      classifiedRefs,
      createdAt
    });

    const records: FixtureItem[] = [
      {
        collection: "evidence-sealing-decisions",
        id: sealingDecision.evidence_sealing_decision_id,
        record: sealingDecision
      },
      ...evidenceClassifications.map((classification) => ({
        collection: "evidence-classifications" as const,
        id: classification.evidence_classification_id,
        record: classification
      }))
    ];
    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const outcome = await this.getCandidateEvaluationRun(evaluationRun.evaluation_run_record_id);
    if (!outcome) {
      throw new LocalStoreError(
        "evaluation_run_reload_failed",
        `evaluation run ${evaluationRun.evaluation_run_record_id} was not reloaded after sealing`,
        { evaluation_run_record_id: evaluationRun.evaluation_run_record_id }
      );
    }
    return outcome;
  }

  async recordLedger(
    input: LedgerInput
  ): Promise<LedgerWriteOutcome> {
    return this.withComparisonEvidenceWriteTransaction(() => this.recordLedgerUnlocked(input));
  }

  async previewLedger(input: LedgerInput): Promise<LedgerWriteOutcome> {
    return this.withComparisonEvidenceWriteTransaction(async () =>
      (await this.buildLedgerWritePlan(input)).outcome
    );
  }

  private async recordLedgerUnlocked(
    input: LedgerInput
  ): Promise<LedgerWriteOutcome> {
    const plan = await this.buildLedgerWritePlan(input);
    if (plan.existing) return plan.outcome;
    await this.assertNoPairBoundSideMutation({ runId: plan.outcome.runtime_id });
    for (const item of plan.immutableRecords) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();
    const recordIds = ledgerRecordIds({
      candidate_id: plan.outcome.candidate_id,
      candidate_version_id: plan.outcome.candidate_version_id,
      runtime_id: plan.outcome.runtime_id,
      idempotency_key: input.idempotency_key
    });
    const outcome = await this.readLedgerWriteOutcome(
      plan.outcome.candidate_id,
      plan.outcome.candidate_version_id,
      plan.outcome.runtime_id,
      recordIds
    );
    if (!outcome) {
      throw new LocalStoreError(
        "ledger_reload_failed",
        "ledger records were not reloaded after write",
        { runtime_id: plan.outcome.runtime_id }
      );
    }
    return outcome;
  }

  private async buildLedgerWritePlan(
    input: LedgerInput,
    options: {
      runtime?: TradingRunRecord;
      stageBinding?: StageBindingRecord;
    } = {}
  ): Promise<LocalLedgerWritePlan> {
    const validationFailure = validateLedgerInput(input);
    if (validationFailure) {
      throw new LocalStoreError(validationFailure, "invalid ledger input");
    }

    const candidate = await this.readOptionalRecord<TradingSystemCandidateRecord>(
      "candidates",
      input.candidate_id
    );
    if (!candidate) {
      throw new LocalStoreError(
        "candidate_not_found",
        `candidate ${input.candidate_id} not found`,
        { candidate_id: input.candidate_id }
      );
    }

    const candidateVersionId = input.candidate_version_id ?? candidate.active_version_id;
    const candidateVersion = await this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidateVersionId
    );
    if (!candidateVersion) {
      throw new LocalStoreError(
        "candidate_version_not_found",
        `candidate version ${candidateVersionId} not found`,
        { candidate_id: candidate.candidate_id, candidate_version_id: candidateVersionId }
      );
    }
    if (candidateVersion.candidate_id !== candidate.candidate_id) {
      throw new LocalStoreError(
        "candidate_version_mismatch",
        `candidate version ${candidateVersionId} does not belong to candidate ${candidate.candidate_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersionId,
          actual_candidate_id: candidateVersion.candidate_id
        }
      );
    }

    const runtimeId = input.runtime_id ?? candidateVersion.runtime_ref.id;
    const runtime = options.runtime ?? await this.readOptionalRecord<TradingRunRecord>(
      "trading-runs", runtimeId
    );
    if (!runtime) {
      throw new LocalStoreError(
        "runtime_not_found",
        `runtime ${runtimeId} not found`,
        { runtime_id: runtimeId }
      );
    }
    if (!tradingRunOwnsCandidateVersion(runtime, candidate, candidateVersion)) {
      throw new LocalStoreError(
        "runtime_mismatch",
        `runtime ${runtime.trading_run_id} is not bound to candidate version ${candidateVersion.candidate_version_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersion.candidate_version_id,
          candidate_version_runtime_id: candidateVersion.runtime_ref.id,
          runtime_id: runtime.trading_run_id
        }
      );
    }

    const recordIds = ledgerRecordIds({
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidateVersion.candidate_version_id,
      runtime_id: runtime.trading_run_id,
      idempotency_key: input.idempotency_key
    });
    const existing = await this.readLedgerWriteOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_run_id,
      recordIds
    );
    if (existing) {
      return {
        outcome: existing,
        previousRuntime: runtime,
        updatedRuntime: runtime,
        immutableRecords: [],
        existing: true
      };
    }

    const createdAt = input.created_at ?? new Date().toISOString();
    const orderIntentRef = ref("order_request", recordIds.orderIntent);
    const gatewayDecisionRef = ref("gateway_result", recordIds.gatewayDecision);
    const executionAttemptRef = ref("execution_result", recordIds.executionAttempt);
    const runtimeRef = ref("trading_run", runtime.trading_run_id);
    const candidateRef = ref("trading_system_candidate", candidate.candidate_id);
    const candidateVersionRef = ref("candidate_version", candidateVersion.candidate_version_id);
    const stageBindingId = runtime.stage_binding_ref?.id
      ?? `stage-binding-paper-${stableSuffix(runtime.trading_run_id)}`;
    const stageBindingRef = ref("stage_binding", stageBindingId);
    const existingStageBinding = options.stageBinding ??
      await this.readOptionalRecord<StageBindingRecord>("stage-bindings", stageBindingId);

    const orderIntent: OrderRequestRecord = stripUndefined({
      record_kind: "order_request",
      version: 1,
      order_request_id: recordIds.orderIntent,
      runtime_ref: runtimeRef,
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      stage_binding_ref: stageBindingRef,
      trace_ref: input.execution_result?.trace_ref ?? runtime.trace_ref,
      intent_kind: input.intent.intent_kind,
      market_scope: "external_trading_api_fixture",
      side: input.intent.side,
      order_type: input.intent.order_type,
      quantity: input.intent.quantity,
      limit_price: input.intent.limit_price,
      status: "proposed",
      created_at: createdAt,
      authority_status: "not_submitted"
    } satisfies OrderRequestRecord);
    const gatewayDecisionAuthorityStatus = gatewayDecisionAuthorityStatusForOutcome(
      input.gateway_result.decision_outcome
    );
    const gatewayDecision: GatewayResultRecord = stripUndefined({
      record_kind: "gateway_result",
      version: 1,
      gateway_result_id: recordIds.gatewayDecision,
      runtime_ref: runtimeRef,
      order_request_ref: orderIntentRef,
      decision_outcome: input.gateway_result.decision_outcome,
      decision_reason: input.gateway_result.decision_reason,
      decided_at: createdAt,
      policy_ref: input.gateway_result.policy_ref,
      authority_status: gatewayDecisionAuthorityStatus
    } satisfies GatewayResultRecord);
    const executionAttemptStatus = input.execution_result?.status
      ?? executionAttemptStatusForDecision(input.gateway_result.decision_outcome);
    const executionAttemptAuthorityStatus = executionAttemptAuthorityStatusForStatus(
      executionAttemptStatus,
      input.gateway_result.decision_outcome
    );
    const executionAttempt: ExecutionResultRecord = stripUndefined({
      record_kind: "execution_result",
      version: 1,
      execution_result_id: recordIds.executionAttempt,
      runtime_ref: runtimeRef,
      order_request_ref: orderIntentRef,
      gateway_result_ref: gatewayDecisionRef,
      stage: "paper",
      execution_mode: input.execution_result?.execution_mode ?? "host_local",
      venue_scope: "external_trading_api_fixture",
      trace_ref: input.execution_result?.trace_ref ?? runtime.trace_ref,
      status: executionAttemptStatus,
      result_reason: input.execution_result?.result_reason ?? input.gateway_result.decision_reason,
      created_at: createdAt,
      completed_at: input.execution_result?.completed_at,
      authority_status: executionAttemptAuthorityStatus
    } satisfies ExecutionResultRecord);
    const stageBinding: StageBindingRecord | undefined = existingStageBinding
      ? undefined
      : stripUndefined({
          record_kind: "stage_binding",
          version: 1,
          stage_binding_id: stageBindingId,
          candidate_ref: candidateRef,
          candidate_version_ref: candidateVersionRef,
          stage: "paper",
          profile: "paper",
          execution_mode: executionAttempt.execution_mode,
          sandbox_placement_ref: runtime.placement_ref,
          hands_environment_ref: runtime.hands_environment_ref,
          created_at: createdAt,
          authority_status: "not_live"
        } satisfies StageBindingRecord);
    const updatedRuntime: TradingRunRecord = stripUndefined({
      ...runtime,
      runtime_lifecycle_status: runtime.runtime_lifecycle_status ?? "registered",
      candidate_ref: runtime.candidate_ref ?? candidateRef,
      candidate_version_ref: runtime.candidate_version_ref ?? candidateVersionRef,
      stage_binding_ref: stageBindingRef,
      order_request_refs: appendUniqueRefs(runtime.order_request_refs, orderIntentRef),
      gateway_result_refs: appendUniqueRefs(runtime.gateway_result_refs, gatewayDecisionRef),
      execution_result_refs: appendUniqueRefs(runtime.execution_result_refs, executionAttemptRef),
      created_at: runtime.created_at ?? createdAt
    } satisfies TradingRunRecord);

    const immutableRecords: FixtureItem[] = [
      ...(stageBinding
        ? [{ collection: "stage-bindings" as const, id: stageBinding.stage_binding_id, record: stageBinding }]
        : []),
      { collection: "order-requests", id: orderIntent.order_request_id, record: orderIntent },
      { collection: "gateway-results", id: gatewayDecision.gateway_result_id, record: gatewayDecision },
      { collection: "execution-results", id: executionAttempt.execution_result_id, record: executionAttempt },
      { collection: "trading-runs", id: updatedRuntime.trading_run_id, record: updatedRuntime }
    ];
    return {
      outcome: {
        candidate_id: candidate.candidate_id,
        candidate_version_id: candidateVersion.candidate_version_id,
        runtime_id: runtime.trading_run_id,
        order_request: orderIntent,
        gateway_result: gatewayDecision,
        execution_result: executionAttempt
      },
      previousRuntime: runtime,
      updatedRuntime,
      immutableRecords,
      existing: false
    };
  }

  async recordPaperTradingEvaluationCommitment(
    commitment: PaperTradingEvaluationCommitmentRecord
  ): Promise<PaperTradingEvaluationCommitmentRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingEvaluationCommitmentUnlocked(commitment)
    );
  }

  private async recordPaperTradingEvaluationCommitmentUnlocked(
    commitment: PaperTradingEvaluationCommitmentRecord
  ): Promise<PaperTradingEvaluationCommitmentRecord> {
    if (!isPaperTradingEvaluationCommitmentRecord(commitment)) {
      throw new LocalStoreError(
        "invalid_paper_trading_evaluation_commitment_input",
        "invalid paper trading evaluation commitment input",
        {
          paper_trading_evaluation_commitment_id:
            (commitment as Partial<PaperTradingEvaluationCommitmentRecord> | undefined)
              ?.paper_trading_evaluation_commitment_id
        }
      );
    }
    const expectedDigest = `sha256:${createHash("sha256")
      .update(paperTradingEvaluationCommitmentDigestInput(commitment))
      .digest("hex")}`;
    if (commitment.commitment_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_evaluation_commitment_digest_mismatch",
        "paper trading evaluation commitment digest does not match canonical content",
        { paper_trading_evaluation_commitment_id: commitment.paper_trading_evaluation_commitment_id }
      );
    }

    const existing = await this.getPaperTradingEvaluationCommitment(
      commitment.paper_trading_evaluation_commitment_id
    );
    if (existing) {
      if (
        existing.commitment_digest !== commitment.commitment_digest ||
        existing.committed_at !== commitment.committed_at ||
        existing.version !== commitment.version ||
        existing.authority_status !== commitment.authority_status
      ) {
        throw new LocalStoreError(
          "paper_trading_evaluation_commitment_conflict",
          "paper trading evaluation commitment is append-only",
          { paper_trading_evaluation_commitment_id: commitment.paper_trading_evaluation_commitment_id }
        );
      }
      return existing;
    }

    const candidate = await this.readOptionalRecord<TradingSystemCandidateRecord>(
      "candidates",
      commitment.candidate_ref.id
    );
    const candidateVersion = await this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      commitment.candidate_version_ref.id
    );
    const tradingRun = await this.getTradingRun(commitment.trading_run_ref.id);
    const systemCode = await this.getSystemCode(commitment.system_code_ref.id);
    if (!candidate || !candidateVersion || !tradingRun || !systemCode) {
      throw new LocalStoreError(
        "paper_trading_evaluation_commitment_reference_not_found",
        "paper trading evaluation commitment references a missing record",
        {
          candidate_id: commitment.candidate_ref.id,
          candidate_version_id: commitment.candidate_version_ref.id,
          system_code_id: commitment.system_code_ref.id
        }
      );
    }
    if (!paperTradingCommitmentReferencesMatch({
      commitment,
      candidate,
      candidateVersion,
      tradingRun,
      systemCode
    })) {
      throw new LocalStoreError(
        "paper_trading_evaluation_commitment_reference_mismatch",
        "paper trading evaluation commitment does not match referenced records",
        { paper_trading_evaluation_commitment_id: commitment.paper_trading_evaluation_commitment_id }
      );
    }

    await this.assertPaperTradingCommitmentWriteDoesNotMutateBoundGraph(commitment);
    await this.writeJson(
      this.itemPath(
        "paper-trading-evaluation-commitments",
        commitment.paper_trading_evaluation_commitment_id
      ),
      commitment
    );
    return commitment;
  }

  async getPaperTradingEvaluationCommitment(
    commitmentId: string
  ): Promise<PaperTradingEvaluationCommitmentRecord | undefined> {
    return this.readOptionalRecord<PaperTradingEvaluationCommitmentRecord>(
      "paper-trading-evaluation-commitments",
      commitmentId
    );
  }

  async listPaperTradingEvaluationCommitments(): Promise<PaperTradingEvaluationCommitmentRecord[]> {
    return (await this.readCollection<PaperTradingEvaluationCommitmentRecord>(
      "paper-trading-evaluation-commitments"
    )).sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.paper_trading_evaluation_commitment_id.localeCompare(
        right.paper_trading_evaluation_commitment_id
      )
    );
  }

  async recordPaperTradingEvaluation(
    evaluation: PaperTradingEvaluationRecord,
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<PaperTradingEvaluationRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingEvaluationUnlocked(evaluation, authority)
    );
  }

  private async recordPaperTradingEvaluationUnlocked(
    evaluation: PaperTradingEvaluationRecord,
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<PaperTradingEvaluationRecord> {
    const existing = await this.getPaperTradingEvaluation(evaluation.paper_trading_evaluation_id);
    if (existing && JSON.stringify(existing) === JSON.stringify(evaluation)) {
      return existing;
    }
    await this.validatePaperTradingEvaluationWrite(evaluation, existing);
    await this.assertNoPairBoundSideMutation({
      runId: evaluation.trading_run_ref.id,
      commitmentId: evaluation.paper_trading_evaluation_commitment_ref?.id,
      evaluationId: evaluation.paper_trading_evaluation_id
    }, authority, authority !== undefined ? {
      writer: "paper_trading_evaluation",
      evaluation,
      existing
    } : undefined);
    await this.writeJson(
      this.itemPath("paper-trading-evaluations", evaluation.paper_trading_evaluation_id),
      evaluation
    );
    return evaluation;
  }

  async getPaperTradingEvaluation(
    evaluationId: string
  ): Promise<PaperTradingEvaluationRecord | undefined> {
    return this.readOptionalRecord<PaperTradingEvaluationRecord>(
      "paper-trading-evaluations",
      evaluationId
    );
  }

  async listPaperTradingEvaluations(): Promise<PaperTradingEvaluationRecord[]> {
    return (await this.readCollection<PaperTradingEvaluationRecord>("paper-trading-evaluations"))
      .sort(comparePaperTradingEvaluations);
  }

  async getLatestPaperTradingEvaluationForCandidate(
    candidateId: string
  ): Promise<PaperTradingEvaluationRecord | undefined> {
    return (await this.listPaperTradingEvaluationsForCandidate(candidateId)).at(-1);
  }

  async getLatestPaperTradingEvaluationForTradingRun(
    tradingRunId: string
  ): Promise<PaperTradingEvaluationRecord | undefined> {
    return (await this.readCollection<PaperTradingEvaluationRecord>("paper-trading-evaluations"))
      .filter((evaluation) => evaluation.trading_run_ref.id === tradingRunId)
      .sort(comparePaperTradingEvaluations)
      .at(-1);
  }

  async listPaperTradingEvaluationsForCandidate(
    candidateId: string
  ): Promise<PaperTradingEvaluationRecord[]> {
    return (await this.readCollection<PaperTradingEvaluationRecord>("paper-trading-evaluations"))
      .filter((evaluation) => evaluation.candidate_ref.id === candidateId)
      .sort(comparePaperTradingEvaluations);
  }

  async recordPaperTradingObservation(
    observation: PaperTradingObservationRecord,
    evaluation: PaperTradingEvaluationRecord
  ): Promise<PaperTradingObservationRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingObservationUnlocked(observation, evaluation)
    );
  }

  private async recordPaperTradingObservationUnlocked(
    observation: PaperTradingObservationRecord,
    evaluation: PaperTradingEvaluationRecord
  ): Promise<PaperTradingObservationRecord> {
    const existingEvaluation = await this.getPaperTradingEvaluation(
      evaluation.paper_trading_evaluation_id
    );
    if (!existingEvaluation || observation.paper_trading_evaluation_ref.id !== evaluation.paper_trading_evaluation_id) {
      throw new LocalStoreError(
        "paper_trading_observation_evaluation_mismatch",
        "paper trading observation does not match a stored evaluation",
        { paper_trading_observation_id: observation.paper_trading_observation_id }
      );
    }
    if (existingEvaluation.status === "invalidated") {
      throw new LocalStoreError(
        "paper_trading_observation_after_invalidation",
        "paper trading observations cannot be appended after invalidation",
        { paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id }
      );
    }
    if (!observation.paper_trading_evaluation_commitment_ref) {
      throw new LocalStoreError(
        "paper_trading_observation_commitment_required",
        "paper trading observation requires a commitment reference",
        { paper_trading_observation_id: observation.paper_trading_observation_id }
      );
    }
    const commitmentId = existingEvaluation.paper_trading_evaluation_commitment_ref?.id;
    if (
      !commitmentId ||
      observation.paper_trading_evaluation_commitment_ref.id !== commitmentId ||
      evaluation.paper_trading_evaluation_commitment_ref?.id !== commitmentId
    ) {
      throw new LocalStoreError(
        "paper_trading_observation_commitment_mismatch",
        "paper trading observation commitment does not match its evaluation",
        { paper_trading_observation_id: observation.paper_trading_observation_id }
      );
    }
    const commitment = await this.getPaperTradingEvaluationCommitment(commitmentId);
    if (!commitment) {
      throw new LocalStoreError(
        "paper_trading_evaluation_commitment_reference_not_found",
        "paper trading observation commitment was not found",
        { paper_trading_evaluation_commitment_id: commitmentId }
      );
    }
    if (!paperTradingObservationReferencesMatch(observation, evaluation, commitment)) {
      throw new LocalStoreError(
        "paper_trading_observation_evaluation_mismatch",
        "paper trading observation identity does not match its evaluation commitment",
        { paper_trading_observation_id: observation.paper_trading_observation_id }
      );
    }
    await this.assertNoPairBoundSideMutation({
      runId: observation.trading_run_ref.id,
      commitmentId,
      evaluationId: evaluation.paper_trading_evaluation_id
    });
    const expectedSequence = existingEvaluation.observation_count + 1;
    if (
      observation.sequence !== expectedSequence ||
      evaluation.observation_count !== expectedSequence
    ) {
      throw new LocalStoreError(
        "paper_trading_observation_sequence_mismatch",
        "paper trading observation sequence is not contiguous",
        {
          paper_trading_observation_id: observation.paper_trading_observation_id,
          expected_sequence: expectedSequence,
          actual_sequence: observation.sequence
        }
      );
    }
    await this.validatePaperTradingAccountLineage({
      commitment,
      existingEvaluation,
      observation,
      evaluation
    });
    await this.validatePaperTradingEvaluationWrite(evaluation, existingEvaluation);
    await this.writeJson(
      this.itemPath("paper-trading-observations", observation.paper_trading_observation_id),
      observation
    );
    await this.writeJson(
      this.itemPath("paper-trading-evaluations", evaluation.paper_trading_evaluation_id),
      evaluation
    );
    return observation;
  }

  async listPaperTradingObservations(
    evaluationId: string
  ): Promise<PaperTradingObservationRecord[]> {
    return (await this.readCollection<PaperTradingObservationRecord>("paper-trading-observations"))
      .filter((observation) => observation.paper_trading_evaluation_ref.id === evaluationId)
      .sort(comparePaperTradingObservations);
  }

  async reservePaperTradingComparisonPreparation(
    preparation: PaperTradingComparisonPreparationRecord
  ): Promise<PaperTradingComparisonPreparationRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.reservePaperTradingComparisonPreparationUnlocked(preparation)
    );
  }

  private async reservePaperTradingComparisonPreparationUnlocked(
    preparation: PaperTradingComparisonPreparationRecord
  ): Promise<PaperTradingComparisonPreparationRecord> {
    if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_preparation_input",
        "invalid paper trading comparison preparation input"
      );
    }
    const expectedDigest = `sha256:${createHash("sha256")
      .update(paperTradingComparisonPreparationDigestInput(preparation))
      .digest("hex")}`;
    if (preparation.preparation_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_preparation_digest_mismatch",
        "paper trading comparison preparation digest does not match canonical content"
      );
    }
    const existing = await this.getPaperTradingComparisonPreparation(
      preparation.paper_trading_comparison_preparation_id
    );
    if (existing) {
      this.assertPersistedComparisonPreparationShape(existing);
      if (!sameJson(existing, preparation)) {
        throw new LocalStoreError(
          "paper_trading_comparison_preparation_conflict",
          "paper trading comparison preparation is append-only"
        );
      }
      await this.validatePaperTradingComparisonPreparation(existing, false);
      return existing;
    }
    await this.validatePaperTradingComparisonPreparation(preparation, true);
    const pairKey = paperTradingComparisonCandidateVersionPairKey(
      preparation.champion.candidate_version_ref.id,
      preparation.challenger.candidate_version_ref.id
    );
    const campaignOutcomes = await this.listPaperTradingComparisonConfirmationCampaignOutcomes();
    const completedCampaignIds = new Set(campaignOutcomes.map((outcome) =>
      outcome.campaign_ref.id));
    const activeCampaign = (
      await this.listPaperTradingComparisonConfirmationCampaigns()
    ).find((campaign) => !completedCampaignIds.has(
      campaign.paper_trading_comparison_confirmation_campaign_id
    ) && paperTradingComparisonCandidateVersionPairKey(
      campaign.champion.candidate_version_ref.id,
      campaign.challenger.candidate_version_ref.id
    ) === pairKey);
    if (activeCampaign) {
      await this.assertPaperTradingComparisonConfirmationSlotReservation(
        activeCampaign,
        preparation
      );
    } else {
      await this.assertResearchControlCampaignPaperScheduleReservation(
        preparation
      );
    }
    const terminatedComparisonIds = new Set(
      (await this.listPaperTradingComparisonVerdicts()).map((verdict) =>
        verdict.paper_trading_comparison_commitment_ref.id)
    );
    const activeConflict = (await this.listPaperTradingComparisonPreparations()).find((record) => {
      this.assertPersistedComparisonPreparationShape(record);
      return !terminatedComparisonIds.has(
        record.paper_trading_comparison_commitment_id
      ) && paperTradingComparisonCandidateVersionPairKey(
        record.champion.candidate_version_ref.id,
        record.challenger.candidate_version_ref.id
      ) === pairKey;
    });
    if (activeConflict) {
      throw new LocalStoreError(
        "paper_trading_comparison_active_pair_conflict",
        "an active preparation already owns this unordered candidate-version pair"
      );
    }
    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-preparations",
        preparation.paper_trading_comparison_preparation_id
      ),
      preparation
    );
    return preparation;
  }

  private async assertResearchControlCampaignPaperScheduleReservation(
    preparation: PaperTradingComparisonPreparationRecord
  ): Promise<void> {
    const owners: Array<{
      schedule: ResearchControlCampaignPaperScheduleRecord;
      slot: Extract<
        ResearchControlCampaignPaperScheduleSlot,
        { slot_status: "candidate_scheduled" }
      >;
    }> = [];
    for (const schedule of await this.listResearchControlCampaignPaperSchedules()) {
      for (const arm of schedule.arms) {
        for (const slot of arm.slots) {
          if (slot.slot_status === "candidate_scheduled" &&
            paperTradingComparisonRefsEqual(
              slot.candidate_ref,
              preparation.challenger.candidate_ref
            ) && paperTradingComparisonRefsEqual(
              slot.candidate_version_ref,
              preparation.challenger.candidate_version_ref
            )) {
            owners.push({ schedule, slot });
          }
        }
      }
    }
    if (owners.length === 0) return;

    const sourceGraphs = new Map<string, {
      campaign: ResearchControlCampaignRecord;
      report: ResearchControlCampaignReportRecord;
    }>();
    for (const owner of owners) {
      if (sourceGraphs.has(
        owner.schedule.research_control_campaign_paper_schedule_id
      )) continue;
      const [campaign, report] = await Promise.all([
        this.getResearchControlCampaign(owner.schedule.campaign_ref.id),
        this.getResearchControlCampaignReport(owner.schedule.report_ref.id)
      ]);
      if (!campaign || !report ||
        !this.researchControlCampaignPaperScheduleGraphMatches(
          owner.schedule,
          campaign,
          report
        )) {
        throw new LocalStoreError(
          "research_control_campaign_paper_schedule_graph_invalid",
          "active ResearchControlCampaign paper schedule graph is invalid"
        );
      }
      sourceGraphs.set(
        owner.schedule.research_control_campaign_paper_schedule_id,
        { campaign, report }
      );
    }

    const exactOwners = owners.filter(({ slot }) =>
      slot.source_preparation_id ===
        preparation.paper_trading_comparison_preparation_id &&
      slot.source_comparison_commitment_id ===
        preparation.paper_trading_comparison_commitment_id
    );
    if (exactOwners.length !== 1) {
      throw new LocalStoreError(
        "research_control_campaign_paper_schedule_source_conflict",
        "a scheduled research candidate accepts only its exact source comparison identity"
      );
    }

    const owner = exactOwners[0]!;
    const graph = sourceGraphs.get(
      owner.schedule.research_control_campaign_paper_schedule_id
    )!;
    const paperProtocol = graph.campaign.paper_evaluation_protocol;
    const comparator = graph.campaign.paper_comparator;
    const selection = preparation.champion_selection;
    if (paperProtocol.protocol_status !== "bound" ||
      comparator.comparator_status !== "trading_review" ||
      !paperTradingComparisonRefsEqual(
        preparation.champion.candidate_ref,
        comparator.candidate_ref
      ) || !paperTradingComparisonRefsEqual(
        preparation.champion.candidate_version_ref,
        comparator.candidate_version_ref
      ) || selection.selection_kind !== "trading_review" ||
      !paperTradingComparisonRefsEqual(
        selection.trading_promotion_ref,
        comparator.trading_promotion_ref
      ) || selection.trading_promotion_digest !==
        comparator.trading_promotion_digest ||
      !paperTradingComparisonRefsEqual(
        selection.paper_trading_evaluation_ref,
        comparator.paper_trading_evaluation_ref
      ) || !paperTradingComparisonRefsEqual(
        preparation.challenger.system_code_ref,
        owner.slot.system_code_ref
      ) || preparation.challenger.system_code_artifact_digest !==
        owner.slot.system_code_artifact_digest ||
      !paperTradingComparisonRefsEqual(
        preparation.challenger.candidate_admission_decision_ref,
        owner.slot.admission_decision_ref
      ) || !sameJson(
        preparation.comparison_policy,
        paperProtocol.comparison_policy
      ) || preparation.market_data_configuration_digest !==
        paperProtocol.market_data_configuration_digest ||
      !sameJson(
        preparation.paper_policy_identity,
        paperProtocol.paper_policy_identity
      ) || Date.parse(preparation.committed_at) <=
        Date.parse(owner.schedule.committed_at)) {
      throw new LocalStoreError(
        "research_control_campaign_paper_schedule_source_conflict",
        "paper comparison preparation does not match the frozen research source slot"
      );
    }

    for (const arm of owner.schedule.arms) {
      for (const priorSlot of arm.slots) {
        if (priorSlot.sequence >= owner.slot.sequence ||
          priorSlot.slot_status === "no_admitted_candidate") continue;
        const priorOutcome = await this.getResearchControlCampaignPaperSlotOutcome(
          researchControlCampaignPaperSlotOutcomeIdFor(
            owner.schedule,
            arm.arm_kind,
            priorSlot.sequence
          )
        );
        if (!priorOutcome ||
          !this.researchControlCampaignPaperSlotOutcomeGraphMatches(
            priorOutcome,
            owner.schedule
          )) {
          throw new LocalStoreError(
            "research_control_campaign_paper_schedule_slot_not_ready",
            "research source sequence is not ready before prior slot outcomes close"
          );
        }
      }
    }
  }

  private async assertPaperTradingComparisonConfirmationSlotReservation(
    campaign: PaperTradingComparisonConfirmationCampaignRecord,
    preparation: PaperTradingComparisonPreparationRecord
  ): Promise<void> {
    await this.validatePaperTradingComparisonConfirmationCampaignGraph(campaign);
    const requestedIndex = campaign.slots.findIndex((slot) =>
      slot.paper_trading_comparison_preparation_id ===
        preparation.paper_trading_comparison_preparation_id &&
      slot.paper_trading_comparison_commitment_id ===
        preparation.paper_trading_comparison_commitment_id
    );
    if (requestedIndex < 0) {
      throw new LocalStoreError(
        "paper_trading_comparison_active_campaign_pair_conflict",
        "an active confirmation campaign owns this unordered candidate-version pair"
      );
    }

    const [preparations, verdicts] = await Promise.all([
      this.listPaperTradingComparisonPreparations(),
      this.listPaperTradingComparisonVerdicts()
    ]);
    let nextSlotIndex = 0;
    let previousVerdict: PaperTradingComparisonVerdictRecord | undefined;
    for (; nextSlotIndex < campaign.slots.length; nextSlotIndex += 1) {
      const slot = campaign.slots[nextSlotIndex]!;
      const persisted = preparations.find((record) =>
        record.paper_trading_comparison_preparation_id ===
          slot.paper_trading_comparison_preparation_id ||
        record.paper_trading_comparison_commitment_id ===
          slot.paper_trading_comparison_commitment_id
      );
      if (!persisted) break;
      if (persisted.paper_trading_comparison_preparation_id !==
          slot.paper_trading_comparison_preparation_id ||
        persisted.paper_trading_comparison_commitment_id !==
          slot.paper_trading_comparison_commitment_id) {
        throw new LocalStoreError(
          "paper_trading_comparison_confirmation_campaign_graph_invalid",
          "persisted confirmation slot preparation identity is inconsistent"
        );
      }
      previousVerdict = verdicts.find((verdict) =>
        verdict.paper_trading_comparison_commitment_ref.id ===
          slot.paper_trading_comparison_commitment_id
      );
      if (!previousVerdict) break;
    }
    if (requestedIndex !== nextSlotIndex || previousVerdict === undefined &&
      requestedIndex > 0) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_slot_not_ready",
        "paper trading comparison confirmation slot is not the next ready slot"
      );
    }

    const lowerBound = requestedIndex === 0
      ? campaign.committed_at
      : previousVerdict!.evaluated_at;
    if (!samePersistedComparisonRecord(preparation.champion, campaign.champion) ||
      !samePersistedComparisonRecord(preparation.challenger, campaign.challenger) ||
      !samePersistedComparisonRecord(
        preparation.champion_selection,
        campaign.champion_selection
      ) || !samePersistedComparisonRecord(
        preparation.comparison_policy,
        campaign.comparison_policy
      ) || preparation.market_data_configuration_digest !==
        campaign.market_data_configuration_digest ||
      !samePersistedComparisonRecord(
        preparation.paper_policy_identity,
        campaign.paper_policy_identity
      ) || Date.parse(preparation.committed_at) <= Date.parse(lowerBound)) {
      throw new LocalStoreError(
        "paper_trading_comparison_active_campaign_pair_conflict",
        "paper trading comparison preparation does not match the frozen confirmation slot"
      );
    }
  }

  async getPaperTradingComparisonPreparation(
    preparationId: string
  ): Promise<PaperTradingComparisonPreparationRecord | undefined> {
    return this.readOptionalRecord<PaperTradingComparisonPreparationRecord>(
      "paper-trading-comparison-preparations",
      preparationId
    );
  }

  async listPaperTradingComparisonPreparations(): Promise<PaperTradingComparisonPreparationRecord[]> {
    const records = await this.readCollection<unknown>(
      "paper-trading-comparison-preparations"
    );
    const validated = records.map((record) => {
      this.assertPersistedComparisonPreparationShape(record);
      return record;
    });
    return validated.sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.paper_trading_comparison_preparation_id.localeCompare(
        right.paper_trading_comparison_preparation_id
      )
    );
  }

  async recordPaperTradingComparisonCommitment(
    commitment: PaperTradingComparisonCommitmentRecord
  ): Promise<PaperTradingComparisonCommitmentRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonCommitmentUnlocked(commitment)
    );
  }

  private async recordPaperTradingComparisonCommitmentUnlocked(
    commitment: PaperTradingComparisonCommitmentRecord
  ): Promise<PaperTradingComparisonCommitmentRecord> {
    if (!paperTradingComparisonCommitmentHasRuntimeShape(commitment)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_commitment_input",
        "invalid paper trading comparison commitment input"
      );
    }
    const expectedDigest = `sha256:${createHash("sha256")
      .update(paperTradingComparisonCommitmentDigestInput(commitment))
      .digest("hex")}`;
    if (commitment.commitment_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_commitment_digest_mismatch",
        "paper trading comparison commitment digest does not match canonical content"
      );
    }
    const existing = await this.getPaperTradingComparisonCommitment(
      commitment.paper_trading_comparison_commitment_id
    );
    if (existing) {
      this.assertPersistedComparisonCommitmentShape(existing);
      if (!sameJson(existing, commitment)) {
        throw new LocalStoreError(
          "paper_trading_comparison_commitment_conflict",
          "paper trading comparison commitment is append-only"
        );
      }
      await this.validatePaperTradingComparisonCommitmentGraph(existing);
      return existing;
    }
    await this.validatePaperTradingComparisonCommitmentGraph(commitment);
    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-commitments",
        commitment.paper_trading_comparison_commitment_id
      ),
      commitment
    );
    return commitment;
  }

  async getPaperTradingComparisonCommitment(
    comparisonId: string
  ): Promise<PaperTradingComparisonCommitmentRecord | undefined> {
    return this.readOptionalRecord<PaperTradingComparisonCommitmentRecord>(
      "paper-trading-comparison-commitments",
      comparisonId
    );
  }

  async listPaperTradingComparisonCommitments(): Promise<PaperTradingComparisonCommitmentRecord[]> {
    const records = await this.readCollection<unknown>(
      "paper-trading-comparison-commitments"
    );
    const validated = records.map((record) => {
      this.assertPersistedComparisonCommitmentShape(record);
      return record;
    });
    return validated.sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.paper_trading_comparison_commitment_id.localeCompare(
        right.paper_trading_comparison_commitment_id
      )
    );
  }

  async recordPaperTradingComparisonTick(
    tick: PaperTradingComparisonTickRecord,
    authority?: PaperTradingComparisonTickCaptureWriteContext
  ): Promise<PaperTradingComparisonTickRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonTickUnlocked(tick, authority)
    );
  }

  private async recordPaperTradingComparisonTickUnlocked(
    tick: PaperTradingComparisonTickRecord,
    authority?: PaperTradingComparisonTickCaptureWriteContext
  ): Promise<PaperTradingComparisonTickRecord> {
    if (!paperTradingComparisonTickHasRuntimeShape(tick)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_tick_input",
        "invalid paper trading comparison tick input"
      );
    }
    const expectedDigest = `sha256:${createHash("sha256")
      .update(paperTradingComparisonTickDigestInput(tick))
      .digest("hex")}`;
    if (tick.tick_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_digest_mismatch",
        "paper trading comparison tick digest does not match canonical content"
      );
    }

    const existing = await this.getPaperTradingComparisonTick(
      tick.paper_trading_comparison_tick_id
    );
    if (existing && !sameJson(existing, tick)) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_conflict",
        "paper trading comparison tick is append-only"
      );
    }

    const comparisonId = tick.paper_trading_comparison_commitment_ref.id;
    const ticks = await this.listPaperTradingComparisonTicks(comparisonId);
    if (tick.sequence === 1) {
      if (authority !== undefined) {
        throw new LocalStoreError(
          "invalid_paper_trading_comparison_tick_capture_context",
          "first paper comparison tick cannot carry next-tick authority"
        );
      }
      await this.validatePaperTradingComparisonConfirmationFirstTick(
        tick,
        existing !== undefined
      );
      await this.validatePaperTradingComparisonTickGraph(
        tick,
        existing === undefined
      );
      const alternate = ticks.find((record) =>
        record.paper_trading_comparison_tick_id !==
          tick.paper_trading_comparison_tick_id
      );
      if (alternate) {
        throw new LocalStoreError(
          "paper_trading_comparison_first_tick_conflict",
          "paper trading comparison already has a different first tick"
        );
      }
    } else {
      if (!paperTradingComparisonTickCaptureWriteContextHasRuntimeShape(authority)) {
        throw new LocalStoreError(
          "invalid_paper_trading_comparison_tick_capture_context",
          "later paper comparison tick requires exact capture authority"
        );
      }
      if (existing) {
        await this.validatePaperTradingComparisonNextTickReplayAuthority(tick, authority);
        return existing;
      }
      await this.validatePaperTradingComparisonTickGraph(tick, false);
      await this.validatePaperTradingComparisonNextTickCapture(
        tick,
        authority,
        ticks
      );
    }
    if (existing) {
      return existing;
    }

    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-ticks",
        tick.paper_trading_comparison_tick_id
      ),
      tick
    );
    return tick;
  }

  private async validatePaperTradingComparisonConfirmationFirstTick(
    tick: PaperTradingComparisonTickRecord,
    exactReplay: boolean
  ): Promise<void> {
    const campaigns = await this.listPaperTradingComparisonConfirmationCampaigns();
    const matches = campaigns.flatMap((campaign) => campaign.slots
      .map((slot, index) => ({ campaign, slot, index }))
      .filter(({ slot }) => slot.paper_trading_comparison_commitment_id ===
        tick.paper_trading_comparison_commitment_ref.id));
    if (matches.length === 0) return;
    if (matches.length !== 1) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_graph_invalid",
        "paper trading comparison confirmation slot identity is ambiguous"
      );
    }
    const match = matches[0]!;
    await this.validatePaperTradingComparisonConfirmationCampaignGraph(match.campaign);
    const outcomes = await this.listPaperTradingComparisonConfirmationCampaignOutcomes(
      match.campaign.paper_trading_comparison_confirmation_campaign_id
    );
    if (outcomes.length > 0) {
      if (exactReplay) return;
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_terminal",
        "paper trading comparison confirmation campaign outcome is terminal"
      );
    }
    const verdicts = await this.listPaperTradingComparisonVerdicts();
    let applicableStart = match.campaign.committed_at;
    for (let index = 0; index < match.index; index += 1) {
      const priorSlot = match.campaign.slots[index]!;
      const priorVerdict = verdicts.find((verdict) =>
        verdict.paper_trading_comparison_commitment_ref.id ===
          priorSlot.paper_trading_comparison_commitment_id
      );
      if (!priorVerdict) {
        throw new LocalStoreError(
          "paper_trading_comparison_confirmation_slot_not_ready",
          "paper trading comparison confirmation predecessor has no exact verdict"
        );
      }
      applicableStart = Date.parse(priorVerdict.evaluated_at) >=
          Date.parse(priorVerdict.window_ended_at)
        ? priorVerdict.evaluated_at
        : priorVerdict.window_ended_at;
    }
    const observedAt = Date.parse(tick.observed_at);
    const startAt = Date.parse(applicableStart);
    if (observedAt <= startAt || observedAt > startAt +
      match.campaign.campaign_policy.maximum_slot_start_delay_ms) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_first_tick_time_mismatch",
        "paper trading comparison confirmation first tick lies outside its frozen start window"
      );
    }
  }

  async getPaperTradingComparisonTick(
    tickId: string
  ): Promise<PaperTradingComparisonTickRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-ticks",
        tickId
      );
      if (record === undefined) {
        return undefined;
      }
      this.assertPersistedComparisonTickShape(
        record,
        "paper_trading_comparison_tick_reload_failed"
      );
      return record;
    } catch (error) {
      if (
        error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_tick_reload_failed"
      ) {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_tick_reload_failed",
        "persisted paper trading comparison tick is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonTicks(
    comparisonId: string
  ): Promise<PaperTradingComparisonTickRecord[]> {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-ticks"
      );
      const validated = records.map((record) => {
        this.assertPersistedComparisonTickShape(
          record,
          "paper_trading_comparison_tick_reload_failed"
        );
        return record;
      });
      return validated
        .filter((record) =>
          record.paper_trading_comparison_commitment_ref.id === comparisonId
        )
        .sort((left, right) =>
          left.sequence - right.sequence ||
          left.paper_trading_comparison_tick_id.localeCompare(
            right.paper_trading_comparison_tick_id
          )
        );
    } catch (error) {
      if (
        error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_tick_reload_failed"
      ) {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_tick_reload_failed",
        "persisted paper trading comparison tick collection is unreadable or corrupt"
      );
    }
  }

  private async validatePaperTradingComparisonTickGraph(
    tick: PaperTradingComparisonTickRecord,
    requireInert = true
  ): Promise<void> {
    let comparison: PaperTradingComparisonCommitmentRecord | undefined;
    try {
      comparison = await this.getPaperTradingComparisonCommitment(
        tick.paper_trading_comparison_commitment_ref.id
      );
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_graph_invalid",
        "paper trading comparison graph is unreadable or corrupt"
      );
    }
    if (!comparison) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_reference_not_found",
        "paper trading comparison commitment was not found"
      );
    }
    if (!paperTradingComparisonCommitmentHasRuntimeShape(comparison)) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_graph_invalid",
        "paper trading comparison commitment has invalid runtime shape"
      );
    }
    const expectedComparisonDigest = `sha256:${createHash("sha256")
      .update(paperTradingComparisonCommitmentDigestInput(comparison))
      .digest("hex")}`;
    if (
      comparison.paper_trading_comparison_commitment_id !==
        tick.paper_trading_comparison_commitment_ref.id ||
      comparison.commitment_digest !== expectedComparisonDigest ||
      tick.paper_trading_comparison_commitment_digest !==
        comparison.commitment_digest ||
      tick.market_data_configuration_digest !==
        comparison.market_data_configuration_digest ||
      Date.parse(tick.observed_at) < Date.parse(comparison.committed_at) ||
      Date.parse(tick.observed_at) < Date.parse(tick.market_snapshot.observed_at) ||
      Date.parse(tick.observed_at) <
        Date.parse(tick.public_execution_snapshot.observed_at)
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_reference_mismatch",
        "paper trading comparison tick does not match its frozen comparison"
      );
    }
    if (requireInert) {
      try {
        await this.validatePaperTradingComparisonCommitmentGraph(comparison);
      } catch {
        throw new LocalStoreError(
          "paper_trading_comparison_tick_graph_invalid",
          "paper trading comparison graph is not complete and inert"
        );
      }
    }
  }

  private async validatePaperTradingComparisonNextTickCapture(
    tick: PaperTradingComparisonTickRecord,
    authority: PaperTradingComparisonTickCaptureWriteContext,
    ticks: PaperTradingComparisonTickRecord[]
  ): Promise<void> {
    const alternate = ticks.find((record) => record.sequence === tick.sequence &&
      record.paper_trading_comparison_tick_id !== tick.paper_trading_comparison_tick_id);
    if (alternate) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_sequence_conflict",
        "paper trading comparison already has a different tick at this sequence"
      );
    }

    let activationAttempt: PaperTradingComparisonActivationAttemptRecord | undefined;
    try {
      activationAttempt = await this.getPaperTradingComparisonActivationAttempt(
        authority.paper_trading_comparison_activation_attempt_ref.id
      );
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_graph_invalid",
        "paper trading comparison activation attempt is corrupt"
      );
    }
    if (!activationAttempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_capture_reference_mismatch",
        "paper trading comparison activation attempt was not found"
      );
    }

    let closure: Awaited<ReturnType<
      LocalStore["loadPaperTradingComparisonActivationAttemptClosure"]
    >>;
    let activationAttempts: PaperTradingComparisonActivationAttemptRecord[];
    let activationOutcomes: PaperTradingComparisonActivationOutcomeRecord[];
    let checkpointAttempts: PaperTradingComparisonCheckpointAttemptRecord[];
    let deliveries: PaperTradingComparisonTickDeliveryRecord[];
    let acknowledgements: PaperTradingComparisonTickAcknowledgementRecord[];
    try {
      closure = await this.loadPaperTradingComparisonActivationAttemptClosure(activationAttempt);
      [activationAttempts, activationOutcomes, checkpointAttempts, deliveries, acknowledgements] =
        await Promise.all([
          this.listPaperTradingComparisonActivationAttempts(
            closure.activation.paper_trading_comparison_activation_id
          ),
          this.listPaperTradingComparisonActivationOutcomes(
            activationAttempt.paper_trading_comparison_activation_attempt_id
          ),
          this.listPaperTradingComparisonCheckpointAttempts(
            activationAttempt.paper_trading_comparison_activation_attempt_id
          ),
          this.listPaperTradingComparisonTickDeliveries(
            activationAttempt.paper_trading_comparison_activation_attempt_id
          ),
          this.listPaperTradingComparisonTickAcknowledgements(
            activationAttempt.paper_trading_comparison_activation_attempt_id
          )
        ]);
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_graph_invalid",
        "paper trading comparison next-tick graph is unreadable"
      );
    }

    const latestActivationOutcome = activationOutcomes.at(-1);
    if (
      !paperTradingComparisonRefsEqual(
        authority.paper_trading_comparison_activation_ref,
        {
          record_kind: "paper_trading_comparison_activation",
          id: closure.activation.paper_trading_comparison_activation_id
        }
      ) ||
      authority.paper_trading_comparison_activation_digest !==
        closure.activation.activation_digest ||
      !paperTradingComparisonRefsEqual(
        authority.paper_trading_comparison_activation_attempt_ref,
        {
          record_kind: "paper_trading_comparison_activation_attempt",
          id: activationAttempt.paper_trading_comparison_activation_attempt_id
        }
      ) ||
      authority.paper_trading_comparison_activation_attempt_digest !==
        activationAttempt.attempt_digest ||
      activationAttempts.at(-1)?.paper_trading_comparison_activation_attempt_id !==
        activationAttempt.paper_trading_comparison_activation_attempt_id ||
      latestActivationOutcome?.outcome_status !== "both_running" ||
      !paperTradingComparisonRefsEqual(
        tick.paper_trading_comparison_commitment_ref,
        closure.activation.paper_trading_comparison_commitment_ref
      ) ||
      tick.paper_trading_comparison_commitment_digest !==
        closure.activation.paper_trading_comparison_commitment_digest
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_capture_reference_mismatch",
        "paper trading comparison capture authority does not match the running activation"
      );
    }

    if (ticks.length !== tick.sequence - 1 ||
      checkpointAttempts.length !== tick.sequence - 1 ||
      tick.sequence > closure.comparison.comparison_policy.maximum_observation_count) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_capture_state_conflict",
        "paper trading comparison next tick is not contiguous or exceeds its observation cap"
      );
    }
    for (let index = 0; index < ticks.length; index += 1) {
      const current = ticks[index]!;
      const previous = ticks[index - 1];
      if (current.sequence !== index + 1 ||
        (previous && (!paperTradingComparisonRefsEqual(current.previous_tick_ref, {
          record_kind: "paper_trading_comparison_tick",
          id: previous.paper_trading_comparison_tick_id
        }) || current.previous_tick_digest !== previous.tick_digest))) {
        throw new LocalStoreError(
          "paper_trading_comparison_tick_capture_state_conflict",
          "persisted paper comparison tick chain is not contiguous"
        );
      }
    }

    const previousTick = ticks.at(-1);
    if (!previousTick ||
      !paperTradingComparisonRefsEqual(tick.previous_tick_ref, {
        record_kind: "paper_trading_comparison_tick",
        id: previousTick.paper_trading_comparison_tick_id
      }) ||
      tick.previous_tick_digest !== previousTick.tick_digest) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_capture_reference_mismatch",
        "paper trading comparison next tick does not bind its exact predecessor"
      );
    }

    const checkpointOutcomes: PaperTradingComparisonCheckpointOutcomeRecord[] = [];
    for (let index = 0; index < checkpointAttempts.length; index += 1) {
      const checkpointAttempt = checkpointAttempts[index]!;
      const outcomes = await this.listPaperTradingComparisonCheckpointOutcomes(
        checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
      );
      const outcome = outcomes[0];
      if (checkpointAttempt.checkpoint_sequence !== index + 1 ||
        outcomes.length !== 1 || !outcome || outcome.outcome_status !== "paired" ||
        outcome.checkpoint_sequence !== checkpointAttempt.checkpoint_sequence ||
        outcome.checkpoint_attempt_digest !== checkpointAttempt.attempt_digest ||
        outcome.champion?.observation_status === "failed" ||
        outcome.challenger?.observation_status === "failed") {
        throw new LocalStoreError(
          "paper_trading_comparison_tick_capture_state_conflict",
          "paper trading comparison prior checkpoint chain is not exact and paired"
        );
      }
      checkpointOutcomes.push(outcome);
    }
    const previousCheckpointAttempt = checkpointAttempts.at(-1);
    const previousCheckpointOutcome = checkpointOutcomes.at(-1);
    if (!previousCheckpointAttempt || !previousCheckpointOutcome ||
      !paperTradingComparisonRefsEqual(authority.previous_checkpoint_attempt_ref, {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: previousCheckpointAttempt.paper_trading_comparison_checkpoint_attempt_id
      }) ||
      authority.previous_checkpoint_attempt_digest !== previousCheckpointAttempt.attempt_digest ||
      !paperTradingComparisonRefsEqual(authority.previous_checkpoint_outcome_ref, {
        record_kind: "paper_trading_comparison_checkpoint_outcome",
        id: previousCheckpointOutcome.paper_trading_comparison_checkpoint_outcome_id
      }) ||
      authority.previous_checkpoint_outcome_digest !== previousCheckpointOutcome.outcome_digest ||
      previousCheckpointOutcome.checkpoint_sequence !== tick.sequence - 1) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_capture_reference_mismatch",
        "paper trading comparison capture authority does not match the prior paired checkpoint"
      );
    }

    const minimumObservedAt = Date.parse(previousTick.observed_at) +
      closure.comparison.comparison_policy.interval_ms;
    const maximumObservedAt = Date.parse(activationAttempt.attempted_at) +
      closure.comparison.comparison_policy.maximum_elapsed_ms;
    if (Date.parse(tick.observed_at) < minimumObservedAt ||
      Date.parse(tick.observed_at) > maximumObservedAt ||
      Date.parse(tick.market_snapshot.observed_at) <=
        Date.parse(previousTick.market_snapshot.observed_at) ||
      Date.parse(tick.public_execution_snapshot.observed_at) <=
        Date.parse(previousTick.public_execution_snapshot.observed_at)) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_capture_state_conflict",
        "paper trading comparison next tick violates its frozen cadence or elapsed window"
      );
    }

    const maximumProviderRequests =
      activationAttempt.activation_policy.maximum_provider_request_count_per_side;
    for (const role of ["champion", "challenger"] as const) {
      const roleAcknowledgements = acknowledgements.filter((record) =>
        record.role === role && record.tick_ref.id === previousTick.paper_trading_comparison_tick_id
      );
      const acknowledgement = roleAcknowledgements[0];
      const delivery = acknowledgement
        ? deliveries.find((record) =>
            record.paper_trading_comparison_tick_delivery_id === acknowledgement.delivery_ref.id)
        : undefined;
      const priorEvidence = previousCheckpointOutcome[role];
      const priorAckMatches = previousCheckpointOutcome.checkpoint_sequence === 1 ||
        Boolean(priorEvidence && acknowledgement &&
          paperTradingComparisonRefsEqual(priorEvidence.tick_acknowledgement_ref, {
            record_kind: "paper_trading_comparison_tick_acknowledgement",
            id: acknowledgement.paper_trading_comparison_tick_acknowledgement_id
          }) && priorEvidence.tick_acknowledgement_digest ===
            acknowledgement.acknowledgement_digest);
      if (roleAcknowledgements.length !== 1 || !acknowledgement || !delivery || !priorEvidence ||
        acknowledgement.paper_trading_comparison_activation_attempt_ref.id !==
          activationAttempt.paper_trading_comparison_activation_attempt_id ||
        acknowledgement.paper_trading_comparison_activation_attempt_digest !==
          activationAttempt.attempt_digest ||
        acknowledgement.trading_run_ref.id !== activationAttempt[role].trading_run_ref.id ||
        acknowledgement.tick_digest !== previousTick.tick_digest ||
        acknowledgement.tick_sequence !== previousTick.sequence ||
        delivery.delivery_digest !== acknowledgement.delivery_digest ||
        delivery.role !== role || delivery.trading_run_ref.id !==
          activationAttempt[role].trading_run_ref.id ||
        delivery.tick_ref.id !== previousTick.paper_trading_comparison_tick_id ||
        delivery.tick_digest !== previousTick.tick_digest ||
        acknowledgement.provider_request_count_at_acknowledgement <
          delivery.provider_request_count_at_delivery ||
        acknowledgement.provider_request_count_at_acknowledgement > maximumProviderRequests ||
        Date.parse(acknowledgement.acknowledged_at) >= Date.parse(tick.observed_at) ||
        !priorAckMatches) {
        throw new LocalStoreError(
          "paper_trading_comparison_tick_capture_state_conflict",
          "paper trading comparison next tick requires exact acknowledgements for both roles"
        );
      }
    }

    const [championState, challengerState] = await Promise.all([
      this.loadPaperTradingComparisonRuntimeSideState(
        activationAttempt,
        "champion",
        closure.comparison,
        "paper_trading_comparison_tick_graph_invalid",
        { allowCommittedCheckpoint: true }
      ),
      this.loadPaperTradingComparisonRuntimeSideState(
        activationAttempt,
        "challenger",
        closure.comparison,
        "paper_trading_comparison_tick_graph_invalid",
        { allowCommittedCheckpoint: true }
      )
    ]);
    if ([championState, challengerState].some((state) =>
      state.evidenceState !== "paired_checkpoint" ||
      state.run.runtime_lifecycle_status !== "running" ||
      state.evaluation.status !== "running" ||
      state.sandbox?.lifecycle_status !== "running")) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_capture_state_conflict",
        "paper trading comparison next tick requires both exact running paired sides"
      );
    }
  }

  private async validatePaperTradingComparisonNextTickReplayAuthority(
    tick: PaperTradingComparisonTickRecord,
    authority: PaperTradingComparisonTickCaptureWriteContext
  ): Promise<void> {
    let previousAttempt: PaperTradingComparisonCheckpointAttemptRecord | undefined;
    let previousOutcome: PaperTradingComparisonCheckpointOutcomeRecord | undefined;
    try {
      [previousAttempt, previousOutcome] = await Promise.all([
        this.getPaperTradingComparisonCheckpointAttempt(
          authority.previous_checkpoint_attempt_ref.id
        ),
        this.getPaperTradingComparisonCheckpointOutcome(
          authority.previous_checkpoint_outcome_ref.id
        )
      ]);
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_graph_invalid",
        "paper trading comparison replay authority graph is unreadable"
      );
    }
    if (!previousAttempt || !previousOutcome ||
      !paperTradingComparisonRefsEqual(authority.previous_checkpoint_attempt_ref, {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: previousAttempt.paper_trading_comparison_checkpoint_attempt_id
      }) ||
      authority.previous_checkpoint_attempt_digest !== previousAttempt.attempt_digest ||
      !paperTradingComparisonRefsEqual(authority.previous_checkpoint_outcome_ref, {
        record_kind: "paper_trading_comparison_checkpoint_outcome",
        id: previousOutcome.paper_trading_comparison_checkpoint_outcome_id
      }) ||
      authority.previous_checkpoint_outcome_digest !== previousOutcome.outcome_digest ||
      !paperTradingComparisonRefsEqual(previousOutcome.checkpoint_attempt_ref, {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: previousAttempt.paper_trading_comparison_checkpoint_attempt_id
      }) ||
      previousOutcome.checkpoint_attempt_digest !== previousAttempt.attempt_digest ||
      previousOutcome.outcome_status !== "paired" ||
      previousOutcome.checkpoint_sequence !== tick.sequence - 1 ||
      !paperTradingComparisonRefsEqual(previousOutcome.tick_ref, tick.previous_tick_ref) ||
      previousOutcome.tick_digest !== tick.previous_tick_digest ||
      !paperTradingComparisonRefsEqual(
        previousAttempt.paper_trading_comparison_activation_ref,
        authority.paper_trading_comparison_activation_ref
      ) ||
      previousAttempt.paper_trading_comparison_activation_digest !==
        authority.paper_trading_comparison_activation_digest ||
      !paperTradingComparisonRefsEqual(
        previousAttempt.paper_trading_comparison_activation_attempt_ref,
        authority.paper_trading_comparison_activation_attempt_ref
      ) ||
      previousAttempt.paper_trading_comparison_activation_attempt_digest !==
        authority.paper_trading_comparison_activation_attempt_digest) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_capture_reference_mismatch",
        "paper trading comparison replay authority does not match persisted lineage"
      );
    }
  }

  async recordPaperTradingComparisonTickDelivery(
    delivery: PaperTradingComparisonTickDeliveryRecord,
    authority: PaperTradingComparisonTickIOWriteContext
  ): Promise<PaperTradingComparisonTickDeliveryRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonTickDeliveryUnlocked(
        delivery,
        authority
      )
    );
  }

  private async recordPaperTradingComparisonTickDeliveryUnlocked(
    delivery: PaperTradingComparisonTickDeliveryRecord,
    authority: PaperTradingComparisonTickIOWriteContext
  ): Promise<PaperTradingComparisonTickDeliveryRecord> {
    const errors = PAPER_TRADING_COMPARISON_TICK_ATTRIBUTION_ERRORS.delivery;
    if (!paperTradingComparisonTickDeliveryHasRuntimeShape(delivery)) {
      throw new LocalStoreError(errors.invalid, "invalid comparison tick delivery input");
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonTickDeliveryDigestInput(delivery)
      );
    } catch {
      throw new LocalStoreError(
        errors.invalid,
        "comparison tick delivery is not canonically digestible"
      );
    }
    if (delivery.delivery_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_delivery_digest_mismatch",
        "comparison tick delivery digest does not match canonical content"
      );
    }

    const existing = await this.getPaperTradingComparisonTickDelivery(
      delivery.paper_trading_comparison_tick_delivery_id
    );
    if (existing && !samePersistedComparisonRecord(existing, delivery)) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_delivery_conflict",
        "comparison tick delivery is append-only"
      );
    }

    const state = await this.loadPaperTradingComparisonTickAttributionState(
      authority,
      "deliver_market_snapshot",
      errors
    );
    if (
      !paperTradingComparisonRefsEqual(
        delivery.paper_trading_comparison_activation_ref,
        authority.paper_trading_comparison_activation_ref
      ) ||
      delivery.paper_trading_comparison_activation_digest !==
        authority.paper_trading_comparison_activation_digest ||
      !paperTradingComparisonRefsEqual(
        delivery.paper_trading_comparison_activation_attempt_ref,
        authority.paper_trading_comparison_activation_attempt_ref
      ) ||
      delivery.paper_trading_comparison_activation_attempt_digest !==
        authority.paper_trading_comparison_activation_attempt_digest ||
      delivery.role !== authority.role ||
      !paperTradingComparisonRefsEqual(delivery.trading_run_ref, authority.trading_run_ref) ||
      !paperTradingComparisonRefsEqual(delivery.tick_ref, authority.tick_ref) ||
      delivery.tick_digest !== authority.tick_digest ||
      delivery.tick_sequence !== state.tick.sequence
    ) {
      throw new LocalStoreError(
        errors.referenceMismatch,
        "comparison tick delivery does not match its role-bound authority"
      );
    }
    const maximumCompletedAt = Date.parse(state.attempt.attempted_at) +
      state.comparison.comparison_policy.maximum_elapsed_ms;
    if (
      delivery.provider_request_count_at_delivery <=
        state.providerRequestCountBefore ||
      delivery.provider_request_count_at_delivery >
        state.attempt.activation_policy.maximum_provider_request_count_per_side ||
      Date.parse(delivery.delivered_at) <
        Date.parse(state.deliveryNotBefore) ||
      Date.parse(delivery.delivered_at) > maximumCompletedAt
    ) {
      throw new LocalStoreError(
        errors.stateConflict,
        "comparison tick delivery lies outside its checkpoint request or time bounds"
      );
    }

    const deliveries = await this.listPaperTradingComparisonTickDeliveries(
      state.attempt.paper_trading_comparison_activation_attempt_id
    );
    const alternate = deliveries.find((record) =>
      record.paper_trading_comparison_tick_delivery_id !==
        delivery.paper_trading_comparison_tick_delivery_id &&
      record.role === delivery.role &&
      paperTradingComparisonRefsEqual(record.tick_ref, delivery.tick_ref)
    );
    if (alternate) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_delivery_conflict",
        "comparison activation side already has a delivery for this tick"
      );
    }
    if (existing) return existing;

    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-tick-deliveries",
        delivery.paper_trading_comparison_tick_delivery_id
      ),
      delivery
    );
    return delivery;
  }

  async getPaperTradingComparisonTickDelivery(
    deliveryId: string
  ): Promise<PaperTradingComparisonTickDeliveryRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-tick-deliveries",
        deliveryId
      );
      if (record === undefined) return undefined;
      this.assertPersistedPaperTradingComparisonTickDelivery(record);
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_tick_delivery_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_tick_delivery_reload_failed",
        "persisted comparison tick delivery is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonTickDeliveries(
    activationAttemptId: string
  ): Promise<PaperTradingComparisonTickDeliveryRecord[]> {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-tick-deliveries"
      );
      const validated = records.map((record) => {
        this.assertPersistedPaperTradingComparisonTickDelivery(record);
        return record;
      });
      return validated
        .filter((record) =>
          record.paper_trading_comparison_activation_attempt_ref.id ===
            activationAttemptId
        )
        .sort((left, right) =>
          left.tick_sequence - right.tick_sequence ||
          left.role.localeCompare(right.role) ||
          left.paper_trading_comparison_tick_delivery_id.localeCompare(
            right.paper_trading_comparison_tick_delivery_id
          )
        );
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_tick_delivery_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_tick_delivery_reload_failed",
        "persisted comparison tick delivery collection is unreadable or corrupt"
      );
    }
  }

  private assertPersistedPaperTradingComparisonTickDelivery(
    value: unknown
  ): asserts value is PaperTradingComparisonTickDeliveryRecord {
    if (!paperTradingComparisonTickDeliveryHasRuntimeShape(value)) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_delivery_reload_failed",
        "persisted comparison tick delivery has invalid runtime shape"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonTickDeliveryDigestInput(value)
      );
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_delivery_reload_failed",
        "persisted comparison tick delivery is not canonically digestible"
      );
    }
    if (value.delivery_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_delivery_reload_failed",
        "persisted comparison tick delivery digest is corrupt"
      );
    }
  }

  async recordPaperTradingComparisonTickAcknowledgement(
    acknowledgement: PaperTradingComparisonTickAcknowledgementRecord,
    authority: PaperTradingComparisonTickIOWriteContext
  ): Promise<PaperTradingComparisonTickAcknowledgementRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonTickAcknowledgementUnlocked(
        acknowledgement,
        authority
      )
    );
  }

  private async recordPaperTradingComparisonTickAcknowledgementUnlocked(
    acknowledgement: PaperTradingComparisonTickAcknowledgementRecord,
    authority: PaperTradingComparisonTickIOWriteContext
  ): Promise<PaperTradingComparisonTickAcknowledgementRecord> {
    const errors =
      PAPER_TRADING_COMPARISON_TICK_ATTRIBUTION_ERRORS.acknowledgement;
    if (!paperTradingComparisonTickAcknowledgementHasRuntimeShape(acknowledgement)) {
      throw new LocalStoreError(
        errors.invalid,
        "invalid comparison tick acknowledgement input"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonTickAcknowledgementDigestInput(acknowledgement)
      );
    } catch {
      throw new LocalStoreError(
        errors.invalid,
        "comparison tick acknowledgement is not canonically digestible"
      );
    }
    if (acknowledgement.acknowledgement_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_acknowledgement_digest_mismatch",
        "comparison tick acknowledgement digest does not match canonical content"
      );
    }

    const existing = await this.getPaperTradingComparisonTickAcknowledgement(
      acknowledgement.paper_trading_comparison_tick_acknowledgement_id
    );
    if (existing && !samePersistedComparisonRecord(existing, acknowledgement)) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_acknowledgement_conflict",
        "comparison tick acknowledgement is append-only"
      );
    }

    let delivery: PaperTradingComparisonTickDeliveryRecord | undefined;
    try {
      delivery = await this.getPaperTradingComparisonTickDelivery(
        acknowledgement.delivery_ref.id
      );
    } catch {
      throw new LocalStoreError(
        errors.graphInvalid,
        "comparison tick acknowledgement delivery evidence is corrupt"
      );
    }
    if (!delivery) {
      throw new LocalStoreError(
        errors.referenceNotFound,
        "comparison tick acknowledgement delivery was not found"
      );
    }

    const state = await this.loadPaperTradingComparisonTickAttributionState(
      authority,
      "acknowledge_tick",
      errors
    );
    if (
      !paperTradingComparisonRefsEqual(
        acknowledgement.delivery_ref,
        {
          record_kind: "paper_trading_comparison_tick_delivery",
          id: delivery.paper_trading_comparison_tick_delivery_id
        }
      ) ||
      acknowledgement.delivery_digest !== delivery.delivery_digest ||
      !paperTradingComparisonRefsEqual(
        acknowledgement.paper_trading_comparison_activation_attempt_ref,
        authority.paper_trading_comparison_activation_attempt_ref
      ) ||
      acknowledgement.paper_trading_comparison_activation_attempt_digest !==
        authority.paper_trading_comparison_activation_attempt_digest ||
      acknowledgement.role !== authority.role ||
      !paperTradingComparisonRefsEqual(
        acknowledgement.trading_run_ref,
        authority.trading_run_ref
      ) ||
      !paperTradingComparisonRefsEqual(acknowledgement.tick_ref, authority.tick_ref) ||
      acknowledgement.tick_digest !== authority.tick_digest ||
      acknowledgement.tick_sequence !== state.tick.sequence ||
      !paperTradingComparisonRefsEqual(
        delivery.paper_trading_comparison_activation_attempt_ref,
        authority.paper_trading_comparison_activation_attempt_ref
      ) ||
      delivery.paper_trading_comparison_activation_attempt_digest !==
        authority.paper_trading_comparison_activation_attempt_digest ||
      delivery.role !== authority.role ||
      !paperTradingComparisonRefsEqual(delivery.trading_run_ref, authority.trading_run_ref) ||
      !paperTradingComparisonRefsEqual(delivery.tick_ref, authority.tick_ref) ||
      delivery.tick_digest !== authority.tick_digest ||
      delivery.tick_sequence !== state.tick.sequence
    ) {
      throw new LocalStoreError(
        errors.referenceMismatch,
        "comparison tick acknowledgement does not match its exact delivery and authority"
      );
    }
    const maximumCompletedAt = Date.parse(state.attempt.attempted_at) +
      state.comparison.comparison_policy.maximum_elapsed_ms;
    if (
      acknowledgement.provider_request_count_at_acknowledgement <
        delivery.provider_request_count_at_delivery ||
      acknowledgement.provider_request_count_at_acknowledgement >
        state.attempt.activation_policy.maximum_provider_request_count_per_side ||
      Date.parse(acknowledgement.acknowledged_at) < Date.parse(delivery.delivered_at) ||
      Date.parse(acknowledgement.acknowledged_at) > maximumCompletedAt
    ) {
      throw new LocalStoreError(
        errors.stateConflict,
        "comparison tick acknowledgement violates delivery request or time ordering"
      );
    }

    const acknowledgements = await this.listPaperTradingComparisonTickAcknowledgements(
      state.attempt.paper_trading_comparison_activation_attempt_id
    );
    const alternate = acknowledgements.find((record) =>
      record.paper_trading_comparison_tick_acknowledgement_id !==
        acknowledgement.paper_trading_comparison_tick_acknowledgement_id &&
      paperTradingComparisonRefsEqual(record.delivery_ref, acknowledgement.delivery_ref)
    );
    if (alternate) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_acknowledgement_conflict",
        "comparison tick delivery already has an acknowledgement"
      );
    }
    if (existing) return existing;

    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-tick-acknowledgements",
        acknowledgement.paper_trading_comparison_tick_acknowledgement_id
      ),
      acknowledgement
    );
    return acknowledgement;
  }

  async getPaperTradingComparisonTickAcknowledgement(
    acknowledgementId: string
  ): Promise<PaperTradingComparisonTickAcknowledgementRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-tick-acknowledgements",
        acknowledgementId
      );
      if (record === undefined) return undefined;
      this.assertPersistedPaperTradingComparisonTickAcknowledgement(record);
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code ===
          "paper_trading_comparison_tick_acknowledgement_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_tick_acknowledgement_reload_failed",
        "persisted comparison tick acknowledgement is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonTickAcknowledgements(
    activationAttemptId: string
  ): Promise<PaperTradingComparisonTickAcknowledgementRecord[]> {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-tick-acknowledgements"
      );
      const validated = records.map((record) => {
        this.assertPersistedPaperTradingComparisonTickAcknowledgement(record);
        return record;
      });
      return validated
        .filter((record) =>
          record.paper_trading_comparison_activation_attempt_ref.id ===
            activationAttemptId
        )
        .sort((left, right) =>
          left.tick_sequence - right.tick_sequence ||
          left.role.localeCompare(right.role) ||
          left.paper_trading_comparison_tick_acknowledgement_id.localeCompare(
            right.paper_trading_comparison_tick_acknowledgement_id
          )
        );
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code ===
          "paper_trading_comparison_tick_acknowledgement_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_tick_acknowledgement_reload_failed",
        "persisted comparison tick acknowledgement collection is unreadable or corrupt"
      );
    }
  }

  private assertPersistedPaperTradingComparisonTickAcknowledgement(
    value: unknown
  ): asserts value is PaperTradingComparisonTickAcknowledgementRecord {
    if (!paperTradingComparisonTickAcknowledgementHasRuntimeShape(value)) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_acknowledgement_reload_failed",
        "persisted comparison tick acknowledgement has invalid runtime shape"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonTickAcknowledgementDigestInput(value)
      );
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_acknowledgement_reload_failed",
        "persisted comparison tick acknowledgement is not canonically digestible"
      );
    }
    if (value.acknowledgement_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_tick_acknowledgement_reload_failed",
        "persisted comparison tick acknowledgement digest is corrupt"
      );
    }
  }

  private async loadPaperTradingComparisonTickAttributionState(
    authority: PaperTradingComparisonTickIOWriteContext,
    expectedOperation: PaperTradingComparisonTickIOOperation,
    errors: PaperTradingComparisonTickAttributionErrorCodes
  ): Promise<PaperTradingComparisonTickAttributionState> {
    if (!paperTradingComparisonTickIOWriteContextHasRuntimeShape(authority)) {
      throw new LocalStoreError(errors.invalid, "invalid comparison tick IO authority");
    }
    if (authority.operation !== expectedOperation) {
      throw new LocalStoreError(
        errors.referenceMismatch,
        "comparison tick IO authority operation does not match the writer"
      );
    }

    let attempt: PaperTradingComparisonActivationAttemptRecord | undefined;
    try {
      attempt = await this.getPaperTradingComparisonActivationAttempt(
        authority.paper_trading_comparison_activation_attempt_ref.id
      );
    } catch {
      throw new LocalStoreError(
        errors.graphInvalid,
        "comparison tick activation attempt evidence is corrupt"
      );
    }
    if (!attempt) {
      throw new LocalStoreError(
        errors.referenceNotFound,
        "comparison tick activation attempt was not found"
      );
    }

    let closure: {
      activation: PaperTradingComparisonActivationRecord;
      comparison: PaperTradingComparisonCommitmentRecord;
      tick: PaperTradingComparisonTickRecord;
    };
    let attempts: PaperTradingComparisonActivationAttemptRecord[];
    let activationOutcomes: PaperTradingComparisonActivationOutcomeRecord[];
    let checkpointAttempts: PaperTradingComparisonCheckpointAttemptRecord[];
    let sideResults: PaperTradingComparisonActivationSideResultRecord[];
    let tick: PaperTradingComparisonTickRecord | undefined;
    try {
      closure = await this.loadPaperTradingComparisonActivationAttemptClosure(attempt);
      [attempts, activationOutcomes, checkpointAttempts, sideResults, tick] =
        await Promise.all([
          this.listPaperTradingComparisonActivationAttempts(
            closure.activation.paper_trading_comparison_activation_id
          ),
          this.listPaperTradingComparisonActivationOutcomes(
            attempt.paper_trading_comparison_activation_attempt_id
          ),
          this.listPaperTradingComparisonCheckpointAttempts(
            attempt.paper_trading_comparison_activation_attempt_id
          ),
          this.listPaperTradingComparisonActivationSideResults(
            attempt.paper_trading_comparison_activation_attempt_id
          ),
          this.getPaperTradingComparisonTick(authority.tick_ref.id)
        ]);
    } catch {
      throw new LocalStoreError(
        errors.graphInvalid,
        "comparison tick activation and checkpoint evidence is corrupt"
      );
    }

    if (
      !paperTradingComparisonRefsEqual(
        authority.paper_trading_comparison_activation_ref,
        {
          record_kind: "paper_trading_comparison_activation",
          id: closure.activation.paper_trading_comparison_activation_id
        }
      ) ||
      authority.paper_trading_comparison_activation_digest !==
        closure.activation.activation_digest ||
      !paperTradingComparisonRefsEqual(
        authority.paper_trading_comparison_activation_attempt_ref,
        {
          record_kind: "paper_trading_comparison_activation_attempt",
          id: attempt.paper_trading_comparison_activation_attempt_id
        }
      ) ||
      authority.paper_trading_comparison_activation_attempt_digest !==
        attempt.attempt_digest ||
      !paperTradingComparisonRefsEqual(
        authority.trading_run_ref,
        attempt[authority.role].trading_run_ref
      )
    ) {
      throw new LocalStoreError(
        errors.referenceMismatch,
        "comparison tick IO authority does not match its frozen activation side",
        {
          activation_ref_matches: paperTradingComparisonRefsEqual(
            authority.paper_trading_comparison_activation_ref,
            {
              record_kind: "paper_trading_comparison_activation",
              id: closure.activation.paper_trading_comparison_activation_id
            }
          ),
          activation_digest_matches:
            authority.paper_trading_comparison_activation_digest ===
            closure.activation.activation_digest,
          activation_attempt_ref_matches: paperTradingComparisonRefsEqual(
            authority.paper_trading_comparison_activation_attempt_ref,
            {
              record_kind: "paper_trading_comparison_activation_attempt",
              id: attempt.paper_trading_comparison_activation_attempt_id
            }
          ),
          activation_attempt_digest_matches:
            authority.paper_trading_comparison_activation_attempt_digest ===
            attempt.attempt_digest,
          trading_run_ref_matches: paperTradingComparisonRefsEqual(
            authority.trading_run_ref,
            attempt[authority.role].trading_run_ref
          )
        }
      );
    }
    if (!tick) {
      throw new LocalStoreError(
        errors.referenceNotFound,
        "comparison tick IO tick was not found"
      );
    }
    if (
      !paperTradingComparisonRefsEqual(
        authority.tick_ref,
        {
          record_kind: "paper_trading_comparison_tick",
          id: tick.paper_trading_comparison_tick_id
        }
      ) ||
      authority.tick_digest !== tick.tick_digest ||
      !paperTradingComparisonRefsEqual(
        tick.paper_trading_comparison_commitment_ref,
        {
          record_kind: "paper_trading_comparison_commitment",
          id: closure.comparison.paper_trading_comparison_commitment_id
        }
      ) ||
      tick.paper_trading_comparison_commitment_digest !==
        closure.comparison.commitment_digest ||
      tick.sequence === 1 && !samePersistedComparisonRecord(tick, closure.tick)
    ) {
      throw new LocalStoreError(
        errors.referenceMismatch,
        "comparison tick IO authority does not match its frozen comparison tick",
        {
          authority_tick_id: authority.tick_ref.id,
          resolved_tick_id: tick.paper_trading_comparison_tick_id,
          tick_ref_matches: paperTradingComparisonRefsEqual(
            authority.tick_ref,
            {
              record_kind: "paper_trading_comparison_tick",
              id: tick.paper_trading_comparison_tick_id
            }
          ),
          tick_digest_matches: authority.tick_digest === tick.tick_digest,
          comparison_ref_matches: paperTradingComparisonRefsEqual(
            tick.paper_trading_comparison_commitment_ref,
            {
              record_kind: "paper_trading_comparison_commitment",
              id: closure.comparison.paper_trading_comparison_commitment_id
            }
          )
        }
      );
    }

    const latestActivationOutcome = activationOutcomes.at(-1);
    const checkpointAttempt = checkpointAttempts.at(-1);
    if (
      attempts.at(-1)?.paper_trading_comparison_activation_attempt_id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      latestActivationOutcome?.outcome_status !== "both_running" ||
      checkpointAttempts.length !== tick.sequence ||
      !checkpointAttempt ||
      checkpointAttempt.checkpoint_sequence !== tick.sequence ||
      !paperTradingComparisonRefsEqual(
        checkpointAttempt.activation_outcome_ref,
        latestActivationOutcome && {
          record_kind: "paper_trading_comparison_activation_outcome",
          id: latestActivationOutcome.paper_trading_comparison_activation_outcome_id
        }
      ) ||
      checkpointAttempt.activation_outcome_digest !== latestActivationOutcome?.outcome_digest ||
      !paperTradingComparisonRefsEqual(checkpointAttempt.tick_ref, authority.tick_ref) ||
      checkpointAttempt.tick_digest !== authority.tick_digest
    ) {
      throw new LocalStoreError(
        errors.stateConflict,
        "comparison tick IO requires the exact latest contiguous both-running checkpoint attempt"
      );
    }

    let currentCheckpointOutcomes: PaperTradingComparisonCheckpointOutcomeRecord[];
    try {
      currentCheckpointOutcomes = await this.listPaperTradingComparisonCheckpointOutcomes(
        checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
      );
    } catch {
      throw new LocalStoreError(
        errors.graphInvalid,
        "comparison tick checkpoint outcome evidence is corrupt"
      );
    }
    let checkpointOutcome: PaperTradingComparisonCheckpointOutcomeRecord | undefined;
    if (tick.sequence === 1) {
      checkpointOutcome = currentCheckpointOutcomes[0];
      if (
        currentCheckpointOutcomes.length !== 1 ||
        checkpointOutcome?.next_action !== "serve_and_acknowledge_current_tick" ||
        !paperTradingComparisonRefsEqual(checkpointOutcome?.tick_ref, authority.tick_ref) ||
        checkpointOutcome?.tick_digest !== authority.tick_digest
      ) {
        throw new LocalStoreError(
          errors.stateConflict,
          "comparison tick IO requires one committed first paired checkpoint"
        );
      }
    } else {
      const previousCheckpointAttempt = checkpointAttempts.at(-2);
      let previousCheckpointOutcomes: PaperTradingComparisonCheckpointOutcomeRecord[];
      try {
        previousCheckpointOutcomes = previousCheckpointAttempt
          ? await this.listPaperTradingComparisonCheckpointOutcomes(
              previousCheckpointAttempt.paper_trading_comparison_checkpoint_attempt_id
            )
          : [];
      } catch {
        throw new LocalStoreError(
          errors.graphInvalid,
          "comparison tick predecessor checkpoint outcome evidence is corrupt"
        );
      }
      checkpointOutcome = previousCheckpointOutcomes[0];
      if (
        currentCheckpointOutcomes.length !== 0 ||
        !previousCheckpointAttempt ||
        previousCheckpointAttempt.checkpoint_sequence !== tick.sequence - 1 ||
        previousCheckpointOutcomes.length !== 1 ||
        !checkpointOutcome ||
        !paperTradingComparisonRefsEqual(
          checkpointAttempt.previous_checkpoint_outcome_ref,
          {
            record_kind: "paper_trading_comparison_checkpoint_outcome",
            id: checkpointOutcome.paper_trading_comparison_checkpoint_outcome_id
          }
        ) ||
        checkpointAttempt.previous_checkpoint_outcome_digest !==
          checkpointOutcome.outcome_digest ||
        checkpointOutcome.next_action === "close_failed_comparison" ||
        checkpointOutcome.next_action === "recover_cleanup"
      ) {
        throw new LocalStoreError(
          errors.stateConflict,
          "comparison tick IO requires one open checkpoint after an exact paired predecessor"
        );
      }
    }
    const checkpointEvidence = checkpointOutcome?.[authority.role];
    if (
      !checkpointOutcome ||
      checkpointOutcome.outcome_status !== "paired" ||
      !checkpointEvidence
    ) {
      throw new LocalStoreError(
        errors.stateConflict,
        "comparison tick IO requires one exact paired checkpoint baseline"
      );
    }

    let sideState: PaperTradingComparisonRuntimeSideState;
    try {
      sideState = await this.loadPaperTradingComparisonRuntimeSideState(
        attempt,
        authority.role,
        closure.comparison,
        errors.graphInvalid,
        { allowCommittedCheckpoint: true }
      );
    } catch (error) {
      if (error instanceof LocalStoreError && error.code === errors.graphInvalid) {
        throw error;
      }
      throw new LocalStoreError(
        errors.graphInvalid,
        "comparison tick post-checkpoint side evidence is corrupt"
      );
    }
    const latestSideResult = latestPaperTradingComparisonActivationSideResult(
      sideResults,
      authority.role
    );
    if (
      sideState.evidenceState !== "paired_checkpoint" ||
      !latestSideResult ||
      !this.paperTradingComparisonSideIsRunningWithinAttempt(
        attempt,
        latestSideResult,
        sideState
      )
    ) {
      throw new LocalStoreError(
        errors.stateConflict,
        "comparison tick IO side is not running from the exact paired checkpoint"
      );
    }

    return {
      attempt,
      comparison: closure.comparison,
      tick,
      checkpointAttempt,
      checkpointOutcome,
      checkpointEvidence,
      providerRequestCountBefore: tick.sequence === 1
        ? checkpointEvidence.provider_request_count_after
        : checkpointAttempt[authority.role].provider_request_count_before,
      deliveryNotBefore: tick.sequence === 1
        ? checkpointOutcome.completed_at
        : checkpointAttempt.attempted_at,
      sideState
    };
  }

  async recordPaperTradingComparisonActivation(
    activation: PaperTradingComparisonActivationRecord
  ): Promise<PaperTradingComparisonActivationRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonActivationUnlocked(activation)
    );
  }

  private async recordPaperTradingComparisonActivationUnlocked(
    activation: PaperTradingComparisonActivationRecord
  ): Promise<PaperTradingComparisonActivationRecord> {
    if (!paperTradingComparisonActivationHasRuntimeShape(activation)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_activation_input",
        "invalid paper trading comparison activation input"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonActivationDigestInput(activation)
      );
    } catch {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_activation_input",
        "paper trading comparison activation is not canonically digestible"
      );
    }
    if (activation.activation_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_digest_mismatch",
        "paper trading comparison activation digest does not match canonical content"
      );
    }

    const existing = await this.getPaperTradingComparisonActivation(
      activation.paper_trading_comparison_activation_id
    );
    if (existing && !samePersistedComparisonRecord(existing, activation)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_conflict",
        "paper trading comparison activation is append-only"
      );
    }

    await this.validatePaperTradingComparisonActivationGraph(activation);
    const comparisonId = activation.paper_trading_comparison_commitment_ref.id;
    const activations = await this.listPaperTradingComparisonActivations(comparisonId);
    const alternate = activations.find((record) =>
      record.paper_trading_comparison_activation_id !==
        activation.paper_trading_comparison_activation_id
    );
    if (alternate) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_pair_conflict",
        "paper trading comparison already has a different activation authorization"
      );
    }
    if (existing) {
      return existing;
    }

    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-activations",
        activation.paper_trading_comparison_activation_id
      ),
      activation
    );
    return activation;
  }

  async getPaperTradingComparisonActivation(
    activationId: string
  ): Promise<PaperTradingComparisonActivationRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-activations",
        activationId
      );
      if (record === undefined) {
        return undefined;
      }
      this.assertPersistedComparisonActivationShape(
        record,
        "paper_trading_comparison_activation_reload_failed"
      );
      return record;
    } catch (error) {
      if (
        error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_activation_reload_failed"
      ) {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_activation_reload_failed",
        "persisted paper trading comparison activation is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonActivations(
    comparisonId: string
  ): Promise<PaperTradingComparisonActivationRecord[]> {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-activations"
      );
      const validated = records.map((record) => {
        this.assertPersistedComparisonActivationShape(
          record,
          "paper_trading_comparison_activation_reload_failed"
        );
        return record;
      });
      return validated
        .filter((record) =>
          record.paper_trading_comparison_commitment_ref.id === comparisonId
        )
        .sort((left, right) =>
          left.authorized_at.localeCompare(right.authorized_at) ||
          left.paper_trading_comparison_activation_id.localeCompare(
            right.paper_trading_comparison_activation_id
          )
        );
    } catch (error) {
      if (
        error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_activation_reload_failed"
      ) {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_activation_reload_failed",
        "persisted paper trading comparison activation collection is unreadable or corrupt"
      );
    }
  }

  private async validatePaperTradingComparisonActivationGraph(
    activation: PaperTradingComparisonActivationRecord
  ): Promise<void> {
    let comparison: PaperTradingComparisonCommitmentRecord | undefined;
    try {
      comparison = await this.getPaperTradingComparisonCommitment(
        activation.paper_trading_comparison_commitment_ref.id
      );
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_graph_invalid",
        "paper trading comparison graph is unreadable or corrupt"
      );
    }
    if (!comparison) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_reference_not_found",
        "paper trading comparison commitment was not found"
      );
    }
    try {
      this.assertPersistedComparisonCommitmentShape(comparison);
      if (
        comparison.commitment_digest !== comparisonExactRecordDigest(
          paperTradingComparisonCommitmentDigestInput(comparison)
        )
      ) {
        throw new Error("comparison digest mismatch");
      }
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_graph_invalid",
        "paper trading comparison commitment is invalid or corrupt"
      );
    }

    let ticks: PaperTradingComparisonTickRecord[];
    try {
      ticks = await this.listPaperTradingComparisonTicks(
        comparison.paper_trading_comparison_commitment_id
      );
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_graph_invalid",
        "paper trading comparison first tick is unreadable or corrupt"
      );
    }
    if (ticks.length === 0) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_reference_not_found",
        "paper trading comparison first tick was not found"
      );
    }
    if (ticks.length !== 1) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_reference_mismatch",
        "paper trading comparison does not have exactly one first tick"
      );
    }
    const [tick] = ticks;
    if (!tick) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_reference_not_found",
        "paper trading comparison first tick was not found"
      );
    }

    const sideMatches = (
      activationSide: PaperTradingComparisonActivationRecord["champion"],
      comparisonSide: PaperTradingComparisonSide
    ): boolean => activationSide.role === comparisonSide.role &&
      paperTradingComparisonRefsEqual(
        activationSide.trading_run_ref,
        comparisonSide.trading_run_ref
      ) &&
      paperTradingComparisonRefsEqual(
        activationSide.paper_trading_evaluation_commitment_ref,
        comparisonSide.paper_trading_evaluation_commitment_ref
      ) &&
      paperTradingComparisonRefsEqual(
        activationSide.paper_trading_evaluation_ref,
        comparisonSide.paper_trading_evaluation_ref
      );
    if (
      activation.paper_trading_comparison_commitment_ref.id !==
        comparison.paper_trading_comparison_commitment_id ||
      activation.paper_trading_comparison_commitment_digest !==
        comparison.commitment_digest ||
      activation.first_tick_ref.id !== tick.paper_trading_comparison_tick_id ||
      activation.first_tick_digest !== tick.tick_digest ||
      tick.paper_trading_comparison_commitment_ref.id !==
        comparison.paper_trading_comparison_commitment_id ||
      tick.paper_trading_comparison_commitment_digest !==
        comparison.commitment_digest ||
      activation.market_data_configuration_digest !==
        comparison.market_data_configuration_digest ||
      tick.market_data_configuration_digest !==
        comparison.market_data_configuration_digest ||
      !sideMatches(activation.champion, comparison.champion) ||
      !sideMatches(activation.challenger, comparison.challenger)
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_reference_mismatch",
        "paper trading comparison activation does not match its frozen pair and first tick"
      );
    }

    const expectedPolicy = paperTradingComparisonActivationPolicyFor(
      comparison.comparison_policy
    );
    if (!samePersistedComparisonRecord(activation.activation_policy, expectedPolicy)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_policy_mismatch",
        "paper trading comparison activation policy was not derived from its frozen pair"
      );
    }
    if (Date.parse(activation.authorized_at) < Date.parse(tick.observed_at)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_time_mismatch",
        "paper trading comparison activation predates its first tick"
      );
    }

    try {
      await this.validatePaperTradingComparisonTickGraph(tick);
      await this.validatePaperTradingComparisonCommitmentGraph(comparison);
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_graph_invalid",
        "paper trading comparison graph is not complete and inert"
      );
    }
  }

  async recordPaperTradingComparisonActivationAttempt(
    attempt: PaperTradingComparisonActivationAttemptRecord
  ): Promise<PaperTradingComparisonActivationAttemptRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonActivationAttemptUnlocked(attempt)
    );
  }

  private async recordPaperTradingComparisonActivationAttemptUnlocked(
    attempt: PaperTradingComparisonActivationAttemptRecord
  ): Promise<PaperTradingComparisonActivationAttemptRecord> {
    if (!paperTradingComparisonActivationAttemptHasRuntimeShape(attempt)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_activation_attempt_input",
        "invalid paper trading comparison activation attempt input"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonActivationAttemptDigestInput(attempt)
      );
    } catch {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_activation_attempt_input",
        "paper trading comparison activation attempt is not canonically digestible"
      );
    }
    if (attempt.attempt_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_digest_mismatch",
        "paper trading comparison activation attempt digest does not match canonical content"
      );
    }

    const existing = await this.getPaperTradingComparisonActivationAttempt(
      attempt.paper_trading_comparison_activation_attempt_id
    );
    if (existing && !samePersistedComparisonRecord(existing, attempt)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_conflict",
        "paper trading comparison activation attempt is append-only"
      );
    }

    const closure = await this.loadPaperTradingComparisonActivationAttemptClosure(attempt);
    const attempts = await this.listPaperTradingComparisonActivationAttempts(
      closure.activation.paper_trading_comparison_activation_id
    );
    if (existing) return existing;

    const latestAttempt = attempts.at(-1);
    if (latestAttempt && attempt.attempt_sequence <= latestAttempt.attempt_sequence) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_state_conflict",
        "paper trading comparison activation already has an open or later attempt"
      );
    }
    const expectedSequence = attempts.length + 1;
    if (attempt.attempt_sequence !== expectedSequence) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_sequence_mismatch",
        "paper trading comparison activation attempt sequence is not contiguous"
      );
    }

    if (!latestAttempt) {
      try {
        await this.validatePaperTradingComparisonActivationGraph(closure.activation);
      } catch {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_attempt_graph_invalid",
          "paper trading comparison activation attempt graph is not complete and inert"
        );
      }
    } else {
      const outcomes = await this.listPaperTradingComparisonActivationOutcomes(
        latestAttempt.paper_trading_comparison_activation_attempt_id
      );
      const latestOutcome = outcomes.at(-1);
      if (!latestOutcome || latestOutcome.outcome_status !== "stopped_cleanly") {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_attempt_state_conflict",
          "paper trading comparison activation retry requires a stopped-cleanly prior attempt"
        );
      }
      if (Date.parse(attempt.attempted_at) <= Date.parse(latestOutcome.completed_at)) {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_attempt_time_mismatch",
          "paper trading comparison activation retry predates its prior outcome"
        );
      }
      const priorResults = await this.listPaperTradingComparisonActivationSideResults(
        latestAttempt.paper_trading_comparison_activation_attempt_id
      );
      const priorChampionResult = latestPaperTradingComparisonActivationSideResult(
        priorResults,
        "champion"
      );
      const priorChallengerResult = latestPaperTradingComparisonActivationSideResult(
        priorResults,
        "challenger"
      );
      const states = await Promise.all([
        this.loadPaperTradingComparisonRuntimeSideState(
          attempt,
          "champion",
          closure.comparison,
          "paper_trading_comparison_activation_attempt_graph_invalid"
        ),
        this.loadPaperTradingComparisonRuntimeSideState(
          attempt,
          "challenger",
          closure.comparison,
          "paper_trading_comparison_activation_attempt_graph_invalid"
        )
      ]);
      if (!priorChampionResult || !priorChallengerResult ||
        !this.paperTradingComparisonSideResultMatchesAttempt(
          latestAttempt,
          priorChampionResult,
          "champion"
        ) ||
        !this.paperTradingComparisonSideResultMatchesAttempt(
          latestAttempt,
          priorChallengerResult,
          "challenger"
        ) ||
        !this.paperTradingComparisonOutcomeResultRefMatches(
          latestOutcome.champion_latest_result_ref,
          priorChampionResult
        ) ||
        !this.paperTradingComparisonOutcomeResultRefMatches(
          latestOutcome.challenger_latest_result_ref,
          priorChallengerResult
        ) ||
        !this.paperTradingComparisonSideIsStoppedCleanly(
          priorChampionResult,
          states[0]
        ) ||
        !this.paperTradingComparisonSideIsStoppedCleanly(
          priorChallengerResult,
          states[1]
        )) {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_attempt_state_conflict",
          "paper trading comparison activation retry requires verified stopped-cleanly evidence"
        );
      }
    }

    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-activation-attempts",
        attempt.paper_trading_comparison_activation_attempt_id
      ),
      attempt
    );
    return attempt;
  }

  async getPaperTradingComparisonActivationAttempt(
    attemptId: string
  ): Promise<PaperTradingComparisonActivationAttemptRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-activation-attempts",
        attemptId
      );
      if (record === undefined) return undefined;
      this.assertPersistedComparisonActivationAttemptShape(
        record,
        "paper_trading_comparison_activation_attempt_reload_failed"
      );
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_activation_attempt_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_reload_failed",
        "persisted paper trading comparison activation attempt is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonActivationAttempts(
    activationId: string
  ): Promise<PaperTradingComparisonActivationAttemptRecord[]> {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-activation-attempts"
      );
      const validated = records.map((record) => {
        this.assertPersistedComparisonActivationAttemptShape(
          record,
          "paper_trading_comparison_activation_attempt_reload_failed"
        );
        return record;
      });
      const filtered = validated
        .filter((record) =>
          record.paper_trading_comparison_activation_ref.id === activationId)
        .sort((left, right) =>
          left.attempt_sequence - right.attempt_sequence ||
          left.paper_trading_comparison_activation_attempt_id.localeCompare(
            right.paper_trading_comparison_activation_attempt_id
          ));
      if (filtered.some((record, index) => record.attempt_sequence !== index + 1)) {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_attempt_reload_failed",
          "persisted paper trading comparison activation attempt sequence is not contiguous"
        );
      }
      return filtered;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_activation_attempt_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_reload_failed",
        "persisted paper trading comparison activation attempt collection is unreadable or corrupt"
      );
    }
  }

  private async loadPaperTradingComparisonActivationAttemptClosure(
    attempt: PaperTradingComparisonActivationAttemptRecord
  ): Promise<{
    activation: PaperTradingComparisonActivationRecord;
    comparison: PaperTradingComparisonCommitmentRecord;
    tick: PaperTradingComparisonTickRecord;
  }> {
    let activation: PaperTradingComparisonActivationRecord | undefined;
    try {
      activation = await this.getPaperTradingComparisonActivation(
        attempt.paper_trading_comparison_activation_ref.id
      );
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_graph_invalid",
        "paper trading comparison activation authorization is unreadable or corrupt"
      );
    }
    if (!activation) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_reference_not_found",
        "paper trading comparison activation authorization was not found"
      );
    }
    let comparison: PaperTradingComparisonCommitmentRecord | undefined;
    let ticks: PaperTradingComparisonTickRecord[];
    try {
      comparison = await this.getPaperTradingComparisonCommitment(
        activation.paper_trading_comparison_commitment_ref.id
      );
      ticks = await this.listPaperTradingComparisonTicks(
        activation.paper_trading_comparison_commitment_ref.id
      );
      if (comparison) {
        this.assertPersistedComparisonCommitmentShape(comparison);
        if (comparison.commitment_digest !== comparisonExactRecordDigest(
          paperTradingComparisonCommitmentDigestInput(comparison)
        )) {
          throw new Error("comparison digest mismatch");
        }
      }
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_graph_invalid",
        "paper trading comparison activation closure is unreadable or corrupt"
      );
    }
    const tick = ticks.find((record) => record.sequence === 1);
    if (!comparison || !tick) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_graph_invalid",
        "paper trading comparison activation closure is incomplete"
      );
    }
    if (
      !paperTradingComparisonRefsEqual(
        attempt.paper_trading_comparison_activation_ref,
        {
          record_kind: activation.record_kind,
          id: activation.paper_trading_comparison_activation_id
        }
      ) ||
      attempt.paper_trading_comparison_activation_digest !== activation.activation_digest ||
      !paperTradingComparisonRefsEqual(
        attempt.paper_trading_comparison_commitment_ref,
        activation.paper_trading_comparison_commitment_ref
      ) ||
      attempt.paper_trading_comparison_commitment_digest !==
        activation.paper_trading_comparison_commitment_digest ||
      !paperTradingComparisonRefsEqual(attempt.first_tick_ref, activation.first_tick_ref) ||
      attempt.first_tick_digest !== activation.first_tick_digest ||
      !samePersistedComparisonRecord(attempt.champion, activation.champion) ||
      !samePersistedComparisonRecord(attempt.challenger, activation.challenger) ||
      activation.paper_trading_comparison_commitment_ref.id !==
        comparison.paper_trading_comparison_commitment_id ||
      activation.paper_trading_comparison_commitment_digest !== comparison.commitment_digest ||
      activation.first_tick_ref.id !== tick.paper_trading_comparison_tick_id ||
      activation.first_tick_digest !== tick.tick_digest
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_reference_mismatch",
        "paper trading comparison activation attempt does not match its frozen closure"
      );
    }
    if (!samePersistedComparisonRecord(
      attempt.activation_policy,
      activation.activation_policy
    )) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_policy_mismatch",
        "paper trading comparison activation attempt policy does not match authorization"
      );
    }
    if (Date.parse(attempt.attempted_at) < Date.parse(activation.authorized_at)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_attempt_time_mismatch",
        "paper trading comparison activation attempt predates authorization"
      );
    }
    return { activation, comparison, tick };
  }

  async recordPaperTradingComparisonActivationSideResult(
    result: PaperTradingComparisonActivationSideResultRecord
  ): Promise<PaperTradingComparisonActivationSideResultRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonActivationSideResultUnlocked(result)
    );
  }

  private async recordPaperTradingComparisonActivationSideResultUnlocked(
    result: PaperTradingComparisonActivationSideResultRecord
  ): Promise<PaperTradingComparisonActivationSideResultRecord> {
    if (!paperTradingComparisonActivationSideResultHasRuntimeShape(result)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_activation_side_result_input",
        "invalid paper trading comparison activation side result input"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonActivationSideResultDigestInput(result)
      );
    } catch {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_activation_side_result_input",
        "paper trading comparison activation side result is not canonically digestible"
      );
    }
    if (result.side_result_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_digest_mismatch",
        "paper trading comparison activation side result digest does not match canonical content"
      );
    }

    const existing = await this.getPaperTradingComparisonActivationSideResult(
      result.paper_trading_comparison_activation_side_result_id
    );
    if (existing && !samePersistedComparisonRecord(existing, result)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_conflict",
        "paper trading comparison activation side result is append-only"
      );
    }
    const attempt = await this.getPaperTradingComparisonActivationAttempt(
      result.paper_trading_comparison_activation_attempt_ref.id
    );
    if (!attempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_reference_not_found",
        "paper trading comparison activation attempt was not found"
      );
    }
    const closure = await this.loadPaperTradingComparisonActivationAttemptClosure(attempt);
    const side = attempt[result.role];
    if (
      result.paper_trading_comparison_activation_attempt_digest !== attempt.attempt_digest ||
      !paperTradingComparisonRefsEqual(
        result.paper_trading_comparison_activation_ref,
        attempt.paper_trading_comparison_activation_ref
      ) ||
      result.paper_trading_comparison_activation_digest !==
        attempt.paper_trading_comparison_activation_digest ||
      !paperTradingComparisonRefsEqual(result.trading_run_ref, side.trading_run_ref) ||
      !paperTradingComparisonRefsEqual(
        result.paper_trading_evaluation_ref,
        side.paper_trading_evaluation_ref
      )
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_reference_mismatch",
        "paper trading comparison activation side result does not match its bound side"
      );
    }
    if (result.provider_request_count >
      attempt.activation_policy.maximum_provider_request_count_per_side) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_policy_mismatch",
        "paper trading comparison activation side result exceeds its provider request budget"
      );
    }
    if (Date.parse(result.effect_started_at) < Date.parse(attempt.attempted_at)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_state_mismatch",
        "paper trading comparison activation side effect predates its attempt"
      );
    }

    const results = await this.listPaperTradingComparisonActivationSideResults(
      attempt.paper_trading_comparison_activation_attempt_id
    );
    if (existing) return existing;
    const roleResults = results.filter((record) => record.role === result.role);
    if (result.operation_sequence !== roleResults.length + 1) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_sequence_mismatch",
        "paper trading comparison activation side operation sequence is not contiguous"
      );
    }
    const outcomes = await this.listPaperTradingComparisonActivationOutcomes(
      attempt.paper_trading_comparison_activation_attempt_id
    );
    const latestOutcome = outcomes.at(-1);
    const priorRoleResult = roleResults.at(-1);
    if (priorRoleResult && Date.parse(result.effect_started_at) <
      Date.parse(priorRoleResult.effect_completed_at) ||
      result.operation === "stop" && latestOutcome &&
        Date.parse(result.effect_started_at) < Date.parse(latestOutcome.completed_at)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_state_mismatch",
        "paper trading comparison activation side effects are not time ordered"
      );
    }
    if (result.operation === "start" && (roleResults.length > 0 || latestOutcome)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_sequence_mismatch",
        "paper trading comparison activation side start is already settled"
      );
    }
    if (result.operation === "stop") {
      const startResult = roleResults.find((record) => record.operation === "start");
      if (!startResult || latestOutcome?.outcome_status === "stopped_cleanly") {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_side_result_state_mismatch",
          "paper trading comparison activation side stop has no recoverable start state"
        );
      }
    }

    const state = await this.loadPaperTradingComparisonRuntimeSideState(
      attempt,
      result.role,
      closure.comparison,
      "paper_trading_comparison_activation_side_result_graph_invalid",
      { allowCommittedCheckpoint: result.operation === "stop" }
    );
    if (
      result.runtime_lifecycle_status !== "unknown" &&
        result.runtime_lifecycle_status !== state.run.runtime_lifecycle_status ||
      result.evaluation_status !== "unknown" &&
        result.evaluation_status !== state.evaluation.status
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_state_mismatch",
        "paper trading comparison activation side result does not match current runtime state"
      );
    }
    let resultSandbox: SandboxDetailReadModel | undefined;
    if (result.sandbox_ref) {
      try {
        resultSandbox = await this.getSandbox(result.sandbox_ref.id);
      } catch {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_side_result_graph_invalid",
          "paper trading comparison activation sandbox state is unreadable or corrupt"
        );
      }
      if (!resultSandbox || resultSandbox.sandbox_id !== result.sandbox_ref.id ||
        resultSandbox.authority_status !== "not_live" ||
        !paperTradingComparisonRefsEqual(resultSandbox.runtime_ref, side.trading_run_ref) ||
        !paperTradingComparisonRefsEqual(
          resultSandbox.system_code_ref,
          state.commitment.system_code_ref
        )) {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_side_result_state_mismatch",
          "paper trading comparison activation side result sandbox does not match its run"
        );
      }
    }
    if (result.operation === "start" && result.outcome === "succeeded" &&
      (!resultSandbox || resultSandbox.lifecycle_status !== "running" ||
        !isIsoTimestamp(resultSandbox.started_at) ||
        !paperTradingComparisonRefsEqual(state.run.sandbox_ref, result.sandbox_ref))) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_state_mismatch",
        "paper trading comparison activation start result lacks a running sandbox"
      );
    }
    if (result.operation === "stop" && result.outcome === "succeeded" &&
      resultSandbox && !["stopped", "removed"].includes(resultSandbox.lifecycle_status)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_state_mismatch",
        "paper trading comparison activation stop result sandbox is still active"
      );
    }

    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-activation-side-results",
        result.paper_trading_comparison_activation_side_result_id
      ),
      result
    );
    return result;
  }

  async getPaperTradingComparisonActivationSideResult(
    resultId: string
  ): Promise<PaperTradingComparisonActivationSideResultRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-activation-side-results",
        resultId
      );
      if (record === undefined) return undefined;
      this.assertPersistedComparisonActivationSideResultShape(
        record,
        "paper_trading_comparison_activation_side_result_reload_failed"
      );
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_activation_side_result_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_reload_failed",
        "persisted paper trading comparison activation side result is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonActivationSideResults(
    attemptId: string
  ): Promise<PaperTradingComparisonActivationSideResultRecord[]> {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-activation-side-results"
      );
      const validated = records.map((record) => {
        this.assertPersistedComparisonActivationSideResultShape(
          record,
          "paper_trading_comparison_activation_side_result_reload_failed"
        );
        return record;
      });
      const filtered = validated
        .filter((record) =>
          record.paper_trading_comparison_activation_attempt_ref.id === attemptId)
        .sort((left, right) =>
          (left.role === "champion" ? 0 : 1) -
            (right.role === "champion" ? 0 : 1) ||
          left.operation_sequence - right.operation_sequence ||
          left.paper_trading_comparison_activation_side_result_id.localeCompare(
            right.paper_trading_comparison_activation_side_result_id
          ));
      for (const role of ["champion", "challenger"] as const) {
        if (filtered.filter((record) => record.role === role).some(
          (record, index) => record.operation_sequence !== index + 1
        )) {
          throw new LocalStoreError(
            "paper_trading_comparison_activation_side_result_reload_failed",
            "persisted paper trading comparison activation side sequence is not contiguous"
          );
        }
      }
      return filtered;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_activation_side_result_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_activation_side_result_reload_failed",
        "persisted paper trading comparison activation side result collection is unreadable or corrupt"
      );
    }
  }

  private async loadPaperTradingComparisonRuntimeSideState(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    role: "champion" | "challenger",
    comparison: PaperTradingComparisonCommitmentRecord,
    errorCode: LocalStoreErrorCode,
    options: { allowCommittedCheckpoint?: boolean } = {}
  ): Promise<PaperTradingComparisonRuntimeSideState> {
    try {
      const activationSide = attempt[role];
      const comparisonSide = comparison[role];
      const [run, commitments, evaluations, observations] = await Promise.all([
        this.getTradingRun(activationSide.trading_run_ref.id),
        this.scanPaperTradingComparisonCommitments(errorCode),
        this.scanPaperTradingComparisonEvaluations(errorCode),
        this.scanPaperTradingComparisonObservations(errorCode)
      ]);
      const commitment = commitments.find((record) =>
        record.paper_trading_evaluation_commitment_id ===
          activationSide.paper_trading_evaluation_commitment_ref.id);
      const evaluation = evaluations.find((record) =>
        record.paper_trading_evaluation_id ===
          activationSide.paper_trading_evaluation_ref.id);
      if (!run || !commitment || !evaluation) throw new Error("side reference missing");
      const baseline = paperTradingComparisonBaselineEvaluation(
        commitment,
        activationSide.paper_trading_evaluation_ref
      );
      const expectedStatus = evaluation.status === "not_started" ||
        evaluation.status === "running" || evaluation.status === "stopped"
        ? evaluation.status
        : undefined;
      const sideObservations = observations.filter((record) =>
        paperTradingComparisonRefsEqual(
          record.paper_trading_evaluation_ref,
          activationSide.paper_trading_evaluation_ref
        ));
      const hasZeroEvidenceState = expectedStatus !== undefined &&
        paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
          evaluation,
          baseline,
          expectedStatus
        ) && sideObservations.length === 0 &&
        (run.order_request_refs?.length ?? 0) === 0 &&
        (run.gateway_result_refs?.length ?? 0) === 0 &&
        (run.execution_result_refs?.length ?? 0) === 0;
      const hasCommittedCheckpointState = options.allowCommittedCheckpoint === true &&
        await this.paperTradingComparisonRuntimeSideHasCommittedCheckpointState({
          attempt,
          role,
          run,
          evaluation,
          observations: sideObservations
        });
      if (
        run.record_kind !== "trading_run" ||
        run.version !== 1 ||
        run.trading_run_id !== activationSide.trading_run_ref.id ||
        run.stage_binding_profile !== "paper" ||
        run.paper_evidence_purpose !== "qualification" ||
        !isTradingRunLifecycleStatus(run.runtime_lifecycle_status) ||
        run.authority_status !== "not_live" ||
        activationSide.role !== comparisonSide.role ||
        !paperTradingComparisonRefsEqual(
          activationSide.trading_run_ref,
          comparisonSide.trading_run_ref
        ) ||
        !paperTradingComparisonRefsEqual(
          activationSide.paper_trading_evaluation_commitment_ref,
          comparisonSide.paper_trading_evaluation_commitment_ref
        ) ||
        !paperTradingComparisonRefsEqual(
          activationSide.paper_trading_evaluation_ref,
          comparisonSide.paper_trading_evaluation_ref
        ) ||
        comparisonSide.paper_trading_evaluation_commitment_digest !==
          commitment.commitment_digest ||
        comparisonSide.paper_trading_evaluation_commitment_record_digest !==
          comparisonExactRecordDigest(
            paperTradingComparisonEvaluationCommitmentRecordDigestInput(commitment)
          ) ||
        commitment.commitment_digest !== comparisonExactRecordDigest(
          paperTradingEvaluationCommitmentDigestInput(commitment)
        ) ||
        comparisonSide.paper_trading_evaluation_record_digest !==
          comparisonExactRecordDigest(
            paperTradingComparisonEvaluationRecordDigestInput(baseline)
          ) ||
        !paperTradingEvaluationReferencesMatch(evaluation, commitment) ||
        !paperTradingComparisonRefsEqual(run.candidate_ref, commitment.candidate_ref) ||
        !paperTradingComparisonRefsEqual(
          run.candidate_version_ref,
          commitment.candidate_version_ref
        ) ||
        !paperTradingComparisonRefsEqual(run.system_code_ref, commitment.system_code_ref) ||
        (!hasZeroEvidenceState && !hasCommittedCheckpointState)
      ) {
        throw new Error("side state mismatch");
      }
      let sandbox: SandboxDetailReadModel | undefined;
      if (run.sandbox_ref) {
        sandbox = await this.getSandbox(run.sandbox_ref.id);
        if (!sandbox || sandbox.sandbox_id !== run.sandbox_ref.id ||
          sandbox.authority_status !== "not_live" ||
          !paperTradingComparisonRefsEqual(
            sandbox.runtime_ref,
            activationSide.trading_run_ref
          ) ||
          !paperTradingComparisonRefsEqual(
            sandbox.system_code_ref,
            commitment.system_code_ref
          )) {
          throw new Error("sandbox mismatch");
        }
      }
      return {
        comparisonSide,
        run,
        commitment,
        evaluation,
        baseline,
        evidenceState: hasCommittedCheckpointState ? "paired_checkpoint" : "zero",
        sandbox
      };
    } catch (error) {
      if (error instanceof LocalStoreError && error.code === errorCode) throw error;
      throw new LocalStoreError(
        errorCode,
        `paper trading comparison runtime ${role} side is unreadable or inconsistent`
      );
    }
  }

  private async paperTradingComparisonRuntimeSideHasCommittedCheckpointState(input: {
    attempt: PaperTradingComparisonActivationAttemptRecord;
    role: "champion" | "challenger";
    run: TradingRunRecord;
    evaluation: PaperTradingEvaluationRecord;
    observations: PaperTradingObservationRecord[];
  }): Promise<boolean> {
    try {
      const checkpointAttempts = await this.listPaperTradingComparisonCheckpointAttempts(
        input.attempt.paper_trading_comparison_activation_attempt_id
      );
      const committed: Array<{
        attempt: PaperTradingComparisonCheckpointAttemptRecord;
        transaction: LocalPaperTradingComparisonCheckpointTransaction;
      }> = [];
      let reachedUncommittedAttempt = false;
      for (const checkpointAttempt of checkpointAttempts) {
        const [transaction, outcomes] = await Promise.all([
          this.getPaperTradingComparisonCheckpointTransaction(
            checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
          ),
          this.listPaperTradingComparisonCheckpointOutcomes(
            checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
          )
        ]);
        if (!transaction) {
          reachedUncommittedAttempt = true;
          if (outcomes.some((outcome) => outcome.outcome_status === "paired")) return false;
          continue;
        }
        if (reachedUncommittedAttempt ||
          transaction.checkpoint_attempt_digest !== checkpointAttempt.attempt_digest ||
          transaction.outcome.outcome_status !== "paired" ||
          transaction.outcome.checkpoint_sequence !== checkpointAttempt.checkpoint_sequence ||
          outcomes.length !== 1 ||
          !samePersistedComparisonRecord(outcomes[0], transaction.outcome)) {
          return false;
        }
        committed.push({ attempt: checkpointAttempt, transaction });
      }
      if (committed.length === 0 || checkpointAttempts.length - committed.length > 1) {
        return false;
      }
      const observations = [...input.observations].sort((left, right) =>
        left.sequence - right.sequence ||
        left.paper_trading_observation_id.localeCompare(
          right.paper_trading_observation_id
        ));
      if (observations.length !== committed.length) return false;
      const ledgerRefIds: string[] = [];
      for (let index = 0; index < committed.length; index += 1) {
        const current = committed[index]!;
        const previous = committed[index - 1];
        const transactionSide = current.transaction[input.role];
        const evidence = current.transaction.outcome[input.role];
        const observation = observations[index];
        if (!evidence || !observation ||
          current.attempt.checkpoint_sequence !== index + 1 ||
          observation.sequence !== current.attempt.checkpoint_sequence ||
          !samePersistedComparisonRecord(
            observation,
            transactionSide.prepared.observation
          ) ||
          !paperTradingComparisonRefsEqual(
            observation.paper_trading_comparison_checkpoint_attempt_ref,
            current.transaction.checkpoint_attempt_ref
          ) ||
          observation.paper_trading_comparison_checkpoint_attempt_digest !==
            current.transaction.checkpoint_attempt_digest ||
          evidence.consumed_event_count !==
            transactionSide.prepared.consumed_event_count ||
          evidence.provider_request_count_after !==
            transactionSide.prepared.provider_request_count_after ||
          previous && !samePersistedComparisonRecord(
            transactionSide.previous_evaluation,
            previous.transaction[input.role].prepared.evaluation
          )) {
          return false;
        }
        ledgerRefIds.push(...evidence.ledger_chain_refs.map((ref) => ref.id));
      }
      const latestCommitted = committed.at(-1)!;
      const committedEvaluation = latestCommitted.transaction[
        input.role
      ].prepared.evaluation;
      const normalizedEvaluation = input.evaluation.status === "stopped" &&
        committedEvaluation.status === "running"
        ? stripUndefined({
            ...input.evaluation,
            status: "running" as const,
            next_observation_at: committedEvaluation.next_observation_at,
            stopped_at: committedEvaluation.stopped_at
          })
        : input.evaluation;
      return samePersistedComparisonRecord(normalizedEvaluation, committedEvaluation) &&
        input.run.trading_run_id ===
          latestCommitted.attempt[input.role].trading_run_ref.id &&
        samePersistedComparisonRecord(
          (input.run.order_request_refs ?? []).map((ref) => ref.id),
          ledgerRefIds
        );
    } catch {
      return false;
    }
  }

  async recordPaperTradingComparisonActivationOutcome(
    outcome: PaperTradingComparisonActivationOutcomeRecord
  ): Promise<PaperTradingComparisonActivationOutcomeRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonActivationOutcomeUnlocked(outcome)
    );
  }

  private async recordPaperTradingComparisonActivationOutcomeUnlocked(
    outcome: PaperTradingComparisonActivationOutcomeRecord
  ): Promise<PaperTradingComparisonActivationOutcomeRecord> {
    if (!paperTradingComparisonActivationOutcomeHasRuntimeShape(outcome)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_activation_outcome_input",
        "invalid paper trading comparison activation outcome input"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonActivationOutcomeDigestInput(outcome)
      );
    } catch {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_activation_outcome_input",
        "paper trading comparison activation outcome is not canonically digestible"
      );
    }
    if (outcome.outcome_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_digest_mismatch",
        "paper trading comparison activation outcome digest does not match canonical content"
      );
    }
    const existing = await this.getPaperTradingComparisonActivationOutcome(
      outcome.paper_trading_comparison_activation_outcome_id
    );
    if (existing && !samePersistedComparisonRecord(existing, outcome)) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_conflict",
        "paper trading comparison activation outcome is append-only"
      );
    }
    const attempt = await this.getPaperTradingComparisonActivationAttempt(
      outcome.paper_trading_comparison_activation_attempt_ref.id
    );
    if (!attempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_reference_not_found",
        "paper trading comparison activation attempt was not found"
      );
    }
    const closure = await this.loadPaperTradingComparisonActivationAttemptClosure(attempt);
    if (
      outcome.paper_trading_comparison_activation_attempt_digest !== attempt.attempt_digest ||
      !paperTradingComparisonRefsEqual(
        outcome.paper_trading_comparison_activation_ref,
        attempt.paper_trading_comparison_activation_ref
      ) ||
      outcome.paper_trading_comparison_activation_digest !==
        attempt.paper_trading_comparison_activation_digest
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_reference_mismatch",
        "paper trading comparison activation outcome does not match its attempt"
      );
    }

    const outcomes = await this.listPaperTradingComparisonActivationOutcomes(
      attempt.paper_trading_comparison_activation_attempt_id
    );
    if (existing) return existing;
    const prior = outcomes.at(-1);
    if (outcome.outcome_sequence !== outcomes.length + 1 ||
      (prior === undefined) !== (outcome.previous_outcome_ref === undefined) ||
      prior && outcome.previous_outcome_ref?.id !==
        prior.paper_trading_comparison_activation_outcome_id) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_sequence_mismatch",
        "paper trading comparison activation outcome sequence is not contiguous"
      );
    }
    if (prior?.outcome_status === "stopped_cleanly") {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_state_mismatch",
        "paper trading comparison activation stopped-cleanly outcome is terminal for its attempt"
      );
    }

    const results = await this.listPaperTradingComparisonActivationSideResults(
      attempt.paper_trading_comparison_activation_attempt_id
    );
    const championResult = latestPaperTradingComparisonActivationSideResult(
      results,
      "champion"
    );
    const challengerResult = latestPaperTradingComparisonActivationSideResult(
      results,
      "challenger"
    );
    if (!this.paperTradingComparisonOutcomeResultRefMatches(
      outcome.champion_latest_result_ref,
      championResult
    ) || !this.paperTradingComparisonOutcomeResultRefMatches(
      outcome.challenger_latest_result_ref,
      challengerResult
    ) || championResult && !this.paperTradingComparisonSideResultMatchesAttempt(
      attempt,
      championResult,
      "champion"
    ) || challengerResult && !this.paperTradingComparisonSideResultMatchesAttempt(
      attempt,
      challengerResult,
      "challenger"
    )) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_reference_mismatch",
        "paper trading comparison activation outcome does not reference latest side results"
      );
    }
    if (Date.parse(outcome.completed_at) < Date.parse(attempt.attempted_at) ||
      [championResult, challengerResult].some((result) => result &&
        Date.parse(outcome.completed_at) < Date.parse(result.effect_completed_at))) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_state_mismatch",
        "paper trading comparison activation outcome predates its side evidence"
      );
    }

    const [championState, challengerState] = await Promise.all([
      this.loadPaperTradingComparisonRuntimeSideState(
        attempt,
        "champion",
        closure.comparison,
        "paper_trading_comparison_activation_outcome_graph_invalid",
        { allowCommittedCheckpoint: outcome.outcome_status !== "both_running" }
      ),
      this.loadPaperTradingComparisonRuntimeSideState(
        attempt,
        "challenger",
        closure.comparison,
        "paper_trading_comparison_activation_outcome_graph_invalid",
        { allowCommittedCheckpoint: outcome.outcome_status !== "both_running" }
      )
    ]);
    if (outcome.outcome_status === "both_running") {
      if (!championResult || !challengerResult ||
        Date.parse(outcome.completed_at) > Date.parse(attempt.start_deadline_at) ||
        !this.paperTradingComparisonSideIsRunningWithinAttempt(
          attempt,
          championResult,
          championState
        ) ||
        !this.paperTradingComparisonSideIsRunningWithinAttempt(
          attempt,
          challengerResult,
          challengerState
        ) ||
        Math.abs(
          Date.parse(championState.sandbox!.started_at!) -
          Date.parse(challengerState.sandbox!.started_at!)
        ) > attempt.activation_policy.maximum_start_skew_ms) {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_outcome_state_mismatch",
          "paper trading comparison activation sides are not both running within policy"
        );
      }
    } else if (outcome.outcome_status === "stopped_cleanly") {
      if (!championResult || !challengerResult ||
        !this.paperTradingComparisonSideIsStoppedCleanly(championResult, championState) ||
        !this.paperTradingComparisonSideIsStoppedCleanly(challengerResult, challengerState)) {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_outcome_state_mismatch",
          "paper trading comparison activation sides are not both stopped cleanly"
        );
      }
    } else if (!this.paperTradingComparisonCleanupRequiredHasEvidence(
      outcome,
      championResult,
      challengerResult,
      championState,
      challengerState
    )) {
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_state_mismatch",
        "paper trading comparison cleanup-required outcome lacks failure or uncertainty evidence"
      );
    }

    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-activation-outcomes",
        outcome.paper_trading_comparison_activation_outcome_id
      ),
      outcome
    );
    return outcome;
  }

  async getPaperTradingComparisonActivationOutcome(
    outcomeId: string
  ): Promise<PaperTradingComparisonActivationOutcomeRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-activation-outcomes",
        outcomeId
      );
      if (record === undefined) return undefined;
      this.assertPersistedComparisonActivationOutcomeShape(
        record,
        "paper_trading_comparison_activation_outcome_reload_failed"
      );
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_activation_outcome_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_reload_failed",
        "persisted paper trading comparison activation outcome is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonActivationOutcomes(
    attemptId: string
  ): Promise<PaperTradingComparisonActivationOutcomeRecord[]> {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-activation-outcomes"
      );
      const validated = records.map((record) => {
        this.assertPersistedComparisonActivationOutcomeShape(
          record,
          "paper_trading_comparison_activation_outcome_reload_failed"
        );
        return record;
      });
      const filtered = validated
        .filter((record) =>
          record.paper_trading_comparison_activation_attempt_ref.id === attemptId)
        .sort((left, right) =>
          left.outcome_sequence - right.outcome_sequence ||
          left.paper_trading_comparison_activation_outcome_id.localeCompare(
            right.paper_trading_comparison_activation_outcome_id
          ));
      if (filtered.some((record, index) =>
        record.outcome_sequence !== index + 1 ||
        (index === 0
          ? record.previous_outcome_ref !== undefined
          : record.previous_outcome_ref?.id !==
            filtered[index - 1]?.paper_trading_comparison_activation_outcome_id))) {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_outcome_reload_failed",
          "persisted paper trading comparison activation outcome chain is not contiguous"
        );
      }
      return filtered;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_activation_outcome_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_activation_outcome_reload_failed",
        "persisted paper trading comparison activation outcome collection is unreadable or corrupt"
      );
    }
  }

  async recordPaperTradingComparisonCheckpointAttempt(
    attempt: PaperTradingComparisonCheckpointAttemptRecord
  ): Promise<PaperTradingComparisonCheckpointAttemptRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonCheckpointAttemptUnlocked(attempt)
    );
  }

  private async recordPaperTradingComparisonCheckpointAttemptUnlocked(
    attempt: PaperTradingComparisonCheckpointAttemptRecord
  ): Promise<PaperTradingComparisonCheckpointAttemptRecord> {
    if (!paperTradingComparisonCheckpointAttemptHasRuntimeShape(attempt)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_checkpoint_attempt_input",
        "invalid paper trading comparison checkpoint attempt input"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonCheckpointAttemptDigestInput(attempt)
      );
    } catch {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_checkpoint_attempt_input",
        "paper trading comparison checkpoint attempt is not canonically digestible"
      );
    }
    if (attempt.attempt_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_digest_mismatch",
        "paper trading comparison checkpoint attempt digest does not match canonical content"
      );
    }

    const existing = await this.getPaperTradingComparisonCheckpointAttempt(
      attempt.paper_trading_comparison_checkpoint_attempt_id
    );
    if (existing && !samePersistedComparisonRecord(existing, attempt)) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_conflict",
        "paper trading comparison checkpoint attempt is append-only"
      );
    }
    if (existing) return existing;

    const activationAttempt = await this.getPaperTradingComparisonActivationAttempt(
      attempt.paper_trading_comparison_activation_attempt_ref.id
    );
    if (!activationAttempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_reference_not_found",
        "paper trading comparison activation attempt was not found"
      );
    }
    let closure: {
      activation: PaperTradingComparisonActivationRecord;
      comparison: PaperTradingComparisonCommitmentRecord;
      tick: PaperTradingComparisonTickRecord;
    };
    try {
      closure = await this.loadPaperTradingComparisonActivationAttemptClosure(
        activationAttempt
      );
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_graph_invalid",
        "paper trading comparison checkpoint activation graph is unreadable"
      );
    }
    const [tick, activationOutcomes, activationResults, existingAttempts] =
      await Promise.all([
        this.getPaperTradingComparisonTick(attempt.tick_ref.id),
        this.listPaperTradingComparisonActivationOutcomes(
          activationAttempt.paper_trading_comparison_activation_attempt_id
        ),
        this.listPaperTradingComparisonActivationSideResults(
          activationAttempt.paper_trading_comparison_activation_attempt_id
        ),
        this.listPaperTradingComparisonCheckpointAttempts(
          activationAttempt.paper_trading_comparison_activation_attempt_id
        )
      ]);
    const activationOutcome = activationOutcomes.at(-1);
    if (!tick || !activationOutcome) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_reference_not_found",
        "paper trading comparison checkpoint tick or activation outcome was not found"
      );
    }
    const expectedSequence = existingAttempts.length + 1;
    if (attempt.checkpoint_sequence !== expectedSequence) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_state_conflict",
        "paper trading comparison checkpoint attempt sequence is not contiguous"
      );
    }
    const previousAttempt = existingAttempts.at(-1);
    let previousOutcome: PaperTradingComparisonCheckpointOutcomeRecord | undefined;
    if (previousAttempt) {
      const previousOutcomes = await this.listPaperTradingComparisonCheckpointOutcomes(
        previousAttempt.paper_trading_comparison_checkpoint_attempt_id
      );
      previousOutcome = previousOutcomes[0];
      if (previousOutcomes.length !== 1 || !previousOutcome ||
        previousOutcome.outcome_status !== "paired" ||
        previousOutcome.checkpoint_sequence !== previousAttempt.checkpoint_sequence ||
        previousOutcome.checkpoint_attempt_digest !== previousAttempt.attempt_digest ||
        previousOutcome.champion?.observation_status === "failed" ||
        previousOutcome.challenger?.observation_status === "failed") {
        throw new LocalStoreError(
          "paper_trading_comparison_checkpoint_attempt_state_conflict",
          "paper trading comparison previous checkpoint is not exactly paired"
        );
      }
    }
    const championResult = latestPaperTradingComparisonActivationSideResult(
      activationResults,
      "champion"
    );
    const challengerResult = latestPaperTradingComparisonActivationSideResult(
      activationResults,
      "challenger"
    );
    if (
      attempt.paper_trading_comparison_activation_digest !==
        closure.activation.activation_digest ||
      !paperTradingComparisonRefsEqual(
        attempt.paper_trading_comparison_activation_ref,
        activationAttempt.paper_trading_comparison_activation_ref
      ) ||
      attempt.paper_trading_comparison_activation_attempt_digest !==
        activationAttempt.attempt_digest ||
      !paperTradingComparisonRefsEqual(
        attempt.activation_outcome_ref,
        {
          record_kind: "paper_trading_comparison_activation_outcome",
          id: activationOutcome.paper_trading_comparison_activation_outcome_id
        }
      ) ||
      attempt.activation_outcome_digest !== activationOutcome.outcome_digest ||
      activationOutcome.outcome_status !== "both_running" ||
      !paperTradingComparisonRefsEqual(
        attempt.paper_trading_comparison_commitment_ref,
        activationAttempt.paper_trading_comparison_commitment_ref
      ) ||
      attempt.paper_trading_comparison_commitment_digest !==
        activationAttempt.paper_trading_comparison_commitment_digest ||
      tick.sequence !== attempt.checkpoint_sequence ||
      tick.paper_trading_comparison_tick_id !== attempt.tick_ref.id ||
      tick.tick_digest !== attempt.tick_digest
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_reference_mismatch",
        "paper trading comparison checkpoint attempt does not match its activation and tick"
      );
    }
    if (attempt.checkpoint_sequence === 1) {
      if (!paperTradingComparisonRefsEqual(attempt.tick_ref, activationAttempt.first_tick_ref) ||
        attempt.tick_digest !== activationAttempt.first_tick_digest ||
        previousAttempt !== undefined || previousOutcome !== undefined) {
        throw new LocalStoreError(
          "paper_trading_comparison_checkpoint_attempt_reference_mismatch",
          "first paper trading comparison checkpoint does not match the activation first tick"
        );
      }
    } else if (!previousAttempt || !previousOutcome ||
      !paperTradingComparisonRefsEqual(attempt.previous_checkpoint_outcome_ref, {
        record_kind: "paper_trading_comparison_checkpoint_outcome",
        id: previousOutcome.paper_trading_comparison_checkpoint_outcome_id
      }) ||
      attempt.previous_checkpoint_outcome_digest !== previousOutcome.outcome_digest ||
      previousAttempt.checkpoint_sequence !== attempt.checkpoint_sequence - 1 ||
      previousOutcome.checkpoint_sequence !== attempt.checkpoint_sequence - 1 ||
      !paperTradingComparisonRefsEqual(tick.previous_tick_ref, previousAttempt.tick_ref) ||
      tick.previous_tick_digest !== previousAttempt.tick_digest) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_reference_mismatch",
        "paper trading comparison checkpoint does not bind its exact prior outcome and tick"
      );
    }
    const predecessorCompletedAt = previousOutcome?.completed_at ??
      activationOutcome.completed_at;
    if (
      Date.parse(attempt.attempted_at) <= Math.max(
        Date.parse(activationOutcome.completed_at),
        Date.parse(predecessorCompletedAt),
        Date.parse(tick.observed_at)
      ) ||
      Date.parse(attempt.checkpoint_deadline_at) >
        Date.parse(activationAttempt.attempted_at) +
          closure.comparison.comparison_policy.maximum_elapsed_ms
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_state_mismatch",
        "paper trading comparison checkpoint attempt exceeds its frozen time window"
      );
    }
    const [
      championState,
      challengerState,
      championObservations,
      challengerObservations,
      acknowledgements
    ] = await Promise.all([
      this.loadPaperTradingComparisonRuntimeSideState(
        activationAttempt,
        "champion",
        closure.comparison,
        "paper_trading_comparison_checkpoint_attempt_graph_invalid",
        { allowCommittedCheckpoint: attempt.checkpoint_sequence > 1 }
      ),
      this.loadPaperTradingComparisonRuntimeSideState(
        activationAttempt,
        "challenger",
        closure.comparison,
        "paper_trading_comparison_checkpoint_attempt_graph_invalid",
        { allowCommittedCheckpoint: attempt.checkpoint_sequence > 1 }
      ),
      this.listPaperTradingObservations(
        activationAttempt.champion.paper_trading_evaluation_ref.id
      ),
      this.listPaperTradingObservations(
        activationAttempt.challenger.paper_trading_evaluation_ref.id
      ),
      this.listPaperTradingComparisonTickAcknowledgements(
        activationAttempt.paper_trading_comparison_activation_attempt_id
      )
    ]);
    const sideBaseline = (
      role: "champion" | "challenger",
      state: PaperTradingComparisonRuntimeSideState,
      observations: PaperTradingObservationRecord[],
      result: PaperTradingComparisonActivationSideResultRecord | undefined
    ) => {
      const priorAcknowledgements = previousAttempt
        ? acknowledgements.filter((record) =>
            record.role === role &&
            record.tick_ref.id === previousAttempt.tick_ref.id)
        : [];
      const priorAcknowledgement = priorAcknowledgements[0];
      const priorEvidence = previousOutcome?.[role];
      const providerEvidenceOrderingMatches = Boolean(
        previousOutcome && priorEvidence && priorAcknowledgement &&
        (previousOutcome.checkpoint_sequence === 1
          ? priorAcknowledgement.provider_request_count_at_acknowledgement >=
            priorEvidence.provider_request_count_after
          : priorAcknowledgement.provider_request_count_at_acknowledgement <=
            priorEvidence.provider_request_count_after)
      );
      const providerBaselineMatches = attempt.checkpoint_sequence === 1
        ? attempt[role].provider_request_count_before === result?.provider_request_count
        : Boolean(
            previousAttempt && previousOutcome && priorEvidence &&
            priorAcknowledgements.length === 1 && priorAcknowledgement &&
            priorAcknowledgement.paper_trading_comparison_activation_attempt_ref.id ===
              activationAttempt.paper_trading_comparison_activation_attempt_id &&
            priorAcknowledgement.paper_trading_comparison_activation_attempt_digest ===
              activationAttempt.attempt_digest &&
            priorAcknowledgement.trading_run_ref.id ===
              activationAttempt[role].trading_run_ref.id &&
            priorAcknowledgement.tick_digest === previousAttempt.tick_digest &&
            priorAcknowledgement.tick_sequence === previousAttempt.checkpoint_sequence &&
            providerEvidenceOrderingMatches &&
            priorAcknowledgement.provider_request_count_at_acknowledgement <=
              activationAttempt.activation_policy.maximum_provider_request_count_per_side &&
            Date.parse(priorAcknowledgement.acknowledged_at) <
              Date.parse(attempt.attempted_at) &&
            (previousOutcome.checkpoint_sequence === 1 ||
              paperTradingComparisonRefsEqual(
                priorEvidence.tick_acknowledgement_ref,
                {
                  record_kind: "paper_trading_comparison_tick_acknowledgement",
                  id: priorAcknowledgement
                    .paper_trading_comparison_tick_acknowledgement_id
                }
              ) && priorEvidence.tick_acknowledgement_digest ===
                priorAcknowledgement.acknowledgement_digest) &&
            attempt[role].provider_request_count_before >=
              Math.max(
                priorAcknowledgement.provider_request_count_at_acknowledgement,
                priorEvidence.provider_request_count_after
              ) &&
            attempt[role].provider_request_count_before <=
              activationAttempt.activation_policy.maximum_provider_request_count_per_side
          );
      const runningStateMatches = Boolean(result &&
        this.paperTradingComparisonSideIsRunningWithinAttempt(
          activationAttempt,
          result,
          state
        ));
      const expectedEvidenceState = attempt.checkpoint_sequence === 1
        ? "zero"
        : "paired_checkpoint";
      const tradingRunMatches = paperTradingComparisonRefsEqual(
          attempt[role].trading_run_ref,
          activationAttempt[role].trading_run_ref
        );
      const evaluationRefMatches = paperTradingComparisonRefsEqual(
          attempt[role].paper_trading_evaluation_ref,
          activationAttempt[role].paper_trading_evaluation_ref
        );
      const evaluationDigestMatches =
        attempt[role].evaluation_record_digest === comparisonExactRecordDigest(
          paperTradingComparisonEvaluationRecordDigestInput(state.evaluation)
        );
      const observationDigestMatches =
        attempt[role].observation_chain_digest === comparisonExactRecordDigest(
          paperTradingComparisonObservationChainDigestInput(observations)
        );
      const details = {
        latest_start_result_present: result !== undefined,
        running_state_matches: runningStateMatches,
        evidence_state: state.evidenceState,
        expected_evidence_state: expectedEvidenceState,
        trading_run_matches: tradingRunMatches,
        evaluation_ref_matches: evaluationRefMatches,
        evaluation_digest_matches: evaluationDigestMatches,
        observation_digest_matches: observationDigestMatches,
        provider_evidence_ordering_matches: providerEvidenceOrderingMatches,
        provider_baseline_matches: providerBaselineMatches,
        attempt_provider_request_count:
          attempt[role].provider_request_count_before,
        ...(priorAcknowledgement ? {
          prior_acknowledgement_provider_request_count:
            priorAcknowledgement.provider_request_count_at_acknowledgement,
          ...(priorEvidence ? {
            prior_evidence_provider_request_count:
              priorEvidence.provider_request_count_after
          } : {}),
          prior_acknowledged_at: priorAcknowledgement.acknowledged_at
        } : {}),
        maximum_provider_request_count:
          activationAttempt.activation_policy.maximum_provider_request_count_per_side,
        attempted_at: attempt.attempted_at
      };
      return {
        matches: result !== undefined &&
          runningStateMatches &&
          state.evidenceState === expectedEvidenceState &&
          tradingRunMatches &&
          evaluationRefMatches &&
          evaluationDigestMatches &&
          observationDigestMatches &&
          providerBaselineMatches,
        details
      };
    };
    const championBaseline = sideBaseline(
      "champion",
      championState,
      championObservations,
      championResult
    );
    const challengerBaseline = sideBaseline(
      "challenger",
      challengerState,
      challengerObservations,
      challengerResult
    );
    if (!championBaseline.matches || !challengerBaseline.matches) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_state_mismatch",
        "paper trading comparison checkpoint attempt does not match both running side baselines",
        {
          champion: championBaseline.details,
          challenger: challengerBaseline.details
        }
      );
    }

    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-checkpoint-attempts",
        attempt.paper_trading_comparison_checkpoint_attempt_id
      ),
      attempt
    );
    return attempt;
  }

  async getPaperTradingComparisonCheckpointAttempt(
    attemptId: string
  ): Promise<PaperTradingComparisonCheckpointAttemptRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-checkpoint-attempts",
        attemptId
      );
      if (record === undefined) return undefined;
      this.assertPersistedComparisonCheckpointAttemptShape(
        record,
        "paper_trading_comparison_checkpoint_attempt_reload_failed"
      );
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_checkpoint_attempt_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_reload_failed",
        "persisted paper trading comparison checkpoint attempt is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonCheckpointAttempts(
    activationAttemptId: string
  ): Promise<PaperTradingComparisonCheckpointAttemptRecord[]> {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-checkpoint-attempts"
      );
      const validated = records.map((record) => {
        this.assertPersistedComparisonCheckpointAttemptShape(
          record,
          "paper_trading_comparison_checkpoint_attempt_reload_failed"
        );
        return record;
      });
      const filtered = validated
        .filter((record) =>
          record.paper_trading_comparison_activation_attempt_ref.id ===
            activationAttemptId
        )
        .sort((left, right) =>
          left.checkpoint_sequence - right.checkpoint_sequence ||
          left.paper_trading_comparison_checkpoint_attempt_id.localeCompare(
            right.paper_trading_comparison_checkpoint_attempt_id
          )
        );
      if (filtered.some((record, index) =>
        record.checkpoint_sequence !== index + 1)) {
        throw new LocalStoreError(
          "paper_trading_comparison_checkpoint_attempt_reload_failed",
          "persisted paper trading comparison checkpoint attempt chain is not contiguous"
        );
      }
      return filtered;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_checkpoint_attempt_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_reload_failed",
        "persisted paper trading comparison checkpoint attempt collection is unreadable or corrupt"
      );
    }
  }

  async recordPaperTradingComparisonCheckpointOutcome(
    outcome: PaperTradingComparisonCheckpointOutcomeRecord
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonCheckpointOutcomeUnlocked(outcome)
    );
  }

  private async recordPaperTradingComparisonCheckpointOutcomeUnlocked(
    outcome: PaperTradingComparisonCheckpointOutcomeRecord
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord> {
    if (!paperTradingComparisonCheckpointOutcomeHasRuntimeShape(outcome)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_checkpoint_outcome_input",
        "invalid paper trading comparison checkpoint outcome input"
      );
    }
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonCheckpointOutcomeDigestInput(outcome)
      );
    } catch {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_checkpoint_outcome_input",
        "paper trading comparison checkpoint outcome is not canonically digestible"
      );
    }
    if (outcome.outcome_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_outcome_digest_mismatch",
        "paper trading comparison checkpoint outcome digest does not match canonical content"
      );
    }
    const existing = await this.getPaperTradingComparisonCheckpointOutcome(
      outcome.paper_trading_comparison_checkpoint_outcome_id
    );
    if (existing && !samePersistedComparisonRecord(existing, outcome)) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_outcome_conflict",
        "paper trading comparison checkpoint outcome is append-only"
      );
    }
    if (existing) return existing;
    if (outcome.outcome_status === "paired") {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_transaction_required",
        "paired paper comparison checkpoint outcome requires the atomic transaction writer"
      );
    }

    const attempt = await this.getPaperTradingComparisonCheckpointAttempt(
      outcome.checkpoint_attempt_ref.id
    );
    if (!attempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_outcome_reference_not_found",
        "paper trading comparison checkpoint attempt was not found"
      );
    }
    if (
      outcome.checkpoint_attempt_digest !== attempt.attempt_digest ||
      !paperTradingComparisonRefsEqual(outcome.tick_ref, attempt.tick_ref) ||
      outcome.tick_digest !== attempt.tick_digest ||
      outcome.checkpoint_sequence !== attempt.checkpoint_sequence
    ) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_outcome_reference_mismatch",
        "paper trading comparison checkpoint outcome does not match its attempt"
      );
    }
    const outcomes = await this.listPaperTradingComparisonCheckpointOutcomes(
      attempt.paper_trading_comparison_checkpoint_attempt_id
    );
    if (outcomes.length > 0) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_outcome_state_conflict",
        "paper trading comparison checkpoint attempt already has a terminal outcome"
      );
    }
    const activationAttempt = await this.getPaperTradingComparisonActivationAttempt(
      attempt.paper_trading_comparison_activation_attempt_ref.id
    );
    if (!activationAttempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_outcome_reference_not_found",
        "paper trading comparison activation attempt was not found"
      );
    }
    const closure = await this.loadPaperTradingComparisonActivationAttemptClosure(
      activationAttempt
    );
    const [activationOutcomes, activationResults] = await Promise.all([
      this.listPaperTradingComparisonActivationOutcomes(
        activationAttempt.paper_trading_comparison_activation_attempt_id
      ),
      this.listPaperTradingComparisonActivationSideResults(
        activationAttempt.paper_trading_comparison_activation_attempt_id
      )
    ]);
    const latestActivationOutcome = activationOutcomes.at(-1);
    if (!latestActivationOutcome ||
      latestActivationOutcome.paper_trading_comparison_activation_outcome_id ===
        attempt.activation_outcome_ref.id ||
      Date.parse(outcome.completed_at) < Date.parse(latestActivationOutcome.completed_at)) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_outcome_state_conflict",
        "paper trading comparison checkpoint incomplete outcome requires later cleanup evidence"
      );
    }
    const recoverCleanup = outcome.next_action === "recover_cleanup";
    if (recoverCleanup
      ? latestActivationOutcome.outcome_status !== "cleanup_required"
      : latestActivationOutcome.outcome_status !== "stopped_cleanly") {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_outcome_state_conflict",
        "paper trading comparison checkpoint cleanup status does not match its next action"
      );
    }
    if (!recoverCleanup) {
      const championResult = latestPaperTradingComparisonActivationSideResult(
        activationResults,
        "champion"
      );
      const challengerResult = latestPaperTradingComparisonActivationSideResult(
        activationResults,
        "challenger"
      );
      const [championState, challengerState] = await Promise.all([
        this.loadPaperTradingComparisonRuntimeSideState(
          activationAttempt,
          "champion",
          closure.comparison,
          "paper_trading_comparison_checkpoint_attempt_graph_invalid",
          { allowCommittedCheckpoint: attempt.checkpoint_sequence > 1 }
        ),
        this.loadPaperTradingComparisonRuntimeSideState(
          activationAttempt,
          "challenger",
          closure.comparison,
          "paper_trading_comparison_checkpoint_attempt_graph_invalid",
          { allowCommittedCheckpoint: attempt.checkpoint_sequence > 1 }
        )
      ]);
      if (!championResult || !challengerResult ||
        !this.paperTradingComparisonOutcomeResultRefMatches(
          latestActivationOutcome.champion_latest_result_ref,
          championResult
        ) ||
        !this.paperTradingComparisonOutcomeResultRefMatches(
          latestActivationOutcome.challenger_latest_result_ref,
          challengerResult
        ) ||
        !this.paperTradingComparisonSideIsStoppedCleanly(championResult, championState) ||
        !this.paperTradingComparisonSideIsStoppedCleanly(challengerResult, challengerState)) {
        throw new LocalStoreError(
          "paper_trading_comparison_checkpoint_outcome_state_conflict",
          "paper trading comparison checkpoint incomplete outcome lacks symmetric cleanup"
        );
      }
    }

    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-checkpoint-outcomes",
        outcome.paper_trading_comparison_checkpoint_outcome_id
      ),
      outcome
    );
    return outcome;
  }

  async getPaperTradingComparisonCheckpointOutcome(
    outcomeId: string
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-checkpoint-outcomes",
        outcomeId
      );
      if (record === undefined) return undefined;
      this.assertPersistedComparisonCheckpointOutcomeShape(
        record,
        "paper_trading_comparison_checkpoint_outcome_reload_failed"
      );
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_checkpoint_outcome_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_outcome_reload_failed",
        "persisted paper trading comparison checkpoint outcome is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonCheckpointOutcomes(
    checkpointAttemptId: string
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord[]> {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-checkpoint-outcomes"
      );
      const validated = records.map((record) => {
        this.assertPersistedComparisonCheckpointOutcomeShape(
          record,
          "paper_trading_comparison_checkpoint_outcome_reload_failed"
        );
        return record;
      });
      return validated
        .filter((record) => record.checkpoint_attempt_ref.id === checkpointAttemptId)
        .sort((left, right) =>
          left.completed_at.localeCompare(right.completed_at) ||
          left.paper_trading_comparison_checkpoint_outcome_id.localeCompare(
            right.paper_trading_comparison_checkpoint_outcome_id
          )
        );
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_checkpoint_outcome_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_outcome_reload_failed",
        "persisted paper trading comparison checkpoint outcome collection is unreadable or corrupt"
      );
    }
  }

  async snapshotPaperTradingComparisonWindowClosureGraph(
    activationAttemptId: string
  ): Promise<PaperTradingComparisonWindowClosureGraphSnapshot> {
    return this.withComparisonEvidenceWriteTransaction(async () => {
      const activationAttempt = await this.getPaperTradingComparisonActivationAttempt(
        activationAttemptId
      );
      if (!activationAttempt) {
        throw new LocalStoreError(
          "paper_trading_comparison_activation_attempt_reload_failed",
          "paper comparison window closure activation attempt was not found"
        );
      }
      const [activationOutcomes, ticks, checkpointAttempts] = await Promise.all([
        this.listPaperTradingComparisonActivationOutcomes(activationAttemptId),
        this.listPaperTradingComparisonTicks(
          activationAttempt.paper_trading_comparison_commitment_ref.id
        ),
        this.listPaperTradingComparisonCheckpointAttempts(activationAttemptId)
      ]);
      const checkpointOutcomes = (await Promise.all(checkpointAttempts.map((attempt) =>
        this.listPaperTradingComparisonCheckpointOutcomes(
          attempt.paper_trading_comparison_checkpoint_attempt_id
        )
      ))).flat();
      return {
        activation_attempt: activationAttempt,
        activation_outcomes: activationOutcomes,
        ticks,
        checkpoint_attempts: checkpointAttempts,
        checkpoint_outcomes: checkpointOutcomes
      };
    });
  }

  async recordPaperTradingComparisonVerdict(
    verdict: PaperTradingComparisonVerdictRecord
  ): Promise<PaperTradingComparisonVerdictRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonVerdictUnlocked(verdict)
    );
  }

  private async recordPaperTradingComparisonVerdictUnlocked(
    verdict: PaperTradingComparisonVerdictRecord
  ): Promise<PaperTradingComparisonVerdictRecord> {
    if (!paperTradingComparisonVerdictHasRuntimeShape(verdict)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_verdict_input",
        "invalid paper trading comparison verdict input"
      );
    }
    const expectedDigest = comparisonExactRecordDigest(
      paperTradingComparisonVerdictDigestInput(verdict)
    );
    if (verdict.verdict_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_verdict_digest_mismatch",
        "paper trading comparison verdict digest does not match canonical content"
      );
    }
    const existing = await this.getPaperTradingComparisonVerdict(
      verdict.paper_trading_comparison_verdict_id
    );
    if (existing) {
      if (!sameJson(existing, verdict)) {
        throw new LocalStoreError(
          "paper_trading_comparison_verdict_conflict",
          "paper trading comparison verdict is append-only"
        );
      }
      await this.validatePaperTradingComparisonVerdictGraph(existing);
      return existing;
    }
    const comparisonConflict = (await this.listPaperTradingComparisonVerdicts()).find(
      (record) => record.paper_trading_comparison_commitment_ref.id ===
        verdict.paper_trading_comparison_commitment_ref.id
    );
    if (comparisonConflict) {
      throw new LocalStoreError(
        "paper_trading_comparison_verdict_conflict",
        "one paper trading comparison can have only one verdict"
      );
    }
    await this.validatePaperTradingComparisonVerdictGraph(verdict);
    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-verdicts",
        verdict.paper_trading_comparison_verdict_id
      ),
      verdict
    );
    return verdict;
  }

  async getPaperTradingComparisonVerdict(
    verdictId: string
  ): Promise<PaperTradingComparisonVerdictRecord | undefined> {
    const record = await this.readOptionalRecord<unknown>(
      "paper-trading-comparison-verdicts",
      verdictId
    );
    if (record === undefined) return undefined;
    this.assertPersistedPaperTradingComparisonVerdict(record);
    return record;
  }

  async listPaperTradingComparisonVerdicts(
    comparisonId?: string
  ): Promise<PaperTradingComparisonVerdictRecord[]> {
    const records = await this.readCollection<unknown>(
      "paper-trading-comparison-verdicts"
    );
    return records.map((record) => {
      this.assertPersistedPaperTradingComparisonVerdict(record);
      return record;
    }).filter((record) => comparisonId === undefined ||
      record.paper_trading_comparison_commitment_ref.id === comparisonId)
      .sort((left, right) =>
        left.evaluated_at.localeCompare(right.evaluated_at) ||
        left.paper_trading_comparison_verdict_id.localeCompare(
          right.paper_trading_comparison_verdict_id
        ));
  }

  private assertPersistedPaperTradingComparisonVerdict(
    record: unknown
  ): asserts record is PaperTradingComparisonVerdictRecord {
    if (!paperTradingComparisonVerdictHasRuntimeShape(record) ||
      record.verdict_digest !== comparisonExactRecordDigest(
        paperTradingComparisonVerdictDigestInput(record)
      )) {
      throw new LocalStoreError(
        "paper_trading_comparison_verdict_graph_invalid",
        "persisted paper trading comparison verdict is malformed or corrupt"
      );
    }
  }

  private async validatePaperTradingComparisonVerdictGraph(
    verdict: PaperTradingComparisonVerdictRecord
  ): Promise<void> {
    const [comparison, activation, attempt, finalOutcome, latestTick] =
      await Promise.all([
        this.getPaperTradingComparisonCommitment(
          verdict.paper_trading_comparison_commitment_ref.id
        ),
        this.getPaperTradingComparisonActivation(
          verdict.paper_trading_comparison_activation_ref.id
        ),
        this.getPaperTradingComparisonActivationAttempt(
          verdict.paper_trading_comparison_activation_attempt_ref.id
        ),
        this.getPaperTradingComparisonActivationOutcome(
          verdict.final_activation_outcome_ref.id
        ),
        this.getPaperTradingComparisonTick(verdict.latest_tick_ref.id)
      ]);
    if (!comparison || !activation || !attempt || !finalOutcome || !latestTick ||
      comparison.commitment_digest !==
        verdict.paper_trading_comparison_commitment_digest ||
      activation.activation_digest !== verdict.paper_trading_comparison_activation_digest ||
      attempt.attempt_digest !==
        verdict.paper_trading_comparison_activation_attempt_digest ||
      finalOutcome.outcome_digest !== verdict.final_activation_outcome_digest ||
      latestTick.tick_digest !== verdict.latest_tick_digest ||
      activation.paper_trading_comparison_commitment_ref.id !==
        comparison.paper_trading_comparison_commitment_id ||
      attempt.paper_trading_comparison_activation_ref.id !==
        activation.paper_trading_comparison_activation_id ||
      finalOutcome.paper_trading_comparison_activation_attempt_ref.id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      finalOutcome.outcome_status !== "stopped_cleanly" ||
      latestTick.paper_trading_comparison_commitment_ref.id !==
        comparison.paper_trading_comparison_commitment_id ||
      verdict.pair_qualification.comparison_id !==
        comparison.paper_trading_comparison_commitment_id ||
      verdict.pair_qualification.activation_id !==
        activation.paper_trading_comparison_activation_id ||
      verdict.pair_qualification.activation_attempt_id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      verdict.pair_qualification_digest !== comparisonExactRecordDigest(
        paperTradingComparisonQualificationResultDigestInput(
          verdict.pair_qualification
        )
      )) {
      throw this.paperTradingComparisonVerdictGraphInvalid();
    }

    const [ticks, checkpointAttempts] = await Promise.all([
      this.listPaperTradingComparisonTicks(
        comparison.paper_trading_comparison_commitment_id
      ),
      this.listPaperTradingComparisonCheckpointAttempts(
        attempt.paper_trading_comparison_activation_attempt_id
      )
    ]);
    if (ticks.length === 0 || ticks.at(-1)?.paper_trading_comparison_tick_id !==
        latestTick.paper_trading_comparison_tick_id ||
      checkpointAttempts.length !== verdict.checkpoint_outcome_refs.length) {
      throw this.paperTradingComparisonVerdictGraphInvalid();
    }
    const checkpointOutcomes: PaperTradingComparisonCheckpointOutcomeRecord[] = [];
    for (let index = 0; index < verdict.checkpoint_outcome_refs.length; index += 1) {
      const checkpointAttempt = checkpointAttempts[index];
      const outcome = await this.getPaperTradingComparisonCheckpointOutcome(
        verdict.checkpoint_outcome_refs[index]!.id
      );
      if (!checkpointAttempt || !outcome || outcome.outcome_digest !==
          verdict.checkpoint_outcome_digests[index] ||
        checkpointAttempt.checkpoint_sequence !== index + 1 ||
        checkpointAttempt.paper_trading_comparison_activation_attempt_ref.id !==
          attempt.paper_trading_comparison_activation_attempt_id ||
        checkpointAttempt.paper_trading_comparison_commitment_ref.id !==
          comparison.paper_trading_comparison_commitment_id ||
        checkpointAttempt.tick_ref.id !== ticks[index]?.paper_trading_comparison_tick_id ||
        checkpointAttempt.tick_digest !== ticks[index]?.tick_digest ||
        outcome.checkpoint_attempt_ref.id !==
          checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id ||
        outcome.checkpoint_attempt_digest !== checkpointAttempt.attempt_digest ||
        outcome.checkpoint_sequence !== index + 1 ||
        outcome.tick_ref.id !== checkpointAttempt.tick_ref.id ||
        outcome.tick_digest !== checkpointAttempt.tick_digest) {
        throw this.paperTradingComparisonVerdictGraphInvalid();
      }
      checkpointOutcomes.push(outcome);
    }
    const pairedCount = checkpointOutcomes.filter((outcome) =>
      outcome.outcome_status === "paired").length;
    if (pairedCount !== verdict.pair_qualification.checkpoint_count ||
      (verdict.pair_qualification.qualification_status === "qualified" &&
        (pairedCount !== checkpointOutcomes.length ||
          pairedCount !== latestTick.sequence)) ||
      verdict.window_started_at !== ticks[0]?.observed_at ||
      verdict.window_ended_at !== latestTick.observed_at ||
      Date.parse(verdict.evaluated_at) < Date.parse(finalOutcome.completed_at)) {
      throw this.paperTradingComparisonVerdictGraphInvalid();
    }

    for (const role of ["champion", "challenger"] as const) {
      const verdictSide = verdict[role];
      const comparisonSide = comparison[role];
      const [commitment, evaluation, observations, run] = await Promise.all([
        this.getPaperTradingEvaluationCommitment(
          verdictSide.paper_trading_evaluation_commitment_ref.id
        ),
        this.getPaperTradingEvaluation(verdictSide.paper_trading_evaluation_ref.id),
        this.listPaperTradingObservations(verdictSide.paper_trading_evaluation_ref.id),
        this.getTradingRun(verdictSide.trading_run_ref.id)
      ]);
      const expectedQualification = commitment && evaluation
        ? decidePaperTradingQualification({
          commitment,
          evaluation,
          observations,
          runnerActive: false,
          policy: {
            minObservationCount:
              comparison.comparison_policy.minimum_observation_count,
            minElapsedMs: comparison.comparison_policy.minimum_elapsed_ms
          },
          commitmentDigestVerified: commitment.commitment_digest ===
            comparisonExactRecordDigest(
              paperTradingEvaluationCommitmentDigestInput(commitment)
            )
        })
        : undefined;
      if (!commitment || !evaluation || !run || evaluation.status !== "stopped" ||
        run.runtime_lifecycle_status !== "stopped" ||
        !expectedQualification || !samePersistedComparisonRecord(
          verdict.pair_qualification[role],
          expectedQualification
        ) ||
        !paperTradingComparisonRefsEqual(
          verdictSide.candidate_ref,
          comparisonSide.candidate_ref
        ) || !paperTradingComparisonRefsEqual(
          verdictSide.candidate_version_ref,
          comparisonSide.candidate_version_ref
        ) || !paperTradingComparisonRefsEqual(
          verdictSide.system_code_ref,
          comparisonSide.system_code_ref
        ) || verdictSide.system_code_artifact_digest !==
          comparisonSide.system_code_artifact_digest ||
        !paperTradingComparisonRefsEqual(
          verdictSide.trading_run_ref,
          comparisonSide.trading_run_ref
        ) || !paperTradingComparisonRefsEqual(
          verdictSide.paper_trading_evaluation_commitment_ref,
          comparisonSide.paper_trading_evaluation_commitment_ref
        ) || !paperTradingComparisonRefsEqual(
          verdictSide.paper_trading_evaluation_ref,
          comparisonSide.paper_trading_evaluation_ref
        ) || verdictSide.paper_trading_evaluation_commitment_record_digest !==
          comparisonExactRecordDigest(
            paperTradingComparisonEvaluationCommitmentRecordDigestInput(commitment)
          ) || verdictSide.paper_trading_evaluation_record_digest !==
          comparisonExactRecordDigest(
            paperTradingComparisonEvaluationRecordDigestInput(evaluation)
          ) || verdictSide.paper_trading_observation_chain_digest !==
          comparisonExactRecordDigest(
            paperTradingComparisonObservationChainDigestInput(observations)
          ) || observations.length !== evaluation.observation_count ||
        (verdict.pair_qualification.qualification_status === "qualified" &&
          (verdictSide.net_revenue_usdt !== evaluation.latest_score.net_revenue_usdt ||
            verdictSide.cost_usdt !== evaluation.latest_score.cost_usdt))) {
        throw this.paperTradingComparisonVerdictGraphInvalid();
      }
    }
  }

  private paperTradingComparisonVerdictGraphInvalid(): LocalStoreError {
    return new LocalStoreError(
      "paper_trading_comparison_verdict_graph_invalid",
      "paper trading comparison verdict does not match exact terminal evidence"
    );
  }

  async recordPaperTradingComparisonConfirmationCampaign(
    campaign: PaperTradingComparisonConfirmationCampaignRecord
  ): Promise<PaperTradingComparisonConfirmationCampaignRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonConfirmationCampaignUnlocked(campaign)
    );
  }

  private async recordPaperTradingComparisonConfirmationCampaignUnlocked(
    campaign: PaperTradingComparisonConfirmationCampaignRecord
  ): Promise<PaperTradingComparisonConfirmationCampaignRecord> {
    if (!paperTradingComparisonConfirmationCampaignHasRuntimeShape(campaign)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_confirmation_campaign_input",
        "invalid paper trading comparison confirmation campaign input"
      );
    }
    const expectedDigest = comparisonExactRecordDigest(
      paperTradingComparisonConfirmationCampaignDigestInput(campaign)
    );
    if (campaign.campaign_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_digest_mismatch",
        "paper trading comparison confirmation campaign digest does not match canonical content"
      );
    }
    await this.assertResearchControlCampaignConfirmationPrecommitDeadline(
      campaign
    );
    const existing = await this.getPaperTradingComparisonConfirmationCampaign(
      campaign.paper_trading_comparison_confirmation_campaign_id
    );
    if (existing) {
      if (!samePersistedComparisonRecord(existing, campaign)) {
        throw new LocalStoreError(
          "paper_trading_comparison_confirmation_campaign_conflict",
          "paper trading comparison confirmation campaign is append-only"
        );
      }
      await this.validatePaperTradingComparisonConfirmationCampaignGraph(existing);
      return existing;
    }
    const campaigns = await this.listPaperTradingComparisonConfirmationCampaigns();
    if (campaigns.some((record) =>
      record.source_verdict_ref.id === campaign.source_verdict_ref.id)) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_source_conflict",
        "one improved source verdict can start only one confirmation campaign"
      );
    }
    const pairKey = paperTradingComparisonCandidateVersionPairKey(
      campaign.champion.candidate_version_ref.id,
      campaign.challenger.candidate_version_ref.id
    );
    const completedCampaignIds = new Set(
      (await this.listPaperTradingComparisonConfirmationCampaignOutcomes()).map(
        (outcome) => outcome.campaign_ref.id
      )
    );
    if (campaigns.some((record) => !completedCampaignIds.has(
      record.paper_trading_comparison_confirmation_campaign_id
    ) && paperTradingComparisonCandidateVersionPairKey(
      record.champion.candidate_version_ref.id,
      record.challenger.candidate_version_ref.id
    ) === pairKey)) {
      throw new LocalStoreError(
        "paper_trading_comparison_active_campaign_pair_conflict",
        "an active confirmation campaign already owns this unordered candidate-version pair"
      );
    }
    const terminatedComparisonIds = new Set(
      (await this.listPaperTradingComparisonVerdicts()).map((verdict) =>
        verdict.paper_trading_comparison_commitment_ref.id)
    );
    const activePreparation = (
      await this.listPaperTradingComparisonPreparations()
    ).find((preparation) => !terminatedComparisonIds.has(
      preparation.paper_trading_comparison_commitment_id
    ) && paperTradingComparisonCandidateVersionPairKey(
      preparation.champion.candidate_version_ref.id,
      preparation.challenger.candidate_version_ref.id
    ) === pairKey);
    if (activePreparation) {
      throw new LocalStoreError(
        "paper_trading_comparison_active_campaign_pair_conflict",
        "an active comparison preparation already owns this campaign pair"
      );
    }
    await this.validatePaperTradingComparisonConfirmationCampaignGraph(campaign);
    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-confirmation-campaigns",
        campaign.paper_trading_comparison_confirmation_campaign_id
      ),
      campaign
    );
    return campaign;
  }

  private async assertResearchControlCampaignConfirmationPrecommitDeadline(
    confirmation: PaperTradingComparisonConfirmationCampaignRecord
  ): Promise<void> {
    const owners: Array<{
      schedule: ResearchControlCampaignPaperScheduleRecord;
      slot: Extract<
        ResearchControlCampaignPaperScheduleSlot,
        { slot_status: "candidate_scheduled" }
      >;
    }> = [];
    for (const schedule of await this.listResearchControlCampaignPaperSchedules()) {
      for (const arm of schedule.arms) {
        for (const slot of arm.slots) {
          if (slot.slot_status === "candidate_scheduled" &&
            slot.source_comparison_commitment_id ===
              confirmation.source_comparison_ref.id) {
            owners.push({ schedule, slot });
          }
        }
      }
    }
    if (owners.length === 0) return;
    if (owners.length !== 1) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_graph_invalid",
        "research-control confirmation source has ambiguous schedule ownership"
      );
    }
    const owner = owners[0]!;
    const [campaign, report, verdict] = await Promise.all([
      this.getResearchControlCampaign(owner.schedule.campaign_ref.id),
      this.getResearchControlCampaignReport(owner.schedule.report_ref.id),
      this.getPaperTradingComparisonVerdict(confirmation.source_verdict_ref.id)
    ]);
    if (!campaign || !report || !verdict ||
      campaign.paper_evaluation_protocol.protocol_status !== "bound" ||
      !this.researchControlCampaignPaperScheduleGraphMatches(
        owner.schedule,
        campaign,
        report
      ) || !paperTradingComparisonVerdictHasRuntimeShape(verdict) ||
      verdict.verdict_digest !== comparisonExactRecordDigest(
        paperTradingComparisonVerdictDigestInput(verdict)
      ) || confirmation.source_verdict_ref.id !==
        verdict.paper_trading_comparison_verdict_id ||
      confirmation.source_verdict_digest !== verdict.verdict_digest ||
      confirmation.source_comparison_ref.id !==
        owner.slot.source_comparison_commitment_id ||
      confirmation.source_comparison_digest !==
        verdict.paper_trading_comparison_commitment_digest ||
      verdict.paper_trading_comparison_commitment_ref.id !==
        owner.slot.source_comparison_commitment_id ||
      verdict.verdict_outcome !== "challenger_improved" ||
      verdict.confirmation_disposition !== "requires_precommitted_campaign" ||
      !paperTradingComparisonRefsEqual(
        confirmation.challenger.candidate_ref,
        owner.slot.candidate_ref
      ) || !paperTradingComparisonRefsEqual(
        confirmation.challenger.candidate_version_ref,
        owner.slot.candidate_version_ref
      ) || !paperTradingComparisonRefsEqual(
        confirmation.challenger.system_code_ref,
        owner.slot.system_code_ref
      ) || confirmation.challenger.system_code_artifact_digest !==
        owner.slot.system_code_artifact_digest) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_graph_invalid",
        "research-control confirmation campaign does not match its scheduled source"
      );
    }
    const deadline = Date.parse(verdict.evaluated_at) +
      campaign.paper_evaluation_protocol.schedule_policy
        .confirmation_precommit_deadline_ms;
    if (Date.parse(confirmation.committed_at) > deadline) {
      throw new LocalStoreError(
        "research_control_campaign_confirmation_precommit_deadline_missed",
        "research-control confirmation campaign missed its frozen precommit deadline"
      );
    }
  }

  async getPaperTradingComparisonConfirmationCampaign(
    campaignId: string
  ): Promise<PaperTradingComparisonConfirmationCampaignRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-confirmation-campaigns",
        campaignId
      );
      if (record === undefined) return undefined;
      this.assertPersistedPaperTradingComparisonConfirmationCampaign(record);
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_confirmation_campaign_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_reload_failed",
        "persisted paper trading comparison confirmation campaign is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonConfirmationCampaigns(): Promise<
    PaperTradingComparisonConfirmationCampaignRecord[]
  > {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-confirmation-campaigns"
      );
      return records.map((record) => {
        this.assertPersistedPaperTradingComparisonConfirmationCampaign(record);
        return record;
      }).sort((left, right) =>
        left.committed_at.localeCompare(right.committed_at) ||
        left.paper_trading_comparison_confirmation_campaign_id.localeCompare(
          right.paper_trading_comparison_confirmation_campaign_id
        ));
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_confirmation_campaign_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_reload_failed",
        "persisted paper trading comparison confirmation campaign collection is unreadable or corrupt"
      );
    }
  }

  private assertPersistedPaperTradingComparisonConfirmationCampaign(
    record: unknown
  ): asserts record is PaperTradingComparisonConfirmationCampaignRecord {
    if (!paperTradingComparisonConfirmationCampaignHasRuntimeShape(record) ||
      record.campaign_digest !== comparisonExactRecordDigest(
        paperTradingComparisonConfirmationCampaignDigestInput(record)
      )) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_reload_failed",
        "persisted paper trading comparison confirmation campaign is malformed or corrupt"
      );
    }
  }

  private async validatePaperTradingComparisonConfirmationCampaignGraph(
    campaign: PaperTradingComparisonConfirmationCampaignRecord
  ): Promise<void> {
    const [sourceVerdict, sourceComparison] = await Promise.all([
      this.getPaperTradingComparisonVerdict(campaign.source_verdict_ref.id),
      this.getPaperTradingComparisonCommitment(campaign.source_comparison_ref.id)
    ]);
    if (!sourceVerdict || !sourceComparison) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_reference_not_found",
        "paper trading comparison confirmation campaign source evidence was not found"
      );
    }
    await this.validatePaperTradingComparisonVerdictGraph(sourceVerdict);
    const sourcePreparation = await this.getPaperTradingComparisonPreparation(
      sourceComparison.preparation_ref.id
    );
    if (!sourcePreparation ||
      sourceVerdict.verdict_digest !== campaign.source_verdict_digest ||
      sourceVerdict.paper_trading_comparison_commitment_ref.id !==
        sourceComparison.paper_trading_comparison_commitment_id ||
      sourceVerdict.paper_trading_comparison_commitment_digest !==
        sourceComparison.commitment_digest ||
      sourceComparison.commitment_digest !== campaign.source_comparison_digest ||
      sourceVerdict.verdict_outcome !== "challenger_improved" ||
      sourceVerdict.pair_qualification.qualification_status !== "qualified" ||
      sourceVerdict.confirmation_disposition !== "requires_precommitted_campaign" ||
      sourceVerdict.release_status !== "sealed" ||
      sourceVerdict.promotion_eligibility !== "not_eligible" ||
      Date.parse(campaign.committed_at) <= Date.parse(sourceVerdict.evaluated_at) ||
      !samePersistedComparisonRecord(campaign.champion, sourcePreparation.champion) ||
      !samePersistedComparisonRecord(campaign.challenger, sourcePreparation.challenger) ||
      !samePersistedComparisonRecord(
        campaign.champion_selection,
        sourceComparison.champion_selection
      ) ||
      !samePersistedComparisonRecord(
        campaign.comparison_policy,
        sourceComparison.comparison_policy
      ) ||
      campaign.market_data_configuration_digest !==
        sourceComparison.market_data_configuration_digest ||
      !samePersistedComparisonRecord(
        campaign.paper_policy_identity,
        sourceComparison.paper_policy_identity
      ) || campaign.slots.some((slot) => {
        const ids = paperTradingComparisonIdsForIdempotencyKey(
          slot.comparison_idempotency_key
        );
        return ids.preparationId !==
            slot.paper_trading_comparison_preparation_id ||
          ids.comparisonId !== slot.paper_trading_comparison_commitment_id;
      })) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_graph_invalid",
        "paper trading comparison confirmation campaign does not match exact improved source evidence"
      );
    }
  }

  async recordPaperTradingComparisonConfirmationCampaignOutcome(
    outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
  ): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonConfirmationCampaignOutcomeUnlocked(outcome)
    );
  }

  private async recordPaperTradingComparisonConfirmationCampaignOutcomeUnlocked(
    outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
  ): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord> {
    if (!paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(outcome)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_confirmation_campaign_outcome_input",
        "invalid paper trading comparison confirmation campaign outcome input"
      );
    }
    const expectedDigest = comparisonExactRecordDigest(
      paperTradingComparisonConfirmationCampaignOutcomeDigestInput(outcome)
    );
    if (outcome.outcome_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_outcome_digest_mismatch",
        "paper trading comparison confirmation campaign outcome digest does not match canonical content"
      );
    }
    const existing = await this.getPaperTradingComparisonConfirmationCampaignOutcome(
      outcome.paper_trading_comparison_confirmation_campaign_outcome_id
    );
    if (existing) {
      if (!samePersistedComparisonRecord(existing, outcome)) {
        throw new LocalStoreError(
          "paper_trading_comparison_confirmation_campaign_outcome_conflict",
          "paper trading comparison confirmation campaign outcome is append-only"
        );
      }
      await this.validatePaperTradingComparisonConfirmationCampaignOutcomeGraph(existing);
      return existing;
    }
    const campaign = await this.getPaperTradingComparisonConfirmationCampaign(
      outcome.campaign_ref.id
    );
    if (!campaign) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_outcome_reference_not_found",
        "paper trading comparison confirmation campaign was not found"
      );
    }
    const campaignConflict = (
      await this.listPaperTradingComparisonConfirmationCampaignOutcomes(
        campaign.paper_trading_comparison_confirmation_campaign_id
      )
    )[0];
    if (campaignConflict) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_outcome_conflict",
        "one paper trading comparison confirmation campaign can have only one outcome"
      );
    }
    await this.validatePaperTradingComparisonConfirmationCampaignOutcomeGraph(outcome);
    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-confirmation-campaign-outcomes",
        outcome.paper_trading_comparison_confirmation_campaign_outcome_id
      ),
      outcome
    );
    return outcome;
  }

  async getPaperTradingComparisonConfirmationCampaignOutcome(
    outcomeId: string
  ): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-confirmation-campaign-outcomes",
        outcomeId
      );
      if (record === undefined) return undefined;
      this.assertPersistedPaperTradingComparisonConfirmationCampaignOutcome(record);
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError && error.code ===
        "paper_trading_comparison_confirmation_campaign_outcome_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_outcome_reload_failed",
        "persisted paper trading comparison confirmation campaign outcome is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonConfirmationCampaignOutcomes(
    campaignId?: string
  ): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord[]> {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-confirmation-campaign-outcomes"
      );
      return records.map((record) => {
        this.assertPersistedPaperTradingComparisonConfirmationCampaignOutcome(record);
        return record;
      }).filter((record) => campaignId === undefined ||
        record.campaign_ref.id === campaignId)
        .sort((left, right) =>
          left.evaluated_at.localeCompare(right.evaluated_at) ||
          left.paper_trading_comparison_confirmation_campaign_outcome_id.localeCompare(
            right.paper_trading_comparison_confirmation_campaign_outcome_id
          ));
    } catch (error) {
      if (error instanceof LocalStoreError && error.code ===
        "paper_trading_comparison_confirmation_campaign_outcome_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_outcome_reload_failed",
        "persisted paper trading comparison confirmation campaign outcome collection is unreadable or corrupt"
      );
    }
  }

  private assertPersistedPaperTradingComparisonConfirmationCampaignOutcome(
    record: unknown
  ): asserts record is PaperTradingComparisonConfirmationCampaignOutcomeRecord {
    if (!paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(record) ||
      record.outcome_digest !== comparisonExactRecordDigest(
        paperTradingComparisonConfirmationCampaignOutcomeDigestInput(record)
      )) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_outcome_reload_failed",
        "persisted paper trading comparison confirmation campaign outcome is malformed or corrupt"
      );
    }
  }

  private async validatePaperTradingComparisonConfirmationCampaignOutcomeGraph(
    outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
  ): Promise<void> {
    const campaign = await this.getPaperTradingComparisonConfirmationCampaign(
      outcome.campaign_ref.id
    );
    if (!campaign) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_outcome_reference_not_found",
        "paper trading comparison confirmation campaign was not found"
      );
    }
    await this.validatePaperTradingComparisonConfirmationCampaignGraph(campaign);
    if (outcome.campaign_digest !== campaign.campaign_digest ||
      outcome.paper_trading_comparison_confirmation_campaign_outcome_id !==
        `${campaign.paper_trading_comparison_confirmation_campaign_id}-outcome` ||
      outcome.slot_results.length !== campaign.slots.length) {
      throw new LocalStoreError(
        "paper_trading_comparison_confirmation_campaign_outcome_graph_invalid",
        "paper trading comparison confirmation campaign outcome identity is invalid"
      );
    }
    let applicableStart = campaign.committed_at;
    let expiredSeen = false;
    for (let index = 0; index < campaign.slots.length; index += 1) {
      const slot = campaign.slots[index]!;
      const result = outcome.slot_results[index]!;
      if (result.paper_trading_comparison_commitment_ref.id !==
          slot.paper_trading_comparison_commitment_id) {
        throw new LocalStoreError(
          "paper_trading_comparison_confirmation_campaign_outcome_graph_invalid",
          "paper trading comparison confirmation outcome slot identity is invalid"
        );
      }
      if (result.status === "slot_expired") {
        const [verdicts, ticks] = await Promise.all([
          this.listPaperTradingComparisonVerdicts(
            slot.paper_trading_comparison_commitment_id
          ),
          this.listPaperTradingComparisonTicks(
            slot.paper_trading_comparison_commitment_id
          )
        ]);
        if (verdicts.length !== 0 || ticks.length !== 0 ||
          !expiredSeen && Date.parse(outcome.evaluated_at) <=
            Date.parse(applicableStart) +
              campaign.campaign_policy.maximum_slot_start_delay_ms) {
          throw new LocalStoreError(
            "paper_trading_comparison_confirmation_campaign_outcome_graph_invalid",
            "paper trading comparison confirmation slot has not validly expired"
          );
        }
        expiredSeen = true;
        continue;
      }
      if (expiredSeen || !result.verdict_ref || !result.verdict_digest ||
        result.verdict_ref.id === campaign.source_verdict_ref.id) {
        throw new LocalStoreError(
          "paper_trading_comparison_confirmation_campaign_outcome_graph_invalid",
          "paper trading comparison confirmation outcome omits or reuses verdict evidence"
        );
      }
      const verdict = await this.getPaperTradingComparisonVerdict(result.verdict_ref.id);
      const expectedStatus = verdict?.verdict_outcome === "challenger_improved"
        ? "challenger_improved"
        : verdict?.verdict_outcome === "challenger_not_improved"
          ? "challenger_not_improved"
          : "comparison_ineligible";
      if (!verdict || verdict.verdict_digest !== result.verdict_digest ||
        verdict.paper_trading_comparison_commitment_ref.id !==
          slot.paper_trading_comparison_commitment_id ||
        result.status !== expectedStatus ||
        result.window_started_at !== verdict.window_started_at ||
        result.window_ended_at !== verdict.window_ended_at ||
        Date.parse(outcome.evaluated_at) < Date.parse(verdict.evaluated_at)) {
        throw new LocalStoreError(
          "paper_trading_comparison_confirmation_campaign_outcome_graph_invalid",
          "paper trading comparison confirmation outcome verdict evidence is invalid"
        );
      }
      applicableStart = verdict.evaluated_at;
    }
  }

  async recordPaperTradingComparisonResearchRelease(
    release: PaperTradingComparisonResearchReleaseRecord
  ): Promise<PaperTradingComparisonResearchReleaseRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonResearchReleaseUnlocked(release)
    );
  }

  private async recordPaperTradingComparisonResearchReleaseUnlocked(
    release: PaperTradingComparisonResearchReleaseRecord
  ): Promise<PaperTradingComparisonResearchReleaseRecord> {
    if (!paperTradingComparisonResearchReleaseHasRuntimeShape(release)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_research_release_input",
        "invalid paper trading comparison research release input"
      );
    }
    const expectedDigest = comparisonExactRecordDigest(
      paperTradingComparisonResearchReleaseDigestInput(release)
    );
    if (release.release_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_research_release_digest_mismatch",
        "paper trading comparison research release digest does not match canonical content"
      );
    }
    const existing = await this.getPaperTradingComparisonResearchRelease(
      release.paper_trading_comparison_research_release_id
    );
    if (existing) {
      if (!samePersistedComparisonRecord(existing, release)) {
        throw new LocalStoreError(
          "paper_trading_comparison_research_release_conflict",
          "paper trading comparison research release is append-only"
        );
      }
      await this.validatePaperTradingComparisonResearchReleaseGraph(existing);
      await this.materializePaperTradingComparisonResearchRelease(existing);
      return existing;
    }
    if ((await this.listPaperTradingComparisonResearchReleases()).some((record) =>
      record.campaign_outcome_ref.id === release.campaign_outcome_ref.id)) {
      throw new LocalStoreError(
        "paper_trading_comparison_research_release_outcome_conflict",
        "one campaign outcome can have only one research release"
      );
    }
    await this.validatePaperTradingComparisonResearchReleaseGraph(release);
    await this.assertPaperTradingComparisonResearchReleaseMaterializationCompatible(
      release
    );
    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-research-releases",
        release.paper_trading_comparison_research_release_id
      ),
      release
    );
    await this.materializePaperTradingComparisonResearchRelease(release);
    return release;
  }

  async getPaperTradingComparisonResearchRelease(
    releaseId: string
  ): Promise<PaperTradingComparisonResearchReleaseRecord | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-research-releases",
        releaseId
      );
      if (record === undefined) return undefined;
      this.assertPersistedPaperTradingComparisonResearchRelease(record);
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError && error.code ===
        "paper_trading_comparison_research_release_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_research_release_reload_failed",
        "persisted paper trading comparison research release is unreadable or corrupt"
      );
    }
  }

  async listPaperTradingComparisonResearchReleases(): Promise<
    PaperTradingComparisonResearchReleaseRecord[]
  > {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-research-releases"
      );
      return records.map((record) => {
        this.assertPersistedPaperTradingComparisonResearchRelease(record);
        return record;
      }).sort((left, right) =>
        left.released_at.localeCompare(right.released_at) ||
        left.paper_trading_comparison_research_release_id.localeCompare(
          right.paper_trading_comparison_research_release_id
        ));
    } catch (error) {
      if (error instanceof LocalStoreError && error.code ===
        "paper_trading_comparison_research_release_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_research_release_reload_failed",
        "persisted paper trading comparison research release collection is unreadable or corrupt"
      );
    }
  }

  async recoverPaperTradingComparisonResearchReleases(): Promise<
    PaperTradingComparisonResearchReleaseRecord[]
  > {
    return this.withComparisonEvidenceWriteTransaction(async () => {
      const releases = await this.listPaperTradingComparisonResearchReleases();
      for (const release of releases) {
        await this.validatePaperTradingComparisonResearchReleaseGraph(release);
        await this.materializePaperTradingComparisonResearchRelease(release);
      }
      return releases;
    });
  }

  private assertPersistedPaperTradingComparisonResearchRelease(
    record: unknown
  ): asserts record is PaperTradingComparisonResearchReleaseRecord {
    if (!paperTradingComparisonResearchReleaseHasRuntimeShape(record) ||
      record.release_digest !== comparisonExactRecordDigest(
        paperTradingComparisonResearchReleaseDigestInput(record)
      )) {
      throw new LocalStoreError(
        "paper_trading_comparison_research_release_reload_failed",
        "persisted paper trading comparison research release is malformed or corrupt"
      );
    }
  }

  private async validatePaperTradingComparisonResearchReleaseGraph(
    release: PaperTradingComparisonResearchReleaseRecord
  ): Promise<void> {
    const [campaign, outcome, candidate, candidateVersion, systemCode, sourceFinding,
      sourceLineage] = await Promise.all([
      this.getPaperTradingComparisonConfirmationCampaign(release.campaign_ref.id),
      this.getPaperTradingComparisonConfirmationCampaignOutcome(
        release.campaign_outcome_ref.id
      ),
      this.readOptionalRecord<TradingSystemCandidateRecord>(
        "candidates",
        release.candidate_ref.id
      ),
      this.getCandidateVersion(release.candidate_version_ref.id),
      this.getSystemCode(release.system_code_ref.id),
      this.readOptionalRecord<ResearchFindingRecord>(
        "research-findings",
        release.source_finding_ref.id
      ),
      this.readOptionalRecord<ArtifactLineageRecord>(
        "artifact-lineages",
        release.source_lineage_ref.id
      )
    ]);
    if (!campaign || !outcome || !candidate || !candidateVersion || !systemCode ||
      !sourceFinding || !sourceLineage) {
      throw new LocalStoreError(
        "paper_trading_comparison_research_release_reference_not_found",
        "paper trading comparison research release provenance was not found"
      );
    }
    await this.validatePaperTradingComparisonConfirmationCampaignOutcomeGraph(outcome);
    const admission = await this.getCandidateAdmissionDecision(
      campaign.challenger.candidate_admission_decision_ref.id
    );
    const materializationAttempt = candidate.materialized_from_attempt_ref
      ? await this.readOptionalRecord<CandidateMaterializationAttemptRecord>(
          "candidate-materialization-attempts",
          candidate.materialized_from_attempt_ref.id
        )
      : undefined;
    if (!admission || !materializationAttempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_research_release_reference_not_found",
        "paper trading comparison research release origin admission was not found"
      );
    }

    const decision = localPaperTradingComparisonResearchReleaseDecision(outcome);
    const expectedSupportingRefs: Ref[] = [
      { ...release.source_finding_ref },
      { ...release.campaign_ref },
      { ...release.campaign_outcome_ref },
      ...outcome.slot_results.flatMap((result) => result.verdict_ref
        ? [{ ...result.verdict_ref }]
        : [])
    ];
    const expectedFinding: ResearchFindingRecord = {
      record_kind: "research_finding",
      version: 1,
      research_finding_id:
        `${release.paper_trading_comparison_research_release_id}-finding`,
      research_worker_ref: { ...sourceFinding.research_worker_ref },
      research_direction_ref: { ...sourceFinding.research_direction_ref },
      experiment_run_ref: { ...sourceFinding.experiment_run_ref },
      trading_evaluation_result_ref: {
        ...sourceFinding.trading_evaluation_result_ref
      },
      finding_kind: decision.findingKind,
      summary: decision.summary,
      supporting_record_refs: expectedSupportingRefs,
      created_at: release.released_at,
      authority_status: "research_trace_only"
    };
    const expectedLineage: ArtifactLineageRecord = {
      record_kind: "artifact_lineage",
      version: 1,
      artifact_lineage_id:
        `${release.paper_trading_comparison_research_release_id}-lineage`,
      child_system_code_ref: { ...sourceLineage.child_system_code_ref },
      ...(sourceLineage.parent_system_code_ref
        ? { parent_system_code_ref: { ...sourceLineage.parent_system_code_ref } }
        : {}),
      source_finding_refs: [
        ...sourceLineage.source_finding_refs.map((ref) => ({ ...ref })),
        { record_kind: "research_finding", id: expectedFinding.research_finding_id }
      ],
      created_by_research_worker_ref: { ...sourceFinding.research_worker_ref },
      created_at: release.released_at,
      authority_status: "lineage_only"
    };
    const fullCycleLineage = materializationAttempt.full_cycle_lineage;
    const sourceLineageCreator = sourceLineage.created_by_research_worker_ref;
    const mismatchFields = [
      release.campaign_digest !== campaign.campaign_digest
        ? "campaign_digest" : undefined,
      release.campaign_outcome_digest !== outcome.outcome_digest
        ? "campaign_outcome_digest" : undefined,
      outcome.campaign_ref.id !== campaign.paper_trading_comparison_confirmation_campaign_id ||
        outcome.campaign_digest !== campaign.campaign_digest
        ? "campaign_outcome_graph" : undefined,
      !paperTradingComparisonRefsEqual(
        release.candidate_ref,
        campaign.challenger.candidate_ref
      ) ? "candidate_ref" : undefined,
      !paperTradingComparisonRefsEqual(
        release.candidate_version_ref,
        campaign.challenger.candidate_version_ref
      ) ? "candidate_version_ref" : undefined,
      !paperTradingComparisonRefsEqual(
        release.system_code_ref,
        campaign.challenger.system_code_ref
      ) ? "system_code_ref" : undefined,
      release.system_code_artifact_digest !==
        campaign.challenger.system_code_artifact_digest
        ? "system_code_artifact_digest" : undefined,
      candidate.active_version_id !== candidateVersion.candidate_version_id
        ? "candidate_version" : undefined,
      candidateVersion.system_code_ref?.id !== systemCode.system_code_id
        ? "candidate_version_system_code" : undefined,
      systemCode.artifact_digest !== release.system_code_artifact_digest
        ? "system_code_digest" : undefined,
      admission.status !== "admitted" || admission.runnable_paper_handoff !== true
        ? "admission_status" : undefined,
      admission.system_code_ref.id !== systemCode.system_code_id ||
        admission.submitted_artifact_digest !== systemCode.artifact_digest
        ? "admission_system_code" : undefined,
      admission.research_finding_ref.id !== sourceFinding.research_finding_id
        ? "admission_source_finding" : undefined,
      campaign.challenger.admission_decision_digest !== comparisonExactRecordDigest(
        paperTradingComparisonAdmissionDecisionDigestInput(admission)
      ) ? "admission_digest" : undefined,
      !paperTradingComparisonRefsEqual(
        release.source_finding_ref,
        admission.research_finding_ref
      ) ? "source_finding_ref" : undefined,
      release.source_finding_record_digest !== comparisonExactRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(sourceFinding)
      ) ? "source_finding_digest" : undefined,
      sourceFinding.experiment_run_ref.id !== admission.experiment_run_ref.id ||
        sourceFinding.trading_evaluation_result_ref.id !==
          admission.trading_evaluation_result_ref.id
        ? "source_finding_provenance" : undefined,
      Date.parse(sourceFinding.created_at) > Date.parse(admission.decided_at)
        ? "source_finding_time" : undefined,
      release.source_lineage_record_digest !== comparisonExactRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(sourceLineage)
      ) ? "source_lineage_digest" : undefined,
      sourceLineage.child_system_code_ref.id !== systemCode.system_code_id
        ? "source_lineage_child" : undefined,
      sourceLineage.parent_system_code_ref?.id !== admission.source_system_code_ref.id
        ? "source_lineage_parent" : undefined,
      !sourceLineage.source_finding_refs.some((ref) =>
        paperTradingComparisonRefsEqual(ref, release.source_finding_ref))
        ? "source_lineage_finding" : undefined,
      Date.parse(sourceLineage.created_at) > Date.parse(admission.decided_at)
        ? "source_lineage_time" : undefined,
      sourceLineageCreator !== undefined && !paperTradingComparisonRefsEqual(
        sourceLineageCreator,
        sourceFinding.research_worker_ref
      ) ? "source_lineage_creator" : undefined,
      !fullCycleLineage ? "full_cycle_lineage" : undefined,
      fullCycleLineage?.evaluation.direction_kind !== release.direction_kind
        ? "direction_kind" : undefined,
      fullCycleLineage?.generated.system_code_ref.id !== systemCode.system_code_id ||
        fullCycleLineage?.generated.artifact_digest !== systemCode.artifact_digest
        ? "full_cycle_generated" : undefined,
      fullCycleLineage?.source.system_code_ref?.id !== admission.source_system_code_ref.id
        ? "full_cycle_source" : undefined,
      release.release_kind !== decision.releaseKind
        ? "release_kind" : undefined,
      release.next_research_focus !== decision.nextResearchFocus
        ? "next_research_focus" : undefined,
      Date.parse(release.released_at) <= Date.parse(outcome.evaluated_at)
        ? "released_at" : undefined,
      !samePersistedComparisonRecord(release.finding, expectedFinding)
        ? "finding" : undefined,
      release.finding_record_digest !== comparisonExactRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(release.finding)
      ) ? "finding_digest" : undefined,
      !samePersistedComparisonRecord(release.lineage, expectedLineage)
        ? "lineage" : undefined,
      release.lineage_record_digest !== comparisonExactRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(release.lineage)
      ) ? "lineage_digest" : undefined
    ].filter((field): field is string => field !== undefined);
    if (mismatchFields.length > 0) {
      throw this.paperTradingComparisonResearchReleaseGraphInvalid(mismatchFields);
    }
  }

  private paperTradingComparisonResearchReleaseGraphInvalid(
    mismatchFields: string[] = []
  ): LocalStoreError {
    return new LocalStoreError(
      "paper_trading_comparison_research_release_graph_invalid",
      "paper trading comparison research release does not match exact origin evidence",
      { mismatch_fields: mismatchFields }
    );
  }

  private async assertPaperTradingComparisonResearchReleaseMaterializationCompatible(
    release: PaperTradingComparisonResearchReleaseRecord
  ): Promise<void> {
    const [finding, lineage] = await Promise.all([
      this.readOptionalRecord<ResearchFindingRecord>(
        "research-findings",
        release.finding.research_finding_id
      ),
      this.readOptionalRecord<ArtifactLineageRecord>(
        "artifact-lineages",
        release.lineage.artifact_lineage_id
      )
    ]);
    if (finding && !samePersistedComparisonRecord(finding, release.finding) ||
      lineage && !samePersistedComparisonRecord(lineage, release.lineage)) {
      throw new LocalStoreError(
        "paper_trading_comparison_research_release_materialization_conflict",
        "paper trading comparison research release materialization is append-only"
      );
    }
  }

  private async materializePaperTradingComparisonResearchRelease(
    release: PaperTradingComparisonResearchReleaseRecord
  ): Promise<void> {
    await this.assertPaperTradingComparisonResearchReleaseMaterializationCompatible(
      release
    );
    const finding = await this.readOptionalRecord<ResearchFindingRecord>(
      "research-findings",
      release.finding.research_finding_id
    );
    if (!finding) {
      await this.writeJson(
        this.itemPath("research-findings", release.finding.research_finding_id),
        release.finding
      );
    }
    const lineage = await this.readOptionalRecord<ArtifactLineageRecord>(
      "artifact-lineages",
      release.lineage.artifact_lineage_id
    );
    if (!lineage) {
      await this.assertArtifactLineageLinks(release.lineage);
      await this.writeJson(
        this.itemPath("artifact-lineages", release.lineage.artifact_lineage_id),
        release.lineage
      );
    }
  }

  private async assertPaperTradingComparisonResearchReleaseBoundWriteAllowed(
    recordKind: "research_finding" | "artifact_lineage",
    id: string,
    next: ResearchFindingRecord | ArtifactLineageRecord
  ): Promise<void> {
    const release = (await this.listPaperTradingComparisonResearchReleases()).find(
      (candidate) => recordKind === "research_finding"
        ? candidate.finding.research_finding_id === id
        : candidate.lineage.artifact_lineage_id === id
    );
    if (!release) return;
    const expected = recordKind === "research_finding"
      ? release.finding
      : release.lineage;
    if (!samePersistedComparisonRecord(expected, next)) {
      throw new LocalStoreError(
        "paper_trading_comparison_research_release_bound_record_conflict",
        "release-bound research evidence is append-only"
      );
    }
  }

  async recordPaperTradingComparisonPairedCheckpoint(
    input: RecordPaperTradingComparisonPairedCheckpointInput
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordPaperTradingComparisonPairedCheckpointUnlocked(input)
    );
  }

  private async recordPaperTradingComparisonPairedCheckpointUnlocked(
    input: RecordPaperTradingComparisonPairedCheckpointInput
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord> {
    this.assertPairedCheckpointInputShape(input);
    const transactionId = input.attempt.paper_trading_comparison_checkpoint_attempt_id;
    const existing = await this.getPaperTradingComparisonCheckpointTransaction(transactionId);
    if (existing) {
      if (!samePersistedComparisonRecord(existing.champion.prepared, input.champion) ||
        !samePersistedComparisonRecord(existing.challenger.prepared, input.challenger) ||
        !samePersistedComparisonRecord(existing.outcome, input.outcome) ||
        existing.checkpoint_attempt_digest !== input.attempt.attempt_digest) {
        throw new LocalStoreError(
          "paper_trading_comparison_paired_checkpoint_transaction_conflict",
          "paper trading comparison checkpoint transaction is append-only"
        );
      }
      await this.materializePaperTradingComparisonCheckpointTransaction(existing);
      return existing.outcome;
    }

    const transaction = await this.buildPaperTradingComparisonCheckpointTransaction(input);
    await this.writeJson(
      this.itemPath(
        "paper-trading-comparison-checkpoint-transactions",
        transaction.transaction_id
      ),
      transaction
    );
    await this.materializePaperTradingComparisonCheckpointTransaction(transaction);
    return transaction.outcome;
  }

  async recoverPaperTradingComparisonCheckpointTransactions(): Promise<
    PaperTradingComparisonCheckpointOutcomeRecord[]
  > {
    return this.withComparisonEvidenceWriteTransaction(async () => {
      const transactions = await this.listPaperTradingComparisonCheckpointTransactions();
      const transitionHistories = this.buildPaperTradingComparisonCheckpointTransitionHistories(
        transactions
      );
      const outcomes: PaperTradingComparisonCheckpointOutcomeRecord[] = [];
      for (const transaction of transactions) {
        await this.materializePaperTradingComparisonCheckpointTransaction(transaction, {
          transitionHistories,
          rebuildProjections: false
        });
        outcomes.push(transaction.outcome);
      }
      await this.rebuildProjections();
      return outcomes;
    });
  }

  private assertPairedCheckpointInputShape(
    input: RecordPaperTradingComparisonPairedCheckpointInput
  ): void {
    if (!paperTradingComparisonCheckpointAttemptHasRuntimeShape(input.attempt) ||
      !paperTradingComparisonCheckpointOutcomeHasRuntimeShape(input.outcome) ||
      input.outcome.outcome_status !== "paired" ||
      !this.preparedCheckpointSideHasRuntimeShape(input.champion, "champion") ||
      !this.preparedCheckpointSideHasRuntimeShape(input.challenger, "challenger")) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_paired_checkpoint_input",
        "invalid paper trading comparison paired checkpoint input"
      );
    }
  }

  private preparedCheckpointSideHasRuntimeShape(
    value: unknown,
    role: "champion" | "challenger"
  ): value is PreparedPaperTradingComparisonCheckpointSideInput {
    if (!isPlainObject(value)) return false;
    const side = value as unknown as PreparedPaperTradingComparisonCheckpointSideInput;
    if (side.role !== role || !Array.isArray(side.ledger_inputs) ||
      !Array.isArray(side.ledger_outcomes) ||
      side.ledger_inputs.length !== side.ledger_outcomes.length ||
      !isPlainObject(side.observation) || !isPlainObject(side.evaluation) ||
      !Number.isInteger(side.consumed_event_count) || side.consumed_event_count < 0 ||
      !Number.isInteger(side.provider_request_count_after) ||
      side.provider_request_count_after < 0 ||
      typeof side.preparation_digest !== "string" ||
      side.preparation_digest.length === 0) {
      return false;
    }
    const { preparation_digest: _digest, ...payload } = side;
    try {
      return side.preparation_digest === comparisonExactRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(payload)
      );
    } catch {
      return false;
    }
  }

  private async buildPaperTradingComparisonCheckpointTransaction(
    input: RecordPaperTradingComparisonPairedCheckpointInput
  ): Promise<LocalPaperTradingComparisonCheckpointTransaction> {
    const persistedAttempt = await this.getPaperTradingComparisonCheckpointAttempt(
      input.attempt.paper_trading_comparison_checkpoint_attempt_id
    );
    if (!persistedAttempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_reference_not_found",
        "paper trading comparison checkpoint attempt was not found"
      );
    }
    if (!samePersistedComparisonRecord(persistedAttempt, input.attempt) ||
      !paperTradingComparisonRefsEqual(
        input.outcome.checkpoint_attempt_ref,
        {
          record_kind: "paper_trading_comparison_checkpoint_attempt",
          id: persistedAttempt.paper_trading_comparison_checkpoint_attempt_id
        }
      ) ||
      input.outcome.checkpoint_attempt_digest !== persistedAttempt.attempt_digest ||
      !paperTradingComparisonRefsEqual(input.outcome.tick_ref, persistedAttempt.tick_ref) ||
      input.outcome.tick_digest !== persistedAttempt.tick_digest ||
      input.outcome.checkpoint_sequence !== persistedAttempt.checkpoint_sequence) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_reference_mismatch",
        "paired checkpoint outcome does not match its persisted attempt"
      );
    }
    if (Date.parse(input.outcome.completed_at) < Date.parse(persistedAttempt.attempted_at) ||
      Date.parse(input.outcome.completed_at) >
        Date.parse(persistedAttempt.checkpoint_deadline_at)) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_state_conflict",
        "paired checkpoint outcome lies outside its recorded deadline"
      );
    }
    const existingOutcomes = await this.listPaperTradingComparisonCheckpointOutcomes(
      persistedAttempt.paper_trading_comparison_checkpoint_attempt_id
    );
    if (existingOutcomes.length > 0) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_state_conflict",
        "paper trading comparison checkpoint attempt already has a terminal outcome"
      );
    }

    const activationAttempt = await this.getPaperTradingComparisonActivationAttempt(
      persistedAttempt.paper_trading_comparison_activation_attempt_ref.id
    );
    if (!activationAttempt) {
      throw new LocalStoreError(
        "paper_trading_comparison_checkpoint_attempt_reference_not_found",
        "paper trading comparison activation attempt was not found"
      );
    }
    const closure = await this.loadPaperTradingComparisonActivationAttemptClosure(
      activationAttempt
    );
    const [activationOutcomes, checkpointTick] = await Promise.all([
      this.listPaperTradingComparisonActivationOutcomes(
        activationAttempt.paper_trading_comparison_activation_attempt_id
      ),
      this.getPaperTradingComparisonTick(persistedAttempt.tick_ref.id)
    ]);
    const latestActivationOutcome = activationOutcomes.at(-1);
    if (!checkpointTick || checkpointTick.tick_digest !== persistedAttempt.tick_digest ||
      checkpointTick.sequence !== persistedAttempt.checkpoint_sequence ||
      !latestActivationOutcome || latestActivationOutcome.outcome_status !== "both_running" ||
      latestActivationOutcome.paper_trading_comparison_activation_outcome_id !==
        persistedAttempt.activation_outcome_ref.id ||
      latestActivationOutcome.outcome_digest !== persistedAttempt.activation_outcome_digest) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_state_conflict",
        "paired checkpoint requires the exact latest both-running activation outcome"
      );
    }
    const [championState, challengerState] = await Promise.all([
      this.loadPaperTradingComparisonRuntimeSideState(
        activationAttempt,
        "champion",
        closure.comparison,
        "paper_trading_comparison_checkpoint_attempt_graph_invalid",
        { allowCommittedCheckpoint: persistedAttempt.checkpoint_sequence > 1 }
      ),
      this.loadPaperTradingComparisonRuntimeSideState(
        activationAttempt,
        "challenger",
        closure.comparison,
        "paper_trading_comparison_checkpoint_attempt_graph_invalid",
        { allowCommittedCheckpoint: persistedAttempt.checkpoint_sequence > 1 }
      )
    ]);
    const champion = await this.buildPaperTradingComparisonCheckpointTransactionSide({
      role: "champion",
      prepared: input.champion,
      checkpointAttempt: persistedAttempt,
      activationAttempt,
      state: championState,
      tick: checkpointTick,
      outcomeEvidence: input.outcome.champion
    });
    const challenger = await this.buildPaperTradingComparisonCheckpointTransactionSide({
      role: "challenger",
      prepared: input.challenger,
      checkpointAttempt: persistedAttempt,
      activationAttempt,
      state: challengerState,
      tick: checkpointTick,
      outcomeEvidence: input.outcome.challenger
    });
    if (champion.prepared.observation.paper_trading_observation_id ===
      challenger.prepared.observation.paper_trading_observation_id) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_reference_mismatch",
        "paired checkpoint sides cannot share an observation identity"
      );
    }
    const draft: LocalPaperTradingComparisonCheckpointTransaction = {
      record_kind: "local_paper_trading_comparison_checkpoint_transaction",
      version: 1,
      transaction_id: persistedAttempt.paper_trading_comparison_checkpoint_attempt_id,
      checkpoint_attempt_ref: {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: persistedAttempt.paper_trading_comparison_checkpoint_attempt_id
      },
      checkpoint_attempt_digest: persistedAttempt.attempt_digest,
      outcome: structuredClone(input.outcome),
      champion,
      challenger,
      transaction_digest: ""
    };
    return withLocalCheckpointTransactionDigest(draft);
  }

  private async buildPaperTradingComparisonCheckpointTransactionSide(input: {
    role: "champion" | "challenger";
    prepared: PreparedPaperTradingComparisonCheckpointSideInput;
    checkpointAttempt: PaperTradingComparisonCheckpointAttemptRecord;
    activationAttempt: PaperTradingComparisonActivationAttemptRecord;
    state: PaperTradingComparisonRuntimeSideState;
    tick: PaperTradingComparisonTickRecord;
    outcomeEvidence: PaperTradingComparisonCheckpointOutcomeRecord["champion"];
  }): Promise<LocalPaperTradingComparisonCheckpointTransactionSide> {
    const { role, prepared, checkpointAttempt, activationAttempt, state, tick } = input;
    const evidence = input.outcomeEvidence;
    const observation = prepared.observation;
    const evaluation = prepared.evaluation;
    const acknowledgement = evidence?.tick_acknowledgement_ref
      ? await this.getPaperTradingComparisonTickAcknowledgement(
          evidence.tick_acknowledgement_ref.id
        )
      : undefined;
    const delivery = acknowledgement
      ? await this.getPaperTradingComparisonTickDelivery(
          acknowledgement.delivery_ref.id
        )
      : undefined;
    const acknowledgementMatches = checkpointAttempt.checkpoint_sequence === 1
      ? acknowledgement === undefined && delivery === undefined &&
        observation.paper_trading_comparison_tick_acknowledgement_ref === undefined &&
        observation.paper_trading_comparison_tick_acknowledgement_digest === undefined
      : Boolean(
          acknowledgement && delivery && evidence &&
          paperTradingComparisonRefsEqual(evidence.tick_acknowledgement_ref, {
            record_kind: "paper_trading_comparison_tick_acknowledgement",
            id: acknowledgement.paper_trading_comparison_tick_acknowledgement_id
          }) &&
          evidence.tick_acknowledgement_digest ===
            acknowledgement.acknowledgement_digest &&
          paperTradingComparisonRefsEqual(
            observation.paper_trading_comparison_tick_acknowledgement_ref,
            evidence.tick_acknowledgement_ref
          ) &&
          observation.paper_trading_comparison_tick_acknowledgement_digest ===
            evidence.tick_acknowledgement_digest &&
          acknowledgement.paper_trading_comparison_activation_attempt_ref.id ===
            activationAttempt.paper_trading_comparison_activation_attempt_id &&
          acknowledgement.paper_trading_comparison_activation_attempt_digest ===
            activationAttempt.attempt_digest &&
          acknowledgement.role === role &&
          acknowledgement.trading_run_ref.id === state.run.trading_run_id &&
          acknowledgement.tick_ref.id === tick.paper_trading_comparison_tick_id &&
          acknowledgement.tick_digest === tick.tick_digest &&
          acknowledgement.tick_sequence === checkpointAttempt.checkpoint_sequence &&
          delivery.paper_trading_comparison_tick_delivery_id ===
            acknowledgement.delivery_ref.id &&
          delivery.delivery_digest === acknowledgement.delivery_digest &&
          delivery.role === role &&
          delivery.trading_run_ref.id === state.run.trading_run_id &&
          delivery.tick_ref.id === tick.paper_trading_comparison_tick_id &&
          delivery.tick_digest === tick.tick_digest &&
          delivery.tick_sequence === checkpointAttempt.checkpoint_sequence &&
          delivery.provider_request_count_at_delivery >=
            checkpointAttempt[role].provider_request_count_before &&
          acknowledgement.provider_request_count_at_acknowledgement >=
            delivery.provider_request_count_at_delivery &&
          prepared.provider_request_count_after >=
            acknowledgement.provider_request_count_at_acknowledgement &&
          Date.parse(delivery.delivered_at) >= Date.parse(checkpointAttempt.attempted_at) &&
          Date.parse(acknowledgement.acknowledged_at) >= Date.parse(delivery.delivered_at) &&
          Date.parse(acknowledgement.acknowledged_at) <=
            Date.parse(checkpointAttempt.checkpoint_deadline_at)
        );
    if (!evidence || evidence.role !== role ||
      !acknowledgementMatches ||
      !paperTradingComparisonRefsEqual(
        checkpointAttempt[role].trading_run_ref,
        state.run.record_kind === "trading_run"
          ? { record_kind: "trading_run", id: state.run.trading_run_id }
          : undefined
      ) ||
      !paperTradingComparisonRefsEqual(
        checkpointAttempt[role].paper_trading_evaluation_ref,
        { record_kind: "paper_trading_evaluation", id: state.evaluation.paper_trading_evaluation_id }
      ) ||
      !paperTradingComparisonRefsEqual(
        observation.paper_trading_evaluation_ref,
        checkpointAttempt[role].paper_trading_evaluation_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        observation.paper_trading_evaluation_commitment_ref,
        activationAttempt[role].paper_trading_evaluation_commitment_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        observation.paper_trading_comparison_tick_ref,
        checkpointAttempt.tick_ref
      ) ||
      observation.paper_trading_comparison_tick_digest !== checkpointAttempt.tick_digest ||
      !paperTradingComparisonRefsEqual(
        observation.paper_trading_comparison_checkpoint_attempt_ref,
        {
          record_kind: "paper_trading_comparison_checkpoint_attempt",
          id: checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
        }
      ) ||
      observation.paper_trading_comparison_checkpoint_attempt_digest !==
        checkpointAttempt.attempt_digest ||
      observation.sequence !== checkpointAttempt.checkpoint_sequence ||
      observation.observed_at !== tick.observed_at ||
      !samePersistedComparisonRecord(observation.market_snapshot, tick.market_snapshot) ||
      !samePersistedComparisonRecord(
        observation.public_execution_snapshot,
        tick.public_execution_snapshot
      ) ||
      evaluation.paper_trading_evaluation_id !==
        state.evaluation.paper_trading_evaluation_id ||
      evaluation.observation_count !== state.evaluation.observation_count + 1 ||
      evaluation.last_observed_at !== tick.observed_at ||
      (observation.status === "failed"
        ? evaluation.status !== "failed"
        : evaluation.status !== "running") ||
      !paperTradingObservationReferencesMatch(
        observation,
        evaluation,
        state.commitment
      ) ||
      !paperTradingComparisonRefsEqual(
        evidence.observation_ref,
        { record_kind: "paper_trading_observation", id: observation.paper_trading_observation_id }
      ) ||
      evidence.observation_record_digest !== comparisonExactRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(observation)
      ) ||
      evidence.evaluation_record_digest !== comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(evaluation)
      ) ||
      evidence.observation_status !== observation.status ||
      evidence.consumed_event_count !== prepared.consumed_event_count ||
      evidence.provider_request_count_after !== prepared.provider_request_count_after ||
      evidence.provider_request_count_after <
        checkpointAttempt[role].provider_request_count_before ||
      evidence.provider_request_count_after >
        activationAttempt.activation_policy.maximum_provider_request_count_per_side) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_reference_mismatch",
        `paired checkpoint ${role} side does not match its frozen graph and tick`
      );
    }
    await this.validatePaperTradingAccountLineage({
      commitment: state.commitment,
      existingEvaluation: state.evaluation,
      observation,
      evaluation
    });
    await this.validatePaperTradingEvaluationWrite(evaluation, state.evaluation);

    const ledgerPlans: LocalLedgerWritePlan[] = [];
    let currentRuntime = state.run;
    let currentStageBinding = currentRuntime.stage_binding_ref
      ? await this.readOptionalRecord<StageBindingRecord>(
          "stage-bindings",
          currentRuntime.stage_binding_ref.id
        )
      : undefined;
    for (let index = 0; index < prepared.ledger_inputs.length; index += 1) {
      const ledgerInput = prepared.ledger_inputs[index]!;
      if (ledgerInput.runtime_id !== state.run.trading_run_id) {
        throw new LocalStoreError(
          "paper_trading_comparison_paired_checkpoint_reference_mismatch",
          `paired checkpoint ${role} Ledger input targets another runtime`
        );
      }
      const plan = await this.buildLedgerWritePlan(ledgerInput, {
        runtime: currentRuntime,
        ...(currentStageBinding ? { stageBinding: currentStageBinding } : {})
      });
      if (plan.existing || !samePersistedComparisonRecord(
        plan.outcome,
        prepared.ledger_outcomes[index]
      )) {
        throw new LocalStoreError(
          "paper_trading_comparison_paired_checkpoint_state_conflict",
          `paired checkpoint ${role} Ledger preview is stale or already materialized`
        );
      }
      ledgerPlans.push(plan);
      currentRuntime = plan.updatedRuntime;
      const plannedStageBinding = plan.immutableRecords.find(
        (record) => record.collection === "stage-bindings"
      )?.record;
      if (plannedStageBinding?.record_kind === "stage_binding") {
        currentStageBinding = plannedStageBinding as StageBindingRecord;
      }
    }
    const expectedLedgerRefs = ledgerPlans.map((plan) => ({
      record_kind: "ledger_chain",
      id: plan.outcome.order_request.order_request_id
    }));
    if (!samePersistedComparisonRecord(evidence.ledger_chain_refs, expectedLedgerRefs) ||
      evidence.consumed_event_count !== (
        evaluation.processed_trading_system_event_ids?.length ?? 0
      ) - (state.evaluation.processed_trading_system_event_ids?.length ?? 0) ||
      (ledgerPlans.length === 0
        ? observation.ledger_ref !== undefined
        : !paperTradingComparisonRefsEqual(
            observation.ledger_ref,
            expectedLedgerRefs.at(-1)
          ))) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_reference_mismatch",
        `paired checkpoint ${role} Ledger and event evidence is inconsistent`
      );
    }
    return {
      prepared: structuredClone(prepared),
      previous_evaluation: structuredClone(state.evaluation),
      ledger_plans: ledgerPlans
    };
  }

  private async materializePaperTradingComparisonCheckpointTransaction(
    transaction: LocalPaperTradingComparisonCheckpointTransaction,
    options: {
      transitionHistories?: Map<
        string,
        Array<TradingRunRecord | PaperTradingEvaluationRecord>
      >;
      rebuildProjections?: boolean;
    } = {}
  ): Promise<void> {
    this.assertPersistedPaperTradingComparisonCheckpointTransaction(transaction);
    for (const side of [transaction.champion, transaction.challenger]) {
      for (const plan of side.ledger_plans) {
        for (const item of plan.immutableRecords) {
          if (item.collection === "trading-runs") continue;
          await this.materializeExactCheckpointRecord(item);
        }
        await this.materializeCheckpointTransition(
          "trading-runs",
          plan.updatedRuntime.trading_run_id,
          plan.previousRuntime,
          plan.updatedRuntime,
          options.transitionHistories?.get(
            `trading-runs:${plan.updatedRuntime.trading_run_id}`
          )
        );
      }
      await this.materializeExactCheckpointRecord({
        collection: "paper-trading-observations",
        id: side.prepared.observation.paper_trading_observation_id,
        record: side.prepared.observation
      });
      await this.materializeCheckpointTransition(
        "paper-trading-evaluations",
        side.prepared.evaluation.paper_trading_evaluation_id,
        side.previous_evaluation,
        side.prepared.evaluation,
        options.transitionHistories?.get(
          `paper-trading-evaluations:${side.prepared.evaluation.paper_trading_evaluation_id}`
        )
      );
    }
    await this.materializeExactCheckpointRecord({
      collection: "paper-trading-comparison-checkpoint-outcomes",
      id: transaction.outcome.paper_trading_comparison_checkpoint_outcome_id,
      record: transaction.outcome
    });
    if (options.rebuildProjections !== false) await this.rebuildProjections();
  }

  private async materializeExactCheckpointRecord(item: FixtureItem): Promise<void> {
    const existing = await this.readOptionalRecord<unknown>(
      item.collection,
      item.id,
      item.itemDir
    );
    if (existing !== undefined && !samePersistedComparisonRecord(existing, item.record)) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_materialization_conflict",
        `paired checkpoint materialization conflicts with ${item.collection}:${item.id}`
      );
    }
    if (existing === undefined) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
  }

  private async materializeCheckpointTransition(
    collection: "trading-runs" | "paper-trading-evaluations",
    id: string,
    before: TradingRunRecord | PaperTradingEvaluationRecord,
    after: TradingRunRecord | PaperTradingEvaluationRecord,
    transitionHistory?: Array<TradingRunRecord | PaperTradingEvaluationRecord>
  ): Promise<void> {
    const existing = await this.readOptionalRecord<unknown>(collection, id);
    const existingHistoryIndex = transitionHistory?.findIndex((record) =>
      samePersistedComparisonRecord(existing, record)
    ) ?? -1;
    const afterHistoryIndex = transitionHistory?.findIndex((record) =>
      samePersistedComparisonRecord(after, record)
    ) ?? -1;
    if (existingHistoryIndex > afterHistoryIndex && afterHistoryIndex >= 0) return;
    const latestHistoryRecord = transitionHistory?.at(-1);
    if (latestHistoryRecord && this.checkpointTransitionHasExactStoppedSuccessor(
      collection,
      existing,
      latestHistoryRecord
    )) return;
    if (existing !== undefined &&
      !samePersistedComparisonRecord(existing, before) &&
      !samePersistedComparisonRecord(existing, after)) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_materialization_conflict",
        `paired checkpoint transition conflicts with ${collection}:${id}`
      );
    }
    if (!samePersistedComparisonRecord(existing, after)) {
      await this.writeJson(this.itemPath(collection, id), after);
    }
  }

  private checkpointTransitionHasExactStoppedSuccessor(
    collection: "trading-runs" | "paper-trading-evaluations",
    existing: unknown,
    latestHistoryRecord: TradingRunRecord | PaperTradingEvaluationRecord
  ): boolean {
    if (!isPlainObject(existing)) return false;
    if (collection === "trading-runs") {
      const stopped = existing as unknown as TradingRunRecord;
      const running = latestHistoryRecord as TradingRunRecord;
      return stopped.record_kind === "trading_run" &&
        running.record_kind === "trading_run" &&
        stopped.runtime_lifecycle_status === "stopped" &&
        running.runtime_lifecycle_status === "running" &&
        samePersistedComparisonRecord(
          { ...stopped, runtime_lifecycle_status: "running" },
          running
        );
    }

    const stopped = existing as unknown as PaperTradingEvaluationRecord;
    const running = latestHistoryRecord as PaperTradingEvaluationRecord;
    if (stopped.record_kind !== "paper_trading_evaluation" ||
      running.record_kind !== "paper_trading_evaluation" ||
      stopped.status !== "stopped" || running.status !== "running" ||
      !isIsoTimestamp(stopped.stopped_at)) return false;
    const { stopped_at: _stoppedAt, ...withoutStoppedAt } = stopped;
    return samePersistedComparisonRecord(
      {
        ...withoutStoppedAt,
        status: "running",
        next_observation_at: running.next_observation_at
      },
      running
    );
  }

  private buildPaperTradingComparisonCheckpointTransitionHistories(
    transactions: LocalPaperTradingComparisonCheckpointTransaction[]
  ): Map<string, Array<TradingRunRecord | PaperTradingEvaluationRecord>> {
    const histories = new Map<
      string,
      Array<TradingRunRecord | PaperTradingEvaluationRecord>
    >();
    const append = (
      collection: "trading-runs" | "paper-trading-evaluations",
      id: string,
      before: TradingRunRecord | PaperTradingEvaluationRecord,
      after: TradingRunRecord | PaperTradingEvaluationRecord
    ) => {
      const key = `${collection}:${id}`;
      const history = histories.get(key) ?? [];
      const previous = history.at(-1);
      if (previous && !samePersistedComparisonRecord(previous, before)) {
        throw new LocalStoreError(
          "paper_trading_comparison_paired_checkpoint_transaction_reload_failed",
          `paired checkpoint transition history is not contiguous for ${key}`
        );
      }
      if (!previous) history.push(before);
      history.push(after);
      histories.set(key, history);
    };
    for (const transaction of transactions) {
      for (const side of [transaction.champion, transaction.challenger]) {
        for (const plan of side.ledger_plans) {
          append(
            "trading-runs",
            plan.updatedRuntime.trading_run_id,
            plan.previousRuntime,
            plan.updatedRuntime
          );
        }
        append(
          "paper-trading-evaluations",
          side.prepared.evaluation.paper_trading_evaluation_id,
          side.previous_evaluation,
          side.prepared.evaluation
        );
      }
    }
    return histories;
  }

  private async getPaperTradingComparisonCheckpointTransaction(
    transactionId: string
  ): Promise<LocalPaperTradingComparisonCheckpointTransaction | undefined> {
    try {
      const record = await this.readOptionalRecord<unknown>(
        "paper-trading-comparison-checkpoint-transactions",
        transactionId
      );
      if (record === undefined) return undefined;
      this.assertPersistedPaperTradingComparisonCheckpointTransaction(record);
      return record;
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code ===
          "paper_trading_comparison_paired_checkpoint_transaction_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_transaction_reload_failed",
        "persisted paired checkpoint transaction is unreadable or corrupt"
      );
    }
  }

  private async listPaperTradingComparisonCheckpointTransactions(): Promise<
    LocalPaperTradingComparisonCheckpointTransaction[]
  > {
    try {
      const records = await this.readCollection<unknown>(
        "paper-trading-comparison-checkpoint-transactions"
      );
      return records.map((record) => {
        this.assertPersistedPaperTradingComparisonCheckpointTransaction(record);
        return record;
      }).sort((left, right) =>
        left.outcome.completed_at.localeCompare(right.outcome.completed_at) ||
        left.outcome.checkpoint_sequence - right.outcome.checkpoint_sequence ||
        left.transaction_id.localeCompare(right.transaction_id));
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code ===
          "paper_trading_comparison_paired_checkpoint_transaction_reload_failed") {
        throw error;
      }
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_transaction_reload_failed",
        "persisted paired checkpoint transaction collection is unreadable or corrupt"
      );
    }
  }

  private assertPersistedPaperTradingComparisonCheckpointTransaction(
    value: unknown
  ): asserts value is LocalPaperTradingComparisonCheckpointTransaction {
    if (!isPlainObject(value)) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_transaction_reload_failed",
        "paired checkpoint transaction has invalid runtime shape"
      );
    }
    const transaction = value as unknown as LocalPaperTradingComparisonCheckpointTransaction;
    if (transaction.record_kind !==
        "local_paper_trading_comparison_checkpoint_transaction" ||
      transaction.version !== 1 || typeof transaction.transaction_id !== "string" ||
      transaction.transaction_id.length === 0 ||
      !paperTradingComparisonRefsEqual(
        transaction.checkpoint_attempt_ref,
        {
          record_kind: "paper_trading_comparison_checkpoint_attempt",
          id: transaction.transaction_id
        }
      ) ||
      typeof transaction.checkpoint_attempt_digest !== "string" ||
      !paperTradingComparisonCheckpointOutcomeHasRuntimeShape(transaction.outcome) ||
      transaction.outcome.outcome_status !== "paired" ||
      !this.preparedCheckpointSideHasRuntimeShape(
        transaction.champion?.prepared,
        "champion"
      ) ||
      !this.preparedCheckpointSideHasRuntimeShape(
        transaction.challenger?.prepared,
        "challenger"
      ) ||
      !Array.isArray(transaction.champion.ledger_plans) ||
      !Array.isArray(transaction.challenger.ledger_plans) ||
      typeof transaction.transaction_digest !== "string") {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_transaction_reload_failed",
        "paired checkpoint transaction has invalid runtime shape"
      );
    }
    const { transaction_digest: _digest, ...payload } = transaction;
    let expectedDigest: string;
    try {
      expectedDigest = comparisonExactRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(payload)
      );
    } catch {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_transaction_reload_failed",
        "paired checkpoint transaction is not canonically digestible"
      );
    }
    if (transaction.transaction_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_paired_checkpoint_transaction_reload_failed",
        "paired checkpoint transaction digest does not match canonical content"
      );
    }
  }

  private paperTradingComparisonOutcomeResultRefMatches(
    resultRef: Ref | undefined,
    result: PaperTradingComparisonActivationSideResultRecord | undefined
  ): boolean {
    return resultRef === undefined && result === undefined || Boolean(
      resultRef && result &&
      resultRef.record_kind === "paper_trading_comparison_activation_side_result" &&
      resultRef.id === result.paper_trading_comparison_activation_side_result_id
    );
  }

  private paperTradingComparisonSideResultMatchesAttempt(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    result: PaperTradingComparisonActivationSideResultRecord,
    role: "champion" | "challenger"
  ): boolean {
    const side = attempt[role];
    return result.role === role &&
      paperTradingComparisonRefsEqual(
        result.paper_trading_comparison_activation_attempt_ref,
        {
          record_kind: "paper_trading_comparison_activation_attempt",
          id: attempt.paper_trading_comparison_activation_attempt_id
        }
      ) &&
      result.paper_trading_comparison_activation_attempt_digest === attempt.attempt_digest &&
      paperTradingComparisonRefsEqual(
        result.paper_trading_comparison_activation_ref,
        attempt.paper_trading_comparison_activation_ref
      ) &&
      result.paper_trading_comparison_activation_digest ===
        attempt.paper_trading_comparison_activation_digest &&
      paperTradingComparisonRefsEqual(result.trading_run_ref, side.trading_run_ref) &&
      paperTradingComparisonRefsEqual(
        result.paper_trading_evaluation_ref,
        side.paper_trading_evaluation_ref
      ) &&
      result.provider_request_count <=
        attempt.activation_policy.maximum_provider_request_count_per_side &&
      Date.parse(result.effect_started_at) >= Date.parse(attempt.attempted_at);
  }

  private paperTradingComparisonSideIsRunningWithinAttempt(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    result: PaperTradingComparisonActivationSideResultRecord,
    state: PaperTradingComparisonRuntimeSideState
  ): boolean {
    const startedAt = state.sandbox?.started_at;
    return result.operation === "start" &&
      result.outcome === "succeeded" &&
      result.provider_request_count <=
        attempt.activation_policy.maximum_provider_request_count_per_side &&
      Date.parse(result.effect_completed_at) <= Date.parse(attempt.start_deadline_at) &&
      state.run.runtime_lifecycle_status === "running" &&
      state.evaluation.status === "running" &&
      state.sandbox?.lifecycle_status === "running" &&
      paperTradingComparisonRefsEqual(result.sandbox_ref, state.run.sandbox_ref) &&
      result.sandbox_ref?.id === state.sandbox.sandbox_id &&
      isIsoTimestamp(startedAt) &&
      Date.parse(startedAt) >= Date.parse(attempt.attempted_at) &&
      Date.parse(startedAt) <= Date.parse(result.effect_completed_at);
  }

  private paperTradingComparisonSideIsStoppedCleanly(
    result: PaperTradingComparisonActivationSideResultRecord,
    state: PaperTradingComparisonRuntimeSideState
  ): boolean {
    const inactiveSandbox = !state.sandbox ||
      state.sandbox.lifecycle_status === "stopped" ||
      state.sandbox.lifecycle_status === "removed";
    return result.operation === "stop" &&
      (result.outcome === "succeeded" || result.outcome === "not_running") &&
      (state.run.runtime_lifecycle_status === "registered" ||
        state.run.runtime_lifecycle_status === "stopped") &&
      (state.evaluation.status === "not_started" || state.evaluation.status === "stopped" ||
        state.evidenceState === "paired_checkpoint" && state.evaluation.status === "failed") &&
      inactiveSandbox;
  }

  private paperTradingComparisonCleanupRequiredHasEvidence(
    outcome: PaperTradingComparisonActivationOutcomeRecord,
    championResult: PaperTradingComparisonActivationSideResultRecord | undefined,
    challengerResult: PaperTradingComparisonActivationSideResultRecord | undefined,
    championState: PaperTradingComparisonRuntimeSideState,
    challengerState: PaperTradingComparisonRuntimeSideState
  ): boolean {
    if (outcome.outcome_reason === "side_result_persistence_failed") {
      return !championResult || !challengerResult;
    }
    const results = [championResult, challengerResult].filter(
      (result): result is PaperTradingComparisonActivationSideResultRecord =>
        result !== undefined
    );
    const uncertainResult = results.some((result) =>
      result.outcome === "failed" || result.outcome === "timed_out");
    const activeOrFailedState = [championState, challengerState].some((state) =>
      !["registered", "stopped"].includes(
        state.run.runtime_lifecycle_status ?? "unknown"
      ) || !["not_started", "stopped"].includes(state.evaluation.status) ||
      Boolean(state.sandbox && !["stopped", "removed"].includes(
        state.sandbox.lifecycle_status
      )));
    if (outcome.outcome_reason === "start_failed") {
      return activeOrFailedState && results.some((result) =>
        result.operation === "start" && result.outcome === "failed");
    }
    if (outcome.outcome_reason === "start_timed_out") {
      return results.some((result) =>
        result.operation === "start" && result.outcome === "timed_out");
    }
    return uncertainResult || activeOrFailedState;
  }

  private async readPaperTradingComparisonCollection(
    collection:
      | "paper-trading-evaluation-commitments"
      | "paper-trading-evaluations"
      | "paper-trading-observations",
    errorCode: LocalStoreErrorCode
  ): Promise<unknown[]> {
    try {
      return await this.readCollection<unknown>(collection);
    } catch {
      throw new LocalStoreError(
        errorCode,
        `persisted ${collection} data is unreadable or corrupt`
      );
    }
  }

  private async scanPaperTradingComparisonCommitments(
    errorCode: LocalStoreErrorCode
  ): Promise<PaperTradingEvaluationCommitmentRecord[]> {
    const records = await this.readPaperTradingComparisonCollection(
      "paper-trading-evaluation-commitments",
      errorCode
    );
    return records.map((record) => {
      if (!isPaperTradingEvaluationCommitmentRecord(record)) {
        throw new LocalStoreError(
          errorCode,
          "persisted paper trading comparison commitment evidence has invalid runtime shape"
        );
      }
      return record;
    });
  }

  private async scanPaperTradingComparisonEvaluations(
    errorCode: LocalStoreErrorCode
  ): Promise<PaperTradingEvaluationRecord[]> {
    const records = await this.readPaperTradingComparisonCollection(
      "paper-trading-evaluations",
      errorCode
    );
    return records.map((record) => {
      if (!isPaperTradingComparisonEvaluationScanRecord(record)) {
        throw new LocalStoreError(
          errorCode,
          "persisted paper trading comparison evaluation has invalid runtime shape"
        );
      }
      return record;
    });
  }

  private async scanPaperTradingComparisonObservations(
    errorCode: LocalStoreErrorCode
  ): Promise<PaperTradingObservationRecord[]> {
    const records = await this.readPaperTradingComparisonCollection(
      "paper-trading-observations",
      errorCode
    );
    return records.map((record) => {
      if (!isPaperTradingComparisonObservationScanRecord(record)) {
        throw new LocalStoreError(
          errorCode,
          "persisted paper trading comparison observation has invalid runtime shape"
        );
      }
      return record;
    });
  }

  private async validatePaperTradingComparisonPreparation(
    preparation: PaperTradingComparisonPreparationRecord,
    requireCurrentSelection: boolean,
    persistedEvidenceErrorCode: LocalStoreErrorCode =
      "paper_trading_comparison_champion_selection_mismatch"
  ): Promise<void> {
    if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
      throw new LocalStoreError(
        "invalid_paper_trading_comparison_preparation_input",
        "invalid paper trading comparison preparation input"
      );
    }
    const expectedDigest = `sha256:${createHash("sha256")
      .update(paperTradingComparisonPreparationDigestInput(preparation))
      .digest("hex")}`;
    if (preparation.preparation_digest !== expectedDigest) {
      throw new LocalStoreError(
        "paper_trading_comparison_preparation_digest_mismatch",
        "paper trading comparison preparation digest does not match canonical content"
      );
    }
    const loadedSides = await Promise.all([preparation.champion, preparation.challenger].map(
      async (side) => {
        const [candidate, candidateVersion, admission] = await Promise.all([
          this.readOptionalRecord<TradingSystemCandidateRecord>("candidates", side.candidate_ref.id),
          this.getCandidateVersion(side.candidate_version_ref.id),
          this.getCandidateAdmissionDecision(side.candidate_admission_decision_ref.id)
        ]);
        const systemCode = candidateVersion?.system_code_ref
          ? await this.getSystemCode(candidateVersion.system_code_ref.id)
          : undefined;
        return { side, candidate, candidateVersion, admission, systemCode };
      }
    ));
    if (loadedSides.some(({ candidate, candidateVersion, admission, systemCode }) =>
      !candidate || !candidateVersion || !admission || !systemCode
    )) {
      throw new LocalStoreError(
        "paper_trading_comparison_preparation_reference_not_found",
        "paper comparison preparation references missing candidate, version, admission, or SystemCode"
      );
    }
    for (const loaded of loadedSides) {
      const { side, candidate, candidateVersion, admission, systemCode } = loaded as {
        side: PaperTradingComparisonCandidateSide;
        candidate: TradingSystemCandidateRecord;
        candidateVersion: CandidateVersionRecord;
        admission: CandidateAdmissionDecisionRecord;
        systemCode: SystemCodeRecord;
      };
      const exactContentMatches =
        paperTradingComparisonRefsEqual(side.candidate_version_ref, {
          record_kind: candidateVersion.record_kind,
          id: candidateVersion.candidate_version_id
        }) &&
        side.candidate_version_digest === comparisonExactRecordDigest(
          paperTradingComparisonCandidateVersionDigestInput(candidateVersion)
        ) &&
        paperTradingComparisonRefsEqual(side.system_code_ref, {
          record_kind: systemCode.record_kind,
          id: systemCode.system_code_id
        }) &&
        side.system_code_record_digest === comparisonExactRecordDigest(
          paperTradingComparisonSystemCodeRecordDigestInput(systemCode)
        ) &&
        side.system_code_artifact_digest === systemCode.artifact_digest &&
        paperTradingComparisonRefsEqual(side.candidate_admission_decision_ref, {
          record_kind: admission.record_kind,
          id: admission.candidate_admission_decision_id
        }) &&
        side.admission_decision_digest === comparisonExactRecordDigest(
          paperTradingComparisonAdmissionDecisionDigestInput(admission)
        );
      if (!exactContentMatches) {
        throw new LocalStoreError(
          "paper_trading_comparison_frozen_record_digest_mismatch",
          "paper comparison frozen CandidateVersion, SystemCode, or admission content changed"
        );
      }
      const admitted =
        candidate.candidate_id === side.candidate_ref.id &&
        candidateVersion.candidate_id === side.candidate_ref.id &&
        candidateVersion.candidate_version_id === side.candidate_version_ref.id &&
        paperTradingComparisonRefsEqual(candidateVersion.system_code_ref, {
          record_kind: systemCode.record_kind,
          id: systemCode.system_code_id
        }) &&
        admission.status === "admitted" &&
        admission.runnable_paper_handoff === true &&
        admission.authority_status === "not_live" &&
        isCandidateAdmissionDecisionConsistent(admission) &&
        isIsoTimestamp(systemCode.created_at) &&
        isIsoTimestamp(admission.decided_at) &&
        Date.parse(systemCode.created_at) <= Date.parse(admission.decided_at) &&
        Date.parse(admission.decided_at) <= Date.parse(preparation.committed_at) &&
        paperTradingComparisonRefsEqual(admission.system_code_ref, {
          record_kind: systemCode.record_kind,
          id: systemCode.system_code_id
        }) &&
        admission.submitted_artifact_digest === systemCode.artifact_digest;
      if (!admitted) {
        throw new LocalStoreError(
          "paper_trading_comparison_candidate_not_admitted",
          "paper comparison candidates must bind exact admitted frozen SystemCode evidence"
        );
      }
    }
    const [champion, challenger] = loadedSides as unknown as [
      { systemCode: SystemCodeRecord },
      { systemCode: SystemCodeRecord }
    ];
    if (champion.systemCode.artifact_digest === challenger.systemCode.artifact_digest) {
      throw new LocalStoreError(
        "paper_trading_comparison_duplicate_executable",
        "paper comparison candidates freeze the same stored SystemCode bytes"
      );
    }
    const latestPromotion = requireCurrentSelection
      ? await this.getLatestTradingPromotion()
      : undefined;
    if (preparation.comparison_policy.comparison_mode === "bootstrap") {
      if (preparation.champion_selection.selection_kind !== "bootstrap" ||
        (requireCurrentSelection && latestPromotion)) {
        throw new LocalStoreError(
          "paper_trading_comparison_champion_selection_mismatch",
          "bootstrap comparison requires no current TradingPromotion"
        );
      }
      return;
    }
    if (preparation.champion_selection.selection_kind !== "trading_review") {
      throw new LocalStoreError(
        "paper_trading_comparison_champion_selection_mismatch",
        "champion challenge requires a bound TradingPromotion"
      );
    }
    const selection = preparation.champion_selection;
    const boundPromotion = await this.getTradingPromotion(selection.trading_promotion_ref.id);
    if (!boundPromotion) {
      throw new LocalStoreError(
        "paper_trading_comparison_champion_selection_mismatch",
        "bound TradingPromotion selection was not found"
      );
    }
    const promotionCampaign = await this
      .getPaperTradingComparisonConfirmationCampaign(
        boundPromotion.comparison_confirmation.campaign_ref.id
      );
    if (!promotionCampaign ||
      promotionCampaign.paper_trading_comparison_confirmation_campaign_id !==
        boundPromotion.comparison_confirmation.campaign_ref.id ||
      promotionCampaign.campaign_digest !==
        boundPromotion.comparison_confirmation.campaign_digest ||
      !paperTradingComparisonRefsEqual(
        promotionCampaign.challenger.candidate_ref,
        boundPromotion.candidate_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        promotionCampaign.challenger.candidate_version_ref,
        boundPromotion.candidate_version_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        promotionCampaign.challenger.candidate_ref,
        preparation.champion.candidate_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        promotionCampaign.challenger.candidate_version_ref,
        preparation.champion.candidate_version_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        promotionCampaign.challenger.system_code_ref,
        preparation.champion.system_code_ref
      ) ||
      promotionCampaign.challenger.system_code_artifact_digest !==
        preparation.champion.system_code_artifact_digest ||
      promotionCampaign.evaluation_authority !==
        "external_to_trading_systems" ||
      promotionCampaign.authority_status !== "not_live") {
      throw new LocalStoreError(
        "paper_trading_comparison_champion_selection_mismatch",
        "bound TradingPromotion confirmation campaign is missing or inconsistent"
      );
    }
    const [allEvaluations, allCommitments, allObservations] = await Promise.all([
      this.scanPaperTradingComparisonEvaluations(persistedEvidenceErrorCode),
      this.scanPaperTradingComparisonCommitments(persistedEvidenceErrorCode),
      this.scanPaperTradingComparisonObservations(persistedEvidenceErrorCode)
    ]);
    const promotionEvaluation = allEvaluations.find((record) =>
      record.paper_trading_evaluation_id === selection.paper_trading_evaluation_ref.id
    );
    const promotionCommitment = allCommitments.find((record) =>
      record.paper_trading_evaluation_commitment_id ===
        selection.paper_trading_evaluation_commitment_ref.id
    );
    if (!promotionEvaluation || !promotionCommitment) {
      throw new LocalStoreError(
        "paper_trading_comparison_preparation_reference_not_found",
        "bound TradingPromotion qualification evaluation or commitment was not found"
      );
    }
    const promotionObservations = allObservations.filter((record) =>
      paperTradingComparisonRefsEqual(
        record.paper_trading_evaluation_ref,
        selection.paper_trading_evaluation_ref
      )
    );
    const frozenPromotionContentMatches =
      selection.trading_promotion_digest === comparisonExactRecordDigest(
        paperTradingComparisonTradingPromotionDigestInput(boundPromotion)
      ) &&
      selection.paper_trading_evaluation_record_digest === comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(promotionEvaluation)
      ) &&
      selection.paper_trading_evaluation_commitment_record_digest === comparisonExactRecordDigest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(promotionCommitment)
      ) &&
      selection.paper_trading_observation_chain_digest === comparisonExactRecordDigest(
        paperTradingComparisonObservationChainDigestInput(promotionObservations)
      );
    if (!frozenPromotionContentMatches) {
      throw new LocalStoreError(
        "paper_trading_comparison_frozen_record_digest_mismatch",
        "paper comparison frozen TradingPromotion qualification closure changed"
      );
    }
    const championAdmission = loadedSides[0]!.admission!;
    const championSystemCode = loadedSides[0]!.systemCode!;
    if (!paperTradingComparisonStoppedQualificationClosureHasRuntimeShape({
      systemCode: championSystemCode,
      admission: championAdmission,
      commitment: promotionCommitment,
      evaluation: promotionEvaluation,
      observations: promotionObservations,
      promotion: boundPromotion,
      preparationCommittedAt: preparation.committed_at
    })) {
      throw new LocalStoreError(
        "paper_trading_comparison_champion_selection_mismatch",
        "bound TradingPromotion qualification evidence has invalid persisted shape"
      );
    }
    const promotionCommitmentSelfDigest = `sha256:${createHash("sha256")
      .update(paperTradingEvaluationCommitmentDigestInput(promotionCommitment))
      .digest("hex")}`;
    const promotionCommitmentDigestVerified =
      promotionCommitment.commitment_digest === promotionCommitmentSelfDigest;
    const qualification = decidePaperTradingQualification({
      evaluation: promotionEvaluation,
      commitment: promotionCommitment,
      observations: promotionObservations,
      runnerActive: false,
      commitmentDigestVerified: promotionCommitmentDigestVerified,
      policy: {
        minObservationCount:
          promotionCampaign.comparison_policy.minimum_observation_count,
        minElapsedMs: promotionCampaign.comparison_policy.minimum_elapsed_ms
      }
    });
    if (!promotionCommitmentDigestVerified ||
      qualification.qualification_status !== "qualified") {
      throw new LocalStoreError(
        "paper_trading_comparison_champion_selection_mismatch",
        "bound TradingPromotion evidence does not satisfy canonical qualification"
      );
    }
    const orderedPromotionObservations = [...promotionObservations].sort((left, right) =>
      left.sequence - right.sequence ||
      left.paper_trading_observation_id.localeCompare(right.paper_trading_observation_id)
    );
    const promotionMatches =
      paperTradingComparisonRefsEqual(
        boundPromotion.paper_trading_evaluation_ref,
        selection.paper_trading_evaluation_ref
      ) &&
      paperTradingComparisonRefsEqual(
        promotionEvaluation.paper_trading_evaluation_commitment_ref,
        selection.paper_trading_evaluation_commitment_ref
      ) &&
      promotionEvaluation.observation_count === orderedPromotionObservations.length &&
      paperTradingComparisonRefsEqual(boundPromotion.candidate_ref, preparation.champion.candidate_ref) &&
      paperTradingComparisonRefsEqual(
        boundPromotion.candidate_version_ref,
        preparation.champion.candidate_version_ref
      ) &&
      (!requireCurrentSelection || latestPromotion?.trading_promotion_id ===
        boundPromotion.trading_promotion_id);
    if (!promotionMatches) {
      throw new LocalStoreError(
        "paper_trading_comparison_champion_selection_mismatch",
        "bound TradingPromotion does not authorize the selected champion"
      );
    }
  }

  private async validatePaperTradingComparisonCommitmentGraph(
    comparison: PaperTradingComparisonCommitmentRecord
  ): Promise<void> {
    const preparation = await this.getPaperTradingComparisonPreparation(
      comparison.preparation_ref.id
    );
    if (!preparation) {
      throw new LocalStoreError(
        "paper_trading_comparison_preparation_reference_not_found",
        "paper comparison commitment preparation was not found"
      );
    }
    this.assertPersistedComparisonPreparationShape(preparation);
    try {
      await this.validatePaperTradingComparisonPreparation(
        preparation,
        false,
        "paper_trading_comparison_commitment_reference_mismatch"
      );
    } catch (error) {
      if (error instanceof LocalStoreError &&
        error.code === "paper_trading_comparison_candidate_not_admitted") {
        throw new LocalStoreError(
          "paper_trading_comparison_commitment_reference_mismatch",
          "paper comparison candidate identity no longer matches its frozen side"
        );
      }
      throw error;
    }
    const candidateSideMatches = (
      runtimeSide: PaperTradingComparisonSide,
      candidateSide: PaperTradingComparisonCandidateSide
    ) => runtimeSide.role === candidateSide.role &&
      paperTradingComparisonRefsEqual(runtimeSide.candidate_ref, candidateSide.candidate_ref) &&
      paperTradingComparisonRefsEqual(
        runtimeSide.candidate_version_ref,
        candidateSide.candidate_version_ref
      ) &&
      runtimeSide.candidate_version_digest === candidateSide.candidate_version_digest &&
      paperTradingComparisonRefsEqual(runtimeSide.system_code_ref, candidateSide.system_code_ref) &&
      runtimeSide.system_code_record_digest === candidateSide.system_code_record_digest &&
      runtimeSide.system_code_artifact_digest === candidateSide.system_code_artifact_digest &&
      paperTradingComparisonRefsEqual(
        runtimeSide.candidate_admission_decision_ref,
        candidateSide.candidate_admission_decision_ref
      ) &&
      runtimeSide.admission_decision_digest === candidateSide.admission_decision_digest;
    const preparationMatches =
      comparison.preparation_ref.record_kind === "paper_trading_comparison_preparation" &&
      comparison.paper_trading_comparison_commitment_id ===
        preparation.paper_trading_comparison_commitment_id &&
      candidateSideMatches(comparison.champion, preparation.champion) &&
      candidateSideMatches(comparison.challenger, preparation.challenger) &&
      sameJson(comparison.champion_selection, preparation.champion_selection) &&
      sameJson(comparison.comparison_policy, preparation.comparison_policy) &&
      comparison.market_data_configuration_digest ===
        preparation.market_data_configuration_digest &&
      sameJson(comparison.paper_policy_identity, preparation.paper_policy_identity) &&
      comparison.committed_at === preparation.committed_at;
    if (!preparationMatches) {
      throw new LocalStoreError(
        "paper_trading_comparison_preparation_mismatch",
        "paper comparison commitment does not match its frozen preparation"
      );
    }
    const champion = await this.loadPaperTradingComparisonSide(comparison.champion);
    const challenger = await this.loadPaperTradingComparisonSide(comparison.challenger);
    if (!champion || !challenger) {
      throw new LocalStoreError(
        "paper_trading_comparison_commitment_reference_not_found",
        "paper trading comparison commitment references an incomplete side graph"
      );
    }
    const sideMatches = (
      role: "champion" | "challenger",
      side: LoadedPaperTradingComparisonSideGraph
    ): boolean => side.input.role === role &&
      paperTradingComparisonSideRecordsHaveInertShape(side) &&
      side.run.runtime_lifecycle_status === "registered" &&
      side.run.stage_binding_ref === undefined &&
      side.run.runtime_operating_policy_ref === undefined &&
      side.run.trace_ref === undefined &&
      side.run.order_request_refs === undefined &&
      side.run.gateway_result_refs === undefined &&
      side.run.execution_result_refs === undefined &&
      side.run.run_control_command_refs === undefined &&
      side.run.run_control_decision_refs === undefined &&
      side.run.runtime_audit_event_refs === undefined &&
      side.run.sandbox_ref === undefined &&
      isIsoTimestamp(side.commitment.committed_at) &&
      Date.parse(side.commitment.committed_at) >= Date.parse(preparation.committed_at) &&
      isIsoTimestamp(side.run.created_at) &&
      side.run.created_at === preparation.committed_at &&
      side.commitment.commitment_digest === `sha256:${createHash("sha256")
        .update(paperTradingEvaluationCommitmentDigestInput(side.commitment))
        .digest("hex")}` &&
      side.input.paper_trading_evaluation_commitment_record_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(side.commitment)
        ) &&
      side.input.paper_trading_evaluation_record_digest === comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(side.evaluation)
      ) &&
      side.evaluation.started_at === side.commitment.committed_at &&
      paperTradingComparisonRefsEqual(side.input.candidate_ref, {
        record_kind: "trading_system_candidate",
        id: side.candidate.candidate_id
      }) &&
      side.candidateVersion.candidate_id === side.input.candidate_ref.id &&
      side.candidateVersion.candidate_version_id === side.input.candidate_version_ref.id &&
      paperTradingComparisonRefsEqual(
        side.candidateVersion.system_code_ref,
        side.input.system_code_ref
      ) &&
      side.input.candidate_version_digest === comparisonExactRecordDigest(
        paperTradingComparisonCandidateVersionDigestInput(side.candidateVersion)
      ) &&
      paperTradingComparisonRefsEqual(side.input.system_code_ref, {
        record_kind: side.systemCode.record_kind,
        id: side.systemCode.system_code_id
      }) &&
      side.input.system_code_record_digest === comparisonExactRecordDigest(
        paperTradingComparisonSystemCodeRecordDigestInput(side.systemCode)
      ) &&
      side.input.system_code_artifact_digest === side.systemCode.artifact_digest &&
      paperTradingComparisonRefsEqual(side.input.candidate_ref, side.commitment.candidate_ref) &&
      paperTradingComparisonRefsEqual(
        side.input.candidate_version_ref,
        side.commitment.candidate_version_ref
      ) &&
      paperTradingComparisonRefsEqual(side.input.system_code_ref, side.commitment.system_code_ref) &&
      side.input.system_code_artifact_digest === side.commitment.system_code_artifact_digest &&
      paperTradingComparisonRefsEqual(side.input.candidate_admission_decision_ref, {
        record_kind: side.admission.record_kind,
        id: side.admission.candidate_admission_decision_id
      }) &&
      side.input.admission_decision_digest === comparisonExactRecordDigest(
        paperTradingComparisonAdmissionDecisionDigestInput(side.admission)
      ) &&
      side.admission.status === "admitted" &&
      side.admission.runnable_paper_handoff === true &&
      side.admission.authority_status === "not_live" &&
      isCandidateAdmissionDecisionConsistent(side.admission) &&
      isIsoTimestamp(side.admission.decided_at) &&
      Date.parse(side.admission.decided_at) <= Date.parse(preparation.committed_at) &&
      paperTradingComparisonRefsEqual(side.admission.system_code_ref, {
        record_kind: side.systemCode.record_kind,
        id: side.systemCode.system_code_id
      }) &&
      side.admission.submitted_artifact_digest === side.systemCode.artifact_digest &&
      paperTradingComparisonRefsEqual(side.input.trading_run_ref, side.commitment.trading_run_ref) &&
      paperTradingComparisonRefsEqual(
        side.input.paper_trading_evaluation_commitment_ref,
        {
          record_kind: side.commitment.record_kind,
          id: side.commitment.paper_trading_evaluation_commitment_id
        }
      ) &&
      side.input.paper_trading_evaluation_commitment_digest ===
        side.commitment.commitment_digest &&
      paperTradingComparisonRefsEqual(side.input.paper_trading_evaluation_ref, {
        record_kind: side.evaluation.record_kind,
        id: side.evaluation.paper_trading_evaluation_id
      }) &&
      paperTradingComparisonRefsEqual(side.run.candidate_ref, side.commitment.candidate_ref) &&
      paperTradingComparisonRefsEqual(
        side.run.candidate_version_ref,
        side.commitment.candidate_version_ref
      ) &&
      paperTradingComparisonRefsEqual(side.run.system_code_ref, side.commitment.system_code_ref) &&
      paperTradingComparisonRefsEqual(
        side.evaluation.paper_trading_evaluation_commitment_ref,
        side.input.paper_trading_evaluation_commitment_ref
      ) &&
      paperTradingComparisonRefsEqual(side.evaluation.candidate_ref, side.commitment.candidate_ref) &&
      paperTradingComparisonRefsEqual(
        side.evaluation.candidate_version_ref,
        side.commitment.candidate_version_ref
      ) &&
      paperTradingComparisonRefsEqual(
        side.evaluation.trading_run_ref,
        side.commitment.trading_run_ref
      ) &&
      sameJson(side.commitment.runtime_identity, {
        artifact_kind: side.systemCode.artifact_kind,
        runtime_kind: side.systemCode.runtime_kind,
        entrypoint: side.systemCode.entrypoint,
        ...(side.systemCode.artifact_runtime_contract_ref
          ? { artifact_runtime_contract_ref: side.systemCode.artifact_runtime_contract_ref }
          : {})
      }) &&
      paperTradingComparisonRefsEqual(
        side.commitment.capability_policy_ref,
        side.systemCode.capability_policy_ref
      ) &&
      paperTradingComparisonRefsEqual(
        side.commitment.secret_policy_ref,
        side.systemCode.secret_policy_ref
      ) &&
      paperTradingEvaluationReferencesMatch(side.evaluation, side.commitment);
    const pairMatches = sideMatches("champion", champion) &&
      sideMatches("challenger", challenger) &&
      champion.input.candidate_version_ref.id !== challenger.input.candidate_version_ref.id &&
      champion.input.trading_run_ref.id !== challenger.input.trading_run_ref.id &&
      champion.input.paper_trading_evaluation_commitment_ref.id !==
        challenger.input.paper_trading_evaluation_commitment_ref.id &&
      champion.input.paper_trading_evaluation_ref.id !==
        challenger.input.paper_trading_evaluation_ref.id &&
      champion.commitment.resolved_artifact_digest !==
        challenger.commitment.resolved_artifact_digest &&
      comparison.comparison_policy.symbol === champion.commitment.data_identity.symbol &&
      sameJson(champion.commitment.data_identity, challenger.commitment.data_identity) &&
      comparison.market_data_configuration_digest ===
        champion.commitment.data_identity.market_data_configuration_digest &&
      sameJson(comparison.paper_policy_identity, champion.commitment.policy_identity) &&
      sameJson(champion.commitment.policy_identity, challenger.commitment.policy_identity) &&
      comparison.comparison_policy.interval_ms === champion.commitment.window_policy.interval_ms &&
      comparison.comparison_policy.interval_ms === challenger.commitment.window_policy.interval_ms &&
      sameJson(champion.commitment.window_policy, challenger.commitment.window_policy) &&
      sameJson(
        champion.commitment.initial_account_snapshot,
        challenger.commitment.initial_account_snapshot
      );
    if (!pairMatches) {
      throw new LocalStoreError(
        "paper_trading_comparison_commitment_reference_mismatch",
        "paper trading comparison commitment does not match its complete inert side graph"
      );
    }
  }

  private async loadPaperTradingComparisonSide(
    input: PaperTradingComparisonSide
  ): Promise<LoadedPaperTradingComparisonSideGraph | undefined> {
    const [
      candidate,
      candidateVersion,
      admission,
      run,
      systemCode,
      allCommitments,
      allEvaluations,
      allObservations
    ] = await Promise.all([
      this.getCandidateForTradingRun(input.trading_run_ref.id),
      this.getCandidateVersion(input.candidate_version_ref.id),
      this.getCandidateAdmissionDecision(input.candidate_admission_decision_ref.id),
      this.getTradingRun(input.trading_run_ref.id),
      this.getSystemCode(input.system_code_ref.id),
      this.scanPaperTradingComparisonCommitments(
        "paper_trading_comparison_commitment_reference_mismatch"
      ),
      this.scanPaperTradingComparisonEvaluations(
        "paper_trading_comparison_commitment_reference_mismatch"
      ),
      this.scanPaperTradingComparisonObservations(
        "paper_trading_comparison_commitment_reference_mismatch"
      )
    ]);
    const commitment = allCommitments.find((record) =>
      record.paper_trading_evaluation_commitment_id ===
        input.paper_trading_evaluation_commitment_ref.id
    );
    const evaluation = allEvaluations.find((record) =>
      record.paper_trading_evaluation_id === input.paper_trading_evaluation_ref.id
    );
    if (!candidate || !candidateVersion || !admission || !run || !systemCode ||
      !commitment || !evaluation) {
      return undefined;
    }
    const runRef = { record_kind: "trading_run", id: input.trading_run_ref.id };
    const commitmentsForRun = allCommitments.filter((record) =>
      paperTradingComparisonRefsEqual(record.trading_run_ref, runRef)
    );
    const evaluationsForRun = allEvaluations.filter((record) =>
      paperTradingComparisonRefsEqual(record.trading_run_ref, runRef)
    );
    if (commitmentsForRun.length !== 1 ||
      commitmentsForRun[0]?.paper_trading_evaluation_commitment_id !==
        input.paper_trading_evaluation_commitment_ref.id ||
      evaluationsForRun.length !== 1 ||
      evaluationsForRun[0]?.paper_trading_evaluation_id !==
        input.paper_trading_evaluation_ref.id ||
      !paperTradingComparisonRefsEqual(
        evaluation.paper_trading_evaluation_commitment_ref,
        input.paper_trading_evaluation_commitment_ref
      ) ||
      candidateVersion.candidate_id !== input.candidate_ref.id) {
      throw new LocalStoreError(
        "paper_trading_comparison_commitment_reference_mismatch",
        "paper comparison side run does not own one deterministic commitment/evaluation chain"
      );
    }
    const loaded: LoadedPaperTradingComparisonSideGraph = {
      input,
      candidate,
      candidateVersion,
      admission,
      run,
      systemCode,
      commitment,
      evaluation,
      observations: allObservations.filter((record) =>
        paperTradingComparisonRefsEqual(
          record.paper_trading_evaluation_ref,
          input.paper_trading_evaluation_ref
        )
      )
    };
    if (!paperTradingComparisonSideRecordsHaveInertShape(loaded)) {
      throw new LocalStoreError(
        "paper_trading_comparison_commitment_reference_mismatch",
        "paper comparison side records have invalid or non-inert runtime shape"
      );
    }
    return loaded;
  }

  private async validatePaperTradingEvaluationWrite(
    evaluation: PaperTradingEvaluationRecord,
    existing?: PaperTradingEvaluationRecord
  ): Promise<void> {
    if (!evaluation.paper_trading_evaluation_commitment_ref) {
      if (
        evaluation.status === "invalidated" &&
        evaluation.invalidation_reason === "commitment_missing"
      ) {
        return;
      }
      throw new LocalStoreError(
        "paper_trading_evaluation_commitment_required",
        "paper trading evaluation requires a commitment reference",
        { paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id }
      );
    }
    const commitment = await this.getPaperTradingEvaluationCommitment(
      evaluation.paper_trading_evaluation_commitment_ref.id
    );
    if (!commitment) {
      throw new LocalStoreError(
        "paper_trading_evaluation_commitment_reference_not_found",
        "paper trading evaluation commitment was not found",
        {
          paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id,
          paper_trading_evaluation_commitment_id:
            evaluation.paper_trading_evaluation_commitment_ref.id
        }
      );
    }
    if (!paperTradingEvaluationReferencesMatch(evaluation, commitment)) {
      throw new LocalStoreError(
        "paper_trading_evaluation_commitment_mismatch",
        "paper trading evaluation does not match its commitment",
        { paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id }
      );
    }
    const candidateVersion = await this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      commitment.candidate_version_ref.id
    );
    const candidate = await this.readOptionalRecord<TradingSystemCandidateRecord>(
      "candidates",
      commitment.candidate_ref.id
    );
    const tradingRun = await this.getTradingRun(evaluation.trading_run_ref.id);
    if (
      !candidateVersion ||
      !candidate ||
      !tradingRun ||
      !tradingRunOwnsCandidateVersion(tradingRun, candidate, candidateVersion) ||
      !paperTradingRunPurposeMatches(tradingRun, candidateVersion, commitment.evidence_purpose)
    ) {
      throw new LocalStoreError(
        "paper_trading_evaluation_identity_mismatch",
        "paper trading evaluation TradingRun does not match its candidate version",
        { paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id }
      );
    }
    if (
      evaluation.observation_count === 0 &&
      !sameJson(evaluation.paper_account_snapshot, commitment.initial_account_snapshot)
    ) {
      throw new LocalStoreError(
        "paper_trading_observation_account_lineage_mismatch",
        "paper trading evaluation initial account does not match its commitment",
        { paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id }
      );
    }
    if (evaluation.status === "invalidated" && !evaluation.invalidation_reason) {
      throw new LocalStoreError(
        "paper_trading_evaluation_identity_mismatch",
        "invalidated paper trading evaluation requires a stable reason",
        { paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id }
      );
    }
    if (evaluation.status !== "invalidated" && evaluation.invalidation_reason) {
      throw new LocalStoreError(
        "paper_trading_evaluation_identity_mismatch",
        "non-invalidated paper trading evaluation cannot retain an invalidation reason",
        { paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id }
      );
    }
    if (!existing) {
      return;
    }
    if (existing.status === "invalidated") {
      throw new LocalStoreError(
        "paper_trading_evaluation_invalidation_terminal",
        "paper trading evaluation invalidation is terminal",
        { paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id }
      );
    }
    if (
      existing.paper_trading_evaluation_commitment_ref?.id !==
        evaluation.paper_trading_evaluation_commitment_ref.id ||
      existing.candidate_ref.id !== evaluation.candidate_ref.id ||
      existing.candidate_version_ref.id !== evaluation.candidate_version_ref.id ||
      existing.trading_run_ref.id !== evaluation.trading_run_ref.id ||
      existing.interval_ms !== evaluation.interval_ms ||
      existing.started_at !== evaluation.started_at ||
      evaluation.observation_count < existing.observation_count
    ) {
      throw new LocalStoreError(
        "paper_trading_evaluation_identity_mismatch",
        "paper trading evaluation immutable identity changed",
        { paper_trading_evaluation_id: evaluation.paper_trading_evaluation_id }
      );
    }
  }

  private async validatePaperTradingAccountLineage(input: {
    commitment: PaperTradingEvaluationCommitmentRecord;
    existingEvaluation: PaperTradingEvaluationRecord;
    observation: PaperTradingObservationRecord;
    evaluation: PaperTradingEvaluationRecord;
  }): Promise<void> {
    if (
      input.existingEvaluation.observation_count === 0 &&
      !sameJson(
        input.existingEvaluation.paper_account_snapshot,
        input.commitment.initial_account_snapshot
      )
    ) {
      throw new LocalStoreError(
        "paper_trading_observation_account_lineage_mismatch",
        "paper trading account does not descend from the committed initial account"
      );
    }
    const latestObservation = (
      await this.listPaperTradingObservations(input.evaluation.paper_trading_evaluation_id)
    ).at(-1);
    if (
      latestObservation?.paper_account_snapshot &&
      !sameJson(
        latestObservation.paper_account_snapshot,
        input.existingEvaluation.paper_account_snapshot
      )
    ) {
      throw new LocalStoreError(
        "paper_trading_observation_account_lineage_mismatch",
        "stored paper trading account lineage is inconsistent"
      );
    }
    if (
      input.observation.paper_account_snapshot &&
      !sameJson(input.observation.paper_account_snapshot, input.evaluation.paper_account_snapshot)
    ) {
      throw new LocalStoreError(
        "paper_trading_observation_account_lineage_mismatch",
        "paper trading observation and evaluation account snapshots differ"
      );
    }
    if (!sameJson(input.observation.cumulative_score, input.evaluation.latest_score)) {
      throw new LocalStoreError(
        "paper_trading_observation_evaluation_mismatch",
        "paper trading observation score does not match its evaluation"
      );
    }
  }

  async recordRunControlAudit(
    input: RunControlAuditInput,
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<RunControlAuditOutcome> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.recordRunControlAuditUnlocked(input, authority)
    );
  }

  private async recordRunControlAuditUnlocked(
    input: RunControlAuditInput,
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<RunControlAuditOutcome> {
    const validationFailure = validateRunControlAuditInput(input);
    if (validationFailure) {
      throw new LocalStoreError(validationFailure, "invalid runtime control input");
    }

    const candidate = await this.readOptionalRecord<TradingSystemCandidateRecord>(
      "candidates",
      input.candidate_id
    );
    if (!candidate) {
      throw new LocalStoreError(
        "candidate_not_found",
        `candidate ${input.candidate_id} not found`,
        { candidate_id: input.candidate_id }
      );
    }

    const candidateVersionId = input.candidate_version_id ?? candidate.active_version_id;
    const candidateVersion = await this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidateVersionId
    );
    if (!candidateVersion) {
      throw new LocalStoreError(
        "candidate_version_not_found",
        `candidate version ${candidateVersionId} not found`,
        { candidate_id: candidate.candidate_id, candidate_version_id: candidateVersionId }
      );
    }
    if (candidateVersion.candidate_id !== candidate.candidate_id) {
      throw new LocalStoreError(
        "candidate_version_mismatch",
        `candidate version ${candidateVersionId} does not belong to candidate ${candidate.candidate_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersionId,
          actual_candidate_id: candidateVersion.candidate_id
        }
      );
    }

    const runtimeId = input.runtime_id ?? candidateVersion.runtime_ref.id;
    const runtime = await this.readOptionalRecord<TradingRunRecord>(
      "trading-runs",
      runtimeId
    );
    if (!runtime) {
      throw new LocalStoreError(
        "runtime_not_found",
        `runtime ${runtimeId} not found`,
        { runtime_id: runtimeId }
      );
    }
    if (!tradingRunOwnsCandidateVersion(runtime, candidate, candidateVersion)) {
      throw new LocalStoreError(
        "runtime_mismatch",
        `runtime ${runtime.trading_run_id} is not bound to candidate version ${candidateVersion.candidate_version_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersion.candidate_version_id,
          candidate_version_runtime_id: candidateVersion.runtime_ref.id,
          runtime_id: runtime.trading_run_id
        }
      );
    }

    const recordIds = runtimeControlAuditRecordIds({
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidateVersion.candidate_version_id,
      runtime_id: runtime.trading_run_id,
      idempotency_key: input.idempotency_key
    });
    const existing = await this.readRunControlAuditOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_run_id,
      recordIds
    );
    if (existing) {
      if (authority && !this.paperTradingComparisonRunControlReplayMatches(
        input,
        existing
      )) {
        throw new LocalStoreError(
          "paper_trading_comparison_runtime_write_transition_mismatch",
          "paper comparison runtime control audit replay drifted from persisted evidence"
        );
      }
      return existing;
    }
    await this.assertNoPairBoundSideMutation(
      { runId: runtime.trading_run_id },
      authority,
      authority !== undefined ? { writer: "run_control", input } : undefined
    );

    const createdAt = input.created_at ?? new Date().toISOString();
    const runtimeRef = ref("trading_run", runtime.trading_run_id);
    const candidateRef = ref("trading_system_candidate", candidate.candidate_id);
    const candidateVersionRef = ref("candidate_version", candidateVersion.candidate_version_id);
    const commandRef = ref("run_control_command", recordIds.command);
    const decisionRef = ref("run_control_decision", recordIds.decision);
    const auditEventRef = ref("runtime_audit_event", recordIds.auditEvent);
    const authorityStatus = runtimeControlAuthorityStatusForOutcome(
      input.decision.decision_outcome
    );
    const command: RunControlCommandRecord = stripUndefined({
      record_kind: "run_control_command",
      version: 1,
      run_control_command_id: recordIds.command,
      runtime_ref: runtimeRef,
      action: input.command.action,
      requested_lifecycle_status: input.command.requested_lifecycle_status,
      actor_kind: input.command.actor_kind,
      actor_ref: input.command.actor_ref,
      runtime_operating_policy_ref: input.command.runtime_operating_policy_ref,
      idempotency_key: input.idempotency_key,
      reason: input.command.reason,
      reason_summary: input.command.reason_summary,
      trace_ref: input.command.trace_ref ?? runtime.trace_ref,
      related_order_request_refs: input.command.related_order_request_refs,
      related_gateway_result_refs: input.command.related_gateway_result_refs,
      related_execution_result_refs: input.command.related_execution_result_refs,
      requested_at: createdAt,
      status: "decided",
      authority_status: authorityStatus
    } satisfies RunControlCommandRecord);
    const decision: RunControlDecisionRecord = stripUndefined({
      record_kind: "run_control_decision",
      version: 1,
      run_control_decision_id: recordIds.decision,
      runtime_ref: runtimeRef,
      command_ref: commandRef,
      decision_outcome: input.decision.decision_outcome,
      decision_reason: input.decision.decision_reason,
      decided_by_actor_kind: input.decision.decided_by_actor_kind,
      decided_by_actor_ref: input.decision.decided_by_actor_ref,
      runtime_operating_policy_ref: input.decision.runtime_operating_policy_ref
        ?? input.command.runtime_operating_policy_ref,
      resulting_lifecycle_status: input.decision.resulting_lifecycle_status,
      trace_ref: input.decision.trace_ref ?? input.command.trace_ref ?? runtime.trace_ref,
      related_order_request_refs: input.decision.related_order_request_refs
        ?? input.command.related_order_request_refs,
      related_gateway_result_refs: input.decision.related_gateway_result_refs
        ?? input.command.related_gateway_result_refs,
      related_execution_result_refs: input.decision.related_execution_result_refs
        ?? input.command.related_execution_result_refs,
      decided_at: createdAt,
      authority_status: authorityStatus
    } satisfies RunControlDecisionRecord);
    const auditEvent: RuntimeAuditEventRecord = stripUndefined({
      record_kind: "runtime_audit_event",
      version: 1,
      runtime_audit_event_id: recordIds.auditEvent,
      runtime_ref: runtimeRef,
      event_kind: input.audit_event.event_kind,
      command_ref: commandRef,
      decision_ref: decisionRef,
      actor_kind: input.audit_event.actor_kind ?? input.command.actor_kind,
      actor_ref: input.audit_event.actor_ref ?? input.command.actor_ref,
      runtime_lifecycle_status: input.audit_event.runtime_lifecycle_status
        ?? input.decision.resulting_lifecycle_status,
      message: input.audit_event.message,
      trace_ref: input.audit_event.trace_ref
        ?? input.decision.trace_ref
        ?? input.command.trace_ref
        ?? runtime.trace_ref,
      supporting_record_refs: input.audit_event.supporting_record_refs
        ?? [commandRef, decisionRef],
      related_order_request_refs: input.audit_event.related_order_request_refs
        ?? decision.related_order_request_refs,
      related_gateway_result_refs: input.audit_event.related_gateway_result_refs
        ?? decision.related_gateway_result_refs,
      related_execution_result_refs: input.audit_event.related_execution_result_refs
        ?? decision.related_execution_result_refs,
      created_at: createdAt,
      authority_status: "audit_only"
    } satisfies RuntimeAuditEventRecord);
    const updatedRuntime: TradingRunRecord = stripUndefined({
      ...runtime,
      runtime_lifecycle_status: decision.resulting_lifecycle_status
        ?? runtime.runtime_lifecycle_status
        ?? "registered",
      candidate_ref: runtime.candidate_ref ?? candidateRef,
      candidate_version_ref: runtime.candidate_version_ref ?? candidateVersionRef,
      run_control_command_refs: appendUniqueRefs(runtime.run_control_command_refs, commandRef),
      run_control_decision_refs: appendUniqueRefs(runtime.run_control_decision_refs, decisionRef),
      runtime_audit_event_refs: appendUniqueRefs(runtime.runtime_audit_event_refs, auditEventRef),
      created_at: runtime.created_at ?? createdAt
    } satisfies TradingRunRecord);

    const records: FixtureItem[] = [
      { collection: "run-control-commands", id: command.run_control_command_id, record: command },
      { collection: "run-control-decisions", id: decision.run_control_decision_id, record: decision },
      { collection: "runtime-audit-events", id: auditEvent.runtime_audit_event_id, record: auditEvent },
      { collection: "trading-runs", id: updatedRuntime.trading_run_id, record: updatedRuntime }
    ];
    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const outcome = await this.readRunControlAuditOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_run_id,
      recordIds
    );
    if (!outcome) {
      throw new LocalStoreError(
        "run_control_reload_failed",
        `runtime control records were not reloaded after write`,
        { runtime_id: runtime.trading_run_id }
      );
    }
    return outcome;
  }

  async listCandidateMaterializationAttempts(): Promise<CandidateMaterializationAttemptReadModel[]> {
    try {
      const index = await this.readJson<CandidateMaterializationAttemptIndexProjection>(
        path.join(this.storeRoot, "read-models/candidate-materialization-attempts/index.json")
      );
      return index.attempts;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async getCandidateMaterializationAttempt(
    attemptId: string
  ): Promise<CandidateMaterializationAttemptReadModel | undefined> {
    try {
      return await this.readJson<CandidateMaterializationAttemptReadModel>(
        path.join(
          this.storeRoot,
          "read-models/candidate-materialization-attempts/items",
          storeJsonFileName(attemptId)
        )
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async materializeCandidate(
    input: CandidateMaterializationInput
  ): Promise<CandidateMaterializationOutcome> {
    return this.withComparisonEvidenceWriteTransaction(
      () => this.materializeCandidateUnlocked(input)
    );
  }

  private async materializeCandidateUnlocked(
    input: CandidateMaterializationInput
  ): Promise<CandidateMaterializationOutcome> {
    const existing = await this.findMaterializationAttemptByIdempotencyKey(input.idempotency_key);
    if (existing) {
      return this.toMaterializationOutcome(existing);
    }

    const validationFailure = validateCandidateMaterializationInput(input);
    if (validationFailure) {
      return this.recordCandidateMaterializationFailure({
        idempotency_key: input.idempotency_key,
        provider_kind: input.provider.provider_kind,
        model: input.provider.model,
        agent_run_id: input.provider.agent_run_id,
        trace_id: input.provider.trace_id,
        failure_reason: validationFailure,
        artifact_refs: input.artifact_refs
      });
    }

    const suffix = stableSuffix(input.idempotency_key);
    const candidateId = `candidate-${suffix}`;
    const idsForCandidate = {
      attempt: `candidate-materialization-attempt-${suffix}`,
      candidate: candidateId,
      version: `candidate-version-${suffix}`,
      spec: `trading-system-spec-${suffix}`,
      program: `trading-system-program-${suffix}`,
      programManifest: `program-manifest-${suffix}`,
      programValidation: `program-validation-${suffix}`,
      capabilityPackage: `capability-package-${suffix}`,
      capabilityManifest: `capability-manifest-${suffix}`,
      capabilityAdmission: `capability-admission-${suffix}`,
      capabilityGrant: `capability-grant-${suffix}`,
      capabilityMount: `capability-mount-${suffix}`,
      agentSpec: `agent-spec-${suffix}`,
      agentSession: `agent-session-${suffix}`,
      providerReadiness: `provider-readiness-${suffix}`,
      providerProbe: `provider-probe-${suffix}`,
      runtime: `trading-run-${suffix}`,
      placement: `sandbox-placement-${suffix}`,
      handsEnvironment: `hands-environment-${suffix}`,
      memorySurface: `runtime-memory-surface-${suffix}`,
      stageBinding: `stage-binding-backtest-${suffix}`,
      evaluationRun: `evaluation-run-${suffix}`,
      evaluationComparisonSet: `evaluation-comparison-set-${suffix}`,
      evidenceSealingDecision: `evidence-sealing-decision-${suffix}`
    };

    const attemptRef = ref("candidate_materialization_attempt", idsForCandidate.attempt);
    const agentRunRef = ref("agent_run", input.provider.agent_run_id);
    const traceRef = ref("trace_placeholder", input.provider.trace_id);
    const providerReadinessRef = ref("provider_readiness_record", idsForCandidate.providerReadiness);
    const systemCodeRef = input.system_code_ref;

    const attempt: CandidateMaterializationAttemptRecord = {
      record_kind: "candidate_materialization_attempt",
      version: 1,
      candidate_materialization_attempt_id: idsForCandidate.attempt,
      idempotency_key: input.idempotency_key,
      provider_kind: input.provider.provider_kind,
      model: input.provider.model,
      agent_run_ref: agentRunRef,
      trace_ref: traceRef,
      status: "materialized",
      validation_status: "accepted",
      resulting_candidate_ref: ref("trading_system_candidate", candidateId),
      artifact_refs: input.artifact_refs,
      ...(input.full_cycle_lineage ? { full_cycle_lineage: input.full_cycle_lineage } : {}),
      created_at: new Date().toISOString()
    };

    const candidate: TradingSystemCandidateRecord = {
      record_kind: "trading_system_candidate",
      version: 1,
      candidate_id: candidateId,
      display_name: input.candidate.title,
      status: "materialized",
      active_version_id: idsForCandidate.version,
      provenance_refs: [agentRunRef, providerReadinessRef, attemptRef],
      title: input.candidate.title,
      system_summary: input.candidate.system_summary,
      first_market_scope: input.candidate.first_market_scope,
      candidate_status: "handoff_ready",
      evaluation_handoff_ready: true,
      materialized_from_attempt_ref: attemptRef,
      active_system_code_ref: systemCodeRef
    };
    const candidateVersion: CandidateVersionRecord = {
      record_kind: "candidate_version",
      version: 1,
      candidate_version_id: idsForCandidate.version,
      candidate_id: candidateId,
      version_label: "materialized-v1",
      spec_ref: ref("trading_system_spec", idsForCandidate.spec),
      program_ref: ref("trading_system_program", idsForCandidate.program),
      capability_package_refs: [ref("capability_package", idsForCandidate.capabilityPackage)],
      runtime_ref: ref("trading_run", idsForCandidate.runtime),
      trace_placeholder_ref: traceRef,
      evaluation_run_ref: ref("evaluation_run_record", idsForCandidate.evaluationRun),
      materialization_attempt_ref: attemptRef,
      agent_spec_ref: ref("agent_spec", idsForCandidate.agentSpec),
      agent_session_ref: ref("agent_session", idsForCandidate.agentSession),
      agent_run_ref: agentRunRef,
      agent_event_ref: ref("agent_event", input.provider.agent_event_id),
      provider_readiness_ref: providerReadinessRef,
      provider_probe_attempt_ref: ref("provider_probe_attempt", idsForCandidate.providerProbe),
      system_code_ref: systemCodeRef
    };
    const materializedEvaluationRunRef = ref("evaluation_run_record", idsForCandidate.evaluationRun);
    const materializedSealingDecisionRef = ref(
      "evidence_sealing_decision",
      idsForCandidate.evidenceSealingDecision
    );
    const materializedEvidenceClassifications = defaultEvidenceClassificationRecords({
      candidateRef: ref("trading_system_candidate", candidateId),
      candidateVersionRef: ref("candidate_version", idsForCandidate.version),
      evaluationRunRef: materializedEvaluationRunRef,
      traceRef,
      sealingDecisionRef: materializedSealingDecisionRef,
      reason: "no_external_evaluator",
      createdAt: attempt.created_at
    });

    const records: FixtureItem[] = [
      { collection: "candidate-materialization-attempts", id: idsForCandidate.attempt, record: attempt },
      { collection: "candidates", id: candidateId, record: candidate },
      { collection: "candidate-versions", id: idsForCandidate.version, record: candidateVersion },
      {
        collection: "trading-system-specs",
        id: idsForCandidate.spec,
        record: {
          record_kind: "trading_system_spec",
          version: 1,
          trading_system_spec_id: idsForCandidate.spec,
          summary: input.spec.summary,
          market: input.spec.market,
          instrument: input.spec.instrument,
          supported_stage_binding_profiles: input.spec.supported_stage_binding_profiles
        } satisfies TradingSystemSpecRecord
      },
      {
        collection: "trading-system-programs",
        id: idsForCandidate.program,
        record: {
          record_kind: "trading_system_program",
          version: 1,
          trading_system_program_id: idsForCandidate.program,
          summary: input.program.summary,
          manifest_ref: ref("program_manifest", idsForCandidate.programManifest),
          validation_record_ref: ref("program_validation_record", idsForCandidate.programValidation)
        } satisfies TradingSystemProgramRecord
      },
      {
        collection: "program-manifests",
        id: idsForCandidate.programManifest,
        record: {
          record_kind: "program_manifest",
          version: 1,
          program_manifest_id: idsForCandidate.programManifest,
          declared_runtime: input.program.declared_runtime,
          declared_outputs: input.program.declared_outputs
        } satisfies ProgramManifestRecord
      },
      {
        collection: "program-validations",
        id: idsForCandidate.programValidation,
        record: {
          record_kind: "program_validation_record",
          version: 1,
          program_validation_record_id: idsForCandidate.programValidation,
          status: "fixture_placeholder",
          authority_status: "not_executable"
        } satisfies ProgramValidationRecord
      },
      {
        collection: "capability-packages",
        id: idsForCandidate.capabilityPackage,
        record: {
          record_kind: "capability_package",
          version: 1,
          capability_package_id: idsForCandidate.capabilityPackage,
          summary: input.capability_package.summary,
          manifest_ref: ref("capability_manifest", idsForCandidate.capabilityManifest),
          admission_record_ref: ref("capability_package_admission_record", idsForCandidate.capabilityAdmission),
          grant_ref: ref("capability_grant", idsForCandidate.capabilityGrant),
          mount_record_ref: ref("capability_mount_record", idsForCandidate.capabilityMount)
        } satisfies CapabilityPackageRecord
      },
      {
        collection: "capability-manifests",
        id: idsForCandidate.capabilityManifest,
        record: {
          record_kind: "capability_manifest",
          version: 1,
          capability_manifest_id: idsForCandidate.capabilityManifest,
          allowed_stages: input.capability_package.allowed_stages,
          declared_permissions: input.capability_package.declared_permissions,
          forbidden_contents: input.capability_package.forbidden_contents
        } satisfies CapabilityManifestRecord
      },
      {
        collection: "capability-admissions",
        id: idsForCandidate.capabilityAdmission,
        record: {
          record_kind: "capability_package_admission_record",
          version: 1,
          capability_package_admission_record_id: idsForCandidate.capabilityAdmission,
          status: "fixture_placeholder",
          authority_status: "not_scanned"
        } satisfies CapabilityPackageAdmissionRecord
      },
      {
        collection: "capability-grants",
        id: idsForCandidate.capabilityGrant,
        record: {
          record_kind: "capability_grant",
          version: 1,
          capability_grant_id: idsForCandidate.capabilityGrant,
          status: "fixture_placeholder",
          authority_status: "not_granted"
        } satisfies CapabilityGrantRecord
      },
      {
        collection: "capability-mounts",
        id: idsForCandidate.capabilityMount,
        record: {
          record_kind: "capability_mount_record",
          version: 1,
          capability_mount_record_id: idsForCandidate.capabilityMount,
          status: "fixture_placeholder",
          authority_status: "not_mounted"
        } satisfies CapabilityMountRecord
      },
      {
        collection: "agent-specs",
        id: idsForCandidate.agentSpec,
        record: {
          record_kind: "agent_spec",
          version: 1,
          agent_spec_id: idsForCandidate.agentSpec,
          purpose: "candidate_generation",
          provider_kind: input.provider.provider_kind,
          model: input.provider.model
        } satisfies AgentSpecRecord
      },
      {
        collection: "agent-sessions",
        id: idsForCandidate.agentSession,
        record: {
          record_kind: "agent_session",
          version: 1,
          agent_session_id: idsForCandidate.agentSession,
          agent_spec_ref: ref("agent_spec", idsForCandidate.agentSpec),
          provider_kind: input.provider.provider_kind,
          model: input.provider.model,
          authority_status: "trace_only"
        } satisfies AgentSessionRecord
      },
      {
        collection: "agent-runs",
        id: input.provider.agent_run_id,
        record: {
          record_kind: "agent_run",
          version: 1,
          agent_run_id: input.provider.agent_run_id,
          agent_session_ref: ref("agent_session", idsForCandidate.agentSession),
          purpose: "candidate_generation",
          status: "succeeded",
          provider_kind: input.provider.provider_kind,
          model: input.provider.model,
          trace_ref: traceRef,
          authority_status: "trace_only"
        } satisfies AgentRunRecord
      },
      {
        collection: "agent-events",
        id: input.provider.agent_event_id,
        record: {
          record_kind: "agent_event",
          version: 1,
          agent_event_id: input.provider.agent_event_id,
          agent_run_ref: agentRunRef,
          status: "provider_output_captured"
        } satisfies AgentEventRecord
      },
      {
        collection: "provider-readiness-records",
        id: idsForCandidate.providerReadiness,
        record: {
          record_kind: "provider_readiness_record",
          version: 1,
          provider_readiness_record_id: idsForCandidate.providerReadiness,
          provider_kind: input.provider.provider_kind,
          model: input.provider.model,
          invocation_surface: input.provider.invocation_surface,
          readiness_status: "active_verified",
          authority_status: "readiness_only"
        } satisfies ProviderReadinessRecord
      },
      {
        collection: "provider-probe-attempts",
        id: idsForCandidate.providerProbe,
        record: {
          record_kind: "provider_probe_attempt",
          version: 1,
          provider_probe_attempt_id: idsForCandidate.providerProbe,
          provider_readiness_record_ref: providerReadinessRef,
          provider_kind: input.provider.provider_kind,
          model: input.provider.model,
          result: "succeeded",
          authority_status: "probe_trace_only"
        } satisfies ProviderProbeAttemptRecord
      },
      {
        collection: "trading-runs",
        id: idsForCandidate.runtime,
        record: {
          record_kind: "trading_run",
          version: 1,
          trading_run_id: idsForCandidate.runtime,
          stage_binding_profile: "paper",
          runtime_lifecycle_status: "registered",
          candidate_ref: ref("trading_system_candidate", candidateId),
          candidate_version_ref: ref("candidate_version", idsForCandidate.version),
          placement_ref: ref("sandbox_placement", idsForCandidate.placement),
          hands_environment_ref: ref("hands_environment", idsForCandidate.handsEnvironment),
          memory_surface_ref: ref("runtime_memory_surface", idsForCandidate.memorySurface),
          authority_status: "not_live"
        } satisfies TradingRunRecord
      },
      {
        collection: "sandbox-placements",
        id: idsForCandidate.placement,
        record: {
          record_kind: "sandbox_placement",
          version: 1,
          sandbox_placement_id: idsForCandidate.placement,
          placement_kind: "fixture_local_placeholder",
          tooling_kind: "fixture_only",
          authority_status: "not_launched"
        } satisfies SandboxPlacementRecord
      },
      {
        collection: "hands-environments",
        id: idsForCandidate.handsEnvironment,
        record: {
          record_kind: "hands_environment",
          version: 1,
          hands_environment_id: idsForCandidate.handsEnvironment,
          environment_kind: "fixture_no_tools",
          authority_status: "not_mounted"
        } satisfies HandsEnvironmentRecord
      },
      {
        collection: "runtime-memory-surfaces",
        id: idsForCandidate.memorySurface,
        record: {
          record_kind: "runtime_memory_surface",
          version: 1,
          runtime_memory_surface_id: idsForCandidate.memorySurface,
          trust_class: "fixture_context",
          access_mode: "read_only",
          surface_version: "materialized-v1",
          visibility: "operator_visible",
          quarantine_status: "not_quarantined",
          authority_status: "not_evidence"
        } satisfies RuntimeMemorySurfaceRecord
      },
      {
        collection: "traces",
        id: input.provider.trace_id,
        itemDir: "placeholders",
        record: {
          record_kind: "trace_placeholder",
          version: 1,
          trace_id: input.provider.trace_id,
          authority_status: "not_counted"
        } satisfies TracePlaceholderRecord
      },
      {
        collection: "stage-bindings",
        id: idsForCandidate.stageBinding,
        record: {
          record_kind: "stage_binding",
          version: 1,
          stage_binding_id: idsForCandidate.stageBinding,
          candidate_ref: ref("trading_system_candidate", candidateId),
          candidate_version_ref: ref("candidate_version", idsForCandidate.version),
          stage: "backtest",
          profile: "backtest",
          execution_mode: "host_local",
          sandbox_placement_ref: ref("sandbox_placement", idsForCandidate.placement),
          hands_environment_ref: ref("hands_environment", idsForCandidate.handsEnvironment),
          created_at: attempt.created_at,
          authority_status: "not_live"
        } satisfies StageBindingRecord
      },
      {
        collection: "evaluation-runs",
        id: idsForCandidate.evaluationRun,
        record: {
          record_kind: "evaluation_run_record",
          version: 1,
          evaluation_run_record_id: idsForCandidate.evaluationRun,
          candidate_ref: ref("trading_system_candidate", candidateId),
          candidate_version_ref: ref("candidate_version", idsForCandidate.version),
          stage_binding_ref: ref("stage_binding", idsForCandidate.stageBinding),
          trace_ref: traceRef,
          status: "created",
          created_at: attempt.created_at,
          authority_status: "not_counted"
        } satisfies EvaluationRunRecord
      },
      {
        collection: "evaluation-comparison-sets",
        id: idsForCandidate.evaluationComparisonSet,
        record: {
          record_kind: "evaluation_comparison_set",
          version: 1,
          evaluation_comparison_set_id: idsForCandidate.evaluationComparisonSet,
          candidate_ref: ref("trading_system_candidate", candidateId),
          candidate_version_ref: ref("candidate_version", idsForCandidate.version),
          stage_binding_ref: ref("stage_binding", idsForCandidate.stageBinding),
          evaluation_run_refs: [ref("evaluation_run_record", idsForCandidate.evaluationRun)],
          comparability_status: "not_evaluated",
          comparability_reason: "no_external_evaluator",
          created_at: attempt.created_at,
          authority_status: "not_counted"
        } satisfies EvaluationComparisonSetRecord
      },
      {
        collection: "evidence-sealing-decisions",
        id: idsForCandidate.evidenceSealingDecision,
        record: {
          record_kind: "evidence_sealing_decision",
          version: 1,
          evidence_sealing_decision_id: idsForCandidate.evidenceSealingDecision,
          evaluation_comparison_set_ref: ref("evaluation_comparison_set", idsForCandidate.evaluationComparisonSet),
          evaluation_run_refs: [ref("evaluation_run_record", idsForCandidate.evaluationRun)],
          evidence_disposition: "not_counted",
          disposition_reason: "no_external_evaluator",
          created_at: attempt.created_at,
          authority_status: "not_counted"
        } satisfies EvidenceSealingDecisionRecord
      },
      ...materializedEvidenceClassifications.map((classification) => ({
        collection: "evidence-classifications" as const,
        id: classification.evidence_classification_id,
        record: classification
      }))
    ];

    await this.assertExactAuthorityIdentity({
      collection: "candidate-versions",
      id: candidateVersion.candidate_version_id,
      recordKind: "candidate_version",
      next: candidateVersion,
      digestInput: paperTradingComparisonCandidateVersionDigestInput
    });
    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const attemptReadModel = await this.getCandidateMaterializationAttempt(idsForCandidate.attempt);
    const candidateReadModel = await this.getCandidate(candidateId);
    if (!attemptReadModel || !candidateReadModel) {
      throw new Error("candidate materialization projection failed");
    }
    return {
      status: "materialized",
      attempt: attemptReadModel,
      candidate: candidateReadModel
    };
  }

  async recordCandidateMaterializationFailure(
    failure: CandidateMaterializationFailureInput
  ): Promise<CandidateMaterializationOutcome> {
    const existing = await this.findMaterializationAttemptByIdempotencyKey(failure.idempotency_key);
    if (existing) {
      return this.toMaterializationOutcome(existing);
    }

    const attemptId = `candidate-materialization-attempt-${stableSuffix(failure.idempotency_key)}`;
    const attempt: CandidateMaterializationAttemptRecord = {
      record_kind: "candidate_materialization_attempt",
      version: 1,
      candidate_materialization_attempt_id: attemptId,
      idempotency_key: failure.idempotency_key,
      provider_kind: failure.provider_kind,
      model: failure.model,
      agent_run_ref: ref("agent_run", failure.agent_run_id),
      trace_ref: ref("trace_placeholder", failure.trace_id),
      status: "failed",
      validation_status: "rejected",
      failure_reason: failure.failure_reason,
      artifact_refs: failure.artifact_refs,
      created_at: new Date().toISOString()
    };
    await this.writeJson(this.itemPath("candidate-materialization-attempts", attemptId), attempt);
    await this.rebuildProjections();

    const readModel = await this.getCandidateMaterializationAttempt(attemptId);
    if (!readModel) {
      throw new Error("candidate materialization failure projection failed");
    }
    return {
      status: "failed",
      attempt: readModel
    };
  }

  private async recordImprovementProposalMaterializationFailure(
    input: ImprovementProposalMaterializationInput,
    failureReason: ImprovementProposalMaterializationFailureReason
  ): Promise<ImprovementProposalMaterializationOutcome> {
    const attemptId = `improvement-proposal-materialization-attempt-${stableSuffix(input.idempotency_key)}`;
    const providerResult = input.provider_result;
    const attempt: ImprovementProposalMaterializationAttemptRecord = {
      record_kind: "improvement_proposal_materialization_attempt",
      version: 1,
      improvement_proposal_materialization_attempt_id: attemptId,
      idempotency_key: input.idempotency_key,
      provider: providerResult.provider,
      agent_run_ref: providerResult.agent_run_ref,
      agent_event_refs: providerResult.agent_event_refs,
      trace_ref: providerResult.trace_ref,
      provider_output_artifact_refs: providerResult.provider_output_artifact_refs,
      debug_artifact_refs: providerResult.debug_artifact_refs,
      status: "failed",
      validation_status: "rejected",
      failure_reason: failureReason,
      created_at: input.created_at ?? new Date().toISOString(),
      authority_status: "proposal_input_only"
    };

    await this.writeJson(this.itemPath("improvement-proposal-materialization-attempts", attemptId), attempt);
    return {
      status: "failed",
      attempt
    };
  }

  private async findImprovementProposalMaterializationAttemptByIdempotencyKey(
    idempotencyKey: string
  ): Promise<ImprovementProposalMaterializationAttemptRecord | undefined> {
    const attempts = await this.readCollection<ImprovementProposalMaterializationAttemptRecord>(
      "improvement-proposal-materialization-attempts"
    );
    return attempts.find((attempt) => attempt.idempotency_key === idempotencyKey);
  }

  private async toImprovementProposalMaterializationOutcome(
    attempt: ImprovementProposalMaterializationAttemptRecord
  ): Promise<ImprovementProposalMaterializationOutcome> {
    if (attempt.status === "failed") {
      return {
        status: "failed",
        attempt
      };
    }

    if (
      !attempt.output_artifact_proposal_ref ||
      !attempt.output_system_code_ref ||
      !attempt.output_lineage_ref
    ) {
      throw new LocalStoreError(
        "improvement_proposal_materialization_reload_failed",
        `improvement proposal materialization attempt ${attempt.improvement_proposal_materialization_attempt_id} has no output refs`,
        { attempt_id: attempt.improvement_proposal_materialization_attempt_id }
      );
    }

    const proposal = await this.readOptionalRecord<ImprovementProposalRecord>(
      "improvement-proposals",
      attempt.output_artifact_proposal_ref.id
    );
    const systemCode = await this.readOptionalRecord<SystemCodeRecord>(
      "system-codes",
      attempt.output_system_code_ref.id
    );
    const lineage = await this.readOptionalRecord<ArtifactLineageRecord>(
      "artifact-lineages",
      attempt.output_lineage_ref.id
    );
    if (!proposal || !systemCode || !lineage) {
      throw new LocalStoreError(
        "improvement_proposal_materialization_reload_failed",
        `improvement proposal materialization attempt ${attempt.improvement_proposal_materialization_attempt_id} was not reloaded`,
        { attempt_id: attempt.improvement_proposal_materialization_attempt_id }
      );
    }

    return {
      status: "materialized",
      attempt,
      proposal,
      system_code: systemCode,
      lineage
    };
  }

  private async findMaterializationAttemptByIdempotencyKey(
    idempotencyKey: string
  ): Promise<CandidateMaterializationAttemptRecord | undefined> {
    const attempts = await this.readCollection<CandidateMaterializationAttemptRecord>(
      "candidate-materialization-attempts"
    );
    return attempts.find((attempt) => attempt.idempotency_key === idempotencyKey);
  }

  private async toMaterializationOutcome(
    attempt: CandidateMaterializationAttemptRecord
  ): Promise<CandidateMaterializationOutcome> {
    const attemptReadModel = toCandidateMaterializationAttemptReadModel(attempt);
    if (attempt.status === "materialized" && attempt.resulting_candidate_ref) {
      const candidate = await this.getCandidate(attempt.resulting_candidate_ref.id);
      if (!candidate) {
        throw new Error(`materialized candidate missing for attempt ${attempt.candidate_materialization_attempt_id}`);
      }
      return {
        status: "materialized",
        attempt: attemptReadModel,
        candidate
      };
    }
    return {
      status: "failed",
      attempt: attemptReadModel
    };
  }

  private async toCandidateEvaluationRunOutcome(
    evaluationRun: EvaluationRunRecord
  ): Promise<CandidateEvaluationRunOutcome> {
    try {
      const trace = await this.readRecord<TracePlaceholderRecord>(
        "traces",
        evaluationRun.trace_ref.id,
        "placeholders"
      );
      const stageBinding = await this.readRecord<StageBindingRecord>(
        "stage-bindings",
        evaluationRun.stage_binding_ref.id
      );
      const comparisonSet = await this.evaluationComparisonSetForRun(
        evaluationRun.evaluation_run_record_id
      );
      const sealingDecision = await this.evidenceSealingDecisionForComparisonSet(
        comparisonSet.evaluation_comparison_set_id
      );
      const evidenceClassifications = await this.listEvidenceClassificationsForEvaluationRun(
        evaluationRun.evaluation_run_record_id
      );

      return {
        candidate_id: evaluationRun.candidate_ref.id,
        candidate_version_id: evaluationRun.candidate_version_ref.id,
        trace,
        stage_binding: stageBinding,
        evaluation_run: evaluationRun,
        comparison_set: comparisonSet,
        sealing_decision: sealingDecision,
        evidence_classifications: evidenceClassifications
      };
    } catch (error) {
      if (isMissingFileError(error) || isMissingEvaluationLinkError(error)) {
        throw new LocalStoreError(
          "evaluation_run_incomplete",
          `evaluation run ${evaluationRun.evaluation_run_record_id} has incomplete linked records`,
          { evaluation_run_record_id: evaluationRun.evaluation_run_record_id }
        );
      }
      throw error;
    }
  }

  private async buildCandidateInspectReadModel(
    candidateId: string,
    candidateVersionId?: string,
    tradingRunId?: string
  ): Promise<CandidateInspectReadModel> {
    const candidate = await this.readRecord<TradingSystemCandidateRecord>("candidates", candidateId);
    const version = await this.readRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidateVersionId ?? candidate.active_version_id
    );
    const spec = await this.readRecord<TradingSystemSpecRecord>("trading-system-specs", version.spec_ref.id);
    const program = await this.readRecord<TradingSystemProgramRecord>(
      "trading-system-programs",
      version.program_ref.id
    );
    const programManifest = await this.readRecord<ProgramManifestRecord>(
      "program-manifests",
      program.manifest_ref.id
    );
    const programValidation = await this.readRecord<ProgramValidationRecord>(
      "program-validations",
      program.validation_record_ref.id
    );
    const capabilityPackage = await this.readRecord<CapabilityPackageRecord>(
      "capability-packages",
      version.capability_package_refs[0]?.id ?? ""
    );
    const capabilityManifest = await this.readRecord<CapabilityManifestRecord>(
      "capability-manifests",
      capabilityPackage.manifest_ref.id
    );
    const capabilityAdmission = await this.readRecord<CapabilityPackageAdmissionRecord>(
      "capability-admissions",
      capabilityPackage.admission_record_ref.id
    );
    const capabilityGrant = await this.readRecord<CapabilityGrantRecord>(
      "capability-grants",
      capabilityPackage.grant_ref.id
    );
    const capabilityMount = await this.readRecord<CapabilityMountRecord>(
      "capability-mounts",
      capabilityPackage.mount_record_ref.id
    );
    const agentSpecRef = version.agent_spec_ref ?? ref("agent_spec", ids.agentSpec);
    const agentSessionRef = version.agent_session_ref ?? ref("agent_session", ids.agentSession);
    const agentRunRef = version.agent_run_ref ?? ref("agent_run", ids.agentRun);
    const agentEventRef = version.agent_event_ref ?? ref("agent_event", ids.agentEvent);
    const providerReadinessRef =
      version.provider_readiness_ref ?? ref("provider_readiness_record", ids.providerReadiness);
    const providerProbeAttemptRef =
      version.provider_probe_attempt_ref ?? ref("provider_probe_attempt", ids.providerProbe);
    const agentSpec = await this.readRecord<AgentSpecRecord>("agent-specs", agentSpecRef.id);
    const agentSession = await this.readRecord<AgentSessionRecord>("agent-sessions", agentSessionRef.id);
    const agentRun = await this.readRecord<AgentRunRecord>("agent-runs", agentRunRef.id);
    const agentEvent = await this.readRecord<AgentEventRecord>("agent-events", agentEventRef.id);
    const providerReadiness = await this.readRecord<ProviderReadinessRecord>(
      "provider-readiness-records",
      providerReadinessRef.id
    );
    const providerProbe = await this.readRecord<ProviderProbeAttemptRecord>(
      "provider-probe-attempts",
      providerProbeAttemptRef.id
    );
    const runtime = await this.readRecord<TradingRunRecord>(
      "trading-runs",
      tradingRunId ?? version.runtime_ref.id
    );
    const placement = await this.readRecord<SandboxPlacementRecord>(
      "sandbox-placements",
      runtime.placement_ref.id
    );
    const handsEnvironment = await this.readRecord<HandsEnvironmentRecord>(
      "hands-environments",
      runtime.hands_environment_ref.id
    );
    const memorySurface = await this.readRecord<RuntimeMemorySurfaceRecord>(
      "runtime-memory-surfaces",
      runtime.memory_surface_ref.id
    );
    const trace = await this.readRecord<TracePlaceholderRecord>(
      "traces",
      version.trace_placeholder_ref.id,
      "placeholders"
    );
    const evaluation = await this.buildCandidateEvaluationReadModel(candidate, version);
    const materializationAttempt = version.materialization_attempt_ref
      ? await this.readRecord<CandidateMaterializationAttemptRecord>(
          "candidate-materialization-attempts",
          version.materialization_attempt_ref.id
        )
      : undefined;
    const latestTradingSubstrate = await buildLatestBinanceBtcusdtTradingSubstrateProjection(this);
    const ledgerSource = await this.buildLedgerSourceRecordsReadModel(runtime);
    const improvement = await this.buildImprovementReadModel(candidate, version);
    const ledger = buildLedgerReadModel(ledgerSource);
    const fullCycleLineage = buildFullCycleLineageReadModel({
      candidate,
      version,
      materializationAttempt,
      runtime,
      ledger
    });
    const runControl = await this.buildRunControlReadModel(runtime);
    const sandbox = runtime.sandbox_ref
      ? await this.buildSandboxDetailReadModel(runtime.sandbox_ref.id)
      : undefined;
    const transcript = await this.buildTradingRunTranscriptReadModel(
      runtime,
      ledger,
      sandbox
    );

    return {
      ...this.toCandidateSummary(candidate),
      trading_system: {
        system_id: candidate.candidate_id,
        version_id: version.candidate_version_id,
        ref: ref(candidate.record_kind, candidate.candidate_id),
        status: candidate.status,
        summary: candidate.system_summary ?? candidate.display_name
      },
      system_code: {
        ref: version.system_code_ref ?? candidate.active_system_code_ref,
        summary: program.summary,
        declared_runtime: programManifest.declared_runtime,
        declared_outputs: programManifest.declared_outputs
      },
      trading_run: {
        ref: ref("trading_run", runtime.trading_run_id),
        stage: runtime.stage_binding_profile,
        lifecycle_status: runtime.runtime_lifecycle_status,
        authority_status: runtime.authority_status
      },
      ledger,
      improvement,
      candidate_version: {
        candidate_version_id: version.candidate_version_id,
        version_label: version.version_label,
        provenance_refs: candidate.provenance_refs,
        materialization_attempt_ref: version.materialization_attempt_ref
      },
      spec: {
        ref: version.spec_ref,
        summary: spec.summary,
        market: spec.market,
        instrument: spec.instrument,
        supported_stage_binding_profiles: spec.supported_stage_binding_profiles
      },
      program: {
        ref: version.program_ref,
        summary: program.summary,
        manifest: {
          ref: program.manifest_ref,
          declared_runtime: programManifest.declared_runtime,
          declared_outputs: programManifest.declared_outputs
        },
        validation: placeholder(program.validation_record_ref, "Program validation", programValidation)
      },
      capability_package: {
        ref: version.capability_package_refs[0],
        summary: capabilityPackage.summary,
        manifest: {
          ref: capabilityPackage.manifest_ref,
          allowed_stages: capabilityManifest.allowed_stages,
          declared_permissions: capabilityManifest.declared_permissions,
          forbidden_contents: capabilityManifest.forbidden_contents
        },
        admission: placeholder(capabilityPackage.admission_record_ref, "Capability admission", capabilityAdmission),
        grant: placeholder(capabilityPackage.grant_ref, "Capability grant", capabilityGrant),
        mount: placeholder(capabilityPackage.mount_record_ref, "Capability mount", capabilityMount)
      },
      agent_provider: {
        agent_spec: placeholder(ref(agentSpec.record_kind, agentSpec.agent_spec_id), "Agent spec", agentSpec),
        agent_session: placeholder(ref(agentSession.record_kind, agentSession.agent_session_id), "Agent session", agentSession),
        agent_run: placeholder(ref(agentRun.record_kind, agentRun.agent_run_id), "Agent run", agentRun),
        agent_event: placeholder(ref(agentEvent.record_kind, agentEvent.agent_event_id), "Agent event", agentEvent),
        provider_readiness: placeholder(ref(providerReadiness.record_kind, providerReadiness.provider_readiness_record_id), "Provider readiness", providerReadiness),
        provider_probe_attempt: placeholder(ref(providerProbe.record_kind, providerProbe.provider_probe_attempt_id), "Provider probe", providerProbe)
      },
      runtime: {
        ref: ref("trading_run", runtime.trading_run_id),
        stage_binding_profile: runtime.stage_binding_profile,
        runtime_lifecycle_status: runtime.runtime_lifecycle_status,
        authority_status: runtime.authority_status,
        placement: placeholder(runtime.placement_ref, "Sandbox placement", placement),
        hands_environment: placeholder(runtime.hands_environment_ref, "Hands environment", handsEnvironment),
        memory_surface: {
          ref: runtime.memory_surface_ref,
          trust_class: memorySurface.trust_class,
          access_mode: memorySurface.access_mode,
          surface_version: memorySurface.surface_version,
          visibility: memorySurface.visibility,
          quarantine_status: memorySurface.quarantine_status,
          authority_status: memorySurface.authority_status
        },
        ledger: ledgerSource,
        run_control: runControl,
        sandbox,
        transcript
      },
      trading_substrate: latestTradingSubstrate,
      trace: placeholder(version.trace_placeholder_ref, "Trace placeholder", trace),
      evaluation,
      materialization_attempt: materializationAttempt
        ? toCandidateMaterializationAttemptReadModel(materializationAttempt)
        : undefined,
      full_cycle_lineage: fullCycleLineage
    };
  }

  private async buildImprovementReadModel(
    candidate: TradingSystemCandidateRecord,
    version: CandidateVersionRecord
  ): Promise<ImprovementReadModel> {
    const activeSystemCodeId = version.system_code_ref?.id ?? candidate.active_system_code_ref?.id;
    const allProposals = await this.listImprovementProposals();
    const proposals = activeSystemCodeId
      ? allProposals.filter((proposal) =>
          proposal.parent_system_code_ref?.id === activeSystemCodeId ||
          proposal.proposed_system_code_ref.id === activeSystemCodeId
        )
      : allProposals;
    const proposalIds = new Set(proposals.map((proposal) => proposal.improvement_proposal_id));
    const proposedArtifactIds = new Set(proposals.map((proposal) => proposal.proposed_system_code_ref.id));
    const sourceFindingIds = new Set(
      proposals.flatMap((proposal) => [
        ...proposal.source_finding_refs,
        ...(proposal.anti_hacking_finding_refs ?? [])
      ]).map((findingRef) => findingRef.id)
    );
    const findings = (await this.listResearchFindings()).filter((finding) =>
      sourceFindingIds.has(finding.research_finding_id)
    );
    const materializationAttempts = (await this.listImprovementProposalMaterializationAttempts())
      .filter((attempt) =>
        attempt.output_artifact_proposal_ref !== undefined &&
        proposalIds.has(attempt.output_artifact_proposal_ref.id)
      );
    const orchestrationRuns = (await this.listResearchOrchestrationRuns())
      .filter((run) =>
        run.output_artifact_proposal_ref !== undefined &&
        proposalIds.has(run.output_artifact_proposal_ref.id)
      );
    const experiments = (await this.listExperimentRuns()).filter((experiment) =>
      proposedArtifactIds.has(experiment.system_code_ref?.id ?? "")
    );
    const experimentIds = new Set(experiments.map((experiment) => experiment.experiment_run_id));
    const tradingEvaluationResults = (await this.listTradingEvaluationResults()).filter((result) =>
      experimentIds.has(result.experiment_run_ref.id)
    );

    return buildImprovementReadModel({
      research_findings: findings,
      improvement_proposals: proposals,
      materialization_attempts: materializationAttempts,
      research_orchestration_runs: orchestrationRuns,
      experiment_runs: experiments,
      trading_evaluation_results: tradingEvaluationResults
    });
  }

  private async buildLedgerSourceRecordsReadModel(
    runtime: TradingRunRecord
  ): Promise<LedgerSourceRecordsReadModel> {
    const runtimeId = runtime.trading_run_id;
    const orderRequests = (await this.readCollection<OrderRequestRecord>("order-requests"))
      .filter((orderIntent) => orderIntent.runtime_ref.id === runtimeId)
      .sort(compareOrderRequests);
    if (!orderRequests.length) {
      return emptyLedgerSourceRecordsReadModel();
    }

    const gatewayResults = await this.readCollection<GatewayResultRecord>("gateway-results");
    const executionResults = await this.readCollection<ExecutionResultRecord>("execution-results");
    const chains = orderRequests
      .map((orderRequest) => ledgerSourceChainForOrderRequest({
        orderRequest,
        gatewayResults,
        executionResults
      }))
      .sort(compareLedgerSourceChains)
      .reverse();
    const latestChain = chains[0];
    const latestOrderRequest = latestChain.order_request;
    const latestGatewayResult = latestChain.gateway_result;
    const latestExecutionResult = latestChain.execution_result;

    return {
      has_activity: true,
      chain_complete: latestChain.chain_complete,
      chain_count: chains.length,
      chains,
      latest_order_request: latestOrderRequest,
      latest_gateway_result: latestGatewayResult,
      latest_execution_result: latestExecutionResult,
      order_request: statusPlaceholder(
        ref("order_request", latestOrderRequest.order_request_id),
        "Order request",
        latestOrderRequest.status,
        latestOrderRequest.authority_status
      ),
      gateway_result: latestGatewayResult
        ? statusPlaceholder(
            ref("gateway_result", latestGatewayResult.gateway_result_id),
            "Gateway result",
            latestGatewayResult.decision_outcome,
            latestGatewayResult.authority_status
          )
        : statusPlaceholder(
            ref("gateway_result", "missing"),
            "Gateway result",
            "missing",
            "not_live"
          ),
      execution_result: latestExecutionResult
        ? statusPlaceholder(
            ref("execution_result", latestExecutionResult.execution_result_id),
            "Execution result",
            latestExecutionResult.status,
            latestExecutionResult.authority_status
          )
        : statusPlaceholder(
            ref("execution_result", "missing"),
            "Execution result",
            "missing",
            "not_submitted"
          )
    };
  }

  private async buildRunControlReadModel(
    runtime: TradingRunRecord
  ): Promise<RunControlReadModel> {
    const runtimeId = runtime.trading_run_id;
    const commands = (await this.readCollection<RunControlCommandRecord>("run-control-commands"))
      .filter((command) => command.runtime_ref.id === runtimeId)
      .sort(compareRunControlCommands);
    const latestCommand = commands.at(-1);
    if (!latestCommand) {
      return emptyRunControlReadModel();
    }

    const decisions = (await this.readCollection<RunControlDecisionRecord>("run-control-decisions"))
      .filter((decision) => decision.command_ref.id === latestCommand.run_control_command_id)
      .sort(compareRunControlDecisions);
    const latestDecision = decisions.at(-1);
    const auditEvents = (await this.readCollection<RuntimeAuditEventRecord>("runtime-audit-events"))
      .filter((event) => (
        event.command_ref?.id === latestCommand.run_control_command_id ||
        (
          latestDecision !== undefined &&
          event.decision_ref?.id === latestDecision.run_control_decision_id
        )
      ))
      .sort(compareRuntimeAuditEvents);
    const latestAuditEvent = auditEvents.at(-1);

    return {
      has_activity: true,
      chain_complete: Boolean(latestDecision && latestAuditEvent),
      latest_command: toRunControlCommandReadModel(latestCommand),
      latest_decision: latestDecision
        ? toRunControlDecisionReadModel(latestDecision)
        : null,
      latest_audit_event: latestAuditEvent
        ? toRunControlAuditEventReadModel(latestAuditEvent)
        : null,
      command: statusPlaceholder(
        ref(latestCommand.record_kind, latestCommand.run_control_command_id),
        "Runtime control command",
        latestCommand.status,
        latestCommand.authority_status
      ),
      decision: latestDecision
        ? statusPlaceholder(
            ref(latestDecision.record_kind, latestDecision.run_control_decision_id),
            "Runtime control decision",
            latestDecision.decision_outcome,
            latestDecision.authority_status
          )
        : statusPlaceholder(
            ref("run_control_decision", "missing"),
            "Runtime control decision",
            "missing",
            "not_live"
          ),
      audit_event: latestAuditEvent
        ? statusPlaceholder(
            ref(latestAuditEvent.record_kind, latestAuditEvent.runtime_audit_event_id),
            "Runtime audit event",
            latestAuditEvent.event_kind,
            latestAuditEvent.authority_status
          )
        : statusPlaceholder(
            ref("runtime_audit_event", "missing"),
            "Runtime audit event",
            "missing",
            "not_live"
          )
    };
  }

  private async buildTradingRunTranscriptReadModel(
    runtime: TradingRunRecord,
    ledger: LedgerReadModel,
    sandbox?: SandboxDetailReadModel
  ): Promise<TradingRunTranscriptReadModel> {
    const runtimeId = runtime.trading_run_id;
    const commands = (await this.readCollection<RunControlCommandRecord>("run-control-commands"))
      .filter((command) => command.runtime_ref.id === runtimeId)
      .sort(compareRunControlCommands);
    const commandIds = new Set(commands.map((command) => command.run_control_command_id));
    const decisions = (await this.readCollection<RunControlDecisionRecord>("run-control-decisions"))
      .filter((decision) => commandIds.has(decision.command_ref.id))
      .sort(compareRunControlDecisions);
    const decisionIds = new Set(decisions.map((decision) => decision.run_control_decision_id));
    const auditEvents = (await this.readCollection<RuntimeAuditEventRecord>("runtime-audit-events"))
      .filter((event) => (
        (event.command_ref ? commandIds.has(event.command_ref.id) : false) ||
        (event.decision_ref ? decisionIds.has(event.decision_ref.id) : false)
      ))
      .sort(compareRuntimeAuditEvents);

    const items: TradingRunTranscriptItemReadModel[] = [];
    for (const command of commands) {
      items.push({
        item_id: `run-control-command:${command.run_control_command_id}`,
        item_kind: "run_control_command",
        occurred_at: command.requested_at,
        label: "Run Control command",
        summary: `${command.action} / ${command.requested_lifecycle_status ?? "unchanged"}`,
        ref: ref(command.record_kind, command.run_control_command_id),
        authority_status: command.authority_status,
        lifecycle_status: command.requested_lifecycle_status
      });
    }
    for (const decision of decisions) {
      items.push({
        item_id: `run-control-decision:${decision.run_control_decision_id}`,
        item_kind: "run_control_decision",
        occurred_at: decision.decided_at,
        label: "Run Control decision",
        summary: `${decision.decision_outcome} / ${decision.resulting_lifecycle_status ?? "unchanged"}`,
        ref: ref(decision.record_kind, decision.run_control_decision_id),
        authority_status: decision.authority_status,
        lifecycle_status: decision.resulting_lifecycle_status
      });
    }
    for (const auditEvent of auditEvents) {
      items.push({
        item_id: `run-control-audit:${auditEvent.runtime_audit_event_id}`,
        item_kind: "run_control_audit",
        occurred_at: auditEvent.created_at,
        label: "Run Control audit",
        summary: auditEvent.message ?? auditEvent.event_kind,
        ref: ref(auditEvent.record_kind, auditEvent.runtime_audit_event_id),
        authority_status: auditEvent.authority_status,
        lifecycle_status: auditEvent.runtime_lifecycle_status
      });
    }

    if (sandbox) {
      items.push({
        item_id: `sandbox-lifecycle:${sandbox.sandbox_id}`,
        item_kind: "sandbox_lifecycle",
        occurred_at: sandbox.stopped_at ?? sandbox.last_heartbeat_at ?? sandbox.started_at ?? sandbox.created_at,
        label: "Sandbox lifecycle",
        summary: `${sandbox.lifecycle_status} / ${sandbox.adapter_kind}`,
        ref: ref("sandbox", sandbox.sandbox_id),
        authority_status: sandbox.authority_status
      });
      for (const heartbeat of sandbox.heartbeats) {
        items.push({
          item_id: `sandbox-heartbeat:${heartbeat.heartbeat_ref.id}`,
          item_kind: "sandbox_heartbeat",
          occurred_at: heartbeat.observed_at,
          label: "Sandbox heartbeat",
          summary: heartbeat.heartbeat_line,
          ref: heartbeat.heartbeat_ref,
          authority_status: heartbeat.authority_status
        });
      }
      for (const log of sandbox.logs) {
        for (const orderRequestEvent of sandboxOrderRequestEvents(log)) {
          items.push({
            item_id: `sandbox-order-request:${log.log_ref.id}:${orderRequestEvent.index}`,
            item_kind: "sandbox_order_request",
            occurred_at: orderRequestEvent.at ?? log.captured_at,
            label: "Sandbox order request",
            summary: `${orderRequestEvent.symbol ?? "BTCUSDT"} ${orderRequestEvent.side ?? "none"} / ${orderRequestEvent.order_type ?? "none"} / ${orderRequestEvent.quantity ?? "none"} @ ${orderRequestEvent.limit_price ?? "none"}`,
            ref: log.log_ref,
            authority_status: log.authority_status
          });
        }
        items.push({
          item_id: `sandbox-log:${log.log_ref.id}`,
          item_kind: "sandbox_log",
          occurred_at: log.captured_at,
          label: "Sandbox log",
          summary: log.lines.join(" / ") || "log captured",
          ref: log.log_ref,
          authority_status: log.authority_status
        });
      }
    }

    if (ledger.latest_order_request) {
      const orderRequest = ledger.latest_order_request;
      items.push({
        item_id: `order-request:${orderRequest.order_request_id}`,
        item_kind: "order_request",
        occurred_at: orderRequest.created_at,
        label: "Order request",
        summary: `${orderRequest.side ?? "none"} / ${orderRequest.order_type ?? "none"} / ${orderRequest.quantity ?? "none"} @ ${orderRequest.limit_price ?? "none"}`,
        ref: ref("order_request", orderRequest.order_request_id),
        authority_status: orderRequest.authority_status
      });
    }
    if (ledger.latest_gateway_result) {
      const gatewayResult = ledger.latest_gateway_result;
      items.push({
        item_id: `gateway-result:${gatewayResult.gateway_result_id}`,
        item_kind: "gateway_result",
        occurred_at: gatewayResult.decided_at,
        label: "Gateway result",
        summary: `${gatewayResult.decision_outcome} / ${gatewayResult.decision_reason}`,
        ref: ref("gateway_result", gatewayResult.gateway_result_id),
        authority_status: gatewayResult.authority_status
      });
    }
    if (ledger.latest_execution_result) {
      const executionResult = ledger.latest_execution_result;
      items.push({
        item_id: `execution-result:${executionResult.execution_result_id}`,
        item_kind: "execution_result",
        occurred_at: executionResult.completed_at ?? executionResult.created_at,
        label: "Execution result",
        summary: `${executionResult.status} / ${executionResult.result_reason}`,
        ref: ref("execution_result", executionResult.execution_result_id),
        authority_status: executionResult.authority_status
      });
    }

    const sortedItems = items.sort(compareTradingRunTranscriptItems);
    return {
      transcript_kind: "trading_run_transcript",
      has_activity: sortedItems.length > 0,
      item_count: sortedItems.length,
      latest_item: sortedItems.at(-1) ?? null,
      items: sortedItems,
      authority_status: "not_live",
      no_authority: {
        live_exchange_authority: false,
        private_read_authority: false,
        order_submission_authority: false,
        credentials: false
      }
    };
  }

  private async readLedgerWriteOutcome(
    candidateId: string,
    candidateVersionId: string,
    runtimeId: string,
    recordIds: LedgerRecordIds
  ): Promise<LedgerWriteOutcome | undefined> {
    const orderIntent = await this.readOptionalRecord<OrderRequestRecord>(
      "order-requests",
      recordIds.orderIntent
    );
    const gatewayDecision = await this.readOptionalRecord<GatewayResultRecord>(
      "gateway-results",
      recordIds.gatewayDecision
    );
    const executionAttempt = await this.readOptionalRecord<ExecutionResultRecord>(
      "execution-results",
      recordIds.executionAttempt
    );
    if (!orderIntent || !gatewayDecision || !executionAttempt) {
      return undefined;
    }
    return {
      candidate_id: candidateId,
      candidate_version_id: candidateVersionId,
      runtime_id: runtimeId,
      order_request: orderIntent,
      gateway_result: gatewayDecision,
      execution_result: executionAttempt
    };
  }

  private async readRunControlAuditOutcome(
    candidateId: string,
    candidateVersionId: string,
    runtimeId: string,
    recordIds: RunControlAuditRecordIds
  ): Promise<RunControlAuditOutcome | undefined> {
    const command = await this.readOptionalRecord<RunControlCommandRecord>(
      "run-control-commands",
      recordIds.command
    );
    const decision = await this.readOptionalRecord<RunControlDecisionRecord>(
      "run-control-decisions",
      recordIds.decision
    );
    const auditEvent = await this.readOptionalRecord<RuntimeAuditEventRecord>(
      "runtime-audit-events",
      recordIds.auditEvent
    );
    if (!command || !decision || !auditEvent) {
      return undefined;
    }
    return {
      candidate_id: candidateId,
      candidate_version_id: candidateVersionId,
      runtime_id: runtimeId,
      command,
      decision,
      audit_event: auditEvent
    };
  }

  private async buildCandidateEvaluationReadModel(
    candidate: TradingSystemCandidateRecord,
    version: CandidateVersionRecord
  ): Promise<CandidateEvaluationReadModel> {
    const evaluationRuns = await this.readCollection<EvaluationRunRecord>("evaluation-runs");
    const replayRuns = evaluationRuns
      .filter((run) => (
        run.candidate_ref.id === candidate.candidate_id &&
        run.candidate_version_ref.id === version.candidate_version_id
      ))
      .sort(compareEvaluationRuns);

    const latestRun = replayRuns.at(-1);
    if (!latestRun) {
      return emptyCandidateEvaluationReadModel(version.evaluation_run_ref);
    }

    const stageBinding = await this.readOptionalRecord<StageBindingRecord>(
      "stage-bindings",
      latestRun.stage_binding_ref.id
    );
    const trace = await this.readOptionalRecord<TracePlaceholderRecord>(
      "traces",
      latestRun.trace_ref.id,
      "placeholders"
    );
    const comparisonSet = await this.findEvaluationComparisonSetForRun(
      latestRun.evaluation_run_record_id
    );
    const sealingDecision = comparisonSet
      ? await this.findEvidenceSealingDecisionForComparisonSet(
          comparisonSet.evaluation_comparison_set_id
        )
      : undefined;
    const evidenceClassifications = await this.listEvidenceClassificationsForEvaluationRun(
      latestRun.evaluation_run_record_id
    );
    const errorState = candidateEvaluationErrorState(
      latestRun,
      Boolean(stageBinding && trace && comparisonSet && sealingDecision)
    );

    return {
      has_runs: true,
      latest_run: {
        run_id: latestRun.evaluation_run_record_id,
        status: latestRun.status,
        stage: stageBinding?.stage ?? null,
        profile: stageBinding?.profile ?? null,
        execution_mode: stageBinding?.execution_mode ?? null,
        trace_ref: latestRun.trace_ref,
        authority_status: latestRun.authority_status,
        created_at: latestRun.created_at,
        started_at: latestRun.started_at,
        completed_at: latestRun.completed_at,
        error_state: errorState
      },
      latest_comparison_set: comparisonSet
        ? {
            comparison_set_id: comparisonSet.evaluation_comparison_set_id,
            stage_binding_ref: comparisonSet.stage_binding_ref,
            evaluation_run_refs: evaluationRunRefsForComparisonSet(comparisonSet),
            comparability_status: comparisonSet.comparability_status,
            comparability_reason: comparisonSet.comparability_reason,
            authority_status: comparisonSet.authority_status,
            created_at: comparisonSet.created_at
          }
        : null,
      latest_sealing_decision: sealingDecision
        ? {
            sealing_decision_id: sealingDecision.evidence_sealing_decision_id,
            evaluation_comparison_set_ref: sealingDecision.evaluation_comparison_set_ref,
            evaluation_run_refs: sealingDecision.evaluation_run_refs,
            evidence_disposition: sealingDecision.evidence_disposition,
            disposition_reason: sealingDecision.disposition_reason,
            authority_status: sealingDecision.authority_status,
            created_at: sealingDecision.created_at,
            sealed_at: sealingDecision.sealed_at
          }
        : null,
      trace: trace
        ? {
            state: "linked",
            trace_ref: latestRun.trace_ref,
            authority_label: trace.authority_label,
            authority_status: trace.authority_status,
            provider_output_artifact_refs: trace.provider_output_artifact_refs ?? [],
            debug_artifact_refs: trace.debug_artifact_refs ?? []
          }
        : {
            state: "missing",
            trace_ref: latestRun.trace_ref,
            authority_status: "not_counted",
            provider_output_artifact_refs: [],
            debug_artifact_refs: []
          },
      evidence_classifications: evidenceClassifications.map(toEvidenceClassificationReadModel),
      counted_evidence: sealingDecision
        ? {
            counted: (
              sealingDecision.evidence_disposition === "counted" &&
              sealingDecision.authority_status === "counted"
            ),
            evidence_disposition: sealingDecision.evidence_disposition,
            disposition_reason: sealingDecision.disposition_reason,
            authority_status: sealingDecision.authority_status,
            sealed_at: sealingDecision.sealed_at
          }
        : {
            counted: false,
            evidence_disposition: "not_counted",
            disposition_reason: "evaluation_links_incomplete",
            authority_status: "not_counted"
          },
      error_state: errorState,
      run: statusPlaceholder(
        ref(latestRun.record_kind, latestRun.evaluation_run_record_id),
        "Evaluation run",
        latestRun.status,
        latestRun.authority_status
      ),
      comparison_set: comparisonSet
        ? statusPlaceholder(
            ref(comparisonSet.record_kind, comparisonSet.evaluation_comparison_set_id),
            "Evaluation comparison set",
            comparisonSet.comparability_status,
            comparisonSet.authority_status
          )
        : statusPlaceholder(
            ref("evaluation_comparison_set", "missing"),
            "Evaluation comparison set",
            "missing",
            "not_counted"
          ),
      sealing_decision: sealingDecision
        ? statusPlaceholder(
            ref(sealingDecision.record_kind, sealingDecision.evidence_sealing_decision_id),
            "Evidence sealing decision",
            sealingDecision.evidence_disposition,
            sealingDecision.authority_status
          )
        : statusPlaceholder(
            ref("evidence_sealing_decision", "missing"),
            "Evidence sealing decision",
            "missing",
            "not_counted"
          )
    };
  }

  private async evaluationComparisonSetForRun(
    evaluationRunRecordId: string
  ): Promise<EvaluationComparisonSetRecord> {
    const comparisonSet = await this.findEvaluationComparisonSetForRun(evaluationRunRecordId);
    if (!comparisonSet) {
      throw new Error(`evaluation comparison set missing for evaluation run ${evaluationRunRecordId}`);
    }
    return comparisonSet;
  }

  private async findEvaluationComparisonSetForRun(
    evaluationRunRecordId: string
  ): Promise<EvaluationComparisonSetRecord | undefined> {
    const comparisonSets = await this.readCollection<EvaluationComparisonSetRecord>("evaluation-comparison-sets");
    return comparisonSets.find(
      (set) => comparisonSetIncludesRun(set, evaluationRunRecordId)
    );
  }

  private async evidenceSealingDecisionForComparisonSet(
    comparisonSetId: string
  ): Promise<EvidenceSealingDecisionRecord> {
    const sealingDecision = await this.findEvidenceSealingDecisionForComparisonSet(comparisonSetId);
    if (!sealingDecision) {
      throw new Error(`evidence sealing decision missing for evaluation comparison set ${comparisonSetId}`);
    }
    return sealingDecision;
  }

  private async findEvidenceSealingDecisionForComparisonSet(
    comparisonSetId: string
  ): Promise<EvidenceSealingDecisionRecord | undefined> {
    const sealingDecisions = await this.readCollection<EvidenceSealingDecisionRecord>("evidence-sealing-decisions");
    return sealingDecisions
      .filter((decision) => decision.evaluation_comparison_set_ref.id === comparisonSetId)
      .sort(compareEvidenceSealingDecisions)
      .at(-1);
  }

  private async listEvidenceClassificationsForEvaluationRun(
    evaluationRunRecordId: string
  ): Promise<EvidenceClassificationRecord[]> {
    const classifications = await this.readCollection<EvidenceClassificationRecord>("evidence-classifications");
    return classifications
      .filter((classification) => classification.evaluation_run_ref.id === evaluationRunRecordId)
      .sort(compareEvidenceClassifications);
  }

  private async assertSandboxLinks(instance: SandboxRecord): Promise<void> {
    const artifact = await this.readOptionalRecord<SystemCodeRecord>(
      "system-codes",
      instance.system_code_ref.id
    );
    if (!artifact) {
      throw new LocalStoreError(
        "system_code_not_found",
        `system code ${instance.system_code_ref.id} not found`,
        { system_code_id: instance.system_code_ref.id }
      );
    }

    if (instance.runtime_ref) {
      const runtime = await this.readOptionalRecord<TradingRunRecord>(
        "trading-runs",
        instance.runtime_ref.id
      );
      if (!runtime) {
        throw new LocalStoreError(
          "runtime_not_found",
          `runtime ${instance.runtime_ref.id} not found`,
          { runtime_id: instance.runtime_ref.id }
        );
      }
    }
  }

  private async assertArtifactLineageLinks(lineage: ArtifactLineageRecord): Promise<void> {
    await this.assertResearchFindingRefsExist(lineage.source_finding_refs, lineage.artifact_lineage_id);
  }

  private async assertResearchFindingRefsExist(findingRefs: Ref[], ownerId: string): Promise<void> {
    for (const findingRef of findingRefs) {
      const finding = await this.readOptionalRecord<ResearchFindingRecord>("research-findings", findingRef.id);
      if (!finding) {
        throw new LocalStoreError(
          "research_finding_not_found",
          `automated research finding ${findingRef.id} not found`,
          { research_finding_id: findingRef.id, owner_id: ownerId }
        );
      }
    }
  }

  private async writeSandboxObservations(
    input: SandboxObservationInput
  ): Promise<void> {
    const records: FixtureItem[] = [
      ...(input.placement
        ? [{
            collection: "sandbox-placements" as const,
            id: input.placement.sandbox_placement_id,
            record: input.placement
          }]
        : []),
      { collection: "sandboxes", id: input.instance.sandbox_id, record: input.instance },
      ...(input.logs ?? []).map((log) => ({
        collection: "sandbox-logs" as const,
        id: log.sandbox_log_id,
        record: log
      })),
      ...(input.heartbeats ?? []).map((heartbeat) => ({
        collection: "runtime-heartbeats" as const,
        id: heartbeat.runtime_heartbeat_id,
        record: heartbeat
      })),
      ...(input.command_evidence ?? []).map((evidence) => ({
        collection: "sandbox-command-evidence" as const,
        id: evidence.sandbox_command_evidence_id,
        record: evidence
      }))
    ];

    if (input.instance.runtime_ref) {
      const runtime = await this.readOptionalRecord<TradingRunRecord>(
        "trading-runs",
        input.instance.runtime_ref.id
      );
      if (runtime) {
        records.push({
          collection: "trading-runs",
          id: runtime.trading_run_id,
          record: stripUndefined({
            ...runtime,
            runtime_lifecycle_status: runtimeLifecycleForSandboxInstance(input.instance.lifecycle_status),
            placement_ref: input.instance.sandbox_placement_ref,
            system_code_ref: input.instance.system_code_ref,
            sandbox_ref: ref(
              input.instance.record_kind,
              input.instance.sandbox_id
            ),
            created_at: runtime.created_at ?? input.instance.created_at
          } satisfies TradingRunRecord)
        });
      }
    }

    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
  }

  private async buildSandboxDetailReadModel(
    sandboxId: string
  ): Promise<SandboxDetailReadModel> {
    const instance = await this.readRecord<SandboxRecord>(
      "sandboxes",
      sandboxId
    );
    const logs = (await this.readCollection<SandboxLogRecord>("sandbox-logs"))
      .filter((log) => log.sandbox_ref?.id === sandboxId)
      .sort(compareSandboxLogs)
      .map(toSandboxLogReadModel);
    const heartbeats = (await this.readCollection<RuntimeHeartbeatRecord>("runtime-heartbeats"))
      .filter((heartbeat) => heartbeat.sandbox_ref?.id === sandboxId)
      .sort(compareRuntimeHeartbeats)
      .map(toSandboxHeartbeatReadModel);
    const commandEvidence = (await this.readCollection<SandboxCommandEvidenceRecord>("sandbox-command-evidence"))
      .filter((evidence) => evidence.sandbox_ref?.id === sandboxId)
      .sort(compareSandboxCommandEvidence)
      .map(toSandboxCommandEvidenceReadModel);

    return {
      ...toSandboxReadModel(instance),
      logs,
      heartbeats,
      command_evidence: commandEvidence
    };
  }

  private toCandidateSummary(candidate: TradingSystemCandidateRecord): CandidateSummaryReadModel {
    return {
      candidate_id: candidate.candidate_id,
      display_name: candidate.display_name,
      status: candidate.status,
      active_version_id: candidate.active_version_id,
      fixture_notice: fixtureNotice
    };
  }

  private itemPath(
    collection: Collection,
    id: string,
    itemDir: "items" | "placeholders" | "source-graphs" = "items"
  ): string {
    return path.join(this.storeRoot, collection, itemDir, storeJsonFileName(id));
  }

  private collectionIndexPath(collection: Collection): string {
    return path.join(this.storeRoot, collection, "index.json");
  }

  private async readRecord<T>(
    collection: Collection,
    id: string,
    itemDir: "items" | "placeholders" | "source-graphs" = "items"
  ): Promise<T> {
    return this.readJson<T>(this.itemPath(collection, id, itemDir));
  }

  private async readOptionalRecord<T>(
    collection: Collection,
    id: string,
    itemDir: "items" | "placeholders" | "source-graphs" = "items"
  ): Promise<T | undefined> {
    try {
      return await this.readRecord<T>(collection, id, itemDir);
    } catch (error) {
      if (isMissingFileError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  private researchMemoryControlPublicationLockPaths(): {
    root: string;
    active: string;
    activeOwner: string;
    transition: string;
    transitionOwner: string;
  } {
    const root = path.join(
      this.storeRoot,
      ".locks",
      "research-memory-control-publication"
    );
    const active = path.join(root, "active");
    const transition = path.join(root, "transition");
    return {
      root,
      active,
      activeOwner: path.join(active, "owner.json"),
      transition,
      transitionOwner: path.join(transition, "owner.json")
    };
  }

  private async acquireResearchMemoryControlPublicationLock(): Promise<
    ResearchMemoryControlPublicationLockOwner
  > {
    const paths = this.researchMemoryControlPublicationLockPaths();
    const owner: ResearchMemoryControlPublicationLockOwner = {
      token: randomUUID(),
      pid: process.pid,
      acquired_at: new Date().toISOString()
    };
    await mkdir(paths.root, { recursive: true });
    await this.cleanupResearchMemoryControlPublicationRetirements(paths);
    const claim = path.join(paths.root, `claim-${owner.token}`);
    const claimOwner = path.join(claim, "owner.json");
    await mkdir(claim);
    await writeFile(
      claimOwner,
      `${JSON.stringify(owner, null, 2)}\n`,
      "utf8"
    );
    try {
      for (let attempt = 0;
        attempt < RESEARCH_MEMORY_CONTROL_PUBLICATION_LOCK_ATTEMPTS;
        attempt += 1) {
        await this.recoverResearchMemoryControlPublicationTransition(paths);
        try {
          await rename(claim, paths.active);
          return owner;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== "EEXIST" && code !== "ENOTEMPTY") throw error;
        }
        const current = await this
          .readResearchMemoryControlPublicationLockOwner(paths.activeOwner);
        if (!current) {
          if (!await pathExists(paths.active)) continue;
          throw new LocalStoreError(
            "research_memory_control_publication_lock_corrupt",
            "Research memory-control publication lock has no complete owner"
          );
        }
        if (researchMemoryControlPublicationOwnerIsAlive(current)) {
          await waitForResearchMemoryControlPublicationLock();
          continue;
        }
        await this.transitionStaleResearchMemoryControlPublicationLock(
          paths,
          current
        );
      }
      throw new LocalStoreError(
        "research_memory_control_publication_lock_unavailable",
        "Research memory-control publication lock did not become available"
      );
    } finally {
      await rm(claim, { recursive: true, force: true });
    }
  }

  private async releaseResearchMemoryControlPublicationLock(
    owner: ResearchMemoryControlPublicationLockOwner
  ): Promise<void> {
    const paths = this.researchMemoryControlPublicationLockPaths();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const current = await this.readResearchMemoryControlPublicationLockOwner(
        paths.activeOwner
      );
      if (current) {
        if (!sameResearchMemoryControlPublicationLockOwner(current, owner)) {
          throw new LocalStoreError(
            "research_memory_control_publication_lock_corrupt",
            "Research memory-control publication lock ownership changed"
          );
        }
        const retiring = path.join(paths.root, `retiring-${owner.token}`);
        const retiringOwner = path.join(retiring, "owner.json");
        try {
          await rename(paths.active, retiring);
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === "ENOENT") {
            await waitForResearchMemoryControlPublicationLock();
            continue;
          }
          if (code === "EEXIST" || code === "ENOTEMPTY") {
            throw new LocalStoreError(
              "research_memory_control_publication_lock_corrupt",
              "Research memory-control retirement identity already exists",
              { cause: error }
            );
          }
          throw error;
        }
        const retiredOwner = await this
          .readResearchMemoryControlPublicationLockOwner(retiringOwner);
        if (!retiredOwner || !sameResearchMemoryControlPublicationLockOwner(
          retiredOwner,
          owner
        )) {
          throw new LocalStoreError(
            "research_memory_control_publication_lock_corrupt",
            "Research memory-control retirement changed ownership"
          );
        }
        await rm(retiring, { recursive: true, force: true });
        return;
      }
      const transitioning = await this
        .readResearchMemoryControlPublicationLockOwner(paths.transitionOwner);
      if (transitioning && sameResearchMemoryControlPublicationLockOwner(
        transitioning,
        owner
      )) {
        await this.restoreResearchMemoryControlPublicationTransition(paths);
        continue;
      }
      await waitForResearchMemoryControlPublicationLock();
    }
    throw new LocalStoreError(
      "research_memory_control_publication_lock_corrupt",
      "Research memory-control publication lock disappeared before release"
    );
  }

  private async cleanupResearchMemoryControlPublicationRetirements(
    paths: ReturnType<LocalStore["researchMemoryControlPublicationLockPaths"]>
  ): Promise<void> {
    const entries = await readdir(paths.root);
    for (const entry of entries.filter((value) =>
      value.startsWith("retiring-")
    )) {
      const retiring = path.join(paths.root, entry);
      const owner = await this.readResearchMemoryControlPublicationLockOwner(
        path.join(retiring, "owner.json")
      );
      if (!owner || !researchMemoryControlPublicationOwnerIsAlive(owner)) {
        await rm(retiring, { recursive: true, force: true });
      }
    }
  }

  private async transitionStaleResearchMemoryControlPublicationLock(
    paths: ReturnType<LocalStore["researchMemoryControlPublicationLockPaths"]>,
    expected: ResearchMemoryControlPublicationLockOwner
  ): Promise<void> {
    try {
      await rename(paths.active, paths.transition);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "EEXIST" || code === "ENOTEMPTY") {
        return;
      }
      throw error;
    }
    const moved = await this.readResearchMemoryControlPublicationLockOwner(
      paths.transitionOwner
    );
    const expectedMoved = moved !== undefined &&
      sameResearchMemoryControlPublicationLockOwner(moved, expected);
    if (!expectedMoved || (moved &&
      researchMemoryControlPublicationOwnerIsAlive(moved))) {
      await this.restoreResearchMemoryControlPublicationTransition(paths);
      return;
    }
    await rm(paths.transition, { recursive: true, force: true });
  }

  private async recoverResearchMemoryControlPublicationTransition(
    paths: ReturnType<LocalStore["researchMemoryControlPublicationLockPaths"]>
  ): Promise<void> {
    if (!await pathExists(paths.transition)) return;
    const owner = await this.readResearchMemoryControlPublicationLockOwner(
      paths.transitionOwner
    );
    if (!owner) {
      if (!await pathExists(paths.transition)) return;
      throw new LocalStoreError(
        "research_memory_control_publication_lock_corrupt",
        "Research memory-control publication transition has no complete owner"
      );
    }
    if (researchMemoryControlPublicationOwnerIsAlive(owner)) {
      await this.restoreResearchMemoryControlPublicationTransition(paths);
      return;
    }
    await rm(paths.transition, { recursive: true, force: true });
  }

  private async restoreResearchMemoryControlPublicationTransition(
    paths: ReturnType<LocalStore["researchMemoryControlPublicationLockPaths"]>
  ): Promise<void> {
    try {
      await rename(paths.transition, paths.active);
    } catch (error) {
      if (isMissingFileError(error)) return;
      throw new LocalStoreError(
        "research_memory_control_publication_lock_corrupt",
        "Research memory-control publication transition could not be restored",
        { cause: error }
      );
    }
  }

  private async readResearchMemoryControlPublicationLockOwner(
    ownerPath: string
  ): Promise<ResearchMemoryControlPublicationLockOwner | undefined> {
    let value: unknown;
    try {
      value = JSON.parse(await readFile(ownerPath, "utf8"));
    } catch (error) {
      if (isMissingFileError(error) || error instanceof SyntaxError) {
        return undefined;
      }
      throw error;
    }
    if (!isPlainObject(value) || typeof value.token !== "string" ||
      !value.token || !Number.isSafeInteger(value.pid) ||
      Number(value.pid) <= 0 || !isIsoTimestamp(value.acquired_at)) {
      throw new LocalStoreError(
        "research_memory_control_publication_lock_corrupt",
        "Research memory-control publication lock owner is corrupt"
      );
    }
    return value as unknown as ResearchMemoryControlPublicationLockOwner;
  }

  private async readCollection<T>(
    collection: Collection,
    itemDir: "items" | "placeholders" | "source-graphs" = "items"
  ): Promise<T[]> {
    const dir = path.join(this.storeRoot, collection, itemDir);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
    const jsonFiles = entries.filter((entry) => entry.endsWith(".json")).sort();
    return Promise.all(jsonFiles.map((entry) => this.readJson<T>(path.join(dir, entry))));
  }

  private async readJson<T>(filePath: string): Promise<T> {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    // LocalStore writes validated records to encoded paths under storeRoot.
    // codeql[js/http-to-file-access]
    await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tmpPath, filePath);
  }

  private async writeJsonCreateOnly(
    filePath: string,
    value: unknown
  ): Promise<"created" | "exists"> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    // LocalStore writes validated records to encoded paths under storeRoot.
    // codeql[js/http-to-file-access]
    await writeFile(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8"
    );
    try {
      await link(temporaryPath, filePath);
      return "created";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        return "exists";
      }
      throw error;
    } finally {
      try {
        await unlink(temporaryPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
}

function placeholder(
  refValue: Ref,
  label: string,
  record: object
): PlaceholderSummary {
  const fields = record as { status?: unknown; authority_status?: unknown };
  return {
    ref: refValue,
    label,
    status: String(fields.status ?? "fixture_placeholder"),
    authority_status: String(fields.authority_status ?? "not_executed")
  };
}

function statusPlaceholder(
  refValue: Ref,
  label: string,
  status: string,
  authorityStatus: string
): PlaceholderSummary {
  return {
    ref: refValue,
    label,
    status,
    authority_status: authorityStatus
  };
}

function emptyCandidateEvaluationReadModel(
  evaluationRunRef?: Ref
): CandidateEvaluationReadModel {
  return {
    has_runs: false,
    latest_run: null,
    latest_comparison_set: null,
    latest_sealing_decision: null,
    trace: {
      state: "none",
      trace_ref: null,
      authority_status: "not_counted",
      provider_output_artifact_refs: [],
      debug_artifact_refs: []
    },
    evidence_classifications: [],
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "no_evaluation_runs",
      authority_status: "not_counted"
    },
    error_state: null,
    run: statusPlaceholder(
      evaluationRunRef ?? ref("evaluation_run_record", "none"),
      "Evaluation run",
      "not_evaluated",
      "not_counted"
    ),
    comparison_set: statusPlaceholder(
      ref("evaluation_comparison_set", "none"),
      "Evaluation comparison set",
      "not_evaluated",
      "not_counted"
    ),
    sealing_decision: statusPlaceholder(
      ref("evidence_sealing_decision", "none"),
      "Evidence sealing decision",
      "not_counted",
      "not_counted"
    )
  };
}

function emptyLedgerSourceRecordsReadModel(): LedgerSourceRecordsReadModel {
  return {
    has_activity: false,
    chain_complete: false,
    chain_count: 0,
    chains: [],
    latest_order_request: null,
    latest_gateway_result: null,
    latest_execution_result: null,
    order_request: statusPlaceholder(
      ref("order_request", "none"),
      "Order request",
      "not_submitted",
      "not_submitted"
    ),
    gateway_result: statusPlaceholder(
      ref("gateway_result", "none"),
      "Gateway result",
      "not_evaluated",
      "not_live"
    ),
    execution_result: statusPlaceholder(
      ref("execution_result", "none"),
      "Execution result",
      "not_submitted",
      "not_submitted"
    )
  };
}

function ledgerSourceChainForOrderRequest(input: {
  orderRequest: OrderRequestRecord;
  gatewayResults: GatewayResultRecord[];
  executionResults: ExecutionResultRecord[];
}): LedgerSourceChainReadModel {
  const gatewayResult = input.gatewayResults
    .filter((candidate) => candidate.order_request_ref.id === input.orderRequest.order_request_id)
    .sort(compareGatewayResults)
    .at(-1);
  const executionResult = gatewayResult
    ? input.executionResults
        .filter((candidate) => candidate.gateway_result_ref.id === gatewayResult.gateway_result_id)
        .sort(compareExecutionResults)
        .at(-1)
    : undefined;
  return {
    chain_id: input.orderRequest.order_request_id,
    chain_complete: Boolean(gatewayResult && executionResult),
    occurred_at: executionResult?.completed_at
      ?? executionResult?.created_at
      ?? gatewayResult?.decided_at
      ?? input.orderRequest.created_at,
    order_request: toLedgerSourceOrderRequestReadModel(input.orderRequest),
    gateway_result: gatewayResult
      ? toLedgerSourceGatewayResultReadModel(gatewayResult)
      : null,
    execution_result: executionResult
      ? toLedgerSourceExecutionResultReadModel(executionResult)
      : null,
    authority_status: "not_live"
  };
}

function compareLedgerSourceChains(
  a: LedgerSourceChainReadModel,
  b: LedgerSourceChainReadModel
): number {
  const timeCompare = a.order_request.created_at.localeCompare(b.order_request.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.chain_id.localeCompare(b.chain_id);
}

function emptyRunControlReadModel(): RunControlReadModel {
  return {
    has_activity: false,
    chain_complete: false,
    latest_command: null,
    latest_decision: null,
    latest_audit_event: null,
    command: statusPlaceholder(
      ref("run_control_command", "none"),
      "Runtime control command",
      "pending_decision",
      "not_live"
    ),
    decision: statusPlaceholder(
      ref("run_control_decision", "none"),
      "Runtime control decision",
      "not_evaluated",
      "not_live"
    ),
    audit_event: statusPlaceholder(
      ref("runtime_audit_event", "none"),
      "Runtime audit event",
      "not_recorded",
      "not_live"
    )
  };
}

function toLedgerSourceOrderRequestReadModel(orderIntent: OrderRequestRecord) {
  return {
    order_request_id: orderIntent.order_request_id,
    intent_kind: orderIntent.intent_kind,
    market_scope: orderIntent.market_scope,
    side: orderIntent.side,
    order_type: orderIntent.order_type,
    quantity: orderIntent.quantity,
    limit_price: orderIntent.limit_price,
    status: orderIntent.status,
    created_at: orderIntent.created_at,
    authority_status: orderIntent.authority_status
  };
}

function toLedgerSourceGatewayResultReadModel(gatewayDecision: GatewayResultRecord) {
  return {
    gateway_result_id: gatewayDecision.gateway_result_id,
    order_request_ref: gatewayDecision.order_request_ref,
    decision_outcome: gatewayDecision.decision_outcome,
    decision_reason: gatewayDecision.decision_reason,
    decided_at: gatewayDecision.decided_at,
    authority_status: gatewayDecision.authority_status
  };
}

function toLedgerSourceExecutionResultReadModel(executionAttempt: ExecutionResultRecord) {
  return {
    execution_result_id: executionAttempt.execution_result_id,
    order_request_ref: executionAttempt.order_request_ref,
    gateway_result_ref: executionAttempt.gateway_result_ref,
    stage: executionAttempt.stage,
    execution_mode: executionAttempt.execution_mode,
    venue_scope: executionAttempt.venue_scope,
    status: executionAttempt.status,
    result_reason: executionAttempt.result_reason,
    created_at: executionAttempt.created_at,
    completed_at: executionAttempt.completed_at,
    authority_status: executionAttempt.authority_status
  };
}

function toRunControlCommandReadModel(command: RunControlCommandRecord) {
  return {
    command_id: command.run_control_command_id,
    action: command.action,
    requested_lifecycle_status: command.requested_lifecycle_status,
    actor_kind: command.actor_kind,
    actor_ref: command.actor_ref,
    reason: command.reason,
    requested_at: command.requested_at,
    status: command.status,
    authority_status: command.authority_status
  };
}

function toRunControlDecisionReadModel(decision: RunControlDecisionRecord) {
  return {
    decision_id: decision.run_control_decision_id,
    command_ref: decision.command_ref,
    decision_outcome: decision.decision_outcome,
    decision_reason: decision.decision_reason,
    decided_by_actor_kind: decision.decided_by_actor_kind,
    decided_by_actor_ref: decision.decided_by_actor_ref,
    resulting_lifecycle_status: decision.resulting_lifecycle_status,
    decided_at: decision.decided_at,
    authority_status: decision.authority_status
  };
}

function toRunControlAuditEventReadModel(auditEvent: RuntimeAuditEventRecord) {
  return {
    audit_event_id: auditEvent.runtime_audit_event_id,
    event_kind: auditEvent.event_kind,
    command_ref: auditEvent.command_ref,
    decision_ref: auditEvent.decision_ref,
    actor_kind: auditEvent.actor_kind,
    actor_ref: auditEvent.actor_ref,
    runtime_lifecycle_status: auditEvent.runtime_lifecycle_status,
    message: auditEvent.message,
    created_at: auditEvent.created_at,
    authority_status: auditEvent.authority_status
  };
}

function candidateEvaluationErrorState(
  evaluationRun: EvaluationRunRecord,
  linkedRecordsComplete: boolean
): CandidateEvaluationErrorState | null {
  if (evaluationRun.status === "failed") {
    return {
      code: "evaluation_failed",
      message: "evaluation run failed"
    };
  }
  if (!linkedRecordsComplete) {
    return {
      code: "evaluation_links_incomplete",
      message: "evaluation run has incomplete linked records"
    };
  }
  return null;
}

function toSandboxReadModel(
  instance: SandboxRecord
): SandboxReadModel {
  return {
    sandbox_id: instance.sandbox_id,
    adapter_kind: instance.adapter_kind,
    system_code_ref: instance.system_code_ref,
    runtime_ref: instance.runtime_ref,
    sandbox_placement_ref: instance.sandbox_placement_ref,
    lifecycle_status: instance.lifecycle_status,
    sandbox_name: instance.sandbox_name,
    sandbox_ref: instance.sandbox_ref,
    created_at: instance.created_at,
    started_at: instance.started_at,
    last_heartbeat_at: instance.last_heartbeat_at,
    stopped_at: instance.stopped_at,
    removed_at: instance.removed_at,
    log_refs: instance.log_refs,
    heartbeat_refs: instance.heartbeat_refs,
    command_evidence_refs: instance.command_evidence_refs ?? [],
    trace_ref: instance.trace_ref,
    authority_status: instance.authority_status
  };
}

function toSandboxLogReadModel(log: SandboxLogRecord): SandboxLogReadModel {
  return {
    log_ref: ref(log.record_kind, log.sandbox_log_id),
    lines: log.lines,
    captured_at: log.captured_at,
    authority_status: log.authority_status
  };
}

function toSandboxHeartbeatReadModel(
  heartbeat: RuntimeHeartbeatRecord
): SandboxHeartbeatReadModel {
  return {
    heartbeat_ref: ref(heartbeat.record_kind, heartbeat.runtime_heartbeat_id),
    heartbeat_line: heartbeat.heartbeat_line,
    observed_at: heartbeat.observed_at,
    authority_status: heartbeat.authority_status
  };
}

function toSandboxCommandEvidenceReadModel(
  evidence: SandboxCommandEvidenceRecord
): SandboxCommandEvidenceReadModel {
  return {
    command_evidence_ref: ref(evidence.record_kind, evidence.sandbox_command_evidence_id),
    command: evidence.command,
    exit_code: evidence.exit_code,
    stdout: evidence.stdout,
    stderr: evidence.stderr,
    started_at: evidence.started_at,
    completed_at: evidence.completed_at,
    authority_status: evidence.authority_status
  };
}

function refsForLogs(logs: SandboxLogRecord[] | undefined): Ref[] {
  return (logs ?? []).map((log) => ref(log.record_kind, log.sandbox_log_id));
}

function refsForHeartbeats(heartbeats: RuntimeHeartbeatRecord[] | undefined): Ref[] {
  return (heartbeats ?? []).map((heartbeat) => ref(heartbeat.record_kind, heartbeat.runtime_heartbeat_id));
}

function refsForCommandEvidence(evidence: SandboxCommandEvidenceRecord[] | undefined): Ref[] {
  return (evidence ?? []).map((item) => ref(item.record_kind, item.sandbox_command_evidence_id));
}

function latestObservedAt(heartbeats: RuntimeHeartbeatRecord[] | undefined): string | undefined {
  return (heartbeats ?? [])
    .map((heartbeat) => heartbeat.observed_at)
    .sort()
    .at(-1);
}

function runtimeLifecycleForSandboxInstance(
  lifecycleStatus: SandboxRecord["lifecycle_status"]
): TradingRunLifecycleStatus {
  switch (lifecycleStatus) {
    case "starting":
      return "starting";
    case "running":
      return "running";
    case "stopping":
      return "stopping";
    case "stopped":
    case "removed":
      return "stopped";
    case "failed":
      return "failed";
    case "requested":
    case "created":
      return "registered";
  }
}

function compareSandboxReadModels(
  a: SandboxReadModel,
  b: SandboxReadModel
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  return timeCompare === 0 ? a.sandbox_id.localeCompare(b.sandbox_id) : timeCompare;
}

function compareSandboxLogs(a: SandboxLogRecord, b: SandboxLogRecord): number {
  const timeCompare = a.captured_at.localeCompare(b.captured_at);
  return timeCompare === 0
    ? a.sandbox_log_id.localeCompare(b.sandbox_log_id)
    : timeCompare;
}

function compareRuntimeHeartbeats(a: RuntimeHeartbeatRecord, b: RuntimeHeartbeatRecord): number {
  const timeCompare = a.observed_at.localeCompare(b.observed_at);
  return timeCompare === 0
    ? a.runtime_heartbeat_id.localeCompare(b.runtime_heartbeat_id)
    : timeCompare;
}

function compareSandboxCommandEvidence(
  a: SandboxCommandEvidenceRecord,
  b: SandboxCommandEvidenceRecord
): number {
  const timeCompare = a.started_at.localeCompare(b.started_at);
  return timeCompare === 0
    ? a.sandbox_command_evidence_id.localeCompare(b.sandbox_command_evidence_id)
    : timeCompare;
}

function compareEvaluationRuns(a: EvaluationRunRecord, b: EvaluationRunRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.evaluation_run_record_id.localeCompare(b.evaluation_run_record_id);
}

function compareEvidenceSealingDecisions(
  a: EvidenceSealingDecisionRecord,
  b: EvidenceSealingDecisionRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.evidence_sealing_decision_id.localeCompare(b.evidence_sealing_decision_id);
}

function compareEvidenceClassifications(
  a: EvidenceClassificationRecord,
  b: EvidenceClassificationRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.evidence_classification_id.localeCompare(b.evidence_classification_id);
}

function compareOrderRequests(a: OrderRequestRecord, b: OrderRequestRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.order_request_id.localeCompare(b.order_request_id);
}

function compareGatewayResults(a: GatewayResultRecord, b: GatewayResultRecord): number {
  const timeCompare = a.decided_at.localeCompare(b.decided_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.gateway_result_id.localeCompare(b.gateway_result_id);
}

function compareExecutionResults(a: ExecutionResultRecord, b: ExecutionResultRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.execution_result_id.localeCompare(b.execution_result_id);
}

function compareRunControlCommands(
  a: RunControlCommandRecord,
  b: RunControlCommandRecord
): number {
  const timeCompare = a.requested_at.localeCompare(b.requested_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.run_control_command_id.localeCompare(b.run_control_command_id);
}

function compareRunControlDecisions(
  a: RunControlDecisionRecord,
  b: RunControlDecisionRecord
): number {
  const timeCompare = a.decided_at.localeCompare(b.decided_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.run_control_decision_id.localeCompare(b.run_control_decision_id);
}

function compareRuntimeAuditEvents(
  a: RuntimeAuditEventRecord,
  b: RuntimeAuditEventRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.runtime_audit_event_id.localeCompare(b.runtime_audit_event_id);
}

function compareTradingRunTranscriptItems(
  a: TradingRunTranscriptItemReadModel,
  b: TradingRunTranscriptItemReadModel
): number {
  const timeCompare = a.occurred_at.localeCompare(b.occurred_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  const kindCompare = transcriptItemKindOrder(a) - transcriptItemKindOrder(b);
  if (kindCompare !== 0) {
    return kindCompare;
  }
  return a.item_id.localeCompare(b.item_id);
}

function transcriptItemKindOrder(item: TradingRunTranscriptItemReadModel): number {
  const order: Record<TradingRunTranscriptItemReadModel["item_kind"], number> = {
    run_control_command: 10,
    run_control_decision: 20,
    run_control_audit: 30,
    sandbox_lifecycle: 40,
    sandbox_heartbeat: 50,
    sandbox_log: 60,
    sandbox_order_request: 70,
    order_request: 80,
    gateway_result: 90,
    execution_result: 100
  };
  return order[item.item_kind];
}

interface SandboxOrderRequestEvent {
  index: number;
  symbol?: string;
  side?: string;
  order_type?: string;
  quantity?: string;
  limit_price?: string;
  at?: string;
}

function sandboxOrderRequestEvents(
  log: SandboxDetailReadModel["logs"][number]
): SandboxOrderRequestEvent[] {
  return log.lines.flatMap((line, index) => {
    const event = parseSandboxOrderRequestEvent(line);
    if (!event) {
      return [];
    }
    return [{ ...event, index: index + 1 }];
  });
}

function parseSandboxOrderRequestEvent(line: string): Omit<SandboxOrderRequestEvent, "index"> | undefined {
  try {
    const value = JSON.parse(line) as Record<string, unknown>;
    if (value.event !== "order_request") {
      return undefined;
    }
    return {
      symbol: typeof value.symbol === "string" ? value.symbol : undefined,
      side: typeof value.side === "string" ? value.side : undefined,
      order_type: typeof value.order_type === "string" ? value.order_type : undefined,
      quantity: typeof value.quantity === "string" ? value.quantity : undefined,
      limit_price: typeof value.limit_price === "string" ? value.limit_price : undefined,
      at: typeof value.at === "string" ? value.at : undefined
    };
  } catch {
    return undefined;
  }
}

function compareResearchFindings(a: ResearchFindingRecord, b: ResearchFindingRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.research_finding_id.localeCompare(b.research_finding_id);
}

function compareCandidateAdmissionDecisions(
  a: CandidateAdmissionDecisionRecord,
  b: CandidateAdmissionDecisionRecord
): number {
  const timeCompare = a.decided_at.localeCompare(b.decided_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.candidate_admission_decision_id.localeCompare(
    b.candidate_admission_decision_id
  );
}

function comparePaperTradingHandoffConformances(
  left: PaperTradingHandoffConformanceRecord,
  right: PaperTradingHandoffConformanceRecord
): number {
  return right.completed_at.localeCompare(left.completed_at) ||
    right.paper_trading_handoff_conformance_id.localeCompare(
      left.paper_trading_handoff_conformance_id
    );
}

function compareCandidateArenaTicks(a: CandidateArenaTickRecord, b: CandidateArenaTickRecord): number {
  const timeCompare = b.completed_at.localeCompare(a.completed_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return b.candidate_arena_tick_id.localeCompare(a.candidate_arena_tick_id);
}

function compareCandidateArenaResearchAllocations(
  left: CandidateArenaResearchAllocationRecord,
  right: CandidateArenaResearchAllocationRecord
): number {
  return right.allocated_at.localeCompare(left.allocated_at) ||
    right.candidate_arena_research_allocation_id.localeCompare(
      left.candidate_arena_research_allocation_id
    );
}

function compareResearchDirections(
  left: ResearchDirectionRecord,
  right: ResearchDirectionRecord
): number {
  return right.created_at.localeCompare(left.created_at) ||
    right.research_direction_id.localeCompare(left.research_direction_id);
}

function compareResearchWorkers(
  left: ResearchWorkerRecord,
  right: ResearchWorkerRecord
): number {
  return right.created_at.localeCompare(left.created_at) ||
    right.research_worker_id.localeCompare(left.research_worker_id);
}

function compareResearchPreflightCommitments(
  left: ResearchPreflightCommitmentRecord,
  right: ResearchPreflightCommitmentRecord
): number {
  return right.committed_at.localeCompare(left.committed_at) ||
    right.research_preflight_commitment_id.localeCompare(
      left.research_preflight_commitment_id
    );
}

function compareResearchWorkerCheckpoints(
  left: ResearchWorkerCheckpointRecord,
  right: ResearchWorkerCheckpointRecord
): number {
  return right.closed_at.localeCompare(left.closed_at) ||
    right.research_worker_checkpoint_id.localeCompare(
      left.research_worker_checkpoint_id
    );
}

function compareResearchBehaviorFingerprints(
  left: ResearchBehaviorFingerprintRecord,
  right: ResearchBehaviorFingerprintRecord
): number {
  return right.created_at.localeCompare(left.created_at) ||
    right.research_behavior_fingerprint_id.localeCompare(
      left.research_behavior_fingerprint_id
    );
}

function compareArtifactLineages(
  a: ArtifactLineageRecord,
  b: ArtifactLineageRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.artifact_lineage_id.localeCompare(b.artifact_lineage_id);
}

function compareImprovementProposals(
  a: ImprovementProposalRecord,
  b: ImprovementProposalRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.improvement_proposal_id.localeCompare(b.improvement_proposal_id);
}

function compareResearchOrchestrationRuns(
  a: ResearchOrchestrationRunRecord,
  b: ResearchOrchestrationRunRecord
): number {
  const timeCompare = a.started_at.localeCompare(b.started_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.research_orchestration_run_id.localeCompare(b.research_orchestration_run_id);
}

function compareExperimentRuns(a: ExperimentRunRecord, b: ExperimentRunRecord): number {
  const timeCompare = a.submitted_at.localeCompare(b.submitted_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.experiment_run_id.localeCompare(b.experiment_run_id);
}

function compareTradingEvaluationResults(
  a: TradingEvaluationResultRecord,
  b: TradingEvaluationResultRecord
): number {
  const timeCompare = a.completed_at.localeCompare(b.completed_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.trading_evaluation_result_id.localeCompare(b.trading_evaluation_result_id);
}

function compareImprovementProposalMaterializationAttempts(
  a: ImprovementProposalMaterializationAttemptRecord,
  b: ImprovementProposalMaterializationAttemptRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.improvement_proposal_materialization_attempt_id.localeCompare(
    b.improvement_proposal_materialization_attempt_id
  );
}

function comparisonSetIncludesRun(
  comparisonSet: EvaluationComparisonSetRecord,
  evaluationRunRecordId: string
): boolean {
  return evaluationRunRefsForComparisonSet(comparisonSet).some(
    (runRef) => runRef.id === evaluationRunRecordId
  );
}

function evaluationRunRefsForComparisonSet(
  comparisonSet: EvaluationComparisonSetRecord
): Ref[] {
  return comparisonSet.evaluation_run_refs ?? [];
}

function defaultEvidenceClassificationRecords(input: {
  candidateRef: Ref;
  candidateVersionRef: Ref;
  evaluationRunRef: Ref;
  traceRef: Ref;
  sealingDecisionRef: Ref;
  reason: EvidenceDispositionReason;
  createdAt: string;
}): EvidenceClassificationRecord[] {
  return [
    evidenceClassificationRecord({
      ...input,
      classifiedRef: input.traceRef,
      classificationKind: "trace_debug_material",
      classificationStatus: "trace_only",
      authorityStatus: "not_counted"
    }),
    evidenceClassificationRecord({
      ...input,
      classifiedRef: input.evaluationRunRef,
      classificationKind: "candidate_evidence",
      classificationStatus: "candidate",
      authorityStatus: "not_counted"
    }),
    evidenceClassificationRecord({
      ...input,
      classifiedRef: input.evaluationRunRef,
      classificationKind: "non_counted_evidence",
      classificationStatus: "not_counted",
      sealedByDecisionRef: input.sealingDecisionRef,
      authorityStatus: "not_counted"
    }),
    evidenceClassificationRecord({
      ...input,
      classifiedRef: input.sealingDecisionRef,
      classificationKind: "sealed_decision",
      classificationStatus: "sealed",
      sealedByDecisionRef: input.sealingDecisionRef,
      authorityStatus: "not_counted"
    })
  ];
}

function sealedEvidenceClassificationRecords(input: {
  candidateRef: Ref;
  candidateVersionRef: Ref;
  evaluationRunRef: Ref;
  sealingDecisionRef: Ref;
  evidenceDisposition: EvidenceDisposition;
  reason: EvidenceDispositionReason;
  classifiedRefs: Ref[];
  createdAt: string;
}): EvidenceClassificationRecord[] {
  const classificationKind = evidenceClassificationKindForDisposition(input.evidenceDisposition);
  const classificationStatus = evidenceClassificationStatusForDisposition(input.evidenceDisposition);
  const authorityStatus = input.evidenceDisposition === "counted" ? "counted" : "not_counted";
  const evidenceClassifications = input.classifiedRefs.map((classifiedRef) => (
    evidenceClassificationRecord({
      candidateRef: input.candidateRef,
      candidateVersionRef: input.candidateVersionRef,
      evaluationRunRef: input.evaluationRunRef,
      sealingDecisionRef: input.sealingDecisionRef,
      classifiedRef,
      classificationKind,
      classificationStatus,
      reason: input.reason,
      createdAt: input.createdAt,
      sealedByDecisionRef: input.sealingDecisionRef,
      authorityStatus
    })
  ));

  return [
    ...evidenceClassifications,
    evidenceClassificationRecord({
      candidateRef: input.candidateRef,
      candidateVersionRef: input.candidateVersionRef,
      evaluationRunRef: input.evaluationRunRef,
      sealingDecisionRef: input.sealingDecisionRef,
      classifiedRef: input.sealingDecisionRef,
      classificationKind: "sealed_decision",
      classificationStatus: "sealed",
      reason: input.reason,
      createdAt: input.createdAt,
      sealedByDecisionRef: input.sealingDecisionRef,
      authorityStatus
    })
  ];
}

function evidenceClassificationRecord(input: {
  candidateRef: Ref;
  candidateVersionRef: Ref;
  evaluationRunRef: Ref;
  sealingDecisionRef: Ref;
  classifiedRef: Ref;
  classificationKind: EvidenceClassificationKind;
  classificationStatus: EvidenceClassificationStatus;
  reason: EvidenceDispositionReason;
  createdAt: string;
  sealedByDecisionRef?: Ref;
  authorityStatus: "not_counted" | "counted";
}): EvidenceClassificationRecord {
  return stripUndefined({
    record_kind: "evidence_classification",
    version: 1,
    evidence_classification_id: evidenceClassificationRecordId({
      evaluation_run_record_id: input.evaluationRunRef.id,
      classification_kind: input.classificationKind,
      classified_ref: input.classifiedRef,
      reason: input.reason,
      sealing_decision_id: input.sealingDecisionRef.id
    }),
    candidate_ref: input.candidateRef,
    candidate_version_ref: input.candidateVersionRef,
    evaluation_run_ref: input.evaluationRunRef,
    classified_ref: input.classifiedRef,
    classification_kind: input.classificationKind,
    classification_status: input.classificationStatus,
    classification_reason: input.reason,
    created_at: input.createdAt,
    sealed_by_decision_ref: input.sealedByDecisionRef,
    authority_status: input.authorityStatus
  } satisfies EvidenceClassificationRecord);
}

function evidenceClassificationKindForDisposition(
  disposition: EvidenceDisposition
): EvidenceClassificationKind {
  if (disposition === "counted") {
    return "counted_evidence";
  }
  if (disposition === "quarantined_for_review") {
    return "rejected_evidence";
  }
  return "non_counted_evidence";
}

function evidenceClassificationStatusForDisposition(
  disposition: EvidenceDisposition
): EvidenceClassificationStatus {
  if (disposition === "counted") {
    return "counted";
  }
  if (disposition === "quarantined_for_review") {
    return "rejected";
  }
  return "not_counted";
}

function evidenceSealingDecisionRecord(input: {
  evidenceSealingDecisionId: string;
  comparisonSetRef: Ref;
  evaluationRunRef: Ref;
  evidenceDisposition: EvidenceDisposition;
  dispositionReason: EvidenceDispositionReason;
  createdAt: string;
  sealedAt: string;
}): EvidenceSealingDecisionRecord {
  const base = {
    record_kind: "evidence_sealing_decision" as const,
    version: 1 as const,
    evidence_sealing_decision_id: input.evidenceSealingDecisionId,
    evaluation_comparison_set_ref: input.comparisonSetRef,
    evaluation_run_refs: [input.evaluationRunRef],
    evidence_disposition: input.evidenceDisposition,
    disposition_reason: input.dispositionReason,
    created_at: input.createdAt,
    sealed_at: input.sealedAt
  };
  if (input.evidenceDisposition === "counted") {
    return {
      ...base,
      evidence_disposition: "counted",
      authority_status: "counted"
    };
  }
  return {
    ...base,
    evidence_disposition: input.evidenceDisposition,
    authority_status: "not_counted"
  };
}

function toEvidenceClassificationReadModel(
  classification: EvidenceClassificationRecord
) {
  return {
    classification_id: classification.evidence_classification_id,
    classified_ref: classification.classified_ref,
    classification_kind: classification.classification_kind,
    classification_status: classification.classification_status,
    classification_reason: classification.classification_reason,
    authority_status: classification.authority_status,
    sealed_by_decision_ref: classification.sealed_by_decision_ref,
    created_at: classification.created_at
  };
}

function toCandidateMaterializationAttemptReadModel(
  attempt: CandidateMaterializationAttemptRecord
): CandidateMaterializationAttemptReadModel {
  return {
    attempt_id: attempt.candidate_materialization_attempt_id,
    idempotency_key: attempt.idempotency_key,
    provider_kind: attempt.provider_kind,
    model: attempt.model,
    agent_run_ref: attempt.agent_run_ref,
    trace_ref: attempt.trace_ref,
    status: attempt.status,
    validation_status: attempt.validation_status,
    failure_reason: attempt.failure_reason,
    resulting_candidate_ref: attempt.resulting_candidate_ref,
    artifact_refs: attempt.artifact_refs,
    created_at: attempt.created_at,
    authority_label: "provider_output_not_evidence"
  };
}

function buildFullCycleLineageReadModel(input: {
  candidate: TradingSystemCandidateRecord;
  version: CandidateVersionRecord;
  materializationAttempt?: CandidateMaterializationAttemptRecord;
  runtime: TradingRunRecord;
  ledger: LedgerReadModel;
}): CandidateInspectReadModel["full_cycle_lineage"] {
  const persisted = input.materializationAttempt?.full_cycle_lineage;
  if (!persisted) {
    return undefined;
  }

  return {
    handoff_status: "runnable",
    source: persisted.source,
    generated: persisted.generated,
    materialized: {
      trading_system_id: input.candidate.candidate_id,
      candidate_version_id: input.version.candidate_version_id,
      system_code_ref: input.version.system_code_ref ?? input.candidate.active_system_code_ref
    },
    evidence: {
      evaluation_status: persisted.evaluation.status,
      evaluation_score: persisted.evaluation.score,
      ...(persisted.evaluation.profit_loss ? { profit_loss: persisted.evaluation.profit_loss } : {}),
      ...(persisted.evaluation.direction_kind ? { direction_kind: persisted.evaluation.direction_kind } : {}),
      trading_run_id: input.runtime.trading_run_id,
      gateway_result_outcome: input.ledger.latest_gateway_result?.decision_outcome ?? "missing",
      ledger_chain_complete: input.ledger.chain_complete
    }
  };
}

function validateCandidateEvaluationRunInput(
  input: CandidateEvaluationRunInput
): LocalStoreErrorCode | undefined {
  if (!input || typeof input !== "object") {
    return "invalid_evaluation_input";
  }

  const raw = input as CandidateEvaluationRunInput & { stage?: unknown };
  if (!nonEmpty(raw.idempotency_key) || !nonEmpty(raw.candidate_id)) {
    return "invalid_evaluation_input";
  }
  if (raw.candidate_version_id !== undefined && !nonEmpty(raw.candidate_version_id)) {
    return "invalid_evaluation_input";
  }
  if (raw.stage !== undefined && raw.stage !== "backtest") {
    return "unsupported_evaluation_stage";
  }
  if (raw.trace_ref !== undefined && !isRef(raw.trace_ref, "trace_placeholder")) {
    return "invalid_evaluation_input";
  }
  if (raw.evaluator_ref !== undefined && !isRef(raw.evaluator_ref)) {
    return "invalid_evaluation_input";
  }
  if (
    !isOptionalRefArray(raw.input_artifact_refs) ||
    !isOptionalRefArray(raw.provider_output_artifact_refs) ||
    !isOptionalRefArray(raw.debug_artifact_refs)
  ) {
    return "invalid_evaluation_input";
  }

  return undefined;
}

const evidenceDispositionReasons = new Set<EvidenceDispositionReason>([
  "fixture_only",
  "no_external_evaluator",
  "provider_output_trace_only",
  "non_comparable",
  "partial_trace",
  "method_not_authoritative",
  "container_or_sandbox_legitimacy_insufficient",
  "sealed_counted_fixture_only_allowed_by_test",
  "no_evaluation_runs",
  "evaluation_links_incomplete"
]);

function validateEvidenceSealingDecisionInput(
  input: EvidenceSealingDecisionInput
): LocalStoreErrorCode | undefined {
  if (!input || typeof input !== "object") {
    return "invalid_evidence_sealing_input";
  }

  const raw = input as EvidenceSealingDecisionInput & {
    evidence_disposition?: unknown;
    disposition_reason?: unknown;
  };
  if (
    !nonEmpty(raw.idempotency_key) ||
    !nonEmpty(raw.evaluation_run_record_id) ||
    !isEvidenceDisposition(raw.evidence_disposition) ||
    !isEvidenceDispositionReason(raw.disposition_reason)
  ) {
    return "invalid_evidence_sealing_input";
  }
  if (raw.evidence_disposition === "counted" && raw.disposition_reason !== "sealed_counted_fixture_only_allowed_by_test") {
    return "invalid_evidence_sealing_input";
  }
  if (!isOptionalRefArray(raw.classified_refs)) {
    return "invalid_evidence_sealing_input";
  }
  if (raw.sealed_at !== undefined && !nonEmpty(raw.sealed_at)) {
    return "invalid_evidence_sealing_input";
  }
  return undefined;
}

function validateLedgerInput(
  input: LedgerInput
): LocalStoreErrorCode | undefined {
  if (!input || typeof input !== "object") {
    return "invalid_ledger_input";
  }

  const raw = input;
  if (
    !nonEmpty(raw.idempotency_key) ||
    !nonEmpty(raw.candidate_id) ||
    (raw.candidate_version_id !== undefined && !nonEmpty(raw.candidate_version_id)) ||
    (raw.runtime_id !== undefined && !nonEmpty(raw.runtime_id))
  ) {
    return "invalid_ledger_input";
  }
  if (
    !raw.intent ||
    !isOrderRequestKind(raw.intent.intent_kind) ||
    (raw.intent.side !== undefined && raw.intent.side !== "buy" && raw.intent.side !== "sell") ||
    (
      raw.intent.order_type !== undefined &&
      raw.intent.order_type !== "market" &&
      raw.intent.order_type !== "limit"
    ) ||
    (raw.intent.quantity !== undefined && !nonEmpty(raw.intent.quantity)) ||
    (raw.intent.limit_price !== undefined && !nonEmpty(raw.intent.limit_price))
  ) {
    return "invalid_ledger_input";
  }
  if (
    !raw.gateway_result ||
    !isGatewayResultOutcome(raw.gateway_result.decision_outcome) ||
    !isGatewayResultReason(raw.gateway_result.decision_reason) ||
    (
      raw.gateway_result.policy_ref !== undefined &&
      !isRef(raw.gateway_result.policy_ref)
    )
  ) {
    return "invalid_ledger_input";
  }
  if (
    raw.execution_result?.execution_mode !== undefined &&
    !isEvaluationExecutionMode(raw.execution_result.execution_mode)
  ) {
    return "invalid_ledger_input";
  }
  if (
    raw.execution_result?.status !== undefined &&
    !isExecutionResultStatus(raw.execution_result.status)
  ) {
    return "invalid_ledger_input";
  }
  if (
    raw.execution_result?.result_reason !== undefined &&
    !isGatewayResultReason(raw.execution_result.result_reason)
  ) {
    return "invalid_ledger_input";
  }
  if (
    raw.execution_result?.trace_ref !== undefined &&
    !isRef(raw.execution_result.trace_ref, "trace_placeholder")
  ) {
    return "invalid_ledger_input";
  }
  if (
    (raw.execution_result?.completed_at !== undefined && !nonEmpty(raw.execution_result.completed_at)) ||
    (raw.created_at !== undefined && !nonEmpty(raw.created_at))
  ) {
    return "invalid_ledger_input";
  }

  return undefined;
}

function validateRunControlAuditInput(
  input: RunControlAuditInput
): LocalStoreErrorCode | undefined {
  if (!input || typeof input !== "object") {
    return "invalid_run_control_input";
  }

  const raw = input;
  if (
    !nonEmpty(raw.idempotency_key) ||
    !nonEmpty(raw.candidate_id) ||
    (raw.candidate_version_id !== undefined && !nonEmpty(raw.candidate_version_id)) ||
    (raw.runtime_id !== undefined && !nonEmpty(raw.runtime_id)) ||
    (raw.created_at !== undefined && !nonEmpty(raw.created_at))
  ) {
    return "invalid_run_control_input";
  }

  if (
    !raw.command ||
    !isRunControlAction(raw.command.action) ||
    !isRunControlActorKind(raw.command.actor_kind) ||
    !isRunControlCommandReason(raw.command.reason) ||
    (
      raw.command.requested_lifecycle_status !== undefined &&
      !isTradingRunLifecycleStatus(raw.command.requested_lifecycle_status)
    ) ||
    (raw.command.actor_ref !== undefined && !isRef(raw.command.actor_ref)) ||
    (
      raw.command.runtime_operating_policy_ref !== undefined &&
      !isRef(raw.command.runtime_operating_policy_ref, "runtime_operating_policy")
    ) ||
    (raw.command.reason_summary !== undefined && !nonEmpty(raw.command.reason_summary)) ||
    (raw.command.trace_ref !== undefined && !isRef(raw.command.trace_ref, "trace_placeholder")) ||
    !isOptionalRefArray(raw.command.related_order_request_refs) ||
    !isOptionalRefArray(raw.command.related_gateway_result_refs) ||
    !isOptionalRefArray(raw.command.related_execution_result_refs)
  ) {
    return "invalid_run_control_input";
  }

  if (
    !raw.decision ||
    !isRunControlDecisionOutcome(raw.decision.decision_outcome) ||
    !isRunControlDecisionReason(raw.decision.decision_reason) ||
    !isRunControlActorKind(raw.decision.decided_by_actor_kind) ||
    (raw.decision.decided_by_actor_ref !== undefined && !isRef(raw.decision.decided_by_actor_ref)) ||
    (
      raw.decision.runtime_operating_policy_ref !== undefined &&
      !isRef(raw.decision.runtime_operating_policy_ref, "runtime_operating_policy")
    ) ||
    (
      raw.decision.resulting_lifecycle_status !== undefined &&
      !isTradingRunLifecycleStatus(raw.decision.resulting_lifecycle_status)
    ) ||
    (raw.decision.trace_ref !== undefined && !isRef(raw.decision.trace_ref, "trace_placeholder")) ||
    !isOptionalRefArray(raw.decision.related_order_request_refs) ||
    !isOptionalRefArray(raw.decision.related_gateway_result_refs) ||
    !isOptionalRefArray(raw.decision.related_execution_result_refs)
  ) {
    return "invalid_run_control_input";
  }

  if (
    !raw.audit_event ||
    !isRuntimeAuditEventKind(raw.audit_event.event_kind) ||
    (
      raw.audit_event.actor_kind !== undefined &&
      !isRunControlActorKind(raw.audit_event.actor_kind)
    ) ||
    (raw.audit_event.actor_ref !== undefined && !isRef(raw.audit_event.actor_ref)) ||
    (
      raw.audit_event.runtime_lifecycle_status !== undefined &&
      !isTradingRunLifecycleStatus(raw.audit_event.runtime_lifecycle_status)
    ) ||
    (raw.audit_event.message !== undefined && !nonEmpty(raw.audit_event.message)) ||
    (raw.audit_event.trace_ref !== undefined && !isRef(raw.audit_event.trace_ref, "trace_placeholder")) ||
    !isOptionalRefArray(raw.audit_event.supporting_record_refs) ||
    !isOptionalRefArray(raw.audit_event.related_order_request_refs) ||
    !isOptionalRefArray(raw.audit_event.related_gateway_result_refs) ||
    !isOptionalRefArray(raw.audit_event.related_execution_result_refs)
  ) {
    return "invalid_run_control_input";
  }

  return undefined;
}

function isEvidenceDisposition(value: unknown): value is EvidenceDisposition {
  return value === "not_counted" || value === "counted" || value === "quarantined_for_review";
}

function isEvidenceDispositionReason(value: unknown): value is EvidenceDispositionReason {
  return typeof value === "string" && evidenceDispositionReasons.has(value as EvidenceDispositionReason);
}

function isOrderRequestKind(value: unknown): boolean {
  return value === "place_order" || value === "cancel_order" || value === "adjust_position";
}

function isGatewayResultOutcome(value: unknown): value is GatewayResultOutcome {
  return value === "allowed" || value === "rejected" || value === "clipped" || value === "dry_run_only";
}

function isGatewayResultReason(value: unknown): value is GatewayResultReason {
  return (
    value === "paper_stage_only" ||
    value === "dry_run_allowed" ||
    value === "no_live_authority" ||
    value === "risk_limit_exceeded" ||
    value === "operator_hold" ||
    value === "fixture_only"
  );
}

function isEvaluationExecutionMode(value: unknown): boolean {
  return value === "host_local" || value === "containerized_local" || value === "containerized_remote";
}

function isExecutionResultStatus(value: unknown): value is ExecutionResultStatus {
  return (
    value === "not_submitted" ||
    value === "dry_run_recorded" ||
    value === "blocked" ||
    value === "canceled" ||
    value === "failed"
  );
}

function isRunControlAction(value: unknown): value is RunControlAction {
  return (
    value === "inspect" ||
    value === "start" ||
    value === "pause" ||
    value === "resume" ||
    value === "stop" ||
    value === "override" ||
    value === "kill" ||
    value === "handoff" ||
    value === "audit"
  );
}

function isRunControlActorKind(value: unknown): value is RunControlActorKind {
  return (
    value === "human_operator" ||
    value === "policy_engine" ||
    value === "external_handoff" ||
    value === "fixture_operator"
  );
}

function isRunControlCommandReason(value: unknown): value is RunControlCommandReason {
  return (
    value === "operator_request" ||
    value === "inspection_request" ||
    value === "manual_override" ||
    value === "safety_intervention" ||
    value === "handoff_requested" ||
    value === "audit_request" ||
    value === "fixture_only"
  );
}

function isRunControlDecisionOutcome(value: unknown): value is RunControlDecisionOutcome {
  return (
    value === "allowed" ||
    value === "rejected" ||
    value === "dry_run_only" ||
    value === "no_live_authority"
  );
}

function isRunControlDecisionReason(value: unknown): value is RunControlDecisionReason {
  return (
    value === "policy_allows_control" ||
    value === "policy_rejected_control" ||
    value === "no_live_authority" ||
    value === "runtime_lifecycle_incompatible" ||
    value === "operator_hold" ||
    value === "manual_override_allowed" ||
    value === "safety_kill_allowed" ||
    value === "fixture_only"
  );
}

function isRuntimeAuditEventKind(value: unknown): value is RuntimeAuditEventKind {
  return (
    value === "control_command_recorded" ||
    value === "control_decision_recorded" ||
    value === "runtime_lifecycle_transitioned" ||
    value === "runtime_inspection_recorded" ||
    value === "control_override_recorded" ||
    value === "control_kill_recorded" ||
    value === "operator_handoff_recorded" ||
    value === "audit_snapshot_recorded"
  );
}

function isTradingRunLifecycleStatus(
  value: unknown
): value is TradingRunLifecycleStatus {
  return (
    value === "registered" ||
    value === "deployed" ||
    value === "starting" ||
    value === "running" ||
    value === "paused" ||
    value === "stopping" ||
    value === "stopped" ||
    value === "failed" ||
    value === "killed" ||
    value === "human_review_required" ||
    value === "fixture_placeholder"
  );
}

function isResearchDirectionRecord(value: unknown): value is ResearchDirectionRecord {
  if (!isPlainObject(value) || !hasOnlyKeys(value, [
    "record_kind",
    "version",
    "research_direction_id",
    "direction_kind",
    "market_scope",
    "prompt_seed",
    "diversity_axis",
    "created_at",
    "authority_status"
  ])) {
    return false;
  }
  return value.record_kind === "research_direction" &&
    value.version === 1 &&
    nonEmpty(value.research_direction_id) &&
    isResearchDirectionKind(value.direction_kind) &&
    value.market_scope === "external_trading_api_fixture" &&
    nonEmpty(value.prompt_seed) &&
    (value.diversity_axis === undefined || nonEmpty(value.diversity_axis)) &&
    isIsoTimestamp(value.created_at) &&
    value.authority_status === "research_seed_only";
}

function isResearchWorkerRecord(value: unknown): value is ResearchWorkerRecord {
  if (!isPlainObject(value) || !hasOnlyKeys(value, [
    "record_kind",
    "version",
    "research_worker_id",
    "display_name",
    "model",
    "provider_kind",
    "agent_profile_id",
    "research_direction_ref",
    "sandbox_policy_ref",
    "budget_policy_ref",
    "workspace_key",
    "lifecycle_protocol",
    "created_at",
    "status",
    "authority_status"
  ])) {
    return false;
  }
  const checkpointFields = [
    value.agent_profile_id,
    value.workspace_key,
    value.lifecycle_protocol
  ];
  const hasCheckpointLifecycle = checkpointFields.every((field) => field !== undefined);
  const hasPartialCheckpointLifecycle = checkpointFields.some((field) => field !== undefined) &&
    !hasCheckpointLifecycle;
  return !hasPartialCheckpointLifecycle &&
    value.record_kind === "research_worker" &&
    value.version === 1 &&
    nonEmpty(value.research_worker_id) &&
    nonEmpty(value.display_name) &&
    (value.model === undefined || nonEmpty(value.model)) &&
    (value.provider_kind === undefined || isProviderKind(value.provider_kind)) &&
    (value.agent_profile_id === undefined || nonEmpty(value.agent_profile_id)) &&
    isRef(value.research_direction_ref, "research_direction") &&
    (value.sandbox_policy_ref === undefined || isRef(value.sandbox_policy_ref)) &&
    (value.budget_policy_ref === undefined || isRef(value.budget_policy_ref)) &&
    (value.workspace_key === undefined ||
      value.workspace_key === `candidate-arena-workers/${value.research_worker_id}`) &&
    (value.lifecycle_protocol === undefined ||
      value.lifecycle_protocol === "research_worker_checkpoint_v1") &&
    isIsoTimestamp(value.created_at) &&
    (value.status === "active" || value.status === "failed" || value.status === "retired") &&
    value.authority_status === "research_only";
}

function isResearchDirectionKind(value: unknown): boolean {
  return value === "trend_following" ||
    value === "mean_reversion" ||
    value === "volatility_regime" ||
    value === "funding_aware_risk" ||
    value === "liquidation_aware_risk" ||
    value === "execution_cost_robustness" ||
    value === "other";
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isSystemCodeRecord(value: unknown): value is SystemCodeRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<SystemCodeRecord>;
  return (
    raw.record_kind === "system_code" &&
    raw.version === 1 &&
    nonEmpty(raw.system_code_id) &&
    (raw.artifact_kind === "python_file" || raw.artifact_kind === "container_image") &&
    nonEmpty(raw.artifact_digest) &&
    (raw.artifact_ref === undefined || isRef(raw.artifact_ref)) &&
    (raw.artifact_runtime_contract_ref === undefined ||
      isRef(raw.artifact_runtime_contract_ref, "artifact_runtime_contract")) &&
    isSystemCodeRuntimeKind(raw.runtime_kind) &&
    Array.isArray(raw.entrypoint) &&
    raw.entrypoint.length > 0 &&
    raw.entrypoint.every((item) => nonEmpty(item)) &&
    isSystemCodeOutputContract(raw.declared_output_contract) &&
    isRef(raw.secret_policy_ref, "secret_policy") &&
    isRef(raw.capability_policy_ref, "capability_policy") &&
    Array.isArray(raw.provenance_refs) &&
    raw.provenance_refs.every((item) => isRef(item)) &&
    raw.status === "registered" &&
    nonEmpty(raw.created_at) &&
    raw.authority_status === "not_live" &&
    (
      (raw.artifact_kind === "python_file" && nonEmpty(raw.artifact_path)) ||
      (raw.artifact_kind === "container_image" && nonEmpty(raw.image_ref))
    )
  );
}

function isCandidateAdmissionDecisionRecord(
  value: unknown
): value is CandidateAdmissionDecisionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<CandidateAdmissionDecisionRecord>;
  const hasPreflightRef = raw.research_preflight_commitment_ref !== undefined;
  const hasPreflightDigest = raw.research_preflight_commitment_digest !== undefined;
  if (
    raw.record_kind !== "candidate_admission_decision" ||
    raw.version !== 1 ||
    !nonEmpty(raw.candidate_admission_decision_id) ||
    hasPreflightRef !== hasPreflightDigest ||
    (hasPreflightRef && (
      !isRef(raw.research_preflight_commitment_ref, "research_preflight_commitment") ||
      !isSha256Digest(raw.research_preflight_commitment_digest)
    )) ||
    !isRef(raw.source_system_code_ref, "system_code") ||
    !isRef(raw.system_code_ref, "system_code") ||
    !isRef(raw.experiment_run_ref, "experiment_run") ||
    !isRef(raw.trading_evaluation_result_ref, "trading_evaluation_result") ||
    !isRef(raw.research_finding_ref, "research_finding") ||
    !nonEmpty(raw.source_artifact_digest) ||
    !nonEmpty(raw.submitted_artifact_digest) ||
    !isCandidateAdmissionResearchWorkerOutcome(raw.research_worker_outcome) ||
    !isCandidateAdmissionExperimentStatus(raw.experiment_status) ||
    !isCandidateAdmissionEvaluationStatus(raw.evaluation_status) ||
    !isEvidenceDisposition(raw.evidence_disposition) ||
    !isOptionalCandidateAdmissionBehaviorComparisonStatus(
      raw.behavior_comparison_status
    ) ||
    !isCandidateAdmissionStatus(raw.status) ||
    !isCandidateAdmissionReason(raw.reason) ||
    typeof raw.runnable_paper_handoff !== "boolean" ||
    !nonEmpty(raw.decided_at) ||
    raw.authority_status !== "not_live"
  ) {
    return false;
  }
  return isCandidateAdmissionDecisionConsistent(
    raw as CandidateAdmissionDecisionRecord
  );
}

function isCandidateAdmissionResearchWorkerOutcome(value: unknown): boolean {
  return value === "changed" || value === "unchanged" || value === "failed";
}

function isCandidateAdmissionExperimentStatus(value: unknown): boolean {
  return value === "evaluated" || value === "failed";
}

function isCandidateAdmissionEvaluationStatus(value: unknown): boolean {
  return value === "accepted" || value === "quarantined_for_review" || value === "disqualified";
}

function isCandidateAdmissionStatus(value: unknown): boolean {
  return value === "admitted" || value === "duplicate" || value === "quarantined";
}

function isOptionalCandidateAdmissionBehaviorComparisonStatus(value: unknown): boolean {
  return value === undefined || value === "distinct" || value === "duplicate" ||
    value === "unavailable";
}

function isCandidateAdmissionReason(value: unknown): boolean {
  return value === "evaluation_accepted" ||
    value === "research_worker_failed" ||
    value === "no_candidate_change" ||
    value === "experiment_failed" ||
    value === "evaluation_disqualified" ||
    value === "evaluation_quarantined" ||
    value === "evidence_already_counted" ||
    value === "evidence_quarantined" ||
    value === "paper_handoff_conformance_failed" ||
    value === "behavior_duplicate" ||
    value === "behavior_fingerprint_unavailable";
}

function isResearchFindingRecord(value: unknown): value is ResearchFindingRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ResearchFindingRecord>;
  return (
    raw.record_kind === "research_finding" &&
    raw.version === 1 &&
    nonEmpty(raw.research_finding_id) &&
    isRef(raw.research_worker_ref, "research_worker") &&
    isRef(raw.research_direction_ref, "research_direction") &&
    isRef(raw.experiment_run_ref, "experiment_run") &&
    isRef(raw.trading_evaluation_result_ref, "trading_evaluation_result") &&
    isResearchFindingKind(raw.finding_kind) &&
    nonEmpty(raw.summary) &&
    Array.isArray(raw.supporting_record_refs) &&
    raw.supporting_record_refs.every((item) => isRef(item)) &&
    nonEmpty(raw.created_at) &&
    raw.authority_status === "research_trace_only"
  );
}

function isCandidateArenaTickRecord(value: unknown): value is CandidateArenaTickRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<CandidateArenaTickRecord>;
  return (
    raw.record_kind === "candidate_arena_tick" &&
    raw.version === 1 &&
    nonEmpty(raw.candidate_arena_tick_id) &&
    nonEmpty(raw.tick_id) &&
    nonEmpty(raw.started_at) &&
    nonEmpty(raw.completed_at) &&
    isCandidateArenaTickStatus(raw.status) &&
    (raw.source_candidate === undefined || isCandidateArenaTickSource(raw.source_candidate)) &&
    Array.isArray(raw.created_candidate_refs) &&
    raw.created_candidate_refs.every((item) => isRef(item, "trading_system_candidate")) &&
    Array.isArray(raw.direction_results) &&
    raw.direction_results.every(isCandidateArenaTickDirectionResult) &&
    (
      raw.research_allocation_ref === undefined &&
        raw.research_allocation_digest === undefined ||
      isRef(
        raw.research_allocation_ref,
        "candidate_arena_research_allocation"
      ) && nonEmpty(raw.research_allocation_digest)
    ) &&
    (
      raw.paper_trading_continuation === undefined ||
      isCandidateArenaTickPaperTradingContinuation(raw.paper_trading_continuation)
    ) &&
    raw.authority_status === "not_live"
  );
}

function isArtifactLineageRecord(value: unknown): value is ArtifactLineageRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ArtifactLineageRecord>;
  return (
    raw.record_kind === "artifact_lineage" &&
    raw.version === 1 &&
    nonEmpty(raw.artifact_lineage_id) &&
    isRef(raw.child_system_code_ref, "system_code") &&
    (raw.parent_system_code_ref === undefined ||
      isRef(raw.parent_system_code_ref, "system_code")) &&
    Array.isArray(raw.source_finding_refs) &&
    raw.source_finding_refs.length > 0 &&
    raw.source_finding_refs.every((item) => isRef(item, "research_finding")) &&
    (raw.created_by_research_worker_ref === undefined ||
      isRef(raw.created_by_research_worker_ref, "research_worker")) &&
    nonEmpty(raw.created_at) &&
    raw.authority_status === "lineage_only"
  );
}

function isImprovementProposalRecord(value: unknown): value is ImprovementProposalRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ImprovementProposalRecord>;
  return (
    raw.record_kind === "improvement_proposal" &&
    raw.version === 1 &&
    nonEmpty(raw.improvement_proposal_id) &&
    isRef(raw.research_worker_ref, "research_worker") &&
    isRef(raw.research_direction_ref, "research_direction") &&
    isRef(raw.trading_evaluation_task_ref, "trading_evaluation_task") &&
    isRef(raw.proposed_system_code_ref, "system_code") &&
    (raw.parent_system_code_ref === undefined ||
      isRef(raw.parent_system_code_ref, "system_code")) &&
    Array.isArray(raw.source_finding_refs) &&
    raw.source_finding_refs.length > 0 &&
    raw.source_finding_refs.every((item) => isRef(item, "research_finding")) &&
    (
      raw.anti_hacking_finding_refs === undefined ||
      (
        Array.isArray(raw.anti_hacking_finding_refs) &&
        raw.anti_hacking_finding_refs.every((item) => isRef(item, "research_finding"))
      )
    ) &&
    nonEmpty(raw.proposal_summary) &&
    nonEmpty(raw.requested_change_summary) &&
    (raw.expected_improvement_summary === undefined || nonEmpty(raw.expected_improvement_summary)) &&
    nonEmpty(raw.created_at) &&
    isImprovementProposalStatus(raw.status) &&
    raw.authority_status === "proposal_only"
  );
}

function isResearchOrchestrationRunRecord(value: unknown): value is ResearchOrchestrationRunRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ResearchOrchestrationRunRecord>;
  return (
    raw.record_kind === "research_orchestration_run" &&
    raw.version === 1 &&
    nonEmpty(raw.research_orchestration_run_id) &&
    isRef(raw.research_worker_ref, "research_worker") &&
    isRef(raw.research_direction_ref, "research_direction") &&
    isRef(raw.trading_evaluation_task_ref, "trading_evaluation_task") &&
    Array.isArray(raw.input_finding_refs) &&
    raw.input_finding_refs.length > 0 &&
    raw.input_finding_refs.every((item) => isRef(item, "research_finding")) &&
    (
      raw.input_lineage_refs === undefined ||
      (
        Array.isArray(raw.input_lineage_refs) &&
        raw.input_lineage_refs.every((item) => isRef(item, "artifact_lineage"))
      )
    ) &&
    (raw.output_artifact_proposal_ref === undefined ||
      isRef(raw.output_artifact_proposal_ref, "improvement_proposal")) &&
    (raw.output_system_code_ref === undefined ||
      isRef(raw.output_system_code_ref, "system_code")) &&
    (raw.output_lineage_ref === undefined || isRef(raw.output_lineage_ref, "artifact_lineage")) &&
    (raw.trace_ref === undefined || isRef(raw.trace_ref, "trace_placeholder")) &&
    nonEmpty(raw.started_at) &&
    (raw.completed_at === undefined || nonEmpty(raw.completed_at)) &&
    isResearchOrchestrationRunStatus(raw.status) &&
    raw.authority_status === "research_only"
  );
}

function isExperimentRunRecord(value: unknown): value is ExperimentRunRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ExperimentRunRecord>;
  return (
    raw.record_kind === "experiment_run" &&
    raw.version === 1 &&
    nonEmpty(raw.experiment_run_id) &&
    isRef(raw.research_worker_ref, "research_worker") &&
    isRef(raw.research_direction_ref, "research_direction") &&
    isRef(raw.system_code_ref, "system_code") &&
    isRef(raw.trading_evaluation_task_ref, "trading_evaluation_task") &&
    (
      raw.sandbox_ref === undefined ||
      isRef(raw.sandbox_ref, "sandbox")
    ) &&
    (
      raw.runtime_trace_refs === undefined ||
      (
        Array.isArray(raw.runtime_trace_refs) &&
        raw.runtime_trace_refs.every((item) => isRef(item))
      )
    ) &&
    (raw.trace_ref === undefined || isRef(raw.trace_ref, "trace_placeholder")) &&
    nonEmpty(raw.submitted_at) &&
    isExperimentRunStatus(raw.status) &&
    raw.authority_status === "not_live"
  );
}

function isTradingEvaluationResultRecord(value: unknown): value is TradingEvaluationResultRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<TradingEvaluationResultRecord>;
  return (
    raw.record_kind === "trading_evaluation_result" &&
    raw.version === 1 &&
    nonEmpty(raw.trading_evaluation_result_id) &&
    isRef(raw.experiment_run_ref, "experiment_run") &&
    isRef(raw.trading_evaluation_task_ref, "trading_evaluation_task") &&
    isRef(raw.evaluator_ref, "external_evaluator") &&
    isTradingEvaluationResultStatus(raw.result_status) &&
    isEvidenceDisposition(raw.evidence_disposition) &&
    isTradingEvaluationScoreSummary(raw.score_summary) &&
    Array.isArray(raw.metric_refs) &&
    raw.metric_refs.every((item) => isRef(item, "metric_snapshot")) &&
    isRef(raw.evaluator_trace_ref, "trace_placeholder") &&
    (
      raw.disqualification_reason === undefined ||
      isTradingEvaluationDisqualificationReason(raw.disqualification_reason)
    ) &&
    (
      raw.quarantine_reason === undefined ||
      isTradingEvaluationQuarantineReason(raw.quarantine_reason)
    ) &&
    tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape(raw) &&
    nonEmpty(raw.completed_at) &&
    (raw.authority_status === "not_counted" || raw.authority_status === "counted")
  );
}

function isResearchFindingKind(value: unknown): boolean {
  return (
    value === "positive_result" ||
    value === "negative_result" ||
    value === "failure_analysis" ||
    value === "anti_hacking_case" ||
    value === "duplicate_result" ||
    value === "next_artifact_hint"
  );
}

function isImprovementProposalStatus(value: unknown): boolean {
  return value === "proposed" || value === "materialized" || value === "discarded";
}

function isResearchOrchestrationRunStatus(value: unknown): boolean {
  return value === "started" || value === "proposed" || value === "failed" || value === "discarded";
}

function isExperimentRunStatus(value: unknown): boolean {
  return value === "submitted" || value === "evaluated" || value === "failed" || value === "discarded";
}

function isCandidateArenaTickStatus(value: unknown): boolean {
  return value === "completed" || value === "completed_with_errors" || value === "failed";
}

function isCandidateArenaTickSourceKind(value: unknown): boolean {
  return (
    value === "fixture_seed" ||
    value === "evaluated_arena_leader" ||
    value === "paper_trading_evaluation_leader" ||
    value === "explicit_candidate"
  );
}

function isCandidateArenaTickSource(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Record<string, unknown>;
  const hasNetRevenue = raw.net_revenue_usdt === undefined ||
    (typeof raw.net_revenue_usdt === "number" && Number.isFinite(raw.net_revenue_usdt));
  return (
    isCandidateArenaTickSourceKind(raw.source_kind) &&
    nonEmpty(raw.candidate_id) &&
    nonEmpty(raw.display_name) &&
    hasNetRevenue &&
    raw.authority_status === "not_live"
  );
}

function isCandidateArenaDirectionResultStatus(value: unknown): boolean {
  return value === "created" ||
    value === "duplicate" ||
    value === "quarantined" ||
    value === "no_submission" ||
    value === "failed";
}

function isCandidateArenaTickPaperTradingContinuation(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as {
    status?: unknown;
    command_kind?: unknown;
    selected_candidate_id?: unknown;
    error?: unknown;
    authority_status?: unknown;
  };
  const hasSelectedCandidateId = raw.selected_candidate_id === undefined || nonEmpty(raw.selected_candidate_id);
  const hasError = raw.error === undefined || nonEmpty(raw.error);
  return (
    (raw.status === "started" || raw.status === "failed") &&
    raw.command_kind === "trading_run.start" &&
    hasSelectedCandidateId &&
    hasError &&
    raw.authority_status === "not_live"
  );
}

function isCandidateArenaResearchDirection(value: unknown): boolean {
  return (
    value === "trend_following" ||
    value === "mean_reversion" ||
    value === "volatility_regime" ||
    value === "funding_aware_risk" ||
    value === "liquidation_aware_risk" ||
    value === "execution_cost_robustness" ||
    value === "other"
  );
}

function isCandidateArenaTickDirectionResult(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as {
    direction_kind?: unknown;
    status?: unknown;
    candidate_id?: unknown;
    finding?: unknown;
    error?: unknown;
    admission_decision_id?: unknown;
    admission_reason?: unknown;
    net_revenue_usdt?: unknown;
    research_efficiency?: unknown;
    research_preflight?: unknown;
    paper_handoff_conformance?: unknown;
  };
  const hasCandidateId = raw.candidate_id === undefined || nonEmpty(raw.candidate_id);
  const hasFinding = raw.finding === undefined || nonEmpty(raw.finding);
  const hasError = raw.error === undefined || nonEmpty(raw.error);
  const hasAdmissionDecisionId = raw.admission_decision_id === undefined ||
    nonEmpty(raw.admission_decision_id);
  const hasAdmissionReason = raw.admission_reason === undefined ||
    isCandidateAdmissionReason(raw.admission_reason);
  const hasNetRevenue = raw.net_revenue_usdt === undefined ||
    (typeof raw.net_revenue_usdt === "number" && Number.isFinite(raw.net_revenue_usdt));
  const hasResearchEfficiency = raw.research_efficiency === undefined ||
    isCandidateArenaResearchEfficiency(raw.research_efficiency);
  const hasResearchPreflight = raw.research_preflight === undefined ||
    isCandidateArenaResearchPreflight(raw.research_preflight);
  const hasPaperHandoffConformance = raw.paper_handoff_conformance === undefined ||
    isCandidateArenaPaperHandoffConformance(raw.paper_handoff_conformance);
  return (
    isCandidateArenaResearchDirection(raw.direction_kind) &&
    isCandidateArenaDirectionResultStatus(raw.status) &&
    hasCandidateId &&
    hasFinding &&
    hasError &&
    hasAdmissionDecisionId &&
    hasAdmissionReason &&
    hasNetRevenue &&
    hasResearchEfficiency &&
    hasResearchPreflight &&
    hasPaperHandoffConformance &&
    (
      raw.status === "created"
        ? nonEmpty(raw.candidate_id)
        : raw.status === "failed"
          ? nonEmpty(raw.error)
          : raw.status === "no_submission"
            ? nonEmpty(raw.finding) &&
              raw.candidate_id === undefined &&
              raw.error === undefined &&
              raw.admission_decision_id === undefined &&
              raw.admission_reason === undefined &&
              raw.net_revenue_usdt === undefined &&
              raw.paper_handoff_conformance === undefined
            : nonEmpty(raw.finding) &&
            nonEmpty(raw.admission_decision_id) &&
            isCandidateAdmissionReason(raw.admission_reason)
    )
  );
}

function isCandidateArenaPaperHandoffConformance(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return Object.keys(raw).length === 4 &&
    nonEmpty(raw.conformance_id) &&
    (raw.status === "passed" || raw.status === "rejected") &&
    nonEmpty(raw.reason) &&
    raw.authority_status === "research_only";
}

function isCandidateArenaResearchEfficiency(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.provider_request_total === "number" &&
    Number.isFinite(raw.provider_request_total) &&
    raw.provider_request_total >= 0 &&
    typeof raw.runner_command_total === "number" &&
    Number.isFinite(raw.runner_command_total) &&
    raw.runner_command_total >= 0 &&
    typeof raw.scenario_count === "number" &&
    Number.isFinite(raw.scenario_count) &&
    raw.scenario_count >= 0 &&
    typeof raw.elapsed_ms === "number" &&
    Number.isFinite(raw.elapsed_ms) &&
    raw.elapsed_ms >= 0 &&
    (raw.development === undefined ||
      isCandidateArenaResearchEfficiencyPhase(raw.development)) &&
    (raw.sealed_admission === undefined ||
      isCandidateArenaResearchEfficiencyPhase(raw.sealed_admission)) &&
    raw.authority_status === "not_promotion_authority"
  );
}

function isCandidateArenaResearchEfficiencyPhase(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return [
    raw.submission_count,
    raw.provider_request_total,
    raw.runner_command_total,
    raw.scenario_count,
    raw.elapsed_ms
  ].every((metric) =>
    typeof metric === "number" && Number.isInteger(metric) && metric >= 0
  );
}

function isCandidateArenaResearchPreflight(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return Object.keys(raw).length === 5 &&
    nonEmpty(raw.commitment_id) &&
    typeof raw.development_submission_count === "number" &&
    Number.isInteger(raw.development_submission_count) &&
    raw.development_submission_count >= 0 &&
    raw.development_submission_count <= 2 &&
    (raw.sealed_terminal_status === "accepted" ||
      raw.sealed_terminal_status === "rejected" ||
      raw.sealed_terminal_status === "not_run") &&
    (raw.sealed_terminal_status === "accepted"
      ? raw.reason === "accepted"
      : raw.sealed_terminal_status === "rejected"
        ? raw.reason === "candidate_rejected"
        : raw.reason === "no_development_winner" ||
          raw.reason === "execution_failed") &&
    raw.authority_status === "not_promotion_authority";
}

function isTradingEvaluationResultStatus(value: unknown): boolean {
  return value === "accepted" || value === "quarantined_for_review" || value === "disqualified";
}

function isTradingEvaluationScoreSummary(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Record<string, unknown>;
  return [
    "total_score",
    "oos_score",
    "drawdown_score",
    "turnover_score",
    "cost_survival_score",
    "reproducibility_score",
    "complexity_penalty"
  ].every((key) => typeof raw[key] === "number" && Number.isFinite(raw[key]));
}

function isTradingEvaluationDisqualificationReason(value: unknown): boolean {
  return (
    value === "lookahead_leakage" ||
    value === "data_leakage" ||
    value === "survivorship_bias" ||
    value === "cost_model_bypass" ||
    value === "funding_ignored" ||
    value === "liquidation_ignored" ||
    value === "seed_cherry_pick" ||
    value === "oos_overfit" ||
    value === "unreproducible" ||
    value === "research_worker_failed" ||
    value === "runtime_crash" ||
    value === "risk_validation_failed" ||
    value === "no_order_request" ||
    value === "runtime_self_report_only"
  );
}

function isTradingEvaluationQuarantineReason(value: unknown): boolean {
  return (
    value === "metric_instability" ||
    value === "insufficient_oos_coverage" ||
    value === "excessive_complexity" ||
    value === "manual_review_required" ||
    value === "partial_trace"
  );
}

function isSystemCodeRuntimeKind(value: unknown): boolean {
  return value === "python" || value === "container_image";
}

function isSystemCodeOutputContract(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as {
    contract_kind?: unknown;
    declared_output_kinds?: unknown;
    event_envelope_ref?: unknown;
    log_contract_ref?: unknown;
    heartbeat_contract_ref?: unknown;
  };
  return (
    raw.contract_kind === "opaque_runtime_boundary" &&
    Array.isArray(raw.declared_output_kinds) &&
    raw.declared_output_kinds.length > 0 &&
    raw.declared_output_kinds.every((item) => isSystemCodeOutputKind(item)) &&
    (raw.event_envelope_ref === undefined || isRef(raw.event_envelope_ref)) &&
    (raw.log_contract_ref === undefined || isRef(raw.log_contract_ref)) &&
    (raw.heartbeat_contract_ref === undefined || isRef(raw.heartbeat_contract_ref))
  );
}

function isSystemCodeOutputKind(value: unknown): boolean {
  return (
    value === "program_event" ||
    value === "runtime_log" ||
    value === "runtime_heartbeat" ||
    value === "metric_snapshot" ||
    value === "diagnostic_artifact" ||
    value === "order_request"
  );
}

function isOptionalRefArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((item) => isRef(item)));
}

function isRequiredRefArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isRef(item));
}

function isRef(value: unknown, recordKind?: string): value is Ref {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<Ref>;
  return (
    nonEmpty(candidate.record_kind) &&
    nonEmpty(candidate.id) &&
    (recordKind === undefined || candidate.record_kind === recordKind)
  );
}

// Pre-comparison promotions remain readable but carry no current promotion authority.
function isLegacyTradingPromotionRecord(
  value: unknown
): value is Omit<TradingPromotionRecord, "comparison_confirmation"> {
  return isPlainObject(value) && !("comparison_confirmation" in value) &&
    value.record_kind === "trading_promotion" && value.version === 1 &&
    nonEmpty(value.trading_promotion_id) &&
    value.status === "promoted_for_trading_review" &&
    isRef(value.candidate_ref, "trading_system_candidate") &&
    isRef(value.candidate_version_ref, "candidate_version") &&
    isRef(value.paper_trading_evaluation_ref, "paper_trading_evaluation") &&
    isIsoTimestamp(value.promoted_at) &&
    (value.promoted_by_command_ref === undefined ||
      isRef(value.promoted_by_command_ref)) &&
    value.authority_status === "not_live";
}

function isPaperTradingEvaluationCommitmentRecord(
  value: unknown
): value is PaperTradingEvaluationCommitmentRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<PaperTradingEvaluationCommitmentRecord>;
  const purposeMatchesRelease =
    (record.evidence_purpose === "research_feedback" &&
      record.window_policy?.release_policy === "closed_observation") ||
    (record.evidence_purpose === "qualification" &&
      record.window_policy?.release_policy === "sealed_until_adjudication");
  return (
    record.record_kind === "paper_trading_evaluation_commitment" &&
    record.version === 1 &&
    nonEmpty(record.paper_trading_evaluation_commitment_id) &&
    purposeMatchesRelease &&
    isRef(record.candidate_ref, "trading_system_candidate") &&
    isRef(record.candidate_version_ref, "candidate_version") &&
    isRef(record.trading_run_ref, "trading_run") &&
    isRef(record.system_code_ref, "system_code") &&
    nonEmpty(record.system_code_artifact_digest) &&
    nonEmpty(record.resolved_artifact_digest) &&
    Boolean(record.runtime_identity) &&
    Array.isArray(record.runtime_identity?.entrypoint) &&
    record.runtime_identity.entrypoint.length > 0 &&
    record.runtime_identity.entrypoint.every(nonEmpty) &&
    Boolean(record.provider_identity) &&
    (record.provider_identity?.runtime_provider_kind === "none" ||
      record.provider_identity?.runtime_provider_kind === "managed_agent") &&
    isRef(record.capability_policy_ref, "capability_policy") &&
    isRef(record.secret_policy_ref, "secret_policy") &&
    Boolean(record.policy_identity) &&
    Boolean(record.data_identity) &&
    record.data_identity?.symbol === "BTCUSDT" &&
    record.data_identity.market_data_port === "gateway_owned" &&
    nonEmpty(record.data_identity.market_data_configuration_digest) &&
    record.data_identity.private_exchange_access === "forbidden" &&
    record.data_identity.live_order_access === "forbidden" &&
    Boolean(record.window_policy) &&
    Number.isInteger(record.window_policy?.interval_ms) &&
    (record.window_policy?.interval_ms ?? 0) > 0 &&
    nonEmpty(record.window_policy?.eligibility_policy_version) &&
    Boolean(record.initial_account_snapshot) &&
    record.initial_account_snapshot?.authority_status === "not_live" &&
    nonEmpty(record.committed_at) &&
    nonEmpty(record.commitment_digest) &&
    record.authority_status === "not_live"
  );
}

function isPaperTradingComparisonEvaluationScanRecord(
  value: unknown
): value is PaperTradingEvaluationRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Partial<PaperTradingEvaluationRecord>;
  return (
    record.record_kind === "paper_trading_evaluation" &&
    record.version === 1 &&
    nonEmpty(record.paper_trading_evaluation_id) &&
    isRef(record.candidate_ref, "trading_system_candidate") &&
    isRef(record.candidate_version_ref, "candidate_version") &&
    isRef(record.trading_run_ref, "trading_run") &&
    (record.paper_trading_evaluation_commitment_ref === undefined ||
      isRef(
        record.paper_trading_evaluation_commitment_ref,
        "paper_trading_evaluation_commitment"
      )) &&
    ["not_started", "running", "stopped", "invalidated"].includes(
      record.status as string
    ) &&
    Number.isInteger(record.interval_ms) &&
    (record.interval_ms ?? 0) > 0 &&
    Number.isInteger(record.observation_count) &&
    (record.observation_count ?? -1) >= 0 &&
    isIsoTimestamp(record.started_at) &&
    (record.last_observed_at === undefined || isIsoTimestamp(record.last_observed_at)) &&
    (record.next_observation_at === undefined || isIsoTimestamp(record.next_observation_at)) &&
    (record.stopped_at === undefined || isIsoTimestamp(record.stopped_at)) &&
    isPaperTradingComparisonScoreShape(record.latest_score) &&
    (record.open_orders === undefined || Array.isArray(record.open_orders)) &&
    (record.processed_trading_system_event_ids === undefined ||
      isStringArray(record.processed_trading_system_event_ids)) &&
    (record.processed_public_trade_ids === undefined ||
      isStringArray(record.processed_public_trade_ids)) &&
    record.authority_status === "not_live"
  );
}

function isPaperTradingComparisonObservationScanRecord(
  value: unknown
): value is PaperTradingObservationRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Partial<PaperTradingObservationRecord>;
  return (
    record.record_kind === "paper_trading_observation" &&
    record.version === 1 &&
    nonEmpty(record.paper_trading_observation_id) &&
    isRef(record.paper_trading_evaluation_ref, "paper_trading_evaluation") &&
    isRef(
      record.paper_trading_evaluation_commitment_ref,
      "paper_trading_evaluation_commitment"
    ) &&
    isRef(record.candidate_ref, "trading_system_candidate") &&
    isRef(record.candidate_version_ref, "candidate_version") &&
    isRef(record.trading_run_ref, "trading_run") &&
    Number.isInteger(record.sequence) &&
    (record.sequence ?? 0) > 0 &&
    ["recorded", "no_order", "failed"].includes(record.status as string) &&
    isIsoTimestamp(record.observed_at) &&
    isPaperTradingComparisonScoreShape(record.score_delta) &&
    isPaperTradingComparisonScoreShape(record.cumulative_score) &&
    (record.open_orders === undefined || Array.isArray(record.open_orders)) &&
    (record.processed_trading_system_event_ids === undefined ||
      isStringArray(record.processed_trading_system_event_ids)) &&
    (record.processed_public_trade_ids === undefined ||
      isStringArray(record.processed_public_trade_ids)) &&
    record.authority_status === "not_live"
  );
}

function isPaperTradingComparisonScoreShape(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const score = value as Record<string, unknown>;
  return [
    score.revenue_usdt,
    score.cost_usdt,
    score.net_revenue_usdt,
    score.net_return_pct
  ].every((item) => typeof item === "number" && Number.isFinite(item));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function paperTradingCommitmentReferencesMatch(input: {
  commitment: PaperTradingEvaluationCommitmentRecord;
  candidate: TradingSystemCandidateRecord;
  candidateVersion: CandidateVersionRecord;
  tradingRun: TradingRunRecord;
  systemCode: SystemCodeRecord;
}): boolean {
  const { commitment, candidate, candidateVersion, tradingRun, systemCode } = input;
  return (
    candidate.candidate_id === commitment.candidate_ref.id &&
    candidate.active_version_id === commitment.candidate_version_ref.id &&
    candidateVersion.candidate_version_id === commitment.candidate_version_ref.id &&
    candidateVersion.candidate_id === commitment.candidate_ref.id &&
    tradingRun.trading_run_id === commitment.trading_run_ref.id &&
    tradingRunOwnsCandidateVersion(tradingRun, candidate, candidateVersion) &&
    paperTradingRunPurposeMatches(tradingRun, candidateVersion, commitment.evidence_purpose) &&
    candidateVersion.system_code_ref?.id === commitment.system_code_ref.id &&
    candidate.active_system_code_ref?.id === commitment.system_code_ref.id &&
    systemCode.system_code_id === commitment.system_code_ref.id &&
    systemCode.artifact_digest === commitment.system_code_artifact_digest &&
    systemCode.artifact_kind === commitment.runtime_identity.artifact_kind &&
    systemCode.runtime_kind === commitment.runtime_identity.runtime_kind &&
    sameJson(systemCode.entrypoint, commitment.runtime_identity.entrypoint) &&
    sameOptionalRef(
      systemCode.artifact_runtime_contract_ref,
      commitment.runtime_identity.artifact_runtime_contract_ref
    ) &&
    sameRef(systemCode.capability_policy_ref, commitment.capability_policy_ref) &&
    sameRef(systemCode.secret_policy_ref, commitment.secret_policy_ref) &&
    systemCode.authority_status === "not_live"
  );
}

function tradingRunOwnsCandidateVersion(
  tradingRun: TradingRunRecord,
  candidate: TradingSystemCandidateRecord,
  candidateVersion: CandidateVersionRecord
): boolean {
  const explicitOwnership = tradingRun.candidate_ref !== undefined ||
    tradingRun.candidate_version_ref !== undefined;
  if (!explicitOwnership) {
    return tradingRun.trading_run_id === candidateVersion.runtime_ref.id;
  }
  const systemCodeRef = candidateVersion.system_code_ref ?? candidate.active_system_code_ref;
  const systemCodeMatches = tradingRun.trading_run_id === candidateVersion.runtime_ref.id
    ? tradingRun.system_code_ref === undefined || sameRef(tradingRun.system_code_ref, systemCodeRef)
    : sameRef(tradingRun.system_code_ref, systemCodeRef);
  return sameRef(
    tradingRun.candidate_ref,
    ref("trading_system_candidate", candidate.candidate_id)
  ) &&
    sameRef(
      tradingRun.candidate_version_ref,
      ref("candidate_version", candidateVersion.candidate_version_id)
    ) &&
    systemCodeMatches &&
    tradingRun.stage_binding_profile === "paper" &&
    tradingRun.authority_status === "not_live";
}

function paperTradingRunPurposeMatches(
  tradingRun: TradingRunRecord,
  candidateVersion: CandidateVersionRecord,
  evidencePurpose: PaperTradingEvidencePurpose
): boolean {
  if (tradingRun.paper_evidence_purpose) {
    return tradingRun.paper_evidence_purpose === evidencePurpose;
  }
  return tradingRun.trading_run_id === candidateVersion.runtime_ref.id &&
    evidencePurpose === "research_feedback";
}

function paperTradingEvaluationReferencesMatch(
  evaluation: PaperTradingEvaluationRecord,
  commitment: PaperTradingEvaluationCommitmentRecord
): boolean {
  return (
    evaluation.paper_trading_evaluation_commitment_ref?.record_kind ===
      "paper_trading_evaluation_commitment" &&
    evaluation.paper_trading_evaluation_commitment_ref.id ===
      commitment.paper_trading_evaluation_commitment_id &&
    sameRef(evaluation.candidate_ref, commitment.candidate_ref) &&
    sameRef(evaluation.candidate_version_ref, commitment.candidate_version_ref) &&
    sameRef(evaluation.trading_run_ref, commitment.trading_run_ref) &&
    evaluation.interval_ms === commitment.window_policy.interval_ms &&
    evaluation.authority_status === "not_live"
  );
}

function paperTradingObservationReferencesMatch(
  observation: PaperTradingObservationRecord,
  evaluation: PaperTradingEvaluationRecord,
  commitment: PaperTradingEvaluationCommitmentRecord
): boolean {
  return (
    sameRef(observation.candidate_ref, commitment.candidate_ref) &&
    sameRef(observation.candidate_version_ref, commitment.candidate_version_ref) &&
    sameRef(observation.trading_run_ref, commitment.trading_run_ref) &&
    sameRef(evaluation.trading_run_ref, commitment.trading_run_ref) &&
    observation.paper_trading_evaluation_ref.record_kind === "paper_trading_evaluation" &&
    observation.paper_trading_evaluation_ref.id === evaluation.paper_trading_evaluation_id &&
    observation.authority_status === "not_live"
  );
}

function sameRef(left: Ref | undefined, right: Ref | undefined): boolean {
  return Boolean(
    left &&
    right &&
    left.record_kind === right.record_kind &&
    left.id === right.id
  );
}

function sameOptionalRef(left: Ref | undefined, right: Ref | undefined): boolean {
  return left === undefined && right === undefined || sameRef(left, right);
}

function researchControlCampaignOutcomeSlotMatchesReport(
  result: ResearchControlCampaignOutcomeRecord["arms"][number]["slot_results"][number],
  slot: ResearchControlCampaignReportRecord["arms"][number]["paper_candidate_slots"][number],
  scheduleSlot: ResearchControlCampaignPaperScheduleSlot,
  slotOutcome: ResearchControlCampaignPaperSlotOutcomeRecord | undefined,
  schedule: ResearchControlCampaignPaperScheduleRecord,
  armKind: ResearchControlCampaignPaperSlotOutcomeRecord["arm_kind"],
  adjudicatedAt: string
): boolean {
  if (result.sequence !== slot.sequence || !paperTradingComparisonRefsEqual(
    result.tick_ref,
    slot.tick_ref
  ) || scheduleSlot.sequence !== slot.sequence ||
    !paperTradingComparisonRefsEqual(scheduleSlot.tick_ref, slot.tick_ref)) {
    return false;
  }
  if (slot.status === "no_admitted_candidate") {
    return result.terminal_status === "no_admitted_candidate" &&
      scheduleSlot.slot_status === "no_admitted_candidate" && !slotOutcome;
  }
  if (result.terminal_status === "no_admitted_candidate" ||
    scheduleSlot.slot_status !== "candidate_scheduled" || !slotOutcome) {
    return false;
  }
  return paperTradingComparisonRefsEqual(
    result.candidate_ref,
    slot.candidate_ref
  ) &&
    paperTradingComparisonRefsEqual(
      result.candidate_version_ref,
      slot.candidate_version_ref
    ) && paperTradingComparisonRefsEqual(
      result.system_code_ref,
      slot.system_code_ref
    ) && result.system_code_artifact_digest ===
      slot.system_code_artifact_digest && paperTradingComparisonRefsEqual(
        scheduleSlot.candidate_ref,
        slot.candidate_ref
      ) && paperTradingComparisonRefsEqual(
        scheduleSlot.candidate_version_ref,
        slot.candidate_version_ref
      ) && paperTradingComparisonRefsEqual(
        scheduleSlot.system_code_ref,
        slot.system_code_ref
      ) && scheduleSlot.system_code_artifact_digest ===
        slot.system_code_artifact_digest &&
      paperTradingComparisonRefsEqual(
        scheduleSlot.admission_decision_ref,
        slot.admission_decision_ref
      ) && result.paper_slot_outcome_ref.id ===
        slotOutcome.research_control_campaign_paper_slot_outcome_id &&
      result.paper_slot_outcome_digest === slotOutcome.slot_outcome_digest &&
      slotOutcome.schedule_ref.record_kind ===
        "research_control_campaign_paper_schedule" &&
      slotOutcome.schedule_ref.id ===
        schedule.research_control_campaign_paper_schedule_id &&
      slotOutcome.schedule_digest === schedule.schedule_digest &&
      slotOutcome.sequence === slot.sequence && slotOutcome.arm_kind === armKind &&
      paperTradingComparisonRefsEqual(slotOutcome.tick_ref, slot.tick_ref) &&
      paperTradingComparisonRefsEqual(
        slotOutcome.candidate_ref,
        slot.candidate_ref
      ) && paperTradingComparisonRefsEqual(
        slotOutcome.candidate_version_ref,
        slot.candidate_version_ref
      ) && paperTradingComparisonRefsEqual(
        slotOutcome.system_code_ref,
        slot.system_code_ref
      ) && slotOutcome.system_code_artifact_digest ===
        slot.system_code_artifact_digest &&
      paperTradingComparisonRefsEqual(
        slotOutcome.admission_decision_ref,
        slot.admission_decision_ref
      ) && slotOutcome.source_comparison_idempotency_key ===
        scheduleSlot.source_comparison_idempotency_key &&
      slotOutcome.source_preparation_id === scheduleSlot.source_preparation_id &&
      slotOutcome.source_comparison_commitment_id ===
        scheduleSlot.source_comparison_commitment_id &&
      result.terminal_status === slotOutcome.terminal_evidence.terminal_status &&
      Date.parse(adjudicatedAt) >= Date.parse(slotOutcome.terminal_at);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameResearchBehaviorFingerprintKey(
  left: ResearchBehaviorFingerprintRecord,
  right: ResearchBehaviorFingerprintRecord
): boolean {
  return left.protocol_version === right.protocol_version &&
    left.development_suite_version === right.development_suite_version &&
    left.development_suite_digest === right.development_suite_digest &&
    left.fingerprint_digest === right.fingerprint_digest;
}

function samePersistedComparisonRecord(left: unknown, right: unknown): boolean {
  try {
    return paperTradingComparisonPersistedRecordDigestInput(left) ===
      paperTradingComparisonPersistedRecordDigestInput(right);
  } catch {
    return false;
  }
}

function sameOptionalPersistedComparisonValue(left: unknown, right: unknown): boolean {
  return left === undefined && right === undefined ||
    samePersistedComparisonRecord(left, right);
}

function latestPaperTradingComparisonActivationSideResult(
  results: PaperTradingComparisonActivationSideResultRecord[],
  role: "champion" | "challenger"
): PaperTradingComparisonActivationSideResultRecord | undefined {
  return results
    .filter((result) => result.role === role)
    .sort((left, right) =>
      left.operation_sequence - right.operation_sequence ||
      left.paper_trading_comparison_activation_side_result_id.localeCompare(
        right.paper_trading_comparison_activation_side_result_id
      ))
    .at(-1);
}

function isMissingFileError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isMissingEvaluationLinkError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.startsWith("evaluation comparison set missing") ||
    error.message.startsWith("evidence sealing decision missing")
  );
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined)
  ) as T;
}

function stableSuffix(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function comparePaperTradingEvaluations(
  a: PaperTradingEvaluationRecord,
  b: PaperTradingEvaluationRecord
): number {
  return a.started_at.localeCompare(b.started_at) ||
    a.paper_trading_evaluation_id.localeCompare(b.paper_trading_evaluation_id);
}

function comparePaperTradingObservations(
  a: PaperTradingObservationRecord,
  b: PaperTradingObservationRecord
): number {
  return a.sequence - b.sequence ||
    a.observed_at.localeCompare(b.observed_at) ||
    a.paper_trading_observation_id.localeCompare(b.paper_trading_observation_id);
}

function storeJsonFileName(id: string): string {
  return `${encodeURIComponent(id)}.json`;
}

interface LedgerRecordIds {
  orderIntent: string;
  gatewayDecision: string;
  executionAttempt: string;
}

function ledgerRecordIds(input: {
  candidate_id: string;
  candidate_version_id: string;
  runtime_id: string;
  idempotency_key: string;
}): LedgerRecordIds {
  const suffix = stableSuffix([
    input.candidate_id,
    input.candidate_version_id,
    input.runtime_id,
    input.idempotency_key
  ].join(":"));
  return {
    orderIntent: `order-request-${suffix}`,
    gatewayDecision: `gateway-result-${suffix}`,
    executionAttempt: `execution-result-${suffix}`
  };
}

interface RunControlAuditRecordIds {
  command: string;
  decision: string;
  auditEvent: string;
}

function runtimeControlAuditRecordIds(input: {
  candidate_id: string;
  candidate_version_id: string;
  runtime_id: string;
  idempotency_key: string;
}): RunControlAuditRecordIds {
  const suffix = stableSuffix([
    input.candidate_id,
    input.candidate_version_id,
    input.runtime_id,
    input.idempotency_key
  ].join(":"));
  return {
    command: `run-control-command-${suffix}`,
    decision: `run-control-decision-${suffix}`,
    auditEvent: `runtime-audit-event-${suffix}`
  };
}

function privateReadinessPostureRecordId(idempotencyKey: string): string {
  return `local-binance-btcusdt-private-readiness-posture-${stableSuffix(idempotencyKey)}`;
}

function runtimeControlAuthorityStatusForOutcome(
  outcome: RunControlDecisionOutcome
): RunControlAuthorityStatus {
  if (outcome === "dry_run_only") {
    return "dry_run_only";
  }
  if (outcome === "no_live_authority") {
    return "not_live";
  }
  return "control_only";
}

function gatewayDecisionAuthorityStatusForOutcome(
  outcome: GatewayResultOutcome
): GatewayResultAuthorityStatus {
  if (outcome === "dry_run_only") {
    return "dry_run_only";
  }
  return "not_live";
}

function executionAttemptStatusForDecision(outcome: GatewayResultOutcome): ExecutionResultStatus {
  if (outcome === "dry_run_only") {
    return "dry_run_recorded";
  }
  if (outcome === "rejected") {
    return "blocked";
  }
  return "not_submitted";
}

function executionAttemptAuthorityStatusForStatus(
  status: ExecutionResultStatus,
  outcome: GatewayResultOutcome
): ExecutionResultAuthorityStatus {
  if (status === "dry_run_recorded" || outcome === "dry_run_only") {
    return "dry_run_only";
  }
  if (status === "not_submitted" || status === "blocked") {
    return "not_submitted";
  }
  return "not_live";
}

function appendUniqueRefs(existing: Ref[] | undefined, next: Ref | Ref[] | undefined): Ref[] {
  let refs = existing ?? [];
  const nextRefs = Array.isArray(next) ? next : next ? [next] : [];
  for (const nextRef of nextRefs) {
    if (!refs.some((candidate) => candidate.record_kind === nextRef.record_kind && candidate.id === nextRef.id)) {
      refs = [...refs, nextRef];
    }
  }
  return refs;
}

function evidenceSealingDecisionRecordId(input: {
  evaluation_run_record_id: string;
  idempotency_key: string;
}): string {
  return `evidence-sealing-decision-${stableSuffix(`${input.evaluation_run_record_id}:${input.idempotency_key}`)}`;
}

function evidenceClassificationRecordId(input: {
  evaluation_run_record_id: string;
  classification_kind: EvidenceClassificationKind;
  classified_ref: Ref;
  reason: EvidenceDispositionReason;
  sealing_decision_id: string;
}): string {
  return `evidence-classification-${stableSuffix([
    input.evaluation_run_record_id,
    input.classification_kind,
    input.classified_ref.record_kind,
    input.classified_ref.id,
    input.reason,
    input.sealing_decision_id
  ].join(":"))}`;
}

function validateImprovementProposalMaterializationInput(
  input: ImprovementProposalMaterializationInput
): ImprovementProposalMaterializationFailureReason | undefined {
  if (!input || typeof input !== "object") {
    return "provider_output_schema_invalid";
  }

  const raw = input as Partial<ImprovementProposalMaterializationInput>;
  const result = raw.provider_result as
    | Partial<ImprovementProposalMaterializationInput["provider_result"]>
    | undefined;
  const provider = (result?.provider ?? {}) as Partial<ImprovementProposalProviderAttribution>;
  const output = (result?.output ?? {}) as Partial<ImprovementProposalProviderOutput>;

  if (
    !nonEmpty(raw.idempotency_key) ||
    result?.status !== "succeeded" ||
    !isProviderKind(provider.provider_kind) ||
    !nonEmpty(provider.model) ||
    !nonEmpty(provider.invocation_surface) ||
    !isRef(result.agent_run_ref, "agent_run") ||
    !Array.isArray(result.agent_event_refs) ||
    result.agent_event_refs.length === 0 ||
    !result.agent_event_refs.every((item) => isRef(item, "agent_event")) ||
    !isRef(result.trace_ref, "trace_placeholder") ||
    !isRequiredRefArray(result.provider_output_artifact_refs) ||
    !isRequiredRefArray(result.debug_artifact_refs) ||
    !nonEmpty(result.idempotency_key) ||
    result.authority_status !== "proposal_input_only" ||
    output.output_kind !== "improvement_proposal_input" ||
    !isRef(output.trading_evaluation_task_ref, "trading_evaluation_task") ||
    !Array.isArray(output.source_finding_refs) ||
    output.source_finding_refs.length === 0 ||
    !output.source_finding_refs.every((item) => isRef(item, "research_finding")) ||
    (
      output.anti_hacking_finding_refs !== undefined &&
      (
        !Array.isArray(output.anti_hacking_finding_refs) ||
        !output.anti_hacking_finding_refs.every((item) => isRef(item, "research_finding"))
      )
    ) ||
    (
      output.parent_system_code_ref !== undefined &&
      !isRef(output.parent_system_code_ref, "system_code")
    ) ||
    !nonEmpty(output.proposal_summary) ||
    !nonEmpty(output.requested_change_summary) ||
    (
      output.expected_improvement_summary !== undefined &&
      !nonEmpty(output.expected_improvement_summary)
    ) ||
    !Array.isArray(output.proposed_artifact_refs) ||
    output.proposed_artifact_refs.length === 0 ||
    !output.proposed_artifact_refs.every((item) => isRef(item)) ||
    output.output_authority_status !== "proposal_input_only" ||
    (raw.artifact_path !== undefined && !nonEmpty(raw.artifact_path)) ||
    (
      raw.artifact_runtime_contract_ref !== undefined &&
      !isRef(raw.artifact_runtime_contract_ref, "artifact_runtime_contract")
    ) ||
    (raw.secret_policy_ref !== undefined && !isRef(raw.secret_policy_ref, "secret_policy")) ||
    (
      raw.capability_policy_ref !== undefined &&
      !isRef(raw.capability_policy_ref, "capability_policy")
    ) ||
    (raw.created_at !== undefined && !nonEmpty(raw.created_at))
  ) {
    return "provider_output_schema_invalid";
  }

  if (containsForbiddenImprovementProposalProviderOutputKey(result)) {
    return "provider_output_rejected";
  }

  return undefined;
}

function validateCandidateMaterializationInput(
  input: CandidateMaterializationInput
): CandidateMaterializationFailureReason | undefined {
  if (!input || typeof input !== "object") {
    return "schema_invalid";
  }

  const candidateInput = input as Partial<CandidateMaterializationInput>;
  const provider = (candidateInput.provider ?? {}) as Partial<CandidateMaterializationInput["provider"]>;
  const candidate = (candidateInput.candidate ?? {}) as Partial<CandidateMaterializationInput["candidate"]>;
  const spec = (candidateInput.spec ?? {}) as Partial<CandidateMaterializationInput["spec"]>;
  const program = (candidateInput.program ?? {}) as Partial<CandidateMaterializationInput["program"]>;
  const capabilityPackage = (candidateInput.capability_package ?? {}) as Partial<CandidateMaterializationInput["capability_package"]>;

  if (
    !nonEmpty(candidateInput.idempotency_key) ||
    !nonEmpty(provider.agent_run_id) ||
    !nonEmpty(provider.agent_event_id) ||
    !nonEmpty(provider.trace_id) ||
    !nonEmpty(provider.output_artifact_hash) ||
    !nonEmpty(candidate.title) ||
    !nonEmpty(candidate.system_summary) ||
    !nonEmpty(spec.summary) ||
    !nonEmpty(program.summary) ||
    !nonEmpty(program.declared_runtime) ||
    !Array.isArray(program.declared_outputs) ||
    program.declared_outputs.length === 0 ||
    !nonEmpty(capabilityPackage.summary)
  ) {
    return "schema_invalid";
  }

  const supportedSpec = (
    spec.market === "ExternalTradingApiProvider" &&
    spec.instrument === "generic trading instruments"
  ) || (
    spec.market === "Binance USD-M Futures" &&
    spec.instrument === "BTCUSDT"
  );

  if (
    candidate.first_market_scope !== "external_trading_api_fixture" ||
    !supportedSpec ||
    (candidateInput.system_code_ref !== undefined && !isRef(candidateInput.system_code_ref, "system_code")) ||
    containsForbiddenMaterializationKey(input)
  ) {
    return "materialization_rejected";
  }

  return undefined;
}

function researchControlStudyConditionForCampaign(
  campaign: ResearchControlCampaignRecord
): ResearchControlStudyCondition {
  const condition: ResearchControlStudyCondition = {
    source: structuredClone(campaign.source),
    research_agent: structuredClone(campaign.research_agent),
    paper_comparator: structuredClone(campaign.paper_comparator) as
      ResearchControlStudyCondition["paper_comparator"],
    paper_evaluation_protocol: structuredClone(
      campaign.paper_evaluation_protocol
    ) as ResearchControlStudyCondition["paper_evaluation_protocol"],
    allocation_policy: structuredClone(campaign.allocation_policy),
    allocation_policy_digest: campaign.allocation_policy_digest,
    campaign_policy: structuredClone(campaign.policy),
    condition_digest: `sha256:${"0".repeat(64)}`
  };
  condition.condition_digest = comparisonExactRecordDigest(
    researchControlStudyConditionDigestInput(condition)
  );
  return condition;
}

function researchControlCampaignIdForStudyKey(key: string): string {
  const canonical = exactStudyKey(key);
  return `research-control-campaign-${safeStudyId(canonical, 48)}-${
    createHash("sha256").update(canonical).digest("hex").slice(0, 12)
  }`;
}

function researchGeneralizationProtocolHasDeterministicIdentities(
  protocol: ResearchGeneralizationProtocolRecord
): boolean {
  if (protocol.research_generalization_protocol_id !==
    researchGeneralizationProtocolIdForKey(protocol.idempotency_key)) {
    return false;
  }
  return protocol.study_slots.every((slot) => {
    const expectedStudyKey = `${protocol.idempotency_key}:${
      slot.condition_block
    }:${slot.condition_block_study_index}`;
    return slot.study_idempotency_key === expectedStudyKey &&
      slot.study_ref.id === researchControlStudyIdForKey(expectedStudyKey) &&
      slot.replication_idempotency_keys.every((key, index) =>
        key === `${expectedStudyKey}:replication:${index + 1}`
      );
  });
}

function researchGeneralizationProtocolIdForKey(key: string): string {
  const canonical = exactStudyKey(key);
  return `research-generalization-protocol-${safeStudyId(canonical, 48)}-${
    createHash("sha256").update(canonical).digest("hex").slice(0, 12)
  }`;
}

function researchControlStudyIdForKey(key: string): string {
  const canonical = exactStudyKey(key);
  return `research-control-study-${safeStudyId(canonical, 48)}-${
    createHash("sha256").update(canonical).digest("hex").slice(0, 12)
  }`;
}

function researchControlStudyOutcomeIdForStudy(studyId: string): string {
  const canonical = exactStudyKey(studyId);
  return `research-control-study-outcome-${
    createHash("sha256").update(canonical).digest("hex").slice(0, 20)
  }`;
}

function researchMemoryControlStudyIdForKey(key: string): string {
  const canonical = exactStudyKey(key);
  return `research-memory-control-study-${
    createHash("sha256").update(canonical).digest("hex").slice(0, 20)
  }`;
}

function researchMemoryControlPairOutcomeIdForPair(
  studyId: string,
  pairIndex: number
): string {
  const key = `${exactStudyKey(studyId)}:${pairIndex}`;
  return `research-memory-control-pair-outcome-${
    createHash("sha256").update(key).digest("hex").slice(0, 20)
  }`;
}

function researchMemoryControlPairSourceGraphId(
  pairOutcomeId: string
): string {
  return `research-memory-control-pair-source-graph-${
    createHash("sha256").update(exactStudyKey(pairOutcomeId)).digest("hex")
      .slice(0, 20)
  }`;
}

function researchMemoryControlPairSourceGraphDigestInput(
  record: ResearchMemoryControlPairSourceGraphRecord
): string {
  const { source_graph_digest: _digest, ...payload } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

function researchMemoryControlStudyOutcomeIdForStudy(
  studyId: string
): string {
  return `research-memory-control-study-outcome-${
    createHash("sha256").update(exactStudyKey(studyId)).digest("hex")
      .slice(0, 20)
  }`;
}

function researchMemoryControlPairMatchesStudy(
  outcome: ResearchMemoryControlPairOutcomeRecord,
  study: ResearchMemoryControlStudyRecord
): boolean {
  const plan = study.pair_plans[outcome.pair_index - 1];
  if (!plan || plan.pair_index !== outcome.pair_index ||
    outcome.study_ref.record_kind !== "research_memory_control_study" ||
    outcome.study_ref.id !== study.research_memory_control_study_id ||
    outcome.study_digest !== study.study_digest ||
    outcome.pair_plan_digest !== comparisonExactRecordDigest(
      paperTradingComparisonPersistedRecordDigestInput(plan)
    ) || outcome.research_direction_ref.record_kind !== "research_direction" ||
    outcome.research_direction_ref.id !== plan.research_direction_ref.id ||
    outcome.direction_kind !== plan.direction_kind ||
    Date.parse(outcome.terminal_at) < Date.parse(study.committed_at)) {
    return false;
  }
  const expectedProviderKind = study.research_agent.provider === "codex"
    ? "codex_cli"
    : study.research_agent.provider === "claude_code"
    ? "claude_code"
    : "fixture_only";
  const arms = [
    [outcome.released_memory, plan.released_memory_treatment],
    [outcome.memory_masked, plan.memory_masked_control]
  ] as const;
  return arms.every(([arm, armPlan]) => {
    if (arm.arm_kind !== armPlan.arm_kind ||
      arm.memory_mode !== armPlan.memory_mode ||
      arm.planned_tick_id !== armPlan.tick_id) {
      return false;
    }
    const malformed = arm.ineligibility_reason === "malformed_evidence_graph";
    const worker = arm.worker_evidence;
    const allocation = arm.allocation_evidence;
    const preflight = arm.preflight_evidence;
    const beforeAnyEffect = researchMemoryControlArmFailedBeforeAnyEffect(arm);
    if (!malformed && !beforeAnyEffect && (!worker || !allocation || !preflight ||
      worker.agent_profile_id !== study.research_agent_profile_id ||
      worker.provider_kind !== expectedProviderKind ||
      worker.model !== study.research_agent.model ||
      allocation.direction_kind !== plan.direction_kind ||
      allocation.allocation_mode !== "explicit" ||
      allocation.selection_kind !== "explicit" ||
      allocation.experiment_budget !== 1)) {
      return false;
    }
    if (!preflight) return malformed || beforeAnyEffect;
    const assignment = preflight.memory_policy.control_assignment;
    const opportunityMatches = preflight.development_suite_version ===
        study.opportunity_protocol.development_suite_version &&
      preflight.development_suite_digest ===
        study.opportunity_protocol.development_suite_digest &&
      preflight.sealed_suite_version ===
        study.opportunity_protocol.sealed_suite_version &&
      preflight.sealed_generator_version ===
        study.opportunity_protocol.sealed_generator_version &&
      preflight.sealed_rotation_commitment_digest ===
        study.opportunity_protocol.sealed_rotation_commitment_digest &&
      preflight.sealed_suite_digest ===
        study.opportunity_protocol.sealed_suite_digest;
    const assignmentMatches = assignment?.study_ref.id ===
        study.research_memory_control_study_id &&
      assignment.study_digest === study.study_digest &&
      assignment.pair_index === plan.pair_index &&
      assignment.arm_kind === armPlan.arm_kind &&
      preflight.memory_policy.memory_mode === armPlan.memory_mode;
    return malformed || (opportunityMatches && assignmentMatches);
  });
}

function researchMemoryControlArmFailedBeforeAnyEffect(
  arm: ResearchMemoryControlPairOutcomeRecord["released_memory"]
): boolean {
  const terminalReasonMatches =
    (arm.terminal_status === "interrupted" &&
      arm.ineligibility_reason === "interrupted_or_unpaired_run") ||
    (arm.terminal_status === "platform_failed" &&
      arm.ineligibility_reason === "worker_or_platform_failure");
  const resource = arm.resource_summary;
  return terminalReasonMatches && arm.tick_evidence === null &&
    arm.preflight_evidence === null && arm.worker_evidence === null &&
    arm.allocation_evidence === null && arm.admission_evidence === null &&
    resource !== null && resource.provider_request_total === 0 &&
    resource.runner_command_total === 0 && resource.scenario_count === 0 &&
    resource.elapsed_ms === 0;
}

function researchGeneralizationOutcomeIdForProtocol(
  protocolId: string
): string {
  const canonical = exactStudyKey(protocolId);
  return `research-generalization-outcome-${
    createHash("sha256").update(canonical).digest("hex").slice(0, 20)
  }`;
}

function researchGeneralizationPolicyDecisionIdForOutcome(
  outcomeId: string
): string {
  const canonical = exactStudyKey(outcomeId);
  return `research-generalization-policy-decision-${
    createHash("sha256").update(canonical).digest("hex").slice(0, 20)
  }`;
}

function researchGeneralizationStudySpacingViolations(
  protocol: ResearchGeneralizationProtocolRecord,
  studies: ResearchControlStudyRecord[]
): Set<string> {
  const violations = new Set<string>();
  const ordered = [...studies].sort((left, right) =>
    left.committed_at.localeCompare(right.committed_at) ||
    left.research_control_study_id.localeCompare(
      right.research_control_study_id
    )
  );
  for (let index = 1; index < ordered.length; index += 1) {
    if (Date.parse(ordered[index]!.committed_at) -
      Date.parse(ordered[index - 1]!.committed_at) <
        protocol.timing_policy.minimum_study_commitment_interval_ms) {
      violations.add(ordered[index]!.research_control_study_id);
    }
  }
  return violations;
}

function researchAllocationPolicyDecisionIdForOutcome(
  outcomeId: string
): string {
  const canonical = exactStudyKey(outcomeId);
  return `research-allocation-policy-decision-${
    createHash("sha256").update(canonical).digest("hex").slice(0, 20)
  }`;
}

function researchAllocationPolicyDecisionIsApproved(
  study: ResearchControlStudyRecord,
  outcome: ResearchControlStudyOutcomeRecord
): boolean {
  return outcome.inference_status === "adaptive_effect_supported" &&
    outcome.policy_decision_eligibility ===
      "eligible_for_separate_policy_decision" &&
    outcome.causal_scope === "same_baseline_stochastic_replication_only" &&
    outcome.non_tied_count >=
      study.analysis_policy.minimum_non_tied_replication_count &&
    outcome.adaptive_positive_count > outcome.static_positive_count &&
    outcome.exact_sign_test_p_value <= study.analysis_policy.alpha &&
    outcome.mean_rate_difference >
      study.analysis_policy.minimum_mean_rate_difference;
}

function researchGeneralizationPolicyDecisionIsApproved(
  protocol: ResearchGeneralizationProtocolRecord,
  outcome: ResearchGeneralizationOutcomeRecord
): boolean {
  return outcome.inference_status === "generalization_supported" &&
    outcome.policy_decision_eligibility ===
      "eligible_for_separate_generalization_policy_decision" &&
    outcome.causal_scope ===
      "pre_effect_market_condition_blocked_cross_baseline_study_effects" &&
    outcome.completed_study_count ===
      protocol.analysis_policy.minimum_terminal_study_count &&
    outcome.non_tied_study_count ===
      protocol.analysis_policy.minimum_non_tied_study_count &&
    outcome.missing_study_count === 0 &&
    outcome.ineligible_study_count === 0 &&
    outcome.distinct_baseline_count >=
      protocol.analysis_policy.minimum_distinct_baseline_count &&
    outcome.exact_sign_test_p_value <= protocol.analysis_policy.alpha &&
    outcome.equal_weight_mean_rate_difference !== null &&
    outcome.equal_weight_mean_rate_difference > 0 &&
    outcome.harmful_condition_blocks.length === 0 &&
    outcome.block_results.every((block) =>
      block.block_status === "complete_positive"
    );
}

function exactStudyKey(value: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    return "invalid";
  }
  return value;
}

function safeStudyId(value: string, maxLength: number): string {
  let normalized = "";
  let insertedSeparator = false;
  for (const character of value) {
    if (/^[A-Za-z0-9_-]$/.test(character)) {
      normalized += character;
      insertedSeparator = false;
    } else if (!insertedSeparator) {
      normalized += "-";
      insertedSeparator = true;
    }
    if (normalized.length > maxLength) break;
  }
  const trimmed = normalized.replace(/^-+|-+$/g, "");
  return trimmed.slice(0, maxLength) || "empty";
}

function comparisonExactRecordDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function localPaperTradingComparisonResearchReleaseDecision(
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
): {
  releaseKind: PaperTradingComparisonResearchReleaseKind;
  findingKind: ResearchFindingRecord["finding_kind"];
  summary: string;
  nextResearchFocus: string;
} {
  let releaseKind: PaperTradingComparisonResearchReleaseKind;
  let findingKind: ResearchFindingRecord["finding_kind"];
  let nextResearchFocus: string;
  if (outcome.campaign_outcome === "confirmed_improvement") {
    releaseKind = "confirmed_improvement";
    findingKind = "positive_result";
    nextResearchFocus =
      "Preserve the confirmed artifact lineage and generate controlled variants under new prospective evidence.";
  } else if (outcome.not_improved_count > 0) {
    releaseKind = "challenger_not_reproduced";
    findingKind = "negative_result";
    nextResearchFocus =
      "Explain non-reproduction, preserve the negative result, and generate differentiated candidates under new prospective evidence.";
  } else if (outcome.ineligible_count > 0) {
    releaseKind = "comparison_evidence_ineligible";
    findingKind = "failure_analysis";
    nextResearchFocus =
      "Repair comparison evidence and protocol quality before making an economic interpretation.";
  } else {
    releaseKind = "campaign_slot_expired";
    findingKind = "failure_analysis";
    nextResearchFocus =
      "Repair campaign scheduling and recovery before making an economic interpretation.";
  }
  return {
    releaseKind,
    findingKind,
    summary: `Paper comparison confirmation campaign ${outcome.campaign_ref.id}: ` +
      `improved=${outcome.improved_count}, ` +
      `not_improved=${outcome.not_improved_count}, ` +
      `ineligible=${outcome.ineligible_count}, ` +
      `expired=${outcome.expired_count}; release=${releaseKind}.`,
    nextResearchFocus
  };
}

function paperTradingComparisonIdsForIdempotencyKey(idempotencyKey: string): {
  preparationId: string;
  comparisonId: string;
} {
  const suffix = createHash("sha256")
    .update(idempotencyKey)
    .digest("hex")
    .slice(0, 16);
  return {
    preparationId: `paper-trading-comparison-preparation-${suffix}`,
    comparisonId: `paper-trading-comparison-${suffix}`
  };
}

function researchControlCampaignPaperScheduleIdForReport(
  report: ResearchControlCampaignReportRecord
): string {
  const suffix = createHash("sha256")
    .update(report.research_control_campaign_report_id)
    .digest("hex")
    .slice(0, 20);
  return `research-control-campaign-paper-schedule-${suffix}`;
}

function researchControlCampaignPaperStartBatchIdFor(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  sequence: number
): string {
  const suffix = createHash("sha256")
    .update(`${schedule.research_control_campaign_paper_schedule_id}:${sequence}`)
    .digest("hex")
    .slice(0, 20);
  return `research-control-campaign-paper-start-batch-${suffix}`;
}

function researchControlCampaignPaperSlotOutcomeIdFor(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  armKind: ResearchControlCampaignPaperSlotOutcomeRecord["arm_kind"],
  sequence: number
): string {
  const suffix = createHash("sha256")
    .update([
      schedule.research_control_campaign_paper_schedule_id,
      armKind,
      String(sequence)
    ].join(":"))
    .digest("hex")
    .slice(0, 20);
  return `research-control-campaign-paper-slot-outcome-${suffix}`;
}

function withLocalCheckpointTransactionDigest(
  transaction: LocalPaperTradingComparisonCheckpointTransaction
): LocalPaperTradingComparisonCheckpointTransaction {
  const { transaction_digest: _digest, ...payload } = transaction;
  return {
    ...transaction,
    transaction_digest: comparisonExactRecordDigest(
      paperTradingComparisonPersistedRecordDigestInput(payload)
    )
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function isProviderKind(value: unknown): value is ProviderKind {
  return (
    value === "codex_cli" ||
    value === "claude_code" ||
    value === "local_process" ||
    value === "fixture_only"
  );
}

function containsForbiddenImprovementProposalProviderOutputKey(value: unknown): boolean {
  const forbiddenKeys = new Set([
    "evidence",
    "evidence_record",
    "counted_evidence",
    "promotion",
    "promotion_decision",
    "live_approval",
    "exchange_credentials",
    "provider_api_key",
    "gateway_signing_material",
    "direct_exchange_order",
    "paper_order_authority",
    "live_order_authority",
    "strategy_internals",
    "strategy_schema",
    "venue_adapter",
    "venue_adapter_assumptions"
  ]);

  if (Array.isArray(value)) {
    return value.some(containsForbiddenImprovementProposalProviderOutputKey);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
      const normalized = key.toLowerCase();
      return forbiddenKeys.has(normalized) || containsForbiddenImprovementProposalProviderOutputKey(child);
    });
  }
  return false;
}

function containsForbiddenMaterializationKey(value: unknown): boolean {
  const forbiddenKeys = new Set([
    "evidence",
    "evidence_record",
    "promotion",
    "promotion_decision",
    "live_approval",
    "exchange_credentials",
    "provider_api_key",
    "gateway_signing_material",
    "direct_exchange_order"
  ]);

  if (Array.isArray(value)) {
    return value.some(containsForbiddenMaterializationKey);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
      const normalized = key.toLowerCase();
      return forbiddenKeys.has(normalized) || containsForbiddenMaterializationKey(child);
    });
  }
  return false;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function sameResearchMemoryControlPublicationLockOwner(
  left: ResearchMemoryControlPublicationLockOwner,
  right: ResearchMemoryControlPublicationLockOwner
): boolean {
  return left.token === right.token && left.pid === right.pid &&
    left.acquired_at === right.acquired_at;
}

function researchMemoryControlPublicationOwnerIsAlive(
  owner: ResearchMemoryControlPublicationLockOwner
): boolean {
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code !== "ESRCH";
  }
}

async function waitForResearchMemoryControlPublicationLock(): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(
      resolve,
      RESEARCH_MEMORY_CONTROL_PUBLICATION_LOCK_RETRY_MS
    );
    timer.unref?.();
  });
}
