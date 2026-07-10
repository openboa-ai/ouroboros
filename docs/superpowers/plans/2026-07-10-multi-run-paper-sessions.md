# Multi-Run Paper Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow one frozen CandidateVersion to own isolated additional paper TradingRuns without mutating or stopping its compatibility/default continuous paper session.

**Architecture:** Keep `CandidateVersion.runtime_ref` as the default-run compatibility pointer, but make `TradingRunRecord.candidate_ref` and `candidate_version_ref` authoritative for resolving any additional run. Extract paper lifecycle orchestration into `PaperTradingSessionService`; the public command adapter always uses the default run with `research_feedback`, while the later comparison coordinator can prepare a distinct externally clocked qualification run through the internal service.

**Tech Stack:** TypeScript, Vitest, LocalStore JSON persistence, application ports, deterministic sandbox adapter, Gateway paper runtime

## Global Constraints

- No public command payload may select `PaperTradingEvidencePurpose` or a comparison ID.
- `CandidateVersion.runtime_ref` remains the default continuous paper run and is not rewritten.
- Every additional run has distinct TradingRun, placement, hands-environment, memory-surface,
  sandbox, provider-session, account, event-cursor, run-control, and Ledger identities.
- CandidateVersion and SystemCode bytes are reused; mutable runtime state and evidence are not.
- All new runs remain paper-only and `not_live`; private reads and live orders remain forbidden.
- Qualification preparation may persist records but may not start providers, sandboxes, runners,
  market reads, Gateway, Ledger, scores, or observations.
- This frontier does not yet have `PaperTradingComparisonCommitment`; therefore `activate` rejects
  every standalone qualification session with `paper_trading_comparison_authority_required`.
  Only the later comparison coordinator may unlock qualification activation after verifying the
  complete pair graph.
- Existing `trading_run.start`, observe, stop, scheduler, recovery, and interface behavior remain
  compatible.

---

### Task 1: Multi-Run Domain And Store Port Contract

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Produces: optional `TradingRunRecord.paper_evidence_purpose`.
- Produces: `OuroborosStorePort.createPaperTradingRun(input): Promise<TradingRunRecord>`.
- Produces: `OuroborosStorePort.listTradingRunsForCandidateVersion(candidateVersionId)`.

- [x] **Step 1: Write failing port and record-shape tests**

Add a LocalStore test that materializes one candidate, captures its default run ID, and requests two
additional qualification runs with different idempotency keys:

```ts
const candidate = await materializedCandidate(store, "multi-run-candidate");
const defaultRunId = candidate.runtime.ref.id;
const first = await store.createPaperTradingRun({
  idempotency_key: "comparison-a:champion",
  candidate_id: candidate.candidate_id,
  candidate_version_id: candidate.candidate_version.candidate_version_id,
  evidence_purpose: "qualification",
  created_at: "2026-07-10T00:00:00.000Z"
});
const second = await store.createPaperTradingRun({
  idempotency_key: "comparison-b:champion",
  candidate_id: candidate.candidate_id,
  candidate_version_id: candidate.candidate_version.candidate_version_id,
  evidence_purpose: "qualification",
  created_at: "2026-07-10T01:00:00.000Z"
});

expect(first.trading_run_id).not.toBe(defaultRunId);
expect(second.trading_run_id).not.toBe(first.trading_run_id);
expect(first.paper_evidence_purpose).toBe("qualification");
expect((await store.getCandidate(candidate.candidate_id))?.runtime.ref.id).toBe(defaultRunId);
expect((await store.listTradingRunsForCandidateVersion(
  candidate.candidate_version.candidate_version_id
)).map((run) => run.trading_run_id)).toEqual([
  defaultRunId,
  first.trading_run_id,
  second.trading_run_id
].sort());
```

- [x] **Step 2: Run the narrow test and confirm RED**

Run: `npx vitest run packages/local-store/test/local-store.test.ts -t "creates isolated paper TradingRuns"`

Expected: FAIL because the port methods and purpose field do not exist.

- [x] **Step 3: Add the domain field and exact store signatures**

Add to `TradingRunRecord`:

```ts
paper_evidence_purpose?: PaperTradingEvidencePurpose;
```

Add to `OuroborosStorePort`:

```ts
createPaperTradingRun(input: {
  idempotency_key: string;
  candidate_id: string;
  candidate_version_id: string;
  evidence_purpose: PaperTradingEvidencePurpose;
  created_at?: string;
}): Promise<TradingRunRecord>;
listTradingRunsForCandidateVersion(candidateVersionId: string): Promise<TradingRunRecord[]>;
```

