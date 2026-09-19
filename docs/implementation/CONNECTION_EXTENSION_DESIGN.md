# Company Connection and Protected Authentication Design Checkpoint

## Outcome and scope

This record applies the owner's 2026-09-15 integrated design decisions to the maintained system,
component, deployment and Mac experience contracts. It is a documentation implementation checkpoint,
not a completed authentication host, operating connection or full Mac/Company implementation.
The earlier [Company flow review](COMPANY_FLOW_REVIEW.md) remains the evidence for its twelve
boundaries and source findings; this revision extends that map rather than replacing the findings.

The owner explicitly selected:

1. Ordinary agents/programs use protected connection operations and never receive raw credentials.
2. New connections can be prepared, independently verified, activated and used inside existing
   delegation, data/cost bounds and applicable acceptance scope without a routine owner gate.
3. New authentication methods can be installed as separately qualified protected modules within
   the supported Host ABI without a full product update. Ordinary Company acceptance cannot confer
   protected-code trust; a new Host primitive still requires a product change.

This design preserves the chair/CEO relationship, useful data-backed membership, fixed product
controls, Company UI/services, one conversation channel, exact artifacts and main-only source.
Binance BTCUSDT USDⓈ-M perpetual is the initial Company's business selection, not a product module
or an implicit account/capital/trading authorization. No new top-level platform or repository is required.

## Contract ownership

