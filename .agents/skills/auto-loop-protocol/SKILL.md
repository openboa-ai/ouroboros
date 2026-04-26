---
name: auto-loop-protocol
description: Use when an autokairos worker must baseline, try one bounded change, measure it, and decide whether to keep, discard, reroute, or stop.
---

# Auto Loop Protocol

## Role

`auto-loop-protocol` is the common bounded-attempt contract.

## Use When

- The worker needs one experiment, patch, cleanup, or recovery attempt.
- Scope drift is likely.
- Evidence must decide whether the attempt survives.

## Workflow

1. Record baseline.
2. State one hypothesis.
3. Stay inside one owned boundary.
4. Measure with the narrowest valid check.
5. Decide keep, discard, reroute, or stop.
6. Emit handoff including writeback status.

## Required Output

- baseline
- one hypothesis
- owned boundary
- verification evidence
- keep/discard/reroute/stop decision
- `writeback_needed`

## Handoff

If a kept result changes durable repo truth, route to `llm-wiki`.

## Hard Boundaries

- Do not accumulate speculative edits.
- Do not claim improvement without evidence.
- Do not widen scope mid-loop.
- Do not self-schedule indefinitely.