Keep the field optional only for existing/default records. Every record returned by
`createPaperTradingRun` sets it explicitly.

- [x] **Step 4: Run the domain typecheck and retain the LocalStore RED evidence**

Run: `npm run typecheck -w @ouroboros/domain`

Expected: domain types compile; the behavior test and LocalStore interface implementation remain
RED until Task 2 implements the new methods. Do not commit this intentionally incomplete boundary.

- [x] **Step 5: Continue directly into Task 2**

Keep the contract and its failing behavior test in the working tree. The first commit is made only
after Task 2 provides a passing LocalStore implementation and application/store typechecks.

---

### Task 2: LocalStore Multi-Run Creation And Resolution

**Files:**
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Consumes: Task 1 store signatures.
- Produces: deterministic additional TradingRun/supporting-record bundles.
- Produces: run-specific `getCandidateForTradingRun` projection without default projection mutation.

- [x] **Step 1: Extend the failing test with idempotency and support-boundary assertions**

```ts
const repeated = await store.createPaperTradingRun({
  idempotency_key: "comparison-a:champion",
  candidate_id: candidate.candidate_id,
  candidate_version_id: candidate.candidate_version.candidate_version_id,
  evidence_purpose: "qualification",
  created_at: "2026-07-10T00:00:00.000Z"
});
expect(repeated).toEqual(first);
expect(first.placement_ref.id).not.toBe(candidate.runtime.placement.ref.id);
expect(first.hands_environment_ref.id).not.toBe(candidate.runtime.hands_environment.ref.id);
expect(first.memory_surface_ref.id).not.toBe(candidate.runtime.memory_surface.ref.id);

const projected = await store.getCandidateForTradingRun(first.trading_run_id);
expect(projected?.candidate_id).toBe(candidate.candidate_id);
expect(projected?.runtime.ref.id).toBe(first.trading_run_id);
expect(projected?.runtime.placement.ref.id).toBe(first.placement_ref.id);
expect((await store.getCandidate(candidate.candidate_id))?.runtime.ref.id).toBe(defaultRunId);
```

Also assert unknown candidate, cross-candidate version, empty idempotency key, and any non-paper
authority fail with stable LocalStore error codes.

- [x] **Step 2: Implement deterministic bundle creation**

Use one digest suffix over
`candidate_id:candidate_version_id:evidence_purpose:idempotency_key`. Persist:

```ts
const run: TradingRunRecord = {
  record_kind: "trading_run",
  version: 1,
  trading_run_id: `trading-run-paper-session-${suffix}`,
  stage_binding_profile: "paper",
  runtime_lifecycle_status: "registered",
  paper_evidence_purpose: input.evidence_purpose,
  candidate_ref: ref("trading_system_candidate", candidate.candidate_id),
  candidate_version_ref: ref("candidate_version", version.candidate_version_id),
  placement_ref: ref("sandbox_placement", `sandbox-placement-paper-session-${suffix}`),
  hands_environment_ref: ref("hands_environment", `hands-environment-paper-session-${suffix}`),
  memory_surface_ref: ref("runtime_memory_surface", `runtime-memory-surface-paper-session-${suffix}`),
  system_code_ref: { ...version.system_code_ref! },
  created_at,
  authority_status: "not_live"
};
```

Persist a `fixture_local_placeholder` SandboxPlacement, `fixture_no_tools` HandsEnvironment, and
read-only RuntimeMemorySurface under those exact refs. Exact replay is idempotent; conflicting
content for deterministic IDs fails `paper_trading_run_conflict`.

- [x] **Step 3: Resolve candidates through TradingRun refs**

Replace reverse matching on `CandidateVersion.runtime_ref` with:

```ts
const run = await this.getTradingRun(tradingRunId);
if (!run?.candidate_ref || !run.candidate_version_ref) return undefined;
const version = await this.readOptionalRecord<CandidateVersionRecord>(
  "candidate-versions",
  run.candidate_version_ref.id
);
const candidate = await this.getCandidate(run.candidate_ref.id);
if (!version || !candidate || version.candidate_id !== candidate.candidate_id) return undefined;
return this.projectCandidateForTradingRun(candidate, version, run);
```

`projectCandidateForTradingRun` overlays only `runtime` and `trading_run` with the requested run,
placement, sandbox, and lifecycle. It does not write the candidate read model.

- [x] **Step 4: Replace default-run equality with explicit run ownership**

Commitment, evaluation, observation, and run-control validation load the referenced TradingRun and
require:

```ts
sameRef(run.candidate_ref, commitment.candidate_ref) &&
sameRef(run.candidate_version_ref, commitment.candidate_version_ref) &&
sameRef(run.system_code_ref, commitment.system_code_ref) &&
(run.paper_evidence_purpose ?? "research_feedback") === commitment.evidence_purpose &&
run.authority_status === "not_live"
```

