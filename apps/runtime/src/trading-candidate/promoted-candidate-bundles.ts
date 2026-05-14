import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  CandidateEvaluationReadModel,
  CandidateInspectReadModel,
  CandidateSummaryReadModel,
  CandidateVersionRecord,
  PlaceholderSummary,
  Ref,
  RunnableArtifactRecord,
  TraderSystemCandidateRecord
} from "@ouroboros/domain";

export const DEFAULT_PROMOTED_CANDIDATE_ROOT = path.join(".ouroboros", "trader-system-candidates");

export interface PromotedCandidateBundleInput {
  root?: string;
}

export interface GetPromotedCandidateInput extends PromotedCandidateBundleInput {
  candidate_id: string;
}

interface PromotedCandidateBundle {
  candidate: TraderSystemCandidateRecord;
  version: CandidateVersionRecord;
  runnableArtifact: RunnableArtifactRecord;
  promotion?: PromotedCandidatePromotionRecord;
}

interface PromotedCandidatePromotionRecord {
  record_kind?: unknown;
  promotion_id?: unknown;
  gate?: unknown;
  artifact_digest?: unknown;
  promoted_at?: unknown;
  evidence_disposition?: unknown;
  authority_status?: unknown;
  artifact_manifest?: {
    id?: unknown;
    name?: unknown;
    entrypoint?: unknown;
    api_contract?: unknown;
  };
  evidence_summary?: {
    scenario_accepted?: unknown;
    scenario_total?: unknown;
    provider_request_total?: unknown;
    runner_command_total?: unknown;
  };
  no_authority?: {
    live_exchange?: unknown;
    order_authority?: unknown;
    credentials?: unknown;
    paper_trading?: unknown;
  };
}

export async function listPromotedCandidateSummaries(
  input: PromotedCandidateBundleInput = {}
): Promise<CandidateSummaryReadModel[]> {
  return (await listPromotedCandidates(input)).map(toSummaryReadModel);
}

export async function getPromotedCandidate(
  input: GetPromotedCandidateInput
): Promise<CandidateInspectReadModel | undefined> {
  const bundle = await readPromotedCandidateBundle(path.join(resolveRoot(input.root), input.candidate_id));
  return bundle ? toInspectReadModel(bundle) : undefined;
}

async function listPromotedCandidates(
  input: PromotedCandidateBundleInput = {}
): Promise<CandidateInspectReadModel[]> {
  const root = resolveRoot(input.root);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const candidates: CandidateInspectReadModel[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const bundle = await readPromotedCandidateBundle(path.join(root, entry.name));
    if (bundle) {
      candidates.push(toInspectReadModel(bundle));
    }
  }

  return candidates.sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
}

async function readPromotedCandidateBundle(
  bundleDir: string
): Promise<PromotedCandidateBundle | undefined> {
  const candidate = await readOptionalJson<TraderSystemCandidateRecord>(
    path.join(bundleDir, "candidate.json")
  );
  const version = await readOptionalJson<CandidateVersionRecord>(
    path.join(bundleDir, "candidate-version.json")
  );
  const runnableArtifact = await readOptionalJson<RunnableArtifactRecord>(
    path.join(bundleDir, "runnable-artifact.json")
  );
  if (!candidate || !version || !runnableArtifact) {
    return undefined;
  }
  if (!isPromotedCandidateBundle(candidate, version, runnableArtifact)) {
    return undefined;
  }

  const promotion = await readOptionalJson<PromotedCandidatePromotionRecord>(
    path.join(bundleDir, "promotion.json")
  );
  return {
    candidate,
    version,
    runnableArtifact,
    promotion
  };
}

function toSummaryReadModel(candidate: CandidateInspectReadModel): CandidateSummaryReadModel {
  return {
    candidate_id: candidate.candidate_id,
    display_name: candidate.display_name,
    status: candidate.status,
    active_version_id: candidate.active_version_id,
    fixture_notice: candidate.fixture_notice
  };
}

