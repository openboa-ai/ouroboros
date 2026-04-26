# TraderSystemCandidate Contract

## Purpose

This page defines the active candidate contract for autokairos.

## Thesis

The active meaning of `Candidate` is `TraderSystemCandidate`.

It is the durable, promotable trading-system candidate that can be evaluated and later run as a
bounded live runtime.

## PR1 Applicability

PR1 only needs the minimum shape that makes the candidate system real:

- durable candidate identity
- spec reference
- executable program reference when present
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
| `trader_system_spec_ref` | versioned system artifact |
| `trader_system_program_ref` | agent-authored executable behavior bundle associated with the spec, if present |
| `capability_package_refs` | context/tool/skill/data-access package refs |
| `agent_spec_refs` | one or more configured agent participants that define the intended runtime shape |
| `agent_session_refs` | one or more running agent participant refs when a runtime run has occurred |
| `runtime_communication_policy` | single-agent or future team/distributed communication mode |
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

## Relationship To Trader-System Spec And Packages

The candidate must reference:

- one `TraderSystemSpec`
- one optional `TraderSystemProgram` artifact when the candidate includes executable behavior
- one `ProgramManifest` and one `ProgramValidationRecord` for executable program artifacts once
  execution is possible
- one or more `CapabilityPackage` artifacts
- at least one `AgentSpec` and, after execution, an `AgentSession` placeholder or ref
- one `RuntimeCommunicationPolicy`

The candidate must not inline all context/tool details as unstructured prose. Package references are
part of the product contract because they enable reuse, audit, and future marketplace boundaries.

The candidate must also not reduce executable behavior to a human-authored strategy DSL. If there is
a `TraderSystemProgram`, it is an agent-authored executable artifact whose authority is limited by
sandbox, trace, evaluation, and gateway contracts.

The candidate must not treat program validation as promotion. `ProgramValidationRecord` only decides
whether a program is safe enough to mount or execute; it does not prove performance, counted
evidence, legitimacy, or live readiness.

The candidate also must not hide its agent-session shape. A single-agent candidate and a future
team-based candidate can share the same product model only if the agent-session boundary is
explicit.

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

If a runtime proposes changed program behavior, the result is a candidate-version proposal with a
new or revised `TraderSystemSpec` / `TraderSystemProgram` path. It must pass evaluation and
promotion again before becoming live authority.

## Operator-Visible Meaning

From the candidate record, the operator must be able to answer:

- what system is this?
- what trader-system spec/version represents it?
- what trader-system program/artifact represents its executable behavior?
- what packages does it use?
- does it have one agent session or multiple agent sessions?
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
