# ResearchControlStudy Automatic Commitment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the default runtime server deterministically commit one bounded ResearchControlStudy per exact reviewed source before scheduler discovery.

**Architecture:** Strengthen ResearchControlStudy publication with create-only filesystem semantics, pin runtime preparation to one expected TradingPromotion, and add a focused `ResearchControlStudyCommitmentCoordinator`. The existing scheduler invokes that coordinator once before each bounded discovery cycle, while buildServer supplies the current managed-agent identity and repository-fixed policy.

**Tech Stack:** TypeScript, Node filesystem hard-link atomics, LocalStore, existing ResearchControlStudy runtime, Fastify lifecycle, Vitest.

## Global Constraints

- Keep `ResearchControlStudy` as the only persisted pre-effect commitment; add no parallel job or intent record.
- Repository policy v1 fixes one incomplete study maximum, 6 replications, 1 tick per arm, 10,000 baseline files, and 1,000,000,000 baseline bytes.
- Derive paper comparison inputs from the exact TradingPromotion confirmation campaign; do not add an environment-controlled protocol default.
- Same-host same-root races publish one complete record and never overwrite an existing study.
- Missing prerequisites defer; malformed, drifted, or conflicting evidence fails closed.
- Automatic commitment owns research scheduling only and creates no policy decision, promotion, order, private, or live authority.
- Keep multi-host fencing, automatic policy decisions, automatic promotion, champion handoff, distinct-regime claims, and Goal completion out of scope.
- Do not touch, stage, or remove the existing untracked `.superpowers/` path.

---

### Task 1: Atomic ResearchControlStudy Publication

**Files:**
- Modify: `packages/local-store/src/index.ts`
- Modify: `packages/local-store/test/research-control-study.test.ts`

**Interfaces:**
- Consumes: validated `ResearchControlStudyRecord` and the existing encoded item path.
- Produces: `LocalStore.recordResearchControlStudy` with atomic create-only publication across independent LocalStore instances.

- [ ] **Step 1: Write failing cross-instance publication tests**

Add tests using two `LocalStore` objects over one temporary root. Publish one exact study concurrently and require both calls to return the same bytes. Then publish two valid records with the same deterministic ID but different `committed_at` and resealed digest; require exactly one fulfillment, one `research_control_study_conflict`, and one complete persisted winner.

```ts
const left = new LocalStore(root);
const right = new LocalStore(root);
await Promise.all([left.initialize(), right.initialize()]);
const study = studyFixture();
await expect(Promise.all([
  left.recordResearchControlStudy(study),
  right.recordResearchControlStudy(structuredClone(study))
])).resolves.toEqual([study, study]);

const changed = structuredClone(studyFixture());
changed.committed_at = "2026-07-13T00:00:01.000Z";
resealStudy(changed);
const settled = await Promise.allSettled([
  left.recordResearchControlStudy(studyFixture()),
  right.recordResearchControlStudy(changed)
]);
expect(settled.filter((item) => item.status === "fulfilled")).toHaveLength(1);
expect(settled.filter((item) => item.status === "rejected")[0])
  .toMatchObject({ reason: { code: "research_control_study_conflict" } });
```

- [ ] **Step 2: Run the LocalStore test and verify RED**

Run:

```bash
npx vitest run packages/local-store/test/research-control-study.test.ts
```

Expected: at least one race fails because both instances use the shared `.tmp` rename path or an existing study can be overwritten.

- [ ] **Step 3: Add complete create-only JSON publication**

Import `link`, `unlink`, and `randomUUID`. Add a private helper that writes a unique non-collection temporary file, atomically links complete bytes to the final path, and reports whether it created the final record.

```ts
private async writeJsonCreateOnly(
  filePath: string,
  value: unknown
): Promise<"created" | "exists"> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await link(temporaryPath, filePath);
    return "created";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return "exists";
    throw error;
  } finally {
    await unlink(temporaryPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
```

Use it only for ResearchControlStudy after the existing validation and campaign-precedence checks. On `exists`, reload the final record and return it only when exact JSON matches; otherwise throw the existing append-only conflict.

- [ ] **Step 4: Verify LocalStore regression and types**

