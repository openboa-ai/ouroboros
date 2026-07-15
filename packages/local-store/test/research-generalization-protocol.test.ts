import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  researchControlStudyDigestInput,
  researchControlStudyOutcomeDigestInput,
  researchGeneralizationOutcomeDigestInput,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord,
  type ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import {
  decideResearchGeneralizationProtocol
} from "@ouroboros/application/candidate/research-generalization-protocol";
import { decideResearchControlStudy } from
  "@ouroboros/application/candidate/research-control-study";
import { decideResearchGeneralizationMarketCondition } from
  "@ouroboros/application/candidate/research-generalization-market-condition";
import {
  decideResearchGeneralizationOutcome
} from "@ouroboros/application/candidate/research-generalization-outcome";
import {
  exactTwoSidedSignTestPValue,
  researchControlStudyOutcomeId
} from "@ouroboros/application/candidate/research-control-study-outcome";
import { LocalStore } from "../src/index";

describe("LocalStore ResearchGeneralizationProtocol", () => {
  let root: string;
  let store: LocalStore;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-generalization-"));
    store = new LocalStore(root);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("appends, reloads, orders, and replays exact protocols", async () => {
    const later = protocolFixture("protocol-b", "2026-07-13T00:00:01.000Z");
    const earlier = protocolFixture("protocol-a", "2026-07-13T00:00:00.000Z");

    await expect(store.recordResearchGeneralizationProtocol(later))
      .resolves.toEqual(later);
    await expect(store.recordResearchGeneralizationProtocol(earlier))
      .resolves.toEqual(earlier);
    await expect(store.recordResearchGeneralizationProtocol(earlier))
      .resolves.toEqual(earlier);
    await expect(store.getResearchGeneralizationProtocol(
      earlier.research_generalization_protocol_id
    )).resolves.toEqual(earlier);
    await expect(store.listResearchGeneralizationProtocols())
      .resolves.toEqual([earlier, later]);
  });

  it("converges exact publication across independent store instances", async () => {
    const sharedRoot = path.join(root, "exact-race");
    const left = new LocalStore(sharedRoot);
    const right = new LocalStore(sharedRoot);
    await left.initialize();
    await right.initialize();
    const protocol = protocolFixture("exact-race");

    await expect(Promise.all([
      left.recordResearchGeneralizationProtocol(protocol),
      right.recordResearchGeneralizationProtocol(structuredClone(protocol))
    ])).resolves.toEqual([protocol, protocol]);
    await expect(left.listResearchGeneralizationProtocols())
      .resolves.toEqual([protocol]);
  });

  it("publishes one winner for conflicting cross-process bytes", async () => {
    const sharedRoot = path.join(root, "conflict-race");
    const left = new LocalStore(sharedRoot);
    const right = new LocalStore(sharedRoot);
    await left.initialize();
    await right.initialize();
    const first = protocolFixture("conflict-race", "2026-07-13T00:00:00.000Z");
    const second = protocolFixture("conflict-race", "2026-07-13T00:00:01.000Z");

    const settled = await Promise.allSettled([
      left.recordResearchGeneralizationProtocol(first),
      right.recordResearchGeneralizationProtocol(second)
    ]);

    expect(settled.filter((result) => result.status === "fulfilled"))
      .toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected"))
      .toEqual([expect.objectContaining({
        reason: expect.objectContaining({
          code: "research_generalization_protocol_conflict"
        })
      })]);
    const persisted = await left.listResearchGeneralizationProtocols();
    expect(persisted).toHaveLength(1);
    expect([first, second]).toContainEqual(persisted[0]);
  });

  it("rejects digest drift and corrupt persisted bytes", async () => {
    const protocol = protocolFixture();
    const drifted = structuredClone(protocol);
    drifted.study_slots[0]!.replication_idempotency_keys[0] = "changed";

    await expect(store.recordResearchGeneralizationProtocol(drifted))
      .rejects.toMatchObject({
        code: "research_generalization_protocol_digest_mismatch"
      });

    const corruptRoot = path.join(
      root,
      "research-generalization-protocols",
      "items"
    );
    await mkdir(corruptRoot, { recursive: true });
    await writeFile(path.join(corruptRoot, "corrupt.json"), JSON.stringify({
      record_kind: "research_generalization_protocol",
      research_generalization_protocol_id: "corrupt"
    }));
    await expect(store.listResearchGeneralizationProtocols())
      .rejects.toMatchObject({
        code: "research_generalization_protocol_reload_failed"
      });
  });

  it("rejects a protocol published after one planned study", async () => {
    const protocol = protocolFixture();
    const slot = protocol.study_slots[0]!;
    const condition = {
      source: sourceFixture(),
      research_agent: structuredClone(protocol.research_agent),
      paper_comparator: comparatorFixture(),
      paper_evaluation_protocol: structuredClone(
        protocol.paper_evaluation_protocol
      ),
      allocation_policy: structuredClone(protocol.target_allocation_policy),
      allocation_policy_digest: protocol.target_allocation_policy_digest,
      campaign_policy: structuredClone(protocol.campaign_policy)
    };
    await store.recordResearchControlStudy(decideResearchControlStudy({
      idempotencyKey: slot.study_idempotency_key,
      baselineSnapshotDigest: digest("1"),
      condition,
      replicationIdempotencyKeys: slot.replication_idempotency_keys,
      committedAt: "2026-07-13T00:00:01.000Z"
    }));

    await expect(store.recordResearchGeneralizationProtocol(protocol))
      .rejects.toMatchObject({
        code: "research_generalization_protocol_study_already_exists"
      });
  });

  it("persists and reloads an exact protocol-bound study", async () => {
    const protocol = protocolFixture();
    const study = assignedStudy(protocol, 0, {
      committedAt: "2026-07-14T00:00:00.000Z"
    });
    await store.recordResearchGeneralizationProtocol(protocol);

    await expect(store.recordResearchControlStudy(study)).resolves.toEqual(study);
    await expect(store.getResearchControlStudy(
      study.research_control_study_id
    )).resolves.toEqual(study);
    await expect(store.listResearchControlStudies()).resolves.toContainEqual(study);
  });

  it("rejects an assigned study without its exact protocol", async () => {
    const study = assignedStudy(protocolFixture(), 0, {
      committedAt: "2026-07-14T00:00:00.000Z"
    });

    await expect(store.recordResearchControlStudy(study))
      .rejects.toMatchObject({
        code: "research_control_study_generalization_protocol_not_found"
      });
  });

  it("rejects assigned-study digest and protocol drift", async () => {
    const protocol = protocolFixture();
    await store.recordResearchGeneralizationProtocol(protocol);
    const digestDrift = assignedStudy(protocol, 0, {
      committedAt: "2026-07-14T00:00:00.000Z"
    });
    digestDrift.generalization_assignment!.assignment_digest = digest("9");
    const protocolDrift = assignedStudy(protocol, 0, {
      committedAt: "2026-07-14T00:00:00.000Z",
      protocolDigest: digest("8")
    });

    await expect(store.recordResearchControlStudy(digestDrift))
      .rejects.toMatchObject({
        code: "research_control_study_generalization_assignment_digest_mismatch"
      });
    await expect(store.recordResearchControlStudy(protocolDrift))
      .rejects.toMatchObject({
        code: "research_control_study_generalization_protocol_mismatch"
      });
  });

  it("rejects rapid study reuse and same-block source reuse", async () => {
    const protocol = protocolFixture();
    await store.recordResearchGeneralizationProtocol(protocol);
    await store.recordResearchControlStudy(assignedStudy(protocol, 0, {
      committedAt: "2026-07-14T00:00:00.000Z",
      sourceArtifactDigest: digest("2")
    }));

    await expect(store.recordResearchControlStudy(assignedStudy(protocol, 1, {
      committedAt: "2026-07-14T01:00:00.000Z",
      sourceArtifactDigest: digest("7")
    }))).rejects.toMatchObject({
      code: "research_control_study_generalization_spacing_not_elapsed"
    });
    await expect(store.recordResearchControlStudy(assignedStudy(protocol, 1, {
      committedAt: "2026-07-15T00:00:00.000Z",
      sourceArtifactDigest: digest("2")
    }))).rejects.toMatchObject({
      code: "research_control_study_generalization_source_reused"
    });
  });

  it("appends, reloads, lists, and replays an exact generalization outcome", async () => {
    const graph = terminalGeneralizationGraph();
    await persistGeneralizationSourceGraph(store, graph);
    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    });

    await expect(store.recordResearchGeneralizationOutcome(outcome))
      .resolves.toEqual(outcome);
    await expect(store.getResearchGeneralizationOutcome(
      outcome.research_generalization_outcome_id
    )).resolves.toEqual(outcome);
    await expect(store.listResearchGeneralizationOutcomes())
      .resolves.toEqual([outcome]);
    await expect(store.recordResearchGeneralizationOutcome(outcome))
      .resolves.toEqual(outcome);
  });

  it("converges exact generalization outcome publication across stores", async () => {
    const sharedRoot = path.join(root, "outcome-exact-race");
    const left = new LocalStore(sharedRoot);
    const right = new LocalStore(sharedRoot);
    await left.initialize();
    await right.initialize();
    const graph = terminalGeneralizationGraph();
    await persistGeneralizationSourceGraph(left, graph);
    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    });

    await expect(Promise.all([
      left.recordResearchGeneralizationOutcome(outcome),
      right.recordResearchGeneralizationOutcome(structuredClone(outcome))
    ])).resolves.toEqual([outcome, outcome]);
    await expect(left.listResearchGeneralizationOutcomes())
      .resolves.toEqual([outcome]);
  });

  it("publishes one winner for conflicting outcome bytes", async () => {
    const sharedRoot = path.join(root, "outcome-conflict-race");
    const left = new LocalStore(sharedRoot);
    const right = new LocalStore(sharedRoot);
    await left.initialize();
    await right.initialize();
    const graph = terminalGeneralizationGraph();
    await persistGeneralizationSourceGraph(left, graph);
    const first = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    });
    const second = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:01.000Z"
    });

    const settled = await Promise.allSettled([
      left.recordResearchGeneralizationOutcome(first),
      right.recordResearchGeneralizationOutcome(second)
    ]);

    expect(settled.filter((result) => result.status === "fulfilled"))
      .toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected"))
      .toEqual([expect.objectContaining({
        reason: expect.objectContaining({
          code: "research_generalization_outcome_conflict"
        })
      })]);
    const persisted = await left.listResearchGeneralizationOutcomes();
    expect(persisted).toHaveLength(1);
    expect([first, second]).toContainEqual(persisted[0]);
  });

  it("rejects outcome digest drift, missing graph, and corrupt reload", async () => {
    const graph = terminalGeneralizationGraph();
    await persistGeneralizationSourceGraph(store, graph);
    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    });
    const drifted = structuredClone(outcome);
    drifted.completed_study_count = 5;

    await expect(store.recordResearchGeneralizationOutcome(drifted))
      .rejects.toMatchObject({
        code: "invalid_research_generalization_outcome_input"
      });

    const missing = structuredClone(outcome);
    missing.slot_results[0]!.study_outcome_ref!.id = "absent-outcome";
    missing.outcome_digest = exactDigest(
      researchGeneralizationOutcomeDigestInput(missing)
    );
    await expect(store.recordResearchGeneralizationOutcome(missing))
      .rejects.toMatchObject({
        code: "research_generalization_outcome_reference_not_found"
      });

    const corruptRoot = path.join(
      root,
      "research-generalization-outcomes",
      "items"
    );
    await mkdir(corruptRoot, { recursive: true });
    await writeFile(path.join(corruptRoot, "corrupt.json"), JSON.stringify({
      record_kind: "research_generalization_outcome",
      research_generalization_outcome_id: "corrupt"
    }));
    await expect(store.listResearchGeneralizationOutcomes())
      .rejects.toMatchObject({
        code: "research_generalization_outcome_reload_failed"
      });
  });
});

