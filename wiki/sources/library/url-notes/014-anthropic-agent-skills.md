# 014 - Anthropic Agent Skills

## Source

- URL: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 14
- Related cluster note:
  [anthropic-2026-runtime-and-managed-agent-stack.md](../anthropic-2026-runtime-and-managed-agent-stack.md)

## What This Source Actually Proves

Agent Skills are a concrete example of capability packaging.

The source defines a skill as a directory with `SKILL.md`, metadata, instructions, scripts, and
resources. The important architecture pattern is progressive disclosure:

- small metadata is preloaded so the agent knows when a skill is relevant
- full instructions are loaded only when needed
- scripts/resources can extend what the agent can do
- organizations can share procedural knowledge as reusable packages
- agents may eventually create and improve skills themselves

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Directory package | `CapabilityPackage` should be artifact-like, versioned, inspectable, and portable. |
| Metadata first | `CapabilityManifest` should expose enough for discovery without loading everything. |
| Progressive disclosure | Do not dump all context/tools into every runtime session. |
| Instructions + scripts + resources | Packages can contain behavior guidance and executable helpers. |
| Sharing and lifecycle | Packages can become marketplace/tradable artifacts later. |
| Agent-created skills | Self-improvement should create candidate/package versions, not mutate live authority. |

## Deep autokairos Insight

This source validates the user's point that context/tool/skill injection should be its own artifact.

A trader-system candidate should not secretly contain all tools, context, credentials, and skills.
Instead:

```text
TraderSystemSpec
+ CapabilityPackage[]
+ StageBinding
= TraderSystemRuntime context surface
```

The capability package can teach the runtime how to use a data feed, backtest helper, risk report,
execution diagnostic, or domain playbook. But it cannot grant permissions by itself. Permission is
still enforced by `StageBinding`, `ToolProxy`, vault binding, and gateway.

## What Not To Copy

- Do not copy Claude Skills file format as the canonical autokairos package format without a
  trading-specific manifest.
- Do not let package scripts execute without sandbox and trace.
- Do not include secrets, credentials, evaluator ground truth, or exchange tokens in packages.
- Do not let agent-created packages become live without review and evaluation.

## Design Questions Forced By This Source

- What minimum fields belong in `CapabilityManifest`?
- Which package resources are read-only versus writable?
- Can a capability package declare required tools without granting them?
- How does a package become trusted enough for paper or live stage?

## autokairos Design Pressure

This source supports:

```text
CapabilityPackage = reusable expertise artifact
CapabilityManifest = discovery and permission request
StageBinding/ToolProxy = actual permission grant
```

It is central to future marketplace boundaries.
