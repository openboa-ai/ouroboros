# Repo Read Order

Use this order before non-trivial coding work.

## Base Order

1. `AGENTS.md`
   Thin entry point
2. `.agents/AGENTS.md`
   Repo-local agent workflow rules
3. `ARCHITECTURE.md`
   Top-level system shape and boundaries
4. `docs/index.md`
   Current documentation tree
5. the most relevant file in `docs/exec-plans/active/`
   Current moving plan or discovery context
6. the closest stable contract in:
   - `docs/design-docs/`
   - `docs/product-specs/`

## Always Read When Relevant

- `docs/RELIABILITY.md`
  if the task affects liveness, failover, or safety intervention behavior
- `docs/SECURITY.md`
  if the task affects credentials, providers, sandboxes, or trust boundaries
- `docs/product-specs/live-trading.md`
  if the task affects live trading or execution policy
- `docs/design-docs/agent-runtime.md`
  if the task affects threads, turns, background work, or runtime boundaries

## Companion Upstream Skills

After orienting, pull in the needed upstream-derived skill from:

- `.agents/skills/agent-skills/`

Only load what matches the task.
Do not read the whole subset by default.
