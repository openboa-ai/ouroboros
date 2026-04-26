# 011 - ClawHub Proactive Agent

## Source

- URL: https://clawhub.ai/halthelobster/proactive-agent
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 11
- Related cluster note:
  [proactive-agent-research-papers.md](../proactive-agent-research-papers.md)

## What This Source Actually Proves

This is not an official platform or peer-reviewed architecture source. It is a package-level
reference for how agent operators are packaging proactive behavior, memory survival, WAL-style
records, compaction recovery, and security warnings into reusable instructions and scripts.

Its value is practical: it shows the kind of behaviors a `CapabilityPackage` may eventually carry.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| WAL protocol | Important corrections, decisions, URLs, and runtime facts should be written before context disappears. |
| Working buffer | There should be a danger-zone log around compaction/restart, but it must not replace canonical trace. |
| Three-tier memory | Separate active state, raw daily/session logs, and curated long-term memory. |
| Security audit warning | Capability packages need review, permission boundaries, and network/tool restrictions. |
| Autonomous vs prompted crons | Proactive execution surfaces differ by context and authority. |
| Verify implementation, not intent | Agent self-description is not enough; inspect the actual mechanism. |

## Deep autokairos Insight

This source shows why `CapabilityPackage` must be treated as an artifact with permissions and
trust boundaries.

A package may contain useful operating behaviors:

- memory discipline
- recovery workflow
- proactive check-ins
- self-improvement prompts
- scripts
- tool migration checklists

But it can also smuggle unsafe instructions:

- skip permission checks
- leak context
- use external tools automatically
- treat package memory as trusted truth
- mutate behavior without review

For autokairos, capability packages should be inspectable and sandboxed. They can shape runtime
behavior, but they cannot grant authority. Actual access comes from `StageBinding`, `ToolProxy`,
and gateway policy.

## What Not To Copy

- Do not treat a ClawHub package as architecture truth.
- Do not import "do not ask permission" style instructions into trading.
- Do not let package memory override external evidence or control-plane records.
- Do not let self-improvement mutate a live runtime in place.

## Design Questions Forced By This Source

- What is the minimum `CapabilityManifest` for a package?
- How are package permissions reviewed before being attached to a runtime?
- Can a package write memory, and if so, who can inspect or revert it?
- What package contents are forbidden in live stage?

## autokairos Design Pressure

This source supports:

```text
CapabilityPackage = useful behavior artifact
CapabilityManifest = declared intent and permissions
StageBinding / ToolProxy = actual authority
Trace = record of what package-influenced behavior did
```

It strengthens the rule that packages are not secret stores and not authority grants.
