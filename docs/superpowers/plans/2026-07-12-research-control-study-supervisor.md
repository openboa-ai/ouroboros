# ResearchControlStudy Supervisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Precommit a study from one exact primary store, then execute and recover every planned
ResearchControlCampaign through terminal paper outcome and final study adjudication.

**Architecture:** Study and campaign progress remain derived from append-only evidence. A concrete
campaign-to-outcome driver composes existing research and paper runtimes; a pure study next-action
projector, one-action executor, and sequential runner add bounded autonomous supervision without a
new progress record.

**Tech Stack:** TypeScript, Vitest, Node filesystem/crypto, existing application services,
LocalStore, CandidateArena campaign runtime, and paper comparison runtime.

## Global Constraints

- Study commitment precedes every planned campaign.
- All planned campaigns use one exact baseline, source, agent, comparator, paper protocol,
  allocation policy, and campaign policy.
- Version 1 executes campaign replications sequentially in precommitted order.
- One executor advance performs at most one complete campaign or one study adjudication.
- No planned campaign or terminal outcome may be skipped, reordered, or rerun after closure.
- Progress is derived from persisted evidence; no StudyRun progress record is added.
- A stop request drains the active campaign and prevents the next replication.
- No policy replacement, promotion, order, private, credential, or live authority is added.
- `.superpowers/` remains untracked and untouched.
- Git commits remain pending while approved escalation is unavailable.

---

### Task 1: Baseline Closure And Runtime Study Commitment

**Files:**
- Modify: `apps/runtime/src/candidate/arena/research-control-campaign.ts`
- Modify: `apps/runtime/test/research-control-campaign.test.ts`
- Add: `apps/runtime/src/candidate/arena/research-control-study-runtime.ts`
- Add: `apps/runtime/test/research-control-study-runtime.test.ts`

**Interfaces:**
- Produces `prepareResearchControlCampaignCommitRequest`,
  `commitResearchControlStudyRuntime`, and a baseline unchanged by control study/campaign evidence.
- Consumes existing source/comparator/protocol resolution and `ResearchControlStudyService`.

- [x] **Step 1: Write failing baseline exclusion test**

Capture a snapshot, add exact files under `research-control-studies` and
`research-control-study-outcomes`, and prove the digest/count/bytes stay equal. Add one ordinary
record file and prove the digest changes.

- [x] **Step 2: Verify RED**

```bash
npx vitest run apps/runtime/test/research-control-campaign.test.ts
```

Expected: study evidence changes the current snapshot.

- [x] **Step 3: Extend the exact exclusion family**

Add only `research-control-studies` and `research-control-study-outcomes` to
`SNAPSHOT_EXCLUDED_COLLECTIONS`. Keep the persisted exclusion policy string unchanged.

- [x] **Step 4: Write failing runtime commitment tests**

Prove one Trading-review/bound-protocol input captures the baseline, derives exact condition parity,
commits 6 deterministic refs before campaigns, creates no campaign effect, replays exactly before
effects, and rejects unavailable comparator, unbound protocol, 5/31 keys, or a pre-existing planned
campaign.

- [x] **Step 5: Extract campaign preparation and implement commitment**

Export:

```ts
prepareResearchControlCampaignCommitRequest(input): Promise<{
  request: ResearchControlCampaignCommitRequest;
  sourceArtifactDirectory: string;
}>;

commitResearchControlStudyRuntime(input): Promise<ResearchControlStudyRecord>;
```

Use the first replication key only for a non-persisted `decideResearchControlCampaign` template,
then project its condition and commit through `ResearchControlStudyService`. Refactor
`runResearchControlCampaign` to use the same preparation function for new campaigns.

- [x] **Step 6: Verify Task 1**

