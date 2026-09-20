# Testing Ouroboros

Tests establish whether an implementation preserves its responsibility: current authority,
isolation, durable effects, continuity and accurate observation. Passing a synthetic test does
not authorize operation or prove actual subscription compatibility, profitability or production
readiness. Test location follows the scope of the behavior, not the language of the driver.

## Where tests belong

| Location | Responsibility |
| --- | --- |
| `contracts/` | API, CLI, resource, conversation and control behavior exercised through supported boundaries. These cases can require real PostgreSQL and processes. |
| `integration/` | Connected harness, Linux containment, provider-process and installed-service checks requiring their actual execution mechanisms. |
| `recovery/` | Backup, restoration, interrupted effects, checkpoint recovery and existing-storage checks. |
| `tooling/` | Deterministic tests of the selector, test drivers, build identity, fixture preparation and final CI gate. |
| `fixtures/` | Synthetic external services, private workload programs and network probes used only for validation. |
| `support/` | Shared fixture preparation/cleanup, scenario catalog, runners, source binding and CI report generation. |
| [`../crates/core/tests/`](../crates/core/tests/) and other crate `tests/` directories | Rust integration tests owned and discovered by their Cargo package. |
| A crate's `src/` under `#[cfg(test)]` | Small meaningful module invariants, such as ciphertext rejection or safe path handling. |
| [`../scripts/`](../scripts/) | Stable, thin user/CI entry points. Do not place new scenario implementations or fixture libraries here. |

Do not duplicate a case across these directories. Choose the directory for its primary purpose;
its catalog entry records all affected responsibilities and required environments. Recovery is
an explicit connected behavior even though it also uses integration mechanisms. Cargo package
tests stay with their package rather than requiring workspace-wide custom test-target wiring.

