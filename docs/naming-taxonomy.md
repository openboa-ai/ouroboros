# Naming Taxonomy

Ouroboros names must keep product scope, authority, source/provenance, lifecycle, audience, and
compatibility separate. Prefer compact canonical nouns plus explicit fields instead of long names
that pack every axis into one identifier.

## Canonical Nouns

| Canonical noun | Meaning |
| --- | --- |
| `CandidateArena` | Research workflow where multiple TradingSystem candidates are generated, evaluated, ranked, and selected. |
| `ResearchWorker` | Stable logical candidate generator bound to one ResearchDirection and exact managed-agent profile across CandidateArena ticks; provider processes and isolated candidate runs remain disposable. |
| `ResearchWorkerSession` | Disposable runtime lifetime of one ResearchWorker under one exact ResearchPreflightCommitment. It owns one bounded working artifact and provider process plus development submission, selection, and finish capabilities; it is not a persisted worker identity or trading authority. |
| `ResearchWorkerCheckpoint` | Append-only lifecycle closure for one stable ResearchWorker and exact ResearchPreflightCommitment. It carries bounded sanitized development notebook continuity and closed budget history into a later new commitment, but cannot resume old effects or grant evaluation, admission, promotion, order, private, or live authority. |
| `ResearchDirection` | Arena research lane such as trend following, mean reversion, volatility regime, funding-aware risk, or execution-cost robustness. |
| `CandidateArenaTick` | One arena iteration that records each direction as created, duplicate, quarantined, no submission, or failed, with candidate/finding/lineage evidence only when that outcome owns it. |
| `CandidateArenaResearchAllocation` | Append-only pre-effect research-only scheduling decision for one CandidateArena tick; it freezes selected and deferred directions, bounded experiment budgets and concurrency, signal provenance, and an explicit-request, repository-default, or exact approved-decision policy basis without becoming economic or promotion evidence. |
| `ResearchPreflightCommitment` | Append-only pre-effect binding of one tick, direction, worker, allocation, source SystemCode, bounded development policy, and evaluator-owned rotating sealed-admission suite. It stores only commitments/digests, permits one sealed submission, and grants no admission, promotion, order, private, or live authority. |
| `ResearchBehaviorFingerprint` | Append-only development-only evidence that one frozen SystemCode emitted one sorted normalized effective decision per scenario on one exact protocol and development-suite digest. Equal fingerprints mean bounded observational duplication only, not semantic equivalence, profitability, qualification, promotion, order, private, or live authority. |
| `CandidateAdmissionDecision` | Research-only external gate that uses source/submitted SystemCode digests, external evaluation, and paper handoff conformance when probed to classify a submission as admitted, duplicate, or quarantined before materialization; only exact passed conformance may produce an admitted runnable handoff, and the decision grants no paper qualification or live authority. |
| `ResearchEfficiency` | Authority-free development and sealed-admission submission/provider-request/runner-command/scenario/elapsed summaries for comparing research cost and latency without exposing sealed evaluator content or becoming rank. |
| `ResearchPopulationDiversity` | Read-only CandidateArena measurement that separately reports assigned ResearchDirection concentration and exact same-suite ResearchBehaviorFingerprint concentration as latest-ten-tick coverage plus newest-first per-tick worker cross-sections. It is a search diagnostic, not economic evidence, semantic strategy identity, allocation policy, or promotion authority. |
| `ResearchControlCampaign` | Append-only pre-effect adaptive-versus-static CandidateArena policy experiment over one exact store and actual research-artifact baseline. Independent arm intents freeze bounded tick sequences; the research report freezes diagnostics and deterministic future paper candidate slots while the primary outcome remains unadjudicated. |
| `ResearchControlCampaignPaperSchedule` | Append-only post-report, pre-paper commitment of every arm slot, deterministic source comparison identity, comparator, policy, order, and deadline for one ResearchControlCampaign. |
| `ResearchControlCampaignPaperStartBatch` | Compact coordinator-owned cross-arm witness for one schedule sequence. It seals candidate-bearing source commitments and shared first-tick public evidence, or a terminal start-ineligible reason, without transferring peer runtime ownership. |
| `ResearchControlCampaignPaperSlotOutcome` | Append-only arm-local terminal classification for one scheduled candidate slot, backed by an exact source verdict, source expiry, start batch, confirmation expiry, or confirmation ResearchRelease. |
| `ResearchControlCampaignPaperExecutor` | Internal bounded runtime orchestrator, assembled by `createResearchControlCampaignPaperRuntime`, that derives and executes one action from append-only campaign paper evidence. It owns no policy-replacement, promotion, order, private, or live authority. |
| `ResearchControlCampaignOutcome` | Append-only external terminal observation over every precommitted ResearchControlCampaign paper slot. It binds the pre-effect Trading review comparator, exact confirmation/release closures, and one shared paper policy; only confirmed improvement earns discovery credit, and the record has no causal, replacement, promotion, order, private, or live authority. |
| `ResearchControlStudy` | Append-only pre-effect replicated experiment commitment over 6 to 30 exact ResearchControlCampaign identities, one same-frozen-snapshot condition, and one paired exact sign-test policy. It permits no outcome-aware inclusion or early stopping and owns research scheduling authority only. |
| `ResearchControlStudyOutcome` | Append-only external inference over every planned ResearchControlCampaignOutcome. Its causal scope is limited to same-baseline stochastic replications; supported adaptive effect grants only eligibility for a separate allocation-policy decision and no replacement, promotion, order, private, or live authority. |
| `ResearchMemoryControlStudy` | Append-only pre-effect commitment of 6 to 30 fresh same-baseline pairs that differ only in safe cross-generation memory visibility. It freezes source, agent, directions, budgets, one exact evaluator opportunity, blinded side identities, and analysis, with research scheduling authority only. |
| `ResearchMemoryControlPairOutcome` | Append-only external terminal result for one planned released-memory versus memory-masked pair. It derives exact-repeat indicators from unchanged-artifact or exact same-suite ResearchBehaviorFingerprint evidence and retains every failure or interruption without quality or downstream authority. |
| `ResearchMemoryControlStudyOutcome` | Append-only aggregate over every planned ResearchMemoryControlPairOutcome under one exact sign test. Support means only reduced exact repetition in the frozen same-baseline condition; it is not economic evidence or memory-policy replacement authority. |
| `ResearchGeneralizationProtocol` | Append-only pre-effect cross-study commitment over six deterministic ResearchControlStudy slots: two each for public long, short, and flat condition blocks. It freezes timing, worker, paper/campaign, source-baseline, resource, and equal-weight analysis policy and owns research scheduling authority only. |
| `ResearchGeneralizationOutcome` | Append-only external inference over every planned ResearchGeneralizationProtocol slot. It reports prospective condition-blocked cross-baseline evidence, including missing, ineligible, tied, duplicated, and harmful results, and grants no policy replacement, promotion, order, private, or live authority. |
| `ResearchGeneralizationPolicyDecision` | Append-only research-only selection derived from one exact ResearchGeneralizationProtocol and ResearchGeneralizationOutcome. Version 1 approves only the frozen adaptive policy digest after eligible supported cross-condition evidence; every other valid outcome is not approved, never selects static control, and grants no evaluation, promotion, order, private, or live authority. |
| `ResearchControlStudyExecutor` | Internal derived-state orchestrator, assembled by `createResearchControlStudyRuntime`, that runs or resumes one exact planned campaign per advance and adjudicates only after full terminal closure. It adds no progress record or policy-replacement, promotion, order, private, or live authority. |
| `ResearchControlStudyProcessSupervisor` | Internal single-owner process scheduler that discovers incomplete ResearchControlStudies from exact store evidence, drains them oldest first through one existing runtime at a time, verifies persisted completion, and stores no parallel progress or downstream authority. |
| `ResearchControlStudyExecutionLease` | Renewable same-host filesystem ownership for one pending ResearchControlStudy under one shared LocalStore root. It guards runtime advances, fails closed for alive or liveness-unknown owners, permits takeover only after expiry plus confirmed PID absence, archives terminal ownership, and has runtime-coordination authority only. |
| `ResearchAllocationPolicyDecision` | Append-only research-only selection derived separately from one exact ResearchControlStudy and outcome. Version 1 approves only an eligible supported adaptive effect for the exact studied policy digest; all other valid outcomes are not approved, never select static control, and grant no evaluation, promotion, order, private, or live authority. |
| `TradingSystem` | Executable BTCUSDT USD-M futures candidate system; it may include code, rules, model calls, tools, or an internal agent runtime. |
| `SystemCode` | Code packaging and verification surface for a TradingSystem, not the limit of what the system can do. |
| `ResearchPreflight` | Candidate-creation evaluation family: bounded adaptive development feedback plus one evaluator-owned rotating sealed admission over an explicitly selected frozen development artifact. It is not prospective economic or promotion authority. |
| `PaperTradingHandoffConformance` | External research-only proof that one exact submitted SystemCode artifact closure satisfies the bounded target paper event protocol before admission, materialization, and generated-candidate paper start; it carries no economic, qualification, promotion, order, private, or live authority. |
| `CandidateEgressAttestation` | Evaluator-owned, canonical start/end proof embedded in version 2 PaperTradingHandoffConformance for one exact SystemCode, ExperimentRun, Docker Sandbox implementation, network-policy identity, candidate-effect window, denial summary, and owned-rule cleanup. It is not candidate self-report or paper, promotion, order, private, or live authority. |
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
- Do not call development replay sealed or admission evidence. `ResearchPreflightCommitment` must
  precede worker effects; sealed admission starts only after artifact freeze and runs at most once.
