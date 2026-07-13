# ResearchControlCampaign Outcome Design

**Status:** Implemented and verified

## Goal

Close the evidence gate between an isolated `ResearchControlCampaign` report and one terminal,
externally backed observation of adaptive-versus-static qualified discovery yield.

The outcome must consume every precommitted paper candidate slot. It may count a candidate as a
qualified discovery only when the exact reserved candidate completes the existing prospective paper
comparison, paired qualification, verdict, confirmation campaign, and ResearchRelease graph against
the same precommitted Trading review comparator and policy as every other reserved candidate.

This frontier adjudicates supplied terminal evidence. It does not implement the production paper
slot scheduler or replace the allocation policy automatically.

## Missing Boundary

The implemented research campaign freezes store/source/agent/tick bounds and candidate reservation,
but it does not explicitly freeze the future paper comparator. Choosing a champion after research
results are visible would permit post-hoc comparator selection and invalidate the estimand.

`PaperTradingComparisonResearchRelease` alone is also insufficient. It identifies the released
challenger and terminal release kind, but fair comparison requires reloading the bound confirmation
campaign and outcome to verify champion selection, comparison policy, market configuration, paper
policy, complete slot result, and exact release graph.

## Pre-Effect Comparator

Extend `ResearchControlCampaign` with exactly one `paper_comparator`:

- `trading_review`: exact current `TradingPromotion` ref/digest, candidate ref, CandidateVersion
  ref, and paper evaluation ref captured before arm effects;
- `unavailable`: explicit `no_trading_promotion_at_commitment`.

An unavailable comparator permits research-arm diagnostics but can never produce an economic
campaign outcome. A later TradingPromotion cannot retroactively repair that campaign.

LocalStore verifies a `trading_review` comparator against the exact persisted promotion when the
campaign is first recorded. The campaign digest binds the comparator.

## Canonical Outcome

`ResearchControlCampaignOutcome` is one append-only external adjudication record for one exact
terminal research report.

For each precommitted slot it records:

- `no_admitted_candidate`, with no paper refs and zero discovery credit; or
- the exact reserved candidate closure plus confirmation campaign, confirmation outcome, and
  ResearchRelease refs/digests and terminal release kind.

The adjudicator accepts only:

- `comparison_mode: champion_challenge`;
- `champion_selection: trading_review` matching the campaign's exact TradingPromotion ref/digest;
- exact champion candidate and CandidateVersion matching the campaign comparator;
- exact challenger candidate, CandidateVersion, SystemCode, and artifact digest matching the
  reserved slot;
- an exact terminal confirmation outcome and exact ResearchRelease bound to that campaign/outcome;
- one identical comparison policy, market-data configuration digest, and paper policy identity for
  every candidate-bearing slot in both arms.

No reserved slot may be omitted, duplicated, substituted, or filled with a later candidate.

`shared_evaluation_policy_status` is `bound` whenever at least one candidate-bearing slot exists.
If neither arm reserved a candidate, it is explicitly
`not_applicable_no_reserved_candidates`; the accompanying digest binds that canonical empty-policy
state rather than pretending that a paper policy existed.

## Metric

The denominator is every precommitted paper slot, including `no_admitted_candidate`, ineligible,
expired, and non-reproduced results. This prevents one policy from appearing better by producing or
reporting fewer candidates.

For each arm:

```text
qualified_discovery_count = count(release_kind == confirmed_improvement)
qualified_discovery_rate = qualified_discovery_count / total_precommitted_slot_count
```

Rates and their adaptive-minus-static difference are rounded to six places. The observed result is
one of:

- `adaptive_rate_higher`;
- `rates_equal`;
- `static_rate_higher`.

These names describe one bounded observation. The record fixes:

```text
causal_conclusion = single_campaign_observation_only
policy_replacement_eligibility = not_eligible
next_action = accumulate_replicated_control_campaigns
```

No p-value, confidence interval, or general policy claim is manufactured from at most five slots
per arm. A later replicated-campaign protocol must precommit its own sample and decision rule.

