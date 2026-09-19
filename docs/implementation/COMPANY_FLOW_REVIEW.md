# Company flow review — 2026-09-15

## Status after the 2026-09-19 source cleanup

The tables and reproductions below retain the **September 15 snapshot**, not current defects.
Since then, native owner calls have gained server-derived environment/firm/principal binding and
connection generation checks. System notifications now retain their primary control intent,
and Library discussion keeps the exact workspace/revision/path and governed read scope. The
unused Binance draft was preserved outside the product checkout and removed from Cargo membership.
The [Mac implementation record](MAC_APP.md) owns current verification and remaining work.
These corrections do not establish the complete Company deployment, financial or autonomous flow.

## Scope and conclusion

The owner requested inspection of the complete flow and every connecting boundary, using
**Company**, not an investment-specific product tier. This review traced current design contracts
and the local implementation through request, effect, result, deployment, artifacts, continuation,
restriction and recovery. It did not connect accounts, call a model/provider, change product code
or run a native app. Source observations concern this working tree, not a released product.

The product/Company split is coherent, but the previous diagrams omitted necessary transitions.
The corrections below are now design requirements. **The complete Company flow is not implemented
or accepted.** In particular, existing fixture admission, package loading and maintenance helpers
cannot simply be composed into that claim. Shared contract owners remain authoritative; this is
a review/evidence record, not another state machine, API service or ledger.

## Connection matrix and corrected failure cases

