# CandidateArena Admission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a persisted admission decision between `ResearchPreflight` and candidate
materialization so failed, unchanged, crashed, disqualified, or quarantined research output cannot
create a runnable paper candidate while valid negative results remain research memory.

**Architecture:** Add a pure domain admission policy and durable decision record, validate and
persist the record through `OuroborosStorePort` and `LocalStore`, then change CandidateArena to
record evaluation, finding, lineage, and admission before materialization. Arena direction results
surface `created`, `duplicate`, `quarantined`, or infrastructure `failed` without widening paper or
live authority.

**Tech Stack:** TypeScript, Vitest, `@ouroboros/domain`, `@ouroboros/application`,
`@ouroboros/local-store`.

## Global Constraints

- Follow [CandidateArena And Research Goal](../../candidate-arena-research-goal.md).
- Follow [CandidateArena Evaluation Protocol](../../candidate-arena-evaluation-protocol.md).
- Profit remains the objective; risk, evidence, authority, and resource bounds remain hard gates.
- Research output and candidate self-report are never evaluation authority.
- Valid negative results remain findings; invalid results create no runnable paper handoff.
- No private data, signed exchange request, live order, or new live authority.
- Use existing canonical nouns and do not add compatibility aliases.
- Write each behavior test first and observe the expected failure before implementation.

---

### Task 1: Pure Candidate Admission Policy

**Files:**
- Create: `packages/domain/src/candidate-admission-policy.test.ts`
- Create: `packages/domain/src/candidate-admission-policy.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: ResearchWorker submission outcome, experiment status, external evaluation status, and
  evidence disposition.
- Produces: `decideCandidateAdmission(input): CandidateAdmissionDecision` and
  `CandidateAdmissionDecisionRecord`.

- [x] **Step 1: Write the failing policy tests**

```ts
import { describe, expect, it } from "vitest";
import { decideCandidateAdmission } from "./candidate-admission-policy";

describe("candidate admission policy", () => {
  it("admits an externally accepted changed candidate", () => {
    expect(decideCandidateAdmission({
      research_worker_outcome: "changed",
      experiment_status: "evaluated",
      evaluation_status: "accepted",
      evidence_disposition: "not_counted"
    })).toEqual({
      status: "admitted",
      reason: "evaluation_accepted",
      runnable_paper_handoff: true,
      authority_status: "not_live"
    });
  });

  it.each([
    ["failed", "evaluated", "accepted", "not_counted", "research_worker_failed"],
    ["changed", "failed", "accepted", "not_counted", "experiment_failed"],
    ["changed", "evaluated", "disqualified", "quarantined_for_review", "evaluation_disqualified"]
  ] as const)("quarantines invalid research output", (
    research_worker_outcome,
    experiment_status,
    evaluation_status,
    evidence_disposition,
    reason
  ) => {
    expect(decideCandidateAdmission({
      research_worker_outcome,
      experiment_status,
      evaluation_status,
      evidence_disposition
    })).toMatchObject({
      status: "quarantined",
      reason,
      runnable_paper_handoff: false
    });
  });

  it("classifies unchanged output as duplicate", () => {
    expect(decideCandidateAdmission({
      research_worker_outcome: "unchanged",
      experiment_status: "evaluated",
      evaluation_status: "accepted",
      evidence_disposition: "not_counted"
    })).toMatchObject({
      status: "duplicate",
      reason: "no_candidate_change",
      runnable_paper_handoff: false
    });
  });
});
```

- [x] **Step 2: Run the test and verify RED**

Run: `npm test -- packages/domain/src/candidate-admission-policy.test.ts`

Expected: FAIL because `candidate-admission-policy` does not exist.

- [x] **Step 3: Implement the pure policy and durable record shape**

```ts
export type CandidateAdmissionStatus = "admitted" | "duplicate" | "quarantined";
export type CandidateAdmissionReason =
  | "evaluation_accepted"
  | "research_worker_failed"
  | "no_candidate_change"
  | "experiment_failed"
  | "evaluation_disqualified"
  | "evaluation_quarantined"
  | "evidence_quarantined";

export interface CandidateAdmissionDecision {
  status: CandidateAdmissionStatus;
  reason: CandidateAdmissionReason;
  runnable_paper_handoff: boolean;
  authority_status: "not_live";
}

