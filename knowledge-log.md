# Knowledge Log

- 2026-04-18: Reset the repository into a design-first architecture workspace centered on
  [README.md](README.md) and [wiki/architecture/](wiki/architecture/).
- 2026-04-18: Added a repo-local `llm-wiki` skill and aligned it to a simpler
  `raw sources -> maintained wiki -> schema` model.
- 2026-04-18: Scaffolded the minimum wiki operating files and raw-source layer:
  [knowledge-index.md](knowledge-index.md),
  [knowledge-log.md](knowledge-log.md), and
  [wiki/sources/](wiki/sources/).
- 2026-04-18: Added
  [00-mission-and-philosophy.md](wiki/architecture/historical/specs/00-mission-and-philosophy.md)
  to deepen the project mission, background, philosophy, goals, and non-goals using Anthropic's
  AAR, Automated W2S Researcher, and Building Effective Agents as design anchors.
- 2026-04-18: Added raw source notes for Anthropic's AAR, Automated W2S Researcher, and Building
  Effective Agents under [wiki/sources/library/](wiki/sources/library/),
  and rewrote the top-level mission/philosophy documents to separate source grounding from
  maintained architectural conclusions.
- 2026-04-18: Moved the raw-source layer under
  [wiki/sources/](wiki/sources/) so architecture pages and source
  provenance live under one top-level documentation tree.
- 2026-04-18: Rewrote the source layer into a deeper research base: each tracked source link now
  has a structured note under [wiki/sources/library/](wiki/sources/library/), and new cross-source
  synthesis pages live under [wiki/sources/synthesis/](wiki/sources/synthesis/). Navigation was
  also updated so source reading comes before architecture work.
- 2026-04-18: Ran a second deep-research pass over all 13 tracked sources. The per-source notes
  were rewritten into a more matrix-heavy format with explicit inspected scope, cited facts, and
  vocabulary extraction, and the synthesis pages gained terminology comparison tables and a source
  coverage view.
- 2026-04-18: Added
  [00-first-principles-architecture-thesis.md](wiki/architecture/historical/specs/00-first-principles-architecture-thesis.md)
  as the shortest source-grounded architecture statement before the deeper design pages.
- 2026-04-18: Strengthened the source layer again before writing the primitive model: reinforced
  [repo-anthropics-claude-code.md](wiki/sources/library/repo-anthropics-claude-code.md),
  [repo-openclaw.md](wiki/sources/library/repo-openclaw.md), and
  [openai-next-evolution-of-the-agents-sdk.md](wiki/sources/library/openai-next-evolution-of-the-agents-sdk.md)
  with additional official web documentation, then rewrote
  [02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md)
  around `AgentIdentity`, `Session`, `Candidate`, `Workspace`, `Stage`, `StageBinding`, `Trace`,
  `EvidenceRecord`, and `PromotionDecision`.
- 2026-04-18: Re-read the evaluation/governance sources and rewrote
  [03-staged-evaluation.md](wiki/architecture/specs/03-staged-evaluation.md)
  as a source-grounded stage model centered on legitimacy boundaries, stage bindings, candidate
  lineage, and explicit promotion outcomes.
- 2026-04-18: Re-read the runtime/control-plane boundary sources, checked additional official docs
  around hooks, results/state, and running agents, and rewrote
  [04-boundaries.md](wiki/architecture/specs/04-boundaries.md)
  around the key separations autokairos must preserve:
  `AgentIdentity vs Candidate`, `Session vs Workspace`, `Workspace vs durable truth`,
  `Stage vs StageBinding`, `Trace vs EvidenceRecord`, `EvidenceRecord vs PromotionDecision`,
  `runtime vs control plane`, and `system core vs presentation`.
- 2026-04-18: Realigned the top-level framing documents
  [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md)
  to the new source-grounded architecture spine so they now point directly to the source-first
  reading order and the current `thesis -> primitives -> staged evaluation -> boundaries` sequence.
- 2026-04-18: Reworked
  [00-mission-and-philosophy.md](wiki/architecture/historical/specs/00-mission-and-philosophy.md)
  so it now sits cleanly between the source layer and the newer
  `thesis -> primitives -> staged evaluation -> boundaries` spine.
- 2026-04-18: Re-read the execution-structure sources, strengthened the runtime/session source base
  with additional official session, result, checkpointing, and runtime-connector material, and added
  [05-agent-execution-architecture.md](wiki/architecture/historical/specs/05-agent-execution-architecture.md)
  to define autokairos execution as:
  `control plane -> runtime connector -> bounded workspace -> external trace and evidence surfaces`.
- 2026-04-18: Re-read [repo-multica.md](wiki/sources/library/repo-multica.md) with deeper daemon,
  task-event, runtime-inventory, and autopilot scope, then updated
  [reference-systems-and-product-postures.md](wiki/sources/synthesis/reference-systems-and-product-postures.md)
  and [05-agent-execution-architecture.md](wiki/architecture/historical/specs/05-agent-execution-architecture.md)
  so Multica now informs autokairos mainly as a runtime-connector and control-plane reference rather
  than as a candidate/evidence model.
- 2026-04-18: Re-read [repo-safety-research-automated-w2s-research.md](wiki/sources/library/repo-safety-research-automated-w2s-research.md)
  with Dockerfile, entrypoint, and image-build scope, then added
  [06-containerized-execution.md](wiki/architecture/specs/06-containerized-execution.md)
  so autokairos now treats container-backed workspaces as the default serious execution mode and
  distinguishes host-local convenience from container-backed legitimate runs.
- 2026-04-18: Checked additional official Docker documentation on Compose, `docker run`, and bind
  mounts, then added
  [07-runtime-connector-contract.md](wiki/architecture/specs/07-runtime-connector-contract.md)
  to define the stable per-run execution contract and to explicitly place `docker compose` as an
  optional local support-stack layer rather than the core runtime-connector abstraction.
- 2026-04-18: Re-read Paperclip, Multica, and W2S candidate-like work units, then added
  [08-candidate-contract.md](wiki/architecture/specs/08-candidate-contract.md)
  to define `Candidate` as the durable promotable lineage object above execution attempts and
  below evidence and promotion decisions.
- 2026-04-18: Re-checked OpenAI's official trace and trace-grading guidance, then added
  [09-trace-contract.md](wiki/architecture/specs/09-trace-contract.md)
  to define `Trace` as the raw external record of one execution attempt and to separate it
  explicitly from `EvidenceRecord`.
- 2026-04-18: Re-read Anthropic AAR/W2S evaluation posture, Paperclip governance posture, and
  OpenAI's official `Evaluate agent workflows` plus `Trace grading` docs, then added
  [10-evidence-record-contract.md](wiki/architecture/specs/10-evidence-record-contract.md)
  to define `EvidenceRecord` as the sealed judged artifact between raw traces and promotion
  decisions, including stage scope, method scope, legitimacy context, and freshness.
- 2026-04-18: Strengthened
  [repo-anthropics-claude-code.md](wiki/sources/library/repo-anthropics-claude-code.md)
  with official Claude Code security and permissions docs, then added
  [11-promotion-decision-contract.md](wiki/architecture/specs/11-promotion-decision-contract.md)
  to define `PromotionDecision` as the explicit governance action above evidence and distinct from
  runtime approvals, including stage transitions, governing surfaces, rationale, and rollback links.
- 2026-04-18: Re-read managed-agents, Paperclip, staged evaluation, and Claude Code approval docs,
  then wrote the first governance-surfaces draft that now survives as
  [control-plane/02-governance-surfaces.md](wiki/architecture/control-plane/02-governance-surfaces.md),
  separating runtime-local safety, evaluation, policy, review intake, decision, and audit into
  distinct governing surfaces rather than one vague approval layer.
- 2026-04-18: Strengthened
  [repo-anthropics-claude-code.md](wiki/sources/library/repo-anthropics-claude-code.md)
  with server-managed settings and monitoring docs, then wrote the first control-plane record
  model that now survives as
  [control-plane/03-record-model.md](wiki/architecture/control-plane/03-record-model.md),
  defining the durable record families autokairos should treat as control-plane truth rather than
  falling back to runtime state, workspace state, or operator memory.
- 2026-04-19: Re-read Paperclip ticket posture, Multica task posture, Anthropic workflow guidance,
  and the new control-plane record model, then added
  [14-review-item-contract.md](wiki/architecture/specs/14-review-item-contract.md)
  to define `ReviewItem` as the durable governance-work object between evidence and committed
  promotion decisions.
- 2026-04-19: Re-read managed-agents, long-running harness, harness-engineering, Agents SDK
  evolution, Claude Code, Multica, and W2S execution references, then wrote the first
  implementation-slice draft that now survives as
  [agent-system/05-implementation-plan.md](wiki/architecture/historical/agent-system/05-implementation-plan.md),
  defining the first real implementation slice for autokairos as one container-backed,
  candidate-aware, trace-first agent path with explicit component boundaries and build order.
- 2026-04-19: Reworked the architecture information architecture into a structured system guidebook
  by adding
  [00-system-map.md](wiki/architecture/00-system-map.md),
  section guides under
  [foundation/](wiki/architecture/foundation/README.md),
  [agent-system/](wiki/architecture/agent-system/README.md),
  [evaluation-and-progression/](wiki/architecture/evaluation-and-progression/README.md), and
  [control-plane/](wiki/architecture/control-plane/README.md),
  so the whole design now reads as overall system sections with agent as one subsystem rather than
  one flat contract list.
- 2026-04-19: Re-checked runtime, harness, session, checkpointing, sandboxing, and driver sources
  across Anthropic, OpenAI, Claude Code, OpenClaw, and Multica, then rebuilt the
  [agent-system/](wiki/architecture/agent-system/README.md) section into a real subsystem guide
  with:
  [01-overview.md](wiki/architecture/agent-system/01-overview.md),
  [02-execution-lifecycle.md](wiki/architecture/agent-system/02-execution-lifecycle.md),
  [03-state-and-ownership.md](wiki/architecture/agent-system/03-state-and-ownership.md),
  [04-runtime-driver-model.md](wiki/architecture/historical/agent-system/04-runtime-driver-model.md), and
  [05-implementation-plan.md](wiki/architecture/historical/agent-system/05-implementation-plan.md),
  so the agent now reads as a proper subsystem with its own overview, lifecycle, ownership model,
  driver model, and build sequence instead of being scattered across flat contracts.
- 2026-04-19: Re-read managed-agents, OpenAI harness/session/HITL docs, Multica daemon/runtime
  posture, and W2S container-legitimacy references, then added
  [agent-system/06-first-code-seam.md](wiki/architecture/historical/agent-system/06-first-code-seam.md)
  to make the first trustworthy implementation seam explicit.
  The current decision is that implementation should begin with governed execution requests,
  durable execution records, and an external trace sink before the first runtime connector or
  container host becomes the center of the system.
- 2026-04-19: Re-audited architecture naming against the source vocabulary and added
  [foundation/01-naming-and-vocabulary.md](wiki/architecture/foundation/01-naming-and-vocabulary.md)
  to explicitly separate source-specific terms such as `harness`, `sandbox`, `Gateway`, and
  `Manifest` from autokairos-local terms such as `Candidate`, `StageBinding`, `EvidenceRecord`,
  `PromotionDecision`, and `ReviewItem`, so implementation can proceed without vocabulary drift.
- 2026-04-19: Re-checked official context, session, result, and tool-design guidance, then
  rewrote the foundation spine:
  [00-first-principles-architecture-thesis.md](wiki/architecture/historical/specs/00-first-principles-architecture-thesis.md),
  [02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md), and
  [04-boundaries.md](wiki/architecture/specs/04-boundaries.md),
  so each page now answers a cleaner question:
  first principles for what the system is, primitives for what objects autokairos locally owns,
  and boundaries for what the architecture must refuse to collapse.
