# Trusted repository baseline CI

Product planning and implementation remain pending. This specification describes
repository infrastructure only; it does not define product acceptance criteria.
The documentation reconciliation changes this specification and its README entry
point to reflect the accepted, installed workflow. It changes no workflow, policy,
permission, deployment, product requirement or automatic-development setting.

## Installed checks

R1. Keep `.github/workflows/ci.yml` and its required `Repository baseline` job
unchanged. Its existing pull-request, main-push and manual-dispatch behavior remains.

R2. The separate `.github/workflows/trusted-baseline.yml` wrapper runs for main
pushes and `pull_request_target` against main (opened, synchronize, reopened,
edited). Its only job, `trusted-baseline`, calls
`openboa-ai/.github/.github/workflows/repository-baseline.yml` at immutable revision
`83967987ca23cc8b8eda60975eda320e434fb7bd`. It has read-only contents permission,
bounded concurrency, no inputs, no inherited secrets and no executable steps.
The PR event loads the wrapper from the base branch. Manual dispatch remains in
the original workflow and does not run this separate wrapper.

R3. The shared check supports branches within the same repository. It verifies
repository identity and event head/base, reads the base repository PR ref and
inspects workflow text, whitespace and secrets with fixed trusted tools. It never
executes product code. Fork PRs, local action metadata and product behavior are
outside this check's supported scope.

## Evidence and delivery

R4. Keep existing required checks and protected-path code-owner review. Before
adding the trusted check as required, observe an actual base-owned target-PR run
and the main-push run, and verify workflow ID/path/event, head/base, referenced
common revision and successful jobs. Confirm applicable Actions event policy.
A green label or candidate-generated result is not producer qualification.
Changed commits require fresh affected validation and review; missing, cancelled
or failed results are not success. Model reviews do not replace required native
code-owner approval.

The original bootstrap delivery and review corrections remain in `acceptance.md`
and `review-remediation-addendum.md` as historical records. The wrapper is now on
main, so subsequent PRs can establish actual target-event evidence. This document
does not claim that enrollment, host installation or automatic operation is done.

For this documentation change, independently compare R1-R4 with the accepted
addendum and actual workflow bytes, confirm only documentation changed, run the
existing and trusted PR checks, inspect Code Review and Security Review, and
verify main-push checks after merge. Reconcile failed or missing checks before
retrying. Product work begins only after its own scoped specification is agreed.
