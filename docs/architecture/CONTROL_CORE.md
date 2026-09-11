# Control Core

This proposed component design follows the [Architecture](../../ARCHITECTURE.md) and the
[shared contracts and state](CONTRACTS_AND_STATE.md). It describes implementation behavior,
not a grant of runtime authority or a change to the governing sources. The separately authorized
local implementation subset is recorded in [Validation](VALIDATION.md#connected-runtime-probe-evidence).

## Responsibility and Boundaries

The Core answers what is currently permitted, which resources are already committed, which
configuration is active, and which execution/effect records remain unresolved. It owns admission,
restriction, protected current state, and durable change/dispatch records. It does not choose the
firm's research, trades, organization, economic comparisons, or next allocation.

All human and private client commands enter through Gateway. Core accepts narrow authenticated
internal calls from Gateway, Runtime, and designated observation/reconciliation workers. Neither
the console nor a private actor gets a direct Core endpoint or database login. Infrastructure
restoration is not an alternate company command interface.

The first implementation is a Rust workspace component with Tokio command workers and SQLx
PostgreSQL transactions. Core has no Docker socket, provider credential, private plugin, or native
agent loop. Gateway calls its internal command interface; Runtime and resource workers request
their assigned dispatch claims and report scoped observations, without independent admission or
authority edits. The shared HTTP contract is translated here without exposing Core's
database types to the CLI or the independent TypeScript client.

## Protected State and Writers

| Record family | Core-owned content and permitted source |
| --- | --- |
| Identity and role bindings | Verified issuer/subject or Runtime instance binding, resource-scoped roles, delegated service relationships, and protected sovereign designation references. |
| Delegations and restrictions | Scope, conditions, lifetime, ancestor bounds, accepted mandate references, revocation ordering, and restriction application observations. |
| Registry and activation | Candidate package/configuration identity, capability/target contract, required enforcement, evidence references, authorized activation, and actual observed configuration. |
| Work and desired execution | Continuing work identity, responsible principal, authority, admitted execution profile, wake conditions, and references to private-owned plans. |
| Intents and attempts | Fixed meaningful request, request-key binding, admission, dispatch claims, assigned worker, observations, and unresolved result responsibility. |
| Commitments and usage | Canonical resource/limit identity, reservations, consumed/reconciled use, uncertainty, provider billing references, and ancestor relationships. |
| Evidence and delivery | Attributable material observations, retained-content references, transactional dispatch/outbox entries, deduplication keys, and consumer progress. |

Gateway and workers submit scoped observations rather than writing these tables directly.
Private business schemas, editable plans, strategy knowledge, and performance interpretations
remain outside this database authority. Published or mutable business documents cannot rewrite
the inputs retained for an earlier decision. A projection is rebuildable; its underlying evidence is not disposable.

The initial store is PostgreSQL with separate protected and operational databases and login roles.
Core owns protected writes through its command handlers. Pure reads use scoped projections under
Gateway authorization. Component packaging alone does not protect a database credential from other
code in the same process; the deployment design isolates credential holders where required.

### First Relational Constraints

The following are logical relation and constraint requirements, not DDL or a migration. Records
carry `firm_id`; references must remain inside that firm. Identifiers never derive authority from
their spelling. Preserve referenced historical revisions and receipts while effects or retention
requirements remain outstanding; cascading deletion cannot settle an obligation.

| Relation group | Required identity, relationships, and update rule |
| --- | --- |
| Firm authority fence | One row per firm with current authority/restriction revision. All admission, dispatch claims, credential/binding changes, revocations, and activation changes lock it first. It is the initial short transaction serialization boundary. |
| Principals, credentials, and delegations | Stable principal identity; unique active certificate binding for issuer/fingerprint/serial to one existing human; separate validity/revocation and replacement references; parent delegation and accepted mandate revision. Changing a credential cannot edit a grant or sovereign designation. Runtime bindings additionally reference verified instance/generation/channel and their observed lifetime. |
| Credential proof challenges | Unique challenge and originating request identity; unpredictable challenge bytes, firm/target human/new-certificate/replacement/revision binding, expiry, and consumed state. Consume once in the binding transaction; challenge issuance changes no credential or grant. |
| Capabilities and activations | Stable canonical target and capability identity; immutable candidate/configuration revisions; at most one selected activation per scoped target/profile slot. Intents retain the revision used, even after it is no longer active. |
| Work and desired execution | Unique `work_id` and `execution_id`; each execution references one work, start intent, profile, permitted inputs, and optional predecessor in that same work. Runtime-confirmed `instance_id` and generation are unique and never inferred from desired state. |
| Intents | Unique `(firm_id, effective_principal_id, operation, request_key)` for own JSON commands; immutable material input and verified origin chain; stable internal invocation identity for native calls. A duplicate cannot allocate another reservation or outbox action. |
| Attempts and effect links | Unique `(intent_id, attempt_sequence)`; assigned worker/channel, expected configuration, claim validity, and observed result. Permit at most one unreconciled dispatch opportunity for the same intent; a later attempt needs an explicit supported retry decision. Provider/resource/receipt identities link continuing effects to their attempts. |
| Limits, reservations, and usage | Canonical limit identity, unit and ancestry; one identified reservation contribution per intent and constraint. Apply estimate/measured/billed revisions to the matching usage record, not as independent charges. Keep uncertainty and outstanding resource references. |
| Dispatch outbox and consumers | Stable action identity tied to committed intent/desired execution; unique consumer/action delivery record; bounded lease and progress. Delivery acknowledgment is not effect completion or reservation release. |
| Observations and wake occurrences | Unique producer/occurrence identity with source and receipt times; retained evidence and restriction-application references. Unique `(work_id, condition_id, source_occurrence_key)` maps duplicate timer/event delivery to one continuation intent. |
| Projection changes | Firm-local commit-ordered sequence, stable event identity, changed record references and source observations, allocated under the firm fence with the mutation. Retained replay range is distinct from source occurrence time or native event order. |

Core alone owns these protected write transactions. File metadata/receipts and the first business
DB transaction/receipt remain owned by their resource workers as specified in
[Resource Services](RESOURCE_SERVICES.md); they are not writes to Core tables through a shared
credential. Gateway and Runtime have no protected SQL login. Maintenance credentials are held by
the separately controlled maintenance procedure, not any normal API or private worker.

## Command and Observation Contracts

The [first routes](CONTRACTS_AND_STATE.md#first-connected-routes) fix client URL spellings.
This table owns their internal command responsibilities, not an executable wire schema.

| Operation | Required inputs and checks | Durable result |
| --- | --- | --- |
| Inspect conditions | Authenticated principal, permitted scope, pagination/cursor; current read permission. | Authorized view with freshness, gaps, and configuration/restriction reference; no new authority. |
| Bind or amend authority | Verified grantor, protected designation where required, requested role/scope/conditions, expected current revision. | Attributable binding change or rejection; cannot exceed grantor scope or manufacture sovereign authority. |
| Register candidate | Package/configuration identity, declared capability and dependencies, proposer and evidence references. | Inactive candidate record; registration runs no private code and grants no access. |
| Activate or restrict target | Candidate, compatible contract, required checks/reviewer evidence, current activation revision and authority. | New activation/restriction revision plus required reconciliation and actual-application tracking. |
| Admit resource operation | Verified request context, immutable material input, active target/configuration, canonical constraints and required bounds. | Intent, reservation where needed, and delivery record in one transaction. |
| Claim dispatch | Existing intent, assigned worker/instance, expected material input/configuration and unexpired claim parameters. | One recorded attempt after current authorization checks; no transferable private permit. |
| Observe result | Authenticated producer, intent/attempt or known external resource, source identity, stage, times, usage and evidence. | Deduplicated observation, explicit reconciliation state, and accounting adjustments justified by the evidence. |
| Request compute or continuation | Admitted work, activated launch profile, bounded resources, permitted wake/retry conditions. | Desired execution delivered to Runtime; no second compute approval in Resource Services. |
| Stop execution | Authenticated controller, target `execution_id`, expected state and current scoped permission. | Ordered execution restriction, desired stop, and required Runtime/worker observations; not a delegation-wide revocation or settlement. |
| Revoke delegation | Authenticated controller, target delegation, expected current revision and valid scope/designation. | Ordered authority cutoff for that delegation and descendants, required fencing, and continuing effects. |
| Prepare credential proof | Currently authenticated target human, intended new public certificate, expected binding revision and explicit replacement if any. | Bounded single-use challenge bound to the exact proposed enrollment; no credential activation or authority change. |
| Bind, replace, or revoke human credential | Current scoped permission, existing principal and credential, expected revision; binding/replacement additionally requires the target human's current authentication, explicit binding consent, and proof of control of the new key. | Explicit binding/replacement/cutoff with application tracking; no private key upload, impersonation, principal creation, or change to principal grants. |

Server-derived caller identity cannot be replaced by a body field. A service executing for another
caller supplies a verified delegation relationship; its own wider role is not sufficient to act
for that caller. An independently authorized standing service work item uses its own explicit
delegation and remains attributable as such.

Required policy values include permitted capabilities/targets, resource and concurrency bounds,
execution/claim lifetimes, evidence retention requirements, and allowed containment. Their accepted
values come from the applicable mandate/profile, not favorable application defaults. Missing a
required value blocks the dependent operation. Lack of trading authority does not prohibit
independently authorized inspection or bounded research.

`POST /work` records an authorized work declaration without executing its private plan. A
`POST /executions` admission refers to that work, current delegation/profile, permitted inputs,
and resource bounds. A continuation additionally fixes its predecessor and permitted checkpoint
references. Input materialization remains a separate current content-access decision; compute
admission is insufficient. Steer targets the named execution only, and cannot retarget itself
after replacement. An idempotent stop of an already terminated instance records or returns the
known application state while preserving remaining effects.

Stopping an execution closes that execution's dependent access and dispatch. It does not revoke
all future use of its work's delegation. A subsequent start needs fresh admission, confirmed
predecessor fencing/reconciliation, and remaining current authority. Delegation revocation cuts
off that authority itself: a new work, instance, generation, credential, or request key cannot
resurrect it. Observation of existing obligations may continue only under distinct valid recovery
authority. Credential revocation similarly ends use of that credential, not historical effects
or independently valid credentials/grants.

Credential-management permission alone cannot attach an agent's, service's, or another human's key
to a human principal and thereby inherit its powers. Ordinary enrollment/replacement requires the
target human's current authentication, explicit consent to that exact binding, and verified control
of the new key. A separate manager can prepare or check material but cannot activate that binding
alone. Lost-key recovery follows protected designation and explicit scope rules, not an ordinary
administrator role or proof of CA/host ownership. It cannot silently transfer the sovereign's identity.

`POST /principals/{principal_id}/credential-challenges` records the intended binding and issues
bounded single-use challenge bytes only to the currently authenticated target human. The CLI signs
them using the already held new key; the subsequent registration carries that proof and the challenge
reference, never the key. Verify it against the recorded certificate using the activated credential
profile's supported standard signature algorithm. Missing or unsupported proof is a denial, not a
fallback to administrator assertion. Replay, expiry, different target/key/replacement, or changed
expected revision cannot activate the binding.

Credential replacement uses one authority transaction: validate those proofs, the new public certificate
and existing principal, consume the challenge, add the replacement binding, retire the specified old binding, increment the
revision, and enqueue connection/stream cutoff observations. The first rotation has no implicit
overlap. A lost reply is recovered through the original request identity and a currently valid
credential; it is not permission to reactivate the retired certificate. An initial installation
can import an already recognized principal/mandate/designation and credential binding into an
uninitialized firm under the protected installation procedure. No first login, CA signature,
certificate subject, repository login, or ordinary administrator role establishes sovereignty.

## Snapshot and Event Continuation

Every Core mutation visible to its work/execution/conditions projections appends a projection
change in the same transaction, including accepted resource observations. Allocate its firm-local
sequence under the authority fence so later commits cannot appear behind a cursor already served.
Do not use a wall-clock timestamp or an independently allocated, out-of-order SQL sequence as proof
that all earlier committed changes were delivered. Native and provider occurrence order is retained
separately and can still be unknown.

Read a snapshot's scoped records, projection revision, and last committed change position in one
short repeatable-read transaction on the primary store. The resulting opaque cursor binds that
position to the view and its access context. Gateway validates current access again at disclosure
and replay; a changed access context requires a new authorized snapshot. Replay uses retained
changes after that position, filters evidence under current permission, and follows the common
gap contract when the range cannot be reconstructed. This closes the snapshot-to-subscription race
without promising a globally current snapshot across providers, file metadata, and the Core.

## Admission and Concurrent Reservations

Resolve canonical resource identity before locking commitments. Two connector aliases for the same
account or quota must meet the same constraint records. Investment enforcement contributes its
domain-specific exposure requirements; generic Core mechanics do not infer financial semantics.

Within one transaction:

1. Use Gateway's verified caller/channel context and lock the firm's authority fence row. Read
   current bindings/restrictions from the primary store under that lock, then resolve the scoped
   request key. An existing matching intent
   prevents duplicate admission regardless of later authority changes. Return its record, result,
   or evidence only after checking current inspection and content-access permission; otherwise
   deny that disclosure without reserving or executing again. Changed material input conflicts.
2. Check current principal/instance/delegation, ancestor restrictions, active target/configuration,
   required domain checks, and the freshness needed for this operation.
3. Lock all affected limit/commitment rows in canonical identifier order, including required
   ancestor constraints. Evaluate the combined request against each relevant bound. Initializing
   a canonical constraint uses its uniqueness rule under the same authority fence, not a second
   availability counter behind a connector alias.
4. Persist the intent, reservation adjustments, authorization/configuration references, and
   dispatch or desired-execution record together.
5. Commit before issuing any external effect. Return acceptance, not an invented provider result.

A transaction conflict retries this database decision using the same request identity; it never
replays a network effect. If the caller loses the acceptance response, it retrieves the original
intent with its request key subject to current read permission. Deduplication does not confer
access to an old result. Any retry duration and concurrency are bounded by the execution profile.

The first store uses ordinary PostgreSQL transactions with these explicit row locks; admission
does not rely on an unlocked availability read or a process-local mutex. Accounting updates that
affect admissible capacity follow the same fence-then-limit order. SQLx retries only bounded
transaction failures known to be rolled back; an uncertain commit is resolved by the stable key.
No provider request, waiting stream, payload copy, or Runtime operation runs while those locks are
held. The single-firm fence deliberately trades write concurrency for an inspectable ordering;
the performance case measures that contention before a different concurrency scheme is adopted.

For a parent limit of 100 units and concurrent children requesting 70 each, at most one request
is admitted until sufficient commitments are resolved. Child budgets are constrained portions of
ancestor capacity, not independent additions to it. Reservations for compute, money, storage, and
investment exposure retain their units and are not indiscriminately converted into a single scalar.

Accounting applies observations with stable provider/resource/billing identities. A replacement
invoice updates the matching estimate/reconciliation rather than double-counting it. Usage below
an estimate can release only the accounted-for portion. Unknown usage or a continuing provider
resource preserves the relevant commitment. Financial returns and owner contributions remain
different records; Core observations do not decide AI contribution or justify future allocation.

### Persistent Storage Admission and Accounting

Use the existing canonical limits, reservations, intents and outbox, not a second storage
admission service. A storage pool identifies one activated store binding and its actual shared
capacity constraints; connector aliases, new work, instances or request keys create no new pool.
Logical allowances are permission bounds. Independent backing-storage and execution-environment
capacity observations establish whether the selected backend can honor them; the VM reference
profile requires both guest and host observations.

The activated profile must provide finite values and units for retained content, object count,
simultaneous uploads, staging, scratch, optional diagnostics, protected state growth and recovery
headroom. It also specifies maximum request growth, observation freshness, uncertainty treatment,
and retirement/retention rules. Physical sizing does not grant the full SSD capacity to private
operation. Missing relevant values block the corresponding activation or growth request.

For each upload or other storage-growing operation:

1. Verify the current storage binding and readiness observations as well as the caller's scope.
   Infrastructure reports actual backing capacity; the storage/execution environment reports
   allocated filesystem or service limits; the file service reports verified/staging/deleting
   content; Runtime reports scratch commitments. For the VM profile, backing and filesystem
   observations come from the host and guest respectively.
2. Under the existing firm fence and canonical limit-lock order, reserve the declared bounded
   growth against every applicable ancestor and pool. Include temporary duplicate bytes, file
   counts, and conservative metadata/transaction overhead established by the qualified profile.
   Two identical concurrent uploads can still require two staging allocations. Do not spend
   predicted deduplication savings before the catalog verifies the outcome.
3. Persist intent, all reservation contributions and dispatch together. Before transmission,
   recheck identity, readiness and the current claim. If capacity evidence became stale or a
   required filesystem changed, restrict dispatch and retain the admission record for resolution.
4. Reconcile measured usage to the same commitment through assigned producer observations.
   The catalog's retained-byte ownership and allocation observations replace estimates rather
   than add a second charge. Preserve consumed cost even after later data deletion.

Count holds and reservations without double-counting their underlying bytes. A confirmed object
may satisfy several references, but each reference retains its independent retention obligation.
Inflight staging and unknown file/metadata outcomes remain committed. An expired worker lease,
missing observation, intent error, or removed worktree cannot turn them into free space.
Release the applicable reservation only after confirmed no-effect cancellation, verified usage
settlement, or actual authorized cleanup. Snapshot-retained host blocks may remain occupied
after guest deletion; they require a separate backing-capacity observation.

Large content must not consume the filesystem reserved for PostgreSQL and essential evidence.
Within protected state, bounded business statements, payload limits, WAL/temp allowance and
bounded spools still matter: filesystem separation does not provide unlimited control writes.
Unrestricted business SQL or bulk database ingestion requires its own qualified containment
before activation. Block workload growth before the accepted control/recovery reserve is spent;
inspection, restrictions and reconciliation remain available only while their actual dependencies
can honor them. If Core cannot persist a restriction, report unavailable or unconfirmed, never
accepted. An infrastructure stop is separate from a recorded company revocation.

For cross-store reference changes, use the durable hold ordering in
[Contracts and State](CONTRACTS_AND_STATE.md#persistent-storage-identities-and-lifetimes).
Core accepts a material evidence reference only after its catalog hold is confirmed. Authorized
release and maintenance deletion preserve the original owner, intent and storage generation.
Reconciliation may look up a committed resource receipt and attach it to the original intent
under standing recovery authority; it cannot obtain a new effectful claim merely because the
worker that lost the reply has been replaced.

The local implementation now reserves declared upload payload bytes as well as the independent
call count. `storage_budgets` is keyed by firm/store/generation, so target aliases share a limit;
`storage_allocations` binds the original intent to its exact size and digest. Admission increments
the byte counter and records allocation/intent/outbox atomically under the firm authority fence.
Missing budget, invalid input or exhausted capacity cannot leave a partial allocation. Upload
readiness and claim require that allocation, including after migration of earlier accepted requests.

Charges are conservative and remain after completion, uncertainty, revocation or worker replacement.
This subset has no release or budget mutation API. Physical block usage, seed content, metadata,
object-count limits, host backing pressure and settlement are still outside the implemented counter.
The qualified local results do not prove those proposed safeguards.

`resource_receipt_recovery` supplies the original assigned worker with a tagged observation ticket
for an existing upload/publication attempt. It reads the frozen input and store binding, never a
new active target configuration, and creates no attempt or reservation. Only an existing matching
resource receipt may use the original completion path. Caller inspection is separately checked by
Gateway before and after observation; no receipt or conflicting source/Core observations leave the
outcome uncertain.

## Dispatch, Restriction, and Configuration Races

The durable dispatcher offers an intent to the designated handler or Runtime. Delivery is at
least once and acknowledges recorded work, not remote success. Each actual attempt requires a
claim checked against current state. Claims bind the worker, input, account/target, instance,
configuration generation, and validity. Worker replacement does not reuse a consumed claim.

Core serializes claim issuance with revocation and activation changes. A restriction committed
first denies the claim. A prior claim is in flight, even if the worker's subsequent transport
result is missing. Fencing can prevent an unsent call, but there is no distributed transaction
with the provider that proves an already committed effect was cancelled.

Claiming takes the same firm fence and locks the intent/attempt after checking current authority,
configuration, instance binding, and any stopping state. It durably assigns a single attempt before
returning a bounded claim to that worker. Dispatch consumers can lease pending outbox rows in
parallel, but a lease conveys no permission to send. Revocation takes that fence, commits the new
cutoff and its application outbox together, then releases it. This orders decisions across Core
processes without claiming atomicity across PostgreSQL and a remote provider. The worker checks
claim validity and any observed fence immediately before sending; if current conditions cannot be
established it does not start a new effect. A race after claim issuance remains in flight and
requires actual application/receipt evidence.

Once an attempt may have been dispatched, lease expiry, worker replacement, or a new delivery only
assigns reconciliation work. It cannot issue a fresh effect claim. A confirmed not-dispatched
attempt may be cancelled and accounted for; a provider-supported retry, where allowed, records a
new attempt with the original fixed effect identity and retention guarantees. Native model calls
in the first profile instead require the no-automatic-replay qualification described in
[Integration and Deployment](INTEGRATION_AND_DEPLOYMENT.md).

Restriction acknowledgments track Gateway workers, active streams, Runtime instances and
descendants independently. Display accepted control separately from observed application.
Priority admission capacity for authorized restriction/inspection cannot depend on the ordinary
workload queue having free capacity. This priority is not an authentication or policy exemption.

Changing a route or package creates a new explicit activation revision; it does not silently
retarget an old intent or claim. Configuration changes that could invalidate an in-flight
operation require restriction/reconciliation of that operation, not a reinterpretation of its input.

## Artifact Use and Space Admission

The [common use contract](CONTRACTS_AND_STATE.md#artifact-use-and-allocated-space) determines which
operation is requested. Core checks the actual resource/action and approved profile; a caller
cannot classify a service activation or financial effect as an ordinary file write to escape its
rules. Local private instructions within a running instance are not separate Core approval events.
Their resource growth and boundary-crossing operations remain constrained by the existing grant.

Workspace provisioning, storage growth, job creation and managed capability activation are distinct
intents, using existing stable keys, claims, outbox and receipts. A namespace request requires current
creation permission and existing permitted parent scope. Record work ownership, logical allocation,
limits and retention references without creating new grants. Preparation or quota assignment alone
does not reserve every future byte or start an execution. Actual bounded allocation/growth uses
the existing shared commitment transaction; handlers report observed allocation separately.

Artifact-backed execution binds exact input/bundle and entrypoint references to the admitted
profile, work, delegation and reservations. Candidate/release/activation owners use the existing
catalog hold protocol before committing retained dependencies; pending hold acquisition cannot
be treated as ready. No catalog RPC or private build runs while the authority transaction is held.
Missing content, stale activation, insufficient capacity or revoked source access blocks dependent
dispatch. The unchanged input of a previous request cannot be redirected to a newly published head.

Technical acceptance is required for the uses specified by the existing policy and profile, not
for every piece of scratch code. A previously accepted experimental profile permits bounded tests
without claiming operating acceptance of their results. Managed service/tool activation for other consumers,
new rights and trusted-boundary changes keep their own verification and authority requirements.
Artifact origin, CEO selection or successful storage publication cannot satisfy those requirements.
Retirement/restriction reuses current lifecycle records; resource release requires attributable
disposal or settlement rather than an expired allocation label. General provisioning and these
artifact-backed uses remain NOT RUN until their owning handlers and qualification are implemented.

## Registry and Governed Activation

Registry entries identify capability, package/configuration, allowed destinations, required
enforcement, credential references, dependencies, compatibility evidence, and activation state.
Discovery is permission-scoped and is checked again at execution. The registry is not an IAM grant.

Activation verifies current authority, capability meaning, bounded costs/failures, required
independent evidence, and the actual deployment configuration. Evidence and approval roles remain
separately accountable: neither a private candidate nor an author of outer controls is its sole
evaluator and acceptor. Multiple agents or votes alone are not sufficient independence.

Role edits, delegation, connector updates, and evaluator/control replacement cannot enlarge the
mandate through an ordinary binding. Sovereign-only actions preserve the designation and durable
scope required by [SOVEREIGN.md](../../SOVEREIGN.md). Authentication credentials or repository access
do not create this authority. No bootstrap process silently assigns it to the first login.

### Agent-Led Service Adoption

Use the [adoption references](CONTRACTS_AND_STATE.md#external-service-adoption-references).
Private operation proposes the service and carries discovery, implementation and economic
evaluation; Core does not become a procurement manager or select the most profitable provider.
Company-provided defaults and internal submissions share the same catalog and acceptance rules;
origin or installation method does not grant authority. Candidate submission is an inactive record.
It neither loads submitted code into Core/Gateway nor publishes a callable MCP tool.

Acceptance ties an immutable release and verified tool semantics to the connection, account,
data scope, operations, limits and execution profile. Activation requires current authority,
accepted evidence, ready credential binding if needed and observed deployment identity. A missing
prerequisite yields an explicit pending/unavailable condition, never implied approval. A successful
secret-store write, OAuth callback or connection probe is only its own observed event.

There are not two mandatory human approvals for every integration. Discovery, mock development
and technical acceptance can proceed within existing explicit delegations. Newly required
authority, reserved owner decisions or personal authentication must be resolved at that boundary.
A predelegated technical acceptance policy may activate a conforming release without asking the
owner to repeat the same decision; this document creates no such delegation. The author cannot
self-certify the evidence or self-activate through ordinary resource access. Sovereign actions
retain their existing scope and recording requirements.

If actual credentials or paid resources are necessary to finish verification, authorize a bounded
test connection first, using the exact candidate accepted for that restricted verification profile.
Its account, data, effects, cost and expiry are explicit and do not become production authority. Preparing new code within that test does not itself justify more resources.
Code, dependencies, target meaning or privilege changes are new candidates/bindings; mutable tags,
startup downloads and edited MCP descriptions cannot replace the artifact previously accepted.
Revocation fences new work and records actual application while prior costs, positions, resources
and uncertain outcomes remain available for observation and reconciliation.

## Wake Conditions and Continuing Work

Core stores private-selected timer/event/dependency conditions with work identity, responsible
principal, execution profile, validity, resource bounds, and allowed technical retries. Timers and
authenticated external events create deduplicated occurrences. The same occurrence produces the
same accountable continuation request after restart or duplicate callback delivery.

Before creating an instance, current permission and resources are checked again. Runtime binds the
actual instance before allowing business access. A restarted scheduler wakes authorized private
operation with its pending observations; it does not invent a new experiment, require a trade,
or grant a fresh allowance. Private decides whether continued work is worthwhile.

Event ordering is provider-dependent. Keep occurrence and receipt times, deduplicate stable source
keys where available, and expose gaps/out-of-order delivery. An inability to establish order is
not permission to discard an inconvenient observation. Clocks used for leases and time-based
authority must be trustworthy; suspend dependent admission after a clock discontinuity until reconciled.

### Operating Assignment and Successor Admission

Use the [operating responsibility contract](CONTRACTS_AND_STATE.md#operating-responsibility-and-handover)
for the initial CEO profile. Core stores the standing work's current assignment and selected
execution binding; it does not store an executable business plan or interpret the CEO's judgment.
This is a constraint on existing work/execution/admission records, not a separate CEO service.

At first start, current appointing authority, an existing principal, explicit delegation and the
required execution/input/resource conditions must be present. The CEO label, package name or
installation cannot supply them. Work creation or assignment does not reserve resources by itself.

When a wake is admitted, serialize the standing work's active execution selection under the same
firm authority fence as permission and reservation changes. A duplicate occurrence identifies
its original continuation; a different concurrent occurrence remains pending for that work while
the coordinator is active. Retain source identities and consumer progress without discarding
events or reserving another coordinator. Private decides how those events affect the agenda.
The next execution rechecks authority, source access and remaining shared capacity. Wake retry
does not extend the instance deadline or create an obligation to keep spending.

After a normal exit, a previously admitted wake uses that occurrence's existing continuation
authority to enter the same handover barrier and assignment transition below. Confirmed old
termination and resolved conflicting effects satisfy their steps without repeating them. No new
owner instruction or manual replacement request is required when valid continuation already
covers it. An absent, expired or revoked continuation cannot be supplied by the scheduler.

Assignment changes and coordinator-only decision publication use the current assignment revision
and actual bound instance, not merely a principal name or an expected document revision. Worker
result submissions remain separately scoped. An owner control command still uses its own current
authority and retains its origin; it does not impersonate the CEO or edit the private rationale.

The first replacement procedure deliberately uses a handover barrier instead of claiming a
distributed transaction across Core, Runtime and file catalog:

1. Admit the scoped replacement under current controller authority and expected assignment
   revision. Record the outgoing execution and intended successor; competing transitions cannot
   both take ownership. Cut off new outgoing-instance requests under the normal authority fence.
2. Observe restriction and termination of that coordinator. Inspect its dispatch claims and
   reconcile conflicting decision publications and management effects with their resource owners.
   A claimed publication may still commit after cutoff; use its original receipt or verified
   non-execution. Do not release reservations or resubmit effects merely because the process died.
3. Retain a pending handover while those results, actual fencing or provisioning are unknown.
   Current independently scoped inspection/containment may continue, as may child work whose
   own grants and conditions remain valid. Do not create an unfenced alternate coordinator.
4. After the barrier is satisfied, conditionally select the successor, advance the assignment
   revision and admit its execution under current authority and limits. Runtime supplies a fresh
   verified binding. Input materialization rechecks read scope. The successor reconciles the
   preserved handover view before publishing new official decisions.

Every transition retains a durable request identity and progress. After a Core/worker restart,
re-read that transition and existing executions/receipts before continuing it. An acknowledgment
lost after assignment commit is resolved by lookup, never a second assignment or new grant.
Revocation during handover prevents dependent admission even if its earlier preparation succeeded.

Stopping the coordinator is narrower than revoking a whole mandate. Inspect actual child grant
ancestry; valid unrelated scopes survive, whereas descendants of a revoked grant are restricted.
The new assignment cannot silently detach children from those ancestors. Existing long-lived
resources remain accountable without waiting for their extinction to transfer operating duty.

This procedure is a design requirement and is **NOT RUN**. The implemented fixture's successor
settlement restrictions and missing native checkpoint recovery are recorded in
[Validation](VALIDATION.md#native-revocation-and-successor-admission-evidence); this section does
not remove those checks or claim an operating coordinator can already be resumed.

## Failure and Recovery

| Failure | Required behavior |
| --- | --- |
| Core/store unavailable before admission | No new dependent effect; Gateway cannot replace current authority with a caller's cached assertion. |
| Commit succeeds but acceptance is lost | Locate the original intent and reservation; never reserve a duplicate. |
| Dispatcher/worker crashes after claim | Keep attempt and unresolved commitment; observe the assigned execution/provider before permitting another effect. |
| Observation storage unavailable | Accept only bounded protected spooling; never report unpersisted material evidence as durable completion. Restrict affected work before evidence capacity is exhausted. |
| Native session/instance disappears | Preserve work, authority, attempts, costs and obligations; revoke stale instance access without deleting their company records. |
| Backup predates a restriction or provider effect | Restore in a restricted state; establish current authority and reconcile actual external state before dependent resumption. A new generation alone is insufficient proof. |

Recovery first identifies pending intents, commitments, observed active configuration and gaps.
Runtime fences stale instances and checks actual resources. Designated outer reconciliation can
query existing effects and account for them using bounded recovery authority; it cannot create new
economic operations as an implicit administrator. A valid ongoing job receives a fresh instance
binding only after its prerequisites are established. Native checkpoint restoration follows these checks.

No automatic multi-host failover is claimed. Within the initial single-active-host profile,
restriction, durable records, backup, and verified restart take precedence over pretending the
company remained controllable through total host failure. Unaffected authorized work may continue
when its own prerequisites remain valid; unknown global commitments can restrict all dependent spending.

## Dependencies, Evidence, and Acceptance

Core consumes bounded observations and execution contracts from [Gateway](GATEWAY.md),
[Runtime](RUNTIME.md), and [Resource Services](RESOURCE_SERVICES.md). The
[integration design](INTEGRATION_AND_DEPLOYMENT.md) owns process/storage placement, and
[observation design](OBSERVABILITY_AND_CONSOLE.md) owns authorized projections and freshness display.

Session budgets, provider identity, transcript stores, and rate limits cannot independently
establish these company contracts. Reuse proven policy,
authentication, storage, and delivery machinery where it satisfies the contract; do not build
another general orchestration platform.

[Validation](VALIDATION.md) must cover concurrent reservations, duplicate requests/wake events,
claim/revocation races, lost responses, privilege laundering, candidate self-activation, storage
failure, and recovery from stale records. Writing this design does not execute those tests.

## Local Compute Return Implementation

`compute_returns` owns one immutable receipt per firm/execution. The assigned Runtime is the
reporting principal; Core owns the acceptance transaction and accounting. The firm fence
serializes it with admission and restriction. Rejected receipt validation does not mutate
accounting. The receipt insert, compute reservation settlement, capacity decrement and event
either commit together or roll back together. Core does not manufacture a successful intent
or settle other limits. After response loss, an identical report or assigned-observer history
lookup recovers the original receipt.

[The shared contract](CONTRACTS_AND_STATE.md#compute-return-transaction) defines the request
and authority boundary. PostgreSQL fixtures verify transaction behavior. The artifact-backed
program connection now covers actual Runtime receipt production; native and multi-instance
management qualification must be assessed separately.

### First wake implementation boundary

Execution admission now has one transaction-owned implementation, `Core::start_locked`, called
by the authenticated start path under the firm fence. It validates current scope, program inputs,
predecessor closure and shared capacity, then writes the intent, input references, reservation and
outbox without committing independently. Future wake occurrence admission must call this same
implementation and commit the occurrence-to-intent binding in that transaction. This extraction
and one-shot registration/read/cancel, occurrence persistence and opt-in scheduler delivery are
implemented. Connected native timer recovery remains separately unverified.

The existing instance-origin request path deliberately requires a currently released and
permitted originating instance at dispatch. An ordinary pending request must not acquire durable
continuation authority merely because its instance exits. Preserve that behavior. The first wake
path needs an explicit, bounded continuation registration, authenticated while the actor is live,
with the original principal, work scope, delegation ancestry, exact execution request and expiry.
Its later dispatch must validate the stored continuation grant and current scope without
impersonating a live instance or silently removing its original provenance. Revoking an ancestor
must disable both admission and dispatch; stopping an instance alone must not invent or erase a
separately registered continuation.

Implement a single bounded timer occurrence first, retaining the same occurrence key after a
restart. No repeating timer, business-plan interpreter or automatic expansion of budget is
implied. Other occurrences while the selected work execution is active remain pending; a timer
must not select a different predecessor or silently change input revisions to make admission pass.
Event/dependency conditions follow through the same occurrence contract. These are pending
implementation requirements, not supported API claims or new grants enabled by default.

### Implemented one-shot wake registration

`POST /wakes` records an immutable `WakeRequest`: `due_at_seconds`, `expires_at_seconds` (UTC Unix
seconds), and the existing full `ExecutionRequest` under `execution`. The due time must be in the
future and precede expiry. Registration requires explicit `wake.register` and `execution.start`
through the same actor/work/delegation checks used for human and actual-instance requests. No
existing grant gains either action automatically. Profile bounds, agent delegation and currently
resolvable program inputs are checked; a selected predecessor must belong to the same work.
Up to 16 unexpired, uncancelled registrations per work are accepted as a metadata admission bound,
not as additional compute authority.

`GET /wakes/{id}` requires current work inspection permission. It returns the immutable execution
request, due/expiry, cancellation and expiry observations, and registration intent identity.
`POST /wakes/{id}/cancel` takes `{"delegation_id":"UUID"}` and requires current `wake.cancel`
permission for that work. Stable request keys bind both mutations; identical replay retrieves
existing results with current read checks, changed input conflicts, and replaying a cancelled
registration cannot reactivate it. Registration and cancellation intents succeed when their
records commit; this does not mean an execution occurred. Registration returns HTTP 201.

The first API is accessible through the existing CLI, for example:

```sh
ouroboros-cli --config CONFIG request POST /wakes --input REQUEST_JSON --key REQUEST_KEY
ouroboros-cli --config CONFIG request GET /wakes/WAKE_ID
ouroboros-cli --config CONFIG request POST /wakes/WAKE_ID/cancel --input CANCEL_JSON --key CANCEL_KEY
```

These registrations do not create execution rows, reservations, outbox entries or input retention
holds. Input references remain exact but may become unavailable before admission; the later
admission must re-resolve them, preserve their revision and reject unavailable inputs. An occurrence must pass the continuation admission described below; registration success alone
is not an execution permit.

### Implemented timer delivery and continuing authority

New registrations persist server-derived origin context and explicit continuation eligibility.
Migration leaves historical registrations ineligible; the scheduler cannot upgrade an older record
into continuing authority. The registration principal and immutable work/grant/instance provenance
remain separate from a live authentication claim. After the original instance exits, only this
explicit continuation path can reconstruct its restricted work/grant scope. Ordinary pending
instance-origin requests still require their original live instance at dispatch.

Core's optional `wake_poll_interval_ms` enables a bounded timer loop (100–60000 ms; absent disables
it). It examines at most 16 due, unexpired candidates per pass, rotating by last-check time so a
blocked candidate does not permanently starve later candidates. It performs no business selection.
For each candidate, the firm fence covers current principal/grant/work checks, active-work checks,
the existing execution admission and insertion of `wake_occurrences`. One `(firm_id, wake_id)`
selects exactly one execution intent; replay and restart recover that same mapping. `wake:` keys
are reserved for this internal path and rejected by the public start method. An unexpected old
intent at that key cannot be adopted without the original occurrence record.

If any execution on the selected work is not confirmed terminated, a different wake stays pending.
This serializes wake admission against existing executions and other wakes; it does not introduce
a universal singleton restriction for ordinary manually submitted parallel jobs. The selected
predecessor and exact input revisions are unchanged. Current capacity, native lineage and confirmed
predecessor compute closure remain prerequisites of the shared start implementation.

Cancellation, registration expiry, disabled principal and revoked/missing continuation actions
fence delivery, claim and subsequent Runtime permission checks. Expiry is therefore a continuing
authority deadline in this profile, separate from the instance's unextendable hard deadline.
Cancellation does not itself confirm process death or settle a pending execution reservation.
`GET /wakes/{id}` exposes the resulting `execution_intent_id` when delivered, preserving access to
existing execution/intent observations. Polling failures retain registrations; this is not a
clock-discontinuity or high-availability qualification. Deadline-aware process containment,
pre-dispatch cancellation settlement and connected native timer recovery require their remaining
tests and integration work.

### Implemented connection change proposals

The first local Registry increment handles a credential-version proposal for an existing fixed
native provider connection. `POST /connection-candidates` takes an idempotency key header and
`target`, `work_id`, `delegation_id`, `expected_credential_version`, `enrollment_intent_id` in JSON.
Core requires current `connection.propose` and inspect scope on the target, work/delegation scope,
and inspect scope on the source enrollment target. Human and actual instance callers use the
same actor checks; author and instance/generation provenance are supplied by Core, not the body.

The referenced enrollment must be a succeeded same-work Core intent with one succeeded original
attempt and a matching custody receipt. It must concern the connection's existing credential ID
and a strictly newer version. This proves a retained registration fact, not that the credential
still works or that the provider account/protocol has passed qualification. Core copies the
current provider configuration and changes only `credential_version`; endpoint, target, worker,
credential identity, timeout and response limit stay bound to the candidate. The current worker's
fixed provider configuration is not changed by this operation.

`connection_candidates` retains immutable base/proposed configurations, the original enrollment
reference, submitting principal and instance provenance. Ordinary UPDATE/DELETE is rejected by a
trigger. The initial profile bounds each target to 128 retained candidates and a provider
configuration to 8192 serialized bytes. Reaching that metadata bound denies further proposals;
there is no implicit deletion, acceptance or activation to make space. The initial provider shape
is deliberately limited to the existing native fixed-provider contract, not arbitrary adapter code.

Same-key/same-input replay returns the original candidate under current target and enrollment
read scope; changed metadata conflicts. `POST /connection-candidates/{id}/inspect` takes work and
delegation context, rechecks both scopes and returns the retained proposal. Read access to a
candidate is not a new dispatch grant. The Rust CLI reaches these APIs through its existing
`request` command and JSON input; a proposal response has HTTP 202 and `state: proposed`.

Bounded verification acceptance and configuration selection are implemented separately below.
Credential registration and candidate submission never automatically select a new version. General adapter/service proposals
will use the same connection identity and lifecycle responsibilities; this increment neither
executes submitted code nor creates an alternative privileged activation mechanism.

### Attributable connection review recommendations

`POST /connection-candidates/{id}/reviews` accepts an idempotency key and JSON containing
`work_id`, `delegation_id`, `recommendation` (`recommend` or `reject`), `rationale` (1–4096
UTF-8 bytes after rejecting whitespace-only input), and `evidence_intent_ids` (1–8 distinct,
non-nil IDs). The existing Rust CLI `request POST` command uses this Gateway management route.
The response is a recorded recommendation, with `operating_acceptance: false`; it does not
change candidate state, the configured worker, a credential, a grant or active configuration.

Under the common firm fence, Core resolves the authenticated principal and actual instance,
checks current work access, target `connection.review` and `inspect`, and source enrollment
inspection. The candidate author cannot submit a review, even using another delegation. Each
referenced resource intent must belong to the same work, have succeeded, and be inspectable
under the current target and namespace scope. Core retains its protected intent reference,
operation and observed state, without copying resource response bodies into the review. These
observations establish which completed calls the reviewer cited; they do not establish relevance,
provider compatibility, safety or profitability. Rationale is attributed reviewer content, not
trusted instructions or independently verified fact.

Migration 0022 owns append-only review records, authenticated reviewer/instance provenance,
request identity and evidence references. At most 64 reviews are retained per candidate; capacity
exhaustion rejects insertion without deleting evidence. Creation and its `connection.reviewed`
event commit together. Same-key identical input returns the original record after current access
checks; changed input conflicts. Ordinary updates/deletes are rejected. Replay is currently the
retrieval surface for a known review request; review listing and separate read-only inspection
remain unimplemented.

A different principal is an attribution boundary, not proof of independent evaluation: aliases,
shared instructions and common failure modes still matter. This first route deliberately records
recommendations only. Scoped acceptance must additionally bind the required verification evidence
and permitted profile; activation must independently enforce that acceptance and the current base
configuration. Neither later operation is performed by the review route.


### Bounded verification acceptance and configuration selection

A credential enrollment receipt cannot prove provider compatibility. The first acceptance profile
therefore authorizes verification only; operating qualification remains separate and unimplemented.
`POST /connection-candidates/{id}/acceptances` requires `connection.accept`, current work/target
and evidence inspection, an immutable recommending review of that exact candidate, and an acceptor
other than the candidate author. Its JSON contains `work_id`, `delegation_id`, `review_id`,
`max_calls` and `lifetime_seconds`. Both numerical values are required: the first profile permits
1–100 admissions within 1–900 seconds from acceptance. These are implementation ceilings, not
owner defaults. Scope is the candidate's work and `model.responses` only. The request key identifies
an immutable acceptance; replay never resets its deadline. Up to 64 acceptances may be retained per
candidate. A review is attributed judgment, not evidence that tests not yet performed have passed.

`POST /connection-candidates/{id}/activate` requires `connection.activate` and JSON containing
`work_id`, `delegation_id`, `acceptance_id`, plus a request key. Under the firm fence, Core checks
unexpired acceptance and its continuing delegation, compares the exact base configuration and
worker against the active target, selects the proposed configuration and records activation plus
its event atomically. An acceptance is activated at most once. Changed base, wrong acceptance or
transaction failure cannot partially update the target. Replay returns the original selection
record, not a claim of present readiness. `configuration_selected` explicitly precedes proof of
successful worker use; there is no provider call in this management transaction.

Admission and dispatch check the active acceptance's work, operation, expiry, current acceptor and
activator grants/scopes, enabled principals and exact selected worker/configuration. Each newly
admitted call reserves one permanent verification slot in the same transaction as its intent and
resource reservation. Replays consume no additional slot. Failure, lost response, lease expiry and
process exit do not refund slots. Dispatch/live checks require the original slot's activation to
still be selected. Existing authority polling restricts open delivery; it is not a promise to undo
an already received provider request. The request's resource limits and caller authority still
apply in addition to verification scope.

Migration 0023 retains immutable acceptance, activation and slot history and the current target
selection. Exhaustion or expiry fails closed: it neither restores the previous configuration nor
silently enables unrestricted operation. Existing fixed deployment targets remain supported when
no managed activation has been selected. Historical proposal `state: proposed` describes submission;
it is not a live connection-health result. The candidate status and stop paths are described below. Operational acceptance, general catalog
discovery, explicit retirement and backup/restore qualification remain to be implemented.

### Connection status and exact-activation restriction

`POST /connection-candidates/{id}/status` takes work/delegation context and requires current
candidate target and enrollment inspection. It returns only that candidate's bounded activation
history, Core-observed selection, expiry, admission counts, succeeded calls and pending effects.
A connection selected for another candidate is not disclosed as that candidate's metadata.
`selected`, `replaced`, `stopped`, `expired`, `restricted` and `exhausted` distinguish the control
state. `dispatch_policy_satisfied` describes the shared activation rules; caller use authorization
and each request's validation remain separate. `new_admission_policy_satisfied` additionally
requires an unused verification slot. Neither flag asserts provider availability or credential
usability; `worker_readiness: not_assessed` and `operating_qualification: false` remain explicit.
Counts are per activation, not the company's complete obligation or cost ledger. The snapshot is
read under the same firm fence used by admission and restriction.

`POST /connection-candidates/{id}/stop` requires `connection.stop`, current work and inspection
scope, an idempotency key, and JSON `work_id`, `delegation_id`, `activation_id`. The activation
must belong to the candidate and still be selected. Core atomically records the immutable stop
and restriction event (migration 0024); admission and live dispatch checks reject that activation
thereafter. The target configuration and historical pointer remain available for authorized
inspection. Stopping does not delete calls, refund verification slots, disable a shared credential
or assert provider cancellation. Existing streams are subject to the existing authorization monitor;
termination of every remote effect is not inferred from accepting the stop.

A same-key replay returns its original restriction after current read/stop authority checks. It
cannot stop a successor. A new request aimed at an old or already stopped activation conflicts.
Restriction remains effective if its issuer later loses authority. Selecting a separately accepted
successor preserves the previous stop and usage history; the old activation is not silently resumed.
The existing Rust CLI `request POST` command reaches both APIs through the common Gateway.

### Retained adapter material and verification execution admission

The first submitted-code entry reuses a retained non-native execution's exact program material.
`POST /adapter-submissions` accepts `work_id`, `delegation_id`, `target` and
`source_execution_id`, plus an idempotency key. The source must be in the same work and contain
retained, structurally consistent program inputs; native harness prompts and empty bundles are
not adapter releases in this profile. `adapter.submit`, target inspection and current namespaced
inspection/read access to every input are required. Submission freezes the program arguments,
profile, input references/digests and source execution, without copying local paths or credentials.
Source execution admission is enough to identify material; it is not proof that the program ran.

Migration 0025 owns immutable submissions with authenticated registrant/instance provenance and
`source_requester_id`. The latter identifies who requested the source execution; it does not
assert original code authorship. Each target permits at most 128 retained submissions. Existing
execution-input retention remains in force after the source terminates. Neither metadata capacity
nor process termination authorizes removal of retained code. Same-key replay checks current source
read scope. `POST /adapter-submissions/{id}/inspect` provides the retained material under the same
work, target and source permissions. Registration reports `tool_exposed: false`.

`POST /adapter-submissions/{id}/verification-executions` accepts the existing execution request
shape, with `program` and `predecessor_execution_id` absent. Work and profile must match the
submission. A separately authenticated requester other than its registrant and source requester
needs `adapter.verify`, ordinary `execution.start`, source read scope and a valid descendant agent
delegation. Core inserts the frozen program and uses the ordinary admission transaction for current
profile/inputs, compute reservation, intent/outbox and the verification-to-submission association.
Caller-supplied replacement code is rejected. Request keys cannot relabel a previously admitted
ordinary execution or another submission's verification. Replays retain the existing execution.
The normal Runtime materialization/guard/bridge path executes it; no privileged adapter runner or
secret injection is added.

Current program-ticket checks also recheck the verification grant and enabled requester. Revoking
only `adapter.verify` can therefore block Runtime claim/release even while `execution.start`
remains. The admitted job and unresolved effects remain retained. Distinct requester identity is
an attribution constraint, not proof of independent technical evaluation. Execution admission or
exit alone does not accept the adapter, publish MCP tools or activate its external connection.
The connected submitted-code Linux verification is covered in Validation. Evaluation receipts,
managed exposure, service lifetime and cross-work reuse remain subsequent integration steps.

### Protected backend program observations

The assigned Runtime can post `RuntimeProgramObservation` to
`/runtime/executions/{id}/program-result`. Core checks the original worker, instance/generation,
retained non-native manifest, completed materialization and released/terminated phase. A complete
observation contains the Docker exec identity, exit code, separate stdout/stderr byte counts and
SHA-256 hashes. Combined output must fit the admitted profile. Raw output is not copied into Core.
Migration 0026 preserves one immutable observation per execution; identical replay is harmless and
changed reports conflict. A private caller cannot submit this through the common management route.

The observer retains receipt-submission authority after ordinary execution permission is revoked;
this is evidence recovery only. `GET /executions/{id}` exposes the bound observation under current
work inspection with explicit Runtime source and `work_success_confirmed: false`. Neither zero
exit nor resource return marks the work succeeded, settles provider effects, accepts an adapter or
activates a tool. A missing observation remains unknown, including interrupted or incomplete output.

### Attributed adapter evaluations

`POST /adapter-submissions/{id}/evaluations` records a bounded principal assessment using
`AdapterEvaluationRequest`. Current `adapter.evaluate` and source inspection/file-read scopes
are required, including on replay. The evaluator cannot be the submission registrant or original
source requester. The referenced execution must belong to this submission's verification records
and already have a protected complete Runtime observation. Neither a supplied exit code nor an
ordinary execution can substitute for that record.

The body carries work/delegation context, `verification_execution_id`, `conclusion` (`supported`,
`unsupported`, or `inconclusive`), and nonempty `criteria`, `rationale`, and `limitations` (each at
most 4096 bytes). The conclusion refers to the stated criterion, not general operational fitness.
Core stores the immutable assessment, evaluator, exact observation, and database time in one
fenced transaction with its event. Each submission admits at most 64 assessments. Same-principal
request-key replay returns the same record; changed content conflicts. Lost responses recover by
that replay under current authority. Revoked execution permission does not erase historical evidence.

This is an attributed judgment, not automatic acceptance: a zero or nonzero exit does not select
its conclusion. All responses retain `independence_confirmed: false`, `operating_acceptance: false`,
and `tool_exposed: false`. Distinct registered principals alone cannot establish evaluator
independence or authorship. Criteria are declared by the evaluator, not precommitted evaluation
policy. Subsequent acceptance must assess these limitations and the supporting evidence explicitly;
this route creates no activation, credential use, or permission. Submission inspection returns bounded evaluation and acceptance history under current source
inspection rights, without requiring permission to create a new assessment. It uses the common
API/CLI path; a global discovery catalog remains follow-up work.

### Explicit bounded adapter acceptance

`POST /adapter-submissions/{id}/acceptances` takes `AdapterAcceptanceRequest`: work/delegation,
`evaluation_id`, mandatory `max_calls` (1–100), `lifetime_seconds` (1–900), nonempty `rationale`
and `independence_basis` (each at most 4096 bytes). These bounds limit the first local profile;
there are no favorable default values. Current `adapter.accept` plus target and retained input
inspection/read scopes are required. The acceptor cannot be the submission registrant or source
requester. The evaluation must belong to the exact frozen submission and report `supported` for
its stated criterion. A negative or inconclusive evaluation cannot be promoted by this route.

Acceptance explicitly records the responsible principal's interpretation of criteria, limitations
and evaluator independence. Different principal IDs or a zero exit do not prove these judgments.
An evaluator may also accept when separately delegated; the source/registrant remains excluded.
This is a bounded authorization decision under a supplied grant, not an economic or production
fitness certificate. Exact material and profile stay in the immutable submission. New acceptance
requires that same profile to be currently active and unchanged.

The Core authority transaction records scope for the same work and `adapter.invoke`, grant, exact
evaluation, and an absolute database deadline. At most 64 acceptances can belong to one submission.
Replay uses current inspection and accept permissions, preserves the original deadline, and rejects
changed input. A recorded expired acceptance remains history, not renewed authority. Submission
inspection includes both assessments and acceptance records (up to their fixed per-submission caps).
The `acceptance_recorded` state is historical; it does not assert current eligibility.

Activation is a separate required transition: acceptance alone does not install a tool, dispatch
code, reserve a call or grant invocation. Acceptance responses are immutable history and retain
`activation_required: true` and `tool_exposed: false`; current selection is exposed separately in
submission inspection and the invocation path below.

### Selected adapters and contained invocation

The first local managed invocation uses fixed argv and the exact retained input manifest. It is a
bounded program operation, not yet a parameterized domain tool or a persistent service. The following
routes use the common human/instance Gateway; the CLI uses `request POST`:

| Route suffix under `/adapter-submissions/{id}` | Request | Result |
| --- | --- | --- |
| `/activate` | Work, delegation, acceptance ID, expected current activation ID (null for first selection) | 201, immutable configuration-selection record; no worker readiness claim |
| `/invocations` | Activation ID and ordinary `ExecutionRequest`, without program or predecessor override | 202, ordinary accepted intent/execution; current replay flag, not completed work |
| `/stop` | Work, delegation, exact activation ID | Restriction recorded; not proof of process termination |
| `/inspect` | Work and delegation | Retained evaluations/acceptances and bounded activation history, selection, stop, expiry and admitted-call counts |

Activation requires current `adapter.activate`, source inspection, and a still-valid acceptance
whose acceptor and grant retain `adapter.accept`. The expected-selection comparison, immutable
activation and target pointer update share the Core fence. Each acceptance can activate once;
replacement requires another acceptance and the exact previous selection. Replay cannot reactivate
an old selection or extend the acceptance deadline. Selection does not distribute credentials.

Invocation checks selected/not-stopped activation, acceptance deadline, current acceptor and
activator grants, the caller's `adapter.invoke`, current source access, and normal execution and
agent delegation. It admits the frozen code through `start_locked`, compares the resolved program
ticket with the submitted ticket, and records the invocation in the same transaction as compute
reservation and outbox. Only a new intent consumes a call. A repeated request must match both the
ordinary execution input and the activation binding; an ordinary execution cannot be relabeled as
an invocation. Failed, stopped or uncertain calls remain counted. Current live authorization
checks do not reject an already admitted call merely because its admission consumed the last slot.

Runtime claim, release and live checks enforce the same selected activation, deadline and grants.
Instance Gateway requests enter through `runtime_allowed` and inherit these checks. Direct successor
creation from a managed invocation is rejected; a continuation must be a new currently authorized
invocation. Independently authorized general code execution does not acquire adapter authority.
The current profile deliberately has no automatic retry or variable-input substitution.

Stop records a durable restriction for the exact current activation, including after expiry or
loss of its original acceptor grant. An old stop replay returns its old record without affecting a
replacement; a newly requested stale stop conflicts. Stopping does not remove effects, positions,
receipts, invocation slots or compute obligations. Runtime observation and termination/return
reconciliation remain separate. Inspection's `current_authority: checked_on_use` explicitly means
historical selection/counts are not a promise that the next request will be authorized.

### MCP uses the same admission and inspection authority

Managed MCP dispatch delegates to `invoke_adapter`; it does not write invocation, reservation or
outbox state itself. Only discovery metadata and protocol formatting are new. `execution_get`
uses the ordinary management projection with an additional explicit work/grant restriction checked
in the same transaction. Revoking that named grant cannot be bypassed by another available read
grant between the initial MCP scope check and the actual read. Disabled resource targets also
restrict new selection, current invocation/Runtime checks and discovery; historical inspection
remains available under its own current rights.

### Explicit cancellation before any dispatch

`cancel_unstarted` uses the existing `execution.stop` authority under current actor/work scope.
It is an explicit request, not an automatic consequence of adapter stop, expiry, or a worker error.
The same firm fence used by Runtime claim checks the expected authority revision, original intent
state `accepted`, an unclaimed outbox row, absence of every attempt and Runtime instance, and an
unsettled compute reservation. A claimed or ambiguous execution returns conflict without releasing
resources. The worker cannot race past a successful cancellation because both paths use this fence.

One transaction marks the execution stopped and its original intent restricted, returns exactly
its reserved compute units, releases only this never-used execution's retained input references,
increments the firm revision and writes an immutable `unstarted_cancellations` receipt and scoped
event. The original admission, outbox, inputs, artifact bytes and adapter invocation allowance remain
in history. No Runtime termination, compute-return observation, work success or profit is invented.
The receipt records the authenticated issuer, selected grant and instance/generation when present.
A same-key/same-input retry returns the original receipt only after current stop authority is checked;
a conflicting key/input or stale revision is rejected. Historical inspection exposes the receipt.

### Next local operations seam: pause admission, then establish a cold boundary

The current implementation has individual execution restriction and receipt recovery, but no
whole-environment admission gate. Process termination alone therefore cannot establish the cold
backup boundary. Add this gate before exposing a backup command; do not report backup readiness
from a live-process count alone.

The first control is an explicit `POST /environment/admission` request through the common Gateway.
Its input is `delegation_id`, `expected_revision`, `paused` and a bounded nonempty `reason`, with a
stable request key. It requires a current explicit `environment.admission` action whose delegation
ancestry has no work-root restriction. No existing administrator, author, conversation participant
or submitter gains this action automatically. The permission criterion is the same for people and
Runtime-bound agents; a bound caller must use its actual delegation. This operational control cannot
create a principal, designate a sovereign, enlarge limits or alter the company's purpose.

Persist the pause bit and transition receipt under the same firm fence used by admission and claim.
Current action/scope checks precede replay; identical keys return their original transition receipt
without changing the present mode. Changed input or a stale expected revision conflicts. A successful
transition advances the firm revision and records issuer/instance/generation, reason and old/new
values. Historical receipts are evidence of a transition, not proof that the current mode still
matches them. Report the current pause bit separately through conditions/status.

While paused, reject fresh execution starts (including wakes and adapter invocations), new resource
admissions and new dispatch claims. Recheck at the existing send/release boundary so a pre-pause
claim cannot start new effects merely because it already has a ticket. Preserve all original intents,
attempts, reservations, artifact references, positions and pending obligations. Current authorized
result lookup, receipt-only reconciliation, stop/revoke and observation/completion reports remain
available. Replaying a completed resource request may return its existing result; it cannot create a
new effect. Admission pause does not extend a guard deadline or rewrite instance identity.

The transition response must say only that the control record changed. It must not claim existing
streams were drained, processes terminated, storage writers stopped, effects settled or a backup
became coherent. The lifecycle operator subsequently observes those states, restricts remaining
execution as authorized and performs the cold shutdown sequence. Physical writer termination and
an identified cross-store cutoff remain required even when the pause bit is true.

An explicit unpause under current authority may resume an ordinary paused installation, but it is
not authority to activate a restored or ambiguous installation. Restore freshness, writer fencing,
revocation continuity and store binding must be qualified separately before restoration can enable
business dispatch. Until that path exists, no supported backup/restore command may automatically
unpause restored data. The implementation status below distinguishes the connected Core gate from unqualified
shutdown behavior. Describing or implementing the endpoint grants no caller its required action.


The first implementation adds `firms.admission_paused` and immutable
`environment_admission_changes`, plus the Gateway/Core route and conditions projection. New
execution admission and claim, Runtime release/live permission, new resource admission, the shared
resource dispatch/live check, and collection advance/claim/dispatch consult the pause bit under the
firm fence. Existing result lookup, Company receipt recovery and completion/termination records
retain their original paths. Stable-key transition replay requires current action and unrestricted
ancestry and cannot overwrite a later transition. No grant is inserted by migration.

PostgreSQL tests qualify transition authorization, scoped-caller denial, stale/replayed controls,
execution admission/claim restrictions, admission-vs-pause ordering and preservation of pending
reservations and Company observation. Actual API/CLI transition delivery, preclaimed effects in
every worker and a complete cold shutdown remain unqualified. In particular, admission pause is
not yet proof that every worker checks again immediately before its irreversible effect; that
coverage must be completed before the shutdown profile is accepted. This is not a backup-ready gate.


The connected running-service qualification confirms that pause leaves authorized instance
conditions readable while denying fresh execution. The existing Runtime current-permission loop
then terminates the contained service after its supervisor can run again; the transition receipt
itself remains an observation of the control change only. A suspended or failed supervisor still
requires its independent guard and separate termination evidence. The finite running-service test
and its unqualified shutdown boundaries are recorded in
[Validation](VALIDATION.md#admission-pause-while-a-contained-service-is-running).


### Environment shutdown inventory

`GET /environment/status/{delegation}` is a read-only Core-record inventory through the common
Gateway. It requires the caller's current `environment.admission` grant with unrestricted work
ancestry, including the existing actual-instance checks for agents. An ordinary work inspector
cannot use it to enumerate firm-wide state. Migration and first access create no authority.
The generic CLI uses `request GET /environment/status/<delegation-id>` with its normal authentication.

The response contains the firm/revision/event cursor, statement observation time, pause state,
and counts of executions awaiting an instance, instances and Runtime records without termination,
unclaimed outbox records, resource calls without replies, dispatched calls without replies, and
unsettled reservation records. Core obtains these aggregates in one SQL statement under the firm
fence; lookup does not change records, generate events, reconcile effects or stop workers. No
payload, credential or private conversation content is returned. Counts of different categories
can overlap and must not be added as a total number of outstanding tasks.

`source: core_records`, `drain_confirmed: false` and `backup_ready: false` are explicit. Even all-zero
counts are not physical liveness evidence or a store-writer barrier. An unclaimed record can be
historical/cancelled; a reservation can remain after a successful operation. Follow-up uses its
original authorized execution/effect APIs and actual backend evidence, not automatic cancellation
or settlement based on these counts. This is an input to shutdown, never a backup authorization.