- 2026-04-19: Re-checked official OpenAI eval, trace, session, results, context, and
  human-in-the-loop guidance, strengthened
  [openai-next-evolution-of-the-agents-sdk.md](wiki/sources/library/openai-next-evolution-of-the-agents-sdk.md)
  with HITL approval/resume vocabulary, and rebuilt the
  [evaluation-and-progression/](wiki/architecture/evaluation-and-progression/README.md) section
  into a structured subsystem guide with:
  [01-overview.md](wiki/architecture/evaluation-and-progression/01-overview.md),
  [02-evaluation-flow.md](wiki/architecture/evaluation-and-progression/02-evaluation-flow.md),
  [03-progression-model.md](wiki/architecture/evaluation-and-progression/03-progression-model.md), and
  [04-review-and-decision-path.md](wiki/architecture/evaluation-and-progression/04-review-and-decision-path.md),
  so evaluation, progression, review, and decision are now read as one coherent subsystem rather
  than only as a flat bundle of contracts.
- 2026-04-19: Re-read Paperclip governance posture, Multica daemon/runtime inventory posture,
  OpenClaw gateway/session ownership, Claude Code administrative control surfaces, and the existing
  flat control-plane specs, then rebuilt the
  [control-plane/](wiki/architecture/control-plane/README.md) section into a structured subsystem guide with:
  [01-overview.md](wiki/architecture/control-plane/01-overview.md),
  [02-governance-surfaces.md](wiki/architecture/control-plane/02-governance-surfaces.md),
  [03-record-model.md](wiki/architecture/control-plane/03-record-model.md), and
  [04-review-operations-and-audit.md](wiki/architecture/control-plane/04-review-operations-and-audit.md),
  so control-plane ownership, governance surfaces, durable record families, and review/audit
  operations are now legible as one subsystem rather than only through flat contracts.
- 2026-04-19: Reorganized the root of
  [wiki/architecture/](wiki/architecture/)
  so that the old flat `00-15` contract pages now live under
  [wiki/architecture/specs/](wiki/architecture/historical/specs/README.md),
  leaving the architecture root focused on
  [00-system-map.md](wiki/architecture/00-system-map.md),
  section guides, and the grouped specs index.
  This keeps the whole design readable as:
  system map -> subsystem guides -> supporting specs,
  rather than as one long flat numbered list.
- 2026-04-19: Reduced spec duplication after the `specs/` move by removing the most redundant
  pages:
  the short philosophy duplicate, the older flat governance-surfaces and control-plane-record
  duplicates, and the older agent-implementation-design duplicate.
  The remaining canonical reading path is now:
  section guides first, then only the specs that still answer distinct lower-level contract
  questions.
- 2026-04-19: Tightened
  [wiki/architecture/historical/specs/README.md](wiki/architecture/historical/specs/README.md)
  into an implementation-critical sequence instead of a passive file list.
  The current lower-level build order is now explicit:
  foundation constraints (`00 / 02 / 04`),
  then agent execution (`05 / 06 / 07`),
  then progression objects (`03 / 08 / 09 / 10 / 11`),
  then governance-work intake (`14`).
- 2026-04-19: Strengthened the proactive-agent research pass again using newer official Claude
  Code, Codex, and OpenClaw automation references and promoted that work into a separate
  [proactive-operations](wiki/architecture/historical/proactive-operations/README.md) subsystem.
  The design now treats "living work" as:
  always-on substrate -> proactive wake orchestration -> wakeable runtime,
  and keeps `governed self-scheduling` as a first-class design commitment.
- 2026-04-19: Extended the control plane so proactive authority is now durable truth rather than
  only a runtime-side behavior.
  Added
  [control-plane/05-proactive-policy-and-wake-records.md](wiki/architecture/historical/control-plane/05-proactive-policy-and-wake-records.md),
  [specs/21-wake-policy-contract.md](wiki/architecture/historical/specs/21-wake-policy-contract.md),
  [historical/specs/22-standing-order-contract.md](wiki/architecture/historical/specs/22-standing-order-contract.md),
  and
  [adrs/0006-proactive-control-plane-truth.md](wiki/architecture/adrs/0006-proactive-control-plane-truth.md),
  so `WakePolicy`, `StandingOrder`, `SelfSchedulingIntent` history, and wake-trigger history now
  have an explicit durable home above the runtime.
- 2026-04-19: Added the next proactive-control-plane implementation layer with
  [control-plane/06-proactive-record-implementation-plan.md](wiki/architecture/historical/control-plane/06-proactive-record-implementation-plan.md)
  and
  [specs/23-wake-trigger-record-contract.md](wiki/architecture/historical/specs/23-wake-trigger-record-contract.md),
  then rewired the system map, section guides, spec index, and top-level navigation so wake-trigger
  history and proactive record implementation now appear explicitly in the implementation-first
  reading order.
- 2026-04-19: Re-read proactive orchestration and automation references, then tightened the
  execution seam so proactive truth now survives all the way into governed invocation.
  Updated
  [specs/12-governed-execution-request-contract.md](wiki/architecture/specs/12-governed-execution-request-contract.md),
  [specs/13-execution-attempt-contract.md](wiki/architecture/specs/13-execution-attempt-contract.md),
  [agent-system/06-first-code-seam.md](wiki/architecture/historical/agent-system/06-first-code-seam.md),
  [agent-system/05-implementation-plan.md](wiki/architecture/historical/agent-system/05-implementation-plan.md),
  [control-plane/03-record-model.md](wiki/architecture/control-plane/03-record-model.md), and
  [control-plane/06-proactive-record-implementation-plan.md](wiki/architecture/historical/control-plane/06-proactive-record-implementation-plan.md)
  so `ExecutionRequest` now preserves primary wake cause, coalesced wake origins, and the
  authority/precedence context that made the request exist.
- 2026-04-19: Re-checked OpenAI session/result/run guidance plus current OpenClaw and Claude
  scheduling docs, then added
  [29-execution-record-store-contract.md](wiki/architecture/historical/specs/29-execution-record-store-contract.md)
  to define the first normalized persisted execution-record family:
  `ExecutionRequestHeader`, `ExecutionRequestWakeOriginLink`, `ExecutionAttemptHeader`, and
  `ExecutionAttemptLifecycleEvent`.
  This makes the first implementation seam concrete at the storage-model level rather than leaving
  request, wake provenance, and attempt history to one opaque run blob or scheduler log.
- 2026-04-19: Added the first explicit documentation doctrine for the repository:
  [foundation/02-documentation-doctrine.md](wiki/architecture/foundation/02-documentation-doctrine.md),
  [foundation/03-diagramming-and-views.md](wiki/architecture/foundation/03-diagramming-and-views.md),
  [adrs/README.md](wiki/architecture/adrs/README.md), and
  [adrs/0001-documentation-system.md](wiki/architecture/adrs/0001-documentation-system.md).
  The architecture set is now explicitly English-first, prescriptive-spec, and ADR-backed for
  major decisions.
- 2026-04-19: Reworked the top-level architecture navigation and section guides to match the new
  doctrine.
  [wiki/architecture/README.md](wiki/architecture/README.md),
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md),
  [wiki/architecture/foundation/README.md](wiki/architecture/foundation/README.md),
  [wiki/architecture/agent-system/README.md](wiki/architecture/agent-system/README.md),
  [wiki/architecture/evaluation-and-progression/README.md](wiki/architecture/evaluation-and-progression/README.md),
  [wiki/architecture/control-plane/README.md](wiki/architecture/control-plane/README.md), and
  [wiki/architecture/historical/specs/README.md](wiki/architecture/historical/specs/README.md)
  now separate subsystem guides, supporting specs, and ADR history more explicitly.
- 2026-04-19: Updated the repo-level navigation and workflow rules to recognize the doctrine and
  ADR layer:
  [README.md](README.md),
  [ARCHITECTURE.md](ARCHITECTURE.md),
  [wiki/index.md](wiki/index.md),
  [knowledge-index.md](knowledge-index.md), and
  [.agents/AGENTS.md](.agents/AGENTS.md).
- 2026-04-19: Normalized the supporting spec set to the doctrine template so every canonical spec
  now exposes the same structural questions:
  thesis,
  why the spec exists,
  canonical object or boundary,
  required behavior,
  what it is not,
  failure modes or invariants,
  and relationships to adjacent specs.
  This makes the lower-level contracts usable as real implementation inputs instead of mixed-form
  notes.
- 2026-04-19: Added an explicit
  [trading-substrate/](wiki/architecture/trading-substrate/README.md)
  subsystem with
  [specs/24-always-on-trading-substrate-contract.md](wiki/architecture/specs/24-always-on-trading-substrate-contract.md)
  and
  [adrs/0007-trading-substrate-layer.md](wiki/architecture/adrs/0007-trading-substrate-layer.md),
  then rewired the root architecture navigation so the system now reads as:
  foundation -> trading substrate -> proactive operations -> agent system -> evaluation and progression -> control plane.
  This pass also made the substrate-signal versus wake-trigger boundary more explicit as a
  first-class architecture concern.
- 2026-04-19: Added
  [25-substrate-signal-contract.md](wiki/architecture/specs/25-substrate-signal-contract.md)
  to define `SubstrateSignal` as the canonical normalized domain-fact object between the always-on
  trading substrate and proactive wake orchestration.
  This makes the signal layer explicit above substrate state surfaces and below `WakeTriggerRecord`
  history, instead of leaving that handoff implicit inside scheduler logic.
- 2026-04-19: Re-read official Alpaca account/position/order docs, Binance user-data stream and
  glossary docs, Coinbase Exchange WebSocket channel docs, and Interactive Brokers order-status
  docs, then added
  [26-substrate-state-surface-contract.md](wiki/architecture/specs/26-substrate-state-surface-contract.md).
  The substrate layer now has a canonical `SubstrateStateSurface` object below `SubstrateSignal`,
  making continuously maintained market/account/position/order_fill/risk/connector-liveness posture
  explicit before proactive orchestration evaluates signals above it.
- 2026-04-19: Re-read official order-lifecycle references across Alpaca, Binance Spot,
  Coinbase Exchange, and Interactive Brokers, then added
  [27-order-fill-surface-contract.md](wiki/architecture/specs/27-order-fill-surface-contract.md).
  The first family-specific substrate contract now fixes the line between current order/fill posture
  and immutable event history, and makes normalized lifecycle, cumulative fill, remaining quantity,
  rejection/cancel posture, and provenance explicit above raw venue-specific status strings.
- 2026-04-19: Re-read official proactive references around OpenClaw cron/heartbeat/standing-order
  composition and Claude Code routines plus scheduled tasks, then added
  [04-precedence-and-overlap.md](wiki/architecture/historical/proactive-operations/04-precedence-and-overlap.md),
  [28-wake-policy-precedence-and-overlap-contract.md](wiki/architecture/historical/specs/28-wake-policy-precedence-and-overlap-contract.md),
  and [0008-wake-policy-precedence.md](wiki/architecture/adrs/0008-wake-policy-precedence.md).
  The proactive layer now has an explicit rule for overlap:
  authority first, scope specificity second, trigger urgency third, and coalescing last.
- 2026-04-19: Re-read managed-agents, OpenAI sessions/results/HITL state docs, and Docker storage
  docs, then added
  [12-governed-execution-request-contract.md](wiki/architecture/specs/12-governed-execution-request-contract.md),
  [13-execution-attempt-contract.md](wiki/architecture/specs/13-execution-attempt-contract.md),
  and [0002-first-implementation-seam.md](wiki/architecture/adrs/0002-first-implementation-seam.md)
  so the first code seam is now anchored in two explicit implementation objects:
  governed invocation before launch, and durable execution-attempt state once launch becomes real.
- 2026-04-19: Re-read Anthropic managed-agents and context guidance, OpenAI sessions/results, and
  Docker restart/live-restore docs, then added
  [agent-system/07-persistent-operations-model.md](wiki/architecture/historical/agent-system/07-persistent-operations-model.md),
  [15-persistent-operations-and-wake-policy.md](wiki/architecture/historical/specs/15-persistent-operations-and-wake-policy.md),
  and [0003-persistent-operations-posture.md](wiki/architecture/adrs/0003-persistent-operations-posture.md)
  to formalize autokairos as an always-on trading substrate plus wakeable runtime rather than one
  immortal process, with explicit `cold`, `warm`, and `hot` wake classes tied to stage posture.
- 2026-04-19: Strengthened the source layer for production-agent design by expanding
  [anthropic-managed-agents.md](wiki/sources/library/anthropic-managed-agents.md) with Anthropic's
  context-management posture, expanding
  [anthropic-effective-harnesses-for-long-running-agents.md](wiki/sources/library/anthropic-effective-harnesses-for-long-running-agents.md)
  with the newer planner/generator/evaluator harness-design article, and expanding
  [openai-next-evolution-of-the-agents-sdk.md](wiki/sources/library/openai-next-evolution-of-the-agents-sdk.md)
  with official guardrail and agent-lifecycle guidance.
