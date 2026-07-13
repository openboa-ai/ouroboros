# ResearchControlCampaign Paper Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Precommit a fair paper evaluation protocol, reserve every report slot before paper
effects, record all source/confirmation terminal paths, and make the campaign outcome consume those
exact slot outcomes.

**Architecture:** Domain records define the immutable protocol, schedule, and arm-local slot outcome.
Application decisions derive deterministic IDs and classifications without effects. LocalStore
independently verifies every digest and source graph. The existing campaign outcome becomes a
coordinator aggregate over exact schedule-owned slot outcomes. Runtime paper execution is a
separate follow-on plan.

**Tech Stack:** TypeScript, Vitest, Node `crypto`, existing domain canonical digest helpers,
application ports/services, LocalStore JSON collections.

## Global Constraints

- Paper protocol is bound before either research arm effect.
- Schedule is bound after the exact research report and before any paper preparation or runtime
  effect.
- Comparison mode is exactly `champion_challenge`.
- Source retries after a terminal verdict are forbidden.
- Every report slot remains in the denominator.
- Existing comparison, confirmation, qualification, verdict, and release algorithms are reused,
  not weakened.
- No public command, automatic promotion, private access, or live order authority is added.
- `.superpowers/` remains untracked and untouched.

---

### Task 1: Pre-Effect Paper Evaluation Protocol

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/research-control-campaign.test.ts`
- Modify: `packages/application/src/candidate/research-control-campaign.ts`
- Modify: `packages/application/src/candidate/research-control-campaign.test.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/research-control-campaign.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign.ts`
- Modify: `apps/runtime/test/research-control-campaign.test.ts`

**Interfaces:**
- Consumes: `PaperTradingComparisonPolicy`, `PaperTradingEvaluationPolicyIdentity`,
  `ResearchControlCampaignPaperComparator`.
- Produces: `ResearchControlCampaignPaperEvaluationProtocol` and a required
  `paper_evaluation_protocol` field on `ResearchControlCampaignRecord`.

- [x] **Step 1: Write failing domain tests**

Add cases that accept only these two relationships:

```ts
expect(validCampaign.paper_evaluation_protocol).toMatchObject({
  protocol_status: "bound",
  comparison_policy: { comparison_mode: "champion_challenge" },
  schedule_policy: {
    policy_version: "research-control-paper-schedule-v1",
    source_start_order: "paired_by_sequence",
    maximum_active_source_pairs: 2,
    source_missed_start_policy: "slot_expired"
  }
});

