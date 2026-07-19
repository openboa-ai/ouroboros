import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GatewayRuntimeBinding,
  PaperTradingApiProviderOptions
} from "@ouroboros/application/trading/gateway/runtime-binding";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import { invalidatePaperTradingEvaluation } from "@ouroboros/application/trading/paper/commitment";
import { PaperTradingEvaluationRunner } from "@ouroboros/application/trading/paper/evaluation-runner";
import {
  PaperTradingSessionService,
  type PaperTradingRecoveryOutcome
} from "@ouroboros/application/trading/paper/session-service";
import type { AccountState, ReplayTradingApiProviderSession } from "@ouroboros/application/trading/research/types";
import type {
  CandidateInspectReadModel,
  PaperTradingEvaluationRecord,
  SandboxLogRecord,
  SandboxPlacementRecord,
  SandboxRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import type {
  SandboxAdapter,
  SandboxAdapterObservationResult,
  SandboxAdapterStartInput,
  SandboxAdapterStartResult
} from "@ouroboros/adapters/sandbox/adapter";
import { buildServer } from "../src/server";
import type { RuntimeSupervisor } from "../src/runtime-supervisor";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

const INTERVAL_MS = 3_600_000;
const ARTIFACT_DIGEST = "sha256:multi-run-paper-session-v1";

let tmpDir: string;
let services: PaperTradingSessionService[];

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-paper-multi-run-"));
  services = [];
});

afterEach(async () => {
  await Promise.allSettled(services.map((service) => service.stopAllSessions()));
  await rm(tmpDir, { recursive: true, force: true });
});

