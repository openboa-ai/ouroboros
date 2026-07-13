import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from
  "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  closeResearchControlStudyExecutionLease,
  decideResearchControlStudyExecutionLease,
  type ResearchControlStudyExecutionLeaseOwner,
  type ResearchControlStudyExecutionLeaseRecord,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import { decideResearchControlStudy } from
  "@ouroboros/application/candidate/research-control-study";
import {
  FileSystemResearchControlStudyExecutionLeaseStore,
  researchControlStudyExecutionLeaseOwnerLiveness
} from "../src/index";

describe("FileSystemResearchControlStudyExecutionLeaseStore", () => {
  let root: string;
  let now: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-study-lease-"));
    now = "2026-07-13T00:00:00.000Z";
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("elects exactly one owner across two independent adapter instances", async () => {
    const study = studyFixture();
    const left = adapter({ token: "left-token", liveness: "alive" });
    const right = adapter({ token: "right-token", liveness: "alive" });

    const results = await Promise.all([
      left.acquire({ study, owner: owner("left", 101), leaseDurationMs: 30_000 }),
      right.acquire({ study, owner: owner("right", 202), leaseDurationMs: 30_000 })
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "acquired",
      "held"
    ]);
    const acquired = results.find((result) => result.status === "acquired")!;
    const held = results.find((result) => result.status === "held")!;
    expect(held.lease).toEqual(acquired.lease);
    expect(held).toMatchObject({ reason: "owner_alive" });
    expect(await readLease(activeLeaseFile(study))).toEqual(acquired.lease);
  });

  it("renews and asserts only the exact active owner, then archives release", async () => {
    const study = studyFixture();
    const store = adapter({ tokens: ["lease-a", "lease-b"], liveness: "alive" });
    const acquired = await store.acquire({
      study,
      owner: owner("server-a", 101),
      leaseDurationMs: 30_000
    });
    expect(acquired.status).toBe("acquired");
    if (acquired.status !== "acquired") throw new Error("expected acquired lease");
    expect(await store.assertOwned({ lease: acquired.lease })).toEqual(acquired.lease);

    now = "2026-07-13T00:00:10.000Z";
    const renewed = await store.renew({ lease: acquired.lease });
    expect(renewed).toMatchObject({
      renewed_at: now,
      expires_at: "2026-07-13T00:00:40.000Z"
    });
    await expect(store.renew({ lease: acquired.lease })).rejects.toMatchObject({
      code: "research_control_study_execution_lease_ownership_lost"
    });

    const staleToken = decideResearchControlStudyExecutionLease({
      study,
      owner: owner("server-a", 101),
      leaseToken: "other-token",
      leaseDurationMs: 30_000,
      acquiredAt: "2026-07-13T00:00:00.000Z"
    });
    await expect(store.assertOwned({ lease: staleToken })).rejects.toMatchObject({
      code: "research_control_study_execution_lease_ownership_lost"
    });

    now = "2026-07-13T00:00:11.000Z";
    const released = await store.release({ lease: renewed });
    expect(released).toMatchObject({
      lease_status: "released",
      close_reason: "owner_released",
      closed_at: now
    });
    expect(await readLease(historyFile(released))).toEqual(released);
    expect(await store.release({ lease: renewed })).toEqual(released);

    const reacquired = await store.acquire({
      study,
      owner: owner("server-b", 202),
      leaseDurationMs: 30_000
    });
    expect(reacquired).toMatchObject({ status: "acquired" });
    if (reacquired.status !== "acquired") throw new Error("expected reacquisition");
    expect(reacquired.lease.lease_token).toBe("lease-b");
    await expect(store.assertOwned({ lease: renewed })).rejects.toMatchObject({
      code: "research_control_study_execution_lease_ownership_lost"
    });
    expect(await readLease(historyFile(released))).toEqual(released);
  });

  it.each([
    ["alive", "owner_alive"],
    ["unknown", "owner_liveness_unknown"]
  ] as const)("does not displace an expired %s owner", async (
    liveness,
    reason
  ) => {
    const study = studyFixture();
    const first = adapter({ token: "lease-a", liveness: "alive" });
    const acquired = await first.acquire({
      study,
      owner: owner("server-a", 101),
      leaseDurationMs: 30_000
    });
    expect(acquired.status).toBe("acquired");
    now = "2026-07-13T00:00:31.000Z";

    const contender = adapter({ token: "lease-b", liveness });
    const result = await contender.acquire({
      study,
      owner: owner("server-b", 202),
      leaseDurationMs: 30_000
    });

    expect(result).toMatchObject({ status: "held", reason });
    expect(result.lease).toEqual(acquired.lease);
    expect(await readdir(historyItemsDir())).toEqual([]);
  });

  it("lets exactly one contender replace a confirmed-absent expired owner", async () => {
    const study = studyFixture();
    const first = adapter({ token: "lease-a", liveness: "alive" });
    const acquired = await first.acquire({
      study,
      owner: owner("server-a", 101),
      leaseDurationMs: 30_000
    });
    expect(acquired.status).toBe("acquired");
    if (acquired.status !== "acquired") throw new Error("expected acquired lease");
    now = "2026-07-13T00:00:31.000Z";
    const left = adapter({ token: "lease-b", liveness: "absent" });
    const right = adapter({ token: "lease-c", liveness: "absent" });

    const results = await Promise.all([
      left.acquire({ study, owner: owner("server-b", 202), leaseDurationMs: 30_000 }),
      right.acquire({ study, owner: owner("server-c", 303), leaseDurationMs: 30_000 })
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "acquired",
      "held"
    ]);
    const expired = await readLease(historyFileForId(
      acquired.lease.research_control_study_execution_lease_id
    ));
    expect(expired).toMatchObject({
      lease_status: "expired",
      close_reason: "expired_owner_absent",
      lease_token: "lease-a",
      closed_at: now
    });
    const active = await readLease(activeLeaseFile(study));
    expect(["lease-b", "lease-c"]).toContain(active.lease_token);
    expect(results.find((result) => result.status === "held")!.lease).toEqual(active);
  });

  it("recovers an expired transition created before terminal archive", async () => {
    const study = studyFixture();
    const first = adapter({ token: "lease-a", liveness: "alive" });
    const acquired = await first.acquire({
      study,
      owner: owner("server-a", 101),
      leaseDurationMs: 30_000
    });
    expect(acquired.status).toBe("acquired");
    if (acquired.status !== "acquired") throw new Error("expected acquired lease");
    await mkdir(path.dirname(transitionDir(study)), { recursive: true });
    await rename(activeDir(study), transitionDir(study));
    now = "2026-07-13T00:00:31.000Z";

    const result = await adapter({ token: "lease-b", liveness: "absent" })
      .acquire({
        study,
        owner: owner("server-b", 202),
        leaseDurationMs: 30_000
      });

    expect(result).toMatchObject({ status: "acquired" });
    expect(await readLease(historyFileForId(
      acquired.lease.research_control_study_execution_lease_id
    ))).toMatchObject({ lease_status: "expired" });
    await expect(readFile(transitionLeaseFile(study), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("restores a non-expired transition instead of opening another owner", async () => {
    const study = studyFixture();
    const first = adapter({ token: "lease-a", liveness: "alive" });
    const acquired = await first.acquire({
      study,
      owner: owner("server-a", 101),
      leaseDurationMs: 30_000
    });
    expect(acquired.status).toBe("acquired");
    if (acquired.status !== "acquired") throw new Error("expected acquired lease");
    await mkdir(path.dirname(transitionDir(study)), { recursive: true });
    await rename(activeDir(study), transitionDir(study));
    now = "2026-07-13T00:00:01.000Z";

    const result = await adapter({ token: "lease-b", liveness: "alive" })
      .acquire({
        study,
        owner: owner("server-b", 202),
        leaseDurationMs: 30_000
      });

    expect(result).toEqual({
      status: "held",
      lease: acquired.lease,
      reason: "owner_alive"
    });
    expect(await readLease(activeLeaseFile(study))).toEqual(acquired.lease);
    await expect(readFile(transitionLeaseFile(study), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("finishes a transition whose terminal history was already written", async () => {
    const study = studyFixture();
    const first = adapter({ token: "lease-a", liveness: "alive" });
    const acquired = await first.acquire({
      study,
      owner: owner("server-a", 101),
      leaseDurationMs: 30_000
    });
    expect(acquired.status).toBe("acquired");
    if (acquired.status !== "acquired") throw new Error("expected acquired lease");
    await mkdir(path.dirname(transitionDir(study)), { recursive: true });
    await rename(activeDir(study), transitionDir(study));
    now = "2026-07-13T00:00:31.000Z";
    const terminal = closeResearchControlStudyExecutionLease({
      lease: acquired.lease,
      leaseStatus: "expired",
      closedAt: now
    });
    await writeLease(historyFile(terminal), terminal);

    const result = await adapter({ token: "lease-b", liveness: "absent" })
      .acquire({
        study,
        owner: owner("server-b", 202),
        leaseDurationMs: 30_000
      });

    expect(result).toMatchObject({ status: "acquired" });
    expect(await readLease(historyFile(terminal))).toEqual(terminal);
    await expect(readFile(transitionLeaseFile(study), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves a new active owner while removing a completed old transition", async () => {
    const study = studyFixture();
    const oldLease = decideResearchControlStudyExecutionLease({
      study,
      owner: owner("server-a", 101),
      leaseToken: "lease-a",
      leaseDurationMs: 30_000,
      acquiredAt: "2026-07-13T00:00:00.000Z"
    });
    const terminal = closeResearchControlStudyExecutionLease({
      lease: oldLease,
      leaseStatus: "expired",
      closedAt: "2026-07-13T00:00:31.000Z"
    });
    const newLease = decideResearchControlStudyExecutionLease({
      study,
      owner: owner("server-b", 202),
      leaseToken: "lease-b",
      leaseDurationMs: 30_000,
      acquiredAt: "2026-07-13T00:00:31.000Z"
    });
    await writeLease(transitionLeaseFile(study), oldLease);
    await writeLease(historyFile(terminal), terminal);
    await writeLease(activeLeaseFile(study), newLease);
    now = "2026-07-13T00:00:32.000Z";

    const result = await adapter({ token: "lease-c", liveness: "alive" })
      .acquire({
        study,
        owner: owner("server-c", 303),
        leaseDurationMs: 30_000
      });

    expect(result).toEqual({
      status: "held",
      lease: newLease,
      reason: "owner_alive"
    });
    expect(await readLease(activeLeaseFile(study))).toEqual(newLease);
    await expect(readFile(transitionLeaseFile(study), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails closed for malformed active, transition, and history state", async () => {
    const study = studyFixture();
    await mkdir(activeDir(study), { recursive: true });
    await writeFile(activeLeaseFile(study), "{not-json\n", "utf8");
    await expect(adapter({ token: "lease-b", liveness: "absent" }).acquire({
      study,
      owner: owner("server-b", 202),
      leaseDurationMs: 30_000
    })).rejects.toMatchObject({
      code: "research_control_study_execution_lease_state_corrupt"
    });

    await rm(activeDir(study), { recursive: true, force: true });
    await mkdir(transitionDir(study), { recursive: true });
    await writeFile(transitionLeaseFile(study), "{}\n", "utf8");
    await expect(adapter({ token: "lease-c", liveness: "absent" }).acquire({
      study,
      owner: owner("server-c", 303),
      leaseDurationMs: 30_000
    })).rejects.toMatchObject({
      code: "research_control_study_execution_lease_state_corrupt"
    });

    await rm(transitionDir(study), { recursive: true, force: true });
    const lease = decideResearchControlStudyExecutionLease({
      study,
      owner: owner("server-a", 101),
      leaseToken: "lease-a",
      leaseDurationMs: 30_000,
      acquiredAt: now
    });
    await writeLease(activeLeaseFile(study), lease);
    await writeFile(historyFileForId(lease.research_control_study_execution_lease_id),
      "{}\n", "utf8");
    await expect(adapter({ token: "unused", liveness: "alive" }).release({
      lease
    })).rejects.toMatchObject({
      code: "research_control_study_execution_lease_state_corrupt"
    });
    expect(await readLease(activeLeaseFile(study))).toEqual(lease);
  });

  it("uses same-host PID liveness and fails closed across hosts", async () => {
    await expect(researchControlStudyExecutionLeaseOwnerLiveness({
      server_instance_id: "this-server",
      host_id: os.hostname(),
      process_id: process.pid
    })).resolves.toBe("alive");
    await expect(researchControlStudyExecutionLeaseOwnerLiveness({
      server_instance_id: "other-host",
      host_id: `${os.hostname()}-other`,
      process_id: process.pid
    })).resolves.toBe("unknown");
  });

  function adapter(options: {
    token?: string;
    tokens?: string[];
    liveness: "alive" | "absent" | "unknown";
  }): FileSystemResearchControlStudyExecutionLeaseStore {
    const tokens = [...(options.tokens ?? [options.token ?? "lease-token"])];
    return new FileSystemResearchControlStudyExecutionLeaseStore(root, {
      now: () => now,
      leaseToken: () => {
        const token = tokens.shift();
        if (!token) throw new Error("test token sequence exhausted");
        return token;
      },
      ownerLiveness: async () => options.liveness
    });
  }

  function baseDir(): string {
    return path.join(root, "research-control-study-execution-leases");
  }

  function historyItemsDir(): string {
    return path.join(baseDir(), "history", "items");
  }

  function activeDir(study: ResearchControlStudyRecord): string {
    return path.join(baseDir(), "active", `${studyPathKey(study)}.lock`);
  }

  function activeLeaseFile(study: ResearchControlStudyRecord): string {
    return path.join(activeDir(study), "lease.json");
  }

  function transitionDir(study: ResearchControlStudyRecord): string {
    return path.join(baseDir(), "transitions", `${studyPathKey(study)}.lock`);
  }

  function transitionLeaseFile(study: ResearchControlStudyRecord): string {
    return path.join(transitionDir(study), "lease.json");
  }

  function historyFile(lease: ResearchControlStudyExecutionLeaseRecord): string {
    return historyFileForId(lease.research_control_study_execution_lease_id);
  }

  function historyFileForId(leaseId: string): string {
    return path.join(historyItemsDir(), `${encodeURIComponent(leaseId)}.json`);
  }

  function studyPathKey(study: ResearchControlStudyRecord): string {
    return createHash("sha256")
      .update(study.research_control_study_id)
      .digest("hex");
  }
});

function owner(
  serverInstanceId: string,
  processId: number
): ResearchControlStudyExecutionLeaseOwner {
  return {
    server_instance_id: serverInstanceId,
    host_id: "test-host",
    process_id: processId
  };
}

async function readLease(file: string): Promise<ResearchControlStudyExecutionLeaseRecord> {
  return JSON.parse(await readFile(file, "utf8")) as
    ResearchControlStudyExecutionLeaseRecord;
}

async function writeLease(
  file: string,
  lease: ResearchControlStudyExecutionLeaseRecord
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(lease, null, 2)}\n`, "utf8");
}

function studyFixture(): ResearchControlStudyRecord {
  const allocationPolicy = { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY };
  return decideResearchControlStudy({
    idempotencyKey: "execution-lease-study",
    baselineSnapshotDigest: digest("a"),
    replicationIdempotencyKeys: Array.from({ length: 6 }, (_, index) =>
      `execution-lease-replication-${index + 1}`
    ),
    committedAt: "2026-07-12T09:00:00.000Z",
    condition: {
      source: {
        candidate_ref: { record_kind: "trading_system_candidate", id: "source" },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: "source-version"
        },
        system_code_ref: { record_kind: "system_code", id: "source-code" },
        system_code_artifact_digest: digest("b"),
        system_code_record_digest: digest("c"),
        research_artifact_protocol: "single_file_python_v1",
        research_artifact_closure_digest: digest("d")
      },
      research_agent: {
        provider: "fixture",
        model: "fixture-model",
        permission_policy: "fixture_only",
        identity_digest: digest("e")
      },
      paper_comparator: {
        comparator_status: "trading_review",
        trading_promotion_ref: {
          record_kind: "trading_promotion",
          id: "promotion"
        },
        trading_promotion_digest: digest("1"),
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: "champion"
        },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: "champion-version"
        },
        paper_trading_evaluation_ref: {
          record_kind: "paper_trading_evaluation",
          id: "champion-evaluation"
        }
      },
      paper_evaluation_protocol: {
        protocol_status: "bound",
        comparison_policy: {
          policy_version: "paper-comparison-v1",
          comparison_mode: "champion_challenge",
          symbol: "BTCUSDT",
          interval_ms: 60_000,
          minimum_observation_count: 2,
          minimum_elapsed_ms: 60_000,
          maximum_observation_count: 2,
          maximum_elapsed_ms: 600_000,
          maximum_start_skew_ms: 5_000,
          maximum_provider_request_count_per_side: 100,
          maximum_retry_count_per_side: 2,
          primary_metric: "net_revenue_usdt",
          minimum_net_revenue_lift_usdt: 1,
          required_confirmation_count: 2,
          require_non_overlapping_windows: true,
          require_both_qualified: true,
          release_policy: "sealed_until_adjudication"
        },
        market_data_configuration_digest: digest("2"),
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
          policy_version: "research-control-paper-schedule-v1",
          source_start_order: "paired_by_sequence",
          maximum_active_source_pairs: 2,
          maximum_cross_arm_first_tick_skew_ms: 5_000,
          source_missed_start_policy: "slot_expired",
          confirmation_precommit_deadline_ms: 600_000
        },
        protocol_digest: digest("3")
      },
      allocation_policy: allocationPolicy,
      allocation_policy_digest: digest("4"),
      campaign_policy: {
        policy_version: "research_control_campaign_v1",
        tick_count_per_arm: 1,
        worker_slot_count_per_tick: 3,
        concurrency_limit_per_arm: 2,
        maximum_total_development_submissions_per_tick: 5,
        arm_execution_policy: "concurrent_per_sequence",
        maximum_baseline_regular_file_count: 10_000,
        maximum_baseline_total_bytes: 1_000_000_000,
        paper_candidate_slot_count_per_arm: 1,
        paper_candidate_reservation_rule:
          "first_admitted_per_tick_in_allocation_order",
        primary_metric_kind:
          "prospective_qualified_candidate_discovery_rate",
        required_future_evidence:
          "confirmed_comparison_research_release"
      }
    }
  });
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
