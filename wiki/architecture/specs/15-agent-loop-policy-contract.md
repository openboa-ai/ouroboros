# Agent Loop Policy Contract

## Purpose

This page defines the minimum runtime-autonomy contract for `TradingSystemPod` execution.

It exists to preserve agent-driven behavior without leaving implementers to invent hidden workflow
engines or one-shot runners.

## Thesis

`AgentLoopPolicy` defines the envelope around an autonomous agent loop.

It does not tell the agent what to think or which step to take next.

It tells autokairos:

- why the loop starts
- how long it may run
- how often it may wake or act
- which tools it may request
- when it must stop
- how trace must be exported
- whether retry or resume is allowed

The control plane owns the loop boundary. The agent owns the reasoning loop inside that boundary.

## Current Active Applicability

This spec is active for PR1 through PR4.

It defines the minimum loop posture for:

- PR1 candidate builder runs
- PR2 evaluation runs
- PR3 bounded live trading pods
- PR4 interruption and intervention behavior

## What This Is Not

`AgentLoopPolicy` is not:

- a central finite-state machine that directs every agent step
- an agent prompt
- an evaluator
- a promotion rule
- a live risk policy
- a scheduler for arbitrary future agent fleets

The agent may still choose observations, reasoning, tool requests, and candidate proposals inside
the allowed envelope.

## Loop Modes

| Mode | Used by | Meaning |
| --- | --- | --- |
| `one_shot_builder` | PR1 | one bounded provider run produces candidate materialization input |
| `bounded_batch_evaluation` | PR2 | one candidate runs under evaluation binding until batch completion, timeout, or failure |
| `continuous_live` | PR3 / PR4 | one promoted candidate remains active under live binding until stopped, failed, or superseded |

## Minimum Contract

An `AgentLoopPolicy` must carry at least:

| Field | Meaning |
| --- | --- |
| `agent_loop_policy_id` | stable policy identity |
| `loop_mode` | `one_shot_builder`, `bounded_batch_evaluation`, or `continuous_live` |
| `trigger_source` | what starts the loop: operator request, evaluation request, governed execution request, wake/intervention |
| `cadence_policy` | whether the loop is one-shot, batch-bounded, periodic, market-event-driven, or wake-driven |
| `max_turns` | optional provider turn cap where supported |
| `timeout_policy` | wall-clock or idle timeout |
| `cancellation_policy` | who may cancel and what trace must be retained |
| `retry_policy` | whether retry creates a new attempt or resumes the same provider session |
| `resume_policy` | whether provider session resume is allowed |
| `trace_export_required` | must be true for active MLP work |
| `tool_access_posture` | allowed tool classes and whether side effects require proxy approval |
| `stop_conditions` | explicit conditions that end the loop |

## PR-Specific Defaults

| Slice | Loop mode | Required default |
| --- | --- | --- |
| Bootstrap | none / fixture only | no provider execution |
| PR1 | `one_shot_builder` | single `codex_cli` run with schema output |
| PR2 | `bounded_batch_evaluation` | run until evaluation trace is complete or rejected |
| PR3 | `continuous_live` | live loop continues while heartbeat, limits, and gateway policy remain valid |
| PR4 | `continuous_live` plus interruption | pause, stop, and override may interrupt the loop without deleting trace |

## Ownership Rules

- control plane owns the durable policy record
- runtime bridge applies the policy when launching runtime units
- provider adapter translates the policy into provider-specific flags where possible
- tool proxy enforces side-effecting tool access
- trace store records loop events and provider events

## Failure Modes

The design is failing if:

- PR1 is implemented as an unbounded provider session
- PR3 is implemented as a one-shot command with no heartbeat or continuation contract
- the control plane micromanages every agent thought/action
- retry mutates previous durable attempts instead of creating or linking explicit attempts
- cancellation deletes the only trace of what happened

## Relationship To Adjacent Specs

This spec is used by:

- [07-runtime-bridge-interface.md](07-runtime-bridge-interface.md)
- [06-containerized-execution.md](06-containerized-execution.md)
- [12-governed-execution-request-contract.md](12-governed-execution-request-contract.md)
- [13-execution-attempt-contract.md](13-execution-attempt-contract.md)

It preserves the boundaries defined in:

- [04-boundaries.md](04-boundaries.md)
