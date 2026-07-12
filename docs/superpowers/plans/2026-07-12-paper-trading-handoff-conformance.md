# Paper Trading Handoff Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Status:** Ready for implementation

**Goal:** Make external target paper-protocol conformance a required, persisted condition of every
new CandidateArena runnable handoff and revalidate it before generated-candidate paper effects.

**Architecture:** Extend the research artifact-runner port with a bounded paper-mode probe, evaluate
its output with the production paper event parser, persist one digest-bound
`PaperTradingHandoffConformance` record for the selected SystemCode, bind that record into admission,
materialize only passed submissions, and fail generated-candidate paper start closed when exact
evidence is missing or drifted. Candidate rejection and infrastructure failure remain distinct.

**Tech Stack:** TypeScript, Vitest, Node child processes, Docker Sandboxes `sbx`, application ports,
LocalStore JSON evidence, CandidateArena, PaperTradingSession command integration.

## Global Constraints

- Follow
  `docs/superpowers/specs/2026-07-12-paper-trading-handoff-conformance-design.md` exactly.
- Use `PaperTradingHandoffConformance` as the only new canonical noun.
- Run the probe over the exact artifact bytes evaluated and submitted for admission.
- Candidate-facing input must omit evaluator direction, outcome, target risk, private state,
  credentials, direct-order capability, and live authority.
- Use the production `paper_trading_event_protocol_v1` parser.
- Bound execution to one tick, five seconds, eight provider requests, existing output buffers, and
  guaranteed cleanup.
- `passed` is runtime compatibility only; it cannot change economic rank, qualification, Trading
  review, promotion, orders, private access, or live authority.
- Candidate protocol rejection becomes quarantined research evidence. Runner/provider setup failure
  remains an infrastructure direction failure.
- Historical admissions remain readable but cannot start a generated candidate without exact
  passed conformance.
- Fixture candidates without a materialization attempt preserve their existing explicit path.
- Use TDD and observe each focused RED failure before implementation.
- Commit after every independently reviewable task.

---

### Task 1: Define Conformance Evidence And Admission Semantics

**Files:**
- Create: `packages/domain/src/paper-trading-handoff-conformance.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/candidate-admission-policy.ts`
- Modify: `packages/domain/src/candidate-admission-policy.test.ts`

**Interfaces:**
- Produces: `PaperTradingHandoffConformanceRecord`, status and reason types.
- Produces: `paperTradingHandoffConformanceDigestInput(record)`.
- Produces: `paperTradingHandoffConformanceHasRuntimeShape(value)`.
- Extends new admission inputs/records with conformance status, ref, and digest while preserving
  historical read compatibility.

- [x] **Step 1: Write failing canonical record tests**

Create one passed and one rejected fixture. Assert exact protocol version, candidate-only evidence
summary, finite bounded counts, canonical timestamps, digest shape, and closed authority. Assert any
identity, protocol, status, reason, request count, event kind, heartbeat, stop, time, or authority
mutation changes digest input.

- [x] **Step 2: Write failing malformed-shape tests**

Reject wrong refs, digest, runner kind, protocol version, negative or over-policy counts, invalid
timestamps, passed-without-decision/heartbeat/stop, rejected-with-runnable handoff, passed-with-false
handoff, promotion/order/live authority, and unknown reasons.

- [x] **Step 3: Write failing admission-policy tests**

Prove:

1. new `passed` conformance plus existing accepted inputs admits;
2. `rejected` conformance always quarantines with
   `paper_handoff_conformance_failed`;
3. new admission linkage is all-or-none and admitted linkage must represent `passed`;
4. historical records without conformance fields remain internally consistent;
5. conformance cannot override worker, experiment, evaluation, or evidence rejection.

- [x] **Step 4: Run RED**

```bash
npm test -- packages/domain/src/paper-trading-handoff-conformance.test.ts packages/domain/src/candidate-admission-policy.test.ts
```

Expected: FAIL because the evidence and policy fields do not exist.

- [x] **Step 5: Implement the domain contract**

Add strict runtime shape and canonical digest helpers, add the record to persisted unions, and add
the optional historical-compatible admission fields. Every new application write will populate
them; undefined remains legacy read compatibility, not new start authority.

- [x] **Step 6: Verify and commit**

