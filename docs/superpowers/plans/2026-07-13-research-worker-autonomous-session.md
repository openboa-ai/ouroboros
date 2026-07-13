# ResearchWorker Autonomous Session Implementation Plan

Status: approved for autonomous execution under the active CandidateArena goal.

**Goal:** Give the default ResearchWorker one bounded agent-owned workspace session with external
development submission and immutable final-selection tools, while preserving one-shot sealed
admission and every downstream authority boundary.

**Architecture:** Add a provider-independent session/tool port around the existing preflight plan
and evaluator. Refactor the research loop into an externally guarded development-session service
that snapshots and evaluates only explicit tool submissions. Implement a session-local exact Unix
socket adapter for one Codex process, with a Windows loopback fallback, and a deterministic fixture
adapter. CandidateArena continues to own
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

- [x] Write RED tests for one-session fixture sequencing, aggregate-feedback adaptation, early
  selection, direction-specific selection, and a non-highest-score selection control.
- [x] Implement fixture and directional fixture sessions through the tool port.
- [x] Keep an explicitly labeled bounded legacy wrapper only where compatibility tests require it;
  default fixture behavior must use the new contract.
- [x] Run research-loop and CandidateArena focused suites plus typechecks.
- [x] Commit as `feat: adapt fixture research sessions`.

### Task 4: Codex Session Tool Adapter

**Files:**

- Create: `packages/application/src/trading/research/research-worker-tool-server.ts`
- Modify: `packages/application/src/trading/research/agent-adapters.ts`
- Modify: `packages/application/src/trading/research/runtime-config.ts`
- Modify: `apps/runtime/test/trading-research-loop.test.ts`

- [x] Write RED transport tests for exact local binding, bearer auth, exact routes/schema/body
  bounds, idempotent replay, conflicts, concurrency, budget, and post-terminal rejection.
- [x] Write RED adapter tests proving one Codex invocation can make multiple worker-chosen tool calls,
  explicitly select or finish, and safely exit without an inferred selection.
- [x] Implement the generated Node tool client, managed environment, autonomous prompt, cleanup,
  timeout, and server lifecycle.
- [x] Assert the prompt and tool responses omit raw evaluator, sealed, private, paper, path, command,
  and authority detail.
- [x] Run focused adapter/transport suites, a real Codex session probe, and typechecks.
- [x] Commit as `feat: expose bounded Codex research tools`.

### Task 5: CandidateArena And Restart Integration

**Files:**

- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `packages/application/src/candidate/research-allocation.ts`
- Modify: `packages/application/src/candidate/research-worker-lifecycle.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/local-store/src/index.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify: `apps/runtime/test/server.test.ts`
- Modify: lifecycle fixtures as required

- [x] Write RED tests for explicit selected snapshot lineage, no-submission negative closure,
  mid-session failure after one completed submission, restart fail-closure, and no provider-process
  adoption.
- [x] Wire default server/CandidateArena factories to session-capable Codex and fixture adapters.
- [x] Preserve allocation concurrency, admission, behavior fingerprint, Finding/Lineage, and
  checkpoint graph semantics.
- [x] Run CandidateArena, server, LocalStore-adjacent lifecycle tests and workspace typecheck.
- [x] Commit as `feat: integrate autonomous research workers`.

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
- Modify: `apps/runtime/test/trading-research-loop.test.ts`
- Modify: `apps/runtime/test/candidate-arena-paper-context.test.ts`
- Modify: terminal Evaluation, checkpoint, and LocalStore validators required by adversarial review

- [x] Add adversarial tests for evaluator probing, raw feedback, token/route misuse, workspace
  mutation races, duplicate effects, current-workspace fallback, and sealed retry.
- [x] Record agent-owned session semantics, bounded tools, immutable selection, restart limits, and
  remaining completion gaps in canonical docs.
- [x] Run focused tests, workspace typechecks, `npm test`, and `npm run check:repo-guards`.
- [x] Audit that no rank, promotion, paper qualification, order, private, or live path changed;
  allocation impact is limited to the explicit `no_submission` recent-outcome adjustment, and
  `.superpowers/` remains untouched.
- [x] Commit as `docs: record autonomous research sessions`.
- [x] Reassess the CandidateArena Goal and choose the next unclosed evidence frontier.

## Completion Evidence

- Session implementation commits: `17d7571`, `c67dc57`, `ce5122c`, `e72a67e`, `0995d3b`.
- Independent adversarial review fixes: `329c367`.
- Focused autonomous-session and lifecycle regression suites passed after RED/GREEN repair.
- Full repository validation passed: 191 test files, 3,093 tests, workspace typecheck, and all repo
  guards.
- `.superpowers/` remains untracked and untouched.

This frontier completes bounded autonomous-session mechanics, not the CandidateArena Goal. Direct
evidence for long-running autonomy, causal memory benefit, agent leverage, prospective economic
frontier lift, and deployed recovery soak remains open.

## Next Evidence Frontier

Run a precommitted longitudinal ResearchWorker control that compares released-memory context with a
memory-masked arm under identical source snapshots, provider identity, directions, development
budgets, evaluator policy, and restart schedule. Measure repeated invalid/duplicate behavior,
qualified discovery yield, research cost, and checkpoint continuity across multiple fresh
commitments. Reuse existing CandidateArena and ResearchControl evidence boundaries; do not create a
promotion, private, order, or live path.
