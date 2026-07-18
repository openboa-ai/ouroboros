# Operator Design System

This document is the visual and interaction contract for the Ouroboros Operator. It owns the
shadcn preset, theme tokens, component rules, responsive behavior, and UI verification. Product
meaning, evidence, commands, and authority remain owned by the domain and application contracts.

The Operator is a dense, long-running operations product. It is not a marketing site. Its first
screen must expose real system state, current evidence, and valid actions without decorative hero
content, invented records, or tutorial copy.

## Foundation

The implementation uses shadcn as open code. Primitive source lives in
`apps/operator-web/src/components/ui`, configuration lives in
`apps/operator-web/components.json`, and semantic theme tokens live in
`apps/operator-web/src/styles.css`.

| Setting | Contract |
| --- | --- |
| Preset basis | `b3kJo21Jq` |
| Reference preset | `b3kJo2qQs` |
| shadcn style | `radix-nova` |
| Base color | `mist` |
| Font | Inter Variable |
| Icons | Lucide |
| Menu | default translucent, subtle accent |
| CSS strategy | semantic CSS variables |
| Maximum radius | 8px |

The reference preset uses generic orange and a 10px default radius. The Ouroboros preset changes
the icon library to Lucide and the radius option to `small`. The exact brand, accessible
foreground, and chart hierarchy are repository-owned constraints, so `shadcn preset resolve` may
report those color fields as local fallbacks.

Use the official CLI instead of copying component source from a website:

```bash
npm exec --yes shadcn@4.13.1 -- init --preset b3kJo21Jq --base radix --cwd apps/operator-web
npm run ui:info -w @ouroboros/operator-web
npm run ui:preset -w @ouroboros/operator-web
npm run ui:resolve -w @ouroboros/operator-web
npm run ui:add -w @ouroboros/operator-web -- <component> --dry-run
npm run ui:add -w @ouroboros/operator-web -- <component> --diff
```

An upstream component update is reviewed as source code. Never overwrite a locally changed
primitive without reading the CLI diff and rerunning the Operator checks.

## Color Contract

Ouroboros has one brand color:

| Name | Value | Use |
| --- | --- | --- |
| Brand | `#F37021` / `rgb(243 112 34)` / Pantone 158 C | Primary actions, active identity, primary chart series, and focused brand signals |
| Brand foreground | `#17120F` | Text and icons on the brand color |

White text on `#F37021` has insufficient normal-text contrast. The dark neutral foreground is the
required filled-control pairing. Do not introduce a second brand hue or substitute a nearby
Tailwind orange. Derived hover, selected, and subtle states use alpha or `color-mix` from the one
brand token.

Success, warning, destructive, and information colors are semantic state signals, not brand
colors. They may not be used for navigation identity, decoration, or data series that lack the
corresponding meaning. Neutral mist surfaces carry the majority of the interface.

Charts use the brand color for the primary inspected series. Additional non-semantic series use
neutral steps. Positive and negative colors appear only when the data meaning is explicitly
positive or negative. A color difference must also have a text, icon, shape, or label distinction.

## Type, Density, And Shape

Inter Variable is the only product font. Use tabular numerals for prices, money, durations,
counts, percentages, and identifiers whose alignment matters. Headings inside operational panels
remain compact; hero-scale type is not part of the Operator.

The spacing rhythm is based on 4px. Common controls are 32px high, dense controls may be 28px,
and primary touch targets on narrow layouts must reach 40px through their surrounding hit area.
Panels and cards may use at most 8px radius. Pills are reserved for status tokens whose shape has
meaning; general controls, navigation items, and containers are not pills.

Borders and surface changes establish hierarchy. Shadows are limited to overlays and the smallest
necessary separation. Page sections are unframed. Cards are for repeated records, dialogs, or a
genuinely bounded tool, and cards are never nested inside cards.

## Component Ownership

Use shadcn primitives directly when they already express the interaction. Feature components may
compose several primitives around a real product object, but the repository must not recreate one
wrapper component for every shadcn primitive.

| Layer | Owns | Examples |
| --- | --- | --- |
| `components/ui` | Accessible interaction primitive and variants | Button, Sidebar, Tabs, Table, Sheet, Tooltip, Chart |
| feature component | Product-specific composition and readable state | Arena system row, Research session timeline, runtime health strip |
| screen | Selection, filtering, route state, command placement, and responsive composition | Arena, Research, Trading, Evidence, System |
| API/view-model adapter | Read-model normalization and command invocation | Operator fetch state, Arena list projection, Research detail projection |