Run:

```bash
npx vitest run packages/local-store/test/research-control-study.test.ts
npm run typecheck --workspace @ouroboros/local-store
```

Expected: all ResearchControlStudy tests pass and LocalStore has zero type errors.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/local-store/src/index.ts packages/local-store/test/research-control-study.test.ts
git commit -m "fix: publish research studies atomically"
```

---

### Task 2: Pin Study Preparation To One TradingPromotion

**Files:**
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-runtime.ts`
- Modify: `apps/runtime/test/research-control-study-runtime.test.ts`

**Interfaces:**
- Consumes: latest TradingPromotion resolved by the existing campaign preparation path.
- Produces: optional `expectedTradingPromotionId` on campaign preparation, campaign execution, and study commitment inputs.

- [ ] **Step 1: Write failing promotion-pin tests**

In the runtime commitment tests, pass the exact fixture promotion ID and require success. Pass a different ID and require failure before any study or campaign exists.

```ts
const promotion = await store.getLatestTradingPromotion();
await expect(commitResearchControlStudyRuntime({
  ...studyCommitInput(store, studyReplicationKeys()),
  expectedTradingPromotionId: promotion!.trading_promotion_id
})).resolves.toMatchObject({
  condition: {
    paper_comparator: {
      trading_promotion_ref: { id: promotion!.trading_promotion_id }
    }
  }
});

await expect(commitResearchControlStudyRuntime({
  ...studyCommitInput(otherStore, studyReplicationKeys()),
  expectedTradingPromotionId: "different-promotion"
})).rejects.toMatchObject({
  code: "research_control_study_runtime_condition_invalid"
});
expect(await otherStore.listResearchControlStudies()).toEqual([]);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-runtime.test.ts
```

Expected: TypeScript transform or assertion failure because the expected-promotion field is not enforced.

- [ ] **Step 3: Thread and enforce the expected promotion**

Add the optional field to `PrepareResearchControlCampaignCommitRequestInput`, `RunResearchControlCampaignInput`, and `CommitResearchControlStudyRuntimeInput`:

```ts
expectedTradingPromotionId?: string;
```

Pass it through every preparation call. Change comparator resolution to reject an unavailable or different latest promotion when an expected ID is supplied.

```ts
async function resolvePaperComparator(
  store: LocalStore,
  expectedTradingPromotionId?: string
): Promise<ResearchControlCampaignPaperComparator> {
  const promotion = await store.getLatestTradingPromotion();
  if (expectedTradingPromotionId &&
      promotion?.trading_promotion_id !== expectedTradingPromotionId) {
    throw runtimeError(
      "research_control_campaign_source_candidate_invalid",
      "ResearchControlCampaign Trading review comparator changed before commitment."
    );
  }
  // Preserve the existing exact shape and unavailable behavior.
}
```

Map this preparation failure to `research_control_study_runtime_condition_invalid` in the study commitment boundary. Existing callers that omit the field retain current behavior.

- [ ] **Step 4: Verify runtime regression and types**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-runtime.test.ts apps/runtime/test/research-control-study-prospective.integration.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

Expected: exact pinning and all existing study runtime behavior pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/runtime/src/candidate/arena/research-control-campaign.ts apps/runtime/src/candidate/arena/research-control-study-runtime.ts apps/runtime/test/research-control-study-runtime.test.ts
git commit -m "feat: pin study commitment promotion"
```

---

### Task 3: Deterministic Commitment Coordinator

**Files:**
- Create: `apps/runtime/src/candidate/arena/research-control-study-commitment-coordinator.ts`
- Create: `apps/runtime/test/research-control-study-commitment-coordinator.test.ts`
- Reuse fixture: `apps/runtime/test/fixtures/research-control-study/trading-review-store`

**Interfaces:**
- Consumes: `LocalStore`, current managed-agent identity callback, exact latest TradingPromotion graph, and `commitResearchControlStudyRuntime`.
- Produces: `RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY`, `ResearchControlStudyCommitmentResult`, and `ResearchControlStudyCommitmentCoordinator.ensureCommittedStudy()`.

- [ ] **Step 1: Write failing policy, prerequisite, and idempotency tests**

Cover the public behavior:

```ts
expect(RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY).toEqual({
  policy_version: "research-control-study-commitment-v1",
  trigger: "latest_trading_promotion",
  maximum_incomplete_study_count: 1,
  replication_count: 6,
  tick_count_per_arm: 1,
  maximum_baseline_regular_file_count: 10_000,
  maximum_baseline_total_bytes: 1_000_000_000
});