describe("multi-run paper TradingSystem sessions", () => {
  it("isolates default, additional, and inert qualification session state", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await requireFixtureCandidate(store);
    const additionalRun = await store.createPaperTradingRun({
      idempotency_key: "multi-run-isolation-additional",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback"
    });
    const qualificationRun = await store.createPaperTradingRun({
      idempotency_key: "multi-run-isolation-qualification",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification"
    });
    const defaultRunId = candidate.runtime.ref.id;
    const additionalRunId = additionalRun.trading_run_id;
    const qualificationRunId = qualificationRun.trading_run_id;
    const sandbox = runKeyedSandboxHarness();
    sandbox.enqueue(defaultRunId, [
      paperOrderLine({
        eventId: "default-event",
        runId: defaultRunId,
        at: "2026-07-10T01:00:03.000Z",
        side: "buy",
        limitPrice: "60000"
      })
    ]);
    sandbox.enqueue(additionalRunId, [
      paperOrderLine({
        eventId: "additional-event",
        runId: additionalRunId,
        at: "2026-07-10T01:01:03.000Z",
        side: "sell",
        limitPrice: "70000"
      })
    ]);
    const providers = runKeyedProviderHarness();
    const runner = new PaperTradingEvaluationRunner();
    const service = paperSessionService({
      store,
      sandbox,
      providers,
      runner,
      digest: () => ARTIFACT_DIGEST,
      executionSnapshots: [
        {
          observed_at: "2026-07-10T01:00:03.000Z",
          agg_trades: [{
            trade_id: "default-public-trade",
            price: "60000",
            quantity: "0.001",
            trade_time: "2026-07-10T01:00:03.500Z"
          }]
        },
        {
          observed_at: "2026-07-10T01:01:03.000Z",
          agg_trades: [{
            trade_id: "additional-public-trade",
            price: "70000",
            quantity: "0.001",
            trade_time: "2026-07-10T01:01:03.500Z"
          }]
        }
      ]
    });

    const preparedQualification = await service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: qualificationRunId,
      evidencePurpose: "qualification",
      clock: "external"
    });
    const preparedDefault = await service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: defaultRunId,
      evidencePurpose: "research_feedback",
      clock: "scheduled"
    });
    await service.activate(preparedDefault);
    const defaultObservation = await service.observe(defaultRunId);
    await service.schedule(defaultRunId);
    const preparedAdditional = await service.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: additionalRunId,
      evidencePurpose: "research_feedback",
      clock: "external"
    });
    await service.activate(preparedAdditional);
    const additionalObservation = await service.observe(additionalRunId);

    const defaultEvaluation = await requireEvaluation(store, defaultRunId);
    const additionalEvaluation = await requireEvaluation(store, additionalRunId);
    const defaultCandidate = await requireRunCandidate(store, defaultRunId);
    const additionalCandidate = await requireRunCandidate(store, additionalRunId);
    const defaultSandbox = defaultCandidate.runtime.sandbox;
    const additionalSandbox = additionalCandidate.runtime.sandbox;
    const defaultObservations = await store.listPaperTradingObservations(
      defaultEvaluation.paper_trading_evaluation_id
    );
    const additionalObservations = await store.listPaperTradingObservations(
      additionalEvaluation.paper_trading_evaluation_id
    );
    const defaultLedgerIds = ledgerIds(defaultCandidate);
    const additionalLedgerIds = ledgerIds(additionalCandidate);

    expect(defaultEvaluation.trading_run_ref.id).not.toBe(additionalEvaluation.trading_run_ref.id);
    expect(defaultEvaluation.paper_trading_evaluation_id)
      .not.toBe(additionalEvaluation.paper_trading_evaluation_id);
    expect(defaultEvaluation.processed_trading_system_event_ids).toContain("default-event");
    expect(defaultEvaluation.processed_trading_system_event_ids).not.toContain("additional-event");
    expect(additionalEvaluation.processed_trading_system_event_ids).toContain("additional-event");
    expect(additionalEvaluation.processed_trading_system_event_ids).not.toContain("default-event");
    expect(defaultEvaluation.processed_public_trade_ids).toContain("default-public-trade");
    expect(defaultEvaluation.processed_public_trade_ids).not.toContain("additional-public-trade");
    expect(additionalEvaluation.processed_public_trade_ids).toContain("additional-public-trade");
    expect(additionalEvaluation.processed_public_trade_ids).not.toContain("default-public-trade");
    expect(defaultSandbox?.sandbox_id).not.toBe(additionalSandbox?.sandbox_id);
    expect(defaultSandbox?.workspace_key).toEqual(expect.stringMatching(/^sha256:/));
    expect(additionalSandbox?.workspace_key).toEqual(expect.stringMatching(/^sha256:/));
    expect(defaultSandbox?.workspace_key).toBe(additionalSandbox?.workspace_key);
    expect(defaultSandbox?.generation).toBe(1);
    expect(additionalSandbox?.generation).toBe(1);
    expect(defaultLedgerIds).not.toEqual(additionalLedgerIds);
    expect(new Set([...defaultLedgerIds, ...additionalLedgerIds]).size)
      .toBe(defaultLedgerIds.length + additionalLedgerIds.length);

    expect(defaultObservation.observation?.paper_trading_observation_id)
      .not.toBe(additionalObservation.observation?.paper_trading_observation_id);
    expect(defaultObservations).toHaveLength(1);
    expect(additionalObservations).toHaveLength(1);
    expect(defaultObservations[0]).toMatchObject({
      paper_trading_evaluation_ref: { id: defaultEvaluation.paper_trading_evaluation_id },
      trading_run_ref: { id: defaultRunId },
      processed_trading_system_event_ids: ["default-event"],
      processed_public_trade_ids: ["default-public-trade"]
    });
    expect(additionalObservations[0]).toMatchObject({
      paper_trading_evaluation_ref: { id: additionalEvaluation.paper_trading_evaluation_id },
      trading_run_ref: { id: additionalRunId },
      processed_trading_system_event_ids: ["additional-event"],
      processed_public_trade_ids: ["additional-public-trade"]
    });
    expect(defaultObservations[0]?.ledger_ref?.id).not.toBe(additionalObservations[0]?.ledger_ref?.id);
    expect(defaultObservations[0]?.paper_account_snapshot).toEqual(defaultEvaluation.paper_account_snapshot);
    expect(additionalObservations[0]?.paper_account_snapshot).toEqual(additionalEvaluation.paper_account_snapshot);

    const defaultProviderUrl = sandbox.providerUrl(defaultRunId);
    const additionalProviderUrl = sandbox.providerUrl(additionalRunId);
    expect(defaultProviderUrl).toEqual(expect.any(String));
    expect(additionalProviderUrl).toEqual(expect.any(String));
    expect(defaultProviderUrl).not.toBe(additionalProviderUrl);
    const defaultProvider = providers.require(defaultProviderUrl!);
    const additionalProvider = providers.require(additionalProviderUrl!);
    expect(defaultProvider.providerId).not.toBe(additionalProvider.providerId);
    expect(defaultProvider.readAccountState).not.toBe(additionalProvider.readAccountState);
    expect(await defaultProvider.readAccountState()).toMatchObject({
      equity: Number(defaultEvaluation.paper_account_snapshot?.equity_usdt)
    });
    expect(await additionalProvider.readAccountState()).toMatchObject({
      equity: Number(additionalEvaluation.paper_account_snapshot?.equity_usdt)
    });
    expect(service.active(defaultRunId)).toBe(true);
    expect(service.active(additionalRunId)).toBe(true);
    expect(service.active(qualificationRunId)).toBe(false);
    expect(runner.active(defaultRunId)).toBe(true);
    expect(runner.active(additionalRunId)).toBe(false);
    expect(sandbox.starts(qualificationRunId)).toBe(0);
    expect(providers.starts()).toBe(2);
    expect(await store.listPaperTradingObservations(
      preparedQualification.evaluation.paper_trading_evaluation_id
    )).toEqual([]);

    const defaultBeforeOtherTerminalChanges = await researchRunSnapshot(store, defaultRunId);
    await service.stop(additionalRunId);
    const stoppedAdditionalBeforeQualificationInvalidation = await researchRunSnapshot(store, additionalRunId);
    const effectCountsBeforeQualificationInvalidation = {
      providerStarts: providers.starts(),
      sandboxStarts: sandbox.totalStarts(),
      sandboxStops: sandbox.totalStops()
    };
    const invalidatedQualification = invalidatePaperTradingEvaluation({
      evaluation: preparedQualification.evaluation,
      verification: {
        status: "invalidated",
        reason: "resolved_artifact_digest_mismatch",
        diagnostic: "Qualification commitment was invalidated without runtime effects."
      },
      invalidatedAt: "2026-07-10T01:02:03.000Z"
    });
    await store.recordPaperTradingEvaluation(invalidatedQualification);

    expect(await researchRunSnapshot(store, defaultRunId)).toEqual(defaultBeforeOtherTerminalChanges);
    expect(await researchRunSnapshot(store, additionalRunId))
      .toEqual(stoppedAdditionalBeforeQualificationInvalidation);
    expect(service.active(defaultRunId)).toBe(true);
    expect(runner.active(defaultRunId)).toBe(true);
    expect(defaultProvider.closed).toBe(false);
    expect(providers.require(additionalProviderUrl!).closed).toBe(true);
    expect({
      providerStarts: providers.starts(),
      sandboxStarts: sandbox.totalStarts(),
      sandboxStops: sandbox.totalStops()
    }).toEqual(effectCountsBeforeQualificationInvalidation);
    expect(await requireEvaluation(store, qualificationRunId)).toMatchObject({
      status: "invalidated",
      invalidation_reason: "resolved_artifact_digest_mismatch",
      observation_count: 0
    });
    expect((await store.getTradingRun(qualificationRunId))?.sandbox_ref).toBeUndefined();
  });

  it("recovers stopped runtimes for persisted running evaluations without consuming evidence", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await requireFixtureCandidate(store);
    const defaultRunId = candidate.runtime.ref.id;
    const additionalRun = await store.createPaperTradingRun({
      idempotency_key: "multi-run-restart-additional",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback"
    });
    const qualificationRun = await store.createPaperTradingRun({
      idempotency_key: "multi-run-restart-qualification",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification"
    });
    const additionalRunId = additionalRun.trading_run_id;
    const qualificationRunId = qualificationRun.trading_run_id;
    const initialSandbox = runKeyedSandboxHarness();
    initialSandbox.enqueue(defaultRunId, [
      paperOrderLine({
        eventId: "restart-default-event",
        runId: defaultRunId,
        at: "2026-07-10T02:00:03.000Z",
        side: "buy",
        limitPrice: "60000"
      })
    ]);
    initialSandbox.enqueue(additionalRunId, [
      paperOrderLine({
        eventId: "restart-additional-event",
        runId: additionalRunId,
        at: "2026-07-10T02:01:03.000Z",
        side: "sell",
        limitPrice: "70000"
      })
    ]);
    const initialProviders = runKeyedProviderHarness();
    const initialRunner = new PaperTradingEvaluationRunner();
    const initialService = paperSessionService({
      store,
      sandbox: initialSandbox,
      providers: initialProviders,
      runner: initialRunner,
      digest: () => ARTIFACT_DIGEST
    });
    const preparedQualification = await initialService.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: qualificationRunId,
      evidencePurpose: "qualification",
      clock: "external"
    });
    const preparedDefault = await initialService.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: defaultRunId,
      evidencePurpose: "research_feedback",
      clock: "scheduled"
    });
    await initialService.activate(preparedDefault);
    await initialService.observe(defaultRunId);
    await initialService.schedule(defaultRunId);
    const preparedAdditional = await initialService.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: additionalRunId,
      evidencePurpose: "research_feedback",
      clock: "external"
    });
    await initialService.activate(preparedAdditional);
    await initialService.observe(additionalRunId);

    const commitmentsBeforeCleanup = structuredClone(await store.listPaperTradingEvaluationCommitments());
    const defaultEvaluationBeforeCleanup = structuredClone(await requireEvaluation(store, defaultRunId));
    const additionalEvaluationBeforeCleanup = structuredClone(await requireEvaluation(store, additionalRunId));
    const qualificationEvaluationBeforeCleanup = structuredClone(await requireEvaluation(store, qualificationRunId));
    const defaultEvidenceBeforeCleanup = await evidenceSnapshot(store, defaultRunId);
    const additionalEvidenceBeforeCleanup = await evidenceSnapshot(store, additionalRunId);
    const defaultWorkspaceKeyBeforeCleanup = (
      await requireRunCandidate(store, defaultRunId)
    ).runtime.sandbox?.workspace_key;
    const additionalWorkspaceKeyBeforeCleanup = (
      await requireRunCandidate(store, additionalRunId)
    ).runtime.sandbox?.workspace_key;
    await initialService.stopAllSessions();

    expect(await requireEvaluation(store, defaultRunId)).toEqual(defaultEvaluationBeforeCleanup);
    expect(await requireEvaluation(store, additionalRunId)).toEqual(additionalEvaluationBeforeCleanup);
    expect((await store.getTradingRun(defaultRunId))?.runtime_lifecycle_status).toBe("stopped");
    expect((await store.getTradingRun(additionalRunId))?.runtime_lifecycle_status).toBe("stopped");
    expect(initialService.active(defaultRunId)).toBe(false);
    expect(initialService.active(additionalRunId)).toBe(false);
    expect(initialRunner.active(defaultRunId)).toBe(false);

    const recoverySandbox = runKeyedSandboxHarness();
    recoverySandbox.enqueue(defaultRunId, [
      paperOrderLine({
        eventId: "unconsumed-default-recovery-event",
        runId: defaultRunId,
        at: "2026-07-10T02:02:03.000Z",
        side: "buy",
        limitPrice: "59000"
      })
    ]);
    recoverySandbox.enqueue(additionalRunId, [
      paperOrderLine({
        eventId: "unconsumed-additional-recovery-event",
        runId: additionalRunId,
        at: "2026-07-10T02:03:03.000Z",
        side: "sell",
        limitPrice: "71000"
      })
    ]);
    const recoveryProviders = runKeyedProviderHarness();
    const recoveryRunner = new PaperTradingEvaluationRunner();
    const recoveryService = paperSessionService({
      store,
      sandbox: recoverySandbox,
      providers: recoveryProviders,
      runner: recoveryRunner,
      digest: () => ARTIFACT_DIGEST
    });

    const outcomes = await recoveryService.recoverRunningEvaluations();

    expect(outcomes).toHaveLength(3);
    expect(outcomes).toEqual(expect.arrayContaining([
      { tradingRunId: defaultRunId, status: "recovered", clock: "scheduled" },
      { tradingRunId: additionalRunId, status: "recovered", clock: "external" },
      { tradingRunId: qualificationRunId, status: "skipped", reason: "evaluation_not_running" }
    ]));
    expect(recoveryService.active(defaultRunId)).toBe(true);
    expect(recoveryService.active(additionalRunId)).toBe(true);
    expect(recoveryService.active(qualificationRunId)).toBe(false);
    expect(recoveryRunner.active(defaultRunId)).toBe(true);
    expect(recoveryRunner.active(additionalRunId)).toBe(false);
    expect((await store.getTradingRun(defaultRunId))?.runtime_lifecycle_status).toBe("running");
    expect((await store.getTradingRun(additionalRunId))?.runtime_lifecycle_status).toBe("running");
    expect(recoverySandbox.starts(defaultRunId)).toBe(1);
    expect(recoverySandbox.starts(additionalRunId)).toBe(1);
    expect(recoverySandbox.starts(qualificationRunId)).toBe(0);
    expect(recoveryProviders.starts()).toBe(2);
    expect((await requireRunCandidate(store, defaultRunId)).runtime.sandbox)
      .toMatchObject({
        workspace_key: defaultWorkspaceKeyBeforeCleanup,
        generation: 2
      });
    expect((await requireRunCandidate(store, additionalRunId)).runtime.sandbox)
      .toMatchObject({
        workspace_key: additionalWorkspaceKeyBeforeCleanup,
        generation: 2
      });
    expect(await store.listPaperTradingEvaluationCommitments()).toEqual(commitmentsBeforeCleanup);
    expect(await requireEvaluation(store, defaultRunId)).toEqual(defaultEvaluationBeforeCleanup);
    expect(await requireEvaluation(store, additionalRunId)).toEqual(additionalEvaluationBeforeCleanup);
    expect(await evidenceSnapshot(store, defaultRunId)).toEqual(defaultEvidenceBeforeCleanup);
    expect(await evidenceSnapshot(store, additionalRunId)).toEqual(additionalEvidenceBeforeCleanup);
    expect((await requireEvaluation(store, defaultRunId)).processed_trading_system_event_ids)
      .not.toContain("unconsumed-default-recovery-event");
    expect((await requireEvaluation(store, additionalRunId)).processed_trading_system_event_ids)
      .not.toContain("unconsumed-additional-recovery-event");

    const effectsBeforeQualificationReload = {
      providerStarts: recoveryProviders.starts(),
      sandboxStarts: recoverySandbox.totalStarts(),
      commitments: structuredClone(await store.listPaperTradingEvaluationCommitments())
    };
    const reloadedQualification = await recoveryService.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: qualificationRunId,
      evidencePurpose: "qualification",
      clock: "external"
    });
    expect(reloadedQualification.commitment).toEqual(preparedQualification.commitment);
    expect(reloadedQualification.evaluation).toEqual(qualificationEvaluationBeforeCleanup);
    expect(reloadedQualification.verification.status).toBe("verified");
    expect(await store.listPaperTradingEvaluationCommitments()).toEqual(effectsBeforeQualificationReload.commitments);
    expect(recoveryProviders.starts()).toBe(effectsBeforeQualificationReload.providerStarts);
    expect(recoverySandbox.totalStarts()).toBe(effectsBeforeQualificationReload.sandboxStarts);
    expect(recoveryService.active(qualificationRunId)).toBe(false);
    expect(await requireEvaluation(store, defaultRunId)).toEqual(defaultEvaluationBeforeCleanup);
  });

  it("restarts a running Sandbox when recovery creates a new provider URL", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await requireFixtureCandidate(store);
    const tradingRunId = candidate.runtime.ref.id;
    const sandbox = runKeyedSandboxHarness();
    const providers = runKeyedProviderHarness();
    const initialService = paperSessionService({
      store,
      sandbox,
      providers,
      runner: new PaperTradingEvaluationRunner(),
      digest: () => ARTIFACT_DIGEST
    });
    const prepared = await initialService.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId,
      evidencePurpose: "research_feedback",
      clock: "scheduled"
    });
    await initialService.activate(prepared);
    const initialProviderUrl = sandbox.providerUrl(tradingRunId);
    expect(initialProviderUrl).toBeDefined();

    const recoveryService = paperSessionService({
      store,
      sandbox,
      providers,
      runner: new PaperTradingEvaluationRunner(),
      digest: () => ARTIFACT_DIGEST
    });

    await expect(recoveryService.recoverRunningEvaluations()).resolves.toContainEqual({
      tradingRunId,
      status: "recovered",
      clock: "scheduled"
    });
    expect(providers.starts()).toBe(2);
    expect(sandbox.starts(tradingRunId)).toBe(2);
    expect(sandbox.totalStops()).toBe(1);
    expect(sandbox.providerUrl(tradingRunId)).not.toBe(initialProviderUrl);
  });

  it("skips a persisted running qualification before resolving artifacts or mutating session state", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await requireFixtureCandidate(store);
    const qualificationRun = await store.createPaperTradingRun({
      idempotency_key: "multi-run-running-qualification-inertness",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification"
    });
    const initialService = paperSessionService({
      store,
      sandbox: runKeyedSandboxHarness(),
      providers: runKeyedProviderHarness(),
      runner: new PaperTradingEvaluationRunner(),
      digest: () => ARTIFACT_DIGEST
    });
    const prepared = await initialService.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: qualificationRun.trading_run_id,
      evidencePurpose: "qualification",
      clock: "external"
    });
    await store.recordPaperTradingEvaluation({
      ...prepared.evaluation,
      status: "running",
      next_observation_at: "2026-07-10T02:30:03.000Z"
    });
    const stateBeforeRecovery = await persistedRunState(store, qualificationRun.trading_run_id);
    const sandbox = runKeyedSandboxHarness();
    const providers = runKeyedProviderHarness();
    const runner = new PaperTradingEvaluationRunner();
    let artifactResolutions = 0;
    const recoveryService = paperSessionService({
      store,
      sandbox,
      providers,
      runner,
      digest: () => {
        artifactResolutions += 1;
        return "sha256:mismatched-running-qualification";
      }
    });

    const outcomes = await recoveryService.recoverRunningEvaluations();

    expect(outcomes).toEqual(expect.arrayContaining([{
      tradingRunId: qualificationRun.trading_run_id,
      status: "skipped",
      reason: "qualification"
    }]));
    expect(await persistedRunState(store, qualificationRun.trading_run_id))
      .toEqual(stateBeforeRecovery);
    expect(artifactResolutions).toBe(0);
    expect(providers.starts()).toBe(0);
    expect(sandbox.totalStarts()).toBe(0);
    expect(sandbox.totalStops()).toBe(0);
    expect(recoveryService.active(qualificationRun.trading_run_id)).toBe(false);
    expect(runner.active(qualificationRun.trading_run_id)).toBe(false);
  });

  it("keeps a purpose mismatch retryable until explicit recovery exhaustion", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await requireFixtureCandidate(store);
    const researchRun = await store.createPaperTradingRun({
      idempotency_key: "multi-run-recovery-purpose-mismatch",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback"
    });
    const initialService = paperSessionService({
      store,
      sandbox: runKeyedSandboxHarness(),
      providers: runKeyedProviderHarness(),
      runner: new PaperTradingEvaluationRunner(),
      digest: () => ARTIFACT_DIGEST
    });
    const prepared = await initialService.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: researchRun.trading_run_id,
      evidencePurpose: "research_feedback",
      clock: "external"
    });
    await store.recordPaperTradingEvaluation({
      ...prepared.evaluation,
      status: "running",
      next_observation_at: "2026-07-10T02:40:03.000Z"
    });
    const sandbox = runKeyedSandboxHarness();
    const providers = runKeyedProviderHarness();
    const runner = new PaperTradingEvaluationRunner();
    let artifactResolutions = 0;
    const recoveryService = paperSessionService({
      store: storeWithTradingRunPurpose(
        store,
        researchRun.trading_run_id,
        "qualification"
      ),
      sandbox,
      providers,
      runner,
      digest: () => {
        artifactResolutions += 1;
        return ARTIFACT_DIGEST;
      }
    });

    const outcomes = await recoveryService.recoverRunningEvaluations({
      persistFailures: false
    });

    expect(outcomes).toEqual(expect.arrayContaining([{
      tradingRunId: researchRun.trading_run_id,
      status: "failed",
      error: "PaperTradingSession recovery purpose does not match the persisted commitment."
    }]));
    const retryableEvaluation = await requireEvaluation(store, researchRun.trading_run_id);
    expect(retryableEvaluation).toMatchObject({
      status: "running",
      next_observation_at: "2026-07-10T02:40:03.000Z"
    });

    await recoveryService.finalizeRecoveryFailures(outcomes);

    const failedEvaluation = await requireEvaluation(store, researchRun.trading_run_id);
    expect(failedEvaluation.status).toBe("failed");
    expect(failedEvaluation.latest_failure_reason).toBe(
      "PaperTradingSession recovery purpose does not match the persisted commitment."
    );
    expect(failedEvaluation.next_observation_at).toBeUndefined();
    expect(artifactResolutions).toBe(0);
    expect(providers.starts()).toBe(0);
    expect(sandbox.totalStarts()).toBe(0);
    expect(sandbox.totalStops()).toBe(0);
    expect(recoveryService.active(researchRun.trading_run_id)).toBe(false);
    expect(runner.active(researchRun.trading_run_id)).toBe(false);
  });

  it("automatically restores default scheduled and additional external sessions during runtime bootstrap", async () => {
    const store = new LocalStore(tmpDir);
    const firstSandbox = runKeyedSandboxHarness();
    const firstProviders = runKeyedProviderHarness();
    const firstCapture: { service?: PaperTradingSessionService } = {};
    const firstServer = await buildServer({
      store,
      sandboxAdapters: { deterministic_test: firstSandbox },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: INTERVAL_MS,
      paperTradingApiProviderFactory: firstProviders.factory,
      paperTradingArtifactResolver: {
        async resolveArtifactDigest() {
          return ARTIFACT_DIGEST;
        }
      },
      onPaperTradingSessionServiceCreated(service) {
        firstCapture.service = service;
      }
    });
    const firstService = requireCapturedService(firstCapture.service);
    const candidate = await requireFixtureCandidate(store);
    const defaultRunId = candidate.runtime.ref.id;
    const additionalRun = await store.createPaperTradingRun({
      idempotency_key: "multi-run-runtime-bootstrap-additional",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback"
    });
    const additionalRunId = additionalRun.trading_run_id;
    const preparedDefault = await firstService.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: defaultRunId,
      evidencePurpose: "research_feedback",
      clock: "scheduled"
    });
    await firstService.activate(preparedDefault);
    await firstService.schedule(defaultRunId);
    const preparedAdditional = await firstService.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: additionalRunId,
      evidencePurpose: "research_feedback",
      clock: "external"
    });
    await firstService.activate(preparedAdditional);
    expect(firstService.active(defaultRunId)).toBe(true);
    expect(firstService.active(additionalRunId)).toBe(true);
    expect(firstSandbox.starts(defaultRunId)).toBe(1);
    expect(firstSandbox.starts(additionalRunId)).toBe(1);
    expect(firstProviders.starts()).toBe(2);

    const commitmentsBeforeRestart = structuredClone(
      await store.listPaperTradingEvaluationCommitments()
    );
    const defaultEvidenceBeforeRestart = await evidenceSnapshot(store, defaultRunId);
    const additionalEvidenceBeforeRestart = await evidenceSnapshot(store, additionalRunId);
    await firstServer.close();
    expect(await requireEvaluation(store, defaultRunId))
      .toEqual(defaultEvidenceBeforeRestart.evaluation);
    expect(await requireEvaluation(store, additionalRunId))
      .toEqual(additionalEvidenceBeforeRestart.evaluation);
    expect((await store.getTradingRun(defaultRunId))?.runtime_lifecycle_status).toBe("stopped");
    expect((await store.getTradingRun(additionalRunId))?.runtime_lifecycle_status).toBe("stopped");

    const recoverySandbox = runKeyedSandboxHarness();
    recoverySandbox.enqueue(defaultRunId, [paperOrderLine({
      eventId: "unconsumed-bootstrap-default-event",
      runId: defaultRunId,
      at: "2026-07-10T02:50:03.000Z",
      side: "buy",
      limitPrice: "60000"
    })]);
    recoverySandbox.enqueue(additionalRunId, [paperOrderLine({
      eventId: "unconsumed-bootstrap-additional-event",
      runId: additionalRunId,
      at: "2026-07-10T02:51:03.000Z",
      side: "sell",
      limitPrice: "70000"
    })]);
    const recoveryProviders = runKeyedProviderHarness();
    const recoveryServiceCapture: { service?: PaperTradingSessionService } = {};
    const recoveryOutcomeCapture = paperTradingRecoveryCapture();
    const restartedServer = await buildServer({
      store,
      sandboxAdapters: { deterministic_test: recoverySandbox },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: INTERVAL_MS,
      paperTradingApiProviderFactory: recoveryProviders.factory,
      paperTradingArtifactResolver: {
        async resolveArtifactDigest() {
          return ARTIFACT_DIGEST;
        }
      },
      onPaperTradingSessionServiceCreated(service) {
        recoveryServiceCapture.service = service;
      },
      onPaperTradingRecovery(outcomes) {
        recoveryOutcomeCapture.observe(outcomes);
      }
    });

    try {
      const recoveryService = requireCapturedService(recoveryServiceCapture.service);
      const recoveryOutcomes = await recoveryOutcomeCapture.outcomes;
      expect(recoveryOutcomes).toEqual(expect.arrayContaining([
        { tradingRunId: defaultRunId, status: "recovered", clock: "scheduled" },
        { tradingRunId: additionalRunId, status: "recovered", clock: "external" }
      ]));
      expect(recoveryService.active(defaultRunId)).toBe(true);
      expect(recoveryService.active(additionalRunId)).toBe(true);
      expect(recoverySandbox.starts(defaultRunId)).toBe(1);
      expect(recoverySandbox.starts(additionalRunId)).toBe(1);
      expect(recoveryProviders.starts()).toBe(2);
      expect((await store.getTradingRun(defaultRunId))?.runtime_lifecycle_status).toBe("running");
      expect((await store.getTradingRun(additionalRunId))?.runtime_lifecycle_status).toBe("running");
      expect(await store.listPaperTradingEvaluationCommitments()).toEqual(commitmentsBeforeRestart);
      expect(await evidenceSnapshot(store, defaultRunId)).toEqual(defaultEvidenceBeforeRestart);
      expect(await evidenceSnapshot(store, additionalRunId)).toEqual(additionalEvidenceBeforeRestart);
      expect((await requireEvaluation(store, defaultRunId)).processed_trading_system_event_ids)
        .not.toContain("unconsumed-bootstrap-default-event");
      expect((await requireEvaluation(store, additionalRunId)).processed_trading_system_event_ids)
        .not.toContain("unconsumed-bootstrap-additional-event");
    } finally {
      await restartedServer.close();
    }
  });

  it("keeps runtime bootstrap ready when the recovery outcome observer rejects", async () => {
    const observerError = new Error("recovery observer failed");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let server: Awaited<ReturnType<typeof buildServer>> | undefined;
    try {
      server = await buildServer({
        store: new LocalStore(tmpDir),
        sandboxAdapters: { deterministic_test: runKeyedSandboxHarness() },
        marketDataPort: fakeGatewayMarketDataPort(),
        paperTradingApiProviderFactory: runKeyedProviderHarness().factory,
        paperTradingArtifactResolver: {
          async resolveArtifactDigest() {
            return ARTIFACT_DIGEST;
          }
        },
        async onPaperTradingRecovery() {
          throw observerError;
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const health = await server.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
      expect(errorSpy).toHaveBeenCalledWith(
        "PaperTrading recovery observer failed.",
        observerError
      );
    } finally {
      await server?.close();
      errorSpy.mockRestore();
    }
  });

  it("persists one recovery failure and continues recovering healthy runs", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await requireFixtureCandidate(store);
    const defaultRunId = candidate.runtime.ref.id;
    const failingRun = await store.createPaperTradingRun({
      idempotency_key: "multi-run-recovery-failing",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback"
    });
    const healthyRun = await store.createPaperTradingRun({
      idempotency_key: "multi-run-recovery-healthy",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "research_feedback"
    });
    const qualificationRun = await store.createPaperTradingRun({
      idempotency_key: "multi-run-recovery-qualification",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification"
    });
    const initialService = paperSessionService({
      store,
      sandbox: runKeyedSandboxHarness(),
      providers: runKeyedProviderHarness(),
      runner: new PaperTradingEvaluationRunner(),
      digest: () => ARTIFACT_DIGEST
    });
    const preparedQualification = await initialService.prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: qualificationRun.trading_run_id,
      evidencePurpose: "qualification",
      clock: "external"
    });
    for (const [tradingRunId, clock] of [
      [defaultRunId, "scheduled"],
      [failingRun.trading_run_id, "external"],
      [healthyRun.trading_run_id, "external"]
    ] as const) {
      const prepared = await initialService.prepare({
        candidateId: candidate.candidate_id,
        candidateVersionId: candidate.candidate_version.candidate_version_id,
        tradingRunId,
        evidencePurpose: "research_feedback",
        clock
      });
      await initialService.activate(prepared);
    }
    await initialService.stop(defaultRunId);
    const stoppedDefaultBeforeRecovery = structuredClone(await requireEvaluation(store, defaultRunId));
    await initialService.stopAllSessions();
    expect((await store.getTradingRun(failingRun.trading_run_id))?.runtime_lifecycle_status).toBe("stopped");
    expect((await store.getTradingRun(healthyRun.trading_run_id))?.runtime_lifecycle_status).toBe("stopped");

    const recoverySandbox = runKeyedSandboxHarness();
    recoverySandbox.failStart(failingRun.trading_run_id);
    const recoveryProviders = runKeyedProviderHarness();
    const recoveryServiceCapture: { service?: PaperTradingSessionService } = {};
    const recoveryOutcomeCapture = paperTradingRecoveryCapture();
    let runtimeSupervisor: RuntimeSupervisor | undefined;
    const recoveryServer = await buildServer({
      store,
      sandboxAdapters: { deterministic_test: recoverySandbox },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: INTERVAL_MS,
      paperTradingApiProviderFactory: recoveryProviders.factory,
      paperTradingArtifactResolver: {
        async resolveArtifactDigest() {
          return ARTIFACT_DIGEST;
        }
      },
      runtimeSupervisorRetryDelaysMs: [],
      onPaperTradingSessionServiceCreated(service) {
        recoveryServiceCapture.service = service;
      },
      onPaperTradingRecovery(outcomes) {
        recoveryOutcomeCapture.observe(outcomes);
      },
      onRuntimeSupervisorCreated(supervisor) {
        runtimeSupervisor = supervisor;
      }
    });
    const recoveryService = requireCapturedService(recoveryServiceCapture.service);
    try {
      const recoveryOutcomes = await recoveryOutcomeCapture.outcomes;
      expect(recoveryOutcomes).toEqual(expect.arrayContaining([
        { tradingRunId: defaultRunId, status: "skipped", reason: "evaluation_not_running" },
        {
          tradingRunId: failingRun.trading_run_id,
          status: "failed",
          error: `sandbox start failed for ${failingRun.trading_run_id}`
        },
        { tradingRunId: healthyRun.trading_run_id, status: "recovered", clock: "external" },
        {
          tradingRunId: qualificationRun.trading_run_id,
          status: "skipped",
          reason: "evaluation_not_running"
        }
      ]));
      expect(recoveryService.active(failingRun.trading_run_id)).toBe(false);
      expect(recoveryService.active(healthyRun.trading_run_id)).toBe(true);
      expect(runtimeSupervisor?.status().lanes.find((lane) =>
        lane.lane === "selected_paper"
      )).toMatchObject({
        status: "blocked",
        reason_code: "paper_trading_recovery_failed"
      });
      expect((await store.getTradingRun(failingRun.trading_run_id))?.runtime_lifecycle_status).toBe("stopped");
      expect((await store.getTradingRun(healthyRun.trading_run_id))?.runtime_lifecycle_status).toBe("running");
      expect(recoveryProviders.require(recoverySandbox.providerUrl(failingRun.trading_run_id)!).closed).toBe(true);
      expect(recoveryProviders.require(recoverySandbox.providerUrl(healthyRun.trading_run_id)!).closed).toBe(false);
      expect(await requireEvaluation(store, defaultRunId)).toEqual(stoppedDefaultBeforeRecovery);

      await recoveryService.stop(healthyRun.trading_run_id);
    } finally {
      await recoveryServer.close();
    }
    const failedEvaluationBeforeMismatch = structuredClone(
      await requireEvaluation(store, failingRun.trading_run_id)
    );
    expect(failedEvaluationBeforeMismatch.status).toBe("failed");
    expect(failedEvaluationBeforeMismatch.latest_failure_reason).toBe(
      `sandbox start failed for ${failingRun.trading_run_id}`
    );
    expect(failedEvaluationBeforeMismatch.next_observation_at).toBeUndefined();
    const stoppedHealthyBeforeMismatch = structuredClone(
      await requireEvaluation(store, healthyRun.trading_run_id)
    );
    const qualificationBeforeMismatch = structuredClone(
      await requireEvaluation(store, qualificationRun.trading_run_id)
    );
    const mismatchSandbox = runKeyedSandboxHarness();
    const mismatchProviders = runKeyedProviderHarness();
    const mismatchService = paperSessionService({
      store,
      sandbox: mismatchSandbox,
      providers: mismatchProviders,
      runner: new PaperTradingEvaluationRunner(),
      digest: () => "sha256:multi-run-paper-session-v2"
    });

    const mismatchOutcomes = await mismatchService.recoverRunningEvaluations();

    expect(mismatchOutcomes).toEqual(expect.arrayContaining([
      { tradingRunId: defaultRunId, status: "skipped", reason: "evaluation_not_running" },
      {
        tradingRunId: failingRun.trading_run_id,
        status: "skipped",
        reason: "evaluation_not_running"
      },
      {
        tradingRunId: healthyRun.trading_run_id,
        status: "skipped",
        reason: "evaluation_not_running"
      },
      {
        tradingRunId: qualificationRun.trading_run_id,
        status: "skipped",
        reason: "evaluation_not_running"
      }
    ]));
    expect(await requireEvaluation(store, failingRun.trading_run_id))
      .toEqual(failedEvaluationBeforeMismatch);
    expect(await requireEvaluation(store, defaultRunId)).toEqual(stoppedDefaultBeforeRecovery);
    expect(await requireEvaluation(store, healthyRun.trading_run_id)).toEqual(stoppedHealthyBeforeMismatch);
    expect(await requireEvaluation(store, qualificationRun.trading_run_id))
      .toEqual(qualificationBeforeMismatch);
    expect(preparedQualification.evaluation.status).toBe("not_started");
    expect(mismatchProviders.starts()).toBe(0);
    expect(mismatchSandbox.totalStarts()).toBe(0);
  });
});

