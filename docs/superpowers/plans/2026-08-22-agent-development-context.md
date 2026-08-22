# Agent Development Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise root `AGENTS.md` that routes development agents through Ouroboros's governing documents and defines the authority limits of skills and plugins.

**Architecture:** `AGENTS.md` is a routing constitution, not a second doctrine. It points agents to the existing authority hierarchy, supplies a compact operating test, and enforces the current clean-slate stage gate. `README.md` exposes it as the operational entry point. No product architecture or reusable agent capability is introduced.

**Tech Stack:** Markdown, Git, shell-based repository integrity checks, Gitleaks

**Spec:** `docs/superpowers/specs/2026-08-22-agent-development-context-design.md`

## Global Constraints

- Save repository documentation in English only.
- Do not modify `CORE_DOCTRINE.md` or `WHITEPAPER.md`.
- Do not create `.agents/`, `.codex/`, skills, plugins, schemas, services, workflows, or runtime code.
- Keep `AGENTS.md` concise and subordinate to the Core Doctrine and Whitepaper.
- Treat skills and plugins as mutable capabilities, never as sources of product authority.
- Explicitly exclude Linear because it is no longer part of the project workflow.
- Preserve repository security and integrity maintenance as permitted work before the Product Specification exists.

---

### Task 1: Add the agent development context

**Files:**
- Create: `AGENTS.md`
- Modify: `README.md`
- Reference: `CORE_DOCTRINE.md`
- Reference: `WHITEPAPER.md`
- Reference: `docs/superpowers/specs/2026-08-22-agent-development-context-design.md`

**Interfaces:**
- Consumes the authority and principles defined by the Core Doctrine and Whitepaper.
- Produces the repository entry point used by development agents before proposing or making changes.
- Does not define product behavior, implementation architecture, permissions, or an agent organization.

- [ ] **Step 1: Create the root routing constitution**

Create `AGENTS.md` with exactly this content:

```markdown
# Agent Development Context

This file is the operational entry point for agents developing Ouroboros. It routes work to the
project's governing sources; it does not replace, summarize, or reinterpret them.

## Source of Truth

Read and apply project authority in this order:

1. [`CORE_DOCTRINE.md`](CORE_DOCTRINE.md) defines the constitutionally governing purpose, identity,
   and boundaries of Ouroboros. Agents may not modify this authority; the human sovereign alone
   may amend the doctrine.
2. [`WHITEPAPER.md`](WHITEPAPER.md) explains the doctrine and the design space it establishes.
3. An approved Product Specification will define required product behavior.
4. Approved architecture and engineering documents will define provisional implementation
   choices.

When sources conflict, the higher source governs. Lower sources may refine but may not redefine
higher ones.

## Operating Test

Before proposing or making a substantive change, establish how it:

- contributes to the sustained compound growth of actual capital through authorized live trading;
- preserves live trading as the product's condition of existence;
- enables valid iteration instead of merely increasing activity;
- keeps claims of improvement accountable to independent evidence and market reality;
- preserves human sovereignty over the objective, capital, authority, and revocation; and
- grants the least authority sufficient for the purpose and the greatest autonomy within it.

If this relationship cannot yet be established, gather evidence or leave the proposal uncommitted.

## Skills

Skills are mutable methods for repeatable execution. Use an existing skill when it materially
improves the reliability or efficiency of an authorized task. Add a repository-local skill only
after recurring use demonstrates a stable need that cannot be met more simply.

A skill cannot create product authority, override a governing source, expand permissions, or turn
its current method into a permanent architectural commitment. Its outputs remain subject to the
same evidence and review as any other work.

## Plugins

Plugins provide external capabilities, not decision authority. Availability does not grant
permission to use credentials, write to external systems, deploy software, trade, move capital, or
expand an agent's authority. Those actions require authority already established for the task.

Treat plugin output as evidence to verify, not truth to inherit. Prefer the narrowest capability
sufficient for the authorized purpose. Linear is not part of the Ouroboros workflow and must not
be introduced as a dependency or source of project state.

## Change Discipline

Use the minimum structure sufficient for the distinction the system must currently express. Do
not create enums, schemas, roles, services, workflows, or abstractions before that distinction is
required by an approved specification and supported by evidence.

No organization, model, tool, or method is permanent. A candidate change may not be its sole
evaluator or approver. Preserve favorable, null, negative, and contradictory evidence together
with the decision rationale so later iterations can reconstruct what was learned.

## Current Repository Stage

The Core Doctrine and Whitepaper are the current product truth. The next authority document is the
Product Specification.

Until that specification is approved, do not implement product runtime, schemas, services,
architecture, or compatibility surfaces. Work may continue on product direction and on repository
security and integrity required to preserve a trustworthy foundation.
```