```bash
npx vitest run apps/runtime/test/research-control-campaign.test.ts apps/runtime/test/research-control-study-runtime.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 2: Concrete Campaign-To-Outcome Driver

**Files:**
- Modify: `apps/runtime/src/candidate/arena/research-control-study-runtime.ts`
- Modify: `apps/runtime/test/research-control-study-runtime.test.ts`

**Interfaces:**
- Produces `runResearchControlCampaignToOutcome` and
  `ResearchControlCampaignToOutcomeResult`.
- Consumes `runResearchControlCampaign`, `createResearchControlCampaignPaperRuntime`, arm runtime
  factory, Gateway market data, and `collectResearchControlCampaignOutcome`.

- [x] **Step 1: Write failing composition tests**

Prove the driver runs research first, opens both exact arm roots, starts and drains one paper runner,
requires `completed`, collects exact outcome once, and returns the campaign/outcome closure. Cover
replay with an already terminal outcome.

- [x] **Step 2: Write failing status tests**

Reject paper runtime `failed`, `stopped`, `idle`, or still-`running` after drain with stable runtime
error codes. Prove no collection occurs on failure.

- [x] **Step 3: Implement the driver**

Accept the existing campaign run input minus `paperExecutor`, one market-data port, one exact arm
runtime factory, optional sleep, and bounded constructor seams for deterministic tests. Never accept
caller-supplied campaign/outcome records.

- [x] **Step 4: Verify Task 2**

```bash
npx vitest run apps/runtime/test/research-control-study-runtime.test.ts apps/runtime/test/research-control-campaign-paper-runtime.test.ts apps/runtime/test/research-control-campaign-paper-runner.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 3: Pure Study Next-Action Projection

**Files:**
- Add: `apps/runtime/src/candidate/arena/research-control-study-next-action.ts`
- Add: `apps/runtime/test/research-control-study-next-action.test.ts`

**Interfaces:**
- Produces `ResearchControlStudyNextAction`,
  `ProjectResearchControlStudyNextActionInput`, and
  `projectResearchControlStudyNextAction`.
- Consumes an exact study, one aligned optional campaign/outcome entry per replication, and optional
  study outcome.

- [x] **Step 1: Write failing action table**

Cover fresh first campaign, resumed first campaign, next campaign after exact terminal closure,
adjudication after all terminal outcomes, and complete after exact study outcome.

- [x] **Step 2: Write failing graph-adversary table**

Reject malformed study digest, wrong evidence length/index/ref, outcome without campaign, duplicate
campaign/outcome refs, later evidence crossing an earlier incomplete replication, baseline,
condition, idempotency, campaign digest, campaign outcome digest/metric, and time drift, plus a study
outcome before complete source closure.

- [x] **Step 3: Implement strict pure projection**

Recompute study/campaign/outcome digests, project campaign condition through the application helper,
and return only the earliest legal action. No clock, I/O, or effects belong in this module.

- [x] **Step 4: Verify Task 3**

```bash
npx vitest run apps/runtime/test/research-control-study-next-action.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 4: One-Action Study Executor

**Files:**
- Add: `apps/runtime/src/candidate/arena/research-control-study-executor.ts`
- Add: `apps/runtime/test/research-control-study-executor.test.ts`

**Interfaces:**
- Produces `ResearchControlStudyExecutor`, `ResearchControlStudyExecutorStep`, and stable executor
  errors.
- Consumes `OuroborosStorePort`, the Task 3 projector, one injected exact campaign-to-outcome action,
  and `ResearchControlStudyOutcomeService`.

- [x] **Step 1: Write failing executor sequence test**

With six planned replications, prove each advance invokes only the earliest incomplete campaign,
reloads exact persisted campaign/outcome bytes, and never adjudicates before all six terminal
closures. The seventh action adjudicates; the eighth is effect-free complete replay.

- [x] **Step 2: Write failing recovery tests**

Preload a campaign without outcome and prove resume of that same key. Preload terminal prefixes and
prove execution starts at the next exact replication. Preload the study outcome and prove no
campaign callback or adjudication.

- [x] **Step 3: Write failing persistence/adversary tests**

Reject missing study, ambiguous outcomes, callback wrong campaign ID/digest, callback return not
persisted exactly, source graph mutation between action and reload, and outcome service conflict.

- [x] **Step 4: Implement executor**

Load each planned campaign by ref, group campaign outcomes by campaign ref with at-most-one
cardinality, project one action, execute it, then reload and deep-compare exact persisted evidence.
Use the application outcome service for final inference.

- [x] **Step 5: Verify Task 4**

```bash
npx vitest run apps/runtime/test/research-control-study-next-action.test.ts apps/runtime/test/research-control-study-executor.test.ts packages/application/src/candidate/research-control-study-outcome.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 5: Sequential Study Runner