function toInspectReadModel(bundle: PromotedCandidateBundle): CandidateInspectReadModel {
  const { candidate, version, runnableArtifact, promotion } = bundle;
  const capabilityRef = version.capability_package_refs[0] ?? ref(
    "capability_package",
    `${candidate.candidate_id}-capabilities`
  );
  const artifactManifestId = stringValue(promotion?.artifact_manifest?.id)
    ?? runnableArtifact.runnable_artifact_id;
  const artifactDigest = stringValue(promotion?.artifact_digest) ?? runnableArtifact.artifact_digest;
  const entrypoint = Array.isArray(runnableArtifact.entrypoint)
    ? runnableArtifact.entrypoint.filter((item): item is string => typeof item === "string")
    : [];

  return {
    candidate_id: candidate.candidate_id,
    display_name: candidate.display_name,
    status: candidate.status,
    active_version_id: candidate.active_version_id,
    fixture_notice: {
      mode: "local_promoted_candidate_bundle",
      label: "Promoted local candidate bundle",
      statements: [
        "Read-only TraderSystemCandidate bundle promoted from Trading AAR.",
        "No exchange credentials or order authority are mounted.",
        "Candidate-run evidence is replay-only and not counted trading authority."
      ]
    },
    candidate_version: {
      candidate_version_id: version.candidate_version_id,
      version_label: version.version_label,
      provenance_refs: candidate.provenance_refs,
      materialization_attempt_ref: version.materialization_attempt_ref
    },
    spec: {
      ref: version.spec_ref,
      summary: candidate.system_summary ?? candidate.title ?? "Promoted Trading AAR candidate.",
      market: "External trading API provider",
      instrument: "Trading system",
      supported_stage_binding_profiles: ["backtest"]
    },
    program: {
      ref: version.program_ref,
      summary: [
        stringValue(promotion?.artifact_manifest?.name) ?? "Promoted runnable artifact",
        artifactDigest
      ].join(" / "),
      manifest: {
        ref: ref("program_manifest", `${artifactManifestId}-manifest`),
        declared_runtime: [
          runnableArtifact.runtime_kind,
          entrypoint.join(" ")
        ].filter(Boolean).join(" "),
        declared_outputs: runnableArtifact.declared_output_contract.declared_output_kinds
      },
      validation: statusPlaceholder(
        ref("program_validation_record", `${runnableArtifact.runnable_artifact_id}-promotion-validation`),
        "Program validation",
        "promoted_from_seeded_stability_gate",
        "not_counted"
      )
    },
    capability_package: {
      ref: capabilityRef,
      summary: "Read-only replay capability for promoted local candidate artifacts.",
      manifest: {
        ref: ref("capability_manifest", `${capabilityRef.id}-manifest`),
        allowed_stages: ["backtest"],
        declared_permissions: [
          stringValue(promotion?.artifact_manifest?.api_contract) ?? "trading_api_provider_v1"
        ],
        forbidden_contents: [
          "exchange_credentials",
          "live_order_submission",
          "paper_order_submission"
        ]
      },
      admission: statusPlaceholder(
        ref("capability_package_admission_record", `${capabilityRef.id}-admission`),
        "Capability admission",
        "promotion_record_read",
        "not_live"
      ),
      grant: statusPlaceholder(
        ref("capability_grant", `${capabilityRef.id}-grant`),
        "Capability grant",
        "not_granted",
        "not_granted"
      ),
      mount: statusPlaceholder(
        ref("capability_mount_record", `${capabilityRef.id}-mount`),
        "Capability mount",
        "not_mounted",
        "not_mounted"
      )
    },
    agent_provider: {
      agent_spec: statusPlaceholder(
        version.agent_spec_ref ?? ref("agent_spec", `${candidate.candidate_id}-promoted-agent-spec`),
        "Agent spec",
        "promoted_from_trading_aar",
        "not_executed"
      ),
      agent_session: statusPlaceholder(
        version.agent_session_ref ?? ref("agent_session", `${candidate.candidate_id}-promoted-agent-session`),
        "Agent session",
        "promoted_from_trading_aar",
        "not_live"
      ),
      agent_run: statusPlaceholder(
        version.agent_run_ref ?? ref("agent_run", `${candidate.candidate_id}-promoted-agent-run`),
        "Agent run",
        "source_trace_only",
        "not_counted"
      ),
      agent_event: statusPlaceholder(
        version.agent_event_ref ?? ref("agent_event", `${candidate.candidate_id}-promoted-agent-event`),
        "Agent event",
        "source_trace_only",
        "not_counted"
      ),
      provider_readiness: statusPlaceholder(
        version.provider_readiness_ref
          ?? ref("provider_readiness_record", `${candidate.candidate_id}-provider-readiness`),
        "Provider readiness",
        "not_probed",
        "not_probed"
      ),
      provider_probe_attempt: statusPlaceholder(
        version.provider_probe_attempt_ref
          ?? ref("provider_probe_attempt", `${candidate.candidate_id}-provider-probe`),
        "Provider probe",
        "not_probed",
        "not_probed"
      )
    },
    runtime: {
      ref: version.runtime_ref,
      stage_binding_profile: "backtest",
      runtime_lifecycle_status: "registered",
      authority_status: "not_live",
      placement: statusPlaceholder(
        ref("runtime_placement", `${version.runtime_ref.id}-placement`),
        "Runtime placement",
        "candidate_replay_only",
        "not_live"
      ),
      hands_environment: statusPlaceholder(
        ref("hands_environment", `${version.runtime_ref.id}-hands`),
        "Hands environment",
        "not_mounted",
        "not_mounted"
      ),
      memory_surface: {
        ref: ref("runtime_memory_surface", `${version.runtime_ref.id}-memory`),
        trust_class: "local_promoted_candidate_bundle",
        access_mode: "read_only",
        surface_version: "v1",
        visibility: "operator_visible",
        quarantine_status: noAuthoritySatisfied(promotion) ? "not_quarantined" : "review_required",
        authority_status: "not_evidence"
      }
    },
    trace: statusPlaceholder(
      version.trace_placeholder_ref,
      "Trace placeholder",
      "source_trace_only",
      "not_counted"
    ),
    evaluation: emptyCandidateEvaluationReadModel(version.evaluation_run_ref)
  };
}

