# TradingSystem Comparison Cadence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a real sandboxed TradingSystem acknowledge a new post-activation comparison tick on
its own cadence and prove 12 pair-qualified source verdicts in the precommitted six-replication
ResearchControlStudy.

**Architecture:** Extend only the opaque Python clock fixture: it polls the existing paper provider
after each decision interval, posts each new exact comparison context once, and leaves Gateway and
Evaluation authority unchanged. Then freeze a two-checkpoint prospective protocol and classify the
real-arm results without inferring improvement from qualified ties.

**Tech Stack:** Python 3 standard library, Node.js HTTP provider, TypeScript, Vitest,
DeterministicSandboxAdapter, LocalStore

## Global Constraints

- TradingSystem owns cadence; Gateway must not synthesize a decision or acknowledgement.
- Post the exact provider-issued `comparison_tick_context` without modification.
- Deduplicate by non-empty `delivery_ref.id`; do not acknowledge the same delivery twice.
- Keep all exchange authority `not_live`; no Binance, credential, private, or submission access.
- Freeze both minimum and maximum observation counts at 2 and the interval/minimum elapsed at 25 ms.
- A qualified tie is `source_not_improved`, not candidate improvement or allocation-policy evidence.
- Do not stage, modify, or remove `.superpowers/`.

---

### Task 1: TradingSystem-owned comparison tick acknowledgement

**Files:**
- Modify: `apps/runtime/test/clock-artifact.test.ts`
- Modify: `fixtures/trading-systems/clock.py`

**Interfaces:**
- Consumes: `TRADING_API_BASE_URL`, `GET /market/snapshot`, and the provider-issued
  `comparison_tick_context` object.
- Produces: `acknowledge_comparison_tick(base_url, market, last_delivery_id) -> str | None` behavior
  and one exact `POST /comparison/tick/ack` per new delivery ID.

- [x] **Step 1: Write the failing real-provider artifact test**

Add a test that starts `startPaperTradingApiProvider` with comparison hooks. The delivery hook must
return `undefined`, context 1, repeated context 1, and context 2 across the initial market read and
three cadence reads. Run the real artifact for four finite heartbeats:

```ts
it("acknowledges each new comparison tick once on its own cadence", async () => {
  const contexts = [comparisonContext(1), comparisonContext(2)];
  const deliveries = [undefined, contexts[0], contexts[0], contexts[1]];
  const acknowledged: unknown[] = [];
  let deliveryIndex = 0;
  const provider = await startPaperTradingApiProvider(
    createGatewayRuntimeBinding({ marketData: fakeGatewayMarketDataPort() }),
    {
      comparison_tick_hooks: {
        deliver: async () => deliveries[deliveryIndex++],
        acknowledge: async ({ context }) => {
          acknowledged.push(context);
          const sequence = (context as { tick_sequence: number }).tick_sequence;
          return {
            acknowledgement_ref: {
              record_kind: "paper_trading_comparison_tick_acknowledgement",
              id: `clock-artifact-ack-${sequence}`
            },
            acknowledgement_digest: `sha256:clock-artifact-ack-${sequence}`
          };
        }
      }
    }
  );

  try {
    await execFileAsync("python3", [
      artifactPath,
      "--instance-id", "clock-comparison-cadence",
      "--ticks", "4",
      "--interval-ms", "1"
    ], { env: { ...process.env, TRADING_API_BASE_URL: provider.base_url } });

    expect(acknowledged).toEqual(contexts);
    expect(provider.requests().map(({ method, path }) => `${method} ${path}`))
      .toEqual([
        "GET /market/snapshot",
        "GET /account/state",
        "POST /orders/validate",
        "GET /market/snapshot",
        "POST /comparison/tick/ack",
        "GET /market/snapshot",
        "GET /market/snapshot",
        "POST /comparison/tick/ack"
      ]);
  } finally {
    await provider.close();
  }
});
```

Add this exact helper in the test file:

```ts
function comparisonContext(sequence: number) {
  return {
    tick_ref: {
      record_kind: "paper_trading_comparison_tick" as const,
      id: `clock-artifact-tick-${sequence}`
    },
    tick_digest: `sha256:clock-artifact-tick-${sequence}`,
    tick_sequence: sequence,
    delivery_ref: {
      record_kind: "paper_trading_comparison_tick_delivery" as const,
      id: `clock-artifact-delivery-${sequence}`
    },
    delivery_digest: `sha256:clock-artifact-delivery-${sequence}`
  };
}
```

- [x] **Step 2: Run the artifact test and confirm RED**

Run:

```bash
npx vitest run apps/runtime/test/clock-artifact.test.ts --reporter=verbose
```

Expected: the new test fails because the current fixture makes only its initial provider requests
and `acknowledged` remains empty.

- [x] **Step 3: Implement exact-context acknowledgement in the fixture**

Add validation and deduplication helpers to `clock.py`:

