# Repo Local Agents

This repository is currently design-first.

## Design Research Gate

Do not change runtime, provider, agent, harness, evaluation, trading-authority, operator-control, or
security architecture from memory or taste.

Before changing those areas:

- Read the maintained source layer first:
  [wiki/sources/library/index.md](../wiki/sources/library/index.md) and the relevant synthesis page
  under [wiki/sources/synthesis/](../wiki/sources/synthesis/).
- If a current reference-impact audit exists for the affected source set, read it before changing
  active product or architecture docs.
- If the maintained source layer is missing, stale, or too shallow for the decision, perform new
  research before writing product or architecture docs.
- Prefer primary sources in this order:
  official API/product docs, official GitHub repositories, official engineering/research posts,
  protocol specifications, peer-reviewed or preprint papers, then third-party analysis.
- Use third-party posts and blogs as heuristics only. They may shape design warnings, but they must
  not define API truth, provider capability, security posture, or architecture vocabulary by
  themselves.
- For OpenAI, Anthropic, Google ADK/A2A, MCP, ACP, Codex, Claude Code, OpenClaw, or other provider
  surfaces, inspect official docs and/or GitHub repository files before treating a capability as
  implementable.
- Do not invent new canonical runtime vocabulary until it is mapped against the maintained source
  vocabulary and the active architecture docs.

If a design change cannot name its source grounding, it is not ready to become active truth.

## Source Intake Workflow

Use this workflow whenever a new reference changes product or architecture meaning:

```text
web/GitHub research
-> source note under wiki/sources/library/
-> synthesis update under wiki/sources/synthesis/
-> product or architecture doc update
-> knowledge-log append
```

Rules:

- Register externally supplied reference lists in
  [wiki/sources/reference-ledger.md](../wiki/sources/reference-ledger.md) before writing architecture
  or product conclusions.
- For large reference batches, add or update a source-impact audit under
  [wiki/sources/synthesis/](../wiki/sources/synthesis/) before editing active architecture.
- Keep raw/source evidence in `wiki/sources/library/`; keep cross-source conclusions in
  `wiki/sources/synthesis/`.
- Use the source-note schema from [wiki/sources/library/index.md](../wiki/sources/library/index.md):
  source, what it is, core thesis, mechanisms, passages/facts, vocabulary, transferable lessons,
  non-transferable baggage, and tensions.
- Do not copy source-specific product shape blindly. Translate sources into autokairos boundaries:
  ownership, authority, execution location, recoverability, evaluation, and audit.
- When sources disagree, preserve the tension in synthesis instead of silently choosing the one that
  fits the current design.
- Update [knowledge-log.md](../knowledge-log.md) only with durable changes, not every transient
  search.

## Design Quality Checklist

Before promoting a design to active docs, check:

- Did we preserve semantic context, or did we prematurely collapse it into enums, booleans, or
  deterministic route handlers?
- Did we accidentally turn an agent-driven system into a central FSM, workflow engine, or event
  dispatch table?
- Are `brain`, `hands`, and `session` separated?
- Are harness, compute/sandbox, durable trace, and control-plane truth separated?
- Are logical runtime identity and physical execution placement separated?
- Are trader-system spec, executable program, program manifest, and program validation separated?
- Is every provider label tied to a concrete invocation surface, probe, auth/model/tool access check,
  output contract, and trace/export path?
- Are `Trace`, `EvidenceRecord`, `PromotionDecision`, `GatewayDecision`, `ExecutionAttempt`, wake,
  and audit boundaries still distinct?
- Are secrets, exchange credentials, evaluator ground truth, and live gateway authority outside
  sandbox/program/capability-package reach?
- Does every capability package flow through manifest declaration, admission, stage-bound grant, and
  traceable mount instead of letting the package grant its own permissions?
- Does every diagram answer one question only: durable truth, physical placement, authority,
  recovery, or delivery?
- Does the design state what autokairos owns versus what it borrows from external providers?
- Does the design include failure, retry/resume, trace, inspection, and operator-control behavior?

If any answer is unclear, keep the document as draft/background and do not treat it as active
implementation guidance.

## Documentation Cleanup Gate

Use this gate when the task is cleanup, navigation, or baseline locking rather than new design.

