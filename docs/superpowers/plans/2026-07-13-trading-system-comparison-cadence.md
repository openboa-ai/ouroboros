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
- Freeze both minimum and maximum observation counts at 2 and the evaluator interval/minimum elapsed
  at 25 ms; keep the TradingSystem sandbox cadence independently fixed at 1,000 ms.
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

### Task 1C: Arm-local comparison tick attribution wiring

**Files:**
- Modify: `apps/runtime/test/research-control-campaign-paper-runtime-arm.test.ts`
- Modify: `apps/runtime/test/research-control-campaign-paper-source-window.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign-paper-runtime-arm.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign-paper-source-window.ts`
- Modify: `docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md`

**Interfaces:**
- Consumes: existing arm Store records and
  `PaperTradingSessionService.enableComparisonTickAttributionSide`.
- Produces: `ResearchControlCampaignPaperSourceWindowArm.enableComparisonTickAttribution({
  activationAttemptId, tickId }): Promise<void>` and matched source-window invocation while both
  arms wait for tick acknowledgement.

- [x] **Step 1: Write the failing runtime-arm authority test**

Create an arm with Store getters returning one exact activation attempt and tick. Capture session
enable calls, invoke `arm.enableComparisonTickAttribution`, and assert two calls in role order:

```ts
await arm.enableComparisonTickAttribution({
  activationAttemptId: "attempt-1",
  tickId: "tick-1"
});
expect(calls.map(({ side, authority, tick }) => ({
  role: side.role,
  authorityRole: authority.role,
  operation: authority.operation,
  tickId: tick.paper_trading_comparison_tick_id
}))).toEqual([
  {
    role: "champion",
    authorityRole: "champion",
    operation: "deliver_market_snapshot",
    tickId: "tick-1"
  },
  {
    role: "challenger",
    authorityRole: "challenger",
    operation: "deliver_market_snapshot",
    tickId: "tick-1"
  }
]);
```

- [x] **Step 2: Write source-window success and failure RED tests**

Extend the source-window fixture with `waiting_tick_acknowledgements`, empty acknowledged roles, and
an arm method that records `enable:<arm>:<tick>`. Assert both operations occur for matched waiting
windows. Add `failAttributionArm: "static_control"` and assert the coordinator rejects with
`research_control_campaign_paper_source_window_transition_failed`, calls both arm stop operations,
and leaves no running arm.

- [x] **Step 3: Run the two focused files and confirm RED**

Run:

```bash
npx vitest run \
  apps/runtime/test/research-control-campaign-paper-runtime-arm.test.ts \
  apps/runtime/test/research-control-campaign-paper-source-window.test.ts \
  --reporter=verbose
```

Expected: compilation or behavior fails because the arm operation and source-window invocation do
not exist.

- [x] **Step 4: Implement exact arm-local authority construction**

In the runtime-arm factory, reload the attempt and tick, fail on missing or mismatched IDs, then call
the existing session port for both roles. Build each authority from the persisted attempt and tick:

```ts
{
  paper_trading_comparison_activation_ref: {
    ...attempt.paper_trading_comparison_activation_ref
  },
  paper_trading_comparison_activation_digest:
    attempt.paper_trading_comparison_activation_digest,
  paper_trading_comparison_activation_attempt_ref: {
    record_kind: "paper_trading_comparison_activation_attempt",
    id: attempt.paper_trading_comparison_activation_attempt_id
  },
  paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
  role,
  trading_run_ref: { ...attempt[role].trading_run_ref },
  tick_ref: {
    record_kind: "paper_trading_comparison_tick",
    id: tick.paper_trading_comparison_tick_id
  },
  tick_digest: tick.tick_digest,
  operation: "deliver_market_snapshot"
}
```

- [x] **Step 5: Wire matched waiting windows and fail closed**

After classifying both source snapshots, when every decision has phase
`waiting_tick_acknowledgements` and transition `none`, invoke each arm's operation with its exact
source attempt and latest tick ID. On any rejection, stop every source attempt with
`handoff_cleanup` and throw the existing transition-failed error. Keep ordinary no-op and repeated
tick transitions unchanged.

- [x] **Step 6: Run focused arm, source-window, and paper-runtime tests**

Run:

```bash
npx vitest run \
  apps/runtime/test/research-control-campaign-paper-runtime-arm.test.ts \
  apps/runtime/test/research-control-campaign-paper-source-window.test.ts \
  apps/runtime/test/research-control-campaign-paper-runtime.test.ts \
  --reporter=verbose
```

Expected: all focused tests pass, including exact two-role authority and matched failure cleanup.

- [x] **Step 7: Commit the arm attribution wiring**

```bash
git add \
  apps/runtime/test/research-control-campaign-paper-runtime-arm.test.ts \
  apps/runtime/test/research-control-campaign-paper-source-window.test.ts \
  apps/runtime/src/candidate/arena/research-control-campaign-paper-runtime-arm.ts \
  apps/runtime/src/candidate/arena/research-control-campaign-paper-source-window.ts \
  docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md \
  docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md
git commit -m "feat: enable arm-local comparison tick attribution"
```

### Task 1D: Preserve repeated-checkpoint ownership across arm drivers

**Files:**
- Modify: `apps/runtime/test/research-control-campaign-paper-runtime-arm.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign-paper-runtime-arm.ts`
- Modify: `docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md`

**Interfaces:**
- Consumes: `PaperTradingComparisonCheckpointCoordinator` in-process open-attempt ownership.
- Produces: one arm-lifetime checkpoint coordinator shared by every per-transition window driver.

- [x] **Step 1: Capture the ownership loss as RED**

Create two window drivers from one runtime arm and assert their internal checkpoint coordinator is
the same object. The test must fail against per-driver coordinator construction.

