# PR4 Design: Live Pod Remains Controllable

## Goal

Answer:

**Can I stay in control after delegation?**

PR4 proves one live `TradingSystemPod` can wake, explain, pause, stop, override, and route
self-evolution into versioned evaluation.

## Canonical Flow

```text
live TradingSystemPod
-> AgentRuntimeUnit / TeamTrace context
-> wake condition
-> WakeTriggerRecord
-> operator inspect context
-> pause / stop / override
-> operator action audit
-> optional CandidateVersion for self-evolution
```

## Ownership And Boundaries

- proactive-operations owns wake semantics
- control-plane owns wake records, operator actions, audit, candidate versioning
- agent-system/trading-substrate provide live pod context
- runtime-unit communication records are inspect context, not operator commands by themselves
- live pod may propose improvement but cannot mutate itself in place

## Minimum Objects

- `WakePolicy`
- `WakeTriggerRecord`
- `OperatorActionRecord`
- `CandidateVersion`
- `TeamTrace` when more than one agent runtime unit participates
- live pod inspect read model

## Operator Surface

The operator must see:

- why they were woken
- which live pod is affected
- candidate/image/package/binding context
- runtime-unit and communication context when relevant
- recent order intents and gateway decisions
- pause, stop, override options
- whether a proposed change became a candidate version

## Risks And Failure Modes

- wake is noisy
- inspect context is too technical
- pause/stop does not clearly act on the live pod
- override bypasses audit
- multi-agent messages make it unclear who caused the wake
- live self-evolution happens in place

## Production Readiness

PR4 is production-designed when intervention preserves control without making the operator the
hidden runtime again.

### Lifecycle And Ownership

```text
live pod context
-> wake policy evaluation
-> WakeTriggerRecord
-> operator inspect context
-> pause / stop / override
-> OperatorActionRecord
-> resume, remain stopped, reject, or CandidateVersion for re-evaluation
```

- proactive-operations owns wake reason and urgency semantics
- control-plane owns wake trigger records, operator actions, audit, and candidate versioning
- agent-system and trading-substrate provide live context but do not own operator action truth
- live pod may propose improvement, but evolution is clone/version plus evaluation

### Durable Truth And Schema Boundary

- every wake must have a durable reason, severity, affected pod/candidate refs, and inspect context
- every operator action must have actor, action type, target live pod, timestamp, reason, and
  outcome
- pause/stop/override are not chat commands; they are durable operator actions
- self-evolution creates `CandidateVersion`; it does not mutate the live pod in place

### Validation And Rejection

PR4 must reject or require review when:

- wake reason is missing or too vague
- inspect context cannot identify affected candidate/pod/execution attempt
- pause/stop target is ambiguous
- override would bypass risk/gateway/audit boundaries
- proposed live mutation does not create a candidate version for evaluation

### Idempotency And Retry

- repeated wake triggers for the same unresolved condition should be linked or coalesced by policy,
  not silently duplicated as independent incidents
- pause and stop must be safe to retry against the same live pod target
- override retry must preserve chronology and not erase the prior action attempt

### Recovery And Restart

- unresolved wakes remain visible after runtime restart
- live pod control posture must be reconstructable from wake records, operator actions, execution
  attempts, and gateway decisions
- post-intervention outcome must be explicit: resume, remain paused/stopped, reject, or create
  candidate version for evaluation

### Security, Observability, And Operator Inspectability

- operator action authority remains outside agent runtime
- audit history must show wake reason, inspect context, action taken, and resulting posture
- operator must see enough context to act without reading raw provider logs first
- multi-agent context may explain a wake, but cannot become the operator action itself

## Test And Acceptance Criteria

- one meaningful wake is durable
- operator can inspect live pod context
- pause and stop are decisive
- override is audited
- improvement creates a candidate version for evaluation
- multi-agent context remains traceable when it explains the wake

## Explicitly Deferred

- enterprise incident management
- multi-operator escalation
- marketplace governance
- broad live fleet management
