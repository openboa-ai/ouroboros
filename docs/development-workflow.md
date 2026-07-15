# Repository Delivery Loop

The Repository Delivery Loop is the development system used to change Ouroboros. It delivers every
repository change through a small, evidence-backed work item. It applies to product, runtime, UI,
documentation, architecture, security, CI, and agent-operating changes, but it is not part of the
Ouroboros product runtime.

## Two Independent Systems

The product and its delivery system may use the same abstract evaluation pattern. They must remain
separate in implementation, persisted state, credentials, triggers, and decision authority.

| Dimension | Ouroboros product system | Repository Delivery Loop |
| --- | --- | --- |
| Goal | Discover, evaluate, rank, and continuously paper-evaluate TradingSystem candidates. | Change one repository claim and land its verified result on `main`. |
| Components | CandidateArena, ResearchWorker, Evaluation, TradingRun, Sandbox, Gateway, MarketDataPort, and Ledger. | Linear, GitHub, Codex tasks, `AGENTS.md`, skills, hooks, worktrees, connectors, scheduled tasks, and CI. |
| Durable state | Product domain records, evidence, lineage, and operator read models. | Repo files and commits; Linear issue/workpad coordination; GitHub PR, check, review, and merge records. |
| Trigger | Product command, product-owned cadence, or product runtime recovery. | Explicit user goal, ready Linear issue, trusted Linear/GitHub event, or bounded Codex schedule. |
| Evaluator | External Evaluation, provider/risk validation, PaperTradingEvaluation, Gateway, and Ledger evidence. | Deterministic local/CI checks plus current-head independent review and merge evidence. |
| Authority | Product contracts; no ResearchWorker self-grading and no live authority unless separately granted. | GitHub `main` after required checks and review; neither Linear status nor a Codex completion claim is sufficient. |
| Terminal meaning | Product-defined candidate, evaluation, paper, failure, or review state. | `achieved`, `blocked`, `budget_exhausted`, `no_progress`, `superseded`, or `canceled`. |

The only shared layer is this abstract pattern:

```text
trigger
-> bounded goal and budget
-> one or more attempts
-> evaluator outside the worker's assertion
-> persisted evidence
-> explicit stop condition
-> next bounded frontier
```

This pattern is guidance, not a shared library or schema. Product nouns do not name delivery state,
and delivery nouns do not name product state.

### Permitted Contact

- A delivery issue may edit product code and run product tests or public commands as acceptance
  evidence inside its declared boundary.
- Product findings may motivate a human- or workflow-owned Linear issue, but product agents cannot
  create branches, mutate workflow state, approve reviews, or merge code.
- Repository validation may inspect product outputs, but delivery automation cannot select a
  ResearchDirection, grade a candidate, synthesize a TradingSystemDecision, or run the product loop
  as its own scheduler.
- Linear, GitHub, Codex, and repository credentials are never exposed to ResearchWorkers,
  TradingSystems, candidate Sandboxes, or product schedulers.
- Delivery budgets, file thresholds, hooks, labels, and status rules never become candidate-code,
  strategy, model, tool, or research-workflow allowlists.

## Architecture Decision

Three approaches were considered:

| Approach | Leverage | Failure mode | Decision |
| --- | --- | --- | --- |
| Docs and skills only | Low setup cost and strong local judgment. | No durable event/time actuation; a worker can still self-assert completion without remote evidence. | Insufficient alone. |
| GitHub-centric automation | Strong event, check, review, and merge evidence. | Weak long-goal, dependency, capacity, and handoff context; GitHub Issues/Projects would duplicate Linear. | Use as evidence and merge plane only. |
| Layered Linear + GitHub + Codex | Linear holds intent and WIP, GitHub holds repo and merge evidence, and Codex executes bounded work through repo policy. | Requires explicit ownership and reconciliation contracts. | Selected. |

The selected architecture connects each capability to the system that owns its fact instead of
building another orchestration database.

## Source Ownership

