import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  closeResearchControlStudyExecutionLease,
  decideResearchControlStudyExecutionLease,
  renewResearchControlStudyExecutionLease,
  type ResearchControlStudyExecutionLeaseOwner,
  type ResearchControlStudyExecutionLeaseRecord,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import type {
  ResearchControlStudyExecutionLeaseAcquireResult,
  ResearchControlStudyExecutionLeasePort
} from "@ouroboros/application/ports/research-control-study-execution-lease";
import { decideResearchControlStudy } from
  "@ouroboros/application/candidate/research-control-study";
import {
  createResearchControlStudyExecutionLeaseSessionFactory,
  ResearchControlStudyExecutionLeaseSessionError
} from "../src/candidate/arena/research-control-study-execution-lease-session";

describe("ResearchControlStudyExecutionLeaseSession", () => {
  it("projects acquired and held claims without changing lease evidence", async () => {
    const study = studyFixture();
    const lease = activeLease(study);
    const acquiredPort = new ScriptedLeasePort({ status: "acquired", lease });
    const acquiredFactory = factory(acquiredPort);

    const claim = await acquiredFactory.acquire(study);

    expect(claim.status).toBe("acquired");
    if (claim.status !== "acquired") throw new Error("expected acquired session");
    expect(claim.session.status()).toEqual({ status: "acquired", lease });
    await expect(claim.session.guard()).resolves.toBeUndefined();
    expect(acquiredPort.assertCount).toBe(1);
    expect(claim.session.status()).toEqual({ status: "acquired", lease });

    const heldPort = new ScriptedLeasePort({
      status: "held",
      lease,
      reason: "owner_alive"
    });
    const held = await factory(heldPort).acquire(study);
    expect(held).toEqual({ status: "held", lease, reason: "owner_alive" });
  });

  it("renews on the bounded interval and releases the latest exact lease", async () => {
    const study = studyFixture();
    const lease = activeLease(study);
    const clock = new DeferredSleep();
    const port = new ScriptedLeasePort({ status: "acquired", lease });
    port.renewImplementation = (current) => renewResearchControlStudyExecutionLease({
      lease: current,
      renewedAt: "2026-07-13T00:00:10.000Z"
    });
    const claim = await factory(port, clock.sleep).acquire(study);
    if (claim.status !== "acquired") throw new Error("expected acquired session");

    expect(claim.session.start(() => undefined)).toBe("started");
    await clock.waiting();
    expect(clock.intervals).toEqual([10_000]);
    clock.wake();
    await eventually(() => expect(port.renewCount).toBe(1));
    expect(claim.session.status()).toMatchObject({
      status: "renewing",
      lease: {
        renewed_at: "2026-07-13T00:00:10.000Z",
        expires_at: "2026-07-13T00:00:40.000Z"
      }
    });
    await clock.waiting();

    const released = await claim.session.stopAndRelease();

    expect(released).toMatchObject({
      lease_status: "released",
      renewed_at: "2026-07-13T00:00:10.000Z"
    });
    expect(port.releaseInputs).toEqual([
      expect.objectContaining({ renewed_at: "2026-07-13T00:00:10.000Z" })
    ]);
    expect(clock.pendingCount).toBe(1);
    expect(claim.session.status()).toEqual({ status: "released", lease: released });
  });

  it("returns already_running for duplicate starts", async () => {
    const clock = new DeferredSleep();
    const claim = await factory(
      new ScriptedLeasePort({ status: "acquired", lease: activeLease(studyFixture()) }),
      clock.sleep
    ).acquire(studyFixture());
    if (claim.status !== "acquired") throw new Error("expected acquired session");

    expect(claim.session.start(() => undefined)).toBe("started");
    expect(claim.session.start(() => undefined)).toBe("already_running");
    await clock.waiting();
    await claim.session.stopAndRelease();
  });

  it("interrupts a pending renewal sleep before release", async () => {
    const clock = new DeferredSleep();
    const port = new ScriptedLeasePort({
      status: "acquired",
      lease: activeLease(studyFixture())
    });
    const claim = await factory(port, clock.sleep).acquire(studyFixture());
    if (claim.status !== "acquired") throw new Error("expected acquired session");
    claim.session.start(() => undefined);
    await clock.waiting();

    await claim.session.stopAndRelease();

    expect(clock.pendingCount).toBe(1);
    expect(port.renewCount).toBe(0);
    expect(port.releaseCount).toBe(1);
  });

  it("turns guard failure into one stable loss callback", async () => {
    const port = new ScriptedLeasePort({
      status: "acquired",
      lease: activeLease(studyFixture())
    });
    port.assertImplementation = () => {
      throw Object.assign(new Error("stale token"), { code: "adapter_stale_token" });
    };
    const claim = await factory(port, async () => new Promise(() => undefined))
      .acquire(studyFixture());
    if (claim.status !== "acquired") throw new Error("expected acquired session");
    const losses: ResearchControlStudyExecutionLeaseSessionError[] = [];
    claim.session.start((error) => { losses.push(error); });

    await expect(claim.session.guard()).rejects.toMatchObject({
      code: "research_control_study_execution_lease_lost"
    });
    await expect(claim.session.guard()).rejects.toBe(losses[0]);
    await expect(claim.session.stopAndRelease()).rejects.toBe(losses[0]);
    expect(losses).toHaveLength(1);
    expect(port.assertCount).toBe(1);
    expect(port.releaseCount).toBe(0);
    expect(claim.session.status()).toMatchObject({
      status: "lost",
      errorCode: "research_control_study_execution_lease_lost"
    });
  });

  it("runs publications through the exact lease and treats rejection as loss", async () => {
    const port = new ScriptedLeasePort({
      status: "acquired",
      lease: activeLease(studyFixture())
    });
    const claim = await factory(port).acquire(studyFixture());
    if (claim.status !== "acquired") throw new Error("expected acquired session");

    await expect(claim.session.runFencedWrite(async () => "published"))
      .resolves.toBe("published");
    expect(port.fencedWriteCount).toBe(1);
    const publicationError = Object.assign(new Error("publication failed"), {
      code: "publication_failed"
    });
    port.fencedWriteImplementation = async () => { throw publicationError; };
    await expect(claim.session.runFencedWrite(async () => "never"))
      .rejects.toBe(publicationError);
    expect(claim.session.status()).toMatchObject({ status: "acquired" });
    port.fencedWriteImplementation = async () => {
      throw Object.assign(new Error("stale token"), {
        code: "research_control_study_execution_lease_ownership_lost"
      });
    };

    await expect(claim.session.runFencedWrite(async () => "never"))
      .rejects.toMatchObject({
        code: "research_control_study_execution_lease_lost"
      });
    expect(claim.session.status()).toMatchObject({ status: "lost" });
  });

  it("turns renewal failure into one stable loss callback", async () => {
    const clock = new DeferredSleep();
    const port = new ScriptedLeasePort({
      status: "acquired",
      lease: activeLease(studyFixture())
    });
    port.renewImplementation = () => {
      throw new Error("renewal failed");
    };
    const claim = await factory(port, clock.sleep).acquire(studyFixture());
    if (claim.status !== "acquired") throw new Error("expected acquired session");
    const losses: ResearchControlStudyExecutionLeaseSessionError[] = [];
    claim.session.start((error) => { losses.push(error); });
    await clock.waiting();

    clock.wake();
    await eventually(() => expect(losses).toHaveLength(1));

    expect(port.renewCount).toBe(1);
    expect(claim.session.status()).toMatchObject({ status: "lost" });
    await expect(claim.session.guard()).rejects.toBe(losses[0]);
    expect(losses).toHaveLength(1);
  });

  it("treats a non-advancing renewal snapshot as lease loss", async () => {
    const clock = new DeferredSleep();
    const port = new ScriptedLeasePort({
      status: "acquired",
      lease: activeLease(studyFixture())
    });
    const claim = await factory(port, clock.sleep).acquire(studyFixture());
    if (claim.status !== "acquired") throw new Error("expected acquired session");
    const loss = deferred<ResearchControlStudyExecutionLeaseSessionError>();
    claim.session.start(loss.resolve);
    await clock.waiting();

    clock.wake();

    await expect(loss.promise).resolves.toMatchObject({
      code: "research_control_study_execution_lease_lost"
    });
    expect(claim.session.status()).toMatchObject({ status: "lost" });
  });

  it("rejects malformed renewed ownership as lease loss", async () => {
    const clock = new DeferredSleep();
    const lease = activeLease(studyFixture());
    const port = new ScriptedLeasePort({ status: "acquired", lease });
    port.renewImplementation = () => activeLease(
      studyFixture(),
      "different-token"
    );
    const claim = await factory(port, clock.sleep).acquire(studyFixture());
    if (claim.status !== "acquired") throw new Error("expected acquired session");
    const loss = deferred<ResearchControlStudyExecutionLeaseSessionError>();
    claim.session.start(loss.resolve);
    await clock.waiting();

    clock.wake();

    await expect(loss.promise).resolves.toMatchObject({
      code: "research_control_study_execution_lease_lost"
    });
    expect(claim.session.status()).toMatchObject({ status: "lost" });
  });

  it("makes successful release idempotent", async () => {
    const port = new ScriptedLeasePort({
      status: "acquired",
      lease: activeLease(studyFixture())
    });
    const claim = await factory(port).acquire(studyFixture());
    if (claim.status !== "acquired") throw new Error("expected acquired session");

    const first = await claim.session.stopAndRelease();
    const second = await claim.session.stopAndRelease();

    expect(second).toEqual(first);
    expect(port.releaseCount).toBe(1);
  });

  it("keeps release failure terminal and prevents later release attempts", async () => {
    const port = new ScriptedLeasePort({
      status: "acquired",
      lease: activeLease(studyFixture())
    });
    port.releaseImplementation = () => {
      throw new Error("disk unavailable");
    };
    const claim = await factory(port).acquire(studyFixture());
    if (claim.status !== "acquired") throw new Error("expected acquired session");

    const first = claim.session.stopAndRelease();
    await expect(first).rejects.toMatchObject({
      code: "research_control_study_execution_lease_release_failed"
    });
    const status = claim.session.status();
    expect(status).toMatchObject({
      status: "release_failed",
      errorCode: "research_control_study_execution_lease_release_failed"
    });
    await expect(claim.session.stopAndRelease()).rejects.toMatchObject({
      code: "research_control_study_execution_lease_release_failed"
    });
    expect(port.releaseCount).toBe(1);
  });

  it.each([
    { leaseDurationMs: 0, renewalIntervalMs: 10_000 },
    { leaseDurationMs: 30_000, renewalIntervalMs: 0 },
    { leaseDurationMs: 30_000, renewalIntervalMs: 15_000 },
    { leaseDurationMs: 30_000, renewalIntervalMs: 15_001 },
    { leaseDurationMs: 30_000.5, renewalIntervalMs: 10_000 }
  ])("rejects invalid lease timing %#", (timing) => {
    expect(() => createResearchControlStudyExecutionLeaseSessionFactory({
      port: new ScriptedLeasePort({
        status: "acquired",
        lease: activeLease(studyFixture())
      }),
      owner: ownerFixture(),
      ...timing
    })).toThrowError(expect.objectContaining({
      code: "research_control_study_execution_lease_session_invalid"
    }));
  });
});

