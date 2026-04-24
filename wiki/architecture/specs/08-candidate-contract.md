# TraderSystemCandidate Contract

## Purpose

This page defines the active candidate contract for autokairos.

## Thesis

The active meaning of `Candidate` is `TraderSystemCandidate`.

It is the durable, promotable trading-system candidate that can be evaluated and later run as a
bounded live pod.

## PR1 Applicability

PR1 only needs the minimum shape that makes the candidate system real:

- durable candidate identity
- image reference
- capability package references
- agent runtime shape reference
- provenance
- current status
- evaluation handoff readiness

PR1 does not need evidence, promotion, live execution, or wake records.

## Minimum Durable Shape

| Field | Meaning |
| --- | --- |
| `candidate_id` | stable durable identity |
| `candidate_kind` | must be `trader_system` for the active MLP |
| `created_at` | when control plane materialized the candidate |
| `created_by_harness_ref` | provider/harness provenance, including concrete `provider_kind` and provider run reference when available |
| `trading_system_image_ref` | versioned system artifact |
| `capability_package_refs` | context/tool/skill/data-access package refs |
| `agent_runtime_unit_refs` | one or more agent participants that define the current pod shape |
| `pod_communication_policy` | single-agent or future team/distributed communication mode |
| `first_market_scope` | Binance BTC perpetual futures for MLP-01 |
| `title` | short operator-facing label |
| `system_summary` | what the candidate system is intended to do |
| `candidate_status` | PR1 status |
| `evaluation_handoff_ready` | whether it can enter PRD 2 without reauthoring |

## PR1 Status Values

- `materialized`
- `handoff_ready`
- `archived`

These values do not imply:

- counted evidence
- legitimacy
- promotion eligibility
- live approval
- live operation

## Relationship To Image And Packages

The candidate must reference:

- one `TradingSystemImage`
- one or more `CapabilityPackage` artifacts
- at least one `AgentRuntimeUnit` or equivalent runtime-unit placeholder
- one `PodCommunicationPolicy`

The candidate must not inline all context/tool details as unstructured prose. Package references are
part of the product contract because they enable reuse, audit, and future marketplace boundaries.

The candidate also must not hide its agent runtime shape. A single-agent candidate and a future
team-based candidate can share the same product model only if the runtime-unit boundary is explicit.

When a real provider creates the candidate, provenance must be concrete enough to answer:

- which `provider_kind` ran
- which command, SDK call, or endpoint invocation was used
- where trace and artifacts were exported
- which output contract produced the materialization input

For MLP-01, the first real provider provenance should normally be `codex_cli` unless prototype
evidence updates the runtime-provider feasibility page.

## Relationship To Runs

The same candidate can have many runs:

- backtest binding runs
- paper binding runs
- live binding runs
- clone/evaluation runs for candidate versions

Runs do not redefine candidate identity.

## Relationship To Self-Evolution

Self-evolution creates a `CandidateVersion`.

The live candidate is not patched in place.

## Operator-Visible Meaning

From the candidate record, the operator must be able to answer:

- what system is this?
- what image/version represents it?
- what packages does it use?
- does it have one runtime unit or multiple runtime units?
- where did it come from?
- is it ready for evaluation?
- what is not yet proven?

## Not Required By PR1

- trace links
- evidence links
- promotion links
- live deployment links
- wake/action history
- marketplace licensing terms
- full multi-agent team graph
- real A2A endpoint wiring

Later slices may add those associations without changing what made the candidate real.

## Acceptance Test

The contract is correct if an implementer cannot mistake the candidate for:

- a strategy note
- a brain session
- a hands environment
- a provider thread
- one backtest result
