# Agent Development Context Design

## Purpose

Create a concise root `AGENTS.md` that turns the Core Doctrine and Whitepaper into actionable
context for development agents without duplicating their content or introducing repository-local
skills prematurely.

The document will govern how agents locate project truth, evaluate proposed work, and use skills
and plugins. It will not define product behavior or implementation architecture.

## Source Hierarchy

Development agents will use the following order of authority:

1. `CORE_DOCTRINE.md` defines the immutable purpose, identity, and constitutional boundaries.
2. `WHITEPAPER.md` explains those principles and the design space they establish.
3. A future Product Specification will define required product behavior.
4. Future architecture and engineering documents will define provisional implementation choices.

When documents conflict, the higher source governs. `AGENTS.md` routes agents to these sources; it
does not replace or reinterpret them.

## Root AGENTS.md

The new root document will contain six compact sections:

1. **Source of Truth** — the authority order and required reading behavior.
2. **Operating Test** — the questions every substantive proposal must answer concerning the
   terminal objective, live trading, valid iteration, evidence integrity, sovereignty, and governed
   autonomy.
3. **Skills** — skills are mutable, repeatable execution methods. They cannot create product
   authority, override higher documents, or become permanent without evidence of recurring need.
4. **Plugins** — plugins provide external capabilities, not decision authority. Availability does
   not grant permission; outputs remain evidence to verify; credentials and consequential writes
   require explicit authority. Linear is excluded.
5. **Change Discipline** — prefer the minimum sufficient structure; do not create enums, schemas,
   roles, services, or workflows before the distinctions they represent are required; preserve
   adverse evidence and independent evaluation.
6. **Current Repository Stage** — until a Product Specification is approved, product runtime,
   schema, and architecture implementation remain out of scope. Work is limited to establishing
   product direction and preserving repository security and integrity.

The guidance will be direct and agent-readable. It will avoid restating the full doctrine,
specifying an agent organization, naming a required framework, or creating a large process manual.

## Repository Changes

- Add the root `AGENTS.md`.
- Link it from `README.md` as the operational entry point for development agents.
- Leave `CORE_DOCTRINE.md` and `WHITEPAPER.md` unchanged.
- Do not create `.agents/`, `.codex/`, skill, plugin, schema, or runtime files.

## Verification

- Confirm every source-hierarchy link resolves to a tracked file.
- Confirm `AGENTS.md` contains no Korean translation and does not duplicate the Doctrine.
- Confirm it explicitly excludes Linear and distinguishes capability from authority.
- Confirm it blocks premature product implementation without blocking repository security work.
- Run repository-integrity checks, Gitleaks, and `git diff --check` over the complete branch range.

## Acceptance Criteria

A development agent entering the repository can determine, from `AGENTS.md` alone:

- what to read and in what order;
- which project principles govern a proposed change;
- what skills and plugins may and may not authorize;
- why implementation cannot begin before the Product Specification exists; and
- which forms of repository maintenance remain allowed during the clean-slate stage.
