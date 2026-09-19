# Runtime Manager

This is a proposed component design under the [Architecture](../../ARCHITECTURE.md), subordinate
to its governing sources. [Contracts and State](CONTRACTS_AND_STATE.md) owns the shared meanings.
This document specifies an initial implementation candidate, not a deployed sandbox, operational
grant, or claim that native harness compatibility and containment have been demonstrated.

## Company Service Host

The operating counterpart of the app's Company UI Host is **Company Service Host**. It is a
generic use of existing Runtime execution, Gateway service binding and resource/custody contracts,
not another executor. Ordinary Company packages own business APIs, investment rules/enforcement
and provider adapters without holding provider secrets. Runtime launches exact selected releases
under isolated profiles and observes/fences their actual instances; it has no built-in investment
implementation.

Service, strategy-agent and UI lifetimes are independent. A required enforcement service does not
share the strategy's mutable checkout, credential or writable state. Package/config replacement
requires its protected selected-use transition. Stale or failed required services block new
dependent effects while preserving separately authorized observation/reconciliation and pending
obligations. Source ownership does not weaken [the shared service contract](CONTRACTS_AND_STATE.md#company-hosts-and-business-services).

### Protected AuthModule profiles

A separately qualified AuthModule is a credential consumer of the protected Resources host, not
an ordinary Company program or a privilege gained by serving an API. Source prepared or maintained
by Company agents may enter that host only as an exact independently accepted module under its
dedicated trust profile. Package ownership, an ordinary execution grant, a tool name or a requested
profile cannot promote private code into a secret-bearing instance.

Resources owns module installation, compatible host-ABI selection, credential binding and scoped
authentication operations. Existing Runtime/backend isolation may realize that selected profile;
it does not introduce another engine, expose launch options or merge it with ordinary execution.
Keep its service identity, memory/mounts, credential/key-service access, egress and result filtering
separate from ordinary callers. All ordinary agents/programs remain use-only Gateway clients.
Plaintext provider credentials and reusable authenticated requests never pass back through their
runtime bridge.

An accepted module within the qualified host ABI can be installed/replaced independently of the
product binary. A required common host/ABI/isolation capability outside that contract remains a
product change. Modules implement provider authentication; they do not replace the product's
encryption envelope or create another secret store. Exact package/configuration, host ABI,
credential schema/version and consumer generation participate in readiness and replacement.
See [installation and connection lifetimes](INTEGRATION_AND_DEPLOYMENT.md#independent-authmodule-installation).
The present ordinary worker/enrollment fixtures do not qualify this protected module profile.

## Implemented finite Company call continuation

An original caller can register `ServiceContinuationRequest` after Runtime has assigned its scoped,
non-native Company execution. The registration requires current `service.manage` on that service
target in addition to the original execution/invocation/read authority. The worker identity comes
from the existing authenticated Runtime assignment. Company code cannot supply a worker identity,
change its origin, or enable its own continuation through a scoped service instance.

The durable policy permits at most 32 restarts, a restart admission window of at most one day and
an explicit backoff of 1–3600 seconds. The backoff must fit within that window. These are contract
ceilings, not automatically granted defaults. The registration is immutable and unique per original
root. A second key, Core restart or supervisor restart cannot replace the policy or reset the count.
No existing installation receives a `service.manage` grant from this implementation.

The persistent worker uses `POST /runtime/service-continuations/reconcile` with its configured
profile, before its existing read-only pending-work query. Core considers up to 16 registrations per
poll, ordered by last check for fairness. Only registrations assigned to that actual worker/profile
are eligible. The bounded fixture worker never drives this controller.

A successor requires all of the following under the same firm fence as stop, claim and admission:

- The previous execution is actually terminated and its original compute reservation has an accepted
  return with matching units. A stop request or container-exit report alone is insufficient.
- Prior root effects and current-instance resource calls have terminal records and stored replies.
  An accepted/claimed/unknown call remains blocked even after compute has been returned.
- The program did not report a successful exit. A successful program exit ends this continuation;
  it still does not assert business success or financial settlement.
- The restart admission window and ordinal allowance remain available, backoff has elapsed, and
  current grants, work scope, selected qualified material and target configuration permit use.
- Ordinary fresh execution admission, frozen input verification, profile limits, current compute
  capacity and the selected adapter acceptance's aggregate invocation bound all pass.

A server-owned `(root, ordinal)` key and immutable execution link are committed with that admission.
Concurrent polls and lost responses recover the same successor. `execution_self` derives the same
original root/caller/input from every replacement instance. Existing successful child receipts replay
under their original slot; changed input conflicts. New executions cannot obtain fresh effect slots,
read another call, use a retired instance, nest services or escape into general management.

`file.read` response bytes remain tied to the original instance. A call that used such a slot is
reported as `transfer_recovery_required` instead of automatically restarting with broadened delivery
rights. Program-input materialization retains its separately qualified, per-execution input path.
Native Codex calls, cross-instance binary redelivery and a continually serving request queue are not
implemented by this continuation contract.

Owner stop targets the displayed current execution ID. A newer successor makes an old stop request
conflict. An accepted stop prevents further admission and fences the current instance; unclaimed
work is cancelled through the existing never-dispatched proof and compute-return accounting. Claimed
work stays `stopping` until actual termination and compute return are observed. Remaining external
effects are always displayed separately. Existing execution-stop controls also prevent automatic
replacement of the execution they restricted.

Management routes: `POST /service-continuations`, `GET /service-continuations/{root_intent_id}`,
`POST /service-continuations/{root_intent_id}/stop`. The read returns desired intent, the current state,
policy/window, used restart count, actual execution/instance history and a timestamped Core observation.
`health: not_observed` and `work_success_confirmed: false` keep those limits explicit. Owner inspection
survives loss of the service's grant; it never constitutes permission to run that service.

The Linux target compile check has passed; native Docker execution remains a separate acceptance
step. A supervisor error still retains the claim journal and exits. Reconciliation does not auto-retry
an ambiguous claim, repair unknown process state, create new credentials or change Company policy.

## Responsibility and Desired Execution

Company services may be continuing responsibilities, but no individual instance is unbounded.
The existing Runtime controller must reconcile effective service selection, required health,
bounded restart authority and remaining capacity into separately admitted fresh instances. An
instance exit or systemd restart policy cannot create a new allowance. Reserve qualified execution
slots/compute and evidence capacity for required Company dependency/recovery services so a waiting
strategy cannot occupy the only slot needed by its dependency. Dependency preparation and admission
must reject a cycle or unavailable required capacity instead of marking the service ready.

Required protected authentication consumers and their bounded refresh/event-ingestion work also
need qualified reserved capacity; they cannot wait for an ordinary caller holding their only slot.
Starting or replacing a protected consumer requires the current activation/installation or
maintenance/recovery authority for that transition, not a caller's ordinary execution allowance.
An open session, refreshed token or restarted process cannot renew an execution's expired allowance.
Resources retains session/subscription and refresh identities outside caller scratch; each business
message still needs its own current authorization. Verified persisted inbound events enter the
existing authorized wake path and cannot choose a new agenda or grant their recipient more rights.

The explicit persistent supervisor mode below waits for separately admitted work without a fixture
execution-count or idle limit. It now drives **finite continuation of an already admitted Company
call** through an explicit Runtime-authenticated Core reconciliation request. A continuation keeps
one root and its effect slots while admitting separately bounded replacement executions. It does
not create a new business operation when a process exits. Desired service availability, qualified
health, dependency capacity and recovery-only grants remain target work; `Restart=no` remains in
place so supervisor failure cannot renew an allowance or repeat an uncertain claim.
Recovery-only and end-operation ordering follow the [deployment lifecycle](INTEGRATION_AND_DEPLOYMENT.md#company-recovery-and-operating-end-barriers);
ordinary pause remains enforced until those narrower profiles are implemented and verified.

[Core](CONTROL_CORE.md) admits desired execution under current authority and aggregate limits.
Runtime Manager is the single executor of that decision against the workload backend. It creates,
binds, observes, restricts, and terminates actual instances; it does not choose research, allocate
business priorities, evaluate investment performance, or run private planning in its supervisor.
Console users, directors, tools, and other agents request execution through [Gateway](GATEWAY.md).
They never receive backend administration, raw Docker options, or an alternative launch endpoint.

The first supervisor is a Rust service with a Bollard Docker adapter. Only this Runtime backend
owner holds general Engine access. Resolve one explicit, activated local Engine endpoint; never
discover it from caller environment, Docker contexts, `DOCKER_HOST`, or private configuration.
The Rust CLI and Mac application's trusted native client use Gateway's HTTP API;
neither client receives direct Core/Runtime access, and backend operation does not depend on the UI.

| Record | Required distinction |
| --- | --- |
| Desired execution | Core's `execution_id`: admitted work, principal/delegation, activated package/profile, input references, reservation, and hard deadline. It can exist without a process and is not the actual instance ID. |
| Dispatch attempt | Core's bounded claim for this launch or control action, fixed to current configuration and material input. An ambiguous create is not permission to create another instance. |
| Actual instance | `instance_id` plus Runtime-observed backend identity, launch/configuration identity, generation, resource allocation, channel binding, and lifecycle observations. A native session name is not this identity. |
| Native context | Harness-specific thread/session material and its compatibility metadata. It supports continuation without owning authority, company records, or outstanding effects. |
| Control outcome | Requested action, durable acceptance, observed enforcement, and remaining effects. None can be inferred solely from a successful supervisor RPC. |

Runtime consumes the desired record, bound input handoff, current dispatch claim, and activated
backend configuration. It returns actual instance/binding observations, bounded native events and
artifact references, measured usage, and unresolved failures through scoped Core ingestion. It
never writes Core tables directly or returns its Engine connection to the requesting client.

Each independently assigned company agent has its own admitted execution environment: actual
instance identity, bounded delegation, writable work area, native session, resource allocation,
network boundary and termination lifecycle. Agent identity persists across replacement instances;
company records are shared only through authorized resource operations. Sharing an immutable base
image or host does not justify sharing a writable home, session, credential or instance identity.
Runtime's backend and native-harness adapters select the execution mechanism for each profile;
the native profile uses Codex without assuming other providers share its session protocol. The
[program path](#artifact-backed-program-runtime) is a separate contained execution mode, not a
replacement implementation of that native loop.

One work may continue through several instances. A native harness may create helper subagents
inside its current instance. Such helpers remain part of the same bounded executor: their names
are attribution, not independently isolated company-agent identities or additional allowance.
An independently assigned agent must instead use a separately admitted and bound instance.
Private internal services are also workloads. Serving another agent does not promote their code
into a trusted outer component or grant access to the server host or company database.

## Initial Backend and Isolation Profile

The proposed Mac profile is Docker Engine inside an owner-managed Lima Linux VM. On a Linux
server, use the same workload contract against an owner-controlled Docker backend. This choice
is conditional on [integration](INTEGRATION_AND_DEPLOYMENT.md) and [validation](VALIDATION.md),
including host architecture and native binary compatibility; it is not a production-readiness claim.

Lima starts from a plain configuration with no automatic host-directory mounts, port forwarding,
or agent forwarding. Allow only explicitly configured outer management and Gateway channels.
Disable incidental host integration; pin the VM image, runtime image, and effective configuration.
Private code cannot reach the host filesystem, SSH agent, Docker socket, VM management endpoint,
control database, outer artifact-store paths, or provider/control credentials. Never mount a
developer home, repository checkout, company volume, or host daemon socket into a private instance.

Each instance has a non-root user, private namespaces and network, read-only base image, bounded
writable scratch, dropped capabilities, no privilege escalation, and an activated seccomp profile.
Do not permit privileged mode, host networking/PID/IPC, device access, arbitrary mounts, or runtime
option overrides. Bound CPU, memory, process count, writable storage, output, and lifetime using
backend-enforced mechanisms. A memory limit does not establish a storage quota. Profiles whose
required bound cannot be enforced are unavailable; a convenient unlimited default is not valid.

Initial snapshots and native context require Gateway read admission under the target workload's
principal and current delegation. Permission to launch compute, or the launcher's wider access,
does not authorize reading that content. Resource Services prepare only the admitted immutable
content and its bounded handoff; Core binds its identity and read-admission references to desired
execution. Runtime materializes only that bound content into instance-owned storage through bounded
backend copies. It cannot resolve arbitrary artifact references or use its backend access as a
second read path. Before delivery, recheck current read authority through the Gateway/Core dispatch
contract; stale admission requires reauthorization and rebinding. Ongoing company file access and
explicit publication also use Gateway resource handlers.

Local changes are working-copy changes until publication succeeds. Collection validates paths,
links, sizes, and scope; an archive or symlink supplied by private code cannot select an outer path.
No shared writable mount makes private edits automatically authoritative company state.

Use Docker `--network none`: the workload receives loopback, no external interface, default route,
Docker DNS forwarding, or published port. Verify the actual namespace and effective routes before
release; private shells, native tools, and descendants cannot attach networks or obtain network
administration. IPv6, DNS, metadata, host/sibling access, and alternate protocols remain covered
by the same confinement. A proxy environment variable is not its enforcement mechanism.

Start only a trusted bootstrap waiter from the activated immutable image, with a short required
setup deadline. Disable image healthchecks and any private entrypoint/payload during preparation.
The waiter exits if setup is abandoned; supervisor failure before guard arming cannot leave an
unbounded bootstrap. No private code starts until guard, channel binding, and authorized inputs
are ready. [Docker none networking](https://docs.docker.com/engine/network/drivers/none/) supplies
the loopback-only primitive; the combined launch profile still requires execution tests.

Docker containers share the guest kernel; Docker administration is a trusted, privileged boundary.
The VM separates the Mac host from that guest, but does not make peer containers independent
kernels. Protected outer services also run in that guest; guest-root compromise can defeat their
enforcement and credential custody. [Docker security](https://docs.docker.com/engine/security/) and
[Lima plain mode](https://lima-vm.io/docs/config/plain/) describe building blocks, not proof of this
combined configuration. The connected isolation checks remain unexecuted.

## Private Builds and Artifact-Backed Execution

Apply the [artifact-use contract](CONTRACTS_AND_STATE.md#artifact-use-and-allocated-space) without
equating an accepted base/profile with approval of every generated file. An admitted native agent
can write, compile, interpret and test its own code in its mutable working copy, using installed
tools or identified dependency artifacts supplied through Gateway. Local commands and installation
hooks execute as private code with the same identity, restrictions, deadline and resource accounting.
They do not run in the supervisor or file worker and receive no system-level package-management, engine or host
administration privilege. Existing scoped local experimentation needs no new platform activation.

For a separate build/job, the desired execution binds the exact retained bundle, entrypoint,
input and dependency references, an already accepted runtime/toolchain profile and finite resource
bounds. Read permission and acknowledged content holds precede materialization. The accepted base's
trusted bootstrap remains in charge until guard, identity, allocation and input checks succeed;
only then may a private launcher run that job inside the instance. No generated image entrypoint,
build hook or artifact can replace the bootstrap or execute during privileged setup. The current
[program implementation](#artifact-backed-program-runtime) covers explicit files and argv within an
activated profile; arbitrary bundles, image builds and service deployment remain outside it.

The first dependency path uses supplied toolchains and explicit dependency artifacts; it does not
require a new package-registry platform. Any additional fetch needs a managed, authorized operation,
fixed source/content identity and data bounds. A registry name or package lockfile alone is not
permission to fetch arbitrary URLs. Runtime never follows mutable startup downloads or private
configuration into a different accepted implementation.

Record immutable starting inputs separately from the mutable work produced during execution.
When a candidate is evaluated or adopted, freeze the evaluated result and relevant dependencies;
later edits require new evidence for that changed use. For an activated service/adapter release,
materialize its implementation and loader configuration read-only and exclude writable hooks,
import paths and undeclared executable dependencies. Its operational data remains separate.
An intentionally offered code-execution capability must declare and qualify that behavior; ordinary
data cannot silently replace the implementation previously accepted. Code remains untrusted even
when immutable and accepted, and all external operations retain their domain enforcement.

Extract bundles only after validating manifest, byte and expanded-size/file-count bounds and
rejecting traversal, links to other roots, special files and incompatible payloads. Bound compiler
output, dependency caches, process trees and temporary copies against admitted scratch and shared
backing capacity. A fixed compressed size is not an expanded-storage bound. The profile maps logical
work/space identities to instance-owned paths; private input never selects a host mount or backend.

A new instance receives a new local allocation and authorized copies of the required company
revisions. Persistent service data uses its mediated resource binding, not the previous container's
writable layer. Stop and expiry fence access and terminate execution without waiting for a final
save. Unpublished local output is explicitly unavailable/lost unless a previously authorized,
bounded recovery collection preserves it as unaccepted content; collection cannot publish it or
restart the departed principal's rights. Runtime confirms disposal separately from termination,
while the catalog retains publication, evidence and recovery holds under their own lifetimes.

The full submission/acceptance workflow, archived bundles and managed services remain NOT RUN.
The program subset below connects individually published code/data files and bounded execution;
the remaining [additional validation](VALIDATION.md#generated-artifact-and-space-validation) is
required before enabling the broader lifecycle.

## Artifact-Backed Program Runtime

The local source now connects the [program contract](CONTRACTS_AND_STATE.md#artifact-backed-program-implementation)
to the existing Runtime Manager. A bounded actual Linux program has connected
[implementation evidence](VALIDATION.md#artifact-backed-program-implementation-evidence).
This does not establish native continuity, the complete isolation matrix or successful recovery.
The program profile is configured explicitly, has its own registered ID, and cannot be substituted
for `gateway-probe` or `codex-fixture` by adding a command. No image pull or caller-selected Engine
endpoint is introduced.

1. **Match the admitted execution.** Runtime requires its configured `ProgramProfile` to equal the
   Core ticket's full profile and match the base image/CPU/memory/PID/lifetime settings. It checks
   the original program, ordered input descriptors, exact compute charge, requested lifetime and
   manifest digest. Missing activation, changed configuration or a mismatched handoff prevents launch.
2. **Prepare the existing isolation boundary.** Create a non-root, network-none container with
   read-only root, dropped capabilities, no privilege escalation, disabled image healthcheck and
   no restart. Explicit tmpfs ceilings apply independently to `/workspace`, `/home/agent` and `/tmp`
   under the shared memory cap; there are no company/host bind mounts. A bounded immutable sleep
   waiter remains the only bootstrap until the existing independent guard and bridge are bound.
   Program binding puts Core in `materializing`, not in ordinary released operation.
3. **Deliver exact inputs inside the container.** Runtime sends the bounded descriptor over attached
   stdin to the fixed materializer from the activated image, running as the private UID. The helper
   uses only loopback `GET /execution-inputs/{index}`, without credentials, caller scope, redirects,
   proxy discovery or automatic retries. Gateway/Core resolve the actual bridge to the fixed read.
   Runtime does not fetch company bytes with its service certificate or load private code on the host.
4. **Confirm delivery, then authorize execution.** The helper bounds descriptor/file/count/aggregate
   sizes, checks status and identity headers, and consumes each stream to actual EOF. It hashes and
   counts bytes while writing in bounded chunks, fsyncs, and verifies pinned files and parents before
   producing the complete receipt. Descriptor-relative creation rejects traversal, links, special
   files, destination collisions and substitutions. Input files have mode `0600` inside `0700`
   directories; an image-provided executable such as `/bin/sh` reads the initial script. No input
   archive expansion or executable-bit inference occurs during preparation. Runtime requires the materializer's
   observed zero exit and the exact bounded receipt, records it, and submits `/materialized` to Core.
   Only subsequent successful `/release` permits the private program; a prepared Catalog receipt or
   a successful container-copy/exec call alone cannot pass this barrier.
5. **Execute and observe.** Docker exec uses the admitted argument vector, fixed private UID and
   container working directory. A fixed `/usr/bin/env -i` wrapper clears inherited environment;
   only the fixed `HOME` and `PATH` precede the normalized absolute executable. Private arguments
   are never interpolated into a host shell or accepted as wrapper assignments. Immediately before
   `start_exec`, Runtime checks current Core authorization, backend/Gateway bindings and the original
   deadline. Concurrent supervision continues through materialization and execution; restriction,
   helper loss, deadline or dependency failure enters containment. After release, external calls
   still use ordinary Gateway resource grants; program admission creates no additional service access.

Stdout and stderr share the profile's `max_output_bytes` ceiling. Runtime writes only bounded
output to its protected evidence area and records Docker exec identity, observed exit code,
separate byte counts and whether the captured output is complete. Stream EOF and observed process
exit remain separate checks. `program_succeeded: true` means a confirmed zero process exit;
`output_source: private_program` remains untrusted application content and `effects_settled: false`
retains the accounting distinction. This source path does not automatically publish output files,
turn console output into company evidence or qualify economic performance.

A failed or interrupted input transfer leaves the payload gated. The same instance/index read
intent cannot be redispatched; a missing materialization or release response requires reconciliation,
not another payload start. `--reconcile` still observes/stops the original bound container and retains
uncertainty. The current path does not resume an abandoned materializer, release retained revision
references, settle reservations or satisfy predecessor admission by observing an exit. Existing
native behavior remains separate, and automatic successor/native checkpoint recovery is not added.
Container paths above are profile-owned internal locations; operator storage and socket paths
remain injected configuration, never fields in `ProgramRequest`.

## Native Harness and Trusted Driver

The initial native integration candidate is a pinned Codex App Server running inside private
execution. Keep its complete agent loop, private orchestration, skills, hooks, local tools, and
subprocesses inside that boundary. The outer driver implements bounded lifecycle and observation
translation; it never imports private plugins, evaluates private code, or hosts their tool loop.
Separately allocated compute can be requested through Gateway without forcing one agent to equal
one container or moving compute administration into the harness.

The [App Server interface](https://learn.chatgpt.com/docs/app-server) supplies the reference
JSONL-over-stdio integration: initialization, thread start/resume, turn start/steer,
interrupt, and streamed events. These are native integration surfaces, not isolation guarantees.
The current page also describes experimental production-support limits. Pin the selected binary
and matching protocol schema in the activated build manifest.
Documentation support does not establish compatibility with this Gateway or proposed sandbox.

For the externally contained reference candidate, the trusted driver fixes the official
`externalSandbox` turn policy with `networkAccess: "enabled"`. That permits native tools to reach
the loopback bridge; the network-none namespace and outer enforcement remain responsible for
blocking every other route. The private request cannot choose this policy or change its bounds.
This mode deliberately relies on the external sandbox and adds no nested Codex sandbox guarantee.
It is permitted only after containment and the fixed guard are confirmed. Never use it for an
uncontained host process. Nested `workspaceWrite` is not a supported fallback for this profile:
its additional namespace creation failed in the qualification guest. Failure of the external
boundary blocks execution; it does not authorize broader Docker permissions. The
[official policy contract](https://learn.chatgpt.com/docs/app-server#command-execution) and
[partial test results](VALIDATION.md#local-implementation-evidence) distinguish intended support
from actual qualification. Resume and each subsequent turn must reapply the admitted profile;
a checkpoint's native settings cannot determine current execution permissions.

The first driver-to-server allowlist is below. Every call remains bound to the admitted execution,
actual instance/generation, and fixed native profile; native thread/turn IDs never replace them.
These are internal protocol mappings, not additional company API routes or a raw JSON-RPC surface.

| Driver operation and native method | Bound input and required result handling |
| --- | --- |
| Connect: `initialize`, then `initialized` | Send fixed driver metadata and approved capabilities once per connection. Wait for matching initialization success before the notification or dependent calls; failure leaves native readiness unconfirmed. |
| Start: `thread/start`, then `turn/start` | Use admitted profile and instance-local paths/inputs. Bind returned `thread.id` as this execution's `threadId` before starting its turn. Retain the returned turn identity; rejection does not authorize another thread or configuration. |
| Continue: `thread/resume`, then `turn/start` | Use the admitted predecessor's `threadId` only after fresh instance/input binding and current checkpoint-read authorization. Bind the returned native context to the successor; missing/incompatible context is explicit, never silent fresh work. |
| Steer: `turn/steer` | Send admitted input with bound `threadId` and the observed active `expectedTurnId`; allow no turn-configuration overrides or new turn creation. Preserve the accepted turn identity; no active turn, mismatch, or error rejects steering without retargeting a successor. |
| Inspect: `thread/read` | Permit only the bound `threadId` under current read authority. Set `includeTurns` only for an authorized bounded history view. A returned transcript is native evidence, not restored authority; deny other thread IDs. |
| Interrupt: `turn/interrupt` | Address the bound `threadId` and active `turnId`. An empty success object acknowledges the request; observe `turn/completed` with status `interrupted` separately. Error or lost events leave native interruption unconfirmed; backend containment still proceeds. |

Correlate responses by connection and request ID; retain acceptance and subsequent native events
separately. `turn/started`, `item/started`, `item/completed`, `item/agentMessage/delta`, and
`turn/completed` are bounded observations with source thread/turn references, not proof of company
effects or resolved obligations. A disconnect cannot justify replaying an uncertain `turn/start`;
reconcile its observed state and existing Gateway intents before another admitted action.
Unknown request methods, configuration/login changes, and raw process/command APIs are denied by
default. Local tool execution inside the native loop remains governed by the confinement profile.

Runtime connects to the instance's stdio through its protected backend channel. It accepts only
activated lifecycle methods and bounded data frames, tracks request IDs, applies backpressure,
and records disconnects and event gaps. Configuration overrides cannot select a wider permission
profile, host path, provider, tool endpoint, or credential source. Server-initiated approval/tool
requests are untrusted requests. For local scratch/tool execution, the driver may acknowledge only
the behavior already permitted by the bound confinement profile; this adds no resource authority.
Route supported company resource operations through Gateway and deny unsupported or wider requests.
They never become privileged supervisor commands. Record the native approval decision separately
from Core admission and actual execution; a native approval is not a company authorization token.

Private local tools execute locally within the same confinement; separately hosted tools use
registered Gateway targets. If native dynamic-tool integration needs a callback, its outer part
only dispatches a fixed contract. Arbitrary tool implementation stays private. Native process or
filesystem APIs cannot address outer resources merely because the server protocol exposes them.
Disable unsupported privileged integration features instead of silently weakening the boundary.

Preserve useful native context management, tool rounds, skills, subagents, steering, and output.
Native model traffic, including background/context-related requests, uses the Gateway model route.
Only a scoped Gateway credential may enter private execution; provider credentials remain outside.
Proxy settings express the route while network enforcement prevents bypass. Do not substitute a
model-only loop, disable a required native feature, or enable direct egress to claim compatibility.

## Actual Identity and Access Channel

Runtime obtains a fresh instance generation from Core and binds it to the backend execution it
actually observes. The binding includes work/principal, launch profile and image/configuration
identity, backend instance, permitted channel, and bounded lifetime. Image labels and private
claims can help correlate records but cannot establish this binding on their own.

Run one trusted authentication bridge per instance as a separate systemd unit and unique Unix UID.
Runtime verifies and retains the actual container network namespace reference; the bridge joins
only that namespace. It retains an outer-owned, restricted mount view and host-side PID identity,
not the private mount/PID environment. Namespace setup is privileged; the serving bridge has no
capabilities, namespace-administration rights, Docker access, provider secrets, or private plugins.

The native client uses a fixed loopback HTTP endpoint. The bridge forwards through a fixed,
generation-specific Gateway pathname Unix socket with a mode restricting connection to that bridge's
unique UID. Gateway owns the listener; private execution has no mount or path to the outer socket.
Gateway derives channel identity from its assigned listener, `SO_PEERCRED`, the Runtime-recorded
bridge process lifetime, actual namespace binding, and current generation. Preserve a process
lifetime handle so PID reuse cannot impersonate the former bridge; retire old sockets/connections
before UID reuse. A supplied header, shared NAT address, or token alone cannot establish identity.
[Unix sockets](https://man7.org/linux/man-pages/man7/unix.7.html) provide peer credentials and
pathname permissions; an abstract socket does not provide equivalent file-permission protection.

Gateway additionally checks the private client's short-lived Gateway token against current Core
authority. The bridge cannot select another upstream or implement an arbitrary CONNECT proxy.
Bound requests, streams, FD count, CPU, memory, and buffers; retain cancellation and backpressure.
Private service ingress, when activated, uses a Gateway-only outer socket and a fixed approved
namespace-local service port. There is no private-to-private direct route or host-published port.
This is a Gateway transport bridge, not an extra resource authority or callback execution host.

Every recreation receives a fresh binding. Native sessions, old process/IP identities, copied
tokens, and inherited environment cannot reactivate it. No business-resource access is available
before Core accepts the actual binding. Token or channel renewal cannot extend the instance deadline.

The binding establishes the source execution and its admitted configuration. It does not attest
that private reasoning is honest, that supplied code is correct, or that an economic claim is true.
A director's decisions and native success messages remain attributable reports and requests, not
authority to change grants, activate code, certify itself, or declare external obligations resolved.

## Hard Deadline and Independent Guard

Core supplies mandatory bounded validity and resource parameters from the applicable mandate and
activated profile. Runtime enforces instance allocation; Core owns aggregate reservations, while
[Resource Services](RESOURCE_SERVICES.md) retain provider usage and continuing obligations.
Time spent provisioning, stopping, or reconciling cannot disappear from usage because a turn ended.
Resource ceilings must account for stopping latency; financial estimates are not hard provider caps.

Give each instance a unique parent cgroup containing its Docker scope and every local private
process descendant. Separately allocated child instances have their own guards; Core's delegation
ancestry coordinates their fencing, rather than claiming one parent's cgroup kill stops them all.
The guard, bridge, supervisor, and shared Engine stay outside that subtree. Runtime verifies the
actual placement and opens exactly that parent's `cgroup.kill` with `O_WRONLY`; a protected setup
channel transfers this FD to the guard, not a directory FD, filesystem path to reopen, or Docker
socket. The guard may also receive a read-only `cgroup.events` FD and bounded control/status channels.
Validate the handoff's sender, FD inventory, instance/generation, and cgroup identity before arming.

The deployment target is a separate guard systemd unit under a nonprivileged identity, with its own bounded resources.
It creates its own `timerfd` using `CLOCK_BOOTTIME`, converts Core's approved expiry conservatively
using the established clock uncertainty, and arms one absolute hard deadline. The timer FD is not
shared. After arming, restrict its syscall surface to required wait/read/stop/status operations;
it cannot open new targets, retransmit FDs, launch work, or reset the timer. It accepts an early-stop
signal only for the already bound target. No message or reconnect can extend the deadline.

Armed guard operation survives supervisor EOF and retains the original timer; unarmed setup cannot
release private execution. On expiry or authorized early stop, write `1` to the bound kill FD
before waiting for stdout, Core, or durable logging. Preallocate the stop path and bound status
output; evidence delivery failure must not delay containment. Observe `cgroup.events` populated=0
separately from successful kill submission. Docker and Core observations complete reconciliation.

The [cgroup interface](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html) kills the
subtree, but is not a permanent prohibition on future creation. Use `restart=no`; expired execution
cannot be restarted or repopulated. An old FD never retargets a recreated cgroup: never reopen its
saved path to continue protection. A successor needs a new cgroup, guard, deadline, and binding.
The FD permits early or repeated killing, so the small guard remains trusted; FD restriction alone
does not prove that it will run on time. LSM permission behavior still needs testing on the guest.

Gateway credential/channel validity can be renewed only under current authority and within that
hard deadline. Longer continuation uses a fresh instance. A fence invalidates affected access and
blocks new claims while prior dispatch can remain in flight. Expiry or termination alone never
releases dispatched reservations, deletes unknown cost, or resolves provider resources and charges.

[CLOCK_BOOTTIME](https://man7.org/linux/man-pages/man2/timerfd_create.2.html) includes Linux suspend;
Mac sleep and Lima VZ pause behavior and resume scheduling remain untested. Neither the guard nor
these ordinary Linux services promise strict real-time execution. Uncertain clock state requires
fencing and revalidation, not a fresh lease calculated from an old snapshot. If guard/kernel failure
prevents observed containment, expose that uncertainty; Gateway independently expires access, and
infrastructure containment may be needed. Loss of contact is not proof that computation stopped.

## Start, Control, and Observed Completion

1. Gateway admits initial-content reads for the target principal/delegation. Resource Services
   provide only the approved immutable input handoff; Core binds it to admitted desired execution
   and reservations. Runtime prepares only those fixed inputs and obtains the current dispatch
   claim immediately before backend creation. Compute admission alone cannot authorize input reads.
2. Create the confined container with its unique parent cgroup, `network none`, `restart=no`,
   disabled image healthcheck, and bounded trusted waiter. Record actual backend identity; an
   absent create response enters reconciliation before retry. Do not start the private payload.
3. Verify limits, actual cgroup/namespace references, and the independently armed guard ACK. Start
   the bound bridge, verify its UID/process lifetime and fixed Gateway channel, and have Core accept
   the actual binding. Any missing observation blocks release; setup time consumes the existing bound.
4. Revalidate current input-read authority before materialization. Programs follow the separate
   materializing/receipt/release barrier above. A native profile releases its pinned harness through
   the protected driver, then initializes and starts or resumes admitted context with current work
   and conditions. Neither readiness nor a program exit proves business success or every resource
   path; report the actual observed stage.
5. Retain host-observed lifecycle and usage separately from native events. Durably record material
   observations before asserting dependent completion, following the shared evidence-capacity rules.

| Backend observation | Evidence and meaning returned to Core |
| --- | --- |
| Bootstrap present | Actual container identity, process lifetime, effective profile, namespace/cgroup references, and setup deadline; private payload is still gated. |
| Guard armed | Matching instance/generation/cgroup, immutable deadline, independent guard lifetime, and ACK; no authority to extend it. |
| Channel bound | Bridge lifetime/UID, actual namespace, Gateway socket binding, and current Core acceptance; a listening port alone is insufficient. |
| Inputs materialized | Program-specific receipt matched to actual instance/generation, all fixed input receipts and delivered bytes; execution remains gated until Core release. |
| Native ready/running | Pinned protocol initialization and observed native lifecycle after release; retain native messages as reports. |
| Program exited | Observed Docker exec exit and bounded output completeness; separate from population empty, publication and settlement. |
| Stop submitted | Fence, guard/backend operation, and observed submission time; termination may still be unresolved. |
| Population empty | Bound cgroup reports no live processes; separately retain Engine state, helper cleanup, usage, artifacts, and external obligations. |
| Unresolved | Last confirmed stage, observation gap/error, deadline, and reconciliation responsibility; never fabricate a later state. |

These are backend evidence stages mapped to the shared execution view, not a competing API enum.

Steering follows an authorized Core command referencing the current instance and native turn.
Record transport delivery, native acceptance/rejection, and subsequent observations separately.
It neither changes the mandate nor guarantees the model will follow the new instruction correctly.

For restriction or stop, Core first blocks the affected new admission/claims and issues the fence.
Gateway applies channel/stream restriction; Runtime requests native interruption where possible,
then enforces the configured process-tree stopping deadline through the backend. Keep the two
enforcement observations separate. An interrupt response, closed stdio, container pause, or stopped
parent PID is not evidence that every descendant or external effect has terminated.

Observe backend termination and remaining allocation, retain bounded artifacts and native context,
and record unresolved collection or usage. The first path stops and continues in a fresh instance;
it does not provide in-place process pause/resume. Stopping does not finish the work, stop unrelated
authorized instances, or constitute the sovereign's decision to terminate the company.

## Restart, Continuation, and Backup Recovery

After supervisor restart, recover current Core state before launching or renewing. Enumerate actual
backend executions and correlate them with protected launch records. Fence stale channels and
quarantine unknown/orphaned executions under preauthorized containment. Do not adopt an execution
solely from its label or relaunch a desired job while an earlier create remains unresolved.
For protected AuthModule consumers, observe old worker/lease, egress and key-service fencing before
enabling a conflicting replacement. A local termination record does not revoke an already copied
secret or close a provider session; Resources separately observes those external outcomes. Retain
the original refresh/ingestion/effect identities, compatible schema evidence and unresolved duties.
Separately reconcile provider effects through Resource Services before any dependent retry.

A continuation is `POST /executions` with the same work and a predecessor reference under the
[shared contract](CONTRACTS_AND_STATE.md). It creates a new desired `execution_id`, then a new actual
instance; it never restarts the predecessor container or replaces its attempt/effect records.
A successor requires current authority, a new binding/generation, available resources, and an
activated compatible profile. Checkpoint/session restoration repeats Gateway read authorization
for the successor's current principal/delegation, including retained restricted content. Historical
access, checkpoint ownership, or permission to resume compute cannot restore former read authority.
If the context's current access scope cannot be established, do not deliver it. Restore admitted
context with original provenance and missing-event markers; obtain current company state and
obligations through Gateway. Incompatible or missing context is an explicit limitation, not permission
to reset work history or silently continue with a different harness. Native resume cannot replay
external effects as though a transcript checkpoint were a transaction checkpoint.

Backups retain protected execution records, relevant configuration identities, operational data,
published artifacts, and restricted native context according to [deployment](INTEGRATION_AND_DEPLOYMENT.md).
Native files do not include reusable provider credentials or restored authority tokens. An old
backup can omit later revocations, charges, or effects: keep restored dispatch fenced until current
authority and actual state are established. Issue fresh identities after reconciliation; never use
the backup's generation alone to make an old credential current again.

[Observation](OBSERVABILITY_AND_CONSOLE.md) exposes requested versus observed state, evidence
sources, age, gaps, resources, and remaining obligations. [Validation](VALIDATION.md) must exercise
native useful work and bypass attempts under the same profile, then supervisor crash, lease expiry,
host sleep, ambiguous launch, revocation, descendant stop, and stale-backup recovery. Source review
supports the design inputs; these runtime scenarios remain unexecuted by this document change.


## Local Connected Runtime Manager

The original connected `gateway-probe` path claims one pending execution from Core and uses
Bollard 0.21.1 with only its Unix-pipe feature and a fixed Docker API 1.52 endpoint. That probe does not run
client-supplied commands. The program branch above adds admitted contained argv; neither path pulls
images, discovers alternative engines or releases a payload without Core's current authorization. The configured execution slot is protected by an exclusive
local supervisor lock. This is a bounded first connection, not the complete continuous scheduler.

The probe starts an immutable sleep bootstrap in a network-none container, arms the guard with a
write-only target FD, creates its bridge, records the actual binding in Core and obtains a single
release authorization. Only then does the fixed private probe call the common Gateway. The guard
drops to a distinct OS UID without supplementary groups or Docker access and survives Runtime
process death. The probe's output is limited to 64 KiB; creation/binding/finish records are written
and synced to Runtime-owned evidence files. Dependency failure, current-authority denial or local
process loss triggers containment. Stop acknowledgement and observed termination remain distinct.

`--reconcile <instance_id>` compares the retained ticket and binding with Core's assigned historical
record and the exact Docker container ID/instance label. It may observe and stop that original
container, then record termination. It never creates an instance or restores a revoked grant.
If a complete compute-return request was already persisted, it may replay that exact request;
it cannot infer cgroup/helper closure from container termination alone. Missing backend evidence or conflicting state stays unresolved. Existing
containers and evidence are retained for reconciliation; test-owner cleanup is separate.

The original connected payload was an environment probe. The native fixture below and the program
branch above extend the source separately; neither inherits the probe's qualification. Bootstrap
crash windows, whole-VM/host time behavior, pressure handling, evidence retention bounds and
native fresh-instance recovery remain qualification work. The full profile stays unqualified;
`runtime_ready` remains false. [Connected tests](VALIDATION.md#connected-runtime-probe-evidence)
record the narrower behavior actually observed.


## Native Fixture Runtime Candidate

The local Rust adapter adds `codex-fixture` alongside the observed `gateway-probe`. It preserves the
same guard, bridge, Core binding and current-authority polling, with bounded tmpfs at `/workspace`,
`/home/agent` and `/tmp` and no host bind mounts. The image must be an exact digest or local SHA-256
image ID. A static internal CLI build is a candidate for the existing pinned Codex fixture image;
the build and new profile remain unqualified until their Linux tests pass.

Before release, Core additionally requires the agent's current catalog input-read scope through
its ancestors and an active workspace target. Individual input requests still require their own
current Gateway permission. The App Server then uses attached Docker exec stdin/stdout inside the
instance. The adapter retains bounded native frames and separate bounded stderr, denies unexpected
server approval requests, and uses the supported external sandbox declaration only with the outer
physical containment. It neither reimplements the native loop nor passes login credentials.

The native model URL and MCP URL are fixed to the instance loopback bridge. Model responses are
controlled test data. Configured automatic model retries are zero, with no authentication or billing
fallback. A native completed turn alone is insufficient: the guest driver independently checks
actual CLI output, DB result and receipt, MCP use, and the publication manifest/receipt. Native
steer and interrupt now run through the common API and CLI, with correlated acknowledgements and
a matching interrupted event in the bounded Linux fixture. Native checkpoint persistence and
fresh-instance native session resumption remain unimplemented.
[Validation](VALIDATION.md#native-control-live-evidence) distinguishes this synthetic-model
execution from actual subscription use and semantic steering effectiveness.

## Original Allocation Observation

The Linux Runtime now opens the original cgroup directory and its `cgroup.events` before
private release. Both descriptors must belong to cgroup v2; capture requires an explicit
`populated 1`. The protected allocation record binds boot identity, directory device/inode,
events inode, instance and generation. Observation reuses these descriptors instead of reopening
a pathname that could refer to a replacement allocation. An ordinary file is rejected.

After the existing cgroup kill request, Runtime waits for its owned bridge child to terminate
and observes the pinned events descriptor for at most 100 ten-millisecond polling intervals.
It records `populated`, `empty`, or `deactivated`; the last means ENODEV from the original
initially live events descriptor, not a missing pathname. Other read failures produce a null
state, which supplies no closure evidence. Missing journals and interrupted observation likewise
remain unresolved. The observation does not replace the separate exact-container finish record.

The allocation observation itself records no capacity return or external-effect settlement.
After positive original-cgroup closure and bridge termination, Runtime retires and waits for its
owned guard child; uncertain observations leave the independent deadline intact. Child shutdown
waits are bounded to two seconds each. A complete candidate is recorded only when both helpers
are confirmed gone. The outer cleanup separately checks exact container ID, instance label and
non-running state before completing and persisting the return request. Core acceptance is recorded
separately from submission. Missing candidates retain the reservation.

Reconciliation replays only `compute-return.json`, which was persisted after all closure checks.
It first matches retained ticket/binding against Core and the exact backend container. It does not
upgrade an incomplete candidate, missing pathname or stopped-container observation into a refund.
Identical local acceptance markers are idempotent; conflicting markers fail. This path returns
only original compute capacity, retaining private work outcomes, external effects and input holds.
Kernel differences, reboot and interrupted closure still require qualification/reconciliation.

[Validation](VALIDATION.md#original-allocation-observation-evidence) records the tested subset.

## Native Turn Identity Implementation

The native fixture now retains up to 512 notifications received while waiting for a start
response, within its existing total evidence-byte bound. A completion arriving before that
response is processed against the subsequently confirmed turn identity instead of discarded.
The active turn binds the returned thread and turn IDs. Completion from another thread/turn
cannot complete it; missing identifiers or conflicting terminal statuses fail explicitly.

The local active-turn adapter constructs steering with its bound `expectedTurnId` and interruption
with its bound `turnId`. It does not expose model, working-directory or sandbox overrides through
these methods, and refuses control after observed terminal status. A request acknowledgement
is not a completion event. Core now admits user commands with current authority and fixed native targets. The fixture
Runtime polls, claims, rechecks and transmits one control at a time, then reports the correlated
native acknowledgement. Transport-loss reconciliation remains incomplete. They create no credentials or execution authority.

The native fixture reports its confirmed turn identity to Core after start response processing
and reports terminal observations before declaring the local fixture complete. A failed report
causes the existing containment path; it is not retried as a fresh native turn. The real-harness control fixture has passed with these reports and separate committed resource
receipts; this does not establish transport-loss recovery.

The JSONL channel retains partial frame bytes across cancelled receive futures. Polling Core
while native output is incomplete therefore cannot discard a prefix and reinterpret a suffix
as a fresh message. The existing frame and evidence limits still apply. Native terminal events
may precede a control acknowledgement; the adapter retains that distinction while waiting for
the outstanding response within the existing execution deadline.


### Native acknowledgement recovery

After validating a correlated native response, Runtime writes its attempt ID, native request ID
and accepted/rejected result into an external-owned receipt before sending it to Core. The file
is published without replacement only after its contents are synced; the parent directory is
synced before reporting. A conflicting existing receipt fails rather than overwriting evidence.
The original command ticket is separately synced before dispatch.

The existing stop-only `--reconcile` path validates Core history, instance generation and backend
identity, confirms termination, and reports saved acknowledgements to the original Core attempts.
It never dispatches native commands or starts a session. A claimed ticket without a complete
response receipt remains unresolved. Partial temporary files are not evidence; a crash before
receipt publication does not justify inferring success from logs or resending the command.
Duplicate receipt delivery uses Core's existing identical-acknowledgement transaction, including
after ordinary permission revocation. A receipt does not establish native turn completion.

Local receipt and transport tests cover this path's helpers. The real Codex fixture also passed
two stop-only receipt replays without changing acknowledged rows or native trace bytes. A bounded
Core transaction delay also passed: an undelivered saved native acknowledgement was reported by
recovery without another command attempt. Process-kill injection, after-commit response loss and
native terminal-report recovery remain unqualified.


### Observed native terminal recovery

The single-turn local profile persists a validated terminal observation before reporting it to
Core, using the same synced, non-replacing publication as acknowledgement receipts. The saved
record binds the execution and exact native thread/turn. Only `completed`, `interrupted` or
`failed` may be saved; an active turn, a different execution or a conflicting terminal result
cannot replace it. The stop-only reconciler first validates its original instance/backend binding
and confirms containment, then reports any saved terminal observation. Core accepts only the
original worker and a previously known turn, with its existing monotonic transition checks.

A missing terminal receipt remains missing evidence. Container termination, acknowledgement
acceptance and compute return never synthesize a native outcome. The current profile has one
native turn per execution; multi-turn receipt indexing and native checkpoint transfer are not
provided by this fixed terminal file. Reconciliation can report an already observed result but
cannot recover an event that was never durably observed.


### Native state transfer implementation boundary

The selected Codex 0.153.4 binary's default generated `ThreadResumeParams` requires `threadId`.
That generated public shape has no `history` or `path` import property. This is narrower evidence
than a claim that every experimental build lacks import support. The first connector must not
invent an inline transcript import or treat `thread/read` output as a supported resume file.
The public App Server documentation also describes restoration of dynamic tools from persisted
rollout metadata; stored native context therefore cannot be accepted as current tool authority.

The next implementation increment must identify the exact native persisted state needed by the
pinned build, then transfer only an admitted immutable checkpoint into a fresh instance's private
home. It must not copy an entire previous home, login cache, host config, socket or credential.
The native thread identity and persisted state must agree. Missing or incompatible state fails
explicitly instead of silently creating a new conversation. The current execution profile fixes
model routing, tool connections, approval behavior and physical containment independently of the
checkpoint, with all actual external operations still checked by Gateway.

Checkpoint creation must produce a bounded immutable artifact plus provenance tying it to the
work, predecessor execution, native build and observed cut. Retaining a checkpoint does not
qualify its cut as a company transaction snapshot: committed receipts and unresolved effects
continue to be reconciled from company records. Successor admission must check current read
rights to that exact artifact and current execution authority. Native state capture/import and
its actual fresh-instance continuation remain unimplemented; the schema check alone is not a
successful session restore.


### Native checkpoint capture candidate

After a non-failed terminal observation, the current fixture captures the single rollout path
returned by the bound native thread. It accepts only the selected profile's session layout and
canonical thread filename, reads as the private UID inside that same container, and caps capture
at 4 MiB with a three-second deadline. The parser requires complete JSONL records, a first
`session_meta` with the matching thread ID and no second session metadata record. The external
capture manifest records execution, native thread/session, source path, observed terminal,
byte count and digest. It explicitly carries `resume_qualified: false`.

These are bounded private-source bytes in Runtime evidence, not an admitted company checkpoint.
No whole-home, owner login or configuration import is performed. The reader does not yet pin a
stable file descriptor across all private path components or establish a quiescent native write
cut; pathname validation and JSON parsing do not prove those properties. The data may have been
modified by private code. An incomplete or failed capture cannot be restored from its manifest.
Immutable artifact publication, storage accounting/retention, stable-cut validation and current
read-authorized successor delivery must be connected before this becomes an available resume path.


### Single-file restore compatibility result

For the observed legacy session in the pinned 0.153.4 build, the selected rollout alone was
sufficient for a fresh App Server in an empty private home to resume the same native thread and
previous turn. The explicit new cwd/provider settings were reflected in its response. The probe
started no turn and had no outbound network or credentials. This establishes the first candidate
transfer format without introducing an unsupported transcript-import API or copying native auth.

The company integration must still publish and retain those bytes as a currently authorized
artifact, bind the exact checkpoint and native build to successor admission, deliver it under a
fresh instance identity, and start any new turn using current conditions. The standalone probe's
disabled MCP configuration cannot replace the actual task's required, authorized connections.
No raw prior container path may serve as a user-selected host restore destination.


### Managed checkpoint artifact connection

The existing generic upload and separate publication path can carry both selected native session
bytes and their capture manifest. An actual fixture publication and revision-specific download
passed, including denial after current read permission was withdrawn. There is no separate
checkpoint blob store or privileged Runtime catalog writer. Native checkpoint input admission
must reuse the same verified publication/object resolution and retained-input barriers as program
inputs, while keeping native invocation and its control channel distinct from an arbitrary argv.

That next admission must bind a same-work terminated predecessor, the exact published checkpoint
revision/object, native identity/build and current human/agent read and execution authority.
Restoring content must not restore a previous grant or replace unresolved company effects. The
existing artifact-backed program input implementation supplies reusable mechanisms; native-mode
admission and materialization are still required before exposing a working native successor.


### Materialized native admission contract

The existing input-bearing request now has an optional `native` invocation containing an explicit
prompt and optional `resume` selector (`thread_id`, `checkpoint_destination`). Its activated
input profile must explicitly set `native_codex: true`. A native invocation has empty `argv`;
ordinary argv and native invocation cannot be mixed. Legacy requests/profiles omit both additions
when absent, preserving their serialized manifest inputs. The materializer validates only the
shared immutable input contract; it does not acquire permission to choose the native method.

A resume selector must identify exactly one admitted input destination and requires the ordinary
same-work predecessor. Core additionally requires an observed terminal native thread on that
predecessor and the same immutable image in its stored native profile. Fresh native invocation
requires no predecessor. Existing publication lineage, current human/agent input permissions,
retention, shared capacity and confirmed predecessor closure checks still apply. The native
prompt is bounded and creates no independent authority.

Core represents this candidate and produces the retained-input ticket. Runtime now connects
materialization and release to the native driver; the earlier temporary pre-claim rejection is
removed. This code path still requires a compatible image and a connected qualification run.
No live profile was activated by this change.
The existing separate legacy fixture and ordinary program paths remain their respective tested
paths; native successor execution is still unavailable.


### Materialized native Runtime connection

For an explicitly native input profile, Runtime completes the same guarded materialization,
receipt check and Core release as ordinary input-bearing execution, then runs the controlled
App Server driver instead of private argv. The independent supervisor remains responsible for
current permission, bridge/guard lifetime and containment. The driver rechecks current Core
execution state before thread start/resume and before starting a new turn. It uses the admitted
prompt, the activated profile's model, the fixed Gateway settings and the existing
deny-unexpected-approval behavior.

The activated `ProgramProfile` may set `native_model` only with `native_codex: true`. The identifier
is 1–128 ASCII letters, digits, dots, underscores, colons or hyphens and is included in the retained
profile and materialization digest. Omission preserves `fixture-model` and its legacy fixture MCP
registration. An explicit model omits that fixture registration while retaining the work-scoped
managed MCP path. Both native startup and thread start/resume use the admitted model; the provider,
loopback Gateway endpoint, disabled automatic retries and credential-free instance remain fixed.
This selection supplies neither a provider connection nor subscription compatibility evidence.

For resume, Runtime selects the exact admitted workspace input, checks its size/digest and native
session identity, and installs those bytes into a fresh private native home before starting the
harness. An existing `.codex` home is rejected. The destination is generated from the canonical
thread UUID inside the profile, not taken from an old host path or submitted manifest. The copied
bytes are read back and compared, and an external restore record binds execution, instance,
generation, input index and digest. The source is read before any private payload starts, after
the trusted materializer has completed. Installation has a bounded deadline and grants no prior
permissions. A rejected resume does not fall back to a new conversation.

This branch compiles and its byte/identity checks have unit coverage. The standalone native resume
probe predates this integrated branch. A combined native/materializer image and first current-
authority predecessor/successor run remain required; none of the earlier fixture results qualify
this new path. Physical crash durability and adversarial checkpoint-cut validation remain separate.


### Fresh materialized native path qualification scope

The combined native/CLI/materializer image and fresh native input path have now passed the
connected guest fixture: managed input publication, current-authority materialization and release,
actual Codex input use, synthetic-model resource workflow, steer/interrupt and repeated recovery.
Captured session state was also published back into the managed input namespace with current
read-right enforcement. The native successor installation/resume branch remains awaiting its
integrated predecessor-to-successor run. These results do not qualify provider credentials,
actual subscription use, physical-failure checkpoint cuts or production operation.


### Connected native successor scope

The managed predecessor/checkpoint/successor path has passed one actual guest run. The old read
right was rejected; explicit new fixture grants authorized the original task input and exact
checkpoint. A new instance resumed the same native thread and completed a new turn, with original
company effects preserved and both compute allocations returned. This proves the connected
mechanism for that pinned image and synthetic workload, not general trust in private checkpoints
or actual model profitability/behavior. No prior grant is restored by the native session.
The remaining qualification includes adversarial cuts, mid-restore authority changes, incompatible
state, real provider custody and crash recovery. Autonomous wake conditions are still separate work.


### Verified checkpoint rejection scope

Actual integrated successor tests now distinguish artifact integrity from native validity: a
correctly hashed/published file carrying another native session ID, or lacking the required final
record boundary, is rejected after materialization and before native startup. No successor model
call occurs, existing company effects and input references remain, and observed closure permits
compute return. These results qualify only those specific cases; they do not make arbitrary
private history trusted or remove the need for current authority throughout restoration.

### Verified revocation during checkpoint reading

A bounded guest fixture now holds the exact checkpoint read after managed input materialization.
The normal human CLI revokes the successor's parent delegation while that read is pending.
The independent Runtime supervision observes the current-authority HTTP rejection, aborts the
restore future and contains the instance. This run produced neither a restore-complete receipt
nor a native protocol trace, and Core recorded no successor model call. Original company effects
and retained input references survived; both instances had confirmed compute returns.

The barrier belongs only to a derived test image: its `head` wrapper holds the single checkpoint
input path before private payload startup. The Runtime implementation and unmodified Codex binary
are unchanged. This tests authority loss during reading, not every instruction boundary during
installation, VM suspension or an already running native session. Those cases retain their
separate qualification requirements.

### Timer-created native continuation

The same managed checkpoint successor path has now passed using a Core timer occurrence as its
execution admission source. Runtime uses the ordinary claimed ticket, current permission checks,
input materialization, isolation and native resume sequence; it does not interpret a timer or
choose private work. The observed new instance resumed the same native thread, completed a new
synthetic-response turn and returned compute while retaining prior company effects. This does
not yet qualify persistent user conversation delivery or a real subscription-backed successor.

### Complete program output observations

For non-native contained programs, Runtime hashes stdout/stderr incrementally while enforcing the
existing combined byte limit. Only a complete stream, synced output files and observed Docker exit
produce the protected local `program-observation.json`. The observation binds the input manifest,
instance/generation and exec ID and is submitted to Core separately from allocation closure.
Native turn reporting is unchanged. Output failure or canceled observation does not invent an exit
record. Raw private output remains in the protected Runtime evidence location.

Normal completion forwards the saved observation through authenticated Runtime control. Explicit
reconciliation can replay that same saved observation after termination; a missing file cannot be
reconstructed from an empty container or returned capacity. Replay adds no process execution and
cannot replace the original receipt with a more favorable result. Local output and its Core-bound
hashes remain evidence about a process, not an independent evaluation of the adapter's behavior.


The first native adapter integration uses separate outer-owned execution-slot evidence roots for
the native caller and adapter worker. Each supervisor retains its exclusive slot lock; both use
the same authenticated Core, Gateway and fixed Docker backend. The adapter worker selects its
explicit profile and cannot claim the native caller's profile. Source and verification executions
run sequentially in the adapter slot; the admitted child then runs concurrently with the native
caller. Separate slots do not increase delegated capacity or create an additional approver.
This is a bounded local fixture arrangement, not a persistent worker-pool implementation.

For an already running approved adapter, an activation stop makes current Core/Gateway authority
checks fail. The program supervisor exits the work path with that authority error and independently
performs containment, actual termination reporting and eligible compute return. The local fixture
checks these records even when the Runtime process exits nonzero; it does not reinterpret interrupted
work as successful execution. Output captured before interruption may exist without a complete
program observation. Its retained input dependencies are not released by the unstarted-cancellation
path, because a dispatch and instance already existed.

### Finite worker mode for one execution slot

`ouroboros-runtime --config <runtime.json> --max-executions <1..100>
--idle-timeout-seconds <1..300>` keeps one exclusive configured slot across a finite series of
independently admitted executions. The idle limit defaults to 30 seconds. Omit `--max-executions`
for the existing one-execution behavior. Worker mode and explicit reconciliation are mutually
exclusive. Bounds are operational limits, not delegations or permission to create work.

The worker selects pending intents only from its fixed profile. Each execution repeats the existing
Core claim, current authority, backend/socket checks, materialization, independent deadline guard,
termination and eligible compute-return path. A worker cannot extend an instance deadline by staying
alive. It reuses no instance identity or private filesystem between requests. The exclusive slot lock
remains held while idle, preventing a second supervisor from owning the same slot. Other explicitly
configured slots remain independent and share Core's resource limits.

After the selected number of successful contained executions, the worker emits
`execution_limit_reached`; an empty queue reaching the idle limit emits `idle_limit_reached` without
creating an instance. Any claim, authority, containment or backend error ends the worker rather than
retrying an ambiguous request or generating replacement work. `completed_executions` counts completed
Runtime paths, not successful company outcomes. Queued and unresolved records remain in Core for
current-authority inspection and explicit recovery. This mode reuses a slot for a finite run;
a managed private service's request/data continuity still requires its own connected contract.

### Persistent supervisor and original claim recovery

`ouroboros-runtime --config <runtime.json> --service --poll-interval-seconds <1..60>` holds one
exclusive configured slot until stopped or an error occurs. Polling defaults to two seconds.
The service does not exit because its queue is empty or a fixture execution count is reached.
It requires an independently managed guard; the direct-child fixture guard is refused. Service,
bounded-worker and explicit recovery/inspection options cannot be combined.

Each instance still has a separate Core admission, current grants, fixed program/profile,
finite resource reservation and original deadline. Normal completion requires actual containment,
termination and accepted compute return before this slot can take another execution. The process
does not create successor work or retry a failed claim. Its completion counter is an observation
of this supervisor lifetime, never a resource allowance. Company scheduling and business outcomes
remain separate from an available outer worker.

Before sending a claim, Runtime reads `GET /runtime/claims/{intent_id}` through its configured
service identity. Core returns an environment/firm/serving-generation/worker/intent/execution/profile
precondition and the existing assignment, if any. A claimed record is visible only to its assigned
worker, including after grant revocation. The response contains no private program input or secret.
This endpoint is read-only and does not claim, reserve, replay or authorize another execution.

Runtime fsyncs `pending-claim.json` in its protected slot before posting the claim with
`x-ouro-runtime-claim`. Core compares the precondition within the admission transaction before
claiming. Worker identity still comes from the authenticated Runtime peer. The additive header is
optional for older direct Core callers; the updated supervisor always supplies it. Ordinary Core
restart changes the claim precondition while preserving the original durable record identity.

The pending record survives response loss, crash, stop and configuration mismatch. Reopening the
slot first reads that original intent. Only matching identity, a terminated assignment and Core's
accepted compute-return record allow it to archive the resolution and remove the barrier, with
directory sync at each step. No claim or external-effect request is resubmitted during this lookup.
Missing, unclaimed, changed, partially written or unresolved evidence blocks further execution.
Legacy instance journals are also checked before starting service mode; absence of a pending marker
in an older release is not cleanup evidence. Read bounds distinguish small claim records from
larger admitted program journals.

`--inspect-claim <intent_id>` exposes the original read-only observation for diagnosis. The existing
`--reconcile <instance_id>` remains a stop-only path for an instance with retained binding evidence;
it clears a matching pending barrier only after qualified compute return. Pre-binding failures
without that evidence remain unresolved and require explicit recovery; starting a different slot
or inventing a new request key is not recovery. Compute return never settles external obligations.

The host stop listener remains active while waiting, and stops further claims. An already sent
claim is awaited with a bounded transport timeout and retained on uncertainty, rather than dropping
its future and continuing. In-flight private work uses the existing containment cleanup sequence.
Systemd service mode retains `Restart=no`, memory/task limits and managed-guard enforcement.

The named `native.persistent-worker` scenario covers two separately admitted contained executions,
idle survival, exclusive slot ownership, explicit stop and reopening with original return records.
Its registration and cross-compilation are not Linux execution evidence; qualification status is
recorded in the [app/runtime work record](../implementation/MAC_APP.md).

### Guard service independence: current boundary

Without a `managed_guard` configuration, the existing fixture Runtime starts the guard as a direct
child, drops its UID and calls setsid. That separates sessions but does not move the guard outside
the supervisor's service cgroup. Do not wrap that mode in a control-group-killing service unit and
claim independent guard survival. The service renderer has a separate privileged Runtime profile
requiring a managed guard; its launch and shutdown qualification is recorded in VALIDATION.md.

The legacy standalone probe accepts a fixed write-only cgroup v2 kill descriptor as stdin
(FD 0); stdout and stderr are never targets. The managed Runtime path instead passes a private
Unix datagram socket as stdin and transfers exactly three CLOEXEC descriptors: the original
write-only cgroup.kill handle, original read-only cgroup.events handle, and a fresh write-only
root-owned receipt file. The guard checks the root socket peer, descriptor inventory, cgroup
filesystem/access modes and protected output metadata. It receives neither Docker access nor a
new target path to open. The unit bootstrap capabilities are limited to UID/GID drop.

Before acknowledging readiness, the managed guard arms an immutable absolute BOOTTIME timerfd
and blocks SIGUSR1 for signalfd delivery. A root-origin early-stop signal can shorten the wait;
it cannot change the target or extend the deadline. After attempting the fixed kill, the guard
observes the original events handle until populated=0 or its original allocation is deactivated
(ENODEV), with a bounded observation interval. Only then does it write and fsync a complete
closure receipt containing the deadline and original events device/inode. Receipt output is a
separate descriptor from the readiness/log pipe, so losing the launch helper does not lose the
closure record. A missing, partial or failed receipt remains unresolved.

The probe confirms survival when the launcher's entire unit cgroup is SIGKILLed and the target is
emptied at the original deadline. Runtime now supports this handoff through an explicit
`managed_guard` object: `systemd_run`, `systemctl`, `setpriv`, positive `memory_max_bytes` and
`tasks_max`. Paths use the existing configuration-root resolution; executable files and their
original/resolved ancestors must be protected and root-owned. Missing tools, invalid identity,
handoff failure or unavailable process observation fail the managed path without direct-child
fallback. The selected guard binary is checked before use as well.

After the exact deadline ACK, Runtime obtains the unit's actual MainPID, pins it with pidfd, and
checks UID, no-new-privileges, effective capabilities, executable, independent cgroup and stable
boot/start-time identity. `guard-binding.json` records this identity, unit, instance, generation
and immutable BOOTTIME deadline, plus the receipt file device/inode. A launch helper's exit while that guard remains alive is degraded
supervision; it is not termination and cannot return capacity. Runtime keeps the guard outside
automatic Drop cleanup. Only after payload closure and bridge termination does it signal the
original guard through pidfd with SIGUSR1, allowing it to persist closure before exiting, then
observe that process's exit and reap its helper. Transient unit
collection does not erase the protected binding/closure records or establish economic settlement.

The actual native fixture exercises the managed handoff and early retirement. Runtime's stop-only
reconciliation now also reads the protected guard binding, checks its instance/generation,
deadline, unit and configured UID, and observes the recorded process through pidfd when possible.
It records `running`, `gone`, `pid_reused` or `different_boot`; absent legacy evidence is
`not_recorded`, and a direct-child record is `direct_child_unqualified`. Binding mismatch or an
unavailable kernel probe fails rather than declaring the guard gone. Observation alone neither signals an orphan nor returns capacity. It is included in the
reconciliation record and CLI result. A changed boot is not qualification of restored deployment
freshness.

A separate recovery step can reconstruct a missing compute-return receipt only from the original
guard closure evidence. It requires the existing Core allocation binding, confirmed container
termination, original bridge and guard gone (or their PIDs reused), and the same boot. It opens
the protected receipt without following symlinks and checks root ownership, permissions, single
link, original file device/inode, complete bounded JSON, original deadline and cgroup.events
identity. After syncing this evidence, Runtime persists the exact compute-return receipt and
submits it through Core's existing idempotent return operation. Repeated reconciliation returns
capacity once without rerunning private work or duplicating company effects. Missing evidence
keeps the reservation; mismatched evidence fails recovery. Legacy guard bindings without this
receipt cannot gain proof merely because the container stopped.

The combined Runtime-unit failure fixture checks guard survival and this stop-only recovery;
its current qualification is recorded in VALIDATION.md. Early retirement of a still-live orphan,
legacy recovery without an independent closure receipt, actual persistent privileged Runtime
installation qualification, host shutdown/suspension, syscall restriction and pressure
behavior remain unqualified. The separate launch-unit probe does not substitute for those cases.

### Host-requested Runtime stop

The single-execution and bounded-worker entry points register SIGTERM/SIGINT before admitting
work. A stop request prevents the next observed pending-work claim. An already in-flight claim
is not cancelled: its response may carry an existing reservation and must retain the normal
journal/cleanup path. A stop is checked again before starting the private container. If an
execution has reached its armed containment scope, stop interrupts private activity there and
runs the existing pinned-cgroup kill, bridge termination, guard closure, actual container
observation and qualified compute-return sequence. It does not drop the entire execution future
from outside that scope. Failure to record the stop request still enters containment cleanup.

An idle worker can exit without taking new work. Interruption of an active task remains a
non-successful task outcome and the worker does not start another execution. A process stop is
neither delegation revocation nor admission pause for other workers, and no economic obligation
is settled by the signal. Host maintenance must first pause admission through the existing
Gateway authority, stop the Runtime main process, observe termination/evidence and reconcile
unresolved outcomes. Sending SIGTERM to every process in its cgroup also terminates the bridge
and does not qualify this graceful main-process path. Force-stop timeout or Runtime loss still
uses the independently armed guard and explicit recovery; it never extends an execution deadline.


### Owner observations for finite call continuation

The fixed control plane projects registered continuations through work-scoped listing and exact-root
inspection. Metadata includes frozen target selection comparison, current original-caller resource
permission, retained-input counts, current/replacement executions, child intent receipt availability
and permitted firm compute totals. No invocation payload, target configuration, receipt body or
secret is included. Reads do not poll the controller, admit executions, emit events or consume a new
restart allowance. A separate issuer-specific stop-request lookup reconciles response loss without
resubmission. Existing stop/termination/return fences continue to own application state.

This projection does not implement permanent request-serving services, qualified health/liveness,
reserved dependency capacity, cross-instance binary delivery or native agent continuation. Actual
Linux Company process restart and native app control must be accepted against real worker/process
records separately from SQL fixtures and UI presentation tests.

## September 19 acceptance correction: restricted operation versus supervisor failure

The actual Linux Company-continuation acceptance reproduced a cleanly stopped operation returning
its reservation but also terminating the persistent Runtime with an HTTP 403 error. The program
permission observer now marks only the authenticated current-execution 403 as an execution
restriction. After the original kernel closure, exact termination/compute-return acknowledgement,
and claim resolution succeed, service mode may retain its slot and await separately admitted work.
Bounded workers and all other errors keep their existing failure behavior. A matching error string,
transport failure, absent return or changed assignment is insufficient. The operation's failure
journal, stopped state and unresolved business outcome remain recorded; this is not a success
classification for Company work.

`native.program-continuation` exercises the actual mechanism and owner CLI control. Native Mac
control remains a separate screen/IPC acceptance item.
