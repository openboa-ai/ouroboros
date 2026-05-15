---
name: auto-loop-protocol
description: "Use when a worker needs a bounded attempt loop for one hypothesis: capture baseline, measure evidence, then keep, discard, reroute, or stop without accumulating speculative edits."
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

## Attempt Contract

```text
baseline:
hypothesis:
owned_boundary:
expected_signal:
verification:
decision:
```

## Decision Criteria

- `keep`: evidence supports the expected signal and no blocker remains.
- `discard`: evidence disproves the hypothesis or the change cannot be made safe.
- `reroute`: the next useful action belongs to another owner or boundary.
- `stop`: the user asked to stop, the work is complete, or further attempts would be speculative.

## Loop Rules

- One active hypothesis at a time.
- A failed attempt must produce evidence, not another unbounded attempt.
- New scope requires a new route through `auto-project` or `auto-pm`.

## Required Output

- goal
- context read
- baseline
- owned boundary
- one hypothesis
- verification evidence
- decision: `keep`, `discard`, `reroute`, or `stop`
- risks
- next owner
- `writeback_needed`

## Handoff

If a kept result changes durable repo truth, route to `llm-wiki`.

## Hard Boundaries

- Do not accumulate speculative edits.
- Do not claim improvement without evidence.
- Do not widen scope mid-loop.
- Do not self-schedule indefinitely.
