---
name: llm-wiki
description: Maintain the autokairos source/wiki and repo memory system. Use for source ingestion, source-to-synthesis promotion, wiki health checks, stale naming, cross-reference repair, and durable PR/frontier/run writeback.
---

# LLM Wiki

This skill owns the maintained knowledge system and durable project-loop memory. It does not own
project-harness scheduling; use `auto-project` for routing and next-owner selection.

Turn a markdown repo into a compounding knowledge system.

The point is not to retrieve from raw files every time. The point is to maintain a persistent wiki
that sits between raw sources and future answers. Read sources once, integrate them into the wiki,
keep the cross-references and synthesis current, and answer from the maintained wiki first.

## Core operating model

Prefer a simple three-layer model first.

- raw sources
  - immutable source material the LLM reads but does not rewrite
- maintained wiki
  - the markdown knowledge base the LLM actively writes and maintains
- schema
  - `AGENTS.md`, `.agents/AGENTS.md`, `CLAUDE.md`, or similar files that tell the LLM how to work

Only add more structure when the wiki truly needs it.

- If the repo benefits from it, the maintained wiki may later be split into sublayers such as
  `workdocs/`, `engdocs/`, and `docs/`.
- Do not force a four-layer hierarchy before the repo has enough substance to justify it.
- Do not create lots of folders, templates, and rituals with too little maintained knowledge inside.

Use two operating files when the repo benefits from them.

- `knowledge-index.md` or `index.md`
  - navigation layer
- `knowledge-log.md` or `log.md`
  - append-only chronology

For autokairos project-loop memory, use this skill when a PR/frontier/run result needs durable
writeback into `knowledge-log.md`, active wiki pages, or future `wiki/prs/` and `wiki/runs/`
records.

Use the nearest `AGENTS.md` files as schema and workflow rules.

For concrete templates and lifecycle details, read:

- [references/operating-model.md](references/operating-model.md)
- [references/templates.md](references/templates.md)
- [references/lint-checklist.md](references/lint-checklist.md)

## Default workflow

### 1. Orient the wiki

Read, in order:

1. repo-level `AGENTS.md` or `.agents/AGENTS.md`
2. the main index file if present
3. nearest `AGENTS.md` files for the affected subtree
4. the most relevant maintained wiki pages
5. raw sources only when provenance or new material matters

Do not start by reading everything. Use the schema and index to stay targeted.

### 2. Choose the operation

Most requests fall into one of three core operations.

- `ingest`
  - add new raw material and integrate it into the wiki
- `query`
  - answer from the maintained wiki and optionally file the result back into it
- `lint`
  - health-check the wiki for drift, contradictions, and missing structure

`promote` is not a separate ideology here. It is simply maintenance: when a note becomes durable,
rewrite or relocate it into the right maintained page.

### 3. Update the lightest structure that works

Prefer the smallest viable wiki shape.

- If a single `docs/` tree plus index/log is enough, keep it that way.
- If active notes and canonical docs need separation, introduce it deliberately.
- If engineering contracts truly need their own layer, add it then.

Do not duplicate the same content across layers unless there is a clear canonical-vs-derived reason.

### 4. Keep navigation current

When the structure changes materially:

- update the index
- append an entry to the log
- update the nearest `AGENTS.md` files if workflow rules changed

## Operation details

### Ingest

Use for new articles, notes, transcripts, PDFs, screenshots, or reference material.

Flow:

1. place or identify the raw source in the repo's source area
2. read the source
3. extract durable knowledge
4. update the relevant maintained wiki pages
5. update the index if discoverability changed
6. append an ingest record to the log

Prefer one-source-at-a-time ingest unless the user explicitly wants batching.

Remember: the value is not the source archive alone. The value is the maintained wiki that now
already reflects what the source changed.

### Query

Use the maintained wiki first.

Flow:

1. read the index
2. open the most relevant maintained pages
3. synthesize the answer
4. if the answer creates durable value, file it back into the wiki
5. log the addition if it materially changes the knowledge system

Prefer answering from maintained pages rather than rediscovering from raw sources every time.

Useful outputs include:

- a markdown page
- a comparison table
- a decision note
- a synthesized summary page

### Lint

Use to keep the wiki healthy.

Check for:

- stale naming
- dead paths
- orphan pages
- duplicate pages
- contradictions between maintained pages
- missing cross-references
- important concepts that deserve their own page
- weak provenance
- schema bloat relative to actual substance

When lint finds a real issue, fix the wiki and record the pass in the log.

## Writing rules

- Prefer markdown files over chat-only answers when the result has durable value.
- Prefer links over duplicated explanations.
- Keep chronology in the log, not scattered across many pages.
- Keep navigation in the index, not only in directory listings.
- Keep raw material immutable.
- Let the LLM own the wiki-writing burden; the human should focus on curation, direction, and
  questions.
- Prefer evolving a few strong maintained pages over spraying many weak pages.

## Failure shields

- Do not impose a heavy multi-layer schema before the wiki has enough content to justify it.
- Do not create folders and templates with too little maintained substance.
- Do not answer from raw sources first when the maintained wiki already exists.
- Do not duplicate the same text across multiple layers without a clear reason.
- Do not turn every transient chat answer into a permanent page.
- Do not skip the index and nearest schema files.

## Triggers and examples

This skill should trigger for requests like:

- "set up an llm wiki in this repo"
- "add a raw-source layer and knowledge index"
- "ingest this article into the wiki"
- "promote this note into a maintained design doc"
- "clean up our document system so it compounds over time"
- "lint the wiki for contradictions and orphan pages"
- "make this repo work like an LLM-maintained Obsidian-style wiki"

## Deliverables

When using this skill, try to leave behind:

- updated maintained wiki pages
- updated index/log files when needed
- updated nearest `AGENTS.md` files when process rules changed

If the repo does not yet have an LLM wiki structure, scaffold the minimum viable system first.
