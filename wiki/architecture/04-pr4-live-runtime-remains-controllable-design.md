# PR4 Design: Live Runtime Remains Controllable

## Goal

Answer:

**Can I stay in control after delegation?**

PR4 proves one live `TraderSystemRuntime` can be inspected, paused, stopped, overridden, killed, and
audited without making the operator the hidden runtime and without letting live self-evolution mutate
in place.

## Canonical Flow

```text
live TraderSystemRuntime
-> RuntimeControl action
-> RuntimeOperatingPolicy validation
-> RuntimeControlDecision
-> RuntimeLifecycleEvent
-> OperatorActionRecord / Audit
-> resume, remain paused/stopped, kill, reject, or CandidateVersion for re-evaluation
```

## Ownership And Boundaries

- control-plane owns runtime-control decisions, operator actions, audit, and candidate versioning
- runtime connector owns placement interruption, stop, kill, trace export, and recovery mechanics
- agent-system/trading-substrate provide live runtime context
- agent-session communication records are inspect context, not operator commands by themselves
- live runtime may propose improvement but cannot mutate itself in place

## Minimum Objects

- `RuntimeControl`
- `RuntimeOperatingPolicy`
- `RuntimeControlDecision`
- `RuntimeLifecycleEvent`
- `OperatorActionRecord`
- `CandidateVersion`
- `TeamTrace` when more than one agent session participates
- live runtime inspect read model

## Operator Surface

The operator must see:

- which live runtime is affected
- candidate/spec/program/package/binding context
- runtime placement and live status
- recent order intents and gateway decisions
- recent program/provider events summarized through trace
- pause, resume, stop, override, and kill options
- whether a proposed change became a candidate version

## Production Readiness

PR4 is production-designed when intervention preserves control without making the operator the
hidden runtime again.

### Durable Truth And Schema Boundary

- every operator action must have actor, action type, target live runtime, timestamp, reason, and
  outcome
- pause, resume, stop, override, and kill are not chat commands; they are durable control actions
- lifecycle effects are recorded as `RuntimeLifecycleEvent`
- self-evolution creates `CandidateVersion`; it does not mutate the live runtime in place

### Validation And Rejection

PR4 must reject or require review when:

- inspect context cannot identify affected candidate/runtime/execution attempt
- pause/stop/kill target is ambiguous
- override would bypass risk/gateway/audit boundaries
- proposed live mutation does not create a candidate version for evaluation

### Idempotency And Retry

- pause, resume, stop, and kill must be safe to retry against the same live runtime target
- override retry must preserve chronology and not erase the prior action attempt
- repeated operator actions should link to prior unresolved action state rather than silently fork
  hidden control histories

### Recovery And Restart

- restart must preserve latest runtime lifecycle state
- if placement failure occurs during intervention, recovery uses trace, placement history,
  execution attempt, gateway decisions, and substrate state
- if safe resume is unavailable, runtime remains paused/stopped or requires operator review

## Explicitly Deferred

- proactive operator notification policy
- enterprise incident management
- multi-operator escalation
- broad alert-routing systems
- full A2A remote-agent mesh

## Test And Acceptance Criteria

- operator can inspect live runtime context in product terms
- pause and stop are decisive and auditable
- kill is available as emergency termination
- override is durable and cannot bypass gateway/audit boundaries
- self-evolution creates a new candidate version for evaluation
- no live in-place mutation occurs
