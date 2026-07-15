# Candidate Sandbox Egress Design

**Status:** Approved under the operator's standing autonomous implementation authority

## Goal

Make every generated `TradingSystem` fail closed unless Docker Sandboxes proves that the candidate
can reach no network destination except the exact host-local Gateway endpoint injected for its
paper run. Preserve candidate flexibility inside the Sandbox: the candidate may choose its own
code, process tree, tools, and decision logic, but network authority remains outside the candidate.

This outcome establishes the enforceable network boundary. Structured long-term egress
attestation belongs to OURO-184; provider-process restriction, multi-host fencing, and live trading
remain separate outcomes.

## Observed Gap

Both concrete generated-artifact paths currently create a Docker Sandbox and execute the artifact
without configuring or verifying network policy:

- `DockerSandboxesSbxTradingArtifactRunner` runs CandidateArena replay and handoff probes;
- `DockerSandboxesSbxSandboxAdapter` runs selected continuous paper sessions.

The existing version predicate only recognizes the pre-0.35 `Client Version` / `Server Version`
output and accepts versions that predate Docker's DNS and ICMP isolation fixes. The installed local
CLI is 0.28.3. It therefore cannot establish the required boundary.

## External Runtime Contract

Docker Sandboxes 0.33.0 closed DNS-policy and restart-persistent ICMP escape paths. Version 0.35.0
adds `sbx policy check network`, machine-readable policy listing, and the current one-line version
format. Ouroboros therefore requires stable `sbx >= 0.35.0` for generated-candidate execution.

Docker policy evaluation is default-deny, with allow rules additive and deny rules absolute. When
organization governance is active, organization policy replaces local policy. Host services are
addressed from a Sandbox as `host.docker.internal`, while the policy resource must be
`localhost:<port>`.

Authoritative references:

- <https://docs.docker.com/ai/sandboxes/release-notes/>
- <https://docs.docker.com/ai/sandboxes/governance/concepts/>
- <https://docs.docker.com/ai/sandboxes/security/defaults/>
- <https://docs.docker.com/ai/sandboxes/usage/#accessing-host-services-from-a-sandbox>
- <https://docs.docker.com/reference/cli/sbx/policy/check/network/>

## Selected Design

One application-owned policy coordinator is shared by the application runner and outer Sandbox
adapter. It receives an injected `sbx` command executor, so it owns policy semantics without
owning subprocess execution or adapter persistence.

For each fresh candidate Sandbox, before any candidate process starts:

1. require a parseable stable `sbx` version at or above 0.35.0;
2. inspect active network allow rules for the exact Sandbox name;
3. reject every pre-existing allow resource, including an exact but unowned Gateway rule;
4. when a host Gateway is required, accept only an `http://host.docker.internal:<port>` base URL
   and add a Sandbox-scoped `localhost:<port>` allow rule;
5. inspect the effective rules again and require the allow set to equal exactly that one resource,
   or the empty set for an in-Sandbox replay sidecar;
6. use `sbx policy check network --json` for every Sandbox to prove the Gateway allow and a fixed adversarial deny
   matrix covering public HTTP, package registries, raw TCP, DNS/UDP, metadata/private addresses,
   and alternate host ports;
7. only then execute the generated artifact.

An unknown JSON shape, CLI error, unexpected allow, invalid Gateway URL, or failed policy check is
an infrastructure failure. No candidate process runs after such a failure.

## Lifecycle And Evidence

The coordinator returns a lease for the one Sandbox-scoped rule it created. Every successfully
created Sandbox terminal path collects bounded `sbx policy log <sandbox> --json`, removes the owned
rule, and stops or removes the Sandbox according to the existing lifecycle owner. A normal
continuous-paper stop preserves the public `stopped` lifecycle and leaves Sandbox removal to its
existing higher-level cleanup path. A failed create does not establish name ownership and therefore
never triggers blind forced removal; successful creation does. Cleanup continues after an earlier
failure and reports a stable policy-cleanup error if the rule cannot be removed.

Continuous paper sessions retain the lease while running. The adapter stores enough host-side
lease state to release the rule after process restart; the candidate workspace does not own that
state. A Sandbox stop/restart keeps the same effective policy, so child processes and candidate
restarts do not create a less restricted path.

Policy log command evidence captures observed allow/deny decisions without yet introducing the
durable attestation schema owned by OURO-184.

## Authority Boundary

The policy does not inspect strategy content, constrain trading algorithms, prescribe tools, or
grant promotion authority. It only constrains network effects. Public market reads and paper
`OrderRequest` validation still cross the injected Gateway endpoint and retain the existing
Gateway/Ledger chain. Replay sidecars remain reachable over Sandbox-local loopback and receive no
host or public egress permission.

## Verification

- policy-coordinator unit tests for version floor, exact Gateway mapping, unexpected allows,
  adversarial deny decisions, JSON drift, and cleanup after partial setup;
- runner tests proving policy setup precedes candidate exec and cleanup follows success, crash,
  timeout, and handoff failures;
- adapter tests proving detached execution never precedes policy verification, terminal stop
  removes the rule, and failed or finite startup removes the Sandbox;
- an opt-in real-platform adversarial probe for Python HTTP, DNS, raw socket, subprocess helper,
  redirect, child process, and a reachable but unallowed alternate host listener while the exact
  Gateway path succeeds;
- existing Gateway, Ledger, research, and paper-session regressions plus repository gates.
