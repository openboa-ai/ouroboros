# Paper Trading Comparison Research Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release one exact terminal paper confirmation campaign into recoverable ResearchFinding,
ArtifactLineage, FindingCluster, and later ResearchWorker context without leaking unreleased
evidence or creating promotion/trading authority.

**Architecture:** Domain owns one append-only release bundle with embedded exact Finding and
Lineage. Application owns pure release classification and the service that resolves origin
provenance. LocalStore independently validates, persists, materializes, freezes, and recovers the
bundle. CandidateArena consumes only accepted release records and proves causal use with an
unreleased/released direction-order ablation.

**Tech Stack:** TypeScript, Vitest, `@ouroboros/domain`, `@ouroboros/application`, LocalStore JSON
records, existing confirmation campaign/outcome evidence, CandidateArena fixture agents.

**Design:**
`docs/superpowers/specs/2026-07-12-paper-trading-comparison-research-release-design.md`

## Global Constraints

- Raw campaign outcomes remain sealed until one accepted release record exists.
- Release never changes campaign, verdict, eligibility, champion, rank, or TradingPromotion state.
- Release classification counts every reserved slot and never treats ineligible/expired-only
  evidence as an economic loss.
- Finding provenance comes from the challenger's exact admission source Finding and original
  ArtifactLineage, not from the compared champion.
- One release bundle is append-only, exact-replayable, materialization-recoverable, paper-only, and
  `lineage_only`.
- CandidateArena context exposes aggregate Finding/Lineage memory under
  `not_promotion_authority`, never raw hidden score fields or promotion eligibility.
- No app/controller/public command, operator mutation, private exchange access, direct order, or
  live authority is added.

---

### Task 1: Define the release bundle contract

**Files:**
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/paper-trading-comparison-research-release.test.ts`

**Interfaces:**
- Produces: `PaperTradingComparisonResearchReleaseKind`
- Produces: `PaperTradingComparisonResearchReleaseRecord`
- Produces: `paperTradingComparisonResearchReleaseDigestInput`
- Produces: `paperTradingComparisonResearchReleaseHasRuntimeShape`
- Consumes: existing campaign/outcome, ResearchFinding, ArtifactLineage, and canonical persisted
  digest contracts

- [x] **Step 1: Write failing runtime-shape and digest tests**

Create a valid release with exact embedded records:

```ts
const release: PaperTradingComparisonResearchReleaseRecord = {
  record_kind: "paper_trading_comparison_research_release",
  version: 1,
  paper_trading_comparison_research_release_id:
    "campaign-outcome-001-research-release",
  campaign_ref: {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    id: "campaign-001"
  },
  campaign_digest: "sha256:campaign",
  campaign_outcome_ref: {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    id: "campaign-outcome-001"
  },
  campaign_outcome_digest: "sha256:outcome",
  candidate_ref: { record_kind: "trading_system_candidate", id: "challenger" },
  candidate_version_ref: { record_kind: "candidate_version", id: "challenger-v1" },
  system_code_ref: { record_kind: "system_code", id: "challenger-code" },
  system_code_artifact_digest: "sha256:challenger",
  source_finding_ref: { record_kind: "research_finding", id: "source-finding" },
  source_finding_record_digest: "sha256:source-finding",
  source_lineage_ref: { record_kind: "artifact_lineage", id: "source-lineage" },
  source_lineage_record_digest: "sha256:source-lineage",
  direction_kind: "mean_reversion",
  release_kind: "confirmed_improvement",
  finding,
  finding_record_digest: "sha256:finding",
  lineage,
  lineage_record_digest: "sha256:lineage",
  next_research_focus:
    "Preserve the confirmed artifact lineage and generate controlled variants under new prospective evidence.",
  released_at: "2026-07-12T04:00:01.000Z",
  release_digest: "sha256:release",
  research_visibility: "released_to_research",
  evaluation_authority: "external_to_trading_systems",
  promotion_authority: false,
  live_exchange_authority: false,
  order_submission_authority: false,
  authority_status: "lineage_only"
};
```

Assert the shape accepts all four release kinds and rejects wrong ref kinds, non-canonical IDs,
unsupported Finding mapping, mismatched child SystemCode, missing source/new finding refs in
Lineage, empty next focus, bad timestamps, changed embedded-record digests, non-released visibility,
promotion/private/live authority, and input containing `undefined`, sparse arrays, cycles, or
non-finite values.

- [x] **Step 2: Run the domain test and verify RED**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-research-release.test.ts
```

