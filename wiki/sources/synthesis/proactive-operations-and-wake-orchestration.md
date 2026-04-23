# Proactive Operations And Wake Orchestration

This page compares the reference set specifically as systems for proactive work.

The goal is to stop flattening `heartbeat`, `cron`, `automation`, `routine`, `autopilot`, and
`standing order` into one vague idea of "persistent agents." The sources use these terms
differently, and the distinctions matter.

## Sources Used

- [repo-anthropics-claude-code.md](../library/repo-anthropics-claude-code.md)
- [repo-openai-codex.md](../library/repo-openai-codex.md)
- [repo-openclaw.md](../library/repo-openclaw.md)
- [repo-multica.md](../library/repo-multica.md)
- [repo-paperclip.md](../library/repo-paperclip.md)

## Comparison Table

| Source | Primary proactive primitive | Timing model | Context model | Durable truth for proactive work | Governance surface | Main lesson |
| --- | --- | --- | --- | --- | --- | --- |
| [Claude Code](../library/repo-anthropics-claude-code.md) | `Routine`, Desktop scheduled task, session-scoped `/loop` | schedule, API, GitHub, or local/session cron-like timing | cloud fresh session, local new session, or existing live session | account-side routine config, local task config, or session-scoped schedule | permission modes, saved task approvals, connector/environment scoping | proactive work should be split by durability and context scope |
| [Codex](../library/repo-openai-codex.md) | `Automation` plus future-work wakeups | scheduled background work and deferred continuation | app thread plus memory and project/plugin context | automation config, app threads, memory, review queue | review queue, sandbox/config rules, human re-entry | background work needs an explicit review/re-entry surface |
| [OpenClaw](../library/repo-openclaw.md) | `Heartbeat`, `Cron`, `Standing order`, `Task Flow`, hooks | approximate periodic main-session turns, exact cron, event-driven hooks | full main-session context, isolated runs, or bootstrap-only heartbeat context | Gateway-owned session plus task/flow records | standing-order approval gates, gateway ownership, task ledger | proactive operations are multiple first-class mechanisms, not one scheduler |
| [Multica](../library/repo-multica.md) | `Autopilot` above tasks plus daemon heartbeat | scheduled or API-triggered work above task assignment | isolated workspace per task; platform-managed agent/runtime records | agent, runtime, task, and autopilot records | platform orchestration, runtime liveness, task lifecycle | recurring work belongs above task execution, not inside the harness |
| [Paperclip](../library/repo-paperclip.md) | scheduled heartbeats and event-based triggers | scheduled wake plus event-driven follow-up | persistent agent/company context | goals, tickets, budgets, approvals, audit | budgets, approvals, rollback, company control | long-running agent companies need governance-heavy proactive work |

## The Main Distinction

The references do not treat "proactive" as one thing.

They separate at least five different concerns:

1. periodic main-session wakeups
2. durable scheduled background runs
3. event-driven triggers
4. durable authority programs
5. detached-work ledgers and orchestration records

These should not be collapsed into one `scheduler` box.

## Claude Code: Three Different Scheduling Surfaces

[Claude Code](../library/repo-anthropics-claude-code.md) is the clearest reminder that proactive
work should be split by durability and context.

- `Routine`
  is a durable cloud-side autonomous session with schedule, API, and GitHub triggers.
- Desktop scheduled task
  is a durable local recurring session with its own permission mode and saved approvals.
- ``/loop``
  is session-scoped scheduling inside a live CLI session, with no catch-up and limited restore.

These are not interchangeable.

The useful lesson is not "Claude has scheduling." It is:

**one product can expose multiple proactive-work surfaces because context scope, durability, and
approval posture differ.**

## OpenClaw: Heartbeat Is Not Cron

[OpenClaw](../library/repo-openclaw.md) is the strongest source for vocabulary precision.

It distinguishes:

- `Heartbeat`
  approximate periodic main-session turns with full session context and no task records
- `Cron`
  precise scheduled jobs that create task records
- `Standing orders`
  durable operating authority with scope, triggers, approval gates, and escalation rules
- `Task Flow`
  durable orchestration above individual tasks
- `Hooks`
  event-driven automation scripts

The key lesson is:

**heartbeat is not just another cron job, and a task ledger is not the scheduler.**

That distinction is exactly what was missing from a shallower "persistent runtime" reading.

## Codex: Background Work Plus Review Queue

[Codex](../library/repo-openai-codex.md) is the clearest current product reference for the
commercial direction of proactive agents.

The relevant ideas are:

- scheduled background `Automations`
- future-work wakeups over days or weeks
- context carry-forward through memory and threads
- proactive suggestions about what to do next
- review queue as the re-entry surface

The lesson is:

**background work should return to a human-readable supervision surface rather than disappearing
into opaque daemon state.**

## Multica And Paperclip: Orchestration Above The Runtime

[Multica](../library/repo-multica.md) and [Paperclip](../library/repo-paperclip.md) both push
proactive work above raw harness execution.

- Multica places `Autopilot` above `AgentTask` and keeps daemon heartbeat and task progress as
  external platform records.
- Paperclip places scheduled heartbeats and event triggers inside a governance-heavy company
  control plane with budgets, approvals, and rollback.

The shared lesson is:

**long-running proactive work belongs in an orchestration or control layer above the agent runtime,
not buried inside the harness loop.**

## Vocabulary Normalization For autokairos

Based on these sources, the safest normalization is:

- `Always-on trading substrate`
  market, account, order, risk, trace, and operator-facing surfaces that stay live
- `Wake orchestration`
  periodic triggers, event triggers, standing authority, dedupe, catch-up, and wake-policy truth
- `Cognitive runtime`
  the actual LLM-centered agent loop
- `Review / governance`
  the layer that judges and advances work

This is more precise than talking about one "persistent agent."

## Governed Self-Scheduling

The user-facing design target should not be:

- the agent silently edits its own cron jobs

It should be:

- the agent proposes a wake-policy or standing-order change
- the orchestration layer decides whether it is auto-applicable
- otherwise the change becomes reviewable governance work

This pattern is strongly supported by the source set.

- OpenClaw's standing orders already combine triggers, authority, approval gates, and escalation.
- Claude Code separates durable tasks from transient session loops.
- Codex separates automations from the review queue where humans re-enter.
- Multica separates autopilot from task execution.
- Paperclip treats proactive work as governed company behavior, not hidden runtime state.

## Architecture Consequence

The architectural consequence is straightforward:

**proactive operations should be its own subsystem above the cognitive runtime.**

Agent runtime design alone is not enough. A living system needs:

- trigger taxonomy
- wake-policy records
- standing-order or authority surfaces
- event-driven orchestration
- governed self-scheduling
- a clear handoff into governed execution requests

## Tensions To Preserve

- How much proactive logic belongs in the control plane versus the always-on substrate?
- Which triggers should create detached-work records, and which should stay main-session turns?
- When is approximate heartbeat behavior acceptable, and when is exact scheduling required?
- Which self-scheduling changes can be auto-applied safely, and which require review?
