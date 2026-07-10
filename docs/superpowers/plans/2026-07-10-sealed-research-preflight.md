# Sealed ResearchPreflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [x]`) syntax for completed implementation evidence.

**Goal:** Make `ResearchPreflight` a one-way information boundary where a TradingSystem receives
only causal market and account inputs, a ResearchWorker receives only bounded aggregate feedback,
and the external evaluator alone can use hidden labels, future outcomes, and counted validation.

**Architecture:** Project each sealed `ReplayTradingScenario` into a label-free
`ReplayTradingCandidateInput` before creating a provider session. Run candidate code with only that
projection, reconstruct order validation from external provider request logs, and keep complete
scenario evidence in the evaluator-owned in-memory result while writing only aggregate feedback to
ResearchWorker-visible files. Propagate exact leakage reasons through CandidateArena admission so
anti-hacking attempts are quarantined rather than rewarded.

**Tech Stack:** TypeScript, Node HTTP, Docker Sandboxes `sbx`, Vitest,
`@ouroboros/application`, `@ouroboros/domain`.

## Global Constraints

- Follow [CandidateArena And Research Goal](../../candidate-arena-research-goal.md).
- Follow [CandidateArena Evaluation Protocol](../../candidate-arena-evaluation-protocol.md).
- `ReplayTradingScenario` is evaluator-only and must never cross a candidate provider or sandbox
  session boundary.
- Candidate-authored events, metrics, validation responses, and explanations are trace only.
- Profit remains the objective; risk, evidence, authority, and resource bounds remain hard gates.
- A valid loss remains research memory; leakage, probing, forged validation, and protocol bypass
  create zero runnable paper handoffs.
- Preserve paper-only authority and do not add private data, signed requests, or live execution.
- Use internal contract names `TradingApiMarketSnapshot`, `TradingApiAccountState`, and
  `ReplayTradingCandidateInput`; do not add a new public or persisted product noun.
- Write each behavior test first and observe its expected failure before production edits.

## Owned Boundary

This frontier owns replay input projection, provider-session shape, candidate sandbox mounts,
external replay evaluation, ResearchWorker feedback release, and exact Arena quarantine
propagation. It does not own candidate freeze, evidence-purpose windows, prospective paper
qualification, champion/challenger comparison, or long-running ResearchWorker lifecycle.

---

### Task 1: Split Candidate Input From Sealed Scenario

**Files:**
- Modify: `packages/application/src/trading/research/types.ts`
- Modify: `packages/application/src/trading/research/replay-trading-api-provider.ts`
- Modify: `packages/application/src/trading/research/replay-set-runner.ts`
- Modify: `packages/application/src/trading/gateway/runtime-binding.ts`
- Test: `apps/runtime/test/trading-research-loop.test.ts`

**Interfaces:**
- Consumes: evaluator-owned `ReplayTradingScenario`.
- Produces: `toReplayTradingCandidateInput(scenario): ReplayTradingCandidateInput`, provider factory
  `(input, options) => ReplayTradingApiProviderSession`, and session field `candidate_input`.

- [x] **Step 1: Write failing provider-boundary tests**

Assert that `/market/snapshot` omits `expected_direction`, a provider session exposes
`candidate_input` but no `scenario`, `outcome`, ID, or description, and the paper provider applies
the same market projection even when its internal `MarketSnapshot` includes a directional label.

- [x] **Step 2: Run the provider tests and verify RED**

Run: `npm test -- apps/runtime/test/trading-research-loop.test.ts`

Expected: FAIL because replay and paper sessions expose the complete scenario and market endpoint.

- [x] **Step 3: Add the candidate-only contract**

```ts
export type TradingApiMarketSnapshot = Omit<MarketSnapshot, "expected_direction">;
export type TradingApiAccountState = Omit<AccountState, "target_risk_fraction">;

export interface ReplayTradingCandidateInput {
  market: TradingApiMarketSnapshot;
  account: TradingApiAccountState;
}

export interface ReplayTradingApiProviderSession {
  base_url: string;
  sandbox_base_url?: string;
  close(): Promise<void>;
  requests(): TradingProviderRequestLog[];
  candidate_input: ReplayTradingCandidateInput;
}
```

Add projections that construct new market and account objects from explicit allowlists. Do not use
object spread followed by deletion because newly added evaluator-only fields must fail closed.

- [x] **Step 4: Move scenario authority into the replay runner**

