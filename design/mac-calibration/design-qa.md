# Portfolio design calibration — revision 02

Historical record. Current redesign evidence is in the local revision 03 record (`evidence/v3/README.md`, excluded from product Git).

Final result: passed for the local design-preview checks below. This is not user design acceptance or a completed Mac application.

## Requested changes

All interface text is English, including accessible labels, search/empty states, details, navigation, component examples, and typography specimens. The redesign retains the official shadcn Mira/Base UI components and the pinned OpenBoa brand source.

The previous delivered screen was reviewed with the revised 1440×900 screen. The concrete changes are:

- A single page header replaces repeated company/page headers. Design-review tools take less space.
- Account equity and trading P&L form one primary group. Deposits have a supporting role.
- Performance defaults to trading P&L excluding deposits; Equity remains selectable and identifies the deposit explicitly.
- Exposure, partial fill, Atlas's current work, next review condition, and the conversation entry form one right-hand column.
- The position row uses aligned numeric columns and clear paired entry/mark values.
- Sections use spacing, alignment, and two surface levels. No section divider lines were added.

## Verified in the browser

| Check | Evidence / result |
| --- | --- |
| Main screen, 1440×900 | `evidence/portfolio-v2-light.jpg`; capital, chart, position, owner controls, and CEO context visible |
| Dark theme | `evidence/portfolio-v2-dark.jpg`; chart line and tick labels use theme-aware brand colors |
| 1100×720 | `evidence/portfolio-v2-1100.jpg`, `portfolio-v2-layout.json`; no document/workspace horizontal overflow, fixed owner controls visible, body scroll reaches lower records |
| Performance modes | P&L caption excludes cash flows; Equity caption includes deposits and chart labels the +10,000 deposit; `portfolio-v2-equity.jpg` |
| Records | Positions, Open orders, and Activity tabs display their corresponding sample records |
| Position detail | `portfolio-v2-position.jpg`; observations, units, decision context, published revision and preview scope visible |
| Search | Unmatched query shows an empty state; BTCUSDT query returns the matching sample record |
| Conversation | Ask Atlas opens the selected position context; input accepts text; sending remains disabled in preview |
| Keyboard | Escape closes the sheet; original position trigger receives focus after closing |
| English coverage | No Korean characters in rendered Portfolio, Components, Typography; none in UI source strings |
| Typography | Eight roles match the original size, line height and weight; Exposure units corrected to complete 12/16 metadata role |
| Component reference | `evidence/components-v2-light.jpg`; official sizes and interaction states retained |
| Console | No errors/warnings observed in the preview browser |
| Source verification | OpenBoa exporter: 15 files, 8 complete roles, 6,706 aliases verified |
| Build | TypeScript/Vite build and App/ComponentSpec ESLint pass |

Independent review caught the company-switcher chevron being clipped and the Exposure currency units inheriting a partial text style. Both were corrected before handoff. Dark chart tick labels were also changed from the chart library's fixed gray to the semantic muted color.

## Limits

All market/account/activity/agent records are explicit synthetic design data. No model, exchange, or company service is connected. Other company areas are presentation panels, not full application screens. Search only filters the displayed sample records. There is no financial authority or live order action.

The 1100px layout intentionally uses internal vertical scrolling. Full accessibility certification, actual Tauri behavior, and production backend integration were not tested. Vite still reports its upstream template native-config compatibility notice and an approximately 811KB JS chunk warning; production packaging/optimization is outside this calibration.

Reference implementations: [shadcn blocks](https://ui.shadcn.com/blocks), [shadcn charts](https://ui.shadcn.com/charts/area), and the previously selected [Mira preset](https://ui.shadcn.com/create?preset=b1D0dv72&template=vite).