| Owner | Applied responsibility |
| --- | --- |
| [System design](../architecture/SYSTEM_DESIGN.md) | Whole-system map, source/trust distinction, four extension kinds, chair journeys, source/data/artifact lifetimes, acceptance and dependency order |
| [Shared contracts](../architecture/CONTRACTS_AND_STATE.md#extensible-connections-and-protected-authentication) | Connection type/binding, Auth Module package, protected enrollment, lifecycle, session/subscription and receipt identities |
| [Resource services](../architecture/RESOURCE_SERVICES.md#protected-authentication-modules) | Qualified module Host, assigned credential use, exact authentication changes, secret capture, refresh/rotation and old-worker closure |
| [Gateway](../architecture/GATEWAY.md#extensible-connections-and-protected-enrollment) | Confidential input, bounded invocation, current caller/connection, data exposure, ingress and ongoing streams |
| [Core](../architecture/CONTROL_CORE.md#connection-and-protected-module-authority) | Existing permission, package selection, lifecycle intents, shared limits and current-state serialization |
| [Runtime](../architecture/RUNTIME.md), [Deployment](../architecture/INTEGRATION_AND_DEPLOYMENT.md) | Distinct protected profile, compatible selection, bootstrap, continuous maintenance, instance fencing and recovery/end barriers |
| [Application](../architecture/APPLICATION_SHELL_AND_VIEWS.md), [Observability](../architecture/OBSERVABILITY_AND_CONSOLE.md) | Existing Connections/System/Conversations/Notifications/Home journeys, source/state distinctions and secret-free evidence |

## Connection-boundary scenarios

These are acceptance obligations, not passing executable test IDs. A scenario must identify the
exact package/Host ABI, evaluator, fixture/environment, current scope and retained original effects.

| Scenario | Required behavior and counterexample prevented |
| --- | --- |
| C01 — Module installation and trust | A new supported authentication implementation installs without a full product rebuild; ordinary Company package metadata cannot select a secret-bearing profile or self-certify acceptance. Source signature/name is not sufficient qualification. |
| C02 — Autonomous addition | Existing scoped provider/account/action/data/cost/acceptance authority permits connection adoption without human input; a fresh connection alias cannot create new authority or budget. Missing personal login/secret/new authority is requested exactly. |
| C03 — Enrollment binding | Native/system-browser enrollment remains bound to company/environment/account/challenge and selected module; cancelled/stale/cross-account callbacks cannot activate use. Secret material never enters ordinary request logging or Company UI. |
| C04 — Final request and authentication | Method/origin/path/query/material headers/body/non-secret nonce and account remain bound to admitted intent; only selected authentication slots can change. A module cannot rewrite an order, follow an unapproved redirect or expose a reusable signature. |
| C05 — Refresh, disable and retry | Credential epochs are distinct from structural/restriction epochs: routine renewal does not reload UI/services; proven-unsent continuation revalidates a new attempt with claim fencing. Concurrent refresh is serialized per credential lineage and changes are conditionally applied, late refresh cannot reactivate disabled use, and successful login never replays an unknown business effect. |
| C06 — Provider-issued secret capture | Body/header/cookie/redirect/stream/error material is protected before ordinary output. Capture receipt and stored secret share their durable boundary; external creation followed by storage/ack loss remains the original unresolved duty, not permission to recreate. |
| C07 — Long-lived session | Handshake authority does not authorize arbitrary later frames. Current scope/bounds, credential/module generations, per-effect admission, cursor/gap and reconnect behavior remain attributable. Ordinary code receives no raw session token/socket. |
| C08 — Incoming event | Fixed ingress validates account/subscription/envelope and persists bounded deduplication before ACK. Canonical provider/account/event identity survives alias and old/new subscription delivery; subscription-local identity limitations require explicit reconciliation. Duplicate/conflicting/out-of-order events stay distinct; provider authentication grants no internal principal or order authority. |
| C09 — Selection and old workers | Only a qualified compatible UI/service/adapter/auth/config/schema combination becomes effective. Old credential leases, egress, KMS access and sessions are fenced/reconciled; local lease expiry does not prove a sent effect was cancelled. |
| C10 — Data and economic scope | Credential-free reads/writes, models, Git and artifact transfers retain allowed disclosure/destination/cost scope. Connection aliases do not multiply financial/resource limits. Unknown costs and partial account coverage stay explicit. |
| C11 — Bootstrap and recovery | Unlock/module acquisition cannot depend on the same locked connection; restore reconciles old consumers/current authority/provider effects under a new recovery generation before dependent use. Old token/backup presence is not validity. |
| C12 — Chair controls and continuity | App logout, use disable, provider revocation and operating end remain distinct; remaining orders/positions/subscriptions/costs survive. The same canonical references connect conversation, notification, source detail and original receipts. |

Representative future implementation proofs use synthetic API-key/Bearer, HMAC and OAuth providers,
plus a new independently installed module and protected external-key fixture. These prove the
extension contract, not arbitrary vendor compatibility. Provider-specific live qualification is
reported separately; unknown credential types stay unsupported until their selected module is qualified.

## Existing implementation versus target

Current source has authenticated credential envelopes (bounded opaque bytes, owner/identifier/version
binding), durable credential registration/disable/use receipts and a fixed Responses Bearer sender.
The consume callback is trusted in-process code, explicitly not a sandbox. Current connection
acceptance is bounded verification and reports `operating_qualification: false`.

Independent Auth Module loading/qualification/selection, general OAuth refresh/HMAC/mTLS/external-key
use, protected native enrollment for all new types, durable incoming provider events and full
session/lifecycle recovery remain implementation work. The Binance draft still combines private
business mapping with secret parsing/signing/direct HTTP and must be split before adoption.
Existing root/child/binding/history/retention/continuity source gaps remain in the preceding flow review.
A design paragraph or fixture does not close those gaps or authorize a new secret consumer.

## Verification record

The resumed existing worktree is `codex/mac-owner-app`; remote main was freshly observed as
`4429c4a1a7155d32d50566d60660483d7343cda9`. Pre-existing source/UI changes were preserved.
Root applies reviewed documentation patches; delegated authors work in independent scratch copies.

Final documentation verification:

| Check | Result |
| --- | --- |
| Session-scoped changed documents | 14 Markdown files; before/after SHA-256 inventory retained outside the product source |
| Local links and anchors | 341 checked, PASS |
| Markdown structure and scoped whitespace | Tables, fences and changed-file whitespace PASS |
| Mermaid parser | 9 diagrams PASS with Mermaid 11.17.2; syntax parsing only, not rendered/native UI evidence |
| Independent connection/trust review | No remaining actionable contradiction after the corrections below |
| Independent release/lifecycle review | Normal refresh versus structural/restriction selection ambiguity corrected and re-reviewed |

The initial Mermaid check exposed a sequence-message semicolon being parsed as a new statement;
message punctuation was corrected. The Node test harness also needed its DOM dependency before
flowchart parsing. The failed first report and successful final report are retained separately.

Cross-boundary review corrected two substantive ambiguities: (1) routine credential-material
renewal is separate from structural selection/restriction, preserving unchanged UI/services and
original sent attempts; proven-unsent continuation requires durable claim fencing and a freshly
validated attempt; (2) canonical incoming event identity survives connection aliases and subscription
generation changes, while provider-local identity limitations require explicit reconciliation.
Bounded old-key verification stays under custody/reconciliation authority and never restores
outbound use or qualifies a compromised signature as current evidence by itself.

The existing owner-request/effect-preparation/original-key contract block was retained; no public
endpoint, schema migration, authentication worker or product API was added in this revision.

**Not run for this design revision:** runtime tests, provider/real-model calls, credential enrollment,
new module installation, native UI screenshots, live investment, cross-boot recovery. No current
runtime/API/UI implementation or company connection is created by the documentation update.
