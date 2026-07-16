# Runtime Restart Soak Harness Implementation Plan

**Goal:** Deliver one bounded, resumable fault-injection harness and invariant report protocol for
OURO-188.

**Architecture:** Application code owns scenario validation, invariant semantics, resume, and
classification. Adapters own create-only filesystem persistence and shell-free subprocess control.
The runtime app owns only CLI composition.

**Scope:** One PR, at most four production files and under the default 800 production-line review
budget unless the implemented acceptance contract proves a smaller safe result is impossible.

**Scope outcome:** The implementation keeps four production surfaces but uses about 1,150 new
production lines. The explicit external sample/event contracts, resume state machine, and
create-only report validator account for the exception. Splitting the application contract from
its only durable adapter and executable composition would create a hard-dependent, non-operational
PR pair, so OURO-188 remains one atomic vertical frontier instead of creating another ticket.

## Task 1: Lock The Application Contract With Failing Tests

**Files:**

- Add: `packages/application/src/runtime-soak.test.ts`

1. Add a healthy cumulative sample fixture.
2. Add a required-action scenario covering clean restart, crash, delayed cleanup, provider loss,
   Sandbox loss, Gateway unavailability, exact recovery, and terminal cleanup.
3. Add table tests for duplicate effects, noncontiguous chains, ownership conflict, retry overflow,
   missing no-order continuity, missing egress attestation, and incomplete terminal cleanup.
4. Add tests for all terminal classifications: `passed`, `invariant_failed`, `target_failed`, and
   `duration_exhausted`.
5. Add a harness-restart test that interrupts during a wait, reconstructs from the same journal,
   preserves elapsed time, and does not replay a completed action.
6. Add a dangling action-intent test that fails closed without a second target call.
7. Run the focused test and confirm it fails because the application module does not exist.

## Task 2: Implement The Application Harness

**Files:**

- Add: `packages/application/src/runtime-soak.ts`

1. Define the scenario, action, sample, manifest, event, terminal, target-port, and journal-port
   contracts.
2. Validate canonical action coverage, ordering, uniqueness, recovery pairing, and duration bounds.
3. Implement strict sample parsing for the external probe boundary.
4. Implement the pure invariant evaluator with fixed failure priority.
5. Implement run initialization, periodic sampling, action intent/completion, wall-clock duration,
   terminal cleanup verification, and terminal classification.
6. Reconstruct completed actions and elapsed time from existing events.
7. Return existing terminal reports idempotently and fail closed on dangling action intent.
8. Run the focused application test until green.

## Task 3: Lock Persistence And Subprocess Behavior With Failing Tests

**Files:**

- Add: `apps/runtime/test/runtime-soak.test.ts`

1. Add filesystem journal tests for immutable manifest creation and exact reload.
2. Add append/reload tests for sequence, predecessor, timestamp, run ID, and digest continuity.
3. Add corruption, unexpected-file, manifest mismatch, and predecessor-conflict tests.
4. Add subprocess target tests using `process.execPath` argv arrays.
5. Verify successful controls return only evidence digests, probe JSON is shape-validated, and
   malformed output or non-zero exit fails.
6. Run the focused test and confirm it fails because the adapter does not exist.

## Task 4: Implement Filesystem And Subprocess Adapters

**Files:**

- Add: `packages/adapters/src/runtime-soak.ts`

1. Create the report root, manifest, events, and pending directories with restrictive modes.
2. Publish manifest and sequence files with create-only writes; use temporary files and hard links
   for atomic event publication.
3. Validate exact event shape, complete digest chain, monotonic time, and manifest binding on load.
4. Implement predecessor comparison and stable journal error codes.
5. Execute configured control and probe argv through `execFile` without a shell and with bounded
   timeout/buffer.
6. Add non-secret run/action metadata to child environments.
7. Parse probe stdout with the application sample parser and retain only command evidence digests.
8. Run the focused adapter test until green.

## Task 5: Add The CLI And Deterministic End-To-End Fixture

**Files:**

- Add: `apps/runtime/src/run-runtime-soak.ts`
- Modify: `package.json`
- Extend: `apps/runtime/test/runtime-soak.test.ts`

1. Parse `--config` and `--report-root` without implicit paths.
2. Validate config version, scenario, control command map, and probe command.
3. Compose `RuntimeSoakHarness`, `FileRuntimeSoakJournal`, and
   `SubprocessRuntimeSoakTarget`.
4. Print one JSON terminal summary and return zero only for `passed`.
5. Add `npm run runtime:soak -- --config <file> --report-root <dir>`.
6. Build a temporary deterministic target fixture in the test that executes every action kind,
   emits healthy samples, and produces a passing terminal report through the CLI composition.
7. Reopen the same report and prove no target command is replayed.
8. Run the complete focused runtime-soak test set.

## Task 6: Write Durable Product Truth

**Files:**

- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/naming-taxonomy.md`

1. Document the operational harness outside RuntimeSupervisor authority.
2. Record the append-only report, first-failure, resume, and shell-free target boundaries.
3. Add `RuntimeSoakHarness` and `RuntimeSoakReport` to canonical vocabulary guidance.
4. Mark short deterministic restart-soak protocol evidence as implemented while leaving actual
   production-duration evidence, OURO-189, multi-host fencing, and economic evidence open.
5. Keep long-duration completion claims explicitly false.

## Task 7: Verify, Review, And Deliver

1. Run focused runtime-soak tests.
2. Run `npm run typecheck`.
3. Run the complete `npm test` suite once.
4. Run:

   ```bash
   bash scripts/check-docs.sh
   npm run check:architecture
   npm run check:naming
   bash scripts/check-env-files.sh --tracked
   bash scripts/check-secrets.sh
   git diff --check
   ```

5. Review the final diff against the OURO-188 owned boundary and scope budget.
6. Update the existing Linear workpad comment with exact evidence; do not create another issue or
   comment thread.
7. Commit with an OURO-188 scope rationale, push the worktree branch, and open one PR whose body is
   exactly `OURO-188`.
8. Require green current-head CI, CodeQL, gitleaks, and current-head Codex review.
9. Fix actionable findings in bounded loops, revalidate, and merge only when the final head is clean.
10. Verify the squash-merge tree, finalize the existing workpad, release the writer lease, and
    remove the worktree and branches.
