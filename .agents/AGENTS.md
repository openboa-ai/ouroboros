# Generic Project Operating Manual

This file contains reusable repo-work rules for coding agents. It must not contain project-specific
product architecture or domain vocabulary. Project-specific truth belongs in the repo root
`AGENTS.md`, `README.md`, `knowledge-index.md`, and `wiki/**`.

Skills live under [skills/](skills/) and are loaded only when the task calls for them.

## Operating Model

Keep three layers distinct:

- Project truth: repo-specific thesis, source notes, design docs, and implementation contracts.
- Repo workflow: how work moves from current truth to a bounded change and verified result.
- Skills: on-demand procedures for recurring project work.

The default workflow is:

```text
recover current truth
-> choose one bounded frontier
-> execute one owner path
-> verify
-> decide keep/discard/reroute
-> write back durable results when needed
```

Use [skills/AGENTS.md](skills/AGENTS.md) as the routing registry.

## Wiki-First Rule

When a repo has a wiki, docs, or knowledge index, treat those files as the system of record before
making durable claims.

Default read order:

1. root `AGENTS.md`
2. `README.md`
3. `knowledge-index.md`, if present
4. `knowledge-log.md`, if present
5. nearest relevant wiki/docs pages
6. source notes or external references only when the maintained docs are missing or stale

Do not let chat history become the only memory of a durable decision.

## Source-First Design Gate

Do not change architecture, security, provider, infrastructure, data, evaluation, or product
behavior from memory or taste.

Before changing those areas:

- Read the maintained source/wiki layer first.
- If the maintained source layer is missing, stale, or shallow, research first and add a source note
  or reference record before changing active design.
- Prefer primary sources in this order: official docs, official repositories, official engineering
  or research posts, protocol specifications, papers, then third-party analysis.
- Treat third-party posts as heuristics only. They do not define implementation truth by themselves.

If a design change cannot name its source grounding, keep it draft/background.

## Bounded Frontier Rule

Work on one frontier at a time.

Each frontier needs:

- goal
- owned boundary
- non-goals
- acceptance criteria
- validation evidence
- current owner
- writeback target when durable

If these are unclear, route to `auto-project` or `auto-pm` before implementation.

## Skill And Writeback Rules

- Use repo-local skills when their description matches the task.
- Use [skills/AGENTS.md](skills/AGENTS.md) before routing multi-step repo work.
- `auto-project` owns routing and next-owner selection.
- `llm-wiki` owns durable source/wiki/repo-memory writeback.
- Do not create a second wiki-writeback skill. Use `llm-wiki`.
- Every completed worker path must state `writeback_needed: yes/no`.
- If `writeback_needed: yes`, route to `llm-wiki` before considering the work complete.

## Validation

Use the narrowest relevant checks, then run the repo's full checks before committing.

Common defaults:

```bash
bash scripts/check-docs.sh
bash scripts/check-secrets.sh
git diff --check
```

Do not keep unverified changes. Do not alter unrelated dirty worktree state.
