# README Markdown Readability Design

## Context

OURO-239 reframed the README around Ouroboros's weak-to-strong thesis, the use of
frontier agents as leverage, and trading as the first test domain. The content is
truthful, but the page still asks a first-time reader to cross several long paragraphs,
a wide navigation row, two dense tables, and a linear text diagram before they can form
a compact mental model.

The follow-up direction is deliberately restrained. The README should become easier to
scan through Markdown structure rather than through a new brand system, decorative hero,
or screenshot that can become stale.

## Decision

Use a Markdown-first README with:

- one sentence stating the thesis;
- three short first-reader claims: the problem, the method, and why trading;
- one visible paper-only authority callout;
- one Mermaid research-loop diagram that also explains the essential architecture;
- a Desktop-first quickstart near the top;
- narrow bullets and small tables instead of paragraph walls and wide comparison tables;
- progressive disclosure from philosophy to operation to repository detail.

Do not add a logo treatment, generated illustration, screenshot, custom SVG, badge wall,
or a second diagram in this change.

## Audience

The primary reader is a technical person interested in AI development who does not yet
know Ouroboros. Trading and crypto readers are an important secondary audience, but the
opening must make clear that trading is the chosen proving ground, not the project thesis.

Within the first screen, a reader should understand:

1. Frontier agents can generate more plausible work than we can reliably select.
2. Ouroboros uses agents such as Codex as leverage instead of rebuilding the agent or
   harness layer.
3. Candidate generation is separated from external evaluation and later authority.
4. Trading is the first high-pressure domain, currently limited to public-data paper
   operation.

## Information Architecture

The README will use this order:

1. `Ouroboros`: title, CI badge, thesis, and a compact paper-only callout.
2. `Why Ouroboros`: three short blocks for problem, approach, and why trading.
3. `The research loop`: one Mermaid loop plus three authority rules.
4. `Quickstart`: prerequisites, Desktop launch, health/status verification, and headless
   alternative.
5. `What exists today`: separate scannable lists for built evidence controls and outcomes
   still to prove.
6. `System boundaries`: Research, Arena, Gateway, and Ledger responsibilities plus the
   canonical product vocabulary.
7. `Operate and develop`: provider setup, common commands, repository guards, and the
   required S5 developer/detail note.
8. `Repository map`: compact path-to-purpose table.
9. `Read next`: the canonical documentation links.

The long inline navigation row will be removed. The section order itself should be clear
enough that a table of contents is unnecessary at this length.

## Opening Copy Contract

The opening thesis remains:

> Ouroboros is a weak-to-strong research system for turning advances in frontier agents
> into cumulative, externally verified progress—tested first in trading.

The introduction must state the following without leading with internal type names:

- **Problem:** generation is improving faster than trustworthy selection.
- **Approach:** use frontier agents to produce candidates, freeze their exact artifacts,
  evaluate them outside the generating session, and carry released findings and lineage
  into the next generation.
- **Why trading:** markets make cost, risk, regime change, and prospective evaluation hard
  to hand-wave away.

Codex is the only current non-fixture provider path. Claude Code and future agents may be
named only as intended sources of leverage, not as implemented integrations.

## Research Loop Diagram

The single Mermaid diagram will show this feedback loop:

```text
Frontier agents
-> diverse candidate TradingSystems
-> frozen exact artifacts
-> evaluator-owned admission and evaluation
-> prospective paper evidence after cost and risk
-> released findings and lineage
-> next generation
```

The diagram and its adjacent notes must preserve three authority boundaries:

- a ResearchWorker generates candidates but cannot grade or admit itself;
- a TradingSystem reaches public market data and fake execution only through Gateway;
- paper evidence grants neither private exchange access nor live-order authority.

The detailed persisted evidence graph belongs in `ARCHITECTURE.md` and the maintained
protocol documents, not in the README diagram.

## Quickstart Contract

The quickstart must remain truthful and executable:

- `npm install`
- `npm run dev:operator-desktop`
- `curl -fsS http://127.0.0.1:4173/health`
- `./bin/ouroboros status`
- `./bin/ouroboros runtime serve` and `./bin/ouroboros arena status` as the headless path

It must explain that the Desktop app starts or reuses the local runtime, the repository CLI
is `./bin/ouroboros`, the Web surface is development-only, and Arena start requires provider
setup. Native prerequisites and the Codex/Docker Sandboxes prerequisites must remain visible
without delaying the first launch commands.

## Truth And Compatibility Constraints

The rewrite must preserve these exact repository contracts:

- `Desktop app is the primary interactive operator surface`
- `CLI remains the complete baseline`
- `share the same runtime/store-backed session data`
- `Candidate Arena -> Trading System -> System Code -> research preflight -> selected Paper Trading -> Gateway -> Ledger`
- `Runbooks for Docker Sandboxes \`sbx\`/\`sdx\`, S5 audits, recovery helpers`
- `developer/detail surfaces`
- `Use the relevant npm script \`--help\` output`
- `Linear workflow notes`

The README must not claim stock support, Claude Code integration parity, private exchange
access, signed requests, live orders, profitability, completed generalization, or completed
weak-to-strong success.

## Scope

Owned files:

- `README.md`
- this design document
- one implementation plan under `docs/superpowers/plans/`

No product code, tests, application UI, app icons, branding assets, or architecture contracts
change. The follow-up must use a new Linear issue rather than reopening completed OURO-239.

## Validation

Required local checks:

```bash
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
npm test -- apps/operator-desktop/desktop-shell.test.ts apps/runtime/test/s5-sbx-validation-script.test.ts
```

Manual review must confirm:

- the first screen communicates problem, approach, and trading-as-test-domain;
- every paragraph is short enough to scan;
- the Mermaid diagram renders on GitHub and carries useful alt text through its labels;
- commands and relative links are correct;
- narrow-screen reading does not depend on a wide table;
- no current capability is promoted into a future claim.

The branch will proceed through an independent content/truth review, current-head CI,
current-head review freshness, and squash merge. Linear writeback will record the design,
PR, validation, and merge evidence when the bundled OAuth Connector is available.