- 2026-04-19: Added the production-agent design layer:
  [agent-system/08-production-agent-design.md](wiki/architecture/historical/agent-system/08-production-agent-design.md),
  [16-production-agent-state-machine.md](wiki/architecture/historical/specs/16-production-agent-state-machine.md),
  [17-production-agent-tool-surface-and-guardrails.md](wiki/architecture/historical/specs/17-production-agent-tool-surface-and-guardrails.md),
  [18-production-agent-observability-and-slos.md](wiki/architecture/historical/specs/18-production-agent-observability-and-slos.md),
  and [0004-production-agent-posture.md](wiki/architecture/adrs/0004-production-agent-posture.md),
  so the next implementation target is now explicitly a production trading agent with state,
  wake posture, guardrails, and external observability rather than a generic harness wrapper.
- 2026-04-19: Re-ran the source pass specifically for proactive work and living-agent references.
  Strengthened [repo-anthropics-claude-code.md](wiki/sources/library/repo-anthropics-claude-code.md)
  with official `routines`, Desktop scheduled tasks, `/loop`, and platform docs; strengthened
  [repo-openai-codex.md](wiki/sources/library/repo-openai-codex.md) with the official Codex app,
  Automations, future-work scheduling, memory, and review-queue posture; strengthened
  [repo-openclaw.md](wiki/sources/library/repo-openclaw.md) with official automation, heartbeat,
  standing-orders, hooks, and task-ledger docs; and updated
  [repo-paperclip.md](wiki/sources/library/repo-paperclip.md) with the current heartbeat and
  event-trigger posture.
- 2026-04-19: Added
  [proactive-operations-and-runtime-control.md](wiki/sources/synthesis/proactive-operations-and-runtime-control.md)
  to normalize the reference set around proactive work.
  The synthesis now makes the core distinctions explicit:
  heartbeat vs exact schedule,
  detached run vs main-session turn,
  standing authority vs one-shot trigger,
  and task ledger vs scheduler.
- 2026-04-19: Promoted `proactive operations` into its own architecture subsystem with
  [historical/proactive-operations/README.md](wiki/architecture/historical/proactive-operations/README.md),
  [01-overview.md](wiki/architecture/historical/proactive-operations/01-overview.md),
  [02-trigger-model.md](wiki/architecture/historical/proactive-operations/02-trigger-model.md),
  [03-governed-self-scheduling.md](wiki/architecture/historical/proactive-operations/03-governed-self-scheduling.md),
  [19-wake-orchestration-and-trigger-model.md](wiki/architecture/historical/specs/19-wake-orchestration-and-trigger-model.md),
  [20-governed-self-scheduling-contract.md](wiki/architecture/historical/specs/20-governed-self-scheduling-contract.md),
  and [0005-proactive-operations-layer.md](wiki/architecture/adrs/0005-proactive-operations-layer.md).
  The architecture now explicitly reads as:
  always-on trading substrate -> proactive wake orchestration -> wakeable agent runtime ->
  downstream evaluation and governance.
- 2026-04-19: Re-read official OpenAI session/results/context docs, Claude scheduled-task/routine
  docs, Supabase architecture docs, and MongoDB transaction/data-modeling docs, then replaced the
  storage decision with
  [30-event-log-first-durable-truth-posture.md](wiki/architecture/historical/specs/30-event-log-first-durable-truth-posture.md)
  and [0009-event-log-first-durable-truth.md](wiki/architecture/adrs/0009-event-log-first-durable-truth.md).
  The architecture is now explicit that execution/control-plane truth should stay event-log-first,
  with explicit current-state projections above append-only history and backend choice kept
  downstream of that truth shape.
- 2026-04-19: Split the event-log-first posture into two explicit layers by adding
  [control-plane/07-history-and-projection-model.md](wiki/architecture/historical/control-plane/07-history-and-projection-model.md),
  [31-history-record-families-contract.md](wiki/architecture/historical/specs/31-history-record-families-contract.md),
  [32-current-state-projection-families-contract.md](wiki/architecture/historical/specs/32-current-state-projection-families-contract.md),
  and [0010-history-projection-split.md](wiki/architecture/adrs/0010-history-projection-split.md).
  The design now distinguishes append-only chronology from current operational standing instead of
  treating them as one undifferentiated record layer.
- 2026-04-19: Added
  [foundation/04-invariants-and-extensibility.md](wiki/architecture/foundation/04-invariants-and-extensibility.md)
  and [0011-upper-layer-flexibility.md](wiki/architecture/adrs/0011-upper-layer-flexibility.md)
  to keep the upper layers from hardening into a fixed workflow-engine schema too early.
  The architecture now treats provenance, authority, chronology, and governance boundaries as
  rigid invariants while leaving trigger families, policy programs, projection forms, and backend
  choices extensible.
- 2026-04-19: Applied that flexibility doctrine directly to proactive operations by adding
  [historical/proactive-operations/05-policy-programs-and-extensibility.md](wiki/architecture/historical/proactive-operations/05-policy-programs-and-extensibility.md)
  and rewriting
  [19-wake-orchestration-and-trigger-model.md](wiki/architecture/historical/specs/19-wake-orchestration-and-trigger-model.md),
  [20-governed-self-scheduling-contract.md](wiki/architecture/historical/specs/20-governed-self-scheduling-contract.md),
  [21-wake-policy-contract.md](wiki/architecture/historical/specs/21-wake-policy-contract.md),
  [22-standing-order-contract.md](wiki/architecture/historical/specs/22-standing-order-contract.md), and
  [28-wake-policy-precedence-and-overlap-contract.md](wiki/architecture/historical/specs/28-wake-policy-precedence-and-overlap-contract.md)
  so proactive authority is now read as stable, auditable envelopes around extensible declarative
  programs rather than as a permanently closed orchestration schema.
- 2026-04-19: Pushed the proactive flexibility work one level deeper by adding
  [historical/proactive-operations/06-clause-model-and-registries.md](wiki/architecture/historical/proactive-operations/06-clause-model-and-registries.md),
  [historical/proactive-operations/07-policy-evaluation-and-resolution.md](wiki/architecture/historical/proactive-operations/07-policy-evaluation-and-resolution.md),
  [33-wake-policy-program-clause-model.md](wiki/architecture/historical/specs/33-wake-policy-program-clause-model.md),
  [34-standing-order-program-clause-model.md](wiki/architecture/historical/specs/34-standing-order-program-clause-model.md),
  [35-policy-program-evaluation-and-resolution-contract.md](wiki/architecture/historical/specs/35-policy-program-evaluation-and-resolution-contract.md),
  and [0012-multi-phase-policy-evaluation.md](wiki/architecture/adrs/0012-multi-phase-policy-evaluation.md).
  The proactive layer is now explicit about two different stability levels:
  baseline clause families remain extensible, while policy evaluation itself is constrained to a
  stable multi-phase pipeline of normalization, authority selection, clause evaluation, precedence
  resolution, outcome decision, and durable recording.
- 2026-04-19: Extended the history/projection doctrine into proactive policy evaluation by adding
  [control-plane/08-proactive-evaluation-history-and-standing.md](wiki/architecture/historical/control-plane/08-proactive-evaluation-history-and-standing.md),
  [36-proactive-evaluation-record-contract.md](wiki/architecture/historical/specs/36-proactive-evaluation-record-contract.md),
  [37-current-proactive-standing-view-contract.md](wiki/architecture/historical/specs/37-current-proactive-standing-view-contract.md),
  and [0013-proactive-evaluation-history-and-standing.md](wiki/architecture/adrs/0013-proactive-evaluation-history-and-standing.md).
  The control plane now distinguishes proactive-policy evaluation chronology from current proactive
  posture, so emitted, suppressed, coalesced, escalated, and rejected outcomes remain auditable
  while live operators can still read one rebuildable standing view per governed scope.
- 2026-04-19: Tightened the proactive control-plane seam by adding
  [control-plane/09-proactive-causality-and-standing-reconciliation.md](wiki/architecture/historical/control-plane/09-proactive-causality-and-standing-reconciliation.md),
  [38-proactive-evaluation-to-execution-linkage-contract.md](wiki/architecture/historical/specs/38-proactive-evaluation-to-execution-linkage-contract.md),
  [39-proactive-standing-watermark-and-reconciliation-contract.md](wiki/architecture/historical/specs/39-proactive-standing-watermark-and-reconciliation-contract.md),
  and [0014-proactive-causality-and-reconciliation.md](wiki/architecture/adrs/0014-proactive-causality-and-reconciliation.md).
  The design now makes proactive chronology explicitly joinable into execution chronology through
  `ProactiveEvaluationRecord -> WakeTriggerRecord -> ExecutionRequest` and requires current
  proactive standing to expose watermark, freshness, and reconciliation posture before it is
  trusted operationally.
- 2026-04-19: Pushed the proactive persistence design down to first-cut store shapes and rebuild
  rules by adding
  [control-plane/10-proactive-record-shapes-and-standing-rebuild.md](wiki/architecture/historical/control-plane/10-proactive-record-shapes-and-standing-rebuild.md),
  [40-proactive-evaluation-record-store-contract.md](wiki/architecture/historical/specs/40-proactive-evaluation-record-store-contract.md),
  [41-proactive-standing-view-store-and-rebuild-contract.md](wiki/architecture/historical/specs/41-proactive-standing-view-store-and-rebuild-contract.md),
  and [0015-proactive-record-shapes-and-standing-rebuild.md](wiki/architecture/adrs/0015-proactive-record-shapes-and-standing-rebuild.md).
  The first proactive implementation is now explicit about two narrow persisted families:
  append-only proactive evaluation history with downstream linkage, and one watermark-aware
  current standing view per governed scope with drift detection, trust posture, and rebuild
  semantics.
- 2026-04-19: Added
  [control-plane/11-proactive-standing-updater-and-trust-management.md](wiki/architecture/historical/control-plane/11-proactive-standing-updater-and-trust-management.md),
  [42-proactive-standing-projection-updater-contract.md](wiki/architecture/historical/specs/42-proactive-standing-projection-updater-contract.md),
  [43-proactive-standing-trust-downgrade-contract.md](wiki/architecture/historical/specs/43-proactive-standing-trust-downgrade-contract.md),
  and [0016-proactive-standing-updater-and-trust-downgrade.md](wiki/architecture/adrs/0016-proactive-standing-updater-and-trust-downgrade.md).
  The proactive standing layer now has an explicit canonical mutation owner above durable history,
  and it treats `lagging`, `degraded`, and `blocked` trust posture as first-class control-plane
  semantics instead of leaving them to scheduler heuristics or UI interpretation.
- 2026-04-19: Added
  [control-plane/12-proactive-standing-update-cycle.md](wiki/architecture/historical/control-plane/12-proactive-standing-update-cycle.md),
  [44-proactive-standing-update-cycle-contract.md](wiki/architecture/historical/specs/44-proactive-standing-update-cycle-contract.md),
  and [0017-proactive-standing-update-cycle.md](wiki/architecture/adrs/0017-proactive-standing-update-cycle.md).
  The proactive standing layer now fixes one stable single-scope service loop:
  `intake -> claim -> load -> decide -> persist -> follow-up`,
  so retries, rebuild requests, and downgrade timing stay deterministic while queue, lock, and
  backend choices remain flexible.
- 2026-04-19: Added
  [control-plane/13-proactive-standing-claim-retry-and-cycle-outcomes.md](wiki/architecture/historical/control-plane/13-proactive-standing-claim-retry-and-cycle-outcomes.md),
  [45-proactive-standing-scope-claim-contract.md](wiki/architecture/historical/specs/45-proactive-standing-scope-claim-contract.md),
  [46-proactive-standing-cycle-outcome-record-contract.md](wiki/architecture/historical/specs/46-proactive-standing-cycle-outcome-record-contract.md),
  and [0018-proactive-standing-claim-and-cycle-outcomes.md](wiki/architecture/adrs/0018-proactive-standing-claim-and-cycle-outcomes.md).
  The proactive standing layer now fixes explicit scope-claim semantics before standing mutation
  and keeps non-trivial cycle outcomes such as claim loss, trust downgrade, rebuild request, and
  failed cycles durably inspectable instead of leaving them to transient logs only.
