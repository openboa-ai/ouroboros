# PR1 Design: Trader-System Candidate Becomes Real

## Goal

Answer:

**What system is this?**

PR1 proves one concrete provider-built trader system can become a durable, inspectable
`TraderSystemCandidate`.

## Canonical Flow

```text
codex_cli provider run with explicit gpt-5.4
-> AgentRun purpose = candidate_generation
-> AgentEvent stream / raw provider output
-> structured candidate proposal JSON
-> trace/artifact export
-> candidate materialization request
-> TraderSystemCandidate
-> TraderSystemSpec ref
-> CapabilityPackage refs
-> AgentSpec ref
-> AgentSession ref
-> RuntimeCommunicationPolicy
-> operator inspect surface
```

`codex_cli` is the default first real provider path because local `codex exec --model gpt-5.4`
produced schema-constrained output in smoke testing. Default `gpt-5.5` failed access in this
workspace. If PR1 uses another provider or model, it must first update
[06-runtime-provider-adapter-feasibility.md](06-runtime-provider-adapter-feasibility.md) with
prototype evidence.

## Ownership And Boundaries

- agent-system `RuntimeProviderAdapter` invokes the selected concrete provider
- `AgentSpec` defines the candidate-generation behavior and output contract
- first default `AgentSession.provider_kind = codex_cli`, `model=gpt-5.4`
- first default `AgentRun.purpose = candidate_generation`
- `AgentRun` may fail without creating a `TraderSystemCandidate`
- control-plane materializes durable candidate truth
- local store persists candidate/spec/package/agent-spec/agent-session/agent-run/agent-event refs
- operator web reads inspect models only

PR1 does not own:

- evidence
- promotion
- live binding
- wake/intervention

## Minimum Durable Shape

Use the PR1 subset from [specs/08-candidate-contract.md](specs/08-candidate-contract.md):

- `candidate_id`
- `candidate_kind`
- `created_at`
- `created_by_harness_ref`
- `materialized_from_provider_run_ref`
- `trader_system_spec_ref`
- `trader_system_program_ref`
- `capability_package_refs`
- `agent_spec_refs`
- `agent_session_refs`
- `runtime_communication_policy`
- `first_market_scope`
- `title`
- `system_summary`
- `candidate_status`
- `evaluation_handoff_ready`

## Operator Inspect Surface

The operator must see:

- what candidate system exists
- which trader-system spec represents it
- which executable program artifact represents its behavior, if present
- which capability packages it uses
- whether the candidate is currently single-agent or shaped for future team/distributed execution
- where it came from
- whether it can enter evaluation
- what is not yet proven

## Risks And Failure Modes

- candidate looks like a strategy note
- package assumptions are hidden in text
- provider session remains the only truth
- provider adapter is described by name but cannot actually be invoked
- provider output is not schema-constrained enough to materialize safely
- provider is unavailable
- requested model is inaccessible
- schema output is missing or invalid
- materialization rejects semantically unsafe output
- agent-to-agent output is treated as candidate truth without materialization
- candidate creation implies legitimacy

## Failure Outcomes

PR1 must preserve failure without creating a false candidate.

Allowed failure outcomes:

- `provider_unavailable`
- `model_inaccessible`
- `provider_failed`
- `schema_missing`
- `schema_invalid`
- `materialization_rejected`

When these happen:

- retain trace/events if available
- do not create a `TraderSystemCandidate`
- expose the failure reason through operator or developer inspect surfaces
- keep provider output as trace/artifact context only

## Production Readiness

PR1 is production-designed when one real provider run can safely attempt candidate creation without
letting provider output become durable truth by default.

### Lifecycle And Ownership

```text
probe provider
-> create provider run attempt
-> execute codex_cli with explicit gpt-5.4 and schema output
-> capture AgentEvents / raw provider output
-> retain trace/artifacts
-> validate schema
-> validate materialization semantics
-> create or reject TraderSystemCandidate
-> expose inspect result
```

- agent-system owns provider probing, invocation, and trace/artifact export
- control-plane owns materialization acceptance and durable candidate creation
- local-store owns persistence
- operator-web reads inspect state only

### Durable Truth And Schema Boundary

- provider output is proposal input, not candidate truth
- candidate truth begins only after schema validation and materialization acceptance
- materialized candidate must link to provider run attempt, trace/artifact refs, spec refs,
  package refs, agent-spec/agent-session refs, and communication policy
- schema-valid JSON is still not evaluation legitimacy

### Validation And Rejection

PR1 must validate:

- provider availability and model access
- schema output presence
- required candidate fields
- first market scope
- package manifest refs and forbidden contents
- session-purpose/provider separation
- no evidence, promotion, live binding, wake, or direct exchange authority fields

Rejection outcomes must remain inspectable and must not create a candidate.

### Idempotency And Retry

- retrying a failed provider run creates or links a new provider run attempt
- retry must not mutate a rejected attempt into a successful candidate without chronology
- materialization should use a deterministic idempotency key from provider run attempt plus output
  artifact hash where practical
- duplicate candidate creation should be rejected or linked as an already-materialized result

### Recovery And Restart

- trace/artifact refs must survive runtime restart
- a provider run that failed before schema output remains a failed run, not a partial candidate
- a materialization crash must recover to either no candidate or exactly one durable candidate for
  the accepted attempt

### Security, Observability, And Operator Inspectability

- provider auth refs stay outside candidate records
- candidate package refs must not include secrets
- operator/developer inspect surface must show provider kind, model, run attempt, validation
  outcome, and why candidate creation did or did not happen

## Test And Acceptance Criteria

- one durable candidate exists after runtime restart
- no candidate is created when provider output is missing, invalid, or rejected
- first real provider materialization can explain command/API invocation, output schema, trace, and
  artifact export path
- spec/package/agent-spec/agent-session refs are inspectable
- candidate can be handed to PR2 without reauthoring
- no evidence/promotion/live meaning appears

## Explicitly Deferred

- backtest evaluator
- counted evidence
- live gate
- live runtime
- operator intervention
- real A2A networking
- marketplace packaging