await expect(new ResearchControlStudyCommitmentCoordinator({
  store: emptyStore,
  researchAgentIdentity: () => fixtureAgent.agent
}).ensureCommittedStudy()).resolves.toEqual({
  status: "deferred",
  reason: "no_trading_promotion"
});
```

Copy the existing trading-review fixture to a temporary root, ensure one study, and assert six exact replication keys, source candidate/version equality with the promotion, one-tick bounds, derived schedule policy, and no campaign/outcome/decision side effects. A second call must return `existing` with the same study ID.

Add a store with a different pending study and require `deferred/pending_study_exists`. Inject a commit function that makes an exact winner visible then throws, and require winner reload acceptance; a mismatched winner must throw a stable coordinator error.

- [ ] **Step 2: Run the coordinator test and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-commitment-coordinator.test.ts
```

Expected: import failure because the coordinator and policy do not exist.

- [ ] **Step 3: Implement exact result, policy, and errors**

Use these public shapes:

```ts
export const RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY = Object.freeze({
  policy_version: "research-control-study-commitment-v1" as const,
  trigger: "latest_trading_promotion" as const,
  maximum_incomplete_study_count: 1 as const,
  replication_count: 6 as const,
  tick_count_per_arm: 1 as const,
  maximum_baseline_regular_file_count: 10_000,
  maximum_baseline_total_bytes: 1_000_000_000
});

export type ResearchControlStudyCommitmentResult =
  | { status: "committed" | "existing"; studyId: string }
  | {
      status: "deferred";
      reason: "no_trading_promotion" | "pending_study_exists";
      pendingStudyId?: string;
    };

export class ResearchControlStudyCommitmentCoordinatorError extends Error {
  readonly code = "research_control_study_commitment_failed";
}
```

- [ ] **Step 4: Derive the sealed protocol and deterministic key**

Load the confirmation campaign referenced by the promotion and require exact ref/digest equality. Derive the protocol input with copied comparison, market, and paper-policy fields plus this schedule:

```ts
const protocol = {
  protocol_status: "bound" as const,
  comparison_policy: structuredClone(campaign.comparison_policy),
  market_data_configuration_digest:
    campaign.market_data_configuration_digest,
  paper_policy_identity: structuredClone(campaign.paper_policy_identity),
  schedule_policy: {
    policy_version: "research-control-paper-schedule-v1" as const,
    source_start_order: "paired_by_sequence" as const,
    maximum_active_source_pairs: 2 as const,
    maximum_cross_arm_first_tick_skew_ms:
      campaign.comparison_policy.maximum_start_skew_ms,
    source_missed_start_policy: "slot_expired" as const,
    confirmation_precommit_deadline_ms:
      campaign.comparison_policy.maximum_elapsed_ms
  }
};
```

Hash canonical policy, promotion ref/digest, campaign ref/digest, candidate refs, agent identity digest, and protocol input. Build one study key and six ordered replication keys from that digest.

- [ ] **Step 5: Implement ensure, queue bound, and race reload**

`ensureCommittedStudy` must:

1. load studies and outcomes and derive incomplete studies with `discoverResearchControlStudyProcessQueue`;
2. load latest promotion and current agent identity;
3. derive the exact intent key and return `existing` after validating an exact existing study;
4. defer if another study is incomplete;
5. call `commitResearchControlStudyRuntime` with promoted source, exact agent, fixed bounds, derived protocol, and expected promotion ID;
6. on any commit error, reload the deterministic ID and accept only an exact-intent winner;
7. otherwise throw `ResearchControlStudyCommitmentCoordinatorError` with the original cause.

The exact-intent validator must compare study key, source candidate/version, promotion ref/digest,
agent identity, bound protocol input/digest, campaign policy bounds, repository allocation policy,
and all six replication keys. It must not compare the race-winning baseline digest or timestamp.