- 2026-04-19: Added
  [control-plane/14-proactive-standing-lease-retry-and-rebuild-handoff.md](wiki/architecture/historical/control-plane/14-proactive-standing-lease-retry-and-rebuild-handoff.md),
  [47-proactive-standing-claim-lease-and-expiry-contract.md](wiki/architecture/historical/specs/47-proactive-standing-claim-lease-and-expiry-contract.md),
  [48-proactive-standing-retry-backoff-and-rebuild-handoff-contract.md](wiki/architecture/historical/specs/48-proactive-standing-retry-backoff-and-rebuild-handoff-contract.md),
  and [0019-proactive-standing-lease-retry-and-rebuild-handoff.md](wiki/architecture/adrs/0019-proactive-standing-lease-retry-and-rebuild-handoff.md).
  The proactive standing layer now treats scope ownership as an expiring lease, treats retry as a
  bounded recovery posture rather than an infinite loop, and requires explicit rebuild handoff once
  retry stops improving confidence.
- 2026-04-19: Added
  [control-plane/15-proactive-standing-rebuild-and-remediation.md](wiki/architecture/historical/control-plane/15-proactive-standing-rebuild-and-remediation.md),
  [49-proactive-standing-rebuild-request-contract.md](wiki/architecture/historical/specs/49-proactive-standing-rebuild-request-contract.md),
  [50-proactive-standing-rebuild-worker-contract.md](wiki/architecture/historical/specs/50-proactive-standing-rebuild-worker-contract.md),
  [51-proactive-standing-operator-remediation-and-unblock-contract.md](wiki/architecture/historical/specs/51-proactive-standing-operator-remediation-and-unblock-contract.md),
  and [0020-proactive-standing-rebuild-and-remediation.md](wiki/architecture/adrs/0020-proactive-standing-rebuild-and-remediation.md).
  The proactive standing recovery chain now treats rebuild as explicit detached work with durable
  request causality, keeps rebuild workers anchored on active authority plus durable history rather
  than stale standing rows, and requires blocked recovery to hand off into audit-visible operator
  remediation instead of disappearing into retry loops or manual trust resets.
- 2026-04-19: Added
  [control-plane/16-proactive-rebuild-progress-and-action-history.md](wiki/architecture/historical/control-plane/16-proactive-rebuild-progress-and-action-history.md),
  [52-proactive-standing-rebuild-attempt-record-contract.md](wiki/architecture/historical/specs/52-proactive-standing-rebuild-attempt-record-contract.md),
  [53-proactive-standing-rebuild-progress-view-contract.md](wiki/architecture/historical/specs/53-proactive-standing-rebuild-progress-view-contract.md),
  [54-proactive-standing-operator-action-record-contract.md](wiki/architecture/historical/specs/54-proactive-standing-operator-action-record-contract.md),
  and [0021-proactive-rebuild-progress-and-action-history.md](wiki/architecture/adrs/0021-proactive-rebuild-progress-and-action-history.md).
  The proactive standing recovery layer now preserves each concrete rebuild try as append-only
  attempt history, exposes current recovery posture as a rebuildable progress view rather than one
  mutable status row, and keeps manual unblock or remediation actions audit-visible as durable
  action history.
- 2026-04-19: Refined
  [53-proactive-standing-rebuild-progress-view-contract.md](wiki/architecture/historical/specs/53-proactive-standing-rebuild-progress-view-contract.md)
  and [control-plane/16-proactive-rebuild-progress-and-action-history.md](wiki/architecture/historical/control-plane/16-proactive-rebuild-progress-and-action-history.md).
  The rebuild progress view now makes freshness and coverage explicit, distinguishes `idle`,
  `running`, `blocked`, and `unknown` as separate read semantics, and requires callers to be able
  to tell when progress is genuinely current versus lagging or unprovable.
- 2026-04-19: Added
  [control-plane/17-proactive-rebuild-progress-field-families.md](wiki/architecture/historical/control-plane/17-proactive-rebuild-progress-field-families.md),
  [55-proactive-rebuild-progress-field-families-contract.md](wiki/architecture/historical/specs/55-proactive-rebuild-progress-field-families-contract.md),
  and [0022-proactive-rebuild-progress-field-families.md](wiki/architecture/adrs/0022-proactive-rebuild-progress-field-families.md).
  The rebuild progress layer now has stable field families for identity/linkage, posture/reason,
  freshness, coverage, terminal summary, and read safety, so implementations can stay flexible
  without collapsing current recovery state into one opaque status row.
- 2026-04-19: Re-checked official OpenClaw task-status, Kurrent persistent-subscription checkpoint,
  and Kafka Streams restore/read-staleness references, then added
  [control-plane/18-proactive-rebuild-read-safety-classes.md](wiki/architecture/historical/control-plane/18-proactive-rebuild-read-safety-classes.md),
  [56-proactive-rebuild-read-safety-classes-contract.md](wiki/architecture/historical/specs/56-proactive-rebuild-read-safety-classes-contract.md),
  and [0023-proactive-rebuild-read-safety-classes.md](wiki/architecture/adrs/0023-proactive-rebuild-read-safety-classes.md).
  The rebuild progress layer now distinguishes operator, automation-safe, and audit reads
  explicitly, so one current projection no longer implies one universal trust threshold.
- 2026-04-19: Re-checked official OpenClaw task-audit and lost/stale-task status behavior, Kafka
  Streams interactive-query locality, and Kurrent checkpoint semantics, then added
  [control-plane/19-proactive-rebuild-read-admission-and-fallback.md](wiki/architecture/historical/control-plane/19-proactive-rebuild-read-admission-and-fallback.md),
  [57-proactive-rebuild-read-admission-and-fallback-contract.md](wiki/architecture/historical/specs/57-proactive-rebuild-read-admission-and-fallback-contract.md),
  and [0024-proactive-rebuild-read-admission-and-fallback.md](wiki/architecture/adrs/0024-proactive-rebuild-read-admission-and-fallback.md).
  The rebuild progress layer now has one canonical evaluator boundary, so serious callers either
  receive an explicitly admitted current projection or are forced onto chronology fallback.
- 2026-04-19: Re-checked official OpenClaw task audit/state-change behavior, Kurrent checkpoint and
  parking/retry visibility, and OpenAI tracing guidance, then added
  [control-plane/20-proactive-read-admission-history-and-fallback-invocation.md](wiki/architecture/historical/control-plane/20-proactive-read-admission-history-and-fallback-invocation.md),
  [58-proactive-rebuild-read-admission-record-contract.md](wiki/architecture/historical/specs/58-proactive-rebuild-read-admission-record-contract.md),
  [59-proactive-rebuild-fallback-invocation-record-contract.md](wiki/architecture/historical/specs/59-proactive-rebuild-fallback-invocation-record-contract.md),
  and [0025-proactive-read-admission-history-and-fallback-invocation.md](wiki/architecture/adrs/0025-proactive-read-admission-history-and-fallback-invocation.md).
  The rebuild read layer now preserves non-trivial admission decisions and actual chronology
  fallback as append-only operational history, while still allowing harmless polling to stay
  ephemeral or sampled.
- 2026-04-19: Re-checked official OpenClaw notify-policy distinctions, OpenAI tracing processor
  customization, and OpenTelemetry sampling concepts, then added
  [control-plane/21-proactive-read-write-policy-and-sampling.md](wiki/architecture/historical/control-plane/21-proactive-read-write-policy-and-sampling.md),
  [60-proactive-read-admission-write-policy-contract.md](wiki/architecture/historical/specs/60-proactive-read-admission-write-policy-contract.md),
  [61-proactive-fallback-invocation-write-policy-contract.md](wiki/architecture/historical/specs/61-proactive-fallback-invocation-write-policy-contract.md),
  and [0026-proactive-read-write-policy-and-sampling.md](wiki/architecture/adrs/0026-proactive-read-write-policy-and-sampling.md).
  The rebuild read layer now distinguishes must-write serious read behavior from sampled or
  ephemeral healthy polling, and gives actual chronology fallback stricter durability than benign
  current-progress reads.
- 2026-04-19: Re-checked official OpenClaw `done_only` vs `state_changes`, OpenTelemetry sampling
  and tail-sampling concepts, and OpenAI tracing processor customization, then added
  [control-plane/22-proactive-read-write-classifier-and-coalescing.md](wiki/architecture/historical/control-plane/22-proactive-read-write-classifier-and-coalescing.md),
  [62-proactive-read-write-classifier-contract.md](wiki/architecture/historical/specs/62-proactive-read-write-classifier-contract.md),
  [63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md](wiki/architecture/historical/specs/63-proactive-read-coalescing-and-duplicate-success-suppression-contract.md),
  and [0027-proactive-read-write-classifier-and-coalescing.md](wiki/architecture/adrs/0027-proactive-read-write-classifier-and-coalescing.md).
  The rebuild read layer now routes durability through one canonical classifier and only allows
  narrow duplicate-success suppression, never suppression of serious warning, failure, or actual
  fallback chronology.
- 2026-04-20: Re-checked official OpenTelemetry batch processor `ForceFlush` guidance, Kafka
  Streams `Punctuator` and stream-time versus wall-clock scheduling semantics, and Kurrent
  persistent-subscription checkpoint/restart behavior, then consolidated proactive read durability
  into
  [control-plane/23-proactive-read-write-coordinator-and-window-state.md](wiki/architecture/historical/control-plane/23-proactive-read-write-coordinator-and-window-state.md),
  [64-proactive-read-write-coordinator-contract.md](wiki/architecture/historical/specs/64-proactive-read-write-coordinator-contract.md),
  and [0028-proactive-read-write-coordinator-and-window-state.md](wiki/architecture/adrs/0028-proactive-read-write-coordinator-and-window-state.md).
  The proactive read layer now exists as one compressed durability-and-recovery layer above the
  classifier: bounded healthy suppression remains operational, durable visibility still survives,
  and restart may lose optimization state without losing truth.
- 2026-04-20: Pruned the finer-grained proactive read micro-spec chain before continuing system
  design, deleting the separate flush, restart, shutdown, and pending-visibility documents and
  folding their important invariants back into `23 / 64 / 0028`.
  The big picture is clearer again, and smaller implementation details can be revisited later
  without turning the control-plane architecture into a long micro-spec spine.
- 2026-04-20: Re-read the core inspiration set through a product lens:
  [anthropic-automated-alignment-researchers.md](wiki/sources/library/anthropic-automated-alignment-researchers.md),
  [anthropic-automated-w2s-researcher.md](wiki/sources/library/anthropic-automated-w2s-researcher.md),
  [repo-safety-research-automated-w2s-research.md](wiki/sources/library/repo-safety-research-automated-w2s-research.md),
  [repo-paperclip.md](wiki/sources/library/repo-paperclip.md),
  and the cross-source synthesis pages for evaluation and proactive operations.
  Then reset the repository from architecture-first documentation to
  `sources -> MLP -> PRD -> architecture -> PR`.
  Added [wiki/product/README.md](wiki/product/README.md),
  [wiki/product/mlp-01/00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md),
  and the first PRD set under [wiki/product/mlp-01/prds/](wiki/product/mlp-01/prds/).
  Rewrote [README.md](README.md) as a product-first entry point, narrowed
  [ARCHITECTURE.md](ARCHITECTURE.md) to a technical overview, updated
  [wiki/index.md](wiki/index.md), [wiki/architecture/README.md](wiki/architecture/README.md),
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md), and
  [wiki/architecture/foundation/02-documentation-doctrine.md](wiki/architecture/foundation/02-documentation-doctrine.md),
  and linked subsystem guides back to the PRD journeys they support.
  The new top-level product posture is now explicit: solo crypto operator, single crypto venue
  first, agent-originated hypothesis, live promotion as the human gate, and full autonomous
  execution within explicit limits.
- 2026-04-20: Split repository documentation roles explicitly.
  Moved the maintained internal knowledge base from `docs/` to `wiki/`, updated internal links to
  point at [wiki/index.md](wiki/index.md), [wiki/sources/](wiki/sources/),
  [wiki/product/](wiki/product/), and [wiki/architecture/](wiki/architecture/), and created
  [docs/README.md](docs/README.md) as the reserved future home for external service docs.
  The repository now distinguishes internal design/wiki material from later user-facing service
  documentation instead of mixing both under one `docs/` root.
