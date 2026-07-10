# Naming Taxonomy

Ouroboros names must keep product scope, authority, source/provenance, lifecycle, audience, and
compatibility separate. Prefer compact canonical nouns plus explicit fields instead of long names
that pack every axis into one identifier.

## Canonical Nouns

| Canonical noun | Meaning |
| --- | --- |
| `CandidateArena` | Research workflow where multiple TradingSystem candidates are generated, evaluated, ranked, and selected. |
| `ResearchWorker` | Candidate generator operating within one ResearchDirection for a CandidateArena tick. |
| `ResearchDirection` | Arena research lane such as trend following, mean reversion, volatility regime, funding-aware risk, or execution-cost robustness. |
| `CandidateArenaTick` | One arena iteration that records per-direction candidate creation, failure, finding, and lineage evidence. |
| `CandidateAdmissionDecision` | Research-only external gate that uses source/submitted SystemCode digests and external evaluation to classify a submission as admitted, duplicate, or quarantined before candidate materialization; it grants no paper qualification or live authority. |
| `ResearchEfficiency` | Authority-free provider-request, runner-command, scenario-count, and elapsed-time summary for comparing research cost and latency. |
| `TradingSystem` | Executable BTCUSDT USD-M futures candidate system; it may include code, rules, model calls, tools, or an internal agent runtime. |
| `SystemCode` | Code packaging and verification surface for a TradingSystem, not the limit of what the system can do. |
| `ResearchPreflight` | Replay, backtest, or simulation used during candidate creation; useful evidence, not final product authority. |
| `PaperTradingEvaluation` | Continuous selected-candidate paper TradingRun evidence ranked by accumulated `revenue - cost`. |
| `PaperTradingEvaluationCommitment` | Append-only pre-start record that fixes evidence purpose and the executable, runtime, policy, data, account, and authority identities under which a PaperTradingEvaluation may count. |
| `PaperTradingEvidencePurpose` | Precommitted `research_feedback` or `qualification` purpose; one paper window cannot carry both or be upgraded after outcomes are known. |
| `PaperTradingQualification` | Evidence-quality gate for an eligible qualification-purpose PaperTradingEvaluation; separate from paper rank and based on observation window, runner health, failure ratio, market data, and public fill evidence. |
| `PaperTradingFailure` | Read-only paper failure classification with stable kind, raw reason, summary, and next action; not a promotion gate. |
| `TradingPromotion` | Qualification- and external-comparison-verdict-backed state that moves one candidate into Trading review; it is not live exchange promotion and carries `not_live` authority. |
| `TradingReview` | Operator projection of the active Trading review candidate; it separates promoted Trading review target from the current Arena selected candidate. |
| `TradingReviewPacket` | Structured read-only evidence packet inside `TradingReview` that explains verdict, blocker, paper performance, runner health, Ledger continuity, lineage, provenance, risk, authority, and next action. |
| `TradingSystemDecision` | `OrderRequest`, `hold`, or no-action signal emitted by a selected TradingSystem according to its own decision cadence. |
| `Evaluation` | Generic evidence noun; qualify it as ResearchPreflight or PaperTradingEvaluation when authority matters. |
| `Finding` | Research observation from a candidate, failed direction, negative result, or paper evidence summary. |
| `FindingCluster` | Read-only CandidateArena grouping of findings by direction, blocker, market regime, and protocol failure for the next ResearchWorker context. |
| `Lineage` | Parent, direction, evaluation, finding, and evidence chain that explains why a candidate exists. |
| `PaperEvidence` | Selected-candidate proof from the paper TradingRun, Gateway, and Ledger path. |
| `Improvement` | Compatibility/AAR lineage noun for proposal and experiment flows that predate CandidateArena. |
| `TradingRun` | One execution session for a TradingSystem. |
| `Sandbox` | Isolated execution boundary for a TradingRun. |
| `Gateway` | Boundary that handles OrderRequest before exchange authority. |
| `MarketDataPort` | Gateway-owned public market data boundary; Binance is one adapter behind this port. |
| `Ledger` | OrderRequest, GatewayResult, and ExecutionResult record chain. |
| `OuroborosCommand` | Product-facing command envelope shared by CLI, UI, and TUI. |
| `OperatorReadModel` | Shared operator state returned to CLI, UI, and TUI. |
| `AgentProfile` | Managed provider runtime profile, such as codex; researcher selects one available provider. |

