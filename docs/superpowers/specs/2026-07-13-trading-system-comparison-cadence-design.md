# TradingSystem Comparison Cadence Design

**Status:** Approved under the operator's standing autonomous implementation authority

## Goal

Make a real sandboxed TradingSystem consume and acknowledge a comparison tick after activation so
the existing external paper evaluator can close a qualified two-checkpoint comparison. Preserve the
core authority boundary: the TradingSystem owns decision cadence; Gateway serves public market data
and records delivery; external Evaluation decides qualification.

This frontier proves eligible denominator closure. It does not claim candidate improvement,
adaptive-allocation benefit, market generalization, economic authority, or live authority.

## Observed Blocker

The retained six-replication prospective study closes every slot, but each source comparison uses
one checkpoint. Its first tick precedes activation, so a positive `minimum_elapsed_ms` cannot be
met even though both individual paper evaluations qualify. The study therefore has 12
`evidence_ineligible` slots and no credible comparison denominator.

The runtime already provides the necessary authority-safe protocol:

1. `GET /market/snapshot` may include an exact `comparison_tick_context`;
2. the TradingSystem may return that exact context to `POST /comparison/tick/ack`;
3. the session service binds delivery and acknowledgement to role, TradingRun, tick, request count,
   and time;
4. the external checkpoint coordinator records a new order or no-order continuity.

Both executable families in a real source comparison originally read the provider once at startup
and emitted only heartbeats afterward: the fixture champion in `fixtures/trading-systems/clock.py`
and the research-generated challenger copied from `artifacts/trading-system/run.py`. A first
implementation changed only the champion. The next two-checkpoint run then isolated the failure:
both champion processes stopped, while the two generated challengers in replication 1 exceeded
1,900 heartbeats without a later provider read. The cadence contract must therefore be carried by
both standalone artifacts.

After both artifacts implemented polling, the next run exposed the owning orchestration gap. Each
arm persisted checkpoint 1 with `next_action: serve_and_acknowledge_current_tick`, but produced zero
new delivery or acknowledgement records. The arm composition never called
`enableComparisonTickAttributionSide`, so the provider correctly returned ordinary market payloads
forever. A 25 ms candidate cadence then exhausted the 100-request cap; a 1,000 ms cadence delayed
that symptom but could not create missing authority. The runtime must explicitly enable the current
tick for both role-bound sessions after the external checkpoint reaches its acknowledgement phase.

## Alternatives

### 1. TradingSystem-owned provider polling and acknowledgement

Enhance the opaque clock fixture and generated TradingSystem template so each artifact's own
`--interval-ms` loop reads the paper provider. When a response carries a new
`comparison_tick_context.delivery_ref.id`, post the exact context to the ack endpoint and remember
the delivery ID. Repeated delivery of the same context is read but not acknowledged again.

This is the selected design. It exercises the real process, HTTP provider, session hooks, Store
authority, and external checkpoint path without moving decision authority into Ouroboros.

### 2. Gateway or session automatic acknowledgement

The runtime could acknowledge a tick immediately after serving it. This would make tests fast, but
it would falsely claim that the TradingSystem consumed the tick and would let Gateway manufacture
decision continuity. Reject this approach.

### 3. Test-harness acknowledgement

The prospective harness could call the endpoint for each process. This would validate Store and
coordinator mechanics but not the candidate runtime. Reject it as synthetic evidence.

## Runtime Behavior

`clock.py` and generated `run.py` keep their initial market-driven order behavior unchanged. They
remain separate because each generated artifact is a sealed standalone closure and cannot import a
repository fixture. When `TRADING_API_BASE_URL` is present, each subsequent artifact cadence
performs one market read. If no comparison context is present, it emits the normal heartbeat and
waits. If a context is present:

1. require an object context with a non-empty `delivery_ref.id`;
2. if the ID matches the last acknowledged delivery, do not post it again;
3. otherwise post the context without modification to `/comparison/tick/ack`;
4. require a structurally valid acknowledgement ref and digest;
5. remember the delivery ID, then continue the heartbeat loop.

The artifact does not call Binance, private APIs, credentials, or an order-submission endpoint. It
does not emit a second OrderRequest merely to satisfy the evaluator. The acknowledged market read,
continued process heartbeat, and absence of a new order allow the external evaluator to record
no-order continuity.

A malformed context, failed request, or malformed acknowledgement remains a process failure. There
is no automatic ack, synthetic hold, or evaluator fallback.

## Arm Attribution Wiring

`ResearchControlCampaignPaperRuntimeArm` exposes one arm-local operation:

```ts
enableComparisonTickAttribution(input: {
  activationAttemptId: string;
  tickId: string;
}): Promise<void>
```

The operation reloads the exact activation attempt and tick from that arm's Store, builds the
existing role-bound `PaperTradingComparisonTickIOWriteContext` for champion and challenger, and
delegates both calls to `PaperTradingSessionService.enableComparisonTickAttributionSide`. It does
not deliver a snapshot or acknowledge on the candidate's behalf.

When both matched source windows classify as `waiting_tick_acknowledgements`, the source-window
coordinator invokes this operation for each arm before its no-op window advance. Repeated calls are
idempotent for the same attempt and tick. If either arm cannot enable exact attribution, the
coordinator stops both owned runtimes and records the existing source-window transition failure.

## Checkpoint Ownership Composition

