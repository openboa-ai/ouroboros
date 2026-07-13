# Post-Activation TradingSystem Decision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not dispatch project
> subagents unless the user explicitly requests them.

**Goal:** Emit delivery-bound sequence-2-or-later TradingSystem decisions before acknowledgement,
then prove qualified non-tied and precommitted adaptive-effect evidence on a frozen paper path.

**Architecture:** Keep the existing provider delivery and acknowledgement records. Replace only raw
event attribution with the immutable delivery ref/digest, make both Python artifact families append
the decision before acknowledging, and let repeated checkpoint preparation validate the event
against the acknowledgement's exact delivery. Reuse the real prospective ResearchControlStudy
harness for the final causal proof.

**Tech Stack:** TypeScript, Vitest, Python 3, LocalStore, deterministic sandbox adapter, paper
Gateway/Ledger, ResearchControlStudy runtime.

## Global Constraints

- `TradingSystem` owns decision cadence; Gateway and evaluator never synthesize candidate decisions.
- Sequence 1 remains compatible and does not gain a duplicate post-start decision.
- Sequence 2+ event IDs are stable by sandbox instance, event kind, and tick sequence.
- Raw event attribution is delivery-bound; persisted observation completion evidence remains
  acknowledgement-bound.
- No legacy raw acknowledgement-attribution alias is accepted.
- No private exchange access, credentials, order-submission authority, promotion mutation, or live
  authority is added.
- All behavior changes use RED-GREEN-REFACTOR and are committed in bounded units.
- The untracked `.superpowers/` directory is never read, staged, modified, or removed.

---

### Task 1: Delivery-Bound Event Parsing And Preparation

**Files:**
- Modify: `packages/application/src/trading/paper/events.test.ts`
- Modify: `packages/application/src/trading/paper/events.ts`
- Modify: `packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts`
- Modify: `packages/application/src/trading/paper/observation.ts`

**Interfaces:**
- Consumes: `PaperTradingComparisonTickAcknowledgementRecord.delivery_ref` and
  `.delivery_digest`.
- Produces: optional parsed event fields `comparison_tick_delivery_ref?: Ref` and
  `comparison_tick_delivery_digest?: string`.

- [x] **Step 1: Write the failing parser contract**

Replace the parser fixture attribution with:

```ts
const deliveryAttribution = {
  comparison_tick_delivery_ref: {
    record_kind: "paper_trading_comparison_tick_delivery",
    id: "delivery-1"
  },
  comparison_tick_delivery_digest: "sha256:delivery"
} as const;
```

Require order, cancel, hold, and no-action events to preserve it. Require partial fields, wrong
record kind, malformed digest, extra `comparison_tick_*` fields, and the old raw acknowledgement
field pair to return `comparison_tick_delivery_attribution_invalid`.

- [x] **Step 2: Run the parser test and verify RED**

Run:

```bash
npx vitest run packages/application/src/trading/paper/events.test.ts
```

Expected: failures show the parser does not preserve `comparison_tick_delivery_*` and still accepts
the old field names.

- [x] **Step 3: Implement the minimal parser replacement**

Rename the parsed event attribution type and parser helper to delivery vocabulary. Permit only the
two exact delivery keys, validate `paper_trading_comparison_tick_delivery`, and return the stable
error `comparison_tick_delivery_attribution_invalid` for malformed or old attribution.

- [x] **Step 4: Verify parser GREEN**

Run the Step 2 command. Expected: all parser tests pass.

- [x] **Step 5: Write failing repeated-preparation tests**

Change the repeated event fixture to use the acknowledgement's delivery evidence:

```ts
comparison_tick_delivery_ref: { ...fixture.acknowledgement.delivery_ref },
comparison_tick_delivery_digest: fixture.acknowledgement.delivery_digest
```

Assert exact delivery-bound hold consumption succeeds, while stale delivery ref/digest and old raw
acknowledgement fields fail before `previewLedger` with
`comparison_tick_delivery_attribution_invalid`. Preserve acknowledged-silence assertions.

- [x] **Step 6: Run preparation tests and verify RED**

Run:

```bash
npx vitest run packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts
```

Expected: exact delivery-bound sequence-2 events fail because preparation still requires event
acknowledgement fields.

- [x] **Step 7: Bind repeated events to the acknowledgement's delivery**

In `preparePaperTradingComparisonCheckpointEvidence`, require every new sequence-2+ event to match:

```ts
event.comparison_tick_delivery_ref?.id === acknowledgement.delivery_ref.id &&
event.comparison_tick_delivery_digest === acknowledgement.delivery_digest
```

Preserve the acknowledgement ref/digest only on the prepared observation. Rename the event-cloning
helper fields to delivery vocabulary.

- [x] **Step 8: Verify and commit Task 1**

Run:

```bash
npx vitest run \
  packages/application/src/trading/paper/events.test.ts \
  packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts \
  packages/application/src/trading/paper/session-service.test.ts \
  packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts
npm run typecheck -w @ouroboros/application
git diff --check
```

Expected: focused tests and application typecheck pass. Commit:

