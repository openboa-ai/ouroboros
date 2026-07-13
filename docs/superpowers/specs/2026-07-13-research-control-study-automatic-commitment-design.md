# ResearchControlStudy Automatic Commitment Design

**Status:** Approved for implementation under the standing autonomous Goal mandate

## Goal

Let the long-running runtime server commit one bounded `ResearchControlStudy` automatically when
an exact Trading review source and paper protocol exist. The commitment must be deterministic,
idempotent across same-host server processes sharing one LocalStore root, visible through scheduler
status, and authority-closed. It must not create an unbounded queue, infer evaluation policy from
mutable runtime defaults, or create a policy decision, TradingPromotion, order, private read, or
live authority.

## Why This Frontier Is Next

The server scheduler now discovers and executes committed studies continuously, and the execution
lease prevents two same-host processes from opening the same study. No product path commits a
study, so the autonomous path still requires a test or caller to create the first durable unit of
work. This leaves the AAR-inspired generate, evaluate, remember, and adapt loop structurally
present but operationally unable to start a controlled replication on its own.

Automatic commitment is the smallest next step. Automatic policy replacement and promotion remain
separate because study evidence must exist before either can be considered.

## Scope And Vocabulary

`ResearchControlStudy` remains the only persisted pre-effect commitment. Add no parallel job,
request, intent, run, or scheduler record.

Use `ResearchControlStudyCommitmentCoordinator` for the internal application component that
decides whether one study should exist before a scheduler discovery cycle. Use
`ResearchControlStudyCommitmentPolicy` for its immutable repository policy. These are internal
component and configuration names, not new evidence nouns and not public commands.

The coordinator result is operational status only:

- `committed`: this cycle created the exact study;
- `existing`: the exact study already exists;
- `deferred`: prerequisites are absent or another incomplete study owns the bounded queue.

## Considered Approaches

### Commit once during server startup

Rejected. It is simple but misses a TradingPromotion created after startup and therefore is not a
long-running control loop.

### Run an independent commitment scheduler

Rejected. A second poll loop duplicates timing, start/stop, failure, and cross-process behavior.
It can also race the execution scheduler and makes shutdown ownership harder to reason about.

### Ensure commitment before each existing scheduler cycle

Selected. The existing `ResearchControlStudyScheduler` already owns immediate startup, bounded
polling, terminal failure, and shutdown interruption. One explicit coordinator call before each
supervisor cycle makes a newly committed study discoverable in the same cycle without overlap or
busy polling.

## Repository Commitment Policy

Version 1 is fixed and exported as `RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY`:

```text
policy_version = research-control-study-commitment-v1
trigger = latest_trading_promotion
maximum_incomplete_study_count = 1
replication_count = 6
tick_count_per_arm = 1
maximum_baseline_regular_file_count = 10000
maximum_baseline_total_bytes = 1000000000
```

Six replications are the existing minimum for the fixed paired exact sign-test design. One tick per
arm is the smallest complete controlled campaign and bounds provider, sandbox, and paper effects.
The baseline limits make existing runtime defaults explicit in the commitment intent.

The policy is research scheduling authority only. A code change and normal repository review are
required to alter it; no environment variable or provider output may silently change it.

## Exact Prerequisites

On each scheduler cycle the coordinator reads exact Store evidence and proceeds only when:

1. no different `ResearchControlStudy` remains incomplete;
2. one latest valid `TradingPromotion` exists;
3. the promotion's referenced confirmation campaign reloads exactly and matches its ref and digest;
4. the promoted candidate and candidate version are the source;
5. the currently selected managed research-agent identity has exact provider, model, permission,
   and identity digest;
6. the source SystemCode artifact and baseline Store snapshot satisfy existing runtime checks.

Absence of a promotion or the presence of an incomplete study returns `deferred` and waits for the
normal bounded poll. Corrupt, stale, mismatched, or missing referenced evidence fails the scheduler
closed with stable attribution.

## Paper Protocol Reconstruction

The coordinator does not invent a mutable paper policy. It reloads the immutable confirmation
campaign named by the latest TradingPromotion and copies:

- `comparison_policy`;
- `market_data_configuration_digest`;
- `paper_policy_identity`.

It derives only the already-defined v1 schedule shape:

```text
source_start_order = paired_by_sequence
maximum_active_source_pairs = 2
maximum_cross_arm_first_tick_skew_ms = comparison.maximum_start_skew_ms
source_missed_start_policy = slot_expired
confirmation_precommit_deadline_ms = comparison.maximum_elapsed_ms
```

The normal campaign decision computes and validates the protocol digest. The automatic path passes
the expected TradingPromotion identity into preparation so a concurrent promotion change fails
before commitment instead of mixing an old source with a new comparator.

## Deterministic Identity And Queue Bound

One automatic intent key hashes canonical data containing:

- commitment-policy version and all numeric bounds;
- TradingPromotion ID and exact digest;
- confirmation-campaign ID and exact digest;
- promoted candidate and candidate-version refs;
- managed research-agent identity digest;
- derived paper-protocol input.

The study idempotency key and six replication keys derive only from that digest. The baseline
snapshot and `committed_at` are intentionally not identity inputs: one race winner freezes those
values, and every contender must accept or reject that exact winner.