function factory(
  port: ResearchControlStudyExecutionLeasePort,
  sleep?: (milliseconds: number) => Promise<void>
) {
  return createResearchControlStudyExecutionLeaseSessionFactory({
    port,
    owner: ownerFixture(),
    leaseDurationMs: 30_000,
    renewalIntervalMs: 10_000,
    ...(sleep ? { sleep } : {})
  });
}

class ScriptedLeasePort implements ResearchControlStudyExecutionLeasePort {
  renewCount = 0;
  assertCount = 0;
  releaseCount = 0;
  fencedWriteCount = 0;
  releaseInputs: ResearchControlStudyExecutionLeaseRecord[] = [];
  renewImplementation = (
    lease: ResearchControlStudyExecutionLeaseRecord
  ): ResearchControlStudyExecutionLeaseRecord => lease;
  assertImplementation = (
    lease: ResearchControlStudyExecutionLeaseRecord
  ): ResearchControlStudyExecutionLeaseRecord => lease;
  releaseImplementation = (
    lease: ResearchControlStudyExecutionLeaseRecord
  ): ResearchControlStudyExecutionLeaseRecord =>
    closeResearchControlStudyExecutionLease({
      lease,
      leaseStatus: "released",
      closedAt: lease.renewed_at
    });
  fencedWriteImplementation = async <T>(
    _lease: ResearchControlStudyExecutionLeaseRecord,
    write: () => Promise<T>
  ): Promise<T> => write();

