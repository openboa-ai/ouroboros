# ResearchControlStudy Arm Session Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create one Store-bound paper session service and evaluation runner for every isolated
ResearchControlCampaign arm.

**Architecture:** A runtime-layer factory receives shared read-only market data and arm-context
dependency builders. Each invocation validates the exact Store root, resolves arm-specific sandbox
and artifact dependencies, and constructs a fresh `PaperTradingSessionService` with no shared
process ownership.

**Tech Stack:** TypeScript, Vitest, `PaperTradingSessionService`, `PaperTradingEvaluationRunner`,
LocalStore.

## Global Constraints

- Do not add a public command, server auto-start, allocation decision, or promotion behavior.
- Preserve one Store, provider-session map, runtime binding set, sandbox registry, and runner per
  arm service.
- Keep market data read-only and preserve paper-only authority.
- Never stage `.superpowers/`.

---

### Task 1: Arm-local paper session factory

**Files:**
- Create: `apps/runtime/src/candidate/arena/research-control-study-arm-session-factory.ts`
- Create: `apps/runtime/test/research-control-study-arm-session-factory.test.ts`
- Modify: `docs/superpowers/plans/2026-07-13-research-control-study-arm-session-factory.md`

**Interfaces:**
- Consumes: `GatewayMarketDataPort`, `SandboxAdapterRegistryPort`,
  `SystemCodeArtifactResolverPort`, `PaperTradingSessionService`, `PaperTradingEvaluationRunner`,
  `LocalStore`, and `ResearchControlCampaignArmKind`.
- Produces: `createResearchControlStudyArmSessionFactory(options)`, returning an async function that
  accepts `{ root, armKind, store }` and resolves to a real
  `ResearchControlCampaignPaperRuntimeArmSessions`.

- [x] **Step 1: Write the failing Store-routing tests**

Create a test with two `RoutedStore` instances that override `getCandidateForTradingRun` to record
the requested run ID and return `undefined`. Create the factory with context-recording sandbox and
artifact builders, then assert:

```ts
const adaptive = await createSessions({
  root: adaptiveStore.root(),
  armKind: "adaptive_treatment",
  store: adaptiveStore
});
const control = await createSessions({
  root: controlStore.root(),
  armKind: "static_control",
  store: controlStore
});

expect(adaptive).toBeInstanceOf(PaperTradingSessionService);
expect(control).toBeInstanceOf(PaperTradingSessionService);
expect(adaptive).not.toBe(control);
await expect(adaptive.prepare(missingPreparation("adaptive-run")))
  .rejects.toMatchObject({ code: "trading_run_not_found" });
await expect(control.prepare(missingPreparation("control-run")))
  .rejects.toMatchObject({ code: "trading_run_not_found" });
expect(adaptiveStore.requestedRuns).toEqual(["adaptive-run"]);
expect(controlStore.requestedRuns).toEqual(["control-run"]);
```

Add a second test that supplies a mismatched `root` and asserts rejection with
`research_control_study_arm_session_store_root_mismatch` before either dependency builder runs.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-arm-session-factory.test.ts
```

Expected: FAIL because
`research-control-study-arm-session-factory.ts` and
`createResearchControlStudyArmSessionFactory` do not exist.

- [x] **Step 3: Implement the minimal factory**

Create the production module with this public shape:

```ts
export interface ResearchControlStudyArmSessionContext {
  root: string;
  armKind: ResearchControlCampaignArmKind;
  store: LocalStore;
}

export interface ResearchControlStudyArmSessionFactoryOptions {
  marketData: GatewayMarketDataPort;
  createSandboxAdapters(context: ResearchControlStudyArmSessionContext):
    SandboxAdapterRegistryPort | Promise<SandboxAdapterRegistryPort>;
  createArtifactResolver(context: ResearchControlStudyArmSessionContext):
    SystemCodeArtifactResolverPort | Promise<SystemCodeArtifactResolverPort>;
  intervalMs?: number;
  sandboxIntervalMs?: number;
  observationDrainTimeoutMs?: number;
  apiProviderFactory?: PaperTradingSessionServiceOptions["apiProviderFactory"];
  apiProviderOptions?: PaperTradingSessionServiceOptions["apiProviderOptions"];
  logger?: PaperTradingSessionServiceOptions["logger"];
  createRunner?: () => PaperTradingEvaluationRunner;
}

export function createResearchControlStudyArmSessionFactory(
  options: ResearchControlStudyArmSessionFactoryOptions
): (context: ResearchControlStudyArmSessionContext) =>
  Promise<ResearchControlCampaignPaperRuntimeArmSessions>;
```

Validate `context.store.root() === context.root`, resolve both dependency builders with the exact
context, and construct:

```ts
return new PaperTradingSessionService({
  store: context.store,
  sandboxAdapters,
  marketData: options.marketData,
  runner: options.createRunner?.() ?? new PaperTradingEvaluationRunner(),
  artifactResolver,
  ...(options.intervalMs === undefined ? {} : { intervalMs: options.intervalMs }),
  ...(options.sandboxIntervalMs === undefined
    ? {}
    : { sandboxIntervalMs: options.sandboxIntervalMs }),
  ...(options.observationDrainTimeoutMs === undefined
    ? {}
    : { observationDrainTimeoutMs: options.observationDrainTimeoutMs }),
  ...(options.apiProviderFactory ? { apiProviderFactory: options.apiProviderFactory } : {}),
  ...(options.apiProviderOptions ? { apiProviderOptions: options.apiProviderOptions } : {}),
  ...(options.logger ? { logger: options.logger } : {})
});
```

Use one exported error class/code for the direct root mismatch. Do not catch dependency or session
errors; `runResearchControlCampaignToOutcome` already wraps them at the arm-composition boundary.

- [x] **Step 4: Run focused tests and typecheck**

Run:

```bash
npx vitest run apps/runtime/test/research-control-study-arm-session-factory.test.ts apps/runtime/test/research-control-study-runtime.test.ts
npm run typecheck -w @ouroboros/runtime
```

Expected: both files pass and runtime TypeScript reports no errors.

- [x] **Step 5: Run repository guards**

Run:

```bash
npm run check:repo-guards
git diff --check
```

Expected: all guards pass with no whitespace errors.

- [x] **Step 6: Record evidence and commit**

Mark the steps complete and append exact test counts. Stage only the plan, factory, and focused test,
then commit:

```bash
git add -- \
  apps/runtime/src/candidate/arena/research-control-study-arm-session-factory.ts \
  apps/runtime/test/research-control-study-arm-session-factory.test.ts \
  docs/superpowers/plans/2026-07-13-research-control-study-arm-session-factory.md
git commit -m "feat: compose arm-local paper sessions"
```

## Verification Evidence

- RED: the focused test failed because the arm-session factory module did not exist.
- GREEN: the factory and existing study-runtime tests passed 2 files and 15 tests.
- `@ouroboros/runtime` TypeScript validation passed.
- Repository docs, architecture, naming, tracked-env, secret, and diff guards passed.
