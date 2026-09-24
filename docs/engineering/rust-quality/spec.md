# Rust quality contract

This is the common engineering contract for the root Rust workspace and the independent
Mac Tauri workspace. It preserves the product authority and recovery contracts; it grants
no deployment, account, provider-call or financial authority. The delivery PR records
review, current-source verification and adoption of this engineering change.

## Coverage and toolchain

The executable inventory is [rust_quality.toml](../../../tests/support/rust_quality.toml).
`rust.policy` checks every versioned or prospective Cargo manifest and lockfile against that
inventory, including package membership, inherited minimum Rust version and required lints.
An added workspace, lockfile, nested toolchain or unregistered ignored test fails closed.
All packages inherit their own workspace policy. The Mac workspace is independent: a root
Cargo command does not cover it.

| Workspace | Required execution | Additional execution |
| --- | --- | --- |
| Root `Cargo.toml` | `rust.invariants` on Linux | The same invariant suite on macOS |
| `apps/mac/src-tauri/Cargo.toml` | `mac.rust` on macOS | `mac.frontend` and real client `mac.gateway` |
| Both lockfiles | `rust.dependencies` against a freshly fetched RustSec database | Dependency Review on pull requests |

[rust-toolchain.toml](../../../rust-toolchain.toml) pins Rust 1.94.1, rustfmt and Clippy.
CI and guest preparation must use the same version; the runner checks the effective `cargo`
and `rustc` versions. Updates change both workspaces and the inventory in one reviewed PR.
The declared version is a supported build baseline, not a claim that older Rust was tested.

## Required checks

For each workspace, [rust_suite.py](../../../tests/support/rust_suite.py) requires:

1. `cargo fmt --all --check`.
2. `cargo clippy --workspace --all-targets --all-features --locked --offline -- -D warnings`.
3. Compile the default-feature test targets and obtain executable identities from the current
   Cargo JSON output. List each harness and its ignored tests, then run the complete harness.
4. Match discovered and executed counts. A missing executable, zero total executed tests,
   unexpected ignored test, filtering, failed test or incomplete summary cannot pass.
5. Run library doctests where Cargo declares them, and build workspace binaries with the same
   locked dependency graph. PostgreSQL feature tests run in their owning disposable DB lanes.

Explicit target directories and manifest paths apply to these commands. Cached binaries are
never selected by filesystem glob. Results record tool versions, harness/test counts,
ignored-test execution scenarios and step durations. Caches accelerate builds; they provide
no verification evidence.

The common inherited deny lints are `unused_must_use`, `unsafe_op_in_unsafe_fn`,
`clippy::await_holding_lock` and `clippy::undocumented_unsafe_blocks`. Every unsafe block needs
a local safety argument identifying memory validity, ownership, lifetime and concurrency as
applicable. A syscall's intended business effect is not its memory-safety argument. A
synchronous guard must be released before awaiting; do not silence the lint to extend a lock.

These checks apply to existing code as well as new changes. Fix violations before enabling
or passing the gate. No broad crate-level suppression or baseline allowlist is used. A future
exception requires a protected, narrowly scoped, expiring decision with a reason, owner,
compensating verification and removal condition; it cannot silently change this contract.

## Tests that require an environment

Ignored tests are a recorded execution obligation, never a successful skip:

| Test | Required scenario and actual environment |
| --- | --- |
| `descriptor_packet_preserves_handles_and_rejects_unbacked_input` | `native.kernel-contracts`, root in the disposable Linux kernel fixture |
| `observes_real_gateway_and_exact_catalog_bytes` | `mac.gateway`, native Rust client plus fresh local mTLS Core/Gateway/Catalog and PostgreSQL |

Feature-gated Core PostgreSQL tests belong to `core.transactions`; Resources PostgreSQL tests
belong to `resources.receipts`. Their manifests, feature names and scenarios are inventoried.
All features compile under Clippy, and the owning lanes execute their tests against real,
explicitly bound disposable databases. Linux containment claims require actual Linux; a Mac
unit test is not containment evidence. The Mac connection case publishes a synthetic document
and checks the exact bytes/revision through the real Rust client. It makes zero provider calls
and is not evidence of a native window interaction.

The Mac fixture injects synthetic database credentials and TLS private keys through explicitly
selected child environment variables. It verifies absence of persisted secret values and removes
its owned private material after verified shutdown. Missing or ambiguous environment bindings
must fail before connection; values must not appear in errors, command arguments or reports.

`mac.frontend` runs unit tests, lint, type/build checks, the Company SDK build and distribution
boundary checks. All selected Mac results join the same `behavior-gate` as Linux and DB results.
The aggregate still rejects missing, duplicate, stale, failed, cancelled and required `NOT RUN`
results. A job being green or skipped is insufficient without its selected case receipts.

## Dependencies and source integrity

`rust.dependencies` audits every inventoried lockfile with pinned cargo-audit 0.22.2. Each run
fetches a new RustSec database and records its commit. All reported vulnerabilities fail the
check regardless of severity. Unmaintained/unsound/notice warnings are retained for review;
they are not represented as fixed or as vulnerabilities. Network/database/auditor failures
cannot be converted to a clean audit. No advisory is ignored by this policy.

Dependency Review remains an independent required check. Dependabot covers both Cargo roots,
Mac npm and Actions. A security update must pass the same relevant behavior checks, with its
actual lockfile diff reviewed. Documentation integrity includes nested Markdown files; local
research and screenshots remain outside the source graph and cannot be required relative links.

## Review responsibilities

Automation is a floor. [REVIEW.md](../../../REVIEW.md) gives the change-specific review questions.
For changed trust boundaries, use fallible SQL/JSON decoding, typed validation and bounded
parsing so malformed external state yields a controlled error rather than a process panic.
A deliberate invariant assertion needs its provenance and failure behavior explained.

Errors must retain enough internal context for recovery while keeping secrets out of public
responses and CI summaries. Cancellation and process loss must preserve unresolved claims,
capacity and effect receipts until actual closure is established. Resource ownership must be
explicit across tasks, processes, descriptors and cleanup. Keep authority, transport, storage
and presentation responsibilities separate; split a large function where doing so clarifies
these boundaries, not to satisfy an arbitrary line-count rule.

These are review criteria for affected changes; this PR does not claim a repository-wide SQL
rewriting or cancellation redesign. The enforced baseline is the complete workspace/test/lint/
audit inventory above, together with the existing behavioral oracles and human code-owner review.

## References

- [Cargo workspace inheritance](https://doc.rust-lang.org/cargo/reference/workspaces.html)
- [Clippy lint reference](https://rust-lang.github.io/rust-clippy/stable/index.html)
- [RustSec cargo-audit](https://github.com/rustsec/rustsec/tree/main/cargo-audit)
- [Testing Ouroboros](../../../tests/README.md)
- [GitHub delivery contract](../../../.github/README.md)
