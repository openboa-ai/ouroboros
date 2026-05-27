# Project Direction

Ouroboros is an automated weak-to-strong trading-system laboratory. It connects improving AI agents
to a hard, dynamic, outcome-gradable trading problem where `revenue - cost` is a clear score. The
product center is the `CandidateArena`: researchers generate parallel TradingSystem candidates,
external `Evaluation` ranks them, findings and lineage feed the next generation, and only a
selected candidate can move into paper `Gateway` and `Ledger` evidence.

Read [Ouroboros Doctrine](ouroboros-doctrine.md) for the full product thesis.

## Source Of Truth

The GitHub repository on `main` is the source of truth for Ouroboros. Code, tests, validation
scripts, root documentation, `docs/`, and `.agents` instructions define the durable product,
architecture, naming, and operating contract.

Linear is a workflow tool for issues, comments, scratchpads, project coordination, and historical
progress notes. Linear can point back to repo truth, but it does not replace the repo as the final
authority.

## Core Loop

```text
parallel TradingSystem candidates
-> external Evaluation
-> leaderboard
-> findings and lineage
-> next generation
-> selected candidate paper evidence
```

Researchers and LLM agents generate candidates; they do not grant authority. External Evaluation,
provider and risk validation, and selected-candidate paper Gateway/Ledger evidence decide what
counts. Loss-making candidates remain useful arena memory unless they crash, submit malformed
orders, bypass provider boundaries, fail risk validation, or attempt private/live behavior.

AI agents improve over time. Codex, Claude Code, Gemini-powered agents, and future providers should
plug into the same loop as replaceable research labor rather than changing the product doctrine.
The stable contract is candidate generation, external Evaluation, findings/lineage memory, and
selected paper evidence.

TradingSystem may include an internal agent runtime, model calls, tools, deterministic code, rules,
and execution logic. Researcher cannot grade, candidate cannot grade itself, and Gateway binding
changes, TradingSystem identity does not. Candidate, Paper Evidence, and Live are separate states.

## Product Boundary

MLP-01 is paper-only. Paper execution reads Binance production public market data while using a
fake account, fake executor, and fake Ledger. Live trading, private account reads, signed exchange
requests, listenKey or user-data streams, leverage or margin mutation, and live orders remain
disabled until a future repo issue explicitly enables that authority.

## Non-Goals

- Do not move back to improving one best artifact in place.
- Do not treat provider output, generated comments, or candidate self-report as proof.
- Do not add new strategy families just to make the leaderboard look richer.
- Do not expose fixture, full-cycle, or replay-only compatibility controls as the primary product
  workflow.
- Do not enable live/private Binance authority in CandidateArena work.
