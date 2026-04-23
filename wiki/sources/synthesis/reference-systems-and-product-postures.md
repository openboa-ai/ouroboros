# Reference Systems And Product Postures

This page compares the main reference repositories as products, not just as codebases. The goal is
to avoid flattening very different systems into one vague idea of an "agent platform."

## Sources Used

- [repo-anthropics-claude-code.md](../library/repo-anthropics-claude-code.md)
- [repo-openai-codex.md](../library/repo-openai-codex.md)
- [repo-openclaw.md](../library/repo-openclaw.md)
- [repo-multica.md](../library/repo-multica.md)
- [repo-paperclip.md](../library/repo-paperclip.md)

## Comparison Table

| Source | Product posture | What the core system is | Where durable truth lives | Where autonomy lives | Where governance lives | Best used as a reference for |
| --- | --- | --- | --- | --- | --- | --- |
| [Claude Code](../library/repo-anthropics-claude-code.md) | Interactive coding harness product | Terminal coding agent plus plugin surfaces | Project files, config, and external session context | The coding agent loop | User controls, plugins, project config | Harness UX and extension surfaces |
| [Codex](../library/repo-openai-codex.md) | Local coding agent runtime plus background-work product | Agent loop plus local sandbox/approval controls, threads, automations, and review queue | Repository docs, AGENTS layering, local runtime state, app threads, memory | The Codex execution loop plus background automations | Approval mode, sandbox mode, review queue, repo guidance | Local runtime behavior plus proactive background-work posture |
| [OpenClaw](../library/repo-openclaw.md) | Always-on assistant platform | Gateway, embedded runtime, ACP-connected tools, heartbeat/cron/standing-order operations | Gateway-owned session and runtime state | Embedded assistant runtime | Gateway, standing orders, and automation surfaces | Persistent assistant posture plus proactive orchestration vocabulary |
| [Multica](../library/repo-multica.md) | Managed-agents platform | Daemon, runtime registry, agent profiles, task lifecycle, autopilot surfaces | Runtime state, agent/task records, workspace dirs, daemon/runtime records | Managed agents executed through daemon and runtimes | Platform-level management, task orchestration, runtime liveness | Control-plane, runtime inventory, daemon bridge, and recurring work above task execution |
| [Paperclip](../library/repo-paperclip.md) | Governance-heavy agent company/control plane | Persistent agents pursuing company goals under control surfaces and scheduled/event wakes | Goal ancestry, budgets, approvals, audit, rollback | Agents operating across goals and heartbeats | Human approvals, budgets, rollback, company policy | Promotion, governance, and persistent supervision |

## Core Distinctions

### Codex and Claude Code are closest to harness/runtime references

[Claude Code](../library/repo-anthropics-claude-code.md) and
[Codex](../library/repo-openai-codex.md) are the cleanest references for repository-facing coding
agent behavior. They expose instructions, config, approval, skills/plugins, and project guidance
surfaces close to the developer workflow.

They are less useful as examples of a full multi-agent control plane.

### OpenClaw sits between runtime product and assistant platform

[OpenClaw](../library/repo-openclaw.md) is not just a thin harness. It has a strong product view:
Gateway ownership, long-lived sessions, always-on assistant posture, ACP integration, and bootstrap
rules. It can still inform runtime design, but it already carries more product-management posture
than Codex or Claude Code.

### Multica and Paperclip are closer to management layers than raw runtimes

[Multica](../library/repo-multica.md) emphasizes agent records, runtime registries, daemon-based
execution, external task progress, and workspace skill distribution. [Paperclip](../library/repo-paperclip.md) emphasizes
budgets, approvals, goal ancestry, heartbeats, and rollback. Both are useful, but neither should
be mistaken for a simple runtime harness reference.

They are strongest as control-plane references.

## Durable Truth By Product Posture

- Harness/runtime products:
  [Claude Code](../library/repo-anthropics-claude-code.md),
  [Codex](../library/repo-openai-codex.md)
  tend to rely on repository files, local config, and explicit user control surfaces.
- Persistent assistant platform:
  [OpenClaw](../library/repo-openclaw.md)
  centers durable truth in a long-lived platform component, the Gateway.
- Managed control planes:
  [Multica](../library/repo-multica.md),
  [Paperclip](../library/repo-paperclip.md)
  place durable truth in platform-managed records such as tasks, goals, runtimes, approvals, and
  budgets.

## Autonomy And Governance Placement

- [Claude Code](../library/repo-anthropics-claude-code.md) and
  [Codex](../library/repo-openai-codex.md)
  place autonomy close to a user-invoked coding loop and governance in config, approvals, and repo
  instructions.
- [OpenClaw](../library/repo-openclaw.md)
  places autonomy in a persistent assistant runtime and governance in the Gateway/session layer.
- [Multica](../library/repo-multica.md)
  places autonomy in managed agents but governance in platform orchestration, runtime selection,
  daemon liveness, and task/autopilot records.
- [Paperclip](../library/repo-paperclip.md)
  allows persistent autonomy but makes governance first-class through approvals, budgets, and
  rollback.

## Vocabulary Comparison

| Term | Claude Code | Codex | OpenClaw | Multica | Paperclip |
| --- | --- | --- | --- | --- | --- |
| main product unit | coding agent | coding agent / CLI | personal assistant | managed agent teammate | agent company / worker |
| extension package | plugin | repo guidance + runtime features, less plugin-centric in the inspected docs | plugin | skill plus runtime provider | plugin plus adapter |
| local execution bridge | terminal session | local CLI runtime | Gateway + native runtime | daemon | adapter / runtime bridge |
| durable coordination object | project config and plugin structure | repo files, config, memories | session owned by Gateway | runtime + task + agent records | ticket + goal + budget + approval |
| governance term | hooks/config/user control | sandbox/approval mode | Gateway ownership and security policy | workspace/runtime management | governance, board, rollback |

These repos use very different product nouns. `Agent` in Claude Code and Codex is close to a
harnessed coding loop. In Multica it is a managed teammate record. In Paperclip it is a company
worker under governance. In OpenClaw it sits inside a broader assistant product anchored by the
Gateway.

## Source Classification

- Runtime references:
  [repo-anthropics-claude-code.md](../library/repo-anthropics-claude-code.md),
  [repo-openai-codex.md](../library/repo-openai-codex.md)
- Runtime-plus-platform reference:
  [repo-openclaw.md](../library/repo-openclaw.md)
- Control-plane references:
  [repo-multica.md](../library/repo-multica.md),
  [repo-paperclip.md](../library/repo-paperclip.md)

## Tensions To Preserve

- When does a runtime product become a platform product?
- How much of session truth should stay local to the workspace versus platform-managed?
- Which extension surfaces are actually runtime concerns, and which are control-plane concerns?
- How much governance should a reference product carry before it stops being a good runtime model?
