# Clean-Slate Repository Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Ouroboros tree with a minimal, secure, language-neutral repository baseline while preserving Git history.

**Architecture:** Remove every product and delivery surface, then recreate only repository identity, vulnerability reporting, ownership, pull-request context, secret scanning, action scanning, and language-neutral integrity checks. The reset deliberately provides no runtime or product compatibility.

**Tech Stack:** Git, GitHub Actions, CodeQL for Actions, Gitleaks, Dependabot.

**Spec:** `docs/superpowers/specs/2026-08-22-clean-slate-repository-reset-design.md`

## Global Constraints

- Preserve Git history and the `openboa-ai/ouroboros` repository.
- Preserve no API, schema, command, runtime, UI, CLI, package, or Linear compatibility.
- Do not select a replacement programming language or application framework.
- Keep GitHub Actions permissions deny-by-default and pin third-party actions to full commit SHAs.
- Do not modify or delete the original dirty control checkout.

---

### Task 1: Preserve the Reset Decision in Git History

**Files:**
- Create: `docs/superpowers/specs/2026-08-22-clean-slate-repository-reset-design.md`
- Create: `docs/superpowers/plans/2026-08-22-clean-slate-repository-reset.md`

**Interfaces:**
- Consumes: the user-approved reset boundary.
- Produces: a recoverable design and exact execution contract in Git history.

- [ ] **Step 1: Review the design and plan for placeholders and contradictions**

Run:

```bash
rg -n 'T[B]D|T[O]DO|implement lat[e]r|fill i[n]' \
  docs/superpowers/specs/2026-08-22-clean-slate-repository-reset-design.md \
  docs/superpowers/plans/2026-08-22-clean-slate-repository-reset.md
```

Expected: no output.

- [ ] **Step 2: Validate Markdown and whitespace**

Run:

```bash
git diff --check
```

Expected: exit 0.

- [ ] **Step 3: Commit the reset decision**

```bash
git add docs/superpowers/specs/2026-08-22-clean-slate-repository-reset-design.md \
  docs/superpowers/plans/2026-08-22-clean-slate-repository-reset.md
git commit -m "docs: define clean-slate repository reset"
```

### Task 2: Remove the Historical Product and Delivery System

**Files:**
- Delete: all tracked paths except the approved baseline files.
- Replace: `.gitignore`

**Interfaces:**
- Consumes: the reset design committed in Task 1.
- Produces: an empty product surface with no legacy compatibility.

- [ ] **Step 1: Remove explicit legacy roots and configuration files with `git rm`**

Remove `.agents`, `.codex`, `.dockerignore`, environment examples, `.githooks`, `.ouroboros`,
`AGENTS.md`, `ARCHITECTURE.md`, `LINEAR.md`, Docker files, application/package/docs/research/test
trees, package manifests, TypeScript configuration, and Vitest configuration. Also remove the old
GitHub workflows and pull-request template before recreating them in Task 3.

- [ ] **Step 2: Verify no unapproved tracked path remains**

Run a tracked-file whitelist check against the exact final paths listed in the spec.

Expected: no unapproved path.

### Task 3: Create the Secure Repository Baseline

**Files:**
- Create or replace: `README.md`
- Create: `SECURITY.md`
- Create: `CODEOWNERS`
- Replace: `.gitignore`
- Replace: `.github/pull_request_template.md`
- Create: `.github/dependabot.yml`
- Replace: `.github/workflows/ci.yml`
- Replace: `.github/workflows/codeql.yml`
- Replace: `.github/workflows/gitleaks.yml`

**Interfaces:**
- Consumes: GitHub repository metadata and organization security ownership.
- Produces: a language-neutral repository that can accept later whitepaper and implementation PRs.

- [ ] **Step 1: Write the reset-state identity and security documents**

State that no runtime is currently shipped, historical implementation is intentionally retired,
private vulnerability reports use the repository Security tab, and product definition comes next.

- [ ] **Step 2: Write ownership and pull-request context controls**

Protect `.github/**`, `CODEOWNERS`, and `SECURITY.md` with `@openboa-ai/security-maintainers`. Require
Context, Decision, Scope, Security, Validation, and Follow-up sections in pull requests.

- [ ] **Step 3: Write language-neutral integrity and security workflows**

Use full commit SHAs for Checkout and CodeQL. Keep permissions read-only except CodeQL
`security-events: write`. Scan complete Git history with checksum-verified Gitleaks.

- [ ] **Step 4: Add monthly GitHub Actions dependency updates**

Configure Dependabot for the `github-actions` ecosystem only.

### Task 4: Validate, Commit, and Publish the Reset

**Files:**
- Verify: the entire final tracked tree and GitHub workflow set.

**Interfaces:**
- Consumes: the final reset tree.
- Produces: a reviewable Git commit and pull request.

- [ ] **Step 1: Validate the exact file whitelist**

Expected tracked files:

```text
.github/dependabot.yml
.github/pull_request_template.md
.github/workflows/ci.yml
.github/workflows/codeql.yml
.github/workflows/gitleaks.yml
.gitignore
CODEOWNERS
README.md
SECURITY.md
```

- [ ] **Step 2: Validate workflows, action pinning, secrets, and whitespace**

Run YAML parsing, full-SHA action-reference checks, Gitleaks over Git history, and
`git diff --check`. Every command must exit 0.

- [ ] **Step 3: Commit the reset**

Commit with subject:

```text
chore: reset Ouroboros for clean-slate reconstruction
```

The body must record the research-first and enum-heavy architecture retirement, history
preservation, compatibility rejection, complete product/runtime/schema/docs removal, minimal
security baseline, and whitepaper-first follow-up.

- [ ] **Step 4: Push and open the pull request**

Push `codex/clean-slate-reset`, open a PR against `main`, and include Context, Decision, Scope,
Security, Validation, Follow-up, and recovery-through-history sections.
