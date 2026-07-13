# Product Quality Design

This page turns the Ouroboros direction into a product-quality contract. The target is not more
surface area. The target is a product where every element has a clear role, clear authority,
clear evidence, and clear maintenance boundary.

Ouroboros should feel autonomous because the loop keeps moving without the operator hand-holding
every step. It should feel trustworthy because no generated candidate, provider trace, replay
result, UI label, or convenient score can promote itself.

## Design Standard

The design standard is functional restraint. The most useful shape is the best-looking shape when
the object is complex, high-stakes, and evidence-driven.

This is the Ouroboros version of Dieter Rams-style restraint: the product should be useful,
honest, thorough, durable, and as little-designed as the evidence allows. Visual taste, UX taste,
architecture taste, and development taste are the same discipline here: remove anything that does
not clarify function, evidence, ownership, or authority.

- Good design makes the product useful: every visible element must help generate candidates,
  evaluate them, explain evidence, block weak evidence, or guide the next action.
- Good design is honest: a candidate that is profitable but unqualified must look profitable and
  unqualified at the same time.
- Good design is unobtrusive: controls should not compete with evidence; status text should not
  sound more confident than the underlying record.
- Good design is thorough: empty, collecting, blocked, failed, mismatch, resume-needed, qualified,
  and promoted states need first-class treatment.
- Good design is durable: product nouns, read models, commands, and UI labels should survive
  provider changes.
- Good design is minimal: do not add a new object, page, command, or adapter unless it removes
  ambiguity from the core loop.

The product quality test is direct: if a knowledgeable operator asks "why should I trust this
TradingSystem right now?", Ouroboros must answer from evidence, not from generated explanation.

## Chosen Design Approach

There are three tempting ways to continue from the current product direction:

| Approach | What it optimizes | Why it is not enough |
| --- | --- | --- |
| Feature patch queue | Fast visible additions such as another card, command, metric, or chart. | It can make the surface look more complete while leaving authority, evidence, and ownership blurry. |
| UI polish pass | Visual consistency, spacing, wording, and first-scan readability. | It improves taste only after the product objects are correct; by itself it cannot decide what deserves to exist. |
| Evidence-spine design | Every object is tied to CandidateArena, PaperTradingEvaluation, qualification, Trading review, Gateway, or Ledger evidence. | This is slower, but it is the only approach that keeps autonomy, evaluation, UX, and maintainability aligned. |

Use the evidence-spine approach. UI polish and feature work are allowed only when they clarify one
object in that spine. A change is not product quality just because it is useful in isolation; it
must make the loop more trustworthy, more autonomous below the authority boundary, or easier to
maintain without weakening evidence.

The practical rule is:

```text
object -> evidence -> authority -> surface order -> test/eval -> removal check
```

If any step is missing, the work is still design analysis, not implementation-ready product work.

## Source Evidence Used

This contract is grounded in the current repo surface, not a separate product idea.

| Source | What it proves |
| --- | --- |
| `AGENTS.md`, `README.md`, `ARCHITECTURE.md` | CandidateArena doctrine, source-of-truth order, authority boundary, and layer ownership. |
| `docs/project-direction.md`, `docs/autonomy-model.md`, `docs/ouroboros-doctrine.md` | Product direction, autonomy layers, prototype/production boundary, and reference lineage. |
| `docs/api-command-contract.md`, `docs/interface-parity.md` | Shared command/read contract and Desktop/CLI/TUI/Web parity expectations. |
| `docs/product-loop-smoke.md` | Operable proof path for selected continuous paper evidence and board readback. |
| `docs/trading-system-paper-event-protocol.md` | TradingSystem event contract and `TRADING_API_BASE_URL` authority boundary. |
| `packages/domain/src/index.ts` | Existing `PaperTradingBoardReadModel`, `TradingPromotionReadModel`, `TradingReviewReadModel`, and `OperatorReadModel` attachment points. |
| `packages/application/src/services/operator.ts` | Promotion gate, paper-board builder, and Trading review projection assembly. |
| `packages/application/src/trading/paper/qualification.ts` | Current qualification policy, reasons, and evidence-window logic. |
| `packages/application/src/trading/paper/qualification-blockers.ts`, `failures.ts`, `learning.ts` | Shared blocker grouping, paper failure classification, and paper-board learning summaries used by review and next research context. |
| `packages/application/src/candidate/arena.ts` | CandidateArena context, finding clusters, research-efficiency summaries, and paper evidence compaction. |
| `packages/local-store/src/index.ts`, `packages/local-store/src/trading-substrate-surfaces.ts` | Persistence validation and low-level substrate read-model conversion for current evidence surfaces. |
| `apps/cli/src/ouroboros-cli.ts`, `apps/operator-tui/src/operator-tui.tsx`, `apps/operator-web/src/App.tsx`, `apps/operator-desktop` | CLI, TUI, shared UI, and Desktop app rendering over the shared Operator read model. |
| `apps/runtime/test/*`, `apps/operator-web/src/App.test.tsx` | Existing coverage for paper board ranking, qualification blocking, promotion, mismatch, smoke, and interface parity. |

## Current Product Spine

The repo already has the right spine:

```text
CandidateArena
-> ResearchPreflight
-> PaperTradingHandoffConformance
-> CandidateAdmissionDecision and candidate materialization
-> leaderboard, findings, lineage
-> selected PaperTradingEvaluation
-> PaperTradingQualification
-> TradingReview
-> operator or explicit-policy promotion decision
```

The product-quality work should strengthen this spine. It should not create a parallel workflow
that lets a generated system route around `PaperTradingQualification`, `Gateway`, or `Ledger`.

## Why This Belongs In Ouroboros

The requested detail belongs in the existing system only when it increases evidence quality in the
core loop. It does not belong as a standalone design artifact, a dashboard decoration, or a second
promotion workflow.

The correct attachment point is `TradingReview` because that projection already sits after selected
paper evidence and before any operator or policy promotion decision. It can pull together the
current candidate, paper board row, qualification result, runner state, market/fill provenance,
risk readback, and authority boundary without creating new authority.

That is why `TradingReviewPacket` is the primary product-quality object for Trading review: a
structured read model that makes the promotion judgment legible while leaving mutation, evaluation,
and exchange authority in their existing owners.

## Promotion Decision Protocol

Ouroboros can become autonomous only below the promotion boundary. The loop may keep researching,
selecting, paper trading, observing, and compacting learning without operator hand-holding, but the
system must never confuse autonomous momentum with promotion authority.

The promotion decision protocol is:

1. `CandidateArena` produces a population, not a winner by assertion.
2. `ResearchPreflight` rejects weak candidates cheaply and records findings, but remains search
   evidence.
3. `PaperTradingHandoffConformance` externally proves that the exact submitted artifact satisfies
   the bounded target paper event protocol without granting economic or trading authority.
4. `CandidateAdmissionDecision` binds exact passed preflight/conformance evidence before candidate
   materialization; generated-candidate paper start revalidates the graph before effects.
5. One candidate is selected for continuous `PaperTradingEvaluation`.
6. Paper observations consume the selected `TradingSystem`'s emitted decisions or record no-order
   continuity; they do not force decisions from snapshots.
7. `PaperTradingQualification` decides whether the evidence window is mature enough to trust.
8. `TradingPromotion` can move only a qualified paper-backed candidate into Trading review.
9. `TradingReviewPacket` explains the active review target from one shared read projection.
10. The operator or an explicit future policy decides whether the review target deserves continued
   promotion attention.
11. Every result, including failure and loss, feeds back into Research as findings, lineage,
   learning summaries, and finding clusters under read-only authority.

Shipping in MLP-01 means the candidate is reviewable in this protocol. It does not mean live
exchange authority. A profitable candidate with thin, stale, private, missing, or malformed
evidence must stay blocked. A losing candidate with clean evidence can still be useful if it teaches
the next generation something specific.

This protocol keeps prototype and production separate:

| Stage | Product meaning | Evidence standard | Promotion effect |
| --- | --- | --- | --- |
| Prototype search | Candidate generation, replay, backtest, fixtures, provider traces, and SystemCode shaping. | Useful for search, rejection, and context. | No promotion authority. |
| Product paper evidence | Selected continuous paper run with public market data, fake account, fake execution, Gateway, and Ledger. | Ranked by paper `revenue - cost`, qualified by evidence quality. | Can enter Trading review only when qualified. |
| Trading review | Operator or policy review of one paper-backed target through `TradingReviewPacket`. | Single packet over qualification, performance, runner, provenance, risk, lineage, Ledger, and authority. | Review selection only; still `not_live`. |
| Future live authority | Real account binding, private reads, signed requests, and live orders. | Outside MLP-01 and requires a future repo issue. | Not granted by current records. |

## Evidence Audit

| Surface | Current role | Quality reading | Gap to close |
| --- | --- | --- | --- |
| `CandidateArena` | Generates parallel or iterative `TradingSystem` candidates and keeps research memory. | Correct product center. It gives autonomy its search engine. | Research directions should become more adaptive from paper-board failures, findings, lineage clusters, and research-efficiency signals. |
| `ResearchPreflight` | Replay, backtest, and simulation during candidate creation. | Correct as cheap search and rejection evidence. | UI and researcher context must keep it below continuous paper evidence. |
| `PaperTradingHandoffConformance` and admission | Externally probe the exact submitted manifest-plus-entrypoint artifact closure against the bounded target paper protocol, persist compact digest-bound evidence, and gate materialization/start. | Correct runtime-compatibility boundary. It prevents replay-only success, undeclared dependency state, or candidate self-report from claiming runnable handoff. | Keep raw probe evidence outside ResearchWorker feedback and keep conformance out of economic rank, qualification, promotion, order, private, and live authority. |
| `PaperTradingEvaluation` | Selected-candidate continuous paper trading over live public market data with fake account and fake execution. | Correct product evaluation authority for MLP-01. | The operator needs a compact, ordered readout that explains evidence maturity, not only score. |
| `PaperTradingQualification` | Separates rank from readiness with observation, elapsed-time, runner, failure-ratio, market, and fill-evidence gates. | Correct gate. It prevents profitable-but-thin evidence from looking ready. | Reasons need product-facing grouping, severity, and remediation guidance without weakening the gate. |
| `TradingPromotion` | Records one qualified paper-backed candidate as the Trading review target with `not_live` authority. | Correct authority boundary. | Promotion should read like a review state, not like exchange enablement. |
| `TradingReview` | Projects active Trading review target, selected-candidate match, qualification, paper evaluation, board entry, and `TradingReviewPacket`. | Correct attachment point for the product-quality contract. | Keep packet fields grouped by operator question instead of drifting back into loose UI-only fields. |
| Trading tab | Shows the paper Trading review cockpit while live authority is disabled. | Correct primary operator place for promotion judgment. | The first viewport should answer verdict, blocker, evidence, and next action before lower-level charts. |
| Arena tab | Owns candidate generation, selection, paper run controls, and paper board. | Correct workbench for generating and observing candidates. | Keep Trading review controls out of Arena except for clearly scoped candidate movement. |
| Research tab | Owns research lineage, preflight context, and next candidate handoff. | Correct place for why candidates exist. | Surface paper findings back into research context as compact evidence, not as operator-only display. |
| Details tab | Owns raw records and developer evidence. | Correct overflow surface. | It should not become the only place to understand promotion blockers. |
| CLI/TUI/Web parity | Share `GET /api/operator` and `POST /api/commands`. | Correct maintainability constraint. | `TradingReviewPacket` must be projected once and rendered consistently across surfaces. |
| Tests and checks | Cover paper board, promotion block, interface parity, naming, architecture, docs, env, and secrets. | Strong base. | Add scenario coverage for review-packet ordering, severity, mismatch, and failure taxonomy. |

## State Matrix

The product must treat every important state as a real state, not an edge case.

| State | Product meaning | Primary surface | Required operator signal | Allowed action |
| --- | --- | --- | --- | --- |
| No selected candidate | Research has not selected a system for proof. | Arena | No selected candidate, paper not started, live disabled. | Run/tick Arena or select candidate. |
| Selected, no paper evaluation | Candidate is inspectable but not proof-backed. | Arena | Paper required. | Start selected paper trading. |
| Paper collecting | Paper run exists but the evidence window is immature. | Arena and Trading review boundary | Observation count, elapsed time, collecting reasons. | Continue observing; do not promote. |
| Paper qualified, not promoted | Evidence quality is sufficient for review. | Arena and Trading review boundary | Qualified, score, rank, authority still `not_live`. | Move to Trading review. |
| Promoted and selected matches | Active Trading review target is the selected candidate. | Trading | Review packet is current. | Observe, stop, or continue review according to packet. |
| Promoted but selected differs | Operator is inspecting a different Arena candidate. | Trading and Arena | Mismatch must be unmistakable. | Open active target or replace target only when selected paper evidence qualifies. |
| Needs resume | Persisted paper run says running, but runner evidence is inactive. | Trading and Arena | `needs_resume` plus runner blocker. | Resume paper trading before review. |
| Blocked by quality | Evidence exists but cannot be trusted. | Trading review packet | Blocker group, severity, latest failure if available. | Fix source problem; do not promote. |
| Paper failed | Evaluation failed. | Trading review packet and Details | Failure reason and no live authority. | Treat as research memory unless hard boundary was violated. |
| Future live authority requested | Out of MLP-01 scope. | None in current product loop | Explicitly outside current authority. | Reroute through a future repo issue and policy gates. |

## Product Contract

Every product element must answer five questions:

1. What does it own?
2. What evidence does it read or write?
3. What authority does it have?
4. What can it never do?
5. What next action should the operator or policy take?

This keeps the product organic without letting responsibilities blur.

| Element | Owns | Reads | Writes | Never does |
| --- | --- | --- | --- | --- |
| `ResearchWorker` | Candidate generation inside one `ResearchDirection`. | Context, findings, lineage, paper-board compaction. | Candidate materialization records and research findings. | Grades itself or grants trading authority. |
| `TradingSystem` | Decision cadence and bounded paper events. | Gateway paper runtime API when injected. | `order_request`, `cancel_order`, `hold`, or `no_action` events. | Imports Binance, reads private state, signs requests, or claims live authority. |
| `Gateway` | Market data boundary, validation, fake execution routing. | Public market data adapter and fake account state. | Gateway/Ledger evidence and fake execution results. | Invents a trade decision from a refreshed snapshot. |
| `Ledger` | Evidence chain. | Order, gateway, execution, and observation records. | Immutable readback chain. | Explains intent beyond recorded evidence. |
| `PaperTradingQualification` | Evidence-quality gate. | `PaperTradingEvaluation`, observations, runner state, market/fill evidence. | Qualification status, reasons, evidence window. | Uses profit as readiness or weakens a blocker for UX convenience. |
| `TradingReview` | Promotion judgment projection. | Promotion record, paper board entry, paper evaluation, selected candidate. | Read model only. | Triggers mutations or enables live/private exchange authority. |
| Operator UI | Decision support. | `OperatorReadModel`. | Commands through `POST /api/commands` only. | Imports runtime internals or hides mismatch/authority state. |