- 2026-04-20: Added a minimal external service-doc spine under `docs/` so the new split is not
  just conceptual.
  Created [docs/getting-started/README.md](docs/getting-started/README.md),
  [docs/concepts/README.md](docs/concepts/README.md),
  [docs/operators/README.md](docs/operators/README.md),
  [docs/reference/README.md](docs/reference/README.md), and
  [docs/policies/README.md](docs/policies/README.md), and expanded
  [docs/README.md](docs/README.md) to explain that `docs/` is for future external service
  documentation while `wiki/` remains the internal research, product, and architecture knowledge
  base.
- 2026-04-20: Elevated MLP-01 planning into its own maintained product spine under
  [wiki/product/mlp-01/](wiki/product/mlp-01/).
  Added [README.md](wiki/product/mlp-01/README.md),
  [01-problem-jtbd-and-value.md](wiki/product/mlp-01/01-problem-jtbd-and-value.md),
  [02-journey-map.md](wiki/product/mlp-01/02-journey-map.md),
  [04-scope-and-cutline.md](wiki/product/mlp-01/04-scope-and-cutline.md),
  and [05-success-metrics-and-launch-bar.md](wiki/product/mlp-01/05-success-metrics-and-launch-bar.md).
  The wiki now treats “finish first MLP planning strongly enough to cut implementation PRs” as the
  current top-level goal instead of letting architecture detail remain the default center of
  gravity.
- 2026-04-20: Locked the canonical MLP more sharply in
  [wiki/product/mlp-01/00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md) around the first true product contract rather
  than a broad thesis.
  The fixed product decisions are now explicit in one place: operator-system posture, trustworthy
  live path as the lovable core, Binance BTC perpetual futures only, agent-originated hypotheses
  only, one per-candidate live deployment gate, and full autonomous execution within explicit
  limits after promotion.
  Updated the MLP-01 planning pack and the read path in
  [wiki/product/README.md](wiki/product/README.md), [wiki/index.md](wiki/index.md),
  [knowledge-index.md](knowledge-index.md), [wiki/product/mlp-01/prds/README.md](wiki/product/mlp-01/prds/README.md),
  and [README.md](README.md) so PRDs are now clearly downstream of the locked MLP rather than a
  parallel product-definition layer.
- 2026-04-20: Reworked the product layer into a more PM-style stack.
  Added [wiki/product/00-product-strategy.md](wiki/product/00-product-strategy.md) and
  [wiki/product/01-product-principles.md](wiki/product/01-product-principles.md), moved the
  canonical MLP contract to [wiki/product/mlp-01/00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md), and rewrote the
  `mlp-01` planning pack so it now reads more like `user/JTBD -> journey map -> scope and slices ->
  planning exit and milestones`.
  Updated [wiki/product/README.md](wiki/product/README.md), [wiki/index.md](wiki/index.md),
  [knowledge-index.md](knowledge-index.md), [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md),
  [wiki/architecture/README.md](wiki/architecture/README.md), [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md),
  and [wiki/architecture/foundation/02-documentation-doctrine.md](wiki/architecture/foundation/02-documentation-doctrine.md)
  so the current product read path is now `strategy -> principles -> MLP -> mlp-01 planning pack ->
  PRDs`.
- 2026-04-20: Deepened the MLP-01 planning layer with a more serious PM-style analysis pass.
  Added [wiki/product/02-market-icp-and-alternatives.md](wiki/product/02-market-icp-and-alternatives.md)
  to make the first user segment, market category, strategic wedge, existing alternatives, and
  Binance BTC perp rationale explicit instead of leaving them implicit inside the MLP contract.
  Expanded [wiki/product/00-product-strategy.md](wiki/product/00-product-strategy.md) with market
  category and alternative-stack framing, and updated
  [wiki/product/README.md](wiki/product/README.md), [wiki/product/mlp-01/00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md),
  [wiki/product/mlp-01/README.md](wiki/product/mlp-01/README.md), [wiki/index.md](wiki/index.md),
  [README.md](README.md), and [knowledge-index.md](knowledge-index.md) so the product layer now
  reads more like a real PM stack rather than just a thin MLP shell.
- 2026-04-20: Reset the product wiki into an explicit PM operating system instead of a loose MLP
  plus architecture mix.
  Added [wiki/product/03-product-metrics-and-decision-rules.md](wiki/product/03-product-metrics-and-decision-rules.md),
  [wiki/product/04-roadmap-now-next-later.md](wiki/product/04-roadmap-now-next-later.md), and
  [wiki/product/05-product-decision-log.md](wiki/product/05-product-decision-log.md), moved the
  MLP contract into [wiki/product/mlp-01/00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md),
  split the planning pack into
  [01-problem-jtbd-and-value.md](wiki/product/mlp-01/01-problem-jtbd-and-value.md),
  [02-journey-map.md](wiki/product/mlp-01/02-journey-map.md),
  [03-story-map-and-release-slices.md](wiki/product/mlp-01/03-story-map-and-release-slices.md),
  [04-scope-and-cutline.md](wiki/product/mlp-01/04-scope-and-cutline.md),
  [05-success-metrics-and-launch-bar.md](wiki/product/mlp-01/05-success-metrics-and-launch-bar.md),
  and [06-risks-and-open-questions.md](wiki/product/mlp-01/06-risks-and-open-questions.md),
  and moved PRDs under [wiki/product/mlp-01/prds/](wiki/product/mlp-01/prds/).
  Updated root and architecture read paths so the canonical order is now
  `sources -> strategy -> principles -> market/ICP -> metrics/decision rules -> roadmap -> decision log -> mlp-01 -> mlp-01 PRDs -> architecture`,
  with product truth above architecture and architecture forbidden from redefining market, user,
  wedge, lovable proof, or launch bar.
- 2026-04-20: Deepened the `mlp-01` planning pack to a decision-complete PM quality bar instead of
  leaving it as a thin planning skeleton.
  Rewrote
  [00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md),
  [01-problem-jtbd-and-value.md](wiki/product/mlp-01/01-problem-jtbd-and-value.md),
  [02-journey-map.md](wiki/product/mlp-01/02-journey-map.md),
  [03-story-map-and-release-slices.md](wiki/product/mlp-01/03-story-map-and-release-slices.md),
  [04-scope-and-cutline.md](wiki/product/mlp-01/04-scope-and-cutline.md),
  [05-success-metrics-and-launch-bar.md](wiki/product/mlp-01/05-success-metrics-and-launch-bar.md),
  and [06-risks-and-open-questions.md](wiki/product/mlp-01/06-risks-and-open-questions.md)
  so each page now answers one PM question decisively:
  user/JTBD/value, locked MLP contract, as-is/to-be journey, release-slice logic, scope defense,
  launch/success/kill bar, and evidence-gap management.
  The `mlp-01` pack now uses one reference operator scenario while staying strategy-agnostic, and
  it should be sufficient to deepen PRDs without forcing architecture or implementation to infer
  product intent.
- 2026-04-21: Reframed the top-level product brand around the stronger thesis
  `autokairos = automated weak-to-strong trader`.
  Updated [wiki/product/00-product-strategy.md](wiki/product/00-product-strategy.md),
  [wiki/product/01-product-principles.md](wiki/product/01-product-principles.md),
  [wiki/product/mlp-01/00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md), and
  [wiki/product/mlp-01/01-problem-jtbd-and-value.md](wiki/product/mlp-01/01-problem-jtbd-and-value.md)
  so weak-to-strong is now translated as weak human supervision over a stronger trading system
  rather than "ordinary people have weak ideas." Then updated [README.md](README.md),
  [wiki/product/README.md](wiki/product/README.md), and [knowledge-index.md](knowledge-index.md)
  so the repo now presents `serious solo crypto operator on Binance BTC perpetual futures` as the
  first wedge under the stronger brand rather than as the brand itself.
- 2026-04-22: Reset the active architecture baseline to sit downstream of the locked `mlp-01`
  PRDs rather than acting like a parallel architecture-first truth layer.
  Rewrote [wiki/architecture/README.md](wiki/architecture/README.md),
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md), subsystem README pages,
  [wiki/architecture/historical/specs/README.md](wiki/architecture/historical/specs/README.md), and
  [wiki/architecture/adrs/README.md](wiki/architecture/adrs/README.md) so the canonical technical
  path is now `PRDs -> architecture -> active specs when needed -> ADR history`, with speculative
  proactive-standing, rebuild, read-admission, and similar families removed from the default
  baseline.
- 2026-04-22: Added [wiki/product/mlp-01/07-implementation-plan.md](wiki/product/mlp-01/07-implementation-plan.md)
  as the canonical implementation entry point for MLP-01.
  Updated [wiki/product/mlp-01/README.md](wiki/product/mlp-01/README.md),
  [wiki/product/README.md](wiki/product/README.md), [wiki/architecture/README.md](wiki/architecture/README.md),
  and [knowledge-index.md](knowledge-index.md) so the active build sequence now flows from locked
  PRDs and reduced architecture into one milestone-first implementation plan, while old
  subsystem-level implementation plans remain background only.
- 2026-04-23: Locked the pre-implementation docs baseline for PR1 as a docs-only normalization
  pass instead of mixing it with the broader repo reset state.
  Added [wiki/architecture/01-pr1-trader-system-candidate-becomes-real-design.md](wiki/architecture/01-pr1-trader-system-candidate-becomes-real-design.md)
  as the canonical PR1 implementation-shape document, rewrote
  [wiki/architecture/specs/08-candidate-contract.md](wiki/architecture/specs/08-candidate-contract.md)
  and [wiki/architecture/specs/04-boundaries.md](wiki/architecture/specs/04-boundaries.md) around
  PR1-safe candidate materialization and anti-blur boundaries, and tightened
  [wiki/architecture/control-plane/README.md](wiki/architecture/control-plane/README.md),
  [wiki/architecture/agent-system/README.md](wiki/architecture/agent-system/README.md),
  [wiki/architecture/historical/specs/README.md](wiki/architecture/historical/specs/README.md),
  [wiki/architecture/README.md](wiki/architecture/README.md),
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md),
  [wiki/product/mlp-01/07-implementation-plan.md](wiki/product/mlp-01/07-implementation-plan.md),
  [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md),
  [knowledge-index.md](knowledge-index.md), [wiki/index.md](wiki/index.md), and
  [.agents/AGENTS.md](.agents/AGENTS.md) so the active implementation path now reads
  `PRDs -> architecture baseline -> implementation plan -> PR1 design note -> active PR1 specs -> subsystem docs`.
- 2026-04-23: Completed the next slice-design layer before any sequential code PR work by adding
  [wiki/architecture/02-pr2-candidate-becomes-externally-evaluated-design.md](wiki/architecture/02-pr2-candidate-becomes-externally-evaluated-design.md),
  [wiki/architecture/03-pr3-bounded-live-trader-system-runtime-design.md](wiki/architecture/03-pr3-bounded-live-trader-system-runtime-design.md),
  and [wiki/architecture/04-pr4-live-runtime-remains-controllable-design.md](wiki/architecture/04-pr4-live-runtime-remains-controllable-design.md)
  as the canonical implementation-shape documents for Slice 2 through Slice 4.
- 2026-04-23: Narrowed the active PR2, PR3, and PR4 supporting specs so they now behave like
  slice-safe contracts rather than broad lifecycle essays.
  Rewrote [wiki/architecture/specs/03-staged-evaluation.md](wiki/architecture/specs/03-staged-evaluation.md),
  [wiki/architecture/specs/10-evidence-record-contract.md](wiki/architecture/specs/10-evidence-record-contract.md),
  [wiki/architecture/specs/11-promotion-decision-contract.md](wiki/architecture/specs/11-promotion-decision-contract.md),
  [wiki/architecture/specs/12-governed-execution-request-contract.md](wiki/architecture/specs/12-governed-execution-request-contract.md),
  [wiki/architecture/specs/13-execution-attempt-contract.md](wiki/architecture/specs/13-execution-attempt-contract.md),
  [wiki/architecture/specs/14-review-item-contract.md](wiki/architecture/specs/14-review-item-contract.md),
  [wiki/architecture/historical/specs/21-wake-policy-contract.md](wiki/architecture/historical/specs/21-wake-policy-contract.md),
  and [wiki/architecture/historical/specs/23-wake-trigger-record-contract.md](wiki/architecture/historical/specs/23-wake-trigger-record-contract.md)
  around the current trust-proof milestones.
