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
    system_code_artifact_digest: digest("2"),
    system_code_record_digest: digest("3"),
    research_artifact_protocol: "single_file_python_v1" as const,
    research_artifact_closure_digest: digest("4")
  };
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