```bash
npm test -- packages/domain/src/paper-trading-handoff-conformance.test.ts packages/domain/src/candidate-admission-policy.test.ts
npm run typecheck --workspace @ouroboros/domain
git add packages/domain/src/index.ts packages/domain/src/candidate-admission-policy.ts packages/domain/src/candidate-admission-policy.test.ts packages/domain/src/paper-trading-handoff-conformance.test.ts
git commit -m "feat: define paper handoff conformance"
```

---

### Task 2: Evaluate The Target Paper Protocol Externally

**Files:**
- Create: `packages/application/src/trading/research/paper-handoff-conformance.ts`
- Create: `packages/application/src/trading/research/paper-handoff-conformance.test.ts`
- Modify: `packages/application/src/trading/research/types.ts`
- Modify: `packages/application/src/trading/research/evaluator.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Produces: `TradingArtifactPaperHandoffProbeResult` and infrastructure error.
- Produces: `evaluatePaperTradingHandoffProbe(result)`.
- Reuses: `parseTradingSystemPaperEventLine` and sealed evaluator boundary checks.

- [ ] **Step 1: Write failing pure pass tests**

Accept an exact bounded probe containing:

- one accepted `order_request` or `hold`/`no_action` event;
- matching instance IDs and canonical times;
- at least one runtime heartbeat and one bounded stop;
- successful market, account, and validation provider requests;
- no undeclared routes, hidden fields, self-reported economics, or authority.

- [ ] **Step 2: Write failing adversarial table tests**

Reject independently: runner crash after attributable start, timeout, malformed JSON decision,
invalid paper event, missing/multiple decisions, wrong instance, missing heartbeat, missing stop,
missing required request, unexpected route, more than eight requests, non-200 request, mismatched
validation body, expected/outcome field, self-reported profit, private/account credential field,
direct-order or live field, and paper protocol error event.

- [ ] **Step 3: Prove infrastructure classification**

Runner unavailable, sandbox creation failure, and provider startup failure must throw
`PaperTradingHandoffConformanceInfrastructureError`; they must not return candidate rejection.

- [ ] **Step 4: Run RED**

```bash
npm test -- packages/application/src/trading/research/paper-handoff-conformance.test.ts
```

- [ ] **Step 5: Implement pure evaluation**

Export the existing evaluator boundary classifier instead of copying hidden/self-report field
logic. Return only stable bounded status/reason/count/event summaries. Raw output remains runner
evidence and is not part of worker feedback.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- packages/application/src/trading/research/paper-handoff-conformance.test.ts apps/runtime/test/trading-research-loop.test.ts
npm run typecheck --workspace @ouroboros/application
git add packages/application/src/index.ts packages/application/src/trading/research/types.ts packages/application/src/trading/research/evaluator.ts packages/application/src/trading/research/paper-handoff-conformance.ts packages/application/src/trading/research/paper-handoff-conformance.test.ts
git commit -m "feat: evaluate paper handoff protocol"
```

---

### Task 3: Execute The Probe Through Host And SBX Runners

**Files:**
- Modify: `packages/application/src/trading/research/artifact-runner.ts`
- Modify: `apps/runtime/test/trading-research-loop.test.ts`

**Interfaces:**
- Extends: `TradingArtifactRunner.probePaperHandoff(input)`.
- Implements: `HostTradingArtifactRunner` and `DockerSandboxesSbxTradingArtifactRunner` parity.

- [ ] **Step 1: Write failing host runner tests**

Run the reference artifact through one paper tick. Assert candidate-only provider payload, target CLI
arguments, decision/heartbeat/stop output, request evidence, five-second bound, output artifacts,
minimal environment, and cleanup. Add a replay-pass/paper-fail artifact fixture.

- [ ] **Step 2: Write failing SBX command-contract tests**

Using the fake `sbx` harness, prove version/create/exec/stop/remove order, sandbox-local candidate-only
provider scenario, target paper CLI arguments, request capture, command evidence, timeout handling,
and cleanup on every terminal path.

- [ ] **Step 3: Run RED**

```bash
npm test -- apps/runtime/test/trading-research-loop.test.ts
```

- [ ] **Step 4: Implement runner parity**

