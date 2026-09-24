# GitHub delivery contract

GitHub Rulesets own main admission; GitHub auto-merge performs the eventual squash merge.
Actions supply test and security evidence. There is no independent merge decision service.

## Required evidence

The main ruleset requires `repository-integrity`, `scan`, `analyze-actions`, `analyze-rust`,
`analyze-python`, `dependency-review`, and `behavior-gate`, bound to GitHub Actions. CodeQL merge
protection separately rejects security alerts at High or Critical and alerts at Error severity.
A successful analysis job alone does not prove that its findings satisfy this policy.

Every PR runs the planner and final behavior gate. Documentation selects integrity checks;
implementation selects affected responsibilities and consumers. Shared inputs, migrations,
workflow/selector changes and unclassified paths expand to full checks. Main, weekly and manual
runs select full synthetic regression. Missing, failed, cancelled or required NOT RUN results
cannot pass. Local and hosted execution use the same plan/run/report contracts.

Linux native cases require a disposable Ubuntu ARM64 VM with the real kernel/daemon prerequisites.
The independent Mac workspace, frontend and real Gateway/Catalog client fixture are required
selected cases in `behavior-gate`. Root Rust validation also runs on Mac; neither establishes Linux isolation. Test fixtures never adopt
account credentials, company state, or a developer's VM. Actual provider calls remain separate.

The [Rust quality contract](../docs/engineering/rust-quality/spec.md) defines workspace coverage,
test accounting, inherited lints and fresh vulnerability audits for both lockfiles.

## Review and merge

PR delivery is the Deploy stage of the [development lifecycle](../docs/DEVELOPMENT.md), not the
whole lifecycle. Intent and design precede dependent implementation; verified delivery and
authorized observation feed subsequent work. A small change may keep its decisions and evidence
in the PR rather than creating three separate planning documents.

The main ruleset requires current-base checks, resolved conversations, and code-owner approval for
paths listed in the root CODEOWNERS file. General approval count is zero after the transition.
`@SonSangjoon` is the technical reviewer, not a replacement for the sovereign designated by
SOVEREIGN.md. A review/merge does not amend doctrine or authorize operation. Candidate changes do
not approve themselves. Changing protected code's old path during a move also requires review.
The file and all higher-priority CODEOWNERS locations are protected against replacement.

GitHub evaluates CODEOWNERS from the base branch. During PR #265's transition, the general approval
count stays at one until the new file is present and valid on main. Then it becomes zero while
required code-owner review remains enabled. No bypass actor is installed for the transition.
The human reviewer submits the actual GitHub review; an agent must not submit it on their behalf.

Auto-merge is enabled per PR after its scope is accepted. The repository setting alone does not
schedule every PR. The existing Dependabot Actions minor/patch helper only requests this native
feature; all reviews and checks still apply. Cargo updates require an explicit merge reservation.
GitHub deletes merged head branches; main is never a cleanup target.

### Approval-ready checkpoint

The delivery agent continues the authorized repair loop through review findings, local checks,
push, and hosted verification. Do not hand work back merely because a workflow was dispatched,
an analysis job succeeded, or one blocker requires human approval. Finish independent repairable
work first, then request the actual human review on the final head.

Before reporting that only approval remains, read back current GitHub state and verify:

- The final head incorporates the current base, has no conflicts, and every required check from
  the active ruleset has completed successfully on the current revision. Missing, pending,
  cancelled, stale, or failed evidence is not a pass.
- Code-scanning findings meet the active ruleset and every review conversation is resolved.
  Inspect bot comments as well as human comments: a warning can leave a conversation unresolved
  even when the CodeQL job and security threshold pass. Resolve a finding's thread only after
  verifying the fix; outdated placement alone does not establish resolution. Do not bulk-dismiss
  alerts, suppress checks, or resolve an objection whose acceptance requires its reviewer.
- Auto-merge is reserved for the intended PR when delivery has been authorized, and the only
  remaining rule is the actual required human approval. The repository-level setting and a
  skipped Dependabot helper do not establish a per-PR reservation.

If the head or base changes, reconcile the new revision, rerun affected validation and repeat
this checkpoint before requesting approval. New commits can dismiss earlier approvals. Record
the exact head, current-base CI evidence, unresolved-thread count and auto-merge state in the PR
handoff. Stop at a real authority boundary or a demonstrated external blocker, describe it
precisely, and finish any independent work that remains possible. Human review is never supplied
by the delivery agent, and this loop does not grant Actions permission to edit or approve PRs.

## Permissions and dependency updates

Actions are limited to GitHub-owned actions and `dependabot/fetch-metadata`; complete SHA pinning
is enforced by repository policy. External contributors require workflow execution approval.
The default token is read-only and cannot approve PRs. Candidate-executing jobs have no operating
secrets. Privileged metadata-only jobs never check out or execute PR code.

Dependabot manages Actions, both Cargo workspaces and Mac npm weekly, with up to three version-update PRs per ecosystem
and grouped minor/patch updates. Security updates are enabled. Dependency Review blocks new
High/Critical vulnerable dependencies without inventing a license allowlist. Secret scanning,
push protection and private vulnerability reporting remain enabled.

## Artifacts and diagnostics

After delivery, preserve actionable regressions and repeated findings in the relevant PR with
the affected revision, observed result and next intended outcome. Update a narrow test or guidance
source when evidence justifies it. Monitoring and rollback require their own existing scope and
authority; a successful pipeline does not install a watcher or authorize production action.

Intermediate build transport expires after seven days; reports, installation candidates and
workflow logs after thirty days. Cache entries contain only dependencies/compiled outputs and
are never accepted as proof of testing. OS, architecture, lockfile and toolchain separate caches.

Job summaries expose selected case IDs, source/plan identifiers, status and duration. Failures
expose bounded test identifiers and command index, not private log contents, assertion values,
credentials or host bindings. The authoritative structured reports remain downloadable artifacts.

The main-only attestation job consumes the current successful run's installation candidate and
uses GitHub Artifact Attestations to bind its bytes to build provenance. It does not execute the
archive. PR candidates are not main release artifacts. No automatic deployment, GitHub Release,
package publication, real provider invocation or paid runner is part of this pipeline.