function paperSessionService(input: {
  store: OuroborosStorePort;
  sandbox: RunKeyedSandboxHarness;
  providers: RunKeyedProviderHarness;
  runner: PaperTradingEvaluationRunner;
  digest: () => string;
  executionSnapshots?: NonNullable<Parameters<typeof fakeGatewayMarketDataPort>[0]>["executionSnapshots"];
}): PaperTradingSessionService {
  const service = new PaperTradingSessionService({
    store: input.store,
    sandboxAdapters: {
      deterministic_test: input.sandbox,
      docker_sandboxes_sbx: input.sandbox
    },
    marketData: fakeGatewayMarketDataPort({
      snapshots: [
        { price: 65_000, observed_at: "2026-07-10T01:00:03.000Z" },
        { price: 65_100, observed_at: "2026-07-10T01:01:03.000Z" }
      ],
      executionSnapshots: input.executionSnapshots
    }),
    runner: input.runner,
    intervalMs: INTERVAL_MS,
    artifactResolver: {
      async resolveArtifactDigest() {
        return input.digest();
      }
    },
    apiProviderFactory: input.providers.factory
  });
  services.push(service);
  return service;
}

interface ProviderSessionProbe {
  providerId: string;
  readAccountState: () => Promise<AccountState>;
  closed: boolean;
}

