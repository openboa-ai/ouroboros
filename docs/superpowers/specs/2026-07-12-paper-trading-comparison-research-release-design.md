# Paper Trading Comparison Research Release Design

**Date:** 2026-07-12
**Status:** Implemented and repository-verified
**Depends on:** Repository-verified sealed
`PaperTradingComparisonConfirmationCampaignOutcome`

## Goal

Release one terminal confirmation campaign into causal CandidateArena research memory without
changing the completed campaign, leaking sealed evidence before release, or granting promotion or
trading authority. The release must preserve positive, negative, ineligible, and expired evidence,
extend the challenger's real research lineage, survive partial materialization and restart, and be
consumed by later ResearchWorkers and adaptive direction ordering.

The campaign outcome remains the external economic decision. Research release is a separate,
append-only visibility transition. A protocol-level `eligible` outcome does not become a
TradingPromotion merely because Research can learn from it.

## Current Boundary

The repository persists exact campaign/outcome evidence and keeps it hidden until one accepted
research release exists. Existing `ResearchFindingRecord` and `ArtifactLineageRecord` remain the
research-orchestration records, while `PaperTradingComparisonResearchRelease` is the append-only
visibility boundary that freezes and rematerializes both. CandidateArena consumes only accepted
release bundles and still builds paper-backed FindingClusters independently. Raw campaign outcomes,
leaderboards, public commands, and operator read models do not imply release.

## Approaches

### Direct outcome projection

Let CandidateArena read every campaign outcome directly. This is rejected because persistence would
implicitly equal release, eliminating the information barrier and making future visibility policy
impossible to audit.

### Sequential Finding and Lineage writes

Create one ResearchFinding and then one ArtifactLineage. This reuses existing consumers but is
rejected as the authority boundary because a crash between writes creates partial visibility and
same-ID replay can drift without an independently frozen release record.

### Append-only research release bundle

Persist one `PaperTradingComparisonResearchRelease` containing the exact Finding and extended
Lineage, then materialize those embedded records into their existing collections. CandidateArena
recognizes only the release bundle; research orchestration continues to consume the materialized
records. This is the selected approach because one durable record defines visibility, exact replay,
recovery, and authority.

## Taxonomy

- `PaperTradingComparisonResearchRelease`: append-only bundle that makes one exact campaign outcome
  available to Research as Finding and Lineage evidence.
- `release_kind`: stable interpretation of the aggregate campaign evidence for research context,
  not a rank or promotion state.
- `released_to_research`: visibility state meaning later ResearchWorkers may consume the evidence.

Do not call the release a verdict, promotion, champion replacement, reward, or statistical proof.
`ResearchFinding`, `ArtifactLineage`, `FindingCluster`, and `ResearchDirection` remain the existing
canonical nouns. No aliases or persisted-key migration are required.

## Release Classification

Classification is deterministic and uses every reserved slot result:

| Condition | `release_kind` | Finding kind | Research interpretation |
| --- | --- | --- | --- |
| Campaign is `confirmed_improvement` | `confirmed_improvement` | `positive_result` | Preserve the confirmed artifact and generate controlled variants under new prospective evidence. |
| Otherwise any slot is `challenger_not_improved` | `challenger_not_reproduced` | `negative_result` | Explain non-reproduction and generate differentiated candidates; do not reuse campaign windows. |
| Otherwise any slot is `comparison_ineligible` | `comparison_evidence_ineligible` | `failure_analysis` | Repair evidence or protocol quality before economic interpretation. |
| Otherwise one or more slots expired | `campaign_slot_expired` | `failure_analysis` | Repair scheduling or recovery before economic interpretation. |

This priority prevents infrastructure or evidence failure from becoming a strategy loss when no
valid non-improvement was observed. Counts and all slot statuses remain in the Finding summary, so
mixed evidence is not hidden by the primary classification.

## Durable Record

