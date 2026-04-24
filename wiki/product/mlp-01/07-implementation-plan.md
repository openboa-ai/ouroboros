# MLP-01 Implementation Plan

This page is the canonical implementation entry point for MLP-01.

## Goal

Build one believable delegated trader-system pod in the same order the operator must learn to trust
it.

The implementation contract is:

```text
TraderSystemCandidate
-> TradingSystemImage + CapabilityPackage
-> StageBinding run
-> external evidence
-> promotion decision
-> bounded live TradingSystemPod
-> wake/intervention/audit
```

Old subsystem-level implementation plans are background only.

## Build Order

The build order is fixed.

### 0. Bootstrap Substrate

Create the minimal code substrate for:

- candidate/image/package durable records
- capability package manifest records
- agent loop policy references
- local store
- operator inspect surface
- runtime provider adapter seam
- trace/evaluator seam

This is plumbing-first because the repo is a docs-only reset baseline.

Bootstrap may keep provider execution as a seam, but PR1 cannot treat "Codex" or "Claude" as a
complete implementation plan. Real provider work must follow
[../../architecture/06-runtime-provider-adapter-feasibility.md](../../architecture/06-runtime-provider-adapter-feasibility.md).

### 1. Slice 1: Trader-System Candidate Becomes Real

Prove:

- one candidate system is durable
- image and capability package references are inspectable
- one `builder_agent` runtime unit can be selected without implying live-agent semantics
- provider output is not the system of record
- failed provider/schema/materialization runs are inspectable without creating a false candidate

### 2. Slice 2: Candidate Becomes Externally Evaluated

Prove:

- same candidate artifact runs under evaluation binding
- evaluation uses a `bounded_batch_evaluation` loop policy
- trace is externalized
- evidence is judged outside the pod
- live gate meaning is evidence-backed

### 3. Slice 3: One Candidate Runs As Bounded Live Trader-System Pod

Prove:

- promoted candidate runs under live binding
- live runtime uses a `live_operator_agent` role and `continuous_live` loop policy
- agent can produce `OrderIntent`
- autokairos gateway turns every order intent into durable `GatewayDecision`
- `ExecutionAttempt` links gateway decisions, not just provider status
- live status is inspectable

### 4. Slice 4: Live Pod Remains Controllable

Prove:

- wake reason is meaningful
- operator can inspect, pause, stop, override
- action history is auditable
- self-evolution creates candidate versions for re-evaluation

## Interfaces To Define First

| Interface / object | Why it must exist first |
| --- | --- |
| `TraderSystemCandidate` | promotable candidate trading system |
| `TradingSystemImage` | stable versioned system artifact |
| `CapabilityPackage` | packageable context/tool/skill/data-access artifact |
| `CapabilityPackageManifest` | declared provenance, permissions, allowed stages, tool/data access, and forbidden contents for package injection |
| `StageBinding` | backtest/paper/live execution semantics |
| `BacktestBindingProfile` / `PaperBindingProfile` / `LiveBindingProfile` | typed binding profiles so stage injection is not an untyped bag of values |
| `TradingSystemPod` | stage-bound execution instance |
| `AgentRuntimeUnit` | one agent participant and its selected provider/driver inside or beside the pod |
| `runtime_unit_role` | why a runtime unit exists: `builder_agent`, `evaluation_runner`, `live_operator_agent`, `critic_agent`, or `remote_specialist` |
| `AgentLoopPolicy` | autonomy envelope for one-shot builder, bounded evaluation, and continuous live loops without central workflow orchestration |
| `BrainSession` | provider/harness reasoning session |
| `HandsEnvironment` | tools, sandbox, data, gateway, and side-effect surface |
| `ToolProxy` | authority boundary around tools and credentials |
| `PodCommunicationPolicy` | unified provider-neutral policy for agent-to-agent routing, sharing, artifact export, and isolation |
| `TeamTrace` | durable multi-agent task/message/artifact trace when more than one runtime unit participates |
| `Trace` | external raw execution record |
| `EvidenceRecord` | externally judged evidence |
| `PromotionDecision` | governance decision for stronger binding |
| `OrderIntent` | live-agent proposal for a trade; never direct exchange execution authority |
| `GatewayDecision` | durable accepted/rejected/clipped gateway judgment for an order intent |
| `ExecutionAttempt` | durable live execution record |
| `WakeTriggerRecord` | durable wake reason and outcome |

Role and provider are separate contracts:

- `runtime_unit_role` answers why the unit exists.
- `provider_kind` answers how the unit runs.
- PR1 defaults to `runtime_unit_role=builder_agent`, `provider_kind=codex_cli`, `model=gpt-5.4`.
- PR3 must introduce `runtime_unit_role=live_operator_agent`; it cannot reuse PR1 builder-agent
  execution semantics.

The first concrete provider adapter sequence is:

1. `codex_cli` through local `codex exec --model gpt-5.4`
2. `claude_agent_sdk_python` or `claude_agent_sdk_ts`
3. `codex_sdk_ts`
4. `openclaw_acp`
5. `a2a_endpoint`
6. `codex_cloud`

This order may change only with prototype evidence. It prevents implementation from becoming a
generic provider abstraction before a real provider can run.

Current local evidence:

- default `gpt-5.5` access failed in the current environment
- explicit `gpt-5.4` schema-output smoke succeeded
- Bootstrap and PR1 must therefore probe model access and use `codex_cli + gpt-5.4 + schema
  output` until new evidence changes the default

## Delivery Sequence

1. Bootstrap PR: minimal app/runtime/store/domain substrate for candidate/image/package inspection.
2. PR1: materialize and inspect one `TraderSystemCandidate` from a `builder_agent` provider run.
3. PR2: run one candidate through evaluation binding and produce externally judged evidence.
4. PR3: launch one promoted candidate as bounded live pod through
   `OrderIntent -> GatewayDecision -> ExecutionAttempt`.
5. PR4: add wake/intervention/audit and clone-based self-evolution.

## PR Rules

- one PR should close one visible trust proof where possible
- bootstrap is the only planned plumbing-first exception
- do not broaden venue scope
- do not implement full marketplace
- do not give agent harness direct exchange authority
- do not mutate live systems in place
- do not add multi-agent pod behavior unless a PRD acceptance criterion cannot be met by one
  runtime unit
- do not let provider output create a candidate unless schema validation and materialization rules
  pass

## Explicitly Deferred

- full marketplace
- full Kubernetes clone
- dynamic multi-level agent scheduling
- full A2A mesh or remote-agent marketplace
- venue breadth
- remote execution fleets
- direct Claude Managed Agents dependency as the only harness path
- PR3 trading APIs during Bootstrap/PR1
- PR4 wake/control APIs during Bootstrap/PR1

## Acceptance Criteria

This plan is correct if a reader can explain:

- what gets built first
- why candidate means trader-system
- how image/package/binding/pod fit together
- why role and provider are separate
- how agent loops stay autonomous without becoming a central workflow engine
- why evaluation precedes live
- why gateway authority bounds live agents through `OrderIntent -> GatewayDecision`
- why self-evolution is versioned

## Read Next

1. [08-greenfield-bootstrap-plan.md](08-greenfield-bootstrap-plan.md)
2. [../../architecture/05-bootstrap-tech-spec.md](../../architecture/05-bootstrap-tech-spec.md)
3. [../../architecture/06-runtime-provider-adapter-feasibility.md](../../architecture/06-runtime-provider-adapter-feasibility.md)
4. [../../architecture/01-pr1-trader-system-candidate-becomes-real-design.md](../../architecture/01-pr1-trader-system-candidate-becomes-real-design.md)
