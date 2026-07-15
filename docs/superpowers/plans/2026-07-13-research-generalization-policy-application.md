# ResearchGeneralization Policy Application Implementation Plan

Status: implemented and verified under the active CandidateArena goal.

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

- [x] Write RED tests for newer negative versus older approved, wrong policy, malformed digest,
  deterministic tie ordering, and no applicable decision.
- [x] Extract one pure selector and make the allocation resolver delegate to it.
- [x] Run focused tests, application typecheck, and `git diff --check`.
- [x] Commit as `refactor: share generalized policy selection`.

### Task 2: Effective Policy Application Projection

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/application/src/candidate/research-generalization-read-model.ts`
- Modify: `packages/application/src/candidate/research-generalization-read-model.test.ts`

- [x] Write RED tests for null, awaiting allocation, allocated, completed tick, latest/effective
  divergence, ordering, counts, clone safety, and every corrupt application edge.
- [x] Add the required compact domain read-model shape.
- [x] Extend the pure builder with allocations and ticks, shared selection, strict graph validation,
  and authority-closed projection.
- [x] Run focused domain/application tests and typechecks.
- [x] Commit as `feat: project generalized policy application`.

### Task 3: CandidateArena And HTTP Composition

**Files:**

- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `packages/application/src/candidate/arena.test.ts`
- Modify: `apps/runtime/test/server.test.ts`
- Modify: typed fixtures reported by TypeScript

- [x] Write RED tests proving CandidateArena reuses complete allocation/tick arrays and HTTP returns
  exact effective/application evidence.
- [x] Preserve canonical empty projection for all-absent legacy generalization ports and fail on
  partial availability.
- [x] Implement composition without duplicate allocation/tick reads.
- [x] Run focused tests and full workspace typecheck.
- [x] Commit the projection and composition in `3b13d68`.

### Task 4: CLI, TUI, And Web Parity

**Files:**

- Modify: `apps/cli/src/ouroboros-cli.ts`
- Modify: `apps/runtime/test/ouroboros-cli.test.ts`
- Modify: `apps/operator-tui/src/operator-tui.tsx`
- Modify: `apps/runtime/test/operator-tui.test.tsx`
- Modify: `apps/operator-web/src/App.tsx`
- Modify: `apps/operator-web/src/App.test.tsx`
- Modify: `apps/operator-web/src/sections/research/research-generalization-section.tsx`

- [x] Write RED parity tests for latest/effective divergence and all three application states.
- [x] Add compact CLI/TUI evidence and a read-only Web block after the latest decision.
- [x] Assert no controls, raw digests, strategy feedback, or downstream authority language.
- [x] Run focused interface tests, Web typecheck, and `git diff --check`.
- [x] Commit as `feat: surface generalized policy application`.

### Task 5: Compositional Closure Integration

**Files:**

- Create: `packages/application/src/candidate/research-generalization-closure.integration.test.ts`
- Create or modify a test-only fixture helper if duplication would otherwise obscure the proof

- [x] Write a supported six-study graph that composes production protocol, outcome, decision,
  resolver, allocation, completed tick, and read-model functions across service reconstruction.
- [x] Add a harmful-block negative control proving `not_approved`, no static inference, and no
  fabricated effective application.
- [x] Assert exact source IDs, application counts/status, authority closure, and deterministic
  replay without claiming real-market evidence.
- [x] Run the integration test with all related focused tests.
- [x] Commit as `test: prove generalized research closure`.

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

- [x] Record latest-versus-effective semantics, application statuses, exact graph, and non-goals.
- [x] Run all focused tests and workspace typechecks.
- [x] Run `npm test` and `npm run check:repo-guards`.
- [x] Audit that no scoring, worker context, rank, promotion, runner, order, private, or live path
  changed; confirm `.superpowers/` remains untouched.
- [x] Commit as `docs: record generalized policy application`.
- [x] Reassess the active CandidateArena goal from the completion rubric.

## Verification Record

- Focused suite: 7 files, 255 tests passed.
- Workspace typecheck: all packages passed.
- Full suite: 188 files, 3,058 tests passed.
- Repository guards: docs, architecture, naming, tracked environment, secret scan, and diff checks
  passed.
- Scope audit: this frontier changed read-only selection/projection, composition, surfaces, tests,
  and durable docs only; it added no scoring, worker-context, rank, promotion, runner, order,
  private, or live path.

## Goal Reassessment

This frontier closes the missing observability and compositional-proof edge from an approved broad
research-policy decision through allocation to a completed CandidateArena tick. It strengthens
Adaptive allocation and Bounded and legible operation evidence, but it completes neither axis by
itself and does not satisfy the overall Goal. Direct real public-path generalization evidence,
learned or tuned allocation parameters, controlled memory and agent-leverage comparisons,
longitudinal restart soak, repeated economic lift, and champion execution continuity remain open.
The next implementation frontier must therefore be selected from those unclosed rubric edges rather
than extending this read-only projection.