  constructor(
    private readonly acquireResult: ResearchControlStudyExecutionLeaseAcquireResult
  ) {}

  async acquire(): Promise<ResearchControlStudyExecutionLeaseAcquireResult> {
    return structuredClone(this.acquireResult);
  }

  async renew(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord> {
    this.renewCount += 1;
    return structuredClone(this.renewImplementation(structuredClone(input.lease)));
  }

  async assertOwned(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord> {
    this.assertCount += 1;
    return structuredClone(this.assertImplementation(structuredClone(input.lease)));
  }

  async withFencedWrite<T>(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
    write: () => Promise<T>;
  }): Promise<T> {
    this.fencedWriteCount += 1;
    return this.fencedWriteImplementation(
      structuredClone(input.lease),
      input.write
    );
  }

  async release(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord> {
    this.releaseCount += 1;
    this.releaseInputs.push(structuredClone(input.lease));
    return structuredClone(this.releaseImplementation(structuredClone(input.lease)));
  }
}

class DeferredSleep {
  readonly intervals: number[] = [];
  private readonly sleeps: Array<ReturnType<typeof deferred<void>>> = [];
  private waitGate = deferred<void>();

  readonly sleep = (milliseconds: number): Promise<void> => {
    this.intervals.push(milliseconds);
    const gate = deferred<void>();
    this.sleeps.push(gate);
    this.waitGate.resolve();
    return gate.promise;
  };

  get pendingCount(): number {
    return this.sleeps.length;
  }

  async waiting(): Promise<void> {
    await this.waitGate.promise;
    this.waitGate = deferred<void>();
  }

  wake(): void {
    const sleep = this.sleeps.shift();
    if (!sleep) throw new Error("no pending sleep");
    sleep.resolve();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

async function eventually(assertion: () => void): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      if (attempt === 19) throw error;
      await Promise.resolve();
    }
  }
}

function activeLease(
  study: ResearchControlStudyRecord,
  leaseToken = "lease-token-a"
): ResearchControlStudyExecutionLeaseRecord {
  return decideResearchControlStudyExecutionLease({
    study,
    owner: ownerFixture(),
    leaseToken,
    fencingToken: 1,
    leaseDurationMs: 30_000,
    acquiredAt: "2026-07-13T00:00:00.000Z"
  });
}

function ownerFixture(): ResearchControlStudyExecutionLeaseOwner {
  return {
    server_instance_id: "server-a",
    host_id: "host-a",
    process_id: 101,
    process_start_marker: "process-start-a"
  };
}

function studyFixture(): ResearchControlStudyRecord {
  return decideResearchControlStudy({
    idempotencyKey: "lease-session-study",
    baselineSnapshotDigest: digest("a"),
    replicationIdempotencyKeys: Array.from({ length: 6 }, (_, index) =>
      `lease-session-replication-${index + 1}`
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
      allocation_policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
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
