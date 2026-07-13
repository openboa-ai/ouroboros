# Post-Activation TradingSystem Decision Design

**Status:** Approved by the standing autonomous-execution instruction

**Goal:** Make a running comparison TradingSystem emit a causally attributable decision for each
new sequence-2-or-later market delivery before acknowledging that delivery, so external Evaluation
can consume distinct candidate behavior without a log-read race.

## Context Read

This design follows the repository doctrine and the current implementations in:

- `AGENTS.md`
- `docs/candidate-arena-evaluation-protocol.md`
- `docs/candidate-arena-research-goal.md`
- `docs/superpowers/specs/2026-07-11-comparison-served-tick-attribution-design.md`
- `docs/superpowers/specs/2026-07-11-repeated-paired-comparison-checkpoint-design.md`
- `docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md`
- `packages/application/src/trading/gateway/runtime-binding.ts`
- `packages/application/src/trading/paper/events.ts`
- `packages/application/src/trading/paper/observation.ts`
- `packages/application/src/trading/paper/session-service.ts`
- `artifacts/trading-system/run.py`
- `fixtures/trading-systems/clock.py`

The current bounded study proves qualified sequence-2 observations, but all pair results are ties.
Both executable artifact families acknowledge a delivered post-activation tick without emitting a
new TradingSystem decision. The event parser can bind a decision only to the acknowledgement ref and
digest returned by `POST /comparison/tick/ack`.

That ordering has a protocol race. The acknowledgement is persisted before the HTTP response gives
its ref and digest to the candidate. The comparison coordinator can observe the persisted
acknowledgement and prepare the checkpoint before the candidate appends an acknowledgement-bound
event. A sleep, polling delay, or scheduler assumption cannot make that ordering causal.

## Alternatives Considered

### 1. Add a second decision-ready endpoint

The candidate could acknowledge, append its event, then post a readiness marker. This preserves the
current raw event fields, but adds a new state transition and either a new persisted record family or
an in-memory signal that cannot survive recovery. It also makes acknowledged silence require an
extra synthetic protocol step. This is not selected.

### 2. Send the decision through the acknowledgement endpoint

The candidate could include a decision in `POST /comparison/tick/ack`, allowing the provider to
persist or reconstruct it. This collapses TradingSystem output into the provider hook and makes the
Gateway-side boundary appear to synthesize candidate events. It also duplicates the sandbox log as
the current candidate output contract. This is not selected.

### 3. Bind the event to delivery, then acknowledge after the event is durable

The candidate already receives an immutable role-bound delivery ref and digest with the frozen
market view. It can bind its decision to that delivery, append the event, and only then acknowledge
the exact context. The acknowledgement remains the externally persisted proof that the candidate
completed consumption. This creates a one-way causal order without another record family and is the
selected approach.

## Protocol

Startup and sequence 1 remain compatible:

1. The sandbox starts and emits its initial decision from the provider snapshot available before
   comparison attribution is enabled.
2. The evaluator commits the first paired checkpoint.
3. The candidate later receives and acknowledges sequence 1 without emitting a duplicate decision.

For each new sequence-2-or-later delivery, the TradingSystem owns this order:

```text
GET /market/snapshot
-> receive exact comparison_tick_context and delivery
-> GET /account/state
-> build TradingSystemDecision
-> POST /orders/validate when the decision is an OrderRequest
-> append one delivery-bound decision event to the sandbox log
-> POST /comparison/tick/ack with the exact context
```

The event ID is stable per instance, event kind, and tick sequence. Re-reading the same delivery
does not append or acknowledge it again. A failed append produces no acknowledgement. A failed
acknowledgement may leave a non-economic event in the log, but no repeated checkpoint can commit
until the exact acknowledgement exists. Recovery still stops or reconstructs owned comparison
state and never fabricates the missing acknowledgement.

`hold` and `no_action` are explicit TradingSystem decisions and follow the same ordering. A
TradingSystem may intentionally emit no new event and then acknowledge; this remains acknowledged
silence and produces no-order continuity. The fixture and generated artifact emit their actual
bounded decision for sequence 2+ so distinct strategies become observable.

## Event Attribution Contract

Raw parsed TradingSystem events use this optional all-or-none pair:

```ts
comparison_tick_delivery_ref?: Ref;
comparison_tick_delivery_digest?: string;
```

The ref kind must be `paper_trading_comparison_tick_delivery`, the ID must be non-empty, and the
digest must use canonical `sha256:` syntax. No other `comparison_tick_*` event fields are accepted.

For a repeated checkpoint, every newly consumed event must match the exact `delivery_ref` and
`delivery_digest` carried by that role's persisted acknowledgement. The session service already
validates that the acknowledgement belongs to the current role, TradingRun, tick, and persisted
delivery. The observation continues to persist:

```ts
paper_trading_comparison_tick_acknowledgement_ref
paper_trading_comparison_tick_acknowledgement_digest
```

Those observation fields prove completed tick consumption. Delivery-bound raw events prove which
immutable input caused each decision. They serve different evidence roles and should not share a
name.