Share bounded probe input/result helpers. Host execution remains disabled unless explicitly opted
in. SBX uses its sandbox-local provider sidecar, never a candidate-visible evaluator fixture file.
Classify pre-candidate setup failures as infrastructure and attributable artifact failures as probe
results.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- packages/application/src/trading/research/paper-handoff-conformance.test.ts apps/runtime/test/trading-research-loop.test.ts
npm run typecheck --workspace @ouroboros/application
git add packages/application/src/trading/research/artifact-runner.ts apps/runtime/test/trading-research-loop.test.ts
git commit -m "feat: probe paper handoff in sandboxes"
```

---

### Task 4: Require Conformance In Every Research Iteration

**Files:**
- Modify: `packages/application/src/trading/research/replay-set-runner.ts`
- Modify: `packages/application/src/trading/research/run-trading-research.ts`
- Modify: `packages/application/src/trading/research/types.ts`
- Modify: `apps/runtime/test/trading-research-loop.test.ts`

**Interfaces:**
- Composes conformance into external `ResearchPreflight` without exposing raw evidence.
- Keeps an iteration only when replay and target protocol both pass.

- [ ] **Step 1: Write failing composition tests**

Prove accepted replay plus passed conformance remains accepted and adds one generic metric. Prove
accepted replay plus rejected conformance becomes disqualified with zero score and stable reason.
Prove an already rejected replay does not spend a conformance probe.

- [ ] **Step 2: Write failing notebook barrier tests**

The in-process result retains bounded conformance evidence for persistence. ResearchWorker notebook,
prompt summary, and replay-set feedback expose only generic status/reason; they omit raw events,
provider requests, commands, paths, hidden fields, and evaluator state.

- [ ] **Step 3: Prove best-artifact semantics**

A replay-high/paper-rejected iteration is never kept. A prior passed keep remains selected when a
later iteration rejects. Infrastructure failure aborts the loop/direction instead of becoming a
discarded strategy score.

- [ ] **Step 4: Implement and verify**

```bash
npm test -- packages/application/src/trading/research/paper-handoff-conformance.test.ts apps/runtime/test/trading-research-loop.test.ts
npm run typecheck --workspace @ouroboros/application
git add packages/application/src/trading/research/replay-set-runner.ts packages/application/src/trading/research/run-trading-research.ts packages/application/src/trading/research/types.ts apps/runtime/test/trading-research-loop.test.ts
git commit -m "feat: gate research on paper conformance"
```

---

### Task 5: Persist And Bind Conformance Before Materialization

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/local-store/src/index.ts`
- Create: `packages/local-store/test/paper-trading-handoff-conformance.test.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`

**Interfaces:**
- Adds LocalStore record/get/list operations.
- Binds exact conformance ref/digest/status to admission.
- Materializes only exact passed evidence.

- [ ] **Step 1: Write failing LocalStore tests**

Cover persist/get/list/restart/exact replay, digest drift, malformed status, missing SystemCode or
ExperimentRun, SystemCode digest mismatch, task mismatch, admission ref/digest mismatch,
cross-SystemCode reuse, rejected-as-runnable, and same-ID mutation.

- [ ] **Step 2: Write failing CandidateArena tests**

Prove ordering:

```text
SystemCode and ExperimentRun
-> PaperTradingHandoffConformance
-> TradingEvaluationResult and Finding/Lineage
-> CandidateAdmissionDecision
-> candidate materialization
```

Assert passed evidence creates one candidate. Replay-pass/paper-rejected creates zero candidates,
one quarantined direction, one causal Finding, and no materialization call. Infrastructure failure
produces a failed direction and no strategy quarantine.

- [ ] **Step 3: Add compact readback**

Direction results carry conformance ID/status/reason with research-only authority. Leaderboard and
paper rank remain unchanged.

- [ ] **Step 4: Implement and verify**

```bash
npm test -- packages/local-store/test/paper-trading-handoff-conformance.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/application
git add packages/application/src/ports/store.ts packages/application/src/candidate/arena.ts packages/domain/src/index.ts packages/local-store/src/index.ts packages/local-store/test/paper-trading-handoff-conformance.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts
git commit -m "feat: bind arena admission to paper conformance"
```

---

### Task 6: Revalidate Generated Candidates Before Paper Effects

**Files:**
- Modify: `packages/application/src/trading/paper/commands.ts`
- Modify: `apps/runtime/test/paper-trading-event-protocol.test.ts`
- Modify: `apps/runtime/test/operator-product-loop-smoke.test.tsx`
- Modify: `apps/runtime/src/server.ts`