Before creating a new key, the coordinator defers when any other study has no terminal outcome.
This keeps the automatic queue at one. An exact existing key returns `existing`, whether pending or
complete. A new TradingPromotion or reviewed policy version can produce a new key only after the
previous study closes.

## Cross-Process Atomicity

`LocalStore.recordResearchControlStudy` currently checks then renames through a shared temporary
path, which is insufficient for two processes creating one deterministic study concurrently.
Strengthen this record family with create-only publication:

1. serialize validated bytes to a unique temporary file in the target directory;
2. atomically hard-link that complete file to the final encoded record path;
3. remove the temporary link;
4. on `EEXIST`, reload the winner and require exact equality or return a stable append-only conflict.

Readers can see either no record or one complete JSON record, never partial bytes. Orphan unique
temporary files are ignored by collection reads. No existing record may be overwritten.

Two automatic coordinators may prepare different baseline snapshots or timestamps. Exactly one
study wins publication. A loser reloads the winner and accepts it only when recomputing the
automatic intent from the winner yields the same deterministic key and exact source, comparator,
agent, protocol, and campaign policy. Otherwise it fails closed.

## Scheduler And Server Composition

Add the coordinator as an optional explicit dependency of `ResearchControlStudyScheduler`.
Immediately before each supervisor start, the scheduler calls `ensureCommittedStudy`. The returned
operational result becomes `last_commitment` in scheduler status. Existing schedulers without the
dependency preserve their exact status shape.

`buildServer` creates the default coordinator from:

- the initialized LocalStore;
- the current CandidateArena research-agent selection and existing agent factory;
- the repository commitment policy;
- the repository root and exact clock.

Automatic commitment is enabled whenever the default study scheduler is enabled. The explicit
injected scheduler path and `runResearchControlStudiesOnStart: false` remain deterministic escape
hatches for tests and operators. There is no public command or UI in this frontier.

## Failure Semantics

- no TradingPromotion: defer;
- another incomplete study: defer without creating a later queue item;
- exact automatic study already exists: return existing;
- promotion changes during preparation: fail the attempt before publication and retry next cycle;
- malformed promotion, campaign, source, protocol, agent, or persisted study: fail closed;
- exact same-key create race: one winner, other contenders reload and accept the winner;
- same-key semantic mismatch: fail closed as an append-only conflict;
- coordinator failure: scheduler becomes terminal and does not open a study;
- server stop during execution: existing scheduler and execution-lease shutdown semantics apply.

No deferred or failure status becomes Finding, Lineage, rank, allocation, paper, policy, or
promotion evidence.

## Tests

### LocalStore

- two independent stores publishing the same exact study both return one exact record;
- two different records with one deterministic ID produce one winner and one stable conflict;
- the final file is complete and temporary files are not collection records;
- existing sequential idempotency and campaign-precedence checks remain unchanged.

### Commitment coordinator

- no promotion defers without snapshot or write effects;
- any incomplete study defers a new intent;
- exact existing automatic intent is idempotent;
- promotion graph reconstructs the exact protocol and source;
- policy produces six deterministic replications and one-tick campaign bounds;
- a promotion change during preparation fails before publication;
- a same-key cross-process winner reload is accepted only after exact intent validation;
- corrupt or mismatched source, agent, promotion, protocol, or winner fails closed.

### Scheduler and server

- commitment runs before discovery and a new study executes in the same cycle;
- deferred commitment preserves bounded polling;
- commitment failure is terminal and opens no runtime;
- status exposes only bounded `last_commitment` metadata;
- default server composition uses the current selected agent and repository policy;
- disabled or explicitly injected scheduler paths do not create studies;
- shutdown ordering remains scheduler first.

Run focused tests, the complete Vitest suite, all workspace type checks, and repository guards.

## Non-Goals

- no automatic `ResearchAllocationPolicyDecision`;
- no automatic TradingPromotion or champion handoff;
- no second study while any study is incomplete;
- no outcome-aware early stopping or changed inference policy;
- no multi-host consensus, network filesystem, or PID-namespace claim;
- no generic job queue or new public command/UI;
- no provider-process adoption, private exchange access, signed request, order, or live authority;
- no claim that one same-baseline study proves distinct-regime generalization or completes P0.

## Acceptance Criteria

1. A default server with an exact TradingPromotion and no incomplete study commits one bounded study
   before discovery without an operator command.
2. A promotion created after startup is considered within one normal scheduler poll interval.
3. Same-host servers sharing one LocalStore publish at most one exact study for one automatic intent.
4. No automatic path creates more than one incomplete study.
5. Source, agent, comparator, protocol, bounds, and replication identities are exact and
   deterministic before campaign effects.
6. Missing prerequisites defer; corrupt or drifted evidence fails before study execution.
7. Automatic commitment grants research scheduling authority only and creates no downstream
   decision or trading authority.
8. Focused races, full tests, type checks, and repository guards pass.

## Remaining Boundary

After this frontier, a server can create and execute one exact controlled study per reviewed source.
Automatic policy-decision creation, distinct-regime/forward-time study scheduling, automatic
promotion, champion runtime handoff, multi-host ownership, and longitudinal soak remain open.
