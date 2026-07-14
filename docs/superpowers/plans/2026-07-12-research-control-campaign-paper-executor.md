# ResearchControlCampaign Paper Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive every bound research-control paper schedule through restart-safe matched source
comparisons, confirmation, ResearchRelease, slot outcomes, and final campaign adjudication.

**Architecture:** Arm stores retain candidate and paper-runtime ownership. A coordinator-owned
`ResearchControlCampaignPaperStartBatch` seals cross-arm shared-snapshot evidence without copying
peer TradingRuns. A bounded step executor derives every action from append-only records and composes
the existing paper comparison services.

**Tech Stack:** TypeScript, Vitest, Node `crypto`, existing Ouroboros domain digest helpers,
application paper services, LocalStore, `GatewayMarketDataPort`.

## Global Constraints

- Use the exact campaign-bound `champion_challenge` policy and paper identity.
- Prepare every candidate-bearing arm in a sequence before market or runtime effects.
- Read one public market snapshot and one public execution snapshot for every matched source tick.
- Never retry a terminal source verdict or select retries from profitability.
- Only `challenger_improved` may enter confirmation, and precommit must meet the frozen deadline.
- One `advance` call performs at most one externally meaningful transition.
- Persisted records, not a process cursor, determine restart behavior.
- No TradingPromotion, private read, credential, live order, or public mutation authority is added.
- `.superpowers/` remains untracked and untouched.
- Git commits remain pending while the approved escalation quota is unavailable.

---

### Task 1: Cross-Arm Paper Start Batch Contract

**Files:**
- Modify: `packages/domain/src/index.ts`
- Add: `packages/domain/src/research-control-campaign-paper-start-batch.test.ts`
- Add: `packages/application/src/candidate/research-control-campaign-paper-start-batch.ts`
- Add: `packages/application/src/candidate/research-control-campaign-paper-start-batch.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Consumes: exact `ResearchControlCampaignPaperScheduleRecord`, candidate-bearing schedule slots,
  source `PaperTradingComparisonCommitmentRecord`s, and persisted sequence-1 ticks.
- Produces: `ResearchControlCampaignPaperStartBatchRecord`,
  `decideResearchControlCampaignPaperStartBatch`, and deterministic
  `researchControlCampaignPaperStartBatchId(schedule, sequence)`.

- [x] **Step 1: Write failing domain tests**

Cover exact keys, schedule ref/digest, contiguous arm order, candidate side count, optional tick
closure, shared snapshot digests, deadlines, strict status/reason mapping, digest drift, and closed
authority. The core paired-ready assertion is:

```ts
expect(batch).toMatchObject({
  record_kind: "research_control_campaign_paper_start_batch",
  sequence: 1,
  batch_status: "paired_ready",
  sides: [
    { arm_kind: "adaptive_treatment", first_tick_ref: { id: adaptiveTickId } },
    { arm_kind: "static_control", first_tick_ref: { id: staticTickId } }
  ],
  evaluation_authority: "external_to_trading_systems",
  promotion_authority: false,
  order_submission_authority: false,
  live_exchange_authority: false,
  authority_status: "not_live"
});
```

- [x] **Step 2: Verify RED**

Run:

```bash
npx vitest run packages/domain/src/research-control-campaign-paper-start-batch.test.ts
```

Expected: missing start-batch exports.

- [x] **Step 3: Implement the strict domain record**

Add these public types and include the record in `FixtureRecord`:

```ts
export type ResearchControlCampaignPaperStartBatchStatus =
  | "single_ready"
  | "paired_ready"
  | "ineligible";

export interface ResearchControlCampaignPaperStartBatchSide {
  arm_kind: ResearchControlCampaignArmKind;
  source_comparison_ref: Ref;
  source_comparison_digest: string;
  first_tick_ref?: Ref;
  first_tick_digest?: string;
  first_tick_observed_at?: string;
}