Expected: FAIL because the release exports do not exist.

- [x] **Step 3: Implement the exact domain record**

Add the types from the design. `paperTradingComparisonResearchReleaseDigestInput` removes only
record metadata, release ID, and `release_digest`, then delegates to
`paperTradingComparisonPersistedRecordDigestInput`. Runtime shape must require:

```ts
const findingKindByReleaseKind = {
  confirmed_improvement: "positive_result",
  challenger_not_reproduced: "negative_result",
  comparison_evidence_ineligible: "failure_analysis",
  campaign_slot_expired: "failure_analysis"
} as const;
```

It must also bind the embedded Finding ID and Lineage ID to deterministic release child IDs, require
the embedded Lineage child to equal `system_code_ref`, and require its source findings to contain
both `source_finding_ref` and the embedded Finding.

- [x] **Step 4: Run domain tests and typecheck**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-research-release.test.ts packages/domain/src/paper-trading-comparison-confirmation-campaign.test.ts
npm run typecheck --workspace @ouroboros/domain
```

- [x] **Step 5: Commit the release vocabulary**

```bash
git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-research-release.test.ts
git commit -m "feat: define paper comparison research release"
```

### Task 2: Implement pure release classification

**Files:**
- Create: `packages/application/src/trading/paper/comparison-research-release-decision.ts`
- Create: `packages/application/src/trading/paper/comparison-research-release-decision.test.ts`

**Interfaces:**
- Consumes: `PaperTradingComparisonConfirmationCampaignOutcomeRecord`
- Produces: `decidePaperTradingComparisonResearchRelease`
- Produces: release kind, Finding kind, deterministic summary, and next research focus

- [x] **Step 1: Write failing classification tests**

Use this exact result contract:

```ts
interface PaperTradingComparisonResearchReleaseDecision {
  release_kind: PaperTradingComparisonResearchReleaseKind;
  finding_kind: ResearchFindingKind;
  summary: string;
  next_research_focus: string;
}
```

Cover all-improved, any non-improved, ineligible-only, expired-only, non-improved plus ineligible,
ineligible plus expired, malformed counts, partial/reordered/duplicate slots, input mutation, and
deterministic replay. Summary must include improved, not-improved, ineligible, and expired counts.

- [x] **Step 2: Run and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-research-release-decision.test.ts
```

Expected: FAIL because the decision module does not exist.

- [x] **Step 3: Implement classification priority**

Implement the design priority exactly:

```ts
if (outcome.campaign_outcome === "confirmed_improvement") {
  return confirmedDecision(outcome);
}
if (outcome.not_improved_count > 0) return nonReproducedDecision(outcome);
if (outcome.ineligible_count > 0) return ineligibleDecision(outcome);
return expiredDecision(outcome);
```

Reject malformed runtime shape with
`invalid_paper_trading_comparison_research_release_decision_input`. Do not read Store state or infer
from promotion eligibility alone.

- [x] **Step 4: Run decision regressions and typecheck**

```bash
npx vitest run packages/application/src/trading/paper/comparison-research-release-decision.test.ts packages/application/src/trading/paper/comparison-confirmation-decision.test.ts
npm run typecheck --workspace @ouroboros/application
```

- [x] **Step 5: Commit the pure decision**

```bash
git add packages/application/src/trading/paper/comparison-research-release-decision.ts packages/application/src/trading/paper/comparison-research-release-decision.test.ts
git commit -m "feat: classify paper comparison research release"
```

### Task 3: Persist, freeze, materialize, and recover release bundles

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Adds: release record/get/list Store methods
- Adds: LocalStore release materialization recovery
- Changes: release-bound ResearchFinding and ArtifactLineage become append-only

