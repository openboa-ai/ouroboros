# Ouroboros Mac app

The Tauri Mac app has seven fixed **Home, Work, Agents, System, Conversations, Library
and Notifications** Workspace pages, separate published Company navigation, and fixed
Owner controls in the sidebar footer. The sidebar has one Settings entry; its body uses
horizontally scrollable General, Connections, Company, Modules and Maintenance tabs.
The source badge appears beside the company name. Theme selection and the labeled
Change company connection action are in General.
Details use the main content with Back/Close, rather than a permanent right inspector.

Product labels are English and the initial theme follows macOS. `apps/mac/src` is the
source; calibration imports it. The four-screen revision 03 is retained design evidence,
not the current navigation.

## Run and verify

```sh
npm ci
npm run tauri -- dev
```

```sh
npm run lint
npm test
npm run build
cargo test --offline --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --debug
```

The local bundle is `src-tauri/target/debug/bundle/macos/Ouroboros.app`.
This is a development build, not a notarized distribution. The 2026-09-14 local
bundle was ad-hoc signed and verified after bundling. No signing identity is required
for that local check. Browser-only development uses `npm run dev` on port 1420;
native connection and file dialogs require the Mac app.

The private verification archive retains native screens, publication/notification API evidence,
and the final service observation/owner-stop comparison. Current results and remaining boundaries
are in [the implementation record](../../docs/implementation/MAC_APP.md).

## Source ownership

| Layer | Canonical location | Responsibility |
| --- | --- | --- |
| Tokens | `src/ui/tokens/` | OpenBoa color, complete typography roles, spacing, shared layout dimensions |
| Primitives | `src/ui/primitives/`, `variants/` | Actual shadcn Mira / Base UI controls and shared variants |
| Components | `src/ui/components/` | Amount, Member, Facts, RecordLink, Status, EmptyState, SectionHeading, theme |
| Layouts | `src/ui/layouts/` | Fixed workspace shell, header, navigation and responsive structure |
| App | `src/app/` | Fixed routes, full-page detail/back stack, discussion return, boundaries and file port |
| Workspace features | `src/features/home/`, `operations/`, `conversations/`, `library/`, `notifications/`, `settings/` | Personal Home, Work/Agents/System, communication, materials, in-app notifications and settings |
| Company host | `src/contracts/`, `bootstrap/`, `modules/`, native `company_views.rs` | Product wrappers, verified package metadata and isolated Company pages; no private `src/company/` imports |
| Investment reference | `src/domains/investment/` | Current synthetic Portfolio to migrate into Company source; target product has no built-in investment UI or backend |
| Sources | `src/data/`, `features/gateway/`, `development/` | Separate Gateway and explicit sample adapters |
| Native | `src-tauri/`, `src/client.ts` | Fixed authenticated API calls and native save dialogs |

Do not copy a screen or redefine font sizes to extend the app. Follow
[UI implementation rules](../../docs/design/UI_IMPLEMENTATION.md) and the
[element purpose contract](../../docs/design/UI_PURPOSE_CONTRACT.md).

## Company UI and personal Home

- **Home layout** is a local preference scoped to source/company/owner. Add/remove/resize/
  reorder widgets with Save/Cancel. This sends no company command and changes no shared configuration.
- **Company UI** is code plus published configuration. Agents can implement and publish
  candidates; compatible composition selects registered widgets without rebuilding.
  New executable company code requires a separately built and verified package. JSON import never runs
  published TypeScript or installs a module.
- **Settings → Company** compares current configuration with an imported candidate.
  Shared updates reuse Catalog upload/publication/readback, a full replacement manifest,
  expected Catalog revision (CAS) and a stable request key. Preserve pending references
  and inspect the original intent after uncertainty. Observed publication/readback confirms
  composition content only. Independent package qualification and protected executable selection
  are still required by the target contract and are not completed by this importer.
- **Settings → Modules** is read-only: verified package versions, screen/widget definitions and
  references from the selected company configuration. Import, source selection and activation
  stay in Company. Unknown usage is not reported as unused or currently executing.
- Company pages cannot replace Workspace, Settings, source identity or Owner controls.
  They reuse OpenBoa Martian composite roles, shared tokens and shadcn Mira/Base UI.

## Notifications and unread state

The in-app Notifications page reads Core `GET /notifications`: stable event IDs, exact
source references, owner read state and authorized server unread aggregates. The screen
and navigation use the same `data/notifications.ts` controller:

| Menu | Server unread category |
| --- | --- |
| Conversations | message |
| Agents | execution |
| System | control |
| Library | publication |
| Work | execution + control |
| Notifications | total |

Counts cover the server scope, not only loaded or filtered rows; menu categories overlap.
Zero/unavailable counts omit the badge. Company pages, Settings and its tabs have generic
badge slots but no fabricated counts before an applicable source contract exists.

`POST /notifications/read` records only submitted stable IDs, at most 100, for the current
owner with permissions rechecked. Mark shown as read uses the currently loaded, filtered
unread IDs within that bound. Opening a notification's source attempts to mark only that
ID read; ordinary menu visits do not mark a whole destination read. Only acknowledged
IDs and returned server aggregates update the client. A read is neither approval nor
resolution and calls no producer/model. Company/environment/owner changes invalidate the
previous notification scope; read state is not a separate local ledger.

This is **in-app only**; macOS push notifications are not implemented. Current notification
categories do not establish coverage of every financial obligation or owner decision.
Backend test and actual-screen results belong in the verification record, not this contract.

## Connection and verification boundaries

- Normal launch makes no model or company request. Choose **Connect company**, **Use saved
  connection**, or **Explore sample company**. A failed connection never substitutes samples.
- Native `company_snapshot` reads conditions/work and scoped execution, activity,
  conversation and Catalog observations. The command name does not imply a `/company/*`
  server API. Coverage and missing fields stay explicit; Gateway read success is not Runtime health.
- Conversations separate message storage, delivery to an exact execution and an actual
  reply. Reconnection preserves request references; it does not create a CEO or start an
  autonomous loop. Native controls preserve the execution and authority revision, original
  request and observed outcome. Stopping a process does not settle financial exposure.
- File reads preserve workspace/revision/path and verify bytes. Catalog replaces the
  manifest, so configuration updates preserve required existing entries. Browser export
  feedback says **Download requested**, not **Saved**.
- Window close sends no operating stop. Actual native behavior, build/signing and
  screen/interaction results belong in the final verification record.

The Mac/control-plane and Company-extension scope does **not** establish Binance live
BTCUSDT futures operation, whole-company capital/cost reconciliation, financial controls
or autonomous CEO continuity. Samples, agent artifact proof and UI acceptance are distinct.



## Company ownership boundary

See [Integrated System Design](../../docs/architecture/SYSTEM_DESIGN.md) for the target
app/runtime/source/data/artifact architecture and [the current checkpoint](../../docs/implementation/COMPANY_BOUNDARIES.md)
for implemented scope. Company source uses main-only trunk with independent package verification
and target selection; this release lifecycle is not yet complete.
Actual company sources and execution evidence are held outside this product checkout.
The product has no built-in private Company package. Synthetic examples live only in development fixtures.
Company packages are independently built, published and pinned; the native host validates and isolates them.
Prior source-import experiments are retired and are not evidence of native package acceptance.
