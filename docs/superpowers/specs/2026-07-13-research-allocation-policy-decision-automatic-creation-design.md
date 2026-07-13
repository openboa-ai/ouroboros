# ResearchAllocationPolicyDecision Automatic Creation Design

**Status:** Implemented and verified

## Goal

Let the long-running runtime server convert every exact terminal
`ResearchControlStudyOutcome` into its deterministic `ResearchAllocationPolicyDecision` without an
operator command. The decision must be append-only, idempotent across same-root server processes,
available to the next uncontrolled CandidateArena tick, and limited to research allocation policy.

The automatic path must record supported, unsupported, and underpowered outcomes symmetrically. It
must not select only favorable evidence, mutate a study outcome, infer static superiority from a
non-significant result, promote a candidate, submit an order, access private exchange state, or gain
live authority.

## Why This Frontier Is Next

The default server can now commit, execute, and externally adjudicate one bounded replicated study.
`ResearchAllocationPolicyDecisionService` can already derive an approved or not-approved decision,
and uncontrolled Arena allocation can already cite the latest exact approval. No runtime path calls
that service after study completion, so the evaluate-to-adapt edge still depends on a test or manual
caller.

Automatic decision creation closes that edge without collapsing evaluation into authority. The
study outcome remains authority-free evidence; a separate fixed application policy interprets it
for future research allocation only.

## Bias And Authority Doctrine

Automatic reconciliation applies to every valid terminal study outcome, not only
`adaptive_effect_supported` outcomes. This is required to prevent selective publication and
outcome-aware policy history:

- supported eligible evidence records `approved` for the exact studied adaptive policy digest;
- unsupported or underpowered evidence records `not_approved` with no effective mode;
- non-significance never selects `static_control`;
- the decision policy remains fixed, deterministic, and external to ResearchWorkers and providers;
- the decision can influence only future uncontrolled CandidateArena allocation provenance;
- explicit directions and explicit adaptive/static modes retain precedence;
- no decision gains evaluation, promotion, order, private, credential, or live authority.

## Scope And Vocabulary

`ResearchAllocationPolicyDecision` remains the only persisted policy-selection record. Add no job,
request, intent, run, or mutable progress schema.

Use `ResearchAllocationPolicyDecisionCoordinator` for the internal application component that
reconciles terminal study outcomes with decisions. This is an internal component name, not a new
evidence noun or public command.

Its bounded operational result is:

- `ensured`: one oldest missing terminal outcome now has its exact decision;
- `up_to_date`: every visible terminal outcome already has an exact decision, including the empty
  store case.

## Considered Approaches

### Decide inside study adjudication

Rejected. It couples external evaluation persistence to policy-selection authority, makes study
completion depend on a downstream interpretation, and weakens independent recovery.

### Run a second independent decision scheduler

Rejected. It duplicates polling, failure, shutdown, and cross-process behavior already owned by the
study scheduler.

### Reconcile after a successful study scheduler cycle

Selected. After the process supervisor reaches `caught_up`, exact study outcomes are durable and no
study runtime is active. One post-cycle reconciliation before the scheduler waits gives immediate
adaptation, deterministic recovery, and one existing lifecycle owner.

## Deterministic Reconciliation

On each eligible scheduler cycle the coordinator:

1. loads exact studies, study outcomes, and policy decisions;
2. rejects orphan decision records that do not reference a visible terminal outcome;
3. orders outcomes by `adjudicated_at`, then outcome ID;
4. resolves each outcome's exact study and validates existing decisions through
   `ResearchAllocationPolicyDecisionService`;
5. selects only the oldest outcome with no decision;
6. invokes the existing service once and returns `ensured` with the exact decision status;
7. returns `up_to_date` when no missing decision remains.

One scheduler cycle creates at most one decision. This bounds recovery work while preserving stable
oldest-first ordering. Current automatic study commitment permits at most one incomplete study, so
the normal path creates the just-completed decision in the same cycle. Historical backlog drains at
one decision per normal poll.

The coordinator does not duplicate statistical logic. The existing decision service remains the
single policy interpreter and LocalStore independently revalidates the complete source graph.

## Time Ordering

`decided_at` must be strictly later than `outcome.adjudicated_at`.

- an exact valid server clock later than the outcome is used unchanged;
- an equal millisecond advances by exactly one millisecond to preserve causal ordering after an
  immediate in-process completion;
- an invalid or earlier clock fails closed;
- replay and race recovery preserve the winner's original `decided_at`.

No timestamp participates in the deterministic decision ID, which remains derived from the outcome
ID.

## Cross-Process Atomicity

`LocalStore.recordResearchAllocationPolicyDecision` must use the existing complete create-only JSON
publication primitive:

1. validate the full study/outcome/decision graph;
2. write complete bytes to a unique temporary file;
3. atomically hard-link the temporary file to the final encoded path;
4. remove the temporary link;
5. on `EEXIST`, reload the winner and require exact equality or return the existing append-only
   conflict.

Two coordinators may derive different valid decision timestamps. Exactly one record wins. The
decision service reloads that winner, re-derives the decision using the winner's timestamp, and
accepts it only when every semantic field and digest match. It never overwrites the winner.

