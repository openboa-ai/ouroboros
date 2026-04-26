# Source Note: The Next Evolution Of The Agents SDK

## Source

- Title: `The next evolution of the Agents SDK`
- Primary URL: [https://openai.com/index/the-next-evolution-of-the-agents-sdk/](https://openai.com/index/the-next-evolution-of-the-agents-sdk/)
- Source type: engineering / product article
- Checked: `2026-04-18`
- Research scope:
  - primary article
  - adjacent official docs:
    - `https://developers.openai.com/api/docs/guides/agent-evals`
    - `https://developers.openai.com/api/docs/guides/trace-grading`
    - `https://developers.openai.com/api/docs/guides/node-reference`
    - `https://openai.github.io/openai-agents-js/guides/running-agents/`
    - `https://openai.github.io/openai-agents-js/guides/sessions/`
    - `https://openai.github.io/openai-agents-js/guides/results/`
    - `https://openai.github.io/openai-agents-js/guides/context/`
    - `https://openai.github.io/openai-agents-js/guides/human-in-the-loop/`
    - `https://openai.github.io/openai-agents-js/guides/guardrails/`
    - `https://openai.github.io/openai-agents-js/guides/agents/`
  - sections:
    - rationale for a more capable harness
    - `A more capable harness for the agent loop`
    - `Native sandbox execution`
    - `Separating harness from compute for security, durability, and scale`
    - `What’s next`

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| Primary article | product/engineering essay | problem statement around production agent systems | clarifies what gaps OpenAI is trying to close |
| Primary article | product/engineering essay | harness-primitives section | establishes the runtime vocabulary |
| Primary article | product/engineering essay | native sandbox section | defines workspace and sandbox posture |
| Primary article | product/engineering essay | harness/compute split section | gives the strongest direct statement on security, durability, and scale |
| Primary article | product/engineering essay | next-steps section | shows intended future primitives such as code mode and subagents |
| `Evaluate agent workflows` | official guide | traces, graders, datasets, eval runs | clarifies OpenAI's official evaluation vocabulary around agent workflows |
| `Trace grading` | official guide | traces as end-to-end run records with structured grading | reinforces external evidence and run-record language |
| `Node reference` | official guide | start node, agent node, state variables, attached evaluations | clarifies OpenAI's workflow-state vocabulary |
| `Running agents` | SDK guide | memory strategies, session vs conversation vs previous response continuation | clarifies execution-continuity choices |
| `Sessions` | SDK guide | persistent memory layer and resumable runs | clarifies session semantics |
| `Results` | SDK guide | resumable state, interruptions, and result surfaces | clarifies run/result vocabulary |
| `Context` | SDK guide | local app context versus conversation state | clarifies context boundaries |
| `Human-in-the-loop` | SDK guide | approval interruptions, serialized `RunState`, long-gap resume | clarifies approval vs resume semantics |
| `Guardrails` | SDK guide | input/output/tool guardrails and tripwires | clarifies execution-time safety surfaces |
| `Agents` | SDK guide | lifecycle hooks and cloning model | clarifies runtime-facing agent capabilities |

## What This Source Is

This is OpenAI's engineering and product framing for a more capable Agents SDK. It is both a
platform announcement and an architectural statement. Its strongest contribution is the argument
that useful long-running agents need a more capable harness, native sandbox execution, a portable
workspace description layer, and an explicit split between harness logic and compute environments.

## Core Thesis

- Production agents need more than model access; they need a capable harness around files, systems,
  and long-running work.
- OpenAI is explicitly moving toward a `model-native harness`.
- Sandbox execution should be a first-class execution layer, not something every developer rebuilds.
- Workspace shape should be portable across providers through a `Manifest`.
- Harness and compute should be separated for security, durability, and scale.
- The SDK should absorb common frontier-agent primitives so developers can focus on domain logic.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Model-native harness` | harness aligned to how frontier models work on document/file/system tasks | section `A more capable harness for the agent loop` |
| `Configurable memory` | memory as an explicit harness capability | same section |
| `Sandbox-aware orchestration` | orchestration layer that knows about sandbox boundaries | same section |
| `Codex-like filesystem tools` | standardized file primitives folded into the harness | same section |
| `Manifest` | portable description of the agent workspace | section `Native sandbox execution` |
| `Native sandbox execution` | built-in controlled environments for files, tools, dependencies, and code execution | section `Native sandbox execution` |
| `Harness/compute split` | harness logic externalized from sandbox containers | section `Separating harness from compute for security, durability, and scale` |
| `Snapshotting and rehydration` | restoring agent state into a fresh container after sandbox loss | same section |
| `Trace grading` | grading the end-to-end trace of model decisions, tool calls, and reasoning steps | adjacent official `Trace grading` guide |
| `Eval runs` | repeatable evaluation runs over traces, datasets, and grader criteria | adjacent official `Evaluate agent workflows` guide |
| `Start node / Agent node / state variables` | workflow-level object model for inputs, state, and agent evaluation attachment | adjacent official `Node reference` guide |
| `Session` | persistent memory layer supplied to the SDK runner | adjacent official `Sessions` and `Running agents` guides |
| `RunState / state` | serializable resumable state behind a run result | adjacent official `Results` guide |
| `history / conversationId / previousResponseId` | alternative continuity strategies with different ownership of conversation state | adjacent official `Running agents` guide |
| `RunContext` | local per-run app state, distinct from conversation state | adjacent official `Context` guide |
| `RunState` approval flow | resumable paused-run surface for approval-based interruption handling | adjacent official `Human-in-the-loop` guide |
| `Guardrails` | explicit validation surface around input, output, and tools | adjacent official `Guardrails` guide |
| `Tripwire` | immediate halting signal raised by a guardrail | same guide |
| `Lifecycle hooks` | runtime callbacks such as `agent_start` and `agent_end` | adjacent official `Agents` guide |

### Architectural Reading

- The article treats workspace description as part of the runtime contract, not just deployment
  detail.
- It assumes prompt injection and exfiltration attempts as a design baseline.
- It places durable run continuity above any single container or sandbox instance.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| OpenAI says developers need systems that support inspecting files, running commands, writing code, and continuing across many steps | article problem statement immediately before `A more capable harness for the agent loop` |
| the updated harness includes configurable memory, sandbox-aware orchestration, Codex-like filesystem tools, and standardized integrations | section `A more capable harness for the agent loop` |
| OpenAI explicitly names MCP, skills, `AGENTS.md`, shell, and apply-patch as primitives in the new harness | section `A more capable harness for the agent loop` |
| sandbox execution is described as native support for controlled environments with files, tools, and dependencies | section `Native sandbox execution` |
| OpenAI introduces `Manifest` as the portability layer for the agent workspace | section `Native sandbox execution` |
| the Manifest can mount local files, define output directories, and pull data from storage providers | section `Native sandbox execution` |
| OpenAI says systems should assume prompt-injection and exfiltration attempts | section `Separating harness from compute for security, durability, and scale` |
| the harness/compute split is justified on three grounds: security, durability, and scale | section `Separating harness from compute for security, durability, and scale` |
| the article says built-in snapshotting and rehydration can continue a run after sandbox loss | same section |
| OpenAI says future expansion includes code mode and subagents | section `What’s next` |
| OpenAI's evaluation guide says traces, graders, datasets, and eval runs are the main evaluation surfaces for agent workflows | adjacent official `Evaluate agent workflows` guide |
| OpenAI says a trace captures the end-to-end record of model calls, tool calls, guardrails, and handoffs for one run | adjacent official `Evaluate agent workflows`, `Start with traces when you are still debugging behavior` |
| OpenAI defines trace grading as assigning structured scores or labels to an agent's trace to assess correctness, quality, or adherence to expectations | adjacent official `Trace grading` guide |
| OpenAI's node reference says start nodes append user input to conversation history and may add state variables | adjacent official `Node reference`, `Start` |
| OpenAI's node reference says agent nodes define instructions, tools, model configuration, or attach evaluations | adjacent official `Node reference`, `Agent` |
| the Agents SDK running guide presents four state-carrying strategies: `result.history`, `session`, `conversationId`, and `previousResponseId` | adjacent official `Running agents`, `Choose one memory strategy` |
| the Sessions guide says a session fetches prior items, persists new input/output after each run, and stays available for future turns or resumed runs | adjacent official `Sessions` guide |
| the Results guide says `state` is the serializable snapshot used to resume interrupted runs | adjacent official `Results` guide |
| the Context guide explicitly says conversation state is a separate concern from local app context | adjacent official `Context` guide |
| the HITL guide says tool approval pauses the run, returns `interruptions`, and resumes later from the same `RunState` rather than by starting a fresh run | adjacent official `Human-in-the-loop`, `Overview`; `Approval flow` |
| the HITL guide says serialized `RunState` can be stored and later resumed, and that serialized state includes app context plus runtime metadata such as approvals and nested tool input | adjacent official `Human-in-the-loop`, `Dealing with longer approval times` |
| the Guardrails guide says tool guardrails run on every function-tool invocation, while input and output guardrails apply only at workflow boundaries | adjacent official `Guardrails`, `Workflow boundaries` |
| the Guardrails guide says a tripwire immediately halts execution when a guardrail fails | adjacent official `Guardrails`, `Tripwires` |
| the Agents guide exposes lifecycle hooks such as `agent_start` and `agent_end` on the agent object | adjacent official `Agents` guide |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `harness` | agent loop plus surrounding runtime primitives | `A more capable harness for the agent loop` | core runtime unit in this source |
| `model-native harness` | harness specifically shaped for frontier-model operating patterns | same section | distinguishes this from generic orchestration frameworks |
| `sandbox` | controlled compute environment for code and files | `Native sandbox execution` | execution boundary |
| `Manifest` | declarative workspace description | `Native sandbox execution` | portable workspace primitive |
| `harness / compute` | split between agent loop and execution environments | dedicated section | security and durability architecture |
| `snapshotting and rehydration` | restoring agent state into a new container | harness/compute split section | run continuity concept |
| `skills` | progressive disclosure primitive for agent knowledge | harness-primitives section | links OpenAI's article to wider agent ecosystem vocabulary |
| `AGENTS.md` | custom instructions surface included as a primitive | harness-primitives section | repository guidance primitive |
| `trace` | end-to-end log of one workflow run | adjacent official eval docs | run/evidence primitive |
| `grader` | structured scoring surface for traces | adjacent official eval docs | evaluation primitive |
| `eval run` | repeatable evaluation execution over traces/datasets | adjacent official eval docs | promotion/benchmark primitive |
| `state variables` | workflow-level state attached at the start node | adjacent official node reference | workflow-state primitive |
| `session` | persistent memory layer for future turns and resumed runs | adjacent SDK guides | continuity primitive |
| `RunState` / `state` | serializable resumable state behind a run result | adjacent SDK guides | interruption and resume primitive |
| `conversationId` | server-managed named conversation resource | adjacent SDK guides | server-side continuity primitive |
| `previousResponseId` | lightweight server-managed continuation from the prior response | adjacent SDK guides | cheap continuation primitive |
| `RunContext` | local app state for the current run, separate from conversation state | adjacent SDK guides | context-boundary primitive |
| `interruptions` | pending approval items that pause a run | adjacent SDK `Results` and `Human-in-the-loop` guides | explicit execution-time approval surface |
| `RunState` | resumable paused-run state including approval and runtime metadata | adjacent SDK guides | pause/resume primitive distinct from long-term governance |
| `guardrail` | validation surface attached to input, output, or tools | adjacent `Guardrails` guide | production safety primitive |
| `tripwire` | immediate halt triggered by a failed guardrail | adjacent `Guardrails` guide | fast-fail primitive |
| `lifecycle hook` | callback emitted around runtime start and end | adjacent `Agents` guide | runtime observability primitive |

## Transferable Lessons

- Treat the workspace as a portable, explicit object.
- Keep the agent loop separate from the compute environments that execute model-generated code.
- Assume exfiltration and prompt-injection pressure at the architecture stage.
- Prefer durable run state that can survive one sandbox instance disappearing.
- Expose common agent primitives in the harness rather than expecting every application to rebuild
  them ad hoc.

## Non-transferable Baggage

- The object model and provider integrations are OpenAI SDK-specific.
- This is partly a platform-positioning document, not a neutral architectural standard.
- The exact primitive set in the SDK is not automatically the right primitive set for another
  product.

## Open Questions / Tensions

- How thin can a `Manifest` stay before it stops describing what really matters in an agent
  workspace?
- Which harness primitives should be standardized and which should stay domain-specific?
- How much of `model-native` behavior is universal versus provider-specific?
- Where should durable run state end and workspace snapshot state begin?
