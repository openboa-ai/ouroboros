# Autokairos Project Operating Manual

This file contains always-on repo rules for agents. It is not a skill and it is not product
architecture. Skills live under [skills/](skills/) and are loaded only when the task calls for them.

## Operating Model For Repo Work

Keep three layers distinct:

- Product runtime: how autokairos operates as a trader-system control plane.
- Repo workflow: how this repository moves from sources to design to implementation.
- Skills: bounded, on-demand procedures for recurring project work.

The default repo workflow is:

```text
recover current truth
-> choose one frontier
-> execute one bounded owner path
-> verify
-> decide keep/discard/reroute
-> llm-wiki writeback when durable
```

Use [skills/AGENTS.md](skills/AGENTS.md) as the routing registry for that workflow.

## Source-First Design Gate

Do not change runtime, provider, agent, harness, evaluation, trading-authority, operator-control, or
security architecture from memory or taste.

Before changing those areas:

- Read [../wiki/sources/library/index.md](../wiki/sources/library/index.md) and the relevant
  synthesis page under [../wiki/sources/synthesis/](../wiki/sources/synthesis/).
- If a source-impact audit exists for the affected source set, read it before changing active docs.
- If the maintained source layer is missing, stale, or shallow, research first and add a source note
  before editing product or architecture truth.
- Prefer primary sources in this order: official API/product docs, official GitHub repositories,
  official engineering/research posts, protocol specifications, papers, then third-party analysis.
- Treat third-party posts as heuristics only. They do not define provider capability, API truth, or
  security posture by themselves.

If a design change cannot name its source grounding, it is not ready to become active truth.

## Source Intake Workflow

Use this workflow when a new reference changes product or architecture meaning:

```text
web/GitHub research
-> source note under wiki/sources/library/
-> synthesis update under wiki/sources/synthesis/
-> product or architecture doc update
-> knowledge-log append
```

Rules:

- Register externally supplied reference lists in
  [../wiki/sources/reference-ledger.md](../wiki/sources/reference-ledger.md).
- Keep raw/source evidence in `wiki/sources/library/`; keep cross-source conclusions in
  `wiki/sources/synthesis/`.
- Translate sources into autokairos boundaries: ownership, authority, execution location,
  recoverability, evaluation, and audit.
- Preserve source tensions instead of silently choosing whichever source fits the current design.

## Active Documentation Rules

- Treat [../README.md](../README.md) as the top-level thesis.
- Treat [../knowledge-index.md](../knowledge-index.md) as the navigation layer.
- Treat [../knowledge-log.md](../knowledge-log.md) as the append-only chronology.
- Treat [../wiki/index.md](../wiki/index.md) as the internal wiki root.
- Treat [../wiki/architecture/README.md](../wiki/architecture/README.md) as the technical design
  workspace.
- Treat [../wiki/architecture/00-system-map.md](../wiki/architecture/00-system-map.md) as the
  architecture map.
- Treat [../wiki/architecture/08-runtime-authority-model.md](../wiki/architecture/08-runtime-authority-model.md)
  and [../wiki/architecture/09-trader-system-runtime-operating-model.md](../wiki/architecture/09-trader-system-runtime-operating-model.md)
  as the current runtime authority and operating baseline.
- Treat [../wiki/architecture/specs/README.md](../wiki/architecture/specs/README.md) as the active
  spec gate.
- Treat files under `wiki/architecture/historical/` as background unless an active page explicitly
  promotes them.

## Product Architecture Guardrails

- autokairos controls lifecycle, placement, observability, permissions, gateway, evaluation, and
  audit. It does not own trader-system internal trading behavior.
- `TraderSystemRuntime` is durable logical runtime identity.
- `RuntimePlacement` is replaceable physical execution.
- `RuntimeControl` covers register, deploy, start, pause, resume, stop, inspect, override, and kill.
- `RuntimeOperatingPolicy` bounds lifecycle, placement, trace, tool/gateway access, stop conditions,
  recovery, and audit.
- Provider-backed execution stays behind:

```text
TraderSystemRuntime
-> RuntimePlacement
-> AgentSession
-> RuntimeProviderAdapter
-> external provider
-> AgentRun
-> AgentEvent
-> Trace
```

- Provider sessions do not own candidate truth, evidence, promotion, live authority, or audit.
- `Trace`, `EvidenceRecord`, `PromotionDecision`, `GatewayDecision`, and `ExecutionAttempt` remain
  separate.
- `RuntimeMemorySurface` is scoped context only. It is not evidence, promotion truth, live authority,
  or provider-private memory.
- `CapabilityPackage` declares requested context/tools/skills/data access. It never grants its own
  permissions.

## Skill And Writeback Rules

- Use repo-local skills when their description matches the task.
- Use [skills/AGENTS.md](skills/AGENTS.md) before routing multi-step repo work.
- `auto-project` owns project routing. It is not product runtime scheduling.
- `llm-wiki` owns durable source/wiki/repo-memory writeback.
- Do not create a second wiki-writeback skill. Wiki/source/project-memory ownership is consolidated
  into `llm-wiki`.
- Every completed worker path must state `writeback_needed: yes/no`.
- If `writeback_needed: yes`, route to `llm-wiki` before considering the work complete.

## Validation

Use the narrowest relevant checks, then run the full docs/security checks before commit:

```bash
bash scripts/check-docs.sh
bash scripts/check-secrets.sh
git diff --check
```

Do not keep unverified changes. Do not alter unrelated dirty worktree state.
