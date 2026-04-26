# Runtime Provider Adapter Feasibility

## Purpose

This page turns provider names on `AgentSession` records into actual callable surfaces.

It exists because a runtime design is not implementation-grade unless autokairos knows how it would
invoke Codex, Claude, or another harness and how provider output becomes traceable product input.

## Current Feasibility Verdict

Provider names are not runnable by themselves. A provider becomes runnable only through a concrete
`ProviderReadinessRecord` produced by `RuntimeProviderAdapter.probe()`.

Readiness status values:

| Status | Meaning |
| --- | --- |
| `active_verified` | Current environment evidence shows the provider surface can run with the required output and trace posture. |
| `candidate_unverified` | Official or plausible provider surface exists, but this repo has not verified install, auth, model access, output contract, and trace export. |
| `future_bridge` | Useful later as an external bridge or remote participant, but not an immediate local runtime surface. |
| `blocked_or_not_installed` | The provider cannot be used in this workspace until installation/auth/environment setup changes. |
| `reference_only` | Source reference informs design, but is not an executable autokairos provider surface. |

| Provider / surface | `provider_kind` | Readiness | Allowed first use | Hard limitation |
| --- | --- | --- | --- | --- |
| Codex CLI `codex exec` | `codex_cli` | `active_verified` with explicit `--model gpt-5.4` and schema output | first local candidate-generation provider | subprocess control; default `gpt-5.5` failed access in this workspace |
| Codex SDK `@openai/codex-sdk` | `codex_sdk_ts` | `candidate_unverified` | later richer Node/runtime integration | SDK dependency, auth, thread behavior, output contract, and trace export must be probed |
| Codex Cloud `codex cloud exec` | `codex_cloud` | `future_bridge` | later background artifact/code work | requires cloud environment and repo setup; not first trading runtime |
| Claude Agent SDK Python | `claude_agent_sdk_python` | `candidate_unverified` | second serious provider path after live source refresh and auth/probe | not installed locally yet; requires Anthropic API key and SDK event/export probe |
| Claude Agent SDK TypeScript | `claude_agent_sdk_ts` | `candidate_unverified` | second serious provider path after live source refresh and auth/probe | not installed locally yet; requires Anthropic API key and SDK event/export probe |
| Claude CLI `claude -p` | `claude_cli` | `blocked_or_not_installed` | prototype only | not installed in this workspace; weaker contract than SDK |
| OpenClaw / ACP | `openclaw_acp` | `future_bridge` | later external harness bridge | not a control-plane replacement; requires ACP/OpenClaw setup |
| A2A endpoint | `a2a_endpoint` | `future_bridge` | later remote-agent communication participant | communication only; not tool access, evidence, promotion, or live authority |
| Local process | `local_process` | `candidate_unverified` | fixtures or first-party workers | cannot bypass adapter semantics, trace, permission, or output contracts |

Local check on `2026-04-24`:

- `codex` exists at `/opt/homebrew/bin/codex`
- `codex --version` reports `codex-cli 0.120.0`
- `claude` is not currently available on `PATH`
- default model `gpt-5.5` failed access in a schema-output smoke test
- explicit `--model gpt-5.4` succeeded with `--json` and `--output-schema`

## Source Facts That Matter

### Codex

Official Codex docs expose three practical invocation surfaces.

1. `codex exec`
   The official non-interactive mode runs Codex from scripts and CI without opening the TUI.
   It supports JSONL events, output schemas, sandbox settings, and final-message output files.

2. `@openai/codex-sdk`
   The official TypeScript SDK starts and resumes Codex threads from server-side Node code.
   The Python SDK is described as experimental and controls the local Codex app-server.

3. `codex cloud exec`
   The local CLI exposes experimental cloud task submission with `--env`, `--branch`, and
   `--attempts`. This depends on Codex Cloud environment configuration.

Useful source pages:

- [Codex non-interactive mode](https://developers.openai.com/codex/noninteractive)
- [Codex SDK](https://developers.openai.com/codex/sdk)
- [Codex cloud](https://developers.openai.com/codex/cloud)

### Claude

The latest official Anthropic docs say the Claude Code SDK has been renamed to the Claude Agent
SDK.

The Agent SDK provides Python and TypeScript APIs for running the same file, command, MCP,
permission, session, hook, and subagent capabilities that power Claude Code.

Important details:

- install with `pip install claude-agent-sdk` or `npm install @anthropic-ai/claude-agent-sdk`
- authenticate with `ANTHROPIC_API_KEY`
- built-in tools include file reads/writes, edits, bash, grep/glob, web search/fetch, and more
- hooks can log, block, or transform behavior
- subagents are available through SDK agent definitions
- session ids can be captured and resumed
- Anthropic says product integrations should use API-key auth, not offer claude.ai login/rate
  limits unless separately approved

Useful source page:

- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)

## Provider Readiness Records

`ProviderReadinessRecord` is the control-plane record that makes a provider label usable.

Minimum shape:

```text
provider_readiness_record_id
provider_kind
invocation_surface
readiness_status
checked_at
version
auth_state
model_access
sandbox_posture
tool_access_posture
output_contract_support
schema_output_smoke
trace_export_support
artifact_export_support
cancel_support
resume_support
known_failure_reasons
allowed_first_use
source_refs
```

Readiness records expire operationally. Before a real adapter implementation depends on Claude,
OpenAI SDK, Codex Cloud, OpenClaw/ACP, or A2A behavior, the relevant official docs and repository
surface must be live-reread and a fresh probe must be recorded.

`ProviderProbeAttempt` is one attempted verification run behind a readiness record.

Minimum shape:

```text
provider_probe_attempt_id
provider_kind
invocation_surface
command_or_api_surface
model
expected_output_contract
result
failure_reason
sandbox_posture
tool_access_posture
trace_ref
artifact_refs
checked_at
```

Standard failure reasons:

- `provider_unavailable`
- `auth_missing`
- `model_inaccessible`
- `schema_output_failed`
- `trace_export_missing`
- `sandbox_unsupported`
- `tool_policy_unknown`
- `artifact_export_failed`
- `cancel_unsupported`
- `resume_unsupported`

Provider readiness is not product authority. Even an `active_verified` provider can only emit
`AgentEvent -> Trace`. It cannot directly create evidence, promotion, live execution, or durable
runtime truth.

Current recorded readiness:

```text
provider_kind = codex_cli
invocation_surface = local subprocess via codex exec
readiness_status = active_verified
model = gpt-5.4
allowed_first_use = candidate_generation
output_contract_support = --output-schema
trace_export_support = --json event stream
known_failure_reasons = default gpt-5.5 model access failed in this workspace
```

## Provider Adapter Model

`AgentSession.provider_kind` should be concrete, not aspirational.

`AgentRun.purpose` must be separate from `provider_kind`.

`AgentRun.purpose` is slice-local. It answers why one invocation exists for the current slice, but it is
not a global role enum.

PR1 may use `AgentRun.purpose = candidate_generation`. Future purposes must be introduced by the slice
design that needs them.

`provider_kind` answers how the session runs.

Recommended enum:

```text
codex_cli
codex_sdk_ts
codex_cloud
claude_agent_sdk_python
claude_agent_sdk_ts
claude_cli
openclaw_acp
a2a_endpoint
local_process
```

`AgentSession` should carry provider continuity:

```text
agent_session_id
agent_spec_ref
provider_kind
provider_version
model
driver_config_ref
auth_ref
working_directory_policy
sandbox_policy
allowed_tool_policy
prompt_contract_ref
output_contract_ref
trace_destination
```

`AgentRun` should carry invocation meaning and outcome:

```text
agent_run_id
agent_session_ref
AgentRun.purpose
input_artifact_ref
output_contract_ref
status
failure_reason
raw_provider_output_ref
trace_ref
agent_event_refs
```

The provider is the execution backend. It does not own candidate identity, evidence, promotion, or
live authority.

## RuntimeProviderAdapter Contract

Every provider adapter should implement the same control-plane-facing contract:

| Operation | Required behavior |
| --- | --- |
| `probe` | confirm binary/package/API availability and version |
| `prepare` | create working directory, prompt files, input artifacts, and policy files |
| `start` | launch provider run and return a provider run id / process id / thread id |
| `stream` | emit provider events into `Trace` or `TeamTrace` |
| `cancel` | interrupt or stop the run when policy requires |
| `collectArtifacts` | export files, final message, JSON output, diffs, logs, and provider metadata |
| `resume` | continue a resumable provider session when supported |

For real provider execution, `probe` must check:

- binary/package/API availability
- version
- auth state
- requested model access
- sandbox posture
- tool access posture
- output contract support
- schema-output smoke path when the adapter claims structured output support
- trace/event export
- cancellation behavior
- artifact export
- resume support

`probe` produces `ProviderProbeAttempt` records and updates or creates a `ProviderReadinessRecord`.
The control plane should not call `start` for a real provider unless the relevant readiness record is
`active_verified` for that `provider_kind`, invocation surface, model, output contract, and allowed
first use.

Provider-specific behavior belongs behind this adapter.

The rest of autokairos should see only:

```text
AgentSession
-> RuntimeProviderAdapter
-> Trace / TeamTrace
-> CandidateMaterializationInput or EvaluationInput
```

## Codex Adapter Shape

### Codex CLI first adapter

Codex CLI is the most immediately feasible first local adapter because it is already installed.

Invocation shape:

```text
codex exec
  --cd <working_dir>
  --model gpt-5.4
  --sandbox read-only | workspace-write
  --json
  --output-schema <schema.json>
  --output-last-message <result.json>
  <prompt>
```

Useful modes:

- `read-only` for candidate analysis
- `workspace-write` for artifact generation inside an isolated working directory
- `--json` for event capture
- `--output-schema` for stable materialization output
- `--ephemeral` when persistent Codex session files are not wanted

What to record:

- command
- CLI version
- model/spec/config overrides; PR1 currently defaults to explicit `gpt-5.4`
- sandbox mode
- working directory
- JSONL event stream
- final message
- output schema result
- file artifacts or diffs

What not to trust:

- final text as evidence
- command success as promotion
- provider session as durable truth

Known PR1 environment constraint:

- `gpt-5.5` access failed during smoke testing
- `gpt-5.4` produced valid schema output

Until new evidence changes this, PR1 must use:

```text
provider_kind = codex_cli
AgentRun.purpose = candidate_generation
model = gpt-5.4
```

### Codex SDK adapter

Use `@openai/codex-sdk` when the runtime app needs long-lived thread control from Node.

This is likely better than shelling out once the bootstrap has a real runtime service.

Minimum adapter role:

```text
new Codex()
-> startThread()
-> thread.run(prompt)
-> collect final response and thread id
```

The SDK should still export events/artifacts into autokairos trace stores. It must not become the
system of record.

### Codex Cloud adapter

Codex Cloud should not be the first trading-system runtime.

It is useful later for:

- background engineering work
- creating or improving `TraderSystemSpec` artifacts
- opening PRs against code repositories
- large parallel coding tasks

It is not ideal for first local candidate execution because it depends on cloud environment setup
and repo/GitHub integration.

## Claude Adapter Shape

### Claude Agent SDK first-class adapter

Claude Agent SDK is the correct production-oriented Claude path.

Python invocation shape:

```text
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt=prompt,
    options=ClaudeAgentOptions(
        cwd=working_dir,
        allowed_tools=["Read", "Edit", "Bash", "Grep", "Glob"],
        max_turns=max_turns,
    ),
):
    emit_to_trace(message)
```

TypeScript invocation shape:

```text
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt,
  options: {
    cwd: workingDir,
    allowedTools: ["Read", "Edit", "Bash", "Grep", "Glob"],
    maxTurns,
  },
})) {
  emitToTrace(message);
}
```

What to record:

- SDK version
- model config
- allowed tools
- permission mode
- cwd
- session id
- hook events
- subagent messages and parent tool ids
- final result

What not to trust:

- Claude result as counted evidence
- Claude subagent report as promotion
- Claude session state as autokairos truth

### Claude CLI prototype adapter

If installed, `claude -p` can be used for a thin prototype:

```text
claude -p "<prompt>" --output-format stream-json --cwd <working_dir>
```

But for autokairos this should be secondary to the SDK because the SDK has a clearer integration
surface for sessions, hooks, subagents, and programmatic control.

## Why This Changes The Architecture

The current architecture should not use an abstract provider label such as "Codex" as if that is
enough.

It must say:

```text
provider_kind = codex_cli
invocation_surface = subprocess
command = codex exec --json --output-schema ...
trace_mode = jsonl_stdout
artifact_mode = working_dir_export
auth_mode = CODEX_API_KEY or existing CLI auth
sandbox_policy = read-only | workspace-write
```

or:

```text
provider_kind = claude_agent_sdk_python
invocation_surface = python_sdk
package = claude-agent-sdk
auth_mode = ANTHROPIC_API_KEY
trace_mode = async message stream
tool_policy = allowed_tools + permission hooks
```

That is the difference between a real adapter and provider-name decoration.

## First Practical Adapter Sequence

Use this order unless prototype evidence contradicts it:

1. `codex_cli`
   Locally available and smoke-tested with `gpt-5.4`. Best for proving runtime adapter plumbing,
   trace export, and schema output for first `candidate_generation`.
2. `claude_agent_sdk_python` or `claude_agent_sdk_ts`
   Best second adapter because it is explicitly designed as a production SDK. It remains
   `candidate_unverified` until install, auth, model access, event export, artifact export, and
   cancellation behavior are probed.
3. `codex_sdk_ts`
   Use when the runtime service needs thread-level Codex control instead of subprocess runs. It is
   not a Bootstrap default.
4. `openclaw_acp`
   Use later if OpenClaw/ACP becomes the preferred bridge for external harness sessions. It cannot
   replace autokairos control-plane truth.
5. `a2a_endpoint`
   Use later for independent remote-agent participants, not for first candidate generation, tool
   access, evidence, promotion, or live authority.
6. `codex_cloud`
   Use later for background engineering and artifact/code work, not first trading runtime.

## MLP-01 Constraint

MLP-01 should not attempt a provider marketplace.

It only needs:

- one real local provider adapter
- one stable output schema
- one trace export path
- one candidate materialization boundary

The first implementation should prove:

```text
Codex CLI subprocess with explicit `gpt-5.4`
-> structured candidate proposal JSON
-> trace/artifact export
-> TraderSystemCandidate materialization
```

Then Claude Agent SDK can be added as the second provider adapter using the same
`RuntimeProviderAdapter` contract.

## Acceptance Test

This page is sufficient if an implementer can answer:

- how to invoke Codex locally today
- why the first real candidate-generation provider uses explicit `gpt-5.4` today
- how to invoke Claude programmatically after installing the SDK
- which provider path is first
- which provider surfaces are `active_verified`, `candidate_unverified`, `future_bridge`,
  `blocked_or_not_installed`, or `reference_only`
- what `probe()` must verify before a provider label becomes runnable
- what a `ProviderReadinessRecord` and `ProviderProbeAttempt` contain
- what command/API output becomes trace
- what output schema candidate materialization expects
- why provider output is not evidence, promotion, or live authority