```python
def acknowledge_comparison_tick(
    base_url: str,
    market: dict[str, object],
    last_delivery_id: str | None,
) -> str | None:
    context = market.get("comparison_tick_context")
    if context is None:
        return last_delivery_id
    if not isinstance(context, dict):
        raise RuntimeError("comparison tick context is not an object")
    delivery_ref = context.get("delivery_ref")
    if not isinstance(delivery_ref, dict):
        raise RuntimeError("comparison tick delivery ref is not an object")
    delivery_id = delivery_ref.get("id")
    if not isinstance(delivery_id, str) or not delivery_id.strip():
        raise RuntimeError("comparison tick delivery id is invalid")
    if delivery_id == last_delivery_id:
        return last_delivery_id
    acknowledgement = post_provider_json(
        base_url,
        "/comparison/tick/ack",
        context,
    )
    acknowledgement_ref = acknowledgement.get("acknowledgement_ref")
    acknowledgement_digest = acknowledgement.get("acknowledgement_digest")
    if (
        not isinstance(acknowledgement_ref, dict)
        or not isinstance(acknowledgement_ref.get("id"), str)
        or not isinstance(acknowledgement_digest, str)
        or not acknowledgement_digest
    ):
        raise RuntimeError("comparison tick acknowledgement is invalid")
    return delivery_id
```

Change `paper_order_payload` to return `(event, last_delivery_id)`, acknowledge an initial context
if present, and retain the existing order/hold contents. In `main`, after each non-terminal sleep,
read `/market/snapshot` and call the helper before the next heartbeat. Skip the read when no provider
URL exists or shutdown was requested.

- [x] **Step 4: Run focused artifact and provider contract tests**

Run:

```bash
npx vitest run \
  apps/runtime/test/clock-artifact.test.ts \
  packages/application/src/trading/gateway/runtime-binding.test.ts \
  --reporter=verbose
```

Expected: both files pass; repeated context 1 has one acknowledgement and context 2 has one.

- [x] **Step 5: Commit the artifact cadence**

```bash
git add apps/runtime/test/clock-artifact.test.ts fixtures/trading-systems/clock.py
git commit -m "feat: acknowledge comparison ticks from TradingSystem"
```

### Task 1B: Generated candidate comparison cadence

**Files:**
- Modify: `apps/runtime/test/generated-trading-system-artifact.test.ts`
- Modify: `artifacts/trading-system/run.py`
- Modify: `docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md`

**Interfaces:**
- Consumes: the same provider context and acknowledgement contract proven by Task 1.
- Produces: every sealed candidate copied from `artifacts/trading-system/run.py` can consume a
  post-activation tick instead of emitting heartbeats forever.

- [x] **Step 1: Record the isolated runtime evidence**

Record in the design that the first two-checkpoint run reached replication 1, stopped the clock
champions, and left the adaptive/static generated `submitted-artifact/run.py` processes alive past
1,900 heartbeats with no later provider request. This establishes that the generated template, not
the runner or provider limit, is the remaining boundary.

- [x] **Step 2: Write the failing generated-artifact provider test**

Extend `generated-trading-system-artifact.test.ts` with the real provider imports and the same two
context helper used by the clock contract:

```ts
import {
  createGatewayRuntimeBinding,
  startPaperTradingApiProvider
} from "@ouroboros/application/trading/gateway/runtime-binding";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

it("acknowledges each new comparison tick once on generated candidate cadence", async () => {
  const contexts = [comparisonContext(1), comparisonContext(2)];
  const deliveries = [undefined, contexts[0], contexts[0], contexts[1]];
  const acknowledged: unknown[] = [];
  let deliveryIndex = 0;
  const provider = await startPaperTradingApiProvider(
    createGatewayRuntimeBinding({ marketData: fakeGatewayMarketDataPort() }),
    {
      comparison_tick_hooks: {
        deliver: async () => deliveries[deliveryIndex++],
        acknowledge: async ({ context }) => {
          acknowledged.push(context);
          const sequence = (context as { tick_sequence: number }).tick_sequence;
          return {
            acknowledgement_ref: {
              record_kind: "paper_trading_comparison_tick_acknowledgement",
              id: `generated-artifact-ack-${sequence}`
            },
            acknowledgement_digest: `sha256:generated-artifact-ack-${sequence}`
          };
        }
      }
    }
  );
  try {
    await execFileAsync("python3", [
      artifactPath,
      "--instance-id", "generated-comparison-cadence",
      "--ticks", "4",
      "--interval-ms", "1"
    ], { env: { ...process.env, TRADING_API_BASE_URL: provider.base_url } });
    expect(acknowledged).toEqual(contexts);
  } finally {
    await provider.close();
  }
});
```

Also assert the exact request sequence from Task 1 so a repeated context cannot create a second
acknowledgement.

- [x] **Step 3: Run the generated-artifact test and confirm RED**

Run:

```bash
npx vitest run apps/runtime/test/generated-trading-system-artifact.test.ts --reporter=verbose
```

Expected: the new test fails with an empty acknowledgement list because `run_paper` performs no
provider read after its initial decision.

- [x] **Step 4: Implement the standalone generated-candidate contract**

