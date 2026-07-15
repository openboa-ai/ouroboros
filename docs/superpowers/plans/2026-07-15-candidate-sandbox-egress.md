# Candidate Sandbox Egress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deny generated-candidate network egress by default while permitting only the exact injected local Gateway endpoint.

**Architecture:** Add one policy coordinator in the application layer and inject each concrete
runner's existing `sbx` command executor. Integrate it before candidate effect in both generated
artifact paths, retain a lease for long-running paper sessions, and collect policy evidence during
terminal cleanup.

**Tech Stack:** TypeScript 5.9, Vitest 4, Node.js subprocess and filesystem APIs, Docker Sandboxes
`sbx` 0.35 policy CLI.

## Global Constraints

- Generated-candidate execution requires stable `sbx >= 0.35.0`.
- The only host network resource permitted is `localhost:<GatewayPort>` for an injected
  `http://host.docker.internal:<GatewayPort>` URL.
- Sidecar replay receives no host or public network allow rule.
- Unknown policy state and cleanup failures fail closed.
- Do not add strategy, tool, or content restrictions.
- Do not add the OURO-184 durable egress-attestation schema.

---

### Task 1: Candidate Network Policy Coordinator

**Files:**
- Create: `packages/application/src/trading/research/candidate-sandbox-network-policy.ts`
- Test: `packages/application/src/trading/research/candidate-sandbox-network-policy.test.ts`

**Interfaces:**
- Consumes: an injected `(command: string[]) => Promise<CandidateSandboxNetworkCommandResult>`.
- Produces: `assertCandidateSandboxSbxVersion`,
  `acquireCandidateSandboxNetworkPolicy`, `CandidateSandboxNetworkPolicyLease`, and
  `CandidateSandboxNetworkPolicyError`.

- [x] **Step 1: Write the failing policy contract tests**

```ts
const lease = await acquireCandidateSandboxNetworkPolicy({
  sbx_path: "/usr/local/bin/sbx",
  sandbox_name: "ouro-candidate-1",
  gateway_base_url: "http://host.docker.internal:4173",
  run_command: fakePolicyCommand
});
expect(lease.allowed_resource).toBe("localhost:4173");
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run packages/application/src/trading/research/candidate-sandbox-network-policy.test.ts`

Expected: FAIL because `candidate-sandbox-network-policy.ts` does not exist.

- [x] **Step 3: Implement the minimal coordinator**

```ts
export async function acquireCandidateSandboxNetworkPolicy(
  input: CandidateSandboxNetworkPolicyInput
): Promise<CandidateSandboxNetworkPolicyLease>;
```

