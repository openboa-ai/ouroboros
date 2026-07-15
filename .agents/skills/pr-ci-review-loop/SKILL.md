---
name: pr-ci-review-loop
description: "Use when a branch or pull request must be published, watched through local validation, GitHub CI, CodeQL, Codex or human review comments, bounded fixes, repeat pushes, and final merge when the current-head validation contract is clean."
---

# PR CI Review Loop

## Role

`pr-ci-review-loop` conducts the full PR landing loop. It does not own product design or broad
implementation; it keeps one branch moving through validation, review, bounded fixes, and merge.

## Workflow

1. Recover the control checkout, dedicated issue worktree, writer lease, base, current branch,
   dirty state, upstream, PR number or URL, and latest commit hash.
2. If no PR exists, run the repo's required local checks, commit intentional changes, push the
   branch, and open a ready PR.
3. If a PR exists, confirm the current local head matches the PR head before trusting CI or review
   evidence.
4. Watch current-head CI with `gh pr checks --watch` or equivalent `gh` check queries until every
   required check is complete.
5. Inspect failing checks through `ci-recovery`; fix only in-scope failures, rerun the narrowest
   relevant local validation, commit, push, and restart the loop from the new head.
6. After CI is green, wait for a current-head review freshness signal before merging. Poll PR
   reviews and inline comments until the configured automated reviewer or a human reviewer has
   reviewed the latest commit, or until an explicit user-approved timeout is reached.
7. If the latest review remains stale after CI and an initial wait, request a fresh automated review
   with the repo's configured review trigger such as `@codex review`, then keep polling the new head.
8. Inspect current-head review comments, inline comments, CodeQL/GitHub Advanced Security alerts,
   and human comments. Treat old-head comments as historical unless they still apply to the latest
   diff.
9. For actionable current-head comments, route a bounded patch through `auto-coding`, rerun local
   validation, commit, push, and restart the CI/review loop from the new head.
10. Continue until current-head CI is green, current-head review freshness is satisfied, actionable
   current-head comments are handled or explicitly rerouted, and mergeability is clean.
11. Treat a PR landing-loop request as merge authority once the validation contract below is fully
   satisfied. Do not ask for a second merge confirmation unless the validation contract is ambiguous.
12. Merge from the active issue worktree with a remote-scoped command such as
    `gh pr merge <number> --repo <owner/repo> --squash`, then verify the remote merge commit and
    reviewed-head tree. Do not use `--delete-branch` while the issue worktree or lease is active;
    local checkout mutation is not part of landing.
13. After remote merge, write back and read back both the merge evidence and `released` writer-lease
    state. From the control checkout, verify the worktree is clean and inactive, remove it, then
    delete local and remote branches as appropriate. Leave cleanup pending when readback,
    cleanliness, or lease state is incomplete.

## Validation Contract

- Local validation must cover the repo-required checks for the change type, or record why a broader
  check is unnecessary.
- Remote CI must be tied to the current `headRefOid`; every required check must be complete and
  successful. Pending, failing, missing, cancelled, or unexplained neutral checks block merge.
- CodeQL, security scanning, repository guards, and naming/docs/env/secrets gates must be reported
  explicitly when present.
- Current-head review freshness must be satisfied, and actionable current-head comments must be
  fixed, intentionally rerouted, or explicitly marked non-blocking with evidence.
- `mergeable` must be `MERGEABLE` and `mergeStateStatus` must be `CLEAN` or the repository's
  equivalent clean state.
- The PR head, recorded issue worktree branch, base, and active writer lease must identify the same
  frontier before landing. Cleanup evidence is collected separately after remote merge.

## Review Freshness Gate

- Read `headRefOid` and PR number with `gh pr view --json number,headRefOid,reviews,comments`.
- Read inline comments by interpolating the actual PR number:
  `gh api repos/{owner}/{repo}/pulls/<pr-number>/comments --paginate`.
- Treat review as current only when the review commit or comment `commit_id` matches `headRefOid`.
- If a fresh automated review was requested with `@codex review`, record the requested `headRefOid`;
  a later top-level reviewer response counts as current only if the PR head still equals that
  requested head.
- Treat "no current-head review yet" as pending, not clean. If the review is stale after the initial
  wait, request a fresh automated review and keep polling. If review remains unavailable, reroute to
  `auto-promotion-protocol`; do not merge merely because CI is green and comments are momentarily
  empty.

## Required Output

- goal
- branch, PR URL, and latest head commit
- control checkout, issue worktree, base, writer lease, and cleanup state
- local validation commands and results
- latest CI status tied to the current head
- review freshness signal and latest review/comment status tied to the current head
- fixes made, commits pushed, or reroute decisions
- merge status and merge commit when merged
- branch cleanup status
- remaining risks
- next owner
- `writeback_needed`

## Handoff

Use `ci-recovery` for failing check evidence, `auto-coding` for bounded patches, and
`auto-promotion-protocol` when the validation contract is ambiguous or a non-blocking exception
needs an explicit readiness judgment.
If the loop outcome changes durable workflow or release state, set `writeback_needed: yes` and route
to the repo's durable writeback skill.

## Hard Boundaries

- Do not merge unless the current-head validation contract is fully satisfied.
- Do not trust stale CI, stale review, or comments from an older head as current promotion evidence.
- Do not merge immediately after CI turns green when expected automated review has not reported on
  the current head yet.
- Do not let merge-time branch deletion switch, detach, or rewrite an active issue worktree.
- Do not remove a dirty, active, leased, or not-yet-written-back worktree automatically.
- Do not broaden the implementation scope while fixing CI or review comments.
- Do not hide failing checks, pending reviews, merge conflicts, or unavailable permissions.
- Do not treat an opened PR as sufficient evidence; current-head checks and review status must be
  evaluated.
