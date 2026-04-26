# Reference Impact Audit 2026-04

This page re-audits rows 1-51 of [../reference-ledger.md](../reference-ledger.md).

It is not another source-summary page. It answers:

- which source pressures reinforce current autokairos design
- which source pressures expose wording gaps
- which source pressures have already been promoted into active boundary hardening
- which source pressures would require new primitives
- which reference-system behavior must be rejected or not copied

Architecture changes should not skip this layer. The path is:

```text
source note
-> synthesis
-> reference impact audit
-> active design change candidate
```

## Audit Scope

Rows covered:

- rows 1-51 in [../reference-ledger.md](../reference-ledger.md)
- URL-level notes under [../library/url-notes/](../library/url-notes/)
- the four active synthesis pages:
  [agent-runtime-and-harness-principles.md](agent-runtime-and-harness-principles.md),
  [proactive-operations-and-runtime-control.md](proactive-operations-and-runtime-control.md),
  [evaluation-governance-and-promotion.md](evaluation-governance-and-promotion.md),
  and [reference-systems-and-product-postures.md](reference-systems-and-product-postures.md)

This audit originally identified safe design changes before architecture patches. It now also
records which audit findings have been promoted into active design so stale "future hardening"
language does not mislead implementers.

## Source Note Quality Findings

The URL-note layer is good enough for design re-audit, with two caveats.

| Finding | Result |
| --- | --- |
| Rows 1-51 all have source-note coverage | Pass |
| Rows 1-51 all link to at least one synthesis page | Pass |
| Non-alias URL notes include `What Not To Copy` and autokairos design pressure | Pass |
| Rows 9 and 47 are duplicate/localized aliases with alias-only notes | Acceptable; canonical meaning lives in rows 16 and 46 |
| Rows 2, 12, 18, 19, 45, and 48 remain `needs-update` in the ledger | Acceptable for this audit, but must be deep-reread before implementation depends on the exact provider/API behavior |

The most important note-quality risk is not missing coverage. It is over-trusting product/marketing
pages as executable API truth. The audit therefore treats product pages as posture evidence and
official developer docs/repositories as implementation evidence.

## Priority Needs-Update Rows

Rows 2, 12, 18, 19, 45, and 48 remain marked `needs-update` in the ledger because they are
implementation-sensitive sources. Their current notes are sufficient for design-direction audit,
but they should be live-reread before any code or API contract depends on exact provider behavior.

| Row | Source | Audit finding | Design action before implementation |
| --- | --- | --- | --- |
| 2 | Claude Managed Agents overview | Reinforces `AgentSpec / HandsEnvironment / AgentSession / AgentEvent / Trace`; provider feature stability remains the risk. | Recheck current Agent/Environment/Session/Event API before a Claude-managed provider adapter. |
| 12 | Claude Managed Agents memory | Strongest memory boundary source; memory versioning, read/write mode, and poisoning risk have now been promoted into active `RuntimeMemorySurface` rules. | Recheck current Managed Agents memory API before provider-specific memory integration; keep autokairos memory separate from provider-private memory. |
| 18 | OpenAI Codex app | Useful provider/product posture, but not stable API truth. | Treat Codex app as posture only; use CLI/SDK/developer docs for executable adapter contracts. |
| 19 | OpenAI Codex product page | Reinforces Codex as provider-backed coding capability, not live authority. | Re-probe concrete Codex invocation surface, auth, model access, output schema, sandbox, and trace before implementation. |
| 45 | Google ADK | Useful framework vocabulary and deployment/eval reference; graph-first orchestration is not an autokairos mandate. | If ADK is considered later, map ADK events/artifacts/tools into `AgentEvent -> Trace` before adopting any framework structure. |
| 48 | A2A latest spec | Strongest protocol boundary for remote agent communication, not tools or authority. | Recheck AgentCard/Task/Message/Artifact details before defining `A2AAgentEndpoint` or remote specialist exchange records. |

These rows should not block the current design audit. They should block provider-specific
implementation confidence until refreshed.

## Impact Classification