- [x] **Step 2: Hoist checkpoint ownership to the arm lifetime**

Construct `PaperTradingComparisonCheckpointCoordinator` once beside the arm's activation runtime.
Keep `PaperTradingComparisonTickCoordinator` driver-local so frozen repeated-tick market evidence
is still scoped to the exact transition.

- [x] **Step 3: Run focused ownership and source-window regressions**

Run the runtime-arm, source-window, and paper-runtime tests. Then rerun the real prospective study;
the second checkpoint must complete instead of failing with
`paper_trading_comparison_checkpoint_not_owned`.

- [x] **Step 4: Commit the ownership composition fix**

Stage only the runtime arm, its focused test, and these design/plan updates, then commit:

```bash
git commit -m "fix: preserve paper checkpoint ownership"
```

### Task 1E: Make matched no-op window decisions deterministic

**Files:**
- Modify: `apps/runtime/test/research-control-campaign-paper-source-window.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign-paper-source-window.ts`
- Modify: `docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md`

- [x] **Step 1: Capture the acknowledgement TOCTOU as RED**

Assert that matched `waiting_tick_acknowledgements` enables both arm sessions but invokes no
window driver. The current implementation fails because it invokes both drivers after selecting
`none`.

- [x] **Step 2: Return exact no-op steps from the classified snapshots**

After attribution enablement, return one step per source from the already validated decision when
the selected transition is `none`. Preserve phase, checkpoint sequence, terminal state, wake time,
stable error code, IDs, and `not_live` authority.

- [x] **Step 3: Verify race-free cadence and commit with Task 1D**

Run focused source-window/runtime tests and the six-replication prospective study. Commit the
ownership and no-op fixes together only after the real study reaches its next stable outcome.

### Task 1F: Isolate long sandbox runtime identities

**Files:**
- Modify: `apps/runtime/test/sandboxes.test.ts`
- Modify: `packages/adapters/src/sandbox/adapter.ts`
- Modify: `docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md`

- [x] **Step 1: Reproduce truncated runtime-file collision**

Start two long-running deterministic sandboxes whose IDs differ only after the 80-character safe
prefix. Assert their start evidence IDs differ and each log contains only its own instance ID. The
current adapter fails with cross-process log contents.

- [x] **Step 2: Use the full-ID digest in runtime identity keys**

Share one hash-suffixed runtime key across log, heartbeat, and PID filenames. Use the same key for
persisted sandbox log, heartbeat, and command evidence when a safe slug truncates; preserve current
short IDs.

- [x] **Step 3: Verify sandbox isolation and prospective qualification**

Run the focused sandbox test, all sandbox tests, focused source/runtime tests, and the prospective
study. No side may observe its peer's OrderRequest or fail acknowledgement attribution.

### Task 1G: Synchronize matched arm progress

**Files:**
- Modify: `apps/runtime/test/research-control-campaign-paper-source-window.test.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign-paper-source-window.ts`
- Modify: `docs/superpowers/specs/2026-07-13-trading-system-comparison-cadence-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md`

- [x] **Step 1: Reproduce partial open-checkpoint readiness**

Classify one matched arm as `views_advanced/complete_next_checkpoint` and its peer as
`views_advanced/none` at the same checkpoint sequence. Assert that neither driver advances and both
steps remain nonterminal no-ops.

- [x] **Step 2: Reproduce partial next-tick readiness**

Classify one arm as `checkpoint_committed/capture_next_tick` and its peer as
`waiting_tick_acknowledgements/none` at the same checkpoint sequence. Assert that no shared market
read or driver advance occurs.

- [x] **Step 3: Implement the bounded matched-progress barrier**

Defer only the two reproduced nonterminal transition pairs with equal checkpoint sequence. Preserve
the existing partial repeated-tick recovery and reject every other transition or sequence
divergence as an invalid graph.

- [x] **Step 4: Stress the comparison/session regression set**

Run the 12-file, 191-test comparison/session/study regression set repeatedly under the repository's
four-worker bound. Require at least six consecutive clean runs after both barriers are present.

### Task 2: Qualified two-checkpoint prospective study

**Files:**
- Modify: `apps/runtime/test/research-control-study-prospective.integration.test.ts`
- Modify: `docs/superpowers/plans/2026-07-13-trading-system-comparison-cadence.md`

**Interfaces:**
- Consumes: the Task 1 and Task 1B artifact cadences plus Task 1C arm-local attribution wiring.
- Produces: six completed replications containing 12 pair-qualified source verdicts and no policy
  decision.

- [x] **Step 1: Freeze the two-checkpoint protocol**

Change `boundProtocol` and the sandbox fixture cadence:

```ts
minimum_observation_count: 2,
minimum_elapsed_ms: 25,
maximum_observation_count: 2,
```

```ts
sandboxIntervalMs: 1_000,
```

Keep `maximum_elapsed_ms: 600_000`, provider request limit 100, confirmation count 1, and all
authority policies unchanged. The 1,000 ms TradingSystem cadence preserves 100 seconds of polling
under the frozen request cap; do not couple it to the evaluator's 25 ms interval.

- [x] **Step 2: Replace ineligible expectations with qualified-tie expectations**

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

- [x] **Step 3: Run the real-arm integration**

Run:

```bash
npx vitest run \
  apps/runtime/test/research-control-study-prospective.integration.test.ts \
  --reporter=verbose
```

Expected: one test passes with 12 `source_not_improved` terminal slots and empty qualification
reasons. If it fails, classify the first stable product or fixture boundary; do not weaken
qualification or fabricate an acknowledgement.

- [x] **Step 4: Run the comparison/session regression set**

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
