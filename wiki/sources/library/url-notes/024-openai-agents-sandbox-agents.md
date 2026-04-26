# 024 - OpenAI Agents SDK Sandbox Agents

## Source

- URL: https://developers.openai.com/api/docs/guides/agents/sandboxes
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 24
- Related cluster note:
  [openai-2026-agent-codex-workspace-stack.md](../openai-2026-agent-codex-workspace-stack.md)

## What This Source Actually Proves

This is one of the strongest technical references for autokairos. It separates the agent harness
from sandbox compute:

- harness owns model calls, tool routing, handoffs, approvals, tracing, recovery, and run state
- compute owns files, commands, packages, mounts, ports, snapshots, and provider-specific isolation
- a manifest defines fresh-session workspace setup
- sandbox sessions can be created, resumed, serialized, or snapshotted

This maps almost directly to the autokairos split between logical runtime, physical placement, hands
environment, provider session, and trace.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Harness vs compute | `TraderSystemRuntime` and `RuntimeConnector` must stay separate from `HandsEnvironment`. |
| Manifest | `TraderSystemSpec` / `CapabilityManifest` can define desired workspace inputs, not live truth. |
| Sandbox session | `RuntimePlacement` is replaceable physical execution state. |
| Snapshots and saved state | Recovery should use trace plus placement state, not private provider memory only. |
| Narrow credentials and mounts | Stage binding controls what the hands environment can see. |
| Handoff / agent-as-tool composition | Multi-agent execution should be admitted only when ownership is explicit. |

## Deep autokairos Insight

This source validates the user's container/sandbox intuition while correcting the naming:

```text
TraderSystemRuntime != Docker container
HandsEnvironment may be container-backed
RuntimePlacement maps the logical runtime onto one physical execution surface
```

The sandbox can run arbitrary trader-system code, install packages, manipulate files, and produce
artifacts. But the control-plane truth, evaluation, audit, credentials, and live gateway stay
outside the sandbox.

## What Not To Copy

- Do not copy OpenAI's `SandboxAgent` API names as autokairos product terms.
- Do not treat sandbox snapshots as evidence.
- Do not let mounted data include evaluator ground truth or live credentials.
- Do not assume hosted sandbox availability for first bootstrap.

## Design Questions Forced By This Source

- What is the autokairos `Manifest` equivalent for a trader-system runtime?
- Which files/artifacts are agent-writable versus control-plane-owned?
- What must survive if the sandbox disappears?
- What stage binding permissions are allowed in backtest, paper, and live?

## autokairos Design Pressure

Sandbox docs strongly support:

```text
logical runtime identity
-> physical placement
-> sandbox/hands compute
-> durable trace outside compute
```