| Classification | Meaning |
| --- | --- |
| `reinforces current design` | Current active model remains correct. |
| `requires wording change` | Current model is directionally right, but terminology or read-path wording can mislead. |
| `requires boundary change` | A current boundary needs stronger design detail before implementation. |
| `requires new primitive` | Existing object model is insufficient. |
| `reject / do not copy` | Source behavior is intentionally out of scope or unsafe to import. |

## Cluster Audit

### Weak-To-Strong, External Evaluation, And Objective Outcomes

Rows: 1, 3, 4, 15, 29, 51.

Classification:

- `reinforces current design`
- `requires boundary change`

What strengthens:

- `Trace`, `AgentEvent`, `ProgramEvent`, tool output, memory summaries, and A2A artifacts are not
  evidence.
- `EvidenceRecord` must be sealed by an external evaluation boundary.
- Stronger provider/model performance can create objective advantage that weak humans may not
  perceive subjectively.
- Runtime self-report cannot become legitimacy, promotion, or live-gate truth.

Boundary change promoted after audit:

- evaluation now preserves provider/model/run attribution so a promoted trader system can be
  compared against weaker or alternative systems.
- evidence design now includes abuse/reward-hacking pressure, not just pass/fail result storage.
- operator satisfaction remains stored separately from objective evidence.

Boundary change now promoted:

- `EvaluationRunRecord` preserves what the evaluator saw and under which provider/model/stage/data
  conditions.
- `EvaluationComparisonSet` preserves whether runs are comparable enough for the claim being made.
- `EvidenceSealingDecision` decides counted, non-counted, or quarantined disposition before any
  `EvidenceRecord` exists.
- subjective operator satisfaction, provider eval output, A2A artifacts, memory summaries, and tool
  results remain judgment inputs, not objective evidence.

Active design impact:

| Axis | Audit result |
| --- | --- |
| `TraderSystemCandidate` | Reinforced; candidate is the evaluated system, not a strategy note. |
| `Trace/EvidenceRecord` | Tightened through `EvaluationRunRecord`, `EvaluationComparisonSet`, and `EvidenceSealingDecision`. |
| Bootstrap substrate | Should leave room for evaluation/sealing refs even before real eval exists. |

### Managed Agents, Long-Running Harnesses, Sessions, And Sandboxes

Rows: 2, 3, 4, 10, 12, 13, 14, 24, 25, 28, 36, 37, 38, 43, 45.

Classification:

- `reinforces current design`
- `requires boundary change`

What strengthens:

- `AgentSpec`, `AgentSession`, `AgentRun`, and `AgentEvent` remain the right vocabulary.
- `TraderSystemRuntime` must not collapse into provider session, container, or sandbox.
- `RuntimePlacement` remains replaceable physical execution infrastructure.
- `HandsEnvironment` is where generated code, scripts, tools, and packages run; it is not truth.
- provider session memory and compaction are conveniences, not recovery truth.

Boundary change promoted after audit:

- `RuntimeMemorySurface` now has explicit trust classes before live runtime:
  read-only reference, candidate-local memory, operator preference, recovery note, evaluator-visible
  context, and rejected/poisoned memory.
- memory reads/writes that influence runtime behavior must become traceable.
- memory rollback and poisoning review now have operator-visible record expectations before live
  autonomy depends on writable memory.

Active design impact:

| Axis | Audit result |
| --- | --- |
| `TraderSystemRuntime` | Reinforced as logical runtime boundary. |
| `RuntimePlacement` | Reinforced as replaceable physical placement. |
| `RuntimeMemorySurface` | Hardened after audit through trust classes, access modes, influence refs, quarantine, and rollback rules. |
| provider-backed execution | Reinforced; provider output remains `AgentEvent -> Trace`. |

### OpenAI Codex, AgentKit, Agents SDK, Tools, Guardrails, And Evals

Rows: 18-38.

Classification:

- `reinforces current design`
- `requires boundary change`
- `requires wording change`
- `reject / do not copy`

What strengthens:

- Codex is a serious provider-backed execution surface, especially for generating
  `TraderSystemProgram` artifacts.
- provider names are not executable until probe, auth, model access, sandbox posture, output
  contract, and trace export are checked.
- tools, shell, computer use, connectors, MCP, and skills are capability surfaces, not authority.
- observability and eval tooling are inputs to autokairos judgment, not autokairos evidence by
  themselves.