**Interfaces:**
- Revalidates exact active SystemCode conformance before `PaperTradingSession.prepare`.
- Preserves fixture candidate compatibility.

- [ ] **Step 1: Write failing no-effect rejection tests**

For generated candidates, reject missing, rejected, malformed, tampered, wrong-SystemCode,
wrong-ExperimentRun, and non-admitted conformance. Assert zero commitment, evaluation, provider,
sandbox, run-control, Ledger, observation, runner, private, and live effects.

- [ ] **Step 2: Write passing start tests**

Exact passed admission-bound evidence permits the existing paper-only start path. Fixture candidates
without materialization attempts continue through their existing path. Repeated start and restart
reuse the same evidence without recomputation.

- [ ] **Step 3: Prove autonomous continuation behavior**

CandidateArena automatic continuation records `failed` with stable conformance reason when start
revalidation fails, keeps the arena loop running, and never reports `started` early.

- [ ] **Step 4: Implement and verify**

```bash
npm test -- apps/runtime/test/paper-trading-event-protocol.test.ts apps/runtime/test/operator-product-loop-smoke.test.tsx apps/runtime/test/candidate-arena-paper-context.test.ts
npm run typecheck --workspace @ouroboros/runtime
git add packages/application/src/trading/paper/commands.ts apps/runtime/src/server.ts apps/runtime/test/paper-trading-event-protocol.test.ts apps/runtime/test/operator-product-loop-smoke.test.tsx
git commit -m "feat: enforce paper conformance at start"
```

---

### Task 7: Update Durable Truth And Verify The Frontier

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/autonomy-model.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/product-quality-design.md`
- Modify: `docs/superpowers/specs/2026-07-12-paper-trading-handoff-conformance-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-paper-trading-handoff-conformance.md`

- [ ] **Step 1: Correct canonical truth**

Record that sealed candidate payloads already exclude evaluator-only fields, every new runnable
handoff now requires external target-protocol proof, generated-candidate start revalidates it, and
rejection remains research memory. Remove the stale claim that the replay provider currently
exposes `expected_direction`.

Keep repeated-score/window probing, behavior-level duplicate detection, long-lived ResearchWorker
recovery, production comparison scheduling, automatic promotion, runner handoff, private/live,
P0, and Goal completion open.

- [ ] **Step 2: Mark design and plan implemented**

Set design status to:

```text
Implemented and verified as external paper handoff conformance
```

Set this plan Status to Complete and check each completed step.

- [ ] **Step 3: Run focused regression**

```bash
npm test -- packages/domain/src/paper-trading-handoff-conformance.test.ts packages/domain/src/candidate-admission-policy.test.ts packages/application/src/trading/research/paper-handoff-conformance.test.ts packages/local-store/test/paper-trading-handoff-conformance.test.ts apps/runtime/test/trading-research-loop.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/paper-trading-event-protocol.test.ts apps/runtime/test/operator-product-loop-smoke.test.tsx
```

- [ ] **Step 4: Run workspace and repository validation**

```bash
npm run typecheck
npm run check:repo-guards
npm test
```

Run listener tests outside the filesystem/network sandbox.

- [ ] **Step 5: Commit durable truth**

```bash
git add AGENTS.md docs/candidate-arena-research-goal.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/autonomy-model.md docs/naming-taxonomy.md docs/product-quality-design.md docs/superpowers/specs/2026-07-12-paper-trading-handoff-conformance-design.md docs/superpowers/plans/2026-07-12-paper-trading-handoff-conformance.md
git commit -m "docs: record paper handoff conformance"
```

## Completion Evidence

Keep this frontier only when current evidence proves:

1. exact candidate-only paper probe input and bounded execution;
2. production parser acceptance before admission and materialization;
3. adversarial rejection across protocol, evaluator, provider, authority, and timeout cases;
4. infrastructure attribution remains separate;
5. digest-bound LocalStore evidence and exact admission linkage;
6. no candidate or paper start for rejected conformance;
7. no paper effect before generated-candidate revalidation;
8. fixture compatibility and valid generated-candidate start;
9. focused tests, workspace typechecks, repository guards, and full suite pass;
10. durable docs leave the remaining P0 and Goal axes open.

After completion, route back to auto-project and choose the next current core-loop blocker from
evidence rather than assuming P0 or the CandidateArena Goal is complete.
