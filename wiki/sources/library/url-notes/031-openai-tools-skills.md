# 031 - OpenAI Skills

## Source

- URL: https://developers.openai.com/api/docs/guides/tools-skills
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 31
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

OpenAI Skills are versioned file bundles with a `SKILL.md` manifest, usable in hosted and local shell
environments. This gives another official source for capability packaging.

For autokairos, this reinforces `CapabilityPackage` and `CapabilityManifest` as artifact boundaries.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Versioned bundle | Capability packages must be versioned and inspectable. |
| `SKILL.md` manifest | Package metadata and instructions should be explicit. |
| Hosted/local execution | Package behavior may run in provider-hosted or local hands environments. |
| Modular process knowledge | Trader-system packages can encode procedures, tools, and domain conventions. |
| Upload/manage/attach | Package attachment should be a control-plane action, not hidden prompt mutation. |

## Deep autokairos Insight

This source strengthens the marketplace-ready artifact boundary:

```text
CapabilityPackage = reusable files + instructions + resources
CapabilityManifest = declared purpose and requested permissions
StageBinding/ToolProxy = actual granted access
```

Skills can make a trader-system runtime more capable without changing candidate identity. That is
valuable for composition, but risky if packages smuggle permissions or hidden instructions.

## What Not To Copy

- Do not copy OpenAI's exact skill standard as final without trading-specific trust fields.
- Do not let a skill package contain secrets or evaluator ground truth.
- Do not attach a live-stage package without reviewing its scripts/resources.
- Do not treat skill versioning as promotion.

## Design Questions Forced By This Source

- What extra fields does `CapabilityManifest` need for trading risk?
- Which packages are allowed in backtest, paper, and live?
- How are package versions pinned in a candidate evaluation?
- How are package-originated scripts traced?

## autokairos Design Pressure

Skills validate the artifact model for tools/context, but actual authority must stay outside the
package.
