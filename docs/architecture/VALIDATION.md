# Validation

This document specifies acceptance evidence for the proposed [Architecture](../../ARCHITECTURE.md) and [Contracts and State](CONTRACTS_AND_STATE.md). It does not grant permission to provision services, obtain credentials, publish externally, or trade.
The full acceptance cases below remain **NOT RUN**. The local implementation section records
narrow component and qualification runs under the separate local implementation authorization;
none establishes completion of an entire acceptance case.
For the current executable entry points, start with [responsibility-based checks](#responsibility-based-executable-checks).
The later implementation evidence preserves earlier runs and their limitations; historical command
lines and test counts are not the current test-selection interface.

## Reference Profile and Evidence Levels

The first proposed reference profile uses a Rust backend and CLI, with API/CLI acceptance first and an independent TypeScript UI deferred. It runs Codex App Server over stdio inside an owner-controlled Lima VZ VM with Ubuntu 24.04 and Docker `network=none`, an instance-bound netns-only bridge, and an isolated agentgateway resource worker;
PostgreSQL 18.6 with distinct control/evidence and operational databases and roles; and an outer-owned artifact store. [Integration and Deployment](INTEGRATION_AND_DEPLOYMENT.md) owns
exact executable versions, image digests, configuration, topology, and supported native paths.
These selections are candidates to validate, not verified compatibility or deployment facts. The selected profile includes an independent armed cgroup kill-FD guard with a nonextendable hard `CLOCK_BOOTTIME` deadline; its limits require actual backend evidence.

The Mac persistent-storage qualification target separates a selected development/cache volume from a
runtime APFS volume with explicit reserve, quota, and ownership on the same external SSD. The
persistent raw data disk contains separate, fixed ext4 state and content filesystems; the replaceable
guest OS/container disk and private scratch have independent bounds. State contains the protected
PostgreSQL cluster and bounded evidence spool; content contains immutable artifacts and staging.
These are proposed boundaries, not observed provisioning. A recovery copy on this same SSD does
not qualify as protection against loss of the device. [Deployment](INTEGRATION_AND_DEPLOYMENT.md)
owns activation, mount identity, cold backup, recovery-anchor limits, and restoration ordering.

| Level | What a result can establish |
| --- | --- |
| Document review | Contract consistency, responsibility coverage, and bounded acceptance criteria; no runtime behavior. |
| F: deterministic fixture | Reproducible ordering, duplicates, uncertainty, accounting, and denied effects against a controlled backend. |
| R: real reference backend | Actual Rust API/CLI, Codex process, VM/container/bridge/guard enforcement, PostgreSQL, artifact storage, and protected worker behavior on the recorded host. |
| P: real provider | Actual native model/MCP or other non-financial provider behavior under separately authorized credentials and spend. A fixture cannot substitute for this claim. |

An R test may use F resources to inject faults while retaining the real enforcement boundary.
Any P portion remains unrun until its own authority and bounded resource commitment exist.
Financial cases use fixtures only here: no live orders, capital movement, or market integration.
Passing Mac tests does not qualify Linux deployment, another harness, or a managed-agent provider.
Each replacement must pass the applicable cases on its own actual supported paths.

For the selected named custom model provider, `request_max_retries=0` limits the HTTP retry loop
to one attempt; `stream_max_retries=0` is not a global no-retransmission guarantee. The separate
`UnboundedConnectionRetries`, WebSocket-to-HTTP fallback, and authentication-recovery paths must
be exercised. Built-in `openai` cannot be overridden by a same-name custom-provider definition;
verify the actual distinct custom provider and loaded configuration, then count real dispatches.
Any observed automatic model retransmission leaves this first profile ineligible; body-hash deduplication
cannot repair it because two intentionally distinct calls may have identical request bodies.

## Responsibility-Based Executable Checks

[Test organization and execution](../../tests/README.md) defines the repository layout and entry points.

The test boundary is the responsibility a replacement implementation must preserve. API/CLI
scenarios assert authenticated outcomes, denied effects, durable receipts and observable state;
they do not assert private function calls or a particular module layout. Actual PostgreSQL, TLS,
filesystem and Linux observations remain necessary where those mechanisms own the guarantee.
Small deterministic unit tests remain appropriate for parsing, cryptography, safe path handling,
state transitions and the test selector itself. No LLM evaluates these system results.

The executable inventory is [`tests/support/check_catalog.py`](../../tests/support/check_catalog.py), together
with the named native contracts in [`tests/support/native_scenarios.py`](../../tests/support/native_scenarios.py).
The following map names representative executable IDs, not equivalent proof of the full V-series
acceptance cases or an exhaustive copy of the catalog.

| Responsibility preserved | Executable IDs | Required observation boundary |
| --- | --- | --- |
| Current authority, aggregate reservations, stable request identity and unresolved effects | `core.transactions`, `core.mutations`, `wake.api`, `native.ack-recovery`, `native.timer-successor` | Real PostgreSQL transactions and bounded oracle mutation proof; real native execution only in the named native cases. |
| Shared human/instance ingress, authenticated context and current controls | `ingress.api_cli`, `resources.api`, `native.management-isolation`, `native.revocation` | Actual mTLS Gateway/Core/CLI and, where selected, two Runtime-bound instances. |
| Exact inputs, native control, bounded containment and successor continuity | `native.workflow`, `native.program-completion`, `native.controls`, `native.successor`, `native.checkpoint-identity`, `native.checkpoint-truncated`, `native.checkpoint-revoked`, `native.runtime-loss`, `native.kernel-contracts` | Real Codex/program execution, Docker, namespace/cgroup/guard and checkpoint observations; model responses are synthetic. The kernel case separately tests actual descriptor handoff. |
| Separate upload/publication, atomic receipts, storage restrictions and operation-only secrets | `resources.receipts`, `resources.api`, `native.encrypted-provider`, `native.adapter-provider` | Real database/file effects and protected worker paths; credentials in these suites are synthetic. |
| Submitted adapter activation, stopped use and persistent service obligations | `native.adapter`, `native.adapter-stop-pending`, `native.adapter-stop-running`, `native.service-db`, `native.service-effect-recovery` | Isolated submitted code, current activation state and recorded effects across replacement. |
| Retained, scoped conversation and explicit native delivery | `conversations.api`, `native.conversation-control`, `native.conversation-reply`, `native.service` | Durable API messages and separately observed native delivery; a message grants no execution authority. |
| Installation, storage identity, restricted recovery and current state | `native.environment`, `native.install-faults`, `native.cold-restart`, `native.cold-successor`, `recovery.crypto`, `recovery.archive`, `recovery.postgres` | Real local files, protected service lifecycle and synthetic restored databases; independent backup and current owner enrollment are separate. |
| Usable control/inspection and trustworthy test accounting | `config.startup`, `ingress.api_cli`, `native.bounded-load`, `repository.integrity`, `tooling.contracts`, `rust.invariants` | Actual binaries, bounded measurements, source-bound result accounting and deterministic tooling tests. |

Core integration targets and the independent resource receipt cases require the Cargo
`postgres-tests` feature. Default Cargo tests intentionally select the fast tests; they do not
silently skip a selected database case. The selected database runner requires nonzero executed
tests with no ignored or filtered cases. It creates its own PostgreSQL 18 cluster, randomized
SCRAM credentials and disposable databases. `OURO_TEST_DATABASE_URL_FILE` is the Core test
binding; resource tests receive `OURO_RESOURCE_TEST_ADMIN_URL_FILE`, `OURO_TEST_TEMP_DIR` and
`OURO_TEST_BINARY_DIR`. These are private fixture inputs, not application configuration or
permission to use an existing database.

[`tests/support/run-postgres-suite.py`](../../tests/support/run-postgres-suite.py) exposes `core-db`,
`control-mutations`, `resources-db`, `api-cli`, `resource-api`, `conversation-api`, `wake-api` and `all` as named
suites. Each management API suite prepares a fresh database and certificates. `resource-api`
selects storage response-loss, bounded binary transfers, workspace, retirement and collection
checks, and requires their individual successful results. Native scenarios are selected by ID
through `run-native-suite.py`; callers cannot choose arbitrary combinations of internal fixture
booleans. Repository-owned orchestration accepts explicit host/build/scratch inputs and does not
depend on a developer's ignored research directory.

The bounded `control-mutations` proof first runs the unchanged independent state-model oracle,
then applies three deliberate authority/capacity/replay violations only to a private source copy.
It uses a fresh build target outside the working checkout, never the attested product binaries.
Each mutant must compile and fail the exact expected behavioral assertion; a compiler error,
unrelated failure, no executed test or timeout does not count as a detected violation. Original
source preservation and cleanup are required evidence. The mutation injection points may need
explicit relocation after a refactor; they do not replace the implementation-independent behavior
oracle with assertions about private function names.

The Linux-only descriptor-handoff test is the deliberate remaining `#[ignore]` exception in the
generic Rust invocation. `native.kernel-contracts` uses its exact prebuilt, source-bound test
binary and exact test name with `--ignored --exact`; it requires one executed pass and zero
remaining ignored tests. An unsupported kernel or absent test binary fails that selected case.
`native.program-completion` separately checks the materialization barrier, natural program
completion, compute-receipt replay and successor history; it is not replaced by a Codex smoke test.

The common `check.py plan/run/report` path selects checks from changed paths and responsibility
dependencies, including deleted paths and both sides of a rename. Shared or unclassified changes
expand selection; invalid selection fails. A full plan selects every registered automated case.
Each result binds the scenario and source digest to its actual environment and outcome. A changed
source, absent/duplicate/unselected result, failed case or required `NOT RUN` cannot satisfy the
final report. Build caches are not test results. The selection and accounting tests include
malformed evidence, documentation-only changes, shared changes, deletion, and incomplete results.

These are executable checks and enforcement rules, not a claim that the current checkout has
passed them. A required platform or tool that is unavailable leaves an explicit failing or
`NOT RUN` result; no simulated backend substitutes for Linux enforcement. Actual GitHub workflow
execution remains **NOT RUN** until tested on a PR. Real subscription calls, independent backup,
and owner-authorized operating recovery remain separate incomplete acceptance boundaries.

## Bounded Runs and Required Records

Before a future run, record its case, exact profile, authenticated principals, current delegation, activated capabilities, canonical backend targets, input fixtures, and independent observation path.
Fix finite time, attempts, children, concurrency, CPU, memory, disk, output, retention, and cost bounds appropriate to that case. Missing required bounds mean NOT RUN, never unlimited execution.
Record how active jobs and unresolved provider effects will be observed and contained at timeout.

Every result retains work/instance, intent/attempt, decision, reservation, configuration/restriction generation, observed lifecycle, provider/resource identity, usage, and material artifact references
where applicable. Retain occurrence and receipt times, denial reasons, provenance, and uncertainty.
Use backend observations to corroborate effects and absence of expected effects; an agent's report
or client error alone proves neither. A denied request must not create an unrecorded effect.
Evidence access and export obey their own permissions. Preserve contradictory and adverse results.
Record gaps and bounded retention costs; a hash without retained content is not sufficient evidence.

Each case below specifies setup/input, fault or challenge, expected records/denials, recovery, and the required evidence level. Successful requests and denied attempts share attributable records.

## Shared Authority and Usable Native Execution

### V-01 — Equivalent human and agent access — NOT RUN

- **Setup/input:** Give an API/CLI human and bound agent equivalent ordinary permissions and compare requests. For credential enrollment, the currently authenticated target human calls `POST /principals/{id}/credential-challenges`, proves possession of the new key by signing that challenge, then calls `POST /principals/{id}/credentials` with explicit exact-binding consent. Repeat client cases on the future UI.
- **Challenge:** Remove permissions, expire a grant, forge a principal, bypass Gateway, and replay an old result key after read revocation. Submit stale, consumed, other-principal, other-key, or changed-revision credential challenges; let a credential-manager agent/service present its own certificate as the human's or sovereign's replacement.
- **Expected:** Equivalent ordinary policy results preserve actual identity. Credential binding requires target-human current authentication, exact consent, new-key proof, and atomic single-use consumption; manager permission alone cannot satisfy them. Deny forged/invalid bindings. Historical lookup checks current read rights without forbidden disclosure, reexecution, or reservation; viewing grants no intervention.
- **Recovery:** Retain denials and use only independently valid current bindings. Recover a lost registration reply by its original identity and a currently valid credential, never challenge replay or restoration of a retired key. An ordinary administrator cannot replace lost-key recovery under protected designation/scope rules.
- **Level:** F policy/challenge/replay cases plus R actual signature verification, atomic challenge consumption, authentication, and alternate-route checks; neither human labels nor localhost exempt the caller.

### V-02 — Internal services cannot launder authority — NOT RUN

- **Setup/input:** An agent invokes a private internal service through Gateway; the service has its own scoped execution identity.
- **Challenge:** Forward a forged origin, substitute the service's wider permission for caller authority, or invoke its backend without Gateway mediation.
- **Expected:** Origin and service remain separately attributable; delegated action satisfies its verified authority chain. Missing or widened context and direct access are denied.
- **Recovery:** Continue independently authorized service work only under its own recorded work and limits; it cannot relabel the denied request as that work.
- **Level:** F context cases plus R internal-service, worker, and Gateway paths, including service-originated follow-on requests.

### V-03 — Complete native work and resumption — NOT RUN

- **Setup/input:** Run actual Codex App Server stdio with the activated distinct custom model provider: discover resources/files, execute real PostgreSQL `read_input` and `record_result`, use the model and one controlled standard MCP tool, request compute, and publish. Inspect/control through API/CLI.
- **Challenge:** Retain subagents, long-context/compaction, background work, tools, waiting, and resume/reconstruction. With both retry settings zero, separately inject connection failure, mid-stream failure, `401` plus authentication recovery, and WebSocket-to-HTTP fallback on actual dispatch paths, including `UnboundedConnectionRetries`.
- **Expected:** Preserve native behavior, parent limits, DB result/receipt, compute, publication, and evidence. Correlate incoming native calls, Gateway attempts, and real upstream dispatch counts: the settings alone do not prove no retransmission. No recovery/fallback path may automatically resend an uncertain call or bypass admission; identical bodies do not establish identical intent.
- **Recovery:** Block this first profile if any tested path automatically retransmits a model call or cannot be qualified; recognizing its identity afterward is not a substitute for preventing that dispatch. Preserve uncertain cost/effects; resume only with current authority and a qualified binding. Subagent labels alone establish no independent isolation.
- **Level:** R complete workflow including real PostgreSQL and controlled standard MCP transport, plus P actual native model behavior under injected failure. An F response or configuration text alone cannot prove provider compatibility or disabled retries; qualify additional MCP providers separately.

## Enforced Resource Boundaries

### V-04 — Network and protocol bypass — NOT RUN

- **Setup/input:** Start Docker with `network=none` and a bridge joined only to that instance's network namespace; bind its actual process/generation and scoped Gateway token to the fixed outer UDS. Probe native tools, subprocesses, and descendants.
- **Challenge:** Attempt raw IPv4/IPv6, DNS tunneling/rebinding, alternate protocols, host/metadata/sibling routes, redirects, native telemetry/browser/download/direct model/MCP paths, forged identity/bridge headers, alternate UDS targets, and UID/PID reuse; close the bridge channel mid-request.
- **Expected:** Only the bound Gateway path succeeds; worker UID/PID or supplied identity alone cannot select another generation/token. Deny arbitrary forwarding and inaccessible host namespaces/UDS credentials. Trusted process/network evidence verifies isolation; bridge EOF cannot create a fallback route or imply the effect did not occur.
- **Recovery:** Reconcile in-flight effects, fence the failed bridge binding, and require a fresh verified process/generation before access resumes. A reused PID, reopened socket, proxy setting, or cooperative hook cannot reestablish authority.
- **Level:** R VM/container and worker networking with controlled F endpoints; P only for native provider routes specifically claimed supported.

### V-05 — Host, mount, database, and storage escape — NOT RUN

- **Setup/input:** A worker has allocated scratch and an authorized working copy; the controlled PostgreSQL contract permits only the bounded `read_input` named query and `record_result` named transaction, with a protected transaction receipt.
- **Challenge:** Access host files, Docker sockets, sibling/shared writable mounts, direct PostgreSQL, protected tables/receipts, raw SQL, undeclared names, SQL extensions, oversized results, or path/symlink traversal; seed another scope's snapshot/checkpoint using compute permission alone. Substitute or override built-in `openai` by name, mutate retry settings, or restore unqualified auth/fallback paths.
- **Expected:** Scoped work succeeds; privileged and unsupported paths are denied. Materialization needs the target principal's current read rights and Gateway-approved immutable input binding. A same-name definition cannot qualify as a built-in override; verify the actual custom provider/configuration and block any profile failing V-03's real retransmission tests.
- **Recovery:** Preserve failed-operation evidence, operational results, and protected receipts; private database permissions cannot forge or erase a receipt. Recover affected work only; scratch exhaustion cannot consume unbounded host/evidence capacity.
- **Level:** R mounts, backend roles, query limits, storage paths, and actual VM/container privilege boundaries; F malicious payload corpus.

## Aggregate Commitments and Continuing Work

### V-06 — Concurrent 70 + 70 against 100 — NOT RUN

- **Setup/input:** Two requests share a 100-unit fixture allowance and each requests 70; repeat through children, new sessions, and two connectors addressing the same canonical resource.
- **Challenge:** Synchronize admission before either commits; replay serialization failures and create nested delegations while the first reservation remains outstanding.
- **Expected:** At most one 70-unit commitment is admitted; no child, session, route, or retry creates a second allowance. Both decisions and aggregate/ancestor reservations remain inspectable.
- **Recovery:** Retry only admission that did not dispatch; release only after confirmed cancellation or accounted-for resolution. Units are illustrative, not a product budget.
- **Level:** F concurrency schedules against R PostgreSQL transactions and actual Core admission; retain the committed history rather than only final counters.

### V-07 — Late bills, external costs, and capital flows — NOT RUN

- **Setup/input:** Supply estimates, measured usage, delayed and revised invoices, owner-paid/shared costs, an unresolved charge, initial/additional contributions, and withdrawals.
- **Challenge:** End the process, remove its connector, duplicate an invoice, post a bill above its estimate, and lose a model response/stream before requesting fresh work.
- **Expected:** Reservations and obligations survive; estimated/measured/billed/unresolved values remain distinct without double counting. Contributions and returned principal are not profit; withdrawn profit is not also retained capital.
- **Recovery:** Reconcile invoice/resource identities and retain corrections, costs, losses, and attribution. An uncertain model call keeps its cost/commitment until resolved; disabling retries does not make it free. Uncertain availability restricts admission; missing cost data is not zero.
- **Level:** F accounting and provider-billing scenarios over R persistence/projections; P required later for any claimed provider ceiling or real billing semantics.

### V-08 — Duplicate wakes and event disorder — NOT RUN

- **Setup/input:** Private operation registers one bounded timer/event/dependency occurrence for existing work with its permitted retry policy.
- **Challenge:** Deliver it twice, reorder callbacks, forge a provider callback, omit one event, and replay after scheduler restart.
- **Expected:** No duplicate occurrence creates new authority, work, or allowance; source authentication, receipt/order evidence, consumer progress, and gaps are recorded.
- **Recovery:** Reconcile the gap, then wake only currently authorized work; Core never invents a new private research or trading agenda.
- **Level:** F delivery schedules plus R Core persistence, scheduler restart, and callback authentication; no assumption of exactly-once transport.

### V-09 — Effect created, response lost, responsibility handed over — NOT RUN

- **Setup/input:** Admit own-JSON compute and `record_result` operations using fixed inputs and stable request keys. Separately originate two intentional identical-body native model calls with distinct Gateway ingress/invocation identities and separately admitted intents; this does not assume caller-supplied native idempotency-key support.
- **Challenge:** Apply a JSON effect, lose its first response before the caller learns its intent ID, deactivate the target, then repeat matching/changed input under the original key and use a fresh key. Replace the harness/connector, interrupt PostgreSQL after result/receipt commit, and inject V-03's native failure/recovery/fallback paths separately.
- **Expected:** Current read permission permits matching-key lookup of the existing JSON intent/result even with its target inactive, without new activation checks, reservation, claim, or effect; new-key admission is unavailable and changed input conflicts. No lookup leaks inaccessible records. Distinct intentional native invocations are never merged by body hash. Real PostgreSQL atomically retains result/protected receipt; all uncertain costs/attempts remain.
- **Recovery:** A fresh bound successor reconciles actual effects before retry/release. Missing Core observation is recovered from the protected DB receipt. Unsupported model lookup retains uncertainty and cost; any later intentional call needs its own admission, not an invisible native retry.
- **Level:** F fault schedules plus R PostgreSQL/compute and actual receipts; P dispatch-count evidence under native failure and each provider's deduplication, key retention, and late responses.

## Revocation and Recovery

### V-10 — Queued dispatch versus revocation — NOT RUN

- **Setup/input:** Pause an admitted effect before claim; order claiming and `POST /delegations/{id}/revoke` both ways. Separately stop only an instance with `POST /executions/{execution_id}/stop` while its delegation remains valid.
- **Challenge:** Replay queues, cached grants, stale claims, and send/fence races; retry old-result lookup after read revocation. After delegation revocation, call `POST /executions` for a successor with fresh request/execution/session identifiers or a predecessor reference.
- **Expected:** Instance stop does not itself revoke a valid grant; any successor still needs fresh current admission. A revoked grant cannot authorize a successor or dispatch through new IDs. Earlier claims remain in flight until observed fencing/reconciliation; historical lookup checks current read rights with no forbidden disclosure, redispatch, or reservation.
- **Recovery:** Preserve separate requested/accepted/applied stop and revocation records plus outstanding effects. Release only confirmed unsent work; a successor needs independently valid current authority, never revived permission or rollback of remote consequences.
- **Level:** F deterministic races plus R Core/worker boundaries, authentication, and actual denial after the cutoff.

### V-11 — Open streams and long-lived sessions — NOT RUN

- **Setup/input:** Open authorized model/MCP streams, data subscriptions, and database operations with bounded usage and stopping latency.
- **Challenge:** Revoke during output, queue another operation on the connection, and delay the backend's terminal acknowledgement.
- **Expected:** Deny subsequent dependent use, observe stream/session restriction, retain delivered bytes and in-flight usage, and label incomplete stop evidence. Already delivered information cannot be revoked retroactively.
- **Recovery:** Reconcile usage and external session state before releasing commitments; a fresh connection requires current authority.
- **Level:** F delayed output plus R Gateway streaming and database controls; P for real provider cancellation and usage behavior.

### V-12 — Active jobs and descendants — NOT RUN

- **Setup/input:** Use a trusted blocked bootstrap, unique instance cgroup/generation, and independent guard holding its kill FD and armed hard `CLOCK_BOOTTIME` deadline before any arbitrary entrypoint/private payload runs; start bounded jobs, subagents, and servers. Separately allocated child instances each need their own guard.
- **Challenge:** Start payload before arming; attempt deadline extension, kill-FD/target replacement or path reopening, cgroup escape or identifier reuse; revoke the parent, retain children, and close/kill the supervisor connection while guards stay alive. Separately fail a guard/kernel.
- **Expected:** Unarmed bootstrap cannot execute arbitrary code. Supervisor EOF cannot cancel a guard, extend its deadline, or release commitments. A kill FD targets only its bound cgroup and local descendants; independently observe allocated children's guards/fencing. Measure termination against the configured bound on a responsive guest without claiming strict real-time execution or protection from guard/kernel failure or host sleep.
- **Recovery:** Independently fence Gateway access and reconcile resources/charges; a fresh instance needs a new armed binding and current delegation, not a deadline extension. Revoked delegation cannot authorize `POST /executions` despite fresh IDs. Stop/expiry proves neither termination nor settled cost; bounded recovery cannot originate new trading or unrestricted compute.
- **Level:** R bootstrap, cgroup kill FD, process/generation reuse, supervisor EOF, and actual deadline/descendant observations; F delayed remote jobs. Test pressure/log-full and sleep limits in V-16/V-22/V-23; P before claiming remote containment.

### V-13 — Old backup and native checkpoint — NOT RUN

- **Setup/input:** Capture backups and a native checkpoint before a later revocation, activation, committed effect, cost, and operational-data update.
- **Challenge:** Restore older control/database/artifact state and resume with old tokens, sessions, or queued work; use a compute grant to copy another scope's old snapshot/checkpoint into a successor without a current approved input binding.
- **Expected:** Older state proves neither current authority nor absence of later effects. Fence old instances and expose gaps; before materialization, require the target principal's current read rights and Gateway-approved immutable input binding. Compute permission or prior checkpoint access alone is insufficient.
- **Recovery:** Reconcile trustworthy authority, actual backends, obligations, artifacts, and operational records before binding a successor; unresolved authority requires the applicable authorized decision.
- **Level:** R backup/restore and bindings plus F later-effect timeline; no automatic multi-host failover or economic rollback claim.

## Failure, Change, and Evidence

### V-14 — API/CLI clients and inner reporting failure — NOT RUN

- **Setup/input:** Observe work through Rust CLI and another authenticated API client; no UI is initially required. Establish Core projection changes ordered by commit and a primary-store repeatable-read snapshot containing its scoped records, revision, and corresponding cursor position.
- **Challenge:** Commit mutations before/during the snapshot and between snapshot completion and SSE subscription; force competing transaction/sequence allocation order, disconnect clients, omit private reports, change read scope, and saturate ordinary requests while authorized inspection/restriction continues. Later repeat with a stopped/stale/malicious TypeScript UI.
- **Expected:** Each authorized committed Core mutation is represented in the consistent snapshot or replay after its cursor, never silently skipped by a mid-snapshot race or late commit behind an already served position. Keep native/provider occurrence order separate. Enforcement and protected control capacity continue; missing reports remain stale/unknown, not inactivity or success.
- **Recovery:** Recheck current access for disclosure/replay; changed scope or unavailable retained history requires a new authorized snapshot and explicit gap. Show requested versus observed control effects without a privileged client route. The Core snapshot is not a globally current provider snapshot; future UI failure cannot remove API/CLI control.
- **Level:** F transaction/delivery schedules over R PostgreSQL repeatable-read/commit ordering, API/CLI/SSE, Gateway capacity, and runtime observations. TypeScript UI remains deferred and NOT RUN.

### V-15 — Gateway or Core unavailable — NOT RUN

- **Setup/input:** Have admitted work, a queued effect, and an active bounded resource; fail Gateway and Core separately, including their authenticated internal link.
- **Challenge:** Attempt fresh admission, use cached permissions, and address providers or Core directly while control is unavailable.
- **Expected:** New dependent effects are blocked; Runtime follows only already-authorized containment. No emergency company API bypass appears; independent host restriction does not create product authority.
- **Recovery:** Retain infrastructure intervention evidence, reconcile effects and control state, then restore mediated access; unaffected work continues only while its own prerequisites remain valid.
- **Level:** R component/network failures with F external effects; document interruption rather than claim uninterrupted availability.

### V-16 — Runtime, connector, or evidence failure — NOT RUN

- **Setup/input:** Active work has bounded connector retries and protected observation ingestion/spooling; observe it independently of private reporting.
- **Challenge:** Kill Runtime, hang/exhaust a connector, block ingestion, fill logs/spool/disk, remove a referenced artifact, and apply bounded CPU/memory/I/O pressure while the independent guard is armed and supervisor EOF occurs.
- **Expected:** Bound consumption, expose affected work/evidence gaps, and restrict activity unable to retain required evidence. Logging or supervisor failure cannot cancel the kill FD or hard deadline; observe actual termination under the recorded pressure profile, without claiming protection from guest/kernel starvation or failure.
- **Recovery:** Reconcile actual instances and provider effects, ingest retained records without duplicates, and recover missing content where possible. Preserve irrecoverable gaps and unchanged unrelated work.
- **Level:** R supervisor/storage/worker failures plus F provider faults; acceptance needs both control records and independently observed backend consequences.

### V-17 — Role, connector, and activation changes — NOT RUN

- **Setup/input:** Register a candidate connector, harness/profile, or control/evaluator change under existing authority; preserve the active package and target binding.
- **Challenge:** Self-grant roles, impersonate the sovereign, replace protected rules via connector maintenance, steal a sibling credential, or activate changed bytes. A credential-manager agent/service attempts to bind its own certificate to an existing human/sovereign or claims ordinary-admin lost-key recovery.
- **Expected:** Registration/publication grants no activation or authority. Enforce separate proposal/evaluation/authorization/activation; reject self-expansion and sole self-acceptance. Credential management cannot substitute for V-01's current target-human authentication, exact binding consent, valid new-key proof, and single-use challenge; ordinary admin cannot recover sovereign identity.
- **Recovery:** Restrict the affected activation and retain prior effects; semantic/cost/failure differences require relevant case evidence. A second real harness is required for portability claims.
- **Level:** F role/contract cases plus R worker isolation, package/target binding, and activation records; P for provider-specific replacement guarantees.

### V-18 — Concurrent and cross-store artifact publication — NOT RUN

- **Setup/input:** Two workers publish from one source revision; staging and publication are separate attributable intents with their own stable keys, attempts, outcomes, and linked immutable content.
- **Challenge:** Independently lose staging and publication commit acknowledgements; crash around blob durability/record commit, retry either uncertain intent, corrupt content, or exhaust artifact capacity.
- **Expected:** Each phase retains its own uncertain state and retry identity; matching retries locate the original committed effect and changed input conflicts. Staging success is not publication; no silent overwrite or successful reference to missing/unverified content occurs.
- **Recovery:** Reconcile each intent's durable effect before retry or cleanup, including a publication committed before its response was lost. Protect in-use artifacts and retain unresolved states. Publication neither activates code nor verifies its claims.
- **Level:** R artifact/PostgreSQL crash boundaries and concurrency with F fault points, including restart and failed cleanup.

### V-19 — Secrets in observations and exports — NOT RUN

- **Setup/input:** Inject synthetic canary secrets into provider errors, traces, configuration, output, native session material, and artifact metadata.
- **Challenge:** Inspect/export as ordinary and restricted principals; make a connector request a sibling worker's secret or forward raw credentials to private execution.
- **Expected:** Ordinary views/exports contain no usable canary; unauthorized secret access is denied. Restricted originals, where necessary, retain scoped access and provenance; redaction identifies material omissions.
- **Recovery:** Retain denial/redaction evidence and reconcile any exposure before reuse. Sanitization must not erase the underlying effect or present an incomplete projection as complete.
- **Level:** F canaries over R custody, worker boundaries, persistence, API/CLI, and export paths; repeat on the deferred TypeScript UI later. Never use real secrets as fixtures.

### V-20 — Mandatory domain controls and overlapping accounts — NOT RUN

- **Setup/input:** Financial fixtures expose the same account/asset through two connectors alongside generic HTTP, SQL, shell, and MCP capabilities.
- **Challenge:** Reach an order endpoint generically, rename its classification, add an unrelated capability, duplicate balances/fills, or remove a connector with positions and charges remaining.
- **Expected:** Investment effects require the domain path and current authority; canonical exposure/costs reconcile without duplication. Installation creates no purpose fit, resource case, or permission.
- **Recovery:** Retain obligations and a bounded authorized reconciliation path after removal; distinguish acceptance, fill, valuation uncertainty, and settled consequences.
- **Level:** F financial effects plus R routing/credential restrictions. This case authorizes no live financial connection or trade.

### V-21 — Technical evidence cannot certify economic or AI value — NOT RUN

- **Setup/input:** Supply favorable, null, negative, and contradictory evaluation fixtures alongside rising whole-firm costs and owner capital/withdrawal records.
- **Challenge:** Improve an internal score, add agents, substitute deterministic work, wait/reduce activity, or remove an evaluator while seeking further allocation or retirement.
- **Expected:** Keep AI-led operation, owner outcomes, AI contribution, conditional earning ability, and next allocation case distinct. Neither traces nor majority agreement certify profit, independent evaluation, or justified continuation.
- **Recovery:** Preserve candidate/active history, costs, evidence, and decision rationale; stopping/replacement/new funding cannot erase obligations. Retirement remains sovereign; no return benchmark or strategy is invented here.
- **Level:** F semantic/projection cases and document review, later R evidence access. Real economic validity needs separately authorized connected live operation and appropriate evaluation.

### V-22 — Clock changes, VM sleep, and restored time — NOT RUN

- **Setup/input:** Record grants, claims, wakes, usage, independent guard arming and hard `CLOCK_BOOTTIME` deadline, and separate staging/publication intents with immutable input/commit observations before Mac sleep or VM restore.
- **Challenge:** Suspend host/guest beyond validity, change wall time, attempt guard deadline extension, replay snapshots/heartbeats and duplicate wakes, and lose either staging/publication commit response across sleep/restore; retry each uncertain intent independently.
- **Expected:** Measure actual guest BOOTTIME and host elapsed behavior; Mac sleep/VM pause cannot be claimed to provide real-time termination while unscheduled. On resume, uncertain validity blocks dependent use and old claims cannot revive. Preserve phase-specific uncertainty/evidence gaps; staging or missing acknowledgement proves no publication status.
- **Recovery:** Re-establish current control, fence prior generations, and reconcile resources, elapsed obligations, and each original staging/publication effect before retry. A committed publication with a lost response must not become a fresh publication; dependent work waits where validity remains unresolved.
- **Level:** F clock schedules plus R Lima VZ host sleep and backup/restore. If native snapshots are unsupported, report that limit and exercise disk/state restoration; fresh Linux deployment needs its own evidence.

### V-23 — Measured overhead and bounded performance — NOT RUN

- **Setup/input:** Freeze the Rust API/CLI/backend build, host/VM resources, operation mix, payload/result sizes, duration, concurrency, warm/cold state, and finite CPU/memory/disk/log/cost caps. Use controlled model/MCP responses, named DB operations, artifact traffic, and authenticated inspection/restriction requests.
- **Challenge:** Compare mediated operations with an authorized trusted test-driver baseline against the same controlled backends; exercise finite load steps, slow consumers/backpressure, saturation, denied requests, and concurrent control operations. Never create a private bypass or disable enforcement to improve the measurement.
- **Expected:** Report sample counts, p50/p95/p99 admission/forwarding/end-to-end latency and attributable overhead, successful/denied throughput, queue depth, memory, errors, and dropped/blocked work. Retain actual effects and all authorization/commitment/guard/evidence invariants under load; expose control delay and resource exhaustion rather than hide failed samples.
- **Recovery:** Drain or restrict bounded work, reconcile in-flight effects and cost, and verify API/CLI inspection/restriction remain attributable during recovery. Record baseline differences and measurement uncertainty; performance does not set a return target, capital allocation, or invented production SLO.
- **Level:** F repeatable workloads on R complete boundary, actual PostgreSQL/guard/bridge and API/CLI; provider latency/cost claims require separate P evidence. This case and any future UI performance extension remain NOT RUN.

## Persistent Storage and Recovery Qualification

V-24 through V-38 extend the earlier cases with persistent-storage and environment-binding boundaries.
All remain **NOT RUN**. Existing local component PASS results below do not qualify these paths.
Future runs use disposable, explicitly bounded test volumes and data; permission to test the
product does not authorize destructive faults against the owner's live SSD, worktrees, or records.
Record host volume/store identities, guest filesystem identities, writer generations, storage
profile, capacity reservations, catalog holds, content references, recovery-set identities, and
independent physical observations where applicable. Missing required storage/retention settings
leave dependent operations unavailable; this document does not choose their numeric values.

### V-24 — Company storage survives checkout and executor retirement — NOT RUN

- **Setup/input:** In an isolated test deployment, publish input/result artifacts, a prepared DB result and receipt, protected Core observations, and permitted native continuation material. Record stable firm/store/work identities and the development checkout, replaceable guest disk, and actual instance separately.
- **Challenge:** Remove only the disposable development checkout and build cache, terminate the instance, and rebuild the replaceable guest OS/container installation. Attempt to infer persistent-storage retirement from any of those deletions.
- **Expected:** Company manifests, receipts, unresolved obligations, retained content, and recovery references retain their original identities outside those lifetimes. Developer cleanup cannot invoke company GC. A private scratch file never published is reported as local/unretained, not retrospectively promoted to a company artifact.
- **Recovery:** Reattach the verified existing state/content store in restricted startup, reconcile current authority and effects, and bind a fresh instance before materializing authorized inputs. Checkpoint access is reauthorized separately from compute access.
- **Pass criteria:** The API/CLI can locate and verify the same retained company records and content after each replacement, without resurrecting old authority or using a private host mount. Lost local scratch and any missing required evidence are explicit.
- **Level:** R actual checkout, guest-installation, instance, PostgreSQL, and content-store lifecycles; F prepared company work only. No removal of an unrelated checkout or the owner's active storage.

### V-25 — Missing, replaced, or cloned storage identity — NOT RUN

- **Setup/input:** Bind a disposable deployment to explicit host volume, persistent store, guest filesystem, and writer-generation identities. Record the expected mount and opened storage-root binding separately from its human-readable path.
- **Challenge:** Start with the SSD absent; replace its path with an ordinary directory, symlink, or different volume; mount a copied store with familiar labels/identifiers; and replace or reconnect the mount while handles are open.
- **Expected:** A path, label, content digest, or copied store identifier cannot establish the active binding or current authority. Missing/mismatched storage blocks dependent readiness and admissions. The supervisor must not create a replacement runtime directory or data disk on the internal SSD, select another volume, or silently trust a cloned generation.
- **Recovery:** Revalidate the actual mounted and opened objects, quarantine copied/restored state, fence retired bindings, and follow current-authority recovery. A reconnected device does not automatically clear I/O uncertainty.
- **Pass criteria:** Every substitution is detected before dependent access resumes, with identity/mount observations and denials retained where durable recording remains possible; host inspection proves no fallback persistent writes occurred.
- **Level:** R actual APFS mounts, guest attachments, open-handle behavior, and supervisor bindings plus F cloned identity records. Device removal faults use the isolated storage fixture.

### V-26 — Backing capacity and state/content isolation — NOT RUN

- **Setup/input:** Record the runtime APFS reserve/quota, sibling development-volume use, actual host backing availability, fixed guest state/content capacities, replaceable OS/container bound, scratch quota, and configured evidence/WAL/temp/log/staging allowances. Set finite pressure and stop bounds.
- **Challenge:** Grow sibling build data while the guest reports apparent free space; separately fill content, scratch, OS/container storage, protected state, and the bounded spool. Include sparse-image growth, host-volume quota rejection, missing/stale capacity observations, and simultaneous admitted uploads.
- **Expected:** Core reservations, worker byte accounting, and host/guest measurements remain distinguishable. Content/scratch growth cannot consume the fixed state filesystem or bypass the actual runtime reserve/quota. New dependent growth is denied when usable backing capacity or required evidence headroom is unavailable/unknown; state exhaustion is not reported as unlimited control availability.
- **Recovery:** Restrict affected activity, preserve unknown effects and committed records, perform only authorized eligible cleanup, and remeasure both host and guest before readmitting work. Expose the precise evidence gap if even the bounded protected recording path fails; do not spill to the internal SSD.
- **Pass criteria:** Physical observations confirm each claimed allocation boundary, configured consumption bounds, and denial behavior. Record control/restriction latency and any unavailable functions under each pressure source. Apparent raw-disk size or a successful reservation alone is insufficient.
- **Level:** R APFS allocation, ext4 filesystems, PostgreSQL/log/spool pressure, and runtime quotas with F bounded producers. No whole-device fill against unrelated owner data.

### V-27 — Concurrent staging reservations and identical content — NOT RUN

- **Setup/input:** Provide 100 normalized units of available staging allowance and submit two distinct upload intents each declaring 70 units, including a variant with the same content digest. Also submit same-key/same-input and same-key/changed-input requests under the same and different current scopes.
- **Challenge:** Race admission, stream partial bodies, disconnect uploaders, retry matching keys, and delay usage/deletion observations. Attempt to count identical digests as one reservation before physical reuse and scope eligibility are established, or to reuse another scope's verified content by digest alone.
- **Expected:** The shared 100-unit allowance cannot admit two outstanding 70-unit commitments. Stable-key replay identifies the original operation without a new allowance; changed input conflicts. Distinct intents and ownership remain distinct even when bytes match. Any qualified physical reuse is separately recorded and cannot erase in-flight staging, evidence, or logical obligations.
- **Recovery:** Reconcile actual content, receipts, and remaining holds under the original intents before releasing capacity. An expired uploader or matching digest cannot release an uncertain reservation or grant access.
- **Pass criteria:** Transaction and physical-byte evidence show no over-admission, cross-scope disclosure, duplicate effect from matching-key replay, or premature release in every ordering.
- **Level:** F deterministic orderings on R Core/catalog transactions and bounded streaming workers; repeated actual concurrent admission, not a mocked counter alone.

### V-28 — Publication and garbage collection serialize — NOT RUN

- **Setup/input:** Prepare an eligible immutable object and a publication referencing it, plus an authorized GC candidate for the same catalog object/generation. Record current manifest, durable holds, policy, and expected revision.
- **Challenge:** Pause publication after content verification but before metadata commit; race GC selection, deletion marking, and byte removal. Repeat with GC first, publication first, and a crash at each transition.
- **Expected:** Publication and GC serialize through the same catalog object's protected lifecycle. GC cannot remove content after a compatible publication/hold commits; an object marked for deletion cannot acquire a new manifest or hold. The publication receipt and manifest remain one metadata transaction, and byte availability is independently checked.
- **Recovery:** Locate the original publication receipt and durable deletion decision. Retain uncertain objects; reconcile interrupted physical removal without inventing another publication or silently making a deleting generation reusable.
- **Pass criteria:** Each ordering produces a valid retained publication or an explicit conflict/unavailable result. No committed, required manifest points to content removed by a successful concurrent GC operation.
- **Level:** F controlled lock/crash schedules on R catalog transactions and filesystem operations, including the verification-to-commit race.

### V-29 — Cross-store content holds survive partial commits — NOT RUN

- **Setup/input:** Make a Core work/evidence record, a recovery continuation, and a backup set each depend on catalog content through separately attributable durable holds. Establish explicit owner/reference and release authority for each hold.
- **Challenge:** Crash after catalog hold creation but before the dependent Core record commits, lose the hold acknowledgement, make Core unavailable, expire leases, and crash before or after a durable authorized release. Race hold acquisition/release with GC.
- **Expected:** Required catalog protection exists before a dependent durable reference becomes eligible. An uncertain handoff leaks a retained hold rather than permitting evidence loss. Only an authenticated, authorized durable transition can release its own hold; unavailable Core, missing worker, deadline expiry, or worktree deletion is not release evidence.
- **Recovery:** Reconcile by original hold owner/reference and generation using surviving durable records. Repeated creation/release is idempotent; unreachable or contradictory owners remain held and visible for bounded investigation.
- **Pass criteria:** Every surviving dependent record retains usable content; no crash window permits collection of a required object. Orphaned holds and their capacity are visible until an explicitly justified release completes.
- **Level:** F cross-store failure schedules on R Core/catalog storage and file worker, including actual process replacement and GC concurrency.

### V-30 — Resource commitment survives loss of Core acknowledgement — NOT RUN

- **Setup/input:** Execute upload verification, publication, and the prepared DB mutation as separate intents with fixed input, current dispatch claims, protected resource receipts, and Core reservations.
- **Challenge:** Commit the resource outcome and lose its notification or Core acknowledgement; replace the worker, deactivate the target, revoke caller write authority, and issue matching/changed-key lookup or retry requests.
- **Expected:** The original protected receipt identifies the actual effect and fixed input independently of Core delivery. Unresolved Core state preserves responsibility, holds, and commitments. Current scoped reading may retrieve an existing result from an inactive target without new dispatch; neither replacement nor a missing acknowledgement creates a fresh effect or restored write authority.
- **Recovery:** A separately authorized reconciler verifies the original resource receipt and reports it into the original Core intent. Where that recovery path is unimplemented, retain the unresolved condition rather than report acceptance passed.
- **Pass criteria:** Exactly one publication revision or DB result exists for the original intent, Core records reconcile to it without new effectful execution, and denied/currently authorized disclosure is correct. Missing reconciliation functionality fails this case despite earlier receipt-library PASS results.
- **Level:** R file/catalog/company/Core transactions and replacement workers with F lost-message schedules; actual provider calls are unnecessary.

### V-31 — Object retirement, removal generations, and physical reclamation — NOT RUN

- **Setup/input:** Select a policy-eligible, unreferenced object with an attributable deletion decision and generation. Retain another object through a manifest/hold and create a controlled APFS snapshot that preserves previously allocated backing blocks.
- **Challenge:** Crash before/after deletion marking and physical removal; rerun stale collector work; introduce identical content under a newly verified lifecycle; and attempt to free host capacity while the snapshot or another filesystem reference still retains blocks.
- **Expected:** A stale deletion task cannot remove a new generation or referenced object. Logical retirement, confirmed file removal, and measured guest/host physical reclamation are separate outcomes. Snapshot-retained blocks and unconfirmed removals remain reflected in actual capacity; a deletion receipt is not a promise of reclaimed SSD bytes.
- **Recovery:** Reconcile the exact immutable object/generation and filesystem observation before confirming removal. Repeat only that authorized deletion; never delete snapshots, new objects, or other references as an implicit extension of the task.
- **Pass criteria:** Crash/replay produces no deletion outside its fixed object generation, and accounting exposes any difference between logical release and physically usable capacity without over-admission.
- **Level:** R catalog/filesystem deletion and actual APFS snapshot/backing-space observations with F stale-worker delivery. No assumption that guest deletion automatically punches holes in the backing image.

### V-32 — Explicit retirement, archives, and evidence retention — NOT RUN

- **Setup/input:** Classify current manifests, unresolved effects, material positive/negative evidence, retired work, expired continuation material, orphan staging, and reproducible developer cache. Configure attributable retention/release policy and an authorized archive destination where applicable.
- **Challenge:** Attempt blanket age-based cleanup, infer retirement from process/worktree deletion, expire a policy without required values, change the policy without authority, and request local removal after only a digest or an unverified archive copy remains.
- **Expected:** Unresolved obligations and required content survive unrelated cleanup. Artifact access, work retirement, hold release, archival verification, and deletion are separate authorized facts. Archive eligibility requires the retained content and metadata to be retrievable and verified; research source notes excluded from Git do not exempt material operational evidence.
- **Recovery:** Preserve candidates whose eligibility is uncertain, restore required references where possible, and report missing evidence or unavailable archives. If a policy legitimately ends checkpoint retention, subsequent recovery must state that continuation material is unavailable rather than claim full restoration.
- **Pass criteria:** The decision, policy revision, remaining references, archive verification where used, and final deletion outcome are traceable for each candidate; no automatic deletion is justified solely by age, expired lease, or a free-space emergency.
- **Level:** F policy/reference permutations on R catalog/authorized maintenance paths and archive reads. No invented retention duration or financial materiality threshold.

### V-33 — SSD loss across file, database, and Core durability boundaries — NOT RUN

- **Setup/input:** Use an isolated disposable external-storage fixture with admitted operations paused at staging write/durability, catalog manifest/receipt commit, company result/receipt commit, Core observation commit, and response delivery. Record independent host and guest observations and finite fault limits.
- **Challenge:** Inject I/O errors and controlled disconnects at each boundary, including open files/DB transactions and a returned application-level success; reconnect the same device or a mismatched replacement. Include filesystem read-only recovery and an unavailable protected spool.
- **Expected:** No durable success is asserted from a mere write return or missing error. Previously confirmed commitments are checked against recovered storage; corruption, missing content, and uncertain outcomes remain explicit. New dependent dispatch is restricted; runtime containment follows its existing profile, without claiming real-time control when the guest cannot run.
- **Recovery:** Keep storage and ordinary execution restricted, verify device/store identity, recover the database/filesystem, and reconcile original receipts and references. Ingest any independently retained bounded incident evidence without treating it as new authority. No internal-disk fallback or silent reinitialization is allowed.
- **Pass criteria:** Each fault boundary either preserves the claimed durable effect or records its demonstrated durability/integrity failure and leaves the profile ineligible. Client success, reconnect success, and a booted VM alone cannot pass the case.
- **Level:** R actual host/guest/filesystem/database durability and disconnection behavior, with F repeatable I/O faults. Corroborate device/bridge flush limitations; do not perform destructive unplug tests on the owner's live store.

### V-34 — Coherent cold backup and verified independent restore — NOT RUN

- **Setup/input:** Prepare the first-profile cold backup by denying ordinary workload mutations/dispatch and GC, completing authorized backup holds and final observation writes, then quiescing all writers or preserving their explicit unresolved outcomes, capturing the participating boundary, and stopping PostgreSQL and the VM. Inventory the complete cluster, catalog/content, required configuration/build identities, protected recovery material, and all required content references. Enroll encrypted, access-controlled copy/staging and rehearsal destinations with separately protected recovery keys.
- **Challenge:** Try to back up with a live writer, omit/corrupt a referenced blob or store, mismatch generations, interrupt the copy, and place the recovery copy on another path/volume of the same SSD. Attempt an unencrypted copy outside the source encrypted volume, an unprotected cross-host transfer, and restore without authorized key recovery. Restore an otherwise complete set into an isolated restricted destination.
- **Expected:** The copy has a verifiable coherent boundary and completion record; partial or mismatched sets cannot be labeled recoverable. Every required referenced object is independently verified offline. A same-device copy/snapshot is labeled local recovery material and cannot establish resilience to loss of that SSD; that claim requires a separate physical failure domain.
- **Recovery:** Retry or replace only the incomplete recovery copy while retaining the source and backup holds. Start PostgreSQL only in the isolated restricted rehearsal after offline set verification, then compare restored manifests/receipts and expose missing content. Restored state stays quarantined for V-35.
- **Pass criteria:** A complete cold set actually restores all required stores and references, including unresolved records, and the recorded destination supports the failure-domain claim made. Encryption/access protection covers all materialized copies and transport; separately protected recovery keys are usable by the authorized recovery owner. Independently successful file/database copy commands or source-volume encryption alone do not pass.
- **Level:** R writer shutdown, physical copy, independent destination verification, and isolated restore plus F omissions/corruption. Backup creation and cleanup obey their own current authority and space bounds.

### V-35 — Old backups, surviving predecessors, and current authority — NOT RUN

- **Setup/input:** Capture a coherent backup, then record a later revocation, writer retirement, committed effect/cost, and configuration change. Retain the original deployment as a controlled live predecessor. Record host-local recovery-anchor information separately from the rollback set.
- **Challenge:** Restore the old set, clone both anchor and store, remove the anchor, replay queued intents/tokens/checkpoints, and attempt to activate a successor while the predecessor remains reachable or its effectful access is unconfirmed.
- **Expected:** Every restored set starts restricted regardless of familiar IDs or anchor contents. An anchor identifies lineage and last observed watermarks but neither proves absence of later effects nor grants authority. Old queues, cached grants, and native sessions cannot dispatch. Missing/untrustworthy freshness or predecessor fencing blocks dependent activation.
- **Recovery:** Establish current authority through surviving trustworthy records or the applicable authorized decision; observe fencing of predecessor credentials, instances, and effectful paths; reconcile newer external effects and obligations. Bind the successor freshly only after its actual prerequisites are satisfied.
- **Pass criteria:** No simultaneous unfenced effectful writers or revived old authority occurs in any ordering. The restored timeline preserves known later effects and explicitly unknown intervals; host possession, restored generation counters, and absent predecessor heartbeat never substitute for the required proof.
- **Level:** R two isolated deployment identities, credential/instance fencing, backup restore, and API/CLI recovery with F external-effect timelines. No autonomous recovery of sovereign identity is introduced.

### V-36 — Storage restart and suspension do not restore stale eligibility — NOT RUN

- **Setup/input:** Run bounded reads/uploads and receipt reporting with current mount/store binding, writer generation, claims, reservations, independent guard, and host/guest time observations. Include a controlled dirty shutdown and a native continuation referencing retained content.
- **Challenge:** Restart individual services and the host/guest; suspend beyond claim/guard validity; reconnect/remount the SSD while paused; alter wall time; and replay old readiness observations, tokens, outbox work, or receipt notifications after resume.
- **Expected:** Readiness distinguishes process health, verified storage, current writer binding, authority, and recovery completion. Paused execution supplies no claim of real-time termination. Mount/clock discontinuity invalidates dependent stale eligibility; committed receipts and unresolved obligations retain their original identity through restart.
- **Recovery:** Verify actual mount and filesystem identities, recover stores in restricted order, fence previous generations, re-establish trustworthy time/current authority, and reconcile each original intent. Load continuation content only after fresh input authorization; never renew an old deadline by reconnecting a bridge.
- **Pass criteria:** Ordinary dispatch remains blocked until each required check is evidenced, with no duplicated committed effect or concealed observation gap. Report actual host/guest elapsed and termination behavior rather than infer it from configuration.
- **Level:** R recorded Mac/Lima storage, restart, suspension, and guard behavior with F delayed/replayed observations. Host sleep tests require an isolated user-approved disturbance window.

### V-37 — Storage secrets, private escape, and bounded streaming scope — NOT RUN

- **Setup/input:** Seed controlled secret canaries in restricted recovery/native material and authorize two disjoint company scopes. Exercise the binary file path within its explicit target limits; keep executable bundles, larger native sessions and bulk backup probes separate from bounded file transfer tests.
- **Challenge:** Attempt raw host/guest mounts, DB/socket access, traversal and symlink/hardlink escapes, digest-only cross-scope reads, direct archive access, and secret-bearing diagnostics/exports. Include intermediate backup and rehearsal copies and attempts to obtain their decryption keys from the same export or private environment. Submit oversized, malformed, binary, slowly streamed, interrupted, and falsely sized content through the applicable public route.
- **Expected:** Private requests remain Gateway-mediated with current content scope; storage paths, digests, backup copies, and session materials create no alternate authority or credential channel. Unsupported content is rejected with bounded consumption. Any supported streaming path enforces admitted byte limits, backpressure, verification, and separate publication without disclosing protected material.
- **Recovery:** Retain sanitized attributed denials and any uncertain partial upload under its original intent/hold; do not publish rejected content or silently transform the payload to claim support. Reconcile and clean staging only under the established lifecycle rules.
- **Pass criteria:** Current fixture behavior meets its actual supported limit and access contract with no escape or secret disclosure. A 64 KiB UTF-8 fixture PASS does not qualify large binary artifacts, bulk backup throughput, sustained streaming, or native sessions of greater size; those claims require their own measured supported-path evidence and remain NOT RUN here.
- **Level:** F malicious/canary/size corpus on R Gateway, file worker, filesystem/process boundaries, and protected export paths. Record implemented versus unavailable transfer capability explicitly.

### V-38 — Environment injection without authority or path leakage — NOT RUN

- **Setup/input:** Prepare two isolated disposable deployments using the same product binaries and logical resource contracts, with different injected storage/build/test/IPC roots, volume labels, VM aliases where applicable, listener addresses, credential references and finite limits. The trusted runner resolves filesystem inputs from each explicit configuration directory; each environment has separately verified storage identities. Keep fixture data apart from any live store.
- **Challenge:** Start from an unrelated CWD, remove each required input, inject conflicting or unknown settings, poison ambient Docker/home settings, rename a mount without updating the approved binding, and submit private requests attempting to replace storage roots or endpoints. Try a configuration edit after activation and a path alias that could bypass a shared limit. Inspect source, example configuration, ordinary API output and public evidence exports for personal paths/account or volume labels.
- **Expected:** The same implementation operates from either accepted binding without source edits or fallback paths. Only the trusted configuration owner can prepare changes; current authorization, identity/capacity validation and activation still apply. Missing or conflicting settings fail before dependent effects or unexpected directory/database creation. Existing instances/attempts do not silently retarget. Logical company/artifact identities and obligations remain independent of physical locators.
- **Recovery:** Correct the explicit candidate, validate and activate a fresh binding through the existing control path, then reconcile/fence before resuming affected work. Restore historical content under current access if required. Preserve original restricted evidence and export only an attributable sanitized projection; do not rewrite history to conceal a configuration failure.
- **Pass criteria:** Both bindings complete the supported fixture flow with the same binaries and no personal source/default path, unsolicited fallback, authority expansion or loss of required separation. CLI/native/bridge/worker endpoints and TLS identities derive consistently from the selected binding. A passed Mac profile does not qualify another OS/backend; each supported profile supplies its own enforcement evidence.
- **Level:** F invalid/ambiguous input and export corpus on R configuration consumers, Runtime/bridge roots, resource storage and API/CLI; alternate backend qualification remains distinct. Current fixed-path fixture runs do not pass this case.

## Requirement Coverage and Review Completion

| Requirement and architectural invariant | Owning documents | Cases |
| --- | --- | --- |
| One firm, public/private responsibilities, sovereign authority, no new product objective | [Architecture](../../ARCHITECTURE.md), [Contracts](CONTRACTS_AND_STATE.md) | V-01–02, V-20–21 |
| Shared Gateway, authenticated delegation, human credential proof/consent, single-use challenges and no service/admin identity laundering | [Gateway](GATEWAY.md), [Core](CONTROL_CORE.md), [Contracts](CONTRACTS_AND_STATE.md) | V-01–02, V-10, V-17 |
| Real custom-provider/native path qualification including zero settings, connection/stream/auth/fallback failures, distinct calls, named DB receipts and controlled MCP | [Runtime](RUNTIME.md), [Resources](RESOURCE_SERVICES.md), [Gateway](GATEWAY.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md) | V-03, V-05, V-07, V-09, V-18 |
| network=none, netns-only bridge, fixed UDS, actual process/generation/token binding, descendant and host/data isolation | [Runtime](RUNTIME.md), [Gateway](GATEWAY.md), [Resources](RESOURCE_SERVICES.md) | V-02, V-04–05, V-12 |
| Aggregate/ancestor budgets, canonical resources, late costs, no session-created allowance | [Core](CONTROL_CORE.md), [Contracts](CONTRACTS_AND_STATE.md), [Resources](RESOURCE_SERVICES.md) | V-06–07, V-09, V-20 |
| Private-origin work, durable scheduling, duplicate callbacks and lifecycle responsibility | [Core](CONTROL_CORE.md), [Runtime](RUNTIME.md) | V-03, V-08–09, V-22 |
| Intent/attempt distinction, inactive-target historical lookup, native invocation versus JSON key, dispatch cutoff, stop/revocation and no fresh-ID successor bypass | [Contracts](CONTRACTS_AND_STATE.md), [Gateway](GATEWAY.md), [Resources](RESOURCE_SERVICES.md) | V-09–12 |
| Protected control/evidence versus operational data, authorized initial materialization, working copies and cross-store durability | [Core](CONTROL_CORE.md), [Resources](RESOURCE_SERVICES.md) | V-05, V-13, V-16, V-18, V-22 |
| Rust API/CLI first, deferred TypeScript UI, commit-ordered repeatable-read snapshot/SSE continuity, current read scope and bounded control access | [Observation](OBSERVABILITY_AND_CONSOLE.md), [Core](CONTROL_CORE.md), [Gateway](GATEWAY.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md) | V-01, V-07, V-14–16, V-19, V-21, V-23 |
| Armed bootstrap, independent fixed-target kill FD, nonextendable BOOTTIME deadline, EOF/pressure/log-full/sleep and restore limits | [Runtime](RUNTIME.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md) | V-09, V-12–16, V-22–23 |
| Scoped adapters, registry versus activation, semantic replacement, independent change evaluation | [Resources](RESOURCE_SERVICES.md), [Core](CONTROL_CORE.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md) | V-02, V-16–17, V-19–21 |
| Whole-firm costs, capital flows, learning versus further allocation, AI/profit distinctions and exit | [Architecture](../../ARCHITECTURE.md), [Observation](OBSERVABILITY_AND_CONSOLE.md) | V-07, V-20–21 |
| Measured latency percentiles/overhead, throughput, memory and backpressure with authorized control under bounded load | [Gateway](GATEWAY.md), [Runtime](RUNTIME.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md), this document | V-12, V-14–16, V-23 |
| Company store identity and persistence independent of checkout, cache, instance, and replaceable guest installation | [Contracts](CONTRACTS_AND_STATE.md), [Resources](RESOURCE_SERVICES.md), [Runtime](RUNTIME.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md) | V-24–25, V-36 |
| Actual runtime APFS reserve/quota, fixed state/content isolation, backing capacity and bounded staging/scratch/evidence | [Core](CONTROL_CORE.md), [Resources](RESOURCE_SERVICES.md), [Runtime](RUNTIME.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md) | V-26–27, V-31, V-33 |
| Durable content holds, publication/GC serialization, explicit retirement and archive eligibility, removal generation and confirmed reclamation | [Contracts](CONTRACTS_AND_STATE.md), [Core](CONTROL_CORE.md), [Resources](RESOURCE_SERVICES.md) | V-28–32 |
| Cross-store receipts and unknown effects survive acknowledgement loss, SSD failure, and storage recovery | [Core](CONTROL_CORE.md), [Resources](RESOURCE_SERVICES.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md) | V-29–30, V-33–36 |
| Coherent cold backup, independent physical recovery copy, untrusted rollback state, predecessor fencing and current-authority recovery | [Contracts](CONTRACTS_AND_STATE.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md) | V-25, V-34–36 |
| Secret-safe evidence/archive access, no private storage bypass, and measured transfer capability beyond the bounded fixture | [Gateway](GATEWAY.md), [Resources](RESOURCE_SERVICES.md), [Observation](OBSERVABILITY_AND_CONSOLE.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md) | V-19, V-32, V-37 |
| Explicit injectable environment binding, no personal paths/default discovery, unchanged authority and sanitized public evidence | [Architecture](../../ARCHITECTURE.md), [Contracts](CONTRACTS_AND_STATE.md), [Deployment](INTEGRATION_AND_DEPLOYMENT.md), [Observation](OBSERVABILITY_AND_CONSOLE.md) | V-24–25, V-37–38 |

Document review checks this coverage against the governing sources and component contracts; it
does not turn NOT RUN into PASS. Future reports attach evidence and limits to each case and profile,
retain failures and unresolved effects, and identify any untested provider or deployment path.
Control conformance, private operating performance, and connected actual outcomes remain separate
verification responsibilities. Public source does not certify deployed enforcement; successful
outer tests do not establish AI contribution, profitability, or a case for more owner capital.

## Persistent Storage and Environment Design Review

Independent source and failure reviews checked this storage extension and the environment-binding
contract. The final review found no remaining material contradiction in its examined scope after
clarifying failed-staging retirement, workspace-before-object locking, preparation-only backup
holds, ordinary-write cutoff before final maintenance, copy/rehearsal encryption and restricted
cold restore. Configuration preparation, validation and activation remain separate; an injected
path or endpoint conveys no authority. Mac/APFS/Lima choices are a reference profile.

The current implementation inspection found no personal username/home/volume path in crates,
scripts, deployment examples, Cargo manifests, README or AGENTS. It did identify literal fixture
roots, backend endpoints and build assumptions, recorded in
[Deployment](INTEGRATION_AND_DEPLOYMENT.md#existing-fixture-injection-gaps). They are implementation
work, not evidence that environment injection already passes. No runtime code or deployment
configuration was changed for this design extension.

Local checks covered all eleven entry/detail documents: relative links/anchors, table widths,
fenced diagrams, whitespace/newlines and conflict markers, plus the repository's required-file
and tracked-secret-path rules. The design/source/example scan found no personal host or volume
path. Pre-change hashes confirmed changes only to the architecture entry and six existing detail
documents; other implementation work was preserved. Research remains Git-ignored. Diagram checking
was structural, not a renderer run. These are document checks, not hosted CI or runtime tests.

V-24 through V-38 remain **NOT RUN**, including real storage disconnect/durability, capacity,
deletion races, independent restore and alternate environment binding. No media was reformatted,
migrated or activated; no keys, model calls, commits or publication were created by this review.

## Completed Document Review

The following historical results apply to the earlier V-01 through V-23 documentation-only change,
before local implementation and before the persistent-storage extension above. They do not record
review or execution of V-24 through V-38. Separate reviewers checked the
written contracts and the identified corrections; they did not run the proposed system. All
V-01 through V-23 runtime cases remain NOT RUN. Review completion does not establish architecture
adoption, authorize runtime deployment, or qualify any native provider or isolation profile.

| Review or check | Result and practical limit |
| --- | --- |
| Responsibility and first-work closure | Independent review traced API/CLI admission, actual instance binding, files/model/DB/MCP, upload/publication, inspection, stop/revocation, and successor recovery. No remaining material responsibility or authority contradiction was identified. Private work selection and economic judgment remain private. |
| Identity and control corrections | Closed credential-manager impersonation using target-human authentication/consent and single-use new-key proof. Kept instance stop, credential cutoff, and delegation revocation separate. Reviewers rechecked the correction and its acceptance cases. |
| Request, storage, and replay corrections | Existing-key lookup precedes new-target activation checks; current read permission still applies. Worker RPC scope includes assigned claims and scoped observations. Snapshot and change positions share a commit boundary. Protected DB/result and publication/manifest receipts have explicit owners and transaction boundaries. The identified inconsistencies were resolved and rechecked. |
| Runtime and native qualification | Specified Rust CLI, fixed Docker endpoint, netns-only bridge, armed independent kill-FD guard, and immutable deadline. Native method mappings and retry limitations are explicit; settings alone do not prove absence of automatic replay. Shared-kernel, Mac/VZ time, guard scheduling, and production-support limitations remain qualification conditions. |
| Scope and preservation | The architecture entry and eight existing detailed documents were refined. README, AGENTS, and the research exclusion were preserved from the starting local proposal. Governing source bodies and the integrity workflow are unchanged. No executable API/schema, runtime, deployment configuration, credential, commit, or publication was created. |
| Local research boundary | Research notes remain ignored and untracked; prior local research content was preserved. The eleven public-facing documentation files contain no relative dependency on those local notes. Operational evidence retention is a separate runtime responsibility and remains required. |
| Repository integrity and whitespace | All eight required files are nonempty; tracked paths pass the existing secret-file prohibition. `git diff --check` and whitespace/newline checks on the entire document bundle pass. These are local checks, not a GitHub CI run. |
| Markdown and diagrams | Relative file links and anchors, table widths, fenced blocks, conflict markers, and unresolved placeholders pass static checking. Three Mermaid diagrams received structural and cross-component flow review; a Mermaid renderer was not executed. |
| Future acceptance coverage | V-01 through V-23 each specify input, fault/challenge, expected records, recovery, and evidence level. Credential proof, snapshot races, inactive-target lookup, native retry paths, and bounded performance were included in independent revalidation. Every runtime case remains NOT RUN. |

That review closed the first connected implementation's document design at that stage. Real native compatibility,
isolation, effective deadlines/revocation, recovery, costs, and performance require the recorded
reference-profile runs during separately authorized implementation. A failed required boundary
leaves that profile unusable; it cannot be repaired by silently weakening authority or isolation.


## Local Implementation Evidence

This and the following implementation-result sections are cumulative historical evidence.
Their exact commands and counts describe the recorded source/profile at that checkpoint. Use
the [current executable checks](#responsibility-based-executable-checks) for present reproduction;
in particular, the earlier `--ignored` and per-store resource URL setup below have been replaced
by feature-gated, independently prepared disposable database suites.

The owner authorized local implementation without PR publication. The Rust workspace is an
incomplete first connection. The evidence below records component runs, not an independent
implementation review or acceptance of the connected product. Tests using controlled responses
made no real provider calls and establish no subscription compatibility. Full V-01–V-23 acceptance
remains NOT RUN until every required path and challenge is implemented and exercised.

| Implemented surface and reproducible test | Observed result | Remaining boundary |
| --- | --- | --- |
| Core PostgreSQL transactions: `cargo test -p ouroboros-core --test control --locked -- --ignored` with the explicit disposable DB URL file | Three tests passed against PostgreSQL 18.6: concurrent 70/70 against 100, stable-key replay/conflict, ancestor revocation, single dispatch claim, retained reservations, current result-read authority | Hierarchical numeric budgets, live Runtime dispatch, credential lifecycle, full cutoff races and recovery remain incomplete |
| Resource receipts: `cargo test -p ouroboros-resources --test receipts --locked -- --ignored` with distinct company/catalog test URL files | Result and receipt commit together; concurrent replay produces one effect; publication revision and receipt survive worker replacement; changed input and corrupt content are rejected | These are worker libraries, not connected Gateway resource routes; production credential roles and whole-work recovery remain unqualified |
| `tests/contracts/test-api-cli.py` following synthetic fixture preparation | Real Rust mTLS Gateway/Core/CLI plus guest PostgreSQL: unregistered certificates denied, direct human Core access denied, forged identity header replaced, reservation race bounded, SSE/current-cursor checks, stop and grant revocation distinguished | No private instance ran through this API. `runtime_ready` stays false; acceptance is not execution success |
| `tests/integration/test-runtime-guest.py` in the dedicated guest | Two network-none instances used distinct bridge peer credentials; bridge shared only netns; direct tested routes failed; armed fixed-deadline guards wrote kill and independent observation confirmed termination | This is a trusted qualification driver, not the production Runtime Manager. PID reuse, supervisor failure, pressure, all bypass vectors and Mac sleep remain NOT RUN |
| `tests/integration/test-codex-guest.py --mode shell --sandbox-policy externalSandbox` with the pinned fixture image | Actual Codex 0.153.4 used native `exec_command` to read fixture input; two controlled Responses requests carried the native tool result across the bound bridge | Model response was synthetic. File delivery used the trusted test driver, not the product file API; DB/MCP/publication/steer/resume were not part of this run |
| `tests/integration/test-codex-guest.py --mode unauthorized --sandbox-policy externalSandbox` | Actual Codex failed the turn after one controlled 401 response, with no provider credential inside the instance | Connection failures, interrupted streams, auth refresh, fallback and real subscription behavior require distinct tests |

The failed nested `workspaceWrite` experiment is retained as a failed profile: the original
fixture lacked bwrap; after adding the official companion, namespace creation was denied. The
working candidate explicitly uses the documented `externalSandbox` policy. Docker network-none,
non-root user, read-only root, dropped capabilities, no-new-privileges, default seccomp, bridge
and armed guard remained in place. No host-home or provider-credential mount was introduced.

Reproduction at that checkpoint required the dedicated test guest and explicit disposable database files. The test
scripts must not be pointed at production databases. Core tests read `OURO_TEST_DATABASE_URL_FILE`;
resource tests read `OURO_COMPANY_TEST_URL_FILE` and `OURO_CATALOG_TEST_URL_FILE`. Values name local
secret files, not inline passwords. Use absolute paths. Guest drivers require explicit image and
binary-directory arguments and root only for the trusted test supervisor. Their Docker CLI use
does not implement the planned production Bollard adapter. Preparation scripts provision test
infrastructure and synthetic credentials; they do not create sovereign authority.

Observed build inputs were Rust 1.94.1, Lima 2.2.0, Ubuntu 24.04 (guest kernel 6.8.0-134-generic),
Docker 29.1.3 and PostgreSQL 18.6. Cargo.lock records Rust dependencies. The guest configuration and
Codex fixture preparation script pin image and official release digests. Requalification is
required after changes; a passing preparation command alone is not evidence of enforcement.

The subsequent connected-probe section records progress on Core claims, Runtime creation and
instance Gateway binding. The later resource API section records separate human-path dispatch
evidence; native steering and fresh-instance work recovery still need connected validation. Only then can the complete workflow be evaluated. Actual
subscription calls still require a compatible external credential path and the owner's finite
usage bound. No automatic API billing fallback is permitted.


## Connected Runtime Probe Evidence

The next local implementation connected real Rust Core, Gateway, CLI and Runtime processes on
the dedicated Linux guest. It used the existing digest-pinned BusyBox image for an environment
probe, PostgreSQL 18.6, separate service OS users and synthetic short-lived credentials. This
extends the earlier component runs; it does not combine their separate native Codex observations
into evidence of a connected Codex workflow. Full V-01–V-23 acceptance is still NOT RUN.

| Run | Observed result and limit |
| --- | --- |
| `tests/integration/test-connected-runtime-guest.py --bin-dir <guest-binaries> --failure revoke` | PASS: human API admission created an actual bound instance; its conditions request traversed the same Gateway/Core and resolved the explicitly delegated logical agent. Human service-RPC access and copied instance headers were denied. |
| Revocation while Runtime was paused | PASS: an actual request from inside the still-running container received HTTP 403 after ancestor revocation. After Runtime resumed, backend termination was observed and recorded. The 70-unit reservation remained unresolved. |
| `tests/integration/test-connected-runtime-guest.py --bin-dir <guest-binaries> --failure runtime-kill` | PASS: SIGKILL of the Runtime process did not prevent the independent guard from terminating the original container. Core initially retained unconfirmed termination instead of inferring it from timeout. |
| Replacement Runtime reconciliation after revocation | PASS: a new Runtime process authenticated as the assigned observer, compared the original backend and Core binding, and reported actual termination. It created no new workload and released no reservation. This is observer recovery, not private-work checkpoint resumption. |
| Core integration suite, explicit disposable PostgreSQL | Four tests passed, including worker mismatch, one-time release, changed bridge identity, current ancestor authority, logical agent scope and retained obligations. |

Both guest commands require root solely for the trusted test orchestration and Runtime supervisor;
the test launches Core, Gateway and CLI under separate non-root UIDs. The test script creates its
own database/credentials and records safe result JSON plus protected component evidence below its
reported run directory. Raw credentials and run material remain outside Git. No real provider,
subscription, API billing, trading or public deployment occurred.

Remaining beyond this probe (see later resource API evidence for its narrower progress): connected
native Codex lifecycle and resource traffic, successor work/checkpoint recovery, full accounting settlement, durable
multi-work scheduling, clock rollback/VM sleep, pressure/failure coverage, full bypass matrix and
performance qualification. These gaps must not be hidden by `runtime_ready` or a generic PASS.


## Resource API Implementation Evidence

The resource path now connects the real Rust Gateway, Core, credential workers and CLI using
mTLS and PostgreSQL 18.6. This evidence comes from a loopback-only disposable database on Mac.
Its service processes share the developer OS UID; separate database credentials were exercised,
but this run does not prove Linux process isolation or the native Codex workflow.

| Check | Observed result | Remaining boundary |
| --- | --- | --- |
| Explicit PostgreSQL Core integration suite | PASS, five tests: existing admission/Runtime tests plus shared resource call budget, concurrent stable-key replay, changed-input conflict, assigned-worker claim, ancestor target attenuation, and result observation after restriction | Provider effects and Linux process identity are not simulated into a PASS |
| Explicit PostgreSQL resource integration suite | PASS, one test: committed DB result/receipt and publication recovery retain matching effects | Cross-store worker failure before Core completion still leaves a claimed, unresolved intent |
| `tests/contracts/test-resource-api.py --admin-url-file <disposable-local-admin-url-file>` | PASS: human mTLS file read, prepared DB query/write, one effect and receipt, bounded upload, separate publication, old snapshot, raw Responses/MCP fixture bodies, owner CLI receipt lookup, inactive target lookup, and current revocation | No real Codex process, isolation test, provider call, subscription or performance result |
| Dispatch review corrections | Pending replay requires the original delegation/instance and current action, in addition to read permission. Upload content is checked against the admitted size/hash before claim; changed content and a non-upload intent are rejected without poisoning the approved upload | No general worker retry or unknown-effect settlement mechanism is claimed |
| `tests/support/prepare-connected-native.sh <pinned-codex-fixture-image-id>` and `tests/integration/test-connected-native-guest.py --config <explicit-fixture.json>` | Subsequently PASS for the bounded synthetic workflow; see [connected native qualification](#connected-native-qualification-results) | Real subscription, steering and successor checkpoint recovery remain unqualified |

At this earlier checkpoint, the native adapter had only compiled on Mac; the changed Linux
Runtime, image and combined workflow were NOT RUN. The subsequent connected native qualification
below supersedes that status only for its explicitly executed cases. Earlier Linux revisions
still must not be used to label an untested revision qualified.

The dedicated Lima guest returned `/bin/bash: Input/output error` while the host had approximately
215 MiB available. Removing only this task's reproducible Rust build artifacts recovered space.
Two bounded restarts did not restore SSH. The dedicated VM was stopped with its disk retained;
the temporary display diagnostic setting was restored. The exact guest failure has not been
established. Earlier safe exported probe results remain historical evidence, not current readiness.
Guest-only fixture records under `/run` are volatile and cannot be assumed recoverable after a
reboot; retaining the VM disk does not preserve tmpfs evidence. Durable evidence export/recovery
is therefore still unqualified.
Repair/rebuild the dedicated guest after verifying storage headroom before continuing native tests;
do not reuse Colima or weaken the execution profile as a workaround.

The recorded Mac/API subset used Rust 1.94.1, a disposable PostgreSQL 18.6 server, PostgreSQL tools
and OpenSSL 3 on PATH. URL files must identify a disposable local administrator, not a production
account. Scripts create synthetic principals/certificates and dedicated databases/worker roles.
The historical commands below consumed no model or subscription allowance. They preserve the
original checkpoint, rather than prescribe the current database suite interface:

```sh
cargo fmt --all --check
CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 cargo clippy --workspace --all-targets --locked -- -D warnings
CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 cargo build --workspace --locked
OURO_TEST_DATABASE_URL_FILE=<core-url-file> cargo test -p ouroboros-core --test control -- --ignored
OURO_COMPANY_TEST_URL_FILE=<company-url-file> OURO_CATALOG_TEST_URL_FILE=<catalog-owner-url-file> OURO_CATALOG_WORKER_TEST_URL_FILE=<catalog-worker-url-file> cargo test -p ouroboros-resources --test receipts -- --ignored
python3 -B tests/contracts/test-resource-api.py --config <absolute-fixture-config-file>
```

Each API run prints a safe result and fixture binding identifier. Configurations, short-lived keys,
database URLs, receipts and component logs stay under its configured protected local evidence root.
Existing roots are not silently reused or overwritten. Test service processes are stopped
by the script. Full V-01–V-23 acceptance remains NOT RUN, including real subscription credentials,
stream revocation, native steer/resume, successor checkpoint recovery, cost settlement, pressure,
performance and the complete bypass matrix. `runtime_ready` remains false.

### Environment Injection Implementation and Reproduction

The fixture drivers now require one explicit JSON configuration. Earlier command lines above
remain historical run records, not the current invocation contract. Provide a new protected
configuration directory outside source control, choose a nonexistent evidence root under an
existing parent, and replace the symbolic paths and example ports for each test environment:

```json
{
  "root": "evidence",
  "bin_dir": "<absolute-build-output>/debug",
  "bind_host": "127.0.0.1",
  "ports": {
    "gateway": 18443,
    "core": 18444,
    "company": 18445,
    "catalog": 18446,
    "fixture": 18447
  },
  "admin_url_file": "<absolute-protected-fixture-directory>/admin.url",
  "disposable_database": true
}
```

The example is not a default deployment or a credential. The administrator URL must explicitly
identify the disposable loopback PostgreSQL server, port, database, username, password and
`sslmode=disable`; do not point this fixture at a company store. Configured service URL/TLS
identities derive from the selected host and ports. Generated TLS/DB/artifact paths are relative
to their service configuration files, while child processes run from a different directory.
Ordinary source/build roots can be outside the checkout. Native guest drivers additionally require
explicit IPC, image, backend and UID bindings; Mac service tests cannot qualify them.

```sh
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked --offline -- -D warnings
cargo build --workspace --locked --offline --target-dir "$CARGO_TARGET_DIR"
cargo test --workspace --locked --offline
python3 -B tests/tooling/test-fixture-config.py
python3 -B tests/tooling/test-build-profile.py
python3 -B tests/contracts/test-config-startup.py --bin-dir "$CARGO_TARGET_DIR/debug"
python3 -B tests/contracts/test-resource-api.py --config "$OURO_FIXTURE_CONFIG_A"
python3 -B tests/contracts/test-resource-api.py --config "$OURO_FIXTURE_CONFIG_B"
```

Choose `CARGO_TARGET_DIR` and the two absolute configuration filenames explicitly. Configurations
A and B must use different roots/listeners with the same built binaries. Unit/startup tests verify
duplicate/unknown/missing fields, FIFO rejection, DB default/override rejection and protected
fixture creation. The resource driver exercises actual mTLS API/CLI, DB effects/receipts, file
upload/publication, native-format fixture responses and current revocation. Test-only model/MCP
responses remain synthetic. The shell tests use command stubs and a disposable Unix socket;
they do not download tools, install software or talk to a Docker daemon.

Shell preparation scripts require the named supported `OURO_TEST_PROFILE` plus their applicable
`OURO_TEST_STAGE_ROOT`, `OURO_TEST_RUST_PREFIX`, `CARGO_TARGET_DIR` and `OURO_DOCKER_SOCKET` inputs.
The Rust installer accepts only a new prefix under an operator-prepared, non-shared directory
owned by the invoking fixture user, containing a protected `.ouroboros-test-install-root` file
with exactly `ouroboros-disposable-toolchains` and a final newline. It runs without `sudo` and
rejects existing destinations before download. Such a marker authorizes no company operation.
The preparation helper removes inherited proxy settings and uses only the selected Docker endpoint.
Unsupported build/native profiles remain unavailable.

The completed two-binding Mac run used the same compiled Core/Gateway/worker/CLI binaries with
different evidence paths and listener ports. Both runs passed the supported resource workflow,
including one DB effect/receipt, upload replay, separate publication, historical result inspection
and post-revocation denial. The invoking environment had deliberately incorrect Docker/proxy/PG
settings and a poisoned HOME `.pgpass`; explicit fixture preparation and complete DSNs preserved
the selected connections. Direct binary startup tests separately confirmed that unsanitized PG
settings are rejected before a DB connection, rather than silently supplying missing values.
These results cover the Mac API subset of V-38, not full environment or persistent-storage acceptance.

A separate disposable Linux aarch64 guest, kernel `6.8.0-134-generic` and Rust `1.94.1`, passed
all 11 Runtime library tests and the Runtime all-target compilation check. Its tested Cargo/crate
files matched the local source hashes. The kernel-backed cases cover pinned alternate sockets,
alias/ancestor replacement, owner/type checks, actual peer credentials and process lifetime,
readiness before a successful probe, and a leftover socket without a listener. An actual Bollard
client sent `_ping` through the injected Unix socket after an independently observed readiness
probe. That endpoint was a bounded HTTP fixture, not a Docker Engine. No container lifecycle,
bridge/guard deployment, native Codex session or provider call was exercised by these tests.

Reproduce that subset in a disposable Linux guest with the locked sources/dependencies and
explicit writable build/cache paths. `TMPDIR` must already be a protected directory owned by the
test user, with enough Unix-socket path headroom; it is not created or selected by the product:

```sh
cargo test --locked --offline -p ouroboros-runtime --lib -- --nocapture
cargo check --locked --offline -p ouroboros-runtime --all-targets
```

The first Linux attempts rejected group-writable fixture directories and an overlong fixture
socket pathname. Correcting only the fixture permissions and pathname length produced the
passing run; the product's protection checks were retained. The earlier failed results remain
part of the local evidence. A parallel Mac test-directory name collision was also corrected
in test setup without changing configuration loading.

The final local checks passed Rust formatting and warning-denying workspace Clippy, 10 Mac
non-database tests, and 21 Python configuration/build/startup tests. Six dedicated database tests
remain explicitly ignored in the generic Cargo command; the two actual resource workflow runs
above are separate database evidence, not a claim that the ignored tests ran in this pass.
Independent code review identified and rechecked corrections for blocking FIFO input, ambient
SQLx connection defaults, readiness before peer verification, installer destination protection,
proxy inheritance and unused guard UID configuration. Review does not replace execution proof.
Full V-38 and V-24–V-37 storage acceptance, real Docker/native execution under these new bindings,
and subscription qualification remain NOT RUN. No SSD migration or storage activation occurred.

### Local Content Binding and Restart Results

The first local storage implementation and fixture ran on macOS with Rust 1.94.1 and PostgreSQL
18.6. Content used a newly created 512 MiB APFS sparse image with ownership enabled. Registration,
configuration and the disposable PostgreSQL cluster remained outside that filesystem. Device
observations confirmed the separate filesystems; both were backed by the test host's internal disk.
No owner SSD, operational store or existing VM was changed. This is not independent-media backup,
APFS reserve/quota, guest-disk attachment or physical device-loss evidence.

| Executed case | Observed result |
| --- | --- |
| Explicit empty-root preparation and ordinary read/upload/publication | Prepared physical root and registration identities matched the protected catalog binding; actual mTLS API/CLI returned the expected input, result and receipts. |
| Stop all five services, cleanly stop/start PostgreSQL, then start the same binaries/configuration | Full selected Core/company/catalog row snapshots matched before/after restart; content hashes, work, request, result and publication identities remained unchanged. PostgreSQL's start timestamp advanced and the orchestrator recorded the actual controlled shutdown/start commands separately. |
| Repeat successful request keys after restart | Existing work and DB/publication receipts were returned without an extra domain effect or revision. A replay flag was compared separately from immutable identity. |
| Revoke a grant, then restart the services again | The original grant stayed revoked. Historical receipt, DB retry and upload requests were denied without rewriting persistent state. A separate synthetic grant was used for later storage faults. |
| Start with missing, empty replacement or marker-copy replacement root | Each case first prepared its own empty root with valid registration custody, then replaced only its content location. Startup exited before listening, database mutation or fallback directory creation; the physical-identity denial and durable restriction were checked. |
| Rename a live content root and put an empty directory at its path | New read and pending-upload PUT returned 503. Neither replacement bytes nor domain effects were written. Restoring the original root did not clear the restriction in memory or after a fresh Catalog process. |
| Missing/wrong firm, store, generation or worker at Core claim | Actual PostgreSQL tests retained the accepted intent, unclaimed outbox and zero attempts after denial. Exactly one correct claim succeeded; replay was denied. |
| Catalog worker tries to modify its storage binding | PostgreSQL denied the UPDATE and the protected binding row remained unchanged. |

The full flow was rerun with the final binary after the warning-denying Clippy check prompted
boxing the larger Catalog worker enum variant. The final run passed with fresh fixture data and
listener bindings. Formatting, workspace Clippy/build, 24 Mac non-database tests, all seven
dedicated PostgreSQL tests, eight fixture-configuration tests, nine shell-profile tests and four
actual-binary startup tests passed. The generic Cargo invocation still ignores the dedicated DB
tests; they were explicitly run against newly created disposable databases in this pass.

Independent review reproduced a restriction bypass through a copied descriptor in a new protected
directory. Binding the external registration directory's physical identity closed that bypass;
the independent harness then passed its normal-restart, writer-lock, replacement-root, durable
restriction, copied-marker and symlink probes. The failed probe and corrected result are retained
as local evidence. Review and local Unix tests do not prove host-administrator resistance or exact
rollback detection when both content and registration are restored together.

To reproduce the API subset, supply a new fixture configuration as described above and optionally
set `storage_root` to an existing empty, owner-only disposable container on the selected test
filesystem. The driver creates only its named content directories within it; evidence and external
registration stay under the separately configured fixture root. Omitting `storage_root` selects
fixture-owned content under that new fixture directory, and cannot establish a mount boundary.

```sh
python3 -B tests/contracts/test-resource-api.py --config "$OURO_FIXTURE_CONFIG"
```

For a real PostgreSQL restart, add `--postgres-restart-checkpoint`. Once all service children have
exited, the driver writes `postgres-restart-checkpoint.json` under the protected fixture root.
A trusted external test runner must stop and start only that explicitly disposable cluster, then
create the exact one-shot continuation file/value recorded in the checkpoint within 60 seconds.
The driver accepts no restart shell command and requires a later PostgreSQL start timestamp.
Without this option PostgreSQL restart is reported NOT RUN. All test processes have finite waits;
the runner remains responsible for stopping its cluster and detaching its disposable image.

For the dedicated receipt test, the owner URL seeds the catalog and the separate worker URL must
have the restricted table/function grants in [Deployment](INTEGRATION_AND_DEPLOYMENT.md).
`prepare-resource-dbs.py` now prepares both credentials for explicitly disposable tests. Do not
substitute the owner credential as the operating worker.

These results exercise local parts of V-24/25/36/38. Full acceptance of those cases remains NOT RUN:
VM/guest replacement, persistent volume UUID enrollment, remount and physical SSD disconnect,
power-loss durability, exact rollback, retention/GC, capacity exhaustion and coherent independent
backup/restore are not qualified. Physical checks cannot atomically prevent a PostgreSQL commit
already in flight during storage loss; uncertain effects retain their existing identities.
Core historical receipts remain evidence of earlier outcomes, not a fresh assertion of current
content availability. No real Codex/subscription invocation or operational storage activation ran.


### Local Storage Capacity and Receipt Recovery Results

The next bounded implementation ran on macOS against a newly initialized disposable PostgreSQL
18.6 cluster. Storage used fixture-owned directories; no owner SSD, existing VM or operating
store was used. The budget is declared payload bytes, not observed filesystem block consumption.
The first fixture run passed with a real PostgreSQL restart; the final run additionally executes
the receipt-reconciliation request through the Rust CLI.

| Executed case | Required and observed outcome |
| --- | --- |
| 100 available bytes, two simultaneous 70-byte uploads | One 202 admission and one 429 denial; exactly one additional allocation and outbox, with no execution attempt from admission alone. Core tests also use different target aliases for the same store/generation. |
| Same accepted request key, then a new key with identical content | Existing intent and byte charge are unchanged on replay. The distinct request is denied when its full staging allowance cannot fit. |
| Invalid digest/size, absent budget and later call-limit failure | No partial byte allocation survives. Old accepted requests without matching allocations cannot pass upload-ready or claim. |
| Completion, revocation and reconstructed Core | Original byte charges remain. Neither success nor missing observations imply verified disposal or release. |
| Interrupted physical staging boundaries | Test-only synthetic EIO interruptions follow creation/write/sync/install/unlink boundaries; a partial write followed by an injected ENOSPC preserves its exact incomplete staging identity. Intact staging can be completed by the same library operation. These are injected errors, not actual full-media or power-loss tests. |
| Deferred PostgreSQL COMMIT rejection at staging insert | No content write begins before durable staging preparation; the failed transaction leaves no preparation or upload receipt. |
| Deferred COMMIT rejection at upload receipt | Installed bytes and the prepared staging row remain, without a false committed receipt. The library recovers the original intent/staging identity after the injected rejection is removed. |
| Deferred COMMIT rejection at publication receipt | Manifest/revision and publication receipt roll back together. Existing content remains, and the exact original publication can subsequently complete once. |
| Catalog effect committed; completion request dropped before Core | API returns 503. Catalog has the original receipt and Core retains its one claimed attempt. A replacement Catalog observes the receipt, completes that same attempt and preserves bytes/allocation. Both upload and publication are covered. |
| Core acknowledges completion; response dropped | The proxy observes Core's 204 before closing the connection. Worker/API report uncertainty, then receipt reconciliation returns the existing result with no second effect, revision or charge. Both operations are covered. |
| Claim response dropped after Core accepts it | The worker receives no ticket and writes no staging/content. After replacement, receipt-only recovery returns 202 with the same claimed attempt and charge. |
| Original grant revoked, target inactive | The revoked reader receives 403. A separate current inspection scope can recover the existing outcome; it does not restore the old execution grant. Core tests also verify original worker/configuration binding after registry changes. |
| Core success exists but Catalog receipt is absent | Explicit reconciliation returns 503 rather than substituting cached success. Only the synthetic test owner removes/restores that receipt; product workers have no repair permission. |
| Actual CLI calls `POST /resource-intents/{id}/reconcile` | It receives the same original result through Gateway with current scoped mTLS authority; all persisted state and content remain unchanged. |
| Service and PostgreSQL restart | The same binaries/configuration retain complete selected Core/company/catalog rows, staging/allocation identities, historical API results and content hashes. Revocation survives another service restart. |

The bounded transport proxy lives only in the fixture. It authenticates the exact synthetic Catalog
certificate, accepts fixed Core resource paths on loopback, bounds bodies/concurrency/time, and
injects one explicitly armed fault without retries. It never changes the product configuration
schema or adds a product fault API. PostgreSQL commit rejection uses temporary intent-specific
triggers created by the disposable test owner; the operating worker cannot install them.

Validation includes 27 Mac non-database Rust tests, eight Core database tests, two receipt-recovery
Core tests and one expanded resource database test. Workspace build, warning-denying Clippy,
formatting, eight fixture-configuration tests, nine shell-profile tests and four actual-binary
configuration-rejection tests pass. The generic Cargo suite skips the eleven dedicated DB tests;
they were separately executed against the explicit disposable endpoints. The shell-profile suite
requires permission to bind its temporary Unix sockets and uses command stubs, not a Docker daemon.

Run the transport/capacity subset using a new disposable fixture configuration:

```sh
python3 -B tests/contracts/test-resource-api.py --config "$OURO_FIXTURE_CONFIG" --storage-failure-checks
```

The driver seeds an explicit synthetic 1 MiB logical budget, temporarily sets exactly 100 additional
bytes for the concurrency case, then restores only that fixture limit while retaining all charges.
It does not fill a filesystem. Add `--postgres-restart-checkpoint` and follow the bounded external
restart handoff above for the PostgreSQL restart case; without that flag the driver reports NOT RUN.

These results cover local portions of V-27, V-30 and V-33 and retain the earlier binding/restart
checks. They do not complete those broad validation cases. Still NOT RUN or unimplemented:
physical ENOSPC and fsync failures, power loss, SSD disconnect/remount, coherent cross-store
backup/rollback, physical/metadata capacity admission,
storage release/GC and automatic completion of prepared staging. An explicit receipt-only request
cannot repair missing bytes or reexecute an effect. No real model/subscription call or operational
activation was performed. Independent review found and verified the cached-success/source-absence
fix; source review is distinguished from the separately recorded execution results.


### Linux Storage Qualification Results

The same source and Cargo lockfile were copied as an explicit bounded archive into a fresh Lima
2.2.0 VZ guest; per-file SHA-256 values matched the host worktree before compilation. The guest
used Ubuntu 24.04 aarch64, kernel `6.8.0-134-generic`, guest-local ext4, Rust/Cargo 1.94.1 and
PostgreSQL `18.6-1.pgdg24.04+2`. All builds and application tests ran as the ordinary fixture user
with UID 1000. Administrative package installation was a separate disposable-host preparation step.

The temporary VM used two CPUs, 3 GiB memory and an 8 GiB virtual disk. Host home mounts, SSH agent
forwarding, host proxy propagation, dynamic port forwarding and containerd were disabled. The
observed mount table contained no virtiofs, 9p or sshfs host share. Application inputs were limited to the explicit source archive and bounded fixture runners;
provider credentials, local DB credentials, research directories and host build outputs were excluded. Rust used two build jobs, disabled incremental compilation and omitted debug
symbols to keep this test within its storage allowance; the Cargo lockfile and enabled code features
were unchanged. No existing VM or owner SSD was modified.

| Executed Linux case | Result |
| --- | --- |
| Native workspace build and ordinary Rust tests | PASS: 34 tests, including Linux socket/kernel peer tests and the 18 resource tests. No macOS binary or mocked operating system was substituted. |
| Core admission and authority tests | PASS: eight tests on a new PostgreSQL DB, including shared 100-byte capacity versus concurrent 70-byte requests, aliasing, duplicate identity and retained charges. |
| Core receipt-observation contracts | PASS: two DB tests, including original worker/configuration binding, revoked execution authority and the distinct read-only ticket. |
| Catalog/company transactional recovery | PASS: expanded resource DB test with a separate restricted Catalog DB credential and deferred staging/upload/publication commit failures. |
| Actual Gateway API and Rust CLI | PASS: ordinary resource work, upload/publication, historical lookup, explicit reconciliation, concurrent capacity and receipt/source disagreement. |
| Request/response loss and Catalog replacement | PASS: both upload and publication recover from the original receipt; dropped claim response leaves one unknown attempt and no new content effect. |
| PostgreSQL and all-service restart | PASS: the controlled PostgreSQL shutdown/start is recorded separately; selected row snapshots, content hashes and stable identities survive. Revocation persists after another service restart. |
| Linux filesystem binding | PASS: missing/replaced/copied roots, symlink/hardlink/FIFO rejection, writer contention and durable restriction execute on Linux. Restoring a displaced root does not clear its restriction after worker restart. |
| Configuration and shell fixtures | PASS: eight configuration tests, nine shell-profile tests using stubs and four actual-binary startup rejection tests. |

Exact full-state equality is checked immediately after restart and stable-key replay, before
further verification reads. The exported later snapshot also contains those new read intents/events;
it is not asserted byte-for-byte identical to the earlier full Core snapshot. Historical API results,
content hashes and domain/storage-allocation records remain consistent.

The driver is unchanged from the macOS capacity pass. Its reproduction command remains
`python3 -B tests/contracts/test-resource-api.py --config <explicit-new-fixture> --storage-failure-checks
--postgres-restart-checkpoint`, with the previously described external PostgreSQL restart handoff.
Build and the three dedicated database test invocations use the same workspace/test names; URL
files, source/build roots and listener ports are injected for the fresh Linux environment. Actual
package versions, compilation settings, binary/source hashes, command exits and fixture evidence
are recorded separately from the design documents. No source fix was needed for this Linux pass.

This qualifies the local storage/API behavior in a Linux VM, not the full private agent sandbox.
All API fixture services share one OS UID, so their separate DB credentials do not establish OS
credential custody. The driver correctly retains `linux_isolation: NOT RUN`; Codex execution,
Docker/cgroup enforcement, independent runtime guard behavior and service-user separation were
not exercised by this storage pass. A fresh VM booted, but VM reboot/host restart recovery was not
tested. Filesystem fault hooks remain synthetic, and physical ENOSPC, device disconnect, power-loss
durability, physical capacity accounting, backup/GC and subscription use remain unqualified.

After success, the driver stopped its test services and disposable PostgreSQL. Evidence was
exported without keys, passwords, DB data directories or compiled artifacts. The temporary VM was
then stopped and removed; the bounded evidence remains Git-ignored. Independent review checks
these execution records against the claims above rather than treating Linux compilation alone as
proof of storage or isolation behavior.


### Connected Native Qualification Results

A fresh disposable Lima VZ/Ubuntu 24.04 aarch64 VM connected the actual pinned Codex 0.153.4 App
Server to Rust Core, Gateway, Runtime, CLI and resource workers. It used guest-local ext4,
PostgreSQL 18.6 and Rust 1.94.1, with two CPUs, 3 GiB VM memory and an 8 GiB virtual disk.
Source hashes, locked dependencies and image identities were recorded. This run used synthetic
Responses and MCP workers; it did not contact a model provider or import subscription credentials.

The trusted fixture driver and Runtime run as guest root. Core, Gateway, human CLI, company,
Catalog and synthetic-provider services use distinct UIDs 70001–70006, empty supplementary groups
and no-new-privileges. The five persistent non-Runtime service processes are also checked in
`/proc` for their actual UID set and zero effective capabilities. The private payload runs as
65532 with an observed read-only root and dropped capabilities; no bind/volume mounts are listed.
The bounded home/work/tmp tmpfs settings are configured by Runtime; the exported Docker
`Mounts` list is empty and does not positively verify those tmpfs size/options. This run does
not qualify their effective capacity enforcement. Its only observed network interface is
loopback; the independent bridge joins that network namespace and
connects to the fixed Gateway Unix socket. These are observations of this disposable deployment,
not guarantees derived solely from public configuration files.

| Connected case | Observed result |
| --- | --- |
| Human admission and actual native startup | PASS: mTLS CLI registers work and creates an admitted instance; Runtime arms its guard, binds the bridge and releases the actual App Server. The explicit empty Codex home is created as the private UID inside its Runtime-configured home directory. |
| Native protocol and registered MCP | PASS: three synthetic Responses requests and four MCP protocol requests, including one completed `fixture_echo` tool call. The fixture preserves the registered `mcp__fixture` namespace rather than changing the harness or disabling tools. |
| Native resource work through Gateway | PASS: two file reads, one prepared DB query, one DB result/receipt, one upload and one separate publication. The native command completion has exit code zero. |
| Artifact capacity and effect evidence | PASS: one 13-byte Core allocation/charge, one committed Catalog staging record and one publication at revision one. |
| Credential custody | PASS: each of six non-Runtime identities reads its own selected credential but receives EACCES/EPERM on seven other known-existing service/Runtime/CA credential paths and on the actual Docker socket. These are representative credential probes, not an exhaustive filesystem audit. |
| Control-service boundary | PASS: the human certificate cannot call Core directly; its Gateway path remains usable. |
| Private direct access | PASS: actual TCP Gateway connection succeeds; metadata and external IPv4 endpoints produce ENETUNREACH/EHOSTUNREACH, and the direct loopback DB port produces ECONNREFUSED. Private checks also find no host credential directory or Docker sockets. Missing tools, HTTP errors and timeouts do not count as denial. |
| Termination and historical observation | PASS: Runtime records actual container termination and retains the unresolved compute reservation. The currently authorized owner reads and reconciles the terminated instance's publication after Catalog deactivation, without another revision or storage charge. |

App Server command `aggregatedOutput` is optional. In actual runs it could omit startup output or
be null even when the command completed. The fixture therefore joins a successful completed
`fixture_work` native item to that call's actual `function_call_output` in the subsequent Responses
request recorded by Core for the same firm, work and instance. Both the workflow completion and
TCP-probe markers must occur in the output field, not the requested command, arguments or model
narration. MCP completion is separately checked by item identity, status, result and absence of
error. This is native-harness output plus platform-recorded traffic; it does not make an arbitrary
private report an independently verified fact. DB receipts, storage charges and Docker observations
remain separate sources.

The first attempts exposed a missing explicit Codex home, a fixture server assuming flat MCP tool
names, and incomplete optional native output. Their failed evidence is retained alongside the
successful runs. The fixed bootstrap creates no credential; namespace handling changes only the
synthetic response producer. No authority, isolation, retry limit or resource deadline was relaxed.
The pinned build also emitted a PATH warning for bubblewrap while identifying its bundled fallback;
this run does not qualify a separate native bubblewrap sandbox. The outer container supplies the
selected external-sandbox boundary.

Reproduction uses the existing explicit configuration helpers:

```sh
cargo build --workspace --locked
cargo test --workspace --locked --offline
cargo clippy --workspace --all-targets --locked --offline -- -D warnings
bash tests/support/prepare-codex-fixture.sh
bash tests/support/prepare-connected-native.sh <exact-first-image-id>
python3 -B tests/integration/test-connected-native-guest.py --config <absolute-fresh-fixture.json>
```

The image helpers require the selected Linux aarch64 profile, an explicit existing stage directory,
Cargo target directory and fixed Docker Unix socket. The native fixture requires a disposable local
PostgreSQL administrator URL file, new fixture/IPC roots, installed binaries readable by the service
UIDs, explicit distinct listener ports and the final image ID. All existing ancestors of the new
fixture root, IPC root and binary directory must allow those UIDs to traverse; private credential
leaves remain 0700/0600. Do not broaden permissions on an unrelated parent to make a test pass.
Root orchestration is confined to the disposable guest. It is not a production provisioning API.
The TCP probe is compiled only into the fixture image, never added to the product CLI contract.

Linux workspace tests (35 non-DB tests), strict Clippy, Mac formatting, eight configuration tests
and nine shell-profile tests pass. The connected fixture exercises its real DB transactions;
it does not relabel skipped standalone DB tests as executed in this run. Safe native events,
selected service identities, containment observations and failed/successful results are exported
before the temporary VM is removed. Keys, URL files, DB directories and build/image artifacts are
not exported as research evidence.

Still NOT RUN: actual subscription acceptance/credential custody, native steer/interrupt and open
stream revocation, successor instance checkpoint recovery, the complete DNS/IPv6/metadata/mount
bypass matrix, effective tmpfs mount options/size enforcement, guard survival during VM/host failure,
physical SSD failure, backup rollback,
resource settlement, pressure and performance qualification. Historical simpler guard/revocation
probes do not fill these native-workflow gaps. This is a connected environment fixture milestone,
not completion of V-01–V-23 or of the subscription-backed first connection.


### Native Revocation and Successor Admission Evidence

The connected fixture also supports `--revoke-native`. The actual pinned Codex performs its
MCP/file/DB/upload/publication workflow, then its fixed native command waits inside the same
isolated instance. The test observes the command-start event and a workload-created checkpoint
marker before injecting revocation. This marker is a fixture synchronization point, not a reusable
native session checkpoint or permission to restore context.

| Case | Observed result |
| --- | --- |
| Live Gateway revocation with Runtime paused | PASS: the actual supervisor enters Linux stopped state. A CLI probe inside the still-running native instance can reach Gateway before revocation and receives 403 after its ancestor delegation is revoked through the human CLI. This proves instance-path enforcement; it is not a claim of graceful native turn interruption. |
| Actual termination before the hard deadline | PASS: Runtime resumes, observes authority denial, exits with that failure, and records backend termination. CLOCK_BOOTTIME observations place termination before the unchanged guard deadline, with more than twelve seconds of remaining deadline required before injection. Deadline expiry cannot substitute for this check. |
| Revoked-authority successor | PASS: a fresh request key with the original revoked grant receives 403; no second execution is created. |
| Independent-current-authority successor | PASS: a separate grant/child prepared before execution receives 409 for the terminated but unsettled predecessor. Its ten requested units fit the thirty remaining units, so capacity exhaustion is not the reason. The fixture does not create authority at recovery time or mutate settlement rows to force admission. |
| Effects and obligations across revocation | PASS: one company result and receipt, one publication at revision one, a 13-byte storage charge and the original unresolved 70-unit compute reservation remain. These values are checked again after historical lookup and explicit receipt reconciliation. |
| Current observation authority | PASS: the revoked grant cannot read the result; the owner's separate current, scoped inspect delegation can read and reconcile the original receipt. This neither resumes execution nor grants access from old session ownership. |
| Registered MCP success | PASS: the native MCP completion item has the expected identity, successful status, result marker and no error before the waiting workflow is revoked. |
| Docker tmpfs configuration | PASS: the actual `HostConfig.Tmpfs` map matches the three configured paths/options/sizes, checked separately from the empty bind/volume mount list. Effective capacity enforcement under writes or pressure remains NOT RUN. |

Reproduce with the same dedicated Linux prerequisites and explicit configuration as the preceding
connected-native section, adding `--revoke-native` to `tests/integration/test-connected-native-guest.py`.
The normal mode remains a separate regression run against a fresh database, work and instance.
Both use real binaries and synthetic provider responses without account credentials or model calls.
Source manifests, native events, Runtime finish records and safe revocation observations are
preserved outside Git. No product authority or runtime admission checks were relaxed for this test.

**A successfully resumed successor is not implemented or proved by these results.** The current
Core requires a predecessor to be terminated, its start intent to be succeeded and its reservations
to be settled before successor admission. Runtime termination intentionally supplies none of that
settlement by itself. Native checkpoint custody, authorized context delivery and `thread/resume`
on a fresh instance are still missing. These are the next implementation dependencies; an empty
replacement task or direct DB edit must not be presented as recovery. Native steering, graceful
interrupt, open-stream revocation, actual subscription use and full lifecycle acceptance remain
NOT RUN.

## Common Management Implementation Evidence

The local Rust implementation now connects human and Runtime-bound instance identity to common
management authorization, explicit work-control roots, immutable parent relationships and current
delegation constraints. This is the first increment of the
[outer implementation sequence](../../ARCHITECTURE.md#sequential-outer-implementation).

Two disposable connected Linux runs passed with real Core, Gateway, Runtime, CLI, PostgreSQL and
two Runtime-created containers. The guest used Ubuntu 24.04.4 LTS aarch64, Linux
`6.8.0-134-generic`, PostgreSQL 18.6, Docker Engine 29.1.3 and Rust 1.94.1. The containers had
distinct instance bindings, bridges and private namespaces on the same guest kernel; this is not
a separate VM or kernel for each agent.

The trusted root-operated fixture driver used Docker exec to run the existing CLI and probes as
the private UID `65532`. Those requests traversed the actual instance bridge and Gateway. The
driver's setup and observation privilege was separate from private authority; it did not supply
an authoritative identity header or expose Docker administration to private code. No native Codex
agent or provider call was part of these management runs.

| Check | Result and scope |
| --- | --- |
| Workspace tests | PASS: 33 non-DB tests, including fixed Gateway route/header handling and human/instance CLI command selection. The normal workspace run reports 22 DB cases ignored; this is not a claim that those ran in that command. |
| Core PostgreSQL tests | PASS: all 21 cases explicitly run on a fresh PostgreSQL 18.6 test cluster: 11 common-management cases, eight existing control/resource cases and two receipt-recovery cases. |
| Common actor cases | PASS in PostgreSQL: same logical agent with distinct bound roots/grants cannot borrow sibling authority or read/replay another scope; human parent control, child creation, explicit parent selection, pagination/cursor scope, and authorship-independent control bindings behave as specified. |
| Dispatch and historical access | PASS in PostgreSQL: removing work control blocks an admitted resource claim; losing resource inspection denies both matching and changed-input replay; losing the submitting instance blocks pending child dispatch without clearing reservations. Stop and scoped delegation revocation remain different operations. |
| Actual human API/CLI | PASS: real Core, Gateway and CLI processes with mTLS and a separate disposable DB role; list/detail, authorized child creation, unauthorized-parent rejection, forged context replacement, concurrent 70/70 admission, replay, SSE, stop, revocation and historical metadata inspection. No private payload was launched in this run. |
| Static and independent review | PASS: workspace all-target Clippy with warnings denied, Rust formatting, and an independent source review. Review findings about resource dispatch scope and replay inspection order were corrected and covered by the DB cases. |
| Actual instance management and event access | PASS in two connected Linux runs: private CLI creates/lists/reads child work, and parent human inspection sees it. Same-principal instances with distinct roots/grants cannot borrow sibling authority, replay its creation or reuse its list/event cursor. Actual event delivery follows the authorized scope. |
| Kernel binding and private space | PASS: two actual bridges preserve their registered kernel peer and instance binding despite forged identity headers. Direct DB/network and host-socket probes are denied; inspected containers use network none, a read-only root, dropped capabilities and no host mounts. A private `/dev/shm` marker is absent from the other container. This narrow check does not qualify general workspace allocation or native subagents. |
| Concurrent shared admission | PASS: a 120-unit compute pool retains 5 units for each of two running instances and 5 for each of two additional admitted jobs, leaving 100. Concurrent 70/70 requests return exactly one `202` and one `429`; total commitment becomes 90 and remains 90 after actual termination. Admission does not prove those additional jobs executed. |
| Live restriction and termination | PASS for both bound instances: while the corresponding Runtime supervisor is paused, the container remains running and a positive request returns `200`. Stop or self-revocation then makes the same live Gateway path return `403` before container termination. Resuming Runtime confirms Core termination and backend non-running state before the original hard deadline. Sibling control is denied; stopped-origin child dispatch is denied without an attempt or reservation release. |
| Guard ownership and fixture cleanup | PASS: the final driver captures each guard's Runtime parent, PID/start identity and original deadline. The original guard processes are observed gone after their deadlines without extending them or using a broad process-name kill. Fixture-owned containers, services, DBs and roles are cleaned up; early instance termination does not settle compute commitments. |
| Provider use and full lifecycle | NOT RUN in this increment: no account authentication/model calls, successful native successor, general artifact storage, managed adapter/service lifecycle or complete outer-product acceptance. |

Reproduce non-provider checks using explicit build and disposable environment bindings:

```sh
cargo test --workspace --locked --offline --target-dir <build-directory>
OURO_TEST_DATABASE_URL_FILE=<disposable-database-url-file> cargo test --locked --offline --target-dir <build-directory> -p ouroboros-core --tests -- --ignored --test-threads=1
cargo clippy --workspace --all-targets --locked --offline --target-dir <build-directory> -- -D warnings
cargo fmt --all --check
python3 -B tests/support/prepare-test-db.py --config <database-fixture-config>
<bin-directory>/ouroboros-migrate --database-url-file <test-database-url-file>
python3 -B tests/support/prepare-api-fixture.py --config <api-fixture-config>
python3 -B tests/contracts/test-api-cli.py --config <api-fixture-config>
python3 -B tests/integration/test-connected-management-guest.py --config <explicit-disposable-config>
```

Build the actual Core/Gateway/CLI binaries before the process test. Database setup and API setup
use different fresh fixture roots; the API binding references the prepared database metadata and
the same explicit administration endpoint. Test certificates and DB credentials are synthetic,
kept in protected disposable paths, and never provider/owner credentials. The process test closes
its services; the dedicated test database was also stopped. Existing environments were preserved.
Local setup failures and the corrected inherited-scope test expectation are retained with the
successful evidence outside Git. The connected guest command additionally requires a dedicated
root-operated Linux fixture, explicit database/backend/binary bindings and a prepared pinned probe
image; it neither pulls nor builds that image. Its default 90-second execution lifetime is bounded
to the supported 45--110-second test range. The small private marker does not provision a persistent
workspace or exercise the future artifact lifecycle.

Test-driver corrections preserve per-container probe scratch, observe a positive request before
restriction while Runtime is paused, and collect owned-guard observations throughout startup.
Unconfirmed startup and guard ownership leave cleanup uncertain rather than complete. The final
run records confirmed Runtime startup and guard ownership during cleanup. Driver
identities, actual observations and earlier failed attempts remain in protected local evidence;
these verification changes did not alter product source or relax its controls. The common
management increment now has the connected instance-path evidence as well as its DB and human
API/CLI results. This completes that bounded slice, not subsequent artifact, provider, managed
service, native-agent or successor-recovery increments or full outer-product qualification.

## Agent-Led Service Adoption Validation

All cases below are **NOT RUN**. Existing native/model/MCP fixtures and browser login evidence
do not implement or prove this lifecycle. These requirements reference
[service adoption](RESOURCE_SERVICES.md#agent-led-discovery-adoption-and-operation).

| Input or fault | Required observation and pass condition |
| --- | --- |
| Owner supplies a default adapter and an agent proposes an equivalent adapter | Both require the same acceptance, activated account binding and per-call delegation. Bundled source/name cannot bypass isolation, grants or revocation; either may reuse valid existing evidence. |
| Agent submits a release before acceptance | Inactive candidate recorded; no new callable tool, credential access, process loading or authority. |
| Existing delegated connection suffices | Reuse only its current account/actions/limits. Do not create a second account budget or demand repeated owner decisions already covered by valid delegation. |
| New account or data/cost authority is required | Concrete pending decision identifies exact scope; proposed scope or secret presence cannot activate it. |
| Owner enrolls a key or completes OAuth | Only reference/version/account status reaches the agent; mismatch, stale enrollment or replay blocks binding. Input values are absent from chat, intent bodies, logs and artifacts. |
| Verification needs live authentication before operating qualification | Only an exact candidate accepted for the bounded test profile can use the test connection; successful login/test does not promote it to operating authority. |
| Independent tests and acceptance select a release | Artifact/dependency/configuration identity matches actual Runtime deployment before MCP availability; altered content under the same name is refused. |
| Accepted adapter requests another action/account or raw secret | Common sender rejects before authentication/dispatch; no direct network or secret-store access from adapter logic. |
| Public unauthenticated endpoint receives private data | Current disclosure/operation scope is checked despite absence of credentials. |
| Provider provisioning creates a credential but custody fails | Secret never reaches adapter/Core/client; created resource and pending liability remain recorded; no blind reprovisioning. |
| Connection or credential is revoked during preparation/refresh | Dispatch recheck rejects new use; previously sent effects and remaining obligations persist for reconciliation. |
| Provider echoes authentication in a response/error | Agent code, normal logs, events and artifacts receive only allowed non-secret data; raw authentication exchange is not a generic resource result. |
| New signing primitive is proposed as an adapter | Ordinary activation cannot load it into the trusted sender; separate platform-change verification is required. |

No new runtime, vendor account, live secret or operational approval is created by these design
requirements. Human gates retain the existing sovereign rules; bounded technical acceptance
requires an actual prior delegation, not an assumption that automation is always permitted.

## CEO Operating Profile Validation

All cases below are **NOT RUN**. They test the
[one-CEO private design](../../ARCHITECTURE.md#initial-private-operation-one-ceo-role),
[assignment and continuity contract](CONTRACTS_AND_STATE.md#operating-responsibility-and-handover),
[Core handover barrier](CONTROL_CORE.md#operating-assignment-and-successor-admission),
[managed adoption](RESOURCE_SERVICES.md#agent-led-discovery-adoption-and-operation) and
[owner evidence view](OBSERVABILITY_AND_CONSOLE.md#operating-responsibility-and-owner-oversight).
They neither supersede the first API/CLI fixture nor turn its successful calls into proof that
the private company operates. Assignment enforcement, managed adoption and successful native
checkpoint recovery have not been established by existing runs.

The first operating experiment uses a bounded environment-verification mandate, explicit resource
and model-call limits, source-linked company records, one operating principal and controlled
services. Present a goal and available evidence rather than a scripted sequence of tool calls.
The agent must select justified work, execute or make a concrete scoped proposal, retain its
decision and effects, and choose a supported next condition. No market, real capital, trading
authority or permanent organization is selected for this experiment. Missing call authorization
or mandatory criteria leave their dependent cases unrun, not filled with favorable defaults.

| Input or fault | Expected evidence and pass condition |
| --- | --- |
| First appointment and first goal, with no prior operating history | Existing owner authority, principal and delegation identify one standing work and current executor. The agent records a justified bounded action and review/stop condition using actual available resources; no invented company performance or grant. |
| A current company tool suffices; an optional specialist has no demonstrated benefit | Tool use follows current delegation and preserves receipts. Direct work, simple code or an explicit wait is an acceptable choice; creating employees or adapters is not the success metric. |
| An agent identifies a missing service while an administrator supplies another | Both use the same inactive candidate, acceptance, connection and usage controls with distinct provenance. The agent can prepare and test within scope. An administrator needs no artificial CEO proposal; neither origin gains secret access or bypasses verification. |
| Desired work needs a new right, but other justified work is already authorized | Exact pending decision links purpose, proposed scope, evidence and missing prerequisite. Dependent effects remain blocked; independent work may continue. A chat reply or CEO self-approval cannot become a control acknowledgment. |
| Duplicate wake and two different events arrive during active coordination | Occurrence keys and consumer progress retain every distinct event. Only one coordinating execution/reservation is selected; later work consumes pending events without duplicate effects or fresh allowance. Scoped workers may run in parallel. |
| Normal exit followed by an already admitted timer | Existing continuation authority drives the same handover barrier and assignment transition; fresh instance, current inputs and shared usage precede the next decision. No repeated owner command or mandatory private process running between occurrences. |
| Deadline, exhausted allowance, unchanged observations or revoked mandate | Hard deadline and shared accounting remain intact. While authorized, private records justified cessation or a bounded wait. Actual cutoff/termination must apply without a final agent report; missing interpretation stays explicit. The scheduler cannot renew rights, invent a task, reset costs or generate indefinite retries. |
| Two successor requests and an old executor re-reading the newest document revision | One replacement transition wins the expected assignment revision. Official decision publication checks assignment and instance, so refreshing the document revision cannot restore the old writer. Unrelated result submissions retain their own scopes. |
| Old official publication commits but its response is lost during replacement | Handover stays pending until the original receipt establishes outcome, the old executor is fenced and conflicting effects are reconciled. No successor official write races that commit; no duplicate publication or erased history. |
| Core restarts after assignment commit but before acknowledgment | Lookup recovers the original replacement and selected execution. No second assignment, provisioning attempt or copied grant; revocation received during recovery still blocks dependent admission. |
| CEO stops while one child has valid authority; another child's ancestor is revoked | Valid child work can continue under its own conditions; the revoked descendant is fenced. Neither gets a new parent grant or allowance. All costs and obligations remain visible. |
| Native session is lost, or a different responsible principal takes over | Current permission governs accessible records and checkpoint content. Successor reconstructs pending work from source records, reconciles effects and preserves predecessors' decisions. Old session ownership supplies no access, and a new principal needs a valid assignment and grants. |
| CEO claims success while a provider receipt contradicts it or cost is missing | API/CLI identifies report versus observation and retains the contradiction/gap. Operational completion, owner economics, AI contribution, earning ability and further allocation are assessed separately; missing cost is never zero. |
| Owner inspects, restricts or declines a prepared decision while coordinator is unavailable | Current human identity uses the same Gateway; raw evidence and actual control progress remain inspectable within scope. The absent CEO is not a prerequisite for owner control and no credential is exposed. |

For each execution test retain mandate/assignment references, input and fault timing, relevant
work/execution/instance and request identities, old/new record revisions, receipts, shared usage,
restriction application and observation gaps. Use source evidence and a review separate from the
candidate's authorship; several agreeing agents alone do not certify a result. If the assignment
barrier or native recovery fails, leave the operating profile unavailable and fix that boundary;
do not route around current Core settlement checks or relax isolation to complete a demonstration.

Completion establishes this bounded operating workflow only. Economic performance needs its own
authorized activity and evidence under the governing purpose. Additional staff, permanent loops,
UI implementation and new services do not follow automatically from this design.

## Generated Artifact and Space Validation

All cases below are **NOT RUN**. They implement the
[artifact-use and space contract](CONTRACTS_AND_STATE.md#artifact-use-and-allocated-space),
[resource workflow](RESOURCE_SERVICES.md#generated-artifact-workflow-and-space),
[Core admission](CONTROL_CORE.md#artifact-use-and-space-admission) and
[private build/job boundary](RUNTIME.md#private-builds-and-artifact-backed-execution).
The separately implemented bounded binary file path does not establish executable bundles,
namespace provisioning, standalone job launching, retention/reclamation or managed service ingress.
Existing company-storage and CEO-handover tests remain applicable, including their unrun conditions.

The first connected experiment starts with one admitted private executor, a finite shared resource
budget and current space/file/job permissions. It creates and edits a small script, tests it locally,
uploads it and separately publishes a company revision, then requests a bounded job using those
exact inputs. It inspects actual execution and result receipts. It next proposes a managed tool
from the same content and verifies that callable availability requires the separate acceptance,
binding and current grants. Controlled services and preauthorized test identities supply any
needed acceptance; the agent cannot manufacture its own verifier role to finish the demonstration.

| Input or fault | Expected records and pass condition |
| --- | --- |
| Agent edits and runs a local script twice within admitted scope | Native/runtime observations and bounded local usage exist; no per-edit candidate or new human approval is required. An external call still follows Gateway admission. Local success publishes or activates nothing. |
| Workspace provisioning succeeds but its acknowledgment is lost | Original intent and handler receipt identify one namespace and its permitted scope. Recovery neither creates another namespace nor grants new access or capacity. |
| Upload and company publication complete; then a separate job is requested | Distinct intents/receipts connect the exact artifact revision to the admitted bundle, profile, input reads, retained-content holds and actual new instance. Accepted creation is distinguishable from execution and business success. |
| Two jobs use the same artifact; a later publication changes its head | Both retain their original exact inputs and their own bounded allocations. Shared content may reuse verified storage, but two executions do not share a fictitious single scratch reservation or automatically run the new head. |
| Two 70-unit peak allocations compete for a shared 100-unit pool | At most one is admitted. Scratch, dependency expansion, staging and uploads include applicable peak overlap; quota aliases, work creation and projected deduplication cannot add capacity. Protected headroom is preserved. |
| A worker exceeds byte, file-count, process or temporary expansion bounds | Actual backend/resource enforcement restricts that growth; control/evidence capacity remains available. Missing enforcement keeps the profile unavailable. No automatic spill to another disk, unlimited quota or host mount. |
| Bundle includes a traversal/link/special file, compressed expansion bomb or mutable dependency | Validation refuses unsafe delivery before private release, with bounded resource use and explicit content status. Privileged setup executes no artifact hook; a package name does not authorize an undeclared fetch. |
| A published file or CEO instruction claims to be an accepted managed tool | Registry/activation remains inactive until actual current acceptance and deployment binding exist. Company publication and title/provenance cannot grant caller rights, trusted-code loading or secret access. |
| Accepted service implementation is replaced through a writable import path or startup download | Fixed release/loader checks prevent substituted execution or keep the profile unavailable. An ordinary experimental working copy remains editable in its distinct scope; no blanket ban on native coding is introduced. |
| Service starts but verified Gateway ingress is missing, or the instance generation changes | No callable target or direct host port appears. Ingress must bind the accepted operation to the current verified instance; stale endpoints and caller-selected destinations are refused. Downstream calls retain originating delegation. |
| Service replacement races an old stateful call or failed data migration | Old effects and original receipts are reconciled before conflicting activation; data and obligations survive process/code replacement. A failed migration or response loss cannot be treated as a successful rollback. |
| Executor exits or is revoked before publishing local output | Termination applies without a final save. Unpublished data is reported unavailable or preserved only by explicitly authorized recovery collection as unaccepted content. Committed company revisions and current child-work obligations survive. |
| Retention expires while an execution, active release or unresolved publication still holds content | New-use restrictions and cleanup eligibility remain separate. Holds block physical deletion; observed disposal, not age/process exit, reconciles occupancy. A stale cleanup generation cannot delete a replacement object. |
| Another worker guesses an artifact digest/space ID; an authorized successor requests it | Guessing supplies no access. Successor input reads use current scope and fresh scratch; retained company identity, historical use and aggregate limits persist without copying former grants. |
| Owner inspects lifecycle/space while an agent reports an unsupported success | API/CLI connects artifact, decision, admission, activation, observed execution, cost and holds to their sources. Missing stages remain explicit; secret material, raw credentials and physical host locators are absent from ordinary views. |

Retain exact content and dependency references, source/work/instance provenance, test inputs,
fault timing, reservations, allocation measurements, acceptance scope, active bindings, receipts,
retention decisions and observation gaps. Verify the actual backend and consumer path; a document
check or a successful small text upload is not proof of binary delivery, enforced capacity or
managed execution. Failure leaves the affected use unavailable without weakening the existing
profile, replacing the accepted release or bypassing current recovery restrictions.

## Work-Centered Management Validation

All cases below are **NOT RUN**. They cover the
[management contract](CONTRACTS_AND_STATE.md#work-centered-management-contract),
[CLI extensions](GATEWAY.md#work-centered-management-client) and
[owner/worker presentation](OBSERVABILITY_AND_CONSOLE.md#list-detail-decision-and-observed-outcome).
Current first-connection endpoint evidence does not establish these additional management routes.

The first workflow lists authorized work, inspects linked artifact/space evidence, submits an
inactive candidate, records an independently authorized technical judgment, activates only an
eligible target and follows actual execution. It then separately stops an execution, restricts
a target, revokes a delegation and requests eligible retained-use retirement. Use controlled
resources and existing test delegations; do not create new authority or live effects to complete it.

| Input or fault | Expected evidence and pass condition |
| --- | --- |
| Equal human/agent scope; hidden sibling work; scope shrinks between pages | Both use the same filter and per-read checks. Counts, pagination, relationships and detail cannot disclose hidden records; a cursor supplies no permission. |
| Core view is current but a linked resource observation is missing/stale | Keep source revisions/times and the gap. The cursor represents the projection only; unavailable facts are not inferred as healthy, deleted or zero cost. |
| A report renders an approval button, target URL or forged completed status | Treat it as untrusted content. Only the trusted client's fixed action mapping can submit a command; actual records determine control state. |
| An inactive candidate is published and then technically accepted | Publication, scoped technical judgment, caller permission and actual activation remain separate. No tool is callable merely because the candidate is stored or reviewed. |
| Target/proposal changes after an owner reviews it | Stale fixed-input/precondition request conflicts or is denied. The client displays changed scope before any new decision and cannot quietly update revisions. |
| Two clicks, timeout or client restart before acknowledgment | Protected pending-action identity survives; lookup returns the same intent/effect. No second grant, allocation, activation or deletion request is generated from uncertainty. |
| Technical acceptance commits but activation fails; late result then arrives | Display confirmed acceptance and failed/unresolved activation separately with their original intents. Reconcile the late result without invented rollback or re-execution. |
| Target is deactivated after a command completed | Current authorized lookup can recover the old receipt without reactivating or redispatching the target. Revoked read scope still denies disclosure. |
| Stop, grant revoke, target deactivate, proposal decline and content retirement are exercised | Each changes only its documented scope. Streams/descendants, residual resources, holds and costs remain traceable until their own outcomes are confirmed. |
| Retirement disposition is recorded while a hold still retains bytes | CLI/UI shows confirmed disposition plus retained content and pending capacity reclamation. It does not report physical deletion or zero occupancy. |
| CEO or UI is unavailable, or read access is revoked during a wait | Another authorized client can inspect/control independently. A revoked waiter stops protected delivery; control application does not depend on its last acknowledgment. |

Retain scoped view/cursor and source references, prepared-input revisions, request keys, per-step
intents, current-authority decisions, observed application, partial outcomes and remaining duties.
Document/CLI exit status cannot stand in for these records. Unsupported routes and missing
qualification remain explicit; clients must not use privileged storage or backend paths as fallback.

## Bounded Binary Transfer Implementation Evidence

This checkpoint covers the file subset of implementation increment 2. It does not complete
logical workspace allocation, artifact-backed jobs, retention holds, retirement or reclamation.
The first file target remains scoped to its configured workspace. The implementation follows the
[binary transfer contract](CONTRACTS_AND_STATE.md#binary-resource-transfer-contract).

The actual Rust Core, Gateway, Catalog and CLI ran with mTLS and PostgreSQL 18.6 in the existing
Linux guest. Services shared the test user's OS identity; this run does not prove private instance
isolation or native Codex behavior. All identities, certificates and provider replies were fixtures.
There was no real model/account call, secret enrollment, financial action or deployment.

| Check | Observed result and scope |
| --- | --- |
| Ordinary workspace Rust tests | PASS: 56 tests on Mac, including bounded storage chunks, CLI byte verification/no-overwrite behavior and Gateway monitor lifetime. The generic command leaves the dedicated PostgreSQL suites ignored. |
| Explicit PostgreSQL suites | PASS: 28 Core tests and one Catalog/company receipt suite on Linux. Includes the seven new transfer tests for fixed expiry, exact certificate/worker/attempt/storage binding, current authority, shared byte capacity, metadata-only reads and post-revocation effect evidence. |
| Actual API and CLI binary paths | PASS: independently upload 196,619-byte and 163,851-byte non-UTF-8 files, separately publish a revision and retrieve exact bytes through API, CLI stdout and a verified output file. The fixture explicitly selects a 1 MiB per-file cap; this is not a product default. |
| Replay and incomplete content | PASS: declared-length mismatch dispatches no attempt; wrong digest and disconnected uploads retain one attributable unresolved attempt and staged content. Receipt observation creates no new upload, charge or publication. |
| Certificate continuity and live revocation | PASS: another valid certificate of the same human can inspect but cannot take over the admitted transfer. A stalled upload receives 403 after its attenuated grant is revoked while Gateway remains healthy; the writer lock releases and the original expiry, reservation and staged prefix remain. |
| Response loss and shared capacity | PASS: upload/publication completion loss before and after Core acknowledgment, lost claim response, inactive-target receipt observation and simultaneous 70-byte requests against 100 available bytes retain their original effects and accounting. The fixture proxy forwards the new worker live-check route to Core using its same fixed certificate. |
| Restart and cleanup | PASS: unchanged service binaries/configuration restart with preserved state and receipts; the enclosing disposable PostgreSQL process is stopped. These are process tests, not VM sleep or storage power-loss tests. |
| Static checks and review | PASS: Rust formatting, warning-denying Clippy, repository integrity checks and an independent source review of the authority and worker/Gateway seams. Diagnostics contain fixed phase tags, intent UUIDs and numeric status only. |

The first combined test failed before reading its initial input because the fault-injection proxy
had not registered the new worker live-check path. Its exact route allowlist was corrected; product
authority, fixed deadlines and isolation were unchanged. Keep that failure separate from the later
passing connected run. Raw run records and source/binary identifiers remain in ignored research;
these documents do not require those local files to explain the supported behavior.

Reproduce with explicitly injected, disposable PostgreSQL URL files and fixture bindings:

```sh
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --all-targets --locked
OURO_TEST_DATABASE_URL_FILE=<core-url-file> cargo test -p ouroboros-core --tests -- --ignored
OURO_COMPANY_TEST_URL_FILE=<company-owner-url-file> OURO_CATALOG_TEST_URL_FILE=<catalog-owner-url-file> OURO_CATALOG_WORKER_TEST_URL_FILE=<catalog-worker-url-file> cargo test -p ouroboros-resources --test receipts -- --ignored
cargo build --workspace --bins --locked
python3 -B tests/contracts/test-resource-api.py --config <absolute-fixture-config-file> --binary-checks --storage-failure-checks
```

The fixture's binary report records actual cases and leaves slow-reader HTTP backpressure, memory
and throughput measurements, control under load, actual instance loss during transfer and natural
transfer-deadline expiry as **NOT RUN**. Unit monitor tests do not substitute for those connected
cases. Incomplete staging is retained; automatic partial retransmission or disposal is unsupported.
General retention/reclamation and protected-headroom enforcement still need their own implementation
and tests before the whole artifact increment can be called complete.

## Workspace Allocation and Retained Object Implementation Evidence

This allocation checkpoint connects the [allocation contract](CONTRACTS_AND_STATE.md#workspace-allocation-and-retained-objects)
to Rust Core, Gateway, CLI and Catalog. It adds explicit namespace allocation without new authority,
per-upload physical object identities, immutable revisions and typed durable holds. It does not
by itself implement retirement, collection or namespace-capacity release, and it does not qualify the complete
outer environment. Public design status and operational authority are unchanged.

| Executed surface | Observed result | Limit of the evidence |
| --- | --- | --- |
| Mac Rust workspace tests | 74 non-database tests passed, including 32 resource-library tests and 14 Gateway tests. | 36 database tests are ignored in this command and were separately executed below. The Gateway fixture needs permission to bind temporary loopback listeners. |
| Linux PostgreSQL 18.6 Core suites | 35 tests passed, including 7 new workspace cases. | Database tests use registered synthetic actors and worker receipts. They do not establish an actual Runtime instance's kernel identity. |
| Linux Catalog/company database suite | The existing receipt suite passed with new generation, hold, workspace and corruption cases. | Intentional commit failures and metadata corruption are installed by the disposable test owner, not exposed to runtime callers. |
| Human mTLS API and real Rust CLI | Workspace creation/list/detail, exact historical binary reads, stable-key replay, scope denial and recovery passed. | This workspace scenario used a human certificate, not a private native agent. Its bounded run made 23 HTTP and 3 CLI requests. |
| Integrated binary and storage-failure fixture | Existing binary, response-loss, shared-byte-capacity, current revocation and storage-replacement checks passed with the new object layout. | Same-UID fixture processes do not prove process credential isolation; physical SSD loss, VM suspension and power failure were not injected. |
| Source and repository checks | Mac/Linux builds used the same 79 allowlisted source/configuration files; formatting, Clippy, required files, tracked-secret-path rules, relative links and diff whitespace passed. | This is local evidence, not CI, public adoption or a deployment acceptance. |

The allocation tests demonstrate that a stable creation request obtains one server-assigned ID and
one retained namespace charge; changing its label conflicts. Leaf and every ancestor resource scope
must match the original namespace. Creation leaves authority rows unchanged. A different work with
the same human and namespace permissions cannot inspect, read or publish into the original work's
workspace. Paged metadata and historical resource receipt delivery recheck current permissions.
Broad work events, including legacy receipt-bearing events, reveal progress without detailed receipts.

Two simultaneous requests for the last available namespace slot produced exactly one admission.
The API scenario finished with four Core allocations and four Catalog creation receipts, retaining
all corresponding charges. Lost completion acknowledgment recovered the original initial receipt
after Catalog restart with one attempt and no second allocation. An independent inspector could
observe an originally dispatched creation after its submitting grant was revoked; observation did
not restore execution permission. All-service restart preserved these records and revocation state.

Two uploads of equal bytes produced different object IDs. Publication stored the exact object in
each immutable revision; upload holds and both revision holds survived a head change. Old and new
revisions remained readable. The Catalog suite verified shared file-lock lifetime after releasing
DB locks, incomplete metadata commits, missing-hold rejection, exact-object addressing without
legacy fallback and legacy receipt compatibility. Independent review identified an initial-snapshot
integrity gap: creation receipt observation now also verifies that revision 0 is exactly empty.
Corrupting that snapshot rejects observation and creation replay without silently repairing evidence.

Reproduction uses the existing injected fixture configuration and separately prepared disposable
Core/company/Catalog databases. After building the same Cargo lockfile, run the focused PostgreSQL
suites with their protected URL-file environment variables and the API fixture:

```sh
cargo test --locked --offline -p ouroboros-core --test workspaces -- --ignored --test-threads=1
cargo test --locked --offline -p ouroboros-resources --test receipts -- --ignored --test-threads=1
python3 tests/contracts/test-resource-api.py --config "$OURO_API_FIXTURE_CONFIG" --binary-checks --workspace-checks --storage-failure-checks
```

The recorded Linux run used the exact prebuilt test executables selected from Cargo's successful
build manifest. Test databases and ports were freshly allocated within the existing dedicated VM;
no additional VM, source checkout, subscription call or production deployment was created. Test
services and PostgreSQL were confirmed stopped afterward. Build identities, source hashes and
per-case local evidence remain in Git-ignored research storage; the design does not depend on those
files being present in a checkout.

At this allocation checkpoint, **NOT RUN / NOT IMPLEMENTED** included actual-instance workspace API
access through the bridge; native Codex using newly allocated spaces; credential/provider integration;
hold release, retirement, deletion and observed capacity return; long-reader HTTP backpressure/RSS
qualification; and physical storage/clock failure. The logical retirement increment below supersedes
only the hold-release and confirmed writable-slot portions. The later explicit collection increment
adds a separate, bounded byte-charge return path; the complete reclamation lifecycle remains incomplete.
Historical receipt observation is separated from eligibility for a new publication because a retained
revision's evidence can outlive the originating upload's eligibility.

## Logical Reference Retirement Implementation Evidence

The local [retirement contract](CONTRACTS_AND_STATE.md#logical-reference-retirement) is now connected
through Core, Catalog, Gateway and the Rust CLI. This increment releases named ordinary references
and returns a confirmed closed workspace's writable slot. It does not delete object bytes or return
upload byte charges, and it does not complete the artifact/reclamation or whole-environment goal.

| Executed surface | Observed result | Evidence boundary |
| --- | --- | --- |
| Mac Rust workspace | 84 non-database tests passed; formatting and Clippy passed. | The command leaves 41 PostgreSQL cases ignored; those were explicitly run below. Temporary loopback listeners were allowed for Gateway contract tests. |
| Linux PostgreSQL 18.6 | 40 Core cases and the Catalog/company receipt suite passed. The workspace suite includes 12 cases, five added for retirement. | Actors and completion records in Core tests are registered fixtures; they do not establish a real agent's kernel identity. Catalog tests use a restricted worker and owner-installed commit-failure/corruption fixtures. |
| Human mTLS API and actual Rust CLI | The bounded retirement scenario passed with 29 HTTP requests and one CLI request, followed by nine receipt reconciliations after all-service restart. | These counts describe the retirement scenario, not the surrounding binary/workspace fixture. No native model or subscription call occurred. |
| Connected regression and restart | Existing binary, workspace allocation, storage-failure, response-loss and revocation checks passed in the same run. Every owned fixture service and test PostgreSQL process was stopped afterward. | Processes share the guest test UID. Physical storage loss, VM suspension, guard behavior and process credential isolation are not qualified by this run. |
| Source and repository | The final Mac/guest source inventory matched 82 allowlisted source/configuration files. Required files, tracked-secret-path checks, relative links/anchors, Python syntax and diff whitespace passed. | Source and local test evidence are not CI, official architecture adoption or operating authority. |

The API scenario retired two upload-owner holds while both published revisions retained their own
holds and exact bytes. New publication from a retired upload was denied. An open current head could
not retire; retirement of revision 1 blocked its new reads while revision 2 remained readable.
Closing the workspace retained revision 2, all bytes and the historical allocation. One replacement
workspace used the single returned slot; a second extra allocation was denied. Byte budgets and
upload allocations remained exactly unchanged throughout retirement and all-service restart.

For the close-recovery case, the Catalog committed its closure and receipt, then a fixture proxy
withheld the completion request before it reached Core. Core retained its claimed attempt, missing
reply and charged slot. After Catalog restart, receipt reconciliation completed that original
attempt and returned exactly one slot. Replaying and reconciling the same intent returned no second
slot or Catalog effect. Every observed retirement matched one succeeded Core intent/attempt and its
exact protected body and receipt. Original upload, publication and workspace-creation receipts also
remained replayable after their live-use eligibility changed. Nine post-restart reconciliations
preserved the exact records, artifact hashes, hold lineage and allocation state.

Database cases cover explicit policy selection, nonzero minimum retention and unknown historical
age, current ancestor permissions, source work/namespace/store identity, concurrent publication and
retirement, pending publication after publisher revocation, exact close receipt recovery and a
single slot release. Workspace-close age follows its expected head's completion, not allocation age.
The Catalog exercises real deferred COMMIT failure, duplicate retirement, unexpected hold rejection,
independent hold release, stale upload-handle rejection and historical metadata lookup when fixture
bytes are missing. Missing bytes do not erase an original effect; new access still fails. At this
retirement checkpoint no test invoked a product collector; collection is separately implemented
and tested in the following increment.

Independent review found that a malformed publication completion could previously become a source
for retirement decisions. Core now compares the worker's JSON body and Catalog receipt to the fixed
intent and `expected_revision + 1`. Eight malformed completion variants leave state and reservations
unchanged and keep retirement blocked; the exact late receipt permits subsequent retirement. A real
DB regression also exposed over-application of namespace barriers to legacy reads. Barriers now apply
to registered namespaces, while removing a registered target's namespace configuration fails closed.
A plausible legacy configuration and matching legacy scopes cannot bypass a retired revision or
workspace barrier; restoring the original configuration restores permitted retained-revision reads.

Reproduction uses existing injected configuration and disposable database URL files; no personal
path or provider credential is required in source. Build the locked workspace's tests and binaries,
then execute the PostgreSQL suites and opt-in connected fixture:

```sh
cargo test --locked --offline --workspace --all-targets
cargo clippy --locked --offline --workspace --all-targets -- -D warnings
cargo build --locked --offline --workspace --bins
OURO_TEST_DATABASE_URL_FILE="$OURO_CORE_TEST_URL_FILE" cargo test --locked --offline -p ouroboros-core --tests -- --ignored --test-threads=1
cargo test --locked --offline -p ouroboros-resources --test receipts -- --ignored --test-threads=1
python3 -B tests/contracts/test-resource-api.py --config "$OURO_API_FIXTURE_CONFIG" --binary-checks --workspace-checks --retirement-checks --storage-failure-checks
```

The resource suite additionally requires explicit `OURO_COMPANY_TEST_URL_FILE`,
`OURO_CATALOG_TEST_URL_FILE` and `OURO_CATALOG_WORKER_TEST_URL_FILE`. The retirement flag requires
workspace checks and enables a fixture-only policy with zero waiting interval and scoped retirement
rights; these are not production defaults. The recorded Linux run selected exact executables from
successful Cargo build manifests, reused the existing VM/source/cache, and used fresh bounded test
DBs. Failed-run diagnostics and the succeeding records remain in ignored research storage.

At this retirement checkpoint, **NOT RUN / NOT IMPLEMENTED** included exact-object physical
collection, confirmed byte-charge return, legacy/incomplete-staging disposition, real-instance
retirement through the bridge, native harness use, provider credentials, physical device/clock
failures and HTTP slow-reader/RSS qualification. The following increment adds only the specified
binary collection subset and its prerequisites. Timeout, process exit and logical reference
retirement alone remain insufficient evidence to release storage bytes.

## Explicit Object Collection Implementation Evidence

The [collection contract](CONTRACTS_AND_STATE.md#explicit-object-collection) now connects an admitted
root and explicit bounded progress steps through Core, Gateway, the Rust CLI and Catalog. The
implementation removes an exact binary object only after its ordinary references have been retired,
then returns its original logical byte charge using the exact confirmed receipt. This completes
the listed collection path, not the entire artifact increment or outer environment.

| Executed surface | Observed result | Evidence boundary |
| --- | --- | --- |
| Mac Rust workspace | 104 non-database tests passed. After a Clippy-driven representation change, all 58 Resource Services tests passed again; final formatting and Clippy passed. | The workspace command leaves 48 database tests ignored. Those were separately executed on PostgreSQL; the resource rerun is not 58 additional distinct cases. |
| Linux PostgreSQL 18.6 Core | All 47 cases passed, including five collection cases in the 17-case workspace suite and two strict upload-completion cases in the binary suite. | Synthetic actors and receipts test Core transactions and authority; they do not prove actual Runtime kernel binding. |
| Linux Catalog/company suite | The receipt suite passed, then passed again against the final Resource Services build. | Owner-installed deferred COMMIT failures and metadata corruption are disposable test fixtures, not runtime administration features. |
| Human mTLS API and real Rust CLI | The collection scenario passed with 35 HTTP requests and one CLI request, followed by receipt checks after all-service restart. | This uses a fixture-owned OS shared file lock, not a slow HTTP reader or native agent. Counts exclude the surrounding binary/workspace/retirement scenarios and post-restart checks. |
| Connected regression and cleanup | Binary transfer, workspace allocation, logical retirement, completion-loss recovery and restart checks passed in the same API run. All owned fixture services and PostgreSQL processes were stopped. | Storage-generation replacement was not re-injected in this run. All services share the guest fixture UID, so it does not establish credential/process isolation. |
| Source and local checks | The final Mac/guest source inventory matched 87 allowlisted source/configuration files. Local repository, link/anchor, syntax and whitespace checks passed. | Core's tested source was unchanged by the final Resource Services representation change. These are local checks, not CI, public adoption or production qualification. |

The API test starts with two equal-byte uploads having distinct physical object IDs. Their upload
holds were retired; one revision still protects the second object. Collection admission and root
replay return `202` without creating an attempt or touching bytes. A real CLI advance encounters a
fixture-held shared lock and records `busy`, without a deletion marker or byte return. After unlocking,
replaying that step key remains observation-only. A new explicit key removes only the first UUID;
the equal-byte sibling, legacy content and unrelated files remain unchanged.

Retiring the second revision releases its hold without returning bytes. Its collection then removes
the second exact object and commits a Catalog receipt, but a fixture proxy drops the completion
request before it reaches Core. Core retains the original claimed attempt, absent reply and byte
charge. Catalog restart changes neither the files nor its receipt. Receipt-only reconciliation
completes the original Core outcome and returns the original charge once. In this fixture each object
has 20 bytes: the budget decreases by 20 for the first confirmed result, stays unchanged while the
second result is missing at Core, and decreases by the remaining 20 only after reconciliation.
This is logical charged capacity; actual free blocks, SSD discard and billing savings were not measured.

Upload allocations, workspace closure and slot accounting remain unchanged. Every collection keeps
its exact binding, principal, certificate, step sequence, dispatch history and unique storage-release
record. Original upload, publication, retirement and collection receipts remain available as metadata
after physical deletion. Root replay and reconciliation after all-service restart create no new step,
physical effect or byte refund.

Core database cases check stable-step replay without renewing expiry or budget, changed-input conflict,
supersession, concurrent claim, one-use dispatch, current ancestor/work/namespace authority, certificate
and configuration changes, expiry and progress by a currently authorized successor caller after the
original grant is revoked. Busy can be recorded after revocation because it is an observation; it
cannot overwrite a dispatched permit. A receipt before any dispatch is denied, while an exact late
receipt can settle a previously dispatched effect without restoring the caller's execution rights.
Malformed, legacy or unretired source uploads and unresolved publication dependencies cannot enter
collection. Fresh upload completion now validates its declared digest/size and exact body/receipt
identity. Seventeen malformed variants leave state and allocations unchanged. Historical stored
outcomes remain observable without silently becoming valid collection authority.

Catalog and storage tests exercise shared-reader conflicts, reverse-manifest detection of missing
holds, replaced/corrupt object rejection, marker COMMIT failure, denied final authorization, removal
followed by receipt COMMIT failure, and restart observation. An existing durable marker plus confirmed
absence can produce `observed_absence` without another unlink; an unmarked missing file cannot justify
a refund. The prepare path also recovers the marked-and-missing case. A source review caught loss of
the underlying filesystem `NotFound` error, which now remains distinguishable for this recovery.
Independent review also caught completion being checked after the same transaction had changed its
root state; validation now precedes that state change. Both corrections were included in the passing
database and connected builds. A large enum variant was boxed to satisfy Clippy without suppressing
the check; affected resource tests were rerun.

Reproduce using explicitly injected disposable database URL files and the existing fixture config.
The Core and resource suites require the same protected URL-file environment variables described in
the preceding sections. Build the locked workspace before starting the API fixture:

```sh
cargo fmt --all -- --check
cargo clippy --locked --offline --workspace --all-targets -- -D warnings
cargo test --locked --offline --workspace --all-targets
cargo build --locked --offline --workspace --bins
OURO_TEST_DATABASE_URL_FILE="$OURO_CORE_TEST_URL_FILE" cargo test --locked --offline -p ouroboros-core --tests -- --ignored --test-threads=1
cargo test --locked --offline -p ouroboros-resources --test receipts -- --ignored --test-threads=1
python3 -B tests/contracts/test-resource-api.py --config "$OURO_API_FIXTURE_CONFIG" --binary-checks --workspace-checks --retirement-checks --collection-checks
```

The opt-in collection flag requires workspace and retirement checks. It adds fixture-only `collect`
permission and a finite invocation allowance; neither becomes a product default. The actual run
selected exact prebuilt executables from successful Cargo manifests and reused the existing dedicated
VM, source directory and build cache. An initial wrapper invocation rejected an unsupported flag
before starting services; the corrected invocation and all failed diagnostics are preserved in ignored
research alongside the passing evidence. No credentials or local research paths are required in these
design documents. No actual model/subscription request, new VM, commit or public release occurred.

Still **NOT RUN / NOT IMPLEMENTED**: actual-instance collection through the bridge, native Codex using
the new artifact lifecycle, slow-reader HTTP backpressure/RSS, process death between unlink and
directory synchronization, power/device loss, general evidence/checkpoint/recovery holds, legacy and
incomplete-staging disposal, coordinated restore and protected physical headroom. Earlier broad V-28
through V-32 scenarios are not wholly qualified by these subset tests. Preserve unresolved charges
where identity, reference lineage, physical completion or receipt provenance cannot be established.

## Artifact-Backed Program Implementation Evidence

This increment connects individually published code/data to actual contained program execution.
It implements the [program contract](CONTRACTS_AND_STATE.md#artifact-backed-program-implementation)
and [Runtime path](RUNTIME.md#artifact-backed-program-runtime), not the full native continuation or
managed-adapter lifecycle. No actual model, subscription, provider credential or financial service
is used. The earlier native fixture results do not qualify this new program path for native Codex.

| Surface | Observed result | Boundary of the evidence |
| --- | --- | --- |
| Rust checks | Locked offline workspace build and Clippy with warnings denied passed. Mac tests passed 124 cases and Linux tests passed 136, including Linux-only Gateway identity cases; 54 database-dependent cases were explicitly ignored in each run. | Mac tests do not execute the Linux materializer or establish containment. The initial sandboxed attempt could not create test sockets; the same tests passed with local socket permission. |
| PostgreSQL Core | PostgreSQL 18.6 ran 53 cases across six Core suites, including six new program cases. All passed. | Synthetic Core instance identities test authorization/state behavior, not kernel identity. The remaining ignored Catalog suite belongs to the prior storage evidence. |
| Actual program and files | Human CLI published shell code and non-UTF8 binary data. Core froze exact revision/object identities. The contained materializer fetched both through the instance bridge, and the released program uploaded and separately published its output using the private CLI. Human CLI retrieved all 196650 output bytes with the expected digest. | A real shell program was used; DB/MCP/model calls and native start/steer/resume were not exercised in these runs. |
| Preparation barrier | Catalog was briefly paused to observe `materializing`. The actual instance's ordinary conditions request returned 403, output work had not started, and only registered input reads were admitted. Delivery receipts then matched instance/generation, manifest, ordered size/hash entries and actual files. | Trusted root test probes only observed the container. They did not copy input or launch private payload; Runtime performed those actions. |
| Restriction and termination | Separate delegation-revocation and execution-stop runs each denied actual Gateway access while the paused Runtime's container still ran. Resumed Runtime observed the respective restriction and confirmed termination before its original guard deadline. | The single observed latency is not a performance percentile or independent termination guarantee for every failure. |
| Natural completion | A third run finished by actual `exit 0`, without a stop/revoke request. Runtime recorded matching instance/generation/exec, zero exit, complete bounded output with exact byte counts and observed termination before the original deadline. | The zero process exit is separate from business success, resource return and unknown external effects. Input hash lines emitted by private code are reports; the trusted materialization receipt and independent byte round trip remain the delivery evidence. |
| Retention and accounting | A non-head input revision could not retire after program admission or after termination. Both input references and the 20-unit whole-instance compute reservation remained. Original output receipts remained observable without a duplicate effect. | Compute usage settlement, input release and successful successor admission are not implemented by this increment. |
| Process capabilities | Core, Gateway, Catalog and human CLI used distinct synthetic UIDs with no supplementary groups; service processes had no effective capabilities and no privilege gain. Probes denied other service key files and Docker socket access. Only Runtime held Docker management access. | These are disposable test certificates, not encrypted provider custody. Docker shares the guest kernel; the full bypass/pressure/failure matrix remains unqualified. |

Core tests cover fixed profile charge and complete properties, published source lineage, input
path/overlap/size rejection, and execution admission versus revision retirement in both orders.
The latter uses the same authority transaction boundary and leaves a durable revision dependency;
no Catalog hold RPC is needed while only the existing protected Core retirement path can release
that revision. This is whole-revision retention, with its associated space cost, not a new independent
checkpoint/evidence owner hold. A future alternative release path must preserve or replace this proof.

Materializing identities cannot borrow another instance's registered read, use ordinary management
or arbitrary resources, or replace the frozen target/configuration. Read admission is stable for the
instance/index and cannot redispatch a claimed/completed request. Read preparation records carry
`stage: prepared`; they cannot substitute for the Runtime report of actual EOF, digest, byte count
and file verification. Wrong instance/generation/manifest/file receipts, malformed source history,
and changed current grants/configuration block the appropriate preparation/release step. Inputs
stay retained across termination even if the helper or caller cannot report a final result.

Runtime tests cover descriptor bounds, destination traversal/overlap, symlinks, special files,
parent/root replacement, incomplete/oversized/hash-mismatched streams and receipt substitution.
The actual program uses a fresh instance, UID 65532, network-none, read-only image, dropped capabilities,
no privilege escalation, explicit tmpfs allocations and a fixed environment reset. Its normalized
absolute executable cannot be interpreted as an environment assignment. The inspected Docker
`HostConfig.Tmpfs` is checked against the exact profile; legacy Engine inspection may report no
entries in `Mounts`, so that list's length is not used as evidence of missing tmpfs mounts.

Reproduce only with an already selected local immutable image, the reference Linux profile and
explicit disposable configuration. The base image must contain the ordinary shell utilities named
by the preparation script. No image pull or provider call is performed:

```sh
cargo fmt --all -- --check
cargo clippy --locked --offline --workspace --all-targets -- -D warnings
cargo test --locked --offline --workspace --all-targets
OURO_TEST_DATABASE_URL_FILE="$OURO_CORE_TEST_URL_FILE" cargo test --locked --offline -p ouroboros-core --test programs -- --ignored --test-threads=1
bash tests/support/prepare-connected-program.sh "$OURO_PROGRAM_BASE_IMAGE_ID"
cargo build --locked --offline --workspace --bins
sudo python3 -B tests/integration/test-connected-program-guest.py --config "$OURO_PROGRAM_REVOKE_CONFIG" --restriction revoke
sudo python3 -B tests/integration/test-connected-program-guest.py --config "$OURO_PROGRAM_STOP_CONFIG" --restriction stop
sudo python3 -B tests/integration/test-connected-program-guest.py --config "$OURO_PROGRAM_COMPLETE_CONFIG" --restriction complete
```

The preparation step requires injected `OURO_TEST_PROFILE`, `OURO_TEST_STAGE_ROOT`,
`OURO_DOCKER_SOCKET` and `CARGO_TARGET_DIR`; the selected Rust/toolchain/cache paths remain operator
configuration. Put its exact resulting image ID into the disposable fixture configuration, with
explicit Core/Gateway/Catalog/bridge ports and pre-existing protected IPC parent. The fixture creates
no CA-derived owner authority: its setup explicitly registers synthetic principals, grants, profiles,
namespace and finite limits. Its trusted setup uses the disposable database owner for test state;
this is not a production Registry activation or provisioning API.

The three separate actual runs reused the dedicated VM, source checkout and build cache on operator-selected storage.
Each used a fresh disposable configuration and instance. Product Rust/migration/image inputs stayed
identical across the builds; only the fixture script gained the natural-completion case. All service and PostgreSQL cleanup was confirmed, and the original independent guard was observed
to leave by its own fixed deadline. The first wrapper invocation failed before services/work started
because its IPC parent was absent; that diagnostic is preserved beside the subsequent result in
ignored research. No working-tree cleanup, new VM, commit, Issue, PR or public release occurred.

Still **NOT RUN / NOT IMPLEMENTED**: controlled native start/steer/interrupt with these artifacts,
native checkpoint preservation, successful current-authority successor, exact execution usage
settlement, explicit dependency release, wake conditions, actual model custody and calls, DB/MCP
in this program workflow, full network/metadata/socket bypass cases, supervisor death and hot-output
or memory-pressure tests, device loss and coordinated restore. Keep the overall implementation goal
open; passing this program fixture does not establish a complete outer execution environment.

## Unresolved Publication Conflict Evidence

The [publication conflict boundary](CONTRACTS_AND_STATE.md#unresolved-publication-conflict-boundary)
is implemented in Core admission and claim. PostgreSQL 18.6 passed 55 Core cases, including two new
cases covering concurrent admission, late receipt recovery and pre-existing queue ordering. No new
schema, role, endpoint, execution permission or service was added.

Two concurrent publications for one workspace have one admitted winner. A separately authorized
grant and an alias for the same physical workspace cannot bypass the pending effect. A different
workspace remains available, and an ordinary read retains its own access path. Revoking the original
grant leaves the original attempt and reservation intact. Its assigned observer can recover and
record the exact late receipt; only then can a current authorized caller submit the next revision.
The revoked grant stays rejected. Conflict responses and failed claims leave all inspected Core
state unchanged, including invocation counts and events.

The second test models two queued requests admitted by the older implementation. Later claim is
blocked; the older accepted request can claim despite the newer queue entry. While that original
claim has no reply, later claim stays blocked. After the exact receipt arrives, the second request
obtains a distinct attempt. The original attempt is preserved, not reused or silently repeated.
The fixture constructs that older queue explicitly; it does not claim that current admission can
produce two concurrent owners of the same conflict boundary.

An initial test incorrectly changed a missing response to a state that the existing receipt path
does not produce or settle. That test failed, and was corrected to preserve the actual `claimed`
record for response loss. The product completion guard was not relaxed. Unsupported historical
states still require their appropriate reconciliation work and are not automatically certified.

Reproduce the added Core cases with a fresh explicitly configured disposable database:

```sh
OURO_TEST_DATABASE_URL_FILE="$OURO_CORE_TEST_URL_FILE" cargo test --locked --offline -p ouroboros-core --test receipt_recovery -- --ignored --test-threads=1
```

These Core tests use synthetic grants and worker reports. They do not themselves prove actual
Runtime replacement, an external Catalog commit with lost acknowledgment, or DB/MCP conflict
handling. The previous Catalog response-loss evidence remains distinct. Successful successor,
compute return and the full handover workflow remain **NOT IMPLEMENTED / NOT RUN**.

The actual bounded program workflow was rerun with this Core change and the previously pinned
immutable image. Input delivery, private upload/publication, human retrieval of the exact 196650-byte
result, zero exit, complete output recording and actual termination all passed. Input holds and the
20-unit compute commitment remained intact. All owned services, original guard and disposable
PostgreSQL instance were observed cleaned up. This is a normal-flow regression; the new unknown-effect
race itself was exercised by the Core database tests, not injected into this program run.

Locked offline builds, warnings-denied Clippy, formatting and repository/link checks passed. The
actual source inventory matched 96 allowlisted files. No model/account call, commit or PR occurred;
working research remains Git-ignored. This evidence advances the active goal without completing it.

## Original Allocation Observation Evidence

The bounded Linux artifact-backed program connection passed with the new Runtime: exact binary
inputs, guarded materialization, Gateway publication, zero program exit and actual container
termination remained connected. The initial and final cgroup identities matched. The original
`cgroup.events` descriptor returned ENODEV after termination, recorded as `deactivated`, and
the owned bridge termination completed. This does not assert an observed `populated 0`.
The compute reservation and input dependencies remained retained; neither capacity return nor
external-effect settlement occurred. The test's owned services, PostgreSQL and bounded runtime
helpers were cleaned up. No actual model or subscription call was made.

The Linux Runtime library suite passed 25 tests, including rejection of ordinary files as kernel
evidence and malformed, missing, duplicate or oversized population records. Runtime Clippy
passed with warnings denied. These are narrower than complete platform qualification. The new
observation path under supervisor loss, reboot, forced stop/revocation and pressure remains
NOT RUN. Core acceptance of a release receipt, duplicate-return prevention and successful
fresh-instance recovery remain unimplemented by this increment. An absent, populated, null or
contradictory observation must not be promoted to a capacity-return fact.

### Core Binding of Original Allocation

Core PostgreSQL regression tests passed 55 tests after binding allocation identity and adding
the historical-release guard. The Runtime control case rejects a missing allocation, a different
boot UUID, a zero inode and replacement of an already bound allocation. It confirms identical
retry, history retention and denial of private release from a historical binding without the
allocation. The fixture's restoration of original data is test setup, not a product mutation API.

The connected Linux program passed with allocation binding: the Runtime binding, initial
allocation record and final kernel observation contained identical allocation identifiers.
The subsequent historical-release guard was covered by Core PostgreSQL tests, not a repeated
connected run. Workspace Clippy passed with warnings denied. Neither this increment nor its
fixtures return capacity; duplicate-return and successful successor tests still await that
implementation. No actual model or subscription call was made.

## Compute Return Core Evidence

The Core PostgreSQL suite passed 55 tests with the return transaction. The Runtime control
case now rejects reports before termination, missing container/bridge/guard closure, a different
generation and a different assigned worker. After revocation and termination, two concurrent
identical reports succeed with exactly one stored receipt and one 70-unit decrement. A later
contradictory closure report conflicts. The test preserves a separate unsettled reservation,
confirms the execution intent has not become successful, and reads the return through both
the authorized execution view and assigned Runtime history.

Workspace Clippy passed with warnings denied. This test uses explicitly synthetic closure
reports to test the Core transaction; it does not prove Runtime closure detection. The live
Runtime does not yet submit return receipts. End-to-end capacity return, guard retirement,
interrupted closure observation, return-response loss over transport and fresh-instance
resumption remain NOT RUN. Existing connected runtime evidence must not be represented as
passing this new return flow.

## Connected Compute Return Evidence

Three bounded Linux artifact-program runs passed: natural completion, delegation revocation and
explicit stop. Each executed real code with exact binary inputs and Gateway publication, then
observed the original cgroup descriptor deactivation, bridge termination, guard termination and
exact Docker container termination. Core returned the original 20 compute units once. Retained
input references and the unresolved execution work outcome remained unchanged. The guard was
retired only after payload closure; explicit restriction took effect before its original deadline.

The revocation run removed only the local acceptance marker and used a new Runtime process to
replay the saved return. The stop run additionally repeated reconciliation with the acceptance
marker already present. Neither replay changed the Core snapshot or decremented capacity again.
This is local acknowledgement-loss coverage, not injected HTTP response-loss coverage. All owned
fixture processes were cleaned up. Workspace Clippy, formatting and document checks passed.
No actual Codex model/subscription call was made by these artifact-program runs.

The native and multi-instance management fixture expectations were updated for confirmed compute
returns; those updated fixtures are NOT RUN. Lost/incomplete closure records, abrupt supervisor
loss during guard retirement, whole-host failure, pressure and actual transport response loss
remain NOT RUN. Fresh-instance work continuation is still unimplemented. Earlier Core-only
return evidence describes an intermediate stage and must not replace these scope distinctions.

## Artifact Successor Evidence

The connected Linux artifact-program fixture passed a two-instance same-work flow: the first
instance published output and returned compute; the successor received fresh instance/generation
identities, materialized the original inputs plus that exact output revision, compared the
checkpoint bytes and published revision 2. Both compute returns were present, commitment returned
to zero, and the predecessor's two and successor's three input holds remained retained. The
predecessor intent was not rewritten as successful. Owned runtime/guard/container/service cleanup
completed. No actual native model or subscription call was made.

Core PostgreSQL tests passed 55 cases. The Runtime case checks denial with the old revoked grant,
new explicitly provisioned authority, fresh instance/generation, idempotent successor admission,
current capacity rejection and preservation of another unsettled reservation. A cross-work
fixture initially lacked the human's work-control entry and was rejected before reaching the
predecessor gate; the corrected fixture supplies that explicit test-only access and confirms the
separate same-work rejection. Product authorization checks were not weakened.

Earlier connected-return result summaries incorrectly retained the old static compute labels
while their transaction checks verified zero commitment; the successor fixture corrects those
summary fields. Previous raw reports remain preserved, and their stale labels are not evidence
of current accounting. Updated native successor-admission expectations remain NOT RUN. Actual
native checkpoint resumption, failed successor recovery, wake deduplication, ambiguous provider
effects and a full multi-instance failure matrix remain unfinished.

## Native Turn Identity Evidence

The Linux Runtime library suite passed 27 tests and Runtime Clippy passed with warnings denied.
New tests use an in-memory native protocol peer: they check steering/interruption IDs, ignoring
other thread/turn completions, acknowledgement versus terminal-event distinction, conflicting
terminal results, rejection of controls after completion, and a completion notification arriving
before its start response. The last case exercises the actual fixture response-reading helper.

These tests validate local protocol handling, not live Codex steering or interruption. At this stage, the changed
fixture has not yet been rerun against the real App Server. Core command admission, user API/CLI
control, native checkpoint transfer, response-loss reconciliation and actual model behavior
remain NOT RUN or unimplemented. No provider or subscription request was executed.

## Native Control Admission Evidence

Core PostgreSQL tests passed 55 cases. The Runtime case now exercises assigned-worker turn
reporting, duplicate reports, no automatic steering authority, same-target request idempotency,
different-turn rejection, a shared 16-request unresolved bound, human and instance actor
authorization, revocation and terminal reporting without restoring an active turn. The active
turn is visible through the existing authorized execution lookup. Gateway tests passed 28 cases
including the exact native-controls route; workspace Clippy passed with warnings denied.

These are Core transaction and Gateway routing tests. At this stage, live API/CLI native-control invocation,
Runtime delivery of queued commands, actual Codex steering/interruption and command response-loss
handling remain NOT RUN. Compilation of the updated native fixture is not live-harness evidence.
No real provider, subscription, new credentials or public deployment was used.

## Native Dispatch Local Evidence

Core PostgreSQL tests passed 55 cases with pending-control lookup, assigned-worker checks,
concurrent claim (one winner), no reclaim, current dispatch permission, denial after revocation
and idempotent original-attempt acknowledgement after revocation. Contradictory acknowledgement
is rejected. Linux Runtime tests passed 28 cases, including cancellation of a partial JSONL
receive followed by successful reconstruction of the original frame. Workspace Clippy passed
after restructuring two nested conditions without changing their behavior.

At this stage, the Runtime polling/claim/send/ack code compiles, but these tests do not execute that entire
loop against Codex. Live API/CLI-to-Codex steering/interruption, transport response loss, queue
fairness across obsolete requests, durable response replay and checkpoint recovery remain
NOT RUN. No model, subscription or credential operation was performed.


## Native Control Live Evidence

The bounded Linux `test-connected-native-guest.py --control-native` scenario passed with real,
unmodified Codex 0.153.4 inside the isolated instance. The image contains the fixture CLI and
fixed network probe; no owner account state was imported. The model endpoint serves synthetic
local responses through Gateway. This is actual native execution, not an actual provider call.

| Boundary | Observed result | Scope |
| --- | --- | --- |
| Existing task effects | The real harness performed the fixture file, DB, MCP and publication workflow before reaching a bounded control checkpoint. | One company result, one protected DB receipt and one publication receipt survived interruption. |
| CLI steering | The human mTLS CLI submitted a stable-key command for the observed thread and turn; Core claimed it and recorded the correlated native acknowledgement. | The fixture explicitly grants steering authority. Acceptance does not prove semantic influence on model reasoning. |
| CLI interruption | The second command was acknowledged and the native trace contained the matching thread/turn completed event with status `interrupted`. | Core turn status was independently queried; HTTP acceptance alone was not used as proof. |
| Closure and accounting | Runtime exited successfully, execution was terminated, the 70-unit compute return was visible and shared compute commitment was zero. | Committed resource receipts were retained; interruption was not treated as successful company work. |
| Fixture cleanup | Disposable PostgreSQL stopped with exit zero, its PID file was absent and evidence export completed without cleanup errors. | This does not test physical host failure or backup restoration. |

The scenario uses the same existing guest fixture configuration and pinned image preparation as
the native workflow: provide the required fixture paths and image to the script and select
`--control-native` instead of `--revoke-native`. It holds the native shell only within the existing
execution deadline, waits for a concrete task checkpoint, sends steer then interrupt, and checks
both control receipts and separate terminal evidence. Image/build identities and raw research
records remain in the ignored research area; this document does not depend on their local paths.

This result supersedes the earlier NOT RUN statements for the single live API/CLI-to-native
control path. Actual subscription use, semantic steering effect, native checkpoint recovery,
transport response loss, durable acknowledgement replay, obsolete-command queue fairness and the
full control/revocation failure matrix remain **NOT RUN or NOT IMPLEMENTED**. The next recovery
increment must retain an observed acknowledgement before attempting delivery to Core and must
never resend a potentially applied native command merely because its response was lost.


## Native Receipt Recovery Local Evidence

Linux Runtime tests passed 30 cases and workspace Clippy passed with warnings denied. New cases
verify that a claimed command and an incomplete temporary write produce no recoverable response;
an observed receipt survives repeated reads and identical saves; another instance or a
contradictory acknowledgement is rejected without replacing the original evidence. A bounded
HTTP test returns 503 on the first report and 200 on retry, checking that both calls target only
the original acknowledgement endpoint. This is a reporting failure test, not a simulated lost
native response or proof of a committed Core transaction.

The real fixture now persists the native response before posting it, and stop-only reconciliation
loads only matching execution/instance/generation/attempt receipts. Workspace compilation checks
that integration. The previous live native-control evidence predates this persistence change;
real Codex with injected failure between receipt persistence and Core delivery, repeated Runtime
reconciliation, and abrupt filesystem/host failure remain **NOT RUN**. Commands with missing
native responses remain unresolved and are not retransmitted. Native checkpoint and terminal
observation recovery still require further implementation.


## Native Receipt Live Replay Evidence

The real Codex 0.153.4 control fixture passed after receipt persistence was added. It observed
two durable acknowledgement files, then invoked the actual Runtime `--reconcile` command twice
against the original terminated instance. Both invocations completed successfully. The complete
Core acknowledgement rows were unchanged, compute return count remained one with zero committed
compute, company results and publication receipts remained one, and the native trace bytes were
unchanged. The fixture used synthetic local model responses and imported no owner credentials.

The first attempt failed in the Python test helper because it passed the subprocess timeout
argument twice. Its disposable PostgreSQL and evidence export were cleaned up successfully.
The helper now permits an explicit bounded timeout override; the subsequent full run passed.
Both attempts' raw results are preserved in ignored research storage.

This qualifies identical receipt replay through the real stop-only Runtime path. It does not
qualify loss between native acknowledgement and receipt persistence, loss after a Core commit,
Core outage during replay, process kill at the publication boundary, native terminal-report
recovery or native checkpoint restoration. Those fault-injection cases remain **NOT RUN**.


## Native Acknowledgement Timeout Evidence

The real Codex fixture passed with `--control-native --ack-timeout`. A disposable-database
transaction acquired an exclusive lock on the native acknowledgement table for eight seconds.
The test observed that lock before submitting a steering command, observed the durable Runtime
response file while the lock remained held, and kept the barrier beyond the two-second report
deadline. Runtime exited unsuccessfully. No production database, account or external provider
was used; the native model responses remained synthetic and local.

Before recovery, the observed Core acknowledgement count was zero. Actual stop-only Runtime
reconciliation created the single acknowledgement from the saved response. A second invocation
preserved the same one acknowledgement and one command attempt; the intent became succeeded,
native trace bytes remained unchanged, and the existing company result and publication receipt
remained single. Disposable PostgreSQL termination and evidence export both completed normally.

This establishes receipt recovery after a delayed Core transaction exceeds the delivery deadline.
It does not establish recovery of a lost native response, a host crash before file publication,
after-commit response loss, or terminal-event/checkpoint restoration. The fixture deliberately
accepts either zero or one pre-recovery receipt because a timed-out remote request could still
commit; this run specifically observed zero. Neither outcome permits resending the native command.


## Native Terminal Receipt Evidence

Linux Runtime tests passed 31 cases and workspace Clippy passed with warnings denied. The new
receipt test rejects active-status persistence, conflicting final status and a different execution;
missing evidence yields no terminal report, while an identical save is idempotent.

The real Codex 0.153.4 control fixture also passed with synthetic local model responses. It checked
that the saved terminal file exactly matched the execution, native thread, native turn and
`interrupted` status. Two actual stop-only reconciliations retained that Core status, the original
acknowledgements, one compute return, unchanged native trace and single company/publication effects.
Disposable PostgreSQL and evidence export cleanup completed successfully.

This verifies terminal persistence and identical report replay. It does not yet inject loss between
terminal persistence and its first Core delivery, or prove recovery of an unseen terminal event.
Native checkpoint/session restoration, multi-turn history export and physical crash durability
remain **NOT RUN or NOT IMPLEMENTED**. Earlier terminal-recovery NOT IMPLEMENTED entries describe
their earlier runs, not this subsequently added observation-only replay path.


## Pinned Native Resume Contract Check

A bounded, read-only, network-none invocation of the existing Codex 0.153.4 image successfully
exported its JSON schemas. Inspection of the default `ThreadResumeParams` confirmed required
`threadId` and the available current-configuration overrides; no inline `history` or `path`
property appeared. The ephemeral schema output was removed with the probe container. No home or
account data was mounted, and no native turn or model call was started. A warning that PATH aliases
could not be created on the read-only filesystem did not prevent successful schema export.

The attempted pinned public source URL returned 404 and was not used as implementation evidence.
Default schema export can omit experimental fields, so this check does not establish their
absence from all protocol variants. Actual selected-state export, consistency of a checkpoint
cut, current-authority import into a fresh instance and successful native continuation remain
**NOT RUN**. The implementation must verify these before making native resume available.


## Native Checkpoint Capture Evidence

Linux Runtime tests passed 32 cases and workspace Clippy passed. New tests reject outside-session
paths, traversal, different-thread content, incomplete JSONL and multiple session metadata records.
The real Codex 0.153.4 fixture passed with a 39137-byte selected rollout captured after interruption.
The fixture compared its execution/thread identity, byte count and digest, and required the manifest
to remain unqualified for resume. Inspection found one session metadata record and a `turn_aborted`
event. The ordinary command, receipt, resource and repeated-reconciliation checks also passed.
No real model account or subscription call was used; fixture cleanup completed normally.

This proves bounded extraction of the observed private file in that run, not a trustworthy or
quiescent checkpoint. Concurrent mutation/symlink replacement, interruption before complete capture,
artifact admission and retention, restore into a fresh native home, successful current-authority
resume, and incompatible-build rejection remain **NOT RUN or NOT IMPLEMENTED**. Capture provenance
must not be presented as evidence that the private transcript is an authoritative company ledger.


## Native Single-File Restore Compatibility

The bounded Linux `test-native-checkpoint-restore.py` probe passed using the existing Codex
0.153.4 image and the captured rollout. It copied only that digest-checked file into a new
container's empty bounded home, initialized a new App Server, and called `thread/resume` with
explicit current model/provider, approval policy, sandbox and working-directory settings.
The response retained the original native thread and its one previous turn, while reporting the
new `/workspace/recovered` cwd and the selected provider. No turn was started, no owner home or
credentials were imported, and the container had network `none`, no host mounts, no capabilities,
a read-only root and finite memory/PID/lifetime limits. The probe removed its container afterward.

The first attempt stopped at native configuration validation: a disabled MCP entry still required
valid transport configuration. Adding a non-listening loopback URL to that disabled entry allowed
initialization; outbound networking stayed unavailable. Both attempt logs remain in ignored
research. This correction is not permission to disable required tools in an actual company task.

This is native storage-format compatibility, not company successor qualification. Core admission,
Gateway-authorized checkpoint publication/read, registry/build compatibility, stable-cut capture,
retained obligations and a new turn with actual resource use are not exercised by this standalone
probe. The result explicitly remains `resume_qualified: false`; those product-path cases remain
**NOT RUN or NOT IMPLEMENTED**.


## Native Capture Through Managed Artifact APIs

The actual native-control fixture passed with a subsequent human mTLS CLI submission of the
captured session and its provenance manifest through the existing upload/content/publication APIs.
The catalog produced revision 2 after the task's revision 1 output. Repeating the identical
publication request returned the same response and retained exactly two publication receipts.
The CLI then downloaded the exact session bytes from revision 2. Removing `file.read` from the
synthetic owner's current delegation caused the next download to return 403 with no output file,
while the publication receipts remained intact. No new artifact bypass or secret access path was
introduced; the test used local model fixtures and normal disposable service cleanup.

This proves ordinary managed publication and current read enforcement for native-state bytes.
The submitter in this scenario is the fixture owner, not automatic Runtime custody or private
self-checkpointing. The original capture remains unqualified, and the manifest is submitted
content rather than independently certified provenance. Native successor input admission,
retention holds tied to that admission, fresh-instance materialization and resumed task execution
remain **NOT IMPLEMENTED / NOT RUN**. Read permission alone is not resume authorization.


## Native Input Admission Evidence

The disposable PostgreSQL Core suite passed after adding native-mode admission tests. The new
case verifies rejection without native profile activation, rejection of missing/unknown native
predecessors, idempotent admission of a fresh native request under an explicitly synthetic native
profile, and a Runtime claim carrying its retained immutable input with empty argv. It does not
launch that ticket. Contracts tests passed 4 cases and Linux Runtime tests passed 32; workspace
Clippy passed with warnings denied. Shared input validation now remains usable independently of
native/argv selection. The contract test covers wrong-mode activation, mixed argv, nonexistent or
traversing checkpoint destinations and omission of the new flag from legacy serialized profiles.

A positive native successor with proven predecessor/build lineage, current-read revocation at
materialization, and real native launch through this new ticket remain **NOT RUN**. Runtime rejects
the new materialized native profile before claim until that launch path is connected. The synthetic
admission fixture is not evidence of profile qualification or additional execution authority.


## Materialized Native Launch Implementation Check

The Runtime branch now routes an admitted native input ticket through existing materialization and
release, then the native driver. The resume installer checks admitted byte length/digest and
native identity before copying into an empty native home, verifies the copy and records its
instance binding. A new unit case rejects wrong size, wrong digest and a different native session
independently. Linux Runtime tests passed 33 cases; the preceding contracts run passed 4 and final
workspace Clippy passed with warnings denied. Workspace compilation includes the changed manager
and driver signatures.

No connected launch of this new native input profile was executed in this increment. Previous real
Codex fixture and standalone restore evidence do not establish its image contents, installation
behavior, current-read rechecks or resumed work effects. Those integrated cases remain **NOT RUN**,
as does the first compatible combined harness/materializer image. No activated live profile,
owner credential or model subscription was changed.


## Materialized Native First Execution Evidence

The existing pinned Codex image was extended with the current static CLI and materializer using
the existing offline COPY-only image builder. The resulting local candidate ran successfully in
the dedicated guest; no account files, host mounts, additional VM or model-provider calls were
introduced. This image build alone was not treated as qualification.

The `--control-native --materialized-native` fixture then passed twice. It creates a scoped input
namespace/workspace through the existing Gateway API, uploads and publishes a marker file, and
starts the explicitly native input profile. Runtime materializes the retained exact input before
Core release. The actual Codex fixture shell asserts the delivered marker's contents before its
file/DB/MCP/publication workflow. CLI steering, interruption, terminal capture, compute return
and two stop-only reconciliations pass through the new branch. The second run publishes captured
native state and its manifest into that same managed input namespace at revision 2. Exact-byte
readback, identical publication replay and denial after current read-right removal also pass.
Both runs completed disposable PostgreSQL cleanup and evidence export normally.

This supersedes earlier NOT RUN entries for a fresh materialized native launch and the combined
image. It still uses a synthetic model endpoint. A current-authority native successor that installs
revision 2, resumes the same thread and performs a new turn is **NOT RUN**; the standalone restore
probe does not satisfy that requirement. The captured cut and private provenance remain
unqualified beyond the stated bounded capture checks.


## Connected Native Successor Evidence

The actual `--control-native --materialized-native --successor-native` guest fixture passed.
After the predecessor was interrupted and its session was published at managed revision 2,
starting a successor with the old delegation failed with 403 because its read right had been
removed. The fixture created explicit new synthetic human and child-agent grants without changing
the old grant, then admitted a same-work successor carrying the original task input at revision 1
and the exact session at revision 2. The native profile/image remained the same.

A new actual Runtime instance materialized both inputs, installed the checkpoint and resumed the
same native thread. Its resume response included the predecessor turn; a distinct new turn reached
`completed`. The native restore record matched the successor execution and instance. Core held
two compute returns and zero committed compute; three retained execution-input records remained.
The original company result stayed single and the three existing publication receipts did not
increase. The synthetic model returned a continuation completion from the restored tool history;
this does not establish a new research decision or additional external business effect. Both
fixture containers and the disposable database were cleaned up normally.

The raw first report retained stale `native_successor_admission: NOT IMPLEMENTED` and top-level
`native_checkpoint_recovery: NOT RUN` labels while its nested successor result and assertions
passed. The report template now derives those labels from the actual successor result; the raw
historical report is preserved. This section states the narrower proven outcome explicitly.

This supersedes earlier NOT RUN entries for one connected native predecessor-to-successor flow.
Actual model/subscription behavior, adversarial checkpoint cuts, incompatible native histories,
authority changes during restore, abrupt-host recovery and the full failure matrix remain
**NOT RUN or unqualified**. The successful synthetic path does not complete the overall goal.


## Invalid Managed Checkpoint Evidence

Two full predecessor/checkpoint/successor guest scenarios passed their expected-rejection checks:
`--invalid-checkpoint identity` publishes a different `session_meta.payload.id`, and
`--invalid-checkpoint truncated` removes the final newline from the captured session. Each changed
file is uploaded and published with its correct new digest through the normal API. Thus the
materializer successfully delivers an authorized, digest-valid artifact before native semantic
validation rejects it. These cases do not simulate undetected storage corruption.

Both successor processes exited unsuccessfully with the expected validation reason. Materialization
receipts existed, but neither a native restore-complete record nor a native protocol trace existed.
Core recorded zero successor `model.responses` calls. The previous company result and three
publication receipts stayed unchanged; three execution-input references remained retained. Both
compute allocations had closure returns with zero committed compute. Both scenarios completed
container/database cleanup and evidence export normally. Result fields identify the outcome as
`rejected_before_native_start`, not a successful resume.

This verifies two specific rejection boundaries after valid managed delivery. It does not verify
all malformed histories, compatible-looking malicious content, storage corruption, concurrent
mutation or revocation during installation. Those cases remain **NOT RUN**. A valid digest binds
bytes and cannot certify native meaning, lineage truth or current execution authority.

### Revocation during managed checkpoint reading

**PASS — one actual guest run, synthetic model transport, no subscription or provider calls.**

Reproduction uses `tests/support/prepare-checkpoint-read-fixture.py --image IMAGE_ID --socket SOCKET`
with the already qualified native/materializer image. It builds without network access or image
pulling and emits the derived immutable image ID. Select that test image in the disposable fixture
configuration and run `tests/integration/test-connected-native-guest.py --config CONFIG --control-native
--materialized-native --successor-native --revoke-restore`. The existing disposable fixture
orchestrator supplies dedicated service identities, stores and teardown; this is not an instruction
to run against a live company database.

After a real native predecessor completes its fixture effects and is interrupted, its captured
checkpoint is published normally. The successor receives current synthetic grants and both exact
inputs. A test-image barrier holds the checkpoint source read, with a readiness marker visible
only to the trusted test controller. The controller verifies materialization and absence of a
native trace, then revokes the successor parent delegation through the ordinary CLI. It does not
release the barrier, stop the Runtime manually or edit the authority database for this revocation.

The observed successor exit was unsuccessful with `403 Forbidden`, rather than the restore timeout.
No restore-complete record or native trace existed, and zero successor model calls were recorded.
The original company result, three publication receipts and three input references survived. Both
compute returns were recorded and committed compute was zero. Container cleanup, disposable
PostgreSQL shutdown and evidence export completed successfully. The report identifies this as
`revoked-during-checkpoint-read` and `rejected_before_native_start`, not a completed recovery.

The wrapper changes only the test image's bounded read behavior; it grants no bypass or additional
Runtime authority. Revocation during the subsequent installation write, simultaneous checkpoint
mutation, VM suspension and real-provider authentication remain **NOT RUN** for this scenario.

### Shared execution admission transaction

**PASS — disposable PostgreSQL Core suite after the admission extraction.** The authenticated
start method uses a transaction-owned admission function so a future wake occurrence can be bound
atomically to its execution intent. The added
`late_execution_admission_failure_rolls_back_all_effects` test injects a firm-specific failure on
outbox insertion, after execution and reservation writes. The call fails; executions, reservations
and outbox remain empty, and committed compute remains zero. Removing the injected failure permits
the same request key to succeed; replay returns that same intent. The test does not establish wake
deduplication, which remains **NOT RUN** until occurrence storage and delivery are implemented.

### One-shot registration policy checks

**PASS — disposable PostgreSQL Core suite.** The new human scenario verifies that an ordinary
execution grant cannot register a wake, two concurrent identical registrations share one intent,
changed input conflicts, and registration leaves compute and execution count unchanged. It also
verifies cancellation, replay without reactivation and rejection of a fresh registration after
revocation. A separately authorized inspector can still observe the retained registration.

A second scenario uses the existing explicitly fabricated Runtime-binding fixture to verify
agent registration and own-work cancellation, rejection of another work or grant, and rejection
of cross-work inspection/cancellation. This is a Core actor-policy test, not new Linux kernel
identity qualification. Gateway route tests cover the exact registration, read and cancel paths.
The wire handlers and generic CLI path are connected; an end-to-end mTLS wake-specific run remains
**NOT RUN**, as do timed delivery, restart deduplication and authority revalidation at occurrence
admission. No timer or subscription call ran during these tests.

### Connected timer delivery qualification

**PASS — PostgreSQL Core tests and real Core/Gateway/mTLS CLI processes.** Concurrent deliveries
of one due registration commit one occurrence, one execution intent and one reservation. A second
wake for the same active work is deferred. A reconstructed Core returns the original mapping.
Cancellation prevents subsequent claim and delivery while preserving the unresolved reservation.
An explicit instance-origin continuation can be claimed after its source instance terminates;
an ordinary instance-origin request is not upgraded to this behavior. Current grant revocation
still denies continued authority.

`tests/contracts/test-wake-api.py`, using the existing disposable DB/API preparation scripts, enables the
Core timer at 100 ms and registers a future occurrence through the actual mTLS CLI. It observes an
accepted execution intent after the due time, checks committed compute of 70, restarts the exact
Core process and verifies the same intent and reservation. It then cancels through the CLI and
replays the registration without reactivation. No Runtime or provider is started by this fixture.
The first attempt failed before service startup because its orchestration omitted required DB
metadata; that failure and clean teardown were preserved. The corrected disposable run passed
and all created services and PostgreSQL exited normally.

Remaining **NOT RUN** cases include a timer-created actual native successor, clock jumps/suspend,
occurrence commit-response loss, a storage failure specifically on occurrence insertion, pending
reservation settlement after pre-dispatch cancellation, and integrated timer event/dependency
sources. Core function tests with fabricated bindings do not establish Linux isolation. Successful
request delivery is not evidence of completed private work or economic performance.

### Timer-created native successor

**PASS — actual isolated Codex with synthetic local model responses.** The connected native fixture
now supports `--control-native --materialized-native --successor-native --wake-successor`. It runs
the predecessor's file/DB/MCP/publication workflow, captures and publishes its checkpoint, denies
old read authority and creates explicit new synthetic grants. It registers the exact successor
request through the CLI instead of calling the start endpoint for that successor.

With the Core timer enabled, the fixture observes one occurrence and its execution intent after
the due time. Registration replay returns the same wake. Runtime claims that intent, delivers the
original input and checkpoint, and starts a different isolated instance. Actual Codex resumes the
same native thread and completes a different turn. The original company result and publication
receipts remain unchanged, both compute allocations return, and teardown/evidence export succeed.
The result explicitly identifies admission as `core_timer` and retains its wake ID.

This run qualifies the connected timer-to-native-resume mechanism for the pinned fixture image.
The restored turn produces a synthetic completion based on earlier fixture history; it is not a
new business effect, real subscription response or proof of economic performance. Agent-authored
persistent conversations, queued-message delivery, real provider custody, timer clock anomalies
and autonomous event/dependency sources remain separate unfinished work.

### Persistent conversation record qualification

**PASS — disposable PostgreSQL Core suite and actual mTLS API/CLI processes.** The Core scenario
verifies concurrent duplicate sends, changed-input conflict, authenticated human and agent author
records, actual-instance provenance from the fabricated binding fixture, cross-work denial,
rejection of cross-conversation reply references, and current read permissions. After source
instance termination, its access is denied; another admitted instance of the same agent can read
the identical preserved conversation. A reconstructed Core returns the same ordered message page.

`tests/contracts/test-conversation-api.py` uses the existing disposable DB and API preparation scripts to
run actual Core/Gateway binaries and the mTLS CLI. It creates a conversation, persists one human
message despite replay, checks authenticated attribution and cursor reads, restarts Core and
verifies identical content. Committed compute remains zero. Both the API run and database suites
completed with their owned processes stopped and disposable PostgreSQL shutdown confirmed.

These tests do not demonstrate a native model generating or receiving a conversational reply.
Native message delivery, acknowledgement/answer collection, wake-on-message, interactive UI,
attachment handling and conversation storage-retention accounting remain unfinished. The agent
reply in the Core scenario is explicitly authored test input through a fabricated instance actor,
not a real Codex answer. Gateway route tests and Rust static analysis cover the added wire paths.

### Stored-message native delivery and group policy

**PASS — PostgreSQL Core policy tests and one actual isolated Codex delivery path.** The connected
native fixture supports `--control-native --materialized-native --conversation-control`. It
creates a conversation and stores a human message through mTLS CLI, then delivers that message ID
to the actual native thread/turn. Duplicate delivery identifies the original control intent.
The native acknowledgement is reflected in that recipient's message projection; the fixture then
interrupts and reconciles using the existing independent control path. Company effects and
checkpoint publication survive, and both native runs before/after group schema changes exited
and cleaned up successfully. The model transport remained a local synthetic fixture.

The group Core scenario creates two human principals and two distinct logical agent principals,
all explicitly scoped to the shared work. They author four messages in one conversation, each
with three other recipients. The same human message admits separate native controls for the two
agents. Excluding one agent denies its read and pending claim, while the other agent's claim still
succeeds. Reply records and the original recipient list remain preserved. The fabricated Runtime
bindings in this test do not prove a live two-agent conversation or autonomous model exchange.

Additional Core coverage verifies that the stored text is the native instruction, changed target
turn conflicts, and removing recipient conversation-read permission prevents dispatch even when
execution-steer remains. Re-admission does not revive deliveries from an earlier membership
revision. Actual native answer collection, live multi-agent fan-out and group conversation wake
behavior remain **NOT RUN**. A succeeded delivery intent proves native command acknowledgement,
not that the message received a meaningful answer.

### Actual native addressed reply path

**PASS — actual isolated Codex, managed Gateway calls, synthetic fixed reply text.** The connected
fixture adds `--conversation-reply` to `--control-native --materialized-native
--conversation-control`. Its model fixture supplies the native tool command that discovers the
instance's work conversations, reads the persisted human message and verifies its exact text,
waits for the explicit native delivery acknowledgement, then posts a reply through the instance
Gateway CLI with the original message ID as `reply_to`.

The human CLI observes two messages. The reply has the expected agent principal, actual instance,
original message reference and Core-observed active native execution/thread/turn. The fixture then
uses the existing interrupt/reconciliation path; original business effects and checkpoint records
remain, compute returns, and all created containers/services and disposable PostgreSQL are cleaned
up. Core regression tests and the Gateway/static checks passed for the added correlation/discovery
path.

The reply text and tool workflow are controlled fixture inputs, not an independently generated
real-provider answer. No subscription call took place. This proves the addressed read/reply
mechanism through a real native harness; it does not prove semantic response quality, spontaneous
conversation discovery, autonomous multi-agent dialogue, queued wake routing or an interactive
chat UI. Automatically copying unaddressed native output into a room is deliberately not the reply
contract.

### Conversation CLI command coverage

Local CLI tests cover UTF-8 and newline preservation, explicit reply routing and delegation,
absence of caller-authored identity fields, negative cursor rejection, and bounded rejection of
blank, NUL-containing and oversized message files. A subsequent disposable Linux PostgreSQL/Core/Gateway test passed using the named CLI list,
send and read commands over actual mTLS. It checked authenticated human attribution, stable-key
replay storing one message, cursor pagination, unchanged records after Core restart, and no
compute reservation for message storage. The exact owned test database process was stopped and
its absence confirmed. This does not establish instance-bridge use of these new command names,
autonomous group conversation, or subscription/model access; those remain separate checks.

### Credential envelope primitive checks

Local resource-library tests pass for synthetic round-trip consumption, substitution of owner,
credential ID or version, every single-byte envelope mutation, wrong unlocking key, truncation,
and oversized plaintext. Authentication failures do not invoke the consumer callback. These
checks do not prove durable storage, nonce/key lifecycle across backup or restart, process
isolation, provider response redaction, revocation or operation-only network dispatch. Those
remain NOT RUN. No real credential or provider call was used.

### Custody PostgreSQL persistence checks

The disposable Linux resource-receipt suite passed synthetic encrypted insertion, duplicate
version rejection, reconstructed-store consumption, absence of the literal synthetic credential
in the stored envelope, idempotent disable, denial after disable, and a separately usable next
version. Its test database process was stopped and confirmed absent. The fixture executes the
custody table definition in the disposable owner database; it does not prove production custody
role separation or deployment migration wiring. Concurrent disable/dispatch, crash/commit-loss
reconciliation, stale restore, key rotation, async sender integration and real credentials remain
NOT RUN.

### Custody restricted-role checks

A disposable PostgreSQL test passed using a separate LOGIN role and column-level grants for
custody operations. Normal insert/consume/disable still passed. Direct ciphertext UPDATE,
DELETE, TRUNCATE, trigger disabling, table DROP and disabled-version re-enablement were denied.
The constructor rejected the test administrator connection and accepted the restricted worker.
The test used synthetic keys and isolated temporary database processes, which were stopped.
It does not qualify host secret custody, continuous role-change detection, historical restore,
Core activation or provider dispatch. The new migration CLI branch builds; an independent
custody-database deployment using that branch remains NOT RUN.

### Linux unlocking-key input checks

The actual Linux guest resource-library suite passed 46 tests, including the explicit key
loader with a synthetic 32-byte file. It accepted protected input and rejected a symlink,
hardlink, group-readable key, non-private parent, relative locator and empty/short/long key.
Workspace Clippy passed. This does not prove private-mount exclusion, separate service ownership,
filesystem backup protection, key rotation or real provider-worker startup; those remain NOT RUN.

### Asynchronous custody-use checks

The actual disposable PostgreSQL receipt suite passed a coordinated asynchronous consumer and
concurrent disable: disable remained pending until the consumer released its row lock, then
completed, and a later consumer was denied before invocation. A deliberately pending consumer
hit its explicit time budget, returned `OutcomeUnresolved`, and a subsequent disable completed
within the test bound. No network effect was performed. These checks do not prove immediate
revocation of an open provider stream, remote cancellation, process-crash recovery or safe
retry. Workspace provider integration remains unfinished.

### Durable custody-use claim checks

The actual disposable PostgreSQL resource suite passed retained-claim lookup from a reconstructed
store, repeat-attempt rejection without callback entry, and restricted-worker rejection of claim
UPDATE, DELETE and TRUNCATE. Existing async disable/timeout tests also passed with claims enabled.
The database was stopped after the suite. This verifies local storage/replay behavior, not a
process-kill test during provider send, a Core-linked attempt, external exactly-once delivery or
stale-backup recovery; those remain NOT RUN.

### Provider worker wiring checks

The Linux workspace builds and actual PostgreSQL suites passed provider target-substitution
rejection before authorization, a denied authorization callback, and rejection of the same
attempt without re-entering the callback. The authorization-denial test deliberately makes no
network call. Existing Core integration suites also passed with model live checks enabled.
Provider HTTP success, redirect/response-reflection behavior, actual worker startup, native
stream use, current Core-linked model revocation and subscription access remain NOT RUN.

A whole-workspace Mac build attempt encountered existing unconditional native-fixture references
to the Linux-only Runtime manager. The Linux workspace build passed; the Mac resource package
build passed independently. This is not evidence that the whole workspace currently builds on
Mac. The host CLI and Linux execution profile remain separate verification surfaces.

### Loopback HTTPS provider round trip

The actual Linux receipt suite passed an HTTPS synthetic-provider round trip using the encrypted
custody store and restricted DB worker. The server verified the synthetic bearer header and
received the fixed `/responses` path. The sender preserved the native JSON response, retained
the requested model separately, rejected replay of the same attempt, and rejected literal
credential reflection, HTTP 500, oversized response and HTTP 307. Exactly five server requests
were observed (one success and four negative cases); the replay caused no extra request and the
redirect was not followed. Test errors contained no synthetic credential. The child HTTPS
server was terminated and waited for, and disposable PostgreSQL cleanup completed.

The first run failed at the response step with the fixture's default self-signed certificate.
After setting server end-entity constraints and serverAuth usage in that fixture, the same test
passed without disabling TLS verification. This does not establish the full cause of every TLS
failure or provider account compatibility. Core authorization in this sender-level test is an
in-process callback; actual Core/Gateway/provider-process wiring, native streaming, revocation
during send, provider-confirmed usage extraction and subscription access remain NOT RUN.

### Provider metadata observation checks

Unit checks pass requested-independent reported fields, missing usage/effort/total preservation,
negative and inconsistent counts, detail-count bounds, malformed SSE and duplicate terminal
response ambiguity. The actual Linux PostgreSQL + loopback HTTPS suite passed distinct requested
and reported model values, reported input/output counts, and absence of a fabricated total.
This remains a synthetic provider response, not real account usage or billing evidence. Provider
streaming and a Core/Gateway process-level observation path remain NOT RUN.

### Corrected model pre-dispatch live-check coverage

Inspection found the earlier model-operation allowance had been added to the file transfer
access check rather than `resource_live`. Existing regression-suite success therefore had not
proved that provider pre-dispatch authorization worked. The allowance has been removed from
file transfer access and applied to the intended currently-claimed resource live check.

A new actual PostgreSQL test admits and claims `model.responses`, checks the exact attempt and
worker without changing the recorded state, rejects a different attempt or worker, rejects file
transfer access for the model intent, and rejects the live check after delegation revocation.
The complete Core integration suites passed with this test included. This corrects the earlier
coverage gap; actual Core/Gateway/provider-process HTTPS wiring remains a separate NOT RUN item.

### Actual CLI/Gateway/Core/provider process connection

The Linux disposable receipt suite now launches actual Core, Gateway and provider worker
processes with mTLS identities, a separate Core database, a restricted ciphertext-custody DB
role, explicit protected key input and a trusted loopback HTTPS certificate. The human CLI
creates work and sends a native model request through Gateway. The provider obtains the actual
Core claim, rechecks current Core permission and sends to the synthetic HTTPS server.

The test passed native response return, a succeeded Core intent, and the persisted Core reply
containing distinct requested/reported models and reported output tokens. It then revoked the
fixture delegation in the test owner database: the next CLI request failed and the HTTPS server
request count did not increase. Service logs did not contain the synthetic bearer value.
All child services and the synthetic HTTPS server were terminated and waited for; disposable
PostgreSQL cleanup completed. No external account or model was used.

The initial process tests failed HTTP 403 because the fixture target scope omitted `inspect`.
Adding explicit target inspection scope allowed the same product path to pass; no runtime
permission check was relaxed. Those failures remain separate from the corrected passing run.
This fixture shares an OS identity among trusted services and uses synthetic provisioning, so
it does not establish service-UID isolation, enrollment approval, runtime-private exclusion,
API-driven revocation, streaming interruption or subscription compatibility. It does establish
the real process path previously represented only by a callback in the sender test.

### Restriction during actual provider response wait

The Linux process-level fixture started a second HTTPS request whose server delayed its body
for three seconds. After the server recorded receipt, the test revoked the delegation through
its owner-only fixture DB connection. The CLI failed within the asserted 1.5-second test bound
and emitted no response body. Core retained exactly one unresolved claimed model intent, and a
subsequent denied request did not increase the server request count. Normal response/metadata
checks remained passing. All fixture services were terminated and PostgreSQL cleanup completed.

This is evidence of actual Core-driven restriction during a buffered response wait. It is not
an API-driven revocation test, remote cancellation proof, incremental private-stream delivery,
resource-usage reconciliation or timing assurance under suspension, contention or Core outage.
Those cases remain independently required.

### Human API revocation and Core outage during provider wait

The process fixture now uses a separately scoped synthetic control delegation and the actual
human mTLS CLI `revoke` command. It reads the current revision through `conditions`, submits the
revoke with that revision and stable key, verifies Core recorded revocation and advanced the
firm revision, and observes the pending provider call fail without returning a body within the
1.5-second test bound. The prior owner-DB mutation is no longer used for this scenario.

A preceding scenario terminates only the disposable Core while an HTTPS request is waiting.
The CLI fails without body in the asserted bound. Restarting Core from the same DB restores
service availability while preserving that claimed, unresolved model intent. The following
API-revoked request likewise remains unresolved, producing two retained claims. A new request
under the revoked delegation does not reach the provider. The combined Linux PostgreSQL and
actual-process suite passed and its services were stopped.

These tests establish local fail-closed behavior for authority-service loss and the real human
control path. They do not prove remote cancellation, refunded cost, recovered provider usage,
safe retry, private incremental streams or host-suspension timing. The shared fixture OS identity
and synthetic enrollment remain separate from production credential/process isolation.

### Retained provider reply checks

The Linux PostgreSQL/HTTPS suite passed storing a native reply, reading the same body and receipt
from a reconstructed sender, refusing an altered original ticket and denied read authorization,
and rejecting operating-role UPDATE, DELETE and TRUNCATE of result records. The HTTPS request
count remained unchanged by recovery. The actual process path continued to pass with persistence
before Core completion. The following process test extends this evidence to the Gateway recovery
route. Worker-crash injection, retention accounting and stale-backup reconciliation remain NOT RUN.

### Provider recovery through API after failed completion

The actual Linux CLI/Gateway/Core/provider/HTTPS fixture passed with an owner-installed trigger in
its disposable Core database rejecting the provider's succeeded-state transaction. The native
request failed at the client while the saved worker receipt and sole claimed attempt remained.
After removing the injected failure, CLI `request POST /resource-intents/{intent}/reconcile`
returned the original native body, completed the original Core intent and preserved exactly one
attempt and one upstream call. No secret or execution ticket is supplied by the caller.

After revoking the original execution delegation, reconciliation using that delegation was denied.
A separate current inspect scope recovered the same result without increasing upstream calls.
The Core PostgreSQL tests additionally compared the recovery selector with the original ticket,
rejected a different worker, and verified observation after revocation did not mutate the state
snapshot. Linux workspace build, Clippy and the resource/Core PostgreSQL suites passed; fixture
processes and disposable databases were cleaned up. These results establish failed-completion
recovery, not process-crash, live subscription or production service-identity isolation proof.


### Explicit managed native targets

The actual CLI/Gateway/Core/provider HTTPS test passed with `managed-model` replacing the former
hardcoded model target. Its failed-completion recovery, Core outage and API revocation scenarios
still passed, without extra upstream calls. The separate resource API fixture passed with explicit
model/MCP route configuration. Both disposable database runs completed cleanup.

All 29 Linux Gateway unit tests and workspace Clippy passed. Route tests cover missing routes,
unknown configured targets and no fallback. The bootstrap authority test retains its original
403 expectation with an explicit test model route, rather than accepting an earlier unconfigured
503 as proof of authority enforcement. The following isolated Codex runs verify the updated
launcher. No real provider account or credential was used.


### Isolated Codex with explicit native routes

Two finite Linux runs using the existing pinned native image and explicit Gateway route
configuration passed. The normal workload recorded three synthetic Responses requests, one DB
read, one DB write, four MCP requests, two file reads, one upload and one publication. The native
command result and completed MCP event, rather than model narration, establish actual tool use.
The persisted DB effect receipt and publication revision each appeared once; the 13-byte result
matched Core allocation and catalog staging. The test also verified service UID separation,
cross-service credential-read denial, non-Runtime Docker-socket denial and the existing limited
private direct-access probes. This is not the full bypass matrix.

The second run acknowledged CLI steering on the actual bound native turn, observed its matching
interrupted event, published the checkpoint and resumed that same native thread in a new instance.
The predecessor's removed read right remained denied. Explicit new synthetic grants permitted the
successor's two materialized inputs; its completed turn differed from the predecessor's turn.
Original DB effects remained singular, publication records were preserved and both observed compute
returns reduced committed compute to zero. This proves current-authority checkpoint restoration in
the fixture, not autonomous credential or authority provisioning.

Both runs reported PASS and exported the selected result/runtime evidence; their exact disposable
PostgreSQL clusters stopped, postmaster markers were absent and fixture containers/services were
removed by the test cleanup. These native runs use the existing controlled model fixture, not the
new encrypted provider sender. The following run covers that integration with synthetic credentials.
Live subscription authentication, incremental provider streams and production custody enrollment
remain NOT RUN.


### Isolated native Codex through encrypted provider custody

The Linux native fixture now supports `--encrypted-provider` for the normal workload. A dedicated
provider OS user holds its own TLS identity, restricted custody DB credential and private 32-byte
key file. The disposable fixture owner prepares one AES-GCM envelope with the exact firm/credential/
version binding; this uses Python cryptography only as fixture setup and is not a production
enrollment path. A different unprivileged OS user serves loopback native Responses over TLS with
a three-request cap. No account, paid model or real token is involved.

The integrated run passed: actual Codex used MCP and its shell, read files, committed the prepared
DB transaction, uploaded and separately published its result. Its three model requests traversed
instance bridge, Gateway, Core admission, the actual provider worker and loopback HTTPS. The
custody database retained exactly three use claims and three replies. Core receipts recorded
`fixture-model` as requested, `fixture-confirmed-native` as provider-reported, and two total tokens
per response. The native protocol body remained usable by the unmodified harness.

The existing OS credential probes additionally covered provider key custody and the separate
upstream service: each non-root service could read its own selected credential and was denied
nine other selected credentials plus Docker access. Provider process status showed its dedicated
UID, empty supplementary groups, zero effective capabilities and no-new-privileges. The known
synthetic bearer was absent from inspected Runtime JSON/JSONL/log/binary evidence. This is bounded
observed non-disclosure, not a proof covering arbitrary encoded leakage or privileged host access.

The fixture exported PASS, observed normal native termination, stopped its services/containers
and shut down its exact disposable PostgreSQL cluster. Responses remain buffered before delivery;
this run does not certify incremental SSE, provider-stream backpressure, live subscription OAuth,
secure owner enrollment/rotation, or encrypted-provider checkpoint recovery and midstream revocation
in one combined workload. Earlier separate recovery/revocation tests retain their own scopes.


### Provider incremental sink checks

The Linux resource suite passed an HTTPS handshake in which the synthetic upstream sends only a
prefix and waits for the sink to receive it before releasing the tail. Concatenated sink bytes
matched the saved native reply exactly, establishing delivery before full-body completion. A
second request blocked its sink after first data and changed the authorization callback to denied;
it terminated within the fixture's 1.5-second bound and had no saved success reply. Existing actual
CLI/Core outage, revocation and failed-completion recovery scenarios still passed in that suite.
The fixture PostgreSQL cluster and child processes completed cleanup.

All 50 resource unit tests and Linux workspace Clippy passed. Added tests split a literal reflected
credential at every fixed chunk width and verify no credential byte escapes, preserve Korean UTF-8
native bytes across every split, and reject a cumulative response exceeding its exact byte limit.
These checks cover the trusted provider sink, not Gateway-to-private HTTP streaming, disconnected
clients, production latency guarantees, encoded-secret leakage or remote cancellation.


### Native HTTP streaming and terminal ordering

The public human HTTPS fixture passed a first-byte handshake: the upstream withheld its tail
until the downstream reader received an initial byte through Gateway and released the fixture
barrier. The client then received the complete native event body, with one additional upstream
request. Existing buffered revocation/outage/recovery cases in that resource suite still passed.
Core tests passed current model transfer access and its denial after revocation; file-only access
continues to reject model requests. Resource unit tests (51) and workspace Clippy passed.

The initial isolated Codex HTTP run exposed missing original-origin records, fixed by admission
recording rather than bypassing origin checks. A subsequent run completed the native turn but
left extra claimed model intents: the harness closed after terminal delivery before Core
completion. The terminal-event gate fixed that ordering. The final isolated run passed the full
file/DB/MCP/upload/publication workflow with exactly three saved provider replies and the original
single unresolved execution intent. LF/CRLF terminal-event splitting is covered by a unit test.
All reported runs stopped their exact disposable clusters and fixture services.

This establishes the tested native HTTP path and completion ordering. The first passing native
result retained a legacy `incremental_stream: false` fixture label; that reporting field has been
corrected, and the transport source plus separate first-byte handshake are the streaming evidence.
The following tests add actual HTTP disconnect, revocation after partial delivery and concurrent
idle readers. Full load/backpressure measurements plus live subscription authentication remain NOT RUN;
earlier buffered-request or callback-only tests do not prove those cases.


### Partial HTTP delivery: revocation and caller disconnect

The Linux process suite passed two additional requests against the real human mTLS Gateway,
Core and provider worker. The synthetic HTTPS server withheld the final event while the caller
received the first byte. In the first request, the CLI revoked that exact execution grant using
the current revision. Reading the remainder raised an incomplete HTTP body within the fixture's
1.5-second bound; no `response.completed` event was present. The original intent stayed claimed
and its Core reply stayed absent.

For the second request, a separate explicitly provisioned synthetic grant permitted a fresh call.
After first-byte receipt the client closed the connection. A rollback-only owner transaction
acquired the exact credential-version row with `FOR UPDATE NOWAIT` within 1.5 seconds, proving
the worker's shared credential-use lock had ended rather than merely observing a dead client.
The original intent again stayed claimed without a Core success reply. The upstream call count
increased only for the two new requests; neither failure was retried. Existing fixture logs were
checked for the known synthetic bearer, and the disposable suite reported complete cleanup.

These tests prove the measured local restriction/cancellation and retained unresolved state.
They do not prove remote provider cancellation, refunded cost, real-time timing under host pause,
TCP buffer saturation or behavior when an otherwise connected client never reads. The synthetic
upstream was explicitly released for cleanup; that is not evidence of remote cancellation.


### Three idle native HTTP readers and control responsiveness

The Linux process suite passed with three simultaneously connected human HTTPS readers that
received headers but deliberately did not consume their response bodies. Their three distinct
intents remained independently attributable. The CLI conditions call and API revocation each
completed within the test's one-second bound. Revocation was submitted before the two-second
provider deadline; a rollback-only lock probe confirmed credential use ended before that deadline,
so a client read or provider timeout was not necessary to apply the restriction.

All three later reads failed as incomplete HTTP bodies without a terminal completion event. Each
original intent remained claimed with no success reply. The upstream count grew by exactly three;
no retry occurred. The existing completion, partial-disconnect, Core outage and recovery cases
also passed, and the disposable suite reported complete cleanup. Fixture observation files now
use atomic replacement to avoid readers seeing a partial JSON write during concurrent requests.

This is a bounded idle-reader test, not evidence of saturated TCP buffers, sustained memory limits,
throughput, percentile latency, system-wide scheduling fairness or host-pause behavior. The response
prefixes are intentionally small, and the reported latency bounds include local CLI/TLS overhead.
A future larger backpressure workload must establish that pressure actually reached the producer
before claiming its cancellation or resource behavior has been tested.


### Consumer-only custody role

The Linux PostgreSQL suite passed opening a consumer with no credential-version INSERT/UPDATE
rights, consuming the enrolled synthetic value, and rejecting registration/disable both through
the store and direct SQL. It rejected the management-capable role as a provider consumer and
rejected a role missing explicit execution of the fixed ciphertext-lock function. Existing
concurrent disable, timeout, reply recovery, partial-stream revocation/disconnect and three
idle-reader scenarios passed using the function-based shared lock.

The actual Core/Gateway/provider process fixture and the isolated native Codex fixture both passed
with separate consumer DB credentials. Codex's three model calls, DB/MCP/file work and publication
remained successful. The fixture owner alone prepared the encrypted version; this does not prove
a production enrollment workflow. Unit tests, Clippy and document checks passed, and the exact
disposable databases and native services were stopped. The previous broad-role fixture remains
useful only for management-library tests and is no longer the runtime provider credential.


### Enrollment receipt transaction checks

The actual Linux custody PostgreSQL suite passed atomic version/receipt registration, metadata
observation with the original ID, no match under another owner, rejection of changed-value
resubmission and rollback of a new version when its enrollment ID conflicts. Disable remained
visible through metadata observation. Receipt serialization omitted the known synthetic value
and ciphertext; direct receipt UPDATE/DELETE/TRUNCATE attempts by the management role failed.

The existing consumer-only provider, HTTPS streaming, partial failure and idle-reader checks in
that suite also passed. Unit tests, workspace Clippy and document checks passed; the disposable
cluster completed cleanup. These are library/transaction checks, not proof of authenticated owner
enrollment, lost HTTP acknowledgement handling, uncertain-commit recovery under a database outage
or a production rotation workflow. Those remain unimplemented or NOT RUN at their respective scope.

### Credential enrollment Core admission checks

The Linux PostgreSQL Core suite passed `credential_enrollment_admits_only_scoped_metadata`:
missing target scope denied admission; extra secret fields, nil/malformed IDs and zero versions
left no enrollment intent; valid metadata admitted once and replay returned the same intent;
changed version conflicted. Persisted input matched the metadata exactly. A provider consumer
could not claim the management intent, enrollment permission did not authorize model use, and
revocation denied both replay and the bound management worker's pending claim.

The locked Linux workspace build, resources unit tests and workspace Clippy passed. The disposable
Core cluster completed cleanup. This validates metadata admission and inherited dispatch controls,
not a secret transfer endpoint, owner enrollment CLI, actual encrypted storage through that endpoint
or a live subscription. Those connected behaviors remain NOT RUN.

### Local API/CLI enrollment connection checks

Actual Linux Core, Gateway, custody-management and CLI processes passed the synthetic enrollment
workflow against disposable PostgreSQL. Metadata admission returned 202 without creating a
credential; the CLI's non-terminal stdin transfer committed one encrypted version and enrollment
receipt, completed the Core intent and printed only identity/version metadata. Empty and oversized
HTTP bodies failed before claim. A changed secret sent to the completed intent returned conflict.
The known synthetic secret was absent from CLI stdout/stderr, Core input/reply and process logs.

The same human's alternate fully scoped grant could not submit the secret to the original
admission, and a direct human mTLS request to the custody worker failed. CLI revocation after
admission denied the pending transfer with no attempt or custody receipt. The Core PostgreSQL
suite separately verified that a second valid certificate for the same principal could not
replace the originating certificate. Current authority and original transfer binding are distinct
requirements; simple inspect permission is insufficient to supply enrollment bytes.

The locked Linux all-target build, existing resources unit tests, complete Core/resources database
suites and workspace Clippy passed, and disposable clusters/services completed cleanup. The first
Clippy run identified an oversized worker enum; the custody variant now uses indirection without
suppressing the check. Separate process roles in this fixture use one OS test user, so this test
does not prove production cross-user custody filesystem isolation. No actual subscription or
external credential was used.

Receipt-only HTTP recovery after custody commit/Core completion loss, rotation, key provisioning,
registration-window expiry under suspended-host time, sustained load and real-account onboarding
remain NOT RUN. Normal enrollment success does not establish those properties. The next connected
step is observation of the original custody receipt without secret resubmission or a new ID.

### Enrollment completion-loss recovery

The actual Linux API/CLI fixture injected a Core trigger failure after custody committed a
synthetic encrypted version and receipt. CLI reported an unconfirmed transfer; Core retained one
claimed attempt and custody retained its original intent/attempt association. After removing the
fault and revoking the enrollment grant, that old grant could not reconcile. A separately scoped
current inspector recovered the original result through Gateway and the custody worker. Core
became succeeded with the same sole attempt and the same one receipt, without resending the secret.

A separately admitted request with identical enrollment metadata attempted a different synthetic
value and failed. Its receipt-only reconciliation returned no matching receipt and left its claim
unresolved rather than borrowing the first request's success. Disabling the original credential
version afterward did not change the immutable registration response on repeated reconciliation.
Core database tests separately rejected observation before claim and by another worker, while
preserving the original observation selector after dispatch revocation.

The locked Linux all-target build, full Core/resources PostgreSQL suites, resources unit tests,
workspace Clippy and document checks passed; disposable clusters/services completed cleanup.
This covers custody commit followed by Core completion failure and its subsequent recovery.
Arbitrary commit-time partitions, stale backup restore, production role/key provisioning and real
account onboarding remain NOT RUN. No actual account credential or provider subscription was used.

### Credential disable and receipt recovery

The actual Linux CLI/Gateway/Core/custody fixture passed explicit version disable. A grant with
only enrollment rights was denied and an extra enable field was rejected without disabling the
version. A Core completion failure was injected after custody committed the disabled state and
its original intent/attempt receipt. A new authorized model request through the real provider
worker then produced no additional HTTPS fixture call. After revoking the disable grant, that
old grant could not reconcile; a current inspector recovered the original disabled result with
one retained attempt and one receipt.

The custody database suite also held an existing credential-use shared lock and verified that
disable did not report completion or expose its receipt before the lock was released. After
release it completed and subsequent consumption failed. A receipt collision during an attempted
disable of another version rolled back the second version's update, leaving that version usable.
A wrong attempt did not match the first receipt; management receipt UPDATE/DELETE/TRUNCATE failed.

Locked Linux builds, Core/resources PostgreSQL suites, resources unit tests, workspace Clippy
and document checks passed; disposable services/clusters completed cleanup. One intermediate test
build rejected a pinned future's borrow extending to a later store drop; its test scope was fixed
and rebuilt without suppressing checks. The shared-lock test proves ordering, not forceful
interruption of an already dispatched external request. Provider-side revocation, version rotation,
connection activation, suspended-host timing and real-account qualification remain NOT RUN.

### Connection candidate submission without activation

The actual Linux API/CLI fixture registered a synthetic successor version and submitted a
connection candidate. An incomplete enrollment was rejected with no candidate. After enrollment
completed, the candidate referenced version 12 while the active provider configuration remained
at version 11. Comparing base/proposed configuration showed that only the credential version
changed. No additional HTTPS provider call occurred. Same-key replay and explicit inspection
returned the retained candidate, while changed metadata conflicted. Ordinary candidate UPDATE
failed. Removing source enrollment inspect scope denied both replay and inspection without
removing the retained record.

The first run was interrupted by the dedicated guest filesystem reaching capacity, including
Clippy's explicit no-space failure. The disposable failed runs finished cleanup and their records
were preserved. Only regenerable Cargo build output was cleaned, releasing approximately 2.3 GiB;
source, research and prior run evidence remained. A clean locked Linux build and subsequent
Core/resources PostgreSQL suites, resources unit tests and workspace Clippy passed. This is not a
long-term storage retention solution or evidence of backup/restore qualification.

At this submission-only checkpoint, acceptance/activation and provider switching had not run.
The later bounded-verification scenario below exercises them separately. Submission success does not prove
independent verification, current credential usability, a new permission or changed runtime state.

### Attributable connection review without acceptance

The connected process fixture passed `POST /connection-candidates/{id}/reviews` through the
Rust CLI and Gateway. It gives the candidate author explicit review rights and expects denial,
then uses a separately authenticated reviewer with explicit work and resource scopes. It checks
retained recommendation and evidence references, identical-key replay, changed-input conflict,
missing-evidence denial, immutable records and denial after source inspection rights are removed.
The active credential configuration must remain unchanged and the provider must receive no extra
request. These are attribution/access tests, not proof that a second principal is an independent
technical evaluator. Review listing and operating acceptance remain NOT RUN; the later bounded
verification case separately exercises configuration selection. This fixture uses synthetic
credentials and does not authorize real account access.

The locked Linux build, resources PostgreSQL/process suite, resources unit tests and workspace
Clippy passed for this review slice. Disposable resources/process services completed cleanup.
Document integrity, Rust formatting and diff whitespace checks passed.


### Bounded credential-version verification activation

The process fixture runs proposal, separate-principal review, explicit scoped acceptance and
activation through the actual Rust CLI/Gateway/Core/custody/provider path. It checks missing
acceptance rights, identical replay without a new deadline, changed-scope conflict, exact-base
conflict, and activation reuse denial. An injected activation INSERT failure must roll back both
selected configuration and the active pointer. The selected successor is encrypted version 12;
version 11 remains disabled. With deployment-managed versions explicitly enabled, actual HTTPS
fixture replies and protected receipts must confirm use of version 12. This uses synthetic bearer
values only and proves no actual subscription compatibility.

Two admitted verification calls exhaust an explicit allowance of two. Removing acceptance scope
between calls denies use without spending the remaining slot or issuing another HTTPS request;
the fixture restores its test scope solely to exercise exhaustion independently. Ordinary rights,
acceptance scope and immutable slot history are checked separately. Expiry under suspension,
concurrent exhaustion, live-stream activation races, full backup recovery, operational acceptance,
secretless submitted adapters and real-account qualification remain NOT RUN for this increment.

The locked Linux all-target build, Core/resources PostgreSQL suites, connected process fixture,
resources unit tests and workspace Clippy passed after the activation fault and authority checks
were added. Both disposable database/process runs completed cleanup. Document integrity, Rust
formatting and diff whitespace checks passed. An initial build used an unavailable date-time crate;
the response now uses PostgreSQL's explicit timestamp projection without adding a dependency.


### Connection status, restriction and successor continuity

The API/CLI process fixture extends the synthetic provider lifecycle through versions 12, 13 and
14. Version 12 exhausts its allowance and status must report its original two admissions. Version
13 is independently submitted, reviewed, accepted and selected, performs one call, then is stopped
with two unused admissions remaining. Missing stop authority must fail; granting explicit fixture
scope permits the stop. Subsequent model use must fail without an additional HTTPS request or a
released slot. Status must preserve the successful call and distinguish stopped from exhausted.

Version 14 follows the same lifecycle and replaces the stopped selection. Replaying version 13's
original stop must return its old record without touching version 14; a fresh stale stop request
must conflict. Version 14 must still perform a real HTTPS fixture call. Status marks the previous
selection as historical while retaining its stop and usage. The test uses synthetic credentials;
real account access, in-flight stop/remote-effect cancellation, stale backup recovery and operating
qualification remain NOT RUN for this scenario.

The locked Linux build, Core/resources PostgreSQL suites, connected API/CLI process fixture,
resources unit tests and workspace Clippy passed. Both disposable runs completed cleanup.
Document integrity, Rust formatting and diff whitespace checks passed. These results establish
between-call restriction and successor continuity, not interruption of an already received
provider operation.

### Submitted adapter material and verification admission

The full-suite rerun described below passed registration from retained source material, missing submission
permission, stable replay/inspection, rejection of registrant self-verification, a separately
scoped verifier, frozen code delivery into a new ordinary execution, duplicate verification
identity, caller code replacement denial, rejection of retroactive ordinary-execution labeling,
and immutable submission records. Removing only verification target scope caused Runtime claim
to fail and roll back its attempt, leaving the original intent accepted. Existing input retention
and ordinary program checks remain part of the same Core implementation.

The locked Linux all-target build, full Core PostgreSQL suite, resources unit tests and workspace
Clippy passed; the disposable Core suite completed cleanup. These tests use synthetic Catalog
receipts and inspect real PostgreSQL transactions. They do not prove the new adapter API has been
exercised through HTTP/CLI or that its registered code has run in Linux. At this database-only checkpoint the routes compiled but connected execution had not run. The
following Linux scenario adds that evidence; evaluation results and managed tool exposure remain
separate from execution.


### Registered code through API/CLI and the real Linux Runtime

`tests/integration/test-connected-program-guest.py --config <injected-fixture.json> --restriction complete
--adapter-verification` uses an already prepared image and disposable service identities. The
human CLI publishes code and binary input, performs an ordinary contained run, then registers that
exact retained material. A second authenticated human with an explicitly scoped agent delegation
requests verification via Gateway. Registration replay/inspection, rejection of self-verification
and repeated verification identity are checked on the actual HTTP path.

The Runtime materializes the same code and input digests in a fresh instance/generation, using its
existing bridge and guard. The unchanged program requests a separate result workspace through
Gateway, uploads binary output and separately publishes it. Core binds the verification execution
to its submission. The fixture checks actual zero exit, second-input materialization hashes,
byte-exact result download, non-root/no-network/read-only/non-privileged container configuration,
retained input dependencies and one compute return per instance. It does not treat completion of
this environment-checking program as independent adapter acceptance, service readiness or economic
success. No provider credential, native model or subscription is used in this scenario.

The first attempt exhausted guest storage while creating disposable databases; its fast shutdown
could not complete. After regenerable build cache was removed, the exact owned failed-run database
was stopped with immediate shutdown and retained for diagnosis. Ten explicitly selected, previously
stopped cluster directories were losslessly archived: each file hash was checked against the archive
and again against its original before the expanded copy was removed. Source, run logs, receipts and
archive reconstruction information remain retained. A local runner now checks minimum free space
before creating a cluster. This is evidence-preserving recovery, not a complete storage-retention
or backup/restore product.

An intermediate run correctly denied private workspace creation because its fixture namespace scope
was absent. The fixture explicitly supplied the required scope; Core and Gateway enforcement were
unchanged. The blocked program's nonzero exit and the failed-run records were retained. Managed MCP
tool exposure, provider-connected submitted code, acceptance of evaluation results, persistent
services and real-account qualification remain NOT RUN.

The final connected adapter run passed, including byte comparison of the second result and its
actual container/input checks. Runtime and disposable PostgreSQL cleanup completed. The locked
Linux build and document integrity, Python syntax, Rust formatting and diff checks passed.

### Program observation ownership and discovery correction

The Core PostgreSQL case checks rejection before release, foreign Runtime identity, wrong generation
and excessive output. A nonzero exit observation can be recorded by the assigned observer after
termination and execution-grant revocation. Identical replay remains stable, changed exit code
conflicts, ordinary deletion fails, and API projection leaves work success unconfirmed.

Review of test selection found that the earlier adapter-submission PostgreSQL case lacked its
explicit ignored-fixture annotation and therefore had not been selected by the local runner.
Its prior database-pass description was too broad for that case. The annotation is corrected;
Core suite execution now includes both regular and explicitly ignored cases under the disposable
DB configuration and records all executed names. An initial overly strict discovery check also
rejected legitimate non-ignored unit cases; selecting the full suite resolved that without skipping
cases. The complete Core run, including the adapter case and backend observation case, passed.
The earlier actual adapter API/CLI/Linux success remains separate valid evidence.

The connected adapter fixture compares both runs' local output hashes with Core's received
observations and retains the original compute-return replay checks. First startup was refused by
the free-space preflight before database creation. Additional explicitly stopped old clusters were
archived with per-file hash verification before retry. Runtime build initially referenced an
unavailable hex helper; encoding now uses the already available digest formatter with no new
dependency. Interrupted-output delivery, Core outage during observation submission and deliberate
loss of the protected local observation remain NOT RUN for this increment.

The final actual Linux adapter run passed. Both complete process observations matched the local
stdout/stderr hashes and the Core API projections; compute-return replay remained stable. All
disposable services/clusters completed cleanup. The locked build, full Core suite, resources unit
tests, workspace Clippy, document checks, Python syntax, Rust formatting and diff checks passed.

### Adapter evaluation records

The disposable PostgreSQL suite passed for the new assessment path: absent evaluate authority,
missing backend observation, self-assessment, unrelated execution evidence, changed replay input,
current-scope removal and immutable record deletion are rejected. A fabricated nonzero observation
can support a retained negative assessment without activation or an independence claim. These
fixtures intentionally fabricate Runtime records; they do not prove actual adapter fitness.

The initial build used an unavailable timestamp dependency. Database JSON timestamp projection
reuses the existing dependencies; the corrected locked Linux build and full Core suite passed.
The actual API/CLI fixture also passed: the scoped reviewer assessed a real contained verification
execution after output-byte, input-hash and container checks; the saved observation matched Core
and Runtime. Replay was stable, self-assessment and changed-input replay were rejected, and all
disposable processes completed cleanup. Resources unit tests and workspace Clippy passed. Managed tool activation, independent acceptance,
provider use and live subscription qualification remain NOT RUN.

### Bounded adapter acceptance

The extended Core fixture exercises absent accept scope, rejection of negative assessments,
source self-acceptance, exact replay with an unchanged deadline, changed count conflict, zero-call
rejection, scope removal, immutable deletion and inspection of retained evaluation/acceptance.
Its fabricated observation remains separate from the actual Linux connection fixture, which now
records a bounded acceptance after checking real contained output and reads both records through
ordinary CLI inspection. Both the full Core PostgreSQL suite and the actual Linux API/CLI fixture
passed, including stable acceptance replay, changed count conflict, self-acceptance rejection and
read-only history inspection. Disposable cleanup completed. The locked build, resources unit
tests, workspace Clippy, Rust formatting, Python syntax, documentation checks and diff checks passed.
The subsequent activation/invocation checks are described below. Parameterized domain-tool exposure, retirement
and persistent services remain NOT RUN; an acceptance record alone must not represent those features.

### Selected adapter invocation

The Core fixture exercises absent activation permission, activation replay, acceptance reuse,
concurrent bounded admissions, replay without another slot, exhausted allowance, revoked acceptor
scope before dispatch, stop restriction, ordinary successor rejection and immutable invocation
records. It also checks replacement, harmless historical stop replay, stale-stop conflict, exactly
one winner for a final shared slot, and an absolute acceptance deadline blocking pending dispatch.

The actual Linux fixture now requests a third instance through the managed invocation API. The
fixed program generates fresh request keys for a deliberate new invocation while preserving them
inside that invocation, publishes separate output, and uses the existing protected Runtime path.
The first connected attempt incorrectly compared the whole accepted response with a replay;
`replayed` intentionally differs. The corrected test compares intent/execution identities and
checks that only one invocation slot is stored. Failed-run records and complete cleanup are retained.
The full Core suite passed, including replacement, final-slot concurrency and real deadline expiry.
The actual connected fixture passed: the third managed invocation published byte-exact output,
replay consumed one slot, and stop denied a new request with remaining allowance. A follow-up
review found that the third guard was not being captured while its parent ran; the fixture now
observes during completion polling. The final rerun observed all three original guards and
confirmed their disappearance. PostgreSQL/service cleanup completed. One earlier retry was
refused by the disk preflight; four explicitly stopped clusters were losslessly archived with
per-file hash verification before continuing. Logs and reconstructable data remain retained.
The locked build, resources unit tests, workspace Clippy and document/format/diff checks passed. No native model,
external provider or subscription is used; MCP exposure remains separate unfinished work.

### Managed MCP discovery and invocation

The new Core fixture negotiates initialization, records the initialized notification, discovers a
selected tool, rejects unknown tools, represents exhausted admission as a tool error, hides stopped
or disabled targets, and reads existing execution evidence. The actual Linux fixture now submits
its third contained execution through MCP, replays it through the direct API without another slot,
compares MCP and API observation projections, and hides/rejects the tool after stop. Its mTLS
transport probe checks invalid Origin, invalid protocol version, missing SSE Accept type, JSON
parse errors and an exactly empty notification response. This does not qualify arbitrary MCP
clients or native Codex interoperability with the managed endpoint.

Review found that managed activation/dispatch needed an explicit active-resource-target check;
this is now applied to selection, Runtime/current requests and discovery, with a DB rejection case.
A named-scope management read prevents a revoked MCP read grant being replaced by another grant
between scope validation and data retrieval. Before tests, eight explicitly stopped old clusters
were losslessly archived with file-by-file verification. Protected source/log/evidence files remain
retained; an inaccessible unrelated run was left untouched. The full Core suite passed. Initial connected testing found the existing native `/mcp` prefix
routing intercepted the managed path; classification now matches the native endpoint exactly,
with a Gateway regression test. A typed-read refactor also removed an unnecessary conversion
reported by Clippy. The final actual MCP fixture passed all transport cases, discovery, third
contained execution, direct-API replay sharing its slot, matching read projections and stopped-tool
rejection. All three guards were observed gone and disposable services/DB cleanup completed.
After a preflight space refusal, eight explicitly completed connected-run DBs were also archived
with verified file hashes using their own cleanup format; expanded duplicates only were removed.
The locked build, resources and Gateway unit tests, workspace Clippy, document checks, Python
syntax, formatting and diff checks passed. Native managed-MCP interoperability, parameterized adapters, real external
provider use, persistent services and subscription qualification remain NOT RUN.


### Native Codex managed-MCP interoperability

The materialized native fixture now configures the unmodified Codex App Server with a required
managed MCP endpoint selected from the Runtime ticket's actual work and agent delegation. The
instance-only `execution_self` tool resolves identity from authenticated Core context and performs
a current named-scope execution read; it accepts no supplied execution or instance identifier.
The controlled model fixture selects this tool from the actual native tool inventory. Its completed
MCP event must contain the admitted execution ID and Runtime-observed instance ID.

The final Linux connected run passed with four synthetic model responses: fixture MCP, managed
self-inspection, native shell work and completion. The native shell read retained input, committed
one prepared DB result with its receipt, and uploaded/published the 13-byte result separately.
The test checks both the retained input's storage charge and output charge, both publication
receipts, the selected output workspace revision, and current historical receipt reconciliation
after output-target deactivation. It also checks the existing service-credential and contained
network probes and observes actual termination. Disposable PostgreSQL/service cleanup completed.

Two preceding attempts retained failure evidence: the normal-workload assertions incorrectly
assumed one workspace/publication after materialized input preparation, then selected both input
and output publication IDs as one resource-intent URL. Assertions now account for the input and
select the output target explicitly; no product authority or isolation condition was relaxed.
The locked Linux workspace test build and binary build passed. This result establishes managed
MCP self-inspection interoperability only. Native invocation of an approved adapter, live model
subscription, the full bypass matrix and this combination's steer/revoke/successor sequence remain
NOT RUN. No real model account or credential was used.


The follow-up explicit PostgreSQL suite also passed the instance self-inspection authority cases:
a released fabricated Runtime peer reads its own execution/instance, a supplied foreign execution
argument fails, a different named grant fails, a human cannot use instance self-inspection, and
revoking the actual agent grant denies subsequent MCP access. These are Core transaction tests
with fabricated trusted Runtime observations, not additional Linux identity or native adapter
invocation evidence. The locked build passed and the disposable DB cleanup completed.


### Native Codex invokes an approved adapter

Run `tests/integration/test-connected-native-guest.py --config <disposable-fixture.json> --materialized-native
--managed-mcp --native-adapter` in the selected root-operated Linux fixture with its pinned native
image, explicitly assigned ports, storage and service credentials. The new preparation helper uses
ordinary API/CLI requests to publish a fixed script, run its source and separate verification,
record an evaluation, accept exactly one call and activate the immutable submission. Only fixture
authority and test certificates are provisioned directly; no execution/approval receipt is forged.

The final connected run passed. Actual unmodified Codex discovers the selected activation's tool
and invokes it through managed MCP with a child grant descending from its own grant. The completed
native tool event identifies the exact managed server/tool and returns admission with
`completion: not_confirmed`. The test independently observes the child Runtime process, exact
24-byte output, successful termination and a 20-unit compute return. Core's intent origin binds
the admitted child to the native caller's actual instance and generation; one activation call is
recorded. Work success remains unconfirmed. The caller also completes the prior file/DB/publication
workflow. Five model responses are synthetic, with no subscription or external provider access.

Initial attempts exposed fixture configuration mismatches: the adapter backend deadline differed
from its activated profile, an explicit false native flag differed from canonical serialized
profile data, and two supervisors attempted to own one exclusive execution slot. The fixture now
uses matching canonical profiles and distinct outer-owned slot roots without relaxing checks.
Preparation and output accounting are separately measured, and the parent intent is inspected by
identity rather than assuming only one company execution exists. All failures remain retained.
After a space-preflight refusal, explicitly completed disposable DBs were losslessly archived with
per-file hash verification. The final run and PostgreSQL/service cleanup passed; locked Linux builds,
resources/Gateway unit checks and workspace Clippy passed. The full native adapter stop/revoke/race
matrix, provider-connected submitted code, persistent services, live subscription and production
qualification remain NOT RUN. Separate fixture reviewer identity is not proof of organizational
independence, and the minimal adapter output is not evidence of economic capability.


### Native adapter admission stopped before dispatch

Add `--native-adapter-stop` to the native adapter fixture command to withhold the adapter worker
until actual Codex has obtained MCP admission. The controller then stops the selected activation
through the authorized reviewer API and starts the original configured worker. Both before and
after its rejected claim, the parent must remain Core-released and actually running according to
Docker inspection. This prevents parent termination from being mistaken for adapter-stop enforcement.

The final Linux run passed: the worker received HTTP 403 for the admitted intent's claim, no
runtime instance or attempt was committed, outbox remained unclaimed, and the 20-unit unsettled
reservation plus invocation record remained. The native admission still reports acceptance only;
its later API projection has no instance, execution observation or compute return. The parent
completed its normal DB/file/publication work using five synthetic model responses. The explicit
stop receipt reports restriction recorded with termination unconfirmed. Disposable DB and service
cleanup completed. This proves the pre-dispatch stop case, not termination of an already running
adapter or automatic settlement of blocked reservations.

Earlier failures remain retained: a ten-second parent hold exceeded the native command response
window; subsequent inspection found the fixture stop hook had been inserted in a successor branch
instead of the initial start branch. Neither earlier run counts as stop evidence. The corrected
hook and five-second hold retain the actual-parent-running assertions. Space preflight refusals
were resolved by hash-verified lossless archival of explicitly completed disposable clusters;
no authority, timeout enforcement or isolation boundary was relaxed. The locked build and
Python/document/format/diff checks passed. Live-provider use, running-adapter stop, authority
revocation races and reservation reconciliation remain separate unverified requirements.

### Explicit reconciliation of an unstarted execution

The new PostgreSQL cancellation test checks stale revision rejection, exact receipt replay,
immutable history, a late claim denial, no duplicate compute return, changed-key target conflict,
current-authority rejection after revocation, and cancellation racing a claim with exactly one
winner. A separately claimed execution deterministically rejects cancellation and retains its
reservation. The full Core suite passed on the final source build.

The actual native pending-stop fixture now continues through the human Gateway/CLI
`cancel-unstarted` API. After proving the child was never claimed, it releases the 20-unit compute
reservation, replays the same receipt without another release, checks the restricted/stopped but
not terminated read projection, confirms no Runtime compute-return record, checks that this
execution's input holds are released, and retains the adapter invocation record. The final Linux
run passed with five synthetic model responses and complete service/PostgreSQL cleanup. No real
model, subscription or external account was used. Prior completed disposable DBs were losslessly
archived with verified file hashes to make room; product records and original failures remain.
The locked build, resources/Gateway unit checks, workspace Clippy and document/format/diff checks
passed. This path reconciles only provably unstarted executions. Claimed/unknown effects, running
adapter termination, persistent services and stale-backup reconciliation remain outside this proof.

### Stop a running native-admitted adapter

Use `--native-adapter-running-stop` with the native adapter fixture instead of the pending-stop
flag. The submitted and separately verified script emits its expected bytes then waits within its
fixed 20-second profile. After actual Codex admits the tool, the test waits for released identity
and the real output file, pauses that adapter's supervisor, and proves the instance CLI's Gateway
conditions request succeeds. It stops the activation via the reviewer API and proves the same
request returns 403 while Docker still reports the same container running. The supervisor then
resumes; actual container termination must precede the independent guard deadline.

The final Linux run passed. The stopped child terminated and returned 20 compute units, retained
its input dependency, and had no completed program observation. `cancel-unstarted` was rejected
with 409 for that already-started execution. The parent completed its file/DB/publication workflow
with five synthetic model responses. The test explicitly expects the supervisor's authority-error
exit alongside successful containment/return evidence; a zero process exit is not the criterion.
An earlier run incorrectly expected zero and failed after containment; that evidence is retained.
Space preflight refusals were resolved through verified lossless archival of explicitly completed
DBs. Final service/DB cleanup, locked build and Python/document/format/diff checks passed.
This is activation stop of one local running adapter, not the complete revocation/stream/backup
matrix. No live subscription, external provider, successful business result or effect settlement
is asserted from the stopped execution.

### Submitted adapter uses encrypted provider custody

Combine `--encrypted-provider --native-adapter --managed-mcp --materialized-native` in the native
guest fixture. The controlled HTTPS provider accepts at most eight requests: one each from source,
verification and final adapter executions, plus five native Codex calls. The immutable adapter
script writes a native protocol request and uses only its instance CLI through Gateway. It checks
the returned provider-model field before emitting its bounded expected output. Fixture-only
credential provisioning stays outside private execution; the existing trusted sender performs
credential use and authenticated transmission.

The final connected run passed. Eight upstream requests match eight custody use claims and eight
saved provider receipts, with eight distinct attempt IDs. Three adapter requests are attributed to
exactly the source, verifier and admitted child instances; their requested model, requested `low`
effort and provider-reported model are checked independently. Five native requests are attributed
to the parent instance. Its unspecified effort remains null rather than acquiring an invented
value. All eight saved usage receipts report the fixture's two tokens. The stored envelope does
not contain the synthetic bearer bytes, and both native and adapter Runtime JSON/trace/log/output
files are scanned for those bytes. Service credential-read probes remain enforced.

The original and provenance-expanded runs passed, along with disposable service/DB cleanup and
locked build/document/Python/format/diff checks. A space-preflight refusal was resolved by verified
lossless archival of completed disposable DBs. The fixture replies are synthetic and cannot prove
model quality, subscription compatibility, real-provider charging, generic adapter safety, or full
secret-leak absence. The provider target is explicitly provisioned by the fixture; this does not
prove real-account onboarding or approval of a new credential/provider binding. Those requirements,
persistent services and connected revocation/backup combinations remain unverified.

### Finite external Runtime worker

Add `--bounded-worker` to the native adapter fixture. One Runtime process with a two-execution
limit handles the source execution, remains alive while its separate verification is admitted,
and handles that verification in another instance. The fixture attempts a second supervisor on
the same slot while the first remains alive and requires the exclusive-lock rejection. It then
checks the worker's exact two-execution terminal record. A separate one-second idle run must exit
with zero completed executions and leave the instance count unchanged. The ordinary native Codex
adapter invocation continues afterward using the same tested product paths.

The final Linux connected run passed these worker cases and the full existing native adapter
workflow; disposable DB/service cleanup completed. Locked builds, resources/Gateway unit checks,
workspace Clippy and Python/document/format/diff checks passed. Initial attempts were refused before
DB creation by disk preflight; explicitly completed DBs were losslessly archived with verified hashes
before continuing. No real model account was used. This proves the finite external worker mode,
not a managed private persistent service, distributed worker pool, automatic recovery after an
ambiguous failure, or service-manager deployment. Those remain incomplete requirements.

### Conversation continuity prerequisite for a bounded private service

`conversation_reply_survives_instance_replacement_without_duplicate_or_authority_restore` in
`crates/core/tests/common_management.rs` runs against disposable PostgreSQL with explicitly
fabricated Runtime bindings. It stores a question and attributed reply, marks the original execution
stopped, admits/binds a different execution under the same logical principal and delegation, and
reads the retained history. Replaying the same reply key/input returns the original message; history,
sequence and original attribution remain unchanged. Changed input conflicts. The stopped instance
cannot read; removing the replacement principal's conversation membership denies both history and
reply replay despite an otherwise live grant. The authorized human retains the original history.

The Linux `service-continuity-core` run passed the new test and the full Core suite; its log contains
the named passing test, and disposable PostgreSQL cleanup completed. Locked workspace build and
format checks passed. This is a Core transaction/access prerequisite, not a real replacement Runtime
or persistent-service test. It does not prove exclusive message consumption, external-effect
idempotency, changed-delegation replay, automatic restart or service availability. The connected
multi-request accepted-program qualification described in RESOURCE_SERVICES.md remains NOT RUN.

### Accepted bounded conversation service in real isolated instances

Use `tests/integration/test-connected-native-guest.py --bounded-service --native-adapter --managed-mcp
--materialized-native` with the existing explicit Linux fixture configuration and pinned native
image. `tests/fixtures/bounded_service_fixture.py` supplies immutable submitted shell code. It discovers
its fixture conversation through Gateway, scans at most four pages per pass and three passes,
handles two unanswered fixture requests and exits within the unchanged 20-second profile. It has
no provider credential, host listener, shared mount or privilege beyond its admitted instance.
This fixture deliberately has one eligible conversation per service principal and no competing
service consumer; it is not a generic mailbox discovery or exclusive-consumption implementation.

Source and independent fixture-verifier executions first produce attributed replies through the
ordinary APIs. Submission, evaluation, two-call acceptance and activation remain the existing
adapter path. Actual Codex then invokes the activated program through managed MCP. In the final
`bounded-service-live` Linux run, the controller observes the first reply, checks that its exact
Runtime instance is released and its Docker container is still running, and only then posts the
second request. Both replies belong to that same service instance. After confirmed termination,
a reviewer explicitly admits another invocation under its currently authorized child grant. That
new instance reads retained history and handles two additional requests; it is not an automatic
restart or restoration of the previous instance's delegation.

The final connected result is PASS. The verifier/service conversation retains six replies to six
distinct requests (two verifier, two native-admitted service, two replacement); the complete old
history is unchanged. The two service instances differ and each returns its 20 compute units. The
normal native file/DB/MCP/publication flow also passed using five synthetic model responses. The
initial batch-input run passed before the stronger live-delivery run. Disposable PostgreSQL/service
cleanup completed; locked builds, Python/document checks and format/diff checks passed. Completed
DBs were losslessly archived with hash verification to preserve evidence while limiting disk use.

This proves finite multi-request execution and retained conversation data across explicitly admitted
instances. The service's only effect is a reply record. Stopping a waiting service, changing membership
while it waits, concurrent consumers, ambiguous external effects, private DB state recovery, automatic
restarts, deployment backup/restore and actual subscription use remain NOT RUN for this path. Earlier
adapter-stop and Core conversation tests do not silently qualify those combined service cases.

### Stop an accepted service while it waits for another request

Add `--bounded-service-stop` to the bounded service fixture. After the first native-admitted service
reply, the controller confirms the exact instance is released and its Docker container running.
It pauses only that instance's Runtime supervisor and waits for its stopped process state. A real
instance CLI conditions request succeeds. The reviewer then stops the adapter activation through
the ordinary API; a second instance CLI request returns 403 while the same container still runs.
This separates Gateway restriction from denial caused by a dead process. The supervisor resumes
in a finally block, and actual termination must occur before the independent hard deadline.

The `bounded-service-stop-verified` Linux run passed. Runtime reports observed termination, no
successful program completion and no effect-settlement claim, and Core records the 20-unit compute
return. The conversation retains the verifier's two replies and the interrupted service's first
reply. A subsequent human request remains unanswered. A new invocation under the stopped activation
is denied with 403 and does not consume the second accepted call or create another invocation.
The native parent completes its normal fixture workflow with five synthetic model responses.
Cleanup completed; locked builds, Python/document/format/diff checks passed. Two earlier attempts
were refused before DB creation by the unchanged disk-space preflight. Hash-verified lossless
archival of explicitly completed DBs made room; these refusals are not service execution failures.

This qualifies activation stop of one waiting local service. It does not qualify membership-only
revocation, credential rotation, network partitions, automatic reactivation/replacement, unresolved
external-effect recovery, restored backups or real subscription use. An unanswered message remains
company history; it is not an instruction for Core to restart the stopped service automatically.

### Completed service DB result survives isolated instance replacement

Add `--bounded-service-db` to the bounded service fixture, without its stop flag. The immutable
program calls the registered `record_result` transaction with a fixed service-state input and stable
request key before processing conversation requests. Source and verifier are separate logical
principals, so each creates its own result and atomic effect receipt. The later native-admitted and
reviewer-admitted service executions use the verifier's logical principal under different current
child grants. They recover the completed result through Gateway's existing same-key resource path,
then include its result ID in their conversation replies. No DB credential or direct connection is
provided to the service.

The final `bounded-service-db-receipt` Linux connected run passed. The two original service results
and their exact protected receipts remain unchanged across both service invocations; neither creates
a new DB effect. Every verifier/service reply reports the original verifier result ID. Six replies
to distinct requests and old message attribution remain intact. The native parent's independent DB
write accounts for the third company result; counts distinguish it from service state. Live second
request delivery, different service instance IDs, compute return and ordinary native workflow checks
also passed, with five synthetic model responses. The earlier count-only run also passed before the
result-ID assertion was added. Cleanup, locked build and document/Python/format/diff checks passed;
completed fixture databases were losslessly archived with verified hashes.

This is recovery of a completed retained result, not failure injection between company commit and
Core completion. It does not prove receipt-only reconciliation after response loss, recovery under a
new logical principal, arbitrary private DB schemas, concurrent updates, a provider's external effect,
or backup/restore. Accepted but undispatched and claimed-but-unresolved work retain their existing
restrictions; replacement cannot convert same-key lookup into a new dispatch under old authority.

### Pending DB identity lookup does not redispatch

The Gateway test `pending_db_replay_returns_identity_without_dispatch_or_reconciliation` supplies
an already-claimed DB admission without a reply and repeats the original request. Both responses
are HTTP 202 with the same intent ID, claimed state and no result ID. The recorded outbound calls
are exactly two authenticated Core admission calls; no worker execution or reconciliation request
occurs. This mock-transport test proves the Gateway branch only. Core remains responsible for
same-key input equality and current inspection authorization.

The Linux locked build passed, and the named test passed within 31 Gateway tests. The 51 resource
library tests and workspace Clippy with warnings denied also passed. Document/Python/format/diff
checks passed. A real company-commit-before-Core-completion transport fault inside the bounded
service fixture is still NOT RUN; the new identity response is preparation for that connected
receipt-only recovery test, not evidence that it has already succeeded.

### Service DB commit survives lost completion and instance replacement

Run the native fixture with `--bounded-service-fault --bounded-service --native-adapter
--managed-mcp --materialized-native`. The immutable accepted program creates one prepared DB effect
per conversation request using a stable key, obtains its intent identity, and explicitly reconciles
before reporting the result. A fixture-only mTLS proxy accepts exactly the Company certificate and
fixed Core paths. It matches one exact synthetic request marker in a successful claim ticket and
arms a one-shot completion-report drop before releasing that ticket. No request body or credential
is recorded in its bounded route/status observations.

In `company-recovery-stages`, the DB effect and protected receipt committed but Core's completion
report was deliberately not sent. The first service instance exited with a nonzero program status
and returned compute without replying. Core retained claimed state and the original attempt. A
reviewer then admitted a different instance under a current grant. Its same-key DB request recovered
the existing pending intent identity; explicit reconciliation read the saved result, completed the
original attempt and produced one attributed reply with that exact result ID. No duplicate effect
was created. The replacement handled the next request normally, and earlier conversation history
remained unchanged. The connected result is PASS, with five synthetic native model responses and
complete disposable DB/service cleanup. No actual account was used.

The first preparation attempt exposed missing DB reconciliation support (409). The implementation
was added. Subsequent preparation attempts exposed missing explicit empty-request framing at the
strict fixture proxy (503); the worker now sends a zero-length observation request explicitly. A
later test failed because it checked post-replacement row counts before replacement; expected counts
are now checked at their actual phase. Space-preflight refusals occurred before DB creation and were
resolved through hash-verified lossless archival of explicitly completed DBs. All failed evidence is
retained rather than counted as successful recovery.

The new Core PostgreSQL test verifies original-dispatch/worker binding and unchanged state, including
observation after Registry replacement and rejection of the replacement worker. Resource PostgreSQL
tests verify missing evidence is not executed, matching records return the original ID, mismatched
parameters fail, and another firm receives no result. Full Core and resource suites passed in
`company-recovery-core` and `company-observation-resources`. Locked builds and
Python/document/format/diff checks passed. Whole-store restore, provider-side ambiguous effects,
new-principal handover and membership revocation during this recovery remain NOT RUN.

### Repeated fixture deployment reuses verified binary releases

`tests/tooling/test-fixture-release.py` tests reuse despite later source changes, rejection of corrupted
binaries without overwrite, cleanup of only the installer's incomplete staging, rejection of source
and release symlinks, mutable stores and unexpected files. All five tests passed locally.

The Linux `immutable-release-ready` connected native service/DB-completion-fault workflow passed
using a new root-owned immutable binary release. A second installer call verified and reused the
same release with identical file inodes and sizes: 11 binaries, 145985540 bytes including the manifest,
were not recopied. Per-run credential boundaries and the original connected recovery assertions
still passed. No account/model call was made. Locked build and document/Python/format/diff checks
passed; disposable DB/service cleanup completed. An initial run was refused by the unchanged disk
preflight, and explicitly completed DBs were losslessly archived with hash verification.

This validates new fixture deployment/reuse. It does not reclaim older deployments, deduplicate
different releases, prove power-loss durability on the physical SSD, qualify production release
management, or authorize deletion of binaries/evidence referenced by old runs.

### Admission pause prerequisite for local shutdown — qualification scope

The source audit found per-execution restriction but no environment-wide admission gate. Before
qualifying cold backup, test the control described in CONTROL_CORE.md with actual PostgreSQL and
API/CLI. An ungranted or work-scoped caller must be denied. An authorized caller pauses at an expected
revision; concurrent fresh execution/resource admission and claim must serialize with that transition.
Wakes and adapter invocations must use the same gate, and a ticket obtained earlier must not bypass
the send/release check. Stable-key replay must preserve the original receipt without undoing a newer
mode transition, and stale revisions must not modify state.

While paused, test that current authorized receipt-only recovery, inspection, stop/revoke and final
observation remain possible; no reservation or artifact dependency is deleted because of pause.
Record pending intents, active instances and unresolved effects separately. A transition response
must never identify itself as drained or backup-ready. Restore/unpause is a separate unqualified
path until installation freshness, old-writer fencing and revocation continuity are established.
The following results qualify selected admission-control cases. Full drain and backup/restore
remain NOT RUN; the scope above is not a claim that all shutdown prerequisites passed.


### Core admission pause and retained recovery records

Migration 0031 and `environment.rs` implement the explicit unrestricted-delegation transition with
stable-key immutable receipts. No existing role receives `environment.admission`. Tests exercise an
ungranted human, an action-bearing work-scoped bound agent, a current unrestricted grant, stale
revision denial, pause/resume and replay of the old pause after resume, plus denial after grant
revocation. They confirm paused conditions do not claim backup readiness, new execution/claims and
Runtime permission fail, earlier accepted work remains identifiable and compute reservations remain.
A simultaneous fresh start either precedes pause and stays unclaimable afterward or is denied;
committed resources match that ordering. A separate Company test preserves original receipt
observation and current inspector lookup while fresh DB admission is denied.

The `admission-pause-core` and expanded `admission-pause-race` PostgreSQL suites passed with complete
cleanup. Locked builds, resource/Gateway unit tests and workspace Clippy passed before the added
race test; the final locked build and full Core suite include that test. Document/Python/format/diff
checks passed. These are Core policy/transaction tests with fabricated instance bindings, not
Linux service drain tests. The connected CLI result below adds control-delivery evidence; coverage
of every worker's interrupted pre-effect boundary remains NOT RUN, as do completed shutdown and
coherent backup/restore.


### Connected admission control and pre-effect revalidation

The `admission-control-live` Linux run passed using the actual Rust CLI, human mTLS, Gateway,
Core and separate resource workers. An ungranted caller was denied. A fixture reviewer with an
explicit unrestricted `environment.admission` grant paused admission at the current revision.
Conditions reported the pause; a valid fresh execution and new Company DB transaction were denied.
The denied transaction created no marker row. Current authorized reconciliation recovered the
original DB receipt from the preceding injected completion-response loss. Resume succeeded, and
replaying the old pause returned its historical receipt without changing the resumed conditions.
The receipt retained `drain_confirmed: false` and `backup_ready: false`.

This control sequence ran after the connected workload finished. It does not demonstrate pausing
an actively running workload, draining streams, or stopping all services. The preceding workload
used actual Codex with controlled synthetic Responses, not the owner's subscription. Its injected
DB completion failure and replacement preserved the original attempt and one committed effect.
Disposable database and service cleanup completed.

Resource workers now revalidate the original attempt immediately before prepared DB reads/writes,
workspace creation, publication, retirement and fixture MCP/model execution. Provider and binary
transfer paths retain their existing live checks. The `admission-preflight-core` full PostgreSQL
suite passed, including a claimed DB request whose live check succeeds before pause and is denied
after pause while original receipt observation remains available. Locked all-target compilation,
resource/Gateway unit tests and workspace Clippy passed. This is not a cross-database atomic fence:
a change that already entered the Company/catalog transaction may finish after the Core pause.
Every such result still requires observation/reconciliation; neither pause nor a failed live check
proves no earlier effect occurred or permits release of an unresolved reservation.


### Admission pause while a contained service is running

The Linux `admission-running-verified` connected run passed with
`--admission-pause-running --bounded-service-stop --bounded-service --native-adapter --managed-mcp
--materialized-native` on the existing injected fixture configuration. The actual Codex parent
invoked the independently verified adapter. After the service's first reply, the controller
confirmed its released binding and running Docker container, suspended only its Runtime supervisor,
and issued the authorized environment pause through the real CLI/Gateway path.

While that container remained alive, instance conditions still returned 200 and reported the pause;
a fresh otherwise-valid execution was denied. Inspection is intentionally retained by admission
pause, unlike activation revocation. After the supervisor continued, Runtime's current-permission
check caused observed container termination before its original guard deadline. The finish record
reported neither runtime success nor settled effects. Core retained the instance and three existing
conversation replies, recorded the observed compute return, and denied replacement invocation.
A later human message remained recorded and unanswered. No activation stop was issued in this variant.

The workload used synthetic model responses and actual isolated native/adapter processes. Database
and service cleanup completed. Earlier attempts stopped before workload setup on the unchanged
free-space preflight; completed historical DBs were hash-verified and archived without discarding
records before retry. This test covers one active contained service and current Runtime enforcement.
It does not qualify open model streams, every resource worker's in-flight commit, supervisor death,
all-service drain, coherent backup or restored-installation freshness. Those cases remain NOT RUN.


### Environment pause after first model-stream data

The `admission-stream-resources` full resource PostgreSQL suite passed, including the existing
actual CLI/Gateway/Core/provider HTTPS process fixture extended with an environment-pause case.
The loopback upstream sends initial SSE data and withholds its tail. After the authenticated human
reader receives the first byte, an explicitly granted fixture control principal pauses admission
through CLI -> Gateway -> Core. The open HTTP response becomes incomplete in under the test's
1.5-second bound and does not deliver a `response.completed` event. The transition does not claim
drain or backup readiness. The original intent remains claimed, its reply remains absent and the
shared committed reservation remains unchanged. Conditions stay readable; a separate current
control resumes the ordinary installation before subsequent fixture checks continue.

The prior delegation-revocation, disconnect, idle-reader, custody and connection lifecycle checks
also ran in this suite. The locked offline build and source agreement passed; disposable DB cleanup
completed. This is synthetic loopback HTTPS with a fixture credential, not a real subscription or
upstream cancellation guarantee. It proves neither zero further provider cost nor terminal token
usage after truncation. Missing terminal evidence remains unresolved rather than fabricated. It
also does not establish all-worker shutdown, production load percentiles or coherent backup/restore.


### Authorized environment shutdown inventory

`environment-inventory-core` passed the full Core PostgreSQL suite. The new inventory case rejects
an ordinary human grant and an action-bearing work-scoped agent, observes two bound instances and
one pending execution, and preserves three reservation records across pause. Repeated reads do not
change revision or event cursor; revoking the selected grant denies further reads. Compilation,
resource/Gateway unit tests and workspace Clippy passed.

The connected `environment-inventory-ready` Linux run exercised
`GET /environment/status/{delegation}` through the actual CLI/Gateway while the contained service
was alive and after Runtime observed termination. The authorized inventory showed one instance and
one Runtime record without termination, then zero of each. Unsettled reservation records changed
from 26 to 25 after the observed compute return and were not falsely cleared. Both responses kept
`drain_confirmed: false` and `backup_ready: false`. The ordinary caller was denied firm-wide access.
Native execution used synthetic model responses, and service/DB cleanup completed. A prior attempt
was refused by disk preflight; completed DB history was verified and archived before retry.

These counts are Core records, not physical service discovery, complete obligation settlement,
artifact-writer exclusion or backup qualification. Document/link/Python/format/diff checks passed.


### Bounded transport drain and ordinary process termination

The transport library tests confirm notification waits for handler completion, and a deliberately
stuck async handler produces an error at the bounded deadline rather than a successful drain. The
library/resource/Gateway unit tests and workspace Clippy passed. The locked build covered both
Linux mTLS and instance-socket implementations and the Gateway's joint shutdown wait.

The full resource PostgreSQL suite `transport-drain-process` passed. Its real HTTPS process fixture
completed the stream/revocation/custody/connection scenarios, then signalled Gateway, provider,
custody and Core in that order. Every current service process exited with code zero within the
seven-second observation bound, and its listening endpoint refused new connections afterward.
This sequence exercises ordinary transport shutdown after workload completion, not interruption of
an active database commit or open stream. Earlier stream restriction assertions remain separate.
Disposable database cleanup completed; the source manifest, document/Python/format/diff checks
passed. Dual-ingress shutdown delivery, process failure escalation, database background-writer
termination and coherent cross-store backup/restore remain NOT RUN.


### Gateway shutdown during an in-flight response

The `inflight-gateway-drain` full resource PostgreSQL suite passed with the actual HTTPS process
fixture. After receiving the first byte of a native model SSE response, the test signals Gateway
while the upstream deliberately withholds its tail. The Gateway listening endpoint closes within
the two-second observation window, but its original process stays alive for the existing response.
Releasing the upstream tail delivers `response.completed`; Gateway then exits with code zero.
Core records that same intent as succeeded. Restarting Gateway with its existing injected
configuration restores conditions access, with exactly one original attempt and no additional
provider call. The remaining resource, revocation and shutdown scenarios also pass and the
owned database/service cleanup completes.

This qualifies an active response that finishes within the five-second drain window. A permanently
stalled real connection, Linux dual-ingress coordination, detached worker activity and an in-flight
Company transaction are not established by this case. Library timeout tests separately establish
error reporting for a stuck async task. Real subscription behavior, full cold shutdown and
consistent backup/restore remain NOT RUN. Source agreement, locked compilation and document/Python/
format/diff checks passed.


### Stalled HTTP request and drain deadline

The `stalled-body-drain` full resource PostgreSQL suite passed. An authenticated TLS client sends
an HTTP request with `Expect: 100-continue` and receives the interim response, establishing that
the server is awaiting its declared body. It then sends only one body byte. SIGTERM leaves this
connection pending until the five-second drain deadline. Gateway exits nonzero within the test's
4.5-to-7-second observation window, records the drain-expired error, and closes the connection.
Intent count and previously committed reservations are unchanged. Starting a new Gateway with
the same configuration restores conditions access. The other connected resource and ordinary
shutdown cases also passed; owned database cleanup completed.

The earlier `stalled-gateway-drain` test failed because its synthetic model upstream automatically
finished after three seconds; that case did not outlast the drain deadline. It is retained as
contradictory test-design evidence, not reported as a runtime failure or a passed deadline case.
The replacement intentionally tests an incomplete HTTP body, not provider cancellation, a
committed DB transaction or an unresponsive OS process. Linux dual-ingress shutdown, independent
process escalation and coherent backup/restore remain NOT RUN. Locked compilation/source agreement
and document/Python/format/diff checks passed.


### Dual-ingress and connected service shutdown

The `dual-ingress-ready` Linux native run passed with `--shutdown-services` combined with the
running-service admission-pause variant. The current authorized inventory recorded zero execution
and Runtime instances awaiting termination while preserving 25 unsettled reservation records.
The fixture then signalled its owned Gateway, Company, Catalog, fixture resource and Core processes
in that order. Each exited with code zero and its TCP endpoint refused new connections. The
Gateway's instance Unix socket also refused connections; the original socket inode remained.
A new Gateway process using that same existing socket path exited nonzero without replacing it.
This verifies joint mTLS/instance-server termination and fail-closed stale-socket behavior.

Actual native Codex and isolated adapters used synthetic responses. The final evidence explicitly
kept backup readiness false. PostgreSQL cleanup completed after the service sequence. An earlier
run stopped on disk preflight; explicitly completed historical clusters were hash-verified and
archived before retry. Source agreement, locked compilation and document/Python/format/diff
checks passed. These assertions do not provide a safe stale-socket removal operation, durable
installation supervision, detached-writer discovery, production PostgreSQL durability or a
cross-store recovery set. Those remain required before complete local shutdown/restore acceptance.


### Owned socket retirement and restart

The transport unit tests pass for normal socket retirement/rebinding, preservation of a replacement
regular file, and leaving a socket intact when the cleanup object is dropped without explicit
retirement. Resource/Gateway/transport unit tests and workspace Clippy passed. The Linux
`owned-socket-restart` connected native run passed: after admission pause, observed execution
termination and orderly service shutdown, the Gateway socket was absent. A new Gateway bound the
same configured Unix path. The fixture then killed that exact owned replacement process; its
socket remained and the next startup exited nonzero without changing the socket inode.

This supersedes the earlier normal-shutdown socket-preservation behavior while retaining its
fail-closed startup rule. Native work used synthetic responses, and final DB/service cleanup
completed. The bound replacement was tested for socket availability while Core was stopped; this
is not evidence of resumed company operation. Independent recovery of a crash residue, a competing
privileged writer, directory power-loss durability and backup/restore remain unqualified. Locked
source/build agreement and document/Python/format/diff checks passed.


### Explicit recovery of a recorded crashed Gateway socket

Transport unit tests reject competing lifecycle locks, missing/corrupt owner records and the live
recorded PID even after its listener is closed. The previous replacement-path preservation tests
remain passing. Locked compilation, transport/resource/Gateway unit tests and workspace Clippy
passed. The connected Linux `socket-crash-ready` run passed: recovery was denied while the actual
Gateway held its lock, forced termination preserved its socket, ordinary startup refused that
residue, and the explicit recovery command retired it only after that exact child was reaped.
The output confirmed no listener start or authority change. Core was already stopped during this
infrastructure check; the result does not claim resumed company operation.

The native workflow used synthetic responses; service and database cleanup completed. A first
attempt was refused by disk preflight; known stopped historical DBs were verified and compressed
before retry. Document/Python/format/diff checks passed. Missing/legacy ownership, competing root
writers, restored-installation freshness, detached external effects and coherent backup/restore
remain outside this qualification. Existing sockets with no trustworthy record stay preserved.


### Existing-service restart and company-record continuity

The `service-restart-ready` Linux native run passed. After the ordered stop and recorded-socket
crash recovery, it started Core, Company, Catalog, fixture resources and Gateway from their existing
configuration files and service identities. It did not recreate authority, databases or company
records. The authorized inventory matched its previous revision, event cursor, pause state and all
counts (excluding the new observation timestamp). Historical publication and DB resource records
matched exactly, and receipt-only reconciliation returned the original result with no new row.

An explicit current reviewer control then resumed this ordinary installation. A new prepared DB
transaction through the same CLI/Gateway created exactly one result and its receipt. The fixture
paused admission again before cleanup. This demonstrates a working Company connection after service
restart, not just a listening socket. The test did not restore a copied database or reboot the VM;
PostgreSQL remained running throughout the application-service sequence. Native model responses
were synthetic and no real account was called. Final service/DB cleanup completed.

A preceding run was refused on free-space preflight. The completed recent cluster was hash-verified
and archived; an older cluster lacking the archive tool's required cleanup evidence was refused
and preserved. Source/build agreement and document/Python/format/diff checks passed. A reusable
installation/service manager, durable PostgreSQL restart, independently verified backup/restore,
new native-instance business recovery after a cold restart and bounded load remain unfinished.


### Clean PostgreSQL restart with the existing recovery material

The `cold-storage-restart` Linux run passed the complete native fixture and subsequent before/after
checks in `tests/recovery/test-existing-storage-guest.py`. Once application services exited, the script
verified `fsync`, `synchronous_commit` and `full_page_writes` were on. It recorded bounded sorted
row-content hashes for all public tables in Core, Company and Catalog, plus the catalog blob file
inventory and content hashes. The controlling process stopped its exact disposable cluster using
`pg_ctl -m fast -w`, verified removal of its PID file and no running original postmaster, and checked
`pg_controldata` reported `shut down`. It then started that same data directory without initdb,
migrations or authority provisioning in the restart checker.

All 78 table hashes and five artifact file hashes matched after restart. Existing service
configurations and identities started successfully and the real reviewer CLI obtained the paused
Core inventory with no live instance recorded and no backup-ready claim. Every orchestration step
returned zero and final PostgreSQL cleanup completed. This is a clean database restart on the
selected VM/filesystem, not restoration from an independent copy, a VM reboot, physical power-loss
proof or arbitrary historical-state recovery. Actual model responses remained synthetic. No
subscription was called. The source/build agreement and document/Python/format/diff checks passed.


### Recovery process-probe error handling

The socket recovery path now uses a fallible process-path existence check. A filesystem probe error
propagates as recovery failure instead of being interpreted as proof that the recorded process is
absent. The recorded identity check and lifecycle lock remain unchanged. The locked all-target
build and existing transport/resource/Gateway unit tests and Clippy cover the current revision;
this small correction is not a new cold-restart or backup qualification.


### Finite local read burst with a concurrent control request

The `bounded-local-load` run passed the native fixture, clean PostgreSQL restart checks and
`tests/support/fixture_load.py` load phase. Four clients completed 128 authenticated HTTPS conditions
queries; each response returned 200 and preserved admission pause. A current authorized pause
control completed while two clients were active, without a conflict or backup-ready claim. The
observed maximum was four active clients. For this single 0.209-second burst, nearest-rank latency
was p50 5.008 ms, p95 7.642 ms and p99 49.103 ms; total-burst throughput was 612.7 queries/s and the
single control response took 9.508 ms. These timings include new TLS connections and Python client
work; they are not isolated Gateway overhead or sustainable capacity measurements.

Process RSS/high-water values after the burst were recorded by role: Core 15368 KiB, Company
13292 KiB, Catalog 13372 KiB, fixture resources 11684 KiB and Gateway 11716 KiB. These include startup
and all preceding work in those processes, not just memory attributable to this burst. No provider
request occurred in the load phase. The preceding native workflow used synthetic responses. Final
service and database cleanup completed. Source/build agreement and document/Python/format/diff
checks passed. This is a bounded functional read/control burst, not a production SLO, throughput
ceiling, sustained mixed workload, streaming backpressure or real-provider performance result.

### Native checkpoint continuation after clean database restart

The `cold-native-current-turn` run passed the connected native workflow, clean PostgreSQL restart
and `tests/recovery/test-existing-storage-guest.py --phase after --native-recovery` continuation. Existing
78 table snapshots and five catalog blobs matched before any new operations. Admission remained
paused and rejected the new execution with 403. The existing authorized reviewer explicitly
reopened admission; no grants were inserted or broadened. The fixture owner uploaded the retained
checkpoint via Gateway, published a separate immutable revision, and requested a successor naming
both its predecessor and the native thread/checkpoint input. The ordinary Runtime created a new
instance and generation, restored the same thread including the previous turn, and actual Codex
executed the synthetic read-only command. It read the original input and the previous company
result receipt through Gateway. The company result count remained unchanged. Admission was paused
again, disposable service/database cleanup completed, and the cold restart and continuation
results both reported PASS.

The initial `cold-native-ready` and `cold-native-rejection` probes were rejected with 400 because
their native predecessor request lacked a resume checkpoint. `cold-native-checkpoint` restored
the thread but failed the required command assertion: the synthetic responder counted an earlier
turn's completed call as completion of the new turn. Those failures remain evidence. The responder
now considers function outputs after the latest user message; its regression test exercises a
restored completed history, a new MCP/command sequence, and completion of that new sequence. All
15 resource-binary unit tests passed. The cold fixture changes only its synthetic command between
phases; it does not update or self-approve a production adapter. Product admission rules and
checkpoint validation were not relaxed.

Reproduce with the existing injected disposable fixture configuration: run the connected native
script with `--materialized-native --managed-mcp --native-adapter --bounded-service
--bounded-service-stop --admission-pause-running --shutdown-services`; snapshot with
`test-existing-storage-guest.py --phase before`, cleanly stop/start the same configured PostgreSQL
cluster, then run its `--phase after --native-recovery` mode. Preserve the fixture root and existing
configuration across these steps; do not reprovision grants or databases. The continuation writes
`cold-native-result.json` alongside the restart result. This qualifies explicit native checkpoint
continuation on the selected local installation, not automatic scheduling, independent backup
restoration, power-loss recovery, financial correctness or actual subscription use. Those broader
conditions remain unqualified.

### Protected services managed by the guest init system

The `managed-services-boundaries` run passed the existing native fixture, clean PostgreSQL restart,
and `tests/recovery/test-existing-storage-guest.py --phase after --system-services` mode. On the selected
systemd 255 guest, `ouroboros-service-unit` rendered Core, Company, Catalog, synthetic resources and
Gateway units from injected immutable binary paths and their existing per-role configurations.
`systemd-analyze verify` accepted each unit. The fixture registered temporary nologin OS accounts
for its already assigned numeric UIDs, started the five units through systemd, and obtained the
authenticated paused environment inventory. No database/grant provisioning occurred in this phase.

For every live service, the fixture checked all reported UID fields, NoNewPrivs=1, zero effective
capabilities, MemoryMax=134217728, TasksMax=64, Restart=no and KillMode=control-group. Entering each
service's mount namespace and dropping to that service UID could not open its launch configuration
for writing: the kernel returned EROFS. These are live identity/mount and configured-limit checks,
not memory-pressure or task-exhaustion results. Every service stopped with success and MainPID=0.
The exact fixture-created units and OS accounts were removed; no boot startup was enabled. Final
PostgreSQL cleanup completed, and the protected `service-units-result.json` reports PASS.

The earlier `managed-services-first` run failed before Core startup because its numeric UID lacked
an OS account. `managed-services-registered` reached API readiness but failed cleanup because
Ubuntu userdel had already removed an empty primary group. The cleanup now handles that observed
behavior and attempts termination of every owned unit before reporting errors; uncertain live
units retain their definitions and identities. Those failed runs remain evidence. The subsequent
`managed-services-clean` run passed before the stronger mount/identity checks were added.

Three Rust renderer tests passed, covering unsupported path/directive expansion, writable launch
inputs, root/unbounded/too-short-stop profiles, privileged Runtime rejection, and absence of auto
restart/boot installation hooks. Locked all-target compilation, Clippy and document/Python/format/
whitespace checks passed. This is management of the five tested protected services on one prepared
guest; Runtime/guard service integration, installation from a clean host, immutable release switch,
storage readiness, real-account operation, independent backup/restore and host failure remain
unqualified. The preliminary native workflow used synthetic model responses throughout.

### Guard survives loss of its launcher's service cgroup

`tests/integration/test-managed-guard-guest.py --root <new-disposable-root> --guard <built-guard>
--uid <qualified-fixture-uid>` provides a finite root-only Linux test with injected paths. On the
selected systemd 255 guest, `managed-guard-verified` passed after `managed-guard-first`. The probe
creates only its own empty target cgroup and a sleep process, supplies that cgroup's write-only
kill FD as stdin through systemd-run's pipe transport, and starts the guard in a distinct transient
unit. The trusted setpriv bootstrap drops to the configured UID before the guard arms. Observed
guard UID fields match; effective capabilities are zero and NoNewPrivs is one. The guard and its
launcher occupy different unit cgroups. Memory/task settings are finite (32 MiB/four tasks for
guard and 64 MiB/16 tasks for launcher); this is not an exhaustion test.

The probe sends SIGKILL to the launcher's entire cgroup, observes launcher MainPID=0, and confirms
both the guard and target remain alive before the original 16-second deadline. At that deadline
the target exits with SIGKILL, cgroup.events reports populated=0, and the guard reports its write.
Only after stopping the exact owned units and removing the empty target cgroup does the final
probe write its PASS result. Negative descriptor checks reject stdin backed by /dev/null and both
stdout/stderr descriptor numbers before arming. No company grants, Docker workload, OS accounts,
subscription calls, boot units or VM were created. Evidence and the verified small guard copy
remain in the marked probe root.

Locked build/source agreement, Clippy, format and document/Python checks passed. At this probe's
revision Runtime still used its direct-child guard path; this result qualifies the independent service
handoff mechanism, not native Runtime integration, early guard retirement, shutdown ordering,
power-loss behavior, host suspension or memory pressure. Those conditions remain NOT RUN for this
managed guard path. In particular, a dead systemd-run helper cannot be reported as a dead guard.

### Runtime-bound managed guard and actual native completion

`native-managed-guard-proof` passed `tests/integration/test-connected-native-guest.py --managed-guard
--managed-mcp --materialized-native` on the selected guest. Runtime used an explicit managed-guard
configuration, handed off its fixed cgroup kill descriptor to a transient unit, verified the actual
guard process and retained its pidfd. The observed binding records the nonprivileged UID, PID,
boot/start identity, independent service unit, instance/generation and fixed BOOTTIME deadline.
Actual Codex completed the ordinary file/DB/MCP/result-publication workflow using synthetic model
responses. The connected verifier required a managed binding, confirmed closure of the payload
and bridge, the actual guard termination record, and MainPID=0 after retirement. The final result
contains `managed_guard.result=PASS`; owned service/PostgreSQL cleanup completed.

The Rust Runtime library's 34 tests passed, including a new two-process pidfd regression: a helper
that has already exited while its guard process is alive raises supervision failure, and retiring
that guard terminates only the pinned process while an unrelated process remains alive. Actual
managed guard UID/capability/executable/cgroup checks run during native admission, not just in a
mock. Root-owned executable ancestry validation and explicit transient-unit collection are included
in the final tested build. Invalid managed setup does not fall back to direct-child guard creation.

Earlier `native-managed-guard-bound` and `native-managed-guard-final` runs passed their then-current
native flows. `native-managed-guard-checked` reached the end but failed a verifier bytes/string
comparison; that error was corrected before the final proof. Space-preflight rejections started no
model work. Explicitly stopped historical fixture clusters were compacted with complete byte/hash
verification to retain evidence without additional VM copies. Locked compilation, Clippy, format
and document/Python checks passed. There were no actual subscription calls.

This qualifies native execution with the managed guard and confirmed early retirement. It does
not yet qualify the privileged Runtime itself as a managed service, simultaneous loss of its whole
unit cgroup during real native work, orphaned-guard reconciliation after Runtime restart, pressure
or host suspension. The existing separate guard-unit failure probe remains narrower evidence.

### Actual Runtime service loss, deadline containment and restart observation

`native-runtime-unit-loss-recovery` passed the connected native fixture with `--runtime-unit-loss
--managed-guard --managed-mcp --materialized-native`. The actual privileged Runtime ran in an
explicit finite transient systemd unit (512 MiB, 128 tasks, 90-second maximum, no restart). Codex
read its admitted input and completed the fixture's file/DB/MCP/publication operations before a
sleep barrier inside the same still-running native turn. The verifier captured the distinct
Runtime/guard unit cgroups and original read-only cgroup.events handles for Runtime and payload.
It sent SIGKILL to the entire Runtime unit, including its bridge and guard-launch helper.

The control command returned exit 1 on this guest: systemd logged signals sent to the main and
auxiliary processes, then an auxiliary-process signalling error. The test did not retry or equate
that return code with absence of effects. It confirmed the original Runtime cgroup was empty and
MainPID=0, while the actual guard and payload remained alive before the original deadline. The
guard then emptied the original payload cgroup at that deadline, without the verifier signalling
the payload. Docker independently reported it stopped and the guard unit had no live MainPID.

A new Runtime process ran stop-only reconciliation with the existing configuration and Core
binding. Its guard observation reported `gone`, with the recorded boot/start identity and original
deadline. Core recorded execution termination, the single existing company result remained, and
no successor execution or compute-return receipt was created. The compute reservation remained
unchanged because the failed Runtime had not persisted a qualified allocation-closure receipt.
The test's own observation handles do not authorize the product to reconstruct one. Final owned
container/unit/service/PostgreSQL cleanup completed; no fixture units remained active.

Runtime's 35 library tests passed, including recovery observation of a live process, rejection of
a mismatched generation, detection of mismatched start identity without signalling the process,
and a gone observation after actual exit. Clippy, locked build/source agreement, format and
document/Python checks passed. The earlier first probe failed on a duplicate Docker endpoint
argument; the next stopped on the nonzero signalling command before checking actual state. Those
failures and space-preflight rejections remain evidence. No actual subscription was called.

This qualifies finite native Runtime-unit loss, independent deadline containment and read-only
orphan observation after restart. It does not qualify a persistent privileged installation,
early retirement of a still-live orphan, reconstruction of missing capacity-return evidence,
automatic continuation, host suspension or power-loss recovery. Missing closure evidence is an
outstanding resource-recovery requirement, not permanent acceptance of leaked capacity and not
permission to release reservations from a stopped-container observation alone.

### Independent closure receipt and capacity recovery

The later `native-runtime-durable-verified` run used the current managed descriptor handoff and
immutable timerfd deadline. It passed the same actual Runtime-unit SIGKILL scenario with real
Codex and controlled native model responses. The independent guard retained the original
cgroup.events descriptor and a separate protected receipt descriptor after the Runtime and its
bridge/launch helper disappeared. It observed closure and persisted the original allocation
identity and deadline. This supersedes the missing-receipt limitation of the preceding run only
for executions launched with this managed handoff; legacy evidence is not upgraded retroactively.

The fixture withheld the receipt before reconciliation: the compute reservation remained and no
return was created. Restoring the same file but changing its deadline caused recovery to fail,
again without returning capacity. Restoring the original contents allowed a new Runtime to
reconcile the original container, bridge and guard, reconstruct and persist the exact return
receipt, and submit it to Core. Repeating reconciliation left exactly one compute return and one
company result; there was no successor execution. All owned fixture processes, services and
PostgreSQL were stopped after evidence export. The systemd kill command's nonzero status was
again resolved through original cgroup and MainPID observation rather than a blind retry.

The separate `native-guard-durable-checked` normal native run passed file, prepared DB, managed
MCP and publication operations, then early guard retirement. The later
`native-guard-receipt-asserted` run also passed explicit checks of the protected closure file
identity, owner/mode, original deadline and closure state after actual guard termination,
independently of the readiness/log pipe. The
managed guard receives a root-origin SIGUSR1 through pidfd for this early retirement; it writes
closure before exit instead of being forcibly killed first. The immutable timer is armed before
the readiness acknowledgement, so early retirement does not introduce an arming race or extend
the original deadline.

Runtime library checks passed 35 tests with one root-only descriptor test excluded from the normal
suite; that test was explicitly run as root in the dedicated guest and passed. It checks descriptor
identity, CLOEXEC, rejection of non-cgroup descriptors and rejection of an unbacked packet.
Workspace Clippy and locked builds passed. These results do not establish persistent installation,
legacy missing-evidence recovery, early retirement of an already orphaned live guard, VM snapshot
freshness, host suspension, power-loss durability or storage-pressure qualification. Actual
subscription use remains NOT RUN. Space-preflight rejections were preserved; stopped fixture DBs
and selected old per-run binary copies were compressed only after complete archive verification.
These archives preserve local evidence but are not independent backups; compressed binaries must
be restored and verified before reusing those old fixture deployments.

### Runtime requested stop while active and idle

`native-runtime-stop-idle` passed with actual native Codex, managed guard, controlled model
responses and the same file/DB/MCP/publication barrier. The fixture sent SIGTERM only to the
Runtime unit's main process. Before the original hard deadline, Runtime interrupted private
activity and confirmed private cgroup, bridge, guard and container termination. The protected
stop and guard closure records remained; Core contained exactly one compute return and the
original company result. The interrupted Runtime exited nonzero rather than reporting native
success. No successor execution was created.

The fixture then launched a new bounded worker against the same live Core, configuration and
evidence root with no pending work. After observing registered signal handling, it sent SIGTERM.
The worker exited zero with `stop_requested`, without another execution or compute return.
Finally all owned fixture processes and PostgreSQL stopped and evidence export completed.
The earlier `native-runtime-stop-signal` run separately passed the active stop case.

The locked Linux build and source agreement passed. Runtime library tests passed 35 with the
existing root-only descriptor test excluded; Resources library tests passed 51 and Gateway
binary tests passed 31. Workspace Clippy, format and document checks passed. SIGINT shares the
handler but was not separately exercised here. Stop during an in-flight claim, pre-guard setup,
stalled evidence I/O, or a host-wide service stop remains outside this run's qualification.
The implementation preserves an in-flight claim and performs activity interruption inside the
existing containment cleanup scope; future tests must check those failure windows directly.
This is a Runtime stop primitive, not a persistent Runtime unit or complete installer. Actual
subscription usage, independently stored backup restoration and power-loss recovery remain NOT RUN.

### Rendered Runtime host service

`native-runtime-unit-capabilities` passed using `ouroboros-service-unit`'s Runtime role. The
fixture rendered a protected unit file, verified it with the installed systemd analyzer,
temporarily installed that exact file under the guest's runtime unit directory, and started it
with systemctl. There was no boot enablement or automatic restart. The unit used explicit root
identity, memory/task/time/worker bounds, protected launch configuration outside the writable
evidence directory, and the mandatory independent managed guard. A separate launch with that
mandatory flag and a direct-child-only configuration was rejected before execution.

Actual native Codex completed the admitted file/DB/MCP/publication work with controlled model
responses. The verifier observed the Runtime's exact effective capability mask and SETUID-only
ambient mask, then observed the actual bridge with its assigned nonzero UID, no-new-privileges,
and zero effective and ambient capabilities. It verified the unit's mixed stop mode and resource
limits. Systemctl stop invoked Runtime's cooperative cleanup before its deadline; the independent
guard closure, single company result and single compute return remained. The following idle-stop
check also passed with no new execution. The exact owned unit file was removed after confirmed
MainPID=0 and systemd was reloaded. All remaining fixture cleanup and evidence export completed.

The first rendered run stopped at bridge readiness; the diagnostic run retained the bridge's
error in root-only `bridge-launch.log`. A finite isolated process probe showed that the selected
systemd explicit-user/seccomp combination removed SETUID from the effective set despite its
bounding-set membership. Retaining that already-bounded capability ambiently in the trusted
supervisor allowed its bridge to drop identity; the same probe and final actual bridge check
confirmed zero effective/ambient capabilities after the drop. No syscall restriction was disabled
and the private payload received no new capability. The failed runs remain preserved evidence.

Three renderer tests, locked build/source agreement, workspace Clippy, document/Python checks,
format and whitespace checks passed. The role also rejects a missing worker bound or an incorrect
host identity. This qualifies this generated unit's finite native start and normal stop, not a
persistent installer, automatic boot/restart, whole-environment readiness, force-stop timeout,
shared pressure, complete capability-minimality proof or independent backup restore. Actual
subscription use remains NOT RUN.

### Whole rendered environment connection

`native-environment-unit-groups` passed with Core, company/catalog/fixture resource workers and
Gateway all running from generated service units, followed by the generated Runtime service.
The PostgreSQL fixture was already initialized; this test does not qualify production enrollment
or initialization. The test checked each actual service UID, effective capabilities, group scope,
no-new-privileges, configured memory/task limits and inability to write its launch configuration.
The actual registered human received an authenticated Gateway conditions response before Runtime
launch; direct human access to Core was rejected. The same admitted native Codex task then used
file, DB, managed MCP and controlled model responses and reached its publication barrier.
Systemctl stop of Runtime preserved its independent closure and single compute return, and the
idle-stop check made no new execution. The remaining service units were stopped in reverse order,
exact owned unit files and fixture-created OS accounts were removed, and PostgreSQL stopped.
Evidence export completed and a final host unit inventory showed no remaining Ouroboros units.

The first combined run failed because the prior direct-process test assumed an empty supplementary
group list. Systemd's account setup also lists the assigned primary group on this guest. The
corrected check permits only that same GID and records the actual group list; unrelated groups
still fail. No host group membership, service authority or generated control was changed to make
the test pass. The previous failed run remains preserved.

Locked source/build agreement, document/Python checks, format and whitespace checks passed. This
qualifies the combined temporary-unit native connection and stop sequence. It does not qualify a
persistent installer, automatic dependency management, storage enrollment/readiness, admission
pause under concurrent submissions, whole-service force-stop recovery, independently stored backup
restore or actual subscription use. The environment used synthetic native model responses.

### Mac host storage preflight command

The Rust `ouroboros-storage host-check` command was built and executed on the actual selected Mac
host volume using an ignored, explicit local configuration. It returned exit 1 and `ready:false`,
with only `ownership_disabled_or_unknown`. The volume identity, APFS filesystem, confirmed
encryption, writable status and configured available-space floor passed. No disk setting, file
ownership, mount, image or enrollment was changed. This is correct rejection of an unready host
profile, not proof that persistent storage is ready. Existing disposable guest tests do not
remove this requirement for real retained restricted material.

The platform-independent evaluator test passed on Mac: missing identity, mount, filesystem,
encryption, ownership or writable observations fail; a different UUID and insufficient capacity
also fail. The synthetic fully confirmed observation passes evaluation but is not a real enrolled
volume. Mac Rust build and Clippy passed, as did the locked Linux build/source agreement and
workspace checks. Host volume replacement during active execution, disconnect, read-only remount,
ongoing monitoring, actual permission-setting remediation and complete guest/host enrollment remain
NOT RUN. The command's point-in-time report does not establish rollback freshness or grant capacity.

### Bound-store check in whole-service startup

`native-environment-store-check` passed using the actual Rust `ouroboros-storage check` command
as the catalog owner UID. Before service startup, a wrong expected generation returned failure;
the correct identity then passed without re-preparing storage. Once the generated catalog service
held the store, another check returned failure rather than taking a competing writer lease.
The same actual native Codex workflow subsequently read and published content, committed its
prepared DB result and used managed MCP through Gateway. Thus the rejected competing check did
not poison the active writer. Normal service stop retained one company result, one compute return
and the guard closure; the idle worker made no successor execution. All owned fixture cleanup
and evidence export completed.

Locked source/build agreement, workspace Clippy and associated tests, Python/document checks,
format and whitespace checks passed. This command uses the existing physical-binding validation
and durable-restriction behavior; it does not add a parallel storage authority. A successful
standalone check is not a continuously held lock, catalog content audit, host mount qualification
or independent backup proof. Actual subscription usage and persistent deployment remain NOT RUN.

### Prepared-host bundle rendering

The actual six-service specifications from the completed whole-environment fixture were supplied
to the new Rust `--bundle` mode. It rendered six named units, put Core first and Runtime last,
and produced a reverse stop order. All content digests matched their bytes. The Runtime unit
was byte-identical to the previously executed unit's protected receipt. Each emitted unit passed
the guest's systemd analyzer without being installed or started; the small output set is retained
as `service-bundle-check` evidence. This test read existing fixture configuration and created no
service identity, credential, authority, database or running deployment.

Five renderer tests passed, including rejection of duplicate names/UIDs, cross-service writable
launch inputs and overlapping writable roots. Locked build/source agreement, workspace Clippy and
associated tests passed. Bundle output is a reviewable installation input, not an installer or
completion of persistent deployment. Actual host path protection, storage readiness, application
readiness, backup/restore and real subscription workflow remain separate required evidence.


### Reviewed installation file path

`tests/integration/test-service-install.py --binary <built-service-unit> --bundle <prepared-input>
--root <new-root-owned-fixture-directory>` passed in the dedicated Linux guest with six actual
service specifications. A wrong reviewed digest created no unit or receipt. A preexisting
sentinel and then a symlink at a destination each caused rejection without changing the existing
entry or other destinations. The accepted bundle installed six exact files with protected
ownership, one link and matching content digests, plus the plan, six individual receipts and
completion receipt. A repeated invocation failed and left the complete file/receipt inventory
unchanged. All files were under a new dedicated fixture directory; no systemd directory was
modified, no reload was issued and no service started.

The locked build/source agreement, five renderer tests, workspace Clippy and associated tests
passed. Document/Python checks, format and whitespace checks passed. This qualifies the explicit
file-write path and collision behavior, not persistent deployment activation. Power loss between
writes, partial-install reconciliation, loaded/transient unit conflicts, controlled updates/removal,
actual service-manager reload and readiness from these newly installed files remain NOT RUN.

### Original-identity installation recovery

The subsequent `service-install-resume-final` fixture passed on the latest source-matched Linux
build using `tests/integration/test-service-install.py --binary <built-service-unit> --bundle <prepared-input>
--root <new-root-owned-fixture-directory> --faults`. Six units were installed and explicitly
revalidated without overwriting their bytes. The new plan format records directory identities;
each unit has a staging identity and final receipt, in addition to the plan and completion record.
This supersedes the earlier partial-install NOT RUN item for the following tested windows only.

Injected `fsync` failures at calls 1, 3, 7, 9 and 13 left no completion claim. Explicit resume
completed each original installation. In the linked-file window, substituting an identical-byte
copy was rejected; restoring the original inode allowed recovery. Replacing the destination
directory at the same path was also rejected without populating the replacement directory.
Wrong reviewed digests, existing destination entries, symlinks and an ordinary repeated install
continued to fail without overwriting existing material. The test uses a fixture-only preload
library; product code contains no fault-injection switch.

Both locked build targets reported success and the local/guest sources matched the recorded
manifest. The associated tests and workspace Clippy passed. No service was loaded or started by
this fixture. These results establish bounded filesystem-error recovery, not physical power-loss
durability, legacy-plan migration, batch atomicity, controlled updates/removal, manager activation,
application readiness, independent backup recovery or a real subscription workflow.

### Installed bundle to actual native execution

`native-installed-profile` passed the rendered-environment path of
`tests/integration/test-connected-native-guest.py` after the fixture switched from writing unit files itself
to the Rust reviewed-bundle installer. All six files were installed under the disposable guest's
runtime service-manager directory. The fixture checked the exact loaded fragment paths, absence
of drop-ins and no pending daemon reload, then started the five control/resource services.
Runtime remained stopped until authenticated Gateway conditions succeeded. Store preflight,
competing-writer rejection and actual process identities remained checked.

The native Codex binary then used the existing synthetic-model file/DB/MCP/publication workflow.
SIGTERM contained its execution before the fixed deadline, retained the protected closure and
one company result, and recorded exactly one compute return. An idle worker stopped without
claiming another execution. Cleanup exported evidence, stopped PostgreSQL and removed the owned
fixture units; a subsequent manager inventory showed no remaining Ouroboros units.

The preceding `native-installed-manager` attempt failed because input preparation changed the
Runtime profile after the launch configuration had been captured. Its evidence remains retained.
The fixture now configures that profile before installation and checks the same launch content at
Runtime start. No runtime permission or configuration consistency check was relaxed.

Source/build agreement, Python/document and whitespace checks passed. This qualifies the connected
installer-to-manager fixture path. Service start/readiness orchestration still lives in the test
driver, not a general product activation command. Boot enablement, persistent host qualification,
independent encrypted backup/restore and actual subscription execution remain NOT RUN.

### Product command for control and Runtime start

`native-product-start-checked` passed with both phases invoked through the Rust service-unit
command instead of direct fixture `systemctl start` calls. The fixture uses the installed bundle,
original installation receipts, an existing human CLI mTLS configuration and explicit expected
firm. The control phase started the five services and completed its authenticated conditions read;
Runtime remained stopped. A repeated control invocation was rejected before any new receipt or
unit start. A runtime invocation with a different expected firm failed its current conditions
identity check while Runtime's main PID remained zero. The subsequent correct runtime invocation
completed and retained its own operation/intent/observation/readiness receipts.

The connected native workflow, graceful termination, protected closure, exactly one company
result and compute return, and idle stop all passed. Cleanup and evidence export completed, and
the service-manager inventory contained no remaining Ouroboros units. The actual Codex binary
still received synthetic model responses; subscription remains NOT RUN. `native-product-start`
also passed the normal product-command path before these counterexamples were added.

Locked Linux builds, source agreement, associated tests/workspace Clippy, Mac service-unit Clippy,
format and document/Python checks passed. Product stop orchestration, recovery from an interrupted
start phase, manager failure/timeout injection, concurrent host maintenance, boot startup and
persistent deployment qualification remain separate incomplete work. No automatic retry, restart,
rollback or application authority was introduced by the start command.

### Product command for Runtime and control stop

`native-product-stop-observed` passed with both stop phases executed by the Rust service-unit
command. Before pausing admission, Runtime stop was rejected and its original main PID remained
unchanged. The fixture owner then paused through the ordinary authenticated Gateway API using its
explicit fixture maintenance delegation. Control stop while the execution remained unresolved was
rejected without stopping Runtime. Runtime stop subsequently preserved the original unit cgroup
observation and protected guard closure, the company result and exactly one compute return.
An idle worker stopped without a successor. Control stop then completed in reverse bundle order.
Owned fixture cleanup and PostgreSQL shutdown/export succeeded; the final manager inventory was empty.

The initial `native-product-stop` attempt preserved a useful counterexample: no Runtime
`stop-request.json` was produced even though host stop and containment were observed. With admission
pause preceding host stop, native work may fail before the Runtime's signal branch records that
event. The combined test now reports `host_signal_observed:false` rather than asserting that source.
It requires the unsuccessful native finish with termination observed, durable stop records and
empty original cgroups. The earlier signal-only tests retain their host-signal record requirement;
this combined test does not replace their evidence or establish a unique cause of native exit.

Source/build agreement, Linux workspace Clippy/associated tests and Mac service-unit Clippy passed.
Subscription remains NOT RUN. Partial shutdown after Gateway loss, manager timeouts, concurrent
unpause, stale loaded jobs, independent backup/restore and persistent deployment qualification are
not established by this test. No test equates stopped services with settled external obligations.

### Host inspection and interrupted control startup

`native-product-inspection` passed read-only product inspections both while the control services
were active and after product shutdown, when Gateway was unavailable. Both inspections verified
six installed units without a Gateway credential and reported that application inventory was not
queried. Temporarily withholding an operation observation left the current active manager state
visible alongside `requested_outcome_unrecorded`; the command did not write replacement records
or retry the action. Original receipt bytes were unchanged and the withheld record was restored.
This is a missing-record diagnostic test, not a simulated successful effect recovery.

`native-control-resume` then passed actual control-start interruption and recovery. A fixture-only
fsync shim returned EIO at the first started service's observation write. The product command
failed without a completion record, leaving that Core service running. Resume retained its exact
PID and manager invocation while starting the untouched remaining services. Substituting a
different boot identity or original invocation identity caused rejection without changing that
live service; the original evidence was restored after each negative test. Repeating the completed
resume was rejected. The new operation completed authenticated readiness, after which the ordinary
Runtime phase, native workflow, both stop phases and final stopped inspection passed.

Source agreement, locked Linux builds, workspace Clippy/associated tests and Mac service-unit
Clippy passed. Cleanup exported evidence and left no Ouroboros units. The original failed operation
and its linked successor remain recorded. The shim is confined to the fixture, not product code.
Physical power loss, cross-boot recovery, disappearance of an observed service, unresolved manager
outcomes, interrupted shutdown and independent backup/restore remain unqualified; actual model
subscription usage remains NOT RUN.

### Control restoration after interrupted shutdown

`native-control-restoration` passed a product shutdown interrupted by a fixture-only fsync error
at the first unit's termination-observation write. Gateway was stopped and the original Core
process remained active, with no control-stop completion record. A restoration attempt with a
different boot identity was rejected while Gateway remained stopped. Restoring the original
evidence allowed `--restore-control` to start Gateway and recover authenticated conditions while
preserving Core's exact PID/invocation and leaving Runtime stopped. Repeating that restoration was
rejected. A new stop operation then read current authorized inventory and completed shutdown;
the original failed stop was retained and linked to the restoration, not rewritten as successful.

This run also passed the preceding interrupted-start recovery, actual native synthetic-model
workflow, company result and single compute return, both normal stop phases and final inspection.
Cleanup/export completed and the manager inventory was empty. Locked source/build agreement,
Linux workspace Clippy/associated tests, Mac service-unit Clippy, document/Python and format checks
passed. This qualifies the observed same-boot partial-shutdown case; it does not prove arbitrary
manager-timeout reconciliation, missing stop observations, concurrent administrator changes,
cross-boot restoration, independent backup/restore or actual subscription execution.

### Prepared backup encryption adapter

The Mac and Linux `tests/recovery/test-backup-seal.py` tests passed with a synthetic 1 MiB input and the native age
v1.3.2 tools. It verified encrypt/decrypt byte equality, ciphertext receipt length/digest, private
output permissions, no replacement of an existing output, and rejection of a wrong tool digest,
oversized input, unprotected input and symlink input. Native decryption rejected changed and
truncated ciphertext. The temporary identity was generated only for this fixture; no company
credential or subscription was used. Decrypted bytes were kept inside the test and not published.
The first Linux run rejected a group-writable recipient file created under the guest's default
umask. The fixture now explicitly protects that file; the product permission check was retained.
Locked Linux builds and source agreement, Mac Clippy and document/format checks passed.

Reproduce with injected paths:

```sh
python3 tests/recovery/test-backup-seal.py --seal "$SEAL_BINARY" --open "$OPEN_BINARY" --age "$AGE_BINARY" \
  --keygen "$AGE_KEYGEN_BINARY" --fixture-parent "$FIXTURE_PARENT"
```

The test is encryption-adapter evidence only. Whole-cluster archive coherence, an enrolled
independent destination, owner recovery-key custody, physical durability, faulted publication and
an isolated company restore remain NOT RUN. A successful sealed-candidate receipt does not mark
any of those conditions complete.

The extended test additionally passed the product `ouroboros-backup-open` path on Mac and Linux: complete
authenticated plaintext publication, private output permissions, no replacement, expected-length
and digest rejection, and absence of a final output after corrupted/truncated-stream rejection.
Partial plaintext remains protected and unpublished. This proves file staging only, not recovery
of PostgreSQL/content or reinstatement of company operation. The final Linux run used the
source-matched locked build of both commands; Mac Clippy and document/format checks passed.

### Prepared recovery-set inventory

`tests/recovery/test-recovery-archive.py` passed on Mac and Linux with synthetic files in all four recovery roots.
It created the standard TAR and inventory, sealed it, opened it into a protected candidate and
verified the recovered complete inventory. The same test rejected output replacement and
repacked archives with missing files, altered bytes, duplicate members, symbolic links and
parent traversal even when the supplied outer digest matched those modified archives.
No archive extraction or company service was invoked. Mac build and Clippy, locked Linux builds
with source agreement, and document/format checks passed.

```sh
python3 tests/recovery/test-recovery-archive.py --archive "$ARCHIVE_BINARY" \
  --seal "$SEAL_BINARY" --open "$OPEN_BINARY" --age "$AGE_BINARY" \
  --keygen "$AGE_KEYGEN_BINARY" --fixture-parent "$FIXTURE_PARENT"
```

This proves a prepared archive's membership/content and its encrypted round trip. It does not
prove that selected sources are the entire company recovery set, that writers were stopped or
that a backup can run a restored PostgreSQL installation. Those integration checks, independent
destination qualification and physical-loss recovery remain NOT RUN.

### Isolated staging and PostgreSQL file restoration

The extended Mac archive test passed `stage` into a new private directory, byte comparison of
all synthetic files, restricted caller-owned modes and refusal to replace the existing directory.
Every malformed archive case was rejected before a destination directory was created. No archived
ownership or executable permissions were applied and no service was started by the product command.

The initial Linux `tests/recovery/test-recovery-postgres.py` rehearsal passed with an actual PostgreSQL 18
cluster containing three synthetic databases and six continuity rows. It verified enabled fsync,
synchronous commit and full-page writes, waited for the owned postmaster to exit successfully,
checked absence of its PID file and `pg_controldata` state `shut down`, then created/sealed/opened/
staged the four-root recovery archive. The test driver explicitly opened only the restored cluster
over a private Unix socket with TCP listening disabled. All six rows and retained artifact bytes
matched; the restored postmaster then shut down cleanly. The product staging command itself
reported `services_started:false` and did not launch that database.

The first attempts exposed a fixture Unix-socket path limit and a too-small 64 MiB source bound.
The fixture now prechecks socket length, uses a 128 MiB source ceiling and separately checks actual
multi-copy headroom with a 128 MiB reserve; it does not disable capacity checks or open TCP.
Temporary synthetic keys, copies and databases were removed only after their owned processes
stopped. Logs retain failed and successful outcomes without key material.

```sh
python3 tests/recovery/test-recovery-postgres.py --source-root "$SOURCE_ROOT" --archive "$ARCHIVE_BINARY" \
  --seal "$SEAL_BINARY" --open "$OPEN_BINARY" --age "$AGE_BINARY" \
  --keygen "$AGE_KEYGEN_BINARY" --pg-bin "$PG_BIN" --fixture-parent "$FIXTURE_PARENT"
```

This is physical PostgreSQL file restoration plus artifact continuity, using synthetic tables.
Actual Ouroboros schema/role restoration, current-authority/predecessor checks, unresolved effects,
independent destination and owner RPO/RTO remain NOT RUN. The rehearsal uses no account, model,
provider credential or external operation. Locked Linux source/build agreement, Mac Clippy and
document/format checks passed.

The subsequent current-schema rehearsal passed all four actual migration sets (Core, Catalog,
Company and Custody) with 84 public tables including migration history. The helper installs each
set under a distinct non-login, non-superuser owner and records migration SHA-384 checksums using
the pinned SQLx migration layout. It hashes sorted complete table contents before and after the
encrypted archive/open/stage/physical restore flow and compares table owners and role properties.
Synthetic fixtures include a paused firm, revoked delegation, unresolved intent/attempt, claimed
outbox item, 70 units still committed and unsettled out of 100, a result with its effect receipt,
and a workspace snapshot with a publication receipt. All were preserved; the Company owner still
lacked SELECT on Core's firms table. Retained artifact bytes also matched.

This upgrades schema/state preservation evidence, not application-level recovery authority.
Custody's schema was included without real credential material. The test did not start Gateway,
reuse restored credentials, claim an outbox item, unpause admission, regrant a revoked delegation
or resolve the pending effect. Predecessor fencing, current-authority enrollment and controlled
Gateway recovery remain NOT RUN, as do independent storage and real subscription execution.

### Recovery inspection restriction implementation

Core and Gateway now share an additional finite inspection filter. Its unit test passed permitted
fingerprint/query-free GET conditions, rejection of other identities, writes, events, alternate
paths and query strings, and elapsed-deadline closure. Core applies the filter before route handlers
and retains its existing pinned Gateway and database authorization checks. Gateway filters before
resource or management forwarding. Inspection startup rejects configured workers/instance sockets
at Gateway and Runtime/wake polling at Core; Core requires preexisting paused admission.

Mac all-target Clippy passed after updating the existing application fixtures for the added optional
field. Locked Linux source-matched builds, 88 existing service-unit/resource/Gateway tests and
workspace all-target Clippy also passed. This is implementation and rule-test evidence only. Real mTLS inspection against a restored
database, denial through both network surfaces, unchanged DB records during inspection, expiry
under live requests, mismatched configurations and invalid startup combinations remain NOT RUN.
Current recovery-operator enrollment and predecessor fencing are still separate unfinished gates.

The subsequent Linux `test-recovery-postgres.py --inspection` run passed the actual restored
Core/Gateway mTLS path. It creates synthetic test certificates and observer records before backup,
retains the currently selected fingerprint configuration outside the four copied roots, and starts
the restored services with an eight-second inspection interval. Core's fixed database contract
uses a loopback-only PostgreSQL listener with SCRAM for a dedicated limited inspection account;
other TCP database access is rejected. This is separate from the preceding Unix-only database test.

The selected observer received paused conditions with `current_authority_verified:false`.
Another certificate with an otherwise valid restored human/inspect grant was rejected. Gateway
rejected work/execution creation, admission changes, event streams, model requests and query-string
variants. Core independently rejected a non-Gateway certificate, a forwarded write and a forged
instance context; an authentic Gateway certificate forwarding the selected observer could read.
After expiry both layers rejected the selected observer. All 84 table digests and ownership/role
checks still matched the pre-backup baseline after service shutdown. The owned processes then
stopped and temporary synthetic material was removed.

Reproduce the combined case with `--inspection` added to the PostgreSQL rehearsal command above.
This qualifies the inspection filter and its unchanged-state behavior through real TLS and SQL.
It does not qualify independently current owner enrollment, old-host fencing, ordinary operational
startup from restored storage, native workload continuation or independent backup storage. Those
remain required before full recovery acceptance.

The firm-identity follow-up corrected the PostgreSQL rehearsal's archive specification to use the
actual seeded firm's ID rather than an unrelated synthetic archive label. The staged receipt and
restored firms row must now match that ID. The full four-database encrypted restore/mTLS inspection
run passed again, including rejection when Core is configured with a different absent firm ID.
This closes an identity-correlation gap in the rehearsal; it does not make archive metadata a
source of current owner authority or prove deployment-generation lineage.

Review of the pinned TAR implementation identified that normal iteration materializes extension
metadata before application member checks. The recovery verifier now performs a bounded raw-header
preflight first. Extended Mac and Linux archive tests passed a supported long path through create,
seal/open, verification and staging, and rejected an 8192-byte long-name extension specifically
at the pathname-metadata bound before normal entry interpretation. Existing membership/content
rejection cases still passed using the supported GNU archive representation. Source-matched Linux
builds and Mac Clippy passed. This addresses metadata allocation bounds, not concurrent hostile
host mutation, current recovery authority or independent-media qualification.

### Current-profile native regression after recovery work

`native-current-profile` exposed an invalid assertion in the combined admission-pause/shutdown
fixture: it required Runtime's PID to remain alive while a later control-shutdown request was
rejected. The separately authorized pause had already caused Runtime termination. The original
finish record reported unsuccessful work with observed termination, and cleanup retained the
failure evidence. A rejected control request must leave its control-service targets unchanged;
it cannot promise that an independently restricted Runtime remains alive.

The fixture now compares the actual requested target-service PIDs and all protected installation
receipts before/after the rejected call. Runtime-target rejection still requires its live Runtime
PID to remain unchanged. Product authorization and shutdown checks were not relaxed.
`native-current-profile-verified` then passed the current source-matched whole environment path:
reviewed bundle installation, authenticated Gateway readiness before Runtime, service isolation,
store preflight and competing-store rejection, actual native Codex execution with synthetic model
responses, one company result, termination before deadline, protected closure, compute return
exactly once and both product stop phases. Cleanup/export completed without errors.

The result explicitly records `host_signal_observed:false`, `obligations_settled:false`,
`new_execution:false` and `subscription:NOT RUN`. This qualifies the combined pause/stop case,
not an observed SIGTERM delivery, settled external effects, a new native successor or actual
subscription operation. Earlier successor and signal-specific evidence remain separate.

### Selected SSD and guest storage placement

The owner selected the existing external SSD for the local Ouroboros environment. After host
ownership was enabled, the actual `ouroboros-storage host-check` returned ready with no failures
for the enrolled host-volume UUID, encrypted APFS and configured free-space floor. This observes
the host; it does not grant company authority.

The existing Lima 2.2.0 guest retained its boot filesystem UUID while its boot disk expanded from
24 GiB to 64 GiB. A new, independently managed 256 GiB raw disk was explicitly checked empty
before partitioning into state and content ext4 filesystems. UUID mounts use nodev/nosuid/noexec.
The default PostgreSQL 18 cluster was cleanly stopped and relocated to state storage; all 971
stopped files matched by SHA-256 before switching its data directory. Its original copy remains
inactive for rollback. No operational firm was registered; this cluster has only the default
PostgreSQL databases. Existing separate development fixtures were not migrated or erased.

Actual unmount/remount checks rejected an unprivileged write into both underlying unmounted
directories and rejected unprivileged reads of protected mounted witnesses. A subsequent full
VM stop/start retained both filesystem UUIDs, mount options and 4096-byte witness hashes.
PostgreSQL restarted with its configured data directory on the state disk, guarded by a systemd
mount dependency and UUID precheck. Observed free space was approximately 40 GiB on boot, 62 GiB
on state and 186 GiB on content.

The selected local allocation is not a delegated capacity budget. Host APFS quota/reserve
isolation, whole-device exhaustion, hardware disconnect/durability, independent backup,
company-store/catalog enrollment and real-subscription execution are **NOT RUN** for this
placement. Default fixture sizing and source templates remain portable; private mount paths,
volume/filesystem UUIDs and selected instance settings remain in ignored environment records.

### Expanded local storage allocation

The owner requested more headroom within the dedicated 2 TB SSD. The selected boot/development
disk is now 256 GiB. A new 1 TiB raw data disk provides a 256 GiB state partition and approximately
768 GiB of content capacity. The combined virtual allocation is 1.25 TiB, leaving approximately
0.57 TiB of the nominal 2 TB device outside these disk ceilings before host overhead and other
files. Sparse allocation is not an APFS reservation.

The default PostgreSQL cluster was cleanly stopped. Migration compared all relative paths,
file hashes, modes, UIDs and GIDs: 1002 state entries and two content entries matched before
activation. UUID mounts and the PostgreSQL unit precheck were updated together. With the old
disk detached, a full VM restart passed UUID/mount-option checks, preserved both witness hashes
and started PostgreSQL from the state filesystem. Approximate available space was 226 GiB on
boot, 249 GiB on state and 748 GiB on content. This supersedes the smaller initial allocation;
earlier test results describe the earlier configuration. Agent budgets were not changed.
