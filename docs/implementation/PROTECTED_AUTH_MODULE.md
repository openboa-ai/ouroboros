# Bounded protected Bearer module host

This unit extends the existing protected Responses sender. A separately delivered binary Wasm
package can supply its Bearer authentication slot without rebuilding the app or product. It does
not add a general HTTP adapter, OAuth/HMAC support, operating qualification, or live provider use.
Company code continues to use the existing named `model.responses` operation and receives only
the permitted provider result. Custody enrollment and disable retain their existing boundaries.

## Package and protected execution

`ouroboros.auth.bearer/1` fixes the credential schema, entrypoint, output location and resource
bounds. A package contains `selection` (`abi`, lowercase `wasm_sha256`) and `wasm_hex`. The digest
covers the binary Wasm bytes; ABI and digest are jointly pinned in the selected configuration.
The 64 KiB maximum package has no host imports or WASI. Its exported `memory` starts at one page;
growth beyond one page, tables and additional memories are denied. `authenticate(i32) -> i32`
receives the token length, reads at offset zero, and returns the byte length of its output at
offset 32768. A graphic-ASCII token is limited to 8192 bytes. Both Runtime and Resources require
the result to equal exactly `Bearer ` followed by that assigned token.

The fixed Runtime executable `ouroboros-auth-module worker` interprets the package in a separate
process; Resources never loads package code into the custody master-key process. The interpreter
has strict compilation limits and 200,000 execution fuel units. The Linux process also has a
256 MiB address-space ceiling, two CPU seconds, no core dumps, a descriptor limit and a two-second
parent deadline. It receives no inherited environment, credential file, key, database handle,
transport operation or process-creation import. Module preparation precedes a `READY` handshake;
the assigned credential then arrives only through that child's private stdin pipe. Its stdout
is a bounded internal authentication slot, never Company output. Success requires exact output,
EOF and observed zero-status process termination. Failure kills and reaps the child. Cancellation
retains the original unresolved custody claim and cannot authorize a resend.

This is a distinct, capability-free Wasm Runtime profile, not arbitrary native plugin support or
the ordinary Company container profile. The interpreter and fixed launcher remain trusted code.
The protected deployment selects the executable and package directory. Runtime/host changes still
require product review; a package cannot replace the launcher. Actual custody process execution
continues to require the existing Linux key-loader boundary.

## Install, verify, accept, select

Prepare a private directory owned by the protected deployment, then install a package:

```sh
ouroboros-auth-module install --package PACKAGE_JSON --directory PACKAGE_DIRECTORY
```

Installation atomically creates the digest-named file and refuses replacement. Every use reloads
and verifies the exact digest. A development-only WAT packager is available through
`cargo run -p ouroboros-runtime --example auth_module_package -- SOURCE_WAT`.
The fixture package and its reviewable WAT source are checked for exact correspondence by tests.

The protected provider configuration explicitly opts in with `auth_module_host`, containing the
absolute `worker_executable` and `package_directory` paths. This permits module loading; it is not
acceptance or connection activation. The host keeps the endpoint, TLS trust, credential identity,
response bounds and existing Core current-use checks. Redirects and transport retries stay disabled.

1. Propose through `/connection-candidates`, adding the desired `auth_module` selection. This
   requires `auth-module.propose` as well as the existing connection proposal scope. The existing
   successful enrollment receipt must identify the same credential and the proposed version.
   Module replacement may retain the current credential version. Omission preserves the selected
   module; it is not a plaintext/fixed-sender downgrade request.
2. A different reviewer invokes `POST /auth-module-verifications` with the selection, target, work,
   delegation and original request key. `auth-module.verify` is separately required. The fixed
   protected host executes two synthetic vectors in separate bounded workers and returns an
   attributable receipt. This operation releases no stored credential and sends no provider request.
3. A connection review requires `auth-module.review`. Acceptance additionally requires
   `auth-module.accept` and a successful verification receipt from that reviewer, the exact module,
   same target/work and the candidate's protected worker. An enrollment receipt or ordinary Company
   execution receipt cannot qualify protected code. The author cannot provide their own review.
4. Selection uses the existing candidate activation/CAS path and also requires `auth-module.select`.
   Existing bounded call/lifetime acceptance still applies. Installation, verification and acceptance
   individually leave the current connection unchanged. Selection replay never extends its scope.

Protected acceptance, verifier-use and selection grants are rechecked for subsequent business
admission/dispatch, together with the existing caller/service chain. The verifier principal must
also remain enabled, even when the acceptor, selector and caller are different principals.
Historical verification and activation records remain available without renewing use authority.
The admitted ticket pins the module and credential version. The child process receives only the
one version selected by the
existing custody use claim. Resources rechecks Core authorization before authentication and before
send. A worker error, unavailable package or incompatible ABI provides no fallback authentication.

## Recovery and restriction

Provider receipts retain the selected module and the original ticket identity. Original-intent
reconciliation reads the persisted receipt without loading the module, releasing a secret or
resending the provider request. A lost completion acknowledgement does not renew the use claim.

Credential disable blocks new custody uses; connection stop and protected grant revocation block
new dependent dispatch. Disclosed plaintext cannot be recalled, and a request sent before restriction
remains a separately observed external effect. Local restriction never claims provider-side account
revocation, financial settlement or cancellation of an already-sent operation.

## Evidence boundary

Runtime tests cover exact output, the two token bounds, package tampering, import denial, memory
growth, unbounded computation and alternative output. The existing real PostgreSQL/provider process
fixture additionally installs the module without a binary rebuild, verifies independent acceptance,
performs mock TLS requests, loses a completion acknowledgement, reconciles the original receipt,
and checks protected selection revocation, credential disable and connection stop against actual
provider send counts. Business and authentication data are synthetic; no actual provider account
or exchange is contacted. Required CI and code-owner review remain independent delivery gates.

Settings UI, API-key header profiles, arbitrary native Auth Modules, OAuth refresh, HMAC/mTLS,
external keys and authenticated inbound events remain subsequent units.