async function persistGeneralizationSourceGraph(
  store: LocalStore,
  graph: ReturnType<typeof terminalGeneralizationGraph>
): Promise<void> {
  await store.recordResearchGeneralizationProtocol(graph.protocol);
  const studyRoot = path.join(store.root(), "research-control-studies", "items");
  const outcomeRoot = path.join(
    store.root(),
    "research-control-study-outcomes",
    "items"
  );
  await mkdir(studyRoot, { recursive: true });
  await mkdir(outcomeRoot, { recursive: true });
  await Promise.all([
    ...graph.studies.map((study) => writeFile(
      path.join(studyRoot, `${study.research_control_study_id}.json`),
      JSON.stringify(study, null, 2)
    )),
    ...graph.studyOutcomes.map((outcome) => writeFile(
      path.join(
        outcomeRoot,
        `${outcome.research_control_study_outcome_id}.json`
      ),
      JSON.stringify(outcome, null, 2)
    ))
  ]);
}

function terminalGeneralizationGraph() {
  const protocol = protocolFixture(
    "generalization-outcome-protocol",
    "2026-07-13T00:00:00.000Z"
  );
  const baselineCharacters = ["1", "2", "3", "1", "2", "3"];
  const studies = protocol.study_slots.map((_, index) =>
    assignedStudy(protocol, index, {
      committedAt: new Date(
        Date.parse(protocol.committed_at) + (index + 1) * 86_400_000
      ).toISOString(),
      sourceArtifactDigest: digest(String.fromCharCode(97 + index))
    })
  );
  for (let index = 0; index < studies.length; index += 1) {
    const study = studies[index]!;
    study.baseline_snapshot_digest = digest(baselineCharacters[index]!);
    for (const replication of study.replications) {
      replication.expected_baseline_snapshot_digest =
        study.baseline_snapshot_digest;
    }
    study.study_digest = exactDigest(researchControlStudyDigestInput(study));
  }
  return {
    protocol,
    studies,
    studyOutcomes: studies.map((study) => studyOutcome(study, 1))
  };
}

