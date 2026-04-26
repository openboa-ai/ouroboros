# Phil Schmid: Why Engineers Struggle Building Agents

## Source

- [Why (Senior) Engineers Struggle to Build AI Agents](https://www.philschmid.de/why-engineers-struggle-building-agents)
- Published: 2025-11-26

## What This Source Is

This is an agent-engineering essay about why traditional deterministic software instincts can make
agent systems worse. It is not an API reference or architecture spec. Its value for autokairos is
as a design constraint against turning an agentic trader system into a brittle event-handler graph.

## Core Thesis

Agent systems should preserve semantic context and let the agent navigate ambiguous control flow.
Traditional software tries to remove ambiguity through strict routes, enums, booleans, and
deterministic handlers. Agent systems need enough structure to be safe and observable, but they
should not encode every possible path as product-owned control flow.

## Key Mechanisms / Architecture

- Preserve semantic state instead of flattening intent into narrow booleans or enums.
- Give the agent a single rich entrypoint with context, tools, and instructions rather than a large
  collection of deterministic route handlers.
- Treat recoverable errors as new context that can be fed back to the agent.
- Judge agent behavior through evals, reliability, quality, and trace rather than only binary unit
  assertions.
- Make tool/API descriptions explicit enough for agents, because agents do not reliably infer human
  shorthand.

## Important Passages Or Facts

- The essay contrasts deterministic software engineering with probabilistic agent engineering.
- It argues that engineers often over-constrain agents by trying to encode away ambiguity.
- It emphasizes preserving natural-language nuance and intermediate trace.
- It frames production readiness as risk management through evaluation and tracing, not perfect
  deterministic certainty.

## Vocabulary And Mental Models

| Source term | Useful autokairos translation |
| --- | --- |
| dispatcher | autokairos provides context and boundaries, not every internal route |
| text is the new state | `TraderSystemProgram` should preserve rich semantic context internally |
| hand over control | `TraderSystemRuntime` owns internal behavior after lifecycle start |
| errors are inputs | recoverable failures become trace/control context, not only crashes |
| evals over tests | external evaluation seals evidence; unit tests do not judge reasoning quality |
| agent-friendly APIs | tool/gateway descriptions must be explicit, semantic, and traceable |

## Transferable Lessons

- Trader-system internal behavior should not be an enum dispatch table over predeclared event
  sources.
- autokairos should control runtime lifecycle externally through `RuntimeControl`, not activate each
  internal reasoning moment.
- `TraderSystemProgram` should preserve human-readable context, observed facts, refs, and authority
  boundaries internally where it needs them.
- Deterministic structure still belongs at safety boundaries: credentials, tool proxy, trading
  gateway, evaluator, audit, and trace persistence.
- Agent reasoning should be evaluated and traced rather than treated as a unit-testable pure
  function.

## Non-transferable Baggage

- The essay is general agent-engineering guidance, not trading-system safety guidance.
- It does not define exchange execution, portfolio risk, market-data semantics, or external
  evaluation legitimacy.
- It should not be used to justify unbounded agent action. autokairos still needs strict gateway,
  credential, evaluation, and audit boundaries.

## Open Questions / Tensions

- How much context should be mounted into runtime/program context versus referenced through
  artifacts?
- How should autokairos observe internal runtime context without turning it into a handler graph?
- Which runtime failures should become recoverable trace/control context, and which should stop the
  runtime for operator review?
