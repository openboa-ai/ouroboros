# Trading Substrate Stage-Facing Bindings

This page defines how stages should consume stable trading-substrate surfaces without changing the
agent-facing conceptual model.

It follows:

- [02-state-surfaces.md](02-state-surfaces.md)
- [03-signal-and-liveness.md](03-signal-and-liveness.md)
- [../specs/03-staged-evaluation.md](../specs/03-staged-evaluation.md)
- [../specs/24-always-on-trading-substrate-contract.md](../specs/24-always-on-trading-substrate-contract.md)

## Purpose

Define what stays stable and what changes when `backtesting`, `paper`, and `live` consume the
trading substrate.

## Scope And Non-Goals

This page covers:

- stable substrate-facing concepts across stages
- stage-specific backing semantics
- stage-dependent freshness and legitimacy posture

This page does not cover:

- detailed agent tool schemas
- promotion logic
- connector implementation code

## Responsibilities

The stage-facing model should:

- preserve one stable domain-facing conceptual surface
- change backing semantics by stage
- avoid forcing the runtime to infer stage from prompt prose

## Stable Concepts Across Stages

Across stages, the system should keep stable concepts such as:

- market state
- account and position posture
- order and fill lifecycle
- risk posture
- connector and liveness posture

What changes is not the meaning of those concepts, but the backing source and operational
requirements.

## Stage Binding Table

| Stage | Market surface | Account / position surface | Order / fill surface | Risk surface | Connector posture |
| --- | --- | --- | --- | --- | --- |
| `backtesting` | replayed or reconstructed historical market state | simulated account and position state | simulated order/fill lifecycle | replay-safe evaluation and risk posture | replay or local simulation connectors |
| `paper` | live or near-live market state | paper or shadow account state | simulated execution against live-ish conditions | live monitoring with non-live execution gates | paper connectors and shadow execution bridges |
| `live` | live market state | live account and position state | live order/fill lifecycle | live risk and kill-switch posture | venue-connected production connectors |

## What Must Stay Stable

The runtime should not need a different conceptual trading language per stage.

It should still be able to ask:

- what does the market look like?
- what exposure exists?
- what orders and fills are active?
- what risk posture applies?

## What Must Change By Stage

The binding must still change:

- data source legitimacy
- execution semantics
- freshness expectation
- allowed side effects
- connector failure tolerance

## Failure And Recovery Model

This layer is failing if:

- the runtime has to guess whether a surface is live or simulated
- stage semantics leak into prompt-only instructions
- stage changes require an entirely different domain model

Recovery depends on explicit stage binding above the substrate and below runtime execution.

## What Is Still Delegated To Specs / ADRs

- the stage model remains in
  [../specs/03-staged-evaluation.md](../specs/03-staged-evaluation.md)
- the substrate boundary remains in
  [../specs/24-always-on-trading-substrate-contract.md](../specs/24-always-on-trading-substrate-contract.md)

## Core Claim

The right design is:

- stable trading concepts
- stage-specific bindings underneath

not:

- one different agent world per stage
