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
Mac validation is supplemental; it does not establish Linux isolation. Test fixtures never adopt
account credentials, company state, or a developer's VM. Actual provider calls remain separate.

## Review and merge

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

## Permissions and dependency updates

Actions are limited to GitHub-owned actions and `dependabot/fetch-metadata`; complete SHA pinning
is enforced by repository policy. External contributors require workflow execution approval.
The default token is read-only and cannot approve PRs. Candidate-executing jobs have no operating
secrets. Privileged metadata-only jobs never check out or execute PR code.

Dependabot manages Actions and Cargo weekly, with up to three version-update PRs per ecosystem
and grouped minor/patch updates. Security updates are enabled. Dependency Review blocks new
High/Critical vulnerable dependencies without inventing a license allowlist. Secret scanning,
push protection and private vulnerability reporting remain enabled.

## Artifacts and diagnostics

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