Wording changes needed:

- Codex should be described as a provider surface or harness, not as the default autokairos runtime.
- AgentKit and Workspace Agents are product/platform references, not active product scope.
- OpenAI eval outputs must be described as eval inputs unless autokairos seals them.

Boundary change promoted after audit:

- provider labels need `ProviderReadinessRecord` before they are runnable.
- probe must verify install/API availability, auth state, model access, sandbox posture, tool access,
  output contract support, schema-output smoke, trace/event export, cancellation, artifact export,
  and resume support.
- the current `codex_cli` assumption is only `active_verified` for explicit `gpt-5.4` schema-output
  candidate generation; default `gpt-5.5` access failure remains design evidence, not a footnote.
- `local_process` remains subject to adapter semantics and cannot bypass trace, permission, output,
  or failure handling.

Do not copy:

- Codex app UX as autokairos product shape.
- AgentKit platform breadth.
- provider review queues as promotion authority.
- shell/computer-use access as unrestricted `HandsEnvironment` authority.

Active design impact:

| Axis | Audit result |
| --- | --- |
| provider-backed execution | Reinforced; first real adapter must stay concrete, probed, and backed by `ProviderReadinessRecord`. |
| `Trace/EvidenceRecord` | Reinforced; provider eval/trace output is not evidence until `EvidenceSealingDecision`. |
| `OrderIntent/GatewayDecision` | Reinforced; tools/shell/computer-use cannot bypass gateway. |
| Bootstrap substrate | Should not implement real provider or evaluator execution, but must keep provider/readiness/probe/run/trace/evaluation refs. |

### Google Gemini Enterprise, Agent Runtime, ADK, A2A, Memory Bank, Jules, And Cloud Assist

Rows: 39-50.

Classification:

- `reinforces current design`
- `requires wording change`
- `reject / do not copy`

What strengthens:

- runtime, memory, identity, registry, observability, evaluation, gateway, and protocol are separate
  platform concerns.
- ADK is a provider/framework reference, not a graph-first mandate.
- A2A is remote agent communication, not MCP, evidence, promotion, or live authority.
- Memory Bank supports scoped memory surfaces, not hidden truth.
- proactive cloud-assist behavior maps to supervised runtime control and operator review, not direct
  side effects.

Wording changes needed:

- A2A should be framed as optional remote-agent communication for future multi-agent runtime shapes.
- Agent registry/identity should be treated as future indexing/governance, not Bootstrap scope.
- Google Agent Gateway should not collapse `ToolProxy` and `TradingGateway` into one generic gateway.

Do not copy:

- enterprise fleet platform scope.
- graph-first orchestration as the core runtime model.
- A2A mesh as a first-MLP dependency.
- agent gateway terminology that hides live trading authority.

Active design impact:

| Axis | Audit result |
| --- | --- |
| `RuntimePlacement` | Reinforced by Google Agent Runtime. |
| `RuntimeMemorySurface` | Reinforced, with future trust/rollback detail needed. |
| A2A / MCP / ACP | Reinforced as separate boundaries. |
| Runtime control | Reinforced as lifecycle/governance control rather than alert-handler dispatch. |

### Proactive Research, Generative Agents, Memory, And Runtime Outcome Quality

Rows: 6, 7, 8, 11, 12, 16, 17, 44, 50.

Classification:

- `reinforces current design`
- `requires boundary change`

What strengthens:

- long-running trader systems need traceable context, action timing, and outcome quality.
- timing quality and action quality are different evaluation questions.
- memory and reflection can improve proactive behavior, but only when influence is auditable.
- background/proactive work must return to inspectable review and runtime-control surfaces.

Boundary change after runtime-control reset:

- autokairos no longer owns trader-system activation through a control-plane payload.
- `TraderSystemProgram` owns internal timing and behavior inside sandbox/provider boundaries.
- runtime actions, memory influence, program events, provider events, tool calls, and order intents
  must remain traceable for later evaluation and audit.

Active design impact:

| Axis | Audit result |
| --- | --- |
| Runtime control | Hardened after audit as lifecycle/governance control, not internal activation. |
| `RuntimeMemorySurface` | Hardened after audit through influence trace, poisoning review, quarantine, and rollback boundaries. |
| `Trace/EvidenceRecord` | Reinforced; timing/action quality must be externally judged. |

### Product Posture, Cowork, Workspace Agents, And Agent-Mediated Work

Rows: 5, 9, 10, 16, 17, 20, 23, 39-42, 49, 51.

Classification:

- `reinforces current design`
- `reject / do not copy`

What strengthens:

- autokairos should feel like supervised delegated work, not chat.
- operator re-entry, inspectability, review, and action history are product requirements.
- agent-mediated work can produce real outcomes even when humans do not directly perform every
  action.
- subjective confidence and objective outcome quality can diverge.

Do not copy:

- Claude Cowork or Workspace Agents UX as product truth.
- enterprise workspace/fleet breadth.
- generic software-agent dashboard scope.
- marketplace/commercial agent packaging as MLP-01 scope.

Active design impact:

| Axis | Audit result |
| --- | --- |
| `TraderSystemCandidate` | Reinforced as the supervised object under judgment. |
| Product category | Reinforced as automated weak-to-strong trader, not generic agent platform. |
| Bootstrap substrate | Should stay inspect-first, not dashboard breadth. |

## Row Coverage Map

| Rows | Source family | Audit classification |
| --- | --- | --- |
| 1 | Automated W2S Researcher | `reinforces current design`, `requires boundary change` for anti-gaming/eval legitimacy |
| 2 | Claude Managed Agents overview | `reinforces current design`, later provider deep-reread before implementation |
| 3-4 | Long-running harness design | `reinforces current design` for trace/artifact recovery and evaluator split |
| 5 | Claude Cowork | `reject / do not copy` product shape; reinforces supervised delegated work |
| 6-8 | Proactive/generative/proactive-benchmark papers | `requires boundary change` for timing/action-quality and memory-influence evaluation |
| 9 | OpenAI Workspace Agents Korean alias | duplicate alias; covered by row 16 |
| 10 | Claude Managed Agents blog | reinforces managed runtime stack, sandbox, session, permission boundaries |
| 11 | Proactive Agent package | `requires boundary change` for package/memory trust and sandboxing |
| 12 | Claude Managed Agents memory | `requires boundary change` for memory trust classes and rollback |
| 13-14 | Claude Code auto mode and skills | reinforces permission tiers, sandboxed generated code, capability packages, and package admission/grant boundaries |
| 15 | Measuring agent autonomy | reinforces measuring delegation behavior separately from task success |
| 16-17 | OpenAI Workspace Agents | reinforces background/review surfaces; reject workspace platform scope |
| 18-21 | Codex app/product/security/use-case pages | reinforces Codex as provider; reject Codex app wrapper and provider-owned truth |
| 22-38 | OpenAI agent developer docs | reinforces provider/run/sandbox/tool/guardrail/eval separation |
| 39-44 | Google Next/Gemini Enterprise/Runtime/Memory | reinforces runtime/memory/gateway/identity/eval decomposition |
| 45 | Google ADK | framework/reference only; reject graph-first mandate |
| 46-48 | Google protocols and A2A | reinforces A2A/MCP distinction; reject A2A as authority |
| 49-50 | Jules and Cloud Assist | reinforces long-running task trace and proactive operator re-entry |
| 51 | Anthropic Project Deal | reinforces objective-vs-subjective outcome gap and provider/model attribution |

## Active Design Impact Matrix

