# Basic flow demonstration

This opt-in local demonstration answers one question: can a human submit a small
file task, inspect the real model's persisted answer, and ask a follow-up that
continues the same native session? It does not qualify deployment or company operation.

The driver uses existing CLI/Gateway APIs for work, file publication, execution,
conversation messages, and stop. Bootstrap creates separate disposable PostgreSQL
databases, synthetic demo identities and finite grants. Protected migration credentials
are separate from runtime worker roles. The model credential is encrypted for the
provider worker; it never enters the native container.

## Preparation

Use the explicit disposable Linux ARM64 environment documented in the
[integration guide](../../docs/architecture/INTEGRATION_AND_DEPLOYMENT.md#checkout-portable-validation-environment).
Build the current source and its native image before running. All native environment
paths, image identities, PostgreSQL tools and service UIDs must pass existing preflight.
Each attempt requires a fresh run name; previous evidence is preserved.

Disposable DB passwords and connection URLs use locked, sealed Linux memory files,
bound at the existing regular-file locators. They require memfd seals, memory locking
and bind-mount permission; there is no disk-backed fallback. The native environment
scenario verifies the actual binding, worker UID isolation, write rejection and cleanup.

The pinned Codex package includes `codex-code-mode-host`, which `gpt-5.6-sol`
needs to run local tools. The image preparation script verifies the official
helper archive's checksum before installation. Demo preflight checks that the
helper is executable and the Codex version matches, in a disposable container
with no network or credentials. It removes that container before continuing;
a missing helper fails before the driver reads a supplied credential.

```sh
python3 tests/integration/demo-basic-flow.py \
  --environment "$NATIVE_ENVIRONMENT" --run-name prepare-01 \
  --model gpt-5.6-sol --preflight

python3 tests/integration/demo-basic-flow.py \
  --environment "$NATIVE_ENVIRONMENT" --run-name prepare-01 \
  --model gpt-5.6-sol --prepare-only
```

Execute on the selected disposable guest as its fixture administrator. `--preflight`
only inspects. `--prepare-only` creates and reads actual CLI records, uses a synthetic
credential, verifies zero model-call and credential-use records, and stops its services
and database. It accepts no actual account or credential input.

## Real-model run

First confirm the account connection and a fresh finite usage allowance. After that
decision, pipe the selected current access token to stdin from its protected owner-side
credential source; never paste it in a command, environment variable, document or chat.
The driver does not discover credentials, log in, refresh tokens or retry calls.

```sh
# Nonterminal stdin must contain the explicitly authorized token.
python3 tests/integration/demo-basic-flow.py \
  --environment "$NATIVE_ENVIRONMENT" --run-name live-01 \
  --model gpt-5.6-sol --responses-lite --account-id "$CONFIRMED_ACCOUNT_ID" \
  --max-calls 20 --max-seconds 600 --credential-stdin
```

The optional activated `ProgramProfile.native_model` selects the model at admission.
The provider's optional `chatgpt_account_id` pins subscription account routing to
`https://chatgpt.com/backend-api/codex/responses`. The existing encrypted credential,
fixed Gateway bridge, current-authority checks and zero transport retries remain.
No API-key billing fallback or new subscription is selected.

Codex 0.153.4 uses Responses Lite for `gpt-5.6-sol`: instructions and tools are
carried in the native input, and its HTTP marker must accompany that body. The
explicit `--responses-lite` flag pins `codex_responses_lite` in the provider
configuration and sends only the fixed `x-openai-internal-codex-responses-lite: true`
header. It requires the exact Codex subscription endpoint and an account binding.
The request body is unchanged. Omit this flag for models that use standard Responses;
there is no automatic dialect detection or retry in another dialect.

The Lite connection requests `Accept: text/event-stream`. A missing response media
header is accepted only on a pinned Codex subscription stream, and only a valid
terminal Responses event can establish completion. Explicit incompatible media types,
empty streams and malformed responses remain failures. Instance sockets allow the
bounded response to last 60 seconds while retaining a separate five-second header
limit and continuous Gateway authority checks.
Internal HTTPS responses also close their connection after each request, so a
later response cannot inherit an earlier request's 60-second connection deadline.

This follows the [pinned Codex client implementation](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/core/src/client.rs).

`--max-calls` bounds **all governed resource calls**, including model requests and
file operations; therefore model requests cannot exceed that number. The same limit
and expiring grants cover both turns. The driver also enforces a wall-clock deadline,
and each native execution is limited to at most 240 seconds. A failed run consumes
part of the authorized allowance; do not start another run with a fresh full allowance.

## What to inspect

### One-turn resource smoke check

Select `--scenario resource-smoke` to exercise the existing managed MCP, Company DB
and Catalog in one actual native turn. The default `basic-flow` scenario above retains
its two-turn conversation behavior. No new server, product API or schema is required.

```sh
python3 tests/integration/demo-basic-flow.py \
  --environment "$NATIVE_ENVIRONMENT" --run-name resources-prepare-01 \
  --scenario resource-smoke --model gpt-5.6-sol \
  --max-calls 30 --max-seconds 300 --prepare-only

# After preparation, with a fresh approved allowance and token on nonterminal stdin:
python3 tests/integration/demo-basic-flow.py \
  --environment "$NATIVE_ENVIRONMENT" --run-name resources-live-01 \
  --scenario resource-smoke --model gpt-5.6-sol --responses-lite \
  --account-id "$CONFIRMED_ACCOUNT_ID" \
  --max-calls 30 --max-seconds 300 --credential-stdin
```

The agent reads a fresh file marker, calls the already registered managed MCP
`execution_self({})`, queries a separate fresh DB marker with `read_input`, and saves
both markers plus its execution ID through `record_result`. It writes the same object
to `result.json`, uploads it and explicitly publishes revision 2, then saves the
published path in the conversation. Expected marker values are absent from its prompt.

The verifier checks the actual native MCP completion and bound execution/instance,
Core's instance-attributed DB calls, the single Company result and commit receipt,
and the agent-attributed Catalog publication receipt. It downloads the immutable
published file through Gateway and compares the JSON with the expected data and DB
result. Upload-only completion cannot pass. Managed MCP uses the Core management
path; a resource-call count for the separate fixture MCP is not its evidence.

`--prepare-only` checks DB and file reads with a synthetic credential and verifies
zero model requests/custody claims. The evidence verifier's portable positive and
negative cases run in `tests/tooling/test-native-suite-contract.py`, including missing
MCP, wrong DB data/receipt/actor, and missing publication or incorrect read-back.

The run root retains `resource-evidence.json`, `resource-summary.json`, the downloaded
`result.json`, conversation transcript and cleanup result. The summary becomes PASS
only after successful verification and cleanup. The five-minute/30-resource-call
limit covers one run, not a renewable retry allowance. Preparation/builds happen
before starting the approved live window; detailed failure evidence stays private.
This scenario defaults to 300 seconds and 30 calls and rejects larger values.
When the operator explicitly removes the overall wall-clock limit, use
`--no-deadline`. This disables the demo-wide alarm and uses a finite 900-second
fixture grant; native execution leases and individual request timeouts remain.
The 30-call ceiling and no-retry behavior are unchanged.
After preparing the input and task, it starts the clock and the temporary grants'
expiry together. Preparation calls still count toward the same 30-call budget.

### Two-turn conversation demo

The transcript prints the sample file, first execution and answer, follow-up execution
and answer, and observed termination with compute return. Each answer is saved by the
native instance through `conversations send`, with message and native execution
provenance. The follow-up restores the published checkpoint into a fresh execution
and must retain the original thread ID with a new turn ID.

Read both answers: the first must summarize the supplied three facts, and the second
must expand the Wednesday opening-hours item without inventing facts. An HTTP success
or a saved message alone cannot establish that semantic result.

Private evidence is stored under the explicit run/deployment roots: `transcript.json`,
`cleanup.json`, and `failure.json` when applicable. The driver removes only its recorded,
verified stopped containers, stops its own services and PostgreSQL, and removes its
provider decryption key after service shutdown. Failure or unconfirmed cleanup stays
visible. DB credential mounts are released after their consumers stop; their underlying
disk files are empty and removed. The custody key retains its existing protected,
singly linked file contract and is separately removed after provider shutdown.
No independent backup, GUI, market access, trading or production acceptance
is included. This live demonstration is not added to the synthetic CI catalog.

### Agent-authored Company UI candidate

`--scenario company-ui` extends the one-turn resource check. The real native Codex
agent independently implements `CompanyPulse.tsx` and a `company-ui.json` composition,
using the existing public Company SDK contract. Its component displays the actual
execution ID and fresh file/DB markers as a **Verification snapshot**, not live health.
The prompt contains no expected marker values. The three outputs are uploaded and
published together at revision 2. The original resource-smoke oracle remains required.

The verifier downloads both UI artifacts from that exact revision through Gateway,
binds bytes and sizes to instance-attributed upload inputs/receipts, checks composition
company/execution/publication identity, and retains the files before cleanup. It does
not execute submitted JavaScript. TypeScript compilation, import-boundary validation,
registration and visible Mac-app operation remain separate acceptance steps.

```sh
python3 tests/integration/demo-basic-flow.py \
  --environment "$NATIVE_ENVIRONMENT" --run-name company-ui-prepare01 \
  --scenario company-ui --model gpt-5.6-sol \
  --max-calls 30 --no-deadline --prepare-only

# Token arrives only on nonterminal stdin from the authorized owner-side source.
python3 tests/integration/demo-basic-flow.py \
  --environment "$NATIVE_ENVIRONMENT" --run-name company-ui-live01 \
  --scenario company-ui --model gpt-5.6-sol --responses-lite \
  --account-id "$CONFIRMED_ACCOUNT_ID" \
  --max-calls 30 --no-deadline --credential-stdin

python3 tests/tooling/verify-company-ui-artifacts.py --run-root "$RUN_ROOT"
```

The scenario inherits the 30-call ceiling, finite grants, individual timeouts,
native execution lease, no automatic retry and the same cleanup checks. There is
no overall wall-clock alarm with `--no-deadline`; the native lease remains bounded.
`--prepare-only` makes no model calls and does not create UI output on the agent's
behalf. `company-ui-evidence.json` explicitly leaves `compiled` and `displayed` as
`NOT RUN`; the subsequent app build and actual UI capture establish those results.
