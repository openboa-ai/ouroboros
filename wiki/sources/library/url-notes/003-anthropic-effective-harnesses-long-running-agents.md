# 003 - Anthropic Effective Harnesses For Long-Running Agents

## Source

- URL: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Ledger row: [reference-ledger.md](../../reference-ledger.md), row 3
- Related cluster note:
  [anthropic-effective-harnesses-for-long-running-agents.md](../anthropic-effective-harnesses-for-long-running-agents.md)

## What This Source Actually Proves

Long-running agents fail when the system assumes one context window can carry the whole job.

The source identifies practical failure modes:

- the agent tries to do too much in one session
- context handoff is unclear after compaction or reset
- the next session has to rediscover what happened
- the agent marks work complete prematurely
- the agent wastes time figuring out how to run and test the system

The solution is not "more context." The solution is durable handoff artifacts: an initializer
session sets up files like an execution script, progress log, feature/task list, and baseline
verification routine so later sessions can continue.

## Mechanisms To Preserve

| Mechanism | autokairos implication |
| --- | --- |
| Initializer agent | A trader-system candidate may need an initial `TraderSystemSpec` / `TraderSystemProgram` scaffold before repeated runs. |
| Feature/task list | Candidate behavior should have declared objectives and unfinished work, not only hidden provider memory. |
| Progress notes | `Trace` and exported artifacts must let a fresh session resume without guessing. |
| `init.sh` equivalent | Each runtime placement needs a clear launch/verify path. |
| Basic verification before new work | Bootstrap and candidate runs should verify substrate assumptions before modifying state. |
| Marking features only after testing | Candidate readiness cannot be self-declared; validation gates must exist. |

## Deep autokairos Insight

This source is not only about coding agents. It is about recoverability.

For autokairos, a provider-backed trader system must survive:

- provider session restart
- context compaction
- container replacement
- local process crash
- remote endpoint failure
- operator inspection after the fact

That requires a minimal recoverable state model:

```text
Trace + exported artifacts + runtime status + candidate/version refs
```

If a live or paper trader system can only be understood by reopening an old agent chat, the design
has failed.

## What Not To Copy

- Do not copy a coding-app feature list literally as trading product structure.
- Do not make the initializer/coding-agent split mandatory for every runtime.
- Do not assume progress notes written by the agent are evidence.
- Do not let an agent-authored script become trusted without validation and sandboxing.

## Design Questions Forced By This Source

- What artifacts must every `TraderSystemRuntime` export before it can be resumed?
- What is the trading equivalent of "basic test still passes"?
- Which candidate files are agent-authored and sandboxed versus control-plane-authored?
- How does a fresh provider session learn enough to continue without hidden memory?
- Which artifacts are inspectable by the operator?

## autokairos Design Pressure

This source pushes autokairos toward session-independent continuity:

```text
provider session can die
runtime placement can be replaced
trace/artifacts must remain sufficient
```

The architecture should treat compaction and provider memory as conveniences, not recovery
foundations.
