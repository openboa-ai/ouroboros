# Agent Harness Source Analysis

This document captures the reasoning behind the initial `AGENTS.md`, `docs/`, `skills/`,
and `agents/` structure for AutoKairos.

Accessed on April 9, 2026.

## Sources

1. Addy Osmani, `agent-skills`
   URL: https://github.com/addyosmani/agent-skills

2. Anthropic, `Harness design for long-running application development`
   URL: https://www.anthropic.com/engineering/harness-design-long-running-apps

3. Andrej Karpathy, `LLM Wiki`
   URL: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

4. OpenAI, `Harness engineering: leveraging Codex in an agent-first world`
   URL: https://openai.com/index/harness-engineering/

5. OpenAI, `Unlocking the Codex harness: how we built the App Server`
   URL: https://openai.com/index/unlocking-the-codex-harness/

## What Each Source Is Arguing

### 1. `agent-skills` argues that skills are reusable engineering workflows

Key claims:

- Skills are not vague tips. They encode repeatable workflows, quality gates, and best practices.
- The best entry point is the development lifecycle: define, plan, build, verify, review, ship.
- Skills should activate from user intent, not only from explicit commands.
- Agents should use a matching skill whenever a task maps to one.
- Skill files should stay concise, with details pushed into scripts or supporting references.
- Packaging matters: a skill should be easy to install, discover, and reuse across agents.

Implications for AutoKairos:

- `skills/` should store repeatable trading-engineering workflows, not long generic prompts.
- Skills should be mapped to common intents like strategy design, exchange integration, risk review, and backtest verification.
- Skill definitions should stay short and push detailed logic into scripts and references.

### 2. Anthropic argues that harness quality is a major multiplier for long-running work

Key claims:

- Better results come from harness design, not just from stronger prompts.
- Agents lose coherence over long tasks, so handoff structure and control loops matter.
- Self-evaluation is weak. Separate the builder from the evaluator.
- Subjective quality becomes more tractable when it is converted into explicit grading criteria.
- A planner can expand short prompts into ambitious but high-level specs.
- A builder and evaluator should negotiate what "done" means before implementation.
- File-based communication between agents creates clearer handoffs than implicit context alone.

Implications for AutoKairos:

- Agent roles should separate planning, implementation, and evaluation.
- Each meaningful work unit should have a contract artifact before work starts.
- Evaluation should use independent criteria, especially for risk, product quality, and correctness.
- Research and trading workflows should generate handoff files rather than relying on chat memory.

### 3. `LLM Wiki` argues that durable value comes from compounding markdown knowledge

Key claims:

- Raw-document retrieval keeps rediscovering the same knowledge from scratch.
- A persistent wiki lets the agent integrate, revise, and cross-link knowledge over time.
- The useful middle layer is not raw sources or chat history; it is a maintained markdown knowledge base.
- Raw sources should remain immutable.
- The wiki should be LLM-maintained, while the human focuses on sourcing and judgment.
- A schema file should define the conventions and workflows that keep the wiki disciplined.
- Ingest, query, and lint are the three core operations.
- An index and a log help both humans and agents navigate the system.

Implications for AutoKairos:

- `docs/` should grow as a living research and execution knowledge base.
- Research should be written back into markdown instead of disappearing into chat history.
- The repo should eventually maintain an index and a log for source ingest and evolving conclusions.
- The docs layer should sit between raw market research and day-to-day agent work.

### 4. OpenAI argues that repository-local knowledge should be the system of record

Key claims:

- In an agent-first environment, the scarce human resource is attention rather than typing.
- The engineering job shifts toward environment design, feedback loops, and scaffolding.
- A giant `AGENTS.md` is a failure mode because it consumes context, loses focus, and rots.
- `AGENTS.md` should be a table of contents, not an encyclopedia.
- Durable knowledge should live in a structured `docs/` tree.
- Agents need progressive disclosure: a small entry point that leads them to deeper documents as needed.
- Repository-local, versioned artifacts are the only knowledge agents can reliably use.
- Documentation quality should be enforced mechanically with CI and doc maintenance loops.
- Agent legibility should be treated like onboarding a new engineer.

Implications for AutoKairos:

- Keep `AGENTS.md` short and durable.
- Put deeper guidance into `docs/`.
- Prefer markdown, schemas, plans, and logs that live in the repo.
- Use CI to check that the structure exists and stays healthy.
- Write down architectural and strategic intent in versioned documents.

### 5. OpenAI's App Server article argues that the harness itself should be a product surface

Key claims:

- The same agent loop should be reusable across multiple client surfaces.
- The harness needs a long-running runtime around the model, not just one-shot calls.
- Thread, turn, and item are useful explicit primitives for persistent agent work.
- The runtime should manage persistence, tool execution, and approvals.
- Rich event streams make better user interfaces and better operational control.
- The harness should support reconnecting, resuming, and forking work.

Implications for AutoKairos:

- AutoKairos should be designed as a local runtime, not only as a prompt template.
- The project should model self-improvement as persistent threads and bounded turns.
- Candidate changes, approvals, and promotions should be explicit runtime events and artifacts.
- The system should be able to expose the same harness through CLI, TUI, or dashboard surfaces later.

## Cross-Source Synthesis

These five sources converge on a single operating model:

1. `AGENTS.md` should be small.
   It is the entry point, not the full manual.

2. `docs/` should hold durable knowledge.
   This is the system of record for architecture, process, research, and plans.

3. `skills/` should hold repeatable workflows.
   A skill is a reusable operating procedure with clear triggers, artifacts, and checks.

4. Multi-agent work should use explicit roles and handoffs.
   Planning, building, and evaluating should be separable.

5. The runtime needs explicit control primitives.
   Long-lived work benefits from threads, turns, items, and approval boundaries.

6. Repository-local knowledge compounds.
   Valuable analysis should be written back into the repo instead of being re-derived every session.

## Direction Chosen For AutoKairos

Based on the sources, AutoKairos should start with the following structure:

- `AGENTS.md`
  A short map telling agents where to look next.

- `docs/`
  Durable design intent, source-backed analysis, runtime model, agent model, and skill model.

- `skills/`
  Future reusable workflows for strategy, research, execution, risk, and validation.

- `agents/`
  Future role-specific prompts for planner, builder, evaluator, and reviewer styles.

- `scripts/`
  Executable checks that make the structure enforceable in CI.

## Updated Practical Conclusion

The repo should aim at a local self-improving loop:

- market and runtime observation
- diagnosis and planning
- code or methodology change
- independent evaluation
- promotion gating
- durable write-back into repo-local docs

That is a stronger and more useful target than a generic coding-agent repo.
