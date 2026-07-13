# ResearchGeneralization Policy Application Implementation Plan

Status: approved for autonomous execution under the active CandidateArena goal.

**Goal:** Prove and expose the exact path from a supported prospective generalization decision to a
completed CandidateArena tick without adding a new record or authority path.

**Architecture:** Share the resolver's effective-decision selector with the pure generalization
read-model builder. Join existing allocation and completed-tick records into one compact effective
policy application projection. CandidateArena supplies its already loaded arrays; CLI, TUI, and Web
render only the shared projection. A bounded application integration test closes the positive and
negative graphs.

**Tech Stack:** TypeScript, Vitest, existing domain records and application services, CandidateArena
read model, Fastify inject, Ink, React server rendering.

## Global Constraints

- Add no persisted record, public command, mutation route, scheduler action, or runner behavior.
- Keep `latest_policy_decision` chronological and `effective_policy_decision` resolver-equivalent.
- Count completed application only through an exact terminal CandidateArenaTick edge.
- Preserve explicit direction and mode precedence.
- Keep all evaluation, promotion, order, private, and live authorities false.
- Label deterministic integration evidence as contract proof, not real-market evidence.
- Keep `.superpowers/` untracked and untouched.

---

### Task 1: Shared Effective-Decision Selector

**Files:**

- Modify: `packages/application/src/candidate/research-allocation.ts`
- Modify: `packages/application/src/candidate/research-allocation.test.ts`

- [ ] Write RED tests for newer negative versus older approved, wrong policy, malformed digest,
  deterministic tie ordering, and no applicable decision.
- [ ] Extract one pure selector and make the allocation resolver delegate to it.
- [ ] Run focused tests, application typecheck, and `git diff --check`.
- [ ] Commit as `refactor: share generalized policy selection`.

### Task 2: Effective Policy Application Projection

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/application/src/candidate/research-generalization-read-model.ts`
- Modify: `packages/application/src/candidate/research-generalization-read-model.test.ts`

- [ ] Write RED tests for null, awaiting allocation, allocated, completed tick, latest/effective
  divergence, ordering, counts, clone safety, and every corrupt application edge.
- [ ] Add the required compact domain read-model shape.
- [ ] Extend the pure builder with allocations and ticks, shared selection, strict graph validation,
  and authority-closed projection.
- [ ] Run focused domain/application tests and typechecks.
- [ ] Commit as `feat: project generalized policy application`.

### Task 3: CandidateArena And HTTP Composition

**Files:**

- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `packages/application/src/candidate/arena.test.ts`
- Modify: `apps/runtime/test/server.test.ts`
- Modify: typed fixtures reported by TypeScript

- [ ] Write RED tests proving CandidateArena reuses complete allocation/tick arrays and HTTP returns
  exact effective/application evidence.
- [ ] Preserve canonical empty projection for all-absent legacy generalization ports and fail on
  partial availability.
- [ ] Implement composition without duplicate allocation/tick reads.
- [ ] Run focused tests and full workspace typecheck.
- [ ] Commit as `feat: expose generalized policy application`.

### Task 4: CLI, TUI, And Web Parity

**Files:**

- Modify: `apps/cli/src/ouroboros-cli.ts`
- Modify: `apps/runtime/test/ouroboros-cli.test.ts`
- Modify: `apps/operator-tui/src/operator-tui.tsx`
- Modify: `apps/runtime/test/operator-tui.test.tsx`
- Modify: `apps/operator-web/src/App.tsx`
- Modify: `apps/operator-web/src/App.test.tsx`
- Modify: `apps/operator-web/src/sections/research/research-generalization-section.tsx`

- [ ] Write RED parity tests for latest/effective divergence and all three application states.
- [ ] Add compact CLI/TUI evidence and a read-only Web block after the latest decision.
- [ ] Assert no controls, raw digests, strategy feedback, or downstream authority language.
- [ ] Run focused interface tests, Web typecheck, and `git diff --check`.
- [ ] Commit as `feat: surface generalized policy application`.

### Task 5: Compositional Closure Integration

**Files:**

- Create: `packages/application/src/candidate/research-generalization-closure.integration.test.ts`
- Create or modify a test-only fixture helper if duplication would otherwise obscure the proof

- [ ] Write a supported six-study graph that composes production protocol, outcome, decision,
  resolver, allocation, completed tick, and read-model functions across service reconstruction.
- [ ] Add a harmful-block negative control proving `not_approved`, no static inference, and no
  fabricated effective application.
- [ ] Assert exact source IDs, application counts/status, authority closure, and deterministic
  replay without claiming real-market evidence.
- [ ] Run the integration test with all related focused tests.
- [ ] Commit as `test: prove generalized research closure`.

### Task 6: Durable Truth And Full Verification

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/product-quality-design.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: `docs/autonomy-model.md`
- Modify: this design and plan

- [ ] Record latest-versus-effective semantics, application statuses, exact graph, and non-goals.
- [ ] Run all focused tests and workspace typechecks.
- [ ] Run `npm test` and `npm run check:repo-guards`.
- [ ] Audit that no scoring, worker context, rank, promotion, runner, order, private, or live path
  changed; confirm `.superpowers/` remains untouched.
- [ ] Commit as `docs: record generalized policy application`.
- [ ] Reassess the active CandidateArena goal from the completion rubric.