Change `ReplayTradingApiProviderFactory` to receive only `ReplayTradingCandidateInput`.
`runTradingReplaySet` retains the complete scenario locally, passes its projection to the provider,
and passes the complete scenario only to `evaluateTradingRun` after candidate execution.

- [x] **Step 5: Sanitize the paper provider session and response**

Use the same allowlist projections for `startPaperTradingApiProvider`. Its candidate session carries
only the initial projected market and risk-limit account state; it excludes the evaluator risk
target and does not synthesize a replay outcome.

- [x] **Step 6: Run the provider tests and verify GREEN**

Run: `npm test -- apps/runtime/test/trading-research-loop.test.ts apps/runtime/test/trading-gateway-runtime-binding.test.ts`

Expected: PASS for the candidate-visible contract tests.

### Task 2: Give The Candidate Sandbox Only Candidate Inputs

**Files:**
- Modify: `packages/application/src/trading/research/artifact-runner.ts`
- Test: `apps/runtime/test/trading-research-loop.test.ts`

**Interfaces:**
- Consumes: `ReplayTradingApiProviderSession.candidate_input` and one candidate artifact directory.
- Produces: an isolated per-run sandbox workspace containing only the copied artifact, provider
  sidecar, candidate input, request log, and candidate-authored event output.

- [x] **Step 1: Write failing sandbox anti-leakage tests**

Use the fake `sbx` adapter to assert that `create ... shell` mounts the per-run workspace rather than
the repository/worktree, the execution working directory is the copied artifact, and
`replay-provider-scenario.json` contains only `market` and `account`. Assert absence of
`expected_direction`, `outcome`, `exit_price`, fee, slippage, funding, scenario ID, and description.

- [x] **Step 2: Run the sandbox test and verify RED**

Run: `npm test -- apps/runtime/test/trading-research-loop.test.ts`

Expected: FAIL because the runner mounts its configured workspace and serializes `provider.scenario`.

- [x] **Step 3: Build an isolated execution workspace**

Before `sbx create`, recreate `<output_dir>/scenario-NNN/sandbox-workspace`, copy the candidate
artifact to `sandbox-workspace/artifact`, and place candidate event/provider files under that root.
Pass the isolated root to `sbx create shell` and use the copied artifact as `sbx exec -w`. Copy raw
evidence into the evaluator-owned in-memory result, then remove the scenario workspace before the
next ResearchWorker can run.

- [x] **Step 4: Serialize only the candidate projection**

Write `input.provider.candidate_input` to the sidecar input file. Rename local implementation
variables from `scenario` to `candidate_input` where they cross the sandbox boundary; the sidecar
continues serving only market, account, and order validation endpoints.

- [x] **Step 5: Run the sandbox tests and verify GREEN**

Run: `npm test -- apps/runtime/test/trading-research-loop.test.ts`

Expected: PASS, with no evaluator-only value present in the mounted workspace fixture.

### Task 3: Make External Evidence Authoritative

**Files:**
- Modify: `packages/application/src/trading/research/types.ts`
- Modify: `packages/application/src/trading/research/evaluator.ts`
- Modify: `packages/application/src/trading/research/replay-set-runner.ts`
- Test: `apps/runtime/test/trading-research-loop.test.ts`

**Interfaces:**
- Consumes: candidate-authored events, provider request logs, and evaluator-only
  `ReplayTradingScenario`.
- Produces: `TradingEvaluationResult.disqualification_reason` and externally reconstructed risk,
  direction, and profit evidence.

- [x] **Step 1: Write failing evaluator-authority tests**

Cover these cases separately:

1. Candidate events omit `expected_direction`, yet the evaluator scores direction and PnL from the
   sealed scenario.
2. A forged `order_validation.accepted: true` cannot rescue an invalid provider POST body.
3. An `order_request` event that differs from the `/orders/validate` POST body is disqualified.
4. A request to `/evaluation/outcome` is `data_leakage`.
5. An event containing `expected_direction` or future outcome fields is `lookahead_leakage`.

- [x] **Step 2: Run evaluator tests and verify RED**

Run: `npm test -- apps/runtime/test/trading-research-loop.test.ts`

Expected: FAIL because the evaluator trusts candidate-authored validation, market labels, and
account targets and does not reject probing.

- [x] **Step 3: Reconstruct the counted order and validation**