interface RunKeyedProviderHarness {
  factory: (
    binding: GatewayRuntimeBinding,
    options: PaperTradingApiProviderOptions
  ) => Promise<ReplayTradingApiProviderSession>;
  require(baseUrl: string): ProviderSessionProbe;
  starts(): number;
}

function runKeyedProviderHarness(): RunKeyedProviderHarness {
  let sequence = 0;
  const sessions = new Map<string, ProviderSessionProbe>();
  return {
    async factory(_binding, options) {
      sequence += 1;
      const providerId = `paper-provider-${sequence}`;
      const baseUrl = `http://${providerId}.test`;
      const probe: ProviderSessionProbe = {
        providerId,
        readAccountState: async () => {
          if (!options.readAccountState) {
            throw new Error("paper provider account reader was not supplied");
          }
          return options.readAccountState();
        },
        closed: false
      };
      sessions.set(baseUrl, probe);
      return {
        base_url: baseUrl,
        sandbox_base_url: baseUrl,
        async close() {
          probe.closed = true;
        },
        requests: () => [],
        candidate_input: {} as never
      };
    },
    require(baseUrl) {
      const session = sessions.get(baseUrl);
      if (!session) {
        throw new Error(`provider session ${baseUrl} was not started`);
      }
      return session;
    },
    starts: () => sequence
  };
}

