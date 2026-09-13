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

This follows the [pinned Codex client implementation](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/core/src/client.rs).

`--max-calls` bounds **all governed resource calls**, including model requests and
file operations; therefore model requests cannot exceed that number. The same limit
and expiring grants cover both turns. The driver also enforces a wall-clock deadline,
and each native execution is limited to at most 240 seconds. A failed run consumes
part of the authorized allowance; do not start another run with a fresh full allowance.

## What to inspect

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
visible. No independent backup, GUI, market access, trading or production acceptance
is included. This live demonstration is not added to the synthetic CI catalog.
