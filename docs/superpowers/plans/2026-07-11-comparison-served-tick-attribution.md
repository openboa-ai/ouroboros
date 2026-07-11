# Comparison Served-Tick Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist role-bound comparison tick delivery and candidate acknowledgement evidence so a
later paired checkpoint can require causal tick consumption instead of timestamp inference.

**Architecture:** The generic paper API provider exposes optional comparison hooks but keeps
non-comparison responses byte-compatible. A comparison session installs dormant hooks, enables them
only under exact owned-side attribution context, and persists deterministic delivery/acknowledgement
records through LocalStore before returning context to candidate code. Event parsing preserves an
optional exact acknowledgement reference for the later-checkpoint frontier.

**Tech Stack:** TypeScript, Vitest, Node.js HTTP/crypto, existing hexagonal application ports,
LocalStore JSON records, deterministic provider/session fixtures.

**Design:**
`docs/superpowers/specs/2026-07-11-comparison-served-tick-attribution-design.md`
at commit `4f886e4`.

## Global Constraints

- Timestamp, log order, and latest-tick inference are never accepted as causal attribution.
- Provider startup, candidate input, account reads, and order validation create no delivery.
- Comparison attribution is dormant until explicitly enabled for an exact owned side.
- Only candidate-facing `GET /market/snapshot` may create delivery.
- Delivery persists before response context; acknowledgement persists before ack response.
- One deterministic delivery and one deterministic acknowledgement exist per activation-attempt,
  role, and tick; repeated requests reuse them while request totals still increase.
- Delivery/acknowledgement evidence is non-economic and grants no lifecycle, Ledger, observation,
  evaluation, private, direct-order, or live authority.
- The existing first paired checkpoint remains acknowledgement-optional and byte-compatible.
- Tick sequence 2, view advancement, repeated checkpoints, resume, adjudication, verdict, promotion,
  and public composition remain out of scope.

---

### Task 1: Define tick delivery, acknowledgement, context, and authority

**Files:**
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/paper-trading-comparison-tick-attribution.test.ts`

**Interfaces:**
- Produces: `PaperTradingComparisonTickContext`
- Produces: `PaperTradingComparisonTickDeliveryRecord`
- Produces: `PaperTradingComparisonTickAcknowledgementRecord`
- Produces: `PaperTradingComparisonTickIOWriteContext`
- Produces: canonical digest-input and total runtime-shape functions for all three durable shapes

- [x] **Step 1: Write failing domain tests**

Construct one valid delivery, acknowledgement, response context, and write context. Assert:

```ts
expect(paperTradingComparisonTickContextHasRuntimeShape(context)).toBe(true);
expect(paperTradingComparisonTickDeliveryHasRuntimeShape(delivery)).toBe(true);
expect(paperTradingComparisonTickAcknowledgementHasRuntimeShape(ack)).toBe(true);
expect(paperTradingComparisonTickIOWriteContextHasRuntimeShape(writeContext)).toBe(true);
```

Use table cases to reject wrong record kinds, cross-role run refs, tick sequence mismatch, wrong
delivery ref/digest shape, request count zero, wrong endpoint, malformed ISO time, partial context,
digest drift, extra authority, and live/order authority. Cross-record delivery/ack time and request
ordering belongs to Task 2 LocalStore validation.

- [x] **Step 2: Run the domain test and verify RED**

Run:

```bash
npx vitest run packages/domain/src/paper-trading-comparison-tick-attribution.test.ts
```

Expected: FAIL because attribution types and predicates are missing.

- [x] **Step 3: Add exact domain records and total predicates**

Implement the design fields and these operation literals:

```ts
type PaperTradingComparisonTickIOOperation =
  | "deliver_market_snapshot"
  | "acknowledge_tick";
```

The context predicate requires exact tick and delivery refs/digests. Delivery requires
`endpoint: "GET /market/snapshot"`; acknowledgement requires
`endpoint: "POST /comparison/tick/ack"` and a positive provider count. Task 2 LocalStore validation
requires the acknowledgement count to be greater than or equal to the referenced delivery count.
Digest-input functions omit record kind, version, deterministic identity, and their own digest field
exactly as existing comparison evidence functions do.

- [x] **Step 4: Run domain regressions and typecheck**

Run:

```bash
npx vitest run packages/domain/src/paper-trading-comparison-tick-attribution.test.ts packages/domain/src/paper-trading-comparison-checkpoint.test.ts packages/domain/src/paper-trading-comparison-runtime-activation.test.ts
npm run typecheck --workspace @ouroboros/domain
```

Expected: selected domain tests and typecheck pass.

- [x] **Step 5: Commit the attribution domain contract**

```bash
git add packages/domain/src/index.ts packages/domain/src/paper-trading-comparison-tick-attribution.test.ts
git commit -m "feat: define comparison tick attribution evidence"
```

### Task 2: Persist attribution evidence behind exact LocalStore authority

**Files:**
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/local-store.test.ts`