export interface CandidateAdmissionDecisionRecord extends CandidateAdmissionDecision {
  record_kind: "candidate_admission_decision";
  version: 1;
  candidate_admission_decision_id: string;
  source_system_code_ref: { record_kind: "system_code"; id: string };
  system_code_ref: { record_kind: "system_code"; id: string };
  experiment_run_ref: { record_kind: "experiment_run"; id: string };
  trading_evaluation_result_ref: { record_kind: "trading_evaluation_result"; id: string };
  research_finding_ref: { record_kind: "research_finding"; id: string };
  source_artifact_digest: string;
  submitted_artifact_digest: string;
  decided_at: string;
}
```

Implement deterministic precedence: worker failure, no change, failed experiment, quarantined
evaluation, disqualified evaluation, quarantined evidence, then accepted admission.

- [x] **Step 4: Export the policy and extend canonical result vocabulary**

Modify `packages/domain/src/index.ts` to export the policy, include the record in `FixtureRecord`,
allow `duplicate_result` findings, add exact Arena disqualification reasons, and allow direction
statuses `duplicate` and `quarantined`.

- [x] **Step 5: Run domain tests and verify GREEN**

Run: `npm test -- packages/domain/src/candidate-admission-policy.test.ts packages/domain/src/research-trading-evaluation-records.test.ts`

Expected: PASS.

### Task 2: Persist Admission Decisions With Referential Validation

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Consumes: `CandidateAdmissionDecisionRecord` after its source and submitted SystemCode,
  ExperimentRun, TradingEvaluationResult, and ResearchFinding records exist.
- Produces: `recordCandidateAdmissionDecision()` and `listCandidateAdmissionDecisions()`.

- [x] **Step 1: Write a failing LocalStore round-trip test**

The test must record all referenced records, persist one admitted decision, reload `LocalStore`, and
assert exact equality. A second assertion must reject a decision whose finding ref does not exist
with `candidate_admission_reference_not_found`.

- [x] **Step 2: Run the LocalStore test and verify RED**

Run: `npm test -- packages/local-store/test/local-store.test.ts`

Expected: FAIL because the admission persistence methods do not exist.

- [x] **Step 3: Add the explicit store port methods**

```ts
recordCandidateAdmissionDecision(
  record: CandidateAdmissionDecisionRecord
): Promise<CandidateAdmissionDecisionRecord>;
listCandidateAdmissionDecisions(): Promise<CandidateAdmissionDecisionRecord[]>;
```

- [x] **Step 4: Implement LocalStore validation and persistence**

Validate record kind, version, all typed refs, status/reason consistency, runnable handoff only for
`admitted`, source/submitted SystemCode digest consistency, evidence-chain field consistency,
timestamp, and `not_live` authority. Verify every referenced record exists before writing
`candidate-admission-decisions/<id>.json`. Sort list results by `decided_at`, then ID.

- [x] **Step 5: Run LocalStore and domain tests and verify GREEN**

Run: `npm test -- packages/local-store/test/local-store.test.ts packages/domain/src/candidate-admission-policy.test.ts`

Expected: PASS.

### Task 3: Gate CandidateArena Materialization

**Files:**
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify: CandidateArena status assertions in affected CLI, TUI, Web, and runtime tests only when
  their fixture intentionally returns `no_change`.

**Interfaces:**
- Consumes: `decideCandidateAdmission`, persisted research records, and one submitted SystemCode.
- Produces: an admitted materialized candidate or a durable `duplicate`/`quarantined` direction
  result with zero runnable candidate IDs.

- [x] **Step 1: Write failing Arena integration tests**

Add three real-flow tests:

1. A failed ResearchWorker creates zero candidates, one quarantined admission decision,
   `failure_analysis`, exact `research_worker_failed` reason, and no positive finding.
2. A `no_change` ResearchWorker creates zero candidates, one duplicate admission decision, and a
   `duplicate_result` finding.
3. A changed candidate with accepted external evaluation and negative net revenue remains admitted,
   materialized, and recorded as `negative_result`.

- [x] **Step 2: Run the Arena test and verify RED**

Run: `npm test -- apps/runtime/test/candidate-arena-paper-context.test.ts`

Expected: FAIL because failed and unchanged output currently materialize candidates and no admission
record exists.

- [x] **Step 3: Record research evidence before materialization**

Change `recordArenaResearchRecords` to accept the notebook entry, persist ExperimentRun,
TradingEvaluationResult, Finding, Lineage, and CandidateAdmissionDecision, and return the admission
decision. Disqualified results use `quarantined_for_review`; worker failure and runtime crash retain
exact disqualification reasons.

- [x] **Step 4: Gate materialization and surface status**

`runArenaDirection` must materialize only when `runnable_paper_handoff` is true. Otherwise return a
typed duplicate or quarantined outcome. `runCandidateArenaTick` must leave `created_candidate_ids`
empty for those outcomes and carry `admission_decision_id`, `admission_reason`, and finding summary
in the direction result.

- [x] **Step 5: Make context-capturing fixtures produce a changed artifact**

Tests that are about context rather than duplicate handling must append a deterministic comment to
their copied `run.py` and return `edited`. Keep the dedicated no-change fixture unchanged.

- [x] **Step 6: Run targeted tests and verify GREEN**

Run: `npm test -- apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/managed-codex-researcher-execution.test.ts packages/domain/src/candidate-admission-policy.test.ts packages/local-store/test/local-store.test.ts`

Expected: PASS.

### Task 4: Validate And Commit The Frontier

**Files:**
- Modify documentation only if implementation reveals a contract correction.

- [x] **Step 1: Run required validation**

```bash
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

- [x] **Step 2: Run application type and test coverage**

Run the repo typecheck command and all CandidateArena, materialization, paper continuation, CLI,
TUI, and Web status tests affected by the public direction-result union.

- [x] **Step 3: Audit P0 acceptance honestly**

Record P0.1/P0.2 as complete only if invalid output creates no runnable handoff and all evidence is
durable. Keep the overall Goal and later P0 items active: evidence purpose, candidate freeze,
evaluator leakage removal, and comparable paper windows are not part of this frontier.

Final evidence on 2026-07-10:

- `npm test`: 72 files and 649 tests passed outside the sandbox required by localhost tests.
- `npm run typecheck`: all workspaces passed, including the Tauri Desktop build check.
- `npm run check:repo-guards`: docs, architecture, naming, tracked environment, secret, and diff
  checks passed.
- Independent repo-quality review found no remaining Critical, Important, or Moderate findings
  after direct-materialization bypasses, counted-evidence admission, and source-digest persistence
  were corrected.
- The overall P0 contract remains active: immutable evidence-purpose lifecycle, candidate freeze,
  evaluator leakage removal, prospective qualification, and comparable paper windows are not
  completed by this frontier.

- [x] **Step 4: Commit**

```bash
git add packages/domain packages/application packages/local-store apps/runtime/test docs/superpowers/plans
git commit -m "feat: gate arena candidate admission"
```
