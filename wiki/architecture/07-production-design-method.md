# Production Design Method

## Purpose

This page defines what "production-level design" means for autokairos before implementation.

Production-level here means implementation safety for the first solo-operator MLP, not enterprise
platform hardening.

## Design Bar

Every Bootstrap or runtime slice design must answer:

- who owns lifecycle
- who owns durable truth
- where validation and rejection happen
- how retry, idempotency, and recovery work
- where credentials and permissions live
- what trace, audit, and inspect surfaces exist
- what is explicitly deferred

If a design cannot answer those questions, implementation should not start.

## Current Runtime Doctrine

The active runtime doctrine is:

```text
External agents build or update trader-system artifacts.
autokairos registers, deploys, observes, gates, evaluates, promotes, and controls lifecycle.
TraderSystemProgram owns internal trading behavior.
RuntimeControl owns lifecycle/governance, not internal step orchestration.
```

It must not require a central finite-state machine or workflow engine.

## Required Production Sections

Each slice design should include:

| Section | Required answer |
| --- | --- |
| Lifecycle and ownership | which object starts, runs, stops, and recovers |
| Durable truth and schema boundary | what record is authoritative |
| Validation and rejection | when output is refused and how the reason is inspected |
| Idempotency and retry | how duplicate runs/actions are prevented or linked |
| Recovery and restart | what survives process/container/provider failure |
| Security and credentials | where secrets live and what never enters runtime context |
| Observability and audit | which trace/audit artifacts are required |
| Operator inspectability | what the operator can see without becoming the runtime |
| Explicitly deferred | what must not be implemented in this slice |

## Specific Active Boundaries

### `RuntimeControl`

- register, deploy, start, pause, resume, stop, inspect, override, kill
- validates against `RuntimeOperatingPolicy`
- produces `RuntimeControlDecision` and `RuntimeLifecycleEvent`
- does not choose internal market reactions, agent calls, scripts, or planner steps

### `RuntimeOperatingPolicy`

- bounds lifecycle, placement, trace, recovery, stop, gateway, and audit posture
- does not write trading behavior
- does not become a strategy workflow engine

### `TraderSystemProgram`

- owns internal behavior inside `HandsEnvironment`
- may call provider-backed agents if needed
- may emit `ProgramEvent`, `ToolRequest`, `OrderIntent`, artifacts, reviews, metrics, or
  candidate-version proposals
- cannot write evidence, promote itself, bypass `ToolProxy`, bypass `TradingGateway`, or mutate live
  in place

### `Trace -> Evidence`

- trace is recoverable runtime history
- evidence exists only after evaluation and sealing
- promotion cites counted evidence, not provider self-report or operator satisfaction

### `OrderIntent -> GatewayDecision`

- trader system proposes
- gateway accepts, rejects, or clips
- execution attempt links venue submission and fill results

## Deferred Production Concerns

These are not active Bootstrap requirements:

- real provider execution
- program execution
- package scanning or real grants
- external evaluator
- evidence sealing
- live gateway
- runtime control action APIs
- operator notification policy
- marketplace
- A2A networking

## Reading Test

A design is ready when a reader can explain:

- what autokairos owns versus what the trader system owns
- what can be restarted or replaced
- what record is authoritative
- what cannot bypass trace, tool proxy, gateway, evaluator, or audit
- why Bootstrap remains read-only substrate rather than product proof
