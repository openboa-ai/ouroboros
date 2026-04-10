# Coding Harness Skill Plan

## Goal

Design a repo-local `coding-harness` skill for AutoKairos without implementing it blindly.

Status: selected upstream `agent-skills` workflows are now copied under `.agents/skills/agent-skills/`.
Initial repo-local `coding-harness` skill is implemented under `.agents/skills/coding-harness/`.
The next refinement step is to decide what should remain in `coding-harness` vs what should split into narrower runtime or live-safety skills later.

The skill should encode how coding work happens inside this repository's agent-first operating model.
It should not be a generic "write code well" prompt.
It should be the workflow layer that connects:

- OpenAI harness principles
- AutoKairos repository structure
- repo-local quality gates
- evidence-driven completion rules

## Why This Skill Should Exist

The OpenAI harness article argues that the leverage comes from scaffolding, not raw code generation,
and that repository knowledge should become the system of record with a short `AGENTS.md` acting as
a map rather than an encyclopedia. It also emphasizes repository-embedded skills, application
legibility, and agent-to-agent review loops. Source: [Harness engineering](https://openai.com/index/harness-engineering/)

The Codex App Server article explains that long-running agent work should be modeled using
`thread`, `turn`, and `item` primitives, with explicit item lifecycles, progress streaming, and
approval pauses. Source: [Unlocking the Codex harness](https://openai.com/index/unlocking-the-codex-harness/)

`agent-skills` contributes the missing workflow discipline:

- process, not prose
- anti-rationalization
- verification is non-negotiable
- evidence requirements at the end of the workflow

Source: [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)

## Design Hypothesis

`coding-harness` should be a narrow, repeatable workflow skill for implementation work in the
AutoKairos repository.

It should not replace:

- architecture docs
- product specs
- active plans
- repo-local wiki maintenance

It should instead tell an agent how to move through those artifacts while doing coding work.

## What The Skill Should Cover

### Trigger Shape

Use the skill when the task is primarily:

- implement a feature
- modify runtime behavior
- fix a bug
- wire a subsystem
- perform repo-aware code surgery

Do not use the skill for:

- pure product-definition discovery
- external research ingestion
- doc-only restructuring
- release-note writing

### Required Inputs

Before coding starts, the skill should require the agent to orient itself from:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/index.md`
- the most relevant active plan in `docs/exec-plans/active/`
- the closest stable design docs or product specs

### Core Workflow

The skill should likely enforce this sequence:

1. Orient
   Read the repo map and the active plan.
2. Define the thread and turn
   Restate the goal as one bounded coding turn.
3. Identify the affected surfaces
   Code, docs, tests, runtime checks, and UI surfaces.
4. Implement in a narrow slice
   Prefer one coherent change unit over sprawling edits.
5. Validate with evidence
   Run the relevant checks, not only reasoning.
6. Record the result
   Update the active plan or knowledge artifacts if the behavior changed.

### Evidence Requirements

The skill should inherit `agent-skills` style evidence expectations.

Completion should require at least one of:

- test output
- build output
- lint output
- runtime verification output
- explicit statement that a required validation could not be run

### AutoKairos-Specific Guardrails

The skill should include stronger guardrails when a task touches:

- live trading logic
- execution invariants
- credential handling
- kill switches
- protective-stop enforcement
- promotion or rollback logic

For those surfaces, the skill should point the agent back to:

- `docs/RELIABILITY.md`
- `docs/SECURITY.md`
- `docs/product-specs/live-trading.md`
- `ARCHITECTURE.md`

## What The Skill Should Not Do

- It should not become another giant `AGENTS.md`.
- It should not contain full architecture theory that already lives in `docs/`.
- It should not duplicate the wiki-maintenance workflow from `autokairos-wiki`.
- It should not prescribe one fixed coding stack.

## Proposed Skill Shape

### Skill name

`coding-harness`

### Location

`.agents/skills/coding-harness/`

### Files

- `SKILL.md`
  Core workflow only
- `references/repo-read-order.md`
  Exact repo orientation order for coding tasks
- `references/evidence-rules.md`
  Completion and verification requirements
- `references/high-risk-surfaces.md`
  What changes need stronger caution and why

Scripts are optional.
For now, the plan is to avoid scripts unless the same validation glue keeps being repeated.

## How It Should Apply OpenAI's Harness Ideas

### From `Harness engineering`

Adopt:

- short `AGENTS.md` as entry point
- repository docs as system of record
- agent legibility as the target
- repo-embedded skills
- coding work tied to validation, not just generation

Do not over-copy:

- worktree-heavy assumptions as mandatory workflow
- internal OpenAI team throughput assumptions
- cloud-specific review topology that does not fit the current repo

### From `Unlocking the Codex harness`

Adopt:

- think in `thread`, `turn`, and `item`
- treat approvals and tool calls as explicit workflow events
- keep client-visible artifacts small and typed

Apply indirectly:

- the skill should ask the agent to define the current coding turn
- the skill should treat validation outputs and diffs as typed artifacts

Do not over-copy:

- JSON-RPC protocol details
- App Server internals that belong in product runtime docs, not in a coding skill

### From `agent-skills`

Adopt directly:

- process, not prose
- anti-rationalization
- verification with evidence
- narrow, triggerable skill scope

## Open Questions Before Implementation

- Should the skill require updating `docs/exec-plans/active/` after every meaningful code change, or only when behavior changes?
- Should the skill include a mandatory self-review step, or rely on repo-level review skills later?
- Should there be one `coding-harness` skill, or a future split between:
  - `coding-harness`
  - `runtime-harness`
  - `live-safety-harness`

## Recommendation

Implement one first version of `coding-harness` as a compact repo-local skill with references.

Keep it focused on:

- orientation
- bounded coding turns
- evidence-based completion
- AutoKairos-specific high-risk reminders

Do not put the entire OpenAI harness philosophy into the skill body.
Put only the operational workflow in the skill, and keep the philosophy in the docs tree.
