# Observability and Console

This is a proposed component design under the [Architecture](../../ARCHITECTURE.md) and
[Contracts and State](CONTRACTS_AND_STATE.md). It specifies evidence collection, authorized
inspection, and control feedback. It does not implement a screen, API, telemetry schema, or
operational delegation. Visibility covers meaningful company work, not hidden model computation.

The first implementation acceptance surface is the HTTP API and Rust CLI against the Rust
backend. Both use the shared Gateway; a TypeScript console is a later, independently replaceable
client. The five views below preserve its intended information design without making screens
a prerequisite for validating execution, evidence access, or effective control.

[Application Shell and Views](APPLICATION_SHELL_AND_VIEWS.md) specifies the Mac client's screen
composition and interaction boundaries: fixed control, required domain baselines, and configurable
company views. The views below define evidence needs, not an exhaustive or immutable menu. Screen
composition inherits these observation contracts and does not create another source of company truth.

## Evidence Sources and Ownership

The Core owns protected execution and control records. Runtime Manager, Gateway, and Resource
Services submit observations through scoped ingestion; private work supplies attributable reports.
The console reads authorized projections of these records and retained artifacts. It cannot write
an observed state merely because a user clicked a control or an agent announced completion.

| Source | What it establishes | What it does not establish |
| --- | --- | --- |
| Private reports and native harness events | What the bound actor or harness reported: work purpose, delegation, messages, tool intent, progress, results, and decision explanations. | Independent confirmation of resource use, external effects, correctness, or complete internal reasoning. |
| Runtime observations | Observed instance identity, activated profile, lifecycle, applied restrictions, local resource use, exit, and collection status. | Business completion, settlement of provider resources, or a fine-grained authority boundary between subagents sharing one instance. |
| Gateway and Core records | Authenticated requests, admission or denial, reservations, dispatch claims, current restrictions, and accepted control commands. | A remote effect merely from admission, a socket write, or a successful local transaction. |
| Resource and provider observations | The provider response, callback, lookup, resource state, usage measurement, or invoice actually obtained and its confirmed stage. | Infallible provider truth, finality beyond that stage, or no later costs or obligations. |
| Reconciliation records | Which observations were compared, the discrepancy, the current conclusion and uncertainty, and who remains responsible. | Retroactive erasure of conflicting evidence or permission to repeat an uncertain action. |

Authenticate the source channel and bind observations to its actual scope. A private event may
name another actor, but cannot author that actor's identity or a Runtime-confirmed lifecycle fact.
Retain occurrence time and receipt time separately; preserve provider ordering where supplied.
Clock ordering alone does not establish causal order across independent sources.

For example, a harness may report a successful order tool while the Gateway holds an unresolved
attempt and the broker later confirms a partial fill. Keep all three records. Link the broker
order to the attempt, expose the earlier discrepancy, and update the reconciled stage without
rewriting the harness report. An apparently newer summary cannot suppress an unresolved effect.

## Collection, Durability, and Retained Content

Runtime collects native event streams and local execution observations outside the private
instance's writable control. Gateway and Resource Services capture attributable requests and
provider observations even when private code emits no useful progress. Document each harness's
available event coverage, continuation guarantees, and known omissions; unsupported detail is
unavailable, not a fabricated common trace. A hook installed inside private execution remains a
reported source even when its transport to the outside is reliable.

Core ingestion assigns protected record identity after validating producer, scope, and references.
Deduplicate a replay by its producer and occurrence identity; preserve a conflicting payload as
a discrepancy rather than overwriting the first record. Link later observations and corrections
to their predecessors. Projected status must remain explainable from retained source material.

| Retained material | Required treatment |
| --- | --- |
| Admission and control basis | Preserve material input, authenticated context, relevant delegation/configuration revision, decision, bounds, and dispatch identity. |
| Native work and execution | Retain relevant messages, tool inputs/results, delegation events, and published decision explanations with their source and coverage. |
| Artifacts and provider evidence | Keep the necessary content, provider/resource identity, observation stage, and provenance in protected records or the outer-owned artifact store. |
| Observation limitations | Retain gaps, truncation, inaccessible content, failed collection, redaction, and the actual scope of every completeness claim. |

A content hash verifies a retrieved object's identity; it is not retained evidence if the object
has disappeared. Store large material outside the control database and retain protected references,
integrity information, and the permissions needed for later inspection. Artifact publication means
content was submitted, not that its claims were independently verified or its code activated.

A producer receives an ingestion acknowledgment only after the required record and retained
content are durably accepted. Distinguish that receipt from an HTTP transport acknowledgment or
an observation temporarily held by a collector. Dependent completion is not asserted while its
required evidence remains only in an uncommitted queue.

During storage failure, a bounded spool owned by the outer environment can preserve observations
with their original identities and retry ingestion. Spool durability, occupancy, oldest pending
record, replay progress, and failures are observable. It is a recovery buffer, not a second
authority store: it cannot admit new effects when Core cannot establish current authority.
When required evidence can no longer be retained, restrict affected activity under the already
authorized failure policy. Do not silently drop material records or mark the resulting gap closed.

Sampling may reduce optional diagnostics, not admission, control, material effect, cost, or
responsibility evidence. Retention is an explicit resource commitment, with access obligations
and outstanding dependencies considered before deletion. Removing an agent, connector, or old
projection does not remove required history. No perpetual retention or arbitrary duration is
invented here; absent required retention and capacity settings block dependent activation.

## Correlation and Query Projections

