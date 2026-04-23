# ADR 0021: Proactive Rebuild Progress And Action History

## Status

Accepted

## Context

autokairos already fixes:

- explicit rebuild requests
- detached rebuild workers
- operator remediation when automated recovery blocks

That still leaves one visibility gap.

Recovery now needs stable answers to three questions:

- what concrete rebuild attempt actually ran?
- what is the current rebuild progress posture right now?
- what manual action changed the recovery path after blocked or failed automation?

Without explicit answers, recovery remains too dependent on transient logs and operator memory.

## Decision

autokairos will preserve proactive-standing recovery through:

- append-only rebuild-attempt history
- one rebuildable current progress view
- append-only operator-action history

The architecture keeps flexible:

- task runtime
- progress granularity
- dashboard and workflow product

But fixes:

- concrete attempt chronology
- current progress read semantics
- durable operator action history for unblock and remediation

## Alternatives Considered

### 1. Reuse rebuild request only and skip attempt history

Rejected because request state alone cannot explain what concrete recovery actually ran.

### 2. Put all progress in worker logs and metrics only

Rejected because blocked recovery and manual follow-up need durable control-plane visibility.

### 3. Treat operator remediation as UI state with no durable action record

Rejected because audit and later diagnosis would be too weak exactly where manual recovery matters.

## Consequences

### Positive

- operators can distinguish requested, running, blocked, failed, and completed recovery more
  clearly
- restarts and supersession preserve attempt chronology
- manual intervention becomes citeable instead of implicit

### Negative

- one more projection and history family must be implemented
- progress semantics now need explicit freshness handling

## Supersedes / Superseded By

- Extends [0020-proactive-standing-rebuild-and-remediation.md](0020-proactive-standing-rebuild-and-remediation.md)
- Superseded by: none

## Date / Owner

- Date: 2026-04-19
- Owner: Codex