Keep `CandidateVersion.runtime_ref` equality only for default-run compatibility paths. Do not use it
to reject an explicitly owned additional run.

- [x] **Step 5: Run store tests and typechecks**

Run: `npx vitest run packages/local-store/test/local-store.test.ts`

Run: `npm run typecheck -w @ouroboros/local-store -w @ouroboros/application`

Expected: PASS.

- [x] **Step 6: Commit the green contract, persistence, and resolution boundary**

```bash
git add packages/domain/src/index.ts packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist isolated paper TradingRuns"
```

---

### Task 3: Internal PaperTradingSessionService

**Files:**
- Create: `packages/application/src/trading/paper/session-service.ts`
- Create: `packages/application/src/trading/paper/session-service.test.ts`
- Modify: `packages/application/src/trading/paper/commands.ts`

**Interfaces:**
- Produces: `PaperTradingSessionService.prepare`, `activate`, `observe`, `stop`, `active`, and
  `schedule`, `stopAllSessions`.
- Consumes: run-specific candidate projection, artifact resolver, sandbox registry, Gateway market
  binding, provider factory, runner, and StorePort.

- [x] **Step 1: Write failing prepare-without-effects tests**

Construct a LocalStore candidate plus an additional qualification run and inject counting fakes for
artifact resolution, provider creation, sandbox start, and market reads:

```ts
const prepared = await service.prepare({
  candidateId: candidate.candidate_id,
  candidateVersionId: candidate.candidate_version.candidate_version_id,
  tradingRunId: qualificationRun.trading_run_id,
  evidencePurpose: "qualification",
  clock: "external"
});

expect(prepared.evaluation.status).toBe("not_started");
expect(prepared.commitment.evidence_purpose).toBe("qualification");
expect(prepared.commitment.trading_run_ref.id).toBe(qualificationRun.trading_run_id);
expect(providerStarts).toBe(0);
expect(sandboxStarts).toBe(0);
expect(marketReads).toBe(0);
expect(await store.listPaperTradingObservations(prepared.evaluation.paper_trading_evaluation_id))
  .toEqual([]);
```

Also assert that `evidencePurpose` must equal the run's persisted
`paper_evidence_purpose`; mismatch fails before a commitment write.

- [x] **Step 2: Run the unit test and confirm RED**

Run: `npx vitest run packages/application/src/trading/paper/session-service.test.ts`

Expected: FAIL because the service does not exist.

- [x] **Step 3: Extract preparation and verification**

Define:

```ts
export type PaperTradingSessionClock = "scheduled" | "external";

export interface PreparedPaperTradingSession {
  candidate: CandidateInspectReadModel;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  verification: Extract<PaperTradingEvaluationCommitmentVerification, { status: "verified" }>;
  clock: PaperTradingSessionClock;
}

export class PaperTradingSessionService {
  prepare(input: {
    candidateId: string;
    candidateVersionId: string;
    tradingRunId: string;
    evidencePurpose: PaperTradingEvidencePurpose;
    clock: PaperTradingSessionClock;
  }): Promise<PreparedPaperTradingSession>;
  activate(prepared: PreparedPaperTradingSession): Promise<PaperTradingEvaluationRecord>;
  observe(tradingRunId: string): Promise<RecordPaperTradingEvaluationObservationResult>;
  schedule(tradingRunId: string): Promise<void>;
  stop(tradingRunId: string): Promise<PaperTradingEvaluationRecord | undefined>;
  active(tradingRunId: string): boolean;
  stopAllSessions(): Promise<void>;
}
```

Move these existing responsibilities out of `PaperTradingCommandService` without weakening them:

- commitment creation/reload and executable-byte verification;
- evaluation creation, running transition, terminal invalidation, and audit;
- provider-session creation/close and fake-account readback;
- run-specific sandbox ensure/refresh/stop;
- observation invocation and scheduled runner lifecycle.

For a research-feedback session with `clock: "external"`, `activate` starts provider/sandbox and
marks the evaluation running but does not observe or schedule a timer. `active` tracks an activated
session independently from scheduler timers, so an externally clocked session is active while its
provider and sandbox are running. In this frontier, `activate` rejects every qualification-purpose
session before provider, sandbox, market, runner, Gateway, Ledger, or observation effects because
no verified pair authority exists yet. For `clock: "scheduled"`, the public adapter explicitly
performs the first observation and calls `schedule`, preserving current response order.

- [x] **Step 4: Make sandbox refresh run-specific**

