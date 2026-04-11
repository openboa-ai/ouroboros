# Orchestrator And Agents

AutoKairos should behave like one managed-agent system embedded inside one local trading app.

This document defines the runtime contract for the agent side of that system.

## Core Concepts

- `orchestrator`
  The local control plane that creates sessions, schedules work, routes provider usage, applies
  policy, and decides when evaluation or promotion flows should run.
- `agent`
  A provider-neutral worker definition declared inside the workspace asset. Agents are the units of
  responsibility the orchestrator runs.
- `environment`
  The configured execution surface an agent is allowed to use. Environments define runtime/tool
  boundaries and should remain easier to replace than the higher-level architecture.
- `session`
  A durable unit of work for one agent in one environment.
- `events`
  The ordered append-only record of session activity. This is the durable session truth, not just
  a model context window.

## Runtime Responsibilities

### Orchestrator

The orchestrator owns:

- session creation and lifecycle
- environment selection
- background work scheduling
- retries and failure policy
- promotion and checkpoint coordination
- provider routing through provider adapters
- translation between workspace state and agent execution

### Agents

Agents own task-level work such as:

- inspecting code, docs, and data
- proposing or materializing future strategy changes
- generating evaluation artifacts
- interpreting evidence
- producing summaries the live lane may later consume

Agents do not own the live safety boundary.

### Environments

Environments should be treated as replaceable execution surfaces.

- They may contain tools, mounted files, and runtime dependencies.
- They are where agent hands act.
- They are not where permanent credentials should live.

### Sessions And Event Logs

Sessions should remain durable outside any one model context window.

- context trimming or summarization may happen in the harness
- durable ordered session truth should stay recoverable from event logs
- replay, inspection, and export should be able to trace back to this durable session history

## Managed-Agent Adaptation

AutoKairos follows Anthropic's managed-agent mental model, but adapts it for a local,
workspace-centered, trading-specific system.

What AutoKairos keeps:

- `agent / environment / session / events` as the core runtime vocabulary
- `brain / hands / session` separation
- provider-neutral agent definitions
- durable session/event history outside the model context window

What AutoKairos changes:

- the durable session home is the workspace asset, not a hosted service
- the control plane is local and application-owned
- the system is optimized for one installable trading app, not a general external agent platform
- the live path is separated into an execution core bounded context that is not just another agent

## Control Plane vs Execution Plane

The orchestrator and the execution core are different bounded contexts.

### Orchestrator Side

- may inspect code, docs, data, and runtime context
- may coordinate backtests, paper runs, shadow evaluation, imports, exports, and artifact
  promotion
- may route work across Codex and Claude provider adapters

### Execution Core Side

- owns live order placement
- owns protective-stop invariants
- owns hard intervention logic
- remains narrower and structurally harder to mutate than the rest of the agent system

## Working Rules

- live execution must never depend directly on an unreviewed experimental workspace
- all live-impacting changes must pass isolated backtest and isolated paper trading
- model failures may block new entries
- execution invariant failures may trigger stronger intervention
- every live position must have an exchange-native protective stop
- critical safety decisions belong to the execution core, not to agents

## Current Open Design Question

- whether v1 live should remain a single promoted strategy version or eventually allow several
  promoted live sub-strategies with central allocation
