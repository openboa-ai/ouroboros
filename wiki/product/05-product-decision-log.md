# autokairos Product Decision Log

## Purpose

This page records the current product decisions that are already locked strongly enough that
downstream docs should not redefine them casually.

It is not a chronology replacement for [../../knowledge-log.md](../../knowledge-log.md). It is the
current product decision ledger.

## Current Locked Decisions

| Decision area | Current answer | Why it is locked now | Change rule |
| --- | --- | --- | --- |
| Product category | Automated weak-to-strong trader | Keeps the brand anchored in weak supervision, evaluation, and governed live progression | Change only if strategy changes first |
| Candidate identity | `TraderSystemCandidate` | Candidate is the system under judgment, not a strategy note or chat artifact | Change only if the MLP product thesis changes first |
| Pod model | Same artifact plus different stage binding | Backtest, paper, and live should run the same candidate artifact under different injected environments | Change only if implementation proves same-artifact bindings are not viable |
| Agent runtime unit | `AgentRuntimeUnit` as the participant boundary inside or beside a pod | Single-agent and multi-agent trader systems need the same candidate identity while keeping brain/hands/session participants explicit | Change only if the runtime bridge proves a different participant boundary is safer |
| Runtime provider adapter | Provider labels must map to concrete callable surfaces; first real local target is `codex_cli` via `codex exec`, with Claude Agent SDK as the second serious provider path | Prevents "Codex/Claude support" from becoming empty architecture vocabulary without a runnable adapter contract | Change only if prototype evidence shows another provider surface is safer as the first adapter |
| Multi-agent communication | One provider-neutral `PodCommunicationPolicy` per pod; provider selection lives on each `AgentRuntimeUnit` | Allows one pod to mix Codex, Claude Code, Claude Managed Agents, OpenClaw/ACP, local drivers, or A2A endpoints without turning provider choice into product truth | Change only if implementation proves a unified policy cannot express required safety boundaries |
| Capability injection | `CapabilityPackage` as versioned artifact boundary | Context, tools, skills, and data access may later be shared or traded; secrets must stay outside packages | Change only if package separation fails in prototype evidence |
| Live authority | Bounded agent through autokairos gateway | Agent can reason and propose, but gateway owns real execution authority | Change only if bounded agency cannot produce meaningful live behavior |
| Self-evolution | Clone -> evaluate -> promote | Prevents silent mutation of live systems | Change only if a safer live-update governance model is explicitly designed |
| First ICP | Serious solo crypto operator | Sharpest urgency and lowest coordination overhead | Change only with new ICP evidence |
| First market | Binance BTC perpetual futures only | Narrowest believable live wedge | Change only if first proof fails for wedge reasons |
| Candidate origin | Agent-built only | Core lovable proof is agent leverage over trader-system creation | Change only if manual-first proves necessary |
| Human gate | Per-candidate live deployment | One serious decision is clearer than constant approval | Change only if trust model fails |
| Autonomy posture | Full autonomy within explicit limits after promotion | Product must feel alive, not half-manual | Change only if bounded autonomy is not trustable |
| Source-role hierarchy | W2S/AAR primary thesis spine, Paperclip governance spine, runtime references secondary | Prevents runtime references from redefining product truth | Change only if source-grounded product thesis changes first |
| Architecture relationship | Product truth precedes architecture | Prevents technical docs from defining the product | Change only with documentation doctrine revision |
| Implementation posture | Docs-only reset baseline, then greenfield bootstrap before PR1 feature work | Prevents legacy app/runtime restoration from becoming an implicit implementation truth | Change only if a legacy codebase is explicitly restored and promoted to active baseline first |

## Reversal Rule

A reversal is allowed only when:

- the current decision is shown to block the lovable proof, or
- better product evidence contradicts the current assumption

When a reversal happens:

1. update this page
2. update the affected product doc first
3. update downstream PRD or architecture docs after the product change is explicit

## Current Reversals

None yet.

## Read Next

1. [mlp-01/README.md](mlp-01/README.md)
2. [mlp-01/00-mlp-brief.md](mlp-01/00-mlp-brief.md)