```ts
type PaperTradingComparisonResearchReleaseKind =
  | "confirmed_improvement"
  | "challenger_not_reproduced"
  | "comparison_evidence_ineligible"
  | "campaign_slot_expired";

interface PaperTradingComparisonResearchReleaseRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_research_release";
  paper_trading_comparison_research_release_id: string;
  campaign_ref: Ref;
  campaign_digest: string;
  campaign_outcome_ref: Ref;
  campaign_outcome_digest: string;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  source_finding_ref: Ref;
  source_finding_record_digest: string;
  source_lineage_ref: Ref;
  source_lineage_record_digest: string;
  direction_kind: ResearchDirectionKind;
  release_kind: PaperTradingComparisonResearchReleaseKind;
  finding: ResearchFindingRecord;
  finding_record_digest: string;
  lineage: ArtifactLineageRecord;
  lineage_record_digest: string;
  next_research_focus: string;
  released_at: string;
  release_digest: string;
  research_visibility: "released_to_research";
  evaluation_authority: "external_to_trading_systems";
  promotion_authority: false;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "lineage_only";
}
```

Release ID is deterministic from campaign outcome ID. Finding and Lineage IDs are deterministic
children of release ID. `released_at` is server-owned, strictly after outcome `evaluated_at`, and
reused on replay. Canonical digest inputs bind the complete embedded records and remove only their
own digest fields where applicable.

## Causal Provenance

The service loads the campaign challenger admission and its exact source ResearchFinding. It also
requires the original ArtifactLineage for the same challenger SystemCode whose source findings
include the admission finding and whose `created_at` is no later than admission `decided_at`. The
candidate's persisted full-cycle lineage supplies the exact `ResearchDirectionKind`; missing or
conflicting origin evidence fails closed.

The released Finding reuses the origin finding's ResearchWorker, ResearchDirection, ExperimentRun,
and TradingEvaluationResult refs because those identify who created the candidate. Its supporting
refs are exactly the source finding, campaign, campaign outcome, and every verdict-bearing campaign
slot. The summary identifies aggregate counts and never presents ineligible or expired evidence as
economic failure.

The released ArtifactLineage keeps the original child and parent SystemCode refs and appends the new
Finding to the origin source-finding chain. It does not claim the compared champion was the
challenger's parent.

## Application Service

```ts
class PaperTradingComparisonResearchReleaseService {
  constructor(options: {
    store: OuroborosStorePort;
    now?: () => string;
  });

  release(input: {
    campaignOutcomeId: string;
  }): Promise<PaperTradingComparisonResearchReleaseRecord>;
}
```

The service validates input before Store reads, returns exact replay for an existing release, builds
one release only from a terminal exact campaign/outcome graph, and delegates persistence to the
Store. It does not write Finding or Lineage independently and does not expose campaign evidence to
CandidateArena before Store acceptance.

## Store Authority And Recovery

The Store port adds record/get/list methods for research releases. LocalStore independently verifies
campaign and outcome digests, challenger identity, admission and origin evidence, classification,
summary counts, supporting refs, extended lineage, timestamps, canonical digests, and all no-authority
fields.

LocalStore writes the release bundle first, then materializes its embedded Finding and Lineage with
exact same-ID checks. Restart recovery rematerializes missing records from every valid release.
CandidateArena reads the bundle, so a crash cannot expose an uncommitted release; research
orchestration sees the existing collections after materialization or recovery. Direct attempts to
change a release-bound Finding or Lineage conflict.

## CandidateArena Consumption

CandidateArena adds a research-context-only `released_campaign_findings` projection containing
release ID, candidate ID, direction, release kind, Finding kind and summary, next research focus,
release time, and `not_promotion_authority`. It contains no hidden side scores beyond the aggregate
Finding summary, no provider credentials, and no promotion eligibility field.

Released records also contribute to `FindingCluster` construction using their direction, candidate,
Finding summary, next research focus, and `unknown` market regime. The release kind participates in
the internal cluster key so positive, non-reproduced, ineligible, and expired evidence do not merge.
Existing adaptive direction scoring may prioritize that cluster, but it cannot alter leaderboard,
qualification, Trading review, or promotion state.

The causal acceptance proof is an ablation:

1. Persist a terminal campaign outcome without release. The next ResearchWorker context and default
   direction order contain no campaign evidence.
