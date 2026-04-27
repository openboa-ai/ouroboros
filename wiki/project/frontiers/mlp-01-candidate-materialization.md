# MLP-01 Candidate Materialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize one provider-generated trader-system candidate into durable candidate/spec/
program/capability records without treating provider output as product truth.

**Architecture:** The existing Bootstrap substrate already provides read-only fixture records,
projections, runtime APIs, and an inspect UI. This frontier adds a probe-gated candidate generation
and materialization path: provider output enters as `AgentRun` / `AgentEvent` / artifact context,
then schema and semantic validation decide whether a `TraderSystemCandidate` is created. Failed,
missing, invalid, or rejected provider output must remain inspectable without creating a candidate.

**Tech Stack:** TypeScript, Fastify, React, Vitest, local file-backed store, optional local Codex CLI
subprocess support behind a `RuntimeProviderAdapter` seam.

---

## Context Read

- [../frontier-ledger.md](../frontier-ledger.md)
- [../../product/mlp-01/prds/01-trader-system-candidate-becomes-real.md](../../product/mlp-01/prds/01-trader-system-candidate-becomes-real.md)
- [../../product/mlp-01/07-implementation-plan.md](../../product/mlp-01/07-implementation-plan.md)
- [../../architecture/01-pr1-trader-system-candidate-becomes-real-design.md](../../architecture/01-pr1-trader-system-candidate-becomes-real-design.md)
- [../../architecture/06-runtime-provider-adapter-feasibility.md](../../architecture/06-runtime-provider-adapter-feasibility.md)
- [../../architecture/specs/08-candidate-contract.md](../../architecture/specs/08-candidate-contract.md)
- [../../architecture/05-bootstrap-tech-spec.md](../../architecture/05-bootstrap-tech-spec.md)

## Owned Boundary

- `packages/domain/src/index.ts`
- `packages/local-store/src/index.ts`
- `packages/local-store/test/local-store.test.ts`
- `apps/runtime/src/server.ts`
- `apps/runtime/test/server.test.ts`
- `apps/operator-web/src/App.tsx`
- `apps/operator-web/src/api.ts`
- `apps/operator-web/src/App.test.tsx`
- minimal supporting runtime files under `apps/runtime/src/`
- minimal UI styling under `apps/operator-web/src/styles.css`
- project state writeback in `wiki/project/frontier-ledger.md` and `knowledge-log.md`

## Non-Goals

- no counted evidence, promotion, live deployment, gateway, exchange, or evaluator execution
- no program execution, sandbox/container implementation, marketplace behavior, or A2A networking
- no broad provider marketplace; only the first `codex_cli` seam and test fakes are in scope
- no silent candidate creation from provider text; materialization requires validation acceptance
- no provider memory/session state as product truth
- no UI controls that imply evidence, promotion, live authority, or runtime lifecycle control

## Acceptance Criteria

- A successful provider-shaped candidate generation run can create exactly one durable
  `TraderSystemCandidate` plus candidate version, spec, program, capability, agent/run/event,
  provider readiness/probe, trace, runtime seam, and evaluation placeholder refs.
- Candidate materialization uses schema validation and semantic validation before durable candidate
  creation.
- Failure reasons are inspectable and create no candidate for:
  `provider_unavailable`, `model_inaccessible`, `provider_failed`, `schema_missing`,
  `schema_invalid`, and `materialization_rejected`.
- Retrying the same accepted provider run/output is idempotent and returns or links the already
  materialized candidate.
- The candidate inspect read model shows provider kind, model, run id, validation outcome,
  materialization attempt, trace/artifact refs, candidate status, and `evaluation_handoff_ready`.
- The operator UI shows candidate materialization attempts and makes clear that provider output is
  not evidence, promotion, or live authority.
- Local tests cover success, invalid schema, semantic rejection, provider failure, duplicate retry,
  and restart projection rebuild.
- Existing validation passes:

```bash
npm test
npm run typecheck
npm run build
bash scripts/check-docs.sh
bash scripts/check-secrets.sh
git diff --check
```

## File Structure Plan