The implementation parses both current and legacy version text, enforces the 0.35.0 floor,
validates the Gateway URL, inspects active allows, adds at most one scoped rule, executes the fixed
policy-check matrix for every Sandbox, and guarantees owned-rule rollback.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run packages/application/src/trading/research/candidate-sandbox-network-policy.test.ts`

Expected: PASS.

### Task 2: CandidateArena Artifact Runner Integration

**Files:**
- Modify: `packages/application/src/trading/research/artifact-runner.ts`
- Modify: `packages/application/src/trading/research/paper-handoff-conformance.ts`
- Test: `apps/runtime/test/trading-research-loop.test.ts`

**Interfaces:**
- Consumes: `acquireCandidateSandboxNetworkPolicy` after Sandbox creation.
- Produces: stable `candidate_sandbox_network_policy_failed` run classification and
  `network_policy_failed` handoff infrastructure classification.

- [x] **Step 1: Add failing command-order and cleanup tests**

Assert that no `sbx exec` appears before policy inspection/check commands and that policy log,
rule removal, stop, and Sandbox removal occur after success and failure.

- [x] **Step 2: Run the focused research tests and verify RED**

Run: `npx vitest run apps/runtime/test/trading-research-loop.test.ts`

Expected: FAIL because the runner currently executes immediately after `sbx create`.

- [x] **Step 3: Integrate the lease around run and handoff execution**

Use the replay sidecar as an empty allow set. For `host_url`, pass the exact provider
`sandbox_base_url`. Always release the lease before stopping and removing the Sandbox, preserving
all command results in `command_evidence`.

- [x] **Step 4: Run focused research tests and verify GREEN**

Run: `npx vitest run apps/runtime/test/trading-research-loop.test.ts`

Expected: PASS.

### Task 3: Continuous Paper Sandbox Adapter Integration

**Files:**
- Modify: `packages/adapters/src/sandbox/adapter.ts`
- Test: `apps/runtime/test/sbx-sandbox-adapter.test.ts`
- Test: `apps/runtime/test/sandboxes.test.ts`

**Interfaces:**
- Consumes: the shared coordinator and the adapter's injected Gateway URL.
- Produces: a retained policy lease for a running Sandbox and terminal policy/Sandbox cleanup.

- [x] **Step 1: Add failing detached-exec and restart-cleanup tests**

Assert exact command ordering, reject old `sbx`, prove a child cannot introduce a new allow, and
recover the owned `localhost:<port>` lease after constructing a replacement adapter instance.

- [x] **Step 2: Run adapter tests and verify RED**

Run: `npx vitest run apps/runtime/test/sbx-sandbox-adapter.test.ts apps/runtime/test/sandboxes.test.ts`

Expected: FAIL because no policy lease exists and stop preserves the Sandbox.

- [x] **Step 3: Integrate policy acquisition, retained state, and cleanup**

Acquire after `sbx create` and before detached exec. On startup failure or finite completion,
collect policy log and remove the rule immediately. On a running session, persist lease metadata
outside the candidate workspace; terminal stop terminates, logs policy decisions, removes the
rule, and stops the Sandbox. Existing higher-level cleanup remains responsible for removing a
successfully stopped Sandbox, preserving the public lifecycle contract.

- [x] **Step 4: Run adapter tests and verify GREEN**

Run: `npx vitest run apps/runtime/test/sbx-sandbox-adapter.test.ts apps/runtime/test/sandboxes.test.ts`

Expected: PASS.

### Task 4: Adversarial Platform Probe And Durable Contract

**Files:**
- Create: `fixtures/security/candidate-network-egress-probe.py`
- Create: `scripts/prove-candidate-sandbox-egress.mjs`
- Modify: `package.json`
- Modify: `docs/candidate-arena-evaluation-protocol.md`
- Test: `apps/runtime/test/candidate-sandbox-egress-proof-script.test.ts`

**Interfaces:**
- Consumes: a logged-in `sbx >= 0.35.0`, deny-all effective policy, and a temporary local HTTP
  Gateway.
- Produces: machine-readable proof that Gateway HTTP succeeds while direct HTTP, redirect, DNS,
  raw TCP, subprocess curl, child-process, metadata, and alternate host-port probes fail.

- [x] **Step 1: Add failing proof-script contract tests**

Run: `npx vitest run apps/runtime/test/candidate-sandbox-egress-proof-script.test.ts`

Expected: FAIL because the script and probe fixture do not exist.

- [x] **Step 2: Implement the bounded proof harness**

The script must always release the scoped rule and remove the Sandbox in `finally`, emit no secret
values, and exit non-zero if any forbidden route succeeds or the Gateway route fails. It removes a
Sandbox only after successful creation establishes ownership; a failed create may refer to an
existing Sandbox with the same name and must not trigger blind deletion.

- [x] **Step 3: Run contract and real-platform validation**

Run: `npm run prove:candidate-sandbox-egress`

Expected: PASS on a logged-in 0.35 runtime. If authentication is unavailable, retain the exact
preflight blocker and do not claim live platform proof.

- [x] **Step 4: Run repository validation**

Run:

```bash
npm test
npm run typecheck
npm run check:repo-guards
```

Expected: all checks pass, followed by GitHub CI and Codex review on one OURO-180 PR.

## Execution Evidence

- `npm test`: 202 files passed; 3,345 tests passed and one skipped.
- `npm run typecheck`: all TypeScript workspaces and the Tauri Rust crate passed.
- `npm run check:repo-guards`: docs, architecture, naming, tracked env, secret scan, and diff checks
  passed.
- `npm run prove:candidate-sandbox-egress -- --sbx-bin /tmp/ouroboros-sbx-035/bin/sbx
  --command-timeout-ms 5000`: contract reached the real 0.35 CLI and failed closed at Sandbox
  creation with `sbx_authentication_required`. The live network-effect claim remains unproven until
  a logged-in Docker Sandboxes runtime reruns this command; no product fallback is allowed.
