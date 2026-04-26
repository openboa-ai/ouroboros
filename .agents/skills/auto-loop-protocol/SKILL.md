---
name: auto-loop-protocol
description: Shared keep/discard protocol for autokairos project work. Use when a worker must baseline, try one bounded change, measure it, and decide whether to keep, revert, reroute, or stop.
---

# Auto Loop Protocol

## Role

`auto-loop-protocol` is the common bounded-attempt contract.

## Required Shape

- baseline
- one hypothesis
- owned boundary
- verification evidence
- keep, discard, reroute, or stop decision

## Hard Boundaries

- Do not accumulate speculative edits.
- Do not claim improvement without evidence.
- Do not widen scope mid-loop.
- Do not self-schedule indefinitely.