Feature components must not import runtime internals. Screens receive read models and command
callbacks. UI state may select, filter, expand, or navigate; it does not grade candidates, infer
missing evidence, or grant authority.

Use Lucide icons for familiar actions. An icon-only button requires an accessible name and a
tooltip when its meaning is not universal. Use text buttons only for explicit commands. Use tabs
for views, segmented controls for modes, switches or checkboxes for binary settings, and inputs,
steppers, or sliders for numeric values.

## Application Structure

The greenfield Operator information architecture is:

1. **Arena**: actual paper TradingSystems, comparable performance, lifecycle, isolation, traces,
   logs, and evidence.
2. **Research**: actual methodology sessions, goals, hypotheses, evidence inputs, progress,
   generated artifacts, admission, and Arena handoff.
3. **Trading**: selected paper state and future live handoff state without implying live authority.
4. **Evidence**: immutable Ledger, evaluation, and provenance readback.
5. **System**: runtime, provider, sandbox, Gateway, recovery, and health state.

Arena and Research use a master-detail model. The master side is optimized for comparison and
selection. The detail side explains one exact object through stable identity, lifecycle, evidence,
trace, logs, and valid actions. On narrow layouts, selection navigates to a full-width detail view
with a conventional back action rather than compressing both columns.

Global chrome contains only the product identity, primary navigation, runtime status, freshness,
and commands that apply globally. Commands affecting one TradingSystem or Research session stay
beside that object. Dangerous or authority-changing commands require an explicit confirmation
surface and cannot rely on color alone.

## State Contract

Every data surface must distinguish these states without substituting fixtures:

| State | Required rendering |
| --- | --- |
| Loading | Stable skeleton matching final geometry; no layout jump |
| Empty | Exact absence and the next valid action, when one exists |
| Running | Lifecycle, owner, freshness, progress, and stop/recovery posture |
| Waiting | What evidence, resource, schedule, or dependency is awaited |
| Degraded | Usable data plus the exact stale, failed, or unavailable part |
| Failed | Failure source, latest safe evidence, retry/recovery posture, and authority boundary |
| Stopped | Terminal or operator-stopped reason and last durable evidence |
| Completed | Result, evidence identity, lineage/handoff, and completion time |

Never render configured Research directions as active sessions, fixture candidates as running
systems, ResearchPreflight scores as Arena rank, or a missing read model as a healthy empty state.
Timestamps include freshness semantics. Logs and traces are sanitized, selectable text with stable
ordering and no secret values.

## Accessibility And Responsiveness

All workflows must be operable by keyboard. Focus remains visible, follows visual order, returns
to its invoker after overlays close, and moves deliberately when a narrow-layout master selection
opens detail. Tables need real headers. Status changes exposed after a command need an appropriate
live region. Motion respects `prefers-reduced-motion`.

At minimum, validate 1440x960 Desktop, 1180x760 minimum Desktop, 768px tablet, and 390px narrow
layouts. Fixed-format elements use stable grid tracks, aspect ratios, and min/max constraints.
Text wraps without overlapping controls. Horizontal scrolling is limited to genuinely tabular or
log content and is never used to conceal the primary workflow.

## Delivery And Audit

UI changes follow the same evidence discipline as `shadcn/improve`: map the current code and
intent, write a self-contained bounded plan, stamp its base commit, define verification and stop
conditions, implement in an isolated worktree, review the diff against the plan, and reconcile
drift before landing. Linear coordinates the work; this document, source, tests, and screenshots
remain canonical.

OURO-233 installs this foundation without deriving from the old Operator hierarchy. OURO-234
switches the application entrypoint to the new UX and atomically deletes the old `App` rendering,
`src/design-system`, legacy shell and feature sections, obsolete primitive copies, and old-layout
tests after functional parity is demonstrated. OURO-229 and OURO-230 then connect the final Arena
and Research runtime behavior to the new screens without creating another UI system.

Before a UI PR can merge:

```bash
npm run typecheck -w @ouroboros/operator-web
npm run build -w @ouroboros/operator-web
npx vitest run apps/operator-web/src
npm run check:repo-guards
```

Visually meaningful work also requires rendered Desktop and narrow captures, overflow and overlap
inspection, keyboard-path verification, and a current-head Codex review.
