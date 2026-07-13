import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  type ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import {
  decideResearchGeneralizationProtocol
} from "@ouroboros/application/candidate/research-generalization-protocol";
import { decideResearchControlStudy } from
  "@ouroboros/application/candidate/research-control-study";
import { decideResearchGeneralizationMarketCondition } from
  "@ouroboros/application/candidate/research-generalization-market-condition";
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
});

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