| Boundary / failure trace | Required connection now specified | Current evidence / remaining work |
| --- | --- | --- |
| **F01 — UI to actual company.** Prepare an action on A, change connection or restore another environment at the same URL, then submit a delayed callback. | Native connection generation plus actual environment/firm/principal; exact service/package/schema/config binding in draft, submission and receipt lookup. Changed context invalidates the draft. [Bound calls](../architecture/CONTRACTS_AND_STATE.md#bound-company-calls-and-owner-actions). | Native `CommandRequest` lacks this envelope; current environment ID is a URL hash. Generic Company action integration remains unimplemented. |
| **F02 — Caller to service to downstream effect.** A read operation reaches a service with wider permissions; or a service restarts after its child succeeded and creates another child. | Server-derived caller and service context, named-operation downstream scope, durable root/parent/effect-slot-to-child binding. Root processing is not authority for all resulting effects. Each child owns its attempt/claim. [Bound calls](../architecture/CONTRACTS_AND_STATE.md#bound-company-calls-and-owner-actions). | Current ActorContext/ResourceRequest do not carry the complete delegated service/root-child contract. No Company business call path is qualified. |
| **F03 — Preparation to reservation.** Two requests each see capacity 100 and independently validate 70; exact signatures still allow a combined 140 if no shared reservation intervenes. | Effect-free Company requirements, registered policy/observation versions and canonical constraints before Core atomically binds/reserves the child. No network under Core locks. [Core admission](../architecture/CONTROL_CORE.md#admission-and-concurrent-reservations). | Existing `resource_calls` accounting does not establish Company financial reservations. The counterexample is a design trace, not a live double-order test. |
| **F04 — Validation to wire request.** A body digest stays unchanged while method/path/query changes; or ordinary Company JSON is promoted into a send permission. | Protected validator operation and actual instance, full request envelope, pinned authentication additions, current checks and one-use sender claim. [Preparation and dispatch](../architecture/CONTRACTS_AND_STATE.md#company-preparation-and-exact-external-dispatch). | Draft Binance code takes raw secrets and performs HMAC/HTTP. It must be split before Company migration; moving the file unchanged violates the target. |
| **F05 — Package checks to effective combination.** U2/S1 and U1/S2 are separately tested, then independent slot CAS operations produce untested U2/S2. A failed candidate also removes U1 too early. | Verified dependency closure and expected dependency selections; prepare/readiness/effective/retire stages; all required packages ready before old handles are released. [Compatible selection](../architecture/CONTRACTS_AND_STATE.md#compatible-selection-and-schema-transitions). | Current hook releases old handles on composition change and applies successful subsets. Service activation primitives alone do not establish a ready, compatible combination. |
| **F06 — Deployment to DB schema.** A checks schema 1; B migrates to schema 2; A's unchanged slot CAS succeeds. | Protected migration barrier, incompatible-writer fencing, DB schema epoch plus local migration receipt, reconciliation before effective selection or rollback. [Schema transitions](../architecture/CONTRACTS_AND_STATE.md#compatible-selection-and-schema-transitions). | Current generic Company deployment/schema coordination is not implemented. No distributed transaction is claimed. |
| **F07 — Effect to UI/history/notification.** DB commits then producer crashes before notification; a new schema decodes old results; related execution ID overrides the original control intent. | Receipt/outbox local durability, idempotent accepted ingestion, scoped projection watermark/generation, typed primary reference independent of related IDs and loaded/latest lists. [Results and projections](../architecture/CONTRACTS_AND_STATE.md#company-results-projections-and-primary-references). | Company outbox/SSE integration and structured message references are incomplete. Control notification routing defect was reproduced as a pure function; see below. |
| **F08 — Durable record to artifact.** A DB/message/deployment references a file, old publication is retired, then GC removes its evidence. Or a late hold survives owner cancellation. | Owner kind/ID/revision, exact object and reason, stable hold request/ack, committed dependency and durable release/cancel reconciliation. [Retained dependencies](../architecture/CONTRACTS_AND_STATE.md#cross-store-retained-dependencies). | Current upload/revision holds and execution-input fences protect their own scope, not every Company dependency. General holds and final input-release lifecycle remain work. |
| **F09 — Manifest edit to publication completion.** An upload is retired but its published entry must remain in a new manifest; or a definite CAS refusal leaves Core permanently claimed. | Carry forward an exact eligible entry from the expected head with an atomic new revision hold; record definite no-effect rejection receipts and reconcile the original intent. [Publication continuity](../architecture/RESOURCE_SERVICES.md#publication-continuity-and-definite-rejection). | Current publication requires active uploads; rejected CAS lacks the completion path needed to settle the barrier. These are identified source/contract gaps, not newly fixed code. |
| **F10 — Restricted boot to Company recovery.** Global pause prevents the very service needed to inspect outstanding effects; a strategy occupies the only slot needed by its dependency. | Protected common startup, explicitly scoped recovery service execution/reads, reserved dependency/control capacity, then per-capability ordinary admission. [Recovery barriers](../architecture/INTEGRATION_AND_DEPLOYMENT.md#company-recovery-and-operating-end-barriers). | Current global pause, one-slot finite worker and `Restart=no` fixtures do not provide continuing services/recovery capacity. Existing restrictions remain until the scoped replacement is verified. |
| **F11 — End operation to actual cessation.** Runtime stops the reconciliation service before residual duties are settled; concurrent unpause bypasses a snapshot precheck. | Durable operating-end barrier, restrict and observe, reconcile/transfer duties, drain services, then stop Runtime/control. Resume checks the same revision. [Operating-end barriers](../architecture/INTEGRATION_AND_DEPLOYMENT.md#company-recovery-and-operating-end-barriers). | Existing host stop is not Company operating-end. Same-boot resume/restore cannot establish cross-boot or backup-recovery authority. |
| **F12 — Decision to next autonomous turn.** A decision says waiting, then the agent crashes before the next wake is durably accepted. | Exact decision/wake references, observed continuation acceptance and original-intent reconciliation; incomplete continuation is visible, never healthy waiting. [Wake conditions](../architecture/CONTROL_CORE.md#wake-conditions-and-continuing-work). | One-shot timer registration/delivery exists, but complete assignment/cycle reconciliation and queued conversation wake are not demonstrated. No new owner task should be required when current continuation is valid. |

## Concrete source findings retained for implementation

These locations were read during review. A source-derived failure trace is not a native, server,
provider or multi-process reproduction.

| Source | Observation |
| --- | --- |
| [Native client](../../apps/mac/src-tauri/src/main.rs) | Snapshot environment identity hashes the Gateway URL. `CommandRequest` contains key/kind/target/expected revision but no authenticated connection generation. `command_receipt` supports stop-key lookup or a known intent ID, not arbitrary lost-first-response Company lookup. |
| [Actors](../../crates/core/src/actors.rs), [request contracts](../../crates/contracts/src/lib.rs) | A principal and optional one bound instance do not encode both original caller and executing service chain. Current `ResourceRequest` lacks root/parent/effect-slot fields. Message requests contain text/reply, not the full structured artifact-reference contract. |
| [Company package hook](../../apps/mac/src/data/company-packages.tsx), [native handles](../../apps/mac/src-tauri/src/company_views.rs) | Key change cleans up old handles; individual preparation failures still permit a partial new module list. Native release closes matching views. Candidate preparation is not an atomic effective selection. |
| [Notification resolver](../../apps/mac/src/features/notifications/open-source.ts), [Gateway workspace](../../apps/mac/src/features/gateway/GatewayWorkspace.tsx), [Catalog projection](../../apps/mac/src/data/catalog.ts) | Related execution ID takes priority over a System control intent. Publication detail relies on latest observed publications, so it cannot establish complete historical resolution. |
| Archived Binance draft (no product source path) | `execute` accepts secret bytes, parses credentials, adds timestamp/query fields, signs and directly sends HTTP. Company migration requires a split from protected authentication/transport. |
| [Catalog](../../crates/resources/src/catalog.rs), [resource effects](../../crates/resources/src/service/effects.rs) | Current publication depends on an active upload. A CAS refusal returns an error without the definite non-effect receipt/completion path needed to settle the already claimed Core intent. |
| [Runtime worker](../../crates/runtime/src/manager.rs), [runtime admission](../../crates/core/src/runtime.rs), [service units](../../crates/cli/src/service_render.rs) | Single-slot bounded worker behavior, broad admission pause and finite service units do not establish persistent Company service or recovery orchestration. |
| [Wake implementation](../../crates/core/src/wakes.rs) | Registration and occurrence-to-execution mapping are concrete primitives. They do not establish a transaction spanning private decision publication and next-condition acceptance. |

## Executed reproduction and verification limits

The current notification resolver was transpiled with the already installed TypeScript package
and invoked without UI/network using synthetic input:

```json
{
  "destination": "system",
  "source": {
    "execution_id": "execution-fixture",
    "intent_id": "stop-intent-fixture",
    "work_id": "work-fixture"
  }
}
```

Expected primary detail: `control-request / stop-intent-fixture`.
Observed detail: `execution / execution-fixture`.
Result: **REPRODUCED; product code not modified**. This confirms the resolver behavior, not a
running native screen or the broader notification architecture.

Independent read-only reviews covered app/host, admission/sender, package/schema, artifacts and
environment lifecycles. Root review also traced continuation and shared contract consistency.
Scoped document checks cover local targets/anchors, tables, fences and whitespace only. Runtime,
Company service integration, native containment, real provider behavior, cross-boot recovery and
Mermaid rendering are **NOT RUN** in this review. Prior test counts are not new evidence.

Final scoped result: 13 changed/new Markdown documents, 307 local links/anchors checked, no table,
code-fence or diff-whitespace failures. This is documentation validation, not Company runtime
acceptance. Follow-up independent reviews found no additional major call/dispatch or release/schema
contract inconsistency; their final lifecycle/hold race clarifications were incorporated.

## Required implementation checks

Use existing test ownership and selectors when implementing these requirements. These descriptions
are acceptance obligations, not registered case IDs or passing tests:

- Change connection/service/schema while an owner draft and old response are pending; no silent
  rebinding, privilege substitution or new-schema decoding of an old response.
- Kill a Company service after child dispatch but before root response; original-key/slot lookup
  finds the same child and outcome without issuing a replacement effect.
- Race two prepared effects against shared capacity and a selection/restriction update; reservation
  remains atomic, stale proposals fail, and no Company RPC runs inside the Core transaction.
- Change any material wire-envelope field after validation, inject an ordinary `approved` response,
  or replay a sender permit; each is rejected without a new provider effect.
- Race UI/service selections and a schema migration; only a verified combination becomes effective,
  required readiness is observed, and the previous eligible UI remains until valid cutover.
- Commit a Company result then crash before ingestion; outbox replay produces one attributable
  event/notification. Resolve historical files/control intents after the latest view changes.
- Race retain/cancel, owner commit and collection; no promised dependency loses its exact bytes.
  Include cancellation after hold acknowledgement but before owner commit. Carry forward an active
  published entry after upload retirement; race publication success against definite refusal and
  replay a lost refusal response without a second terminal outcome or refund of incurred calls.
- Recover under business pause using only explicitly scoped Company observation capabilities;
  required service capacity is available and no new economic effect is granted by recovery.
- Race operating end against resume and pending effects; responsibilities and observation survive
  until explicitly settled/transferred to an acknowledged custodian outside the shutdown target,
  without claiming that stopping processes settles providers. Reconcile uncertain host creates
  before starting a recovery-service replacement, then reconcile provider effects.
- Crash between decision publication and wake acceptance; distinguish incomplete continuation
  from normal waiting and recover only the original currently authorized condition.

## Connection and authentication extension review

The subsequent [connection extension checkpoint](CONNECTION_EXTENSION_DESIGN.md) preserves F01–F12
and adds C01–C12 for independently qualified Auth Modules, scoped autonomous connection adoption,
secret enrollment/capture, lifecycle races, long-lived sessions, inbound events, data disclosure
and recovery. Those design obligations do not close the concrete code findings above.