function studyOutcome(
  study: ResearchControlStudyRecord,
  effect: number
): ResearchControlStudyOutcomeRecord {
  const adaptivePositive = effect > 0 ? 6 : 0;
  const staticPositive = effect < 0 ? 6 : 0;
  const tied = effect === 0 ? 6 : 0;
  const nonTied = adaptivePositive + staticPositive;
  const pValue = exactTwoSidedSignTestPValue(
    adaptivePositive,
    staticPositive
  );
  const supported = adaptivePositive === 6 && pValue <= 0.05;
  const outcome: ResearchControlStudyOutcomeRecord = {
    record_kind: "research_control_study_outcome",
    version: 1,
    research_control_study_outcome_id: researchControlStudyOutcomeId(study),
    study_ref: {
      record_kind: "research_control_study",
      id: study.research_control_study_id
    },
    study_digest: study.study_digest,
    replication_results: study.replications.map((replication) => ({
      replication_index: replication.replication_index,
      campaign_ref: { ...replication.campaign_ref },
      campaign_digest: digest("a"),
      campaign_outcome_ref: {
        record_kind: "research_control_campaign_outcome",
        id: `${replication.campaign_ref.id}-outcome`
      },
      campaign_outcome_digest: digest("b"),
      observed_rate_difference: effect
    })),
    planned_replication_count: 6,
    completed_replication_count: 6,
    adaptive_positive_count: adaptivePositive,
    static_positive_count: staticPositive,
    tied_count: tied,
    non_tied_count: nonTied,
    mean_rate_difference: effect,
    exact_sign_test_p_value: pValue,
    inference_status: nonTied < 6
      ? "insufficient_non_tied_replications"
      : supported
        ? "adaptive_effect_supported"
        : "adaptive_effect_not_supported",
    causal_scope: "same_baseline_stochastic_replication_only",
    policy_decision_eligibility: supported
      ? "eligible_for_separate_policy_decision"
      : "not_eligible",
    next_action: supported
      ? "review_research_allocation_policy"
      : "accumulate_or_redesign_precommitted_study",
    adjudicated_at: new Date(Date.parse(study.committed_at) + 3_600_000)
      .toISOString(),
    study_outcome_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  outcome.study_outcome_digest = exactDigest(
    researchControlStudyOutcomeDigestInput(outcome)
  );
  return outcome;
}

function protocolFixture(
  idempotencyKey = "generalization-protocol",
  committedAt = "2026-07-13T00:00:00.000Z"
): ResearchGeneralizationProtocolRecord {
  return decideResearchGeneralizationProtocol({
    idempotencyKey,
    targetAllocationPolicy: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
    researchAgent: {
      provider: "fixture",
      model: "scripted-fixture",
      permission_policy: "fixture_only"
    },
    paperEvaluationProtocol: boundPaperProtocolInput(),
    campaignPolicy: campaignPolicy(),
    committedAt
  });
}

function boundPaperProtocolInput() {
  return {
    protocol_status: "bound" as const,
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge" as const,
      symbol: "BTCUSDT" as const,
      interval_ms: 60_000,
      minimum_observation_count: 2,
      minimum_elapsed_ms: 60_000,
      maximum_observation_count: 2,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 2,
      primary_metric: "net_revenue_usdt" as const,
      minimum_net_revenue_lift_usdt: 1,
      required_confirmation_count: 2,
      require_non_overlapping_windows: true as const,
      require_both_qualified: true as const,
      release_policy: "sealed_until_adjudication" as const
    },
    market_data_configuration_digest: digest("5"),
    paper_policy_identity: {
      market_data_policy_version: "market-v1",
      gateway_policy_version: "gateway-v1",
      cost_policy_version: "cost-v1",
      funding_policy_version: "funding-v1",
      slippage_policy_version: "slippage-v1",
      fill_policy_version: "fill-v1",
      risk_policy_version: "risk-v1",
      paper_account_policy_version: "account-v1",
      decision_event_protocol_version: "decision-v1",
      persistent_state_boundary_version: "state-v1"
    },
    schedule_policy: {
      policy_version: "research-control-paper-schedule-v1" as const,
      source_start_order: "paired_by_sequence" as const,
      maximum_active_source_pairs: 2 as const,
      maximum_cross_arm_first_tick_skew_ms: 5_000,
      source_missed_start_policy: "slot_expired" as const,
      confirmation_precommit_deadline_ms: 600_000
    }
  };
}