Before editing active docs:

- Check whether the issue is stale wording, read-path drift, active/historical confusion, or a real
  design gap.
- Prefer compressing navigation over adding another page.
- Keep [knowledge-index.md](../knowledge-index.md) focused on default read path, catalog entrypoints,
  and current guardrails.
- Keep long file inventories in directory READMEs, not in the top-level index.
- Keep [wiki/architecture/specs/README.md](../wiki/architecture/specs/README.md) as the physical
  active-spec gate; do not link historical specs as equal-weight active truth.
- When a hardening pass has already promoted a finding into active design, update source audit
  wording from future action to completed/hardened status.
- Run stale-term and link checks after cleanup so old vocabulary does not become canonical again.

## Required Research Anchors

Use these source clusters when changing the corresponding design area:

- Weak-to-strong and evaluation thesis:
  [reference-ledger.md](../wiki/sources/reference-ledger.md),
  [anthropic-automated-alignment-researchers.md](../wiki/sources/library/anthropic-automated-alignment-researchers.md),
  [anthropic-automated-w2s-researcher.md](../wiki/sources/library/anthropic-automated-w2s-researcher.md),
  [proactive-agent-research-papers.md](../wiki/sources/library/proactive-agent-research-papers.md),
  [repo-safety-research-automated-w2s-research.md](../wiki/sources/library/repo-safety-research-automated-w2s-research.md),
  and [evaluation-governance-and-promotion.md](../wiki/sources/synthesis/evaluation-governance-and-promotion.md).
- Long-running agent runtime and harness:
  [anthropic-2026-runtime-and-managed-agent-stack.md](../wiki/sources/library/anthropic-2026-runtime-and-managed-agent-stack.md),
  [openai-2026-agent-codex-workspace-stack.md](../wiki/sources/library/openai-2026-agent-codex-workspace-stack.md),
  [google-2026-agent-platform-and-protocols.md](../wiki/sources/library/google-2026-agent-platform-and-protocols.md),
  [anthropic-managed-agents.md](../wiki/sources/library/anthropic-managed-agents.md),
  [anthropic-effective-harnesses-for-long-running-agents.md](../wiki/sources/library/anthropic-effective-harnesses-for-long-running-agents.md),
  [openai-next-evolution-of-the-agents-sdk.md](../wiki/sources/library/openai-next-evolution-of-the-agents-sdk.md),
  [openai-agents-sdk-and-sandbox.md](../wiki/sources/library/openai-agents-sdk-and-sandbox.md),
  and [agent-runtime-and-harness-principles.md](../wiki/sources/synthesis/agent-runtime-and-harness-principles.md).
- Provider and coding-harness execution:
  [repo-openai-codex.md](../wiki/sources/library/repo-openai-codex.md),
  [repo-anthropics-claude-code.md](../wiki/sources/library/repo-anthropics-claude-code.md),
  [repo-openclaw.md](../wiki/sources/library/repo-openclaw.md), and
  [agent-client-protocol.md](../wiki/sources/library/agent-client-protocol.md).
- Agent interoperability and tools:
  [google-2026-agent-platform-and-protocols.md](../wiki/sources/library/google-2026-agent-platform-and-protocols.md),
  [google-agent-development-kit.md](../wiki/sources/library/google-agent-development-kit.md),
  [google-agent2agent-a2a.md](../wiki/sources/library/google-agent2agent-a2a.md),
  and [model-context-protocol.md](../wiki/sources/library/model-context-protocol.md).
- Semantic agent design:
  [phil-schmid-why-engineers-struggle-building-agents.md](../wiki/sources/library/phil-schmid-why-engineers-struggle-building-agents.md)
  and [proactive-agent-research-papers.md](../wiki/sources/library/proactive-agent-research-papers.md).

## Rules

- Keep the autokairos runtime model separate from the planning/development/documentation process.
  The runtime model explains how the product operates:
  `Operator -> Control Plane -> Candidate Factory -> TraderSystemCandidate Pool -> Stage-bound TraderSystemRuntimes -> Trace -> External Evaluation -> Promotion -> Bounded Live Runtime -> Wake/Intervention/Audit`.
  Do not describe `research/source -> product truth -> architecture -> implementation design -> delivery`
  as autokairos runtime behavior.