### Element Inspection Contract

Before adding, moving, renaming, or polishing any element, inspect it as a product object. The
inspection must be concrete enough that another worker can implement or delete the element without
guessing intent.

| Question | Required answer | Reject the element when |
| --- | --- | --- |
| Why does it exist? | It strengthens CandidateArena generation, PaperTradingEvaluation, qualification, Trading review, Gateway, Ledger, or next-generation learning. | It only fills space, decorates a surface, or repeats stronger evidence. |
| What owns it? | A domain type, application service, command, port, adapter, read model, or UI surface is named. | Ownership is "the UI", "the agent", or "the docs" without a durable source. |
| What evidence does it use? | The exact record, read-model field, port, fixture, or test fixture is named. | It depends on generated explanation, candidate self-report, or unstated runtime state. |
| What authority does it have? | Read-only, command-capable, adapter-owned, policy-owned, or future/out-of-scope is explicit. | It can be mistaken for rank, qualification, promotion, private read, live order, or exchange authority. |
| Where should it appear? | Trading, Arena, Research, Details, CLI, TUI, docs, or tests is chosen by product role. | It appears where it is most convenient to code rather than where the operator needs it. |
| What state does it cover? | Empty, collecting, blocked, failed, mismatch, resume-needed, qualified, promoted, and out-of-scope states are considered when relevant. | It only handles the happy path. |
| How is it verified? | A deterministic test, eval, guard, doc assertion, or screenshot check is named. | Correctness is only visual inspection or confidence. |
| What would remove it? | A stronger source, duplicate surface, or low decision value removal condition is stated. | Nobody can say when it should disappear. |

This is the product-quality equivalent of type checking. It turns taste into a repeatable
engineering standard without lowering the taste bar.

## Trading Review Packet

`TradingReview` owns the structured packet that explains whether one paper-backed candidate is
worth continued operator attention.

The packet is not a new authority. It is a read projection over existing authority:

```text
TradingPromotion record
+ PaperTradingEvaluation
+ PaperTradingBoard entry
+ PaperTradingQualification
+ Ledger/readback state
+ selected-candidate match
-> TradingReviewPacket
```

### Packet Sections

| Section | Operator question | Required content |
| --- | --- | --- |
| Verdict | Is this candidate reviewable right now? | `readiness_status`, qualification status, top blocker, authority status, selected-match state. |
| Subject | Which system is being reviewed? | Candidate id, version id, display name, promoted time, paper evaluation id, selected-candidate mismatch. |
| Performance | Is the score meaningful? | Rank, `net_revenue_usdt`, `net_return_pct`, observation count, elapsed time, negative-result visibility. |
| Evidence window | Is there enough time and sample size? | Observation count, elapsed ms, failed count, failed ratio, first/last observation times when available. |
| Quality blockers | What blocks trust? | Grouped qualification reasons with severity and remediation target. |
| Runner health | Is the paper session current? | Active, inactive, needs resume, next observation, last observed time. |
| Market and fill provenance | Did fills come from public execution evidence? | Market source, public execution source, freshness, WebSocket/REST fallback state, stream marker, fill status, and order-book sync state when available. |
| Risk and account | What exposure exists in paper? | Fake equity, available balance, position, open orders, latest fill, latest failure reason. |
| Ledger | Is execution evidence complete? | Chain status, latest order/gateway/execution refs, no-order continuity where present. |
| Lineage | Why does this candidate exist? | Research direction, parent links, findings, paper-board learning summary when available. |
| Boundary | What authority is still disabled? | `not_live`, `mlp_paper_only`, no credentials, no live orders, no private account reads. |
| Next action | What should happen next? | Resume paper, continue collecting, fix quality, inspect active target, replace target, or keep under review. |

The first screen should show verdict, subject, performance, blocker, and next action. Lower sections
can expand detail, but the operator should not have to inspect raw records to know why a candidate
is blocked.

### Packet Audit

The packet should be audited section by section before adding new UI. The point is not to make the
Trading screen denser; it is to make the review object complete enough that CLI, TUI, Web UI, and
future policy automation can answer the same operator questions from one projection.

| Section | Current evidence | Quality reading | Required improvement |
| --- | --- | --- | --- |
| Verdict | `TradingReviewPacket.verdict` carries readiness, qualification, severity, and top blocker. | Implemented at the correct read-model boundary. | Keep severity derived from qualification, mismatch, and promotion state; do not add a UI-only readiness label. |
| Subject | Packet carries candidate id, version id, display name, paper evaluation id, promoted time, selected candidate, and match state. | Complete for the current review target identity. | Keep promoted time inside the packet so CLI/TUI/Web can explain when this review target became active without reading the promotion record separately. |
| Performance | Packet carries paper rank and profit/loss metrics. Evidence window carries observation and elapsed-time data. | Correct separation, but the first scan requires two sections to decide whether the score is meaningful. | Keep rank and score in performance; keep maturity in evidence quality, and render them adjacent in every surface. |
| Evidence window | Packet carries observation count, elapsed ms, failed observation count, first observed time, and last observed time when available. | Complete for the current maturity summary. | Keep first/last observation times as explanatory evidence only; do not make timestamp presence a qualification gate. |
| Quality blockers | Packet carries deterministic blocker groups with summary and next action. | Correct product-facing grouping; it preserves canonical qualification reasons. | Keep this helper shared with CandidateArena researcher context so UI remediation and next-generation research do not drift. |
| Runner health | Packet carries runner status, active flag, run status, last observed time, and next observation time. | Correct authority boundary: runner state is evidence, not a command. | Keep `needs_resume` unmistakable when persisted paper state is running but active runner evidence is missing. |
| Market and fill provenance | Packet carries market source, public execution source, freshness, WebSocket connection state, REST fallback state, stream marker, fill status, and order-book sync summary. | Complete for the current public-market paper evidence path. | Keep order-book continuity sourced only from paper public execution snapshots; future source extensions may add more provenance fields, but the packet must not invent missing evidence. |
| Risk and account | Packet risk carries open order count, latest fill status, latest failure, fake equity, available balance, wallet balance, margin reserved, BTCUSDT position, notional, mark price, and `not_live` authority when paper account snapshots exist. | Complete for current fake paper account exposure. | Keep the packet sourced from paper account snapshots only; never fall back to private-readiness account or substrate data for this paper review object. |
| Ledger | Packet carries chain status, chain completeness, latest order, Gateway outcome, execution status, and decision kind. | Correct proof-chain summary. | Preserve no-order checkpoints as valid evidence; do not make missing orders look like missing proof when the latest decision was hold/no-action. |
| Lineage | Packet carries lineage status, direction, parent candidate/version, generated refs, latest finding, evaluation status, score, and compact paper-board learning summary. | Complete for current review and next-generation context. | Keep `paper_board_learning` under `lineage_only` authority; it may guide the next ResearchWorker but must not replace qualification, packet next action, or promotion authority. |
| Boundary | Packet carries `not_live`, `mlp_paper_only`, and explicit disabled capability booleans. | Implemented and necessary. | Keep this inside the packet even when shown elsewhere, because authority is part of the review evidence. |
| Next action | Packet carries the review next action from promotion/qualification state. | Correct single-action contract. | Do not let lower UI sections introduce competing recommendations; they may explain but not override this action. |

The audit turns the next design work into small evidence closures. A closure is valid only when it
adds missing review evidence to the shared packet, proves it in service tests, and renders the same
meaning across CLI, TUI, and Web UI. A change that only decorates one surface is not enough.

### Packet Shape

The domain shape is a nested read model, assembled in `packages/application` and rendered by CLI,
TUI, and Web UI:

```ts
interface TradingReviewPacketReadModel {
  packet_kind: "trading_review_packet";
  verdict: {
    readiness_status: TradingPromotionReadinessStatus;
    qualification_status?: PaperTradingQualificationStatus;
    severity: "ready" | "collecting" | "needs_resume" | "blocked" | "failed" | "mismatch";
    top_blocker?: PaperTradingQualificationReason | "arena_selection_mismatch" | "paper_required";
  };
  subject: {
    candidate_id?: string;
    candidate_version_id?: string;
    display_name?: string;
    paper_trading_evaluation_id?: string;
    promoted_at?: string;
    selected_candidate_id: string | null;
    selected_matches_trading_review: boolean;
  };
  performance: {
    rank?: number;
    primary_rank_metric: "net_revenue_usdt";
    secondary_rank_metric: "net_return_pct";
    profit_loss?: TradingProfitLossReadModel;
  };
  evidence_quality: {
    evidence_window?: {
      observation_count: number;
      elapsed_ms: number;
      failed_observation_count: number;
      first_observed_at?: string;
      last_observed_at?: string;
    };
    qualification_reasons: PaperTradingQualificationReason[];
    blocker_groups: TradingReviewPacketBlockerGroup[];
  };
  provenance: {
    market_data_source?: PaperTradingMarketDataSourceKind;
    latest_public_execution_source?: PaperTradingMarketDataSourcePriority;
    latest_public_execution_freshness?: PaperTradingMarketDataFreshness;
    latest_public_execution_ws_connected?: boolean;
    latest_public_execution_rest_fallback_used?: boolean;
    latest_public_execution_stream_marker?: string;
    latest_fill_status?: PaperTradingFillSummary["fill_status"];
    order_book?: {
      sync_status: PaperTradingOrderBookSummary["sync_status"];
      last_update_id?: string;
      previous_final_update_id?: string;
      gap_detected: boolean;
      depth_level_count?: number;
      authority_status: "read_only";
    };
  };
  risk: PaperTradingRiskSummaryReadModel;
  runner: {
    runner_status?: PaperTradingBoardRunnerStatus;
    runner_active: boolean;
    trading_run_status?: TradingRunLifecycleStatus;
    last_observed_at?: string;
    next_observation_at?: string;
    authority_status: "not_live";
  };
  ledger: {
    evidence_status: "not_observed" | "no_order_checkpoint" | "complete_chain" | "incomplete_chain";
    ledger_chain_complete: boolean;
    latest_order_request_id?: string;
    latest_gateway_outcome?: string;
    latest_execution_status?: string;
    latest_decision_kind?: PaperTradingDecisionKind;
    authority_status: "not_live";
  };
  lineage: {
    lineage_status: "available" | "blocked" | "missing";
    direction_kind?: ResearchDirectionKind;
    parent_candidate_id?: string;
    parent_candidate_version_id?: string;
    generated_by_agent?: true;
    latest_finding?: string;
    evaluation_status?: string;
    evaluation_score?: number;
    profit_loss?: TradingProfitLossReadModel;
    paper_board_learning?: {
      rank?: number;
      net_revenue_usdt: number;
      net_return_pct: number;
      observation_count: number;
      qualification_status?: PaperTradingQualificationStatus;
      qualification_reasons: PaperTradingQualificationReason[];
      top_blocker?: PaperTradingQualificationReason;
      latest_failure_kind?: PaperTradingFailureKind;
      latest_failure_summary?: string;
      summary: string;
      next_research_focus: string;
      authority_status: "lineage_only";
    };
    authority_status: "lineage_only";
  };
  authority: {
    authority_status: "not_live";
    live_disabled_reason: "mlp_paper_only";
    no_authority: {
      live_exchange_authority: false;
      private_read_authority: false;
      order_submission_authority: false;
      credentials: false;
    };
  };
  next_action: string;
}
```

The shape should stay nested by operator question. A flat field list makes rendering easy for one
UI and hard to maintain across surfaces. Runner, Ledger, lineage, and authority stay inside the
packet because they answer review questions; they do not create runner commands, Ledger records,
candidate generation, credentials access, private reads, order submission, or live authority.

The `Risk and account` closure uses `PaperTradingRiskSummaryReadModel` without renaming the packet
or adding a second review object:

```ts
interface PaperTradingRiskSummaryReadModel {
  open_order_count: number;
  account?: {
    equity_usdt: string;
    available_balance_usdt: string;
    wallet_balance_usdt: string;
    margin_reserved_usdt: string;
    authority_status: "not_live";
  };
  position?: {
    symbol: "BTCUSDT";
    side: "long" | "short" | "flat";
    quantity: string;
    notional_usdt: string;
    average_entry_price?: string;
    mark_price: string;
    authority_status: "not_live";
  };
  latest_fill_status?: PaperTradingFillSummary["fill_status"];
  latest_failure_reason?: string;
  latest_failure?: PaperTradingFailureReadModel;
}
```

Only `PaperTradingEvaluation.paper_account_snapshot` and observation account snapshots may feed
these fields in MLP-01. Private-readiness account and position substrate records must not be
treated as fake paper account evidence for this packet. If no paper account snapshot exists, the
packet should say paper account evidence is missing; it should not fall back to private-readiness
or substrate data.

## Failure Taxonomy

Qualification reasons are correct but too raw for the product surface. Keep the canonical reasons
machine-readable, then group them for review:

| Group | Reasons | Meaning | Operator action |
| --- | --- | --- | --- |
| Evidence window | `min_observation_count_not_met`, `min_elapsed_ms_not_met` | The run is too young. | Continue paper observations. |
| Runner health | `runner_inactive_for_running_evaluation` | Persisted state says running, but scheduler evidence is lost. | Resume the paper run before review. |
| Observation quality | `failed_observation_ratio_exceeded`, `paper_evaluation_failed` | The run is unstable or failed. | Inspect latest failure, fix runtime or protocol issue, then restart/continue evidence. |
| Market provenance | `latest_market_snapshot_missing` | Score lacks current public market context. | Restore Gateway market data path. |
| Fill provenance | `fill_public_execution_evidence_missing` | Fill-bearing result lacks public execution evidence. | Restore public execution stream/backfill and retry observation. |

Paper failure read models should use the same grouping:

| Failure kind | Meaning | Operator action |
| --- | --- | --- |
| `market_data_gap` | Paper observation could not read current public market data. | Restore Gateway market data before continuing paper evidence. |
| `public_execution_evidence_gap` | Fill or execution evidence could not be tied to public execution data. | Restore public execution evidence before trusting fills or paper score. |
| `trading_system_protocol_error` | TradingSystem emitted an invalid paper event or protocol shape. | Fix the paper event protocol before retrying observation. |
| `risk_rejection` | Gateway or paper risk validation rejected the emitted decision. | Review order sizing, side, and risk limits before continuing paper evidence. |
| `sandbox_or_runner_failure` | Sandbox or paper runner failed before reliable evidence could be recorded. | Repair or resume the runner before treating paper evidence as current. |
| `runner_health_loss` | Persisted paper session lost active runner health evidence. | Resume paper trading before review. |
| `ledger_gap` | Paper observation did not produce a complete Ledger chain. | Inspect order, Gateway, and execution records before trusting the observation. |
| `authority_boundary_violation` | TradingSystem attempted private or live authority outside the paper boundary. | Reject or repair the candidate before further review. |
| `unknown_failure` | Paper observation failed without a recognized failure group. | Inspect the raw reason and add a classifier if this recurs. |

Do not collapse these into a single generic failure label. The operator needs to know whether to
wait, resume, fix market data, fix the TradingSystem, or reject the candidate. Do not delete the
raw reason; `PaperTradingFailure` carries both stable product action and debugging evidence.

## UX Contract

The operator UX should be quiet, dense, and ordered by decision value.

### Trading Tab

Target order:

1. Decision bar: current recommendation, authority, runner, market freshness.
2. Trading review packet: verdict, subject, score, blocker group, blocker remediation, evidence
   window, runner, Ledger, lineage, next action, authority.
3. Paper account and risk readback: equity, position, open orders, fills, latest failure.
4. Market and execution provenance: market source, public execution source, order book/fallback
   state.
5. Ledger and detailed readback.

If the Trading review packet renders supporting provenance or risk fields inline, place them after
the packet next action and authority so they do not compete with the promotion decision path.

The Trading tab should not make the operator infer readiness from charts. Charts are context, not
the promotion gate.

### Arena Tab

Target order:

1. Arena controls and researcher readiness.
2. Selected candidate paper controls.
3. PaperTradingEvaluation board ranked by paper score.
4. Qualification and promotion-gate reasons in the board row.
5. Candidate details and paper readback.

The Arena tab should make exploration fast while keeping final review in Trading.

### Research Tab

Research should show how evidence changes the next generation:

- direction performance
- failed directions
- findings and lineage clusters
- paper-board summaries used as next context, including blocker groups and remediation targets
- cost and latency proxies when available

Research is where autonomy improves. Trading is where evidence is judged.

### Visual Grammar

- Use restrained status badges for authority, readiness, runner, and source state.
- Use tables or compact definition grids for evidence, not long prose blocks.
- Prefer one strong decision row over several competing cards.
- Avoid nesting framed cards when the content is one decision surface; use unframed sections inside
  the surface and reserve cards for repeated records or separately framed tools.
- Use destructive tone only for authority violations, quality blockers, paper failures, and
  selected-target mismatches.
- Keep live-disabled state visible but not noisy; it is a standing invariant, not a warning that
  needs to dominate every row.

## Full-Surface Quality Audit

Product quality is not finished when one packet, tab, or test looks correct. The whole operator
surface must be audited from the top of the loop down to raw evidence. Every row below should be
treated as a product object with a role, evidence source, authority boundary, and maintenance
owner. If a future change cannot answer those points, it is not ready to ship.

### Audit Method

For each product element, ask the same questions in order:

1. Does this element strengthen CandidateArena generation, external Evaluation,
   PaperTradingEvaluation, qualification, Trading review, or next-generation lineage?
2. Is the primary evidence read from the shared read model, a domain record, or a documented port?
3. Is the element read-only, command-capable, or adapter-owned, and is that authority visible?
4. Is the next action singular and compatible with the packet or qualification state?
5. Can CLI, TUI, Web UI, and tests express the same meaning without duplicating business logic?
6. If the element vanished, would the operator lose a decision-critical fact or only decoration?

The audit should prefer removal or relocation over adding another card. A dense surface is good
only when density follows decision value.

### Current Surface Readout

| Surface | Product role | Evidence source | Authority boundary | Quality decision | Improvement focus |
| --- | --- | --- | --- | --- | --- |
| Operator decision bar | One-line recommendation for the current Trading view. | `OperatorReadModel`, selected candidate, Trading review state. | Read-only summary plus scoped observe/stop commands. | Keep. It orients the first viewport before detail. | Ensure its recommendation never conflicts with `TradingReviewPacket.next_action`. |
| Trading promotion boundary | Shows whether the selected Arena candidate can become the active Trading review target. | `TradingPromotion`, `TradingReview`, selected paper board row. | `trading_candidate.promote`; still `not_live`. | Keep. It is the explicit bridge from Arena proof to review. | Keep mismatch and non-qualified states unmistakable; do not phrase promotion as live enablement. |
| Trading review packet | Shared review object for verdict, subject, score, blockers, runner, Ledger, lineage, provenance, risk, authority, and next action. | `OperatorReadModel.trading_review.review_packet`. | Read-only projection. | Keep as the primary product-quality object. | Add fields only when they answer a review question across CLI/TUI/Web. |
| Safety boundary | Standing reminder that MLP-01 is paper-only. | Runtime binding and candidate fixture statements. | No command authority. | Keep, but quiet. It prevents authority ambiguity. | Avoid repeating the same warning so loudly that it competes with packet blockers. |
| Trading cockpit and chart | Contextual market and paper account readback below the review decision. | Public market surface, paper account snapshot, Ledger readback. | Read-only evidence. | Keep below packet. Charts cannot be the gate. | Keep charts subordinate to qualification and provenance. |
| Trading paper readback | Detailed status for `Paper Trading Evaluation`, `Paper runner`, paper market snapshot, Gateway market data, paper fill, public execution evidence, public order-book evidence, and failure. | `PaperTradingEvaluation`, paper board risk summary. | Read-only evidence. | Keep as explanation, not recommendation. | Do not duplicate packet next action with another recommendation. |
| Arena command bar | Starts, stops, and ticks CandidateArena research. | Command registry and arena runner state. | `arena.start`, `arena.stop`, `arena.tick`. | Keep in Arena only. It is research control, not Trading review. | Show provider readiness and live-disabled authority near the controls. |
| PaperTradingEvaluation board | Product evaluation leaderboard for selected candidates. | `paper_trading_board.entries`. | Read-only board plus row-level paper controls elsewhere. | Keep. It separates rank from readiness. | Keep negative, blocked, failed, and collecting rows visible. |
| Candidate Arena leaderboard | Research preflight ordering for generated candidates. | `candidate_arena.leaderboard`. | Read-only selection surface. | Keep distinct from paper board. | Do not let replay/backtest rank look like product authority. |
| Candidate Arena inspector | Selected candidate paper controls and evidence details. | Selected candidate, selected paper evaluation, Ledger, public execution snapshot. | Starts/observes/stops selected paper run. | Keep as the workbench for proof gathering. | Keep Trading review replacement scoped to qualified paper evidence, not inspection alone. |
| Agent provider status | Shows managed research provider readiness. | `researcher_provider`, `agent_profiles`, command log. | Provider setup/probe/login-start commands; no trading authority. | Keep in Arena context. | Avoid provider-brand language becoming product authority. |
| Research paper evidence learning | Shows what selected paper evidence should teach the next ResearchWorker. | `TradingReviewPacket.lineage.paper_board_learning`. | Read-only `lineage_only`; no promotion authority. | Keep near the top of Research when available. | Keep next research focus sourced from paper evidence, not replay score alone. |
| Research generalization | Shows prospective protocol lifecycle, condition-block progress, deadline, and latest conservative cross-study outcome. | `CandidateArenaReadModel.research_generalization`. | Read-only `not_promotion_authority`; no allocation or ResearchWorker feedback. | Keep before Finding clusters and Research signals. | Preserve simultaneous active/latest evidence and exclude raw studies, artifacts, and per-slot effects. |
| Research tab system performance | Explains how current evidence affects the next research cycle. | Candidate lineage, Evaluation, replay/full-cycle compatibility records. | Read-only, except developer-detail controls below Details. | Keep, but align with CandidateArena doctrine. | Keep paper-board learning above generic system performance when available. |
| Research cycle and generated-system cards | Shows SystemCode, backtest, paper run, and Ledger handoff lineage. | Full-cycle and recovered lineage records. | Read-only lineage. | Keep as historical compatibility, not primary workflow. | Keep wording clear that CandidateArena is the main research loop. |
| Details tab | Raw records, developer controls, substrate readbacks, replay, private-readiness, and compatibility surfaces. | Candidate inspect model and low-level records. | Mixed developer commands; no live authority. | Keep below the product loop. | Keep the raw-evidence/developer-record boundary visible and prevent Details from becoming the only place to understand promotion blockers. |
| CLI status | Automation-friendly baseline operator summary. | `GET /api/operator`. | Commands through CLI command surface. | Keep as parity baseline. | Render packet semantics in the same order as Web/TUI where practical. |
| TUI status | Keyboard operator console. | `GET /api/operator`. | Commands through shared command endpoint. | Keep as compact parity surface. | Preserve packet, mismatch, runner, provenance, risk, and failure wording. |
| Tests and guards | Prove states, boundaries, parity, naming, architecture, docs, env, and secrets. | Vitest, docs checks, architecture/naming guards, secret/env checks. | No product mutation authority. | Keep as quality operating system. | Add scenario tests whenever a new surface state or authority boundary appears. |

### Element Detail Ledger

This is the working product-quality ledger. It should be updated before broad UI, command,
architecture, or autonomy changes. Each row answers why the element exists, what makes it good, and
what kind of improvement is allowed. If a future row cannot name its evidence and authority, the
element is probably decoration or misplaced behavior.

#### Product Spine Objects

| Element | Essential function | Maintenance boundary | Quality pressure | Acceptable next improvement |
| --- | --- | --- | --- | --- |
| `CandidateArena` | Keep many candidate hypotheses moving through research, evaluation, findings, and lineage. | Application use case and read model; UI only controls and displays it. | Autonomy must increase candidate diversity, not edit one artifact until it looks convincing. | Durable ResearchWorker workspace/recovery ownership and discovery-yield evidence under controlled runs. |
| `ResearchDirection` | Name the lane being explored so parallel candidates do not become random variants. | Domain vocabulary plus CandidateArena context. | Directions must be distinct enough to teach the next tick something. | Direction scoring that includes paper-board learning without making it promotion authority. |
| `CandidateArenaResearchAllocation` | Freeze which directions run, why they run, and their bounded concurrency and experiment budgets before worker effects. | Domain record, application allocator, LocalStore, latest-tick read model, and researcher context. | Focus must change actual resources while completed-history exploration prevents entropy collapse. | Longitudinal adaptive-versus-static discovery-yield evidence; do not infer a learned reward model from scheduling scores. |
| `ResearchPopulationDiversity` | Make recent population coverage and each tick's worker cross-sectional concentration separately visible. | Pure application read-model builder over bounded append-only evidence; shared CandidateArena and next-worker read model. | Rolling coverage must not be mislabeled as current entropy, cross-suite samples must be incomparable, raw fingerprints must stay hidden, and entropy must never become quality or authority. | Add semantic-family classification or policy feedback only through a separately versioned evaluator and controlled causal design. |
| `ResearchControlCampaign` | Make an Arena policy ablation executable without cross-arm memory, population, or duplicate-baseline contamination. | Domain/application decisions, append-only LocalStore graph, and internal runtime snapshot/arm composition. | Exact baseline and source closure precede effects; both arms have equal maximum bounds; diagnostics never declare a winner; restart cannot replay a completed tick. | Schedule precommitted candidate slots through prospective qualified paper comparisons and add a separately sealed outcome. |
| `ResearchPreflightCommitment` | Freeze source, worker, allocation, development policy, and one evaluator-owned rotating sealed set before worker effects. | Domain record, in-memory evaluator plan, application use case, and append-only LocalStore graph. | Development feedback must remain useful without becoming admission evidence; raw seed and sealed scenarios stay unavailable to workers. | Durable evaluator-owned recovery only with an explicit design; current process loss deliberately fails closed. |
| `ResearchWorker` | Generate a candidate inside one direction with repo context and tool limits. | Provider adapter plus application orchestration. | Worker output is material, not proof. | Better prompt context from failed paper evidence, lineage clusters, and protocol violations. |
| `TradingSystem` | Own its decision cadence and emit bounded paper events. | Candidate runtime and paper event protocol. | It must be able to include code, tools, or internal agents without touching exchange authority. | Richer internal agent/tool loops that still emit only validated `OrderRequest`, `cancel_order`, `hold`, or `no_action` events. |
| `SystemCode` | Package executable candidate behavior for sandboxed runs. | Candidate materialization and Sandbox boundary. | Code quality matters only as part of a TradingSystem that can be externally evaluated. | Verification metadata that explains run commands, dependencies, and protocol capability. |
| `ResearchPreflight` | Use bounded adaptive development to select one artifact, then run one rotating sealed admission over its frozen bytes. | Research evaluator plan, replay runner, terminal evidence, and compact direction readback. | Development score has no admission authority; sealed content never returns to the worker; neither phase proves future economics. | Broader adversarial side-channel and cross-commitment probing controls without turning query caps into a reward-hacking claim. |
| `Evaluation` | Record preflight/backtest score and acceptance status. | Domain evidence record. | Must not be confused with selected continuous paper evidence. | Explicit labels for preflight vs paper authority in every projection. |
| `Finding` | Preserve what a candidate, failure, or direction taught the arena. | CandidateArena lineage memory. | Findings must be reusable context, not narrative decoration. | Cluster findings by direction, blocker, market regime, and protocol failure. |
| `FindingCluster` | Group paper-backed findings into reusable next-generation research pressure. | CandidateArena read model, researcher context, and Research tab read-only surface. | Clusters may feed bounded ResearchWorker allocation and context, but must not become rank, qualification, Trading review blockers, or promotion authority. | Change allocation scoring only with separate tests, equal-bound controls, and `not_promotion_authority` evidence. |
| `Lineage` | Explain why a candidate exists and what it inherited. | Domain/read-model projection. | Lineage should teach generation without granting readiness. | Link parent direction, latest finding, paper learning, and evaluation score in one compact context. |
| `PaperTradingEvaluation` | Evaluate selected candidates continuously with public market data, fake account, fake execution, and Ledger evidence. | `packages/application/src/trading/paper/*` and Gateway ports. | This is the MLP-01 product evidence surface. | Better score trajectory, fill provenance, and account-risk readback; observation cadence lag now feeds Research as `not_promotion_authority` context. |
| `PaperTradingQualification` | Decide whether paper evidence is mature enough to trust. | Qualification policy and shared blocker helpers. | Rank and readiness must stay separate. | Expand blocker grouping only when it preserves canonical reasons and deterministic remediation. |
| `PaperTradingFailure` | Classify latest paper failure while preserving the raw reason. | Paper failure classifier and read-model projection. | Failure must become action, not disappear when another candidate appears. | Add classifier cases only after recurring raw reasons prove a stable product action. |
| `TradingPromotion` | Move one qualified paper-backed candidate into Trading review. | `trading_candidate.promote` command and service gate. | Promotion is review selection, not live exchange enablement. | Stronger mismatch and replacement evidence when the Arena selection changes. |
| `TradingReview` | Bind the active review target and selected Arena candidate relationship. | Operator read model. | Trading controls must act on the review target, not whichever candidate is being inspected. | Preserve target/selection mismatch across CLI, TUI, and Web with identical meaning. |
| `TradingReviewPacket` | Explain verdict, subject, performance, blockers, runner, Ledger, lineage, provenance, risk, authority, and next action. | Read-only projection inside `TradingReview`. | This is the product judgment object, not a command or gate. | Add fields only when they answer a review question across all operator surfaces. |
| `Gateway` | Validate requests, own public market data access, and route fake execution. | Application port plus concrete adapters. | Gateway has authority; TradingSystem has intent. | Authority decorators for timeout, retry, audit, and provenance without changing candidate identity. |
| `MarketDataPort` | Keep Binance public market data behind a Gateway-owned boundary. | Adapter port and Binance adapter. | Public evidence must be attributable and retryable; private/live access stays outside MLP-01. | More explicit source health, cache age, WebSocket continuity, and REST fallback summaries. |
| `Ledger` | Preserve order, Gateway, execution, and observation evidence chain. | Domain evidence and store records. | Ledger truth is record truth; it should not explain beyond evidence. | Better no-order checkpoint and incomplete-chain summaries in review packet surfaces. |
| `ResearchEfficiency` | Compare development and sealed submission/cost counts without creating a rank metric or exposing evaluator content. | CandidateArena tick direction result and next-worker count context. | Efficiency is a research signal, not promotion authority; compatibility totals keep development scheduling semantics. | Add provider-dollar cost only when adapters expose it reliably. |

