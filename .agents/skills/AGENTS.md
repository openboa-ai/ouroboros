# Repo Skill Registry

`.agents/skills/` contains the repo-local project harness skills.

The harness is for building this repository. It is not the autokairos product runtime, not a
TraderSystem scheduler, and not an agent mesh.

## Active Buckets

Core workers:

- `auto-project`: project harness scheduler and routing owner
- `auto-pm`: bounded frontier and PR contract owner
- `auto-coding`: implementation and verification worker
- `auto-qa`: functional evaluation and veto worker
- `llm-wiki`: source/wiki maintenance and repo-memory writeback worker

Shared protocols:

- `auto-loop-protocol`
- `auto-handoff-protocol`
- `auto-run-memory`
- `auto-promotion-protocol`
- `auto-eval-rubrics`
- `auto-garbage-collection`

Optional utilities:

- `brain-autokairos`
- `ci-recovery`
- `harness-skill-audit`

## Routing Rules

Use this order:

1. Use `auto-project` when a task needs PR ownership, routing, or next-owner selection.
2. Use one core worker when the requested stage is explicit.
3. Use a shared protocol when a worker needs a common keep/discard, handoff, memory, promotion, or
   cleanup contract.
4. Use an optional utility for focused support that should not own the project loop.

Do not route every task through every skill. One active owner is the default.

## Boundary Rules

- `auto-project` may schedule repo work; it must not describe product runtime behavior.
- `auto-pm` may lock PR scope; it must not implement.
- `auto-coding` may implement; it must verify and keep/discard one bounded attempt.
- `auto-qa` may veto; it must not fix by default.
- `llm-wiki` owns source/wiki ingest, wiki health checks, and durable PR/frontier/run writeback.

When a worker completes, it should return a handoff packet rather than self-scheduling indefinitely.