Use these nouns for new code, tests, docs, API paths, UI labels, and persisted keys. If a name
drifts, replace it with the canonical term instead of adding a new alias, unless the old name is an
explicit compatibility boundary.

## Vocabulary Sources

Use the most authoritative vocabulary source for each domain:

1. OpenAI, Anthropic, and established agent-tool vocabulary for agent, model, tool, MCP, guardrail,
   eval, trace, workflow, and memory terms.
2. Binance USD-M Futures vocabulary for BTCUSDT perpetual futures terms, including account, asset,
   balance, position, order, trade, user data stream, listenKey, margin, leverage, mark price,
   liquidation price, notional, `USER_DATA`, and `TRADE`.
3. GitHub vocabulary for repository, branch, commit, pull request, check, workflow, and review
   state.
4. Linear vocabulary only when the concept is actually a Linear issue, project, milestone, cycle,
   document, comment, or status update.
5. Conventional engineering, product, finance, and trading terms before coining project-local terms.

Coin an Ouroboros-specific term only when the project introduces a genuinely new concept or no
standard term fits. Record that decision in repo docs and tests.

## Naming Rules

- Preserve external API, protocol, fixture, and persisted-schema spelling unless a compatibility
  layer explicitly maps it.
- Do not expose provider commands as product commands. Use `ouroboros` commands and provider
  selection fields.
- Do not call candidate output proof. ResearchPreflight is not final authority; selected continuous
  PaperTradingEvaluation and Ledger evidence are proof.
- Do not imply TradingSystem is only code. It may include an internal agent runtime, but it must
  emit bounded validated OrderRequests when it chooses to trade.
- Do not make paper observations force TradingSystem decisions. Observations are checkpoint/readback
  events; they consume newly emitted TradingSystemDecision records when present and otherwise record
  no-order continuity.
- Do not infer or mutate `PaperTradingEvidencePurpose` from results. Research-feedback evidence may
  guide later ResearchWorkers but cannot qualify or authorize promotion; qualification evidence
  remains sealed from research until prospective adjudication releases it.
- Do not reuse old sandbox output as a fresh paper decision.
- Do not confuse TradingPromotion with live promotion. TradingPromotion only selects a paper-backed
  Trading review candidate while live/private authority remains disabled.
- Do not bind Trading controls to the current Arena selected candidate when a different
  TradingReview target is active. Arena selection is research inspection; TradingReview is the
  promoted paper-backed target for Trading review.
- Do not let `TradingReviewPacket` become a command, promotion record, or authority gate.
  It is read-only decision support over existing paper evidence and `not_live` authority.
- Do not replace raw `PaperTradingFailure` reasons with classifier labels. Keep both: stable
  failure kind for product action and raw reason for debugging.
- Do not let `ResearchEfficiency` become a rank metric or promotion gate. It is a cost and latency
  comparison signal for improving CandidateArena autonomy.
- Do not let `FindingCluster` become a rank metric, qualification gate, or Trading review blocker.
  It is read-only generation context for the next ResearchWorker.
- Do not attach Binance directly to TradingSystem. Public market data goes through Gateway
  `MarketDataPort`; private/live Binance authority remains outside the product loop.
- Do not use compatibility nouns such as `Improvement` to name new CandidateArena primary workflow.
- Do not widen `scripts/check-naming-surface.mjs` allowlists to avoid a vocabulary decision.