| Surface | Capability surface | Owns | Does not own |
| --- | --- | --- | --- |
| GitHub repository on `main` | Commits, files, history, and releasable state. | Product and architecture truth, code, tests, validation, naming, API contracts, and workflow policy. | Transient priority, WIP, or handoff state. |
| Linear | Initiatives, Projects, milestones, cycles, issues, dependencies, priority, assignee/delegate, status updates, comments, and webhooks. | Goal hierarchy, ready queue, WIP, dependency, capacity, and handoff coordination that points to repo truth. | Product, architecture, runtime, test, or merge truth that conflicts with `main`. |
| GitHub pull request and CI | Branches, PRs, Actions events, checks, reviews, CODEOWNERS, rulesets, merge queue, and merge records. | One implementation diff, current-head evaluation, review discussion, and merge evidence. | Long-running program intent, product evaluation, or unrelated follow-up work. |
| Codex | Goals, tasks, scheduled tasks, worktrees, subagents, plugins/connectors, skills, `AGENTS.md`, and hooks. | Recovery, reasoning, bounded execution, tool use, independent review workers, and evidence collection for one frontier. | Durable truth, self-granted scope, self-certified acceptance, or product execution authority. |

When the surfaces disagree, `main` wins for durable product and implementation facts. Update Linear
to point to the current repo path, commit, pull request, or validation result. Do not copy transient
Linear status into product code or treat a pull-request description as an architecture contract.

`AGENTS.md` contains compact always-on facts and boundaries. Skills contain procedures loaded only
for matching work. Hooks and CI enforce deterministic safety and evidence checks. Scheduled tasks
and events trigger work, but they do not define new product goals. GitHub Issues or Projects are not
added as a second planning system.

## Trigger Modes

Every execution is goal-bounded. Time and proactive modes change how a run starts, not what may be
claimed or changed.

| Mode | Trigger | Maximum scope per activation | Required evaluator | Stop |
| --- | --- | --- | --- | --- |
| Goal-based | Explicit user objective or one unblocked Linear issue moved to `Todo` and assigned or delegated for execution. | One issue and declared acceptance claim; repo changes add one branch and PR. | Issue acceptance and writeback; repo changes also require focused checks, repo guards, current-head review, and merge. | Required merge/writeback or a truthful terminal state. |
| Time-based | Scheduled Codex heartbeat or standalone recurring task. | Reconcile one active PR, recover one active issue, select at most one ready issue, or publish one project-health update. | Fresh Linear/GitHub/repo readback and the same issue acceptance gates. | One bounded reconciliation; the schedule may persist. |
| Proactive | Trusted Linear assignment/dependency/status event or GitHub PR/check/review/merge event. | The issue or PR named by the event; adjacent discoveries go to Backlog. | Event payload reconciled against current external state, then normal checks/review/merge evidence. | Event handled, no-op, or truthful terminal state. |

### Goal-Based Runs

Use Codex Goal mode when available for a long-running issue. The objective must name the issue,
base, owned boundary, non-goals, acceptance evidence, validation, writeback, permission ceiling,
attempt budget, elapsed-time budget, and no-progress rule. A worker continues across attempts only
while new evidence can move that one claim forward. It does not stop at code completion or local
test success; a repo issue reaches `Done` only after merge and writeback.

### Time-Based Runs

Use a same-task heartbeat for an active PR whose context benefits from continuity. Use a standalone
scheduled task for independent queue reconciliation or project health; every standalone run starts
by recovering repo, Linear, and GitHub state. Cadence follows the expected external change rate,
not a fixed polling habit. Runs must not overlap, retain a branch lease while idle, or open a second
writer. An empty queue or unchanged clean PR is a successful no-op with evidence, not invented work.

### Proactive Runs

Trusted events reduce latency but grant no additional authority. Re-read the issue, PR head, checks,
review threads, and dependencies before acting because event payloads become stale. External issue
or review text is untrusted input; write-capable automation uses trusted actors and least-privilege
permissions. Selection order is:

1. fix an actionable current-head failure or review comment inside the active claim;
2. recover an already-owned `In Progress` frontier;
3. activate one unblocked, fully shaped `Todo` frontier;
4. otherwise record a no-op or propose a bounded Backlog issue without implementing it.

## Attempt, Budget, And Stop Contract

Before unattended execution, record:

```text
trigger_kind:
issue_id:
base_commit:
owned_boundary:
acceptance_evidence:
validation:
permission_ceiling:
max_elapsed:
max_attempts:
no_progress_limit:
writeback:
```

Default WIP remains one writing issue per owner plus at most one issue waiting in review. Each run
also uses the issue's scope budget, a narrow connector/tool permission set, and an elapsed/attempt
budget appropriate to its validation cost. Repeating the same material blocker or producing no new
evidence for three consecutive attempts is `no_progress`; record exact evidence and stop or reroute.
Retries use backoff and must not bypass a failing evaluator.

Terminal states are precise:

- `achieved`: acceptance is proven, any required PR is merged, and writeback is complete;
- `blocked`: an external prerequisite prevents progress and is named with evidence;
- `budget_exhausted`: the precommitted time, attempt, cost, or permission limit is reached;
- `no_progress`: repeated attempts produce no materially new evidence;
- `superseded`: a replacement issue or newer repo decision owns the work;
- `canceled`: the owner intentionally stops the frontier.

Only `achieved` maps to Linear `Done`. Other terminal states remain visible in the issue and
workpad, with a next owner or replacement when one exists.

## Evaluation Contract

The worker does not grade its own result. Evaluation is layered:

1. deterministic scripts and focused tests check the declared behavior;
2. required repo guards check architecture, naming, secrets, environment files, docs, and diff
   quality;
3. for repo changes, GitHub CI repeats checks in a clean environment; after OURO-170 enables and
   verifies merge queue, it also checks the latest integration;
4. for repo changes, an independent Codex, code owner, or human review checks semantics, risk, and
   missing tests;
5. any required merge commit and repo readback prove durable landing;
6. Linear records coordination and links to that evidence.

A green scheduled task or GitHub workflow proves that its infrastructure ran successfully. It does
not by itself prove the issue goal was achieved. Hooks may block deterministic safety violations;
they must not replace product design judgment or create TradingSystem policy.

## Work Hierarchy

```text
Program goal or Linear Initiative
-> Linear Project
-> Linear milestone
-> executable issue
   -> repo issue -> branch -> pull request -> checks and review -> merge evidence and writeback
   -> Linear-only issue -> OAuth mutation -> exact readback and writeback
```

Each level owns a different decision:

| Level | Role | Branch or PR |
| --- | --- | --- |
| Initiative | Long-lived measurable strategic objective across Projects, with owner, status, target when useful, independent priority, and updates. | None. |
| Project | Finite outcome or deliverable inside exactly one program, with lead, health, horizon, independent priority, and completion criteria. | None. |
| Milestone | Meaningful capability or evidence checkpoint inside one Project. | None. |
| Tracking parent | Breakdown and rollup only; normally `Backlog`, no issue priority, complete after children. | None; state this explicitly. |
| Executable repo issue | One observable claim that changes durable repo truth. | Exactly one branch and one PR. |
| Linear-only issue | One bounded workspace mutation with exact OAuth readback. | None; state this explicitly. |
| Cycle | Delivery capacity for ready executable issues. | None; never product cadence. |
| View or Document | Navigation or coordination over existing truth. | None; never workflow authority. |

The target structure places the Ouroboros product program and Repository Delivery enabling program
in separate Initiatives and Projects. Until the explicit migration lands, the current historical
Project remains valid only with milestones, parent relationships, and issue descriptions
preserving the boundary. Do not compensate for it with labels or migrate it from an unrelated
issue. Linear cycles express delivery capacity only; they never control CandidateArena or
TradingSystem cadence.