#### Operator Surface Objects

| Surface element | Essential function | Maintenance boundary | Quality pressure | Acceptable next improvement |
| --- | --- | --- | --- | --- |
| Navigation shell | Let operators move by product loop state: Trading, Arena, Research, Details. | Web UI presentation only. | Active state must be unmistakable and should not imply hidden authority. | Show tab-level state badges only when sourced from `OperatorReadModel`, such as active review, collecting paper, or provider blocked. |
| Candidate Arena cockpit | Make the research engine operable and inspectable. | Arena tab over shared commands/read model. | It should feel like a workbench, not the final judgment screen. | Compress runner/provider readiness and authority into the first scan. |
| Arena command bar | Start, stop, and tick research. | `arena.start`, `arena.stop`, `arena.tick`. | Research commands must not look like trading controls. | Disable or annotate controls when provider readiness or runner state blocks useful progress. |
| PaperTradingEvaluation board | Rank selected paper evidence by accumulated paper performance while showing qualification separately. | `paper_trading_board.entries`. | A high score with thin evidence must be visibly not ready. | Add trend and blocker-density signals without changing rank rules. |
| Candidate Arena leaderboard | Show research preflight ordering. | CandidateArena read model. | It must never outrank or visually replace the paper board. | Label preflight score and paper evidence distance more directly. |
| Candidate Arena inspector | Inspect selected candidate, start/observe/stop selected paper run, and read latest evidence. | Arena tab selected-candidate section. | Inspection should gather proof, not imply review approval. | Make the path from qualified paper evidence to Trading review explicit and disabled otherwise. |
| Agent provider status | Show managed provider readiness and setup/probe actions. | AgentProfile commands and researcher provider selection. | Provider brand is implementation detail, not product authority. | Surface blocked provider remediation near Arena controls without moving it into Trading. |
| Command log | Show recent operator command evidence. | Shared latest command records. | Command logs explain what happened; they do not define product state. | Group failed commands by command kind and next remediation. |
| Latest ticks | Show recent CandidateArena activity. | CandidateArena tick summaries. | Tick history should teach research momentum, not decorate the page. | Include direction, generated count, failure count, and efficiency when available. |
| Operator decision bar | Give one first-viewport Trading recommendation. | Trading tab projection from shared read model. | It must not conflict with `TradingReviewPacket.next_action`. | Derive recommendation from packet severity, runner state, and selected mismatch in one helper. |
| Trading promotion boundary | Explain whether selected paper evidence can enter Trading review. | `TradingPromotion`, `TradingReview`, paper board row. | It is the bridge from Arena proof to review, not live enablement. | Keep replacement of active review target explicit and qualified. |
| Trading review packet UI | Render the shared packet in decision-value order. | Web/TUI/CLI presentation over packet. | Packet order should answer trust before detail. | Add compact section grouping or progressive disclosure without hiding blockers. |
| Operator messages | Show mutation success or failure after commands. | Command response state. | Messages are transient; they must not become the only place blockers are visible. | Link command errors back to visible blocker sections. |
| Safety boundary | Keep MLP-01 paper-only authority visible. | Runtime and read-model authority flags. | It should be quiet but always present where a promotion word appears. | De-duplicate repeated warnings while keeping explicit disabled capabilities in the packet. |
| Trading cockpit | Show active review context and paper state below the decision packet. | Trading tab readback. | Context must stay subordinate to qualification and packet verdict. | Keep chart/account/readback layouts compact and evidence-first. |
| BTCUSDT futures chart | Provide market context for paper observations. | Public market readback. | Charts cannot be the gate. | Make freshness and source mode more visible than decorative price movement. |
| Paper trading review summary | Show paper account, score, position, and public execution evidence. | Paper account snapshot and public execution snapshot. | These are supporting facts, not separate recommendations. | Align summary labels with packet risk and provenance wording. |
| Trading paper readback | Explain runner, paper market snapshot, Gateway market data, paper fill, public execution evidence, public order-book evidence, and failure detail. | `PaperTradingEvaluation` and paper board risk summary. | Readback should explain the packet, not compete with it. | Keep classified failure remediation before raw text. |
| Paper evidence learning | Feed selected paper result back into Research. | `TradingReviewPacket.lineage.paper_board_learning`. | It may guide ResearchWorkers, but it is `lineage_only`. | Add failed-direction and blocker-cluster context when available. |
| Research signals | Show read-only research-facing quality, risk posture, and packet signal for the next candidate cycle. | Candidate lineage, Evaluation, compatibility records. | It must not repeat Trading recommendations as if Research can promote. | Keep signal labels research-facing when they sound like operator decision authority. |
| Research cycle | Show candidate-generation flow, backtest/preflight, and handoff lineage. | Full-cycle and recovered lineage records. | Compatibility flow must not displace CandidateArena doctrine. | Use CandidateArena language first, compatibility language second. |
| Agent generated Trading System cards | Show materialized SystemCode and run evidence. | Generated candidate records and full-cycle lineage. | These cards are useful only when they explain why a candidate exists. | Collapse verbose raw implementation data behind Details when it is not decision-critical. |
| Fixture notice | Explain why current evidence may be fixture/dry-run only. | Candidate fixture and compatibility metadata. | Fixture status must not look like real PnL. | Keep fixture messaging in Details unless it affects first-viewport trust. |
| Details boundary | Mark Details as raw evidence and developer/detail records. | Web UI label and low-level inspect model. | Details must not become qualification, promotion, live-authority, or ordinary trust surface. | Keep owner/reads/never-does/use-for fields above raw details. |
| Developer/detail controls | Expose replay, full-cycle, private-readiness, run-control, and compatibility tools. | Details tab and command registry. | These are maintenance tools; they must not create product authority by proximity. | Group controls by authority and move any product-critical blocker up to Trading or Arena. |
| Private-readiness panels | Inspect future private/live posture without enabling it. | Trading substrate readback and posture records. | Future authority preview must stay below MLP-01 product loop. | Keep checked gates and remediation useful while preventing accidental live-path language. |

#### Interface And Harness Objects

| Element | Essential function | Maintenance boundary | Quality pressure | Acceptable next improvement |
| --- | --- | --- | --- | --- |
| Runtime HTTP | Compose adapters and expose shared read/command endpoints. | `apps/runtime` controllers and registry. | Controllers validate and dispatch; they do not own product logic. | Keep route modules thin and push orchestration into application services. |
| Command registry | Define every product-facing mutation name and authority. | `packages/domain` command descriptors. | UI, CLI, and TUI must not invent commands. | Add descriptors before adding new surfaces or aliases. |
| CLI status | Provide automation-friendly loop state. | CLI over `GET /api/operator` and `POST /api/commands`. | CLI wording is part of product truth, not a debug dump. | Match packet section order where practical. |
| TUI status | Provide keyboard-first operator console. | Ink UI over shared read/command contracts. | Compactness must not erase blocker, mismatch, or authority detail. | Preserve exact packet semantics with shorter labels. |
| Desktop app | Provide the primary daily operator experience, background runtime visibility, and packaged local app surface. | `apps/operator-desktop` over shared read/command contracts and shared Operator UI source. | App chrome, runtime status, and session continuity must reflect shared runtime/store truth. | Improve app-owned lifecycle and status affordances before adding separate product surfaces. |
| Shared Operator UI | Provide dense visual operator surface for Desktop and browser/development use. | `apps/operator-web` over shared read/command contracts. | Visual hierarchy must follow product authority, not data volume. | Improve scan order before adding new cards. |
| Tests | Prove product states and failure cases. | Vitest suites and fixture tests. | Tests are the quality operating system for autonomy. | Add tests for every new authority boundary, state, or packet field. |
| Docs | Preserve durable product truth and read order. | Root docs, `docs/`, `.agents`. | Docs should explain why a change belongs, not narrate implementation history. | Keep design truth in this page and command/architecture truth in their canonical docs. |
| Checks | Enforce docs, architecture, naming, env, secrets, and diff hygiene. | Scripts and npm checks. | Green checks are necessary but not sufficient for product quality. | Add checks only when they enforce a durable rule, not a one-off preference. |

### Source-To-Surface Evidence Map

Every product element needs a code owner, an interface owner, and proof. This map is the working
audit index for "does this belong, and is it expressed with the right authority?"

| Product question | Source of truth | Operator surfaces | Proof surface | Current gap |
| --- | --- | --- | --- | --- |
| What is the active Trading review target and next action? | `TradingReviewPacket` in `OperatorReadModel`. | CLI, TUI, Web Trading. | Packet service tests and surface tests for subject, blocker, next action, mismatch, and first-viewport recommendation. | Keep `buildTradingFirstViewportRecommendation` aligned with packet semantics as new Trading review states are added. |
| Is paper score meaningful or only high? | `paper_trading_board.entries`, `PaperTradingQualification`, evidence window. | Arena board, Trading review packet, CLI/TUI status. | Board ranking/qualification tests and interface parity tests. | Keep summary wording aligned with packet risk/provenance. |
| What did the latest CandidateArena tick actually allocate and produce? | `CandidateArenaTickReadModel.research_allocation`, `direction_results`, and `ResearchEfficiency`. | Arena latest ticks, CLI status, TUI status, next researcher context. | Allocation persistence/restart/context tests plus CLI/TUI/Web status tests. | Provider-dollar cost remains unavailable until adapters expose reliable usage. |
| Is prospective cross-study generalization collecting, awaiting reconciliation, or closed? | `CandidateArenaReadModel.research_generalization`. | CLI status, TUI Arena scan, Web Research. | Pure projection graph tests, operator HTTP integration, interface parity, and active/latest/empty surface tests. | Real-market protocol completion and any generalization-policy decision remain separate frontiers. |
| What should the next ResearchWorker learn? | CandidateArena read model/context, allocation selection, findings, lineage, paper-board learning, paper-loop latency, finding clusters, and adaptive direction focus. | Research tab and researcher prompt context. | CandidateArena allocation/read-model/context tests plus Web Research surface tests. | Provider-dollar cost remains unavailable until adapters expose reliable usage. |
| Can the operator trust a fill-bearing paper result? | Public execution snapshot, order book summary, fake account, Ledger. | Trading packet provenance/risk, Arena readback, CLI/TUI status. | Operator paper-board, packet, and smoke tests. | Chart freshness/source mode can be more visible without becoming a gate. |
| Where do raw records and future private/live posture belong? | Candidate inspect model, substrate readbacks, private-readiness surfaces. | Details only, with boundary labels. | Web Details tests and no-action-control assertions. | Any product-critical blocker discovered there must be moved up to Trading or Arena. |

### Current Code-Surface Audit Ledger

This ledger ties the design contract back to the current code surface. It is not a list of files to
touch blindly; it is the audit trail for why each surface exists, what it proves today, and what
kind of improvement is allowed next.