interface RunKeyedSandboxHarness extends SandboxAdapter {
  enqueue(tradingRunId: string, lines: string[]): void;
  failStart(tradingRunId: string): void;
  providerUrl(tradingRunId: string): string | undefined;
  starts(tradingRunId: string): number;
  totalStarts(): number;
  totalStops(): number;
}

function runKeyedSandboxHarness(): RunKeyedSandboxHarness {
  const batches = new Map<string, string[][]>();
  const startCounts = new Map<string, number>();
  const providerUrls = new Map<string, string>();
  const failedStartRunIds = new Set<string>();
  let totalStartCount = 0;
  let totalStopCount = 0;
  return {
    kind: "deterministic_test",
    enqueue(tradingRunId, lines) {
      const queued = batches.get(tradingRunId) ?? [];
      queued.push(lines);
      batches.set(tradingRunId, queued);
    },
    failStart(tradingRunId) {
      failedStartRunIds.add(tradingRunId);
    },
    providerUrl: (tradingRunId) => providerUrls.get(tradingRunId),
    starts: (tradingRunId) => startCounts.get(tradingRunId) ?? 0,
    totalStarts: () => totalStartCount,
    totalStops: () => totalStopCount,
    async startArtifactInstance(input: SandboxAdapterStartInput): Promise<SandboxAdapterStartResult> {
      const tradingRunId = requireRuntimeRef(input.runtime_ref?.id);
      totalStartCount += 1;
      startCounts.set(tradingRunId, (startCounts.get(tradingRunId) ?? 0) + 1);
      if (input.env?.TRADING_API_BASE_URL) {
        providerUrls.set(tradingRunId, input.env.TRADING_API_BASE_URL);
      }
      if (failedStartRunIds.has(tradingRunId)) {
        throw new Error(`sandbox start failed for ${tradingRunId}`);
      }
      const placementRef = { record_kind: "sandbox_placement" as const, id: input.sandbox_placement_id };
      const sandboxRef = { record_kind: "sandbox" as const, id: input.instance_id };
      return {
        placement: sandboxPlacement(input.sandbox_placement_id),
        instance: {
          record_kind: "sandbox",
          version: 1,
          sandbox_id: input.instance_id,
          adapter_kind: "deterministic_test",
          system_code_ref: { record_kind: "system_code", id: input.artifact.system_code_id },
          runtime_ref: input.runtime_ref,
          sandbox_placement_ref: placementRef,
          lifecycle_status: "running",
          sandbox_name: input.sandbox_name,
          workspace_key: input.workspace_key,
          generation: input.generation,
          created_at: input.created_at,
          started_at: input.created_at,
          last_heartbeat_at: input.created_at,
          log_refs: [],
          heartbeat_refs: [],
          command_evidence_refs: [],
          authority_status: "not_live"
        },
        logs: [],
        heartbeats: [{
          record_kind: "runtime_heartbeat",
          version: 1,
          runtime_heartbeat_id: `runtime-heartbeat-${input.instance_id}-start-${totalStartCount}`,
          sandbox_ref: sandboxRef,
          heartbeat_line: JSON.stringify({ event: "runtime_heartbeat", trading_run_id: tradingRunId }),
          observed_at: input.created_at,
          authority_status: "trace_only"
        }],
        command_evidence: []
      };
    },
    async getArtifactInstanceStatus(): Promise<SandboxAdapterObservationResult> {
      return { lifecycle_status: "running" };
    },
    async getArtifactInstanceLogs(instance): Promise<SandboxAdapterObservationResult> {
      const tradingRunId = requireRuntimeRef(instance.runtime_ref?.id);
      const queued = batches.get(tradingRunId) ?? [];
      const lines = queued.shift() ?? [];
      batches.set(tradingRunId, queued);
      const capturedAt = eventTime(lines[0]) ?? "2026-07-10T01:00:03.000Z";
      return {
        lifecycle_status: "running",
        logs: lines.length > 0
          ? [{
              record_kind: "sandbox_log",
              version: 1,
              sandbox_log_id: `sandbox-log-${instance.sandbox_id}-${capturedAt}`,
              sandbox_ref: { record_kind: "sandbox", id: instance.sandbox_id },
              lines,
              captured_at: capturedAt,
              authority_status: "trace_only"
            } satisfies SandboxLogRecord]
          : [],
        heartbeats: [{
          record_kind: "runtime_heartbeat",
          version: 1,
          runtime_heartbeat_id: `runtime-heartbeat-${instance.sandbox_id}-${capturedAt}`,
          sandbox_ref: { record_kind: "sandbox", id: instance.sandbox_id },
          heartbeat_line: JSON.stringify({ event: "runtime_heartbeat", trading_run_id: tradingRunId }),
          observed_at: capturedAt,
          authority_status: "trace_only"
        }]
      };
    },
    async stopArtifactInstance(): Promise<SandboxAdapterObservationResult> {
      totalStopCount += 1;
      return {
        lifecycle_status: "stopped",
        stopped_at: "2026-07-10T01:05:03.000Z"
      };
    }
  };
}

