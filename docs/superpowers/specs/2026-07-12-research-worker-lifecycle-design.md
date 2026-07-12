# ResearchWorker Lifecycle Design

**Status:** Approved for implementation

## Goal

Make one logical `ResearchWorker` persist across CandidateArena ticks with a stable workspace,
sanitized notebook continuity, and reconstructible bounded-budget history. Recover safely after
process loss without recreating evaluator-held sealed state, retrying an old commitment, or
granting unused development budget to a later tick.

This frontier closes lifecycle evidence. It does not claim that a provider process, sandbox, or
sealed evaluator session survives restart.

## Why This Frontier Is Next

CandidateArena already persists pre-effect allocation, direction, worker, source SystemCode, and
`ResearchPreflightCommitment`. It also closes successful research through evaluation, Finding,
lineage, admission, and optional candidate materialization. The remaining lifecycle gap is between
those endpoints:

- direction and worker IDs are regenerated for every tick;
- the notebook is a tick-local file and is not consumed by the next invocation;
- worker status remains `active` after a thrown process;
- a commitment can remain permanently open after host-process loss;
- no durable record distinguishes a completed worker step from fail-closed recovery;
- per-tick budget exists, but its consumption and closure do not form a worker history.

The Goal requires restart-safe longitudinal autonomy and a worker-owned workspace, notebook,
budget, and multiple experiment opportunities. The next bounded frontier is therefore durable
logical worker continuity, not broader allocation learning or production process adoption.

## Source Interpretation

Anthropic's Automated Weak-to-Strong Researcher treats repeated research attempts, external
evaluation, and retained findings as a search process. It does not establish that an in-memory
researcher process or hidden evaluator state should be reconstructed after failure. Ouroboros must
preserve the useful longitudinal unit - worker direction, public development learning, causal
findings, and resource history - while refusing to recreate one-shot sealed admission state.

The resulting mental model is:

```text
stable logical ResearchWorker
-> new tick allocation and new pre-effect commitment
-> bounded development work in an isolated candidate run
-> one terminal ResearchWorkerCheckpoint
-> sanitized notebook and closed budget carried to the next new commitment
```

## Considered Approaches

### 1. Resume the old process and commitment

Rejected. The sealed evaluator seed and generated suite are intentionally process-local. Rebuilding
them would resample admission evidence; persisting them would widen the worker-visible attack
surface. An old commitment is terminally closed after process loss.

### 2. Treat each tick as a new worker and rely only on Findings

Rejected. This preserves population memory but does not provide worker-owned notebook, budget, or
lifecycle continuity and cannot explain orphan commitments.

### 3. Persist and replay the complete tick-local notebook

Rejected. The file contains paths, commands, event locations, agent metadata, and mutable local
state. Carrying it forward is unnecessary and makes continuity depend on stale run directories.

### 4. Reuse a stable worker and append terminal sanitized checkpoints

Selected. A worker is stable for one exact direction and managed-agent identity. Every tick still
gets isolated artifact bytes and a new commitment. A terminal checkpoint carries bounded public
development summaries, closed budget accounting, and a previous-checkpoint link. Restart either
reconstructs an already persisted terminal admission or fails the orphan closed.

## Canonical Vocabulary

Add one canonical noun: `ResearchWorkerCheckpoint`.

It is append-only lifecycle evidence that one stable ResearchWorker's exact preflight commitment
was closed. It can authorize sanitized notebook continuation into a later new commitment. It has
no evaluation, admission, promotion, order, private, credential, or live authority.

`ResearchWorker` changes from a tick-scoped invocation identity to a stable logical candidate
generator bound to one ResearchDirection and exact managed-agent profile. Candidate execution and
sealed evaluation remain tick-scoped.

## Stable Identity And Workspace

CandidateArena creates or reuses:

- one deterministic `ResearchDirection` per canonical `direction_kind` and market scope;
- one deterministic `ResearchWorker` per direction, provider kind, model identity, and managed
  agent profile ID;
- one relative workspace key `candidate-arena-workers/<research_worker_id>`.

New ResearchWorker records declare `research_worker_checkpoint_v1`. Historical tick-scoped records
remain readable and are excluded from checkpoint recovery.

Changing direction, provider, model, or managed-agent profile creates a new worker. Changing a tick,
source candidate, allocation, or preflight suite does not. Candidate artifact edits stay in the
existing isolated `candidate-arena-runs` tree; the stable worker workspace owns only sanitized
notebooks and continuity material.

## Persisted Checkpoint

Add version-1 `ResearchWorkerCheckpointRecord` with:

- exact worker, direction, tick, commitment ref, and commitment digest;
- exact workspace key;
- optional exact previous checkpoint ref and digest;
- current submission limit and recorded development submission count;
- cumulative committed and recorded submission counts;
- zero remaining submission authority;
- a bounded cumulative notebook summary containing only development-visible entries;
- terminal status `completed` or `failed_closed`;
- terminal reason `admission_recorded`, `execution_failed`, or `restart_recovery`;
- an exact CandidateAdmissionDecision ref only for `completed/admission_recorded`;
- close time, canonical checkpoint digest, notebook-continuation authority, and closed downstream
  authority fields.