`PaperTradingComparisonCheckpointCoordinator` owns the in-process open-attempt token created by
`beginNext` and required by `completeNext`. It is therefore an arm-lifetime coordinator, not a
window-driver-lifetime helper. Recreating it for every source-window advance preserves Store
records but loses the non-transferable ownership token and correctly fails with
`paper_trading_comparison_checkpoint_not_owned`.

The runtime arm composes one checkpoint coordinator beside its activation owner and shares it
across every window driver created for that arm. Tick coordinators remain driver-local because a
repeated tick must use the exact frozen market-data view and clock supplied for that transition.
Different arms still receive different checkpoint coordinators and cannot share ownership.

## No-op Window Determinism

The matched source-window coordinator classifies an exact pair of snapshots before selecting a
transition. A `none` decision is returned directly as an immutable no-op step; it is not delegated
to a driver that reloads mutable Store state. Candidate acknowledgements can arrive between those
operations, so reclassification would create a TOCTOU race where a driver built with a no-read
market port unexpectedly selects `capture_next_tick`.

This short-circuit does not delay or synthesize a candidate decision. The next executor iteration
reloads acknowledgements and selects the newly eligible transition. Mutating transitions continue
through the real driver, with one shared frozen market snapshot for matched repeated ticks.

## Matched Arm Progress Barrier

Candidate acknowledgements arrive independently in each arm even though the source comparison is
advanced as one matched pair. Two normal intermediate states can therefore expose different local
transitions for the same checkpoint sequence:

- one arm is ready to `capture_next_tick` while its peer still reports nonterminal `none` in
  `waiting_tick_acknowledgements` or `checkpoint_committed`;
- one open checkpoint is ready to `complete_next_checkpoint` while its peer still reports
  nonterminal `none` in `views_advanced`.

The source-window coordinator treats only those exact two-arm combinations as a synchronization
barrier. It projects both already classified decisions as immutable `none` steps and reloads on the
next executor iteration. It does not capture a tick, complete a checkpoint, read market data, or
advance either driver until both arms select the same mutating transition.

Both decisions must be nonterminal and carry the same checkpoint sequence. Partial repeated-tick
persistence remains governed by its separate contiguous recovery rule. Any other transition,
terminal-state, or sequence divergence remains a graph error and fails closed.

## Sandbox Runtime Identity

`safeRuntimeId` is a bounded path/display slug, not a complete process identity. Comparison sandbox
IDs share a long activation-attempt prefix and place the role/run discriminator after that prefix;
truncating at 80 characters therefore mapped champion and challenger to the same log and heartbeat
files. Their Store evidence then contained cross-role OrderRequests and made repeated checkpoint
attribution timing-dependent.

Every runtime file key includes a digest of the full instance ID, as PID files already do. Persisted
sandbox log, runtime heartbeat, and command-evidence IDs use the same collision-resistant identity
when the bounded slug would truncate. Short existing IDs retain their current readable identity.
The adapter must prove two long same-prefix sessions have isolated file contents and distinct
evidence IDs.

## Prospective Protocol

Keep the same precommitted six replications, real arm-local Stores, real deterministic subprocesses,
real loopback providers, controlled read-only BTCUSDT market data, and effect-free restart replay.
Change only the frozen comparison window needed to test the new cadence:

- `minimum_observation_count: 2`;
- `maximum_observation_count: 2`;
- `minimum_elapsed_ms: 25`;
- sandbox TradingSystem cadence of 1,000 ms, independent from the evaluator's 25 ms interval;
- all other paper, schedule, request-count, authority, and release policies unchanged.

The independent cadence is required by the product model and the frozen request budget. A 25 ms
candidate poll exposed the missing arm wiring by exhausting the 100-request provider cap;
1,000 ms preserves 100 seconds of bounded candidate polling while still fitting the 10-second
observation drain and 600-second outer comparison window. Cadence does not substitute for explicit
role-bound attribution enablement.

Expected classification is 12 pair-qualified source verdicts. Equal candidates are
`source_not_improved`, not evidence-ineligible and not an improvement. The six-replication study may
remain six ties with p-value 1 and no allocation-policy eligibility.

## Verification

Artifact contract tests:

- run the real clock fixture and generated candidate template against real loopback paper providers;
- serve `undefined`, context 1, repeated context 1, then context 2 across startup and three cadence
  reads;
- assert the exact context bodies are acknowledged in order;
- assert repeated context 1 is not acknowledged twice;
- retain initial order and heartbeat behavior.

Arm wiring tests:

- prove the runtime-arm factory reloads the exact attempt and tick and enables both role contexts;
- prove matched waiting source windows enable both arms before retrying;
- prove one arm enablement failure stops both owned runtimes and fails the transition closed.
- prove successive drivers from one arm share checkpoint ownership while separate arms do not.
- prove a ready next-tick capture waits for its acknowledgement-lagging peer without a market read;
- prove a ready open checkpoint waits for its acknowledgement-lagging peer without driver advance.

Prospective integration:

- assert all 12 terminal statuses are `source_not_improved`;
- assert pair, champion, and challenger qualification reasons are empty;
- assert exact provider/sandbox start-stop symmetry;
- assert six completed ties, no policy decision, unchanged promotion state, and effect-free restart.

Run focused artifact, provider/session, comparison, and prospective tests, then workspace typechecks,
repository guards, and the full test suite.

## Next Decision

If the qualified study remains tied, retain that negative result and next isolate candidate behavior:
prove that a challenger can emit a distinct post-activation decision and produce a non-tied paper
outcome under a frozen market path. Do not start market-condition generalization until the
same-baseline study has qualified non-tied evidence.
