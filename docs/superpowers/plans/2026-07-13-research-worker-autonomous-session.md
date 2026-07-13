# ResearchWorker Autonomous Session Implementation Plan

Status: approved for autonomous execution under the active CandidateArena goal.

**Goal:** Give the default ResearchWorker one bounded agent-owned workspace session with external
development submission and immutable final-selection tools, while preserving one-shot sealed
admission and every downstream authority boundary.

**Architecture:** Add a provider-independent session/tool port around the existing preflight plan
and evaluator. Refactor the research loop into an externally guarded development-session service
that snapshots and evaluates only explicit tool submissions. Implement a session-local loopback
adapter for one Codex process and a deterministic fixture adapter. CandidateArena continues to own
pre-effect commitment, external record creation, materialization, and terminal checkpoint closure.

**Tech Stack:** TypeScript, Node `http`, Codex CLI, existing artifact closure/replay evaluator,
Vitest, LocalStore-backed CandidateArena integration.

## Global Constraints

- Follow the companion design exactly.
- Preserve raw evaluator seed and sealed-suite process locality.
- Expose aggregate development feedback only.
- Do not auto-select by development score.
- Add no public route, command, scheduler action, promotion, private, order, or live authority.
- Keep `.superpowers/` untracked and untouched.
- Use TDD and observe focused RED before production changes.

---

### Task 1: Session And Tool Port

**Files:**

- Modify: `packages/application/src/trading/research/types.ts`
- Create: `packages/application/src/trading/research/research-worker-session.ts`
- Create: `packages/application/src/trading/research/research-worker-session.test.ts`

- [x] Write RED tests for flexible call ordering, zero/one/full-budget submissions, explicit
  selection, finish, no automatic selection, and terminal states.
- [x] Add provider-independent session, tool, status, development result, selection, and finish
  contracts.
- [x] Implement strict idempotency, serialization, budget accounting, and terminal guards around an
  injected development evaluator callback.
- [x] Run focused tests, application typecheck, and `git diff --check`.
- [x] Commit as `feat: define autonomous research sessions`.

### Task 2: Immutable Development Submission Harness

**Files:**

- Modify: `packages/application/src/trading/research/run-trading-research.ts`
- Modify: `packages/application/src/trading/research/types.ts`
- Modify: `apps/runtime/test/trading-research-loop.test.ts`

- [x] Write RED tests proving explicit tool submission snapshots immutable artifact bytes and
  selection, not highest score or current workspace state, chooses sealed input.
- [x] Move development evaluation behind the tool callback; keep aggregate feedback and external
  evidence separation.
- [x] Record exact session status and selected sequence in the tick-local notebook/result while
  preserving bounded checkpoint compatibility.
- [x] Prove no selection leaves the sealed suite unclaimed and produces no submitted artifact.
- [x] Run the complete trading research loop suite and application/runtime typechecks.
- [x] Commit as `feat: run bounded autonomous research sessions`.

### Task 3: Deterministic Fixture Session

**Files:**

- Modify: `packages/application/src/trading/research/agent-adapters.ts`
- Modify: `packages/application/src/trading/research/runtime-config.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: CandidateArena fixture tests using injected adapters

- [ ] Write RED tests for one-session fixture sequencing, aggregate-feedback adaptation, early
  selection, direction-specific selection, and a non-highest-score selection control.
- [ ] Implement fixture and directional fixture sessions through the tool port.
- [ ] Keep an explicitly labeled bounded legacy wrapper only where compatibility tests require it;
  default fixture behavior must use the new contract.
- [ ] Run research-loop and CandidateArena focused suites plus typechecks.
- [ ] Commit as `feat: adapt fixture research sessions`.

### Task 4: Codex Loopback Tool Adapter

**Files:**

- Create: `packages/application/src/trading/research/research-worker-tool-server.ts`
- Modify: `packages/application/src/trading/research/agent-adapters.ts`
- Modify: `packages/application/src/trading/research/runtime-config.ts`
- Modify: `apps/runtime/test/trading-research-loop.test.ts`

- [ ] Write RED transport tests for loopback-only binding, bearer auth, exact routes/schema/body
  bounds, idempotent replay, conflicts, concurrency, budget, and post-terminal rejection.
- [ ] Write RED adapter tests proving one Codex invocation can make multiple worker-chosen tool calls
  and must explicitly select or finish.
- [ ] Implement the generated Node tool client, managed environment, autonomous prompt, cleanup,
  timeout, and server lifecycle.
- [ ] Assert the prompt and tool responses omit raw evaluator, sealed, private, paper, path, command,
  and authority detail.
- [ ] Run focused adapter/transport suites and typechecks.
- [ ] Commit as `feat: expose bounded Codex research tools`.

### Task 5: CandidateArena And Restart Integration

**Files:**

- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify: `apps/runtime/test/server.test.ts`
- Modify: lifecycle fixtures as required

- [ ] Write RED tests for explicit selected snapshot lineage, no-submission negative closure,
  mid-session failure after one completed submission, restart fail-closure, and no provider-process
  adoption.
- [ ] Wire default server/CandidateArena factories to session-capable Codex and fixture adapters.
- [ ] Preserve allocation concurrency, admission, behavior fingerprint, Finding/Lineage, and
  checkpoint graph semantics.
- [ ] Run CandidateArena, server, LocalStore-adjacent lifecycle tests and workspace typecheck.
- [ ] Commit as `feat: integrate autonomous research workers`.

### Task 6: Adversarial Review And Durable Truth

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `research/program.md`
- Modify: `docs/project-direction.md`
- Modify: `docs/candidate-arena-research-goal.md`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/autonomy-model.md`
- Modify: `docs/naming-taxonomy.md`
- Modify: this design and plan

- [ ] Add adversarial tests for evaluator probing, raw feedback, token/route misuse, workspace
  mutation races, duplicate effects, current-workspace fallback, and sealed retry.
- [ ] Record agent-owned session semantics, bounded tools, immutable selection, restart limits, and
  remaining completion gaps in canonical docs.
- [ ] Run focused tests, workspace typechecks, `npm test`, and `npm run check:repo-guards`.
- [ ] Audit that no rank, worker-allocation scoring, promotion, paper qualification, order, private,
  or live path changed; confirm `.superpowers/` remains untouched.
- [ ] Commit as `docs: record autonomous research sessions`.
- [ ] Reassess the CandidateArena Goal and choose the next unclosed evidence frontier.