function campaignPolicy() {
  return {
    policy_version: "research_control_campaign_v1" as const,
    tick_count_per_arm: 1,
    worker_slot_count_per_tick: 3 as const,
    concurrency_limit_per_arm: 2 as const,
    maximum_total_development_submissions_per_tick: 5 as const,
    arm_execution_policy: "concurrent_per_sequence" as const,
    maximum_baseline_regular_file_count: 10_000,
    maximum_baseline_total_bytes: 1_000_000_000,
    paper_candidate_slot_count_per_arm: 1,
    paper_candidate_reservation_rule:
      "first_admitted_per_tick_in_allocation_order" as const,
    primary_metric_kind:
      "prospective_qualified_candidate_discovery_rate" as const,
    required_future_evidence:
      "confirmed_comparison_research_release" as const
  };
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sourceFixture() {
  return sourceFixtureWithArtifact(digest("2"));
}

function sourceFixtureWithArtifact(systemCodeArtifactDigest: string) {
  return {
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "candidate-fixture"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "candidate-version-fixture"
    },
    system_code_ref: {
      record_kind: "system_code",
      id: "system-code-fixture"
    },
    system_code_artifact_digest: systemCodeArtifactDigest,
    system_code_record_digest: digest("3"),
    research_artifact_protocol: "single_file_python_v1" as const,
    research_artifact_closure_digest: digest("4")
  };
}

