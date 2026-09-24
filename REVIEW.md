# Reviewing Ouroboros changes

Use the [Rust quality contract](docs/engineering/rust-quality/spec.md), affected component design
and [delivery contract](.github/README.md). Scope the review to actual effects and dependencies;
a passing build does not establish authority, recovery, native UI behavior or live operation.

For Rust and boundary changes, verify:

- The root and independent Mac workspace are covered, with inherited toolchain/lints and both
  lockfiles audited. Required, ignored and feature-gated tests have actual execution evidence.
- External SQL/JSON/IPC data is decoded fallibly and validated before it becomes authoritative.
  Size, count, deadline and output bounds hold on both successful and malformed input paths.
- Error types preserve actionable recovery meaning; public errors and CI artifacts expose no
  credentials, personal paths, private prompts or application state.
- Async calls do not retain blocking locks. Cancellation, lost responses and process crashes
  preserve the original request identity and unresolved obligations until independently closed.
- Every unsafe block documents pointer validity, initialization, descriptor ownership and
  concurrency. A new owner is created exactly once; cleanup cannot target unrelated resources.
- Authority decisions stay with their owning component. Refactoring does not introduce a
  second source of truth or a fallback that treats missing evidence as success.
- Regressions are tested through observable contracts. Changed oracles include negative cases
  and cannot bypass a missing environment, zero-test execution, stale build or failed cleanup.

Review a changed test/oracle independently from the candidate's own success claim. Human
code-owner approval is still required on protected paths; agents do not approve on behalf of
reviewers. Record unresolved findings and required NOT RUN cases in the PR until resolved.
