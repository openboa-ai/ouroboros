# PR2 Design: Candidate Becomes Externally Evaluated

## Goal

Answer:

**Why should I trust this candidate?**

PR2 proves one `TraderSystemCandidate` can run under an evaluation binding and produce externally
judged evidence.

## Canonical Flow

```text
TraderSystemCandidate
-> TradingSystemImage + CapabilityPackage refs
-> AgentRuntimeUnit refs + PodCommunicationPolicy
-> backtest StageBinding
-> TradingSystemPod run
-> Trace
-> EvidenceRecord
-> hold / reject / live-gate-ready
```

## Ownership And Boundaries

- runtime bridge launches the pod
- trace sink stores what happened
- evaluator judges outside the pod
- evaluation-and-progression owns evidence meaning
- control-plane persists status and gate readiness

PR2 must not make agent self-report, custom tool results, A2A task artifacts, remote-agent
messages, or outcome rubrics count automatically.

## Minimum Objects

- `StageBinding`
- `TradingSystemPod`
- `AgentRuntimeUnit`
- `PodCommunicationPolicy`
- `Trace`
- `EvidenceRecord`
- `PromotionDecision` only when live-gate readiness is reached

## Operator Surface

The operator must see:

- which candidate artifact ran
- which binding was used
- which packages were active
- which runtime units or communication artifacts were trace context only
- what counted
- what did not count
- why the candidate is held, rejected, or live-gate ready

## Risks And Failure Modes

- evaluated artifact differs from candidate artifact
- evidence is only agent narration
- evidence is only A2A or remote-agent output
- convenience mode is treated as legitimate
- live gate appears without evidence basis

## Production Readiness

PR2 is production-designed when evaluation can advance, hold, or reject a candidate without
turning runtime self-report into truth.

### Lifecycle And Ownership

```text
candidate selected
-> evaluation StageBinding resolved
-> bounded_batch_evaluation AgentLoopPolicy applied
-> TradingSystemPod run emits Trace
-> evaluator judges outside the pod
-> EvidenceRecord sealed as counted or non-counted
-> PromotionDecision or ReviewItem records gate readiness, hold, or reject
```

- runtime bridge owns pod launch under evaluation binding
- trace sink owns raw run chronology
- evaluator owns judged evidence output
- evaluation-and-progression owns evidence meaning and stage status
- control-plane owns durable status, review, and promotion records

### Durable Truth And Schema Boundary

- trace is raw chronology, not evidence
- custom tool output, A2A artifact, remote-agent message, or outcome rubric is not counted evidence
  until evaluator seals it
- `EvidenceRecord` must link to candidate, image/package refs, binding, trace, evaluator identity,
  and legitimacy mode
- `PromotionDecision` must cite evidence basis; it cannot cite provider narration alone

### Validation And Rejection

PR2 must reject or hold when:

- evaluated artifact does not match the candidate artifact
- binding profile is incomplete or convenience-only
- trace is missing or partial beyond evaluator tolerance
- evaluator cannot distinguish counted from non-counted evidence
- promotion eligibility is ambiguous

### Idempotency And Retry

- rerun creates a new evaluation attempt or links to a prior attempt; it does not overwrite sealed
  evidence
- duplicate evidence for the same trace/evaluator pair should be rejected or superseded explicitly
- ambiguous evidence leads to hold or review, not automatic promotion

### Recovery And Restart

- partial evaluation remains inspectable as incomplete trace/evaluation context
- sealed evidence must survive runtime restart
- promotion readiness can be reconstructed from evidence records and review items, not runtime
  memory

### Security, Observability, And Operator Inspectability

- evaluator secrets and hidden labels stay outside candidate packages and agent context
- operator must see what counted, what did not count, evaluator/legitimacy posture, and why the
  candidate is held, rejected, or live-gate-ready

## Test And Acceptance Criteria

- one candidate produces trace from an evaluation binding
- evaluator creates counted or non-counted evidence
- evidence links to candidate/image/package/runtime-unit/binding when applicable
- operator can explain status from product records
- candidate is not live

## Explicitly Deferred

- live execution
- order intent
- wake/intervention
- self-evolution rollout
