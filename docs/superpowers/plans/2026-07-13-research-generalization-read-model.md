# ResearchGeneralization Read Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose exact prospective ResearchGeneralizationProtocol progress and latest
ResearchGeneralizationOutcome evidence through one authority-closed CandidateArena read model shared
by HTTP, CLI, TUI, and Web Research.

**Architecture:** A pure application builder validates and projects complete protocol, study, study
outcome, and generalization outcome arrays into one required domain read model. CandidateArena loads
the records and delegates once; every operator surface renders only that shared projection and never
reads raw store records.

**Tech Stack:** TypeScript, Vitest, LocalStore, Fastify inject tests, React server rendering, Ink
testing, existing Ouroboros design-system sections.

## Global Constraints

- Do not feed this projection into CandidateArenaResearchAllocation or ResearchWorker context.
- Do not add a command, mutation, rank, qualification, policy decision, promotion, order, private,
  or live authority.
- Keep raw kline windows, source artifacts, digests, study IDs, campaign IDs, and per-slot effects
  out of the compact read model.
- Use `ResearchGeneralizationReadModel`, `research_generalization`, `not_started`, `collecting`,
  `awaiting_outcome`, and `closed` exactly.
- Sort the active protocol oldest-first by commitment time and ID; sort the latest outcome
  newest-first by adjudication time and ID.
- Fail corrupt source graphs with code `research_generalization_read_model_graph_invalid`.

---

### Task 1: Pure ResearchGeneralization Projection

**Files:**

- Modify: `packages/domain/src/index.ts`
- Create: `packages/application/src/candidate/research-generalization-read-model.ts`
- Create: `packages/application/src/candidate/research-generalization-read-model.test.ts`
- Modify: `packages/application/src/index.ts`

**Interfaces:**

- Consumes: `ResearchGeneralizationProtocolRecord[]`, `ResearchControlStudyRecord[]`,
  `ResearchControlStudyOutcomeRecord[]`, and `ResearchGeneralizationOutcomeRecord[]`.
- Produces:

```ts
export interface ResearchGeneralizationReadModel {
  status: "not_started" | "collecting" | "awaiting_outcome" | "closed";
  protocol_count: number;
  outcome_count: number;
  active_protocol: ResearchGeneralizationActiveProtocolReadModel | null;
  latest_outcome: ResearchGeneralizationLatestOutcomeReadModel | null;
  authority_status: "not_promotion_authority";
}

export function buildResearchGeneralizationReadModel(input: {
  protocols: ResearchGeneralizationProtocolRecord[];
  studies: ResearchControlStudyRecord[];
  studyOutcomes: ResearchControlStudyOutcomeRecord[];
  outcomes: ResearchGeneralizationOutcomeRecord[];
}): ResearchGeneralizationReadModel;
```

- [ ] **Step 1: Write failing empty and progress tests**

Add tests that expect an empty projection and an oldest active protocol with canonical block rows:

```ts
expect(buildResearchGeneralizationReadModel({
  protocols: [], studies: [], studyOutcomes: [], outcomes: []
})).toEqual({
  status: "not_started",
  protocol_count: 0,
  outcome_count: 0,
  active_protocol: null,
  latest_outcome: null,
  authority_status: "not_promotion_authority"
});

expect(readModel.active_protocol).toMatchObject({
  status: "collecting",
  planned_study_count: 6,
  assigned_study_count: 2,
  terminal_study_count: 1,
  next_action: "collect_precommitted_studies",
  condition_blocks: [
    { condition_block: "long", planned_study_count: 2 },
    { condition_block: "short", planned_study_count: 2 },
    { condition_block: "flat", planned_study_count: 2 }
  ],
  authority_status: "research_only"
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npx vitest run packages/application/src/candidate/research-generalization-read-model.test.ts
```

Expected: failure because the read-model module and domain interfaces do not exist.

- [ ] **Step 3: Add exact domain read-model interfaces**

Define active protocol, condition-block progress, latest outcome, and top-level interfaces. Use
`null` for absent active/latest records and literal false authority fields on the latest outcome:

```ts
policy_replacement_authority: false;
promotion_authority: false;
order_submission_authority: false;
live_exchange_authority: false;
authority_status: "not_live";
```

- [ ] **Step 4: Implement deterministic empty and active projection**

Implement exact identity maps, canonical `long`, `short`, `flat` order, oldest missing-outcome
selection, slot assignment matching, terminal counting, and deterministic next action. Copy arrays
before returning.

- [ ] **Step 5: Add failing closed/latest and simultaneous active/latest tests**

Assert all compact outcome fields are copied from the newest exact outcome and that a newer active
protocol can coexist with a prior latest outcome:

```ts
expect(readModel).toMatchObject({
  status: "collecting",
  protocol_count: 2,
  outcome_count: 1,
  active_protocol: { research_generalization_protocol_id: "protocol-002" },
  latest_outcome: {
    research_generalization_outcome_id: "outcome-001",
    inference_status: "generalization_not_supported",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false
  }
});
```

- [ ] **Step 6: Add failing corruption, ordering, and immutability tests**

Cover duplicate identities, orphan outcome refs, mismatched slot assignment, an outcome without its
study, shuffled input arrays, and attempted mutation of returned harmful blocks/condition blocks.
Every graph failure must expose the stable error code.

- [ ] **Step 7: Complete strict projection and export it**

Implement the latest-outcome projection, strict graph checks, clone boundaries, and export from
`packages/application/src/index.ts`.

- [ ] **Step 8: Run focused tests and package typechecks**

Run:

```bash
npx vitest run packages/application/src/candidate/research-generalization-read-model.test.ts
npm run typecheck --workspace @ouroboros/domain
npm run typecheck --workspace @ouroboros/application
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add packages/domain/src/index.ts packages/application/src/index.ts packages/application/src/candidate/research-generalization-read-model.ts packages/application/src/candidate/research-generalization-read-model.test.ts
git commit -m "feat: project research generalization evidence"
```

### Task 2: CandidateArena And Operator Composition

**Files:**

- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/server.test.ts`
- Modify: any typed `CandidateArenaReadModel` fixtures reported by TypeScript

**Interfaces:**

- Consumes: `buildResearchGeneralizationReadModel` from Task 1 and the existing store list methods.
- Produces: required `CandidateArenaReadModel.research_generalization` for `GET /api/operator`,
  `GET /api/arena`, and `arena.status`.

- [ ] **Step 1: Write failing operator readback tests**

In `server.test.ts`, assert an empty store returns the canonical empty projection. Add one LocalStore
fixture with a committed protocol and assert `/api/operator` returns `collecting` and exact block
counts without raw kline arrays, digests, or study IDs.

- [ ] **Step 2: Run the server tests and confirm RED**

```bash
npx vitest run apps/runtime/test/server.test.ts
```

Expected: `candidate_arena.research_generalization` is absent.

- [ ] **Step 3: Load and project exact graph arrays in CandidateArena**

In `buildCandidateArenaReadModel`, load protocols and outcomes. Load studies and study outcomes when
the store methods are available, delegate to the pure builder, and assign the result in the initial
arena object. Legacy partial test doubles without any generalization list methods must receive the
canonical empty projection; a partial presence of methods must fail rather than mix data sources.

- [ ] **Step 4: Update typed fixtures with canonical empty projection**

Use this exact value where tests construct a `CandidateArenaReadModel` directly:

```ts
research_generalization: {
  status: "not_started",
  protocol_count: 0,
  outcome_count: 0,
  active_protocol: null,
  latest_outcome: null,
  authority_status: "not_promotion_authority"
}
```

- [ ] **Step 5: Run application/runtime tests and typechecks**

```bash
npx vitest run packages/application/src/candidate/research-generalization-read-model.test.ts apps/runtime/test/server.test.ts
npm run typecheck --workspace @ouroboros/application
npm run typecheck --workspace @ouroboros/runtime
```

Expected: all pass and no read triggers a write or scheduler lifecycle.

- [ ] **Step 6: Commit**

```bash
git add packages/application/src/candidate/arena.ts apps/runtime/test/server.test.ts apps/runtime/test apps/operator-web/src/App.test.tsx
git commit -m "feat: expose generalization in operator state"
```

Stage only fixture files actually changed; do not stage unrelated runtime tests.

### Task 3: CLI, TUI, And Web Research Parity

**Files:**

- Modify: `apps/cli/src/ouroboros-cli.ts`
- Modify: `apps/runtime/test/ouroboros-cli.test.ts`
- Modify: `apps/operator-tui/src/operator-tui.tsx`
- Modify: `apps/runtime/test/operator-tui.test.tsx`
- Create: `apps/operator-web/src/sections/research/research-generalization-section.tsx`
- Modify: `apps/operator-web/src/App.tsx`
- Modify: `apps/operator-web/src/App.test.tsx`

**Interfaces:**

- Consumes: required `OperatorReadModel.candidate_arena.research_generalization` only.
- Produces: equivalent compact status, progress, next action, and authority semantics across all
  three rendered operator surfaces.

- [ ] **Step 1: Write failing CLI and TUI parity tests**

Use a collecting fixture and assert text equivalent to:

```text
Research generalization: collecting / protocols 1 / outcomes 0 / assigned 2/6 / terminal 1/6 / next collect_precommitted_studies / not_promotion_authority
```

Add a closed fixture and assert the latest inference and next action are present. Assert no command
or promotion wording is introduced.

- [ ] **Step 2: Implement one compact formatter per surface**

Read only the shared projection. Keep no duplicated graph logic. The TUI adds one line under the
Arena status; the CLI adds one line after the Arena summary.

- [ ] **Step 3: Run CLI/TUI tests and typechecks**

```bash
npx vitest run apps/runtime/test/ouroboros-cli.test.ts apps/runtime/test/operator-tui.test.tsx
npm run typecheck --workspace @ouroboros/cli
npm run typecheck --workspace @ouroboros/operator-tui
```

Expected: all pass.

- [ ] **Step 4: Write failing Web Research section tests**

Assert the Research tab renders one `Research generalization` section before Finding clusters and
Research signals. Cover empty, collecting, awaiting outcome, and closed negative states. Assert
condition blocks, deadline, exact p-value when present, next action, and authority. Assert the
section is absent from Trading and Arena panels and contains no action button.

- [ ] **Step 5: Add the focused Web section**

Create a reusable section using existing `OperatorPanel`, `OperatorSectionHeader`,
`OperatorEvidenceStatus`, `OperatorEvidenceRow`, and `OperatorField` components. Use stable compact
dimensions and existing status badge variants; do not add nested cards or new palette tokens.

- [ ] **Step 6: Wire the section before FindingCluster**

Map the shared read model to display fields in `App.tsx` and render it first in the Research tab.
Do not add state or network requests.

- [ ] **Step 7: Run Web tests and typecheck**

```bash
npx vitest run apps/operator-web/src/App.test.tsx
npm run typecheck --workspace @ouroboros/operator-web
```

Expected: all pass.

- [ ] **Step 8: Run interface parity tests**

```bash
npx vitest run apps/runtime/test/operator-interface-parity.test.ts apps/runtime/test/operator-tui.test.tsx apps/runtime/test/ouroboros-cli.test.ts apps/operator-web/src/App.test.tsx
```

Expected: all pass with identical authority meaning.

- [ ] **Step 9: Commit**

```bash
git add apps/cli/src/ouroboros-cli.ts apps/runtime/test/ouroboros-cli.test.ts apps/operator-tui/src/operator-tui.tsx apps/runtime/test/operator-tui.test.tsx apps/operator-web/src/App.tsx apps/operator-web/src/App.test.tsx apps/operator-web/src/sections/research/research-generalization-section.tsx
git commit -m "feat: render research generalization progress"
```

### Task 4: Durable Contract And Full Verification

**Files:**

- Modify: `AGENTS.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/product-quality-design.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/superpowers/specs/2026-07-13-research-generalization-read-model-design.md`
- Modify: this plan

**Interfaces:**

- Consumes: completed shared projection and rendered surfaces.
- Produces: canonical repository truth and complete verification evidence.

- [ ] **Step 1: Record the shared read-model contract**

Document required presence, lifecycle states, fields excluded from projection, surface placement,
and explicit authority/non-feedback boundaries. Mark the design and plan implemented only after
verification succeeds.

- [ ] **Step 2: Run focused feature tests**

```bash
npx vitest run packages/application/src/candidate/research-generalization-read-model.test.ts apps/runtime/test/server.test.ts apps/runtime/test/ouroboros-cli.test.ts apps/runtime/test/operator-tui.test.tsx apps/runtime/test/operator-interface-parity.test.ts apps/operator-web/src/App.test.tsx
```

- [ ] **Step 3: Run all workspace typechecks and full tests**

```bash
npm run typecheck
npm test
```

- [ ] **Step 4: Run required repository guards**

```bash
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

- [ ] **Step 5: Review scope and authority**

Confirm no allocator, ResearchWorker context, command descriptor, promotion service, order path,
private adapter, or live flag changed. Confirm `.superpowers/` remains untracked and untouched.

- [ ] **Step 6: Commit durable truth**

```bash
git add AGENTS.md docs/api-command-contract.md docs/product-quality-design.md docs/candidate-arena-evaluation-protocol.md docs/superpowers/specs/2026-07-13-research-generalization-read-model-design.md docs/superpowers/plans/2026-07-13-research-generalization-read-model.md
git commit -m "docs: record generalization readback contract"
```

- [ ] **Step 7: Reassess the active CandidateArena goal**

Treat complete real-market protocol evidence, any generalization-policy decision, multi-host
fencing, and automatic promotion as separate frontiers. Do not infer success from the projection.

