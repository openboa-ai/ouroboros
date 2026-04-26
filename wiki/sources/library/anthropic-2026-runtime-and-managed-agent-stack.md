# Anthropic 2026 Runtime And Managed-Agent Stack

## Source

This note clusters Anthropic runtime, managed-agent, and product references from the April 2026
ingestion pass:

- [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- [Managed Agents memory](https://platform.claude.com/docs/en/managed-agents/memory)
- [Managed Agents engineering post](https://www.anthropic.com/engineering/managed-agents)
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Claude Managed Agents blog](https://claude.com/blog/claude-managed-agents)
- [Claude Cowork](https://www.anthropic.com/product/claude-cowork)
- [Project Deal](https://www.anthropic.com/features/project-deal)
- [Claude Code auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode)
- [Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Measuring AI agent autonomy in practice](https://www.anthropic.com/news/measuring-agent-autonomy)

## Consumed By Synthesis

- [agent-runtime-and-harness-principles.md](../synthesis/agent-runtime-and-harness-principles.md)
- [proactive-operations-and-runtime-control.md](../synthesis/proactive-operations-and-runtime-control.md)
- [evaluation-governance-and-promotion.md](../synthesis/evaluation-governance-and-promotion.md)
- [reference-systems-and-product-postures.md](../synthesis/reference-systems-and-product-postures.md)

## URL Coverage

| URL | Ingestion role | autokairos design implication |
| --- | --- | --- |
| https://platform.claude.com/docs/en/managed-agents/overview | Managed Agents API overview | Ground `AgentSpec`, `HandsEnvironment`, `AgentSession`, `AgentEvent`, tool, file, memory, vault, and event-stream vocabulary. |
| https://platform.claude.com/docs/en/managed-agents/memory | Managed Agents memory docs | Treat memory as scoped managed context, not hidden provider state or evidence. |
| https://www.anthropic.com/engineering/managed-agents | Managed Agents engineering rationale | Preserve brain/hands/session separation and session truth outside the current harness/container. |
| https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents | Long-running harness pattern | Use handoff artifacts and setup context for long tasks; do not rely on one uninterrupted context window. |
| https://www.anthropic.com/engineering/harness-design-long-running-apps | Generator/evaluator/handoff harness design | Separate worker generation from evaluator judgment and preserve structured handoff artifacts across resets. |
| https://claude.com/blog/claude-managed-agents | Product posture | Treat Claude Managed Agents as hosted provider capability, not autokairos product truth. |
| https://www.anthropic.com/product/claude-cowork | Product posture | Use cowork/re-entry as an operator-product reference, not a trading authority model. |
| https://www.anthropic.com/features/project-deal | Agent-mediated marketplace experiment | Model/provider quality can create objective economic advantage that humans may not perceive; external evaluation is mandatory. |
| https://www.anthropic.com/engineering/claude-code-auto-mode | Permission mode reference | Auto mode means bounded permission posture, not unrestricted live trading authority. |
| https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills | Skills packaging reference | Shape `CapabilityPackage` as reusable, inspectable, secret-free procedural context. |
| https://www.anthropic.com/news/measuring-agent-autonomy | Autonomy measurement reference | Evaluate autonomy from observed behavior, intervention rate, and task outcomes instead of architecture labels. |

## What This Source Is

This cluster is Anthropic's strongest current material for long-running agent runtime design,
managed sessions, memory, skills, and autonomy measurement.

It is not a trading-system blueprint. It is a boundary reference for how autokairos should separate
brain, hands, session, memory, tools, permissions, and autonomy measurement.

## Core Thesis

Long-running agents become practical when the system separates:

- model reasoning from hands/work environment
- session state from ephemeral harness execution
- memory from hidden private context
- skills/tools from unconstrained authority
- autonomy measurement from vague "agentic" claims

## Key Mechanisms / Architecture

| Mechanism | Anthropic posture | autokairos translation |
| --- | --- | --- |
| Agent / Environment / Session / Events | Managed Agents exposes agent setup, environments, sessions, and event streams as first-class concepts. | Keep `AgentSpec`, `HandsEnvironment`, `AgentSession`, `AgentRun`, `AgentEvent`, and `Trace` separated. |
| Brain / hands / session | Engineering writing emphasizes decoupled reasoning, execution environment, and session continuity. | `TraderSystemRuntime` may use external providers, but durable trace and authority stay in autokairos. |
| Memory | Managed memory is a controlled context surface, not a random dump of private runtime state. | Long-term trading memory must be explicit artifacts, scoped, inspectable, and safe to remove. |
| Harness design | Long-running work needs handoff artifacts, setup, progress records, and verification loops. | Runtime recovery should use trace/checkpoints and exported artifacts, not provider-local memory. |
| Auto mode | Permission skipping is safer only when bounded by explicit mode and risk controls. | Trading auto-execution cannot mean direct exchange authority; gateway remains the authority boundary. |
| Skills | Skills package procedural knowledge and reusable capabilities. | `CapabilityPackage` should be package-like, permission-declared, and secret-free. |
| Autonomy measurement | Agent autonomy should be measured in practice, not claimed from architecture labels. | autokairos must judge delegated live runtime by evidence, intervention rate, and operator control. |

## Important Passages Or Facts

- Managed Agents docs organize the system around Agent, Environment, Session, Events, files, tools,
  vaults, memory, multi-agent behavior, observability, and outcomes.
- The engineering material treats session continuity as durable infrastructure outside the current
  harness/container.
- Claude Code auto mode is framed as a safer permission-skipping mode, not an argument for removing
  permission boundaries.
- Agent Skills are reusable capability packages that let agents load targeted procedural knowledge
  and resources.
- Claude Cowork and Managed Agents product pages emphasize shared work, long-running tasks, memory,
  and organizational control.

## Vocabulary And Mental Models

| Anthropic term | autokairos term |
| --- | --- |
| Agent | `AgentSpec` |
| Environment | `HandsEnvironment` / `RuntimePlacement` depending on context |
| Session | `AgentSession` plus durable `Trace` |
| Events | `AgentEvent` / `ProgramEvent` / trace spans |
| Memory | scoped memory artifacts, not hidden provider state |
| Skills | `CapabilityPackage` / `CapabilityManifest` |
| Vaults | vault/credential binding outside package and sandbox |
| Outcomes | evaluation signal, not self-report truth |

## Transferable Lessons

- Keep brain/hands/session separate in every architecture diagram.
- Keep session/event history outside ephemeral runtime placement.
- Use skills/capability packages as inspectable artifacts, not hidden prompt blobs.
- Treat memory as scoped, governed, and auditable.
- Treat auto mode as a risk-managed permission posture, never as proof that live trading authority
  belongs to the agent.
- Measure autonomy with observed behavior and outcomes, not labels.

## Non-transferable Baggage

- Managed Agents is a hosted provider product; autokairos should not clone its infrastructure.
- Claude product memory and workspace affordances do not define trading evidence or live authority.
- Auto mode permission posture for coding does not transfer directly to financial execution.
- Claude Cowork is a product posture reference, not a trader-system control-plane spec.

## Open Questions / Tensions

- Which memories should be available to a live trader system, and which should require review before
  reuse?
- How should autokairos represent "session resume" when a provider cannot actually resume native
  hidden state?
- What autonomy measurement best predicts safe delegation in live trading?
- How much skill packaging belongs in first MLP versus later marketplace boundaries?