- [x] **Step 1: Write failing LocalStore graph and recovery tests**

Seed one exact Arena-generated challenger origin graph plus terminal campaign outcome. Test:

```ts
recordPaperTradingComparisonResearchRelease(release)
getPaperTradingComparisonResearchRelease(releaseId)
listPaperTradingComparisonResearchReleases()
recoverPaperTradingComparisonResearchReleases()
```

Require exact persistence/replay/restart, materialized Finding and Lineage, release-before-materialize
crash recovery, one release per outcome, and no duplicate adaptive evidence. Reject missing or
drifted campaign/outcome, challenger identity drift, wrong admission/source Finding, missing or
post-admission source Lineage, candidate direction mismatch, wrong classification/count summary,
supporting-ref omissions/extras, parent mutation, timestamp reversal, digest drift, and any authority
escalation.

Also assert direct `recordResearchFinding` or `recordArtifactLineage` calls cannot change a
release-bound same-ID record, while exact replay remains accepted.

- [x] **Step 2: Run selected Store tests and verify RED**

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "comparison research release|release materialization|release-bound"
```

Expected: FAIL because release Store methods do not exist.

- [x] **Step 3: Add Store methods and collection**

Add to `OuroborosStorePort`:

```ts
recordPaperTradingComparisonResearchRelease(
  release: PaperTradingComparisonResearchReleaseRecord
): Promise<PaperTradingComparisonResearchReleaseRecord>;
getPaperTradingComparisonResearchRelease(
  releaseId: string
): Promise<PaperTradingComparisonResearchReleaseRecord | undefined>;
listPaperTradingComparisonResearchReleases(): Promise<
  PaperTradingComparisonResearchReleaseRecord[]
>;
```

Persist under `paper-trading-comparison-research-releases/items`. LocalStore independently derives
the deterministic release/finding/lineage IDs from outcome ID and recomputes every digest.

- [x] **Step 4: Implement graph validation and exact replay**

Under `withComparisonEvidenceWriteTransaction`, load campaign, outcome, challenger admission,
source Finding, origin Lineage, candidate, CandidateVersion, and SystemCode. Recompute the pure
classification locally rather than importing application code. Require the candidate's full-cycle
direction, the original Lineage time bound, exact supporting refs, and exact parent preservation.

Existing same-ID release must be deeply equal. A different release for the outcome or changed bytes
must throw stable conflict codes before any materialized writer runs.

- [x] **Step 5: Materialize and recover exact embedded records**

Write the accepted release bundle first. Then materialize Finding and Lineage only when missing or
exactly equal. Add:

```ts
recoverPaperTradingComparisonResearchReleases(): Promise<
  PaperTradingComparisonResearchReleaseRecord[]
>;
```

Call recovery from `LocalStore.initialize()` after collections exist. Freeze release-linked IDs in
ordinary Finding/Lineage writers. Recovery of one corrupt bundle fails closed without rewriting
source campaign evidence.

- [x] **Step 6: Run full LocalStore and typechecks**

```bash
npx vitest run packages/local-store/test/local-store.test.ts
npm run typecheck --workspace @ouroboros/local-store
npm run typecheck --workspace @ouroboros/application
```

- [x] **Step 7: Commit Store authority**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist paper comparison research release"
```

### Task 4: Build the release application service

**Files:**
- Create: `packages/application/src/trading/paper/comparison-research-release-service.ts`
- Create: `packages/application/src/trading/paper/comparison-research-release-service.test.ts`

**Interfaces:**
- Produces: `PaperTradingComparisonResearchReleaseService.release`
- Consumes: exact campaign outcome, origin candidate/admission/Finding/Lineage, and Task 2 decision
- Persists only through Task 3's bundle writer

- [x] **Step 1: Write failing service tests**

Use:

```ts
class PaperTradingComparisonResearchReleaseService {
  constructor(options: { store: OuroborosStorePort; now?: () => string });
  release(input: {
    campaignOutcomeId: string;
  }): Promise<PaperTradingComparisonResearchReleaseRecord>;
}
```

