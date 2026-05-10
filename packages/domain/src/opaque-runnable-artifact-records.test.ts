import { describe, expect, it } from "vitest";
import type {
  ArtifactRuntimeContractRecord,
  Ref,
  RunnableArtifactOutputContract,
  RunnableArtifactRecord,
  RuntimePlacementRecord,
  SandboxRuntimeInstanceRecord,
  TraderSystemCandidateRecord,
  TraderSystemRuntimeRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

const clockOutputContract = {
  contract_kind: "opaque_runtime_boundary",
  declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat"],
  event_envelope_ref: ref("program_event_contract", "opaque-clock-program-event-v1"),
  log_contract_ref: ref("runtime_log_contract", "opaque-clock-log-v1"),
  heartbeat_contract_ref: ref("runtime_heartbeat_contract", "opaque-clock-heartbeat-v1")
} satisfies RunnableArtifactOutputContract;

describe("opaque runnable artifact and sandbox instance contracts", () => {
  it("models a Python file runnable artifact without normalizing strategy internals", () => {
    const runtimeContract = {
      record_kind: "artifact_runtime_contract",
      version: 1,
      artifact_runtime_contract_id: "artifact-runtime-contract-python-clock-v1",
      runtime_kind: "python",
      entrypoint: ["python", "/workspace/clock.py"],
      declared_output_contract: clockOutputContract,
      secret_policy_ref: ref("secret_policy", "secret-policy-no-raw-values-v1"),
      capability_policy_ref: ref("capability_policy", "capability-policy-clock-fixture-v1"),
      created_at: "2026-05-10T12:00:00.000Z",
      authority_status: "contract_only"
    } satisfies ArtifactRuntimeContractRecord;

    const artifact = {
      record_kind: "runnable_artifact",
      version: 1,
      runnable_artifact_id: "runnable-artifact-python-clock-v1",
      artifact_kind: "python_file",
      artifact_path: "fixtures/trader-systems/clock.py",
      artifact_digest: "sha256:fixture-clock-python-artifact-v1",
      artifact_runtime_contract_ref: ref(
        "artifact_runtime_contract",
        runtimeContract.artifact_runtime_contract_id
      ),
      runtime_kind: runtimeContract.runtime_kind,
      entrypoint: runtimeContract.entrypoint,
      declared_output_contract: runtimeContract.declared_output_contract,
      secret_policy_ref: runtimeContract.secret_policy_ref,
      capability_policy_ref: runtimeContract.capability_policy_ref,
      provenance_refs: [ref("agent_run", "agent-run-authored-clock-v1")],
      status: "registered",
      created_at: "2026-05-10T12:00:01.000Z",
      authority_status: "not_live"
    } satisfies RunnableArtifactRecord;

    expect(artifact.runnable_artifact_id).toBe("runnable-artifact-python-clock-v1");
    expect(artifact.artifact_digest).toMatch(/^sha256:/);
    expect(artifact.artifact_path).toBe("fixtures/trader-systems/clock.py");
    expect(artifact.entrypoint).toEqual(["python", "/workspace/clock.py"]);
    expect(artifact.declared_output_contract.declared_output_kinds).toEqual([
      "program_event",
      "runtime_log",
      "runtime_heartbeat"
    ]);
    expect(artifact.secret_policy_ref.record_kind).toBe("secret_policy");
    expect(artifact.capability_policy_ref.record_kind).toBe("capability_policy");
    expect(Object.keys(artifact)).not.toContain("strategy_internals");
  });

  it("models an image-backed artifact and one sandbox runtime instance around it", () => {
    const imageArtifact = {
      record_kind: "runnable_artifact",
      version: 1,
      runnable_artifact_id: "runnable-artifact-image-clock-v1",
      artifact_kind: "container_image",
      image_ref: "registry.example.invalid/ouroboros/clock@sha256:fixture-clock-image-v1",
      artifact_digest: "sha256:fixture-clock-image-v1",
      runtime_kind: "container_image",
      entrypoint: ["/app/run-clock"],
      declared_output_contract: clockOutputContract,
      secret_policy_ref: ref("secret_policy", "secret-policy-no-raw-values-v1"),
      capability_policy_ref: ref("capability_policy", "capability-policy-clock-fixture-v1"),
      provenance_refs: [ref("agent_run", "agent-run-authored-clock-image-v1")],
      status: "registered",
      created_at: "2026-05-10T12:05:00.000Z",
      authority_status: "not_live"
    } satisfies RunnableArtifactRecord;

    const placement = {
      record_kind: "runtime_placement",
      version: 1,
      runtime_placement_id: "runtime-placement-docker-sandboxes-clock-v1",
      placement_kind: "containerized_remote",
      tooling_kind: "docker_sandbox",
      sandbox_template_ref: ref("sandbox_template", "docker-sandboxes-clock-template-v1"),
      authority_status: "not_launched"
    } satisfies RuntimePlacementRecord;

    const instance = {
      record_kind: "sandbox_runtime_instance",
      version: 1,
      sandbox_runtime_instance_id: "sandbox-runtime-instance-clock-alpha-v1",
      adapter_kind: "docker_sandboxes_sbx",
      runnable_artifact_ref: ref("runnable_artifact", imageArtifact.runnable_artifact_id),
      runtime_ref: ref("trader_system_runtime", "runtime-clock-paper-v1"),
      runtime_placement_ref: ref("runtime_placement", placement.runtime_placement_id),
      lifecycle_status: "running",
      sandbox_name: "sbx-clock-alpha",
      sandbox_ref: ref("docker_sandbox", "sbx-clock-alpha"),
      created_at: "2026-05-10T12:06:00.000Z",
      started_at: "2026-05-10T12:06:05.000Z",
      last_heartbeat_at: "2026-05-10T12:06:10.000Z",
      log_refs: [ref("runtime_log", "runtime-log-clock-alpha-v1")],
      heartbeat_refs: [ref("runtime_heartbeat", "runtime-heartbeat-clock-alpha-v1")],
      trace_ref: ref("trace_placeholder", "trace-clock-alpha-v1"),
      authority_status: "not_live"
    } satisfies SandboxRuntimeInstanceRecord;

    expect(imageArtifact.image_ref).toContain("@sha256:");
    expect(instance.runnable_artifact_ref).toEqual(
      ref("runnable_artifact", imageArtifact.runnable_artifact_id)
    );
    expect(instance.runtime_placement_ref).toEqual(
      ref("runtime_placement", placement.runtime_placement_id)
    );
    expect(instance.log_refs).toHaveLength(1);
    expect(instance.heartbeat_refs).toHaveLength(1);
    expect(instance.sandbox_name).not.toBe(imageArtifact.runnable_artifact_id);
  });

  it("lets candidate and logical runtime records reference artifact boundaries without making sandbox ids identity", () => {
    const artifactRef = ref("runnable_artifact", "runnable-artifact-python-clock-v1");
    const instanceRef = ref("sandbox_runtime_instance", "sandbox-runtime-instance-clock-alpha-v1");

    const candidate = {
      record_kind: "trader_system_candidate",
      version: 1,
      candidate_id: "candidate-opaque-clock",
      display_name: "Opaque clock trader-system candidate",
      status: "materialized",
      active_version_id: "candidate-version-opaque-clock-v1",
      provenance_refs: [ref("agent_run", "agent-run-authored-clock-v1")],
      active_runnable_artifact_ref: artifactRef
    } satisfies TraderSystemCandidateRecord;

    const runtime = {
      record_kind: "trader_system_runtime",
      version: 1,
      trader_system_runtime_id: "runtime-clock-paper-v1",
      stage_binding_profile: "paper",
      runtime_lifecycle_status: "running",
      candidate_ref: ref("trader_system_candidate", candidate.candidate_id),
      candidate_version_ref: ref("candidate_version", candidate.active_version_id),
      stage_binding_ref: ref("stage_binding", "stage-binding-clock-paper-v1"),
      placement_ref: ref("runtime_placement", "runtime-placement-docker-sandboxes-clock-v1"),
      hands_environment_ref: ref("hands_environment", "hands-environment-clock-v1"),
      memory_surface_ref: ref("runtime_memory_surface", "runtime-memory-clock-v1"),
      runtime_operating_policy_ref: ref("runtime_operating_policy", "runtime-policy-clock-v1"),
      trace_ref: ref("trace_placeholder", "trace-clock-alpha-v1"),
      runnable_artifact_ref: artifactRef,
      sandbox_runtime_instance_ref: instanceRef,
      created_at: "2026-05-10T12:07:00.000Z",
      authority_status: "not_live"
    } satisfies TraderSystemRuntimeRecord;

    expect(candidate.candidate_id).not.toBe(artifactRef.id);
    expect(runtime.trader_system_runtime_id).not.toBe(instanceRef.id);
    expect(runtime.trader_system_runtime_id).not.toBe(runtime.placement_ref.id);
    expect(runtime.runnable_artifact_ref).toEqual(artifactRef);
    expect(runtime.sandbox_runtime_instance_ref).toEqual(instanceRef);
  });
});

if (false) {
  const _artifactWithRawSecrets = {
    record_kind: "runnable_artifact",
    version: 1,
    runnable_artifact_id: "runnable-artifact-invalid-secret",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trader-systems/clock.py",
    artifact_digest: "sha256:fixture-clock-python-artifact-v1",
    runtime_kind: "python",
    entrypoint: ["python", "/workspace/clock.py"],
    declared_output_contract: clockOutputContract,
    secret_policy_ref: ref("secret_policy", "secret-policy-no-raw-values-v1"),
    capability_policy_ref: ref("capability_policy", "capability-policy-clock-fixture-v1"),
    provenance_refs: [],
    status: "registered",
    created_at: "2026-05-10T12:08:00.000Z",
    authority_status: "not_live",
    // @ts-expect-error raw secret material must stay outside artifact boundary records.
    raw_secret_values: { example_value: "redacted" }
  } satisfies RunnableArtifactRecord;

  const _artifactWithStrategyInternals = {
    record_kind: "runnable_artifact",
    version: 1,
    runnable_artifact_id: "runnable-artifact-invalid-strategy",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trader-systems/clock.py",
    artifact_digest: "sha256:fixture-clock-python-artifact-v1",
    runtime_kind: "python",
    entrypoint: ["python", "/workspace/clock.py"],
    declared_output_contract: clockOutputContract,
    secret_policy_ref: ref("secret_policy", "secret-policy-no-raw-values-v1"),
    capability_policy_ref: ref("capability_policy", "capability-policy-clock-fixture-v1"),
    provenance_refs: [],
    status: "registered",
    created_at: "2026-05-10T12:09:00.000Z",
    authority_status: "not_live",
    // @ts-expect-error strategy internals are opaque to Ouroboros artifact records.
    strategy_internals: { lookback_window: 14, signal_family: "clock_tick" }
  } satisfies RunnableArtifactRecord;

  void _artifactWithRawSecrets;
  void _artifactWithStrategyInternals;
}
