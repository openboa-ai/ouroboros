# Source Note: Effective Harnesses For Long-Running Agents

## Source

- Title: `Effective harnesses for long-running agents`
- Primary URL: [https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Source type: engineering article
- Checked: `2026-04-18`
- Research scope:
  - primary article
  - adjacent official docs:
    - `https://www.anthropic.com/engineering/harness-design-long-running-apps`
  - sections:
    - opening problem framing
    - `The long-running agent problem`
    - solution framing around `initializer agent` and `coding agent`
    - artifact examples such as `init.sh`, progress notes, and feature-list JSON
    - `Future work`
    - planner / generator / evaluator refinement
    - structured artifacts between sessions

### Research Scope Matrix

| Artifact | Type | Inspected areas | Why it mattered |
| --- | --- | --- | --- |
| Primary article | engineering essay | problem framing around discrete sessions and lost memory | defines the long-running continuity problem |
| Primary article | engineering essay | two-agent solution | clarifies initializer vs coding role split |
| Primary article | engineering essay | failure-mode table and artifact examples | provides concrete workspace artifacts |
| Primary article | engineering essay | JSON/file-format guidance | shows how Anthropic shaped agent-editable artifacts |
| Primary article | engineering essay | `Future work` | exposes open uncertainty about single-agent vs multi-agent setups |
| `Harness design for long-running application development` | engineering essay | planner / generator / evaluator loop and structured artifacts | extends Anthropic's newer long-running harness posture |

## What This Source Is

This is Anthropic's tactical guidance for making a coding harness work across many context windows.
Unlike `Managed Agents`, which focuses on service boundaries, this article is workspace-centric. It
shows how to turn repeated fresh sessions into incremental progress by using initialization,
structured artifacts, progress notes, and strict end-of-session hygiene.

## Core Thesis

- Long-running agents fail because each fresh session starts with no memory and incomplete local
  context.
- Context compaction alone is not enough for production-quality long tasks.
- Anthropic's proposed pattern is a two-part harness: an `initializer agent` plus a repeated
  `coding agent`.
- The workspace should contain explicit artifacts that bridge sessions.
- Agents should make incremental progress, keep the environment clean, and leave behind structured
  state for the next session.
- Verification and artifact discipline matter as much as raw coding ability.

## Key Mechanisms / Architecture

### Mechanism Mapping

| Mechanism | What it is in this source | Evidence |
| --- | --- | --- |
| `Initializer agent` | first-run agent that prepares the repo and supporting artifacts | opening solution statement |
| `Coding agent` | repeated session worker that advances one feature at a time | opening solution statement and failure-mode table |
| `Feature list JSON` | structured end-to-end feature inventory used to avoid premature victory | failure-mode summary table |
| `Progress notes file` | session handoff artifact describing current state and next steps | failure-mode summary table |
| `init.sh` | canonical script that starts the dev environment | failure-mode summary table |
| `Git commits + progress update` | end-of-session closure artifact | failure-mode summary table |
| `JSON over Markdown for test status` | choice made to reduce accidental edits and overwrites | test-status example discussion |
| `Planner / generator / evaluator` | three-role long-running architecture | adjacent `Harness design for long-running application development` article |
| `Structured artifacts` | explicit handoff files between sessions or roles | same adjacent article |

### Architectural Reading

- The harness design here is artifact-heavy rather than service-heavy.
- The workspace is treated as a continuity layer between sessions.
- Session continuity is achieved by leaving behind structured files, not by assuming perfect memory.

## Important Passages Or Facts

### Cited Facts Matrix

| Claim | Evidence |
| --- | --- |
| Anthropic describes the core challenge as work happening across discrete sessions with no memory | opening framing and `The long-running agent problem` |
| the proposed solution is explicitly two-fold: initializer agent + coding agent | opening solution statement |
| compaction is acknowledged but described as insufficient on its own | `The long-running agent problem` |
| one failure mode is that the agent tries to do too much at once and leaves half-finished work | `The long-running agent problem` |
| another failure mode is that a later agent sees some progress and declares the project done | `The long-running agent problem` |
| the failure-mode summary prescribes `init.sh`, progress notes, and a feature list file | failure-mode summary table |
| Anthropic says the coding agent should self-verify features before marking them passing | failure-mode summary table |
| Anthropic says they landed on JSON for test-status artifacts because the model was less likely to overwrite it improperly than Markdown | discussion around the test-status example |
| the article explicitly leaves open whether a single general-purpose coding agent is best, or whether multi-agent specialization may outperform it | `Future work` |
| Anthropic's newer harness-design article says the long-running coding architecture carried forward two lessons: decomposing work into tractable chunks and using structured artifacts to hand off context between sessions | adjacent `Harness design for long-running application development` article |
| the same article says the planner still added obvious value because without it the generator under-scoped and started building before speccing the work | adjacent article |
| the same article shows an evaluator loop that critiques generated work against explicit criteria before the next cycle | adjacent article |

## Vocabulary And Mental Models

### Vocabulary / Primitive Matrix

| Term | Meaning in this source | Where it appears | Why it matters |
| --- | --- | --- | --- |
| `long-running agent` | agent expected to work across many context windows | title and opening framing | defines the problem setting |
| `initializer agent` | first-run environment-preparation agent | opening solution statement | shows Anthropic's explicit setup phase |
| `coding agent` | repeated incremental worker session | opening solution statement | main execution actor |
| `feature list file` | structured backlog of end-to-end features | failure-mode summary | prevents vague progress and premature completion |
| `progress notes file` | session handoff record | failure-mode summary | continuity primitive between sessions |
| `init.sh` | canonical startup script for the workspace | failure-mode summary | stable bootstrap surface |
| `incremental progress` | do one clear step and leave the repo clean | article framing and failure-mode summary | core execution ethic |
| `planner` | agent that scopes and structures work before generation | adjacent newer harness-design article | planning primitive |
| `generator` | agent that produces the next implementation artifact | same adjacent article | main actor in that design |
| `evaluator` | agent that critiques outputs against explicit criteria | same adjacent article | quality-control primitive |
| `structured artifacts` | handoff files that carry context between sessions | same adjacent article | continuity primitive |

## Transferable Lessons

- Fresh-session systems benefit from explicit handoff artifacts rather than hidden memory alone.
- Startup scripts, progress files, and structured feature inventories can stabilize long tasks.
- Verification should be part of the working loop, not only the end of a project.
- Structured machine-editable artifacts can be more reliable than free-form Markdown for mutable
  status tracking.
- Leaving the environment in a clean state is itself a systems requirement.

## Non-transferable Baggage

- The article is tuned to coding tasks and web-app development.
- The initializer/coding split may not map directly to non-coding domains.
- The exact artifact set (`init.sh`, feature JSON, progress notes) is illustrative, not canonical
  across all systems.

## Open Questions / Tensions

- When is a two-role setup enough, and when is a richer multi-agent decomposition worth it?
- How much structure helps before the artifact layer becomes its own maintenance burden?
- Which artifacts should be human-readable versus agent-optimized?
- What should live in workspace artifacts versus external session stores?
