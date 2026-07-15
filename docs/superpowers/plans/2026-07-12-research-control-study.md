# ResearchControlStudy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Precommit 6 to 30 exact ResearchControlCampaign replications and adjudicate every terminal
outcome with one deterministic paired exact-sign inference rule.

**Architecture:** Domain records own immutable study and aggregate outcome contracts. Application
decisions derive IDs, condition digests, campaign guards, and exact statistics without effects.
LocalStore independently enforces pre-effect ordering, planned campaign identity, append-only
graphs, and terminal outcome persistence.

**Tech Stack:** TypeScript, Vitest, Node `crypto` and `util`, existing canonical digest helpers,
application StorePort, LocalStore JSON collections.

## Global Constraints

- A study must commit before every planned campaign.
- Version 1 uses one exact `same_frozen_snapshot` baseline digest.
- Replication count is an integer from 6 through 30.
- Every planned campaign ID is deterministic from a unique idempotency key.
- Every campaign must match the exact source, agent, comparator, paper protocol, allocation policy,
  and campaign policy committed by the study.
- Every planned campaign outcome enters the aggregate exactly once; there is no early stopping.
- The test is two-sided exact sign at alpha 0.05; ties are excluded from the sign test and included
  in the mean.
- Supported adaptive effect grants only separate research-policy decision eligibility.
- No candidate promotion, order submission, private data, credential, or live authority is added.
- `.superpowers/` remains untracked and untouched.
- Git commits remain pending while approved escalation is unavailable.

---

### Task 1: Strict Study Domain Contract

**Files:**
- Modify: `packages/domain/src/index.ts`
- Add: `packages/domain/src/research-control-study.test.ts`

**Interfaces:**
- Consumes: existing ResearchControlCampaign source, agent, comparator, protocol, allocation, and
  policy types.
- Produces: `ResearchControlStudyCondition`, `ResearchControlStudyReplication`,
  `ResearchControlStudyAnalysisPolicy`, `ResearchControlStudyRecord`, digest input, and strict
  runtime-shape validation.

- [x] **Step 1: Write failing exact-shape tests**

Cover one six-replication record, exact keys, contiguous indices, deterministic ref kinds, one
baseline digest, unique keys/IDs, fixed analysis policy, strict SHA-256 digests, and all closed
authority fields. Reject 5 and 31 replications, duplicate IDs, mixed baselines, alpha drift, a
non-trading comparator, unavailable paper protocol, condition digest drift, study digest drift,
extra keys, and widened authority.

- [x] **Step 2: Verify RED**

```bash
npx vitest run packages/domain/src/research-control-study.test.ts
```

Expected: missing study exports.

- [x] **Step 3: Implement the domain record**

Add the exact design types, `researchControlStudyConditionDigestInput`,
`researchControlStudyDigestInput`, and `researchControlStudyHasRuntimeShape`. Include the study in
`FixtureRecord`. Export canonical digest inputs so application and LocalStore can independently
recompute both digests; runtime shape enforces:

```ts
replications.length >= 6 && replications.length <= 30
replications.every((entry, index) => entry.replication_index === index + 1)
replications.every((entry) =>
  entry.expected_baseline_snapshot_digest === baseline_snapshot_digest
)
```

- [x] **Step 4: Verify Task 1**

```bash
npx vitest run packages/domain/src/research-control-study.test.ts
npm run typecheck --workspace @ouroboros/domain
```

---

### Task 2: Deterministic Study Commitment

**Files:**
- Modify: `packages/application/src/candidate/research-control-campaign.ts`
- Add: `packages/application/src/candidate/research-control-study.ts`
- Add: `packages/application/src/candidate/research-control-study.test.ts`
- Modify: `packages/application/src/index.ts`
- Modify: `packages/application/src/ports/store.ts`

**Interfaces:**
- Consumes: one explicit study condition, baseline digest, replication idempotency keys, and StorePort.
- Produces: exported `researchControlCampaignId`, `decideResearchControlStudy`,
  `researchControlStudyId`, `researchControlStudyConditionFromCampaign`, and idempotent
  `ResearchControlStudyService.commit`.

- [x] **Step 1: Write failing decision tests**

Assert each replication campaign ref equals:

```ts
{
  record_kind: "research_control_campaign",
  id: researchControlCampaignId(replicationKey)
}
```

