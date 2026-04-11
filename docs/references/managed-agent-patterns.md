# Managed-Agent Patterns

Accessed on April 11, 2026.

This note captures the source-backed managed-agent concepts AutoKairos should adopt on the agent
side while keeping its own workspace-first and trading-specific architecture.

## Sources

1. Anthropic, `Claude Managed Agents overview`
   URL: https://platform.claude.com/docs/en/managed-agents/overview

2. Anthropic, `Scaling Managed Agents: Decoupling the brain from the hands`
   URL: https://www.anthropic.com/engineering/managed-agents

3. Multica, `README`
   URL: https://github.com/multica-ai/multica

## What Matters From Anthropic

Anthropic's managed-agent overview defines four core concepts:

- `Agent`
- `Environment`
- `Session`
- `Events`

That split is more important than the hosted product itself.
It gives AutoKairos the right top-level vocabulary for the agent side of the system.

The engineering write-up adds the more important implementation lesson:

- the `brain`
- the `hands`
- and the `session`

should not collapse into the same component.

For AutoKairos, this means:

- provider brains must be replaceable
- execution environments must be easier to rotate than the whole system
- durable session truth must live outside any one model context window

## What Matters From Multica

Multica is not a trading architecture, but its README expresses a useful product shape:

- an orchestrator feeling
- an agent workforce feeling
- runtimes as explicit execution surfaces
- local daemons or runtimes connected into one control plane

The useful takeaway is not its exact stack.
The useful takeaway is that users should experience agents as explicit teammates/workers under one
orchestrated system rather than as anonymous prompt loops.

## AutoKairos Implications

AutoKairos should adopt this shape:

- `workspace asset`
  The durable local home of the managed-agent system
- `orchestrator`
  The control plane that manages agent sessions and promotion/evaluation flows
- `agents`
  Provider-neutral worker definitions declared in the workspace
- `environments`
  Configured execution surfaces for those agents
- `sessions and event logs`
  Durable work history inside the workspace asset
- `execution core`
  A separate safety-critical bounded context that is not just another agent

This preserves the managed-agent pattern where it matters while keeping the trading path narrow.

## What AutoKairos Should Not Copy Blindly

- hosted-first assumptions
- externally owned durable session storage as the primary source of truth
- generic cloud agent platform scope
- collapsing live execution into the same boundary as agent experimentation

## Resulting Design Rule

The agent side of AutoKairos should feel like a local managed-agent system.
The rest of the application should still follow the stronger system-design patterns already chosen:

- Hexagonal Architecture
- CQRS-light
- Snapshot + Event Journal
- State Machine + Policy
- Adapter / Strategy