| Code surface | Product-quality reading | Current evidence | Next improvement rule |
| --- | --- | --- | --- |
| `packages/domain/src/index.ts` read models | Strong keep. Domain now carries the product objects that should survive UI/provider changes: CandidateArena, CandidateArenaResearchAllocation, PaperTradingEvaluation board, TradingPromotion, TradingReview, TradingReviewPacket, ResearchEfficiency, FindingCluster, PaperTradingFailure, and first-viewport recommendation. | Types carry explicit `research_only`, `not_live`, `not_promotion_authority`, `lineage_only`, and `read_only` authority statuses. | Add new fields here first only when they answer a product question across CLI/TUI/Web; otherwise reject UI-only state. |
| `OUROBOROS_COMMAND_REGISTRY` and `OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS` | Strong keep. Command names define product authority and prevent interface surfaces from inventing mutations. | Product loop includes `trading_candidate.promote`, paper run commands, provider commands, and researcher provider selection. | Any new operator mutation must enter the registry before UI controls; developer/detail commands must not become product-loop commands by proximity. |
| `commandRemediation` | Keep. Failed command evidence is turned into a pointer back to the owning visible surface rather than becoming hidden product state. | Failed promote, paper-run, paper-evidence, provider, arena, and selection commands map to remediation surfaces. | Expand only when a failure has a stable owning surface; never make the command log the blocker owner. |
| `packages/application/src/services/operator.ts` | Strong keep, but watch size. This is the main read-model builder for paper board, promotion gate, TradingReview, and TradingReviewPacket. | `buildTradingReviewPacket` groups verdict, subject, performance, evidence quality, provenance, risk, runner, Ledger, lineage, authority, and next action from existing records. | If another packet section is added, add service tests and keep the packet nested by operator question; extract helper modules only when size starts hiding ownership. |
| `packages/application/src/candidate/arena.ts` | Strong keep. CandidateArena context learns from paper evidence and executes a persisted pre-effect allocation instead of merely reordering every default lane. | Adaptive default selects three of five lanes, at most two focus plus at least one exploration, with concurrency two and two/one experiment budgets; context carries the compact allocation, paper learning, efficiency, clusters, and direction focus. | Scheduling signals may guide worker selection and budget only; they must stay out of rank, qualification, review readiness, promotion, orders, private access, and live authority. |
| `qualification-blockers.ts` | Strong keep. It prevents raw qualification reasons from becoming inconsistent UI prose. | Canonical reasons map to deterministic group, severity, summary, and next action. | Add groups only when a canonical reason or recurring evidence pattern exists; do not weaken `PaperTradingQualification`. |
| `failures.ts` | Keep. It turns raw paper failure text into stable action without deleting debug evidence. | Failure kinds cover market data, public execution, protocol, risk, sandbox/runner, runner health, Ledger, authority violation, and unknown. | Add classifier cases only after repeated raw reasons justify a stable operator action. |
| `learning.ts` | Keep. It is the bridge from product paper evidence back into Research without creating promotion authority. | Summaries carry rank, score, qualification, blockers, latest failure, next research focus, and `lineage_only`. | Keep this shared between TradingReviewPacket lineage and CandidateArena context so Research and review do not drift. |
| `packages/local-store/src/index.ts` validators | Keep. Persistence validators are part of product quality because they reject malformed stored evidence. | Allocation shape/digest/authority and exact tick ref, digest, direction order, replay, and restart binding are validated alongside `ResearchEfficiency`. | Add validators for new durable read-model fields at the same time as domain types; never let persisted authority fields become optional by accident. |
| `packages/local-store/src/trading-substrate-surfaces.ts` | Keep below the product loop. It converts substrate records into read models for Details and supporting market evidence. | Public market, order fill, private-readiness, and account-position surfaces keep source, freshness, fixture/simulated flags, and authority labels. | Product-critical facts discovered here must move up to Trading/Arena/Research; private-readiness must remain future posture, not paper review evidence. |
| `apps/cli/src/ouroboros-cli.ts` | Keep as parity baseline. CLI wording is product truth for automation, not a debug dump. | Status renders review packet, evidence window, blockers, authority, runner, Ledger, lineage learning, provenance, risk, paper board trend, blocker density, market data, failures, and command remediation. | Match packet semantics before adding CLI-only summaries; compactness cannot remove authority or blocker meaning. |
| `apps/operator-tui/src/operator-tui.tsx` | Keep as keyboard operator console. | TUI renders the same packet, paper board, runner, provenance, research efficiency, and latest tick meanings in compact form. | Preserve exact semantics with shorter labels; do not let TUI actions silently target the Arena selection when TradingReview differs. |
| `apps/operator-web/src/App.tsx` Trading/Arena/Research/Details | Keep, with strict ordering. Web is the richest surface, so it is most likely to accumulate decorative or duplicate elements. | Trading renders decision bar, promotion boundary, packet, paper summary, provenance, risk, and readback. Arena owns research and paper board. Research owns lineage learning and finding clusters. Details is labeled raw evidence/developer records. | Before adding another card, decide whether the fact belongs in packet, board, Research learning, or Details; remove or relocate duplicate recommendations. |
| Tests and guards | Strong keep. They are the operating system for autonomous quality. | Runtime, Web, CLI, TUI, domain, local-store, docs, naming, architecture, env, secrets, and diff checks cover the current frontier. | Every new state, authority boundary, or packet field needs a matching test or guard; green broad checks are necessary but not sufficient unless they cover the product question. |

### Detail Review Sequence

Before implementing any product-quality improvement, walk the element through this sequence:

1. Name the element's place in the product spine.
2. Name the record, read model, port, or command that owns its evidence.
3. Name its authority: read-only, command-capable, adapter-owned, or future/out-of-scope.
4. Decide whether the element belongs in Trading, Arena, Research, Details, CLI/TUI, docs, or tests.
5. Write the failing test or doc assertion that proves the missing state or boundary.
6. Implement the smallest change that makes the evidence more honest.
7. Remove or relocate any text, card, command, or field that now duplicates a stronger source.

This sequence is the quality bar. A change that skips it may still pass tests, but it is not yet
product design.

### Design Detail Closure Loop

The audit is not complete when an element is described. It is complete only when the element has a
decision that a future worker can act on without inventing product intent. Every audited element
must end in exactly one of these decisions:

| Decision | Use when | Required proof | Next action |
| --- | --- | --- | --- |
| Keep | The element has a product-spine role, a durable owner, direct evidence, visible authority, state coverage, and a test or guard. | Existing docs, read model, command, service, adapter, UI, and tests already prove the role. | Preserve it. Future edits may only clarify the same role. |
| Refine | The role is correct, but wording, scan order, grouping, evidence maturity, or parity is weak. | A failing test, doc assertion, or screenshot/markup check can prove the weakness. | Make the smallest change that makes the evidence more honest. |
| Relocate | The fact is useful but appears on the wrong surface. | The target surface owns the operator question better than the current surface. | Move it to Trading, Arena, Research, Details, CLI/TUI, docs, or tests according to authority. |
| Remove | The element repeats stronger evidence, fills space, or forces the operator to reconcile competing hints. | Removing it does not hide a decision-critical fact because a stronger source already exists. | Delete it before adding replacement surface area. |
| Reroute | The element needs new authority, live/private access, a second promotion path, or a policy decision outside MLP-01. | It cannot be proven inside the current paper-only CandidateArena loop. | Reroute through a future repo issue or Linear workflow note that points back to repo truth. |

This is the practical version of functional restraint. A product-quality pass should produce fewer
ambiguous elements, not merely more complete screens. When an element is refined, the test should
prove the product question, not only the rendered text. When an element is removed, the stronger
source that remains must be named in the commit or PR description.

### Improvement Queue

The queue below is derived from the ledger above. Priority means product-truth risk, not delivery
urgency. Each item should become a bounded frontier with tests before implementation.

| Priority | Improvement | Why it matters | Owner surface | Proof required | Boundary |
| --- | --- | --- | --- | --- | --- |
| P0 | Derive the Trading first-viewport recommendation from `TradingReviewPacket` severity, next action, runner state, and selected-target mismatch in one shared helper. | The first sentence the operator reads must never conflict with the packet. | `packages/domain` read-only helper, then CLI/TUI/Web rendering when a surface needs a first-viewport recommendation. | Tests where collecting, blocked, failed, mismatch, and ready states produce one consistent recommendation. | Read-only recommendation; no new promotion command. |
| P0 | Keep product-critical blockers above Details. | Details is raw evidence; ordinary trust must come from Trading/Arena/Research. | Trading packet, Arena board, Research learning, Details boundary. | Web/CLI/TUI tests proving blocker, failure, and mismatch appear before raw records. | Details may explain; it must not become the only source. |
| P0 | Make qualified replacement of an active Trading review target explicit. | Replacing the review target is a product decision, not a side effect of inspecting a candidate. | `trading_candidate.promote`, Trading promotion boundary, command errors. | Service and UI tests for selected target mismatch, qualified replacement, and non-qualified rejection. | Still `not_live`; no exchange authority. |
| P1 | Group failed commands by command kind and visible remediation. | Command messages disappear; remediation must survive in the product surface. | Operator messages, command log, blocker/failure sections. | Tests where a failed command points to an existing blocker or failure surface. | Do not make command log the source of product state. |
| P1 | Add tab-level state badges only from `OperatorReadModel`. | Navigation can improve scan speed, but only if it reflects real state. | Web navigation shell. | UI tests for active review, collecting paper, provider blocked, and no badge when state is absent. | Badges are read-only labels, not commands. |
| P1 | Refine paper-board trend and blocker-density signals. | Rank alone hides whether evidence quality is improving or repeatedly blocked. | PaperTradingEvaluation board and researcher context. | Board tests proving rank remains `net_revenue_usdt` first while trend/blocker density stay explanatory. | Do not change rank or qualification policy. |
| P1 | Refine tick direction, generated count, failure count, and `ResearchEfficiency` in latest ticks. | Autonomy quality depends on trajectory and cost, not just latest candidate output. | CandidateArena latest ticks, CLI/TUI/Web status. | CandidateArena/read-model tests and parity tests. | Efficiency remains `not_promotion_authority`. |
| P1 | Refine paper review summary labels with packet risk and provenance wording. | Duplicate labels create drift between compact summary and review packet. | Trading paper review summary and `TradingReviewPacket`. | Snapshot/markup tests proving account, position, fill, and source wording match packet semantics. | Summary explains packet; it does not override it. |
| P2 | Make market chart freshness and source mode more visible than visual movement. | Trading charts are context; stale or fixture data must not look persuasive. | BTCUSDT chart and market readback. | UI tests for stale, fixture, WebSocket, and REST fallback states. | Chart remains below qualification and provenance. |
| P2 | Keep finding clusters and bounded allocation as shared read-model and Research context. | Research should improve from accumulated evidence while preserving exploration and reconstructable resource choices. | `CandidateArenaReadModel`, researcher context, and Web Research surface. | Allocation/read-model/context tests showing actual three-of-five selection, focus/exploration budgets, completed-history coverage, equal-bound static control, and closed authority. | Clusters and efficiency guide research scheduling only; no rank, qualification, Trading review blocker, promotion, order, private, or live authority. |
| P2 | Add provider-dollar cost when adapters expose reliable usage. | Cost matters for autonomous loops but should not be guessed. | Provider adapters, `ResearchEfficiency`. | Adapter tests with explicit usage evidence and no value when unavailable. | Cost is research efficiency, not rank or promotion gate. |
| P3 | Keep `ResearchPopulationDiversity` as a shared coverage and cross-sectional diagnostic before testing policy feedback. | The system must distinguish rolling coverage, current worker concentration, assigned lanes, and observed behavior without manufacturing cross-suite novelty. | `CandidateArenaReadModel`, pure application builder, and next-worker context. | Known-distribution entropy tests, latest-collapse trajectory tests, exact-linkage and mixed-cohort adversarial tests, E2E distinct/duplicate context tests, and equal-bound future controls. | No automatic collapse threshold or rank, admission, allocation, qualification, promotion, order, private, or live authority. |
| P3 | Adjudicate `ResearchControlCampaign` paper slots prospectively. | Isolated arm execution is not causal discovery-yield evidence until every precommitted slot reaches an external qualified terminal state. | Internal campaign runner, paper comparison scheduler, confirmation/release graph, and a new sealed campaign outcome. | Equal slot accounting, exact candidate closure, same champion/policy checks, restart recovery, no-candidate slots, and no research-proxy fallback. | No winner before terminal paper evidence; no automatic policy replacement, promotion, private, order, or live authority. |

Current P0 recommendation evidence: `buildTradingFirstViewportRecommendation` in `packages/domain`
now owns the read-only first-viewport recommendation contract. It uses
`TradingReviewPacket.next_action`, verdict severity, top blocker, runner state, and selected-target
mismatch before any compatibility-cycle fallback. Domain tests cover collecting, blocked, mismatch,
ready, legacy risk/ledger/replay fallback, and legacy change-proposal identity. Web Trading renders
that helper result instead of rebuilding packet priority locally. CLI and TUI continue to render
packet `next_action` directly, so they do not need a first-viewport recommendation fallback.

Current P0 blocker-boundary evidence: Details now labels itself as raw evidence and
developer/detail records while explicitly saying product blockers stay in Trading, Arena, and
Research. That keeps ordinary operator trust attached to packet, board, and research-learning
surfaces instead of raw records.

Current P0 replacement evidence: `trading_candidate.promote` now reports a qualified active-target
replacement as `Replaced Trading review target ...` instead of phrasing it as a first promotion.
When the selected candidate is not paper-qualified, the command error keeps the existing active
Trading review target intact and names the attempted replacement with candidate-specific
qualification reasons. The Web action already labels this as replacing the Trading review target
when selected-candidate mismatch exists. Live authority remains `not_live`.

Current P1 command-remediation evidence: failed `latest_commands` now pass through a shared
`commandRemediation` projection that groups command kind, points to the existing visible surface,
and gives a next remediation without making the command log a source of product state. CLI, TUI,
and Web all prove that a failed `trading_candidate.promote` points back to the Trading review
packet and Paper Board qualification surfaces under `not_live` authority.
Pass 1 Trading first-viewport refinement keeps the same remediation visible in Web Trading
`Operator messages`, after the Trading review packet and before the safety boundary, so a failed
promotion command is not hidden in the Arena command log while the operator is reviewing the
blocked candidate. The remediation remains read-only command evidence; it points back to the
packet and Paper Board instead of becoming a new blocker source or promotion path. Web command
remediation fields use `Remediation group`, `Visible surface`, `Remediation next step`, and
`Command authority` so the command log cannot be mistaken for product-state authority.

Current P1 tab-badge evidence: the Web navigation shell now renders small read-only badges only
from `OperatorReadModel`: active Trading review shows `review`, collecting selected paper evidence
shows `collecting` on Arena, and a selected provider profile that cannot run research shows
`provider blocked` on Research. Details stays unbadged because it is raw evidence, not product
state. These badges do not create commands, hidden state, or authority.

Current P1 Arena command-bar evidence: the Web Arena first scan now labels the research control
surface as `Arena command bar`, not `Runtime command bar`. That keeps `arena.start`, `arena.stop`,
and `arena.tick` visibly inside the CandidateArena workbench instead of sounding like TradingRun,
runtime lifecycle, or live/trading control authority.