```bash
git add packages/application/src/trading/paper/events.ts \
  packages/application/src/trading/paper/events.test.ts \
  packages/application/src/trading/paper/observation.ts \
  packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts
git commit -m "fix: bind comparison decisions to delivered ticks"
```

### Task 2: Fixture Decision-Before-Acknowledgement Cadence

**Files:**
- Modify: `apps/runtime/test/clock-artifact.test.ts`
- Modify: `fixtures/trading-systems/clock.py`

**Interfaces:**
- Consumes: `comparison_tick_context` with `tick_sequence`, `delivery_ref`, and
  `delivery_digest`.
- Produces: one sequence-2+ order or hold event in the sandbox log before the exact ack request.

- [x] **Step 1: Extend the cadence test to prove ordering and deduplication**

Capture stdout and request-hook order. Require the sequence-2 event to contain:

```ts
{
  event_id: "clock-comparison-cadence:order-request:0002",
  comparison_tick_delivery_ref: contexts[1]!.delivery_ref,
  comparison_tick_delivery_digest: contexts[1]!.delivery_digest
}
```

Record `acknowledge` hook snapshots of parsed stdout/log state and assert the sequence-2 event is
already present when context 2 is acknowledged. Assert sequence 1 adds no decision and repeated
context 1 adds no duplicate event or ack.

- [x] **Step 2: Run the fixture test and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/clock-artifact.test.ts
```

Expected: context 2 is acknowledged without a sequence-2 decision.

- [x] **Step 3: Implement sequence-aware fixture decisions**

Refactor the Python helper so it returns validated context metadata without acknowledging. For a
new context with `tick_sequence >= 2`, read account state, build and validate the same bounded paper
intent, attach delivery fields and a sequence-padded event ID, append the event, then call
`POST /comparison/tick/ack`. For sequence 1, acknowledge without emitting a second startup
decision. Update `last_delivery_id` only after ack response validation.

- [x] **Step 4: Verify and commit Task 2**

Run:

```bash
npx vitest run apps/runtime/test/clock-artifact.test.ts \
  apps/runtime/test/generated-trading-system-artifact.test.ts
git diff --check
```

Expected: clock tests pass and generated artifact tests remain unchanged. Commit:

```bash
git add fixtures/trading-systems/clock.py apps/runtime/test/clock-artifact.test.ts
git commit -m "feat: emit fixture decisions before tick acknowledgement"
```

### Task 3: Generated Candidate Decision-Before-Acknowledgement Cadence

**Files:**
- Modify: `apps/runtime/test/generated-trading-system-artifact.test.ts`
- Modify: `artifacts/trading-system/run.py`
- Test: `apps/runtime/test/research-control-campaign.test.ts`

**Interfaces:**
- Consumes: the same context parser and event contract proven by Task 2.
- Produces: candidate-specific sequence-2+ `TradingSystemDecision` events that retain directional
  edits made by `DirectionalFixtureTradingResearchAgentAdapter`.

- [ ] **Step 1: Write the failing generated-artifact cadence test**

Require context 2 to produce an attributed event before acknowledgement, using event ID
`generated-comparison-cadence:order-request:0002`. Require the request order for context 2 to be:

```text
GET /market/snapshot
GET /account/state
POST /orders/validate
POST /comparison/tick/ack
```

Assert only the final POST occurs after the attributed line is visible.

- [ ] **Step 2: Run the generated artifact test and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/generated-trading-system-artifact.test.ts
```

Expected: no sequence-2 decision exists and account/validation requests are absent.

- [ ] **Step 3: Implement generated candidate post-activation decisions**

Apply the Task 2 sequencing to `run_paper`. Reuse `build_order_request` and
`paper_event_from_intent`, but accept tick sequence and delivery attribution so IDs are stable and
candidate-specific edits continue to control side, risk, and hold behavior. Append before ack.

- [ ] **Step 4: Prove directional edits still affect post-activation behavior**

Add or extend the arena test to materialize trend-following and mean-reversion artifacts from the
same source and inspect their `run.py` behavior contract. On an upward signal, require the generated
sequence-2 decisions to be `buy` and `sell` respectively; funding-aware behavior must remain hold.

- [ ] **Step 5: Verify and commit Task 3**

Run:

```bash
npx vitest run \
  apps/runtime/test/generated-trading-system-artifact.test.ts \
  apps/runtime/test/clock-artifact.test.ts \
  apps/runtime/test/research-control-campaign.test.ts
npm run typecheck
git diff --check
```

Expected: focused tests and all workspace typechecks pass. Commit:

```bash
git add artifacts/trading-system/run.py \
  apps/runtime/test/generated-trading-system-artifact.test.ts \
  apps/runtime/test/research-control-campaign.test.ts
git commit -m "feat: emit generated decisions before tick acknowledgement"
```

### Task 4: Precommitted Qualified Adaptive-Effect Study

**Files:**
- Modify: `apps/runtime/test/helpers/research-control-study-prospective.ts`
- Modify: `apps/runtime/test/research-control-study-prospective.integration.test.ts`