The mixed layout follows [Cargo's package layout](https://doc.rust-lang.org/cargo/guide/project-layout.html)
and [Rust's test organization](https://doc.rust-lang.org/book/ch11-03-test-organization.html).
The root system-test directories are an Ouroboros convention, not a Cargo discovery rule.

## Find a case and its requirements

Start with [`support/check_catalog.py`](support/check_catalog.py): it owns stable scenario IDs,
purpose, responsibilities, required execution lanes and change-impact selection. Native cases are
defined once in [`support/native_scenarios.py`](support/native_scenarios.py). The broader requirements
and acceptance cases remain in [architecture validation](../docs/architecture/VALIDATION.md).

A directory name is not a promise that a test is fast or dependency-free. For example,
`contracts/test-api-cli.py` requires an explicitly prepared mTLS/PostgreSQL fixture. Use the common
runner so source identity, required prerequisites, deadlines, cleanup and evidence remain enforced.
Do not run all files by indiscriminate discovery: some are fixture servers or Linux-only drivers.

## Run the checks

Use change-impact selection for ordinary development and the full plan when the selector or
release/regression task requires it. Run the selected checks, repair failures caused by the
requested change, and rerun affected checks without asking again for already-authorized fixture
work. Broaden verification when new evidence warrants it, not after every text edit. This does
not relax required CI, environment prerequisites, or code-owner review of test changes.

From the repository root, the public commands remain unchanged:

```sh
python3 scripts/check.py --help
python3 scripts/check.py plan --full --output "$CHECK_PLAN"
python3 scripts/check.py build --environment "$TEST_ENVIRONMENT" --output "$BUILD_MANIFEST"
python3 scripts/check.py run --plan "$CHECK_PLAN" --lane "$SELECTED_LANE" \
  --environment "$TEST_ENVIRONMENT" --output "$LANE_RESULTS"
python3 scripts/check.py report --plan "$CHECK_PLAN" --results "$LANE_RESULTS" \
  --output "$CHECK_SUMMARY"
```

Supply explicit paths for each variable. The environment must reference the current build manifest;
run every selected lane and pass all its result files to `report`. A result file must be new;
never overwrite failed evidence or present one lane's result as completion of the full plan.
[Integration and deployment](../docs/architecture/INTEGRATION_AND_DEPLOYMENT.md) documents environment
inputs and complete build/run/package examples. `plan --base "$BASE_REVISION" --head HEAD` selects
by change impact; `--full` requests the entire automated inventory.

For an individual dependency-free tooling check:

```sh
python3 tests/tooling/test-check-catalog.py
```

Standalone drivers retain their explicit argument contracts. Their small bootstrap locates this
checkout's Python package from the file location; it does not infer deployment paths, credentials,
DB connections, Docker endpoints or host identity. Imports use `tests.support` / `tests.fixtures`,
not ambient `PYTHONPATH` or a developer-specific installation. Test-only helper implementations live
under `tests/`; only the three public entry commands remain under `scripts/`.

## Add or move a test

1. State the behavior and failure it detects; assert observable effects and authorized records.
   Keep real SQL/kernel/filesystem observations when the guarantee belongs to those mechanisms.
2. Reuse support fixtures with explicit inputs and owned cleanup. Never adopt account credentials,
   existing company state or a developer's VM as a default fixture.
3. Connect the case to its catalog scenario and change-impact rule. New standalone tooling checks
   must be included in `tooling.contracts`; its inventory completeness is tested.
4. For a move, update all callers, imports, documentation, source-hash inventories and CODEOWNERS.
   Preserve scenario IDs, assertion meaning, timeouts, negative cases and fail-closed cleanup.
5. Run affected local checks and the selected hosted lanes. Keep failures and required `NOT RUN`
   visible; no path change, cache hit or mocked result can substitute for actual execution.

All test oracles and required-check selection remain code-owner protected. Deleted and renamed
paths participate in selection; unknown/shared changes expand verification instead of skipping it.
The final gate rejects missing, failed, cancelled and required `NOT RUN` cases. The test framework
is the existing Python/Rust tooling; no LLM judges system correctness.

## Evidence and migration

For an explicitly authorized real-model functional demonstration, see the
[basic flow procedure](integration/BASIC_FLOW_DEMO.md). Its model-free preparation and
bounded live run are separate from the synthetic CI scenarios.

Reports bind the source digest, selected scenario IDs and outcomes. Private fixture logs,
credentials, generated data and build outputs belong in explicit ignored storage such as `.local/`,
never beside versioned tests. Public summaries allow known test locations and bounded identifiers,
not raw tracebacks, assertion values or secrets.

The registered `native.program-continuation` case reuses the contained-program driver and its
independent adapter qualification. It observes a real abnormal exit, one finite recovery, unchanged
Company DB effect/receipt identity, exact owner stop, kernel/compute closure, and the still-available
Runtime service. Its ordinary automated stop is made by the fixture owner CLI; it does not prove a
native Mac button click. The explicit `--native-owner-stop` mode on
`integration/test-connected-program-guest.py` waits for the real app control instead. It requires
`--restriction complete --adapter-verification --service-continuation` and the same disposable
configuration. The operator connects the app before creating the fixture's `owner-ready` marker,
then captures its actual stopped state before creating `owner-observed`; these markers coordinate
observation only and neither submits a stop nor supplies a success receipt. No model account is used.

`native.program-host` qualifies a bounded operation with the same source/verifier path, then runs
two separately admitted requests in one contained instance. It checks each request's exact Company
result and effect receipt, deliberately drops one HTTP admission response, recovers by original key,
and stops the host with spare quota before its deadline. Actual container/guard termination, one
compute return, retained results and the surviving shared Runtime are observed separately. Its
normal owner is the fixture reviewer; this is model-free Linux evidence, not Mac-window evidence.
For the Mac checkpoint, the native suite accepts `--native-owner-stop` only with this single
scenario. Connect using the disposable owner profile, visibly close the window before writing
`owner-ready`, reopen after `awaiting_owner_stop`, use the execution inspector's Stop control,
and capture the stopped state before writing `owner-observed`. The fixture verifies the actual
human principal's stop record; the markers supply neither authorization nor outcome evidence.

System test files previously under `scripts/` now live here. Update direct file-path callers to the
locations above; there is no second copy or compatibility alias for old scenario paths. The public
`check.py`, `ci_environment.py` and `ci_report.py` commands remain in `scripts/`. No product API,
storage migration, authority semantics or Rust package-test ownership changes with this move.

## Integrated company lifecycle acceptance

[Integrated System Design](../docs/architecture/SYSTEM_DESIGN.md#10-acceptance-across-the-full-lifecycle)
connects existing responsibility tests to main-only source, independent Company packages, protected
selected use, artifact history/retention, native UI isolation, autonomous operation and financial
results. The listed outcomes are design acceptance requirements, not registered runnable case IDs.
Implement cases in their existing owning lane/catalog; do not claim a passed document check or one
resource-smoke run satisfies them. Test exact package/config/profile/evaluator identities, retain
negative/NOT RUN evidence, and keep actual company secrets/content out of product CI artifacts.

The protected Bearer module cases extend `resources.receipts` through
`support/auth_module_fixture.py` and the existing real Linux provider-process fixture. A compatible
Wasm package is installed without rebuilding, independently verified under separate grants and
selected through Core, then tested for mock dispatch, original-receipt recovery and restriction.
`crates/runtime/tests/auth_module.rs` covers capability denial and execution/output bounds. Mac
interpreter tests cannot substitute for the Linux custody-process integration.