Load `store.getCandidateForTradingRun(tradingRunId)` before every refresh and use that projection's
sandbox. Never read `getCandidate(candidateId).runtime.sandbox` for an additional run. After writing
logs, reload the same run-specific projection.

- [x] **Step 5: Add standalone-qualification rejection and independent-stop tests**

First assert that activating the prepared qualification session fails with
`paper_trading_comparison_authority_required` and leaves provider, sandbox, market, Ledger, and
observation counts at zero. Then create an additional externally clocked `research_feedback` run
to prove the generic session lifecycle with a fake provider session and deterministic sandbox:

```ts
const defaultBefore = await store.getTradingRun(candidate.runtime.ref.id);
await expect(service.activate(preparedQualification)).rejects.toMatchObject({
  code: "paper_trading_comparison_authority_required"
});
const activeResearch = await service.activate(preparedAdditionalResearch);
expect(service.active(additionalResearchRun.trading_run_id)).toBe(true);
expect((await store.getTradingRun(additionalResearchRun.trading_run_id))?.runtime_lifecycle_status)
  .toBe("running");
await service.stop(additionalResearchRun.trading_run_id);
expect((await store.getTradingRun(candidate.runtime.ref.id))?.runtime_lifecycle_status)
  .toBe(defaultBefore?.runtime_lifecycle_status);
```

Also verify provider and sandbox IDs differ from a concurrently active default session.

- [x] **Step 6: Run service tests and application typecheck**

Run: `npx vitest run packages/application/src/trading/paper/session-service.test.ts`

Run: `npm run typecheck -w @ouroboros/application`

Expected: PASS.

- [x] **Step 7: Commit the internal lifecycle**

```bash
git add packages/application/src/trading/paper/session-service.ts packages/application/src/trading/paper/session-service.test.ts packages/application/src/trading/paper/commands.ts
git commit -m "refactor: isolate paper TradingRun sessions"
```

---

### Task 4: Keep Public Commands Research-Only

**Files:**
- Modify: `packages/application/src/trading/paper/commands.ts`
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/test/paper-trading-evaluation-commitment.test.ts`
- Modify: `apps/runtime/test/long-running-paper-session.test.ts`

**Interfaces:**
- Consumes: `PaperTradingSessionService`.
- Preserves: `PaperTradingCommandService.start(candidateId, payload)`, observe, stop, and response
  shapes.

- [ ] **Step 1: Add public-boundary regression tests**

POST normal and malicious payloads:

```ts
await postCommand(app, "trading_run.start", { candidate_id: candidateId });
await postCommand(app, "trading_run.start", {
  candidate_id: candidateId,
  evidence_purpose: "qualification",
  trading_run_id: qualificationRunId,
  comparison_id: "forbidden-comparison"
});
```

Assert both operate only the candidate's default `runtime.ref.id`, persist or reuse a
`research_feedback` commitment, and create no commitment, provider, or sandbox for the supplied run
ID.

- [ ] **Step 2: Delegate command lifecycle to the session service**

`PaperTradingCommandService.start` resolves the selected candidate and calls:

```ts
const prepared = await this.sessions.prepare({
  candidateId,
  candidateVersionId: candidate.candidate_version.candidate_version_id,
  tradingRunId: candidate.runtime.ref.id,
  evidencePurpose: "research_feedback",
  clock: "scheduled"
});
```

Preserve start, resume, already-running, invalidation, first-observation, and response semantics by
delegating to `activate`, `observe`, and schedule methods. Payload parsing remains limited to
`runtime_environment` and `paper_order_request`.

- [ ] **Step 3: Wire one shared service at the composition root**

Build one `PaperTradingSessionService` from the existing runner, store, sandbox adapters, market
port, provider factory, artifact resolver, intervals, and logger. Inject it into
`PaperTradingCommandService`; Operator runner-active checks use the session service's `active`
method so externally clocked sessions are not mislabeled `needs_resume`.

- [ ] **Step 4: Run lifecycle and commitment tests**

Run: `npx vitest run apps/runtime/test/paper-trading-evaluation-commitment.test.ts apps/runtime/test/long-running-paper-session.test.ts apps/runtime/test/reference-paper-soak-trading-system.test.ts`

Expected: PASS outside the restricted listener sandbox.

- [ ] **Step 5: Commit command compatibility**

```bash
git add packages/application/src/trading/paper/commands.ts apps/runtime/src/server.ts apps/runtime/test/paper-trading-evaluation-commitment.test.ts apps/runtime/test/long-running-paper-session.test.ts
git commit -m "refactor: route paper commands through session service"
```

---

### Task 5: Multi-Run Isolation And Recovery Evidence

**Files:**
- Create: `apps/runtime/test/paper-trading-multi-run-session.test.ts`
- Modify: `packages/application/src/trading/paper/session-service.ts`
- Modify: `packages/local-store/src/index.ts`

**Interfaces:**
- Verifies: independent lifecycle, account, event cursor, sandbox, provider, Ledger, and restart
  state.

- [ ] **Step 1: Write the two-run isolation scenario**

Start the default research session and one additional externally clocked research-feedback session
for the same candidate version. Separately prepare a qualification session and prove it remains
inert. Feed distinct emitted event IDs to the two active research sandboxes and assert:

```ts
expect(defaultEvaluation.trading_run_ref.id).not.toBe(additionalEvaluation.trading_run_ref.id);
expect(defaultEvaluation.processed_trading_system_event_ids)
  .not.toContain("additional-event");