Select the provider POST to `/orders/validate`, parse its body as the submitted `OrderRequest`,
require it to equal the candidate `order_request` event on protocol fields, and call
`validateOrderRequest(body, scenario.market, scenario.account)` externally. Ignore the
candidate-authored `order_validation` event for status, risk, notional, and PnL.

- [x] **Step 4: Add fail-closed protocol inspection**

Permit only the declared method/path combinations for market, account, and order validation.
Inspect event object keys recursively for evaluator-only fields. Return a zero-score disqualified
result with exact `data_leakage` or `lookahead_leakage` before economic scoring.

- [x] **Step 5: Carry exact reasons through scenario aggregation**

Import `TradingEvaluationDisqualificationReason` from `@ouroboros/domain`, add optional
`disqualification_reason` to aggregate and scenario runtime results, and choose the first
disqualified scenario reason deterministically when aggregating.

- [x] **Step 6: Run evaluator tests and verify GREEN**

Run: `npm test -- apps/runtime/test/trading-research-loop.test.ts`

Expected: PASS for sealed scoring, forged self-report, mismatch, lookahead, and probing cases.

### Task 4: Release Only Bounded Aggregate Research Feedback

**Files:**
- Modify: `packages/application/src/trading/research/replay-set-runner.ts`
- Modify: `packages/application/src/trading/research/run-trading-research.ts`
- Test: `apps/runtime/test/trading-research-loop.test.ts`

**Interfaces:**
- Consumes: complete in-memory evaluator results.
- Produces: ResearchWorker-visible `notebook.json` and `replay-set.json` containing aggregate status,
  score, risk decision, profit/loss, metric summaries, and no per-scenario correctness or hidden
  evaluator path.

- [x] **Step 1: Write a failing feedback-release test**

Assert the returned `TradingResearchLoopResult.entries` retains `scenario_results` for the outer
Arena, while the JSON files read by a later ResearchWorker contain no `scenario_results`, scenario
IDs, runner evidence, per-example correctness, hidden outcomes, or evaluator-only field names.

- [x] **Step 2: Run the research-loop test and verify RED**

Run: `npm test -- apps/runtime/test/trading-research-loop.test.ts`

Expected: FAIL because both files currently serialize complete scenario results.

- [x] **Step 3: Add one explicit feedback projection**

Project notebook entries before every write rather than mutating the evaluator-owned in-memory
entry. Keep only bounded aggregate evaluation fields. Point any worker-visible evidence path at the
aggregate replay-set file, never at per-scenario candidate events or evaluator records.

- [x] **Step 4: Write aggregate-only replay output**

Keep `scenario_results` in the function return value, but serialize only the aggregate evaluation
surface to `replay-set.json`.

- [x] **Step 5: Run feedback tests and verify GREEN**

Run: `npm test -- apps/runtime/test/trading-research-loop.test.ts apps/runtime/test/managed-codex-researcher-execution.test.ts`

Expected: PASS with complete outer evidence and bounded ResearchWorker feedback.

### Task 5: Quarantine Leakage In CandidateArena

