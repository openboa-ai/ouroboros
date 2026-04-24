# Runtime Provider Adapter Feasibility

## Purpose

This page turns the provider names in `AgentRuntimeUnit` into actual callable surfaces.

It exists because a pod design is not implementation-grade unless autokairos knows how it would
invoke Codex, Claude, or another harness and how provider output becomes traceable product input.

## Current Feasibility Verdict

| Provider / surface | Can autokairos call it? | Best first use | Hard limitation |
| --- | --- | --- | --- |
| Codex CLI `codex exec` | yes, locally smoke-tested with explicit `--model gpt-5.4` | first local provider adapter for PR1 builder-agent work | process/subprocess control; default `gpt-5.5` failed access in this workspace |
| Codex SDK `@openai/codex-sdk` | yes, official TypeScript SDK | richer local app integration after bootstrap | server-side Node dependency and local Codex app-server behavior |
| Codex Cloud `codex cloud exec` | possible if Codex Cloud environment exists | later background engineering tasks / PR work | requires environment id and cloud repo setup; not first trading runtime |
| Claude Agent SDK | yes, official Python/TypeScript SDK | strongest Claude-side production adapter | not installed locally yet; requires Anthropic API key |
| Claude CLI `claude -p` | possible when installed | quick prototype only | not installed in this workspace; weaker contract than SDK |
| OpenClaw / ACP | possible conceptually | later bridge to external runtime sessions | not current first adapter; requires separate ACP/OpenClaw setup |
| A2A endpoint | possible conceptually | later independent remote-agent participant | communication only; not evaluation or execution authority |

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

## Provider Adapter Model

`AgentRuntimeUnit.provider_kind` should be concrete, not aspirational.

`runtime_unit_role` must be separate from `provider_kind`.

Allowed initial roles:

```text
builder_agent
evaluation_runner
live_operator_agent
critic_agent
remote_specialist
```

`runtime_unit_role` answers why the unit exists. `provider_kind` answers how it runs.

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

`AgentRuntimeUnit` should also carry:

```text
agent_runtime_unit_id
role
runtime_unit_role
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
- schema-output smoke path when the adapter claims structured output support

Provider-specific behavior belongs behind this adapter.

The rest of autokairos should see only:

```text
AgentRuntimeUnit
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
- model/profile/config overrides; PR1 currently defaults to explicit `gpt-5.4`
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
runtime_unit_role = builder_agent
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
- creating or improving `TradingSystemImage` artifacts
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

The current architecture should not say:

```text
provider_kind = Codex
```

as if that is enough.

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
   Locally available and smoke-tested with `gpt-5.4`. Best for proving runtime adapter plumbing
   and schema output for `builder_agent`.
2. `claude_agent_sdk_python` or `claude_agent_sdk_ts`
   Best second adapter because it is explicitly designed as a production SDK.
3. `codex_sdk_ts`
   Use when the runtime service needs thread-level Codex control instead of subprocess runs.
4. `openclaw_acp`
   Use later if OpenClaw/ACP becomes the preferred bridge for external harness sessions.
5. `a2a_endpoint`
   Use later for independent remote-agent participants, not for first candidate generation.
6. `codex_cloud`
   Use later for background engineering and PR-producing tasks, not first trading pod runtime.

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
- why PR1 uses explicit `gpt-5.4` today
- how to invoke Claude programmatically after installing the SDK
- which provider path is first
- what command/API output becomes trace
- what output schema candidate materialization expects
- why provider output is not evidence, promotion, or live authority
