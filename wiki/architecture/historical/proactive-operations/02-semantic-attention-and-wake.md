# Semantic Attention And Wake

This page defines the active MLP-01 wake model.

## Thesis

autokairos should not model runtime activation as a closed event enum or handler table.

The active entrypoint is:

```text
wake(runtime_id, AttentionRequest)
```

`AttentionRequest` is a semantic packet that tells a `TraderSystemRuntime` why it should look again,
which context to inspect, what authority envelope applies, and where prior trace can be resumed.

## Why This Exists

The agent references converge on one rule: serious agent systems preserve rich context and then
bound authority at deterministic edges.

For autokairos this means:

- semantic context stays in `attention_text`, `observed_facts`, and `context_refs`
- the runtime decides whether to invoke a provider-backed agent, run `TraderSystemProgram`, request
  a tool, emit `OrderIntent`, produce `NextAttentionPlan`, wake the operator, or do nothing
- deterministic control lives at `ToolProxy`, `TradingGateway`, evaluator, credentials, trace, and
  audit boundaries

## Minimum `AttentionRequest`

The minimum active shape is:

| Field | Meaning |
| --- | --- |
| `attention_request_id` | durable activation identity |
| `runtime_ref` | target `TraderSystemRuntime` |
| `attention_text` | natural-language reason this runtime should look again |
| `observed_facts` | readable facts, not commands or handler selectors |
| `context_refs` | links to market snapshots, fills, risk reports, operator notes, errors, schedules, artifacts, or memory surfaces |
| `authority_envelope_ref` | deterministic boundary for allowed action classes |
| `trace_cursor_ref` | where runtime history should resume |
| `deadline_or_budget` | time, token, turn, or risk budget for this activation |
| `correlation_refs` | related signal, wake, trace, execution, or operator-action refs |
| `delivery_attempt` | delivery/retry metadata |
| `construction_provenance_ref` | why this attention was constructed and from which records |
| `pre_attention_context_ref` | context snapshot needed to evaluate whether this wake was timely and useful |
| `attention_intent` | semantic reason for attention, not handler route |
| `expected_decision_surface` | likely decision surface: no-op, tool, provider, program, order intent, operator wake, or next attention |
| `admission_status` | delivered, rejected, or deferred by control-plane policy |

## Attention Quality

Good attention is not "the right event enum."

Good attention means the runtime received enough safe semantic context to decide what to do without
hidden routing, missing critical facts, or unsafe authority.

Trace should preserve enough construction context to later classify attention as:

- useful
- noisy
- late
- missed
- unsafe

That later classification is `AttentionQualityReview`. It is not `EvidenceRecord` unless an
evaluation or review boundary seals it.

## `NextAttentionPlan`

`NextAttentionPlan` is how a runtime proposes that it should look again later.

It must include:

- proposed attention text
- context refs to re-check
- reason for next look
- deadline or budget
- authority envelope ref
- source trace ref

The runtime does not own the future schedule. The control plane validates the plan and either
accepts, rejects, or modifies it before producing a future `AttentionRequest`.

## Source-Derived Rules

- Anthropic Managed Agents and long-running harness references support session/event recovery rather
  than hidden process memory.
- OpenAI agent, sandbox, guardrail, observability, and eval references support traceable runs plus
  deterministic approval/eval boundaries.
- Google Agent Runtime, Memory Bank, Agent Gateway, and A2A references support separating runtime,
  memory, protocol, gateway, observability, and evaluation.
- Phil Schmid's agent-engineering warning supports preserving semantic context instead of collapsing
  work into route enums.

## What This Replaces

Older proactive material used trigger-taxonomy and scheduler-centric language. That material is now
historical unless a current active design explicitly promotes it.

The current baseline allows substrate or control-plane records to classify observations for storage,
inspection, dedupe, and audit. Those classifications are not runtime dispatch keys.

## Boundary Rules

- No active runtime design should route directly on canonical event-source enums.
- `SubstrateSignal` can record domain facts; it does not choose runtime behavior.
- `WakePolicy` can govern whether operator attention is warranted; it does not script runtime
  reasoning.
- `AttentionRequest` can point to `RuntimeMemorySurface`; memory remains context, not evidence.
- quarantined memory is excluded from default attention context.
- memory-influenced attention must preserve memory id, version, trust class, scope, and quarantine
  status in trace.
- `OperatorWakeRequest` and `WakeTriggerRecord` are product-facing wake/control records, not every
  internal runtime step.

## Acceptance Test

A reader should be able to explain:

- why `wake(runtime_id, AttentionRequest)` is the single conceptual runtime activation entrypoint
- why `attention_text` is more important than source enums
- why runtime autonomy remains inside `TraderSystemRuntime`
- where deterministic safety boundaries still exist
- how `NextAttentionPlan` stays a proposal instead of hidden scheduler truth
- how attention quality can later be reviewed from trace
- why memory, trace, and evidence remain separate