- 2026-04-23: Updated the active implementation read path across
  [wiki/product/mlp-01/07-implementation-plan.md](wiki/product/mlp-01/07-implementation-plan.md),
  [wiki/architecture/README.md](wiki/architecture/README.md),
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md),
  [wiki/architecture/historical/specs/README.md](wiki/architecture/historical/specs/README.md),
  [wiki/architecture/evaluation-and-progression/README.md](wiki/architecture/evaluation-and-progression/README.md),
  [wiki/architecture/trading-substrate/README.md](wiki/architecture/trading-substrate/README.md),
  [wiki/architecture/historical/proactive-operations/README.md](wiki/architecture/historical/proactive-operations/README.md),
  [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md),
  [wiki/index.md](wiki/index.md), [knowledge-index.md](knowledge-index.md), and
  [.agents/AGENTS.md](.agents/AGENTS.md) so the canonical order is now
  `PRDs -> architecture baseline -> implementation plan -> matching slice design note -> matching subsystem README -> active specs when needed`.
- 2026-04-23: Formalized the current repo as a **docs-only reset baseline** rather than an
  implementation-ready legacy app tree.
  Updated [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md),
  [wiki/architecture/README.md](wiki/architecture/README.md),
  [wiki/product/05-product-decision-log.md](wiki/product/05-product-decision-log.md),
  [wiki/index.md](wiki/index.md), [knowledge-index.md](knowledge-index.md), and
  [.agents/AGENTS.md](.agents/AGENTS.md) so implementers should not infer the deleted app/runtime
  tree as active implementation truth.
- 2026-04-23: Added [wiki/product/mlp-01/08-greenfield-bootstrap-plan.md](wiki/product/mlp-01/08-greenfield-bootstrap-plan.md)
  as the next planning artifact beneath the current design lock.
  This page fixes the first code step as a greenfield bootstrap substrate:
  browser-based operator surface, local runtime/service process, file-backed non-relational store,
  shared `Candidate` boundary, and deferred live/wake behavior until later PRs.
- 2026-04-23: Updated
  [wiki/product/mlp-01/README.md](wiki/product/mlp-01/README.md),
  [wiki/product/README.md](wiki/product/README.md),
  [wiki/product/mlp-01/07-implementation-plan.md](wiki/product/mlp-01/07-implementation-plan.md),
  [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md),
  [wiki/index.md](wiki/index.md), and [knowledge-index.md](knowledge-index.md)
  so the active build path now reads
  `docs-only reset baseline -> implementation plan -> greenfield bootstrap plan -> slice design -> feature PRs`.
- 2026-04-24: Reset the active docs around the managed-agents-aligned trader-system runtime model.
  Updated source, product, MLP, PRD, architecture, specs, and read-path pages so `Candidate` now
  means `TraderSystemCandidate`, execution means `TraderSystemRuntime`, and backtest/paper/live are
  `StageBinding` differences for the same artifact rather than separate product systems. Added
  Claude Managed Agents as the strongest runtime interface reference for `brain / hands / session`,
  Agent/Environment/Session/Events, custom tool execution, files/memory/vault resources, and
  provider-neutral harness seams. The active product thesis is now:
  `weak human -> agent-built trader-system candidates -> external evaluation -> promotion -> bounded live runtime -> wake/control`.
  `CapabilityPackage` is locked as a versioned context/tool/skill/data-access artifact boundary,
  while secrets remain in vault/binding/tool-proxy layers. Legacy static-note/path terminology
  was removed from the active read path, and PRD/slice design filenames were renamed to match the
  new model.
- 2026-04-24: Added Google Agent2Agent as the agent-communication/interoperability source and
  threaded it through the active product and architecture model.
  The current decision is that autokairos keeps W2S/AAR as the thesis spine, Claude Managed Agents
  as the brain/hands/session reference, and Google A2A as the reference for communication between
  independent agent endpoints.
  Updated
  [google-agent2agent-a2a.md](wiki/sources/library/google-agent2agent-a2a.md),
  [agent-runtime-and-harness-principles.md](wiki/sources/synthesis/agent-runtime-and-harness-principles.md),
  [01-product-principles.md](wiki/product/01-product-principles.md),
  [02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md), and
  [04-boundaries.md](wiki/architecture/specs/04-boundaries.md)
  so the agent-session model, `RuntimeCommunicationPolicy`, A2A-compatible task/message/artifact exchange,
  and `TeamTrace` are communication seams, not evidence, promotion, or live authority.
- 2026-04-24: Tightened the runtime/provider model so `RuntimeCommunicationPolicy` is now one unified
  provider-neutral policy per pod, while provider/driver selection lives on each
  agent-session participant model.
  This preserves the ability for one `TraderSystemRuntime` to mix Codex, Claude Code, Claude Managed
  Agents, OpenClaw/ACP, local drivers, or A2A endpoints without turning provider choice into
  product truth or separate pod types.
- 2026-04-24: Added the runtime-provider feasibility layer so provider support is no longer a vague
  label.
  [wiki/architecture/06-runtime-provider-adapter-feasibility.md](wiki/architecture/06-runtime-provider-adapter-feasibility.md)
  records the actual invocation surfaces checked for MLP-01:
  local Codex CLI `codex exec` is available and is the first real adapter target, Codex SDK and
  Codex Cloud are later OpenAI surfaces, Claude should use Claude Agent SDK, and OpenClaw/ACP or A2A
  endpoint support remains future bridge work.
  Updated the architecture read path, bootstrap specs, runtime connector interface, core primitives,
  agent-system overview, implementation plan, and product decision log so provider/session
  provider selection must name `provider_kind`, invocation surface, auth mode, sandbox policy,
  trace mode, and output contract before implementation.
- 2026-04-24: Closed the pre-implementation architecture hardening findings before Bootstrap/PR1.
  Added [wiki/architecture/specs/15-runtime-operating-policy-contract.md](wiki/architecture/specs/15-runtime-operating-policy-contract.md)
  so agent-driven pods have explicit autonomy boundaries without introducing a central workflow engine.
  Added [wiki/architecture/specs/16-order-intent-and-gateway-decision-contract.md](wiki/architecture/specs/16-order-intent-and-gateway-decision-contract.md)
  so PR3 live authority is bounded by `OrderIntent -> GatewayDecision -> ExecutionAttempt`.
  Tightened runtime role/provider separation, Codex CLI `gpt-5.4` PR1 feasibility, PR1
  materialization failure states, typed stage binding profiles, capability package manifest
  boundaries, multi-agent admission rules, and PR-specific architecture read paths across the
  active product and architecture docs.
- 2026-04-24: Reworked [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md)
  into the diagram-first architecture map for the active MLP-01 design.
  The page now shows the end-to-end product-to-architecture flow, core object model,
  `TraderSystemRuntime` anatomy, stage progression, runtime autonomy contract, provider/role split,
  multi-agent admission rule, live authority boundary, PR slice flow, subsystem ownership, and
  PR-specific spec read paths in one canonical entry document.
- 2026-04-24: Added [wiki/architecture/07-production-design-method.md](wiki/architecture/07-production-design-method.md)
  as the production-level design bar for Bootstrap and PR1 through PR4.
  Updated the system map, architecture README, knowledge index, and repo-local agent rules so
  slice design now flows through:
  `00-system-map -> 07-production-design-method -> Bootstrap/PR slice design -> active specs`.
  Added compact production-readiness sections to the Bootstrap, PR1, PR2, PR3, and PR4 design
  notes covering lifecycle, durable truth, validation/rejection, idempotency, recovery, security,
  observability, audit, and operator inspectability without reactivating old central-FSM or
  speculative production-agent documents.
- 2026-04-24: Clarified the first five operating-model explanations before continuing the
  implementation-readiness walkthrough.
  Updated [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md) so the
  autokairos runtime operating loop is separate from the docs/build workflow. The active operating
  model is now:
  `Operator -> Control Plane -> Candidate Factory -> TraderSystemCandidate Pool -> stage-bound runtimes -> Trace -> External Evaluator -> EvidenceRecord -> PromotionDecision -> bounded live runtime -> Gateway -> Wake/Intervention/Audit`.
  Updated [wiki/architecture/specs/06-containerized-execution.md](wiki/architecture/specs/06-containerized-execution.md),
  [wiki/architecture/specs/02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md),
  and [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md)
  so `TraderSystemRuntime` is a logical stage-bound runtime instance whose default serious hands
  substrate should be container-backed, while the container never owns truth.
  Also clarified that `CapabilityPackage` declares context/tool/skill/data-access capability but
  does not grant runtime access; `StageBinding`, `ToolProxy`, vault/credential binding, and gateway
  policy grant access, with package injection read-only and traceable by id/version.
- 2026-04-24: Renamed the active agent participant model to follow Claude Managed Agents more
  closely without cloning its managed harness.
  The active baseline now uses `AgentSpec` for configured agent participant profiles,
  `AgentSession` for running agent participants, `HandsEnvironment` for the sandbox/tool/data
  environment, and trace/event records outside provider state.
  Replaced the old global runtime-unit / runtime-role vocabulary in active product and
  architecture docs with slice-local `purpose_label` plus concrete `provider_kind`. PR1 may use
  `purpose_label=candidate_builder`, while PR3 must introduce its own live-session purpose instead
  of inheriting PR1 semantics.
- 2026-04-24: Corrected the active agent-runtime vocabulary to the reference-grounded model after
  reviewing OpenAI Agents SDK/SandboxAgent, Claude Managed Agents, Claude Agent SDK, Google ADK,
  A2A, ACP/OpenClaw, and MCP.
  The active design now uses `AgentSpec` for configured agent definitions, `AgentSession` for
  provider/session continuity, `AgentRun` for one invocation/task/turn/attempt, and `AgentEvent`
  for raw provider/runtime output.
  `AgentRun.purpose` replaces the older `purpose_label` wording and belongs to a concrete
  invocation, not to a session or provider.
  `AgentSession.provider_kind` names how the session is invoked, such as `codex_cli`,
  `claude_agent_sdk`, `openclaw_acp`, or `a2a_endpoint`.
  The active artifact term is now `TraderSystemSpec`, not `TradingSystemImage`, so the trader-system
  definition is not confused with a Docker/container image.
  Added maintained source notes for OpenAI Agents SDK/SandboxAgent, Claude Agent SDK, Google ADK,
  MCP, and ACP, and updated the source synthesis so A2A, ACP, and MCP stay distinct boundaries:
  A2A is remote agent communication, ACP is external coding-harness bridging, and MCP is
  tool/resource/prompt access.
- 2026-04-24: Added `TraderSystemProgram` as the open-ended executable behavior bundle inside a
  `TraderSystemSpec`.
  This corrects the design away from a human-authored strategy DSL: the weak human defines execution,
  sandbox, trace, evaluation, permission, and gateway boundaries, while the agent-built trader system
  can author Python scripts, generated policies, local planners, indicators, experiments, and wake
  logic inside a container-backed `HandsEnvironment`.
  Updated core primitives, containerized execution, boundary specs, PR1/PR3 contracts, bootstrap
  plans, source synthesis, and source notes so sandbox compute can execute freely but secrets,
  evaluator ground truth, promotion, live gateway authority, counted evidence, and durable
  session/event truth remain outside the sandbox.
- 2026-04-25: Corrected `AgentLoopPolicy` from an external wake-decision runner into an
  autonomy/observability/audit envelope.
  The active model is now that `TraderSystemRuntime` owns its internal autonomy: it may decide whether
  to invoke an agent brain, execute `TraderSystemProgram`, run scripts, use scratch state, request
  tools, or do nothing. autokairos does not choose each internal step.
  autokairos owns the boundary around that autonomy: injected inputs, event and trace export,
  `ProgramEvent` / `AgentEvent`, tool-proxy and gateway mediation, operator wake, intervention,
  external evaluation, promotion, and audit.
  Updated [wiki/architecture/specs/15-runtime-operating-policy-contract.md](wiki/architecture/specs/15-runtime-operating-policy-contract.md),
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md),
  [wiki/architecture/specs/02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md),
  [wiki/architecture/specs/07-runtime-connector-contract.md](wiki/architecture/specs/07-runtime-connector-contract.md),
  [wiki/architecture/03-pr3-bounded-live-trader-system-runtime-design.md](wiki/architecture/03-pr3-bounded-live-trader-system-runtime-design.md),
  [wiki/product/01-product-principles.md](wiki/product/01-product-principles.md),
  and the Managed Agents source/synthesis notes to align with Anthropic's brain/hands/session and
  event-observability model.