export interface ResearchControlCampaignPaperStartBatchRecord extends BaseRecord {
  record_kind: "research_control_campaign_paper_start_batch";
  research_control_campaign_paper_start_batch_id: string;
  schedule_ref: Ref;
  schedule_digest: string;
  sequence: number;
  batch_status: ResearchControlCampaignPaperStartBatchStatus;
  sides: ResearchControlCampaignPaperStartBatchSide[];
  source_start_deadline_at: string;
  shared_market_snapshot_digest?: string;
  shared_public_execution_snapshot_digest?: string;
  ineligible_reason?:
    | "first_tick_incomplete"
    | "cross_arm_first_tick_mismatch"
    | "source_start_deadline_missed";
  evaluated_at: string;
  start_batch_digest: string;
  evaluation_authority: "external_to_trading_systems";
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}
```

- [x] **Step 4: Write failing application decision tests**

Test `single_ready`, `paired_ready`, deadline-closed incomplete, immediate mismatch, candidate or
comparison substitution, non-first ticks, snapshot mismatch, skew overflow, early incomplete,
deterministic ID, and exact replay input.

- [x] **Step 5: Implement the pure decision**

Use this input boundary:

```ts
export interface DecideResearchControlCampaignPaperStartBatchInput {
  campaign: ResearchControlCampaignRecord;
  schedule: ResearchControlCampaignPaperScheduleRecord;
  sequence: number;
  sources: Array<{
    armKind: ResearchControlCampaignArmKind;
    comparison: PaperTradingComparisonCommitmentRecord;
    firstTick?: PaperTradingComparisonTickRecord;
  }>;
  sourceStartDeadlineAt: string;
  evaluatedAt: string;
}
```

Derive status, reasons, and skew from the campaign-bound protocol; do not accept caller-supplied
classification or fairness thresholds.

- [x] **Step 6: Verify and preserve the task**

```bash
npx vitest run packages/domain/src/research-control-campaign-paper-start-batch.test.ts packages/application/src/candidate/research-control-campaign-paper-start-batch.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
```

Expected: all focused tests and both typechecks pass.

---

### Task 2: Start Batch Persistence And Cross-Store Witness

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/research-control-campaign.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/research-control-campaign-paper-slot-outcome.test.ts`
- Modify: `packages/application/src/candidate/research-control-campaign-paper-slot-outcome.test.ts`
- Modify: `packages/application/src/candidate/research-control-campaign-paper-slot-outcome.ts`

**Interfaces:**
- Consumes: Task 1 start batch and the existing schedule/slot outcome collections.
- Produces: record/get/list/replicate start-batch ports and slot outcomes that bind an exact
  start-batch ref/digest for paired ineligibility.

- [x] **Step 1: Write failing LocalStore append and replication tests**

Prove coordinator append/reload, deterministic ordering, schedule mismatch rejection, digest drift,
same-ID conflict, and arm replication with exact local comparison/tick readback. Prove peer graph is
not fabricated in the arm store.

- [x] **Step 2: Add store ports**

```ts
recordResearchControlCampaignPaperStartBatch(
  batch: ResearchControlCampaignPaperStartBatchRecord
): Promise<ResearchControlCampaignPaperStartBatchRecord>;
replicateResearchControlCampaignPaperStartBatch(
  batch: ResearchControlCampaignPaperStartBatchRecord
): Promise<ResearchControlCampaignPaperStartBatchRecord>;
getResearchControlCampaignPaperStartBatch(
  batchId: string
): Promise<ResearchControlCampaignPaperStartBatchRecord | undefined>;
listResearchControlCampaignPaperStartBatches(
  scheduleId?: string
): Promise<ResearchControlCampaignPaperStartBatchRecord[]>;
```

- [x] **Step 3: Implement LocalStore persistence**

Coordinator recording validates shape, digest, schedule, sequence, and append identity. Arm
replication additionally requires the local arm side's comparison and first tick, when present, to
match exact refs/digests. Neither path writes peer TradingRun or tick records.

- [x] **Step 4: Write failing paired terminal evidence tests**

Replace the uncommitted `paired_batch_ineligible` variant with `source_start_ineligible` and require:

```ts
start_batch_ref: {
  record_kind: "research_control_campaign_paper_start_batch";
  id: string;
};
start_batch_digest: string;
```

Reject missing batch, wrong sequence, ready batch, reason mismatch, tick list mismatch, and batch
digest drift.

- [x] **Step 5: Implement batch-backed slot validation**

LocalStore loads the exact start batch and verifies terminal evidence against its status/sides. It
no longer assumes both arm ticks physically exist in one arm store.

- [x] **Step 6: Verify and preserve the task**

```bash
npx vitest run packages/domain/src/research-control-campaign-paper-start-batch.test.ts packages/domain/src/research-control-campaign-paper-slot-outcome.test.ts packages/application/src/candidate/research-control-campaign-paper-slot-outcome.test.ts packages/local-store/test/research-control-campaign.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/local-store
```