Current P1 Arena preflight-rank evidence: the Web Arena metric strip and research leaderboard now
say `ResearchPreflight net`, `ResearchPreflight return`, and `ResearchPreflight leaderboard`
instead of generic `Net revenue`, `Net return`, or `Revenue-cost leaderboard`. The Paper Board
still appears above this preflight leaderboard as the product-authority continuous paper evidence
surface, so research preflight rank cannot visually replace selected PaperTradingEvaluation proof.

Current P1 paper-board evidence: `paper_trading_board.entries` now carry `trend` and
`blocker_density` as row-level explanatory signals with `not_promotion_authority`. The board still
ranks by `net_revenue_usdt` first and `net_return_pct` second; trend and blocker density only tell
operators and the next ResearchWorker whether evidence is improving, thin, or repeatedly blocked.
CLI, TUI, Web, interface parity, and CandidateArena researcher-context tests cover the signal
without changing qualification or promotion policy.
The Web Arena board labels its row fields by role: `Paper return`, `Qualification reasons`,
`Promotion gate`, `Paper runner`, `Paper observations`, and `Market provenance` replace generic
`Return`, `Reasons`, `Gate`, `Runner`, `Observations`, and `Market`. The Arena summary also says
`Arena runner`, so the workbench does not blur CandidateArena process state with paper-runner
evidence.

Current P1 latest-tick evidence: CandidateArena latest ticks now render direction status, created
count, failed count, and `ResearchEfficiency` across Web, CLI, and TUI. The same
`ResearchEfficiency` remains in next researcher context under `not_promotion_authority`, so provider
request count, runner command count, scenario count, and elapsed milliseconds teach autonomy
trajectory without becoming leaderboard rank, qualification, or promotion policy.

Current P1 paper-summary evidence: the Web Trading paper summary now uses packet-aligned labels:
`Paper risk equity`, `Paper score`, `Paper risk position`, and `Review readiness`. These cards stay
below `TradingReviewPacket` and explain paper risk/score/readiness; they do not introduce another
recommendation, readiness policy, or promotion path.

Current P1 Trading-cockpit structure evidence: the Web Trading cockpit is now an unframed section
below the packet, not a card that wraps other evidence cards. Chart, paper summary, paper readback,
and trade-status records remain visually grouped as supporting evidence, but the cockpit wrapper no
longer competes with the `TradingReviewPacket` as another framed decision object.

Current P1 no-order readback evidence: Web Trading `Trade status` now reads
`TradingReviewPacket.ledger` before falling back to raw order-chain fields. When the packet says
`no_order_checkpoint`, the lower readback shows the `TradingSystemDecision` and decision kind such
as `hold` instead of presenting `no order request`, `0/0`, or missing order/Gateway/execution
badges as if proof were absent. Its order/decision, filled-quantity, average-price, and execution
status stats are labeled `Paper order / decision`, `Paper filled`, `Paper average price`, and
`Paper execution`, not generic `Side / type`, `Filled`, `Average price`, or `Execution`, so the
lower readback cannot imply live exchange execution. No-order continuity remains read-only paper
evidence, not an order chain and not a promotion shortcut.
The lower raw Details surfaces still show raw order evidence, but their side/type fields now read
`Order side / type` so they remain explicitly order-owned instead of reusing a context-free UI
label.

Current P1 authority-copy evidence: the Web Trading decision bar now says `Paper Trading review
cockpit` instead of `Actual trading and realized-profit cockpit`, so first-viewport copy names the
paper review boundary before any lower readback. It keeps live exchange authority disabled and does
not imply realized live profit. The same first-viewport action copy now says `Observe paper` and
`Stop paper`, not generic `Observe` or `Stop`, so the controls read as PaperTradingEvaluation
observation controls rather than live trading controls.

Current P1 packet-priority evidence: the Web Trading tab now renders the `TradingReviewPacket`
immediately after the operator decision bar and before the `TradingPromotion` boundary. The
promotion bridge remains visible, but the first detailed object is the shared read-only review
packet: verdict, subject, paper rank, blocker group, evidence window, runner, Ledger, lineage, next
action, and authority. This preserves the target order that judgment evidence precedes mutation
affordances.

Current P1 promotion-boundary label evidence: the Web Trading promotion boundary now scopes its
lower bridge fields as `Paper runner`, `Promotion condition`, and `Review authority` instead of
generic `Runner`, `Next action`, and `Authority`. The card still sits below the
`TradingReviewPacket`; the labels make clear that the bridge is moving a paper-qualified candidate
into Trading review under disabled live authority, not granting live exchange control. It no longer
renders a separate first-viewport next-action sentence, so operator recommendation wording remains
owned by the decision bar and `TradingReviewPacket.next_action`.

Current P1 CLI/TUI packet-priority evidence: CLI `ouroboros status` and the Ink TUI now print
`TradingReviewPacket` summary and detail lines before the `TradingPromotion` status line. This keeps
automation-friendly and keyboard-first operator surfaces aligned with the Web first-scan order:
review evidence first, promotion bridge second, paper readback after that.
CLI/TUI authority copy also names the owner of the authority: local agent-provider command output
uses `Agent profile authority`, and the TUI header uses `Operator authority`, not generic
`Authority`. That keeps provider setup/probe authority, operator read-model authority, Trading
review authority, and live exchange authority visibly separate across compact surfaces.
The Ink TUI selected-paper readback also uses `Paper runner`, `Paper decision`, `Paper account`,
and `Paper fill`, matching CLI paper evidence wording instead of generic `Runner`, `Decision`,
`Account`, or `Fill`. That keeps compact keyboard output from sounding like live execution,
private-account readback, or an unscoped runner.
Paper Board compact quality rows in CLI/TUI now say `paper runner`, `market provenance`,
`paper fill`, and `paper open orders`, not generic `runner`, `market`, `fill`, or `open`.
That keeps row-level qualification context tied to selected paper evidence instead of sounding like
live execution state or a generic market-source dump.
Lower CLI/TUI paper readback now labels public fills as `Public execution evidence`, not generic
`Public execution`, so public-market provenance stays tied to paper evidence instead of sounding
like live execution authority.
The TUI lower paper readback now labels Ledger continuity as `Paper ledger chain`, not generic
`Ledger chain`, so compact keyboard output keeps the selected paper evidence chain separate from
future live/private Ledger authority.
Lower CLI/TUI/Web market readback now says `Paper market snapshot`, `Gateway market data`, and
`Public order book evidence`, not generic `Market`, `Market data`, or `Order book`. The Web Trading
review paper readback uses the same labels as the selected candidate readback, so latest price,
source mode, and order-book continuity stay tied to paper observation evidence through the
Gateway-owned `MarketDataPort` instead of looking like a free-floating or TradingSystem-owned
source.

Current P2 market-chart evidence: the Web Trading chart now renders a market data provenance strip
before the mark-price SVG. The strip shows source mode, freshness/liveness, observed time, and
paper-only authority from `PublicMarketLivenessSurfaceReadModel`, so stale fixture data, REST
market data, and WebSocket market data cannot look like persuasive chart movement without source
context. Tests cover fixture/stale, Binance market-data REST, and Binance production public
WebSocket modes. `TradingSubstrateSourceKind` and the local-store validator now accept the
production public REST/WebSocket/hybrid/stream source vocabulary already used by paper public
evidence. Deeper source-health work such as cache age, order-book continuity, and REST fallback
summaries remains future detail under the same `MarketDataPort` boundary.

Current P2 finding-cluster evidence: `CandidateArenaReadModel` and CandidateArena researcher
context now carry `finding_clusters` grouped by research direction, top paper blocker, market
regime, and classified paper protocol failure. The cluster is built from existing lineage,
paper-board qualification groups, market snapshots, and `PaperTradingFailure`; it has
`not_promotion_authority` and only guides the next ResearchWorker. CandidateArena derives
`adaptive_direction_focus` from those clusters and combines it with completed direction outcomes,
`ResearchEfficiency`, and completed allocation history in a pre-effect
`CandidateArenaResearchAllocation`. Adaptive default now runs exactly three of five lanes, at most
two focus and at least one exploration, with concurrency two and focus/exploration budgets of two
and one within five total iterations. Only completed tick-bound allocations change future coverage;
orphan intent is same-tick replay evidence. `static_control` ignores signals under the equal
three-worker, two-concurrency, five-experiment bound. The compact allocation is present in the
latest-tick read model and researcher context; no new UI mutation is required. Web Research renders
the source cluster as read-only next-generation context and labels its `ResearchWorker input` plus
`Cluster boundary`: no rank, no qualification, no Trading review blocker, and no promotion.
Allocation/read-model/context tests and Web surface tests prove paper failures can change actual
bounded research resources without changing paper rank, qualification, Trading review, promotion,
order, private, or live authority.

Current P3 concentration evidence: `ResearchPopulationDiversity` reconstructs the same latest ten
completed ticks exposed by CandidateArena. Top-level distributions report recent population
coverage; required newest-first `tick_series` entries independently report every exact worker
cross-section so older diversity cannot mask latest behavior collapse. Both views separately report
assigned `ResearchDirection` Shannon entropy and exact observed `ResearchBehaviorFingerprint`
entropy with six-place canonical rounding. Observed behavior is comparable only within one exact
fingerprint protocol and development-suite cohort; mixed cohorts report `incomparable_suites` and
omit invalid unique/entropy claims. A cross-tick suite transition closes the window but preserves
valid single-cohort tick measurements. Admission, exact behavior duplicate, artifact duplicate, and
unavailable fingerprint counts remain separate. CandidateArena and the next ResearchWorker share
only this bounded read model. Tests prove label/behavior disagreement, known uniform and non-uniform
entropy, earlier diversity versus latest collapse, orphan and hidden-evidence non-interference,
latest-ten truncation, suite-transition and intra-tick closure, and real distinct-to-duplicate Arena
readback. This measures concentration but does not establish semantic strategy families,
directed-worker lift, memory lift, allocation lift, agent leverage, or economic improvement; those
require equal-bound causal controls.

Current failure-remediation evidence: `PaperTradingFailure` now stays classified across CLI, TUI,
and Web surfaces as kind, human summary, next action, then raw reason. That order makes the failure
actionable before it becomes debugging text, while preserving the raw provider/runtime evidence.
Surface tests cover the same summary/next-action/raw ordering without changing
`PaperTradingQualification`, rank, or Trading review authority.

Current Research wording evidence: the Web Research `Research signals` section now describes
itself as research-facing quality, risk posture, and packet signal for the next candidate cycle.
The compact packet-derived card is labeled `Trading review signal`, not `Operator decision`, so the
Research surface can learn from Trading review evidence without sounding command-capable. Web tests
assert that Research excludes generic `Operator decision` and `next action for the operator`
wording, excludes `System performance`, and keeps Trading actions out of the view.

Current Research cycle wording evidence: the Web Research cycle now describes itself through
CandidateArena evidence, `ResearchPreflight`, and lineage before compatibility history. Its middle
preflight stage is labeled `ResearchPreflight`, not generic `Evaluation`, and its handoff stage is
labeled `Candidate handoff`, not `Improvement output`, so the old compatibility noun remains
implementation detail instead of the primary research workflow. Web tests assert this
CandidateArena-first wording and keep generic `Evaluation` stage labeling and `Improvement output`
out of the Research view.

Current ResearchPreflight labeling evidence: the Web Research `Research signals` cards now label
score and status as `ResearchPreflight`, not generic profit analysis or evaluation authority. This
keeps replay/backtest evidence inside candidate creation and prevents the Research view from
sounding like the selected `PaperTradingEvaluation` board or Trading promotion surface. Web tests
assert `ResearchPreflight score` and `ResearchPreflight status` while keeping `Profit analysis` out
of the Research view.

Current Arena inspector labeling evidence: the Web Arena selected-candidate inspector now labels
candidate-creation evidence as `ResearchPreflight` and leaderboard score as `Research leaderboard`,
not generic `Evaluation` or schema-shaped `profit_loss`. This keeps the Arena workbench readable as
research search evidence while the `PaperTradingEvaluation` fields remain the selected-candidate
paper authority surface. Web tests assert the authority-specific labels and keep the old generic
labels out of the Arena view. The same inspector labels candidate ancestry and authority as
`Candidate lineage` and `Selected candidate authority`, not generic `Lineage` and `Authority`, so
the selected candidate card cannot be mistaken for Trading review lineage or promotion authority.

Current Arena inspector readability evidence: the Web Arena selected-candidate inspector keeps
domain nouns in code and docs, but renders operator-facing labels as `System Code`, `Paper Trading
Evaluation`, and `Trading Run` instead of camel-case record names. CLI `ouroboros status` and the
Ink TUI also render `Paper Trading Evaluation` instead of `PaperTradingEvaluation`. This keeps the
operator surfaces from looking like raw read-model dumps while preserving the same CandidateArena,
PaperTradingEvaluation, and TradingRun boundaries. Tests assert the readable labels and keep the
camel-case labels out of operator-facing output.

Current Details ResearchPreflight Evidence-label evidence: Web Details renders the old trace and
evaluation record group as `ResearchPreflight Evidence`, not `Trace And Evaluation`. Inside that
raw evidence panel, the run, comparison set, provider trace material, counted evidence, and sealing
decision use role-specific labels such as `ResearchPreflight run authority`, `Comparison set
authority`, `Trace material authority`, `Counted evidence authority`, and `Sealing decision
authority`, not generic `Authority`. This keeps replay/backtest evidence useful for inspection
while preventing it from reading like the selected `PaperTradingEvaluation` board, Trading review,
or live authority path.

Current Details TradingRun-label evidence: Web Details `Trading Run` labels runtime lifecycle
authority as `Trading run authority`, not generic `Authority`, while keeping separate memory
surface authority under `Memory authority`. That keeps the running paper session inspectable as
runtime state without making memory context, order submission, Trading review, or live exchange
authority sound interchangeable.

Current Details replay-label evidence: Web Details `Candidate Runs` is explicitly replay/preflight
raw evidence. It labels run fields as `Replay runner`, `Replay runner commands`, and
`Replay authority`, including the no-run empty state, instead of generic `Runner` and `Authority`.
Selected run detail and scenario rows use `Replay detail no authority`, `Replay scenario runner`,
and `Replay scenario runner commands`, not generic `No authority`, `Runner`, or `Runner commands`.
That keeps replay evidence inspectable without making it sound like paper evaluation, Trading
review, or promotion authority.