function isPromotedCandidateBundle(
  candidate: TraderSystemCandidateRecord,
  version: CandidateVersionRecord,
  runnableArtifact: RunnableArtifactRecord
): boolean {
  return candidate.record_kind === "trader_system_candidate"
    && candidate.status === "materialized"
    && candidate.authority_status === "not_live"
    && version.record_kind === "candidate_version"
    && version.candidate_id === candidate.candidate_id
    && version.candidate_version_id === candidate.active_version_id
    && runnableArtifact.record_kind === "runnable_artifact"
    && runnableArtifact.authority_status === "not_live";
}

function noAuthoritySatisfied(promotion?: PromotedCandidatePromotionRecord): boolean {
  const noAuthority = promotion?.no_authority;
  if (!noAuthority) {
    return true;
  }
  return noAuthority.live_exchange === false
    && noAuthority.order_authority === false
    && noAuthority.credentials === false
    && noAuthority.paper_trading === false;
}

async function readOptionalJson<T>(pathname: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(pathname, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function emptyCandidateEvaluationReadModel(
  legacyRunRef?: Ref
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
      legacyRunRef ?? ref("evaluation_run_record", "none"),
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

function statusPlaceholder(
  placeholderRef: Ref,
  label: string,
  status: string,
  authorityStatus: string
): PlaceholderSummary {
  return {
    ref: placeholderRef,
    label,
    status,
    authority_status: authorityStatus
  };
}

function ref(recordKind: string, id: string): Ref {
  return {
    record_kind: recordKind,
    id
  };
}

function resolveRoot(root?: string): string {
  return path.resolve(root ?? DEFAULT_PROMOTED_CANDIDATE_ROOT);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