- Use `research/source -> product truth -> architecture -> implementation design -> delivery` only as
  the repo's planning, development, and documentation workflow. It is a build process for creating
  autokairos, not the system that autokairos runs.
- When documenting durable product behavior, start from the runtime operating loop and object
  boundaries. When documenting work execution, start from the planning/development workflow.
- Do not use delivery units as the primary explanation of the architecture.
  First explain runtime roles, concern areas, authority boundaries, execution placement, and
  recovery. Only after that map is clear should delivery slicing be discussed.
- Treat [README.md](../README.md) as the top-level thesis.
- Treat [knowledge-index.md](../knowledge-index.md) as the navigation layer.
- Treat [knowledge-log.md](../knowledge-log.md) as the append-only chronology.
- Treat [wiki/index.md](../wiki/index.md) as the internal wiki root.
- Treat [wiki/product/README.md](../wiki/product/README.md) as the canonical product workspace.
- Treat [wiki/product/mlp-01/07-implementation-plan.md](../wiki/product/mlp-01/07-implementation-plan.md) as background delivery planning until the upper architecture model is stable.
- Treat [wiki/product/mlp-01/08-greenfield-bootstrap-plan.md](../wiki/product/mlp-01/08-greenfield-bootstrap-plan.md) as the canonical code-substrate planning page while the repo remains in docs-only reset posture.
- Treat [wiki/architecture/06-runtime-provider-adapter-feasibility.md](../wiki/architecture/06-runtime-provider-adapter-feasibility.md) as mandatory before implementing real Codex, Claude, OpenClaw/ACP, or A2A runtime provider execution.
- Do not treat a provider label as runnable without a current `ProviderReadinessRecord`.
  `Codex`, `Claude`, `OpenClaw`, `A2A`, and `local_process` must resolve to concrete
  `provider_kind`, invocation surface, auth/model access posture, output contract, trace/export
  path, and probe result before implementation uses them.
  The current first runnable assumption is intentionally narrow:
  `provider_kind=codex_cli`, `model=gpt-5.4`, `AgentRun.purpose=candidate_generation`, and schema
  output. Do not silently widen that assumption to default `gpt-5.5`, SDKs, cloud providers, or
  remote endpoints.
- Treat [wiki/architecture/07-production-design-method.md](../wiki/architecture/07-production-design-method.md) as the production-level design bar before deepening or implementing any runtime concern.
- Treat [wiki/architecture/08-runtime-authority-model.md](../wiki/architecture/08-runtime-authority-model.md) as the canonical design-first map for runtime roles, ownership, authority, execution location, and recovery before using delivery-slicing documents.
- Treat [wiki/architecture/09-trader-system-runtime-operating-model.md](../wiki/architecture/09-trader-system-runtime-operating-model.md) as the canonical operating model for how autokairos deploys and controls agent-built trader systems without becoming the trader-system brain.
- Treat [wiki/architecture/specs/07-runtime-connector-contract.md](../wiki/architecture/specs/07-runtime-connector-contract.md) as the active connector contract between a logical runtime and physical execution. Do not call this layer a supervisor.
- Treat provider-backed runtime execution as a locked boundary:
  `TraderSystemRuntime -> RuntimePlacement -> AgentSession -> RuntimeProviderAdapter -> external provider -> AgentRun -> AgentEvent -> Trace`.
  Do not describe Codex, Claude, OpenClaw/ACP, A2A, or local process sessions as product truth
  owners, evaluators, gateways, or durable runtime identity.
- Treat [wiki/architecture/specs/15-runtime-operating-policy-contract.md](../wiki/architecture/specs/15-runtime-operating-policy-contract.md) as the active runtime operating boundary. Do not reintroduce the older agent-loop-policy or semantic-wake runtime model.
- Runtime control is lifecycle/governance, not closed event routing and not internal step orchestration.
  Use `RuntimeControl` for register, deploy, start, pause, resume, stop, inspect, override, and kill.
  Do not reintroduce semantic-wake primitives as active runtime primitives. The trader system owns
  its internal trading loop and decides whether to call provider-backed agents.