- 2026-04-25: Renamed the active runtime boundary away from misleading supervisor/loop language.
  `Runtime Bridge` is now `RuntimeConnector`, and `AgentLoopPolicy` is now
  `RuntimeAutonomyContract`.
  Added `RuntimePlacement` as the physical execution placement for a logical `TraderSystemRuntime`,
  so the design now separates logical runtime identity from process/container/provider/endpoint
  placement.
  Strengthened [wiki/architecture/specs/09-trace-contract.md](wiki/architecture/specs/09-trace-contract.md)
  with a minimum recoverable session trace envelope, checkpoint fields, and recovery outcomes
  (`reattached`, `recreated`, `stopped_for_review`, `abandoned`).
  Updated the system map, production design method, bootstrap spec, PR3 design, product principles,
  Managed Agents source note, and repo agent rules so trace plus control-plane records are the
  recoverable product state, not private runtime memory.
- 2026-04-25: Moved architecture explanation back to design-first runtime boundaries instead of
  PR-first delivery slicing.
  Added [wiki/architecture/08-runtime-authority-model.md](wiki/architecture/08-runtime-authority-model.md)
  as the canonical map for roles, execution location, ownership, authority, trace, live gateway,
  intervention, and recovery.
  Updated [wiki/architecture/README.md](wiki/architecture/README.md),
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md),
  [knowledge-index.md](knowledge-index.md), and [.agents/AGENTS.md](.agents/AGENTS.md)
  so PRDs and PR-slice docs are treated as delivery contracts after the runtime authority model,
  not as the primary architecture explanation.
- 2026-04-25: Reset runtime naming and diagrams to align with Kubernetes semantics without cloning
  Kubernetes APIs.
  The durable logical execution object is now `TraderSystemRuntime`; physical launch/resume mapping
  is `RuntimePlacement`; `ExecutionPod` is reserved only for a genuinely pod-like physical execution
  group under a placement.
  Renamed the active specs to
  [wiki/architecture/specs/07-runtime-connector-contract.md](wiki/architecture/specs/07-runtime-connector-contract.md)
  and
  [wiki/architecture/specs/15-runtime-operating-policy-contract.md](wiki/architecture/specs/15-runtime-operating-policy-contract.md),
  and renamed PRD/slice docs for bounded live runtime and live runtime control.
  Updated [wiki/architecture/08-runtime-authority-model.md](wiki/architecture/08-runtime-authority-model.md),
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md),
  [wiki/architecture/specs/02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md),
  product principles, architecture navigation, and repo agent rules so `Pod` is no longer used for
  durable product truth.
- 2026-04-25: Split canonical architecture diagrams by question so runtime design is no longer
  explained through one overloaded map.
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md) now owns the system
  boundary and durable object model views, while
  [wiki/architecture/08-runtime-authority-model.md](wiki/architecture/08-runtime-authority-model.md)
  owns logical-versus-physical execution, runtime autonomy, stage progression, live authority, and
  recovery views.
  [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md) now has
  a Bootstrap substrate view that keeps fixture/read-model setup separate from PR1 product proof.
  [wiki/architecture/foundation/03-diagramming-and-views.md](wiki/architecture/foundation/03-diagramming-and-views.md)
  now forbids diagrams that mix delivery sequence, runtime placement, durable truth, and trading
  authority in one view.
- 2026-04-25: Strengthened the runtime-agent execution boundary so agent behavior inside a
  `TraderSystemRuntime` is explicitly provider-backed.
  The active model is now
  `TraderSystemRuntime -> RuntimePlacement -> AgentSession -> RuntimeProviderAdapter -> external provider -> AgentRun -> AgentEvent -> Trace`.
  Codex, Claude, OpenClaw/ACP, A2A, and local processes are invocation surfaces behind
  `RuntimeProviderAdapter`; they provide reasoning or harness execution capability, but they do not
  own candidate truth, evidence, promotion, live gateway authority, wake/control, or audit.
- 2026-04-25: Propagated the provider-backed runtime boundary into product truth, core primitives,
  Bootstrap substrate design, product decision rules, and repo agent guidance.
  [wiki/product/01-product-principles.md](wiki/product/01-product-principles.md) and
  [wiki/product/mlp-01/00-mlp-brief.md](wiki/product/mlp-01/00-mlp-brief.md) now state that
  external providers supply execution capability behind `RuntimeProviderAdapter`, while autokairos
  keeps candidate truth, counted evidence, promotion, live gateway authority, wake/control, and
  audit.
  [wiki/architecture/specs/02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md)
  now defines `AgentSession` as provider-backed through `RuntimeProviderAdapter`, and
  [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md) now
  keeps provider execution disabled while preserving the provider-backed record seam for candidate
  materialization.
- 2026-04-25: Re-centered active architecture docs above delivery-unit planning.
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md) now describes trust-proof
  milestones and concern-specific spec paths without using pull-request sequencing as the design
  model.
  Bootstrap, core primitives, runtime connector, product principles, product decision rules, and
  repo agent guidance now use candidate materialization, external evaluation, bounded live runtime,
  and live control as design concerns first; delivery units can be cut later after the upper runtime
  model is stable.
- 2026-04-25: Corrected runtime activation from typed event-source dispatch into semantic wake.
  Added [phil-schmid-why-engineers-struggle-building-agents.md](wiki/sources/library/phil-schmid-why-engineers-struggle-building-agents.md)
  and updated the runtime authority, core primitive, connector, autonomy, source synthesis, and
  repo-agent guidance so `wake(runtime_id, AttentionRequest)` is the single conceptual runtime
  activation entrypoint.
  `AttentionRequest` carries semantic context, observed facts, refs, trace cursor, budget, and
  authority envelope; it must not become a canonical event enum or handler selector.
- 2026-04-25: Strengthened [.agents/AGENTS.md](.agents/AGENTS.md) as the repo-level
  research-grounded design gate.
  Future runtime, provider, agent, harness, evaluation, trading-authority, wake/control, and security
  design changes must now start from maintained source notes and synthesis, add missing source notes
  before architecture changes, and pass a design-quality checklist covering semantic context,
  brain/hands/session separation, harness/compute separation, concrete provider invocation surfaces,
  trace/evidence/promotion/live-authority separation, credential isolation, diagrams, failure,
  recovery, audit, and operator inspectability.
- 2026-04-25: Added a full supplied-reference ingestion layer before further architecture changes.
  [wiki/sources/reference-ledger.md](wiki/sources/reference-ledger.md) now preserves every supplied
  URL, including duplicates and localized aliases, and links each row to a maintained source note and
  synthesis target.
  Added four cluster notes:
  [anthropic-2026-runtime-and-managed-agent-stack.md](wiki/sources/library/anthropic-2026-runtime-and-managed-agent-stack.md),
  [openai-2026-agent-codex-workspace-stack.md](wiki/sources/library/openai-2026-agent-codex-workspace-stack.md),
  [google-2026-agent-platform-and-protocols.md](wiki/sources/library/google-2026-agent-platform-and-protocols.md),
  and [proactive-agent-research-papers.md](wiki/sources/library/proactive-agent-research-papers.md).
  Updated source maps, synthesis pages, knowledge navigation, and repo-agent rules so future
  autokairos design work starts from ledger -> source note -> synthesis before product or
  architecture conclusions.
- 2026-04-25: Began URL-level deep source ingestion under
  [wiki/sources/library/url-notes/](wiki/sources/library/url-notes/).
  Rows 1-21 of [wiki/sources/reference-ledger.md](wiki/sources/reference-ledger.md) now link to
  one-file-per-URL notes for the foundational W2S, Managed Agents, long-running harness, proactive
  agent, memory, skills, permission, autonomy-measurement, Workspace Agents, and Codex references.
  The notes extract design pressure for autokairos rather than only summarizing sources:
  external evaluation over self-report, brain/hands/session separation, recoverable trace,
  semantic wake, capability packages as non-authority artifacts, layered permissions, memory as a
  governed resource, autonomy as observed delegation behavior, and Codex as a provider-backed
  execution surface rather than a control-plane owner.
- 2026-04-25: Added Anthropic's
  [Project Deal](wiki/sources/library/url-notes/051-anthropic-project-deal.md) as a URL-level source
  note and ledger row.
  The source strengthens the economic weak-supervision thesis: agent representatives can produce
  real transaction outcomes, stronger models can produce objectively better outcomes, and humans
  represented by weaker agents may not perceive the disadvantage.
  Updated evaluation/governance and product-posture synthesis so autokairos treats provider/model
  quality, comparable runs, objective evidence, and subjective/operator-satisfaction gaps as
  explicit design concerns.
- 2026-04-25: Completed URL-level ingestion for OpenAI rows 22-38 in
  [wiki/sources/reference-ledger.md](wiki/sources/reference-ledger.md).
  Added one-file-per-URL notes for OpenAI's new agent-building tools, AgentKit, Agents SDK sandbox
  agents, running agents, orchestration/handoffs, guardrails and human review, observability,
  agent evals, MCP/connectors, skills, latest-model guidance, tools overview, shell, computer use,
  compaction, token counting, and reasoning models under
  [wiki/sources/library/url-notes/](wiki/sources/library/url-notes/).
  The extracted design pressure is now explicit: provider agent loops are borrowed capability,
  sandbox compute is physical placement not product truth, tool availability is not authority,
  trace is mandatory but not evidence, evals become `EvidenceRecord` only through autokairos rules,
  model choice requires probe/eval metadata, and shell/computer-use surfaces must stay inside
  stage-bound permission and gateway controls.
- 2026-04-25: Completed URL-level ingestion for Google rows 39-50 in
  [wiki/sources/reference-ledger.md](wiki/sources/reference-ledger.md).
  Added one-file-per-URL notes for Google Cloud Next '26, Gemini Enterprise Agent Platform,
  Gemini Enterprise app updates, Agent Runtime, Memory Bank, ADK, Google's agent protocol guide,
  A2A, Jules with Gemini 3, and Gemini Cloud Assist under
  [wiki/sources/library/url-notes/](wiki/sources/library/url-notes/).
  The extracted design pressure is now explicit: enterprise agent platforms separate runtime,
  memory, identity, registry, gateway, observability, evaluation, and protocol; `RuntimePlacement`
  is replaceable execution infrastructure rather than product truth; memory must be scoped and
  auditable rather than counted evidence; ADK is a provider/framework option rather than a mandate
  for graph-first architecture; A2A is remote agent communication rather than tool access or live
  authority; and proactive cloud-assist behavior maps to semantic attention and operator control,
  not direct trading side effects.
- 2026-04-25: Promoted the full reference ingestion into active design constraints and cleaned the
  architecture baseline.
  Updated the four synthesis pages under [wiki/sources/synthesis/](wiki/sources/synthesis/) so URL
  notes now resolve into explicit design rules for provider-backed execution, semantic attention,
  runtime memory, A2A/MCP/ACP boundaries, external evaluation, and platform-scope restraint.
  Reduced [wiki/architecture/specs/](wiki/architecture/specs/) to the physical active-spec gate
  with 21 markdown files including its README, and moved non-active specs to
  [wiki/architecture/historical/specs/](wiki/architecture/historical/specs/).
  Replaced the active proactive trigger model with
  [wiki/architecture/historical/proactive-operations/02-semantic-attention-and-wake.md](wiki/architecture/historical/proactive-operations/02-semantic-attention-and-wake.md),
  preserving older scheduler/standing-order material under
  [wiki/architecture/historical/proactive-operations/](wiki/architecture/historical/proactive-operations/).
  Added `RuntimeMemorySurface` as scoped runtime context, not evidence or provider-private truth, and
  tightened active architecture/read-path guidance so source -> synthesis -> runtime authority ->
  active specs is the default design path.