expect(unavailableCampaign).toMatchObject({
  paper_comparator: { comparator_status: "unavailable" },
  paper_evaluation_protocol: {
    protocol_status: "unavailable",
    reason: "no_trading_promotion_at_commitment"
  }
});
```

Reject bound protocol with unavailable comparator, bootstrap mode, digest drift, skew above policy,
or a confirmation deadline different from `maximum_elapsed_ms`.

- [x] **Step 2: Verify RED**

Run:

```bash
npm test -- --run packages/domain/src/research-control-campaign.test.ts
```

Expected: failures because the protocol type and runtime-shape validation do not exist.

- [x] **Step 3: Implement domain protocol and digest binding**

Add the exact union from the design. Include `paper_evaluation_protocol` in campaign exact keys and
`researchControlCampaignDigestInput`. Enforce comparator/protocol relationship in
`researchControlCampaignHasRuntimeShape`.

- [x] **Step 4: Add application decision input**

Require `paperEvaluationProtocol` in `ResearchControlCampaignDecisionInput`. Clone it into the
record, recompute `protocol_digest` from all bound fields, and reject caller-provided digest drift.
The runtime maps unavailable comparator to unavailable protocol only when no bound configuration is
provided; a Trading review comparator requires explicit bound configuration.

- [x] **Step 5: Add LocalStore and runtime parity tests**

Prove LocalStore rejects protocol/comparator mismatch and protocol digest drift. Prove runtime
commits the exact supplied bound protocol before arm tick calls and cannot change it on resume.

- [x] **Step 6: Verify; commit pending escalation quota recovery**

```bash
npm test -- --run packages/domain/src/research-control-campaign.test.ts packages/application/src/candidate/research-control-campaign.test.ts packages/local-store/test/research-control-campaign.test.ts apps/runtime/test/research-control-campaign.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/runtime
git add packages/domain/src/index.ts packages/domain/src/research-control-campaign.test.ts packages/application/src/candidate/research-control-campaign.ts packages/application/src/candidate/research-control-campaign.test.ts packages/local-store/src/index.ts packages/local-store/test/research-control-campaign.test.ts apps/runtime/src/candidate/arena/research-control-campaign.ts apps/runtime/test/research-control-campaign.test.ts
git commit -m "feat: bind research campaign paper protocol"
```

Expected: focused tests and four typechecks pass. If Git escalation remains quota-blocked, preserve
the verified files and record the commit as pending rather than bypassing approval.

Evidence on 2026-07-12: 146 focused tests passed; application, LocalStore, and runtime typechecks
passed after the outcome adjudicator was also proven to reject shared post-effect policy drift.
The domain typecheck passed during protocol implementation. Commit remains pending because the
approved git escalation quota is unavailable until 2026-07-18 15:20 KST.

---

### Task 2: Deterministic Paper Schedule Decision

**Files:**
- Modify: `packages/domain/src/index.ts`
- Add: `packages/domain/src/research-control-campaign-paper-schedule.test.ts`
- Add: `packages/application/src/candidate/research-control-campaign-paper-schedule.ts`
- Add: `packages/application/src/candidate/research-control-campaign-paper-schedule.test.ts`
- Modify: `packages/application/src/index.ts`
- Modify: `packages/application/src/ports/store.ts`

**Interfaces:**
- Consumes: exact `ResearchControlCampaignRecord`, `ResearchControlCampaignReportRecord`, and
  `paperTradingComparisonIdsForIdempotencyKey`.
- Produces: `ResearchControlCampaignPaperScheduleRecord`,
  `decideResearchControlCampaignPaperSchedule`, and
  `ResearchControlCampaignPaperScheduleService.commit`.

- [x] **Step 1: Write failing domain schedule tests**

Cover exact arm order, equal slot count, contiguous sequence, report tick identity, candidate/no-
candidate variants, strict SHA-256 digests, source ID uniqueness, schedule authority closure, and
rejection of extra fields.

- [x] **Step 2: Verify RED**

```bash
npm test -- --run packages/domain/src/research-control-campaign-paper-schedule.test.ts
```

Expected: missing exports.

- [x] **Step 3: Implement domain schedule contract**

Add the design types, `researchControlCampaignPaperScheduleDigestInput`, and strict runtime-shape
validation. Add the schedule record to `FixtureRecord`.

- [x] **Step 4: Write failing application schedule tests**

Test deterministic IDs:

```ts
const key = `research-control-paper:${campaignId}:adaptive:slot:1:source`;
expect(slot.source_comparison_idempotency_key).toBe(key);
expect({
  preparation_id: slot.source_preparation_id,
  comparison_commitment_id: slot.source_comparison_commitment_id
}).toEqual(paperTradingComparisonIdsForIdempotencyKey(key));
```

Reject unavailable protocol, report/campaign mismatch, report time before campaign, candidate
substitution, changed admission ref, and schedule clock before report completion.

- [x] **Step 5: Implement decision and idempotent service**

Build the schedule directly from report slots. Use `maximum_source_start_delay_ms` from the frozen
comparison `maximum_elapsed_ms`. Service replay reuses the original `committed_at` and rejects
changed campaign/report/protocol input.

- [x] **Step 6: Verify; commit pending escalation quota recovery**

```bash
npm test -- --run packages/domain/src/research-control-campaign-paper-schedule.test.ts packages/application/src/candidate/research-control-campaign-paper-schedule.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
git add packages/domain/src/index.ts packages/domain/src/research-control-campaign-paper-schedule.test.ts packages/application/src/candidate/research-control-campaign-paper-schedule.ts packages/application/src/candidate/research-control-campaign-paper-schedule.test.ts packages/application/src/index.ts packages/application/src/ports/store.ts
git commit -m "feat: precommit research paper schedule"
```

---

### Task 3: LocalStore Schedule Ownership

**Files:**
- Modify: `packages/local-store/src/index.ts`
- Add: `packages/local-store/test/research-control-campaign-paper-schedule.test.ts`

**Interfaces:**
- Consumes: schedule domain shape/digest and existing comparison identity derivation.
- Produces: record/get/list schedule methods and exact source-preparation ownership checks.

- [x] **Step 1: Write failing append/reload tests**

Cover missing campaign/report, digest drift, comparator/protocol mismatch, append conflict, file
corruption, and deterministic ordering.

- [x] **Step 2: Implement schedule collection**

Add `research-control-campaign-paper-schedules`. At write time reload campaign and report, validate
every slot against the report, and derive every source preparation/commitment ID independently with
Node `crypto` parity.

- [x] **Step 3: Write failing pair-ownership tests**

After copying an active schedule into an arm LocalStore, reject an arbitrary preparation for its
scheduled candidate pair and reject sequence 2 before sequence 1 has a terminal slot outcome.
Accept only the exact sequence-1 source preparation.

- [x] **Step 4: Implement active schedule guard**

Extend `reservePaperTradingComparisonPreparation` before TradingRun allocation. Existing
confirmation-campaign ownership remains higher priority once a source-improved slot enters
confirmation.

- [x] **Step 5: Verify; commit pending escalation quota recovery**

```bash
npm test -- --run packages/local-store/test/research-control-campaign-paper-schedule.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts
npm run typecheck --workspace @ouroboros/local-store
git add packages/local-store/src/index.ts packages/local-store/test/research-control-campaign-paper-schedule.test.ts
git commit -m "feat: enforce research paper schedule ownership"
```

---

### Task 4: Arm-Local Terminal Slot Outcomes

**Files:**
- Modify: `packages/domain/src/index.ts`
- Add: `packages/domain/src/research-control-campaign-paper-slot-outcome.test.ts`
- Add: `packages/application/src/candidate/research-control-campaign-paper-slot-outcome.ts`
- Add: `packages/application/src/candidate/research-control-campaign-paper-slot-outcome.test.ts`
- Modify: `packages/application/src/index.ts`
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Add: `packages/local-store/test/research-control-campaign-paper-slot-outcome.test.ts`

**Interfaces:**
- Consumes: one exact schedule candidate slot and source verdict or confirmation release closure.
- Produces: `ResearchControlCampaignPaperSlotOutcomeRecord` plus an idempotent recording service.

- [x] **Step 1: Write failing domain variant tests**

Cover `source_verdict`, `source_slot_expired`, `source_start_ineligible`,
`confirmation_precommit_expired`, and `confirmation_release`. Reject release/status mismatch,
free-form error reasons, missing start-batch ref/digest, duplicate tick refs, early expiry, and
widened authority.

- [x] **Step 2: Implement domain record**

The record binds schedule ref/digest, arm/sequence/tick, candidate closure, source IDs, exact terminal
evidence, `terminal_at`, digest, external evaluation authority, and all false downstream authority.

- [x] **Step 3: Write failing application graph tests**

Prove source `challenger_not_improved` maps only to `source_not_improved`, source
`comparison_ineligible` maps only to `evidence_ineligible`, and source `challenger_improved` cannot
close directly. Prove only an exact confirmation campaign/outcome/release closure can use the
confirmation variant.

- [x] **Step 4: Implement decision/service**

Use separate typed inputs for each variant. Never accept a caller-supplied terminal status without
deriving it from exact records. Replay is byte-equivalent; conflicting same-slot evidence fails.

- [x] **Step 5: Add LocalStore independent graph validation**

Reload schedule, comparison commitment/verdict or confirmation closure, first ticks, deadlines, and
current slot state. For expiry require the applicable deadline to have passed. For source-start
ineligibility require an exact ineligible start-batch ref/digest and its persisted first-tick
refs/digests. Write no outcome when the graph is incomplete.

- [x] **Step 6: Verify; commit pending escalation quota recovery**

```bash
npm test -- --run packages/domain/src/research-control-campaign-paper-slot-outcome.test.ts packages/application/src/candidate/research-control-campaign-paper-slot-outcome.test.ts packages/local-store/test/research-control-campaign-paper-slot-outcome.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/local-store
git add packages/domain/src/index.ts packages/domain/src/research-control-campaign-paper-slot-outcome.test.ts packages/application/src/candidate/research-control-campaign-paper-slot-outcome.ts packages/application/src/candidate/research-control-campaign-paper-slot-outcome.test.ts packages/application/src/index.ts packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/research-control-campaign-paper-slot-outcome.test.ts
git commit -m "feat: close research paper slots"
```

---

### Task 5: Campaign Outcome Over Exact Slot Outcomes

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/research-control-campaign-outcome.test.ts`
- Modify: `packages/application/src/candidate/research-control-campaign-outcome.ts`
- Modify: `packages/application/src/candidate/research-control-campaign-outcome.test.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/research-control-campaign.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign.ts`
- Modify: `apps/runtime/test/research-control-campaign-outcome.test.ts`

