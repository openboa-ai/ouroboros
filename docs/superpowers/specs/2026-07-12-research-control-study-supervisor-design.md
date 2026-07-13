# ResearchControlStudy Supervisor Design

**Status:** Approved under the standing CandidateArena Goal authority

## Goal

Execute one precommitted `ResearchControlStudy` to its exact terminal outcome without manual
campaign-by-campaign coordination. The runtime must resume from append-only campaign evidence,
complete every planned replication in order, adjudicate only after all terminal outcomes exist, and
preserve the study's same-baseline, no-early-stopping, paper-only authority boundary.

This frontier makes the replicated protocol operable. It does not claim that a study has produced a
supported effect, replace allocation policy, create TradingPromotion, or deploy a public command.

## Current Gap

The repository has all lower-level decisions and execution components, but no owner for the whole
graph:

- `ResearchControlStudy` precommits exact campaign identities and analysis policy;
- `runResearchControlCampaign` creates or resumes one isolated adaptive/static research run;
- `createResearchControlCampaignPaperRuntime` and its runner drive one campaign's paper slots;
- `collectResearchControlCampaignOutcome` records one terminal campaign observation;
- `ResearchControlStudyOutcomeService` adjudicates an already complete replication set.

Two composition gaps prevent correct study execution. First, the campaign baseline snapshot does
not yet exclude study evidence, so committing a study changes the bytes later planned campaigns
would snapshot. Second, no runtime composes one campaign through research, paper, and terminal
outcome before moving to the next planned replication.

## Approaches

### External callback loop only

An executor could invoke an injected `runCampaign` callback and leave all real composition outside
the repository. This is small but proves only orchestration over mocks, not that existing campaign
and paper components can close one real runtime graph.

### Persist a separate StudyRun state machine

A new mutable or append-only progress record could track current replication and status. This adds
observable state, but duplicates facts already determined by planned campaign refs, campaign
outcomes, and the study outcome. Crash windows could make the progress record disagree with the
authoritative evidence graph.

### Derive progress and compose one bounded campaign at a time

Selected. A pure projector derives the next action from exact stored evidence. An executor performs
at most one campaign-to-outcome action or one final adjudication per call. A runner may repeat those
steps, stopping between campaign boundaries. No separate progress record exists; restart reloads the
same append-only graph.

## Baseline Closure

`captureResearchControlCampaignSnapshot` must exclude both:

```text
research-control-studies
research-control-study-outcomes
```

alongside existing campaign evidence collections. This is not a broad exclusion: candidate,
Finding, Lineage, Trading review, and every non-control record remain covered. Committing a study or
one planned campaign therefore cannot change the next planned campaign's baseline. Any unrelated
primary-store mutation still changes the digest and causes the study's planned-campaign guard to
fail closed.

The existing exclusion policy name remains
`research_control_campaign_evidence_only`; study records are part of that control-experiment
evidence family, not candidate state.

## Runtime Study Commitment

`commitResearchControlStudyRuntime` prepares one study before planned effects:

1. capture the exact primary LocalStore baseline;
2. resolve the frozen source SystemCode artifact closure;
3. require one pre-effect Trading review comparator and bound paper protocol;
4. derive a non-persisted campaign template from the first planned idempotency key;
5. project the exact study condition from that template;
6. commit 6 to 30 deterministic campaign refs through `ResearchControlStudyService`.

The template creates no campaign, arm, tick, paper, or trading effect. The LocalStore study guard
still rejects commitment if any planned campaign already exists.

## Campaign-To-Outcome Driver

`runResearchControlCampaignToOutcome` is the concrete lower-level action used by study execution:

1. call `runResearchControlCampaign` without an injected single paper step;
2. require the persisted bound paper schedule;
3. open the two arm runtime adapters through one injected arm factory;
4. compose `createResearchControlCampaignPaperRuntime` with the coordinator LocalStore;
5. start and drain its interruptible campaign paper runner;
6. require `completed`, rejecting `stopped` or `failed` status;
7. call `collectResearchControlCampaignOutcome` idempotently and return the exact campaign/outcome
   closure.

The arm factory is the only outer adapter seam. It supplies existing source-window, confirmation,
market-data, paper-store, and driver implementations; it cannot alter the frozen study or campaign
condition.

## Derived Study Actions

`projectResearchControlStudyNextAction` accepts one exact study plus aligned stored campaign and
outcome evidence. It returns exactly one of:

```ts
type ResearchControlStudyNextAction =
  | {
      action: "run_campaign";
      replicationIndex: number;
      campaignId: string;
      campaignIdempotencyKey: string;
      resume: boolean;
    }
  | { action: "adjudicate_study" }
  | { action: "complete" };
```

