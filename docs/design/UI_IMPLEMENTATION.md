# UI implementation and reuse contract

Status: 2026-09-14. The user accepted calibration 03 and authorized the Mac UI
implementation. This document covers client implementation; it does not declare
the autonomous company, investment backend or live Gateway contract complete.

## One product UI source and independent Company packages

`apps/mac/src` is canonical. `design/mac-calibration` is a development harness:
its source re-exports the app, and its tokens, registry controls, assets and CSS
resolve to the app source. Changes must not be copied between two implementations.
Its Components and Typography boards exercise the same production primitives.

The fixed Workspace is Home / Work / Agents / System / Conversations / Library / Notifications,
with one Settings entry and fixed Owner controls. Company pages are independently delivered private
packages; the current Portfolio is a synthetic domain reference, not live investment integration.
Conversations is the single communication destination and Library retrieves exact retained materials.
[Integrated System Design](../architecture/SYSTEM_DESIGN.md) owns source/environment/package/data
boundaries; [Application Shell and Views](../architecture/APPLICATION_SHELL_AND_VIEWS.md) owns screen
and bridge behavior. Company code consumes the released SDK instead of this app's source paths.
The detailed purpose of each element remains in [UI_PURPOSE_CONTRACT](UI_PURPOSE_CONTRACT.md).
`UX:` comments on compositions refer to those IDs instead of inventing another spec.

## Dependency direction

```text
OpenBoa tokens → shadcn primitives → semantic components → shared layouts
                                                           ↑
                             app composition ← screen components
                                    ↑                 ↑
                              source adapters → typed view models
```

| Change | Owning source | Required reuse rule |
| --- | --- | --- |
| Color / typography / spacing | `apps/mac/src/ui/tokens/` | Change semantic roles once; never override a font size per screen |
| Button / tab / input behavior | `ui/primitives/` + `ui/variants/` | Use the actual registry primitive, keyboard behavior and variants |
| Numeric or record presentation | `ui/components/Amount.tsx`, `RecordLink.tsx`, etc. | Pass unit, identity, label and state; do not bake in USDT or CEO identity |
| Sidebar / header / inspector | `ui/layouts/` | One structure for all destinations; fixed control entries are shell-owned |
| Route / detail / return state | `app/Workspace.tsx`, `navigation.ts` | Use the common reducer; do not create screen-local modal histories |
| Common work / communication / files | `features/operations`, `conversations`, `library` | Common features must not import investment or development fixtures |
| Private Company surface | Product `modules/`, native `company_views.rs`, released `packages/company-ui-sdk/` | External JSON/SDK contracts and isolated code; never import private React source into the product |
| Financial interpretation | Current `domains/investment/` is a synthetic migration reference | Move financial UI to private Company source; services/enforcement/adapters are Company packages, not product built-ins |
| Source or native operation | `data/`, `features/gateway/`, `client.ts`, Rust | Translate the source through explicit adapters; no fallback to sample records |

`npm run verify:ui`, also run by `npm run build`, checks the current import boundaries
and rejects inline numeric typography in app/screen compositions. This is a
development guard, not a server authorization mechanism or a proof of every CSS property.
Relative imports and new folders must still receive review.

## Component and layout decisions

- Typography uses complete OpenBoa roles (size, line height, weight, tracking and
  width), with tabular numeric figures. `ui/recipes.css` binds control types to roles.
- `layout.css` owns sidebar, inspector and header dimensions. Shared surfaces,
  spacing and focus behavior live in layouts/recipes. Investment responsive rules
  live beside Portfolio; common layouts do not depend on `.portfolio` selectors.
- Each semantic component has one implementation file. `patterns.tsx` only exports
  them. Screens compose components and supply meaning, not alternative button styles.
- `WorkspaceLayout` owns navigation, the fixed Settings entry and Owner controls. A screen adapter
  supplies data and content components; it cannot remove these controls.
- `Workspace<T>` accepts stable React screen/inspector components and a typed model.
  Destinations remain mounted while hidden, retaining local filters and drafts.
  Source changes remount the workspace to prevent sample/live state mixing.
- One full-page detail controls close, back and focus. Discussion retains the source
  destination and detail stack with the full scoped artifact reference. Returning restores the
  selected revision and record; there is no separate fixed right-side inspector requirement.
- Per-screen errors leave the fixed shell available. Empty, stale, restricted and
  uncertain states must be presented explicitly, not transformed into zero or success.
- Browser and Tauri share a FilePort contract. Only the native adapter invokes the
  fixed Rust save command. Generic components contain no filesystem or API access.

## Adding a screen element

1. Identify the owner's question and intended action using an existing purpose ID,
   or add a missing purpose to the existing contract.