Current Details replay validation-label evidence: Web Details `Candidate Runs` labels replay-run
comparison and validation authority by role: `Replay comparison authority`, `Replay comparison no
authority`, `Replay validation authority`, `Replay validation no authority`, `Candidate validation
authority`, and `Candidate validation no authority`, not generic `Authority` or `No authority`.
This keeps replay comparison posture, replay validation state, and candidate-level latest
validation state inspectable as ResearchPreflight evidence without making them sound like
PaperTradingQualification, Trading review, or live exchange authority.

Current Details run-control label evidence: Web Details `Run Control` labels latest command,
decision, and audit authority as `Command authority`, `Decision authority`, and `Audit authority`,
not generic `Authority`. That keeps pause/resume control records inspectable as control-only and
audit-only evidence without making them sound like Trading review or promotion authority.

Current Details execution-evidence label evidence: Web Details `Sandbox`, `Trading Run Transcript`,
and `Backtest / paper / live contract` label execution mode and authority as `Execution mode` and
`Execution mode authority`, not generic `Mode` or `Authority`. Ledger execution results use
`Execution result mode` and `Execution result authority`. Trading gateway environment labels
live/order-submission flags as `Gateway environment authority`, not generic `Authority`. That keeps
isolated runtime state, transcript readback, trace events, Gateway environment posture, and
execution-mode contracts inspectable without implying product review, paper qualification, or
promotion authority.

Current Details Ledger-label evidence: Web Details `Ledger` labels authority by record role:
`Order request authority`, `Gateway result authority`, `Execution result authority`, and `Ledger
chain authority`, not generic `Authority`. That keeps the selected paper evidence chain readable as
OrderRequest, GatewayResult, ExecutionResult, and historical Ledger continuity without making any
single raw record sound like Trading review, paper qualification, or live exchange authority.

Current Details Improvement-label evidence: Web Details `Improvement` labels compatibility/AAR
records by role: `Source finding authority`, `Change proposal authority`, `Materialization
authority`, `Experiment authority`, `Evaluation result authority`, `Improvement evidence
authority`, and `Improvement promotion authority`, not generic `Authority`. That keeps the old
proposal/experiment/evaluation lineage inspectable without letting it read like the primary
CandidateArena, PaperTradingEvaluation, Trading review, or live authority path.

Current Details materialization-label evidence: Web Details `Materialization Attempt` labels the
provider trace as `Provider trace`, not generic `Trace`. That keeps agent-run trace material
inspectable as provider output lineage without making it sound like counted ResearchPreflight
evidence, PaperTradingEvaluation proof, or promotion authority.

Current Operator next-action readability evidence: Trading review `next_action` and blocker
remediation strings now say `Paper Trading Evaluation` when they address the operator, while code,
schemas, and taxonomy docs keep the canonical `PaperTradingEvaluation` noun. The product rule is
that command output can reference durable concepts, but it must not read like an internal TypeScript
record dump. Product-loop smoke coverage asserts the readable Trading review action copy and rejects
raw camel-case `PaperTradingEvaluation` in operator-facing CLI output.

Current Trading readback label evidence: the Web Trading lower readback now labels the selected
paper authority as `Paper Trading Evaluation`, not the generic `Paper evaluation`; the selected
paper session runner as `Paper runner`, not generic `Runner`; paper market context as `Paper market
snapshot`, `Gateway market data`, and `Public order book evidence`, not generic `Market snapshot`,
`Market data`, or `Order book`; paper fill status as `Paper fill`, not generic `Latest fill`; and
freshness/source/fallback/stream-marker readback as `Public execution evidence`, not the narrower
`Market source`. This keeps the lower evidence explanation aligned with the first-viewport packet
and prevents the readback from sounding like research-time `Evaluation`, an unscoped runner, a
live-trading latest-fill stream, a separate authority, or a market-price-only source. Web tests
scope these assertions to the `Trading paper readback` section.

### Current Operator Scan-Order Audit

The operator surface is part of the product design, not a neutral rendering of available records.
Each view should be read top to bottom in the same order that the product expects a trustworthy
decision to form. When a future change disrupts this order, it should be treated as a design
regression even if the underlying data still renders somewhere.

| View or surface | Current top-to-bottom scan order | Product-quality reading | Evidence now present | Next correction rule |
| --- | --- | --- | --- | --- |
| Web shell | Workspace label, `BTCUSDT operator cockpit`, then Trading, Arena, Research, Details with read-only state badges when `OperatorReadModel` has state. | Keep. Navigation is organized by product-loop role rather than by implementation subsystem. | Web tests prove Trading, Arena, and Research badges are read-model sourced and Details stays unbadged when it has no product state. | Add navigation badges only for durable product state. Never badge Details for raw-record volume, developer activity, or future live-read posture. |
| Web Trading first scan | Operator decision bar, Trading review packet, Trading review candidate boundary, transient command messages, safety boundary, then lower Trading cockpit/readback. | Keep. The first scan answers "what should I do, which target is active, why is it blocked or ready, and what authority is disabled" before chart or account detail. | `buildTradingFirstViewportRecommendation` reads `TradingReviewPacket.next_action`; Web tests prove recommendation, packet-before-promotion ordering, packet field order, blocker detail, authority, provenance, risk, and mismatch behavior. | Any new Trading fact must first choose packet, promotion boundary, or lower readback. Do not add a parallel recommendation card or move chart/account context above packet judgment. |
| Web Trading packet | Verdict, subject, paper rank, blocker groups, blocker detail, evidence window, runner, Ledger, lineage, lineage learning, next action, authority, provenance, risk. | Keep, but treat order as a contract. It moves from trust question to supporting evidence to disabled authority and only then detailed provenance/risk. | Web packet tests assert this field ordering and packet content for collecting evidence, blocker groups, public execution provenance, order-book sync, fake account risk, and `not_live` authority. | If a packet section grows, group by operator question before adding fields. If the order changes, update tests to prove the new order answers trust earlier, not merely because layout changed. |
| Web Arena | CandidateArena cockpit, arena command bar, revenue-cost leaderboard, selected-candidate inspector, paper board, provider status, command evidence, and latest tick summaries. | Keep as workbench. Arena generates and gathers proof; it does not become the Trading review judgment screen. | View-scoping tests keep Arena separate from Trading cockpit, Research cycle, and developer controls. Paper-board and latest-tick tests cover rank, qualification, blockers, trend, density, direction results, research efficiency, selected-candidate inspector labels for `ResearchPreflight` and `Research leaderboard`, and readable record labels such as `System Code`, `Paper Trading Evaluation`, and `Trading Run`. | Keep research commands and selected paper controls in Arena. Move only qualified review judgment into Trading, and keep replay/backtest leaderboard visually below paper evidence authority. Never expose schema-shaped labels such as `profit_loss` or camel-case record labels in the operator surface. |
| Web Research | Paper evidence learning and finding clusters when available, then `ResearchPreflight` system performance, CandidateArena-first Research cycle, generated-system lineage, and compatibility history. | Keep. Paper learning correctly leads the Research view, Trading-derived guidance is labeled as a read-only signal, and the cycle wording names CandidateArena, ResearchPreflight, lineage, and candidate handoff before old compatibility nouns. | Web Research tests prove paper learning and finding clusters render as `lineage_only` / `not_promotion_authority`, do not expose Trading review actions, keep generic `Operator decision` / `next action for the operator` wording out of Research, keep `Profit analysis` out of Research system performance, keep generic `Evaluation` out of the Research cycle stage labels, and keep `Improvement output` out of the Research cycle. | Keep labels such as research signal, next research focus, Trading review signal, `ResearchPreflight score`, `ResearchPreflight status`, `ResearchPreflight`, or Candidate handoff. Research may learn from packet and compatibility signals, but it must not look able to promote or drift back to one-artifact Improvement flow. |
| Web Details | Fixture notice when relevant, Details boundary, then replay, full-cycle, private-readiness, substrate, and raw compatibility panels. | Keep. Details is the raw-evidence and developer-record boundary below product decisions. | Details tests prove "Product decisions stay in Trading, Arena, and Research", "Product blockers stay in Trading, Arena, and Research", and "No promotion authority" before raw records and developer controls. | If a blocker, mismatch, failure, or next action is found only in Details, move it up to Trading, Arena, or Research before treating the surface as shippable. |
| CLI status | Arena/tick/researcher status, active Trading review packet verdict and next action, subject, evidence window, blockers, authority, runner, Ledger, lineage, provenance, risk, then paper-board and substrate summaries. | Keep as automation scan. CLI is not visual, so packet verdict and next action must appear before longer evidence dumps. | CLI tests assert packet, blockers, authority, runner, Ledger, lineage learning, provenance, risk, paper-board blocker density, market data, failures, and command remediation wording. | Compact output may differ from Web order, but it must never omit blocker, authority, mismatch, or provenance meaning that Web/TUI expose. |
| TUI status | Compact operator state, Trading review packet next action, subject, blockers, authority, runner, Ledger, lineage, provenance, risk, paper-board and command remediation. | Keep as keyboard scan. TUI is allowed to be terser, not less authoritative. | TUI tests assert the same packet, blocker, authority, runner, Ledger, provenance, risk, paper-board, and command-remediation semantics. | Preserve target/selection mismatch and disabled authority in short labels; do not let compactness erase why a command is unavailable. |

The current scan order is therefore directionally correct: the richest surface begins with judgment
and authority, the research surface begins with learning, and the detail surface begins with a
boundary. The remaining product-quality risk is not missing widgets; it is drift. Any next UI or
read-model frontier should prove that it preserves this scan order before claiming product polish.

### Audit Outcomes

The current product spine is sound: CandidateArena owns search; pre-effect commitment, bounded
development, one-shot sealed admission, PaperTradingHandoffConformance, and admission own
candidate-to-paper compatibility;
PaperTradingEvaluation owns MLP-01 product evidence, PaperTradingQualification owns readiness,
TradingReviewPacket owns operator judgment, and Gateway/Ledger own evidence boundaries.

The remaining design pressure is not to add more surface area. It is to make each existing surface
more exact:

- Trading should keep the first viewport focused on recommendation, review target, packet verdict,
  blocker, evidence window, authority, and next action.
- Arena should make paper evidence creation fast while keeping review judgment in Trading.
- Research should increasingly learn from paper-board blockers, failed directions, findings,
  lineage, finding clusters, and research efficiency instead of replay score alone; when
  `TradingReviewPacket.lineage.paper_board_learning` exists, it belongs above generic Research
  status as read-only next-generation context.
- Details should stay useful for raw inspection and developer/detail records without becoming
  qualification, promotion, live-authority, or ordinary operator trust surface.
- CLI, TUI, and Web UI should continue to render one shared packet and one shared command/read
  contract; formatting can differ, meaning cannot.

Any proposed improvement that does not strengthen one of those outcomes should be removed,
rerouted, or documented as a future issue before implementation.

### Next Audit Pass Plan

The next quality pass should move from the strongest authority surface outward. The goal is not to
find one more feature; it is to prove that each surface is still necessary, ordered, and honest.

| Pass | Scope | What to inspect | Required output | Proof |
| --- | --- | --- | --- | --- |
| 1 | Trading first viewport | Decision bar, promotion boundary, packet, command messages, safety boundary, paper summary, provenance, risk, chart, and readback. | `keep/refine/relocate/remove/reroute` decision for each visible element, with duplicate recommendations removed or assigned below the packet. | Web tests plus CLI/TUI parity when packet meaning changes. |
| 2 | Arena proof workbench | Research controls, provider readiness, selected candidate inspector, paper controls, paper board, latest commands, and latest ticks. | Clear separation between research generation, selected paper evidence creation, and Trading review replacement. | Web Arena tests, paper-board tests, CandidateArena context tests. |
| 3 | Research learning surface | Paper-board learning, finding clusters, ResearchPreflight system performance, Research cycle, generated-system lineage, and compatibility history. | Research uses paper evidence as next-generation context without exposing Trading actions or promotion authority. | Web Research tests plus CandidateArena researcher-context tests. |
| 4 | Details and developer records | Fixture notice, raw evidence boundary, replay/full-cycle panels, private-readiness, substrate, and developer/detail controls. | Product-critical blockers are moved above Details; remaining Details content is clearly raw, future, or developer-owned. | Details boundary tests and no-product-authority assertions. |
| 5 | Shared read/command contract | `OperatorReadModel`, command registry, `TradingReviewPacket`, paper board, failure classifier, blocker grouping, and remediation projection. | One source of product meaning for every surface; no UI-only business logic. | Domain/service tests, interface parity tests, `npm run check:architecture`, `npm run check:naming`. |
| 6 | Harness and maintainability | Large read-model builders, UI files, fixture factories, local-store validators, docs, and checks. | Extract only when ownership is hidden or duplication makes tests weaker; otherwise keep local structure stable. | Narrow package tests, docs checks, secret/env checks, and `git diff --check`. |

The first pass should start with Trading because it is where the operator decides whether the
paper-backed candidate deserves continued promotion attention. The second pass should start only
after Trading remains coherent, because Arena can otherwise drift into a second review surface.
Research and Details come next because they are most useful when their limits are visible:
Research learns, Details explains raw records. Neither decides promotion.

### Trading First-Viewport Element Audit Frontier

The implementation frontier selected after PR #174 is **Trading first-viewport element audit**.

Goal: prove the Trading first viewport has exactly one operator recommendation source, keeps
`TradingReviewPacket` as the judgment object, and assigns every other visible Trading element to
`keep`, `refine`, `relocate`, `remove`, or `reroute` based on evidence and authority.

Context evidence:

- The scan-order audit already identifies Trading as the strongest authority surface and requires
  judgment evidence before chart, account, or lower readback detail.
- `buildTradingFirstViewportRecommendation` already reads `TradingReviewPacket.next_action` before
  compatibility fallback signals.
- Web tests already cover packet-before-promotion ordering, blocker detail, authority, provenance,
  risk, mismatch behavior, and command remediation in the Trading first viewport.
- CandidateArena, Research, and Details now have boundaries that depend on Trading remaining the
  only promotion-judgment surface.

Owned boundary:

- `apps/operator-web/src/App.tsx`
- `apps/operator-web/src/App.test.tsx`
- `packages/domain/src/trading-first-viewport-recommendation.test.ts`
- `packages/domain/src/index.ts`, only if the shared recommendation helper needs a stricter
  contract