---

### Task 3: Confirmation Precommit Deadline Closure

**Files:**
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/research-control-campaign.test.ts`

**Interfaces:**
- Consumes: active schedule ownership, improved source verdict, and confirmation campaign.
- Produces: write-time rejection of a late confirmation campaign and readback rejection of a late
  campaign-backed slot outcome.

- [x] **Step 1: Write failing deadline tests**

Create an exact schedule-owned improved source verdict. Accept confirmation committed at:

```ts
new Date(
  Date.parse(sourceVerdict.evaluated_at) + confirmationDeadlineMs
).toISOString()
```

Reject one millisecond later with
`research_control_campaign_confirmation_precommit_deadline_missed`. Also reject a manually injected
late campaign when recording a confirmation-release slot outcome.

- [x] **Step 2: Verify RED**

```bash
npx vitest run packages/local-store/test/research-control-campaign.test.ts
```

Expected: late confirmation currently records successfully.

- [x] **Step 3: Implement the active schedule deadline guard**

During `recordPaperTradingComparisonConfirmationCampaign`, find the unique schedule slot whose
`source_comparison_commitment_id` matches the campaign source. Reload campaign protocol and source
verdict, then require:

```ts
Date.parse(confirmation.committed_at) <=
  Date.parse(sourceVerdict.evaluated_at) +
    protocol.schedule_policy.confirmation_precommit_deadline_ms
```

Apply the same invariant in confirmation-release slot validation.

- [x] **Step 4: Verify and preserve the task**

```bash
npx vitest run packages/local-store/test/research-control-campaign.test.ts packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts
npm run typecheck --workspace @ouroboros/local-store
```

---

### Task 4: Arm Graph Installer And Pure Next-Action Projector

**Files:**
- Add: `apps/runtime/src/candidate/arena/research-control-campaign-paper-graph.ts`
- Add: `apps/runtime/test/research-control-campaign-paper-graph.test.ts`
- Add: `apps/runtime/src/candidate/arena/research-control-campaign-paper-next-action.ts`
- Add: `apps/runtime/test/research-control-campaign-paper-next-action.test.ts`

**Interfaces:**
- Consumes: coordinator campaign, both arm intents, report, schedule, batches, and arm stores.
- Produces: idempotent `installResearchControlCampaignPaperGraph` and pure
  `projectResearchControlCampaignPaperNextAction`.

- [x] **Step 1: Write failing installer tests**

Prove both arm stores receive both intents, report, and schedule, while each exact start batch is
replicated only to its candidate-bearing arms, before the injected effect callback can run. Reject
changed campaign, intent, report, schedule, and existing conflicts.

- [x] **Step 2: Implement the graph installer**

```ts
export async function installResearchControlCampaignPaperGraph(input: {
  coordinator: OuroborosStorePort;
  arms: Record<ResearchControlCampaignArmKind, OuroborosStorePort>;
  campaign: ResearchControlCampaignRecord;
  report: ResearchControlCampaignReportRecord;
  schedule: ResearchControlCampaignPaperScheduleRecord;
}): Promise<void>;
```

Use existing append-only record methods and exact readback checks.

- [x] **Step 3: Write projector table tests**

Use one fixture per stable action. Include all-no-candidate, unopened before/after deadline,
prepared, partial first tick, ready batch, activation, active window, terminal source verdict,
improved verdict before/after precommit deadline, confirmation slots, release, slot outcome, all
terminal, and conflicting evidence.

- [x] **Step 4: Implement the pure projector**

```ts
export type ResearchControlCampaignPaperNextAction =
  | { action: "wait_until"; sequence: number; wakeAt: string }
  | { action: "expire_unstarted_source_slot"; armKind: ResearchControlCampaignArmKind; sequence: number }
  | { action: "prepare_source_batch"; sequence: number }
  | { action: "capture_source_start_batch"; sequence: number }
  | { action: "authorize_source_batch"; sequence: number }
  | { action: "start_source_batch"; sequence: number }
  | { action: "advance_source_window"; sequence: number }
  | { action: "adjudicate_source_verdict"; armKind: ResearchControlCampaignArmKind; sequence: number }
  | { action: "precommit_confirmation"; armKind: ResearchControlCampaignArmKind; sequence: number }
  | { action: "expire_confirmation_precommit"; armKind: ResearchControlCampaignArmKind; sequence: number }
  | { action: "advance_confirmation"; armKind: ResearchControlCampaignArmKind; sequence: number }
  | { action: "record_slot_outcome"; armKind: ResearchControlCampaignArmKind; sequence: number }
  | { action: "collect_campaign_outcome" }
  | { action: "complete" };