- Keep `submission_sequence: 1` for the one sealed attempt distinct from
  `selected_development_submission_sequence`, which identifies the immutable development snapshot
  chosen by the worker. `no_submission` means no selected snapshot and must carry no candidate,
  admission, conformance, revenue, or failure evidence.
- Do not expose raw evaluator seed, sealed scenarios, scenario outcomes, score deltas, raw events,
  paths, command evidence, or evaluator internals as ResearchWorker context or compact readback.
- Do not call equal `ResearchBehaviorFingerprint` values universal strategy or program identity.
  They mean exact normalized behavior only on the named development protocol and suite. Never use
  sealed or paper outcomes, rationale, timestamps, event noise, score, or PnL in that key.
- Do not infer paper readiness from replay success. Every new runnable handoff requires one exact
  passed `PaperTradingHandoffConformance`, and generated-candidate paper start must revalidate its
  admission linkage before paper effects.
- Do not call entrypoint bytes a complete generated SystemCode identity when sibling manifest or
  dependency state can alter execution. The current single-file Python contract hashes the frozen
  manifest plus sole editable entrypoint and rejects every undeclared closure entry.
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
- Do not combine assigned-direction entropy with observed-behavior entropy, compare fingerprints
  across protocol or development-suite cohorts, or use `ResearchPopulationDiversity` as rank,
  admission, allocation, qualification, or promotion authority.
