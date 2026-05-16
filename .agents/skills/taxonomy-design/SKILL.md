---
name: taxonomy-design
description: "Use when naming durable concepts, creating or renaming domain types, adding schema families, or resolving vocabulary drift before implementation."
---

# Taxonomy Design

## Role

`taxonomy-design` helps shape durable vocabulary before implementation.

It is a design aid, not a blocker, linter, or replacement for maintained project truth.

## Workflow

1. Read the maintained project truth and the current implementation names.
2. Identify the vocabulary source hierarchy for the concept before inventing names.
3. Prefer the native terms used by authoritative platform, protocol, vendor, standard, or workflow
   references when those terms already describe the concept.
4. List the axes present in the concept: domain noun, data role, lifecycle state, authority,
   source/provenance, audience, and compatibility.
5. Choose one compact canonical noun for the primary concept.
6. Move volatile or contextual axes into fields, docs, metadata, or labels instead of name suffixes.
7. Name compatibility explicitly: canonical names, aliases, persisted keys, and names to avoid
   extending.
8. Preserve source spelling and casing at external, persisted, fixture, or protocol boundaries unless
   a compatibility layer explicitly maps a local alias.
9. Coin a new project-local term only when no authoritative or conventional term fits, and record
   the reason.
10. Prefer guidance, examples, and review notes over mechanical name bans.

## Required Output

- goal
- context read
- vocabulary sources considered
- naming problem
- concept axes
- canonical vocabulary
- project-local terms coined, if any
- source terms preserved and local aliases, if any
- compatibility names or aliases
- names to avoid extending
- migration or no-migration decision
- tests or review evidence
- writeback_needed

## Handoff

If the vocabulary changes durable product, architecture, source, or schema meaning, route the
decision to `llm-wiki` for writeback.

If implementation follows, hand off to `auto-pm` or `auto-coding` with the canonical vocabulary and
compatibility decision already stated.

## Hard Boundaries

- Do not invent vocabulary from taste alone; read maintained context first.
- Do not pack every axis into one identifier.
- Do not create automatic naming blockers as a substitute for design judgment.
- Do not rename persisted or public shapes without an explicit compatibility decision.
- Do not replace official protocol, API, or platform terms with local synonyms at source boundaries.
- Do not use this skill as durable memory; write durable decisions back through `llm-wiki`.