**Interfaces:**
- Consumes: exact campaign, report, schedule, and all terminal slot outcomes.
- Produces: revised `ResearchControlCampaignOutcomeRecord` with
  `source_not_improved_count` and slot-outcome refs/digests.

- [x] **Step 1: Write failing revised outcome tests**

Replace the assumption that every candidate has a ResearchRelease. Cover all six terminal statuses,
schedule mismatch, missing/extra slot outcomes, source retry substitution, count/rate conservation,
and exact replay.

- [x] **Step 2: Revise domain outcome shape**

Paper-bearing slot results store one `paper_slot_outcome_ref` and digest plus candidate closure and
derived terminal status. Confirmation refs remain inside the arm-local slot outcome. Add
`source_not_improved_count`; keep every-slot denominator and policy status rules.

- [x] **Step 3: Revise application adjudicator**

Validate campaign/report/schedule linkage and one exact terminal outcome per candidate slot. Derive
metrics only from validated slot outcomes. Keep `single_campaign_observation_only`,
`not_eligible`, and closed authority.

- [x] **Step 4: Revise Store and runtime collector**

Coordinator LocalStore validates exact schedule and outcome refs. Runtime collector loads slot
outcomes by schedule arm/sequence instead of scanning only confirmation releases. Existing terminal
coordinator outcome replay still opens no arm stores.

