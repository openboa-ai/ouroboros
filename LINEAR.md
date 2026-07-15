# Linear Workflow Guide

Linear is an Ouroboros workflow tool for issues, comments, scratchpads, project coordination, and
historical progress notes. It is not the source of truth for product, architecture, naming, API, or
runtime behavior.

The GitHub repository on `main` is the source of truth. Linear work should reference the repo commit,
pull request, doc path, or validation evidence that owns the durable fact.

## Direction

- Repo-originated durable documentation changes stay in the repo.
- Linear comments and workpads should summarize progress and link to repo truth.
- Linear-related work must select the `linear` skill first and execute Linear operations through
  the bundled Linear OAuth Connector.
- One executable repo issue maps to one branch and one pull request. The complete lifecycle and
  frontier contract live in [Development Workflow](docs/development-workflow.md).
- Primary docs should keep agents focused on the CandidateArena loop: parallel or iterative
  TradingSystem candidate generation, external Evaluation, leaderboard, findings/lineage, next
  generation, and selected candidate paper evidence.

## Current Project

- Ouroboros Project: https://linear.app/openboa/project/ouroboros-113fef53f6d1

The current workspace still has historical work in one Project. The target structure separates the
Ouroboros product program from the Repository Delivery program. Until the explicit migration issue
lands, preserve that boundary with milestones, parent relationships, and issue descriptions. Do
not invent a program label as a substitute for the Project boundary.

## Planning Hierarchy

| Linear object | Owned decision | Required operating evidence |
| --- | --- | --- |
| Initiative | One long-lived, measurable strategic objective spanning Projects. | Owner, status, target when useful, independent Initiative priority, and periodic update. |
| Project | One finite outcome or deliverable inside exactly one program. | Lead, health, horizon, Project priority, milestones, and completion criteria. |
| Milestone | One meaningful capability or evidence checkpoint inside a Project. | Independently completable child issues and checkpoint evidence; no branch of its own. |
| Tracking parent | Breakdown and rollup for child issues. | `Backlog`, no issue priority, explicit `no branch / no PR`, and completion only after children. |
| Executable repo issue | One observable claim that changes durable repo truth. | Complete frontier contract, one branch, one PR, validation, review, merge, and readback. |
| Linear-only issue | One bounded workspace configuration or coordination mutation. | Explicit `no branch / no PR`, exact mutation plan, OAuth execution, and object readback. |
| Cycle | Delivery capacity for ready executable issues. | A bounded time window; never CandidateArena or TradingSystem cadence. |
| View | Filtered navigation over existing state. | No authority and no duplicated workflow state. |
| Document, comment, or workpad | Coordination that points to repo truth. | Stable links and one updated `## Codex Workpad`, not competing durable policy. |

Initiatives and Projects have independent priorities because they answer different questions.
Initiative priority compares strategic objectives. Project priority compares finite outcomes.
Issue priority selects the next executable frontier. Never copy a parent priority mechanically to
its children.

Linear subissues may inherit the parent Project and priority, but labels do not inherit. After
creating a child, explicitly read back and normalize its Project, priority, labels, dependencies,
and state before treating it as ready.

## Priority

| Issue priority | Meaning |
| --- | --- |
| `Urgent` | Active production, security, trading-authority, or data-integrity exposure, or the sole immediate blocker. Multiple Urgent issues require independent active exposures and named owners. |
| `High` | The next unblocked critical-path issue. Additional ready High issues require independent, staffed critical paths. |
| `Medium` | Planned, valuable work that follows the current critical path. |
| `Low` | Optional improvement, optimization, or deferred experiment. |
| `No priority` | Intake, parked work, and branchless tracking parents. |

Priority represents sequencing and impact, never status, dependency, risk, assignee, or effort. A
blocked issue is not the current `High` or `Urgent` execution selection; preserve its strategic
importance in its parent, Project, or update and select an unblocked frontier. Estimates describe
effort when enabled and do not change priority.

## Labels

Executable and Linear-only issues use orthogonal label dimensions:

- exactly one `area:*` label for the owning repository or workflow surface;
- exactly one `type:*` label for the work shape;
- zero or more `risk:*` labels for independent risk dimensions;
- zero or one `gate:*` label only when a human, environment, or manual gate cannot be derived from
  status, dependencies, assignee, delegate, cycle, or GitHub state.

Do not encode the product-versus-delivery program, status, priority, dependency, assignee, cycle,
or runner readiness as labels. Retire `gate:blocked`, `gate:agent-ready`, and `gate:hydra-ready`
when normalizing existing issues because Linear already owns those facts through relations, state,
assignment, delegation, and cycle membership. Initiative labels are limited to cross-cutting
strategic dimensions. Project labels are limited to reusable cross-Project operational dimensions;
they never replace program boundaries or health/status fields.

## Selection And State

Select work only from shaped, unblocked executable repo or Linear-only issues. Prefer the highest
issue priority that fits current WIP and dependencies; do not activate a tracking parent. `Todo`
means ready and selected. `In Progress` requires one owner and either a repo branch/base/workpad or
a Linear-only mutation plan/workpad. `In Review` requires a pull request plus local evidence for
repo work, or an independent readback gate for Linear-only work. `Done` requires merged-main
evidence for repo work, or exact post-mutation readback for Linear-only work.

Branch names use `codex/OURO-NNN-short-slug`, pull-request titles start with `[OURO-NNN]`, and the
PR links back to the issue. Tracking parents, Initiatives, Projects, milestones, cycles, views, and
Documents do not own branches or pull requests.

## Primary Repo Read Path