- Do not call rolling latest-ten-tick coverage current worker entropy. Use `tick_series` for the
  cross-sectional question and keep both views bounded and threshold-free.
- Do not treat `CandidateArenaResearchAllocation.focus_score`, selection `signal_score`, or
  experiment budget as reward, expected profit, candidate quality, or promotion evidence. They are
  deterministic research scheduling pressure; only allocations linked from completed ticks count
  toward later exploration coverage.
- Do not treat `ResearchAllocationPolicyDecision.not_approved` as evidence that static control is
  superior or equivalent. Version 1 is one-sided: only eligible supported adaptive evidence may
  approve the exact studied policy digest, and explicit caller intent remains higher priority.
- Do not treat `ResearchGeneralizationOutcome.generalization_supported` as policy replacement,
  economic superiority, TradingPromotion eligibility, or live authority. It only permits a
  separate `ResearchGeneralizationPolicyDecision` to review the exact frozen protocol.
- Do not call an approved `ResearchGeneralizationPolicyDecision` a learned policy, regime winner,
  generalized TradingSystem, or promotion. It authorizes only the exact frozen `adaptive_default`
  policy digest as provenance for future uncontrolled research allocation; explicit directions and
  modes still win. `not_approved` never means static control is superior.
- Use `latest_policy_decision` only for chronological decision history and
  `effective_policy_decision` only for the exact approved decision selected by the current
  uncontrolled-allocation resolver. Call its read-only join to existing allocations and completed
  ticks `policy application`, with `awaiting_allocation`, `allocated`, or `completed_tick` status.
  Do not call it deployment, policy promotion, learned policy, regime winner, or generalization
  success; no new persisted application record exists.
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
