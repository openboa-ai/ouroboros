# Additive reusable baseline CI

Product planning remains pending. This change only connects repository hygiene
checks to an immutable shared workflow. The existing required Repository baseline
job, read-only permissions, branch protection and code-owner policy remain intact.

Add a caller job named `trusted-baseline` to Repository CI for pull requests and
main pushes. It invokes the reviewed OpenBoa repository-baseline workflow at full
SHA `b5df6ff3dbdf210ed9de5acb92a91e93c99d706c` without inputs or inherited secrets.
The shared workflow checks event commits, workflow syntax, whitespace and secrets;
it never executes product code. Manual dispatch retains the original baseline and
does not call the event-bound shared workflow.

Acceptance: workflow lint and existing baseline pass; the additional actual PR
run exposes the expected immutable referenced workflow and successful job for the
current head/base. Verify the job name before enrolling it as a required check.
Both checks must remain required once the new one is enrolled. New commits need
fresh CI and review. This does not add product validation, deployment, automatic
merge authorization or new credentials.

Delivery requires the shared workflow's central PR to be accepted and merged,
this repository's required code-owner review, and current CI. A draft caller may
exercise the immutable revision before delivery; the protected main is unchanged.
