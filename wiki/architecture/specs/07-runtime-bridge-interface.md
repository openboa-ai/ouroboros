# Runtime Bridge Interface

## Purpose

This page defines the stable interface between the control plane and external or local execution
runtimes.

It is paired with
[../06-runtime-provider-adapter-feasibility.md](../06-runtime-provider-adapter-feasibility.md),
which turns provider names into concrete invocation surfaces.

## Thesis

The runtime bridge launches and supervises `TradingSystemPod` sessions.

It does not own candidate truth, evidence truth, promotion authority, or live execution authority.

The bridge also does not micromanage each agent reasoning step. It applies an `AgentLoopPolicy`
that bounds an autonomous agent loop.

## Bridge Input

The bridge accepts a governed pod launch request.

Minimum fields:

- `candidate_ref`
- `trading_system_image_ref`
- `capability_package_refs`
- `candidate_version_ref`
- `stage`
- `stage_binding_ref`
- `agent_runtime_units`
- `agent_loop_policy_ref`
- per-runtime-unit `runtime_unit_role`
- per-runtime-unit `provider_kind`
- per-runtime-unit invocation surface
- per-runtime-unit auth reference
- per-runtime-unit sandbox and working-directory policy
- per-runtime-unit output contract reference
- per-runtime-unit brain profile
- per-runtime-unit hands environment spec
- `tool_proxy_policy`
- `pod_communication_policy`
- `shared_context_surface_refs`
- `trace_destination`
- `timeout_policy`
- `interrupt_policy`

## Bridge Output

The bridge returns:

- `pod_session_ref`
- `brain_session_ref`
- `hands_environment_ref`
- `agent_runtime_unit_refs`
- `execution_handle`
- trace stream reference
- artifact export references
- completion status

## Required Operations

| Operation | Purpose |
| --- | --- |
| `probeDriver` | confirm the selected provider/container/external bridge is available |
| `resolveRuntimeProviderAdapter` | map concrete `provider_kind` to a callable adapter implementation |
| `resolveAgentLoopPolicy` | apply the loop envelope without turning the bridge into a step-by-step orchestrator |
| `prepareHandsEnvironment` | materialize tools, package files, mounts, and network policy |
| `prepareAgentRuntimeUnits` | resolve one or more brain/hands/session participants |
| `startPod` | launch a `TradingSystemPod` from image, packages, and binding |
| `routeAgentCommunication` | route task/message/artifact exchange according to the pod's communication policy |
| `attachOrResume` | reattach to a resumable brain/session when allowed |
| `streamTrace` | emit external trace events while the pod runs |
| `interruptPod` | pause or stop current execution |
| `exportArtifacts` | move outputs out of runtime-local storage |
| `teardown` | discard or checkpoint the hands environment |

## Concrete Provider Kinds

The bridge may support only provider kinds that map to a known invocation surface.

| `provider_kind` | Invocation surface | First use |
| --- | --- | --- |
| `codex_cli` | local subprocess via `codex exec` | first real local provider adapter |
| `codex_sdk_ts` | server-side TypeScript SDK | richer runtime integration after bootstrap |
| `codex_cloud` | Codex cloud task submission | later background engineering or artifact work |
| `claude_agent_sdk_python` | Python Claude Agent SDK | production-oriented Claude adapter |
| `claude_agent_sdk_ts` | TypeScript Claude Agent SDK | production-oriented Claude adapter |
| `claude_cli` | local Claude CLI prompt mode | prototype only when installed |
| `openclaw_acp` | ACP/OpenClaw bridge | later external harness sessions |
| `a2a_endpoint` | independent remote-agent endpoint | later communication participant |
| `local_process` | local internal process | fixtures or first-party runtime workers |

Driver choice must not change product truth. It must change only invocation mechanics.

## Provider Rule

Provider selection is per `AgentRuntimeUnit`, not per pod.

`runtime_unit_role` is separate from `provider_kind`.

Allowed initial roles are:

