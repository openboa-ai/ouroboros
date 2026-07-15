# Development Workflow

Ouroboros delivers every repository change through a small, evidence-backed work item. The
workflow applies to product, runtime, UI, documentation, architecture, security, CI, and agent
operating changes. It constrains how repository changes are delivered; it must not constrain which
TradingSystem strategies, models, tools, or research workflows CandidateArena may explore.

## Source Ownership

| Surface | Owns | Does not own |
| --- | --- | --- |
| GitHub repository on `main` | Product and architecture truth, code, tests, validation, naming, API contracts, and workflow policy. | Transient priority, WIP, or handoff state. |
| Linear | Projects, milestones, PR-sized issues, dependencies, priority, WIP, comments, and handoffs that point to repo truth. | Product, architecture, runtime, or validation truth that conflicts with `main`. |
| GitHub pull request and CI | One implementation diff, review discussion, checks, and merge evidence. | Long-running program intent or unrelated follow-up work. |
| Codex task | Execution of one active frontier and its evidence collection. | Durable truth that exists only in chat memory. |

When the surfaces disagree, `main` wins for durable product and implementation facts. Update Linear
to point to the current repo path, commit, pull request, or validation result. Do not copy transient
Linear status into product code or treat a pull-request description as an architecture contract.

## Work Hierarchy

```text
Program goal
-> Linear Project
-> Linear milestone
-> PR-sized Linear issue
-> branch
-> pull request
-> checks and review
-> merge evidence and writeback
```

A Project may contain several long-running goals. A milestone groups multiple independently
mergeable frontiers. One executable repo issue maps to exactly one branch and one pull request.
Linear-only administration may close with exact Linear evidence, but any durable product, design,
process, or implementation decision must land in the repo.

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
| `Backlog` | Valid problem or opportunity exists. | Research, ordering, dependency discovery. |
| `Todo` | Frontier contract is complete, bounded, and unblocked. | Branch preparation and implementation start. |
| `In Progress` | One owner, branch, base commit, and workpad are recorded. | TDD implementation inside the owned boundary. |
| `In Review` | Pull request exists and local acceptance evidence is recorded. | CI, review, and fixes required by the same claim. |
| `Done` | Pull request merged, required checks and reviews passed, and writeback is complete. | Select the next ready frontier. |
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
- the PR is merged or explicitly parked with a named owner;
- durable repo truth is current;
- the Linear workpad records the final evidence and next frontier.

Long-running program goals remain open until every mapped requirement has direct evidence. A small
pull request closes one frontier, not the entire program that contains it.