```

- [x] **Step 5: Verify and preserve the task**

```bash
npx vitest run apps/runtime/test/research-control-campaign-paper-graph.test.ts apps/runtime/test/research-control-campaign-paper-next-action.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 5: Source Batch Preparation And Shared First Tick

**Files:**
- Add: `apps/runtime/src/candidate/arena/research-control-campaign-paper-source-batch.ts`
- Add: `apps/runtime/test/research-control-campaign-paper-source-batch.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign.ts`

**Interfaces:**
- Consumes: installed arm graphs, one `GatewayMarketDataPort`, arm-local
  `PaperTradingComparisonCoordinator`s, and Task 1 batch decision.
- Produces: exact source commitments, shared first ticks, and one replicated start batch.

- [x] **Step 1: Write failing no-effect-before-preparation tests**

With two candidate slots, assert both `prepare` calls finish before either market read. With one
preparation failure, assert zero market reads, activations, providers, and sandboxes.

- [x] **Step 2: Implement exact source input resolution**

Resolve champion admission through the exact TradingPromotion confirmation campaign and challenger
admission from the schedule slot:

```ts
{
  idempotencyKey: slot.source_comparison_idempotency_key,
  champion: {
    candidateId: schedule.paper_comparator.candidate_ref.id,
    candidateVersionId: schedule.paper_comparator.candidate_version_ref.id,
    admissionDecisionId: promotionCampaign.challenger
      .candidate_admission_decision_ref.id
  },
  challenger: {
    candidateId: slot.candidate_ref.id,
    candidateVersionId: slot.candidate_version_ref.id,
    admissionDecisionId: slot.admission_decision_ref.id
  },
  comparisonPolicy: campaign.paper_evaluation_protocol.comparison_policy,
  marketDataConfigurationDigest:
    campaign.paper_evaluation_protocol.market_data_configuration_digest,
  paperPolicyIdentity: campaign.paper_evaluation_protocol.paper_policy_identity
}
```

- [x] **Step 3: Write failing shared-snapshot and partial-write recovery tests**

Prove one market/execution read produces byte-identical first-tick summaries and one observed time.
Interrupt after one tick, restart with a market port that throws on read, and prove the missing peer
tick is reconstructed from the persisted first tick.

- [x] **Step 4: Implement shared first-tick capture**

Wrap the frozen snapshot in a read-only `GatewayMarketDataPort` preserving the exact configuration
identity. Call existing tick coordinators with deterministic keys:

```text
research-control-paper-start:<schedule-id>:<sequence>:<arm-kind>
```

Record the Task 1 start batch in the coordinator and replicate it only to candidate-bearing arms.

- [x] **Step 5: Write and implement deadline ineligibility tests**

After the applicable deadline, convert missing or late persisted first ticks into one
`ineligible` batch and exact zero-credit slot outcomes. Before the deadline return
`wait_until` and write nothing terminal.

- [ ] **Step 6: Verify and preserve the task**

Current sandbox evidence: the runtime source-batch and comparison-tick suites pass 22 tests, the
two schedule-owned comparison preparation tests pass, and runtime typecheck passes. The full
comparison coordinator file still has one real loopback-provider scenario closed as
`paper_trading_comparison_session_start_failed` under the command sandbox; no source-batch graph or
first-tick assertion fails.