- [README.md](README.md)
- [AGENTS.md](AGENTS.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [Development Workflow](docs/development-workflow.md)
- [Project Direction](docs/project-direction.md)
- [Architecture Governance](docs/architecture-governance.md)
- [API And Command Contract](docs/api-command-contract.md)
- [Naming Taxonomy](docs/naming-taxonomy.md)

## Historical Linear References

- 00 Start Here - Ouroboros Documentation Index: https://linear.app/openboa/document/00-start-here-ouroboros-documentation-index-953f443725df
- 04 Execution Ledger - Active Frontier and Handoff: https://linear.app/openboa/document/04-execution-ledger-active-frontier-and-handoff-9e036cf84011
- 05 Project Ledger - Frontier State and Run Packet: https://linear.app/openboa/document/05-project-ledger-frontier-state-and-run-packet-e3d192eb65b8
- 35 Source Synthesis - Runtime, Evaluation, Product Postures: https://linear.app/openboa/document/35-source-synthesis-runtime-evaluation-product-postures-fd857d802e22
- 38 Source Addendum - AlphaProof Nexus and Candidate Arena References: https://linear.app/openboa/document/38-source-addendum-alphaproof-nexus-and-candidate-arena-references-fa78e56e2ad2
- the active Linear issue, comments, blockers, and linked PRs

Use the taxonomy below only when a task needs historical planning context or issue coordination.

## Document Taxonomy

- 00 Start Here - Ouroboros Documentation Index: https://linear.app/openboa/document/00-start-here-ouroboros-documentation-index-953f443725df
- 01 Product Strategy - Thesis, Market, Metrics: https://linear.app/openboa/document/01-product-strategy-thesis-market-metrics-0b56a519c964
- 02 MLP-01 Brief - Scope, JTBD, Cutline: https://linear.app/openboa/document/02-mlp-01-brief-scope-jtbd-cutline-b64af14949a6
- 03 MLP-01 Release Plan - Milestones and Slices: https://linear.app/openboa/document/03-mlp-01-release-plan-milestones-and-slices-d3d83c35f208
- 04 Execution Ledger - Active Frontier and Handoff: https://linear.app/openboa/document/04-execution-ledger-active-frontier-and-handoff-9e036cf84011
- 05 Project Ledger - Frontier State and Run Packet: https://linear.app/openboa/document/05-project-ledger-frontier-state-and-run-packet-e3d192eb65b8
- 10 Product Archive - Strategy Through Implementation: https://linear.app/openboa/document/10-product-archive-strategy-through-implementation-70e5394b89d5
- 11 Product Archive - MLP-01 PRDs and Slice Details: https://linear.app/openboa/document/11-product-archive-mlp-01-prds-and-slice-details-3985937ee6fe
- 20 Architecture Baseline - System Map and Runtime Model: https://linear.app/openboa/document/20-architecture-baseline-system-map-and-runtime-model-ff4804a6d25c
- 21 Architecture Baseline - Agent, Control, Evaluation: https://linear.app/openboa/document/21-architecture-baseline-agent-control-evaluation-41c1aaff0f8f
- 22 Architecture Baseline - Foundation and Trading Substrate: https://linear.app/openboa/document/22-architecture-baseline-foundation-and-trading-substrate-31ac0895169f
- 23 Architecture Decisions - ADRs: https://linear.app/openboa/document/23-architecture-decisions-adrs-b516f7432828
- 24 Architecture Contracts - Core Through Evidence: https://linear.app/openboa/document/24-architecture-contracts-core-through-evidence-d18b7d17d45d
- 25 Architecture Contracts - Promotion Through Substrate: https://linear.app/openboa/document/25-architecture-contracts-promotion-through-substrate-e71a72691597
- 26 Architecture Contracts - Index and Remaining Specs: https://linear.app/openboa/document/26-architecture-contracts-index-and-remaining-specs-6136fc24c533
- 30 Source Library - Agent Runtime References A: https://linear.app/openboa/document/30-source-library-agent-runtime-references-a-ee27d978c9c0
- 31 Source Library - OpenAI and Repository References B: https://linear.app/openboa/document/31-source-library-openai-and-repository-references-b-cff64c66b612
- 32 Source Library - Repository and URL Notes C: https://linear.app/openboa/document/32-source-library-repository-and-url-notes-c-533606a3d39f
- 33 Source Library - OpenAI URL Notes D: https://linear.app/openboa/document/33-source-library-openai-url-notes-d-0592a84e24e6
- 34 Source Library - Google and Synthesis Inputs E: https://linear.app/openboa/document/34-source-library-google-and-synthesis-inputs-e-22de8a782cae
- 35 Source Synthesis - Runtime, Evaluation, Product Postures: https://linear.app/openboa/document/35-source-synthesis-runtime-evaluation-product-postures-fd857d802e22
- 37 Source Addendum - Trading Taxonomy References: https://linear.app/openboa/document/37-source-addendum-trading-taxonomy-references-33f2442f6588
- 38 Source Addendum - AlphaProof Nexus and Candidate Arena References: https://linear.app/openboa/document/38-source-addendum-alphaproof-nexus-and-candidate-arena-references-fa78e56e2ad2
- 40 Agent Operating Guide - Repo Harness and Skills: https://linear.app/openboa/document/40-agent-operating-guide-repo-harness-and-skills-7b1d4d884739
- 50 Service Docs - Runtime, Operator, Policies: https://linear.app/openboa/document/50-service-docs-runtime-operator-policies-578ec402e4d8
- 90-95 Architecture Archive documents: listed in the Documentation Index
- 99 Migration Source Map - Legacy Root Navigation: https://linear.app/openboa/document/99-migration-source-map-legacy-root-navigation-f5e8229e5e4d

## Update Rule

Update repo docs, code, tests, and validation first for durable product, architecture, source,
service, naming, or operating changes. Update Linear only when the task needs issue progress,
scratchpad notes, project coordination, or historical status.

Use the `linear` skill for Linear-related work and execute the selected operation through the
bundled Linear OAuth Connector. Read the Project, milestone, issue, comments, or document before
writing. Keep one issue comment headed `## Codex Workpad`, update it rather than creating duplicate
progress comments, and report the exact Linear identifiers changed.

Do not use a repo-local `LINEAR_API_KEY`, raw GraphQL command, or local `.env` credential path. If
the OAuth Connector is unavailable, leave workflow writeback blocked with exact evidence instead of
treating Linear or chat memory as a replacement for repo truth.
