# Repo Skill Registry

`.agents/skills/` contains repo-local skills. Skills are bounded capabilities loaded on demand, not
always-on policy. Always-on policy belongs in [../AGENTS.md](../AGENTS.md).

The harness builds this repository. It is not the autokairos product runtime, not a
TraderSystem scheduler, and not an agent mesh.

## Workflow Map

Use the smallest skill set that fits the work.

| Phase | Default skill | Use when |
| --- | --- | --- |
| Recover | `auto-run-memory` | current PR/frontier/state must be reconstructed from repo evidence |
| Frame | `brain-autokairos` | product thesis or architecture boundary needs a concise repo-grounded answer |
| Shape | `auto-project` | ownership, route, stop state, or PR/frontier direction is unclear |
| Shape | `auto-pm` | a rough request needs one bounded frontier with acceptance and validation |
| Execute | `auto-coding` | one bounded code/docs change must be made and verified |
| Evaluate | `auto-qa` | a frontier needs scenario/regression pressure or a veto/pass judgment |
| Evaluate | `auto-eval-rubrics` | a worker needs shared pass/fail language |
| Evaluate | `ci-recovery` | GitHub Actions or local checks fail and need root-cause routing |
| Persist | `llm-wiki` | durable source/wiki/project-memory writeback is needed |
| Clean | `auto-garbage-collection` | stale docs, duplicate memory, or old run notes block resumption |
| Clean | `harness-skill-audit` | the skill surface itself may need merging, removal, or rewrite |

## Default Routing

1. If the next owner is unclear, start with `auto-project`.
2. If the task is already bounded, use the matching worker directly.
3. Use shared protocols only when the active worker needs that contract.
4. End every worker path with a handoff packet.
5. Before stopping, decide `writeback_needed: yes/no`.
6. If `writeback_needed: yes`, route to `llm-wiki`.

One active owner is the default. Do not route every task through every skill.

## Mandatory llm-wiki Gate

Use `llm-wiki` when any of these become durable:

- product thesis or architecture decision
- source ingestion, source interpretation, or synthesis update
- PR/frontier/run outcome
- CI recovery result that affects future work
- skill routing, harness policy, or repo workflow rule
- active/historical documentation boundary
- read-path or stale-term cleanup

`llm-wiki` is not required for:

- read-only inspection with no durable conclusion
- discarded local experiments with no future relevance
- transient command output already captured by CI or git history

Chat history is not durable memory. If a future agent needs the result to resume safely, write it
back through `llm-wiki`.

## Handoff Packet

Every worker should return:

- `goal`
- `owned_boundary`
- `evidence`
- `decision`: `keep`, `discard`, `reroute`, `blocked`, or `ready`
- `next_owner`
- `writeback_needed`
- `llm_wiki_target` when writeback is needed

## Boundary Rules

- `auto-project` schedules repo work, not product runtime behavior.
- `auto-pm` locks scope and acceptance; it does not implement.
- `auto-coding` implements one bounded change and verifies before keeping it.
- `auto-qa` can veto; it does not fix by default.
- `ci-recovery` extracts actionable check evidence; it does not broaden the PR.
- `llm-wiki` owns source/wiki ingest, wiki health checks, and durable writeback.
- Do not create a second wiki-writeback skill. Use `llm-wiki`.