Add the exact `acknowledge_comparison_tick` validation and delivery-ID deduplication from Task 1 to
`artifacts/trading-system/run.py`. In valid paper mode, acknowledge an initial context if present.
After each non-terminal sleep, read `/market/snapshot` and acknowledge a new context before the next
heartbeat. Rejected fixture mode remains provider-free. Do not import repository code because the
generated artifact closure must remain exactly `manifest.json` plus `run.py`.

- [x] **Step 5: Run both artifact contract tests**

Run:

```bash
npx vitest run \
  apps/runtime/test/clock-artifact.test.ts \
  apps/runtime/test/generated-trading-system-artifact.test.ts \
  packages/application/src/trading/gateway/runtime-binding.test.ts \
  --reporter=verbose
```

Expected: all tests pass and both executable artifact families acknowledge context 1 and context 2
exactly once.

- [x] **Step 6: Commit the completed artifact contract**

```bash
git add \
  apps/runtime/test/generated-trading-system-artifact.test.ts \
  artifacts/trading-system/run.py \
  docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md \
  docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md
git commit -m "feat: acknowledge comparison ticks from generated candidates"
```

### Task 2: Qualified two-checkpoint prospective study

**Files:**
- Modify: `apps/runtime/test/research-control-study-prospective.integration.test.ts`
- Modify: `docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md`

**Interfaces:**
- Consumes: the Task 1 and Task 1B artifact cadences plus existing real arm/session composition.
- Produces: six completed replications containing 12 pair-qualified source verdicts and no policy
  decision.

- [ ] **Step 1: Freeze the two-checkpoint protocol**

Change `boundProtocol` and the sandbox fixture cadence:

```ts
minimum_observation_count: 2,
minimum_elapsed_ms: 25,
maximum_observation_count: 2,
```

```ts
sandboxIntervalMs: 25,
```

Keep `maximum_elapsed_ms: 600_000`, provider request limit 100, confirmation count 1, and all
authority policies unchanged.

- [ ] **Step 2: Replace ineligible expectations with qualified-tie expectations**

Assert exact source verdict closure:

```ts
expect(outcomes.flatMap((outcome) => outcome.arms.flatMap((arm) =>
  arm.slot_results.map((slot) => slot.terminal_status)
))).toEqual(Array.from({ length: 12 }, () => "source_not_improved"));

expect(qualificationEvidence).toEqual(Array.from({ length: 12 }, () => ({
  pair: [],
  champion: [],
  challenger: []
})));
```

Retain the exact six ties, zero non-ties, p-value 1,
`insufficient_non_tied_replications`, no allocation decision, unchanged promotion, symmetric
provider/sandbox lifecycle, and effect-free restart assertions.

- [ ] **Step 3: Run the real-arm integration**

Run:

```bash
npx vitest run \
  apps/runtime/test/research-control-study-prospective.integration.test.ts \
  --reporter=verbose
```

Expected: one test passes with 12 `source_not_improved` terminal slots and empty qualification
reasons. If it fails, classify the first stable product or fixture boundary; do not weaken
qualification or fabricate an acknowledgement.

- [ ] **Step 4: Run the comparison/session regression set**

Run:

```bash
npx vitest run \
  packages/application/src/trading/paper/session-service.test.ts \
  packages/application/src/trading/paper/comparison-coordinator.test.ts \
  packages/application/src/trading/paper/comparison-window-driver.test.ts \
  apps/runtime/test/research-control-study-*.test.ts \
  --reporter=dot
```

Expected: all files pass with no child process or provider leaks.

- [ ] **Step 5: Commit the qualified study evidence**

```bash
git add \
  apps/runtime/test/research-control-study-prospective.integration.test.ts \
  docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md
git commit -m "test: qualify prospective comparison cadence"
```

### Task 3: Evidence classification and repository verification

**Files:**
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/superpowers/specs/2026-07-12-candidate-arena-research-evidence-program-design.md`
- Modify: `docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md`

**Interfaces:**
- Consumes: exact Task 2 status, qualification, lifecycle, study-inference, and restart evidence.
- Produces: durable scope classification and the next bounded non-tied-candidate frontier.

- [ ] **Step 1: Record only observed evidence**

Document the exact terminal counts and qualification reasons. State that eligible ties validate the
comparison denominator but do not support candidate superiority, adaptive allocation, economic
authority, live authority, or condition generalization. Name distinct post-activation candidate
behavior as the next frontier only if the study remains tied.

- [ ] **Step 2: Run all required verification**

Run:

```bash
npm run typecheck
npm run check:repo-guards
npm test -- --reporter=dot
```

Expected: every workspace typecheck, docs/architecture/naming/env/secret/diff guard, and the full
Vitest suite passes under the repository's four-worker bound.

- [ ] **Step 3: Verify scope and commit**

Confirm `.superpowers/` is absent from staged paths, run `git diff --cached --check`, and commit:

```bash
git add \
  docs/candidate-arena-evaluation-protocol.md \
  docs/superpowers/specs/2026-07-12-candidate-arena-research-evidence-program-design.md \
  docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md \
  docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md
git commit -m "docs: classify qualified comparison cadence evidence"
```
