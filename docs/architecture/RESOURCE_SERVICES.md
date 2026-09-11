# Resource Services

This is a proposed component design under the [Architecture](../../ARCHITECTURE.md) and
[Contracts and State](CONTRACTS_AND_STATE.md). It defines mediated resource behavior, not installed
providers, executable APIs, credentials, or authority to trade. Private operation selects and
evaluates work; these services execute admitted operations and report their actual consequences.
The first HTTP paths, request identities, result codes, and native invocation rules are defined
once in [the common contract](CONTRACTS_AND_STATE.md#first-connected-routes). This document fixes
the resource-specific input, persistence, and recovery behavior behind those paths.

## Ownership and Execution Boundary

Resource Services contain capability handlers and scoped provider adapters. They resolve resource
meaning, validate capability-specific conditions, execute a Core-issued dispatch claim, and submit
observations. They cannot grant authority, enlarge a reservation, activate their own replacement,
or decide that a research result justifies more capital. [Control Core](CONTROL_CORE.md) owns those
protected execution conditions; economic allocation remains private.

All human and private resource access enters through [Gateway](GATEWAY.md), including background
services, native harness tools, and subsequent operations on an existing stream or resource.
Bulk handlers may carry bytes without sending them through Core, but remain on the enforced
Gateway data path. No handler returns a provider credential, directly usable signed URL, raw
database connection, shared host mount, or runtime socket as an alternative client route.

Trusted adapters use narrow internal provider and observation interfaces. This does not expose
another client API. Provider credentials remain outside private execution. A native tool's ability
to call a provider directly is disabled unless its actual path satisfies this same boundary.

## Activated Targets and Required Conditions

Registration records a capability; activation selects verified behavior and configuration.
Admission resolves the activated target and its domain enforcement before dispatch. Caller labels,
MCP annotations, URL shape, or a model's interpretation cannot select a weaker resource family.

| Target information | Required treatment |
| --- | --- |
| Resource identity | Canonical provider, account, database, workspace, or resource identity, including known aliases and shared ownership. |
| Capability and domain | Supported operations, material argument meaning, applicable domain checks, and unsupported behavior. |
| Endpoint configuration | Approved destinations, paths/protocols, transport verification, account selection, redirects, and any permitted secondary endpoints. |
| Credential binding | The scoped credential reference and worker permitted to use it; never an inner-supplied backend secret. |
| Data and result scope | Permitted namespaces, objects, methods, retained inputs, result size, disclosure, and evidence access. |
| Limits and timing | Required concurrency, resource/cost bounds, deadlines, freshness, stopping behavior, and in-flight allowance. |
| Recovery behavior | Provider request identity, deduplication scope and retention, result lookup, cancellation, and unresolved-effect handling. |

Missing required limits or unverified recovery guarantees prevent dependent admission; the adapter
must not substitute unlimited defaults. Values come from an activated profile and valid mandate,
not this document. Provider estimates are not hard ceilings. A capability whose costs or effects
cannot be bounded as required remains unavailable under that profile.

Two connectors addressing one account do not establish two balances, exposure limits, or budgets.
Preserve route-specific observations while reconciling them to the same canonical resource. Alias
uncertainty remains visible and blocks allocations that depend on treating the resources as separate.

## Intent, Attempts, and Continuing Resources

Follow the common admission contract: Core persists intent and applicable reservation, then issues
a bounded dispatch claim for an assigned worker and fixed material input. The adapter verifies that
claim against the operation it will send. A redirect, account change, argument mutation, or fallback
outside the admitted configuration requires a new admission decision, not silent forwarding.

Preserve the provider request identifier, actual attempt, timestamps, configuration, observations,
usage, and uncertainty. A returned result may confirm acceptance, partial effect, completion, or
failure. The request's response, Core's durable acceptance of an observation, and the provider's
actual effect are separate facts. A completed create request can leave a chargeable resource.

Each adapter states whether the provider deduplicates requests, the key's account/operation scope,
material-input matching, retention window, lookup methods, and treatment of delayed responses.
Use a stable intent across permitted retries, but retain every attempt. An expired deduplication
window, missing lookup result, or transport timeout does not prove that repetition is safe.
If dispatch might have occurred, reconcile the original effect before another attempt that could
duplicate it. Without sufficient provider evidence, report unresolved and preserve responsibility.

Subsequent stop, delete, settlement, or release operations have their own current authorization
and link to the existing resource. Process exit, session deletion, cancellation acknowledgement,
or a missing resource in one incomplete listing does not establish that all charges or obligations
ended. Reconciliation uses separately bounded observation/recovery authority, not revived agent
credentials or generic permission to create replacement resources.

## Company Workspace and Artifacts

The initial interface provides identified snapshots or selected files, allocated local working
copies, and explicit publication. Reads check namespace, path, caller scope, expected revision,
and byte bounds. Normalize paths and reject traversal, symlink escapes, unexpected archive entries,
and references outside the authorized snapshot. Snapshot contents retain usable content references.
Already delivered local bytes can be read or edited within the allocated runtime without another
network call; shared or durable company changes still require Gateway publication.

The first snapshot response identifies `workspace_id`, `revision`, and manifest/content references
with their paths, content identities, and sizes. Its file endpoint fixes the revision in the route
and accepts `path` within that manifest; it never silently reads a newer head. Initial copying into
an execution uses a Gateway-approved input binding for the target principal, not the launcher's
wider file permissions. A caller may read only the permitted portion of a snapshot.

Staging/upload and revision-checked publication are separate fixed intents. Each independently
tracks its request key, admission, applicable reservation, claims, attempts, uncertainty, costs,
and retries. Their work and content references connect them; an upload claim cannot authorize
publication, and another claim on that intent cannot change its fixed effect into publication.

The upload JSON command fixes `sha256` and `size` under its own request key. Core fixes the
work, registered target, namespace, storage generation and bounds from authenticated scope and
configuration; selecting the destination workspace belongs to the separate publication. The response returns `upload_id` and the upload intent, not
a provider URL. The content PUT addresses that same intent and uploads only its declared bytes.
It authenticates the current caller and obtains the assigned worker's current claim before writing.
It is the data execution stage, not another JSON admission or a second upload allowance. A second
PUT cannot change the content or forward another attempt while the original remains unresolved.

The publication JSON command fixes `expected_revision` and the submitted manifest of verified
staged-content references under a separate request key. References resolve to retained immutable
content and allowed ownership; they are not caller-selected storage paths or proof of permission.

The sequence is:

1. Admit an upload intent with declared content identity, size, namespace, and bounds. Bind its
   staged upload handle to that caller, upload intent, scope, and bounded lifetime.
2. Obtain the upload dispatch claim and stream through Gateway into outer-owned staging. Verify
   actual size/content, complete immutable blobs durably, and submit upload observations to Core.
   Mismatched or unverified bytes are ineligible for publication; uploading never changes a head.
3. Separately admit a publication intent fixing the target workspace, expected revision, submitted
   manifest, and verified immutable staged-content references. Obtain its current dispatch claim.
   In one resource-metadata transaction, compare the expected revision, commit the new manifest,
   and record a receipt with the publication intent and fixed input. A conflict leaves the head intact.
4. Submit the receipt and content references to Core. Report provider/metadata commitment separately
   from Core's accepted observation and delivery of the response to the caller. Do not assert the
   complete recorded outcome until Core has durably accepted the material receipt.

The file service owns upload verification, workspace manifests, and publication receipts. A receipt
is unique for its intent and retains the fixed-input fingerprint, resulting workspace revision,
and content references. Manifest change and receipt insertion are one transaction in the owning
resource-metadata store. Private business queries cannot modify either. Core separately owns the
intent, reservation, accepted observation, and unresolved responsibility; it does not claim a
distributed transaction with the file store.

Blob storage, publication metadata, and Core records are not assumed to share a transaction.
If blob completion fails, no new manifest becomes visible. If blobs exist but metadata fails, they
are staged or orphaned content, not a publication. If metadata commits but its response is lost,
look up the receipt and current manifest using the original publication intent; do not publish
another revision blindly. If Core is unavailable after commitment, retain the receipt and reconcile
its observation. If an upload's final response is lost, first reconcile its content and verification
record under the upload intent, rather than treating it as an unperformed or free upload.

Cleanup observes retention and current references, including unresolved intents, receipts, recovery
records, and evidence obligations. It cannot delete a possibly committed blob merely because an
upload lease expired or the worker disappeared. Failed uploads and orphan retention consume storage
and remain accounted for until cleanup is confirmed. Snapshot and receipt retention are explicit.

Private edits remain local until publication commits. Publishing content does not activate its
code, register a trusted service, change authority, or verify its claims. Concurrent publication
returns a conflict with an authorized revision reference; private operation chooses any merge.
Transparent shared writable mounts are outside the initial interface and require separate tests
for cached data, open handles, concurrent writes, and effective restriction before introduction.

## Generated Artifact Workflow and Space

Use the common [artifact-use and space contract](CONTRACTS_AND_STATE.md#artifact-use-and-allocated-space).
Private agents produce content and select its intended use. Resource Services preserve identified
content and execute authorized resource operations; they do not certify a report's economics or
load generated code into a trusted service. No separate artifact-approval platform is required.

1. **Allocate for work.** Within delegated creation/growth scope, request a logical workspace or
   reuse one, then request bounded execution with identified inputs. Core reserves actual scratch
   and other capacity; the file service provisions an authorized namespace using a durable intent
   and receipt. If acknowledgment is lost, locate that namespace instead of creating another.
   Workspace provisioning and an execution request are distinct; neither silently performs both.
2. **Create and test.** The CEO or a scoped worker edits, compiles and runs code inside its existing
   execution limits. Downloads, dependencies and external tools use admitted Gateway resources.
   Local changes need no per-file publication or manual approval. Separate build jobs use the
   normal compute path; no resource handler builds private code in its privileged process.
3. **Freeze the intended result.** Upload exact bounded content, verify it, then request a separate
   workspace publication. Preserve source/build/dependency and creating-work references where
   needed. An executable bundle, dataset and report can share one catalog without sharing permissions.
   Publishing under an existing name creates a new revision, not an in-place replacement of retained bytes.
4. **Use under the applicable contract.** Data can be read under current scope; a bounded job can
   use admitted exact inputs; a service or adapter requires its managed acceptance/activation.
   The owner of an execution, candidate or active release acquires acknowledged holds on its
   required content before committing the dependency. Release those holds through that owner's
   reconciled lifecycle, never from a worker's assertion that the files are no longer needed.
5. **Preserve or retire.** Publish useful results while authorized, retain required evidence and
   account for costs and unresolved effects. Job termination does not publish scratch or delete
   service data. Request retirement of eligible material through the existing catalog procedure;
   only confirmed disposal changes physical occupancy accounting.

An administrator may provide initial spaces and artifacts through the same resource contracts;
private operation can create further scoped material within actual delegation. Provenance remains
distinct from permission. Only the CEO's designated official decision scope uses the operating
assignment writer constraint; worker reports, code and experiments retain their own scoped writers.

### Space Allocation and Growth

Execution scratch, retained content, upload staging, service data and shared backing capacity use
their existing canonical pools. Compilation, dependency unpacking, logs, temporary databases and
upload copies consume the actual applicable pools even when the input is already stored elsewhere.
Reserve bounded peak overlap before dispatch; do not spend anticipated deletion or deduplication
savings. A new workspace, builder or service cannot multiply firm allowance. Protected records and
required recovery/evidence headroom remain unavailable to private growth.

The initial file workspace is a logical namespace with immutable revisions, not a writable host
directory delivered to the agent. Runtime supplies an instance-owned working copy; publication
is the explicit merge boundary. Filesystem paths are resolved only by the activated backend owner.
A workspace-size ceiling does not eagerly allocate that many bytes; individual growth and actual
occupancy reconcile to the same reservation contributions without double-counting. Required byte,
object, staging, temporary expansion and lifetime bounds are explicit; unavailable enforcement
blocks the affected profile rather than granting the whole host volume.

Service data is allocated separately through the file or DB handler. A service uses current
Gateway file operations or registered DB operations; the first profile provides no shared writable
mount, raw database login or persistent local disk attachment. A dependency that requires those
interfaces remains unsupported until a separately qualified contract exists. DB namespace/schema
provisioning, where authorized, uses a fixed managed operation and its effect receipt, not private
SQL administration; the current read/record fixture does not implement general provisioning.

Expiry limits further use or triggers an authorized retirement check. It cannot erase holds,
pending publications, prior evidence or obligations. Cleanup addresses exact storage/instance
generations and records actual results. If quota is reached, restrict further growth and preserve
required evidence; the responsible private work may request a justified increase or retire eligible
material. Silence or failure is not permission to select another disk or consume protected capacity.

The connected allocation subset is defined in the [workspace and retained-object contract](CONTRACTS_AND_STATE.md#workspace-allocation-and-retained-objects). Executable bundle delivery,
managed services and full backing-capacity reclamation remain outside that subset. Additional
[logical retirement](CONTRACTS_AND_STATE.md#logical-reference-retirement) and
[explicit object collection](CONTRACTS_AND_STATE.md#explicit-object-collection) have local
implementations, with their DB/API verification tracked separately. See [artifact/space validation](VALIDATION.md#generated-artifact-and-space-validation).

## Persistent Artifact Lifecycle

This section specifies persistent storage behavior, distinguishing the connected subset from the
remaining recovery and broader retention design. Its names and shared state meanings
belong to [Contracts and State](CONTRACTS_AND_STATE.md); capacity admission belongs to
[Control Core](CONTROL_CORE.md), and physical placement, storage binding, backup and restore belong
to [Integration and Deployment](INTEGRATION_AND_DEPLOYMENT.md). The full lifecycle remains
**NOT RUN**. The implemented local binding subset and its limited evidence are described below;
bounded fixture results do not qualify the full lifecycle.

### Inventory and Ownership

Persistence follows the lifetime of a company obligation or retained result, rather than the
lifetime of a checkout, native session, worker process or container. The file service owns bytes,
their catalog references and the execution of an authorized retention decision. Private operation
selects useful research and business material and may request its retirement within its delegation;
it does not obtain filesystem administration or decide whether an evidence obligation has ended.

| Material | Persistent owner and reference | Lifetime boundary |
| --- | --- | --- |
| Published inputs and business results | File catalog: firm, workspace revision, permitted path and retained blob generation. | Retained revisions and explicit obligations survive instance and source-checkout replacement. |
| Accepted uploads and incomplete staging | File catalog: original upload intent, staging identity, declared bound and actual bytes. | Publication, cancellation or a failed worker does not itself release storage; uncertainty and authorized retention must be resolved. |
| Native checkpoints and restricted supporting evidence | The responsible outer service retains an access-scoped artifact reference and a retention hold. | A checkpoint is recoverable material, not current authority; secret-bearing native material requires its protected handling contract. |
| Authority, effect, cost and lifecycle records | Core or the owning resource database retains its protected records; associated large content is held in the catalog. | Artifact retirement cannot delete or rewrite protected economic history, receipts, restrictions or obligations. |
| Recovery-set content | Backup preparation establishes explicit holds on required blob generations and identified database recovery points. | Verified completion or reconciled abandonment can release preparation-only source holds; destination retention and separate operational/archive obligations remain. Unrelated expiry releases none. |
| Runtime scratch and delivered working copies, including private agent builds/downloads/caches | Runtime allocates bounded temporary space against company work and records confirmed disposal. | Local bytes are not a publication or a backup. Retaining results uses the normal file-service path; required termination cannot wait for a final upload. |
| Product developers' host worktrees, package downloads, compiler caches and disposable test output | Host development tooling, outside the activated company store; distinct from private agents doing company work. | Development cleanup never scans or deletes company storage; source control does not preserve untracked operating data. |

The inventory records material size, provenance, owning intent or reference, lifecycle state and
its storage binding. A digest identifies content and never creates access. Core owns the current
permission and commitment; the catalog owns the verified content and reference facts. Neither may
infer the other's durable acknowledgement from a successful local write.

### Bounded Content and Durable References

The file path streams bounded binary bytes through the admitted Gateway path. It requires a
declared size and digest, finite upload lifetime, bounded buffers, backpressure and actual byte
counting; excess or mismatched bytes cannot become publishable. Target configuration supplies
`max_file_bytes` and `transfer_seconds` explicitly, independently of the small JSON metadata
limit. Core retains no file body. See the [transfer contract](CONTRACTS_AND_STATE.md#binary-resource-transfer-contract)
for current source identity, fixed expiry and delivery checks. Binary transfer does not establish
executable bundle admission, retention or reclamation.

Before data transfer, Core reserves the applicable storage amount and the catalog records the
staging identity under the existing upload intent. The file worker verifies its active storage
binding and uses the protected owned root, not a caller-selected path. A failed storage binding
or unavailable capacity blocks writes without creating a replacement directory or choosing an
alternate disk. The physical enforcement and measurement limits are specified in the deployment
document; free-space sampling alone is not an atomic shared reservation.

Write a new staging object exclusively, verify its complete size and digest, synchronize its bytes,
install its immutable physical object without replacement, and synchronize the containing directory
before recording it as durable in the catalog. Staging and installation must use the qualified
filesystem path; cross-filesystem copying cannot silently stand in for the required installation
operation. Failure before the catalog acknowledgement leaves identified staging or an unresolved
installation, never a successful upload. Capacity remains charged until its actual disposition is
confirmed. The catalog commit and Core observation still require separate acknowledgements.

A blob generation identifies one physical object's lifetime within a storage binding. Its physical
key includes a non-reused generation in addition to its digest; a later upload of identical bytes
cannot reuse a deleted generation's physical key. A collector carrying an old deletion intent must
therefore be unable to unlink the replacement. Metadata includes the full binding and generation,
and all writes, reads and cleanup validate them. Digest equality is insufficient for that check.

Any future persistent deduplication is scoped to one firm and store generation, subject to the
current caller's content scope. Reuse would require the new upload's own admission and catalog
checks. Current uploads create distinct object generations and retain their full charges even when
content is identical. Reuse never grants access to an existing workspace, discloses an
unauthorized reference, or imports another owner's retention decision. Neither responses nor quota
decisions expose cross-firm content existence. A generation already marked for deletion cannot be
revived through deduplication; a fresh authorized upload creates a new generation if required.
Conservative admission includes the possible full staging allocation even when matching content
may exist. Verified reuse and confirmed staging disposal determine subsequent accounting.

Every durable dependency must acquire a catalog retention hold before its owner commits that
dependency. The hold has a unique owner and reason from the shared contract: for example an
accepted upload, a retained workspace revision, a Core work/checkpoint reference, an unresolved
effect or a recovery set. A reference containing only a digest or a requested hold is insufficient.
The owner retains the catalog's acknowledged hold identity with its dependency. If the owner commit
fails or its reply is lost, the hold remains for reconciliation rather than expiring automatically.
Release is an explicit, attributable action by the permitted owner under the applicable policy.

Catalog transactions acquire affected workspace rows first, then blob-generation rows in canonical
identifier order; a transaction holding blob rows never later acquires a workspace row.
Publication uses that order, verifies eligible state and required holds, then commits the new manifest,
snapshot retention and publication receipt in the owning catalog transaction. Any hold needed for
that revision is established in the same transaction. Hold acquisition and deletion marking use
the same catalog object-generation serialization boundary. Thus publication cannot race a collector
that has already made its objects ineligible, and the collector cannot overlook a committed hold.
Core, backup and other cross-store owners establish acknowledged holds before their own commit;
they do not obtain a fictional cross-database transaction. Do not keep a Core admission transaction
open across a catalog RPC: committed intents/outbox and idempotent hold reconciliation stage the
dependency, and the later owner transaction accepts it only after the hold acknowledgment.

### Retirement and Collection

Retirement is a current authorized request to end a named material reference's ordinary retention,
not a command to delete an arbitrary digest or directory. Humans and agents use the same Gateway
admission and Core permission checks. The request fixes its scope, purpose, expected material
revision and stable request identity. Missing retention policy, an unknown effect or an unresolved
reference makes the target ineligible for deletion. Reclaiming disk space cannot waive a hold.

#### Connected Logical Retirement

The current resource worker implements `file.retire` for registered namespace targets through
`POST /retirements`. The [shared contract](CONTRACTS_AND_STATE.md#logical-reference-retirement)
owns its exact selectors, policy fields, CLI syntax and result meanings. Core admits only the
current work/namespace scope and the explicitly configured policy; absent policy denies retirement.
The worker receives the frozen request and policy from its claimed ticket. A caller cannot supply
a replacement storage path, retire a legacy digest-only object, release another owner's dependency
or choose a different policy in the byte service.

Admission preserves the source effect and an enduring reference barrier. Core rejects unresolved
publications that depend on the selected upload or affect its workspace, and subsequent admission
and dispatch recheck applicable barriers. This orders cross-store intent without holding a Core
transaction across a Catalog RPC. If execution fails or its response is lost, the barrier and source
records remain; receipt reconciliation cannot fabricate a new retirement attempt.

Catalog locks the exact workspace before its affected object rows, with objects ordered by ID.
It verifies the original owner, object generation, hold lineage, expected revision and policy age
before committing a retirement record together with the permitted state change. An upload releases
only its upload-owner hold. A revision releases only that revision's exact object holds, retaining
the immutable manifest. An active head cannot be retired as a revision; it must first be replaced
or the workspace explicitly closed. Workspace closure matches the supplied current head and marks
the workspace nonwritable, retaining every revision/upload hold and all bytes.

Both services require a known source completion time when minimum retention is nonzero. Catalog
checks the upload or snapshot's original completion time; closure uses the expected head snapshot,
including revision `0` for an empty workspace. It does not use the older workspace allocation age
after a later publication. Migration leaves unknown ages unknown. An explicitly configured zero
interval waives age alone, while the policy, authority, material and lineage checks remain.

The Catalog receipt is an immutable `RetirementRecord` tied to its intent, target selector and
policy revision. Core validates that exact record before finalizing the intent. Confirmed closure
alone returns one namespace writable-workspace slot, with a unique release record in the same Core
transaction. A lost response can leave the slot charged; original receipt recovery completes it
once. Upload/revision retirement changes no namespace slot, and none of these outcomes returns
byte charges or physically removes content.

Upload, publication and retirement receipt inspection now verifies retained metadata and source/
release lineage independently of present byte availability. Valid release records explain why an
ordinary hold ended; they do not erase the earlier receipt, manifest or object identity. A receipt
can therefore survive unavailable or later removed bytes without recreating them or restoring a
hold. Missing or contradictory lineage remains an error. Actual publication/file reads separately
require usable retained references and current content verification. Closed workspaces can retain
readable, unretired revisions under current permission.

Logical retirement and physical collection have separate results and verification scopes. Existing
earlier evidence retains its stated scope; retirement alone does not establish removal or return a
byte charge.

#### Explicit Physical Object Collection

The current Catalog implements the bounded [collection contract](CONTRACTS_AND_STATE.md#explicit-object-collection)
for a completed upload's exact non-reused object. That contract owns root/step identities, API and
CLI routes, fixed input, current authorization and result meanings. The file service accepts the
original upload, object, firm/store/generation, digest, size and explicit policy bound by Core. It
cannot select a path, substitute equal-content bytes or infer that an unknown object is disposable.
The collection executor remains part of the existing resource worker and its single-writer store;
it is not another policy authority or a general filesystem-management service.

Eligibility requires the upload-owner hold to have a valid matching release and every revision
reference to have its own attributable retirement and release. Collection never releases these
holds itself. Catalog also searches immutable snapshot manifests for the object and compares that
reverse-reference inventory with the typed hold rows. A missing hold cannot be counted as released,
and an extra or contradictory reference blocks marking. The current local profile bounds both
returned reference sets and each inspected manifest to 1,000 entries, with a five-second PostgreSQL
statement timeout. Exceeding these limits or failing a query blocks collection; it does not truncate
validation and continue. Core's pending-publication barriers remain required before Catalog release
or collection; a future dependency owner must establish its protective contract before activation.

| File-service phase | Execution and durable record | Failure behavior |
| --- | --- | --- |
| Resolve and pin | Under the object row lock, validate the fixed source, store, policy age and reference/release lineage; acquire a nonblocking exclusive lock on an FD for the exact object. | A live shared reader or writer returns busy. A first preparation does not create a deletion marker while that FD is unavailable. Binding mismatch, missing required metadata or an unmarked missing object fails. |
| Verify and mark | End the database transaction while retaining the exclusive FD, verify the file size/digest, then lock the object again and recheck references. Commit the exact physical identity and irreversible deletion marker together. | Hash failure creates no new marker. Failed marker commit leaves the bytes and accounting intact. An existing marker must name the same inode/device and object generation; it cannot select a replacement. |
| Advance removal | With the verified FD retained, recheck the marker and references, end the transaction, and invoke the worker's fresh Core permission callback immediately before removal. Revalidate the pinned name/identity, unlink only that object, close the FD, synchronize the directory and verify absence. | A denied or expired permission check preserves the marker and bytes. I/O failure preserves the unresolved marker and charge; no alternate path, generation or disk is tried. Full-file hashing and the Core callback hold no database transaction. |
| Commit outcome | Record the immutable collection receipt and completed object disposition in one Catalog transaction. | Failure after unlink can leave a durable marker and absent bytes without a receipt. A later observer returns the first committed receipt rather than replacing its confirmation. |

For a durable marker whose fixed object is already absent, receipt recovery verifies the original
binding, marker and release lineage, then confirms absence and directory synchronization. It may
commit an `observed_absence` receipt without calling unlink or obtaining a new destructive claim.
This does not assert which process performed an unobserved removal. An unmarked missing object
cannot enter this recovery path: absence alone creates neither a marker nor a successful receipt.
A present object still requires a newly authorized advance. Revocation denies new dispatch permits;
it cannot retract a final permit already issued or restore removed bytes. Reconciliation preserves
the actual outcome without assuming that an older worker stopped.

Core accepts only the exact collection record matching the original upload allocation, object,
store generation, size and frozen policy. Its unique `storage_releases` entry, logical byte-budget
reduction and completion record commit together. Receipt loss can delay that release; replay cannot
release it twice. Catalog does not modify Core's budget, erase the original allocation or turn
retirement, a deletion marker, a busy observation or a worker timeout into returned capacity.

Upload/publication/retirement history remains metadata-only after collection. Object history in a
deleting or deleted state must have the matching collection marker and, when completed, its valid
receipt. These records do not promise current byte availability. Fresh reads require an unretired
revision and a usable object; fresh publication requires active upload references and an open
workspace. An old upload or publication request key can recover its original result but cannot
recreate bytes or holds. Equal content uploaded later receives a different physical object ID.

This implementation does not collect legacy digest-addressed objects, prepared objects, incomplete
staging, unknown files or arbitrary directories. It does not scan for disposable data or introduce
automatic collection. Coordinated backup/restore and additional evidence, checkpoint or recovery
owners still require their own verified retention and release mechanisms. Verification results
belong to [Validation](VALIDATION.md); implementation of these phases is not a claim that their
DB, filesystem, connected API or deployment tests have passed.

Unlink and directory synchronization confirm namespace removal, not necessarily reclaimed device
capacity. Open handles, other retained links, filesystem snapshots and backing-disk allocation can
retain blocks. The file service ends new reads of a marked generation, bounds and accounts for
already open readers, and records when its own references and handles are gone. Core reconciles
logical ownership separately from the qualified physical-capacity observations. Do not increase
available physical headroom based solely on a deletion mark or the sum of deleted logical lengths.
Pending cleanup records and receipts remain durable even when bytes have already disappeared.

Inventory may identify unrecognized files for bounded investigation, but a whole-store scan cannot
automatically delete everything absent from a single catalog query. The discrepancy may indicate
an interrupted write, an incomplete restore or mismatched databases. Record its binding, path
identity, size and uncertainty, quarantine its eligibility, and reconcile against staging, intent,
backup and manifest records before an explicit deletion decision. Unknown bytes consume capacity
while their status is unresolved. Private paths, timestamps and reported completion are not evidence
that the store's protected content is disposable.

### Reconciliation and Qualification

Catalog receipts, hold acknowledgements and releases are reconciled to their existing Core intents
or dependency owners. Recovery may authenticate a replacement worker for bounded receipt lookup and
observation delivery; it must not obtain a new execution claim merely to learn whether the original
effect committed. Same input returns the retained result, conflicting evidence preserves uncertainty,
and unexpectedly missing required content is an integrity failure. Legitimately retired references
retain their historical metadata and release lineage; receipt observation is not byte delivery.
Recovery-only permission cannot upload, publish,
delete or recreate a missing effect unless that action is separately admitted under current authority.

The current code has SHA-256 verification, an exclusive staging write with file/directory
synchronization, fixed upload receipts, revision-checked publication and retained historical
manifests. The local content worker now opens an explicitly prepared binding: firm/store/generation,
owner, physical root and filesystem identity, and external registration-directory identity. It pins
directory handles, uses directory-relative file operations, holds a single-writer lock, and checks
the binding before reads, uploads, publication and receipt replay. Detected identity loss persists
a restriction outside the content root; restoring a path or restarting the worker does not clear it.
An independent protected catalog row must match. The worker has no write privilege on that row;
a fixed security-definer function locks and compares it within each catalog transaction.
Before claiming dispatch, it checks local/catalog readiness and supplies firm/store/generation
for Core to compare against the admitted target. No startup enrollment or automatic recovery occurs.

This is a local directory and mount-session binding, not stable APFS/guest-disk enrollment or proof
against an exact rollback of the store and external registration together. The earlier binding
slice used digest-named objects, which remain explicit legacy records. Current namespace uploads
use non-reused object generations and durable upload/revision holds; logical reference retirement
and explicit physical object collection are the additional subsets described above. Coordinated
backup/restore and full backing-capacity reclamation remain outside them. Bounded binary transport has separate
[implementation evidence](VALIDATION.md#bounded-binary-transfer-implementation-evidence).
Core now owns a separate explicit logical
byte budget for each firm/store/generation. Every distinct upload reserves its full declared size
before content dispatch, including equal-content uploads through different target aliases. A stable
request key identifies its existing allocation. Missing or insufficient budget denies admission;
invalid size or digest creates no allocation. The retained text compatibility helper remains
bounded to 65,536 bytes; binary transfers use the explicit target limits.

`storage_allocations` preserve the original charge after acceptance, completion, failure, revocation
or worker replacement. Only the exact, confirmed collection outcome described above can return its
logical payload charge through Core's unique release record. There is no expiry, deduplication rebate
or arbitrary capacity-change API. Distinct equal-content uploads retain separate charges until each
object is collected. This ledger is not measurement or reservation of filesystem blocks, metadata,
PostgreSQL, logs or host backing capacity. Fixture maintenance explicitly supplies its synthetic budget; no
operating budget is inferred from free space or installed hardware. The old `resource_calls` limit
continues to bound invocation count independently.

The catalog commits `upload_staging` with the original intent, immutable store binding, digest,
declared size and staging UUID before writing bytes. The staging filename derives from that UUID.
Only verified installed content and the upload receipt can advance the inventory to `committed`
in the same catalog transaction. Partial writes and uncertain installation retain their identity;
worker termination cannot convert them into free capacity. Local storage retry tests can finish
intact staging with the same identity; the public receipt-reconciliation route never performs this
write or retries an incomplete upload.

A separate receipt-only path reconciles upload/publication/retirement outcomes and collection
records with Core. It obtains the assigned worker's original receipt selectors, verifies current
storage binding and retained source/release lineage, and reports the existing metadata receipt without
requiring the historical bytes to be delivered, claiming or executing another attempt. A missing
receipt remains unresolved; collection's existing-marker absence observation is the bounded exception
specified above and performs no unlink. Current caller inspection authority governs access and is
checked again before delivery; expired execution authority does not erase a worker's duty to report earlier
results. This is explicit reconciliation, not an automatic retry scheduler. Existing PASS entries
retain exactly their recorded scope.

Filesystem checks and PostgreSQL commit are not one atomic transaction. A loss during an in-flight
commit can leave an unresolved committed effect; post-commit validation must not erase it or declare
success. The pinned root prevents redirection into a replacement directory. It does not promise
zero commits after an unobserved device loss. Core may retain an accepted intent when a worker's
preflight blocks its claim; no attempt or resource completion is fabricated.

Before this profile can store operational material, [Validation](VALIDATION.md) must exercise lost
upload/publication/hold/deletion acknowledgements; concurrent hold acquisition, publication and GC;
same-digest re-upload while a stale collector resumes; byte and metadata capacity exhaustion;
missing, swapped or remounted storage; backup-held content; unknown files; and cross-store restore.
The expected result is attributable disposition without lost live content, repeated external effects,
invented free capacity or broader authority. A failure keeps the affected capability unavailable;
it does not relax retention, storage identity or Gateway access.

## Company Database and Knowledge

The database capability provides bounded queries and bounded transaction batches through Gateway.
It returns results or scoped pagination handles, never a DSN, backend password, or direct client
session. Every subsequent fetch or operation rechecks current authority and relevant limits.
The first connected fixture uses the PostgreSQL reference in [Integration](INTEGRATION_AND_DEPLOYMENT.md).

For that fixture, the query route accepts `input.operation` equal to `read_input` and parameterized
`input.parameters` containing `input_id`. The activated handler executes one prepared read in the
permitted business namespace and returns its bounded value and data revision. It resolves work and
namespace scope from the verified request context; an arbitrary `input_id` does not grant access.

The transaction route accepts `input.operation` equal to `record_result` and parameters containing
the permitted `input_id` and bounded `result`. With applicable input-revision preconditions, one
prepared transaction appends a result for the admitted work/input and inserts its protected effect
receipt. The receipt is unique for the intent and retains its fixed-input fingerprint and resulting
record identity. Replay reads that receipt; it cannot append another result under the same intent.
Prior results remain attributable rather than being overwritten by a retry.

First-fixture requests cannot supply SQL text, SQL identifiers, functions, DDL, or a backend role.
The trusted handler chooses the prepared statements; parameter values do not select more powerful
statements. This permits the worker to write its protected receipt without handing that privilege
to arbitrary private SQL. The fixture's two operations do not remove the broader query, transaction,
or private-schema capabilities: those require their own activated interfaces, scoped roles, and
validation before use. Passing the fixture does not establish a general-purpose SQL boundary.

Private operation owns business schemas and knowledge within explicitly allocated namespaces.
Authorized schema changes use the same bounded handler with a suitable backend role. This does not
grant database administration, ownership of protected records, or authority over other namespaces.
Separate query and mutation permissions where required; parameterize values and constrain supported
statement forms. Parsing and query labels supplement actual backend privileges, not replace them.

Deny access to protected control, source evidence, credentials, and service metadata from the
private query surface. Deny role escalation, arbitrary extensions, operating-system execution,
unapproved network/file access, and functions or triggers that escape the allocated domain.
An approved ordinary query cannot reach financial execution through a stored procedure or plugin.
Unsupported statement semantics remain unavailable instead of being forwarded under a powerful role.

Bound connection use, transaction duration, statement execution, lock waits, result rows/bytes,
and concurrent queries. A result limit alone does not limit the work needed to produce that result.
Do not hold an interactive backend transaction open while an agent reasons or waits for a model.
Cancellation must observe whether work stopped and whether the transaction committed or rolled back.

For mutations, the adapter must support a protected effect receipt in the same backend transaction
as the business write, or state an alternative verified reconciliation guarantee. Private SQL cannot
edit that receipt. A lost commit response is resolved by receipt lookup and actual backend state;
SQL transaction atomicity alone does not provide exactly-once RPC execution. Keep request-key scope,
retention, stale-revision conflicts, and late replies explicit. Uncertain commits retain commitments.
The first `record_result` fixture uses the same-commit receipt, not the alternative. Test failure
before commit, commit with lost response, and repeated requests against that actual transaction.
The worker's business/receipt permissions do not include control-database access, role creation,
schema ownership, or an API for editing its receipts. Migration authority remains separately held.

Native session/database integrations must use this handler or an equivalent verified Gateway adapter.
A stock SDK that opens its own SQL connection inside a private worker does not satisfy the contract.
Knowledge search is also a bounded resource operation; retrieved text and private interpretations
remain evidence to assess rather than protected authority or independently verified company facts.

## Native Model Calls and Streams

Provide an activated native-compatible model handler for each supported provider protocol. Preserve
the admitted native payload and relevant configuration, including tool declarations, beta/version
headers, model identity, continuation handles, and supported opaque blocks. Retain their content or
restricted source references alongside normalized observations; a hash alone cannot recover them.
Do not flatten provider events into a generic chat shape that silently discards required semantics.
The first model route's prefix resolves an activated `target_id`; its remaining suffix and payload
follow that provider's supported native protocol. Gateway records each meaningful ingress invocation
through Core as specified in the common contract. A relay or protocol worker cannot create another
Core claim, authorize a fallback target, or reinterpret equal request bodies as a safe retry.

Authenticate the workload at Gateway and inject the scoped provider credential only in its trusted
adapter. Forward only supported headers and destinations. Caller-supplied authentication, alternate
base URLs, automatic model substitution, and provider-hosted tool execution are not bypass routes.
Built-in browsing, remote tools, or hosted descendants require verified prior control and evidence;
unsupported paths are disabled under the profile even when the model provider offers them.

Admission includes applicable input/output, concurrent invocation, duration, streaming, and cost
bounds. Track actual provider request identity, native event ordering, partial output, reported token
usage, and later billing observations. Preserve unknown usage rather than infer zero from a missing
final event. Match cost revisions to the original invocation instead of adding duplicate bills.

Restricting a stream blocks subsequent dependent delivery/use and initiates supported provider
cancellation. Closing the client connection does not prove that provider computation or billing
stopped, and already delivered bytes cannot be revoked. Retain partial results and pending costs.
Automatic replay after a broken stream is allowed only under verified adapter retry semantics and
the common commitment rules. A private decision
to request a new result creates a separately admitted intent; it does not erase the earlier charge.

The first custom named-provider profile uses request/stream retry zero only as a candidate setting
for those specific loops. It does not establish one dispatch across connection retry, authentication
recovery, or WebSocket-to-HTTP fallback. [Integration](INTEGRATION_AND_DEPLOYMENT.md) owns the pinned
settings and path controls; [Validation](VALIDATION.md) must observe actual dispatch under faults.
A path that can silently repeat an uncertain provider effect remains unavailable in that profile.

## MCP Tools and Private Internal Services

MCP discovery exposes only permitted descriptions. A listed tool, read-only annotation, connected
server, or successful initialization does not authorize invocation. Admission uses the actual tool
name and material arguments against the activated server, destination, account, and domain contract.
Unknown or changed tool meaning cannot inherit a previous approval merely because the name matches.
Schema validation does not prove that a remote server behaves as described; activation and ongoing
observations must address the side effects the capability actually permits.

The first MCP probe uses an activated fixture server over the common MCP route: initialize the
session, discover tools, and call one permitted `read_input` tool with an in-scope `input_id`.
Repeat the call with an out-of-scope input and verify denial against the actual arguments, despite
successful discovery. The fixture may exercise the real transport while controlling its data;
it does not qualify another provider, privileged tool, or financial endpoint. Native protocol
responses remain intact, with intent and evidence correlation recorded outside their payload.

Keep subscriptions, callbacks, server-initiated requests, and pagination on governed paths with
their own current authority and bounds. Authenticate callback sources and preserve duplicate/gap
handling. Remote content cannot instruct an adapter to add a destination, expose a secret, or change
the required control. Generic HTTP/MCP access cannot carry credentials to privileged financial routes.

Private internal services run as isolated workloads, including services written by agents. Callers
reach them through Gateway; their downstream resource use returns through Gateway as well. A service
has its own verified instance identity, separate from the caller for whom it is doing work.

For work on behalf of a caller, preserve a verified origin and delegation chain. Effective authority
must satisfy both the service's allowed capability and the originating delegation, including shared
limits and revocation. A forwarded username, work ID, or privileged service credential cannot expand
that chain. Autonomous service work uses its own admitted work and delegation; it cannot silently
switch to that authority when a caller's request is denied. Private service responses remain private
reports, not direct writes into Core or activation instructions for protected adapters.

## Compute, Jobs, and Server Lifecycle

A compute handler resolves an activated execution profile and requested bounded resources, then
asks Core to admit the desired execution and reserve applicable shared capacity. [Runtime](RUNTIME.md)
alone holds execution-backend privileges and performs provisioning, identity binding, supervision,
restriction, and termination. Resource admission does not expose raw launch flags or runtime sockets.
Infrastructure adapters operating for Runtime remain inside that designated authority boundary.

Return an accepted desired execution before provisioning, an observed instance only after binding,
and actual usage/lifecycle observations as they become available. A failed create response can leave
a real server; find the original resource before requesting another. Instance termination, job
completion, storage deletion, and cessation of provider charges are separately confirmed outcomes.
Unused disks, endpoints, subscriptions, and pending bills remain in inventory and company accounting.
Use the common `execution_id` for desired state and `instance_id` only for the actual Runtime
binding. Successor requests use the common start route with predecessor/checkpoint references;
resource workers cannot turn an uncertain start into a fresh instance by calling it a resume.

Serving an internal API does not change a workload's trust. Its ingress, descendants, egress, file
access, and model/tool use must retain the same Gateway and Runtime restrictions. Remote compute
that cannot establish those conditions is not eligible merely because it offers a sandbox label.

A private service's accepted release binds operation definitions, permitted consumer scopes,
exact payload/profile, declared loopback listener and separately identified durable data. Activation
selects a currently observed healthy instance/generation before Gateway makes the capability callable.
Runtime registers the verified endpoint binding; the authorized Gateway handler reaches only that
binding over an authenticated, scoped bridge path. Clients cannot choose a port, upstream URL or
instance, and no host port or general private-to-private network is exposed. The existing outbound
bridge fixture does not prove this service ingress; absence of its qualification keeps the target
unavailable. Work performed for a caller retains the caller/service authority intersection above.

Replacing a service means accepting the required new release/configuration and selecting a new
verified instance under current authority. New file publication or an updated name cannot retarget
an active service or an in-flight call. Restrict/drain and reconcile the old instance's calls before
conflicting stateful use; failed readiness leaves activation pending/unavailable. Data remains an
independent resource. Rolling back code does not roll back DB writes, provider effects or costs;
incompatible schema changes need their own governed migration and recovery evidence.

## Credential Workers, Financial Enforcement, and Validation

Pure protocol transformations may share a process. Adapters needing independently protected secrets
or authority require separate credential workers or a demonstrated provider-enforced boundary.
Workers accept only assigned dispatch claims, possess only scoped target credentials, and submit
bounded observations. Package separation is not protection against another adapter reading memory.
Private plugins are never loaded into these workers or given their credential environment.

Observe and redact errors, native payloads, configuration, and exports under the same credential
rules as successful calls. Necessary restricted originals retain scoped access and provenance;
ordinary logs and artifacts cannot become an alternate source of usable provider credentials.
Worker replacement preserves its pending attempts and effects without transferring obsolete grants.

Actions affecting investment authority, capital, exposure, or obligations require the mandatory
investment enforcement bound at Gateway before provider dispatch. That enforcement resolves actual
account/resource overlap and applies the current domain conditions; it is not optional connector
advice. Neither a generic tool nor SQL, shell, HTTP, or another agent can bypass it. Private operation
still selects the investment work and interprets its economic result within the mandate.

No broker, market, live financial credential, capital amount, or trading strategy is selected here.
Initial financial behavior uses fixtures for accepted, partial, duplicated, delayed, and unresolved
effects. Fixtures must exercise the mandatory boundary and cannot establish live provider behavior
or profitability. Real adapters require their own verified conditions and separate authority.

[Validation](VALIDATION.md) must cover publication conflicts and cross-store failures, uncertain DB
commit, broken model streams and delayed costs, changed MCP arguments and service impersonation,
duplicate compute creation, shared-account reconciliation, and forbidden financial bypasses.
[Observation and Console](OBSERVABILITY_AND_CONSOLE.md) owns evidence presentation and access;
[Integration and Deployment](INTEGRATION_AND_DEPLOYMENT.md) owns concrete worker/storage choices.
Writing these contracts proves no
provider integration, runtime isolation, operational safety, or economic performance.


## Current Local Fixture Worker Implementation

`ouroboros-resources` starts one configured role per process: company database, file catalog plus
artifact storage, or credential-free model/MCP fixture. It accepts only the configured Gateway
service certificate at `POST /execute/{intent_id}` and `PUT /uploads/{intent_id}/content`, plus the
separate collection-step route in the shared contract. It authenticates separately to Core, claims an
assigned accepted intent, applies the fixed target configuration, performs its bounded operation,
and records the reply/receipt in Core before returning. It has no Docker or Core database credential.
No private executable or arbitrary SQL/URL is accepted by these workers.

Company targets bind one prepared `read_input` identity and the `record_result` transaction.
Legacy Catalog targets bind one workspace. Explicit namespace targets allow Core-assigned workspaces
within pre-existing work/namespace scope; allocation does not create authority. Reads use a current
or immutable historical revision. Blob reads
reject symlinks and verify size/digest before bounded binary delivery. Transfers keep their
original authority and fixed deadline; the worker checks current access independently of network
backpressure. Core receives only a metadata receipt, and a prepared read does not prove completed
client delivery. Upload content must match the admitted size/hash; publication remains a distinct
intent and commits manifest revision
and receipt together. Previous and new revisions are retained in `workspace_snapshots` with their exact object holds.
New uploads use non-reused object IDs and retain upload holds; legacy digest addresses remain
explicitly protected. [Allocation evidence](VALIDATION.md#workspace-allocation-and-retained-object-implementation-evidence) records the connected subset.

The model fixture emits bounded Responses SSE; the MCP fixture exposes stateless initialize,
notification and one echo tool. They make no upstream calls. This is a raw-format fixture path,
not a general native proxy: streaming/backpressure, cancellation, MCP sessions/extensions,
provider headers/authentication, delayed charges and real subscription integration remain unqualified.
The fixture models three native calls for MCP, CLI work, and a final message; the integration test
requires independent database/catalog receipts and a native execution marker before accepting work.

A committed worker effect with a lost Core completion response remains claimed and unresolved.
Core refuses another ordinary resource claim; the same database/catalog receipt remains available
to its trusted worker. Collection uses its separately authorized bounded steps and receipt
observations, not replay of the original resource claim. Automatic cross-store reconciliation is
not yet connected. Claiming alone, lease expiry,
instance termination or an error never releases the retained resource call count or compute amount.
The `resource_calls` limit counts admitted fixture calls; it is not monetary accounting or model
usage settlement. [Validation](VALIDATION.md#resource-api-implementation-evidence) records the
observed API subset and the blocked native qualification separately.

## Managed external-service interface

External services are exposed through outer-managed adapters. Internal agents can discover the
need, author the code and propose its adoption; outer management means control of acceptance,
activation and execution, not exclusive authorship. An adapter translates registered operations
and interprets permitted responses. Agent-authored logic remains isolated and secretless after
acceptance. A common trusted execution worker validates the final operation, applies mandatory
domain controls, adds authentication or signs, and sends to the fixed provider itself. These operations are published as MCP tools
through the shared Gateway. Both a native agent harness and code written by an agent can act as
MCP clients from the same isolated instance; generated code receives no direct provider credentials
or alternate network route. Originating delegation and instance identity survive that client change.

The managed path is client -> Gateway MCP surface -> existing Core admission/claim -> isolated
adapter logic -> common trusted execution worker -> external service. Results return through the same controlled boundary. Gateway
is the client entry and enforcement path; MCP publication does not establish authority. Tool
discovery is scoped to current access, while every invocation is independently authorized. The
registered tool/connection binding resolves to a meaningful operation, account, active configuration
and assigned worker. Clients cannot supply an arbitrary upstream URL, credential selector, raw
signing request or provider SDK escape hatch as tool parameters.

MCP is the client tool contract, not an instruction to replace every native wire protocol. Existing
provider-native model requests and streams remain supported through Gateway and their assigned
adapter under the same authority/custody contract. The adapter speaks the external service's
required HTTP, WebSocket, database or other protocol. MCP handlers and adapters are logical
boundaries; one server/process per provider or per tool is not required. Independent credential
ownership and failure containment determine process separation.

Existing Core state owns registration, validation, activation, permissions, restriction and
attempt records. MCP tool names/schemas describe capabilities without creating a second Registry
or permission system. Provider outages, usage, ambiguous outcomes and revocation remain visible
in the existing evidence path. Adding an adapter must preserve this contract, not recreate identity,
secret management, logging or admission logic inside each integration.

This is the target managed interface. The existing MCP fixture does not establish general adapter
registration, discovery filtering or authenticated provider integration; those remain NOT RUN.

## Agent-Led Discovery, Adoption and Operation

The [four adoption references](CONTRACTS_AND_STATE.md#external-service-adoption-references) separate
need, code, connection and authority. The outer system supplies a development contract, controlled
submission, verification/execution environment, secret custody and managed access. Internal agents
supply and maintain service-specific logic; the owner is not required to discover APIs or implement
each integration. These are responsibilities within the existing components, not new layers.

1. Private operation identifies missing capability, checks existing tools/connections and compares
   alternatives using its currently permitted research resources. It explains expected value,
   cost/data implications, needed actions and when continued use would cease to be worthwhile.
2. The agent prepares an adapter release and mock tests in its normal isolation. The submission
   includes operation schemas, intended account/environment, fixed destinations and request mapping,
   data exposure, authentication requirements, bounds and handling of uncertain results. Candidate
   tests are inputs to independent verification, not proof the candidate can declare for itself.
3. Where a required resource or decision is outside current delegation, the owner sees one concrete
   decision package: what is proposed, why, account/actions/data/cost scope, prepared evidence,
   remaining uncertainty and the exact approval or authentication needed. Registration of a secret
   and authorization of its business use remain separate facts even if the UI collects both.
4. A trusted platform-owned enrollment flow receives an API key or completes official OAuth when
   needed. Values go directly to encrypted custody. The agent receives only bound status/reference
   metadata. OAuth state/callback and confirmed account must match the intended enrollment; a form,
   script or MCP tool written by the proposing agent never receives the actual credential.
5. Independent verification and current authority select the accepted release/configuration. Runtime
   executes that immutable release with its scoped identity; actual readiness precedes publication
   of the managed MCP tools. Technical verification requiring a real account uses only an explicitly
   bounded test connection: the exact candidate first passes acceptance for that verification
   profile, which permits its specified tests without claiming operating qualification. Operating
   acceptance and authority remain separate requirements.
6. Agents and generated code use the active tools through Gateway, within the intersection of caller
   delegation and connection/adapter scope. Private operation evaluates actual value and proposes
   retention, replacement or cessation. Outer services supply usage, cost and outcome evidence and
   apply authorized restrictions; they do not make the economic decision.

Company-provided defaults and internally proposed adapters enter one managed catalog and the
same submission/acceptance/activation/update/restriction path. The owner can prepare or supply
initial adapters without requiring an agent to rediscover them. Their origin changes provenance
and existing evidence, not execution privileges. Preprovisioning may prepare accepted releases
and explicitly authorized connections, but does not create blanket caller access. Updating an
owner-supplied adapter from internal code still creates a new release subject to the same checks;
using the same name or claiming to be bundled cannot inherit another release's acceptance.

There are two preparation entry points: an authorized owner/administrator can directly submit
a company-provided release and connection, or private operation can propose and submit one.
Direct supply does not require a synthetic AI proposal or a CEO approval. Both converge on the
same accepted release, connection activation and per-call delegation. Record author, registrant,
verification source, acceptor and maintenance responsibility as attributable references; these
are distinct responsibilities, not mandatory separate people or two different adapter classes.
Authorship and registration alone confer none of the acceptance or usage permissions.

In the initial private profile, the CEO is responsible for deciding whether an added capability
is worth pursuing and ensuring its upkeep is assigned. It may implement the adapter itself or
delegate preparation; it cannot self-certify acceptance, read the credential, or turn its role
into a new trusted sender. A proposed maintainer is not a new grant. Company tool availability
and per-worker access remain separate, including after a new CEO or worker is assigned.

The same path covers public APIs with no credential, reuse of an existing approved connection,
a new API-key/account connection, OAuth and infrastructure that creates credentials during
provisioning. For provider-generated credentials, the trusted execution worker captures and stores
secret response fields before any result reaches adapter logic, Core events or private consumers.
Only approved non-secret response fields are released. If provisioning succeeded but custody or
response delivery failed, retain the resource and unresolved obligation; do not blindly create it
again. Capturing a newly created secret never independently activates the resulting connection.

Agent-authored adapters use a restricted host-call contract, not direct sockets, a generic
`send(url, body, secret_ref)` method or arbitrary signing. The trusted sender checks the actual
post-transformation account/action/material arguments against the admitted operation, then signs
and sends those exact bytes. A read-only tool label cannot authorize a write or withdrawal on the
same host. Provider responses and errors are filtered before returning to extension code, and
redirects or callback flows cannot move authentication to an unapproved recipient.

Standard request/response mapping can be declarative; custom transformation code runs under
Runtime isolation. Both satisfy the same accepted contract. New authentication primitives or
protocols that the trusted sender cannot enforce require a separate platform change and its
verification. Internal agents may prepare that change too, but ordinary adapter approval cannot
grant their code entry into the secret-bearing process. No self-authored evaluator or tool
description is a substitute for externally enforced constraints.

The initial proof uses one agent-authored read-only fixture: proposal and submission; refusal
before acceptance; independently accepted activation; successful authorized calls; wrong-target,
secret-read, altered-package and broader-operation rejection; and observed restriction after
revocation. It proves the adoption mechanism, not profitability or unrestricted provider support.
General submission, acceptance and secretless extension execution remain NOT RUN.

## Stored secrets and operation-only use

Ouroboros owns a small secret-store interface for provider API keys, API signing secrets, OAuth
credentials and service passwords. The client contract is an authorized operation on a registered
connection, not secret retrieval. A registered connection binds the target account, permitted
operations, assigned worker and current credential reference/version. A private caller cannot
choose a secret-store locator, insert an upstream credential, select an arbitrary destination or
request an arbitrary signature. No new top-level component or policy engine is introduced.

The normal path is client -> Gateway -> current Core admission/claim -> assigned resource worker
-> provider -> permitted result. Core retains authority, activation, restriction and attempt records.
Gateway routes operations; neither Core nor the general routing layer needs provider plaintext.
The scoped worker resolves its assigned credential internally, adds authentication or signs the
exact approved request, sends it itself and returns only the permitted result. A usable token,
credential, signed URL or reusable signed request is not a result. Credentials are never handed
to the private harness, plugins, environment, workspace or subagents.

| Interface boundary | Allowed operations and responsibility |
| --- | --- |
| Human credential administration through Gateway | Trusted secret-input channel for enrollment/replacement, metadata inspection and disable. Return reference, version and status only. Request-body logging, chat input and transcript capture are excluded for this route. |
| Our secret-store interface | Store encrypted values, resolve an immutable assigned version inside trusted code, and retain version/status metadata. Replacement is separate from Core activation. Disabling prevents new use without erasing past effect records. |
| Provider worker | Use the bound credential for the approved operation and fixed account/origin; retain access/refresh tokens internally. Core authority and credential version are rechecked immediately before external dispatch. |
| Audit and client views | Reference/version, operation, attempt, target, outcome and usage. No secret value or raw authentication exchange, including on errors. |

There is no client-facing reveal, get-secret or decrypt-and-return endpoint, even for a human
using an ordinary administrative view. Possession of a reference grants no use authority.
Credential enrollment/rotation does not by itself grant a trading operation or enlarge limits.
Owner credential input belongs in a masked trusted form or protected CLI input, never chat,
source code, a public example, a command-line argument or a model-visible tool result. The
trusted input handler passes the value directly to custody and does not serialize it into a
generic Core intent body. Core instead records the secret-free enrollment outcome and binding.

Encryption at rest remains required. The initial store uses an established authenticated-encryption
implementation and binds ciphertext to its owner, identifier and version. It does not implement
a new cryptographic algorithm or require a generic multi-algorithm/plugin registry. Keep the
unlocking material outside the ciphertext store and outside private-readable paths, under the
separate service/infrastructure identity. Explicit deployment-owned protected input supplies the
bootstrap access needed before Core and its DB are available; business delegation cannot be its
own bootstrap prerequisite. An encrypted file beside an equally accessible key does not satisfy
this boundary. The storage location and key input are injected, never personal source constants.

Only the trusted credential consumer can obtain plaintext in memory where the provider protocol
requires it. This is not a claim that no process ever decrypts a value or that host administrators
cannot access process memory. Separate service ownership, private mount/process isolation, bounded
secret lifetime, no raw dumps and sanitized error handling remain necessary. A native provider
that can sign without exporting its key may keep that implementation inside the store/worker
boundary; compatibility with any named vault or key service is not an initial completion criterion.

Rotation validates a pending credential, publishes a new version, and changes the active binding
under Core control. OAuth refresh is serialized per account and cannot retry model or trading
requests automatically. A failed refresh disables dependent new use; it cannot select an unrelated
credential or restore a revoked version. Restore must reconcile current disable/activation state
before business dispatch. Audits identify versions without recording secret-derived values.

The mandatory connector path makes opaque environment-token substitution unnecessary for the
first implementation. Likewise, a separate all-data encryption platform is not introduced by
this secret store. Files, databases and backups keep their existing resource owners and protection
requirements; a business-data read is not permission to reveal authentication material.

OpenClaw's protected credential entry and boundary-only use are useful references. Its optional
plaintext/env paths, provider compatibility switches and personal-assistant trust assumptions
do not establish Ouroboros isolation. Source research stays outside Git; this contract does not
depend on it.

Implementation status: the current product worker still serves model/MCP fixtures, and the
browser-subscription qualification uses a separate permission-restricted plaintext auth file.
The previous unintegrated generic protection draft is outside the Cargo workspace. This section
is a design correction, not a claim of encrypted custody or live operation-only integration.
Those cases remain NOT RUN. Before live integration, prove with synthetic credentials that
allowed operations succeed while reveal attempts, wrong accounts/targets, stale versions,
redirects, response echoes, refresh errors and log/transcript/artifact leakage are blocked.

### Credential envelope implementation boundary

The resource library now contains an in-process envelope primitive using pinned ring 0.17.14
AES-256-GCM and zeroize 1.9.0 buffers. Authenticated data binds the format, owner UUID,
credential UUID and nonzero version. Values are bounded to 16 KiB. Each seal obtains a fresh
96-bit nonce from the operating system random source; durable key-use accounting and rotation
limits must be enforced by the custody store before deployment. No production store is enabled
by this primitive. The unlocking key is supplied by trusted code, with no path/default credential.

Plaintext input and decryption buffers are zeroized on drop; this is not a guarantee about all
allocator copies, library key schedules, process dumps or host administrators. The trusted
consumer callback is not an isolation mechanism and could leak values if incorrectly written.
Only reviewed provider-worker code may invoke it. There is no HTTP reveal endpoint, enrollment
route, persistence, Core activation/disable integration, OAuth refresh or live provider sender
implemented by this addition. The existing separate plaintext qualification file must not be
silently imported. Durable custody, separated bootstrap ownership and current-authority checks
remain required before real credentials are used.

### Durable custody versions

`CredentialStore` adds a dedicated PostgreSQL custody migration and trusted insert/consume/disable
methods. It stores only the authenticated envelope with owner, credential ID, exact version,
and creation/disable metadata. A duplicate primary key is an error, never replacement or
re-enablement. Replacement uses another version and does not activate a Core connection.
Disabling is idempotent and terminal through this interface. Previous operation receipts remain
owned by their existing systems.

A synchronous trusted consumer holds a shared row lock while checking disabled state and using
the decrypted value. Disable serializes against that lock; a completed disable prevents later
consumption. This is not cancellation of a prior effect and does not yet hold authority across
asynchronous HTTP dispatch. Consumer callbacks must not perform unbounded work or return reusable
credentials. A commit error after callback execution is an uncertain outcome, never permission
to repeat an external effect. The sender integration must preserve that distinction.

The custody migration is separate from company/catalog migrations. Deployment must provision a
separate database and operating role, with schema changes reserved to its migration identity;
that deployment and least-privilege role validation remain unfinished. The constructor accepts
an injected pool and key; it does not locate, generate, import or persist an unlocking key.
Enrollment routes, metadata reconciliation for uncertain inserts, durable key-use limits,
Core activation, async dispatch and protection against stale restore remain unfinished. This
library is not enabled as a live credential service.

### Custody operating-role boundary

The second custody migration guards identity, ciphertext and creation metadata against UPDATE
and rejects DELETE and re-enablement of a disabled version. The management-capable library role
has SELECT, INSERT on `owner_id, credential_id, version, envelope`, and UPDATE only on
`disabled, disabled_at`. The actual provider process now requires the separate consumer role
specified below. Neither role receives DELETE, TRUNCATE, schema CREATE or table ownership.
The migration CLI accepts `--role custody` using an explicitly supplied protected DB URL file;
that migration identity must not be passed to the operating store.

The asynchronous store constructor checks the connected role for superuser, role/database
creation, row-security bypass, ownership membership, schema creation and excessive table/column
rights, and checks the selected management or consumption rights. A rejected connection never produces a
usable store. This is a startup configuration check, not a proof against subsequent privileged
DB administration, malicious SECURITY DEFINER functions or arbitrary role graph changes.
Deployment must still isolate the custody database, protect its migration identity, control
role changes and reconcile restored state. No real credential service is enabled yet.

### Explicit unlocking-key bootstrap

The Linux `credential_key::load_key` helper accepts one injected absolute file locator and
returns an in-process envelope key. It does not discover credentials, read environment values,
generate keys or import earlier qualification files. Deployment must provision exactly 32 raw
key bytes under the credential worker's identity, in a private directory separate from ciphertext
storage and absent from private mounts. The helper does not itself prove that deployment layout.

Directory-FD traversal rejects symlinks and parent traversal. Ancestors must belong to root or
the worker and cannot be group/other-writable, except root-owned sticky staging ancestors. The
immediate parent must be private to the worker. The opened key must be a worker-owned regular
file with no group/other permissions, one link and exactly 32 bytes. Bounded reading and a second
metadata check reject size/ownership/mode changes observed during loading. Errors contain no
path or key value. The key buffer is zeroized after construction. This does not protect against
the worker's own malicious code, host administrators, filesystem-wide privileged snapshots or
all concurrent same-owner modifications. Non-Linux hosts are unsupported and return an error.

The helper is not yet connected to a live provider worker or secret enrollment route. The
operating configuration, separated custody database, key-use lifecycle and provider dispatch
still need one integrated verification before real credentials are admitted.

### Bounded asynchronous credential use

`consume_async` extends trusted consumption across an awaited operation while holding the same
shared version lock. It requires an explicit positive time budget, with a first-library hard cap
of 30 seconds and no default. This is an implementation bound, not owner financial authority or
a completed provider-stream profile. A completed disable fences later consumers; disable waits
for earlier consumers to finish or time out. It is not immediate interruption of those consumers.
The future must cooperate with async cancellation, must not block the executor and must not
spawn detached tasks retaining credentials.

Failures before invoking the callback return `NotStarted`. Callback failure, timeout after entry,
or later transaction failure return `OutcomeUnresolved`; there is no automatic retry. The
callback result must contain only permitted provider output. Timeout drops the local future and
its zeroizing buffer but does not prove remote cancellation or rollback. Core dispatch checks,
stream cancellation, durable attempt/receipt recording and provider reconciliation are still
required in the actual sender. The in-memory distinction does not survive a process crash and
must not replace a durable attempt record.

### Durable credential-use claims

Before asynchronous consumption, custody inserts an immutable `(owner, attempt)` claim bound
to the exact credential/version. The trusted sender must supply its existing Core attempt ID;
private callers cannot select a replacement ID to retry an uncertain operation. A committed
claim is never cleared by timeout, disable or object reconstruction. Reusing it returns
`AlreadyClaimed` without invoking the callback, including when another credential/version is
presented under that owner/attempt. Claim insertion uncertainty returns `OutcomeUnresolved`.

Claims contain no secret, request body or provider output. They establish possible dispatch,
not a success receipt. A callback never invoked after a successful claim may return `NotStarted`,
but that claim still remains. Future authorized recovery must consult existing authority/effect
records; a new attempt is a separate decision, not automatic fallback. `has_use_claim` exposes
existence only to trusted code. The operating role has SELECT and column-specific INSERT on
claims, with no UPDATE/DELETE/TRUNCATE; the constructor rejects excessive claim-table rights.

This gives local at-most-once entry per recorded attempt, not exactly-once external effects.
Core-to-custody attempt binding, provider reconciliation, retention accounting and historical
restore protection are still required before live sender use. The synchronous internal helper
is not an external-dispatch path and does not allocate these asynchronous-use claims.

### Initial fixed Responses worker wiring

A distinct `provider` worker role now loads an injected Linux key file and custody DB, compares
its fixed `ProviderBinding` with the Core-issued ticket configuration, uses the ticket's existing
attempt ID, and checks Core's live permission immediately before HTTP dispatch. Core live checks
now admit a currently claimed `model.responses` attempt under the existing worker/authority
checks. No new claim, authority or retry is created by that check. Other worker roles reject the
provider/key configuration fields.

The binding specifies target, HTTPS Responses endpoint, exact credential version, explicit
operation timeout and response-size bound. Client construction disables ambient proxies,
redirects and automatic retry. Authentication is added only inside the worker, and request
headers, upstream errors and response headers are not returned as provider results. Native JSON
or SSE bodies are retained without protocol conversion, but this first implementation buffers
the bounded response before returning it. Literal credential reflection is rejected; this is
not a general proof against encoded reflection from malicious endpoints. Only reviewed provider
origins belong in this trusted role. The HTTP library owns temporary authentication header
memory; zeroization of every library copy is not claimed.

Receipts currently correlate attempt and credential version plus requested model/effort.
Provider-confirmed model and usage extraction, durable result recovery, live stream delivery and
revocation during a provider call remain unfinished. The native request protocol remains direct;
no ChatGPT subscription compatibility or account binding has been established by this wiring.
No live credentials may be used until the integrated path and finite owner allowance are ready.

### Provider TLS trust input

The provider worker may receive an explicit `provider_ca_file` from deployment. This bounded
PEM input replaces built-in roots for that sender; it does not disable hostname or certificate
verification. Other worker roles reject it. It belongs to the trusted deployment configuration,
not private request input. With no override, the client retains its normal built-in roots.
Neither option grants a target or credential: the exact admitted provider binding must still
match and the current Core check must still pass before sending.

### Requested and provider-reported invocation metadata

Provider receipts now retain requested model/effort alongside a separate whitelisted
`provider_observation`. JSON responses or one unambiguous terminal native SSE response supply
reported response ID, model, reasoning effort, status and usage. Reported effort is an echoed
provider field, not proof of the model's internal reasoning or effective computation. Missing
fields remain null/unavailable and are not filled from requested values.

Usage retains reported input/output/total tokens and optional cached-input/reasoning-output
counts. Counts must be nonnegative integers, the reported total (if present) must match input
plus output, and detail counts must not exceed their parent counts. Missing total is left null,
not synthesized. Contradictory usage is marked invalid. Malformed, incomplete or multiple
terminal stream observations are marked explicitly; they do not manufacture a successful
usage record. Only selected metadata fields enter this projection; native body delivery remains
unchanged. This is provider-reported evidence, not billing reconciliation, financial cost or
independent proof of actual model execution. Streaming extraction is still over the bounded
buffer, not an incremental streaming gateway.

### Restriction while a provider response is pending

The provider now rechecks current Core permission before send, every 250 ms while the bounded
HTTP operation is pending, and again before returning its result. Each check has a 500 ms wait
bound within the overall operation budget. Denial or failure to confirm authority drops the
local HTTP future and withholds the buffered body. These are implementation polling bounds,
not a universal wall-clock guarantee under host suspension or scheduler failure.

The original buffered path covers waiting for headers or response body. That path alone is not
incremental streaming to the private caller. The operation may already have occurred remotely;
its Core claim and custody-use record remain for reconciliation. Restriction must not imply
zero tokens, no charge, provider cancellation, successful completion or automatic reservation
release. Credential-version disable and Core delegation restriction retain their distinct
semantics; the latter can now interrupt this pending local HTTP operation through the live check.

### Retained provider result before Core completion

After a successful bounded provider response, the sender records the native reply and metadata
in `provider_receipts` before returning to the worker's Core completion call. The immutable row
references the retained custody-use claim and binds a digest of the original Core ticket,
including work, intent, attempt, input and configuration. Conflict cannot overwrite the earlier
result. Operating roles have SELECT and column-specific INSERT, without UPDATE/DELETE/TRUNCATE.
The reply is protected company data in the custody database, not a plaintext credential store;
its retention/capacity and backup protection still need deployment integration.

The trusted `recover` helper requires current read authorization and the original ticket. It
loads the matching saved reply without decrypting credentials or sending another provider call.
It can observe a result after the sender object is reconstructed. It does not reactivate an
expired credential or authorize execution.

`POST /resource-intents/{intent}/reconcile` now supports `model.responses`. Gateway checks the
caller's current inspect scope before observation and again before delivering the result. The
original authenticated provider worker obtains `POST /resource/provider-recovery/{intent}` from
Core: firm ID, intent ID, original attempt ID and the SHA-256 digest of the original admitted
resource ticket. This is a distinct `ProviderRecoveryTicket`, carrying no input, credential,
configuration or dispatch authority. Core derives it from retained admission and exactly one
matching claimed/succeeded attempt; wrong workers and unclaimed requests are rejected. Model
requests have no workspace binding. Recovery does not require the old execution grant or target
to remain active and creates no attempt, reservation or outbox entry.

The worker reads only the matching saved reply and submits that observation through the existing
Core completion transaction. Gateway compares the source observation with the current Core reply
before delivery. A missing receipt remains unresolved; no provider retry occurs. A persistence
timeout is likewise not permission to repeat the external call. Current read denial prevents
response delivery even if an earlier completion or observation succeeded. The local process test
injects a failed Core completion transaction and recovers through this API without another HTTPS
request. Worker-crash recovery, receipt retention/capacity and stale-backup reconciliation remain
separate validation obligations.


### Current isolated native integration

The normal isolated Codex workload has been exercised through the encrypted provider sender using
a separate local HTTPS fixture and dedicated provider OS identity. The harness received native
SSE syntax, completed its MCP/shell work and retained three matching custody claims/replies. This
established compatibility of the buffered response path with the tested native harness. The
HTTP streaming extension below adds incremental transport, not live subscription authentication. Synthetic
fixture enrollment remains separate from a product credential enrollment interface. See the
[combined validation](VALIDATION.md#isolated-native-codex-through-encrypted-provider-custody).


### Provider-side incremental transport primitive

`ProviderSender::execute_stream` now emits a validated media-type/status head followed by byte
chunks to a trusted asynchronous sink. It awaits each write, so sink backpressure remains inside
the original bounded credential-use future. The existing 250 ms authority polling and bounded
Core checks run while the sink is pending. Sink failure, deadline or authority loss stops local
processing and retains the dispatch claim as unresolved. Previously emitted bytes cannot be
retracted and are not a completion receipt. Success is returned only after the full native reply
has been persisted; the existing `execute` path uses a no-output sink and remains buffered.

Before emitting bytes, the worker retains the last credential-length-minus-one bytes and checks
each combined boundary for literal credential reflection. The final safe suffix is released only
at upstream EOF. This preserves arbitrary UTF-8 splits and native body bytes. The cumulative body
limit still applies; the complete reply remains bounded in memory for receipt persistence. This
is literal-value exclusion, not protection against arbitrary encoding or a hostile approved
provider. Only the validated media-type essence is forwarded, excluding arbitrary upstream header
parameters. No authorization, cookie or other upstream header is forwarded by this primitive.

For real provider requests with native `stream: true`, the resource HTTP handler and Gateway now
use this sink. Other requests retain the buffered path. The following contract governs the HTTP
extension; complete disconnect/backpressure fault coverage remains required.


### Native HTTP stream lifetime and completion

The provider worker starts one owned task with a two-frame bounded channel. Dropping the HTTP
body or the pre-header handler aborts that task; it is not a detached credential user. Provider
checks continue while channel writes are backpressured. Errors terminate the body, and task panic
cannot produce a clean EOF. Only a validated `text/event-stream` response is accepted on this path.

A byte-preserving SSE gate emits ordinary complete events but holds `response.completed`,
`response.failed`, `response.incomplete` and subsequent bytes until the saved reply and Core
completion transaction succeed. This avoids the observed race where the harness closed on a
terminal event before its completion was recorded. LF and CRLF boundaries and multiline data are
recognized; incomplete trailing bytes are held until completion. Limits still bound the complete
reply. This gate neither invents events nor transforms provider model data.

Core records the original human certificate fingerprint (or instance origin) and a fixed delivery
expiry for model targets with explicit `timeout_ms`: that configured timeout plus five seconds
for bounded persistence/completion overhead, measured from admission and never renewed. The
separate `/resource/model-transfers/{id}/access` service check enforces the original caller,
instance, current grant/target and expiry, including buffered bytes after worker completion. The
file-transfer endpoint remains file-only. Missing original delivery records deny model streaming.

Gateway uses an independent access monitor and cancels upstream delivery when access ends. At EOF
it additionally requires a currently readable Core reply with identical bounded native bytes;
EOF alone cannot establish success. Already delivered bytes cannot be revoked. Source completion,
client receipt and remote cancellation remain distinct: disconnect before durable completion can
leave a claim unresolved, while a completed reply may survive a later delivery failure. These
local polling/timeout values are not host-suspension or real-time guarantees.


The actual HTTP partial-delivery fixture now verifies API-driven revocation and caller disconnect.
A revoked stream cannot finish normally or release the terminal event; a disconnected caller's
credential-use lock is released while its original intent remains unresolved. This evidence is
local and bounded; no remote cancellation or financial settlement is inferred. See
[partial-delivery validation](VALIDATION.md#partial-http-delivery-revocation-and-caller-disconnect).


### Credential consumer versus management authority

The production provider process opens `CredentialStore::open_consumer`. Startup rejects a role
with any INSERT or UPDATE privilege on credential versions, including column grants. The consumer
may read existing ciphertext and append use claims/replies; it cannot enroll, disable or alter
credential versions. Store methods also reject insert/disable in consumer mode before mutation.
The management-capable constructor remains for separately authorized management integration and
fixtures; it is not used by the provider process and is not an enrollment authorization API.

PostgreSQL row locking otherwise requires UPDATE privilege. Migration `0005_consumer_lock.sql`
therefore defines the fixed `public.lock_credential_version(uuid,uuid,bigint)` function. It selects
one enabled immutable version with `FOR SHARE`, returns ciphertext only, and holds that lock in
the caller's transaction. It has no dynamic SQL or mutation, uses fully qualified table names and
a fixed catalog search path, and revokes PUBLIC execution. Deployment explicitly grants execution
to the selected custody consumer. Disable still waits for existing consumers, and a later consumer
cannot use a disabled version. No plaintext is decrypted inside PostgreSQL.

The function's migration owner is trusted authority and must remain separate from the consumer.
This change does not constitute a general audit of arbitrary definer functions, later privileged
role changes or stale database restores. Owner-facing registration, uncertain enrollment recovery,
credential rotation and Core connection activation remain distinct implementation work.


### Enrollment receipt persistence

The management library now offers `enroll(binding, enrollment_id, secret)` with a five-second
transaction budget. It commits an immutable encrypted version and its `credential_enrollments`
receipt together. The receipt has a unique firm/enrollment identity and a unique firm/credential/
version association. A duplicate is an error, never acceptance of a possibly changed secret; a
receipt collision rolls back the new version as well. A timeout is an uncertain outcome, not
permission to allocate another enrollment ID or version.

`enrollment(owner, enrollment_id)` reads identity and current disabled status only. It returns no
plaintext, ciphertext or hash of the secret. The receipt proves which version was committed under
that enrollment ID; it does not certify a later proposed value, connection activation or external
account ownership. Management callers must compare the returned identity with the original request.
Missing observation after an uncertain operation remains unresolved until its transaction is
reconciled; it does not automatically mean no registration occurred.

The provider consumer cannot create these receipts or use management methods. Management startup
requires receipt read/insert and rejects update/delete/truncate rights; the consumer additionally
rejects receipt insert rights. This is persistence infrastructure only. Authenticated owner API/CLI
admission, secret input transport, enrollment-intent allocation and activation remain required before
this is an owner-facing registration capability. Legacy fixture `insert` does not create a receipt
and cannot be retroactively claimed to be an acknowledged enrollment.

### Credential enrollment admission boundary

Core accepts `credential.enroll` as a resource admission containing exactly `credential_id`,
`enrollment_id` and a positive signed-64-bit-compatible `version`. Both IDs must be non-nil,
canonical UUID strings. Unknown fields and invalid identities are rejected before intent or
replay persistence. No credential value, secret digest or client-supplied owner belongs here;
firm, author, work, delegation and actual instance binding come from existing trusted context.

The common Gateway authority contract requires current inspect and `credential.enroll` action,
work scope and target scope, including ancestor delegation attenuation. Metadata admission does
not grant model use, secret retrieval or connection activation. Stable same-input replay returns
the existing intent; changed metadata conflicts. Only the bound worker may claim, and claim
rechecks current authority. A revoked accepted intent cannot proceed using its earlier approval.

An admitted metadata intent is not a stored credential. The local enrollment transfer path below
binds these IDs to the separate custody transaction. Receipt-only HTTP recovery is described
below; real credential onboarding still requires the selected custody deployment to be verified.

### Local enrollment transfer path

The local implementation now exposes metadata-only `POST /credential-enrollments` (explicit
resource target, work, delegation and request key), followed by
`PUT /credential-enrollments/{intent}/secret` with `application/octet-stream`. Gateway checks
current inspect scope, the original target and accepted intent state, forwards at most 16 KiB
without JSON conversion, and compares the worker response with the current protected Core reply
before returning it. Completed/claimed intents cannot accept a new secret body as replay.

The separate `custody-management` worker holds an injected encryption key and a management DB
credential, no provider endpoint configuration. It accepts only the configured Gateway mTLS
identity on `/enrollments/{intent}/secret`; a valid human certificate alone cannot bypass Gateway.
It bounds body ingestion to five seconds and 1–16384 bytes, uses a zeroizing buffer, claims the
exact intent through Core and rechecks current attempt authority before the five-second encrypted
version/receipt transaction. Firm and credential/version identities come from the claimed ticket.
Its completion and HTTP response contain receipt metadata only. Gateway and worker perform no
secret-body retry. TLS/HTTP transient buffers are not claimed to have complete allocator erasure.

`ouroboros-cli credential-secret INTENT --work WORK --delegation DELEGATION` takes a non-terminal
stdin stream, never a secret argument or environment lookup. It requires the external mTLS CLI;
private instance mode is rejected. Supply input through a private pipe from the owner's input
mechanism, not a shell command containing a literal secret. The CLI reads at most 16385 bytes
before any transfer, rejects empty/oversized input, and retains a zeroizing HTTP body owner.
It prints only parsed receipt IDs, version and recorded state, never raw error/response bodies.
Waiting for pipe input requires the producer to finish or the owner to cancel; the subsequent
network operation has a twenty-second bound and no automatic replay.

These paths implement enrollment, not activation, rotation, external account ownership validation
or login. A custody commit followed by lost Core completion remains unresolved until the original
receipt is reconciled through the path below. Do not issue a fresh enrollment ID to mask that
outcome. A verified synthetic connection does not approve real credential onboarding or establish
the selected local custody deployment's isolation and key lifecycle.

Enrollment transfer is also bound to the admission's original certificate fingerprint or actual
instance and generation, principal, work and delegation. An otherwise valid alternate grant or
certificate cannot supply bytes for that admission. The initial local transfer window expires
five minutes after admission, is never renewed by replay, and is rechecked at claim/live dispatch.
This bounds a pending transfer; expiry does not delete its intent or resolve a committed receipt.

### Enrollment observation after an uncertain result

`POST /resource-intents/{intent}/reconcile` now supports `credential.enroll`. Gateway checks current
inspect permission before and after contacting the original management worker. Core supplies an
`EnrollmentRecoveryTicket` only to that admission's authenticated worker, for exactly one original
claimed/succeeded attempt. The selector contains firm, intent, attempt, enrollment, credential and
version identities; no secret, encrypted value, execution input or new grant. Old dispatch authority
may be revoked because this operation observes an existing effect instead of making another one.

Custody stores the Core intent and attempt with the version/enrollment receipt in the same
transaction. Both are unique per firm and must appear together. Legacy library-only receipts have
neither; they cannot prove a Core attempt retroactively. Recovery compares every selector field
against that receipt. Identical enrollment metadata under a different intent/attempt does not
match, even if its failed duplicate write left an unresolved Core claim.

A matching receipt reconstructs the immutable registration response and completes the original
Core intent without another claim, secret transfer, decrypt, version insert or provider call.
The response records registration identity; current disabled status is deliberately separate so
later disable cannot rewrite a past success. Missing receipts return an unresolved observation,
never proof of failed registration or permission to retry. Core/Gateway delivery still requires
current read scope; old revoked dispatch permissions do not authorize the reader.

The management worker bounds receipt reconciliation to five seconds, including a two-second
custody query. A further lost completion can be reconciled again with the same original selector.
Backup rollback, key recovery and network partitions across the entire transaction lifecycle
remain additional qualification work beyond the tested completion-failure scenario.

### Credential-version disable

`POST /credential-disables` takes exactly `credential_id` and positive `version`, with an explicit
work, delegation, target and stable request key. It uses the same Gateway admission/dispatch path;
`credential.disable` and matching target scope are required. Enrollment or model-use permission
alone does not authorize it. Extra enable/secret fields are rejected before persistence. The CLI
can call this operation through `request POST /credential-disables --input METADATA --key KEY
--work WORK --delegation DELEGATION --target TARGET`; the metadata file contains no secret.

Only the designated custody-management worker executes the admitted disable. It rechecks the
original claimed attempt through Core, then atomically sets the exact version's irreversible
local disabled state and records `credential_disables` with firm, intent, attempt and version.
Unknown versions fail. A receipt conflict rolls back the state update; the disabled bit alone is
never sufficient evidence that this particular request completed. The provider consumer has no
receipt insert or version-update rights, and management may not update/delete/truncate receipts.

The disable transaction has a five-second budget inside the worker's ten-second execution bound.
It waits for an existing credential-use shared lock before committing. Acceptance is therefore
not immediate termination: an already authorized use may finish, and external effects already
sent are not undone. Once disable commits, later credential consumption cannot obtain the value.
If waiting or completion times out, keep the original intent unresolved until observed; do not
silently release its reservation, re-enable the version or switch to another credential/provider.
Fast restriction of an active execution still uses the existing Core revocation/Runtime paths.
This local disable is not revocation of the credential at the external provider.

Receipt-only reconciliation uses the common `CredentialRecoveryTicket` union at the worker/Core
boundary, selecting enrollment or disable from the original admitted operation. The original
worker and sole attempt remain required. `POST /resource-intents/{intent}/reconcile` can confirm
the stored disable under a current independent inspect grant after the disable grant is revoked.
No secret/decrypt/provider call, repeated disable or replacement attempt is part of recovery.
Version rotation, connection activation and provider-side key revocation remain separate work.


### Deployment-pinned provider with managed credential versions

The provider process configuration can explicitly set `provider_managed_versions: true`; its
absence retains strict equality with the deployment's full fixed binding. Other worker roles
reject the option. In managed mode only `credential_version` can differ in a Core-issued ticket.
Target, endpoint, credential identity, timeout and maximum response size must equal the local
binding. The version must be positive and representable by custody. Native protocols, TLS roots,
retry policy and response redaction are unchanged. This opt-in is a deployment trust decision;
private caller JSON cannot enable it or choose an endpoint.

The trusted sender obtains the selected version from authenticated Core dispatch, then performs
current Core live authorization inside credential use immediately before send and during delivery.
The custody claim and provider receipt bind the actually selected version. The worker does not
interpret a proposal or recommendation as authority and never fetches plaintext on behalf of an
agent. Core's managed verification scope applies to each admitted call and live check. Selecting
configuration alone does not prove a credential is usable: absent/disabled versions or incompatible
provider authentication fail without granting fallback access. Receipt-only recovery continues to
refer to the original attempt and does not resend under a successor version.

The selected native adapter fixture now exercises operation-only provider use from submitted code.
Its immutable script calls the existing Gateway native Responses route; it does not receive a
credential value, custody key, provider TLS key or credential-store connection. The trusted provider
worker alone uses the encrypted credential and contacts a bounded loopback HTTPS provider fixture.
Source execution, independent fixture verification and the final native-admitted child each make
one provider request under their own actual instance. The native parent uses the same managed
provider for its five synthetic model responses. This qualifies the connection of existing paths
in the local fixture, not arbitrary HTTP adapters or any real provider/account integration.

### Bounded private service through retained conversations

The first private service is an accepted immutable contained program that handles multiple requests
within one fixed execution lifetime. It uses a retained conversation as its authorized contact
channel. Service code is submitted, separately verified, accepted and activated through the existing
adapter lifecycle; neither calling it a service nor retaining its channel creates a new approval
path. Its executable never resides in Core or the credential-bearing provider worker.

The service reads conversation pages through Gateway, checks message IDs and explicit reply links,
and records responses through the same API as people and other agents. Inputs identify the existing
conversation and authorized work, not a new network listener. A message's text is untrusted task
input, not a delegation: any requested resource operation needs its own current authorization.
The selected program fixes a finite request count and polling interval within its approved hard
deadline and existing message/byte limits. Idle waiting does not extend the deadline. No incoming
message automatically creates a new execution or enlarges a resource limit.

A replacement is explicitly admitted under current authority and reads retained records before
selecting outstanding work. It must not copy the old instance identity or treat a local cursor as
the authoritative completion record. For an unchanged logical principal, delegation and reply input,
reusing the stable reply request key recovers the original message without replacing its author
instance attribution. Different input conflicts; changed delegation is different input and requires
reading the original record rather than assuming replay compatibility. A new principal needs its
own current membership and permissions. Historical membership does not restore access.

A conversation is not an exclusive job queue. Several participants may legitimately reply to the
same message, and distinct request keys may create distinct replies. The first service must not
claim exactly-once external execution from reply deduplication or cursor advancement. It records and
reconciles each DB, publication or provider operation through that resource's existing stable intent
and effect receipt before reporting its result. Ambiguous external effects remain unresolved; an
absent reply does not authorize resending them. Concurrent processing requiring exclusive ownership
needs an explicit admission/claim contract before it can be enabled.

Stopping activation denies further service use through the same running-execution checks as an
adapter. Runtime termination and compute return do not remove the conversation, its artifact
references or unresolved resource records. Inspection uses current access; publication/retirement
and retention remain separate operations. A worker surviving between executions is external
scheduling capacity, not proof that this private service has remained available.

The next connected qualification must run one accepted program against at least two requests in
one real isolated instance, retain its replies, stop it, explicitly admit a new instance, and handle
an additional request from retained state. It must test current membership denial and resource
receipt recovery without exposing a host listener, credential or shared mount. This full service
qualification is partially exercised by the bounded service fixture recorded in VALIDATION.md.
Live delivery and retained replies across separately admitted instances passed; service-specific
forced stop, membership revocation while waiting and external resource receipt recovery remain
NOT RUN. The transaction-level conversation test separately qualifies its stated storage/access scope.

The subsequent waiting-service fixture also qualifies activation stop: after the first response,
instance Gateway access changes from success to denial while the actual container is still alive,
then Runtime observes termination before the hard deadline. Existing replies remain readable by
the authorized human, a post-stop request stays unanswered, and a new invocation under that stopped
activation is denied. Resuming service requires an independently valid activation/admission decision;
retained messages are not such a decision. Membership-only revocation, external-effect continuity
and deployment restoration remain separate unqualified service paths.

For completed DB work, the connected service fixture now recovers the original registered
`record_result` response across separately admitted instances of the same logical principal. The
stable resource key binds work, target, operation and input; current inspect scope is checked again.
The changed child grant does not change a completed effect's identity or authorize a second effect.
Service replies contain the recovered result ID, which the fixture compares with the original
atomic company receipt. This result does not extend to an accepted/undispatched request: that path
still binds the original instance and grant. A claimed but unresolved request requires the existing
receipt-only reconciliation path before it can be reported as complete. That interruption case has
not yet been qualified inside the bounded service fixture.

### Company receipt-only recovery

Company DB writes now have an implemented observation path. Earlier references to an existing
receipt-only path described the intended relationship; the connected fault test revealed that the
Gateway allowlist and Company worker had not yet implemented DB observation. They are now connected
explicitly, without using `record_result` for reconciliation.

For `POST /resource-intents/{id}/reconcile`, Gateway checks current reader scope and contacts the
original registered worker. The Company worker authenticates to Core at
`POST /resource/company-recovery/{id}`. Core returns a `CompanyRecoveryTicket` only for an original
`db.write`/`record_result` intent in claimed or succeeded state with exactly one matching original
worker/attempt/state. The ticket binds firm, intent, original attempt and parameters. A changed
Registry worker does not inherit access to the old attempt, and an undispatched request cannot
obtain this ticket. The route is an authenticated worker observation endpoint, not a private API.

The worker reads the existing effect receipt joined to its company result and compares both stored
inputs with the ticket parameters. It returns no result when evidence is absent and fails on a
mismatch. It never inserts a result, creates an attempt or invokes the prepared transaction. A
matching observation is reported through the existing completion path; Gateway checks current
inspection access again before delivering it. The original result ID, attempt and economic record
remain unchanged. Native protocol handling and credential access are unaffected.


### Admission pause at resource execution

For prepared Company queries and transactions, workspace creation, publication, retirement and
fixture MCP/model operations, the assigned worker calls Core's original-attempt live check
immediately before entering the operation. Catalog checks include the observed storage claim.
A denied or unavailable check prevents that dispatch; it does not retry with another worker or
release an unresolved reservation. Native provider and binary transfer paths keep their own
existing live-check boundaries. Receipt-only Company recovery uses the original dispatch and
retained receipt, without authorizing a fresh write.

Core admission pause and a Company/catalog commit are separate transactions. A request that has
passed its last live check can already be in flight when pause commits. Pause therefore means
new dispatch is restricted, not that all effects have ceased. Shutdown must separately account for
active workers, final observations and unresolved effects before claiming a coherent backup.
See the connected and Core qualification results in [Validation](VALIDATION.md#connected-admission-control-and-pre-effect-revalidation).


The provider's existing current-attempt live checks also apply to an open model stream after
admission pause. A failed check interrupts delivery without synthesizing a native completion or
settling the original request. Received bytes do not establish terminal usage, and local disconnect
does not establish provider cancellation. The connected first-byte/pause qualification is recorded
in [Validation](VALIDATION.md#environment-pause-after-first-model-stream-data).