## Taxonomy Decision

- **Vocabulary sources considered:** repository `TradingSystemDecision`, `PaperEvidence`, and
  comparison delivery/acknowledgement records; HTTP request/response ordering; Gateway-owned
  `MarketDataPort` boundaries.
- **Naming problem:** the current raw event field names describe a later completion record rather
  than the immutable input that caused the event.
- **Concept axes:** event provenance, delivery lifecycle, acknowledgement lifecycle, role/run
  ownership, paper-only authority, and persisted compatibility.
- **Canonical vocabulary:** `comparison_tick_delivery_ref` and
  `comparison_tick_delivery_digest` for raw event provenance; existing acknowledgement names for
  persisted observation completion evidence.
- **Project-local terms coined:** none.
- **Source terms preserved:** `TradingSystemDecision`, `OrderRequest`, delivery,
  acknowledgement, Gateway, Ledger, and PaperTradingEvaluation retain repository meanings.
- **Compatibility names or aliases:** none for raw event attribution. Persisted observation fields
  are unchanged because they represent acknowledgement evidence, not an alias.
- **Names to avoid extending:** raw event `comparison_tick_acknowledgement_ref` and
  `comparison_tick_acknowledgement_digest`.
- **Migration decision:** direct internal protocol replacement. Sandbox log events are runtime
  inputs, not a public compatibility surface; accepting both forms would preserve the race and
  weaken fail-closed validation. Historical design documents remain historical and this document
  explicitly supersedes only their raw-event attribution ordering.
- **Review evidence:** parser, repeated-checkpoint preparation, executable artifact, generated
  candidate, coordinator regression, and prospective study tests.
- **writeback_needed:** yes; update the canonical evaluation protocol and the active evidence
  program after executable proof exists.

## Artifact Behavior

Both `fixtures/trading-systems/clock.py` and `artifacts/trading-system/run.py` will separate these
operations:

- parse and validate one comparison context;
- build one post-activation decision from the delivered market and account;
- attach exact delivery attribution and a sequence-stable event ID;
- append the event before acknowledgement;
- acknowledge the exact context only after the append succeeds;
- advance `last_delivery_id` only after a valid acknowledgement response.

The generated artifact retains candidate-specific strategy edits. Trend-following and
mean-reversion variants must therefore emit opposite decisions on the same non-flat frozen market
snapshot. Funding-aware or other explicit hold variants emit an attributed hold.

## Evaluation And Non-Tied Proof

The first executable proof is deliberately smaller than the adaptive/static study:

1. Freeze one comparison commitment, market path, account policy, cost policy, cadence, and request
   cap.
2. Run two distinct candidate artifacts through the real provider, sandbox, Gateway, Ledger, and
   paired checkpoint path.
3. Require both sides to remain pair-qualified.
4. Require at least one repeated checkpoint to consume a delivery-bound decision from each side.
5. Require a non-tied source verdict caused by the candidate decisions, with no peer leakage and no
   promotion or live-authority change.

Only after this proof passes may the prospective adaptive/static study use the behavior. A single
non-tied pair proves mechanism, not adaptive-agent leverage, profitability, statistical power, or
generalization.

## Failure Semantics

- Malformed or partial delivery attribution becomes candidate protocol negative evidence.
- A delivery-bound event for a stale, peer, or different-tick delivery fails preparation before
  Ledger preview.
- Missing acknowledgement remains a non-economic waiting state.
- Acknowledged silence remains valid no-order continuity.
- Candidate append failure creates no acknowledgement and cannot advance the evaluator.
- Provider validation rejection remains candidate evidence and cannot gain order authority.
- Request caps, deadlines, symmetric cleanup, restart rules, paper-only authority, and external
  Evaluation ownership remain unchanged.

## Acceptance

1. Parser tests accept exact delivery-bound order, cancel, hold, and no-action events and reject
   partial, malformed, acknowledgement-named, or extra-authority attribution.
2. Repeated preparation consumes only events matching the acknowledgement's exact delivery and
   rejects stale or cross-delivery events before Ledger preview.
3. The fixture and generated artifact append one sequence-2 decision before posting its exact
   acknowledgement and deduplicate repeated delivery.
4. Sequence 1 produces no duplicate post-start decision.
5. Existing acknowledged-silence behavior remains valid.
6. A real frozen-path comparison produces pair-qualified, non-tied evidence from distinct
   post-activation decisions.
7. No Gateway code synthesizes a TradingSystem decision; no private/live endpoint, credential,
   order-submission authority, promotion change, or peer decision enters either candidate.
8. Focused tests, application/runtime typechecks, repository guards, and the full suite pass.

## Out Of Scope

- Claiming adaptive research effectiveness from one mechanism test.
- Changing qualification thresholds, source verdict statistics, promotion, or live authority.
- Adding a public command or operator UI.
- Adding a readiness record or decision endpoint.
- Supporting legacy acknowledgement-bound raw events as aliases.