**Files:**
- Add: `apps/runtime/src/candidate/arena/research-control-study-runner.ts`
- Add: `apps/runtime/test/research-control-study-runner.test.ts`

**Interfaces:**
- Produces `ResearchControlStudyRunner` and `ResearchControlStudyRunnerStatus`.
- Consumes only `ResearchControlStudyExecutor.advance`.

- [x] **Step 1: Write failing lifecycle tests**

Prove idle -> running -> completed, exact step order, already-complete replay, and only one active
study. Prove the runner does not introduce sleeps or parallel campaign calls.

- [x] **Step 2: Write failing stop/failure tests**

Use a deferred campaign step to prove `stop()` drains it, records `stopped`, and never starts the
next replication. Prove a typed executor error becomes stable `failed` status and drain resolves.

- [x] **Step 3: Implement runner**

Mirror the existing campaign paper runner lifecycle but check stop only between executor calls.
Treat `study_adjudicated` as advanced and continue once to observe effect-free `complete`.

- [x] **Step 4: Verify Task 5**

```bash
npx vitest run apps/runtime/test/research-control-study-runner.test.ts apps/runtime/test/research-control-study-executor.test.ts
npm run typecheck --workspace @ouroboros/runtime
```

---

### Task 6: Durable Truth And Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `docs/autonomy-model.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/superpowers/specs/2026-07-12-research-control-study-supervisor-design.md`
- Modify: `docs/superpowers/plans/2026-07-12-research-control-study-supervisor.md`

**Interfaces:**
- Consumes verified supervisor behavior.
- Produces canonical current-state truth, exact evidence, and the next frontier.

- [x] **Step 1: Update canonical docs**

Document derived study progress, sequential campaign boundary, exact restart behavior, internal
runtime-only status, and absence of a policy decision/public supervisor.

- [x] **Step 2: Run focused and required checks**

```bash
npx vitest run apps/runtime/test/research-control-study*.test.ts packages/domain/src/research-control-study*.test.ts packages/application/src/candidate/research-control-study*.test.ts packages/local-store/test/research-control-study.test.ts
npx vitest run apps/runtime/test/research-control-campaign*.test.ts packages/application/src/candidate/research-control-campaign*.test.ts packages/domain/src/research-control-campaign*.test.ts packages/local-store/test/research-control-campaign.test.ts
npm run typecheck --workspaces --if-present
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
npm test
```

Classify the known listener/`tsx` IPC `EPERM` set separately if the command sandbox still denies
local listeners.

- [x] **Step 3: Record frontier decision**

Follow-on frontiers now implement one-shot process discovery and one separate exact-digest research
allocation policy decision. Listener-capable end-to-end study evidence remains next, followed by
distinct-regime and memory/agent factorial studies; TradingPromotion remains unrelated.

- [ ] **Step 4: Commit when escalation is available**

Stage only explicit repository paths from the study, paper, and supervisor plans. Never stage
`.superpowers/`. If escalation remains quota-blocked, preserve the verified diff and record that
single blocker without retrying another path.

## Verification Evidence

- Study contract, persistence, runtime commitment, next action, executor, and runner focus: 9 files
  and 115 tests passed.
- Full ResearchControlCampaign and paper regression focus: 23 files and 385 tests passed.
- All workspace TypeScript checks and the Operator Desktop Rust check passed.
- Docs, architecture, naming, tracked-env, secret, and diff guards passed.
- The full repository run completed with 153 of 163 files and 2,555 of 2,619 tests passing. The same
  64 listener-dependent tests failed because the command sandbox denied local TCP, Unix-socket, or
  `tsx` IPC listeners with `EPERM`; no study supervisor test failed.
- The internal supervisor is verified without network listeners. This is not actual prospective
  replicated study evidence, a deployed process-discovery service, or a policy decision.
- Commit remains blocked by the approved escalation quota until 2026-07-18 15:20 KST.