function sandboxPlacement(sandboxPlacementId: string): SandboxPlacementRecord {
  return {
    record_kind: "sandbox_placement",
    version: 1,
    sandbox_placement_id: sandboxPlacementId,
    placement_kind: "fixture_local_placeholder",
    authority_status: "not_launched"
  };
}

function paperOrderLine(input: {
  eventId: string;
  runId: string;
  at: string;
  side: "buy" | "sell";
  limitPrice: string;
}): string {
  return JSON.stringify({
    event: "order_request",
    event_id: input.eventId,
    instance_id: input.runId,
    at: input.at,
    authority_status: "trace_only",
    intent_kind: "place_order",
    symbol: "BTCUSDT",
    side: input.side,
    order_type: "limit",
    quantity: "0.001",
    limit_price: input.limitPrice,
    reason: `${input.eventId}-paper-order`
  });
}

function eventTime(line: string | undefined): string | undefined {
  if (!line) {
    return undefined;
  }
  const parsed = JSON.parse(line) as { at?: unknown };
  return typeof parsed.at === "string" ? parsed.at : undefined;
}

function requireRuntimeRef(tradingRunId: string | undefined): string {
  if (!tradingRunId) {
    throw new Error("sandbox operation did not include a TradingRun ref");
  }
  return tradingRunId;
}