**Interfaces:**
- Consumes: Task 1 records and context
- Produces: Store get/list/record methods for delivery and acknowledgement
- Preserves: all pair-bound economic and lifecycle mutation guards

- [ ] **Step 1: Write failing LocalStore lifecycle and authority tests**

Starting from a real committed first paired checkpoint whose sessions remain running, assert:

```ts
await store.recordPaperTradingComparisonTickDelivery(delivery, deliveryContext);
await store.recordPaperTradingComparisonTickAcknowledgement(ack, ackContext);
```

Verify exact replay, append-only conflicts, one deterministic record per role/tick, current latest
`both_running` activation outcome, exact post-checkpoint side graph, role/run/tick matching, provider
count at or below the frozen cap, acknowledgement requiring its exact delivery, and corruption
failure. Invoke sandbox, evaluation, observation, Ledger, run-control, tick, checkpoint, and
promotion writers with the IO context and assert every one remains rejected.

- [ ] **Step 2: Run LocalStore attribution tests and verify RED**

Run:

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "comparison tick attribution"
```

Expected: FAIL because Store methods and collections do not exist.

- [ ] **Step 3: Add Store methods and append-only collections**

Add:

```ts
recordPaperTradingComparisonTickDelivery(record, authority): Promise<DeliveryRecord>;
getPaperTradingComparisonTickDelivery(id): Promise<DeliveryRecord | undefined>;
listPaperTradingComparisonTickDeliveries(activationAttemptId): Promise<DeliveryRecord[]>;
recordPaperTradingComparisonTickAcknowledgement(record, authority): Promise<AckRecord>;
getPaperTradingComparisonTickAcknowledgement(id): Promise<AckRecord | undefined>;
listPaperTradingComparisonTickAcknowledgements(activationAttemptId): Promise<AckRecord[]>;
```

Use `withComparisonEvidenceWriteTransaction`. Reload activation, latest attempt/outcome, tick,
paired checkpoint transaction evidence, role-bound run/evaluation/sandbox, and frozen request cap.
Delivery requires a running post-checkpoint side. Ack requires exact delivery and a count not below
delivery. Writes never rebuild economic records; they append only attribution collections.

- [ ] **Step 4: Run LocalStore and typecheck regressions**

Run:

```bash
npx vitest run packages/local-store/test/local-store.test.ts -t "comparison tick attribution|paired checkpoint transaction|runtime activation write context"
npm run typecheck --workspace @ouroboros/local-store
```

Expected: selected tests and LocalStore typecheck pass.

- [ ] **Step 5: Commit attribution persistence**

```bash
git add packages/application/src/ports/store.ts packages/local-store/src/index.ts packages/local-store/test/local-store.test.ts
git commit -m "feat: persist comparison tick attribution"
```

### Task 3: Add optional provider delivery and acknowledgement protocol

**Files:**
- Modify: `packages/application/src/trading/research/types.ts`
- Modify: `packages/application/src/trading/gateway/runtime-binding.ts`
- Modify: `packages/application/src/trading/gateway/runtime-binding.test.ts`

**Interfaces:**
- Produces: `PaperTradingApiProviderComparisonTickHooks`
- Extends: `PaperTradingApiProviderOptions` with optional `comparison_tick_hooks`
- Preserves: generic provider response bytes when hooks are absent or dormant

- [ ] **Step 1: Write failing provider protocol tests**

Cover:

- no hooks: market response exactly equals the current sanitized payload and ack route is `404`;
- dormant hook returns no context and records no delivery;
- enabled GET calls delivery once before response and includes exact context;
- repeated GET returns the hook's same context and increments `request_count`;
- delivery failure returns `503` without context;
- valid ack calls the hook before response and returns acknowledgement ref/digest;
- malformed/stale ack returns a stable `409` or `422` and records nothing;
- startup initial market read and `/orders/validate` do not call delivery;
- request-cap rejection occurs before either hook.

- [ ] **Step 2: Run provider tests and verify RED**

Run:

```bash
npx vitest run packages/application/src/trading/gateway/runtime-binding.test.ts -t "comparison tick"
```

Expected: FAIL because hooks, response context, and ack route are missing.

- [ ] **Step 3: Implement optional provider hooks**

Add:

```ts
interface PaperTradingApiProviderComparisonTickHooks {
  deliver(input: {
    market: MarketSnapshot;
    provider_request_count: number;
    delivered_at: string;
  }): Promise<PaperTradingComparisonTickContext | undefined>;
  acknowledge(input: {
    context: unknown;
    provider_request_count: number;
    acknowledged_at: string;
  }): Promise<{
    acknowledgement_ref: Ref;
    acknowledgement_digest: string;
  }>;
}
```

Call `deliver` only inside successful candidate-facing `GET /market/snapshot`. Spread context into
the sanitized market payload only when returned. Add `POST /comparison/tick/ack`; map hook validation
errors to a stable client response and infrastructure errors to `503`. Keep the request cap before
body parsing and all hooks.

- [ ] **Step 4: Run provider regressions and typecheck**

Run:

```bash
npx vitest run packages/application/src/trading/gateway/runtime-binding.test.ts packages/application/src/trading/research/replay-trading-api-provider.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: provider tests and application typecheck pass.