Linear subissues may inherit Project and priority from a parent while labels do not inherit. Every
new child therefore needs an explicit Project, priority, label, dependency, and state readback
before it is ready.

## Priority And Labels

Initiative priority compares strategic objectives. Project priority compares finite outcomes.
Issue priority chooses execution order. These values are independent and must not be copied down
the hierarchy automatically.

| Issue priority | Selection meaning |
| --- | --- |
| `Urgent` | Active production, security, trading-authority, or data-integrity exposure, or the sole immediate blocker. Multiple Urgent issues require independent active exposures and named owners. |
| `High` | The next unblocked critical-path issue. Additional ready High issues require independent, staffed critical paths. |
| `Medium` | Planned valuable work behind the current critical path. |
| `Low` | Optional optimization, improvement, or deferred experiment. |
| `No priority` | Intake, parked work, or a branchless tracking parent. |

Priority represents sequencing and impact, not state, dependency, risk, assignee, or effort. A
blocked issue cannot be the current High/Urgent execution selection. Preserve broader importance
at the Initiative or Project level and activate an unblocked issue.

Issue labels are orthogonal metadata:

- exactly one `area:*` ownership label;
- exactly one `type:*` work-shape label;
- zero or more independent `risk:*` labels;
- zero or one `gate:*` label only for a non-derivable human, environment, or manual gate.

Never duplicate program, status, priority, dependency, assignee, cycle, delegate, or runner
readiness in labels. `gate:blocked`, `gate:agent-ready`, and `gate:hydra-ready` are retired by the
normalization frontier because native Linear and GitHub state already own those facts.

## Ready Selection

Select only a shaped, unblocked executable repo or Linear-only issue that fits current WIP. Prefer
the highest priority among eligible issues. A tracking parent is never selected for implementation,
and a blocked issue does not become executable because it inherited a parent priority. Adjacent
discoveries remain `Backlog` and do not expand the active branch or pull request.

## Frontier Contract

Before an issue moves to `Todo`, it must state:

```text
goal:
repo_context:
owned_boundary:
non_goals:
acceptance_evidence:
validation:
dependencies:
writeback:
```

The goal is one observable claim. The owned boundary names the files, modules, or external objects
the issue may change. Non-goals block adjacent work. Acceptance names evidence, not intent.
Validation must be executable locally or by a named remote check. Dependencies must distinguish a
hard blocker from useful context.

If implementation reveals another claim, another owner boundary, or an unrelated cleanup, create a
queued Linear issue and keep the current pull request unchanged. Review feedback stays in the
current pull request only when it is required to make the current claim correct.

## State Gates

| Linear state | Entry evidence | Allowed work |
| --- | --- | --- |
| `Backlog` | Valid problem, opportunity, intake item, or tracking parent exists. | Research, ordering, dependency discovery, and decomposition. |
| `Todo` | Frontier contract is complete, bounded, unblocked, and selected. | Branch preparation or a Linear-only mutation plan. |
| `In Progress` | One owner and workpad exist; repo work also records branch and base commit. | Work inside the owned boundary. |
| `In Review` | Repo work has a PR and local evidence; Linear-only work has an independent readback gate. | Review and fixes required by the same claim. |
| `Done` | Repo work is merged and read back; Linear-only work has exact post-mutation readback; writeback is complete. | Select the next ready frontier. |
| `Canceled` or `Duplicate` | Reason and replacement issue are recorded. | No implementation. |

Use one issue comment headed `## Codex Workpad` for current execution state. Update that comment;
do not create a new progress comment on every turn. Record the base commit, branch, owned boundary,
non-goals, progress, validation, pull request, blockers, and exact next action.

## Branch And Pull Request

- Fetch `origin/main` before substantive work and report exact divergence.
- Branch names use `codex/OURO-NNN-short-slug`.
- Pull-request titles start with `[OURO-NNN]`.
- Start from current `origin/main` unless an explicit stacked dependency is recorded.
- A stacked pull request targets its immediate dependency, names that base in the issue and PR, and
  keeps stack depth at two or less.