- [ ] **Step 6: Verify coordinator and related runtime tests**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-commitment-coordinator.test.ts apps/runtime/test/research-control-study-runtime.test.ts packages/local-store/test/research-control-study.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

Expected: all coordinator, pinning, and atomic Store tests pass.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/runtime/src/candidate/arena/research-control-study-commitment-coordinator.ts apps/runtime/test/research-control-study-commitment-coordinator.test.ts
git commit -m "feat: ensure bounded research studies"
```

---

### Task 4: Scheduler Commitment Cycle And Status

**Files:**
- Modify: `apps/runtime/src/candidate/arena/research-control-study-scheduler.ts`
- Modify: `apps/runtime/src/candidate/arena/research-control-study-server-runtime.ts`
- Modify: `apps/runtime/test/research-control-study-scheduler.test.ts`
- Modify: `apps/runtime/test/research-control-study-server-runtime.test.ts`

**Interfaces:**
- Consumes: `Pick<ResearchControlStudyCommitmentCoordinator, "ensureCommittedStudy">`.
- Produces: pre-discovery commitment and optional `lastCommitment` in scheduler status.

- [ ] **Step 1: Write failing scheduler-order and failure tests**

Use a recording coordinator and supervisor. Prove `commit` precedes `supervisor-start`, a committed
study is discoverable in the same cycle, deferred status still enters one bounded wait, and a
coordinator error produces terminal scheduler failure without starting the supervisor.

```ts
const events: string[] = [];
const scheduler = new ResearchControlStudyScheduler({
  commitmentCoordinator: {
    async ensureCommittedStudy() {
      events.push("commit");
      return { status: "deferred", reason: "no_trading_promotion" };
    }
  },
  supervisor: recordingSupervisor(events),
  now: clock.now,
  sleep: clock.sleep
});
scheduler.start();
await clock.waiting();
expect(events).toEqual(["commit", "supervisor-start"]);
expect(scheduler.status()).toMatchObject({
  lastCommitment: { status: "deferred", reason: "no_trading_promotion" }
});
```

- [ ] **Step 2: Run scheduler tests and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/research-control-study-server-runtime.test.ts
```

Expected: constructor/type failure because the coordinator dependency and status are absent.

- [ ] **Step 3: Invoke commitment before every discovery cycle**

Extend scheduler options with:

```ts
commitmentCoordinator?: {
  ensureCommittedStudy(): Promise<ResearchControlStudyCommitmentResult>;
};
```

At the start of each loop iteration, await it before `supervisor.start()`. Store a cloned successful
result and expose it as optional `lastCommitment` from `status()`. Preserve the exact old status
shape when no coordinator is configured. Let existing stable-error mapping make thrown coordinator
errors terminal before any runtime opens.

Pass the optional coordinator through `CreateResearchControlStudyServerSchedulerInput` to the
scheduler. Do not pass it into the process supervisor or execution lease.

- [ ] **Step 4: Verify scheduler/server-runtime regression and types**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/research-control-study-server-runtime.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

Expected: all scheduler tests pass with no behavior change on the unconfigured path.

- [ ] **Step 5: Commit Task 4**

```bash
git add apps/runtime/src/candidate/arena/research-control-study-scheduler.ts apps/runtime/src/candidate/arena/research-control-study-server-runtime.ts apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/research-control-study-server-runtime.test.ts
git commit -m "feat: commit studies before discovery"
```

---

### Task 5: Default Runtime-Server Composition

**Files:**
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/test/server.test.ts`

**Interfaces:**
- Consumes: Task 3 coordinator and Task 4 server-scheduler input.
- Produces: default automatic commitment using current agent selection, plus explicit coordinator injection for tests.

- [ ] **Step 1: Write failing server composition tests**

Add a recording coordinator to `BuildServerOptions`, start the default scheduler against an empty
Store, and require one `ensureCommittedStudy` call before scheduler waiting. Verify
`runResearchControlStudiesOnStart: false` makes zero calls. Use the exported server helper against a
copy of the trading-review fixture to prove the default policy commits one study with the current
fixture agent and returns existing on replay.

- [ ] **Step 2: Run server tests and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/server.test.ts
```

