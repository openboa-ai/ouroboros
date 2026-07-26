# README Philosophy And First-Reader Design

Status: approved in conversation; pending written-spec review before implementation.

Linear issue: `OURO-239`

## Goal

Rewrite the root `README.md` so a technical reader interested in AI development can understand,
within the first screen, what Ouroboros believes, what problem it is trying to solve, how it
approaches that problem, why trading is its first domain, and which claims are implemented versus
still unproven.

The README must remain useful to readers who are interested in stocks, crypto, systematic trading,
or market research. That appeal comes from a concrete and difficult market challenge, transparent
paper evidence, and explicit costs and risk—not from profitability promises or promotional PnL.

## Audience

The primary reader is technically literate and interested in AI agents or AI research but does not
know Ouroboros or its internal taxonomy. The secondary readers are:

- market and crypto enthusiasts who want to understand what competes, how performance is measured,
  and why the evidence is credible;
- contributors who need a fast path to prerequisites, installation, operation, architecture, and
  validation.

The README must not require prior knowledge of `CandidateArena`, `ResearchWorkerSession`, or other
persisted record types before it gives the reader a compact mental model.

## Selected Narrative

Use a thesis-first narrative. The product is not introduced primarily as an AI trading bot or a
dashboard. It is introduced as a weak-to-strong research system that tries to convert progress in
external AI agents into cumulative, externally verified progress. Trading follows as the first
adversarial, dynamic, and economically observable domain chosen to test that method.

The opening thesis should express this meaning in compact language:

> Ouroboros is a weak-to-strong research system for turning advances in frontier agents into
> cumulative, externally verified progress—tested first in trading.

The first screen then establishes four claims:

1. AI agents are improving at generation faster than systems are improving at deciding what to
   trust, retaining what was learned, and making progress compound.
2. Agents generate candidates; they do not grade themselves or grant themselves authority.
3. Frozen candidate artifacts are evaluated outside the generator, and positive, negative,
   invalid, and duplicate outcomes become memory for the next generation.
4. Trading is the first test domain, not the thesis.

## Frontier-Agent Leverage Doctrine

Ouroboros does not compete with frontier labs to build a foundation model, a general-purpose coding
agent, or another generic agent harness. OpenAI, Anthropic, and future frontier labs can advance
models, agents, tool use, and general harness capabilities faster than this project should try to
reproduce them.

Ouroboros treats OpenAI Codex, Anthropic Claude Code, and future frontier agents as an improving
supply of external intelligence. It owns the domain and evaluation layer those agents must not own:

- choosing a difficult, externally gradable problem;
- giving workers bounded tools and workspaces;
- generating a diverse population of frozen candidate systems;
- keeping generation separate from evaluation;
- preserving evidence, failures, duplicates, findings, and lineage;
- deciding what evidence permits more authority;
- feeding only bounded, released memory into the next generation.

The stable relationship is:

```text
frontier labs
models -> agents -> general-purpose harness capabilities
                    |
                    v
          improving intelligence supply
                    |
                    v
Ouroboros
hard problem -> candidate search -> external evaluation
             -> evidence and memory -> next generation
                    |
                    v
trading
the first adversarial, measurable test domain
```

The provider boundary must remain accurate. The current implemented path is described as
Codex-first. Claude Code and future agents may be named as the intended external intelligence
supply, but the README must not imply equal current integration when `main` does not prove it.

## Why Trading

Trading is selected because it stresses the research method:

- markets are competitive, path-dependent, noisy, and non-stationary;
- strategies face changing regimes and cannot rely on one static benchmark;
- revenue and loss are observable, but raw PnL is not sufficient proof of quality;
- fees, funding, slippage, risk, identity, evidence purpose, and comparison opportunity change what
  an outcome can prove;
- prospective paper evidence can reject self-report and optimistic backtest narratives without
  granting live authority.

The concrete challenge should appeal to market-oriented readers without becoming a promise:

> Can an AI research system repeatedly discover a TradingSystem that beats its current champion on
> prospective paper evidence—after fees, funding, slippage, and risk—without weakening the rules of
> evaluation?

The README must state that the current concrete market boundary is `BTCUSDT` USD-M futures paper
trading over Binance public data. It must not imply current stock support, private exchange access,
signed requests, live orders, or proven profitability.

## Information Architecture

The README should follow this progressive order:

1. **Hero** — title, thesis sentence, minimal status badges, and anchor links.
2. **The thesis** — weak-to-strong problem, leverage doctrine, and generator/evaluator separation.
3. **Why trading** — the concrete challenge and the reason this is the first domain.
4. **How Ouroboros compounds progress** — one compact loop plus the Research, Arena, Gateway,
   Ledger, finding, and lineage roles.