## Release Classification

| Release kind | Slot terminal status | Discovery credit |
| --- | --- | --- |
| `confirmed_improvement` | `qualified_improvement` | 1 |
| `challenger_not_reproduced` | `not_reproduced` | 0 |
| `comparison_evidence_ineligible` | `evidence_ineligible` | 0 |
| `campaign_slot_expired` | `paper_slot_expired` | 0 |
| no admitted research candidate | `no_admitted_candidate` | 0 |

Admission count, preflight score, entropy, provider requests, elapsed time, and research report
diagnostics never substitute for a release.

## Persistence And Placement

The coordinator LocalStore persists the outcome because it already owns campaign, arm intents, and
report. Arm-local raw paper records remain in their isolated stores. The application adjudicator
receives complete typed arm-local closure objects, validates them, and stores only exact refs,
digests, classifications, shared comparator/policy digest, and arm metrics in the coordinator.

Filesystem paths, raw market ticks, observations, scores, sealed scenarios, provider logs, and
Finding text do not enter the outcome.

## Recovery

- Missing terminal evidence: no outcome; return an explicit not-terminal error.
- Comparator unavailable: no outcome; the campaign is permanently economic-ineligible.
- Existing exact outcome: return it without rereading mutable research proxies.
- Existing conflicting outcome: fail closed.
- Missing arm workspace after outcome persistence: exact coordinator outcome remains replayable.
- Arm evidence mutation before outcome persistence: digest or graph validation fails closed.

The runtime collector discovers a release only when candidate, CandidateVersion, SystemCode, and
artifact digest all match one reserved slot. Zero matches is incomplete, multiple matches is
ambiguous, and a release without its exact campaign/outcome closure is incomplete. Once the
coordinator outcome exists, replay validates campaign/report identity and does not reopen either arm
store.

## Non-Goals

- Starting paper sessions or comparison windows.
- Choosing which champion to use after campaign commitment.
- Importing arm candidates into the primary CandidateArena population.
- Automatic allocation-policy replacement, promotion, champion handoff, private access, or live
  trading.
- Directed/undirected, memory/no-memory, or agent/baseline ablations.
- Replicated statistical inference across multiple research campaigns.

## Acceptance

1. Campaign shape and digest bind either the exact pre-effect Trading review comparator or explicit
   unavailability.
2. LocalStore rejects a forged/missing TradingPromotion comparator.
3. Outcome shape rejects omitted slots, unequal denominators, duplicate release graphs, metric
   drift, winner fields, and widened authority.
4. Application rejects unavailable comparator, nonterminal evidence, bootstrap comparison,
   comparator/policy mismatch, candidate substitution, extra/missing closures, and release graph
   mismatch.
5. Every slot is counted exactly once; only `confirmed_improvement` earns discovery credit.
6. Exact outcome replay is idempotent and conflicting replay fails closed.
7. Outcome exposes no raw paper/research evidence and cannot replace policy or promote.
8. Focused tests, workspace typechecks, repository guards, and the full suite pass.

## Implementation Evidence

- Domain outcome contract: `9342861`, with explicit empty-policy status correction in `abca8ab`.
- External application adjudicator and coordinator LocalStore persistence: `4d3478b`.
- Arm-local release collector and terminal replay: `91a43a5`.
- Direct outcome coverage: 30 domain, 17 application, 14 LocalStore campaign/outcome, and 6 runtime
  collector tests passed.
- Existing runtime campaign regression: 10 tests passed.
- All workspace typechecks passed, including the Operator Desktop Rust build.
- Docs, architecture, naming, tracked-env, secret, and diff guards passed.
- Full repository suite: 304 of 304 suites and 2279 of 2279 tests passed, with zero failed,
  pending, or todo. The final JSON report is
  `/private/tmp/ouroboros-research-control-outcome-final.json`.

This closes supplied terminal outcome adjudication, not outcome production. The next causal
frontier must precommit and operate the paper-slot scheduler, then accumulate replicated campaigns
under a predeclared inference and policy decision rule.