async function requireFixtureCandidate(store: LocalStore): Promise<CandidateInspectReadModel> {
  const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
  if (!candidate) {
    throw new Error("fixture candidate was not materialized");
  }
  return candidate;
}

async function requireRunCandidate(store: LocalStore, tradingRunId: string): Promise<CandidateInspectReadModel> {
  const candidate = await store.getCandidateForTradingRun(tradingRunId);
  if (!candidate) {
    throw new Error(`candidate for TradingRun ${tradingRunId} was not found`);
  }
  return candidate;
}

async function requireEvaluation(store: LocalStore, tradingRunId: string): Promise<PaperTradingEvaluationRecord> {
  const evaluation = await store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
  if (!evaluation) {
    throw new Error(`paper evaluation for TradingRun ${tradingRunId} was not found`);
  }
  return evaluation;
}

function ledgerIds(candidate: CandidateInspectReadModel): string[] {
  return [...new Set((candidate.ledger?.chains ?? []).flatMap((chain) => [
    chain.chain_id,
    chain.order_request.order_request_id,
    chain.gateway_result?.gateway_result_id,
    chain.execution_result?.execution_result_id
  ].filter((id): id is string => Boolean(id))))];
}

async function researchRunSnapshot(store: LocalStore, tradingRunId: string) {
  const evaluation = await requireEvaluation(store, tradingRunId);
  const candidate = await requireRunCandidate(store, tradingRunId);
  return structuredClone({
    tradingRun: await store.getTradingRun(tradingRunId),
    sandbox: candidate.runtime.sandbox,
    evaluation,
    nextObservationAt: evaluation.next_observation_at,
    paperAccountSnapshot: evaluation.paper_account_snapshot,
    observations: await store.listPaperTradingObservations(evaluation.paper_trading_evaluation_id),
    ledger: candidate.ledger
  });
}

