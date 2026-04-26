# Agent System

This section defines the execution-side subsystem around provider-backed agent sessions, sandboxed
hands environments, and trader-system program execution.

The active model is:

```text
TraderSystemRuntime
-> RuntimePlacement
-> HandsEnvironment + AgentSession
-> RuntimeProviderAdapter
-> external provider or harness
-> AgentEvent / ProgramEvent
-> Trace
```

The agent system does not own durable candidate truth, evidence, promotion, or live authority.

## What This Section Owns

- provider-backed `AgentSession` attachment and continuity
- `RuntimeProviderAdapter` posture for concrete invocation surfaces
- sandbox or container-backed `HandsEnvironment` setup boundaries
- `TraderSystemProgram` execution support from the runtime side
- provider `AgentRun` and `AgentEvent` export into trace
- runtime-local interruption, stop, and failure handling as requested by `RuntimeControl`
- trace export sufficient for recovery, evaluation, and audit

## What This Section Does Not Own

- durable `TraderSystemCandidate` truth
- durable `TraderSystemSpec` or `CapabilityPackage` records
- stage-binding authority
- counted evidence meaning
- promotion and live-gate meaning
- exchange credential custody
- A2A task or artifact legitimacy
- control-plane audit history
- the trader system's internal strategy choices

## Current Active Docs

- [01-overview.md](01-overview.md)
- [02-execution-lifecycle.md](02-execution-lifecycle.md)
- [03-state-and-ownership.md](03-state-and-ownership.md)

Older runtime-driver and production-agent notes are preserved under
[../historical/agent-system/](../historical/agent-system/) and are not active baseline.

## Active Spec Gate

The current supporting specs are:

- [../specs/06-containerized-execution.md](../specs/06-containerized-execution.md)
- [../specs/07-runtime-connector-contract.md](../specs/07-runtime-connector-contract.md)
- [../06-runtime-provider-adapter-feasibility.md](../06-runtime-provider-adapter-feasibility.md)
- [../specs/15-runtime-operating-policy-contract.md](../specs/15-runtime-operating-policy-contract.md)
- [../specs/12-governed-execution-request-contract.md](../specs/12-governed-execution-request-contract.md)
- [../specs/13-execution-attempt-contract.md](../specs/13-execution-attempt-contract.md)

## One Sentence Summary

The agent system lets deployed trader systems use external agent providers and hands environments
without letting those providers become autokairos truth owners.
