# 037 - OpenAI Token Counting

## Source

- URL: https://developers.openai.com/api/docs/guides/token-counting
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 37
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

The token counting page matters because agent runtimes with tools, files, images, schemas, and
reasoning cannot rely on simple local text estimates. Accurate input token counts help estimate
cost, fit context limits, route requests, and avoid surprises.

For autokairos, this makes runtime budget a real control-plane concern.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Exact input counting | `AgentRun` should record token/cost estimates where provider supports it. |
| Tools/schemas cost | Capability packages and tool schemas affect runtime budget. |
| Routing by prompt size | Provider/model selection may depend on context size and cost. |
| Files/images support | Rich context refs need budget estimation before run. |
| Model-specific behavior | Token/cost metrics must include provider/model version. |

## Deep autokairos Insight

Token counting is not just billing. It is an autonomy boundary.

A live or paper runtime can become unsafe if it silently consumes too much budget, truncates
important context, or routes to a weaker model without recording why.

For autokairos:

```text
runtime context refs + tools + memory + output schema
-> token/budget estimate
-> provider/run config
-> trace budget record
```

## What Not To Copy

- Do not over-optimize token budget before correctness/evidence boundaries exist.
- Do not use local estimates when provider counts are available.
- Do not compare candidate performance without recording cost/context differences.
- Do not let cost routing silently alter model/provider quality.

## Design Questions Forced By This Source

- What budget fields belong on `AgentRun`?
- When should a runtime ask for more budget versus compact context?
- How does budget affect evidence comparability?
- Which context refs are too expensive for live attention?

## autokairos Design Pressure

Provider cost/context behavior must be traceable because it affects candidate quality and autonomy.