async function evidenceSnapshot(store: LocalStore, tradingRunId: string) {
  const evaluation = await requireEvaluation(store, tradingRunId);
  const candidate = await requireRunCandidate(store, tradingRunId);
  return structuredClone({
    evaluation,
    observations: await store.listPaperTradingObservations(evaluation.paper_trading_evaluation_id),
    ledger: candidate.ledger
  });
}

async function persistedRunState(store: LocalStore, tradingRunId: string) {
  const evaluation = await requireEvaluation(store, tradingRunId);
  const candidate = await requireRunCandidate(store, tradingRunId);
  return structuredClone({
    tradingRun: await store.getTradingRun(tradingRunId),
    evaluation,
    commitments: await store.listPaperTradingEvaluationCommitments(),
    runControl: candidate.runtime.run_control,
    sandbox: candidate.runtime.sandbox,
    observations: await store.listPaperTradingObservations(evaluation.paper_trading_evaluation_id),
    ledger: candidate.ledger
  });
}

function storeWithTradingRunPurpose(
  store: LocalStore,
  tradingRunId: string,
  purpose: "research_feedback" | "qualification"
): OuroborosStorePort {
  return new Proxy(store as OuroborosStorePort, {
    get(target, property, receiver) {
      if (property === "getTradingRun") {
        return async (requestedTradingRunId: string) => {
          const run = await store.getTradingRun(requestedTradingRunId);
          return run && requestedTradingRunId === tradingRunId
            ? { ...run, paper_evidence_purpose: purpose }
            : run;
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function requireCapturedService(
  service: PaperTradingSessionService | undefined
): PaperTradingSessionService {
  if (!service) {
    throw new Error("paper session service was not captured from runtime bootstrap");
  }
  return service;
}

function paperTradingRecoveryCapture(): {
  outcomes: Promise<readonly PaperTradingRecoveryOutcome[]>;
  observe: (outcomes: readonly PaperTradingRecoveryOutcome[]) => void;
} {
  let resolveOutcomes: (outcomes: readonly PaperTradingRecoveryOutcome[]) => void = () => undefined;
  const outcomes = new Promise<readonly PaperTradingRecoveryOutcome[]>((resolve) => {
    resolveOutcomes = resolve;
  });
  return {
    outcomes,
    observe: (observedOutcomes) => resolveOutcomes(observedOutcomes)
  };
}