- [ ] **Step 2: Expose the operational entry point in the README**

Replace the final README paragraph with:

```markdown
The [Agent Development Context](AGENTS.md) is the operational entry point for development agents.
It routes work through the [Core Doctrine](CORE_DOCTRINE.md), which defines Ouroboros's
constitutionally governing purpose and boundaries; agents may not modify that authority, and the
human sovereign alone may amend the doctrine. The [Whitepaper](WHITEPAPER.md) explains the
reasoning behind those principles and the design space they establish. Architecture, product
specifications, and implementation must remain subordinate to both.
```

- [ ] **Step 3: Verify document structure and scope**

Run:

```bash
test -s AGENTS.md
test -s CORE_DOCTRINE.md
test -s WHITEPAPER.md
rg -n '^## (Source of Truth|Operating Test|Skills|Plugins|Change Discipline|Current Repository Stage)$' AGENTS.md
rg -n '\(CORE_DOCTRINE\.md\)|\(WHITEPAPER\.md\)|\(AGENTS\.md\)' AGENTS.md README.md
rg -n 'Linear is not part of the Ouroboros workflow' AGENTS.md
rg -n 'Until that specification is approved, do not implement product runtime' AGENTS.md
if LC_ALL=C rg -n '[^\x00-\x7F]' AGENTS.md README.md; then exit 1; fi
test ! -e .agents
test ! -e .codex
git diff --check
```

Expected: all required files and six headings are present; links resolve; Linear, the stage gate,
and the maintenance exception are explicit; no non-ASCII text, agent capability directories, or
whitespace errors are introduced.

- [ ] **Step 4: Run repository security and integrity checks**

Run the local equivalent of `.github/workflows/ci.yml`:

```bash
set -euo pipefail
test -s README.md
test -s SECURITY.md
test -s CODEOWNERS
failed=0
while IFS= read -r -d '' path; do
  case "$path" in
    .env.example|*/.env.example) ;;
    .env|*/.env|.env.*|*/.env.*|.envrc|*/.envrc|*.pem|*.key|*.p12|*.pfx|id_rsa|*/id_rsa|id_dsa|*/id_dsa|id_ecdsa|*/id_ecdsa|id_ed25519|*/id_ed25519)
      echo "Forbidden tracked secret path: $path" >&2
      failed=1
      ;;
  esac
done < <(git ls-files -z)
test "$failed" -eq 0
git diff --check origin/main HEAD
```

Run the configured secret scanner over the complete repository history:

```bash
gitleaks git --no-banner --redact .
```

Expected: both checks exit successfully with no forbidden tracked secret paths or detected leaks.

- [ ] **Step 5: Review the complete change against the approved design**

Run:

```bash
git diff -- AGENTS.md README.md
git status --short
```

Confirm that `CORE_DOCTRINE.md` and `WHITEPAPER.md` are unchanged, no unplanned files exist, and
`AGENTS.md` routes to rather than duplicates the governing documents.

- [ ] **Step 6: Commit the implementation**

```bash
git add AGENTS.md README.md
git commit -m "docs: add the agent development context" \
  -m "Route development agents through the doctrine and whitepaper, define skill and plugin authority limits, and preserve the clean-slate product specification gate."
```

Expected: one documentation commit containing only `AGENTS.md` and `README.md`.
