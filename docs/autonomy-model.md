# Autonomy Model

This page makes the detailed Ouroboros autonomy boundary explicit. The product direction stays the
same: generate many `TradingSystem` candidates, evaluate them externally, keep findings and lineage,
paper trade selected candidates continuously, and let evidence decide what can be promoted.
Read [Product Quality Design](product-quality-design.md) for the corresponding product-quality
contract across review packets, UX, eval rubrics, and implementation frontiers.
Read [CandidateArena And Research Goal](candidate-arena-research-goal.md) and
[CandidateArena Evaluation Protocol](candidate-arena-evaluation-protocol.md) for the target
long-running research completion contract and the P0 evidence boundary. Those pages define target
evidence that current main must still implement; they do not silently redefine current records as
already conformant.

The reference pressure from
[*The New SDLC With Vibe Coding*](https://drive.google.com/file/d/1IR7CddF_2FyQo_PdfBNTaEA50EGiVt2r/view)
is useful because it names the same operating shift Ouroboros is built around: move from ad-hoc
generation to a production harness where specifications, context, tools, tests, evals, guardrails,
and human judgment surround agent output.
Ouroboros applies that pattern to a trading problem with observable economic outcomes rather than
to ordinary app development. Because those outcomes are noisy and non-stationary, prospective and
comparable evaluation is part of the target contract rather than an assumption that raw PnL is a
stable answer.

## Autonomy Layers

Ouroboros autonomy is layered. Each layer may automate work below it, but it must not claim
authority that belongs to a higher layer.

| Layer | Autonomous work | Authority boundary | Evidence |
| --- | --- | --- | --- |
| `CandidateArena` research | Generate parallel or iterative `TradingSystem` candidates across stable logical `ResearchWorker` and `ResearchDirection` lanes; precommit bounded development and one rotating sealed admission set; freeze one submission; run external target paper-protocol conformance; record admission, findings, lineage, and terminal worker checkpoint. | Researchers may consume aggregate development feedback and their own sanitized checkpoint notebook, but never sealed seed/scenarios/outcomes, resume old commitment authority, grade themselves, assert runtime compatibility, or grant trading authority. | `CandidateArenaTick`, `ResearchPreflightCommitment`, `ResearchWorkerCheckpoint`, `SystemCode`, sealed terminal `Evaluation`, `PaperTradingHandoffConformance`, `CandidateAdmissionDecision`, `Finding`, `Lineage`, research leaderboard. |
| Selected paper evaluation | Run the selected `TradingSystem` as a managed paper session; inject `TRADING_API_BASE_URL`; observe emitted events on a schedule; update fake account, fills, score, and Ledger evidence. | `TradingSystem` owns decision cadence; Gateway validates and fake executes; paper observation never invents a trade decision from a refreshed snapshot. | `PaperTradingEvaluation`, observations, public market snapshots, public execution evidence, fake account state, Ledger chain. |
| Paper qualification | Decide whether accumulated paper evidence is mature enough to trust. | Rank is not readiness. A high paper score can still be collecting evidence or blocked by quality. | `PaperTradingQualification` status, reasons, evidence window, runner state, market/fill quality. |
| Trading review promotion | Move one qualified paper-backed candidate into Trading review. | Operator or explicit policy decides promotion. `TradingPromotion` remains `not_live`; it does not bind exchange authority. | `TradingPromotion`, `TradingReview`, selected candidate match/mismatch, paper board row, Ledger readback. |
| Future live authority | Change execution authority, account binding, and destination while preserving `TradingSystem` identity. | Outside MLP-01. Requires a future repo issue, policy gates, private/live controls, and validation beyond paper. | Future live-read/live-order evidence, not current paper-only records. |

The short rule is: the agent has intelligence, Gateway has authority, Ledger has truth, and the
operator or policy owns promotion boundaries.

## Prototype And Production Boundary

For Ouroboros, "prototype" and "production" are product states, not UI polish levels.

- Prototype or research work lives in `ResearchPreflight`: replay, backtest, fixtures, generated
  code, provider traces, and candidate self-reports. These are useful for search and rejection, but
  they are not final product proof.
- `ResearchPreflightCommitment` is persisted before worker effects. It separates bounded adaptive
  development feedback from one evaluator-owned rotating sealed admission submission and stores no
  raw seed or sealed scenario. Process loss is terminal for that in-memory plan.
- `ResearchWorkerCheckpoint` closes each checkpoint-enabled commitment as completed or failed-closed,
  carries only bounded sanitized development notebook and budget history, and reconciles orphans
  before a later worker effect. It resumes logical context through a new commitment, not a provider
  process, sandbox, old budget, or evaluator plan.
- `PaperTradingHandoffConformance` externally checks the exact submitted artifact against the
  bounded target paper event protocol before admission and generated-candidate paper start. It is
  runtime compatibility evidence, not economic or qualification evidence.
- MLP-01 production evidence is selected continuous paper trading: live public Binance market data
  through `MarketDataPort`, fake account, fake execution, Gateway validation, and Ledger readback.
- Shipping a TradingSystem means moving a qualified paper-backed candidate into Trading review. It
  does not mean live exchange promotion.
- Live/private Binance authority is a separate future boundary. Paper success can motivate that
  review, but it cannot grant it.

This keeps fast candidate exploration cheap while making the expensive word "production" mean
evidence-backed paper behavior, not a convincing generated artifact.

## Tests And Evals

Ouroboros should treat tests and evals as the contract with autonomous work.

| Contract | Purpose | Current repo surface |
| --- | --- | --- |
| Deterministic tests | Keep command descriptors, schemas, read models, adapters, and authority records stable. | Vitest suites under `packages/*/src/*.test.ts` and `apps/*/test`. |
| Architecture and naming checks | Keep layer dependencies, command names, and product vocabulary aligned with the doctrine. | `npm run check:architecture`, `npm run check:naming`. |
| Secret and environment checks | Keep local/runtime configuration from leaking authority or credentials into repo truth. | `bash scripts/check-env-files.sh --tracked`, `bash scripts/check-secrets.sh`. |
| `ResearchPreflight` | Score candidate behavior during creation without pretending it is final product authority. | Candidate replay/backtest/evaluation records and research leaderboard. |
| `PaperTradingHandoffConformance` | Prove exact submitted-artifact compatibility with the bounded target paper event protocol before materialization. | External host/`sbx` probe, production event parser, persisted digest-bound conformance and admission evidence. |
| `PaperTradingEvaluation` | Product evaluation authority for selected living systems. | `trading_run.start`, `trading_run.observe`, `trading_run.stop`, paper observations, paper board. |
| `PaperTradingQualification` | Readiness gate separate from rank. | Qualification policy, board reasons, promotion command gate. |

Tests verify deterministic behavior. Evals verify whether autonomous work took the right trajectory,
used the right evidence, stayed inside authority boundaries, and produced a result worth promoting.
Both are required before a generated `TradingSystem` can be trusted.

## Harness Ownership

Ouroboros is the harness around improving external AI agents and internal TradingSystem behavior.
That harness is repo-owned, reviewed, and versioned.

- Static context: `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `docs/`, naming taxonomy, API
  contract, and validation policy.
- Dynamic context: `.agents/skills`, selected researcher provider, CandidateArena context,
  paper-board compaction, selected paper lineage/finding summaries, and recent paper failures.
- Tools and ports: `MarketDataPort`, Sandbox adapters, Gateway runtime API, store ports, provider
  adapters, CLI/TUI/Web command surfaces.
- Guardrails: command registry authority flags, paper event protocol, qualification policy,
  architecture/naming checks, secret checks, and live/private authority blocks.
- Observability: Ledger chain, paper observations, fake account state, public execution evidence,
  runner status, latest command results, and read-model parity across operator surfaces.

When an autonomous run fails, first inspect the harness: missing context, vague rules, weak evals,
wrong tool boundaries, poor observability, or an absent guardrail are more actionable than simply
blaming the model.

## Non-Negotiable Invariants

- Generate many candidates; do not collapse the arena into one best artifact edited in place.
- Provider output is trace and materialization input, not proof.
- Candidate self-report is not proof.
- `ResearchPreflight` is search evidence, not final product authority.
- Replay success cannot claim runnable paper handoff. Exact passed
  `PaperTradingHandoffConformance` must be externally recorded and revalidated before generated
  paper effects.
- Generated single-file Python SystemCode freeze covers the canonical manifest-plus-entrypoint
  closure. Entrypoint-only hashing cannot authorize undeclared dependency state.
- Selected continuous `PaperTradingEvaluation` is the MLP-01 product evidence surface.
- `TradingSystem` owns decision cadence and emits bounded paper events.
- Paper observation consumes emitted events or records no-order continuity; it does not synthesize
  decisions.
- Binance public data enters through Gateway `MarketDataPort`; private/live authority remains
  disabled.
- Ranking and qualification stay separate.
- `TradingPromotion` moves a qualified candidate into Trading review while preserving `not_live`
  authority.
- Read models never trigger mutations.

## Detail Debt

The next level of detail should improve the autonomous loop without widening authority:

- CandidateArena now persists one `CandidateArenaResearchAllocation` before worker effects. Its
  adaptive default selects three of five directions, caps focus at two, preserves at least one
  exploration lane, runs no more than two workers concurrently, and applies two/one focus and
  exploration experiment budgets within five total iterations. Completed tick-bound allocations
  drive exploration coverage, while `static_control` provides the equal-bound `2`, `2`, `1`
  no-evidence comparison. Every allocation also seals whether that policy came from explicit caller
  intent, the repository fallback, one exact approved `ResearchAllocationPolicyDecision`, or one
  exact approved `ResearchGeneralizationPolicyDecision`.
- Allocation remains deterministic research scheduling authority, not a calibrated bandit, profit
  signal, rank, qualification, Trading review, or promotion gate. Provider-dollar cost, learned
  allocation, and durable provider-process/sandbox adoption remain future detail.
- `ResearchControlCampaign` now freezes one exact LocalStore and research-artifact baseline, then
  runs independent adaptive and static arm stores under exact tick sequences and equal maximum
  bounds. Its terminal report contains only research diagnostics and deterministic prospective
  paper candidate slots; `unadjudicated` is enforced, so no entropy, admission, or preflight result
  can become a causal winner. A deterministic schedule and bounded paper executor now prepare
  candidate-bearing arms, seal matched shared snapshots, enforce source and confirmation deadlines,
  and create one exact terminal slot outcome per candidate. `ResearchControlCampaignOutcome`
  separately validates those slot outcomes against the pre-effect Trading review comparator and one
  shared paper policy, then records only a non-causal adaptive/static observation.
  `ResearchControlStudy` now precommits 6 to 30 exact same-baseline campaigns and a paired exact
  sign-test policy before any planned campaign exists. Its terminal outcome consumes every planned
  campaign without early stopping and limits causal scope to stochastic repetitions of that frozen
  condition. The internal study executor derives progress from exact records and completes one
  campaign-to-outcome closure per advance with restart recovery and stop-between-campaign semantics.
  A separate same-baseline policy decision approves only the exact studied adaptive policy after
  eligible supported evidence; unsupported or underpowered outcomes remain not approved and never
  imply static superiority. `ResearchGeneralizationProtocol` adds six pre-effect slots across two
  public long, short, and flat blocks, independent baselines, fixed spacing/deadline, and equal-weight
  analysis. Its terminal outcome preserves every missing, tied, ineligible, and harmful result. A
  separate `ResearchGeneralizationPolicyDecision` may approve only that protocol's frozen
  `adaptive_default` policy digest after exact supported cross-condition evidence. Uncontrolled ticks
  resolve explicit directions and modes first, then broad approval, same-baseline approval, and the
  repository fallback. The default server scheduler owns oldest-first study discovery, same-host
  renewable execution leasing, and post-catch-up outcome, broad-decision, then same-baseline-decision
  reconciliation. Each campaign arm is composed from its exact LocalStore and arm-local paper
  session; confirmation advances one persisted transition at a time and recovers rather than adopts
  unowned attempts. Multi-host fencing, complete real-market prospective evidence, generated or
  tuned policy parameters, and long-duration deployed soak remain future detail.
- Exact pre-effect commitment, one-shot sealed terminal result, submitted-artifact paper handoff
  conformance, and admission are now bound before materialization and generated-candidate paper
  start. Direction readback is compact, and efficiency separates development from sealed counts
  without promotion authority. Exact same-suite `ResearchBehaviorFingerprint` comparison now keeps
  one admitted population slot and preserves duplicate Finding/Lineage without exposing raw
  observations. Approximate or cross-suite behavior clustering, broader evaluator side channels,
  worker-chosen de-risking sequences, long-duration restart soak, and economic generalization remain
  future detail; a query cap is not treated as a reward-hacking proof.
- CandidateArena and next-worker context now share `ResearchPopulationDiversity` over the latest
  ten completed ticks. Top-level distributions measure rolling coverage and `tick_series` preserves
  each exact worker cross-section newest first. Assigned-direction and exact same-suite behavior
  entropy remain separate; mixed cohorts expose counts as `incomparable_suites` without unique or
  entropy claims. This is read-only concentration evidence, not an allocation reward, quality
  score, rank, gate, or causal proof that directed research, memory, adaptive allocation, or an AI
  agent improved discovery.
- A compact Trading review packet that explains why a qualified candidate should or should not be
  promoted; see [Product Quality Design](product-quality-design.md).
- Clear eval rubrics for trajectory quality, tool-use quality, hallucinated dependencies, protocol
  compliance, and authority-boundary violations.
- Better failure taxonomy for paper observations. `PaperTradingFailure` now classifies latest
  failures into market data, public execution evidence, protocol, risk, sandbox/runner,
  runner-health, Ledger, authority-boundary, and unknown groups while retaining raw reason.
- Cost and latency observability for provider research runs and paper observations. CandidateArena
  now records provider-request, runner-command, scenario-count, and elapsed-time research
  efficiency proxies and derives compact paper-loop latency summaries from selected paper
  observations; provider-dollar cost remains future detail until adapters expose reliable usage.
- Policy hooks for future promotion review, still separate from live authority.

These are detail improvements inside the same direction. They should strengthen CandidateArena
generation, external evaluation, leaderboard/finding/lineage memory, or selected paper evidence.