The common navigation path is work origin or wake occurrence -> work -> responsible principal
-> admitted desired execution and actual instance -> intent and attempts -> artifact/provider effect
-> usage and cost -> subsequent private evaluation. Work may have several instances, and an effect may
outlive all of them. Preserve those relationships instead of forcing the company into one session
tree. Native subagent identifiers remain provider-scoped and do not become verified principals.

A Gateway-bound correlation reference connects native traces to protected records. A client-sent
trace id is a search hint, never authentication or a reason to merge unrelated effects. Missing
joins remain visible. Unmapped resource use remains attributable to its verified caller/account
while reconciliation investigates; it is not discarded to keep a work total tidy.

Query projections support lists, timelines, aggregates, and search. Each response identifies its
observation boundary and projection freshness. Rebuild them from Core records and retained content;
neither a search index nor a tracing backend becomes the source of current authority. When a
projection lags, controls still use current Core state and clients see the lag instead of a false
claim that the displayed state was used to authorize an action.

Company business projections use [the result/outbox and primary-reference contract](CONTRACTS_AND_STATE.md#company-results-projections-and-primary-references).
Business-record commit and a replayable receipt/outbox share their local transaction; protected
ingestion authenticates and deduplicates the original producer/intent/schema before acknowledging.
The projection watermark covers accepted ingestion, not the producer's claimed latest state.
Multi-store snapshots expose coverage rather than pretend atomicity. Incompatible service/schema
changes reset that projection's cursor; historical records retain their original bindings.
Notifications resolve a primary typed source independently of related execution IDs or currently
loaded lists. Company interpretation, provider receipt and Core control outcome remain attributable
to their different producers; no Company event may rewrite protected authority or claim execution
termination. Receipt-only recovery can observe an old attempt without reviving its dispatch rights.

Freshness is specific to the fact and dependency: a collector heartbeat does not refresh an old
broker balance. Show last observation, receipt, known gaps, affected work, and unavailable sources.
Missing, stale, restricted, unresolved, and measured zero are distinct. Aggregates with incomplete
coverage state their included scope and unknown remainder where that disclosure is authorized;
they never present an accessible subset as a verified company total.

## Authorized Inspection, Streaming, and Export

Initial inspection uses the HTTP JSON snapshots, paginated detail, and SSE payload contract in
[Contracts and State](CONTRACTS_AND_STATE.md#status-snapshot-and-event-contract), exposed by the
canonical API and CLI operation table in [Gateway](GATEWAY.md#client-surfaces-and-routing).
Those documents own field names, required values, event kinds, cursor
semantics, and error shapes; clients must not invent a separate console schema or infer completion
from transport success. This document owns how their evidence and uncertainty are interpreted.
Human clients and workloads authenticate differently but pass the same current action, resource,
and condition checks. Neither CLI nor browser has a direct Core database or artifact-store path.

Render the common source fields rather than flattening them into one unqualified status: producer
and source kind, original occurrence and receipt times, confirmed stage, evidence references,
applicable generation, and uncertainty. The view cursor and projection boundary describe the
authorized observation view, not a new underlying fact or a substitute for native source identity.

A snapshot returns the authorized state with its common `cursor`. Subscribe from that boundary and
apply identified updates without interpreting duplicate delivery as a new fact. Snapshot and
cursor must describe the same boundary so a change between loading and subscribing is not lost.
Ordering within this view does not invent global provider ordering or fill a native trace gap.
Use the common `GET /events?view=...` route and opaque reconnect cursor via `Last-Event-ID`.
The snapshot and event field tables in the common contract are authoritative for both clients;
the CLI does not substitute its local receipt sequence for the server's cursor.

Check current permissions at query time, on each page and artifact read, and before releasing
incremental stream content. The initial human mTLS profile requires both a valid client certificate
and its current Core binding to an existing principal. Certificate, principal, or read-scope
revocation applies to open streams as well as new requests. A successful TLS handshake does not
freeze authorization for the connection's lifetime. Revocation narrows or closes a stream and
invalidates affected cached views; a once-authorized cursor cannot preserve access. Permission
changes that alter the view require a new authorized snapshot, not an old broader subscription.
Already delivered information cannot be unread, and the console must not claim otherwise.

Bound subscriptions and output queues. A slow client, expired cursor, unavailable projection,
or discontinuity receives an explicit resynchronization requirement; it fetches a fresh authorized
snapshot rather than silently continuing after omitted events. Show disconnected and stale views
as such. The SSE cursor is delivery progress, not evidence that every company action was observed.
Reconnect authenticates again and checks current read permission before accepting the cursor.
Where the authenticated stream may disclose the problem, use the common `event_type=gap` response
with its authorized range/reason or explicit unknown extent, end that continuation, and obtain a
fresh snapshot. A denied disclosure must not leak protected gap details. Do not synthesize missed
records, emit a fake complete event, or infer that no work ran during the gap.

Prevent usable credentials from entering logs, trace attributes, URLs, events or evidence payloads.
Apply source-side minimization and protected ingestion handling, then permission-aware redaction
at query/export time. A raw provider error is not exempt. Retain necessary non-secret original
material through separately restricted content access; a retention or audit requirement does not
create a credential-read route. Preserve verifiability, safe correlation and material consequences
while marking authorized views as redacted or incomplete. Treat rendered model text and artifact
content as untrusted, never executable controls.

Export is a separately scoped operation for an identified recipient/destination and bounded data
selection. Recheck authorization while preparing and releasing it; record requester, scope,
redaction, snapshot boundary, content identity, and completion or failure. Downloads remain on the
Gateway path, not directly usable provider URLs. Audit material evidence access and export without
copying the protected contents or credentials into the access log. Evidence-access auditing uses
a bounded internal append path and does not recursively generate an audit record for every append.

## First Acceptance Through API and CLI

The Rust CLI implements the canonical [Gateway command mapping](GATEWAY.md#client-surfaces-and-routing). It submits the
same operation and stable request identity as any other authorized API client; a local command
must not call privileged backend code directly. Keep machine-readable output faithful to the
common management result and event payloads; native provider commands keep the Gateway's native
output contract. Human-readable output is a rendering of that data, including
unavailable fields, source qualifications, and gaps, rather than a second status computation.

An accepted `execution_id` names the durable desired record before Runtime has necessarily created
an instance. Display desired state and admission/queue status separately from the observed
`instance_id`, backend binding, lifecycle, and observation time. An absent instance is not
a running process, a confirmed failure, or a fabricated zero identifier. A replacement can bind
a new execution and instance to the same continuing work without erasing earlier attempts and effects.

For inspect/watch output, make queue, dispatch claim, observed execution, unresolved outcome, and
remaining responsibility distinguishable using the common vocabulary. A launch acknowledgment
does not prove startup; an accepted stop does not prove termination. On reconnect, inspect the
existing desired execution, actual instances, and control record before deciding whether a command
needs another delivery. Do not generate a new request identity to repair an unknown acknowledgment.

The first acceptance run demonstrates authorized inspection, a snapshot followed by events,
reconnection and explicit gap recovery, and a restriction followed through actual application.
It includes observed results and required retained evidence, not just a command exit code.

## Operating Responsibility and Owner Oversight

The company roster presents continuing logical agent identities, their distinct current responsibilities,
actual executions, original contributions and observed collaboration. It inherits
[Company Agent Identity and Membership](CONTRACTS_AND_STATE.md#company-agent-identity-and-membership).
A team-like presentation must be backed by those records; a familiar avatar or name is not evidence
of activity, appointment or authority. Direct inspection remains available without an agent reply.

The [initial CEO profile](../../ARCHITECTURE.md#initial-private-operation-one-ceo-role) adds an
operating view over existing authorized work, artifact and event records. The first proof remains
API/CLI inspection; it does not require a graphical console or a second management backend.

| Owner-facing question | Evidence and distinction |
| --- | --- |
| Who currently carries operation? | Core's standing work, assignment revision, current principal and selected execution; Runtime's actual instance and last observation. A title or familiar session name is insufficient. |
| What is being pursued, and why? | Private decision record, rationale, scoped child work and requested commitments. Keep the agent's explanation distinct from admission and observed execution. |
| What actually resulted? | Resource receipts, artifacts, usage/cost observations and unresolved effects linked to the private evaluation. The CEO's summary cannot replace contradictory evidence or establish profitability by itself. |
| What needs an owner decision? | A concrete pending action, rationale, scope, prepared evidence, uncertainty and exact missing authority or authentication. Approval status comes from the relevant control/enrollment record, not a sentence in chat. |
| What happens next? | Private continuation/stop decision, registered wake conditions, last consumed occurrence and current eligibility. Distinguish authorized waiting, blocked operation, an unobserved executor and pending handover. |

Present important exceptions, results and decisions first, with authorized drill-down to original
records and retained earlier revisions. The owner can inspect individual worker actions and
controls without becoming the everyday dispatcher. Neither a reassuring activity indicator nor
an agent-reported completion substitutes for actual observation. Secret values remain excluded
from every view, including a view with comprehensive operational audit permission.

The CEO prepares proposals and explanations; the trusted client renders and submits privileged
controls through Gateway under the actual human's identity. Approval cards identify immutable
proposal/release and scope references, and stale decisions must be revalidated before application.
Model-authored text, forms or tools cannot collect credentials or manufacture an approval event.
Owner takeover, where later supported, uses current human permission and the same Gateway; it
does not borrow the executor's identity or create an unobserved direct resource path.

On replacement, show requested handover, outgoing-instance cutoff, actual fencing, pending old
effects and accepted successor separately. CEO absence does not mark all child work stopped;
show each child's observed state and current grant status. Preserve the outgoing interpretation
and the successor's revised judgment with their respective authorship and evidence references.
These view contracts and their underlying operating assignment remain **NOT RUN** until the
[operating validation](VALIDATION.md#ceo-operating-profile-validation) is implemented.

### Observation Summaries and Shared Conversations

The [unified conversation contract](CONTRACTS_AND_STATE.md#unified-rooms-and-proactive-messages)
carries progress updates, report explanations, proposals and ordinary personal/group discussion.
Observation views separately show current work/execution state and readable summaries with source/time
and original message, work or artifact references. Preserve differences between agent explanations and
receipts. A summary is a view over retained evidence/content, not a submitted report lifecycle. Direct
inspection/control works while a room is quiet or its participants are unavailable.

### Generated Artifacts and Space Visibility

An authorized owner or worker can follow an artifact from creating work/instance to retained
content, workspace revision, evaluated release, intended use, active configuration and actual
execution. Display those as separate facts: stored, published, accepted for a named profile,
active for identified consumers, and observed running are not interchangeable status labels.
Show the author, registrant, verifier/acceptor, current maintenance responsibility and underlying
evidence within scope. A model's proposed label cannot become an approval or activation event.

For each logical space, expose permitted work ownership, allocation/limit, reservation and observed
occupancy, scratch versus retained/service data, pending uploads, holds, retirement progress and
remaining obligations. Shared totals must count canonical pools consistently. Use logical IDs;
physical deployment paths and secrets remain outside ordinary views. On executor replacement,
show new scratch and retained company data separately, including unpublished output loss or
restricted recovery collection. Lookup and controls use the same Gateway without a CEO-mediated
inspection gate. The [artifact and space tests](VALIDATION.md#generated-artifact-and-space-validation)
remain NOT RUN; this view does not establish implementation of general allocation or binary storage.

### Artifact discovery, versions and selected-use evidence

The artifact projection specified in [Integrated System Design](SYSTEM_DESIGN.md#7-artifact-management-and-lifecycle)
uses current-scope historical Catalog lookup with opaque cursor and coverage. Latest manifest files
are a partial discovery source, not complete company history; absence from a list is not deletion.
Preserve creator/creating execution, publisher/receipt, exact environment/workspace/revision/path/
digest, explicit lineage, evaluator, current consumers, owner/reason holds and disposal observations.
A current display name does not rewrite the original principal's attribution.

Library list, preview, authorized save, copy-reference, Discuss and notification source resolution
carry the same exact reference. Follow current access even for old room links; missing/denied/retired
content is visible and never replaced by latest. Report/code preview treats content as data; a
published executable is loaded only through its qualified Company/job/service use contract.

Source main commit, built package, verification and selected/observed deployment are separately
queryable from existing Settings/Library/work details. Private report statements cannot fabricate
technical acceptance or financial outcomes. Retention/retirement/deletion and actual recovered bytes
are independently observed. The present Mac Library projection only covers latest observed
publications and lacks this complete provenance/use/retention/history path; its checkpoint must
retain that limitation rather than claim historical completeness.

### List, Detail, Decision and Observed Outcome

Use the [work-centered management contract](CONTRACTS_AND_STATE.md#work-centered-management-contract)
for API/CLI and later console presentation. The same record supports owner oversight and scoped
agent operation; there is no separate owner-only truth or CEO-required control path.

| Step | Visible information and submitted operation |
| --- | --- |
| List | Currently accessible work, responsible actor, reported purpose, important exceptions and source freshness. Filters, counts and continuation disclose only the authorized projection. Disappearance is not proof of deletion. |
| Detail | Separate artifact/publication, technical acceptance, authority, desired activation, observed execution, space, cost and obligation facts. Expand source links with current access rather than copying all private content into Core. |
| Decide | Exact proposed action/target/revision/scope, reasons, prepared evidence and missing prerequisites. Supported controls render outside untrusted content and submit the named route under the actual caller; visibility is only a hint, not a permit. |
| Observe | Original command/intent, subsequent actual effect, producer/time and uncertainty. Display per-step outcomes when one interaction spans several commands; partial completion must remain intelligible. |
| Restrict or retire | Name the exact execution, delegation, activation or retained use. Show admitted control, actual application, holds and remaining effects; do not combine these into a destructive universal delete. |

Use explicit labels for command accepted, release technically accepted for a profile, activation
ready, execution terminated and content physically removed. Owner-decision prompts appear only
where actual authority or a reserved choice is missing; existing delegated work proceeds without
repeated human confirmation. Declining a proposal does not stop something already dispatched.

A changed target, proposal or material scope invalidates the corresponding prepared interaction.
Show the refreshed difference before a new decision; never silently substitute current revisions
into a previously approved request. If an authoritative source is unavailable, show the gap and
disable only actions whose required preconditions cannot be established. If current read authority
itself is unavailable or revoked, end protected delivery rather than rendering a cached permission.
Client failure leaves original commands observable from another currently authorized client.

## Future Console Views and Shared Control Feedback

When the independent TypeScript console is implemented, its first screen is a company overview
with important exceptions and links to underlying work, not an unfiltered log stream. Each detail
preserves firm, time range, view scope, and freshness. The following five views are future client
designs over the same authorized evidence contracts, not additional first-acceptance features.
Their aggregation and presentation are introduced as the relevant capabilities are implemented.

| View | Planned content and drill-down |
| --- | --- |
| Company overview | Current restrictions, active/blocked work, capital/resource observations, commitments, unresolved effects, material costs, and observation gaps. |
| Work and execution | Origin, private rationale, responsibility and descendants, instance history, intent/attempt timeline, artifacts, results, and next authorized wake conditions. |
| Actors and dependencies | Verified principal/instance bindings, active profiles, actual restrictions, native-session coverage, providers, affected work, and replacement status. |
| Resources and costs | Canonical accounts/resources, reservations, usage sources, charges, remaining obligations, and the evidence behind each total. |
| Evidence and changes | Searchable retained evidence, contradictions, private evaluations, candidate versus active configuration, and authorized changes with actual application status. |

Estimated, measured, billed, and unresolved cost are different stages, not additive categories.
Match provider/resource/invoice identity and revision when replacing an estimate with a bill.
Identify currency, units, pricing basis, coverage, and stopping latency where relevant. Owner-paid
and shared costs retain their source, attribution, and any uncertainty; absence from Gateway
metering does not make them zero. Reservations are commitments, not incurred cost or earned profit.

Private operation owns economic interpretation and reports: the console can display a submitted
report with its author, methodology, inputs, evidence cutoff, and contradictions. Outer accounting
and observation do not independently certify AI contribution, profitability, or the next allocation
case. Contributions, principal return, profit withdrawal, and remaining capital keep their meanings;
the same withdrawn profit is not added to remaining capital again.

Control views distinguish requested -> durably accepted -> observed application -> remaining
effects. Show the target, current restriction generation, responsible component, last confirmation,
and unresolved descendants/resources. Stopping an instance does not settle its orders or charges.
A console timeout leaves the command outcome unknown until its stable identity is queried; it
does not invite a second broad stop, grant, or allocation command.

Reserve bounded admission and processing capacity for authorized restriction and observation
operations, including required evidence ingestion. Priority follows the operation and permission,
not a human label. Rate-limit it against abuse without allowing ordinary workload traffic to
consume its reservation. This is capacity isolation within the shared Gateway, not an administrator
bypass. If the console fails, another authorized client uses the same contracts; if Core/Gateway
fails, already-authorized supervisor containment applies without a new privileged product route.

## Storage and Recovery Observation

Expose storage through the existing authorized conditions, snapshots and events. Do not create
a console-only disk-management bypass. The following are required observations and source labels,
not claims that the current CLI implements every field.

| View | Authoritative observation and required distinction |
| --- | --- |
| Store readiness | Expected versus observed store/deployment generation, execution-side storage binding, actual backing identity, last check and restriction reason. Report each backend-specific observation's owner; in the Mac profile, a guest mount cannot attest to the external host volume. |
| Capacity | Logical committed/temporary bytes and objects from Core/catalog; state/content capacity from the storage environment; backing allocation and enforced limits from infrastructure. The Mac profile includes sparse images and APFS limits. Show units, freshness, unknown expansion and protected headroom separately. |
| Retention and cleanup | Policy revision, retained uses/holds, retirement acceptance, generation-bound deletion stage and confirmed space observations. Age or an accepted deletion request is not a reclaimed-byte result. |
| Evidence continuity | Durable ingestion boundary, bounded spool occupancy, missing/corrupt content, failed export and unreconciled receipts. Dropped optional diagnostics and missing material evidence are different events. |
| Recovery sets | Coherent boundary, participating stores, verification outcome, actual independent destination/failure domain, tested restore point and unresolved newer effects. A snapshot on the same backing device does not protect against its loss. |
| Recovery restriction | Old writer containment requested versus observed, current-authority source, storage health and outstanding reconciliation. Connected media and a running database do not prove recovered permission. |

The infrastructure observer may keep a small owner-protected incident record outside the
runtime storage failure domain: expected binding, last observed watermark, detected loss, and
actual backend containment stage. In the Mac profile this is outside the external SSD. This is
diagnostic/freshness evidence, never a second authority database, a company control acknowledgment,
or permission to recreate a missing store. If the affected environment cannot report, show last
known state and the gap. Do not claim its observer can recover the missing content.

Use logical run, store and artifact references in ordinary API output and public evidence exports.
Absolute deployment paths, volume/account labels and credential locations belong only in scoped
maintenance diagnostics where needed. Export an explicit sanitized projection; retain original
restricted observations with provenance rather than rewriting historical evidence in place.

Optional diagnostic retention is bounded independently of material decision/effect evidence.
Neither private actors nor a collector may suppress inconvenient outcomes by labeling them logs.
Measure storage overhead, synchronous write latency, upload backpressure, control response under
load, capacity-signal delay and recovery duration on the actual deployment. Device capacity,
an fsync call, or a volume name is not a measured durability/performance result.

## Performance Observation

Measure outer overhead separately from work quality and native provider latency. Correlate the
following intervals with the same request/intent/attempt where applicable; concurrent and streaming
intervals may overlap, so adding their quantiles does not yield total latency.

| Measurement boundary | Required observation |
| --- | --- |
| Gateway | Authentication and current authorization, request parsing, queue/admission wait, routing, first response, and streaming delivery delay. |
| Core | Admission transaction, contention/serialization retries, durable record/content acknowledgment, dispatch-claim wait, and projection lag. |
| Runtime or resource worker | Claim-to-start delay, execution setup, local processing, observation submission, and stop/fence request to observed application. |
| Native harness or provider | Provider request and first-result latency, stream duration, native task time, response/lookup wait, and provider-side limits where measured. |
| End-to-end client | Submission to admission and to each actually observed result, plus event receipt lag; unknown outcomes stay outside completed-only success summaries. |

Report p50/p95/p99 latency with units, measurement window, observation count, and operation class.
Separate successful, denied, failed, unresolved, and cancelled paths. Report offered, admitted,
and completed throughput separately so rejection or queue growth cannot masquerade as capacity.
Record process memory, buffered bytes, active streams, queue depth/age, backpressure, and protected
spool occupancy; distinguish measured peaks from configured limits and missing samples from zero.

Exercise ordinary-load saturation while measuring the reserved control capacity: restriction
admission latency, time to observed enforcement, and required evidence progress. Attribute delays
to Gateway/Core/worker/provider boundaries when evidence permits; do not label all long model
turns backend slowness. Instrumentation overhead and collection/export costs remain attributable.
Rust is an implementation choice, not proof of throughput or memory behavior. Publish observed
conditions and results without inventing an unapproved SLO, capacity target, or monetary ceiling.

## Instrumentation Reuse and Validation

Reuse OpenTelemetry traces, metrics, and logs for operational diagnosis and correlation, including
[span links](https://opentelemetry.io/docs/concepts/signals/traces/#span-links) across asynchronous
work. Preserve company identities independently of trace sampling and provider span lifetimes.
The [GenAI conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/README.md)
are currently marked Development; pin and record the instrumentation mapping used by an integration,
and review changes. They are not the company's audit schema or a proof of complete native coverage.
[Sensitive-data guidance](https://opentelemetry.io/docs/security/handling-sensitive-data/) leaves
context-specific classification to implementers. Telemetry exporters receive only approved data;
their success, a green trace, or an agent span cannot establish authorization or an external effect.

| Validation input or failure | Required records and visible result | Dependency |
| --- | --- | --- |
| Native success, lost response, later provider partial result | Retain the report, unresolved attempt, later confirmation, discrepancy, and continuing obligation; no fabricated success. | Resource reconciliation, protected ingestion |
| Storage unavailable, spool fills, then recovers | Expose pending evidence and gap; restrict affected work, replay without duplicate facts, clear the gap only with evidence. | Core, protected spool, Runtime failure policy |
| Old SSE cursor or slow consumer during new work | Explicit gap and fresh authorized snapshot; no silent missing updates or false inactivity. | Gateway view boundary, bounded queues |
| Permission revoked during streaming or export | Stop further unauthorized content, invalidate the affected view, and retain control/access evidence without claiming data recall. | Current Core authorization, Gateway mediation |
| Secret in provider error or native artifact | Ordinary view/export contains no usable credential; material restricted evidence and redaction provenance remain inspectable by authorized principals. | Ingestion handling, artifact access |
| Shared account through two connectors; estimate later billed | One canonical resource and linked cost revision; partial coverage and owner-paid costs remain explicit. | Resource identity, accounting contract |
| Private reporting stops but process and resource use continue | Runtime/Gateway activity and costs remain visible alongside missing private progress. | Independent source collection |
| Workload saturates Gateway while owner requests restriction | Authorized management capacity remains available; accepted and actually applied restriction are separate observations. | Admission scheduling, Runtime fencing |
| Projection rebuilt or console process lost | Retained records/artifacts reconstruct authorized views; enforcement and evidence do not depend on either client process. | Core storage, artifact retention |
| API/CLI accepts execution before an instance exists | Show the durable desired identifier and queued/claimed stage; add the actual instance only on Runtime observation. | Common payload, Gateway command mapping |
| Certificate revoked after TLS setup, followed by SSE reconnect | Apply current certificate/principal/read scope to the live stream and reconnect; never use an old cursor to recover revoked content. | Human credential binding, current authorization |
| Provider slows down while ordinary Gateway traffic saturates | Separate provider and outer latency; report latency distributions, throughput, memory/backpressure, and reserved control progress without fabricated targets. | Boundary timing, bounded queues, workload conditions |
| New connection inside current delegation, then a missing-login case | Retain automatic admission without an owner approval step for the first case; link the exact missing personal login/secret/authority/trust action for the second. | Connection admission, protected enrollment, current bounds |
| Independently installed authentication module returns secret-bearing error data | Installation is distinct from qualification/selection; all observable outputs and retained artifacts exclude usable secrets and bearer/signing material. | Protected module qualification, custody, source minimization |
| Credential rotation while provider acknowledgment is lost | Keep the original intent/attempt and credential/module revision, unresolved outcome and later reconciliation; no automatic replacement dispatch. | Immutable attempt binding, provider reconciliation |
| Local use disabled while provider revocation cannot be confirmed | Show applied local restriction separately from unknown remote revocation and remaining effects; app logout does not claim company termination. | Credential lifecycle, provider evidence, fixed controls |
| Enrollment callback repeats after company/account/module or schema change | Bind the original session and change; reject incompatible or stale continuation without adopting a new target or repeating the effect. | Native enrollment generation, exact revisions, current authorization |

These are requirements for subsequent implementation validation, not results obtained by writing
this document. [Core](CONTROL_CORE.md) owns records and commitments, [Gateway](GATEWAY.md) owns
client mediation, [Runtime](RUNTIME.md) owns lifecycle observations, and
[Resource Services](RESOURCE_SERVICES.md) own provider evidence. Their integrated cases belong in
[Validation](VALIDATION.md); deployment binds collection, storage, access, and recovery capacity.

## External connection and protected authentication observations

This is the target evidence contract for extensible connections and independently installed,
qualified and selected protected authentication modules. It extends common request, receipt and
projection semantics; it does not establish an implementation by adding fields to a screen.
The [connection journeys](APPLICATION_SHELL_AND_VIEWS.md#connection-user-journeys-and-acceptance)
put the corresponding actions in Settings → Connections (Overview / Access / Activity), Settings
→ Modules, System and existing conversations and notifications. No additional primary screen or
separate approval inbox is required. Exact serialization, authority and lifecycle contracts belong
in [Contracts and State](CONTRACTS_AND_STATE.md), [Gateway](GATEWAY.md) and
[Resource Services](RESOURCE_SERVICES.md).

Record a connection addition whether initiated by the owner or private work. A new connection may
be added and used automatically when current delegation, cost/resource bounds, qualified modules
and required verification permit it. Being new is not itself a request for owner approval.
Admission evidence identifies those conditions and the responsible work. Only missing personal
login, a new secret, new authority or trust not already covered for a protected module calls for
the corresponding user action. A conversational suggestion or an agent's statement that a module
is trusted cannot supply that authority.

| Evidence group | Required interpretation |
| --- | --- |
| Identity and scope | Preserve the authenticated firm/environment, caller, responsible work and applicable execution or native-session generation. Bind the canonical provider account/tenant/environment and connection configuration revision; a display name, alias or Company-supplied identity is not proof of the account. |
| Effective implementation | Identify the actual qualified connector or Company service, protected authentication module, exact package/content identity, selected configuration revision and operation/schema version used. Installed, qualified, selected and actually applied are distinct observations. |
| Credential use | Keep only an opaque credential reference and version, permitted operation, requesting service, current authorization outcome and observation time. Provider permission evidence and company delegation are separate; successful login cannot authorize new company operations. |
| Request and effect | Retain the original admitted intent, attempt, non-secret input identity, effective bounds and dispatch stage, followed by provider observation, cost or unresolved outcome. Never replace an uncertain original effect with an apparent success from a later retry. |
| Enrollment and change | Retain the safe enrollment/change reference, bound connection and native-session generation, purpose, expiry, requested change, selected module revision and terminal or unresolved result. Raw challenge/state values, authorization codes, tokens, signed bearer material and authentication URLs do not belong in these records. |
| State and coverage | Keep connection identity/configuration, authentication, observed provider permissions, current company delegation, module qualification/selection, runtime readiness and actual use/effect as independent axes with their own producer, observation time and gaps. A heartbeat, installed module or authenticated account cannot refresh all of them. |

Credential-bearing types share the same use-only boundary, including API keys, passwords, private
keys and certificates, access/refresh/session tokens, cookies and one-time inputs. Enrollment uses
the fixed native path or system browser with a protected, bound callback. Company WebViews,
conversations, files and ordinary services cannot collect or return those values. The protected
module may use the credential for the authorized operation; its output to Company code and
inspection surfaces excludes reusable signing/authentication material and arbitrary raw provider
responses. A credential-access or audit-read permission never permits credential extraction.
Observability must not turn a failed authentication module into a secret-export path.

Record module installation, qualification, selection, activation and observed use separately.
A package's self-description is not its qualification evidence; installing it neither selects it
nor grants access to a credential. An already authorized policy can cover a compatible installation
and selection. Where a new protected trust boundary is not covered, retain the exact decision and
applied revision before permitting dependent use. Settings → Modules links these records to
Connections → Access; the trace retains the actual selected revision even after replacement.
Qualification applies to the complete protected use path, not only to the module's returned JSON.

Renewal, rotation and recovery preserve old attempt identity. If a response is lost while a new
credential or module is selected, reconcile the old attempt with its original binding and retained
evidence; do not dispatch the same business effect using the replacement as a presumed retry.
An enrollment callback is accepted only for its bound, current session and intended change.
Company/account/source changes, expired sessions, incompatible schema changes or a revoked grant
invalidate dependent admission. Late or repeated callbacks remain attributable without silently
retargeting the enrollment, reusing consent or recreating an effect. Credential/module version
changes and duplicate account aliases cannot renew a used budget or multiply exposure limits.
Provider quota, company budget, reservation, measured cost, invoice and unknown remaining cost
remain separately observable under their existing accounting and identity contracts.

Local use restriction, external provider revocation, credential disposal, app logout and provider
session logout have different outcomes. Show each supported request, acceptance, actual observation
and remaining obligations. An unreachable provider leaves remote revocation unconfirmed; disabling
local use does not erase an already-dispatched effect or close an external session. App logout is
not an instruction to stop the company. Recovery reconciles current bindings, grants and unresolved
attempts before dependent new use; a restored cache or old session is not current authorization.
Permitted monitoring, reconciliation and duty cleanup retain their own scope when new effects are
restricted, rather than being hidden behind a single disconnected flag.

Notifications and conversation links use a primary typed connection, enrollment or change reference
with its firm/environment and exact relevant revision. Related work, execution, module and safe
credential metadata references remain relationships, not competing destinations. Following a
notification opens its original record even when a newer credential, module, account selection or
Company package is now active. If the source is inaccessible or retired, retain the authorized
unavailable state rather than redirect to a different live record.

Source occurrence identity deduplicates receipt ingestion and repeated events. Snapshot and SSE
cursor semantics preserve the authorized observation boundary, including a new snapshot when the
source, schema or access scope changes. Unread state, action still required and outcome unresolved
remain separate. A renewal success appends evidence instead of erasing an earlier failure; repeated
reports of one outstanding problem do not create a notification storm. Badges and counts for
Settings/Connections, System and Notifications come from the same authorized server aggregates
and primary-source mapping when implemented, not from the currently loaded list. Ordinary in-scope
connection addition is activity, not a mandatory owner review; prompt for the missing action only
when the corresponding prerequisite actually needs the owner.

Existing model-specific traces, partial Gateway projections and prototype connection fixtures do
not prove this generic connection/authentication-module path. Protected enrollment, independent
module installation/selection, use-only enforcement, rotation/revocation, projection mapping and
native/provider integration require scoped execution evidence. They remain NOT RUN where the
corresponding implementation and actual provider observation are absent.

## Model invocation audit and secret exclusion

Every native model attempt requires an external observation record tied to its firm, work,
principal, delegation, instance/generation, intent, attempt and active connector configuration.
This applies equally to Astra and other configured models; no particular operating model is selected.
The trusted provider worker supplies observations and Gateway/Core correlate them. Private text
is never the source of authority for this record.

| Field | Source and required interpretation |
| --- | --- |
| Requested provider and model identifier | Effective outbound native request, preserving the exact identifier rather than a display alias. |
| Requested reasoning effort | Effective native request; retain explicit value, inherited/default origin, or absent. Absent never means low or none. |
| Provider-reported model and effort | Allowlisted response metadata if provided; otherwise unavailable. Do not infer hidden reasoning effort from token counts. |
| Other generation controls | Allowlisted effective values supported by the selected protocol, including output limit, service tier and sampling controls; preserve absence and configuration provenance. |
| Execution provenance | Harness build, connector/configuration revision, protocol and approved account reference; no credential material. |
| Attempt result | Dispatch and completion timestamps, provider request/response identifiers, status, retry relationship and unresolved outcome. A retry is a separate attempt. |
| Token usage | Provider-reported input, cached input, cache-write input, output, reasoning output and total, with source and observation time. Missing is unknown, not zero. |
| Cost | Estimated, provider-reported and later billed amounts remain separate, with currency and pricing basis. Subscription tokens are not automatically API charges. |

Provider token categories may overlap: reasoning output may already be included in output, and
cached input in input. Preserve native counts and their semantics; never sum all categories into
an invented total. Corrections append observations without erasing the earlier result. Stream
interruption before usage arrives leaves usage incomplete and reconciliation outstanding.

Operational logs and audit payloads are built from allowlisted metadata, not serialized requests,
headers, arbitrary provider errors or complete native events. Authorization/Cookie headers, OAuth
codes, access/refresh/ID tokens, login URLs and credential file contents are excluded before
persistence or export, including debug logs, traces, crash reports, CLI/SSE views and artifacts.
Prompt/output retention is a separate authorized data policy, not implied by invocation auditing.
Credential access audit records contain only opaque secret reference, version, requesting service,
action, authorization outcome and time. An audit-read permission never grants secret-read access.

Qualification must inject synthetic secret canaries into headers, enrollment callbacks, cookie and
signing outputs, refresh/rotation failures, malformed SSE, provider error text and native stderr,
then inspect all persisted/exported surfaces for leakage. Apply this to independently installed
protected authentication modules as well as the complete caller-to-provider path, including native,
Company-facing, conversation, artifact and notification surfaces.
Missing audit storage blocks new billable dispatch; already-dispatched uncertain outcomes remain
recorded as unresolved rather than retried silently. These cases are NOT RUN until the real
provider connector and protected credential service are implemented and tested.

## Direct User Conversation

Provide a primary conversation entry point for asking questions, explaining artifacts and
intervening with the responsible agent. Optional explicit work requests use the same path, while
normal company operation continues without the owner supplying new tasks. Do not make users translate every interaction into
execution IDs and management commands. The conversation belongs to continuing work, with the
current responsible agent and execution state visible, and follows the
[direct conversation contract](CONTRACTS_AND_STATE.md#direct-conversation-and-work-continuity).

Show the user's messages and actual attributed agent replies together with queued/delivered/answer
status. Allow progress/result messages to link to authorized source records and published artifacts.
A pause, missing reply or unavailable agent must remain visible; the Console must not invent a
completion message or relabel a transport acknowledgement as a conversational response.

The first delivery is an API/CLI conversation path; a dedicated chat client can use the same
Gateway endpoints and event cursor without a privileged backend. This is a required interaction
capability, not a new execution layer or an additional model hidden inside the public environment.
Persistent conversation records and native message/reply paths are described in the implemented
client-path sections below. They do not establish complete autonomous routing, continuous CEO
operation or every native/UI acceptance scenario; current coverage belongs in the implementation
checkpoint, not a blanket claim that storage/delivery is absent or fully complete.

### First conversation client path

This subsection preserves the initial API/CLI milestone. Current Mac Conversations and native
message paths build on it; complete automatic routing, idle-recipient wake and native/UI acceptance
remain separate work. Historical fixture evidence below is not evidence of those later outcomes.

The persistent record API is now available through the same CLI transport as other management
requests. A human uses a registered mTLS client; an admitted agent uses the existing `--instance`
path and its assigned conversation scope. For example:

```sh
ouroboros-cli --config CONFIG request POST /conversations --input CONVERSATION_JSON --key CREATE_KEY
ouroboros-cli --config CONFIG request POST /conversations/ID/messages --input MESSAGE_JSON --key MESSAGE_KEY
ouroboros-cli --config CONFIG request GET '/conversations/ID/messages?cursor=0' --max-bytes 1048576
```

Retain the returned cursor and use it for later reads; paginate while `has_more` is true. The
explicit client response bound accommodates the bounded message page, including JSON escaping.
The initial milestone established durable records. Messages and attributed replies survive
process and instance replacement. The current Mac client also provides Conversations and native
send/delivery paths; complete autonomous recipient routing and idle-recipient wake require further
integration. A stored or delivered message must never be displayed as an actual answer without one.

### Group conversation interaction

The direct conversation surface must serve human-to-agent, agent-to-agent and many-to-many groups.
Show authenticated authors, reply relationships and the logical participants separately from
current instances. Render each recipient's delivery state independently: one native acknowledgement
or one reply does not mean all recipients have read or acted. Participation management uses the
same Gateway and explicit conversation-management permission; a chat administrator is not
implicitly a sovereign or an execution approver.

The backend now stores participants, membership revisions, immutable per-message recipients and
recipient-specific native delivery bindings. The current CLI can call the participant and delivery
endpoints described in the common contract. The Mac conversation view and native paths do not
by themselves establish complete group-participant UI, autonomous routing, idle-recipient wake
or recipient-specific native/UI acceptance.

### Addressed reply evidence

An actual isolated native-harness fixture has now read a user's stored message and posted an
explicitly addressed reply through the instance Gateway path. The user CLI can retrieve both
messages with author and execution correlation. Its text is synthetic test content from that
fixture milestone, not proof of the complete later conversational product. Present `native_context`
as execution correlation, not independent proof of model authorship or a correct answer.

### Conversation CLI access

Both authenticated human clients (`--config`) and Runtime-bound clients (`--instance`) can use
`conversations list WORK_ID`, `conversations read CONVERSATION_ID --cursor SEQUENCE`, and
`conversations send CONVERSATION_ID --delegation GRANT_ID --text-file MESSAGE_FILE --key KEY`
(with optional `--reply-to MESSAGE_ID`). These commands use the existing Gateway endpoints and
JSON results. Reading returns a bounded page; callers advance with its cursor while `has_more`
is true. The sender's identity is never accepted from message text or command options.

The text file is read with a 16 KiB limit and validated as nonblank UTF-8 without NUL. Its path
is not transmitted. Preserve the key across uncertain sends; sending again with a new key is a
new message. A stored message does not automatically dispatch a native control or start an agent.
The explicit message-delivery API remains separate. This is command-line access, not yet an
interactive chat window or autonomous group routing.