One commitment has exactly one checkpoint. One worker's checkpoints form one contiguous chain.
Unused budget is evidence, not authority: every terminal checkpoint records zero remaining
submission authority, and the next tick receives a newly allocated budget.

## Sanitized Notebook Contract

The durable summary keeps at most the latest six entries across checkpoints. Each entry contains:

- tick ID and local iteration;
- `keep`, `discard`, or `crash` decision;
- development score and compact summary;
- development evaluation status and risk decision;
- development net revenue;
- agent edit status.

It excludes scenario payloads, provider request bodies, evaluator seeds, sealed suite identity,
sealed outcome, paper evidence, artifact paths, event paths, commands, stdout, stderr, credentials,
and private/live data. Summary text is length bounded.

The next run starts a fresh tick-local notebook with the prior checkpoint summary in a separate
`prior_checkpoint` field. Current entries remain empty at start, so prior experiments cannot count
against or masquerade as current submissions. The agent prompt receives only the compact prior and
current summaries.

## Closure And Recovery State Machine

Normal closure:

1. resolve the stable worker and latest checkpoint;
2. persist a new commitment before worker effects;
3. run bounded development and at most one sealed submission;
4. persist evaluation, Finding, lineage, and admission;
5. materialize only when all existing admission rules pass;
6. append `completed/admission_recorded` checkpoint with sanitized notebook and closed budget.

Immediate failure after commitment:

1. do not fabricate evaluation, admission, Finding, or candidate evidence;
2. read only notebook entries already durably written;
3. append `failed_closed/execution_failed`;
4. return the existing failed direction result.

Restart recovery before any new worker effect:

1. scan only checkpoint-enabled commitments without a checkpoint, oldest first;
2. if an exact persisted admission binds the commitment, append
   `completed/admission_recorded` without replaying effects;
3. otherwise append `failed_closed/restart_recovery`;
4. never regenerate or claim the old sealed suite;
5. never rerun the old artifact, provider, sandbox, or development budget;
6. allow the next tick to create a new commitment using only the sanitized checkpoint history.

Recovery is idempotent. A corrupt, forked, future-dated, cross-worker, or noncontiguous checkpoint
graph fails closed and prevents a new effect for that worker.

## Admission Binding

New CandidateArena admission records bind the exact ResearchPreflightCommitment ref and digest.
The fields remain optional for historical readability, but the checkpoint-enabled path requires
them. This gives recovery a direct terminal graph instead of inferring one from filenames or
mutable run directories.

## Store Integrity

LocalStore enforces:

- strict runtime shape, canonical timestamps, bounded summary text, finite scores and net revenue;
- exact worker lifecycle protocol and workspace key;
- exact worker/direction/commitment identity and digest;
- close time at or after commitment time;
- one checkpoint per commitment and append-only exact replay;
- exact previous checkpoint/digest and contiguous oldest-to-newest worker chain;
- current and cumulative budget arithmetic with zero remaining authority;
- `completed/admission_recorded` iff an exact commitment-bound admission exists;
- no admission ref on failed-closed checkpoints;
- canonical checkpoint digest and closed downstream authority.

## Read Model And Feedback

This frontier does not add raw checkpoint data to the public Operator read model. The existing tick
result remains the operator-facing status. Later workers receive their own sanitized prior notebook
plus existing released CandidateArena Finding context. They do not receive another worker's raw
notebook or any sealed evidence.

## Non-Goals

- reviving a provider process, sandbox, evaluator handle, or old commitment;
- persisting or exposing an evaluator seed or sealed scenario;
- retrying unused budget from a failed tick;
- provider-dollar accounting or learned allocation;
- cross-provider notebook transfer;
- automatic promotion, production scheduling, private data, or live exchange behavior;
- proving the complete longitudinal-autonomy soak or AI-agent baseline axes.

## Acceptance

The frontier is complete when tests prove:

- the same direction and exact managed-agent identity reuse one worker and workspace across ticks;
- provider, model, profile, or direction changes create a distinct worker;
- each tick uses a distinct commitment and isolated candidate run;
- completed and immediate-failure paths append exact terminal checkpoints;
- restart closes an orphan commitment before any next worker effect and never replays it;
- restart reconstructs an already persisted admission as completed without materialization replay;
- notebook history is bounded, sanitized, restart-stable, and visible to the next same worker only;
- prior entries do not consume current budget and unused budget authority is always zero;
- malformed, forked, mismatched, corrupt-digest, or authority-bearing checkpoints fail closed;
- historical tick-scoped workers and admissions remain readable but cannot enter v1 recovery;
- focused tests, typechecks, repository guards, product-loop regression, and the full suite pass.