5. **What exists today** — implemented evidence separated from open claims and future authority.
6. **Quickstart** — prerequisites, install, primary Desktop path, first inspection path, and CLI
   alternative.
7. **Product and architecture** — operator surfaces, component map, repository shape, and links to
   canonical contracts.
8. **Operate and develop** — primary commands, safety boundary, validation, deeper documentation,
   contributing, and license.

The first compact product loop should use plain concepts before internal record names:

```text
improving frontier agents
-> diverse candidate systems
-> external evaluation
-> bounded paper evidence
-> findings and lineage
-> better-informed next generation
```

Deeper terminology may appear after this mental model is established and should link to canonical
docs instead of reproducing the full evidence graph in the README.

## Readability Contract

Readability is a structural requirement, not a request to remove essential content.

- Each section answers one reader question.
- The first sentence of each section states its conclusion.
- Prose paragraphs stay short; use bullets for parallel claims, tables for comparisons, and code
  blocks for commands and sequences.
- Keep the thesis, current status, safety boundary, and unproven claims visible. Do not hide them in
  `<details>`.
- Use `<details>` only for secondary installation alternatives or developer-only command depth.
- Introduce internal types only after their plain-language concept.
- Keep one meaningful loop diagram; avoid decorative diagrams, badge walls, or images that do not
  convey current product evidence.
- Do not choose an arbitrary line-count target. Remove duplication and fast-changing implementation
  inventories, not necessary reasoning.
- Link detailed protocols to maintained canonical docs so the README remains readable and less
  vulnerable to implementation drift.

The design adapts, without copying, the progressive disclosure used by current official READMEs
for [OpenAI Codex](https://github.com/openai/codex),
[Anthropic Claude Code](https://github.com/anthropics/claude-code),
[uv](https://github.com/astral-sh/uv), and
[Browser Use](https://github.com/browser-use/browser-use): concise identity, scannable value,
early usage, examples or evidence, and deeper links.

## Claim And Evidence Contract

Every material claim must be legible as one of three layers:

1. **Core thesis** — what Ouroboros believes and is designed to test.
2. **Built today** — behavior currently supported by code, tests, and maintained docs on `main`.
3. **Still to prove** — economic frontier improvement, long-horizon generalization, causal agent
   leverage, production-duration autonomy, private access, and live authority.

The README must preserve these non-negotiable boundaries:

- researcher and candidate output are not evaluation proof;
- replay and backtest are research tools, not final product authority;
- continuous comparable paper evidence is proof gathering, not live promotion;
- the current product is paper-only and uses fake accounts, fake execution, and fake Ledgers;
- losing candidates remain useful evidence unless they are invalid, malformed, boundary-bypassing,
  risk-invalid, private, or live;
- implemented mechanisms must not be presented as completed profitability, generalization, or
  weak-to-strong success.

## Approaches Considered

### Thesis first

Selected. It makes the durable AI research philosophy clear, then grounds it in the concrete
trading problem and working product.

### Conventional problem-solution-product

Rejected as the primary narrative. It is familiar but makes Ouroboros resemble a generic AI
trading product and weakens the frontier-agent leverage philosophy.

### Product and quickstart first

Rejected as the primary narrative. It helps immediate execution but makes the reason for the
project secondary. Quickstart remains early, after the thesis, domain choice, loop, and current
status are clear.

## Owned Boundary And Non-Goals

The implementation owns the root `README.md`. This approved design document is the planning record.
Another repo doc may change only if an exact broken link or direct contradiction prevents the
README from being truthful.

Non-goals:

- changing runtime, API, architecture, taxonomy, authority, or provider support;
- adding stock trading, private data, exchange credentials, or live execution;
- claiming that Claude Code is currently integrated at the same level as Codex without evidence;
- publishing a profitability result, benchmark, roadmap, or exhaustive implementation changelog;
- adding decorative branding or stale screenshots as a substitute for explanation.

## Acceptance And Validation

Reader acceptance requires all three paths to pass:

- an AI developer can explain the weak-to-strong approach and why frontier agents are leveraged
  rather than rebuilt;
- a market-oriented reader can explain what competes, which costs and risks count, why evidence is
  external, and why current paper results are not live authority;
- a contributor can find prerequisites, installation, primary Desktop usage, CLI usage, repository
  structure, validation, and canonical docs without searching the repository.

Repository validation:

```bash
bash scripts/check-docs.sh
npm run check:architecture
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
```

Before merge, verify every command and relative link against the current PR head, complete a manual
claim audit against `AGENTS.md`, `ARCHITECTURE.md`, Project Direction, Ouroboros Doctrine,
CandidateArena And Research Goal, and Research And Arena Product Loop, then require current-head CI
and review.