- CLI/TUI parity tests, only if the audit changes shared packet meaning rather than Web layout
- `docs/product-quality-design.md` for the final keep/refine/relocate/remove/reroute record

Non-goals:

- Do not add a new Trading recommendation card, chart gate, score gate, or UI-only readiness label.
- Do not move Arena selection, Research learning, Details raw records, or private-readiness preview
  into Trading first-viewport authority.
- Do not weaken `PaperTradingQualification`, paper rank, `TradingPromotion`, `not_live` authority,
  or the disabled live/private capability set.
- Do not refactor large UI or read-model files unless the audit finds duplicated business meaning
  that tests cannot otherwise protect.

Acceptance criteria:

- The Web Trading first viewport has one recommendation source derived from
  `TradingReviewPacket.next_action`; lower sections may explain but cannot introduce competing next
  actions.
- The first viewport order remains decision bar, `TradingReviewPacket`, Trading promotion boundary,
  command messages, safety boundary, then lower Trading context/readback.
- Each visible first-viewport element has a documented `keep`, `refine`, `relocate`, `remove`, or
  `reroute` decision with owner, source, authority, and removal condition.
- Tests prove chart/account/provenance/readback content stays subordinate to packet judgment and
  cannot appear as a promotion gate.
- If shared packet meaning changes, CLI and TUI tests prove the same blocker, authority, mismatch,
  provenance, and next-action semantics.

Validation plan:

- `npm test -- apps/operator-web/src/App.test.tsx`
- `npm test -- packages/domain/src/trading-first-viewport-recommendation.test.ts`
- CLI/TUI/runtime parity tests only when the shared packet or recommendation helper changes
- `bash scripts/check-docs.sh`
- `npm run check:architecture`
- `npm run check:naming`
- `bash scripts/check-env-files.sh --tracked`
- `bash scripts/check-secrets.sh`
- `git diff --check`
- `npm run typecheck --workspaces --if-present`
- `npm test`
- `npm run build`

Writeback target: update this section with the completed element decisions and evidence before the
frontier is promoted or merged.

Completed audit decision record:

| Visible Trading element | Decision | Owner and source | Authority | Removal condition and evidence |
| --- | --- | --- | --- | --- |
| Operator decision bar | `keep` | Web renders `buildTradingFirstViewportRecommendation`, sourced from `TradingReviewPacket.next_action` before compatibility fallback. | Read-only recommendation plus scoped paper observe/stop controls. | Remove only if the packet itself becomes the sole compact first sentence. Web tests keep `Recommended action` sourced from the packet helper. |
| `TradingReviewPacket` | `keep` | `OperatorReadModel.trading_review.review_packet`. | Read-only judgment object for verdict, blocker, paper evidence, runner, Ledger, lineage, provenance, risk, authority, and next action. | Do not remove until a shared replacement object exists across CLI, TUI, and Web. Web tests keep packet before promotion and assert packet field order. |
| Trading promotion boundary | `refine` | `TradingPromotion`, `TradingReview`, selected paper board row, and command registry. | Review-selection bridge through `trading_candidate.promote`; live remains `not_live`. | The boundary now renders `Promotion condition`, not `Promotion next action`, so it cannot compete with packet next-action wording. |
| Operator messages | `keep` | Latest command response state and command remediation projection. | Transient command evidence only; points back to packet and Paper Board. | Keep only while messages or remediations exist. Web tests keep messages after packet/promotion and before safety. |
| Safety boundary | `keep` | Runtime authority flags and fixture notices. | No command authority; repeats paper-only disabled live/private authority. | Keep wherever promotion wording is visible. Web tests keep it before lower cockpit/readback. |
| Trading cockpit wrapper | `keep` | Web presentation section over active review context. | Read-only context grouping below safety. | Remove only if lower context can remain grouped without becoming a framed judgment card. Existing tests keep it below first-scan elements. |
| BTCUSDT futures chart | `keep` | Gateway-owned public market data readback. | Read-only market context; chart is not a gate. | Relocate only if it rises above packet judgment. Web tests keep chart below safety and outside packet/promotion sections. |
| Paper trading review summary | `keep` | Paper account, paper score, position, and readiness readback aligned to packet risk/provenance. | Read-only supporting facts, not a recommendation or readiness policy. | Remove or relocate if it introduces a separate score gate. Web tests keep labels as paper risk/score/readiness below the packet. |
| Trading paper readback | `keep` | `PaperTradingEvaluation`, Gateway market data, public execution evidence, public order-book evidence, and paper failure classification. | Read-only evidence explanation below packet judgment. | Relocate only if a blocker or next action appears only in readback. Web tests keep readback scoped and subordinate. |
| Trade status | `keep` | Ledger and `TradingReviewPacket.ledger` fallback for paper order, Gateway, execution, and no-order continuity. | Read-only paper execution evidence, never live exchange execution. | Remove only if packet Ledger fully replaces lower order-chain explanation. Current labels remain paper-scoped. |

Completed audit evidence: the Web test was first tightened to fail while the promotion boundary
still rendered `Promotion next action`; the implementation then replaced that field with
`Promotion condition` and removed the unused promotion next-action helper. Targeted Web validation
passed with `npm test -- apps/operator-web/src/App.test.tsx`.

## Autonomous Quality Rubric

Autonomous work must be judged on trajectory, not only output.

| Rubric | Pass signal | Fail signal |
| --- | --- | --- |
| Candidate diversity | Multiple candidates explore distinct `ResearchDirection` lanes or lineage hypotheses. | One generated artifact is edited in place until it looks good. |
| Protocol compliance | TradingSystem emits bounded paper events with `trace_only` authority. | Candidate imports exchange clients, private state, credentials, or live-order intent. |
| Evidence trajectory | Paper observations improve score, reduce blockers, and preserve Ledger continuity. | Score exists without market/fill provenance or repeats stale sandbox output. |
| Failure learning | Failures become findings, blocker groups, or next research context. | Failures disappear from the surface once a new candidate appears. |
| Cost and latency | Provider and paper loops expose cost/latency enough to compare autonomy efficiency without promotion authority. | A candidate is considered good while being too expensive or slow to run repeatedly. |
| Operator trust | The review packet explains what is known, unknown, blocked, and next. | The UI asks the operator to trust a score without explaining evidence quality. |
| Promotion discipline | Review selection follows `PaperTradingQualification` and keeps `TradingPromotion` under `not_live` authority. | A score, chart, generated summary, or command success implies the candidate should be trusted. |
| Surface economy | Each visible element has an owner, evidence source, authority, state coverage, and removal condition. | Product screens grow by accumulation and make the operator reconcile competing hints. |
| Maintenance clarity | Boundaries point to domain/application/adapters/interfaces and shared tests. | One surface duplicates business logic that another surface cannot share. |

## Implementation Frontiers

This work should move in small, high-quality frontiers. Each frontier must preserve paper-only
authority and pass the repo checks.

### Frontier 0: Product-quality operating protocol

Owned files:

- `docs/product-quality-design.md`
- linked canonical docs when the read order or authority boundary changes
- relevant test files only after a concrete element inspection chooses a proof surface

Acceptance:

- The chosen approach is evidence-spine design, not a feature patch queue or UI polish pass.
- Every proposed product element has an inspection record: why it exists, owner, evidence,
  authority, surface placement, state coverage, verification, and removal condition.
- Promotion decision flow is explicit from CandidateArena through Trading review and keeps live
  authority outside MLP-01.
- Improvement queues and implementation frontiers name proof requirements before code changes.
- `bash scripts/check-docs.sh`, `npm run check:naming`, and `git diff --check` pass for doc-only
  writeback.

### Frontier 1: Product-quality contract

Owned files:

- `docs/product-quality-design.md`
- canonical doc links
- docs validation active-doc list

Acceptance:

- Product direction, autonomy, architecture, command/read-model, UX, tests, and improvement gaps
  are tied together in one durable document.
- The full operator surface is audited by role, evidence source, authority boundary, quality
  decision, and improvement focus before new UI or command work is added.
- The document names current surfaces and future gaps without claiming unimplemented behavior as
  done.
- `bash scripts/check-docs.sh`, `npm run check:architecture`, `npm run check:naming`, secret/env
  checks, and `git diff --check` pass.

### Frontier 2: TradingReviewPacket domain and service projection

Owned files:

- `packages/domain/src/index.ts`
- `packages/application/src/services/operator.ts`
- `apps/runtime/test/operator-paper-trading-board.test.ts`
- CLI/TUI/Web fixture tests as needed

Acceptance:

- `OperatorReadModel.trading_review.review_packet` includes verdict, subject, performance,
  evidence-quality, runner, Ledger, lineage, provenance, risk, authority, and next-action sections.
- Packet sections are grouped by operator question, not by implementation convenience.
- Packet subject and evidence window carry review time and paper observation time so every surface
  can explain when the target was promoted and what evidence interval is being judged.
- Packet risk includes paper account and BTCUSDT position exposure from `PaperTradingAccountSnapshot`
  when available, carries `not_live` authority, and never falls back to private-readiness account
  or position substrate data.
- Mismatch, collecting, qualified, needs-resume, blocked, failed, and not-promoted packet states are
  covered by service tests; CLI, TUI, and Web render the shared packet semantics from
  `OperatorReadModel`.

### Frontier 3: Operator UI packet stack

Owned files:

- `apps/operator-web/src/App.tsx`
- `apps/operator-web/src/App.test.tsx`
- `apps/operator-tui/src/operator-tui.tsx`
- `apps/runtime/test/ouroboros-cli.test.ts`
- `apps/runtime/test/operator-interface-parity.test.ts`

Acceptance:

- Trading first viewport shows verdict, subject, score, blocker, evidence window, and next action.
- Arena selected candidate mismatch is unmistakable and Trading controls stay disabled or scoped to
  the active target.
- CLI, TUI, and Web render the same packet semantics from `OperatorReadModel`.

### Frontier 4: Failure grouping and remediation guidance

Owned files:

- `packages/application/src/trading/paper/qualification.ts`
- `packages/application/src/trading/paper/qualification-blockers.ts`
- domain read-model types if needed
- `apps/runtime/test/paper-trading-qualification.test.ts`

Acceptance:

- Machine-readable reasons stay canonical.
- Review-facing groups and remediation targets are deterministic.
- `TradingReviewPacket` and CandidateArena researcher context use the same paper blocker grouping
  helper, so UI presentation and next-generation research feedback do not drift.
- The gate is not weakened by presentation grouping; grouped blockers explain work to do, not
  promotion authority.

### Frontier 5: Research feedback and autonomy efficiency

Owned files:

- `packages/application/src/candidate/arena.ts`
- `packages/domain/src/index.ts`
- `apps/operator-web/src/App.tsx`
- `apps/operator-web/src/App.test.tsx`
- `apps/runtime/test/candidate-arena-paper-context.test.ts`
- `docs/api-command-contract.md`
- `docs/interface-parity.md`
- `docs/product-quality-design.md`
- future cost/latency observability files

Acceptance:

- Paper-board blockers, failures, and qualified evidence influence the next research context.
- Researcher context carries grouped blocker severity and next action from paper qualification
  reasons so the next generation can respond to evidence-window, runner, provenance, and quality
  failures.
- Researcher context carries selected paper evidence lineage status, research direction, parent
  candidate, latest finding, evaluation status, and `paper_board_learning` under `lineage_only`
  authority.
- Researcher context carries selected paper-loop latency from persisted observations: expected
  interval, latest and max lag, interval count, cadence status, and `not_promotion_authority`, so
  next-generation candidates can respond to lagging paper cadence without changing rank or
  promotion.
- Researcher context carries `finding_clusters` grouped by direction, blocker, market regime, and
  protocol failure with `not_promotion_authority`.
- `CandidateArenaReadModel` carries the same `finding_clusters`, and Web Research renders them as
  read-only next-generation context without adding controls or Trading review authority.
- `CandidateArenaReadModel.research_generalization` carries required compact prospective protocol
  lifecycle and outcome evidence. CLI, TUI, and Web Research render the same status, active
  progress, latest inference, next action, and `not_promotion_authority`; the projection is not
  researcher context and does not alter allocation.
- CandidateArena tick direction results record compact `ResearchPreflight` closure: commitment ID,
  development submission count, generic sealed terminal status/reason, and
  `not_promotion_authority`. They never expose seed, suite digest, scenario identity/outcome, score,
  raw event, path, command evidence, or evaluator internals.
- `ResearchEfficiency` preserves development-only compatibility totals for allocation and splits
  development versus sealed submission, provider request, runner command, scenario, and elapsed
  counts under `not_promotion_authority`.
- Next researcher context carries prior `ResearchEfficiency` so cost and latency proxies become
  comparable signals without becoming promotion authority. Actual provider-dollar cost remains a
  future adapter detail when providers expose it.
- Losing and failed candidates remain useful memory unless they violate hard boundaries.

### Frontier 6: PaperTradingFailure classification and surface parity

Owned files:

- `packages/domain/src/index.ts`
- `packages/application/src/trading/paper/failures.ts`
- `packages/application/src/services/operator.ts`
- CLI/TUI/Web fixture tests

Acceptance:

- `PaperTradingFailure` preserves raw reason and adds stable failure kind, summary, next action,
  and `not_live` authority.
- `PaperTradingEvaluation`, paper board risk summary, and `TradingReviewPacket.risk` carry the
  same classified failure projection.
- CLI, TUI, and Web render classified failure kind, human summary, and next action before raw
  failure text.
- Classification remains read-only and does not weaken `PaperTradingQualification`.

## Non-Goals

- Do not enable live trading, private account reads, signed exchange requests, listenKey/user-data
  streams, leverage mutation, margin mutation, or live orders.
- Do not let `TradingReviewPacket` create records or trigger commands.
- Do not replace `PaperTradingQualification` with a UI-only readiness label.
- Do not create a second promotion path outside `trading_candidate.promote`.
- Do not hide negative, failed, or resume-needed paper evaluations.
- Do not redesign the UI as a marketing surface.
- Do not add decorative abstractions that do not clarify ownership, authority, or evidence.

## Completion Standard

A product-quality change is complete only when all of this is true:

1. The product direction is clearer than before.
2. The user-facing surface is more honest about evidence and authority.
3. The code boundary is more maintainable, not wider by accident.
4. The tests prove the important state transitions and failure cases.
5. The docs explain why the change belongs in Ouroboros.
6. The validation gates pass.

Anything less is prototype-quality work and should not be described as production-ready product
design.