- Treat `RuntimeMemorySurface` as scoped runtime context only. It may be derived from trace,
  approved artifacts, package context, or operator-visible notes, but it is not evidence, promotion
  truth, live authority, or provider-private memory.
- Treat [wiki/architecture/specs/09-trace-contract.md](../wiki/architecture/specs/09-trace-contract.md) as the minimum recoverable session trace contract.
- Treat [wiki/architecture/specs/README.md](../wiki/architecture/specs/README.md) as the physical
  active-spec gate. Markdown files outside that directory, especially under
  [wiki/architecture/historical/](../wiki/architecture/historical/), are background unless an active
  page explicitly promotes them.
- Treat delivery-shape pages under `wiki/architecture/01-04` as background until the upper runtime
  architecture is stable.
- Treat [wiki/architecture/README.md](../wiki/architecture/README.md) as the canonical technical design workspace downstream of product truth.
- Treat old subsystem-level implementation-plan pages as background unless a newer doc explicitly promotes them back to the active baseline.
- Treat [wiki/architecture/foundation/02-documentation-doctrine.md](../wiki/architecture/foundation/02-documentation-doctrine.md) as the rule for what counts as a real design doc.
- Treat [wiki/architecture/adrs/README.md](../wiki/architecture/adrs/README.md) as the rule for major architectural decisions.
- Treat [wiki/sources/README.md](../wiki/sources/README.md) as the raw-source layer rule.
- Treat [docs/README.md](../docs/README.md) as reserved future space for external service documentation rather than the current internal design wiki.
- Prefer updating the product docs first, then the architecture docs, over inventing chat-only answers when the result has durable value.
- Keep major design decisions in ADRs instead of burying them in README or section prose.
- Use repo-local skills under `.agents/skills/` when they match the task.
- Use [.agents/skills/AGENTS.md](skills/AGENTS.md) as the repo-local skill registry. For project
  execution, route through the harness skills there; for source/wiki maintenance, use `llm-wiki`.

## Current Focus

- AutoKairos runtime authority model
- role and concern separation
- logical `TraderSystemRuntime` versus physical `RuntimePlacement`
- optional `ExecutionPod` only for pod-like physical execution groups
- candidate/spec/program/package/binding ownership
- provider, brain, hands, and session execution placement
- runtime-control operating model for deploying and controlling agent-built trader systems
- trace, checkpoint, recovery, and audit boundaries
- evaluation, promotion, live gateway, and operator-control authority boundaries
- delivery slicing only after the above design model is clear
- `AgentSpec`, `AgentSession`, `AgentRun`, `AgentEvent`, and A2A-compatible communication seams for
  future multi-agent runtime shapes
- concrete runtime-provider adapter surfaces, starting with `codex_cli` rather than vague provider
  labels
- provider-backed agent execution inside `TraderSystemRuntime`, without letting provider sessions
  own candidate truth, evidence, promotion, live execution authority, wake semantics, or audit

Use Claude Managed Agents naming as the default mental model where it fits:

- `AgentSpec` ~= configured `Agent`
- `HandsEnvironment` ~= configured execution `Environment`
- `AgentSession` ~= running `Session`
- `AgentRun` ~= one provider invocation / task / turn
- `AgentEvent` ~= raw observable `Events`
- `Trace` ~= autokairos durable normalized execution history

Keep logical and physical execution boundaries separate:

- `TraderSystemRuntime` = logical stage-bound runtime boundary.
- `RuntimePlacement` = physical process/container/provider/endpoint placement.
- `ExecutionPod` = optional physical execution group; never durable product truth.
- `HandsEnvironment` = sandbox/tool/data surface.
- `BrainSession` = provider or harness reasoning session.
- `Trace` = durable recoverable session log outside physical runtime state.

Keep protocol boundaries separate:

- A2A = remote agent communication.
- ACP = external coding-harness bridge.
- MCP = tool/resource/prompt access.

Do not reintroduce the old global runtime-unit role taxonomy in active docs.
Use concern-local `AgentRun.purpose` plus concrete `provider_kind` instead.

Do not let `local_process` become an escape hatch around the provider-backed runtime boundary. If a
local process is used, it still needs explicit adapter semantics, trace export, permission boundary,
and failure handling.

UI remains out of scope unless explicitly brought back later.