**Interfaces:**
- Consumes: real generated artifacts, fixture source candidate, LocalStore baseline copies, matched
  paper source windows, and `ResearchControlStudyOutcome` exact sign-test policy.
- Produces: six non-tied replications with qualified source verdicts and no policy mutation.

- [ ] **Step 1: Write the pre-effect baseline and falling-path expectations**

Before committing the study, run one explicit baseline arena tick selecting:

```ts
["trend_following", "volatility_regime", "funding_aware_risk"]
```

This frozen history makes the adaptive arm select untried `mean_reversion` first while static
control still selects `trend_following` first. Extend `prospectiveMarketData` with an optional
deterministic `priceAt(observedAt)` callback and configure a strictly falling positive price path.

Assert before starting effects that the committed study and every replication point to the exact
same post-history baseline digest, and that adaptive/static candidate directions are mean reversion
and trend following.

- [ ] **Step 2: Change the study assertions before implementation and verify RED**

Require all 12 source verdicts to remain pair-qualified. Require adaptive slots to be
`qualified_improvement`, static slots to be `source_not_improved`, and require each sequence-2
checkpoint transaction to consume at least one event per side with distinct role-bound delivery
refs. Require:

```ts
{
  adaptive_positive_count: 6,
  static_positive_count: 0,
  tied_count: 0,
  non_tied_count: 6,
  mean_rate_difference: 1,
  exact_sign_test_p_value: 0.03125,
  inference_status: "adaptive_effect_supported",
  policy_decision_eligibility: "eligible_for_separate_policy_decision",
  next_action: "review_research_allocation_policy"
}
```

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-prospective.integration.test.ts
```

Expected: RED because post-activation decisions or adaptive/static direction divergence are not yet
reflected in source verdicts.

- [ ] **Step 3: Make only evidence-fixture adjustments required by the frozen study**

Keep comparison thresholds, request caps, two observations, six replications, promotion state, and
authority flags unchanged. Adjust only the pre-effect explicit history and deterministic public
price path needed to instantiate the committed condition. Do not alter verdict or study statistics
logic to obtain the expected result.

- [ ] **Step 4: Verify effect-free restart and causal boundaries**

Require rerunning the completed study to create no provider or sandbox effects, no new campaign,
outcome, allocation policy decision, promotion, or source-store mutation. Assert candidate artifact
logs never contain peer candidate IDs, peer decisions, private fields, or live authority.

- [ ] **Step 5: Verify and commit Task 4**

Run the integration test twice consecutively. Expected: both runs pass with identical classifications
and all providers/sandboxes closed. Commit:

```bash
git add apps/runtime/test/helpers/research-control-study-prospective.ts \
  apps/runtime/test/research-control-study-prospective.integration.test.ts
git commit -m "test: prove qualified adaptive research effect"
```

### Task 5: Canonical Writeback And Full Verification

**Files:**
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/superpowers/specs/2026-07-12-candidate-arena-research-evidence-program-design.md`
- Modify: `docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md`
- Modify: `docs/superpowers/specs/2026-07-13-post-activation-trading-system-decision-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-post-activation-trading-system-decision.md`

**Interfaces:**
- Consumes: exact test and runtime evidence from Tasks 1-4.
- Produces: durable repository truth that separates mechanism proof, same-condition causal effect,
  policy eligibility, profitability, and generalization claims.

- [ ] **Step 1: Write back only observed claims**

Document delivery-bound decision causality, exact study condition, direction divergence, verdict
counts, qualification reasons, sign-test result, and effect-free replay. State explicitly that
policy eligibility is not policy replacement, paper evidence is not live authority, and one frozen
condition does not establish profitability or condition generalization.

- [ ] **Step 2: Mark this plan from observed execution state**

Check each completed step only after its command passed. Record any reroute in the matching task;
do not rewrite expected evidence after seeing results without a new precommitted study condition.

- [ ] **Step 3: Run focused regression**

```bash
npx vitest run \
  packages/application/src/trading/paper/events.test.ts \
  packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts \
  packages/application/src/trading/paper/session-service.test.ts \
  packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts \
  apps/runtime/test/clock-artifact.test.ts \
  apps/runtime/test/generated-trading-system-artifact.test.ts \
  apps/runtime/test/research-control-study-prospective.integration.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 4: Run repository validation**

```bash
npm run typecheck
npm run check:repo-guards
npm test
git diff --check
```

Expected: all workspaces typecheck, guards pass, and the complete Vitest suite passes.

- [ ] **Step 5: Commit writeback and inspect branch state**

```bash
git add docs/candidate-arena-evaluation-protocol.md \
  docs/superpowers/specs/2026-07-12-candidate-arena-research-evidence-program-design.md \
  docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md \
  docs/superpowers/specs/2026-07-13-post-activation-trading-system-decision-design.md \
  docs/superpowers/plans/2026-07-13-post-activation-trading-system-decision.md
git commit -m "docs: record qualified adaptive research evidence"
git status --short
git log --oneline --decorate -12
```

Expected: the only untracked path is user-owned `.superpowers/`; all task changes are committed.
