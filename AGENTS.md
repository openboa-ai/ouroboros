# Agent Entry Point

This file is the repo-wide entry point for coding agents. It follows the
[AGENTS.md](https://agents.md/) convention: keep the always-on instructions here, and route detailed
project workflow to repo-local agent docs.

## Start Here

1. Read [.agents/AGENTS.md](.agents/AGENTS.md) for the generic project operating manual.
2. Read [.agents/skills/AGENTS.md](.agents/skills/AGENTS.md) before using repo-local skills.
3. Use `llm-wiki` whenever a decision, source insight, PR result, CI result, or frontier state must
   survive outside chat history.
4. If external workflow skills such as Superpowers are available, let `auto-project` use them for
   design, planning, execution, review, verification, and branch-finishing discipline while keeping
   repo truth in `wiki/**`.

## Auto Project Rule

When `auto-project` is used in this repo, it must read
[wiki/project/frontier-ledger.md](wiki/project/frontier-ledger.md) before choosing the next task.

The intended loop is PR-sized:

```text
read repo truth + project frontier ledger
-> pick one MLP/frontier
-> route PM/coding/QA/CI/wiki owner
-> drive to ready-to-land or blocked
-> write back state
-> after merge is recorded, select the next frontier
```

For the current repo state, MLP-01 continues from the Bootstrap substrate frontier unless the ledger
has been updated with a newer active frontier.

## Current Posture

- This repo is still in pre-Bootstrap docs/design reset.
- Do not implement runtime, provider, evaluator, gateway, storage, schema, or UI behavior unless the
  current frontier explicitly allows it.
- autokairos is a trading-system control plane/devops layer for agent-built trader-system
  artifacts. It is not the trader-system brain and not a generic agent platform.
- `.agents/**` is intentionally generic and reusable across projects. Project-specific autokairos
  truth lives in this file, `README.md`, `knowledge-index.md`, and `wiki/**`.

## Validation Commands

Run the relevant checks before committing:

```bash
bash scripts/check-docs.sh
bash scripts/check-secrets.sh
git diff --check
```

## Required Writeback Rule

No durable repo decision should live only in chat. If work changes product truth, architecture,
source interpretation, PR state, CI recovery state, or project workflow, route the result through
`llm-wiki` for the lightest durable writeback.