Assert malformed input performs no reads; all four outcome classes build exact records; release
time follows outcome time; source Finding provenance is preserved; original parent is preserved;
supporting refs include source Finding, campaign, outcome, and verdict-bearing slots in stable order;
exact replay after clock advance performs no extra mutation. Reject absent or malformed outcome,
campaign mismatch, missing admission/source Finding, ambiguous or late source Lineage, missing
full-cycle direction, SystemCode drift, and changed Store replay.

- [x] **Step 2: Run and verify RED**

```bash
npx vitest run packages/application/src/trading/paper/comparison-research-release-service.test.ts
```

- [x] **Step 3: Implement deterministic bundle construction**

Release IDs are:

```ts
const releaseId = `${outcome.paper_trading_comparison_confirmation_campaign_outcome_id}-research-release`;
const findingId = `${releaseId}-finding`;
const lineageId = `${releaseId}-lineage`;
```

Use `paperTradingComparisonPersistedRecordDigestInput` plus SHA-256 for exact linked-record digests.
Select only the origin Lineage matching child SystemCode, admission source Finding, and
`created_at <= admission.decided_at`. Call the pure decision once and pass the finished bundle to
`recordPaperTradingComparisonResearchRelease`.

- [x] **Step 4: Run focused service/Store regressions and typecheck**

```bash
npx vitest run packages/application/src/trading/paper/comparison-research-release-decision.test.ts packages/application/src/trading/paper/comparison-research-release-service.test.ts packages/local-store/test/local-store.test.ts -t "comparison research release|release materialization|release-bound"
npm run typecheck --workspace @ouroboros/application
```

- [x] **Step 5: Commit the service**

```bash
git add packages/application/src/trading/paper/comparison-research-release-service.ts packages/application/src/trading/paper/comparison-research-release-service.test.ts
git commit -m "feat: release paper comparison research evidence"
```

### Task 5: Consume releases in CandidateArena context and direction ordering

**Files:**
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`

**Interfaces:**
- Adds: research-context-only `released_campaign_findings`
- Changes: `arenaFindingClusters` includes accepted release bundles
- Changes: adaptive default direction ordering can react to released campaign evidence
- Preserves: leaderboard, qualification, Trading review, and promotion state

- [x] **Step 1: Write the unreleased/released ablation test**

Use a real LocalStore candidate and override only the release-list read with a domain-valid release
fixture. First return `[]` and run a tick; assert default direction order and no release context.
Then return `[release]` and run the equivalent next tick; assert:

```ts
expect(context.released_campaign_findings).toEqual([
  expect.objectContaining({
    candidate_id: challengerId,
    direction_kind: "mean_reversion",
    release_kind: "challenger_not_reproduced",
    finding_kind: "negative_result",
    authority_status: "not_promotion_authority"
  })
]);
expect(nextTick.direction_results[0]?.direction_kind).toBe("mean_reversion");
```

Assert context omits raw slot scores, `promotion_eligibility`, Ledger chains, credentials, and live
authority. Exact duplicate release reads must not duplicate clusters or focus score.

- [x] **Step 2: Run the context test and verify RED**

```bash
npx vitest run apps/runtime/test/candidate-arena-paper-context.test.ts -t "released campaign|unreleased campaign|direction ablation"
```

- [x] **Step 3: Add the compact context projection**

Load releases once per context/read-model build and map only:

```ts
{
  release_id,
  candidate_id,
  direction_kind,
  release_kind,
  finding_kind: release.finding.finding_kind,
  summary: release.finding.summary,
  next_research_focus,
  released_at,
  authority_status: "not_promotion_authority"
}
```

Sort by `released_at` descending then ID, cap context to eight, and never fall back to campaign
outcomes when the release list is empty.

- [x] **Step 4: Extend FindingClusters without rank authority**

Pass releases into `arenaFindingClusters`. Use direction, candidate, summary, next focus, `unknown`
regime, and release kind in the internal key. Do not set a fake qualification blocker or protocol
failure. Deduplicate by release ID and candidate ID. Existing adaptive focus may reorder directions;
no leaderboard or paper-board values change.

- [x] **Step 5: Run CandidateArena and application regressions**

```bash
npx vitest run apps/runtime/test/candidate-arena-paper-context.test.ts
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/runtime
```

- [x] **Step 6: Commit causal consumption**

```bash
git add packages/application/src/candidate/arena.ts apps/runtime/test/candidate-arena-paper-context.test.ts
git commit -m "feat: consume released comparison findings"
```

### Task 6: Prove lifecycle, write back truth, and verify

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts`
- Modify: `AGENTS.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/superpowers/specs/2026-07-12-paper-trading-comparison-research-release-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-paper-trading-comparison-research-release.md`

