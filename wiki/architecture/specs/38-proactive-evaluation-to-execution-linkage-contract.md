# Proactive Evaluation To Execution Linkage Contract

## Thesis

When proactive authority results in emitted work, autokairos should preserve one explicit causal
chain:

`ProactiveEvaluationRecord -> WakeTriggerRecord -> ExecutionRequest -> ExecutionAttempt`

## Why This Spec Exists

autokairos already distinguishes:

- proactive policy evaluation
- wake-trigger history
- governed execution requests
- execution attempts

That is still insufficient unless the architecture fixes how these layers remain causally linked.

Without this spec:

- proactive evaluation becomes durable but execution starts are not attributable to it
- `ExecutionRequest` keeps only coarse scheduler origin while losing the deeper why
- coalesced or suppressed proactive causes become hard to distinguish from emitted primary causes

## Canonical Object / Interface / Boundary

This spec defines the canonical linkage boundary between proactive evaluation history and execution
history.

It sits above:

- normalized proactive candidates
- `ProactiveEvaluationRecord`

And below:

- `WakeTriggerRecord`
- `ExecutionRequest`
- `ExecutionAttempt`

It is a causality contract, not one storage engine or one query implementation.

## Required Fields Or Required Behaviors

### 1. Evaluation-to-trigger linkage

Every emitted `WakeTriggerRecord` must remain attributable to one originating
`ProactiveEvaluationRecord`.

Required behavior:

- the wake record must preserve an originating proactive-evaluation reference or equivalent durable
  linkage
- the system must not need scheduler logs to explain which evaluation emitted the wake

### 2. Trigger-to-request linkage

Every proactively emitted `ExecutionRequest` must preserve:

- exactly one primary `WakeTriggerRecord`
- zero or more coalesced `WakeTriggerRecord`s

Required behavior:

- the request header may duplicate the primary wake cause for fast reads
- the one-to-many wake-origin linkage remains the durable home of primary versus coalesced causes

### 3. Evaluation-to-request traceability

From one `ExecutionRequest`, the system must be able to recover:

- the primary `WakeTriggerRecord`
- the originating `ProactiveEvaluationRecord`
- any additional coalesced wake origins that materially shaped the request

The request may carry denormalized evaluation references for convenience, but should not become the
canonical owner of proactive causality.

### 4. Non-emitted outcomes remain linked

Not every `ProactiveEvaluationRecord` emits work.

Required behavior:

- suppressed, coalesced, escalated, and rejected evaluations must still preserve their downstream
  disposition
- "no emitted request exists" must itself remain a durable explainable outcome, not a missing link

### 5. Attempt inheritance without ownership confusion

`ExecutionAttempt` may copy primary proactive provenance for operator joins and debugging.

Required behavior:

- attempts may denormalize primary wake and evaluation references
- attempts must not become the canonical owner of wake precedence or proactive causality

## Lifecycle Or State Model

The stable causal path is:

`normalized candidate -> ProactiveEvaluationRecord -> WakeTriggerRecord emitted or suppressed -> ExecutionRequest when emitted -> ExecutionAttempt when launched`

The important invariant is that each downstream step should preserve enough linkage to walk back to
the earlier proactive cause.

## What This Is Not

This contract is not:

- one join table design
- one foreign-key strategy
- one scheduler implementation
- one direct runtime callback chain
- a requirement that every object duplicate every upstream identifier

It only fixes the causal spine that must remain reconstructable.

## Failure Modes / Invariants

### Invariants

- every proactively emitted request remains attributable to one originating proactive evaluation
- primary and coalesced causes remain distinguishable
- suppressed or escalated proactive evaluations remain durably explainable even when no request
  exists
- runtime loss does not destroy the causal path from proactive evaluation into execution history

### Failure modes

- request provenance stops at `origin = scheduler`
- a wake record exists with no recoverable evaluation cause
- an emitted request can name a wake trigger but not the evaluation that justified it
- coalesced causes disappear once execution starts
- operators can explain a request only from logs or memory

## Relationship To Adjacent Specs

- [36-proactive-evaluation-record-contract.md](36-proactive-evaluation-record-contract.md)
  defines the append-only proactive evaluation record at the start of this chain.
- [23-wake-trigger-record-contract.md](23-wake-trigger-record-contract.md)
  defines the adjacent trigger-history object produced from proactive evaluation.
- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
  defines the governed invocation object that preserves the emitted wake cause.
- [13-execution-attempt-contract.md](13-execution-attempt-contract.md)
  defines the concrete execution object that may denormalize, but should not own, this causality.
- [29-execution-record-store-contract.md](29-execution-record-store-contract.md)
  defines the first persisted execution-store shapes that should keep this linkage durable.