This is same-root filesystem coordination. It does not claim multi-host consensus or arbitrary
network-filesystem semantics.

## Scheduler And Server Composition

Add the coordinator as an optional dependency of `ResearchControlStudyScheduler`. After a
supervisor cycle reaches `caught_up`, and before entering bounded wait, call `ensureNextDecision`.

Do not invoke it when the supervisor:

- fails;
- is contended by another same-host owner;
- is stopping or stopped;
- ends in an invalid state.

The returned operational result becomes optional `lastPolicyDecision` scheduler status. Schedulers
without this dependency preserve their exact current status shape.

`buildServer` creates the default coordinator from the initialized LocalStore and exact server
clock, passes it through `createResearchControlStudyServerScheduler`, and starts it only when the
default study scheduler starts. An explicitly injected scheduler and
`runResearchControlStudiesOnStart: false` remain deterministic test/operator escape hatches.

## Failure Semantics

- no terminal outcome: `up_to_date` with zero checked outcomes;
- all exact decisions present: `up_to_date` after validation;
- one missing decision: ensure exactly that oldest decision;
- supported outcome: ensure `approved`;
- unsupported or underpowered outcome: ensure `not_approved`;
- malformed, orphaned, substituted, time-inverted, or conflicting graph: fail closed;
- same-ID publication race: accept only the exact semantic winner;
- coordinator failure: scheduler becomes terminal after the successful supervisor cycle and before
  bounded wait;
- next process restart: reconstruct from Store evidence and retry the oldest missing outcome.

No operational result becomes a Finding, Lineage item, rank, evaluation, promotion, order, private,
or live record.

## Tests

### LocalStore and decision service

- concurrent exact decision publication returns one complete record;
- different valid timestamps for one deterministic ID produce one winner and one direct-store
  conflict;
- the decision service reloads and accepts an exact concurrent winner;
- semantic mismatch still fails as a persistence conflict;
- existing sequential append-only and graph validation remain unchanged.

### Decision coordinator

- no outcomes returns `up_to_date` without writes;
- eligible supported evidence ensures `approved`;
- unsupported and underpowered evidence each ensure `not_approved`;
- an existing exact decision is validated and the next oldest missing outcome is selected;
- at most one decision is created per call;
- orphan, missing-study, digest-drift, and conflicting existing decisions fail closed;
- equal-millisecond completion advances one millisecond; a regressed clock fails;
- an automatically ensured approval is selected by the existing uncontrolled-allocation resolver.

### Scheduler and server

- order is commitment, supervisor catch-up, policy decision, bounded wait;
- policy decision is not invoked on contention, supervisor failure, stop, or invalid state;
- policy-decision failure is terminal and preserves completed-study counters;
- status exposes only bounded `lastPolicyDecision` metadata;
- default server composition runs the coordinator; disabled or explicitly injected scheduler paths
  do not;
- shutdown ordering remains unchanged.

Run focused tests, the complete Vitest suite, all workspace type checks, and repository guards.

## Non-Goals

- no automatic TradingPromotion or champion runtime handoff;
- no static-superiority, equivalence, non-inferiority, or learned policy;
- no distinct-regime or forward-time generalization claim;
- no decision before exact terminal study outcome persistence;
- no more than one missing decision reconciled per scheduler cycle;
- no public command or UI;
- no multi-host consensus, provider-process adoption, private exchange access, signed request, order,
  or live authority;
- no claim that one same-baseline approval completes P0 or the Goal.

## Acceptance Criteria

1. Every exact terminal study outcome is eventually represented by one deterministic decision,
   regardless of whether the result supports adaptive allocation.
2. The just-completed outcome is decided before the default scheduler enters bounded wait.
3. Same-root process races publish one complete decision and accept only an exact semantic winner.
4. An approved automatic decision is available as provenance to the next uncontrolled Arena tick.
5. Unsupported and underpowered automatic decisions remain not approved and never select static.
6. Missing evidence, corruption, drift, orphan records, and clock regression fail before policy use.
7. Automatic creation grants research-policy selection authority only.
8. Focused races, full tests, type checks, and repository guards pass.

## Implementation Evidence

- `54cdbca` made decision publication create-only and reconciled exact concurrent winners.
- `fc8bf6b` added symmetric oldest-first terminal-outcome decision reconciliation.
- `72b8973` invoked one decision only after successful scheduler catch-up.
- `ea01ace` composed automatic decisions into the default runtime server and preserved opt-outs.
- Focused Store/Application/scheduler/server regression passed with 6 files and 127 tests.
- Full Vitest passed with 178 files and 2,858 tests.
- All workspace type checks and `npm run check:repo-guards` passed.

## Remaining Boundary

After this frontier, the default server can commit and execute one bounded study, create a symmetric
research-only decision for its terminal outcome, and expose an approved exact decision to later
uncontrolled Arena allocation. Distinct-regime and forward-time study selection, learned policy
parameters, automatic TradingPromotion, champion runtime handoff, multi-host ownership, and
longitudinal soak remain open.