Prove deterministic identity, frozen condition clone, exact baseline, fixed analysis policy,
pre-effect clock, and byte-equivalent replay. Reject duplicate keys, caller-supplied campaign ID,
malformed condition, and changed replay input.

- [x] **Step 2: Export deterministic campaign identity**

Change the existing private helper to:

```ts
export function researchControlCampaignId(idempotencyKey: string): string;
```

Preserve existing output exactly.

- [x] **Step 3: Implement pure decision and service**

The service first derives the requested record. Existing exact study replays; same-ID drift throws
`research_control_study_conflict`. New commit calls
`recordResearchControlStudy`, reloads by ID, and requires deep equality.

- [x] **Step 4: Verify Task 2**

```bash
npx vitest run packages/application/src/candidate/research-control-study.test.ts packages/application/src/candidate/research-control-campaign.test.ts
npm run typecheck --workspace @ouroboros/application
```

---

### Task 3: LocalStore Precommit And Planned-Campaign Guard

**Files:**
- Modify: `packages/local-store/src/index.ts`
- Add: `packages/local-store/test/research-control-study.test.ts`

**Interfaces:**
- Consumes: Task 1 record shape/digests and Task 2 campaign condition projection.
- Produces: study record/get/list persistence and a write-time guard on planned campaigns.

- [x] **Step 1: Write failing persistence tests**

Prove append/reload/list ordering, same-ID replay, conflict, malformed file rejection, and rejection
when any planned campaign already exists before study commit.

- [x] **Step 2: Implement the study collection**

Add `research-control-studies` with:

```ts
recordResearchControlStudy(
  study: ResearchControlStudyRecord
): Promise<ResearchControlStudyRecord>;
getResearchControlStudy(id: string): Promise<ResearchControlStudyRecord | undefined>;
listResearchControlStudies(): Promise<ResearchControlStudyRecord[]>;
```

Validate domain shape/digest and deterministic campaign IDs independently before append.

- [x] **Step 3: Write failing planned-campaign tests**

After study commit, accept each exact planned campaign only when:

```text
campaign.committed_at > study.committed_at
campaign.baseline.snapshot_digest == study.baseline_snapshot_digest
campaign condition == study.condition
campaign.idempotency_key == replication campaign_idempotency_key
```

Reject baseline, source, agent, comparator, paper protocol, allocation policy, campaign policy,
idempotency, and timestamp drift before campaign persistence.

- [x] **Step 4: Implement the campaign write guard**

Before `recordResearchControlCampaign` appends, find at most one study replication owning the
campaign ID. Multiple owners are store corruption and fail closed. For one owner, independently
recompute the campaign condition digest and enforce the exact replication graph.

- [x] **Step 5: Verify Task 3**

```bash
npx vitest run packages/local-store/test/research-control-study.test.ts packages/local-store/test/research-control-campaign.test.ts
npm run typecheck --workspace @ouroboros/local-store
```

---

### Task 4: Exact Study Outcome And Inference

**Files:**
- Modify: `packages/domain/src/index.ts`
- Add: `packages/domain/src/research-control-study-outcome.test.ts`
- Add: `packages/application/src/candidate/research-control-study-outcome.ts`
- Add: `packages/application/src/candidate/research-control-study-outcome.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**
- Consumes: one exact study and an ordered campaign plus terminal outcome closure for every
  replication.
- Produces: `ResearchControlStudyOutcomeRecord`, strict digest/runtime shape,
  `exactTwoSidedSignTestPValue`, `decideResearchControlStudyOutcome`, and idempotent outcome service.

- [x] **Step 1: Write failing domain outcome tests**

Cover exact keys, six results, count conservation, rounded mean/p-value, inference mapping, next
action, digest drift, arithmetic drift, reordered/duplicate results, extra fields, and widened
authority.

- [x] **Step 2: Implement outcome types and strict validation**

Add the exact design outcome interface, `researchControlStudyOutcomeDigestInput`, and
`researchControlStudyOutcomeHasRuntimeShape`. Include it in `FixtureRecord`.

- [x] **Step 3: Write failing inference table tests**

Required rows:

```text
6 positive, 0 negative, 0 ties -> p 0.03125, adaptive_effect_supported
5 positive, 0 negative, 1 tie  -> p 0.0625, insufficient_non_tied_replications
6 positive, 1 negative         -> p 0.125, adaptive_effect_not_supported
0 positive, 6 negative         -> p 0.03125, adaptive_effect_not_supported
0 positive, 0 negative, 6 ties -> p 1, insufficient_non_tied_replications
```

Also reject missing/extra campaign, pre-study campaign time, condition mismatch, baseline drift,
outcome campaign ref/digest mismatch, and outcome metric drift.

- [x] **Step 4: Implement exact inference**

Compute binomial coefficients with bounded integer arithmetic for n <= 30. Round persisted rates to
six decimals. Derive all classifications; accept no caller-supplied count, p-value, or inference.
Service replay requires exact study/outcome identity.

- [x] **Step 5: Verify Task 4**

```bash
npx vitest run packages/domain/src/research-control-study-outcome.test.ts packages/application/src/candidate/research-control-study-outcome.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
```

---

### Task 5: Study Outcome Persistence

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/research-control-study.test.ts`

