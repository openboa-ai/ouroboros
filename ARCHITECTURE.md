# Architecture

Ouroboros is organized around one trust sequence:

```text
TradingSystemCandidate
-> external evaluation
-> bounded live TradingSystemRuntime
-> runtime control and audit
```

This file is a compact development map. Linear Project Documents own the full architecture archive, active contracts, source synthesis, product brief, and historical decisions.

## Local Layers

- `apps/runtime`: runtime server, candidate materialization, provider adapter seam, local execution, and API surfaces.
- `apps/operator-web`: operator UI for inspecting and controlling local runtime state.
- `packages/domain`: shared contracts and domain types.
- `packages/local-store`: durable local filesystem store primitives.
- `.agents`: repo-local coding-agent harness and reusable work skills.

## Current Development Boundary

Preserve these separations: candidate identity vs evaluation evidence, evaluation evidence vs promotion decisions, live runtime control vs order intent generation, provider output as trace material rather than proof, and persistence with enough attribution to replay why state exists.

## Linear Architecture Sources

- 20 Architecture Baseline - System Map and Runtime Model: https://linear.app/openboa/document/architecture-active-baseline-mirror-01-ff4804a6d25c
- 21 Architecture Baseline - Agent, Control, Evaluation: https://linear.app/openboa/document/architecture-active-baseline-mirror-02-41c1aaff0f8f
- 22 Architecture Baseline - Foundation and Trading Substrate: https://linear.app/openboa/document/architecture-active-baseline-mirror-03-31ac0895169f
- 23 Architecture Decisions - ADRs: https://linear.app/openboa/document/architecture-adr-mirror-b516f7432828
- 24 Architecture Contracts - Core Through Evidence: https://linear.app/openboa/document/architecture-specs-mirror-01-d18b7d17d45d
- 25 Architecture Contracts - Promotion Through Substrate: https://linear.app/openboa/document/architecture-specs-mirror-02-e71a72691597
- 26 Architecture Contracts - Index and Remaining Specs: https://linear.app/openboa/document/architecture-specs-mirror-03-6136fc24c533

## Validation Surface

- Documentation and agent-policy changes: `bash scripts/check-docs.sh`, `bash scripts/check-secrets.sh`, `git diff --check`
- Runtime or package changes: add the relevant tests, then run `npm test` and `npm run typecheck`