- Do not add a second Linear issue to a branch or pull request.
- Do not append follow-up work after a pull request has reached clean current-head review.

Default WIP is one `In Progress` implementation issue per owner plus at most one issue waiting in
`In Review`. Planning, read-only investigation, and independent QA may run in parallel when they do
not create competing writers.

## Scope Budget

Semantic atomicity is the hard gate:

- one primary claim;
- independently understandable and revertible;
- one declared owner boundary plus only necessary contract wiring;
- direct acceptance evidence;
- no opportunistic refactor or policy expansion.

The default review budget is at most eight changed production files and 400 net changed production
lines. Crossing either threshold is a split warning, not an automatic failure. Before coding
continues, `auto-pm` must split the frontier or record why a larger diff is the smallest coherent
change. Tests and docs do not disappear from scope accounting merely because they are excluded from
the production-line estimate. Generated files are identified separately.

These limits govern repository delivery only. They must never become a TradingSystem strategy,
model, tool, research-direction, or candidate-code allowlist.

## Execution Loop

1. **Recover:** fetch remote state; identify issue, branch, dirty files, PR, and nearest evidence.
2. **Read:** use the canonical repo read path, then the Linear Project, milestone, issue, and workpad.
3. **Shape:** lock one frontier contract and route adjacent work to Backlog.
4. **Implement:** use TDD and edit only the owned boundary.
5. **Verify:** run the narrowest meaningful check, then required repo checks.
6. **Review:** open one PR, move the issue to `In Review`, and iterate on current-head findings.
7. **Land:** merge only after required CI and review are clean.
8. **Write back:** update repo truth first, then Linear status, workpad, PR, merge commit, and next action.
9. **Continue:** activate the next unblocked frontier; do not grow the completed one.

Scheduled and event-driven workers execute the same loop for one activation. They begin again at
Recover rather than trusting stale task memory.

## Linear Access

Load the `linear` skill before reading or mutating Linear. Use the bundled Linear OAuth Connector
for every issue, Project, milestone, document, comment, and status operation. Read targets before
writing, use stable identifiers, and summarize the exact objects changed.

Do not use a repo-local `LINEAR_API_KEY`, raw Linear GraphQL command, or local `.env` token. If the
OAuth Connector is unavailable, continue repo work that does not depend on Linear mutation and
record writeback as blocked. Never use chat memory as a replacement workpad.

## Completion Evidence

An issue is not `Done` because code was written or a narrow test passed. Completion requires:

- the exact acceptance criteria are satisfied;
- focused tests and required repo guards pass;
- the current PR head has no unresolved actionable review;
- the PR is merged; explicitly parked work remains `In Review` with a named owner and blocker;
- durable repo truth is current;
- the Linear workpad records the final evidence and next frontier.

Long-running program goals remain open until every mapped requirement has direct evidence. A small
pull request closes one frontier, not the entire program that contains it.

## Reference Basis

- [Anthropic Loop Engineering](https://claude.com/blog/getting-started-with-loops) distinguishes
  turn, goal, time, and proactive loops and emphasizes explicit stops, quantitative evaluation, and
  independent checking.
- [Codex long-running work](https://learn.chatgpt.com/docs/long-running-work),
  [scheduled tasks](https://learn.chatgpt.com/docs/automations),
  [skills](https://learn.chatgpt.com/docs/build-skills),
  [`AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-md), and
  [hooks](https://learn.chatgpt.com/docs/hooks) supply the execution primitives.
- [GitHub Actions](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows),
  [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
  and [merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
  supply event and merge evidence.
- [Linear agent delegation](https://linear.app/docs/agents-in-linear),
  [cycles](https://linear.app/docs/use-cycles), and
  [project updates](https://linear.app/docs/initiative-and-project-updates) supply intent,
  capacity, delegation, and status coordination.
