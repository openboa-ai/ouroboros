---
name: coding-harness
description: Runs bounded coding turns inside AutoKairos with repo-first orientation, upstream engineering workflow composition, evidence-based completion, and stronger guardrails for live-trading risk surfaces. Use when implementing features, fixing bugs, modifying runtime behavior, or performing repo-aware code surgery.
---

# Coding Harness

Use this skill for coding work in AutoKairos.

This is not a generic "write good code" prompt.
It is the repo-local workflow layer that tells an agent how to move through AutoKairos documents, companion skills, high-risk trading boundaries, and verification requirements while making code changes.

## When To Use

Use this skill when the task is primarily:

- implement a feature
- fix a bug
- modify runtime behavior
- wire a subsystem
- perform repo-aware code surgery

Do not use this skill for:

- pure product-definition discovery
- source-ingest or reference-note work
- doc-only restructuring
- release-note writing

Use `autokairos-wiki` when the main job is maintaining the markdown system rather than changing code.

## Read First

Before editing code, read:

1. `AGENTS.md`
2. `.agents/AGENTS.md`
3. `ARCHITECTURE.md`
4. `docs/index.md`
5. the most relevant file in `docs/exec-plans/active/`
6. the closest stable document in:
   - `docs/design-docs/`
   - `docs/product-specs/`

For the exact orientation order, read [references/repo-read-order.md](references/repo-read-order.md).

## Companion Skills

This skill composes with the copied upstream workflows under `.agents/skills/agent-skills/`.

Pull them in only when relevant:

- `planning-and-task-breakdown`
  when the task still needs finer implementation slices
- `incremental-implementation`
  for multi-file coding work
- `source-driven-development`
  when framework or API correctness depends on official documentation
- `test-driven-development`
  when behavior changes or regression coverage matter
- `code-review-and-quality`
  for self-review before closing the turn
- `security-and-hardening`
  when touching secrets, external integrations, or trust boundaries
- `documentation-and-adrs`
  when the change creates durable architectural or behavioral consequences

## Workflow

### 1. Orient

Read the repo map, the active plan, and the closest stable contracts.
Do not start by reading everything.
Stay targeted.

### 2. Define The Coding Turn

Restate the goal as one bounded coding turn:

- what behavior changes
- what surfaces are in scope
- what must stay untouched

If the turn is too large, break it down before coding.

### 3. Identify Affected Surfaces

Check which of these are affected:

- implementation files
- tests
- build or typecheck surfaces
- runtime wiring
- docs that describe behavior
- live-trading safety boundaries

If the task touches live-trading risk surfaces, read [references/high-risk-surfaces.md](references/high-risk-surfaces.md) before editing.

### 4. Implement A Narrow Slice

Prefer one coherent change unit over sprawling edits.

Rules:

- do the smallest thing that can work
- avoid incidental cleanup
- do not silently widen scope
- preserve rollback clarity
- keep live execution narrow and deterministic

### 5. Validate With Evidence

A coding turn is not complete because it "looks right".
Run the most relevant checks and capture the evidence.

Read [references/evidence-rules.md](references/evidence-rules.md) and use the strongest available proof:

- test output
- build output
- lint output
- typecheck output
- runtime verification output

If a required check cannot run, state that explicitly and say why.

### 6. Record The Result

If the change materially affects repository knowledge:

- update the relevant active plan
- update a stable design or product doc if the behavior is now durable
- append a concise entry to `knowledge-log.md`

Use `autokairos-wiki` if the documentation update becomes the primary task.

## Rationalizations To Reject

| Rationalization | Response |
|---|---|
| "I'll just code first and read the docs later." | AutoKairos has live-trading boundaries. Coding before orientation is how invariants get broken. |
| "This touches a lot of files, but it's one idea." | Split the turn. Large unfocused edits hide regressions and break rollback clarity. |
| "The tests are probably fine; this is a small change." | Small changes break systems too. Produce evidence or state why you could not. |
| "I can improve nearby code while I'm here." | Incidental cleanup is scope drift. Note it, don't fold it into the turn. |
| "This safety guard is annoying." | Execution invariants outrank convenience. Treat them as system boundaries, not style choices. |

## Red Flags

- changing live execution behavior without checking product and reliability docs
- touching credential or kill-switch code casually
- multi-file edits without a bounded turn definition
- closing the task with no concrete verification output
- changing behavior without updating the repository record

## Verification

- [ ] The coding turn was explicitly bounded before implementation
- [ ] The repo was oriented using the required read order
- [ ] The right companion upstream skills were used when needed
- [ ] High-risk surfaces were checked before editing if relevant
- [ ] The change was validated with concrete evidence
- [ ] Durable behavior changes were recorded in the repo