- [x] **Step 5: Verify; commit pending escalation quota recovery**

```bash
npm test -- --run packages/domain/src/research-control-campaign-outcome.test.ts packages/application/src/candidate/research-control-campaign-outcome.test.ts packages/local-store/test/research-control-campaign.test.ts apps/runtime/test/research-control-campaign-outcome.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/runtime
git add packages/domain/src/index.ts packages/domain/src/research-control-campaign-outcome.test.ts packages/application/src/candidate/research-control-campaign-outcome.ts packages/application/src/candidate/research-control-campaign-outcome.test.ts packages/local-store/src/index.ts packages/local-store/test/research-control-campaign.test.ts apps/runtime/src/candidate/arena/research-control-campaign.ts apps/runtime/test/research-control-campaign-outcome.test.ts
git commit -m "feat: adjudicate scheduled research paper slots"
```

---

### Task 6: Phase-One Verification And Runtime Handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-research-control-campaign-paper-schedule-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-research-control-campaign-paper-protocol.md`
- Add: `docs/superpowers/plans/2026-07-12-research-control-campaign-paper-executor.md`
- Update canonical root/docs surfaces named by the design.

**Interfaces:**
- Consumes: verified phase-one protocol/schedule/slot-outcome contract.
- Produces: durable evidence and a separate runtime executor plan using existing paper services.

- [ ] **Step 1: Run all required checks**

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

Expected: all workspace typechecks, guards, and the full suite pass. Run the full suite with approved
loopback permission when sandbox listeners receive `EPERM`.

- [ ] **Step 2: Record exact evidence and remaining boundary**

Mark this plan complete only after recording exact focused/full counts. State clearly that phase one
precommits and validates paper work but does not yet drive market/session effects.

- [x] **Step 3: Write the runtime executor plan**

The next plan must compose `PaperTradingComparisonCoordinator`, first-tick batching, activation,
window driver/runner, qualification, verdict, confirmation, release, and slot-outcome services. It
must include restart recovery and paired-sequence fairness tests.

- [ ] **Step 4: Commit durable truth**

```bash
git add docs/superpowers/specs/2026-07-12-research-control-campaign-paper-schedule-design.md docs/superpowers/plans/2026-07-12-research-control-campaign-paper-protocol.md docs/superpowers/plans/2026-07-12-research-control-campaign-paper-executor.md AGENTS.md ARCHITECTURE.md README.md docs
git commit -m "docs: record research paper protocol"
```

If escalation remains quota-blocked, leave the exact staged scope uncommitted and report the single
external blocker without retrying through an unsafe path.
