# README Philosophy And First-Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the root README so a technical AI reader can understand Ouroboros's weak-to-strong thesis, frontier-agent leverage doctrine, trading test domain, evidence boundary, current capabilities, and first-run path without prior project vocabulary.

**Architecture:** Keep `README.md` as the progressive-disclosure entry point and link detailed evidence graphs to canonical repository documents. Lead with plain-language thesis and current status, then introduce product nouns only after the compact generation/evaluation/memory loop is clear. Preserve the repo-owned commands, paper-only authority boundary, and implemented-versus-unproven distinction.

**Tech Stack:** Markdown, repository-local npm scripts, Bash documentation/security guards, GitHub pull-request checks.

## Global Constraints

- The primary reader is technically literate and interested in AI agents or AI research but does not know Ouroboros.
- Stocks, crypto, systematic-trading, and market-research readers must see a concrete hard problem and credible evidence boundary without profitability promises.
- The opening must frame Ouroboros as a weak-to-strong research system that leverages improving frontier agents; trading is the first test domain, not the thesis.
- Codex is the implemented provider path. Claude Code and future agents may be described only as intended external intelligence supply.
- The current market boundary is `BTCUSDT` USD-M futures paper trading over Binance public data with fake accounts, fake execution, and fake Ledgers.
- Do not imply stock support, private exchange access, signed requests, live orders, proven profitability, completed generalization, or completed weak-to-strong success.
- Change only `README.md` plus this implementation plan unless an exact broken link prevents truthful documentation.

---

### Task 1: Rewrite The Progressive-Disclosure README

**Files:**

- Modify: `README.md`
- Reference: `docs/superpowers/specs/2026-07-26-readme-philosophy-design.md`
- Reference: `AGENTS.md`
- Reference: `ARCHITECTURE.md`
- Reference: `docs/project-direction.md`
- Reference: `docs/ouroboros-doctrine.md`
- Reference: `docs/candidate-arena-research-goal.md`
- Reference: `docs/research-arena-product-loop.md`

**Interfaces:**

- Consumes: canonical product, architecture, authority, command, and validation truth from the referenced repository documents.
- Produces: one first-reader README with stable links into those contracts; it creates no runtime, API, provider, evaluation, or authority behavior.

- [ ] **Step 1: Record the baseline reader and truth gaps**

  Confirm the current README opens with dense product inventory, introduces internal record types before a compact mental model, and does not clearly distinguish frontier-agent leverage, implemented evidence, and open claims.

- [ ] **Step 2: Replace the opening with the approved thesis-first hero**

  The first screen must contain the title, the approved one-sentence weak-to-strong thesis, compact navigation, and four plain-language claims: generation outpaces trustworthy selection, agents generate but do not grade, frozen artifacts are externally evaluated and retained as memory, and trading is the first test domain.

- [ ] **Step 3: Explain the frontier-agent leverage doctrine and trading choice**

  State that Ouroboros does not rebuild foundation models or generic coding-agent harnesses. Describe Codex as today's implemented path and Claude Code/future agents as intended supply. Explain why competitive, noisy, non-stationary markets with observable costs and prospective paper evidence pressure-test the method.

- [ ] **Step 4: Present the compact loop before internal taxonomy**

  Use exactly one meaningful loop diagram from improving frontier agents through diverse candidates, external evaluation, bounded paper evidence, findings/lineage, and the next generation. Follow it with a small role table for Research, Arena, Gateway, and Ledger and link detailed protocols instead of copying their full graphs.

- [ ] **Step 5: Separate current implementation from unproven outcomes**

  Use an explicit `Built today` / `Still to prove` comparison. Include Codex-first bounded sessions, external admission/conformance, isolated paper operation, costs/risk/Ledger evidence, shared operator surfaces, and paper-only safety. Keep economic frontier improvement, causal agent leverage, long-horizon generalization, production-duration autonomy, multi-host operation, private access, and live authority visibly open.

- [ ] **Step 6: Add a verified quickstart and contributor path**

  Give prerequisites, `npm install`, `npm run dev:operator-desktop`, runtime health/first inspection, and the CLI alternative. Keep the Desktop app primary, Web explicitly a development surface, and the CLI available for headless operation. Include compact operate/develop commands, repository shape, validation, canonical docs, contributing, and license links only when the linked files exist.

- [ ] **Step 7: Audit readability and claims**

  Check that each section answers one reader question, opens with its conclusion, uses short paragraphs/bullets/tables, introduces internal nouns after plain concepts, keeps safety and open claims visible, and contains no decorative badge wall or unsupported provider/trading claim.

### Task 2: Verify And Deliver The README

**Files:**

- Verify: `README.md`
- Verify: every relative Markdown link and documented command against the current branch head.

**Interfaces:**

- Consumes: the completed README diff and repository validation scripts.
- Produces: local verification evidence, independent review, current-head CI/review evidence, merged GitHub truth, and Linear workpad readback.

- [ ] **Step 1: Run the repository documentation contract**

  ```bash
  bash scripts/check-docs.sh
  npm run check:architecture
  npm run check:naming
  bash scripts/check-env-files.sh --tracked
  bash scripts/check-secrets.sh
  git diff --check
  ```

- [ ] **Step 2: Manually audit commands, links, and claims**

  Verify every README command exists in `package.json`, `bin/ouroboros`, or the canonical command contract; verify every relative link resolves; compare material claims with the design spec and canonical documents named in Task 1.

- [ ] **Step 3: Request independent reader and repository review**

  Require the reviewer to test three readings: AI developer, market-oriented reader, and contributor. Fix all Critical and Important findings inside the same README boundary.

- [ ] **Step 4: Commit, push, and open one ready PR**

  Use branch `codex/OURO-239-readme-philosophy`, a title beginning `[OURO-239]`, and a PR body containing exactly `OURO-239`.

- [ ] **Step 5: Complete the current-head PR loop**

  Wait for all required GitHub checks, CodeQL/security gates when present, and a current-head Codex or human review. Apply bounded fixes, rerun local validation, and push until the head is clean and mergeable.

- [ ] **Step 6: Squash-merge and write back**

  Merge only after current-head CI and review are clean. Read back the merge commit, then update and re-read the existing Linear `## Codex Workpad` with the PR, validation, review, merge, released writer lease, and final issue state.