function assignedStudy(
  protocol: ResearchGeneralizationProtocolRecord,
  slotIndex: number,
  options: {
    committedAt: string;
    sourceArtifactDigest?: string;
    protocolDigest?: string;
  }
) {
  const slot = protocol.study_slots[slotIndex]!;
  const source = sourceFixtureWithArtifact(
    options.sourceArtifactDigest ?? digest(String(slotIndex + 2))
  );
  return decideResearchControlStudy({
    idempotencyKey: slot.study_idempotency_key,
    baselineSnapshotDigest: digest(String(slotIndex + 1)),
    condition: {
      source,
      research_agent: structuredClone(protocol.research_agent),
      paper_comparator: comparatorFixture(),
      paper_evaluation_protocol: structuredClone(
        protocol.paper_evaluation_protocol
      ),
      allocation_policy: structuredClone(protocol.target_allocation_policy),
      allocation_policy_digest: protocol.target_allocation_policy_digest,
      campaign_policy: structuredClone(protocol.campaign_policy)
    },
    replicationIdempotencyKeys: slot.replication_idempotency_keys,
    generalizationAssignment: {
      protocol_ref: {
        record_kind: "research_generalization_protocol",
        id: protocol.research_generalization_protocol_id
      },
      protocol_digest: options.protocolDigest ?? protocol.protocol_digest,
      slot_index: slot.slot_index,
      condition_block: slot.condition_block,
      condition_block_study_index: slot.condition_block_study_index,
      market_condition: marketCondition(slot.condition_block),
      source_system_code_artifact_digest:
        source.system_code_artifact_digest
    },
    committedAt: options.committedAt
  });
}

