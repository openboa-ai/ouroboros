# Repository Delivery Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. In this repository, use executing-plans for writes because project-scoped subagents remain read-only. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish and verify an autonomous, bounded Repository Delivery Loop without coupling it
to the Ouroboros CandidateArena product system.

**Architecture:** Linear owns goal hierarchy, priority, dependencies, WIP, and handoffs. GitHub owns
repository truth, diff, CI, review, latest-base integration, and merge evidence. Codex executes one
frontier through repo-owned policy, skills, isolated worktrees, connectors, hooks, goal mode,
scheduled tasks, and independent review; each run recovers external state before acting.

**Tech Stack:** Markdown policy, Linear OAuth Connector, GitHub pull requests/Actions/rulesets/merge
queue, Codex `AGENTS.md`/skills/goals/scheduled tasks/worktrees/subagents/hooks.

## Global Constraints

- Product and delivery systems share no runtime code, schema, persisted state, credentials, or authority.
- One executable Linear issue maps to one branch and one pull request.
- Every frontier is independently reviewable, revertible, and evidence-backed.
- Linear is coordination; GitHub `main` is durable truth.
- Automated runs use least privilege, explicit time/attempt/no-progress bounds, and truthful stops.
- Product strategy, model, tool, and research workflow remain open-ended.

---

### Task 1: OURO-168 - Lock The System Boundary And Operating Model

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/development-workflow.md`
- Create: `docs/superpowers/plans/2026-07-15-repository-delivery-loop.md`

**Interfaces:**
- Consumes: merged FLOW-01 contract on stacked base `ed4681baf7f27dedf84649f952aade63df376ae2`
- Produces: canonical boundary, capability ownership, trigger modes, evaluator, budgets, stops, and this frontier order

- [x] Add the compact always-on product/delivery boundary to `AGENTS.md`.
- [x] Add the two-system architecture, approach comparison, capability map, and goal/time/proactive
  modes to `docs/development-workflow.md`.
- [x] Run `bash scripts/check-docs.sh`, `npm run check:architecture`, `npm run check:naming`,
  `bash scripts/check-env-files.sh --tracked`, `bash scripts/check-secrets.sh`, and
  `git diff --check`; expect every command to exit `0`.
- [ ] Commit, push, open one PR against `codex/arena-p0-sealed-preflight`, wait for CI/current-head
  review, resolve actionable findings, and merge only with explicit authority.

### Task 2: OURO-166 - Align Generic Skills And Retire Linear GraphQL

**Files:**
- Modify: `.agents/skills/AGENTS.md`
- Modify: `.agents/skills/auto-project/SKILL.md`
- Modify: `.agents/skills/auto-pm/SKILL.md`
- Modify: `.agents/skills/auto-coding/SKILL.md`
- Modify: `.agents/skills/llm-wiki/SKILL.md`
- Modify: `package.json`
- Delete: `.agents/skills/linear-graphql/SKILL.md`
- Delete: `.agents/skills/linear-graphql/scripts/lib/linear-graphql-client.mjs`
- Delete: `.agents/skills/linear-graphql/scripts/linear-graphql.mjs`
- Delete: `.agents/skills/linear-graphql/scripts/linear-workpad.mjs`
- Delete: `apps/runtime/test/linear-graphql-scripts.test.ts`

**Interfaces:**
- Consumes: OURO-168 boundary and the installed Linear OAuth Connector
- Produces: one generic frontier/handoff packet and no active local API-key/GraphQL route

- [ ] Update generic skill routing and handoff fields without adding product-specific nouns under `.agents`.
- [ ] Remove the obsolete GraphQL skill, scripts, package commands, and their obsolete execution tests.
- [ ] Run the harness skill audit, repo guards, `npm test`, and `git diff --check`; expect all checks to pass.
- [ ] Deliver one OURO-166 PR and retain OAuth Connector read/write evidence in its Workpad.

### Task 3: OURO-169 - Add Repository Delivery Orchestration Skill

**Files:**
- Create: `.agents/skills/repository-delivery-loop/SKILL.md`
- Create: `.agents/skills/repository-delivery-loop/pressure-scenarios.md`
- Modify: `.agents/skills/AGENTS.md`

**Interfaces:**
- Consumes: OURO-166 generic packet and the canonical trigger/stop contract
- Produces: one procedure for goal, time, and proactive activations

- [ ] Run baseline pressure scenarios where a worker widens scope, self-grades, trusts a stale event,
  overlaps writers, or calls product runtime; record the violations.
- [ ] Write the smallest skill that prevents those observed violations and routes to existing PM,
  coding, QA, CI, promotion, and writeback skills.
- [ ] Rerun every pressure scenario and require correct scope, evaluator, no-op, and terminal behavior.
- [ ] Run the harness skill audit and repo guards, then deliver one OURO-169 PR.

### Task 4: OURO-167 - Add Frontier Metadata And Scope Checks

**Files:**
- Create: `.github/pull_request_template.md`
- Create: `scripts/check-pr-frontier.mjs`
- Create: `apps/runtime/test/check-pr-frontier-script.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: one-issue/one-PR contract and OURO-169 trigger metadata
- Produces: deterministic PR identity/metadata validation and non-authoritative size warnings

