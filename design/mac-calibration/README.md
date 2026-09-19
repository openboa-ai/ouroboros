# Ouroboros design calibration

A development harness importing the canonical Mac UI from `apps/mac/src`. There is no separate screen implementation. Revision **03** implements four destinations: **Portfolio**, **Company**, **Conversations**, and **Library**. The interface is entirely in English. The top bar switches between **App**, **Components**, and **Typography**, with five explicit synthetic data scenarios.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4178 --strictPort
```

## Foundation

Official [shadcn/create Mira · Base UI preset](https://ui.shadcn.com/create?preset=b1D0dv72&template=vite), generated with shadcn 4.21.0. Installed versions are pinned in the lockfile. Sidebar, buttons, inputs, tabs, charts, tables, badges, avatars, progress and sheets use the actual registry components.

OpenBoa Brand System release `2026.08.23`, commit `e93f55cbfd90b668ef9d77875f71d8e53f7ceb4b`. The supplied Martian Grotesk font, symbol, license and provenance are retained.

| Canonical layer | Location under `apps/mac/src` |
| --- | --- |
| Brand and semantic roles | `ui/tokens/`, `../public/brand/` |
| Registry controls and variants | `ui/primitives/`, `ui/variants/` |
| Semantic reusable components | `ui/components/` |
| Shell and inspector layouts | `ui/layouts/` |
| Navigation and composition | `app/Workspace.tsx`, `navigation.ts` |
| Investment | `domains/investment/` |
| Common company, conversations, library | `features/` |
| Explicit scenarios and component boards | `development/` |

The preview entry imports the canonical `apps/mac/src/development/Calibration` directly.
Retired compatibility shims and starter assets were removed; keep screens, primitives and tokens
in the app source. The token exporter writes canonical `apps/mac/src/ui/tokens`.
See [UI implementation rules](../../docs/design/UI_IMPLEMENTATION.md).

Each typography role includes size, line height, weight, tracking and width. Body 14/20, data 13/18, controls 13/16, metadata 12/16, section labels 14/20, page title 20/28, primary amount 28/36, secondary amount 24/32px. Numeric columns use tabular figures. Section hierarchy uses spacing and surfaces, not separator lines.

## Preview behavior

Portfolio prioritizes current capital and the selected period's trading result, with cash movements and operating costs kept distinct. Exposure emphasizes notional value and remaining order quantity. At 1100px, exposure appears before the chart so it remains easy to reach.

The 1D/7D selector changes history and breakdown scope. P&L and Equity expose their actual sample observations through **View data**. A historical point opens its own value and timestamp. Position → order → rationale → exact file revision is navigable in one detail panel with a back stack. **Ask Atlas** opens the CEO's personal room with the selected reference; returning restores the original destination and detail stack.

Company separates continuing member identity from current work and execution. Trace expands public tool inputs/results and links to the corresponding sample record. Library filters materials and opens the fixed workspace/revision/path. Conversations preserves room drafts and saves messages locally with **Not delivered** feedback; no agent reply is fabricated.

Owner controls and Connections remain fixed in the shell. Stop/cancel review shows an exact target and remaining obligations; effective commands are disabled. This is a composition prototype, not a production module-loader or an authorization boundary. No account, model or company service is connected.

```sh
python3 scripts/export-brand-tokens.py --from-vendored --check
npm run build
npm --prefix ../../apps/mac run lint
```

See Mac implementation verification (retained local evidence; excluded from product Git) for current evidence. [Revision 03 screenshots](evidence/v3/README.md) retain the accepted pre-migration design. [design-qa.md](design-qa.md) and `evidence/*v2*` retain the earlier revision's historical checks. User design acceptance and actual product implementation remain separate steps.

## Purpose and interaction specification

[UI Purpose Contract](../../docs/design/UI_PURPOSE_CONTRACT.md) defines the question, evidence,
layout rationale, behavior, states and acceptance criteria for all four product destinations and
the shared shell, controls, connections and setup flows. `UX:` comments in the compositions link
to stable element IDs; generated shadcn internals inherit the shared primitive contract.

[Purpose audit](evidence/purpose-audit/REPORT.md) records revision 02's gaps from a chair's
investigation flow. Revision 03 implements the connected local flows listed above; the
[current coverage table](../../docs/design/UI_PURPOSE_CONTRACT.md#coverage) identifies remaining product work.