- `builder_agent`
- `evaluation_runner`
- `live_operator_agent`
- `critic_agent`
- `remote_specialist`

`runtime_unit_role` answers why the unit exists. `provider_kind` answers how it is invoked.

PR1 uses `builder_agent` with `codex_cli` and explicit `gpt-5.4` until feasibility evidence
changes.

PR3 requires `live_operator_agent`; a builder-agent adapter cannot be silently reused as a live
trading loop.

One pod may launch mixed participants:

| Runtime unit role | Example provider / driver |
| --- | --- |
| `builder_agent` | `codex_cli` or `codex_sdk_ts` |
| `evaluation_runner` | `local_process`, `claude_agent_sdk_python`, or evaluator service adapter |
| `live_operator_agent` | `local_process`, `claude_agent_sdk_ts`, or future managed-agent driver behind gateway policy |
| `critic_agent` | `claude_agent_sdk_python`, `codex_sdk_ts`, or local evaluator helper |
| `remote_specialist` | `a2a_endpoint` |

The runtime bridge may still choose a simple single-provider implementation for MLP-01, but the
interface must not make same-provider teams the only valid shape.

For first implementation, prefer `codex_cli` because it is locally available and can emit structured
output through a schema. Claude Agent SDK is the second serious adapter once dependency and API-key
setup are explicit.

## Multi-Agent Admission Rule

MLP-01 starts single-agent.

The runtime bridge may launch multiple `AgentRuntimeUnit` records only when a current PRD
acceptance criterion cannot be met by one runtime unit.

Admission requires:

- explicit `runtime_unit_role` for each unit
- one `PodCommunicationPolicy`
- `TeamTrace` export
- shared context declared as non-secret
- no communication path to live authority except `ToolProxy` / gateway

## Agent Loop Rule

`AgentLoopPolicy` is the active loop contract.

The bridge must support these loop modes:

| Loop mode | Meaning |
| --- | --- |
| `one_shot_builder` | run once and produce candidate materialization input |
| `bounded_batch_evaluation` | run until evaluation trace is complete, timeout, or failure |
| `continuous_live` | keep a promoted live pod active while heartbeat, limits, and gateway policy remain valid |

The policy defines trigger, cadence, timeout, cancellation, retry, resume, trace export, tool
posture, and stop conditions.

It must not define the agent's internal reasoning steps.

## Communication Rule

`PodCommunicationPolicy` is one unified policy over all runtime units.

It may allow:

- no inter-agent channel
- coordinator-routed provider-native threads
- A2A-compatible task/message/artifact exchange
- control-plane mediated messages
- shared read-only context surfaces

It may forbid:

- direct lateral messaging
- shared writeable context
- live-stage communication channels that bypass the gateway
- untraced artifact exchange

Communication outputs are trace inputs first. They do not become evidence, promotion, live
approval, or execution authority without the relevant autokairos subsystem.

## Tool Proxy Rule

The pod does not get unrestricted tool access.

For trading:

```text
BrainSession -> tool request / OrderIntent -> ToolProxy -> gateway/evaluator -> result event
```

The bridge must make custom tool requests traceable and must not treat tool success as counted
evidence.

## Credential Rule

Credentials are resolved through vault, binding, or gateway surfaces.

They are not stored in:

- `TradingSystemImage`
- `CapabilityPackage`
- provider prompt context
- container-visible package files
- shared context surfaces

## Truth Rule

Runtime-local state may help execution continue.

It must not be the only durable record of:

- candidate identity
- image/package refs
- binding used
- trace
- evidence
- promotion
- live execution
- wake/intervention
- multi-agent task/message/artifact exchange

## Acceptance Test

The runtime bridge is correct if an implementer can launch a pod without deciding:

- what the candidate means
- what evidence counts
- who owns live authority
- how self-evolution is promoted
- whether the run is a builder, evaluator, or live operator loop
- how the autonomous loop is bounded without central step orchestration

Those decisions belong above the bridge.