**Interfaces:**
- Proves: actual campaign outcome to release bundle to materialized Finding/Lineage to restart
- Records: release is internal and promotion integration remains separate

- [ ] **Step 1: Extend the real campaign lifecycle integration**

Give the challenger fixture complete full-cycle direction and original ArtifactLineage evidence.
Before release, assert the confirmed outcome has created no new campaign Finding/Lineage. Release
the exact confirmed outcome, then assert positive classification, exact supporting refs, preserved
parent, one materialized Finding/Lineage, no TradingPromotion, and exact replay. Restart LocalStore,
run release recovery, and assert the same bundle and materialized records remain.

- [ ] **Step 2: Add negative/ineligible/expired integration coverage at the narrowest layer**

Use pure decision and Store fixtures rather than running extra six-window campaigns. Prove each
class persists and materializes the correct Finding kind, and source verdict exclusion remains
exact.

- [ ] **Step 3: Update canonical docs**

Add the ResearchRelease noun, classification priority, recoverable bundle, released context,
FindingCluster use, and ablation evidence. State explicitly that raw outcomes stay sealed until
release and no promotion/public/private/live authority was added.

- [ ] **Step 4: Verify no forbidden authority composition**

```bash
rg -n "ResearchReleaseService|recordPaperTradingComparisonResearchRelease" apps packages --glob '!**/*.test.ts'
rg -n 'recordTradingPromotion|promotion_eligibility|private_exchange_access: "allowed"|live_exchange_authority: true|order_submission_authority: true' packages/application/src/trading/paper/comparison-research-release-*.ts packages/domain/src/index.ts
```

Expected: internal domain/application/Store and CandidateArena read-only consumption only; no
promotion, private, direct-order, or live authority.

- [ ] **Step 5: Run repository-wide verification**

```bash
npx vitest run packages/domain/src/paper-trading-comparison-research-release.test.ts packages/application/src/trading/paper/comparison-research-release-decision.test.ts packages/application/src/trading/paper/comparison-research-release-service.test.ts packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts apps/runtime/test/candidate-arena-paper-context.test.ts packages/local-store/test/local-store.test.ts
npm run typecheck
npm run check:repo-guards
npm test
git diff --check
```

Run localhost provider/subprocess tests with the required unsandboxed execution permission.

- [ ] **Step 6: Mark design/plan complete and commit durable truth**

```bash
git add packages/application/src/trading/paper/comparison-confirmation-campaign.integration.test.ts AGENTS.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-12-paper-trading-comparison-research-release-design.md docs/superpowers/plans/2026-07-12-paper-trading-comparison-research-release.md
git commit -m "docs: record paper comparison research release"
```

## Plan Self-Review

- Domain shape, pure classification, Store authority, service construction, causal consumption, and
  lifecycle proof are independently rejectable commit boundaries.
- Every design acceptance item maps to at least one task and one exact test command.
- The Store independently validates classification and identity without importing application code.
- Release-first materialization plus restart recovery prevents half-visible Finding/Lineage state.
- CandidateArena never infers release from raw outcome persistence.
- The ablation proves later ResearchWorker input and direction ordering change only after release.
- Promotion, public command, operator mutation, private exchange, direct-order, and live authority
  remain explicit non-goals.
- No placeholder, compatibility alias, optional replacement window, or score-aware release rule is
  introduced.
