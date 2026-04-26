# Boundaries

## Purpose

This page defines the separations autokairos must preserve after the runtime-control reset.

## Thesis

The architecture fails if it collapses unlike things:

- control plane vs trader-system author
- runtime control vs internal trading behavior
- trader-system spec vs runtime
- runtime vs physical placement
- trader-system program vs sandbox authority
- capability declaration vs permission grant
- provider output vs evidence
- memory surface vs evidence
- trace vs evidence
- evidence sealing vs promotion
- order intent vs real execution
- gateway decision vs venue result

## Boundary Matrix

| Boundary | Must not collapse because |
| --- | --- |
| autokairos vs trader-system author | external agents create/update trader-system logic; autokairos operates and governs it |
| `RuntimeControl` vs internal strategy loop | lifecycle commands must not become central workflow/FSM orchestration |
| `TraderSystemCandidate` vs `TraderSystemSpec` | candidate standing changes while spec versions are artifacts |
| `TraderSystemSpec` vs `TraderSystemRuntime` | the same trader-system definition can run under many bindings |
| `TraderSystemRuntime` vs `RuntimePlacement` | runtime identity must survive process/container/provider failure |
| `TraderSystemProgram` vs human-authored strategy DSL | agent-authored behavior must stay open-ended or W2S collapses back into weak-human templates |
| `TraderSystemProgram` vs `HandsEnvironment` | the program can run inside the sandbox, but the sandbox does not own program identity or truth |
| `CapabilityPackage` vs credentials/secrets | packages may be shared; secrets must not be packaged |
| `CapabilityManifest` vs `CapabilityGrant` | package declarations request access; stage/tool/vault/gateway surfaces grant it |
| `CapabilityPackage` vs evaluator ground truth | packages cannot contain hidden labels, benchmark answers, or scoring ground truth |
| `CapabilityPackage` vs live authority | packages cannot contain live approval, gateway signing material, or exchange credentials |
| `CapabilityMountRecord` vs `EvidenceRecord` | mounted package content can influence behavior but is not judged evidence |
| `Stage` vs `StageBinding` | product legitimacy differs from concrete environment injection |
| harness vs compute | model/harness loops and sandbox execution can restart or be replaced independently |
| `AgentSession` vs `TraderSystemRuntime` | a runtime may contain running agent participants, but the runtime remains the deployed system |
| `AgentRun.purpose` vs `provider_kind` | purpose defines why one invocation exists; provider kind defines how the session is invoked |
| `RuntimeOperatingPolicy` vs central workflow engine | policy bounds lifecycle and governance; it does not direct every trader-system step |
| A2A endpoint vs tool/resource access | A2A is remote agent communication; MCP/tool proxy is tool/resource access |
| `A2ATaskRecord` / `A2AArtifact` vs `EvidenceRecord` | agent communication output is not judged evidence |
| shared context vs secrets | shared context can be mounted or communicated; secrets remain in vault/binding/gateway layers |
| `RuntimeMemorySurface` vs `EvidenceRecord` | memory is scoped context; only evaluator sealing creates evidence |
| `RuntimeMemorySurface` vs live authority | memory may influence reasoning but cannot contain live approval or exchange authority |
| provider-private memory vs durable truth | provider memory may help execution but cannot be the only recoverable record |
| `BrainSession` vs durable event log | provider context is not autokairos truth |
| `HandsEnvironment` / sandbox compute vs durable event log | container state is replaceable and cannot be the only session truth |
| `Trace` vs `EvidenceRecord` | history is not judgment |
| `EvaluationRunRecord` vs `EvidenceRecord` | evaluator output records what was inspected; sealing decides what counts |
| `EvidenceSealingDecision` vs `PromotionDecision` | sealing creates citeable evidence; promotion changes candidate standing |
| custom tool result vs counted evidence | tool output may inform evaluation but does not count automatically |
| operator satisfaction vs objective evidence | satisfaction may inform review but can hide worse objective outcomes |
| `OrderIntent` vs exchange execution | trader-system proposal is not authority to trade |
| `GatewayDecision` vs venue result | gateway acceptance is not the same as successful exchange fill |
| `CandidateVersion` vs live mutation | self-evolution must be clone/evaluate/promote |

## Control Plane / Trader-System Boundary

autokairos is the control plane for agent-built trader systems.

It owns:

- artifact registration
- deployment and runtime lifecycle
- runtime placement records
- trace/audit requirements
- capability admission/grant/mount boundaries
- tool and credential boundaries
- gateway authority
- evaluation, evidence sealing, and promotion

It does not own:

- internal trading behavior
- every market reaction
- when the program calls a provider-backed agent
- provider-native hidden state
- direct strategy generation inside live runtime

## RuntimeControl Boundary

`RuntimeControl` can register, deploy, start, pause, resume, stop, inspect, override, or kill a
runtime.

It cannot:

- decide every internal program step
- become a finite-state strategy engine
- route market/fill/risk facts to handler functions
- grant live execution directly
- produce evidence or promotion

## TraderSystemProgram Boundary

`TraderSystemProgram` is the agent-authored executable behavior bundle referenced by
`TraderSystemSpec`.

It may contain arbitrary executable logic inside the allowed hands environment, including generated
scripts, local planners, indicators, provider calls, and internal state files.

Allowed outward outputs are narrow:

- `ProgramEvent`
- `AgentRun` / `AgentEvent`
- `ToolRequest`
- `OrderIntent`
- trace fragments
- diagnostic artifacts
- review requests
- metric snapshots
- candidate-version proposals

Anything outside those contracts is rejected or treated as untrusted artifact data.

## Capability / Secret Boundary

`CapabilityPackage` may contain tool contracts, context, skills, data access requirements, and
compatibility metadata.

It must not contain API keys, exchange credentials, evaluator secrets, evaluator hidden labels,
benchmark answers, scoring ground truth, live approval state, gateway signing material, undeclared
network endpoints, hidden self-promotion instructions, policy-bypass prompts, or privileged gateway
tokens.

Secrets are injected only through vault, binding, proxy, or gateway layers.

## Stage / Binding Boundary

`Stage` answers product legitimacy: backtest, paper, or live.

`StageBinding` answers operational injection: data source, clock, evaluator, simulator/exchange,
risk envelope, tool proxy, and credential policy.

Same artifact, different binding.

## Provider Boundary

`AgentSession` and provider sessions are execution continuity surfaces, not product truth.

Provider output becomes:

```text
AgentEvent -> Trace
```

It does not directly become evidence, promotion, gateway decision, execution attempt, or audit truth.

## Trace / Evidence Boundary

The active evidence chain is:

```text
Trace
-> EvaluationRunRecord
-> EvaluationComparisonSet
-> EvidenceSealingDecision
-> EvidenceRecord
-> PromotionDecision
```

No provider output, program output, tool result, package artifact, memory summary, or operator
satisfaction counts without evidence sealing.

## Live Authority Boundary

The live authority chain is:

```text
TraderSystemProgram or AgentSession
-> OrderIntent
-> TradingGateway
-> GatewayDecision
-> ExecutionAttempt
```

The trader system proposes. The gateway decides. The venue result is linked later.

## Deferred Operator Notification

Operator notification is intentionally not part of the current active runtime primitive set.

If later work needs proactive human notification, it should be designed as `OperatorAlertPolicy` and
`OperatorAlertRecord` around operator attention and audit. It must not reintroduce runtime
activation or internal trader-system scheduling.