function marketCondition(block: "long" | "short" | "flat") {
  const start = Date.parse("2026-07-13T23:00:00.000Z");
  const closes = block === "long"
    ? Array.from({ length: 30 }, (_, index) => 60_000 + index)
    : block === "short"
      ? Array.from({ length: 30 }, (_, index) => 60_030 - index)
      : Array.from({ length: 30 }, () => 60_000);
  return decideResearchGeneralizationMarketCondition({
    publicKlineWindow: {
      symbol: "BTCUSDT",
      interval: "1m",
      sample_count: 30,
      observed_at: "2026-07-13T23:30:30.000Z",
      closed_window_end_at: "2026-07-13T23:29:59.999Z",
      source: {
        provider_kind: "binance_production_public_market_data",
        source_kind: "binance_production_public_rest",
        rest_base_url: "https://fapi.binance.com",
        endpoint: "/fapi/v1/klines",
        authority_status: "read_only"
      },
      klines: closes.map((close, index) => ({
        open_time: new Date(start + index * 60_000).toISOString(),
        close_time: new Date(start + (index + 1) * 60_000 - 1).toISOString(),
        close_price: String(close)
      })),
      authority_status: "read_only"
    },
    classifiedAt: "2026-07-13T23:30:31.000Z"
  });
}

function comparatorFixture() {
  return {
    comparator_status: "trading_review" as const,
    trading_promotion_ref: {
      record_kind: "trading_promotion",
      id: "promotion-fixture"
    },
    trading_promotion_digest: digest("6"),
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "candidate-fixture"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "candidate-version-fixture"
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: "paper-fixture"
    }
  };
}
