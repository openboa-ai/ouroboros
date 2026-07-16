# ResearchControlStudy Multi-Host Fencing Implementation Plan

**Issue:** OURO-187
**Delivery:** one branch, one PR, PR body `OURO-187`

## Scope Guard

Implement one per-study runtime capability boundary. Do not create more Linear issues, add research
policy, or broaden this into a generic scheduler, consensus service, or deployment platform.

## Task 1: Domain And Port

1. Add `fencing_token` and distributed-expiry close reason to the lease record.
2. Require the token in decision, shape, digest, renewal, release, and identity checks.
3. Add `lease_unexpired` held semantics and `withFencedWrite` to the application port.
4. Write failing domain tests first, then make the smallest implementation pass.

## Task 2: Shared Coordination Adapter

1. Add failing tests for two-host race, monotonic takeover, partition/heal stale writer, blocked
   writer ordering, restart, PID reuse, corrupt state, and exact terminal history.
2. Implement the SQLite-backed shared adapter with bounded async lock acquisition.
3. Keep active state, token high-water mark, and immutable history in one transaction domain.
4. Prove callback non-entry for stale tokens and rollback on callback failure.

## Task 3: Single-Host Compatibility

1. Add monotonic token allocation to the existing filesystem adapter.
2. Add its same-host guarded-write implementation without changing confirmed-dead takeover rules.
3. Update existing fixtures and preserve their transition-recovery coverage.

## Task 4: Commit Boundary

1. Add an optional `LocalStore` write transaction decorator.
2. Wrap replace and create-only publication primitives.
3. Add a child-root factory that preserves the decorator.
4. Prove coordinator and arm-root writes run inside the same fence and reads remain unrestricted.

## Task 5: Runtime Composition

1. Expose fenced writes from the lease session and mark failures as lease loss.
2. Build a fenced coordinator store after acquisition and inherit it in campaign arm stores.
3. Switch the default server lease adapter to the shared implementation.
4. Preserve injected adapters and no-lease test composition for single-host compatibility.

## Task 6: Verification And Delivery

1. Run focused domain, adapter, LocalStore, session, supervisor, executor, and server tests.
2. Run affected package type checks, then the full suite and repo-required guards.
3. Commit with `OURO-187`, push once, and open one PR whose body is exactly `OURO-187`.
4. Wait for current-head CI and Codex review, fix actionable findings on the same branch, and merge
   only when the final head is green and review-clean.
5. Update the existing Linear workpad comment and clean the worktree/branch after merge.