| File | Responsibility |
| --- | --- |
| `packages/domain/src/index.ts` | Add candidate materialization input, attempt, validation, provider, and read-model types. |
| `packages/local-store/src/index.ts` | Add durable attempt writes, validation helpers, idempotent candidate materialization, and projections. |
| `apps/runtime/src/candidate-materialization.ts` | Convert a provider result into a validated materialization request and store outcome. |
| `apps/runtime/src/providers/runtime-provider-adapter.ts` | Define the adapter interface and CI-safe fake provider shape. |
| `apps/runtime/src/providers/codex-cli-provider.ts` | Implement optional `codex_cli` probe/run command construction and event/artifact collection seam. |
| `apps/runtime/src/server.ts` | Add narrow candidate-generation/materialization APIs while keeping live/runtime/eval action routes absent. |
| `apps/operator-web/src/api.ts` | Add typed client calls for materialization attempts and candidate refresh. |
| `apps/operator-web/src/App.tsx` | Show materialization attempt status and success/failure provenance without evidence claims. |
| `packages/local-store/test/local-store.test.ts` | Cover idempotency, validation, failure retention, projection rebuild. |
| `apps/runtime/test/server.test.ts` | Cover API success/failure behavior and absence of out-of-scope routes. |
| `apps/operator-web/src/App.test.tsx` | Cover operator-facing materialization status labels. |

## Task 1: Domain Contracts

**Files:**

- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Add provider and materialization status types**

Add these concepts near the existing provider and agent record types:

```ts
export type ProviderKind = "codex_cli" | "local_process" | "fixture_only";
export type AgentRunPurpose = "candidate_generation" | "candidate_generation_placeholder";
export type AgentRunStatus = "succeeded" | "failed" | "rejected" | "fixture_placeholder";
export type CandidateMaterializationFailureReason =
  | "provider_unavailable"
  | "model_inaccessible"
  | "provider_failed"
  | "schema_missing"
  | "schema_invalid"
  | "materialization_rejected";
export type CandidateMaterializationStatus = "materialized" | "failed";
```

- [ ] **Step 2: Add `CandidateMaterializationInput`**

The input must include candidate, spec, program, capability, provider, trace, and idempotency fields.
It must not include evidence, promotion, live approval, exchange credentials, provider API keys, or
gateway signing material.

- [ ] **Step 3: Add `CandidateMaterializationAttemptRecord`**

The record must preserve the provider run, status, validation outcome, failure reason, resulting
candidate ref when present, trace/artifact refs, and idempotency key.

- [ ] **Step 4: Extend read models**

`CandidateSummaryReadModel` and `CandidateInspectReadModel` should support `materialized` candidates
in addition to Bootstrap fixture candidates. Add a list/detail read model for materialization
attempts so failures remain inspectable without creating candidate records.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck -w @autokairos/domain
```

Expected: compile errors point only to downstream packages that have not been updated yet.

## Task 2: Local Store Materialization

**Files:**

- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

- [ ] **Step 1: Write failing tests for successful materialization**

Test that `store.materializeCandidate(validInput)` creates candidate, candidate version, spec,
program, capability, agent run/event, trace placeholder, and materialization attempt records, then
`getCandidate(candidate_id)` returns an inspectable materialized candidate.

- [ ] **Step 2: Write failing tests for rejected materialization**

Test that invalid schema or forbidden semantic fields produce a failed attempt with
`schema_invalid` or `materialization_rejected` and `store.listCandidates()` does not include a new
candidate.

- [ ] **Step 3: Write failing idempotency test**

Test that the same provider run id plus output artifact hash does not create duplicate candidates.

- [ ] **Step 4: Implement store collections and atomic writes**

Add `candidate-materialization-attempts` as an authoritative item collection and projection source.
Keep item files authoritative and write with temp-write-then-rename.

- [ ] **Step 5: Implement validation and materialization**

Validation must reject missing required refs, unknown market scope, evidence/promotion/live fields,
credential-looking fields, and direct exchange authority fields.

- [ ] **Step 6: Run local-store tests**

Run:

```bash
npm test -- packages/local-store/test/local-store.test.ts
```

Expected: all local-store candidate materialization tests pass.

## Task 3: Runtime Provider Adapter Seam

**Files:**

- Create: `apps/runtime/src/providers/runtime-provider-adapter.ts`
- Create: `apps/runtime/src/providers/codex-cli-provider.ts`
- Create: `apps/runtime/src/candidate-materialization.ts`
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/test/server.test.ts`

- [ ] **Step 1: Define `RuntimeProviderAdapter`**

The interface must expose `probe()` and `runCandidateGeneration()`. The rest of the runtime should
receive provider output as typed run/event/artifact data, not as a trusted candidate.

- [ ] **Step 2: Implement a fake adapter for tests**

The test fake must return deterministic success, provider failure, model-inaccessible, missing
schema, invalid schema, and semantic-rejection cases without invoking external CLIs.

- [ ] **Step 3: Implement `codex_cli` command construction**

The Codex provider must construct:

```text
codex exec --cd <working_dir> --model gpt-5.4 --sandbox read-only --json --output-schema <schema> --output-last-message <result> <prompt>
```

Actual subprocess execution should be behind the adapter seam and should not run in normal CI tests.

- [ ] **Step 4: Add runtime APIs**

Add the narrow APIs needed for this frontier:

```text
GET  /api/candidate-materialization-attempts
GET  /api/candidate-materialization-attempts/:attempt_id
POST /api/candidate-generation-runs
```

The `POST` endpoint must create an attempt, run through the injected adapter, materialize only when
validation passes, and return either the resulting candidate ref or the failure reason.

- [ ] **Step 5: Preserve out-of-scope route absence**

Keep tests proving no evaluator, promotion, live order, gateway, or runtime lifecycle control routes
exist.

- [ ] **Step 6: Run runtime tests**

Run:

```bash
npm test -- apps/runtime/test/server.test.ts
```

Expected: runtime API tests pass without Codex installed or authenticated.

## Task 4: Operator Inspect Surface

**Files:**

- Modify: `apps/operator-web/src/api.ts`
- Modify: `apps/operator-web/src/App.tsx`
- Modify: `apps/operator-web/src/styles.css`
- Modify: `apps/operator-web/src/App.test.tsx`

- [ ] **Step 1: Add client calls for materialization attempts**

Expose list/detail calls for attempt records. Keep candidate list refresh separate from attempt
status so a failed attempt can be visible without a candidate.

- [ ] **Step 2: Add materialization attempt panel**

The panel must show provider kind, model, run id, status, validation outcome, failure reason,
resulting candidate ref if present, trace/artifact refs, and a clear `not evidence` label.

- [ ] **Step 3: Add optional development-only run action only if explicitly scoped**

If adding a button would imply product-level autonomous generation, skip it. Prefer API-backed tests
and read-only UI display unless the implementation plan is revised.

- [ ] **Step 4: Add UI tests**

Test success and failure labels and verify no evidence/promotion/live control labels appear.

- [ ] **Step 5: Run operator-web tests/build**

Run:

```bash
npm test -- apps/operator-web/src/App.test.tsx
npm run build -w @autokairos/operator-web
```

Expected: tests and build pass.

## Task 5: Full Verification And Writeback

**Files:**

- Modify: `wiki/project/frontier-ledger.md`
- Modify: `knowledge-log.md`

- [ ] **Step 1: Run full validation**

Run:

```bash
npm test
npm run typecheck
npm run build
bash scripts/check-docs.sh
bash scripts/check-secrets.sh
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Update project ledger**

Set this frontier to `pr-open` when the implementation branch is pushed and a PR exists, or
`blocked` if provider/materialization evidence cannot be produced.

- [ ] **Step 3: Append chronology**

Append only the durable result to `knowledge-log.md`: branch, PR, validation status, and any
materialization proof or blocker.

- [ ] **Step 4: Commit and push**

Use focused commits. Suggested sequence:

```bash
git add packages apps
git commit -m "feat: materialize provider candidate attempts"
git add wiki/project/frontier-ledger.md knowledge-log.md
git commit -m "project: update candidate materialization frontier"
git push -u origin feat/mlp-01-candidate-materialization
```

## Failure Handling

- If Codex CLI is unavailable locally, the implementation must still pass tests with injected fake
  adapters and record `provider_unavailable` in real probe output.
- If `gpt-5.4` access fails, record `model_inaccessible`; do not switch silently to another model.
- If provider output has no schema result, record `schema_missing`; do not parse final prose as a
  candidate.
- If schema parse passes but semantic guardrails fail, record `materialization_rejected`; do not
  create candidate records.
- If a crash occurs after acceptance, recovery must produce no candidate or exactly one candidate for
  the idempotency key.

## Auto Project Run Packet

```text
current_mlp: MLP-01
active_frontier: mlp-01-candidate-materialization
branch: feat/mlp-01-candidate-materialization
pr: not opened
status: in-progress
context_read: frontier ledger, MLP-01 PRD/design/provider/bootstrap/domain/store/runtime/UI code
route: auto-pm -> auto-coding
skills_considered: superpowers:using-superpowers, superpowers:writing-plans, auto-project, auto-pm, project-context, llm-wiki
evidence_required: tests, typecheck, build, docs/secrets checks, candidate success/failure/idempotency behavior
risks: provider execution may drift into product truth; UI actions may imply evidence or live authority
next_owner: auto-coding
writeback_needed: yes
llm_wiki_target: wiki/project/frontier-ledger.md, knowledge-log.md
```
