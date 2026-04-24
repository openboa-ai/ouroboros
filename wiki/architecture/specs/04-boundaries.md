# Boundaries

## Purpose

This page defines the separations autokairos must preserve after the trader-system pod reset.

## Thesis

The architecture fails if it collapses unlike things:

- candidate system vs one run
- image vs pod
- capability package vs credential
- stage vs binding
- agent runtime unit vs pod
- runtime unit role vs provider kind
- agent loop policy vs central workflow engine
- agent-to-agent communication vs evidence
- brain session vs durable truth
- trace vs evidence
- order intent vs real execution
- gateway decision vs venue result

## Boundary Matrix

| Boundary | Must not collapse because |
| --- | --- |
| `TraderSystemCandidate` vs `TradingSystemImage` | candidate standing changes while image versions are artifacts |
| `TradingSystemImage` vs `TradingSystemPod` | the same image can run under many bindings |
| `CapabilityPackage` vs credentials/secrets | packages may be shared; secrets must not be packaged |
| `Stage` vs `StageBinding` | product legitimacy differs from concrete environment injection |
| `AgentRuntimeUnit` vs `TradingSystemPod` | a pod may contain one or many agent participants, but the pod remains the stage-bound execution instance |
| `runtime_unit_role` vs `provider_kind` | role defines why a unit exists; provider kind defines how it is invoked |
| `AgentLoopPolicy` vs central workflow engine | policy bounds an autonomous loop; it does not direct every agent reasoning step |
| `A2AAgentEndpoint` vs `CapabilityPackage` | a remote agent endpoint is not a packaged tool/context artifact |
| `A2ATaskRecord` / `A2AArtifact` vs `EvidenceRecord` | agent communication output is not judged evidence |
| `agent-to-agent message` vs live execution authority | collaboration does not grant exchange authority |
| `SharedContextSurface` vs secrets | shared context can be mounted or communicated; secrets must remain in vault/binding/gateway layers |
| `BrainSession` vs durable event log | provider context is not autokairos truth |
| `HandsEnvironment` vs control plane | tools/sandboxes do not own governance |
| `Trace` vs `EvidenceRecord` | history is not judgment |
| `custom tool result` vs counted evidence | tool output may inform evaluation but does not count automatically |
| `outcome/rubric result` vs legitimate trading evidence | artifact quality checks are not trading performance evidence |
| `OrderIntent` vs exchange execution | agent proposal is not authority to trade |
| `GatewayDecision` vs venue result | gateway acceptance is not the same as a successful exchange fill |
| `CandidateVersion` vs live mutation | self-evolution must be clone/evaluate/promote |

## Candidate Identity Boundary

`TraderSystemCandidate` is the promotable system under judgment.

It is not:

- a strategy note
- a chat transcript
- an agent identity
- a provider session
- one execution attempt

## Image / Pod Boundary

`TradingSystemImage` is the versioned artifact.

`TradingSystemPod` is an execution instance assembled from image, packages, binding, brain session,
hands environment, and tool proxy.

If a live run requires rewriting the image into a different object, progression meaning is broken.

## Capability / Secret Boundary

`CapabilityPackage` may contain:

- tool contracts
- context
- skills
- data access requirements
- compatibility metadata

It must not contain:

- API keys
- exchange credentials
- evaluator secrets
- privileged live gateway tokens

Secrets are injected through vault, binding, or gateway layers.

## Stage / Binding Boundary

`Stage` answers product legitimacy:

- backtest
- paper
- live

`StageBinding` answers operational injection:

- data source
- clock
- evaluator
- exchange adapter
- risk envelope
- tool proxy
- credential policy

Each active binding should use one typed profile:

- `BacktestBindingProfile`
- `PaperBindingProfile`
- `LiveBindingProfile`

## Agent Runtime Unit / Pod Boundary

`AgentRuntimeUnit` is one agent participant.

`TradingSystemPod` is the whole execution instance of the trader-system candidate under one
binding.

This matters because a trader-system candidate may be:

- single-agent
- provider-native managed team
- A2A-compatible distributed team

The candidate and pod cannot collapse into any one participant's provider session, prompt, thread,
or remote endpoint.

`runtime_unit_role` and `provider_kind` must also remain separate.

Examples:

- `builder_agent` can run through `codex_cli`
- `live_operator_agent` may later run through a different provider
- `remote_specialist` can use `a2a_endpoint`

Changing provider does not change role. Changing role changes the product meaning of the runtime
unit.

## Agent Loop Policy Boundary

`AgentLoopPolicy` bounds an autonomous agent loop.

It may define trigger, cadence, timeout, cancellation, retry, resume, trace export, tool posture,
and stop conditions.

It must not become a central workflow engine that tells the agent every reasoning step.

## A2A / Evidence Boundary

A2A-compatible tasks, messages, and artifacts are communication records.

They may become:

- trace events
- artifact references
- candidate materialization inputs
- evaluator inputs

They are not automatically:

- counted evidence
- promotion decisions
- live gate approval
- exchange execution authority

Only the autokairos evaluation path can seal an A2A artifact into an `EvidenceRecord`.

## Agent Card / Capability Package Boundary

An `AgentCard`-like endpoint description tells autokairos what a remote agent says it can do.

A `CapabilityPackage` is a versioned context/tool/skill/data-access artifact that autokairos can
package, inspect, and eventually exchange.

The two may reference each other, but they are not the same object.

## Shared Context / Secret Boundary

Multi-agent pods may use `SharedContextSurface` for:

- market context
- task instructions
- package files
- read-only reference material
- shared artifacts

They must not use shared context for:

- exchange credentials
- evaluator secrets
- gateway signing keys
- privileged live tokens

## Brain / Hands / Session Boundary

Claude Managed Agents makes this boundary explicit:

- brain: model plus harness loop
- hands: tools, sandbox, containers, gateways
- session: durable event history

autokairos translates that into:

- `BrainSession`
- `HandsEnvironment`
- external `Trace` / control-plane records

The provider session may be useful, but it is not the autokairos system of record.

## Trace / Evidence Boundary

`Trace` records what happened.

`EvidenceRecord` records what was judged and whether it counted.

No trace, tool result, outcome result, or agent report becomes evidence without evaluator
adjudication.

## Live Authority Boundary

Live agent authority stops at `OrderIntent`.

Real execution requires:

```text
OrderIntent -> risk gateway -> GatewayDecision -> exchange request when accepted -> ExecutionAttempt
```

The agent harness must not hold unrestricted exchange credentials.

Rejected and clipped gateway decisions remain durable product records.

## Self-Evolution Boundary

The live pod may propose improvement.

It may not mutate itself in place.

Valid flow:

```text
proposal -> CandidateVersion -> backtest binding -> evidence -> promotion
```

## Acceptance Test

This boundary spec is correct if a reader can explain:

- why candidate is not image
- why image is not pod
- why packages do not carry secrets
- why stage is not binding
- why one agent runtime unit is not the whole pod
- why A2A messages and artifacts are not counted evidence
- why custom tool results are not counted evidence
- why order intent is not execution
- why self-evolution is versioned