2. Release the same outcome. Exact replay creates no duplicate Finding or Lineage.
3. The next context contains the released Finding and its FindingCluster, and the released direction
   moves ahead of the default order.
4. Removing only the release record from an equivalent fixture removes that effect.

## Information And Authority Boundary

- The source verdict and slot outcomes remain immutable.
- Research sees only accepted release bundles, never every sealed outcome.
- `confirmed_improvement` is useful positive research evidence but not promotion authority.
- Negative, ineligible, and expired evidence remain useful and cannot be silently dropped.
- No candidate, ResearchWorker, or TradingSystem authors classification, summary, or release time.
- No public command, operator mutation, TradingPromotion, private exchange access, direct order, or
  live authority is added.

## Failure And Replay

- Missing, malformed, unsealed, or changed campaign evidence writes nothing.
- Missing or conflicting admission, source Finding, origin Lineage, candidate direction, or artifact
  identity writes nothing.
- Same outcome releases at most once; exact replay reuses time and embedded records.
- Same-ID release, Finding, or Lineage drift conflicts.
- Crash after bundle persistence but before materialization is recovered from the bundle on restart.
- CandidateArena ignores malformed or incomplete release values rather than falling back to raw
  campaign outcomes.
- Release failure never changes campaign pair ownership, outcome eligibility, or promotion state.

## Acceptance

1. Every terminal campaign class maps to one stable release and Finding kind.
2. The source verdict never counts as a slot result or changes release classification.
3. Release binds the exact campaign outcome, challenger candidate/version/SystemCode, source
   Finding, and original Lineage.
4. Release persists one append-only bundle and materializes exact Finding and Lineage records.
5. Partial materialization recovers after restart; same-ID drift fails closed.
6. A campaign outcome alone remains absent from CandidateArena context and FindingClusters.
7. A released outcome appears in later ResearchWorker context under `not_promotion_authority`.
8. Release kind separates positive, non-reproduced, ineligible, and expired research pressure.
9. An ablation proves the release changes later direction ordering while the unreleased control does
   not.
10. Exact replay creates no duplicate release, Finding, Lineage, or adaptive pressure.
11. No TradingPromotion, public command, operator mutation, private access, direct order, or live
    authority is created.
12. Focused domain, application, LocalStore, CandidateArena context, typecheck, repository guards,
    and full-suite validation pass.

## Implementation Evidence

- Domain shape and digest tests cover all four release kinds, deterministic child IDs, causal
  Finding/Lineage refs, canonical persistence input, and no-authority fields.
- Pure decision tests cover classification priority and malformed, reordered, duplicate, mixed,
  ineligible, and expired slot evidence without input mutation.
- LocalStore tests cover append-only persistence, one-outcome identity, bundle-first crash recovery,
  exact materialization, release-bound child freezing, origin graph validation, and restart replay.
- Service tests cover malformed-input no-read behavior, all four terminal classes, exact provenance,
  clock ownership, ambiguous or late Lineage rejection, and Store replay conflicts.
- CandidateArena's unreleased/released ablation uses a real LocalStore candidate. Only the release
  adds compact context and a FindingCluster, moves `mean_reversion` to the first default direction,
  and deduplicates repeated reads without changing rank or promotion authority.
- The real confirmation lifecycle test reaches prospective public-fill paper evidence, confirmed
  outcome, release, materialized Finding/Lineage, exact replay, restart recovery, and no
  TradingPromotion.

## Out Of Scope

- consuming `eligible` outcomes in TradingPromotion review;
- public/operator release commands or manual release approval;
- exposing raw campaign slot economics in UI;
- model-based summarization of findings;
- market-regime attribution across multi-window campaigns;
- long-running worker process ownership, dynamic budget allocation, or statistical significance;
- private exchange data, credentials, or live trading.

## Next Frontier

Consume protocol-level eligible outcomes in a separately reviewed TradingPromotion path, then use
released causal memory and efficiency evidence to govern durable
ResearchWorker budgets and recovery. Neither frontier may mutate completed campaign or release
evidence.