Expected: option/helper import failure because server composition does not create or inject the coordinator.

- [ ] **Step 3: Compose the default coordinator once per server**

Add:

```ts
researchControlStudyCommitmentCoordinator?: Pick<
  ResearchControlStudyCommitmentCoordinator,
  "ensureCommittedStudy"
>;
```

Export a focused helper:

```ts
export function createResearchControlStudyServerCommitmentCoordinator(input: {
  store: LocalStore;
  researchAgentIdentity: () => ManagedResearchAgent;
  repoRoot?: string;
}): ResearchControlStudyCommitmentCoordinator {
  return new ResearchControlStudyCommitmentCoordinator(input);
}
```

When the scheduler itself is not injected, create one coordinator after persisted researcher
selection is restored. Its identity callback reads `candidateArenaRunner.researchAgent()` and then
returns `tradingResearchAgentFactory(provider).agent`, so later provider selection applies on the
next cycle. Pass the coordinator and existing lease session factory into
`createResearchControlStudyServerScheduler`.

Do not call the coordinator outside scheduler start; the existing disabled-start option therefore
performs no automatic write.

- [ ] **Step 4: Verify server and full study-scheduler focused tests**

Run:

```bash
npx vitest run apps/runtime/test/server.test.ts apps/runtime/test/research-control-study-commitment-coordinator.test.ts apps/runtime/test/research-control-study-scheduler.test.ts apps/runtime/test/research-control-study-server-runtime.test.ts packages/local-store/test/research-control-study.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

Expected: default composition, disabled path, atomic commitment, and scheduler lifecycle all pass.

- [ ] **Step 5: Commit Task 5**

```bash
git add apps/runtime/src/server.ts apps/runtime/test/server.test.ts
git commit -m "feat: start bounded research studies automatically"
```

---

### Task 6: Durable Truth, Full Verification, And Promotion Review

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/naming-taxonomy.md` only if the internal coordinator needs durable vocabulary clarification.
- Modify: `docs/superpowers/specs/2026-07-13-research-control-study-automatic-commitment-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-research-control-study-automatic-commitment.md`

**Interfaces:**
- Consumes: verified implementation from Tasks 1-5.
- Produces: canonical current truth, exact validation evidence, and next bounded frontier selection.

- [ ] **Step 1: Update canonical docs with proven behavior**

Record only verified claims:

- one exact latest TradingPromotion and sealed confirmation graph can create one study;
- one pending study bounds the queue;
- repository policy fixes six one-tick replications and baseline limits;
- same-key same-root races publish one winner;
- missing prerequisites defer and corrupt evidence halts;
- scheduler status exposes bounded operational commitment state;
- no automatic policy decision, promotion, handoff, private, or live authority exists.

Remove automatic commitment from current-gap lists. Keep distinct-regime/forward-time scheduling,
automatic policy decisions, automatic promotion, handoff, multi-host ownership, soak, and P0 open.

- [ ] **Step 2: Run full verification**

Run:

```bash
npx vitest run
npm run typecheck
npm run check:repo-guards
```

Expected: zero failing tests, zero type errors, and all repository guards green.

- [ ] **Step 3: Record exact evidence and self-review the frontier**

Update the design status to implemented and verified, check every plan box, and record exact commit
hashes, test-file/test counts, type checks, and guard result. Confirm the worktree contains only the
existing untracked `.superpowers/` path.

Select the next frontier from current evidence. Prefer automatic, exact
`ResearchAllocationPolicyDecision` creation after a terminal eligible study if no higher-severity
correctness gap appears; keep automatic promotion separate.

- [ ] **Step 4: Commit durable truth**

```bash
git add AGENTS.md README.md ARCHITECTURE.md docs/project-direction.md docs/candidate-arena-research-goal.md docs/candidate-arena-evaluation-protocol.md docs/naming-taxonomy.md docs/superpowers/specs/2026-07-13-research-control-study-automatic-commitment-design.md docs/superpowers/plans/2026-07-13-research-control-study-automatic-commitment.md
git commit -m "docs: record automatic study commitment"
```
