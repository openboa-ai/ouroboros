---
name: project-context
description: "Use when a worker needs current repository thesis, domain, product, architecture, constraints, active docs, or maintained project-document context before planning, coding, QA, review, or explanation."
---

# Project Context

## Role

`project-context` gives a concise, repo-grounded framing of the current project.

It reads the current repo's own truth sources. It must not embed one project's domain assumptions in
the skill itself.

## Workflow

1. Read root `AGENTS.md`.
2. Read `README.md`.
3. Read `LINEAR.md`, if present.
4. Read the most relevant project documents or minimal repo docs.
5. Extract thesis, current posture, active constraints, implementation stage, non-goals, and relevant
   docs.
6. Explain only the smallest relevant boundary needed for the current task.
7. State tensions, missing docs, affected owner, and writeback status.

## Context Extraction

Use this checklist and omit irrelevant fields:

- thesis: what the repo is trying to make or maintain
- current posture: planning, design, implementation, stabilization, or release
- active constraints: source-first rules, validation gates, scope limits, branch rules
- implementation stage: what is already built, fixture-only, deferred, or unknown
- relevant docs: exact files used for the answer
- non-goals: tempting work that should not be done in this frontier
- gaps: stale, missing, or conflicting repo truth

## Required Output

- goal
- owned boundary
- context read
- concise context answer
- source pages used
- evidence
- decision: `answered`, `reroute`, or `blocked`
- key tradeoffs or tensions
- risks
- affected docs or owner
- next owner
- `writeback_needed`

## Output Template

```text
goal:
owned_boundary:
context_read:
repo_framing:
active_constraints:
relevant_docs:
non_goals:
gaps_or_tensions:
decision:
next owner:
writeback_needed:
```

## Handoff

If the explanation corrects or changes durable project understanding, route to `llm-wiki`.

## Hard Boundaries

- Do not invent project truth from chat memory.
- Do not treat delivery slicing as system architecture.
- Do not replace source-first research when current docs are missing or stale.