- [ ] Write failing fixtures for missing/multiple issue IDs, missing frontier fields, and large scope
  without an atomicity rationale.
- [ ] Implement the validator so semantic metadata fails while file/line size only warns and requires rationale.
- [ ] Run focused tests, workflow syntax checks, repo guards, and one real PR check; deliver one OURO-167 PR.

### Task 5: OURO-170 - Enforce Review And Latest-Base Evidence

**Files And External Objects:**
- Create: `.github/CODEOWNERS`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/codeql.yml`
- Modify: `.github/workflows/gitleaks.yml`
- Update: GitHub ruleset `15718142`, merge queue, branch update, auto-merge, and branch cleanup settings

**Interfaces:**
- Consumes: OURO-167 required check names and PR metadata
- Produces: enforced current-head review, resolved threads, required checks, and latest-base integration

- [ ] Add `merge_group` coverage and CODEOWNERS with least-privilege workflow permissions.
- [ ] Record settings before mutation, enable only controls backed by passing workflows, then read them back.
- [ ] Run one representative merge-queue dry run and verify required checks execute on the merge group.
- [ ] Deliver the repo diff in one PR and record exact external settings evidence in OURO-170.

### Task 6: OURO-171 - Separate Linear Product And Delivery Programs

**Linear Objects:**
- Create: one product Initiative and one Repository Delivery enabling Project/milestone
- Move: OURO-165 through OURO-173 workflow issues and dependency relations to the delivery Project
- Update: product Project description, delivery Project description, ownership, and status-update cadence

**Interfaces:**
- Consumes: canonical source ownership and existing OAuth Connector identifiers
- Produces: separately reportable product and delivery programs linked only by explicit dependencies

- [ ] Read every target Project, milestone, issue, relation, assignee/delegate, cycle, and status update.
- [ ] Create the separated hierarchy through the OAuth Connector; use the Linear UI only for settings
  not exposed by the connector, then verify them through connector readback.
- [ ] Move workflow issues without changing product truth, preserve human accountability, and post one
  evidence-linked delivery Project update.
- [ ] Close OURO-171 with exact object IDs and no repository PR because this is Linear-only administration.

### Task 7: OURO-172 - Activate Scheduled And Event-Driven Reconciliation

**Codex, GitHub, And Linear Objects:**
- Create: active-PR heartbeat, daily frontier reconciler, and weekly project-health scheduled tasks
- Configure: trusted Linear assignment/dependency and GitHub PR/check/review/merge event paths
- Record: automation IDs, target project/worktree, cadence, permissions, concurrency, and last-run evidence

**Interfaces:**
- Consumes: OURO-169 skill, OURO-170 GitHub gates, and OURO-171 Linear hierarchy
- Produces: bounded time-based and proactive activation without a second planning system

- [ ] Run each exact prompt manually and require correct recovery, no-op, and permission behavior.
- [ ] Create schedules with non-overlap, elapsed/attempt/no-progress bounds, backoff, and narrow connectors.
- [ ] Trigger one failing-CI or review-comment recovery and one empty-queue no-op; verify external readback.
- [ ] Close OURO-172 with automation and event evidence; do not create a repo PR unless a repo-owned
  prompt or skill correction is required, in which case reroute that correction to a new issue.

### Task 8: OURO-173 - Verify Autonomy And Recovery

**Files And Evidence:**
- Create: `docs/repository-delivery-acceptance.md`
- Record: Linear, GitHub, and Codex evidence for the precommitted scenario matrix

**Interfaces:**
- Consumes: the complete Repository Delivery Loop
- Produces: an evidence-backed operational verdict and bounded remediation issues

- [ ] Precommit goal, time, proactive, restart, duplicate-trigger, stale-state, connector-outage,
  failed-CI, review, merge, empty-queue, budget, and no-progress scenarios.
- [ ] Run the matrix over representative docs and code frontiers without changing product authority.
- [ ] Create one bounded remediation issue for every failed scenario; never fix failures inside the
  verification frontier.
- [ ] Run repo guards and independent review, then mark the workflow operational only when every
  required scenario has direct evidence or an explicit blocked verdict.