| Active design axis | Audit verdict | Required next action |
| --- | --- | --- |
| `TraderSystemCandidate` | correct | keep candidate as evaluated trader-system identity |
| `TraderSystemRuntime` | correct | keep as logical runtime, not provider session or container |
| `RuntimeControl` | hardened after audit | active docs now define lifecycle commands, decisions, lifecycle events, placement, trace, stop, recovery, and audit posture |
| `RuntimePlacement` | correct | keep physical placement replaceable and provider/container agnostic |
| `RuntimeMemorySurface` | hardened after audit | active docs now define trust classes, read/write posture, influence trace, quarantine, and rollback expectations |
| provider-backed execution | hardened after audit | provider feasibility docs now require concrete invocation/probe/auth/model/output/trace readiness records |
| `Trace/EvidenceRecord` | hardened after audit | active evaluation docs now capture comparable runs, provider/model attribution, sealing, and anti-gaming pressure |
| `CapabilityPackage` | hardened after audit | active docs now separate manifest declaration, admission, grant, and mount records |
| `TraderSystemSpec / TraderSystemProgram` | hardened after audit | active docs now separate versioned system definition, executable behavior bundle, manifest, validation, and trace-linked artifacts |
| `OrderIntent/GatewayDecision` | correct | keep tool/computer/shell/provider output behind `ToolProxy` and `TradingGateway` |
| Bootstrap substrate | correct | keep provider execution disabled, but preserve provider/run/trace/memory refs |

## Completed Follow-Up Hardening

The audit originally identified five boundaries that had to be tightened before implementation
could depend on them. Those follow-up passes are now reflected in active architecture:

1. `RuntimeMemorySurface` now has explicit trust classes, access modes, influence refs, quarantine,
   and rollback rules.
2. Semantic activation was removed from active architecture; `RuntimeControl` and
   `RuntimeOperatingPolicy` now own lifecycle/governance while `TraderSystemProgram` owns internal
   behavior.
3. Evaluation now uses comparable run attribution and evidence sealing before promotion.
4. Provider feasibility now requires concrete probe/readiness records before a provider label is
   runnable.
5. `CapabilityPackage` now flows through manifest declaration, admission, grant, mount, and trace
   rather than granting its own permissions.

## Active Architecture Follow-Up Status

The audit itself stopped before changing `wiki/architecture/`, but subsequent hardening passes have
now promoted its highest-risk findings into active design.

The first follow-up hardening target was `RuntimeMemorySurface`, because rows 12, 36, 37, 44, and
the proactive research rows all showed that memory can improve autonomy while also becoming a hidden
poisoning, attribution, or evidence-confusion surface.

The active architecture follow-up promotes:

- memory trust classes
- memory access modes
- trace-backed memory influence refs
- trace-backed runtime memory write proposals
- quarantine and rollback rules

The second follow-up originally explored semantic activation. That model has since been retired
from active architecture because it made autokairos look like the backend scheduler for the trading
system. The corrected active architecture promotes:

- `RuntimeControl` as lifecycle/governance surface
- `RuntimeOperatingPolicy` as the operating envelope
- `TraderSystemProgram` as owner of internal behavior
- trace as the audit surface for internal timing, provider calls, memory influence, and tool/gateway
  effects

The audit follow-up has now promoted memory, runtime control, provider feasibility, evaluation
comparability, capability-package trust, and trader-system artifact identity into active
architecture. Remaining hardening should focus on final Bootstrap implementation readiness.

## Rejected Directions

The 1-51 reference set does not justify:

- turning autokairos into a generic enterprise agent platform
- making A2A the main runtime architecture
- treating ADK graph orchestration as the core runtime model
- making Codex, Claude, Gemini, or OpenClaw the product system of record
- treating provider memory as evidence
- letting shell/computer-use/tool access bypass trading gateway authority
- collapsing `ToolProxy` and `TradingGateway`
- letting workspace/cowork UX redefine the W2S trading thesis

## Audit Conclusion

The current active design is directionally correct.

The references do not require replacing `TraderSystemCandidate`, `TraderSystemRuntime`,
`RuntimeControl`, `RuntimePlacement`, provider-backed execution, or the
`OrderIntent -> GatewayDecision -> ExecutionAttempt` live-authority chain.

The strongest original gap was depth, not direction. Follow-up hardening has now promoted those
depth gaps into active rules:

- memory is governable through trust classes, access modes, influence refs, quarantine, and rollback
- runtime timing and action quality are evaluable through trace, program/provider events, and
  review/evaluation records
- evidence comparability and anti-gaming are protected by evaluation-run attribution and sealing
- provider feasibility is concrete through readiness/probe records before any label becomes runnable
- capability packages are bounded by manifest declaration, admission, grant, mount, and trace
- trader-system artifacts are bounded by spec, program, manifest, validation, and trace