expect(additionalEvaluation.processed_trading_system_event_ids)
  .not.toContain("default-event");
expect(defaultSandbox.sandbox_id).not.toBe(additionalSandbox.sandbox_id);
expect(defaultLedgerIds).not.toEqual(additionalLedgerIds);
```

The initial account values may be equal, but the persisted account lineage, observation IDs, and
evaluation refs must be distinct. Stop the additional research run and invalidate the inert
qualification evaluation, then assert the default runner, provider, sandbox, evaluation status,
next observation, account, and Ledger count are unchanged. The qualification session has no
runtime effects to stop; invalidating it must also leave both research sessions unchanged.

- [ ] **Step 2: Write restart reconstruction tests**

Create a new service over the same LocalStore, recover the active additional research run by its
TradingRun record, reload the inert qualification commitment without activating it, and assert no
replacement commitment or default-run mutation occurs. A changed SystemCode digest invalidates
only the affected additional evaluation; it never unlocks or reconstructs qualification authority.

- [ ] **Step 3: Implement recovery by explicit TradingRun identity**

Recovery scans persisted running evaluations, resolves each through
`getCandidateForTradingRun(evaluation.trading_run_ref.id)`, verifies its original commitment, and
recreates only that run's provider and sandbox. It never recovers an additional run by selecting the
candidate's default runtime.

- [ ] **Step 4: Run focused and regression tests**

Run: `npx vitest run apps/runtime/test/paper-trading-multi-run-session.test.ts apps/runtime/test/paper-trading-evaluation-commitment.test.ts apps/runtime/test/long-running-paper-session.test.ts apps/runtime/test/operator-paper-trading-board.test.ts`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit isolation evidence**

```bash
git add apps/runtime/test/paper-trading-multi-run-session.test.ts packages/application/src/trading/paper/session-service.ts packages/local-store/src/index.ts
git commit -m "test: prove isolated multi-run paper sessions"
```

---

### Task 6: Durable Truth And Frontier Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md`

**Interfaces:**
- Produces: repo truth that multi-run sessions are implemented while paired comparison remains
  pending.

- [ ] **Step 1: Update canonical docs**

Document that `CandidateVersion.runtime_ref` is the default continuous session pointer, not a
one-run cardinality constraint. State that additional runs are internal, isolated, paper-only, and
not user-selectable through commands. State that standalone qualification sessions remain inert
until the prospective comparison coordinator verifies a complete pair commitment. Mark the first
comparison-design prerequisite implemented without claiming shared-tick comparison or a verdict.

- [ ] **Step 2: Run focused tests**

Run: `npx vitest run packages/local-store/test/local-store.test.ts packages/application/src/trading/paper/session-service.test.ts apps/runtime/test/paper-trading-multi-run-session.test.ts apps/runtime/test/paper-trading-evaluation-commitment.test.ts apps/runtime/test/long-running-paper-session.test.ts apps/runtime/test/operator-paper-trading-board.test.ts`

Expected: PASS.

- [ ] **Step 3: Run repository verification**

```bash
npm run typecheck
npm test
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

Expected: all checks pass; listener and process tests run outside the restricted sandbox when
needed.

- [ ] **Step 4: Commit durable truth**

```bash
git add AGENTS.md docs/api-command-contract.md docs/candidate-arena-evaluation-protocol.md docs/superpowers/specs/2026-07-10-prospective-paper-comparison-design.md
git commit -m "docs: record multi-run paper session boundary"
```

- [ ] **Step 5: Hand off the next frontier**

The next plan begins only after this branch is green. It implements
`PaperTradingComparisonCommitment`, `PaperTradingComparisonTick`, the shared market view,
coordinator, sealed adjudication, non-overlapping confirmations, promotion integration, and pair
recovery from the approved design.
