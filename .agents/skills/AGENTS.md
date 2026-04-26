# Generic Skill Registry

`.agents/skills/` contains reusable project-harness skills. Skills are bounded capabilities loaded
on demand, not always-on policy. Always-on policy belongs in [../AGENTS.md](../AGENTS.md).

This harness works on a repository. It is not the product runtime for any specific project.

## Project Operating Flow

Use the smallest skill set that fits the work. A normal project loop is:

```text
Recover -> Context -> Shape -> Execute -> Evaluate -> Promote -> Persist -> Clean
```

Do not force every task through every phase. Skip directly to the right owner when the frontier is
already bounded and current evidence is known.

| Phase | Default skill | Use when |
| --- | --- | --- |
| Recover | `auto-run-memory` | current branch, task, assumptions, failed attempts, or evidence must be reconstructed from repo state |
| Context | `project-context` | current repo thesis, domain, constraints, active docs, or wiki-grounded context is needed |
| Shape | `auto-project` | ownership, route, stop state, or work direction is unclear |
| Shape | `auto-pm` | a rough request needs one bounded frontier with acceptance and validation |
| Execute | `auto-coding` | one bounded code/docs/config change must be made and verified |
| Evaluate | `auto-qa` | a frontier needs scenario, regression, edge-case, or reader acceptance pressure |
| Evaluate | `auto-eval-rubrics` | a worker needs shared pass/fail language |
| Evaluate | `ci-recovery` | local checks or remote CI fail and need root-cause routing |
| Promote | `auto-promotion-protocol` | a frontier, branch, release, or PR needs a landing/readiness decision |
| Persist | `llm-wiki` | durable source/wiki/project-memory writeback is needed |
| Clean | `auto-garbage-collection` | stale docs, duplicate memory, or old run notes block resumption |
| Clean | `harness-skill-audit` | the skill surface itself may need merging, removal, or rewrite |

## Phase Evidence

- Recover produces a `Recovered State Packet`: current branch, frontier, latest accepted assumptions,
  failed attempts, winning evidence, open risks, owner, and writeback gaps.
- Context produces a repo-grounded answer with exact pages read and the smallest relevant boundary.
- Shape produces a bounded frontier or route, not implementation.
- Execute produces a diff plus verification evidence and a keep/discard/reroute decision.
- Evaluate produces pass/conditional-pass/veto evidence without fixing by default.
- Promote produces a stop state: `looping`, `final-signoff`, `ready-to-land`, `reroute`, or
  `discarded`.
- Persist records only durable facts that future work needs.
- Clean removes or historicalizes stale state only after identifying active truth.

## Default Routing

1. If current state is unclear, use `auto-run-memory`.
2. If the next owner is unclear, use `auto-project`.
3. If the task is already bounded, use the matching worker directly.
4. Use shared protocols only when the active worker needs that contract.
5. End every worker path with a handoff packet.
6. Before stopping, decide `writeback_needed: yes/no`.
7. If `writeback_needed: yes`, route to `llm-wiki`.

One active owner is the default. Do not route every task through every skill.

## Skill Quality Standard

Every `SKILL.md` must stay small, generic, and triggerable.

- Frontmatter must contain only `name` and `description`.
- `name` must match the skill directory name.
- `description` must start with `Use when` and carry the trigger context; this is the primary
  loading surface.
- Body must contain `Role`, `Workflow`, `Required Output`, `Handoff`, and `Hard Boundaries`.
- Body should avoid repeating the full trigger logic from the description. Use the body for
  activation guardrails, procedure, and output contract.
- Skills must not embed project-specific product truth. Read root `AGENTS.md`, `README.md`,
  `knowledge-index.md`, and `wiki/**` for project context.
- Add `references/`, `scripts/`, or `assets/` only when repeated work, fragile execution, or
  deterministic output justifies the extra surface.
- Prefer updating, merging, or deleting existing skills before adding new ones.

## Mandatory llm-wiki Gate

Use `llm-wiki` when any of these become durable:

- product or design decision
- source ingestion, source interpretation, or synthesis update
- branch, task, PR, run, or release outcome
- CI or QA result that affects future work
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
- `context_read`
- `owned_boundary`
- `changes_or_findings`
- `evidence`
- `decision`: `keep`, `discard`, `reroute`, `blocked`, or `ready`
- `risks`
- `next_owner`
- `writeback_needed`
- `llm_wiki_target` when writeback is needed

The handoff must be enough for the next owner to continue from repo evidence without relying on
chat history. If it is not enough, route to `auto-run-memory` or `llm-wiki` before continuing.

## Boundary Rules

- `auto-project` schedules repo work, not product behavior.
- `auto-pm` locks scope and acceptance; it does not implement.
- `auto-coding` implements one bounded change and verifies before keeping it.
- `auto-qa` can veto; it does not fix by default.
- `ci-recovery` extracts actionable check evidence; it does not broaden the work.
- `llm-wiki` owns source/wiki ingest, wiki health checks, and durable writeback.
- Do not create a second wiki-writeback skill. Use `llm-wiki`.