2. Add or extend the owning view model with source, observation, scope and references.
   Keep unknown values distinct from zero and preserve exact file revisions.
3. Compose existing semantic components inside the shared layout. If a reusable
   pattern is missing, define it once in `ui/components`; keep domain meaning outside it.
4. Supply explicit development examples and an independent source adapter. A fixture
   is never an API failure fallback. Do not infer authority from model-authored text.
5. Verify interaction and return context in the running build at 1440×900 and
   1100×720, both themes, and affected error/empty states. Retain relevant screen proof.

## Current adapter coverage

This is a source/evidence checkpoint, not full-system acceptance. Test results and native limits
are retained in [Company boundaries checkpoint](../implementation/COMPANY_BOUNDARIES.md).

| Path | Existing behavior | Remaining contract / verification |
| --- | --- | --- |
| Sample company | Fixed Workspace, Company Portfolio reference, local samples and explicit source distinction | No actual company/financial effect; no sample fallback after live failure |
| Gateway | Current-scope common observations, controls, messages, notifications and publication references | Complete financial/readiness/assignment and independent profile projections |
| Execution control | Exact target/revision, retained request identity and receipt inspection | Full native intervention, resource return and residual-duty acceptance |
| Conversations | Personal/group UI plus native read/send/delivery paths | Complete participant/routing/idle-wake behavior and native acceptance |
| Files | Exact native read/save, integrity/size checks and escaped text preview | Full history/creator/use/retention, all Discuss references, richer safe preview and native save dialogs |
| Company package | Independent SDK build and native separate WebView host | Environment-neutral package/verification/selected use, retention and real native containment |
| Mac lifecycle | Buildable Tauri bundle; close/reopen handlers | Actual native window/dialog/hang/version-switch, installation and recovery acceptance |

The unused earlier control-plane draft, its isolated projection, styles and tests were removed
during the final source cleanup. Extend `App.tsx → app/Workspace` and the canonical layers above.
Connected screen routing, record details and publication loading have separate components.

Current verification scope and private evidence locations are recorded in the
[implementation checkpoint](../implementation/COMPANY_BOUNDARIES.md).


## Historical screen follow-up — 2026-09-14

This records an earlier four-destination implementation pass. It is not the current navigation
contract or proof of live coverage. The fixed Workspace destinations and full-page detail behavior
above supersede that arrangement; the reusable panels and purpose IDs remain relevant.

| Surface and purpose | Implementation | State / action boundary |
| --- | --- | --- |
| Company: retained decisions and responsibility, O-04/O-13 | `development/CompanyPreview.tsx` historical History tab, typed history model | Member filtering, record drill-down; named sample events |
| Conversations: find an earlier message or reference, R-02/R-04 | `features/conversations/Conversations.tsx` room-scoped search | Independent of room search and drafts; clear/no-result states |
| Library: examine the selected publication, A-04/P-22 | Inspector Versions tab and `development/fixtures/artifacts.ts` | Current/prior content separately retained; exact revision in discussion/return/save; missing revision fails closed |
| Connections: services, resource responsibility and storage, N-02/N-03 | `features/resources/ResourcesPanel.tsx` + typed model | Categories, search, lifecycle and linked work; tab/query survives nested detail |
| Owner controls: precise intervention, T-01–T-06 | `features/controls/OwnerControls.tsx` + typed options | Scope, delegation and request history; sample review is never submission or application |
| App settings: local appearance and client behavior, S-10 | `features/settings/SettingsPanel.tsx` | System/light/dark is effective and persisted; unsupported OS integration shown explicitly |
| Entry: existing versus recovery connection, B-01–B-04 | `features/connection/ConnectionScreen.tsx` | Native profile/snapshot path reused; no auto resubmit, fabricated installation, authority or live fallback |

`DetailSection` owns spacing and section headings; `ActivityTimeline` owns the common
chronology across company history, file versions, connection preparation and request
outcomes. Settings is selected by the app composition, not the source adapter. Connections is
accessed within Settings; its former separate sidebar entry is not the current menu contract.

The follow-up sample panels described in this historical table are supplied by development adapters. Generic components
contain no Binance calculations, credentials or command dispatch. Live Gateway data
continues through its existing independent readout; the new sample panels do not claim
that complete server projections, autonomous routing or financial controls have been implemented.

Publication and activation remain distinct. Delayed observation cannot rewrite a retained
file revision. Both source and saved copy use the exact selected content. Version comparison
beyond opening the individually retained revisions remains future work.

Follow-up screen evidence is retained outside the product checkout; see the [current checkpoint](../implementation/MAC_APP.md#current-checkpoint).
