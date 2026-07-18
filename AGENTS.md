# AGENTS.md

## Canonical Sources

The GitHub repository on `main` is the source of truth for Ouroboros product, architecture,
naming, API contracts, runtime behavior, tests, validation, and agent operating policy.

Start every non-trivial task from:

1. this file, [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and `.agents/skills/AGENTS.md`
2. [Development Workflow](docs/development-workflow.md)
3. [Project Direction](docs/project-direction.md)
4. [Research And Arena Product Loop](docs/research-arena-product-loop.md)
5. [CandidateArena And Research Goal](docs/candidate-arena-research-goal.md)
6. [CandidateArena Evaluation Protocol](docs/candidate-arena-evaluation-protocol.md)
7. [Autonomy Model](docs/autonomy-model.md)
8. [Product Quality Design](docs/product-quality-design.md)
9. [Architecture Governance](docs/architecture-governance.md)
10. [API And Command Contract](docs/api-command-contract.md)
11. [Naming Taxonomy](docs/naming-taxonomy.md)
12. [LINEAR.md](LINEAR.md), only when the task needs issue workflow or Linear writeback

Linear is a workflow scratchpad and issue tracker. It can coordinate work and record progress, but
it must point back to repo truth instead of replacing it.

## Product And Delivery System Boundary

Ouroboros contains a product system; the Repository Delivery Loop is the separate system used to
change that product. They share an evaluation pattern, not implementation, state, credentials, or
authority.

| Boundary | Ouroboros product system | Repository Delivery Loop |
| --- | --- | --- |
| Purpose | Generate and externally evaluate TradingSystem candidates, retain findings and lineage, and accumulate selected PaperTradingEvaluation evidence. | Deliver one bounded repository change from intent through merged evidence and workflow writeback. |
| State | CandidateArena, Evaluation, TradingRun, Gateway, Ledger, and product read models. | Linear issue/workpad, Git branch and pull request, checks, review, merge commit, and Codex task state. |
| Authority | Product contracts plus external Evaluation, Gateway, and Ledger evidence. | Repository `main`, required GitHub checks and review, and the merge result. Linear status and Codex claims are not merge authority. |
| Automation | Product commands and product-owned schedulers inside the runtime boundary. | Linear/GitHub events and bounded Codex goal, scheduled-task, skill, hook, worktree, and connector execution. |

The shared mental model is only `trigger -> bounded goal -> attempts -> external evaluation ->
persisted evidence -> stop condition -> next frontier`. Product types and delivery types must not be
reused across that boundary. Delivery automation may edit product code and run product validation
as issue evidence, but it must not orchestrate CandidateArena, choose ResearchDirections, grade
candidates, or gain Gateway, exchange, private-data, or live authority. ResearchWorkers,
TradingSystems, and product schedulers must not access Linear, GitHub, Codex delivery tasks,
repository credentials, branches, reviews, or merge authority. The full operating contract is in
[Development Workflow](docs/development-workflow.md).

## CandidateArena Core Doctrine

Keep every non-trivial product, docs, source-ingestion, and implementation task tied to the core
loop:

```text
problem
-> parallel or iterative TradingSystem candidate generation
-> pre-effect ResearchPreflightCommitment
-> bounded agent-owned ResearchWorkerSession and development ResearchPreflight
-> explicit immutable development-submission selection
-> frozen one-shot rotating sealed admission
-> external PaperTradingHandoffConformance
-> development-only ResearchBehaviorFingerprint comparison
-> CandidateAdmissionDecision and materialization
-> terminal ResearchWorkerCheckpoint
-> admitted TradingSystem into bounded isolated paper Arena
-> comparable paper leaderboard
-> findings and lineage
-> next generation
-> explicit qualified handoff for later Trading review
```

Research is the candidate-generation process; Arena is the paper execution and evaluation process.
Actual Research sessions and admitted paper systems must remain separately observable. The detailed
product, read-model, UX, and always-on contract is in
[Research And Arena Product Loop](docs/research-arena-product-loop.md).

Researchers and LLM agents generate candidates; they do not grant authority. External Evaluation,
exact submitted-artifact paper handoff conformance, provider/risk validation, selected-candidate
continuous paper `revenue - cost`, and Gateway/Ledger evidence decide what counts. Every new
runnable handoff must bind its exact pre-effect commitment, sealed terminal evaluation, submitted
`SystemCode`, and passed `PaperTradingHandoffConformance`. Development feedback has no admission
authority; raw evaluator seed, sealed scenarios, and sealed outcome stay unavailable to the
ResearchWorker. The default Codex and fixture paths run one bounded provider session over one
artifact workspace. The worker may make multiple externally snapshotted development submissions,
receive aggregate feedback, and explicitly select one completed sequence or finish without a
selection. The host never selects from score or mutable workspace state. A selected sequence and
exact submitted SystemCode digest are bound into the terminal Evaluation while sealed
`submission_sequence: 1` continues to mean the single sealed attempt. Finishing without selection
records `no_submission`, creates no SystemCode/admission/Evaluation/Finding, and closes the
checkpoint as `completed/finished_without_submission`. Provider or tool failure fails closed.
Process loss fails the exact commitment closed rather than resampling. A stable
logical ResearchWorker may continue only through a new allocation and commitment after one
append-only `ResearchWorkerCheckpoint`; restart recovery reconstructs an exact persisted admission
closure or records `failed_closed/restart_recovery` before any new worker effect. It never resumes
the old provider process, budget, evaluator seed, or sealed suite. Generated
single-file Python SystemCode identity is the canonical digest of its
frozen manifest-plus-entrypoint closure, not the entrypoint alone; generated-candidate paper start
revalidates that closure and conformance evidence before paper effects.
CandidateArena also fingerprints normalized effective order decisions from the exact development
suite. Only an earlier admitted fingerprint on the same protocol and suite may exclude a later
exact behavioral duplicate; missing canonical observations fail closed, duplicate Finding/Lineage
remain research memory, and sealed scores, paper outcomes, rationale text, and event noise never
define the fingerprint.
CandidateArena derives `ResearchPopulationDiversity` over the same latest ten completed ticks.
Top-level distributions measure rolling coverage and newest-first `tick_series` entries measure
each tick's worker cross-section. Assigned-direction entropy and exact same-suite behavior entropy
stay separate; mixed protocol or development-suite cohorts are `incomparable_suites`. This bounded
read model may guide researcher attention but never rank, admit, allocate, qualify, promote, submit
orders, or grant private/live authority.
`ResearchControlCampaign` is the controlled execution boundary for testing an Arena policy. It commits one exact
LocalStore baseline, actual research artifact closure, managed-agent identity, equal maximum bounds,
and adaptive/static tick sequences before effects; runs each arm in an independent LocalStore; and
persists only an unadjudicated research report with deterministic future paper candidate slots.
Admission, duplicate, diversity, and efficiency differences are diagnostics, never a winner or
economic result. A bound campaign commits one deterministic
`ResearchControlCampaignPaperSchedule`; the internal bounded executor prepares all candidate-bearing
arms before source effects, seals matched shared snapshots in a
`ResearchControlCampaignPaperStartBatch`, and records every source, deadline, or confirmation path
as one `ResearchControlCampaignPaperSlotOutcome`. `ResearchControlCampaignOutcome` separately
requires the pre-effect Trading review comparator, the complete exact slot-outcome set, and one
shared paper policy. It counts every slot and records one non-causal observation with no
policy-replacement, promotion, order, private, or live authority. The optional executor step and
runner are internal orchestration, not a default deployed scheduler or public command.
`createResearchControlCampaignPaperRuntimeArm` now composes one arm-local store and paper-session
service into the existing comparison, activation, checkpoint, qualification, confirmation, and
release services. Confirmation advances one persisted transition per executor action and propagates
its exact wake time instead of polling. Each arm owns a distinct runtime activation coordinator;
an unowned running attempt is recovered, never adopted.
`ResearchControlStudy` is the replicated inference boundary. Before any planned campaign exists it
commits 6 to 30 exact campaign identities, one same-frozen-snapshot condition, and one paired exact
sign-test policy. `ResearchControlStudyOutcome` requires every planned campaign and terminal
campaign outcome exactly once, permits no early stopping, and limits its causal scope to
same-baseline stochastic repetitions. A supported adaptive effect grants only eligibility for a
separate allocation-policy decision; neither record replaces policy, promotes, submits orders, or
widens private/live authority.
`ResearchMemoryControlStudy` is the narrower cross-generation-memory inference boundary. It
precommits 6 to 30 fresh same-baseline pairs with one source, agent identity, direction schedule,
budget, and exact evaluator opportunity. Worker-facing payloads and opaque tick/workspace side
identities reveal no treatment/control label; only safe prior Arena memory content differs.
`ResearchMemoryControlPairOutcome` derives exact-repeat observations from external unchanged-
artifact or same-suite fingerprint evidence, and `ResearchMemoryControlStudyOutcome` includes every
planned terminal pair in one exact sign test. Neither record measures candidate quality or paper
economics, replaces memory policy, promotes, submits orders, or widens private/live authority.
`createResearchControlStudyRuntime` is the canonical internal study composition. Its executor
derives progress only from append-only study, campaign, campaign-outcome, and study-outcome records,
completes at most one planned campaign per advance in fixed order, and adjudicates only after exact
closure. Its runner may repeat those actions and drains an active campaign before stopping. It is
not a public command or policy application path.
`ResearchControlStudyProcessSupervisor` is the internal one-shot process-discovery boundary. One
composition root may start one supervisor for one store; it discovers incomplete studies oldest
first, opens only one existing study runtime, reloads exact terminal evidence after completion, and
rescans until caught up. Failure never skips an earlier study, and stop drains the active campaign
without opening the next study. Before every default server discovery cycle,
`ResearchControlStudyCommitmentCoordinator` reloads the latest exact TradingPromotion graph and
ensures at most one deterministic six-replication, one-tick-per-arm study under the repository-fixed
policy. It preserves the sealed numeric, market-data, and paper policy while binding comparison to
`champion_challenge`; no promotion or an existing incomplete study defers, while corrupt or drifted
evidence fails closed. Same-root contenders publish through create-only LocalStore semantics and
accept only an exact deterministic winner. This operational component is not research evidence and
has no allocation-policy, promotion, order, private, or live authority.
`ResearchControlStudyScheduler` invokes that coordinator before starting the supervisor and polls
for later reviewed sources with an interruptible bound. Before opening a study, one
renewable `ResearchControlStudyExecutionLease` excludes other same-host servers sharing the
LocalStore root, guards every executor advance, and releases on terminal paths. Alive or unknown
owners wait; takeover requires expiry and confirmed absence of the same-host PID. Lease records
carry runtime-coordination authority only and are never research or policy evidence. Multi-host
fencing and public commands remain outside.
`buildServer` must own selected PaperTrading recovery, persisted CandidateArena start intent, and
the ResearchControlStudyScheduler through one `RuntimeSupervisor`. Keep the lane order fixed, use
the immutable checkpoint chain for retry/restart state, retry only within the bounded no-progress
budget, isolate lane failures, and stop in reverse order. `/health` and `OperatorReadModel` must
return the same supervisor projection. The supervisor coordinates runtime only; it never ranks,
qualifies, promotes, submits orders, or widens private/live authority.
Keep `RuntimeSoakHarness` outside `RuntimeSupervisor`. It is an operational test controller that
injects operator-configured faults, samples external state, and writes an authority-free
`RuntimeSoakReport`; it must not become a runtime lane, trading policy, or source of evaluation or
promotion authority.
Child provider and deterministic long-running Sandbox processes use separate
`RuntimeProcessOwnership` scopes. Before any child effect, the runtime durably binds the exact
host, PID start marker, executable, profile digest, worker/store-root process scope, runtime ref,
and session token. A
restarted provider session terminates an exact stale owner before starting fresh because its pipes
and tool capabilities are not recoverable; a deterministic Sandbox may adopt only an exact live
owner. Missing, unreadable, reused, or mismatched identity fails closed, and every terminal path is
kept as inspectable history. This is same-host runtime coordination only; external `sbx` resources,
multi-host fencing, provider-session resumption, and private/live authority remain outside.
`ResearchGeneralizationProtocol` is the prospective cross-study inference boundary. Before any
assigned study effect it freezes one exact adaptive policy, ResearchWorker identity, paper and
campaign policy, six deterministic study slots, two slots each for public `long`, `short`, and
`flat` condition blocks, a 24-hour global spacing rule, a 90-day collection deadline, and an
equal-weight stratified analysis. The Gateway classifies only an exact 30-element closed
`BTCUSDT` one-minute public kline window with the frozen
`btc_usdt_closed_kline_direction_v1` policy. A study's optional
`generalization_assignment` binds one matching slot, pre-effect classification, source artifact,
and exact baseline snapshot without changing historical same-baseline study meaning.
`ResearchGeneralizationOutcome` externally accounts for all six planned slots at terminal closure
or expiry. It requires eligible evidence in every block, six non-ties, at least three distinct
baseline snapshots, an exact two-sided sign-test p-value at most 0.05, a positive equal-weight
mean, and no non-positive block before reporting `generalization_supported`. Missing, tied,
ineligible, duplicated, expired, or harmful evidence remains explicit. After successful scheduler
catch-up, the default outcome coordinator reconciles at most the oldest missing protocol outcome
before the generalization-policy and same-baseline allocation-policy decision coordinators. Neither
protocol nor outcome changes policy, promotes, submits orders, or gains private/live authority; a
supported outcome is only eligible for the separate generalization-policy decision.
`ResearchGeneralizationPolicyDecision` is that append-only broad research-policy selection
boundary. It reloads one exact protocol/outcome graph and may approve only the frozen
`adaptive_default` policy digest after exact `generalization_supported` evidence. Every other valid
terminal outcome records `not_approved` with no effective mode; it never infers static superiority.
For future uncontrolled ticks, explicit directions and modes win, then the latest applicable broad
approval, then the latest applicable same-baseline approval, then the repository adaptive default.
LocalStore independently validates decision and outcome provenance before worker effects. After
successful catch-up, the default scheduler reconciles at most one oldest missing generalization
decision before the same-baseline decision. This grants research-policy selection authority only,
never evaluation, rank, qualification, promotion, order, private, or live authority.
`ResearchGeneralizationReadModel` is the required compact operator projection of that graph. It
reports `not_started`, `collecting`, `awaiting_outcome`, or `closed`, the oldest protocol without an
outcome, the latest adjudicated outcome, and the chronologically latest policy decision. It also
reports the exact approved broad decision currently selected by the uncontrolled-allocation
resolver as `effective_policy_decision`; a newer `not_approved` decision does not revoke an older
applicable approval. Its application projection is `awaiting_allocation`, `allocated`, or
`completed_tick`, counts exact citing allocations and completed ticks, and exposes the latest
allocation link. CandidateArena builds it from complete protocol, study, study-outcome, outcome,
decision, allocation, and tick evidence. Duplicate or irreconcilable source or application graph
state fails the read path instead of appearing empty. CLI, TUI, and Web Research may render this
projection, but it is read-only evidence over existing records and must not enter ResearchWorker
context, direction scoring, rank, qualification, promotion, order, private, or live behavior.
`ResearchAllocationPolicyDecision` is the separate research-only policy-selection boundary. Only
an exact eligible `adaptive_effect_supported` study outcome may approve the studied adaptive policy
digest; non-supported or underpowered evidence never selects static control. It is the fallback
decision family when no applicable broad generalization approval exists. Every allocation seals
its exact basis, and LocalStore independently validates decision-backed provenance before worker
effects. After each
successful default scheduler catch-up, `ResearchAllocationPolicyDecisionCoordinator` validates
existing decisions and ensures the oldest missing terminal outcome, at most one per cycle. It
records supported, unsupported, and underpowered outcomes symmetrically, advances an equal
adjudication millisecond by one, rejects clock regression, and resolves same-root races through
create-only publication plus exact winner re-derivation. This remains a separate fixed application
decision, not outcome self-authorization, and grants no evaluation, promotion, order, private, or
live authority.
Binance public market data enters through the Gateway-owned
`MarketDataPort`, never directly through a `TradingSystem`. A selected `TradingSystem` owns its
decision cadence; paper observations are checkpoint/readback events that consume newly emitted
`OrderRequest`s, record no-order continuity when nothing new was emitted, and never make the
Gateway synthesize a trade decision because a market snapshot was refreshed. Failed or loss-making
candidates remain useful arena memory unless they crash, submit malformed orders, bypass provider
boundaries, fail risk validation, or attempt private/live behavior.

Treat AAR, AlphaProof Nexus, and future research references as pressure toward this candidate
population loop. If a proposed change does not strengthen CandidateArena generation, external
Evaluation, leaderboard/finding/lineage memory, or selected paper evidence, treat it as scope
expansion and reroute through Linear before implementation.

## Codex Operating Contract

This repository uses Codex features as an operating system for quality, not as a second source of
truth.

| Codex surface | Repo role |
| --- | --- |
| `AGENTS.md` | Always-on policy for source order, boundaries, naming, validation, and writeback. |
| `.agents/skills` | Bounded workflow instructions loaded only when the task matches the skill. |
| Plugins | External app, MCP, and reusable workflow bundles such as Linear, GitHub, browser, security, and OpenAI docs access. |
| Project-scoped subagents | Explicitly requested read-only exploration or review workers for parallel evidence gathering. |
| Hooks | Local pre-tool and post-tool safety checks; Git hooks and CI remain the final guard. |

Use plugins and skills to access the system that owns each workflow fact: GitHub for repo,
PR/CI/review evidence, Linear for issue workflow notes, OpenAI docs for Codex/OpenAI behavior, and
browser tooling for rendered local UI evidence. Do not replace repo truth with chat memory.

For any work that reads, creates, updates, comments on, audits, or writes back Linear issues,
projects, documents, cycles, comments, or project updates, load and follow the `linear` skill first.
Use it because Linear workflow needs explicit target issue/project/team context, read-before-write
discipline, durable identifiers, related-operation batching, and a clear summary of remaining
blockers.

The purpose of the `linear` skill is to keep issue workflow notes connected to repo truth. The
method is: recover the active issue and project context, read relevant comments and updates, decide
the exact Linear operation, execute that operation through the bundled Linear OAuth Connector, and
report the exact Linear objects changed. Read before write, update one `## Codex Workpad` comment
instead of creating duplicates, and batch only related mutations. Do not use a repo-local Linear
API key, raw GraphQL command, or `.env` credential path. If the OAuth Connector is unavailable,
report workflow writeback as blocked instead of replacing repo truth with chat memory.

When work needs a Linear Initiative, Project, milestone, issue shape, priority, label, dependency,
cycle, state, or GitHub linkage decision, apply the repo-local `linear-workflow` skill after loading
the external `linear` skill. Initiatives own measurable strategic objectives across Projects;
Projects own finite outcomes, and the target structure does not mix the Ouroboros product program
with the Repository Delivery program. Until the explicit migration lands, follow the interim
milestone, parent, and issue-description boundary in `LINEAR.md`; do not migrate it from an
unrelated task. Milestones own capability checkpoints. A tracking parent is branchless, PR-less,
and has no issue priority. An executable repo issue owns one observable claim, one branch, and one
pull request. A Linear-only configuration issue owns one bounded mutation and readback but no
branch or pull request.

Issue separation is an outcome-delivery contract. Code and merge-order independence are necessary
but not sufficient: each executable sibling must close independently usable, operable,
review-decidable, or distinct risk/authority value. Split only when expected parallel wall-time
savings exceed the added issue, worktree, PR, CI, review, merge, cleanup, and writeback cost and a
current writer slot exists. A fan-in needed mainly to make helper siblings useful means those
siblings belong in one outcome packet. Use priority for preferred order, parentage for rollup, and
`blocked by` only for a concrete unavailable input. Materialize active issues only up to verified
concurrent writer capacity, plus one ready successor by default; keep later design nodes, review
notes, transient signals, and unshaped ideas in the repo plan or active workpad. Every repo-writing
issue uses its own dedicated worktree, recorded base, branch, and writer lease; the root checkout
is a control checkout for fetch and inventory, not implementation.

Priority selects work; it does not restate status, dependency, or risk. Reserve `Urgent` for an
active exposure or the sole current blocker and `High` for the next unblocked critical-path issue.
Every executable issue has exactly one `area:*` and one `type:*` label, may have `risk:*` labels,
and may use one `gate:*` label only for a non-derivable human, environment, or manual gate. Do not
encode program, status, priority, dependency, assignee, cycle, or runner readiness as labels.

Use project-scoped subagents only when the task benefits from parallel read-only work, such as
Linear context recovery, code path mapping, PR review, or UI reproduction. Subagents are advisory:
the main Codex worker remains responsible for the final patch, validation, and writeback decision.

## Repository Responsibility

The repo owns durable truth: code, tests, fixtures, local validation scripts, compact
developer-facing docs, executable agent instructions, architecture policy, naming policy, API
contracts, and review evidence.

Linear owns workflow coordination: issues, comments, scratchpads, project boards, cycles, project
updates, and handoff notes that point back to repo truth.

When the two disagree, reconcile by updating or linking back to the repo source of truth. Do not
promote Linear scratchpad text above repo code, tests, and docs.

## Agent Workflow

1. Recover the current branch, issue, dirty state, and nearest validation evidence.
2. Read this file, [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md),
   [Development Workflow](docs/development-workflow.md), and the relevant docs under
   [docs](docs/project-direction.md).
3. Read [LINEAR.md](LINEAR.md) and the active Linear issue through the OAuth Connector when the
   task needs workflow context or writeback.
4. Read `.agents/skills/AGENTS.md`.
5. Route work through `.agents/skills/AGENTS.md` when the task is multi-step or ambiguous.
6. Keep implementation changes bounded to the active repo issue, task, or approved plan.
7. Run the narrowest meaningful validation, then the repo's required checks.
8. Keep durable outcomes in repo code, tests, docs, and validation. Write Linear progress notes
   through the `linear` skill and OAuth Connector only when issue workflow needs it.

## App Launch Workflow

When the user asks to launch, open, run, or inspect the Ouroboros app, treat the primary app as the
Tauri Desktop app in `apps/operator-desktop` unless they explicitly ask for Web, TUI, CLI, or a
packaged release artifact. Do not conclude the Desktop app is missing from a stale checkout.

Before launching an app surface:

1. Read this file, [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and
   [Operator Desktop Performance And Release](docs/operator-desktop-performance-release.md).
2. Recover branch and dirty state, then fetch `origin/main` and report exact divergence. If the
   branch is behind and can be fast-forwarded without touching unrelated dirty files, run
   `git pull --ff-only origin main` before app launch. If it cannot be fast-forwarded cleanly,
   report the blocker instead of falling back to a stale surface.
3. Verify `apps/operator-desktop/package.json` and `apps/operator-desktop/src-tauri/tauri.conf.json`
   exist after sync. If a newly synced dependency is missing, run `npm install` from the repo root
   before launching.
4. Launch source-checkout Desktop development with `npm run dev:operator-desktop`. This builds the
   shared Operator UI into the Tauri `frontendDist` target and opens the native macOS app; it does
   not require `npm run dev:operator-web`.
5. For packaged-app checks, use `npm run package:operator-desktop`, then
   `npm run open:operator-desktop`, then `npm run verify:operator-desktop-release`.
6. Verify the native process, not only HTTP or browser reachability. On macOS,
   `pgrep -fl ouroboros-operator-desktop` and System Events process checks are valid evidence. The
   runtime health endpoint is supporting evidence: `curl -fsS http://127.0.0.1:4173/health`.
7. Use `npm run dev:operator-web` only when the user asks for the browser development surface or a
   Web-specific UI check. Use `ouroboros tui` only when the user asks for the terminal interface.

Ouroboros Desktop is Tauri, not Electron. The Web app is shared UI source and a browser/development
surface; it is not the default interactive operator app. If multiple helper surfaces were started
while diagnosing a launch, close unnecessary Web/TUI sessions and leave only the requested app
surface plus required runtime process running.

## Skill-First Gate

Use `.agents/skills/AGENTS.md` before routing multi-step repo work. Keep `project-context`, `llm-wiki`, `writeback_needed`, `superpowers:using-superpowers`, and Skill-First Gate active.

`llm-wiki` remains the durable-writeback skill name for compatibility, but its target is now repo
docs, repo policy, or workflow notes that point back to repo truth.

Default skill routing:

| Work shape | Skill route |
| --- | --- |
| Recover branch, dirty state, PR, task, and nearest evidence | `auto-run-memory` |
| Explain current product, architecture, or repo posture | `project-context` |
| Decide the next bounded frontier or owner | `auto-project` |
| Shape a rough request into acceptance criteria | `auto-pm` |
| Implement one approved docs, code, config, or CI change | `auto-coding` |
| Review scenarios, regressions, risks, or acceptance | `auto-qa` |
| Decide PR readiness, landing, or reroute | `auto-promotion-protocol` |
| Update repo durable truth or workflow memory | `llm-wiki` |
| Design durable vocabulary or schema names | `taxonomy-design` |

When an external Superpowers skill is available, use it as process support behind the same
repo-local ownership model. Project truth comes from this repo; workflow context can come from
Linear when relevant.

## Taxonomy and Naming

For durable domain names, schema families, public/persisted keys, or naming cleanup, use `.agents/skills/taxonomy-design` before implementation.

Ouroboros taxonomy should be maintained as vocabulary guidance, not as a mechanical blocklist.
Prefer compact canonical nouns plus explicit fields for product scope, authority,
source/provenance, lifecycle, audience, and compatibility. Do not add naming/audit blockers unless
a repo issue explicitly asks for enforcement.

Canonical Ouroboros nouns for the current product surface:

| Canonical noun | Meaning |
| --- | --- |
| `CandidateArena` | Research workflow where multiple TradingSystem candidates are generated, evaluated, ranked, and selected. |
| `ResearchWorker` | Stable logical candidate generator bound to one ResearchDirection and exact managed-agent profile across CandidateArena ticks; provider processes and candidate artifact runs remain disposable. |
| `ResearchWorkerSession` | Runtime lifetime of one ResearchWorker under one exact ResearchPreflightCommitment. It owns one bounded artifact workspace and provider process plus status, development submission, explicit selection, and finish tools; it is not a persisted worker identity or trading authority. |
| `ResearchDirection` | Arena research lane such as trend following, mean reversion, volatility regime, funding-aware risk, or execution-cost robustness. |
| `CandidateArenaTick` | One arena iteration that records each direction as created, duplicate, quarantined, no submission, or failed, with candidate/finding/lineage evidence only when that outcome owns it. |
| `CandidateArenaResearchAllocation` | Append-only pre-effect research-only scheduling decision for one CandidateArena tick; it freezes selected and deferred directions, bounded experiment budgets and concurrency, signal provenance, and whether policy came from an explicit request, repository default, or exact approved ResearchAllocationPolicyDecision without becoming economic or promotion evidence. |
| `ResearchPreflightCommitment` | Append-only pre-effect binding of one tick/direction/worker/allocation/source SystemCode to bounded development feedback and one evaluator-owned rotating sealed-admission suite; it stores commitments and digests, never the raw evaluator seed or sealed scenarios, and grants no admission, promotion, order, private, or live authority. |
| `ResearchWorkerCheckpoint` | Append-only terminal lifecycle evidence for one stable ResearchWorker and exact ResearchPreflightCommitment; it carries bounded sanitized notebook continuity and closed budget history into a later new commitment without resuming old effects or granting downstream authority. |
| `ResearchBehaviorFingerprint` | Append-only development-only record of normalized effective decisions for one exact protocol, suite digest, commitment, and frozen SystemCode; exact matching is bounded observational duplicate evidence, not semantic equivalence, score, qualification, promotion, order, private, or live authority. |
| `CandidateAdmissionDecision` | Research-only external gate that binds the complete new-format ResearchPreflight commitment/terminal/submitted-SystemCode graph and paper handoff conformance to classify a submission as admitted, duplicate, or quarantined before materialization; only exact passed conformance may produce an admitted runnable handoff, and the decision grants no paper qualification or live authority. |
| `ResearchEfficiency` | Authority-free development and sealed-admission submission/provider-request/runner-command/scenario/elapsed summaries for comparing research cost and latency without exposing sealed evaluator content or becoming rank. |
| `ResearchPopulationDiversity` | Read-only latest-ten-tick coverage aggregate plus newest-first per-tick worker cross-sections that separate assigned ResearchDirection concentration from exact same-suite observed ResearchBehaviorFingerprint concentration; mixed cohorts are incomparable, and the read model has no scheduling, evaluation, admission, rank, qualification, promotion, order, private, or live authority. |
| `ResearchControlCampaign` | Append-only pre-effect adaptive-versus-static CandidateArena ablation over one exact store and source-artifact baseline. Isolated arm intents and the research-phase report freeze bounds, ticks, diagnostics, and future paper candidate slots while the primary outcome remains unadjudicated and authority-closed. |
| `ResearchControlCampaignPaperSchedule` | Append-only post-report, pre-paper commitment of every arm slot, source comparison identity, comparator, policy, order, and deadline for one ResearchControlCampaign. |
| `ResearchControlCampaignPaperStartBatch` | Coordinator-owned cross-arm witness for one schedule sequence. It seals candidate-bearing source commitments and shared first-tick public market/execution evidence, or a terminal start-ineligible reason, without copying peer TradingRuns. |
| `ResearchControlCampaignPaperSlotOutcome` | Arm-local append-only terminal classification for one scheduled candidate slot, backed by an exact source verdict, source expiry, start batch, confirmation expiry, or confirmation ResearchRelease. |
| `ResearchControlCampaignPaperExecutor` | Internal bounded runtime orchestrator, assembled by `createResearchControlCampaignPaperRuntime`, that derives one action from append-only campaign paper evidence. It has paper scheduling/evaluation authority only and is not a public command, policy decision, promotion path, or live runner. |
| `ResearchControlCampaignOutcome` | Append-only external adjudication of every precommitted ResearchControlCampaign paper slot against its pre-effect Trading review comparator and one shared policy. Only exact confirmed-improvement ResearchRelease evidence receives discovery credit; one outcome is not causal proof or policy authority. |
| `ResearchControlStudy` | Append-only pre-effect commitment of 6 to 30 exact ResearchControlCampaign replications under one same-frozen-snapshot condition and one paired exact sign-test policy. It fixes every campaign identity before effects, permits no early stopping, and owns research scheduling authority only. |
| `ResearchControlStudyOutcome` | Append-only external aggregate over every planned ResearchControlCampaignOutcome. It reports same-baseline stochastic-replication inference and may make a supported effect eligible for a separate policy decision, but cannot replace policy, promote, submit orders, or gain private/live authority. |
| `ResearchMemoryControlStudy` | Append-only pre-effect commitment of 6 to 30 fresh same-baseline released-memory versus memory-masked pairs. It freezes source, agent, directions, budgets, evaluator opportunity, blinded side identities, and exact analysis before effects; only cross-generation memory visibility may differ. |
| `ResearchMemoryControlPairOutcome` | Append-only external terminal result for one planned memory pair. It derives an exact-repeat difference only from unchanged-artifact or exact same-suite ResearchBehaviorFingerprint evidence, retains failures and interruptions, and has no quality or downstream authority. |
| `ResearchMemoryControlStudyOutcome` | Append-only all-pairs exact-sign-test aggregate. A supported result means only that released memory reduced exact repeats under the frozen same-baseline conditions; it is not economic evidence and cannot replace memory policy or grant downstream authority. |
| `ResearchGeneralizationProtocol` | Append-only pre-effect cross-study commitment that freezes six deterministic ResearchControlStudy slots across two public long, short, and flat condition-block replications, independent source-baseline controls, timing, resource bounds, and equal-weight analysis. It owns research scheduling authority only. |
| `ResearchGeneralizationOutcome` | Append-only external aggregate over every planned ResearchGeneralizationProtocol slot. It reports prospective condition-blocked cross-baseline inference, preserves missing and harmful evidence, and may only make exact supported evidence eligible for the separate ResearchGeneralizationPolicyDecision. |
| `ResearchGeneralizationPolicyDecision` | Append-only research-only selection record derived from one exact ResearchGeneralizationProtocol and ResearchGeneralizationOutcome. Version 1 may approve only the frozen adaptive policy digest after eligible supported cross-condition evidence; every other valid outcome is not approved, never selects static control, and grants no evaluation, promotion, order, private, or live authority. |
| `ResearchGeneralizationReadModel` | Required compact CandidateArena operator projection of protocol lifecycle, oldest active progress, canonical condition blocks, latest outcome inference, latest policy decision, next actions, and explicit non-authority. It is read-only and never feeds allocation, ResearchWorker context, policy selection, rank, qualification, promotion, order, private, or live behavior. |
| `ResearchControlStudyExecutor` | Internal derived-state orchestrator, assembled by `createResearchControlStudyRuntime`, that completes or resumes one exact planned campaign per advance and adjudicates only after every terminal outcome. It persists no parallel progress record and owns no policy-replacement, promotion, order, private, or live authority. |
| `ResearchControlStudyProcessSupervisor` | Internal single-owner process scheduler that discovers incomplete ResearchControlStudies from exact store evidence, drains them oldest first through existing runtimes, rescans after each completion, and persists no separate progress or downstream authority. |
| `ResearchControlStudyExecutionLease` | Renewable same-host filesystem ownership for one pending ResearchControlStudy under one shared LocalStore root. It guards runtime advances, waits for alive or liveness-unknown owners, permits takeover only after expiry plus confirmed PID absence, archives terminal ownership, and grants runtime coordination only. |
| `RuntimeSupervisor` | Store-scoped runtime coordinator for selected PaperTrading sessions, persisted CandidateArena start intent, and the ResearchControlStudyScheduler. It owns bounded progress-aware retry and reverse-order shutdown, with runtime-coordination authority only. |
| `RuntimeSupervisorCheckpoint` | Immutable predecessor-linked RuntimeSupervisor state containing lane desire, status, basis/progress digests, attempts, retry time, and reason. It is restart coordination, not evaluation or promotion evidence. |
| `RuntimeProcessOwnership` | Same-host operational identity and transition history for one RuntimeSupervisor, provider, or deterministic long-running Sandbox process. It binds host, PID start marker, executable/profile, runtime-supervisor, worker/store-root, or Sandbox process scope, runtime, and session token before effects; exact Sandbox owners may be adopted while provider owners are terminated before a fresh session. It grants no research, evaluation, order, private, or live authority. |
| `ResearchAllocationPolicyDecision` | Append-only research-only selection record derived separately from one exact ResearchControlStudy and outcome. Version 1 may approve only the studied adaptive policy digest after eligible supported same-baseline evidence; otherwise it records not-approved with no effective mode and never selects static control. |
| `RuntimeSoakHarness` | External operational test controller for one immutable time-bounded fault schedule, normalized invariant sampling, restart reconstruction, and terminal classification. It is not a RuntimeSupervisor lane and grants no product authority. |
| `RuntimeSoakReport` | Create-only manifest and predecessor-linked operational-test event chain for one RuntimeSoakHarness run. It preserves elapsed time, action evidence, samples, first failure, and terminal status without evaluation, promotion, order, private, or live authority. |
| `FindingCluster` | Read-only CandidateArena grouping of paper-backed or explicitly released campaign findings by direction, blocker, market regime, protocol failure, and release kind for the next ResearchWorker context. |
| `TradingSystem` | Agent-built BTCUSDT USD-M futures trading system. |
| `SystemCode` | Executable code produced for a TradingSystem. |
| `CandidateVersion` | Frozen candidate identity and default runtime projection. Its `runtime_ref` is the compatibility/default continuous paper TradingRun pointer, not a one-run cardinality constraint. |
| `ResearchPreflight` | Replay, backtest, or simulation used during candidate creation; useful evidence, not final product authority. |
| `PaperTradingHandoffConformance` | External research-only proof that one exact submitted SystemCode artifact closure satisfies the bounded target paper event protocol before admission, materialization, and generated-candidate paper start; it carries no economic, qualification, promotion, order, private, or live authority. |
| `CandidateEgressAttestation` | Evaluator-owned proof embedded in version 2 PaperTradingHandoffConformance that one exact SystemCode and ExperimentRun remained under the expected Docker Sandbox network policy for its candidate-effect window and completed owned-rule cleanup; it is required for new Docker-generated admission and grants research-preflight authority only. |
| `PaperTradingEvaluation` | Continuous selected-candidate paper TradingRun evidence ranked by accumulated `revenue - cost`. |
| `PaperTradingEvaluationCommitment` | Append-only pre-start record that fixes a paper evaluation's evidence purpose and executable, runtime, policy, data, account, and authority identities before evidence exists. |
| `PaperTradingComparisonCommitment` | Append-only champion/challenger qualification envelope that binds two frozen, distinct, inert paper sessions and one comparison policy before market outcomes exist. |
| `PaperTradingComparisonTick` | Append-only Gateway-owned market and public-execution checkpoint in one contiguous comparison sequence. Shared input evidence is not activation, consumption, verdict, or promotion proof. |
| `PaperTradingComparisonTickDelivery` | Append-only non-economic evidence that one exact role-bound provider persisted the context for a candidate-facing market response against one comparison tick. It does not prove acknowledgement, a decision, or an order. |
| `PaperTradingComparisonTickAcknowledgement` | Append-only non-economic evidence that the same role-bound session returned one exact delivery context. It proves observable receipt, not reasoning quality, economic evidence, or promotion fitness. |
| `PaperTradingComparisonTickContext` | Candidate-facing opaque lineage object containing exact tick and delivery refs/digests. It carries no lifecycle, Ledger, private, direct-order, or live authority. |
| `PaperTradingComparisonActivation` | Append-only internal paper-only authorization that binds one verified comparison, its sole first tick, exact side runtime refs, and a bounded derived start/cleanup/recovery policy. `authorized` is not runtime start, consumption, or outcome evidence and grants no live, private, credential, or direct order authority. |
| `PaperTradingComparisonActivationAttempt` | Append-only symmetric-start intent persisted before provider or sandbox effects; it fixes attempt sequence, retry index, both sides, deadline, and the activation policy inherited from one authorization. |
| `PaperTradingComparisonActivationSideResult` | Append-only per-side start or stop settlement with operation sequence, bounded request count, current runtime/evaluation state, and a stable error code when failed or uncertain. |
| `PaperTradingComparisonActivationOutcome` | Append-only pair reconciliation state: `both_running`, `stopped_cleanly`, or `cleanup_required`. `both_running` is zero-observation operational evidence, not a paired checkpoint, qualification result, verdict, or promotion. |
| `PaperTradingComparisonCheckpointAttempt` | Append-only intent for one checkpoint sequence, persisted before side effects. It binds the owned `both_running` attempt, exact tick, side evaluation/observation and provider-request baselines, deadline, and for sequence 2+ the exact prior paired outcome and provider-view advance. |
| `PaperTradingComparisonCheckpointOutcome` | Append-only terminal result for one checkpoint sequence. `paired` means one atomic LocalStore bundle committed both side Ledger/Observation/Evaluation evidence against the same tick; `incomplete` means no economic bundle was committed. Sequence 2+ paired evidence requires exact role-bound tick acknowledgements. |
| `PaperTradingComparisonCheckpointWriteContext` | Exact internal authority for one side's sandbox-evidence refresh, provider-view advance, or the paired commit boundary. It grants no ordinary Ledger, observation, evaluation, lifecycle, private, or live write authority. |
| `PaperTradingComparisonWindowDriver` | Internal application service that reloads one exact comparison graph and performs at most one legal tick, checkpoint, or orderly-stop transition toward the frozen maximum window. It is not a durable record, verdict, or public command. |
| `PaperTradingComparisonWindowRunner` | Process-local non-overlapping scheduler for one owned WindowDriver. It stops on terminal/error state, cannot adopt provider identity after restart, and grants no qualification, promotion, private, or live authority. |
| `PaperTradingComparisonQualification` | Read-only application decision that admits one cleanly stopped shared window to later adjudication only when both canonical side qualifications and the exact checkpoint-declared run-specific `ledger_chain` set are complete. It carries `not_verdict` authority and grants no winner, release, promotion, private, or live authority. |
| `PaperTradingComparisonVerdict` | Append-only external evaluation of one exact settled comparison window. It seals qualified improvement, qualified non-improvement, or ineligible closure; every outcome remains promotion-ineligible and releases only the experiment pair for a new precommitted window. |
| `PaperTradingComparisonConfirmationCampaign` | Append-only sealed precommitment for every new prospective window used to confirm one source improved verdict. It freezes deterministic slots, pair identity, policy, strict sequence, non-overlap, and start-delay rules before campaign evidence exists. |
| `PaperTradingComparisonConfirmationSlot` | One deterministic future comparison identity inside a confirmation campaign. It is immutable nested commitment data, not a mutable lifecycle record or an observed result. |
| `PaperTradingComparisonConfirmationCampaignOutcome` | Append-only external aggregate decision over every reserved campaign slot. Only all improved slots produce protocol-level `eligible`; the outcome remains sealed, paper-only, and `not_live`. It cannot create TradingPromotion or research visibility by itself; only the explicit operator promotion command or a separate ResearchRelease may consume it for those distinct purposes. |
| `PaperTradingComparisonResearchRelease` | Append-only internal bundle that makes one exact terminal confirmation outcome available to Research as a materialized Finding and extended Lineage. It is restart-recoverable, `lineage_only`, and grants no promotion, public, private, order, or live authority. |
| `PaperTradingEvidencePurpose` | Precommitted `research_feedback` or `qualification` purpose; one evaluation window cannot carry both or be upgraded after outcomes are known. |
| `PaperTradingQualification` | Evidence-quality gate for an eligible qualification-purpose PaperTradingEvaluation; separate from paper rank and based on observation window, runner health, failure ratio, market data, and public fill evidence. |
| `PaperTradingFailure` | Read-only paper failure classification with stable kind, raw reason, summary, and next action; not a promotion gate. |
| `TradingPromotion` | Explicit `trading_candidate.promote` transition into Trading review. It requires one terminal eligible all-improved confirmation campaign, freezes the exact campaign, outcome, final verdict, and final qualified challenger evaluation, and atomically revalidates the campaign against the current champion. It changes only Trading review, is not live exchange promotion, and carries `not_live` authority. |
| `TradingReview` | Operator projection of the active Trading review candidate; it separates promoted Trading review target from the current Arena selected candidate. |
| `Improvement` | Compatibility/AAR lineage noun for proposal and experiment flows that predate the primary CandidateArena workflow. |
| `TradingReviewPacket` | Structured read-only evidence packet inside `TradingReview` that explains verdict, blocker, paper performance, runner health, Ledger continuity, lineage, provenance, risk, authority, and next action for the active review target. |
| `TradingSystemDecision` | `OrderRequest`, `hold`, or no-action signal emitted by a selected TradingSystem according to its own decision cadence. |
| `Evaluation` | Generic evidence noun; qualify it as ResearchPreflight or PaperTradingEvaluation when authority matters. |
| `Finding` | Research observation from a candidate, failed direction, negative result, or paper evidence summary. |
| `Lineage` | Parent, direction, evaluation, finding, and evidence chain that explains why a candidate exists. |
| `PaperEvidence` | Selected-candidate proof from the paper TradingRun, Gateway, and Ledger path. |
| `TradingRun` | One execution session for a TradingSystem. |
| `Sandbox` | Isolated execution boundary for a TradingRun. |
| `Gateway` | Boundary that handles OrderRequest before exchange authority. |
| `MarketDataPort` | Gateway-owned public market data boundary; Binance is one adapter behind this port. |
| `Ledger` | OrderRequest, GatewayResult, and ExecutionResult record chain. |
| `OuroborosCommand` | Product-facing command envelope shared by CLI, UI, and TUI. |
| `OperatorReadModel` | Shared operator state returned to CLI, UI, and TUI. |
| `AgentProfile` | Managed provider runtime profile, such as codex; researcher selects one available provider. |

Use the canonical nouns above for new code, tests, docs, API paths, UI labels, and persisted keys.
When a name drifts, replace it directly with the canonical term instead of adding aliases or
compatibility reads.

`npm run check:naming` is the repo-local naming quality gate. It checks public routes, UI labels,
compact docs, and canonical read-model exports. If it fails, fix the vocabulary decision instead
of widening the allowlist unless the old name is explicitly a compatibility boundary.

Use the most authoritative vocabulary source for each domain before inventing project-local terms:

1. Agent, harness, AI, model, tool, MCP, guardrail, eval, trace, workflow, and memory terms should follow OpenAI and Claude/Anthropic terminology when those products have established names. Treat frontier product language as de facto standard vocabulary before coining local synonyms.
2. Bitcoin perpetual futures and trading substrate terms should follow Binance USD-M Futures terminology for `BTCUSDT`, including account, asset, balance, position, position side, order, trade, user data stream, listenKey, margin, leverage, mark price, liquidation price, notional, `USER_DATA`, and `TRADE`.
3. Planning and execution-state terms should follow GitHub when the concept is a repository,
branch, commit, pull request, workflow, check, or review state.
4. Linear terms should be used only when the concept is a Linear issue, project, milestone, cycle,
document, comment, status update, or project update.
5. Other concepts should use conventional engineering, product, finance, and trading terms where they exist.
6. Coin an Ouroboros-specific term only when the project introduces a genuinely new concept or no standard term fits. Record that decision in repo docs and tests.

At external API, persisted-schema, fixture, or connector boundaries, preserve official spelling and casing unless a compatibility layer explicitly maps it. Internal aliases can be clearer, but they must name the source term they represent.

Project-specific taxonomy truth starts from [Naming Taxonomy](docs/naming-taxonomy.md).

## Architecture Pattern Selection

Use Hexagonal Architecture, Clean Architecture, Layered Architecture, Domain-Driven Design, and
CQRS as the default design frame for new runtime work. Apply patterns as design tools, not as
decoration:

| Pattern | Use when |
| --- | --- |
| Strategy | selecting an algorithm, scoring policy, ranking rule, or risk rule |
| Factory | choosing provider, exchange, sandbox, runner, or adapter implementation |
| Builder | assembling read models, prompt context, Ledger summaries, or command responses |
| Adapter | integrating external tools, vendor SDKs, subprocesses, stores, or exchanges |
| Decorator | wrapping a port with timeout, retry, logging, audit, metrics, or authority guards |
| Observer | reacting to application events such as tick completion or evidence recording |
| Middleware | transport or command-envelope validation, shaping, rate limits, or error mapping |
| Registry | publishing discoverable command, provider, plugin, or handler catalogs |
| Plugin | adding packaged provider/exchange/evaluator/sandbox capabilities behind descriptors |
| Dependency Injection | wiring concrete adapters into services from a composition root |

Interfaces call controllers. Controllers validate and dispatch only. Services orchestrate use cases
through domain contracts and ports. Adapters implement ports. `apps/runtime` is the HTTP composition
root, `apps/cli` is the command-line interface, `apps/operator-tui` is the Ink interface, and
`apps/operator-web` is the Web interface. Shared command/query behavior belongs in
`packages/application`; concrete Codex, Binance, Sandbox, fixture, subprocess, and other outer
system integrations belong in `packages/adapters`. UI, CLI, and TUI must use the shared Operator
read model and Ouroboros command surface, or the local Ouroboros controller for CLI-only local
operations, instead of importing runtime internals. If a new feature touches a public command,
provider, exchange, or evidence boundary, update the registry or port first and document the chosen
pattern in the PR or repo docs when it changes durable architecture.

## Validation

Before a PR is ready for merge, collect all of the following evidence unless the active issue
explicitly narrows the scope:

```bash
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

For implementation changes, also run the relevant package tests and type checks.
For PR completion, wait for GitHub CI and Codex review. If review leaves actionable comments, fix
or explicitly reroute them before merge. After merge, update Linear only when issue workflow needs a
progress note; durable truth remains in the merged repo state.
