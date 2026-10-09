# Base-owned trusted baseline caller

Proposed source follow-up to `spec.md`. The original additive caller ran from
candidate-owned pull-request workflow content. Replace only that new caller job
with a separate `.github/workflows/trusted-baseline.yml` wrapper loaded from the
base branch on `pull_request_target`; also run it for main pushes. The wrapper
contains only read-only contents permission, bounded concurrency and one pinned
reusable call, with no inputs, inherited secrets or executable steps.

The shared revision must be the final independently reviewed commit of central
PR #24. Record the exact SHA in the wrapper and verification record after it is
available. The original `ci.yml` baseline, its manual-dispatch behavior, required
checks and native code-owner review remain unchanged.

The trusted lane supports branches within the same repository only. The shared
workflow verifies repository IDs/names, exact head/base and the base PR ref. It
rejects forks before checkout and retains checkout's default fork protection.
It inspects workflow text and source as data with trusted tools; it executes no
product code. Local action metadata is outside this hygiene lane's validation.

## Bootstrap and acceptance

The new target wrapper does not exist on main yet, so this bootstrap PR cannot
prove target-event execution. Before delivery, lint both workflows, verify that
the old required baseline is byte-for-byte unchanged, independently review the
wrapper and complete fresh Code Review/Security Review and existing required CI.
Central PR delivery and native current-head code-owner approval remain required.

After normal protected merge, verify the main-push run and a subsequent
qualification PR. Bind its real workflow ID/path, event, exact head/base,
referenced common SHA and successful job before enrolling a new required check.
Retain the old required check. Applicable Actions event policy is a separate
qualification condition; do not change it or opt out here. A prior
candidate-owned PR run does not establish this new producer's provenance.

This changes no product requirements, deployment, credentials, merge policy or
automatic development activation. Model review cannot substitute for native
code-owner approval or unobserved integration evidence.