- [ ] **Step 5: Commit provider protocol**

```bash
git add packages/application/src/trading/research/types.ts packages/application/src/trading/gateway/runtime-binding.ts packages/application/src/trading/gateway/runtime-binding.test.ts
git commit -m "feat: expose comparison tick acknowledgement protocol"
```

### Task 4: Preserve acknowledgement lineage in candidate events

**Files:**
- Modify: `packages/application/src/trading/paper/events.ts`
- Modify: `packages/application/src/trading/paper/events.test.ts`
- Modify: `packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts`

**Interfaces:**
- Extends: every accepted `ParsedTradingSystemPaperEvent` with optional acknowledgement ref/digest
- Preserves: acknowledgement lineage through first-checkpoint preparation without requiring it

- [ ] **Step 1: Write failing parser and preparation tests**

Add an order, cancel, hold, and no-action event containing:

```json
{
  "comparison_tick_acknowledgement_ref": {
    "record_kind": "paper_trading_comparison_tick_acknowledgement",
    "id": "ack-1"
  },
  "comparison_tick_acknowledgement_digest": "sha256:..."
}
```

Assert both fields survive parsing. Reject either field alone, wrong record kind, empty ID, malformed
digest, and forbidden extra attribution authority. Assert first-checkpoint preparation still accepts
an event without attribution and preserves an attributed event in the prepared engine event path.

- [ ] **Step 2: Run event tests and verify RED**

Run:

```bash
npx vitest run packages/application/src/trading/paper/events.test.ts packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts -t "attribution|acknowledgement"
```

Expected: FAIL because parsed events omit acknowledgement lineage.

- [ ] **Step 3: Add all-or-none attribution parsing**

Define one shared optional attribution interface and spread it into every accepted event kind. The
parser validates exact ref kind and `sha256:` digest syntax before event-specific parsing. Rejected
attribution becomes a normal `PaperTradingErrorEvent`; it never silently strips malformed lineage.

- [ ] **Step 4: Run paper event and observation regressions**

Run:

```bash
npx vitest run packages/application/src/trading/paper/events.test.ts packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts packages/application/src/trading/paper/observation.test.ts
npm run typecheck --workspace @ouroboros/application
```

Expected: selected tests and application typecheck pass.

- [ ] **Step 5: Commit event lineage**

```bash
git add packages/application/src/trading/paper/events.ts packages/application/src/trading/paper/events.test.ts packages/application/src/trading/paper/comparison-checkpoint-preparation.test.ts
git commit -m "feat: preserve comparison tick acknowledgement lineage"
```

### Task 5: Wire dormant role-bound hooks through PaperTradingSessionService

**Files:**
- Modify: `packages/application/src/ports/paper-comparison-session.ts`
- Modify: `packages/application/src/trading/paper/session-service.ts`
- Modify: `packages/application/src/trading/paper/session-service.test.ts`

**Interfaces:**
- Produces: `enableComparisonTickAttributionSide`
- Consumes: Task 2 Store persistence and Task 3 provider hooks
- Preserves: activation and first-checkpoint behavior before enablement

- [ ] **Step 1: Write failing session tests**

Start one authorized comparison side, then prove:

- before enablement, candidate GET returns no context and Store has no delivery;
- wrong role, stale attempt/outcome, wrong tick, stopped side, missing provider, and pre-checkpoint
  evaluation state are rejected before enabling;
- exact post-checkpoint running side enablement succeeds once;
- first enabled GET persists one delivery before returning context;
- repeated GET reuses delivery while request total grows;
- valid ack persists one acknowledgement and exact replay reuses it;
- cross-role, stale, malformed, or over-budget ack fails;
- no Ledger, observation, evaluation, run-control, sandbox lifecycle, or market-source read occurs.

- [ ] **Step 2: Run session attribution tests and verify RED**

Run:

```bash
npx vitest run packages/application/src/trading/paper/session-service.test.ts -t "tick attribution"
```

Expected: FAIL because session enablement and provider hook wiring are missing.

- [ ] **Step 3: Add the focused session method**

Add:

```ts
enableComparisonTickAttributionSide(input: {
  side: PaperTradingComparisonActivationSide;
  authority: PaperTradingComparisonTickIOWriteContext;
  tick: PaperTradingComparisonTickRecord;
}): Promise<void>;
```

Install provider hook closures at provider creation but read an in-memory enabled-attribution map.
The enable method independently reloads the latest exact `both_running` attempt, paired checkpoint
outcome, role-bound post-checkpoint running state, provider session, frozen cap, and tick. Delivery
and ack hooks derive exact write operations, use total request count including prior provider
sessions, and return deterministic contexts from persisted records.

- [ ] **Step 4: Run session, provider, Store, and checkpoint regressions**

Run:

```bash
npx vitest run packages/application/src/trading/paper/session-service.test.ts packages/application/src/trading/gateway/runtime-binding.test.ts packages/application/src/trading/paper/comparison-checkpoint-coordinator.test.ts packages/local-store/test/local-store.test.ts -t "attribution|comparison tick|checkpoint"
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/local-store
```

Expected: selected tests and both typechecks pass.

- [ ] **Step 5: Commit session integration**

```bash
git add packages/application/src/ports/paper-comparison-session.ts packages/application/src/trading/paper/session-service.ts packages/application/src/trading/paper/session-service.test.ts
git commit -m "feat: wire role-bound tick attribution"
```

### Task 6: Prove the real path and update durable truth

**Files:**
- Modify: `packages/application/src/trading/paper/comparison-coordinator.test.ts`
- Modify: `AGENTS.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/superpowers/specs/2026-07-11-comparison-served-tick-attribution-design.md`
- Modify: `docs/superpowers/plans/2026-07-11-comparison-served-tick-attribution.md`

**Interfaces:**
- Consumes: Tasks 1-5 complete attribution path
- Produces: real LocalStore/provider/session evidence and maintained implementation status
- Leaves: tick sequence 2 and repeated checkpoints explicitly closed

- [ ] **Step 1: Write the real integration test**

Extend the real first paired checkpoint fixture. Keep both sessions running after paired commit,
enable attribution for both roles, call each provider's candidate-facing market and ack endpoints,
and assert exact delivery/ack records with distinct role/run identities and the same first tick.
Assert provider startup and checkpoint preparation created no delivery, repeated GET/ack are
idempotent, no underlying market read occurs, and restart recovery does not fabricate attribution.

- [ ] **Step 2: Run integration and verify the attribution path**

Run:

```bash
npx vitest run packages/application/src/trading/paper/comparison-coordinator.test.ts -t "served tick attribution"
```

Expected: PASS only when real LocalStore, provider, session, and authority boundaries agree.

- [ ] **Step 3: Verify no production composition**

Run:

```bash
rg -n "enableComparisonTickAttributionSide|paper_trading_comparison_tick_delivery|paper_trading_comparison_tick_acknowledgement" apps packages --glob '!**/*.test.ts'
```

Expected: domain, Store, provider, and application internals only; no runtime controller, public
command, CLI, TUI, Web, or Desktop composition.

- [ ] **Step 4: Update canonical docs**

Add the three canonical attribution nouns, state that delivery/ack substrate is implemented for the
existing first-tick session, and preserve explicit closure of later ticks, repeated checkpoints,
resume, adjudication, verdict, promotion, private access, and live authority. Record actual commits
and verification counts in this plan.

- [ ] **Step 5: Run focused and repository-wide verification**

Run:

```bash
npx vitest run packages/domain/src/paper-trading-comparison-tick-attribution.test.ts packages/application/src/trading/gateway/runtime-binding.test.ts packages/application/src/trading/paper/events.test.ts packages/application/src/trading/paper/session-service.test.ts packages/application/src/trading/paper/comparison-coordinator.test.ts packages/local-store/test/local-store.test.ts
npm run typecheck
npm run check:repo-guards
npm test
git diff --check
```

Expected: all focused tests, workspace typechecks, repository guards, and the full suite pass.

- [ ] **Step 6: Commit durable implementation evidence**

```bash
git add AGENTS.md docs/candidate-arena-evaluation-protocol.md docs/api-command-contract.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-11-comparison-served-tick-attribution-design.md docs/superpowers/plans/2026-07-11-comparison-served-tick-attribution.md packages/application/src/trading/paper/comparison-coordinator.test.ts
git commit -m "docs: record served-tick attribution"
```

## Plan Self-Review

- Every acceptance item in the design maps to a named test or command.
- Delivery and acknowledgement identities and method names match across all tasks.
- Dormant provider behavior prevents activation-start races and preserves current response bytes.
- Request-cap checks precede every attribution hook.
- First-checkpoint acknowledgement remains optional; no existing economic outcome changes.
- No task appends tick sequence 2, advances a view, records a repeated checkpoint, resumes a
  provider, adjudicates, promotes, or adds public composition.
