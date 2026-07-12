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
| `PaperTradingComparisonCommitment` | Append-only champion/challenger qualification envelope that binds two frozen, distinct, inert paper sessions and one comparison policy before market outcomes exist. |
| `PaperTradingComparisonTick` | Append-only Gateway-owned market and public-execution checkpoint for one comparison sequence; shared input evidence does not prove activation, consumption, a verdict, or promotion. |
| `PaperTradingComparisonTickDelivery` | Append-only non-economic evidence that one exact role-bound provider persisted the context for a candidate-facing market response against one comparison tick. It does not prove acknowledgement, a decision, or an order. |
| `PaperTradingComparisonTickAcknowledgement` | Append-only non-economic evidence that the same role-bound session returned one exact delivery context. It proves observable receipt, not reasoning quality, economic evidence, or promotion fitness. |
| `PaperTradingComparisonTickContext` | Candidate-facing opaque lineage object containing exact tick and delivery refs/digests. It carries no lifecycle, Ledger, private, direct-order, or live authority. |
| `PaperTradingComparisonActivation` | Append-only internal paper-only authorization that binds one verified comparison, its sole first tick, exact side runtime refs, and a bounded derived start/cleanup/recovery policy. `authorized` does not mean started or observed and grants no live, private, credential, or direct order authority. |
| `PaperTradingComparisonActivationAttempt` | Append-only intent for one bounded symmetric start. It is durable before provider or sandbox effects and fixes sequence, retry index, both sides, deadline, and inherited activation policy. |
| `PaperTradingComparisonActivationSideResult` | Append-only per-side start or stop settlement with contiguous operation sequence, bounded provider-request count, current lifecycle state, and stable failure or timeout code. |
| `PaperTradingComparisonActivationOutcome` | Append-only sequenced pair reconciliation: `both_running`, `stopped_cleanly`, or `cleanup_required`. `both_running` is operational zero-observation state, not a paired checkpoint, qualification, verdict, or promotion. |
| `PaperTradingComparisonCheckpointAttempt` | Append-only intent for one checkpoint sequence, persisted before side effects. It binds the exact owned `both_running` attempt, tick, side evaluation/observation and provider-request baselines, deadline, and for sequence 2+ the exact prior paired outcome and provider-view advance. |
| `PaperTradingComparisonCheckpointOutcome` | Append-only terminal result for one checkpoint sequence. `paired` proves one atomic bundle committed both sides against the same tick; `incomplete` proves the attempt closed without an economic bundle. Sequence 2+ paired evidence requires exact role-bound tick acknowledgements. |
| `PaperTradingComparisonCheckpointWriteContext` | Internal authority scoped only to exact sandbox-evidence refresh, provider-view advance, or paired checkpoint commit. It cannot authorize ordinary lifecycle, Ledger, observation, evaluation, private, or live writes. |
| `PaperTradingComparisonWindowDriver` | Internal application service that reconstructs one comparison from durable evidence and performs at most one legal transition toward its frozen maximum window. It is not evidence, a verdict, or a public command. |
| `PaperTradingComparisonWindowRunner` | Process-local scheduler that invokes one WindowDriver without overlap for an owned activation attempt. It cannot resume or adopt provider identity after restart and grants no qualification or trading authority. |
| `PaperTradingComparisonQualification` | Read-only paired evidence-quality decision over one cleanly stopped shared window, both canonical side qualifications, and the exact checkpoint-declared run-specific `ledger_chain` set. `qualified` permits only later adjudication and carries `not_verdict` authority. |
| `PaperTradingComparisonVerdict` | Append-only external evaluation of one exact settled comparison window. It records qualified improvement, qualified non-improvement, or ineligible closure, remains sealed and promotion-ineligible, and releases only the experiment pair for another precommitted window. |
| `PaperTradingComparisonConfirmationCampaign` | Append-only sealed precommitment for every new prospective window used to confirm one exact source improved verdict. It freezes deterministic slots, pair identity, policy, strict sequence, non-overlap, and bounded start delay before campaign evidence exists. |
| `PaperTradingComparisonConfirmationSlot` | One deterministic future comparison identity nested in a confirmation campaign. It is immutable commitment data, not a mutable lifecycle record or an observed result. |
| `PaperTradingComparisonConfirmationCampaignOutcome` | Append-only external aggregate decision over every reserved slot. Only all improved slots produce protocol-level `eligible`; it remains sealed, paper-only, and `not_live`. It grants no implicit promotion or research visibility, but the explicit operator promotion command or a separate ResearchRelease may consume it for those distinct purposes. |
| `PaperTradingComparisonResearchRelease` | Append-only internal visibility bundle for one exact terminal campaign outcome. It materializes one deterministic Finding and extended ArtifactLineage, recovers after restart, and remains `lineage_only` with no promotion, public, private, order, or live authority. |
| `PaperTradingEvidencePurpose` | Precommitted `research_feedback` or `qualification` purpose; one paper window cannot carry both or be upgraded after outcomes are known. |
| `PaperTradingQualification` | Evidence-quality gate for an eligible qualification-purpose PaperTradingEvaluation; separate from paper rank and based on observation window, runner health, failure ratio, market data, and public fill evidence. |
| `PaperTradingFailure` | Read-only paper failure classification with stable kind, raw reason, summary, and next action; not a promotion gate. |
| `TradingPromotion` | Explicit `trading_candidate.promote` transition into Trading review, backed by one terminal eligible all-improved confirmation campaign and its exact final qualified challenger evaluation. It freezes the campaign, outcome, and final verdict, revalidates the current champion atomically, changes no Arena selection or runtime, and carries `not_live` authority. |
| `TradingReview` | Operator projection of the active Trading review candidate; it separates promoted Trading review target from the current Arena selected candidate. |
| `TradingReviewPacket` | Structured read-only evidence packet inside `TradingReview` that explains verdict, blocker, paper performance, runner health, Ledger continuity, lineage, provenance, risk, authority, and next action. |
| `TradingSystemDecision` | `OrderRequest`, `hold`, or no-action signal emitted by a selected TradingSystem according to its own decision cadence. |
| `Evaluation` | Generic evidence noun; qualify it as ResearchPreflight or PaperTradingEvaluation when authority matters. |
| `Finding` | Research observation from a candidate, failed direction, negative result, or paper evidence summary. |
| `FindingCluster` | Read-only CandidateArena grouping of paper-backed or explicitly released campaign findings by direction, blocker, market regime, protocol failure, and release kind for the next ResearchWorker context. |
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
  Trading review candidate after the explicit operator command revalidates exact comparison
  confirmation evidence; Arena selection, runners, orders, and live/private authority remain
  unchanged.
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
- Do not treat `PaperTradingComparisonVerdict.challenger_improved` as confirmation, statistical
  significance, champion replacement, or promotion eligibility. Confirmation requires a campaign
  committed before any campaign-bound outcome, and every reserved terminal result must count.
- Do not infer research visibility from a sealed confirmation outcome. Only an accepted
  `PaperTradingComparisonResearchRelease` may add its compact Finding to later ResearchWorker
  context and FindingClusters; release kind is not rank or promotion authority.
- Do not infer TradingPromotion from a sealed confirmation outcome. Only the explicit
  `trading_candidate.promote` command may bind an eligible all-improved campaign, outcome, final
  verdict, and qualified challenger evaluation into Trading review after current-champion
  revalidation.
- Do not attach Binance directly to TradingSystem. Public market data goes through Gateway
  `MarketDataPort`; private/live Binance authority remains outside the product loop.
- Do not use compatibility nouns such as `Improvement` to name new CandidateArena primary workflow.
- Do not widen `scripts/check-naming-surface.mjs` allowlists to avoid a vocabulary decision.
