---
name: pr-ci-review-loop
description: "Use when a branch or pull request must be published, watched through local validation, GitHub CI, CodeQL, Codex or human review comments, bounded fixes, repeat pushes, and final merge only after explicit landing authority."
---

# PR CI Review Loop

## Role

`pr-ci-review-loop` conducts the full PR landing loop. It does not own product design or broad
implementation; it keeps one branch moving through validation, review, bounded fixes, and merge.

## Workflow

1. Recover the current branch, dirty state, upstream, PR number or URL, and latest commit hash.
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
7. Inspect current-head review comments, inline comments, CodeQL/GitHub Advanced Security alerts,
   and human comments. Treat old-head comments as historical unless they still apply to the latest
   diff.
8. For actionable current-head comments, route a bounded patch through `auto-coding`, rerun local
   validation, commit, push, and restart the CI/review loop from the new head.
9. Continue until current-head CI is green, current-head review freshness is satisfied, actionable
   current-head comments are handled or explicitly rerouted, and mergeability is clean.
10. Merge only when the user has explicitly granted landing authority with wording such as "merge if
   clean" or "merge when there are no issues".
11. Prefer `gh pr merge --squash --delete-branch`. If local worktree state blocks the command,
    verify whether the remote PR merged anyway, then separately handle branch cleanup and report the
    exact final state.

## Review Freshness Gate

- Read `headRefOid` and PR number with `gh pr view --json number,headRefOid,reviews,comments`.
- Read inline comments by interpolating the actual PR number:
  `gh api repos/{owner}/{repo}/pulls/<pr-number>/comments --paginate`.
- Treat review as current only when the review commit or comment `commit_id` matches `headRefOid`.
- Treat "no current-head review yet" as pending, not clean. Keep polling or reroute to
  `auto-promotion-protocol`; do not merge merely because CI is green and comments are momentarily
  empty.

## Required Output

- goal
- branch, PR URL, and latest head commit
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
`auto-promotion-protocol` for final readiness judgment when landing authority is absent or unclear.
If the loop outcome changes durable workflow or release state, set `writeback_needed: yes` and route
to the repo's durable writeback skill.

## Hard Boundaries

- Do not merge without explicit landing authority.
- Do not trust stale CI, stale review, or comments from an older head as current promotion evidence.
- Do not merge immediately after CI turns green when expected automated review has not reported on
  the current head yet.
- Do not broaden the implementation scope while fixing CI or review comments.
- Do not hide failing checks, pending reviews, merge conflicts, or unavailable permissions.
- Do not treat an opened PR as sufficient evidence; current-head checks and review status must be
  evaluated.