```bash
npx vitest run apps/runtime/test/research-control-campaign-paper-source-batch.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/application/src/trading/paper/comparison-tick-coordinator.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 6: Matched Source Window And Source Verdict Closure

**Files:**
- Add: `apps/runtime/src/candidate/arena/research-control-campaign-paper-source-window.ts`
- Add: `apps/runtime/test/research-control-campaign-paper-source-window.test.ts`

**Interfaces:**
- Consumes: ready start batch, activation/runtime/checkpoint/window/qualification/verdict services.
- Produces: one bounded lockstep transition and terminal source verdicts.

- [x] **Step 1: Write failing symmetric activation tests**

Authorize both comparisons before runtime start. If one start fails, stop the survivor and preserve
durable activation outcomes from which later projected actions can adjudicate ineligible verdicts;
no session may remain running.

- [x] **Step 2: Implement activation and recovery**

Call `recoverIncompleteActivations` before new start. Start both ready source comparisons with
deterministic activation and runtime keys. Preserve the existing retry limit and require clean prior
cleanup.

- [x] **Step 3: Write failing lockstep window tests**

For each repeated tick prove one shared market/execution read, equal observed time, both checkpoint
transitions, and no next sequence until both verdicts exist. Inject one checkpoint failure and prove
peer cleanup.

- [x] **Step 4: Implement one lockstep transition per advance**

Use both window readers to require compatible phases. Shared transitions capture one snapshot and
then call both existing tick coordinators. Side-local transitions call both checkpoint coordinators.
Stopping calls both runtime activation coordinators before qualification/verdict.

- [x] **Step 5: Write and implement source terminal mapping**

```text
challenger_not_improved -> source_not_improved slot outcome
comparison_ineligible  -> evidence_ineligible slot outcome
challenger_improved    -> no slot outcome; confirmation next action
```

Prove a terminal verdict cannot create a second source comparison.

- [ ] **Step 6: Verify and preserve the task**

Current sandbox evidence: source-window, activation authorization, runtime activation recovery,
window state, and window driver suites pass 75 tests, and runtime typecheck passes. The same full
comparison coordinator loopback-provider limitation recorded in Task 5 remains outside this
networkless verification set.

```bash
npx vitest run apps/runtime/test/research-control-campaign-paper-source-window.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 7: Confirmation Execution And Terminal Release

**Files:**
- Add: `apps/runtime/src/candidate/arena/research-control-campaign-paper-confirmation.ts`
- Add: `apps/runtime/test/research-control-campaign-paper-confirmation.test.ts`

**Interfaces:**
- Consumes: improved source verdict and existing confirmation campaign/window/release services.
- Produces: on-time confirmation campaign, sequential terminal windows, ResearchRelease, and exact
  confirmation-release or precommit-expiry slot outcome.

- [x] **Step 1: Write failing precommit boundary tests**

Accept precommit at the exact deadline. At one millisecond late, write
`confirmation_precommit_expired` and prove no campaign/preparation/runtime effect is created.

- [x] **Step 2: Implement precommit or expiry**

Use the existing campaign service only before the frozen deadline. Record expiry through
`ResearchControlCampaignPaperSlotOutcomeService` after it.

- [x] **Step 3: Write failing sequential confirmation tests**

Prove only the current confirmation slot prepares, each window starts strictly after the prior
verdict, missed slots settle as expired, and restart replays exact campaign identities.

- [x] **Step 4: Implement bounded confirmation advancement**

Use `PaperTradingComparisonConfirmationWindowService.prepareNext`, ordinary first-tick/activation/
window services, qualification, and verdict. Execute one transition per call.

- [x] **Step 5: Write and implement release-to-slot mapping**

Settle the campaign, create one ResearchRelease, then map:

```text
confirmed_improvement           -> qualified_improvement
challenger_not_reproduced       -> not_reproduced
comparison_evidence_ineligible  -> evidence_ineligible
campaign_slot_expired           -> paper_slot_expired
```

Record exact campaign/outcome/release refs and digests in the slot outcome.

- [x] **Step 6: Verify and preserve the task**