Rules:

- an existing study outcome means `complete` only when its exact study ref/digest matches;
- the first planned replication without a terminal campaign outcome is `run_campaign`;
- `resume` is true when its campaign exists but terminal outcome does not;
- an outcome without its campaign, duplicate outcome, out-of-order later campaign, or any ref,
  digest, baseline, condition, or time mismatch fails closed;
- only a complete ordered set returns `adjudicate_study`;
- no result, sign, p-value, or inference influences scheduling.

## Executor And Runner

`ResearchControlStudyExecutor.advance({ studyId })` reloads the study and exact planned graph. For
`run_campaign`, it invokes the campaign-to-outcome action and then reloads and verifies the exact
persisted closure. For `adjudicate_study`, it invokes `ResearchControlStudyOutcomeService`. For
`complete`, it returns the persisted outcome without effects.

One executor call performs at most one full campaign or one adjudication. This is the study-level
budget boundary. `ResearchControlStudyRunner` repeats executor calls sequentially and exposes
`idle`, `running`, `completed`, `stopped`, and `failed` status. A stop request drains the active
campaign step and prevents the next replication; it never abandons an in-flight append operation.

Campaigns run in precommitted replication order. Version 1 deliberately avoids cross-campaign
parallelism because all campaigns claim one exact primary-store baseline and because unbounded
concurrent researcher/paper workloads would make resource equality harder to audit.

## Recovery And Failure

- Restart derives progress from study, campaign, campaign outcome, and study outcome records.
- An interrupted research arm reuses exact completed ticks through `runResearchControlCampaign`.
- An interrupted paper phase reloads append-only schedule evidence through the campaign paper
  executor.
- A terminal campaign outcome is never rerun; it is reloaded and verified.
- A study outcome is byte-equivalent replay and ends execution.
- Missing evidence selects the earliest incomplete replication; malformed or contradictory evidence
  fails the executor rather than skipping the replication.
- Runner failure records a stable error code in memory only. Durable source evidence remains the
  recovery authority.

## Authority Boundary

- The study executor has research scheduling and external paper-evaluation orchestration authority.
- It cannot alter the planned sample, condition, analysis policy, or observed differences.
- TradingSystems never select replications or adjudicate outcomes.
- Supported inference does not mutate `CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY`.
- CandidateAdmission, TradingPromotion, TradingReview, Gateway order authority, credentials,
  private data, and live exchange behavior remain unchanged.

## Testing

- snapshot tests prove study evidence does not change the frozen baseline while ordinary state does;
- runtime commitment tests prove study-before-campaign order and exact condition parity;
- pure projector tables cover fresh, resumed, terminal, complete, out-of-order, duplicate, and drift
  graphs;
- executor tests prove one replication per advance, exact reload, no early adjudication, idempotent
  completion, and fail-closed callback output;
- runner tests prove sequential completion, restart, stop-between-campaigns, and stable failure;
- campaign-to-outcome composition tests prove paper runner start/drain/status and exact collection;
- focused campaign/study tests, workspace typechecks, repository guards, and available full-suite
  checks remain required.

## Non-Goals

- A public CLI, HTTP, TUI, or Desktop command.
- A default process-discovery daemon.
- Cross-campaign parallelism.
- Distinct-baseline or regime-stratified studies.
- A research allocation policy decision or automatic policy replacement.
- Automatic TradingPromotion, private exchange data, or live execution.

## Implemented Boundary

The baseline exclusions, runtime study commitment, campaign-to-outcome driver, strict next-action
projector, one-action executor, sequential runner, and `createResearchControlStudyRuntime`
composition are implemented. Focused tests prove exact precommit, fixed-order progress, terminal
reload, adjudication gating, restart projection, active-step drain, and stable failure status.

The runtime remains internal and explicitly constructed. A follow-on single-owner one-shot process
supervisor now discovers committed studies, and a separate follow-on allocation-policy decision can
consume an eligible outcome. No public command or server auto-start starts the process, and no
completed prospective study evidence exists in the repository.

## Acceptance

1. A runtime can precommit a study from the exact source store before any planned campaign.
2. Study evidence does not perturb the planned baseline; unrelated state still does.
3. Repeated advance calls complete exactly one planned campaign at a time in fixed order.
4. Every campaign runs through terminal paper outcome before the next replication.
5. Restart resumes the earliest incomplete campaign without duplicating completed effects.
6. Adjudication occurs only after every exact planned outcome exists.
7. Stop and failure preserve append-only recovery evidence and never shrink the sample.
8. No new record or runtime path grants policy replacement, promotion, order, private, or live
   authority.
