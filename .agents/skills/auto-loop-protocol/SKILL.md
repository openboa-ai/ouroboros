---
name: auto-loop-protocol
description: Use when a worker needs a bounded attempt loop: establish baseline, try one hypothesis, measure evidence, and decide whether to keep, discard, reroute, or stop without accumulating speculative edits.
---

# Auto Loop Protocol

## Role

`auto-loop-protocol` is the common bounded-attempt contract.

## Workflow

1. Record baseline.
2. State one hypothesis.
3. Stay inside one owned boundary.
4. Measure with the narrowest valid check.
5. Decide keep, discard, reroute, or stop.
6. Emit handoff including writeback status.

## Required Output

- goal
- baseline
- owned boundary
- one hypothesis
- verification evidence
- decision: `keep`, `discard`, `reroute`, or `stop`
- next owner
- `writeback_needed`

## Handoff

If a kept result changes durable repo truth, route to `llm-wiki`.

## Hard Boundaries

- Do not accumulate speculative edits.
- Do not claim improvement without evidence.
- Do not widen scope mid-loop.
- Do not self-schedule indefinitely.