```bash
npx vitest run apps/runtime/test/research-control-campaign-paper-confirmation.test.ts packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 8: Top-Level Step Executor, Runner, And Campaign Outcome

**Files:**
- Add: `apps/runtime/src/candidate/arena/research-control-campaign-paper-executor.ts`
- Add: `apps/runtime/src/candidate/arena/research-control-campaign-paper-runner.ts`
- Add: `apps/runtime/test/research-control-campaign-paper-executor.test.ts`
- Add: `apps/runtime/test/research-control-campaign-paper-soak.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign.ts`

**Interfaces:**
- Consumes: Tasks 4-7 and `collectResearchControlCampaignOutcome`.
- Produces: `ResearchControlCampaignPaperExecutor.advance`, optional process runner, and terminal
  `ResearchControlCampaignOutcome`.

- [x] **Step 1: Write failing end-to-end step tests**

Cover all-no-candidate, source loss, source ineligible, confirmed improvement, non-reproduction,
source expiry, confirmation expiry, paired start failure, and final outcome replication. Assert only
confirmed improvement receives discovery credit.

- [x] **Step 2: Implement the bounded executor**

```ts
export class ResearchControlCampaignPaperExecutor {
  advance(input: {
    campaignId: string;
  }): Promise<ResearchControlCampaignPaperExecutorStep>;
}
```

Load exact campaign/report/schedule, install graphs, recover runtime cleanup, project one action,
execute it, and return stable evidence. Never loop inside `advance` across external transitions.

- [x] **Step 3: Write failing runner timing tests**

Prove the runner uses `wakeAt`, does not busy-loop, interrupts scheduled waits on shutdown, stops on
terminal or stable failure, and drains active steps on shutdown.

- [x] **Step 4: Implement the runner**

Follow the existing `PaperTradingComparisonWindowRunner` status pattern with start/status/stop/drain
methods. Keep runner state non-authoritative.

- [x] **Step 5: Write crash-boundary and soak tests**

Interrupt after each durable boundary listed in the design. Run at least three schedule sequences
and assert uniqueness of TradingRuns, commitments, ticks, verdicts, campaigns, releases, slot
outcomes, and final outcome after repeated restarts.

- [x] **Step 6: Implement remaining restart readbacks and verify**

```bash
npx vitest run apps/runtime/test/research-control-campaign-paper-executor.test.ts apps/runtime/test/research-control-campaign-paper-soak.test.ts apps/runtime/test/research-control-campaign-outcome.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 9: Durable Truth And Full Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `docs/autonomy-model.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/superpowers/specs/2026-07-12-research-control-campaign-paper-schedule-design.md`
- Modify: `docs/superpowers/specs/2026-07-12-research-control-campaign-paper-executor-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-research-control-campaign-paper-protocol.md`
- Modify: `docs/superpowers/plans/2026-07-12-research-control-campaign-paper-executor.md`

**Interfaces:**
- Consumes: verified executor and soak evidence.
- Produces: canonical architecture/read-path truth and exact validation evidence.

- [x] **Step 1: Update canonical docs**

Document `ResearchControlCampaignPaperStartBatch`, bounded step execution, paired shared snapshots,
terminal mappings, restart recovery, and the handoff to the separately implemented replicated-study
inference boundary. Do not claim automatic TradingPromotion or long-term economic improvement.

- [x] **Step 2: Run focused and full checks**

```bash
npm run typecheck --workspaces --if-present
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
npm test
```

Expected: all workspace typechecks, repository guards, and the full suite pass. Use approved
loopback execution only if listener tests fail with sandbox `EPERM`.

- [x] **Step 3: Record evidence and frontier decision**

Write exact test counts and identify the next frontier as replicated control campaigns and causal
policy comparison, not TradingPromotion.

- [ ] **Step 4: Commit when escalation is available**

Stage only the explicit repository paths from this plan and the preceding paper-protocol plan.
Never stage `.superpowers/`. Use bounded commits by task; if the escalation quota is still blocked,
preserve the clean diff and record the blocker once without retrying through another path.

## Verification Evidence

Evidence collected on 2026-07-12 KST from this worktree:

- Paper protocol/executor focus: 18 files and 231 tests passed.
- Runner shutdown focus: 5 tests passed, including interrupting a scheduled wait while still
  draining an active executor step.
- All workspace TypeScript checks and the Operator Desktop Rust check passed.
- Docs, architecture, naming, tracked-env, secret, and diff guards passed.
- The latest full repository run completed with 153 of 163 files and 2,555 of 2,619 tests passing. The 64
  failures are blocked by the command sandbox denying local TCP, Unix-socket, or `tsx` IPC listeners
  with `EPERM`. The one indirect comparison-coordinator failure was isolated: its activation had
  already closed `stopped_cleanly` after the same loopback start denial, so checkpoint capture
  correctly failed closed on a non-running activation.
- No diagnostic patch remains in the comparison suite. The rejected external-execution escalation
  was not retried through another path.
- On 2026-07-13 KST, the same worktree was rerun in a listener-capable environment: all 169 test
  files and all 2,707 tests passed. This closes the environment-only verification blocker; it does
  not supply a prospective `ResearchControlStudy` outcome.

The bounded executor components and its internal composition factory are implemented and verified
without network listeners. The separate `ResearchControlStudy` contract now precommits replicated
same-baseline inference, and `createResearchControlStudyRuntime` can now execute its planned
campaigns sequentially through adjudication. Follow-on frontiers add one-shot process discovery and
a separate exact-digest allocation-policy decision, but no process has executed a complete
prospective study. That evidence remains next, followed by distinct-regime or
factorial studies. TradingPromotion remains outside that frontier.