- 2026-04-25: Locked the `TraderSystemRuntime` operating model before code bootstrap.
  Added
  [wiki/architecture/09-trader-system-runtime-operating-model.md](wiki/architecture/09-trader-system-runtime-operating-model.md)
  as the canonical operating-cycle document for what happens after
  `wake(runtime_id, AttentionRequest)`.
  The model keeps runtime activation semantic rather than closed event routing, separates
  `TraderSystemRuntime` from `RuntimePlacement`, separates provider-backed `AgentSession` execution
  from `TraderSystemProgram` hands execution, and requires all meaningful outputs to cross trace,
  tool proxy, trading gateway, evaluator, operator wake, or audit boundaries before becoming
  durable product truth.
  Updated architecture/read-path docs so `00-system-map -> 08-runtime-authority-model ->
  09-trader-system-runtime-operating-model -> connector/autonomy/trace specs` is the active
  runtime-design path.
- 2026-04-25: Re-audited supplied reference rows 1-51 before further architecture changes.
  Added and promoted
  [wiki/sources/synthesis/reference-impact-audit-2026-04.md](wiki/sources/synthesis/reference-impact-audit-2026-04.md)
  as the source-impact gate between URL notes and active design changes.
  The audit confirms the current direction: `TraderSystemCandidate`, `TraderSystemRuntime`,
  semantic `AttentionRequest`, replaceable `RuntimePlacement`, provider-backed execution,
  `Trace != EvidenceRecord`, and `OrderIntent -> GatewayDecision -> ExecutionAttempt` remain
  correct.
  It also identifies the next hardening targets before implementation: `RuntimeMemorySurface` trust
  classes and rollback, attention-quality evaluation, comparable/evaluable runs with provider/model
  attribution, concrete provider probes, and tighter capability-package trust boundaries.
- 2026-04-25: Hardened `RuntimeMemorySurface` into an active production-grade memory boundary.
  Updated [wiki/architecture/specs/02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md),
  [wiki/architecture/specs/04-boundaries.md](wiki/architecture/specs/04-boundaries.md),
  [wiki/architecture/specs/09-trace-contract.md](wiki/architecture/specs/09-trace-contract.md),
  [wiki/architecture/09-trader-system-runtime-operating-model.md](wiki/architecture/09-trader-system-runtime-operating-model.md),
  [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md), and
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md) so runtime memory is now
  versioned, scoped, trust-classed, access-mode controlled, and auditable.
  The active rule is: memory may influence runtime reasoning only through traceable memory id,
  version, trust class, and scope; runtime writes become `MemoryWriteProposal`; quarantine excludes
  memory from default runtime context; rollback changes accepted memory pointers without deleting
  trace; and memory remains separate from evidence, promotion, live authority, credentials, and
  provider-private state.
- 2026-04-25: Hardened `AttentionRequest` and `NextAttentionPlan` into active production-grade
  runtime activation boundaries.
  Updated [wiki/architecture/specs/02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md),
  [wiki/architecture/historical/proactive-operations/02-semantic-attention-and-wake.md](wiki/architecture/historical/proactive-operations/02-semantic-attention-and-wake.md),
  [wiki/architecture/09-trader-system-runtime-operating-model.md](wiki/architecture/09-trader-system-runtime-operating-model.md),
  [wiki/architecture/specs/15-runtime-operating-policy-contract.md](wiki/architecture/specs/15-runtime-operating-policy-contract.md),
  [wiki/architecture/specs/09-trace-contract.md](wiki/architecture/specs/09-trace-contract.md),
  [wiki/architecture/historical/specs/21-wake-policy-contract.md](wiki/architecture/historical/specs/21-wake-policy-contract.md),
  and [wiki/architecture/historical/specs/23-wake-trigger-record-contract.md](wiki/architecture/historical/specs/23-wake-trigger-record-contract.md).
  The active rule is: `wake(runtime_id, AttentionRequest)` remains the only conceptual runtime
  activation entrypoint, but every delivered attention must be recoverable through construction,
  admission, outcome, and later quality-review records.
  `NextAttentionPlan` is now explicitly a runtime proposal that must be accepted, modified,
  rejected, or deferred by the control plane before creating future attention, and
  `WakeTriggerRecord` remains operator-facing wake history rather than generic runtime activation.
- 2026-04-25: Hardened provider feasibility into an active probe/readiness boundary.
  Updated
  [wiki/architecture/06-runtime-provider-adapter-feasibility.md](wiki/architecture/06-runtime-provider-adapter-feasibility.md),
  [wiki/architecture/specs/07-runtime-connector-contract.md](wiki/architecture/specs/07-runtime-connector-contract.md),
  [wiki/architecture/specs/02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md),
  [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md),
  [wiki/sources/synthesis/reference-impact-audit-2026-04.md](wiki/sources/synthesis/reference-impact-audit-2026-04.md),
  and [.agents/AGENTS.md](.agents/AGENTS.md).
  The active rule is: a provider label is not runnable until `RuntimeProviderAdapter.probe()`
  produces a current `ProviderReadinessRecord`; probe must verify availability, version, auth,
  model access, sandbox posture, tool policy, output contract, schema-output smoke, trace/event
  export, cancellation, artifact export, and resume behavior.
  The first runnable assumption remains narrow: `provider_kind=codex_cli`, `model=gpt-5.4`,
  `AgentRun.purpose=candidate_generation`, schema output, and trace export.
  Default `gpt-5.5` access failure remains recorded environment evidence, and provider readiness
  does not grant evidence, promotion, live execution, or durable runtime truth.
- 2026-04-26: Hardened evaluation comparability and evidence sealing into an active architecture
  boundary.
  Added
  [wiki/architecture/specs/17-evaluation-comparability-and-sealing-contract.md](wiki/architecture/specs/17-evaluation-comparability-and-sealing-contract.md)
  and updated the staged evaluation, trace, evidence, promotion, bootstrap, boundary, runtime
  operating-model, architecture navigation, PRD, and source-synthesis docs around it.
  The active rule is now:
  `Trace -> EvaluationRunRecord -> EvidenceSealingDecision -> EvidenceRecord -> PromotionDecision`.
  `EvaluationComparisonSet` records whether runs are comparable before evidence can support a
  promotion claim.
  Provider eval output, A2A artifacts, memory summaries, tool results, and operator satisfaction are
  judgment inputs only; they do not become counted evidence without sealing.
  Non-comparable, partial, leakage-tainted, or reward-hacking-suspect results remain visible but
  cannot open live gate.
- 2026-04-26: Hardened `CapabilityPackage` trust, sandbox, and permission boundaries into active
  architecture.
  Added
  [wiki/architecture/specs/18-capability-package-trust-and-permission-contract.md](wiki/architecture/specs/18-capability-package-trust-and-permission-contract.md)
  and updated core primitives, boundaries, containerized execution, bootstrap substrate, source
  synthesis, and the reference-impact audit around it.
  The active rule is now:
  `CapabilityPackage -> CapabilityManifest -> CapabilityPackageAdmissionRecord -> CapabilityGrant -> CapabilityMountRecord -> Trace`.
  `CapabilityManifest` declares requested capabilities; it never grants access.
  `CapabilityGrant` records stage-bound access through `StageBinding`, `ToolProxy`, vault/binding,
  and `TradingGateway`.
  `CapabilityMountRecord` records what package content reached one runtime placement or hands
  environment, with read-only package content separated from writable scratch/output.
  Packages must not contain exchange credentials, provider keys, vault tokens, gateway signing
  material, live approval, evaluator hidden labels, benchmark answers, scoring ground truth,
  undeclared network endpoints, hidden self-promotion instructions, or policy-bypass prompts.
- 2026-04-26: Cleaned up active design navigation and stale audit wording without adding new
  architecture primitives.
  Updated [knowledge-index.md](knowledge-index.md) so the default design read path is eight steps
  and file inventory detail lives behind catalog entrypoints.
  Updated [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md) with a
  `Current Locked Boundaries` table covering runtime/placement, provider/evidence,
  memory/evidence, semantic attention, capability grant, trace/evidence, live authority, and
  A2A/MCP/ACP separation.
  Updated [wiki/sources/synthesis/reference-impact-audit-2026-04.md](wiki/sources/synthesis/reference-impact-audit-2026-04.md)
  so completed hardening work is marked as active/hardened rather than future work.
  Updated [wiki/architecture/README.md](wiki/architecture/README.md),
  [wiki/architecture/specs/README.md](wiki/architecture/specs/README.md), and
  [.agents/AGENTS.md](.agents/AGENTS.md) so future cleanup work prioritizes stale wording,
  read-path drift, and active/historical confusion before adding more docs.
- 2026-04-26: Hardened `TraderSystemSpec` / `TraderSystemProgram` artifact identity into active
  architecture.
  Added
  [wiki/architecture/specs/19-trader-system-artifact-contract.md](wiki/architecture/specs/19-trader-system-artifact-contract.md)
  and connected it from core primitives, candidate contract, bootstrap substrate, system map,
  architecture navigation, and source synthesis.
  The active rule is now:
  `TraderSystemSpec -> TraderSystemProgram -> ProgramManifest -> ProgramValidationRecord -> ProgramEvent / Trace`.
  `TraderSystemSpec` defines the versioned trader-system artifact; `TraderSystemProgram` is the
  agent-authored executable behavior bundle; `ProgramManifest` declares entrypoint, runtime kind,
  artifacts, output contract, sandbox requirement, and required grants; and
  `ProgramValidationRecord` decides whether a program is safe enough to mount or execute.
  Program validation is not promotion, program artifacts are not evidence, and changed program
  behavior must become a `CandidateVersion` path rather than live in-place mutation.
- 2026-04-26: Cleaned up Bootstrap implementation-readiness docs before code work.
  Reframed [wiki/architecture/05-bootstrap-tech-spec.md](wiki/architecture/05-bootstrap-tech-spec.md)
  as a narrow Bootstrap PR contract with four deliverables only:
  `apps/operator-web`, `apps/runtime`, `packages/domain`, and `packages/local-store`.
  Updated [wiki/product/mlp-01/08-greenfield-bootstrap-plan.md](wiki/product/mlp-01/08-greenfield-bootstrap-plan.md),
  [wiki/architecture/00-system-map.md](wiki/architecture/00-system-map.md), and
  [wiki/architecture/specs/README.md](wiki/architecture/specs/README.md) so Bootstrap is split into
  `Build now`, `Fixture only`, and `Do not build`.
  The active rule is now: Bootstrap provides read-only inspect, local file-backed fixture truth,
  restart recovery, and seam visibility for provider/program/capability/memory/evaluation/runtime
  records, but it does not execute providers, programs, evaluators, wake/control, live trading,
  marketplace, or A2A networking.
- 2026-04-26: Reset active runtime architecture from semantic activation to control-plane
  lifecycle operation.
  Updated [wiki/architecture/08-runtime-authority-model.md](wiki/architecture/08-runtime-authority-model.md),
  [wiki/architecture/09-trader-system-runtime-operating-model.md](wiki/architecture/09-trader-system-runtime-operating-model.md),
  [wiki/architecture/specs/02-core-primitives.md](wiki/architecture/specs/02-core-primitives.md),
  [wiki/architecture/specs/07-runtime-connector-contract.md](wiki/architecture/specs/07-runtime-connector-contract.md),
  [wiki/architecture/specs/15-runtime-operating-policy-contract.md](wiki/architecture/specs/15-runtime-operating-policy-contract.md),
  [wiki/architecture/control-plane/README.md](wiki/architecture/control-plane/README.md), and
  [wiki/architecture/agent-system/README.md](wiki/architecture/agent-system/README.md).
  The active rule is now:
  `external agent creates artifact -> autokairos registers/deploys/controls lifecycle -> TraderSystemRuntime runs internally -> ToolProxy/TradingGateway/Trace/Evaluation/Audit bound effects`.
  Removed semantic activation primitives from active baseline and moved older proactive/wake,
  attention, and runtime-driver notes under `wiki/architecture/historical/`.
  `RuntimeControl` now covers `register`, `deploy`, `start`, `pause`, `resume`, `stop`,
  `inspect`, `override`, and `kill`; `RuntimeOperatingPolicy` bounds lifecycle, placement, trace,
  tool/gateway access, stop conditions, recovery, and audit.
  Bootstrap remains read-only inspect plus fixture seams, with no runtime action APIs.