**Files:**
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`

**Interfaces:**
- Consumes: exact `TradingEvaluationResult.disqualification_reason`.
- Produces: the same reason on `TradingEvaluationResultRecord`, an `anti_hacking_case` finding for
  leakage, and a quarantined admission with `runnable_paper_handoff: false`.

- [x] **Step 1: Write a failing Arena anti-hacking test**

Submit a changed artifact whose run probes an evaluator path or emits a hidden label. Assert zero
created candidate IDs, one quarantined admission, exact `data_leakage` or `lookahead_leakage`, one
`anti_hacking_case`, and no positive/negative finding.

- [x] **Step 2: Run the Arena test and verify RED**

Run: `npm test -- apps/runtime/test/candidate-arena-paper-context.test.ts`

Expected: FAIL because Arena currently replaces evaluator leakage reasons with a generic fallback
and classifies quarantine as `failure_analysis`.

- [x] **Step 3: Preserve evaluator reason and finding kind**

Use `entry.evaluation.disqualification_reason` before fallback classification. Map leakage and
candidate self-report authority violations to `anti_hacking_case`; preserve existing crash,
ResearchWorker failure, risk, and duplicate behavior.

- [x] **Step 4: Run Arena tests and verify GREEN**

Run: `npm test -- apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/trading-research-loop.test.ts`

Expected: PASS with no runnable handoff from the adversarial submission.

### Task 6: Migrate Fixtures And Verify The Frontier

**Files:**
- Modify only compile- or behavior-affected fixtures in:
  `apps/runtime/test/candidate-arena-paper-context.test.ts`,
  `apps/runtime/test/operator-product-loop-smoke.test.tsx`,
  `apps/runtime/test/managed-codex-researcher-execution.test.ts`,
  `apps/runtime/test/server.test.ts`, and
  `apps/runtime/test/clock-artifact.test.ts`,
  `apps/runtime/test/long-running-paper-session.test.ts`,
  `artifacts/trading-system/run.py`, and
  `fixtures/trading-systems/{clock,reference_paper_soak}.py`.

**Interfaces:**
- Consumes: candidate-only provider sessions and externally authoritative order logs.
- Produces: representative fake runners that decide from causal moving averages and submit the
  exact order body to `/orders/validate` instead of reading evaluator labels.

- [x] **Step 1: Remove cheating fixture behavior**

Replace `input.provider.scenario.market.expected_direction` reads with
`input.provider.candidate_input`; infer buy/sell/hold from fast and slow moving averages. Include
the submitted order body in each fake provider request log.

- [x] **Step 2: Run targeted regressions**

Run: `npm test -- apps/runtime/test/trading-research-loop.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts apps/runtime/test/managed-codex-researcher-execution.test.ts apps/runtime/test/operator-product-loop-smoke.test.tsx apps/runtime/test/server.test.ts apps/runtime/test/clock-artifact.test.ts`

Expected: PASS.

- [x] **Step 3: Run package and workspace checks**

Run: `npm run typecheck`

Run: `npm test`

Expected: all package checks and tests PASS.

- [x] **Step 4: Run repository gates**

```bash
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

Expected: every command exits 0.

- [x] **Step 5: Perform independent adversarial review**

Review the complete diff for any remaining path by which a candidate or ResearchWorker can receive
scenario labels, future outcomes, per-scenario correctness, or candidate-authored counted evidence.
Fix every Critical, Important, or Moderate finding and rerun the affected checks.

- [x] **Step 6: Commit the bounded frontier**

```bash
git add docs/superpowers/plans/2026-07-10-sealed-research-preflight.md \
  artifacts/trading-system fixtures/trading-systems \
  packages/application/src/trading/research \
  packages/application/src/trading/gateway/runtime-binding.ts \
  packages/application/src/candidate/arena.ts \
  apps/runtime/test
git commit -m "feat: seal arena research preflight"
```

Expected: pre-commit hooks PASS and the worktree is clean.

## Verification Evidence

Current evidence collected on 2026-07-10:

- `npm run typecheck`: all workspaces passed.
- `npm test`: 72 test files and 659 tests passed. One load-sensitive operator polling attempt timed
  out once; the scenario passed alone, the complete operator file passed, and the full suite passed
  on immediate reproduction without a product or timeout change.
- `bash scripts/check-docs.sh`: passed, including 70 local Markdown links.
- `npm run check:architecture`: passed.
- `npm run check:naming`: passed.
- `bash scripts/check-env-files.sh --tracked`: passed.
- `bash scripts/check-secrets.sh`: passed with no leaks found.
- `git diff --check`: passed.

Independent adversarial review also verified and added regression coverage for opaque scenario paths,
post-evaluation workspace cleanup, cleanup after provider-close failure, exact provider POST schemas,
semantic hold/directional order coherence, boundary-reason precedence, trace-only event metadata,
evaluator risk-target removal, and accepted-only best-artifact selection.

## Frontier Acceptance

This frontier passes only when all of the following are current evidence:

1. No candidate API response, provider session, sidecar file, or mounted candidate workspace
   contains an evaluator label or future outcome.
2. Candidate-authored validation, profit, metrics, and explanations cannot become counted evidence.
3. Unexpected evaluator probing and hidden-field emission are disqualified with exact reasons.
4. Complete per-scenario evidence remains available to the outer Arena in memory, while the next
   ResearchWorker receives only bounded aggregate feedback.
5. Leakage attempts become quarantined `anti_hacking_case` memory and create zero runnable paper
   candidates.
6. Existing accepted, valid-negative, duplicate, crash, risk-invalid, paper, CLI, TUI, and operator
   behavior does not regress.

Passing this frontier is partial P0 evidence only. It does not prove immutable evidence purpose,
candidate freeze, prospective qualification, fair champion/challenger comparison, or completion of
the CandidateArena and Research Goal.
