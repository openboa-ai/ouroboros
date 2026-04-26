# Source Note: Building Effective Agents

## Source

- Title: `Building effective agents`
- Primary URL: [https://www.anthropic.com/engineering/building-effective-agents](https://www.anthropic.com/engineering/building-effective-agents)
- Source type: engineering article
- Checked: `2026-04-18`
- Research scope:
  - primary article
  - sections:
    - `What are agents?`
    - `When (and when not) to use agents`
    - `When and how to use frameworks`
    - `Building block: The augmented LLM`
    - workflow sections:
      `Prompt chaining`, `Routing`, `Parallelization`, `Orchestrator-workers`, `Evaluator-optimizer`
    - `Agents`
    - `Summary`
    - appendices:
      `Agents in practice`, `Prompt engineering your tools`

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| Primary article | engineering essay | definition of `workflow` vs `agent` | establishes Anthropic's vocabulary baseline |
| Primary article | engineering essay | pattern catalog for workflows | defines the non-agent baseline Anthropic recommends first |
| Primary article | engineering essay | `Agents` section | shows when Anthropic thinks true autonomy is warranted |
| Primary article | engineering essay | `Summary` and appendices | captures implementation principles and concrete domains |

## What This Source Is

This is Anthropic's broad engineering guidance on agentic systems. It is not a runtime-specific
document and not a research paper. Its main value is terminological and architectural: it defines
what Anthropic means by `workflow`, `agent`, `augmented LLM`, and `ACI`, and it argues that most
teams should begin with simpler patterns before escalating to autonomous agents.

## Core Thesis

- Anthropic uses `agentic systems` as an umbrella category, but makes a sharp distinction between
  `workflows` and `agents`.
- The default recommendation is to start with the simplest solution that can work and add
  complexity only when outcomes justify it.
- Well-defined tasks with predictable paths fit workflows better than full agents.
- Open-ended tasks with uncertain step counts and meaningful environmental feedback are where
  agents become useful.
- Tool quality and agent-computer interface quality are first-class engineering concerns, not
  afterthoughts.
- Simplicity, transparency, and clear tool design are treated as reliability principles.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Augmented LLM` | the foundational building block: model + retrieval + tools + memory | section `Building block: The augmented LLM` |
| `Prompt chaining` | fixed sequential decomposition with gates between stages | section `Workflow: Prompt chaining` |
| `Routing` | classify input and dispatch to a specialized downstream prompt/tool path | section `Workflow: Routing` |
| `Parallelization` | split or repeat work in parallel for speed or confidence | section `Workflow: Parallelization` |
| `Orchestrator-workers` | one model dynamically decomposes work and delegates to workers | section `Workflow: Orchestrator-workers` |
| `Evaluator-optimizer` | one model generates while another critiques in a loop | section `Workflow: Evaluator-optimizer` |
| `Agent` | an open-ended tool-using loop directed by the model itself | section `Agents` |
| `ACI` | the interface exposed between the agent and its tools/computer environment | `Summary`, Appendix 2 |

### Architectural Reading

- The article does not define a control plane, session store, or durable evaluation service.
- It does define a decision ladder for when to use no agent, when to use workflows, and when to
  use agents.
- It assumes that the surrounding application can enforce checkpoints, stopping conditions, and
  tool contracts outside the model loop.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| Anthropic explicitly distinguishes `workflows` from `agents` | section `What are agents?` |
| `Workflows` are predefined code paths, while `agents` dynamically direct process and tool usage | section `What are agents?` |
| Anthropic recommends finding the simplest solution possible before building agents at all | section `When (and when not) to use agents` |
| frameworks can hide prompts/responses and make systems harder to debug | section `When and how to use frameworks` |
| the article presents five concrete workflow patterns before discussing autonomous agents | `Building blocks, workflows, and agents` and the five workflow subsections |
| agent usefulness depends on environmental `ground truth` and explicit stopping conditions | section `Agents` |
| extensive sandbox testing and guardrails are recommended for autonomous agents | section `Agents` |
| Anthropic's three summary principles are simplicity, transparency, and ACI quality | section `Summary` |
| coding agents are treated as a strong fit because tests give verifiable feedback | Appendix 1, subsection `Coding agents` |
| tools should receive the same prompt-engineering attention as the main prompt | Appendix 2, `Prompt engineering your tools` |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `agentic systems` | umbrella category covering both workflows and agents | `What are agents?` | broadest Anthropic framing |
| `workflow` | LLMs and tools orchestrated through predefined code paths | `What are agents?` | non-agent baseline Anthropic wants teams to try first |
| `agent` | system where the LLM directs its own process and tool usage | `What are agents?`, `Agents` | Anthropic's narrow definition of autonomy |
| `augmented LLM` | model enhanced with retrieval, tools, and memory | `Building block: The augmented LLM` | base primitive underneath all higher patterns |
| `ground truth` | feedback from the environment, especially tool results or execution results | `Agents` | critical for long-running autonomous loops |
| `ACI` | agent-computer interface; tool and environment interface quality | `Summary`, Appendix 2 | core reliability and usability concern |
| `orchestrator-workers` | dynamic delegation pattern | dedicated workflow section | closest workflow analogue to multi-step coding agents |
| `evaluator-optimizer` | iterative generator/critic loop | dedicated workflow section | early governance-like pattern inside a workflow |

## Transferable Lessons

- Keep `workflow` and `agent` as distinct ideas rather than collapsing them into one vague
  abstraction.
- Treat tool and workspace interface quality as part of system design, not only prompt design.
- Prefer explicit workflow scaffolding where the path should be predictable.
- Use agents where the step count is open-ended and real environmental feedback can guide recovery.
- Keep stopping conditions and guardrails outside the agent's own self-description.

## Non-transferable Baggage

- The article is intentionally general-purpose and does not solve durable session ownership,
  external evaluation, or governance-heavy promotion.
- It is guidance for application builders, not a fully specified runtime architecture.
- The pattern catalog is descriptive and pedagogical; it is not a complete system decomposition.

## Open Questions / Tensions

- Where is the practical boundary between a very flexible workflow and a narrow agent loop?
- How much agent autonomy is useful before the cost/error compounding tradeoff flips negative?
- Which parts of ACI quality are universal versus domain-specific?
- How often should a system revisit the choice between workflow and agent as model capabilities
  improve?