**Interfaces:**
- Consumes: Task 4 terminal outcome.
- Produces: outcome record/get/list persistence with independent source-graph validation.

- [x] **Step 1: Write failing Store tests**

Prove exact append/reload, deterministic list order, replay, conflict, missing study, missing planned
campaign/outcome, result substitution, count/p-value drift, and malformed file rejection.

- [x] **Step 2: Add StorePort methods**

```ts
recordResearchControlStudyOutcome(
  outcome: ResearchControlStudyOutcomeRecord
): Promise<ResearchControlStudyOutcomeRecord>;
getResearchControlStudyOutcome(
  id: string
): Promise<ResearchControlStudyOutcomeRecord | undefined>;
listResearchControlStudyOutcomes(): Promise<ResearchControlStudyOutcomeRecord[]>;
```

- [x] **Step 3: Implement independent LocalStore validation**

Reload the study, each planned campaign, and each exact campaign outcome. Recompute condition,
baseline, ordered result, statistics, inference, digest, and authority before append. Never accept
raw paper or research diagnostic input.

- [x] **Step 4: Verify Task 5**

```bash
npx vitest run packages/local-store/test/research-control-study.test.ts packages/application/src/candidate/research-control-study-outcome.test.ts
npm run typecheck --workspace @ouroboros/local-store
```

---

### Task 6: Durable Truth And Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `docs/autonomy-model.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/superpowers/specs/2026-07-12-research-control-study-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-research-control-study.md`

**Interfaces:**
- Consumes: verified study and outcome evidence.
- Produces: canonical current-state docs and exact validation record.

- [x] **Step 1: Update canonical docs**

Document same-baseline causal scope, exact planned sample, no early stopping, external paper outcome,
separate policy-decision eligibility, and remaining distinct-regime/factorial-study boundary.

- [x] **Step 2: Run focused and required checks**

```bash
npx vitest run packages/domain/src/research-control-study*.test.ts packages/application/src/candidate/research-control-study*.test.ts packages/local-store/test/research-control-study.test.ts
npm run typecheck --workspaces --if-present
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
npm test
```

Record listener `EPERM` separately if the command sandbox again denies local ports or `tsx` IPC.

- [x] **Step 3: Record frontier decision**

The internal study execution/supervision boundary is now implemented in the follow-on supervisor
plan. Follow-on frontiers now implement one-shot process discovery and a separate allocation-policy
decision. The next boundary is listener-capable prospective evidence, then distinct-regime and
memory/agent factorial studies. TradingPromotion remains unrelated.

- [ ] **Step 4: Commit when escalation is available**

Stage only explicit repository paths from this plan and its design. Never stage `.superpowers/`.
If escalation remains quota-blocked, preserve the verified diff and record that single blocker.

## Verification Evidence

- Study domain, application, and LocalStore focus: 5 files and 74 tests passed. LocalStore study
  focus passed 15 tests, including ordering, replay, conflict, substitution, corruption, missing
  graph, and temporal-graph rejection.
- Full ResearchControlCampaign regression focus: 23 files and 385 tests passed.
- Every workspace typecheck and the Operator Desktop Rust check passed. Docs, architecture, naming,
  tracked-env, secret, and diff guards passed.
- The latest full repository run completed with 153 of 163 files and 2,555 of 2,619 tests passing. The same
  64 listener-dependent tests failed because the command sandbox denied local TCP, Unix-socket, or
  `tsx` IPC listeners with `EPERM`; no study test failed.
- Commit remains blocked by the approved escalation quota until 2026-07-18 15:20 KST.
