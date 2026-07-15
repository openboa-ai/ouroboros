---
name: llm-wiki
description: "Use when repository knowledge needs durable maintenance: source ingestion, synthesis promotion, project-document health, stale naming repair, cross-reference repair, active/historical cleanup, or branch/task/PR/run/design/CI writeback."
---

# LLM Wiki

## Role

`llm-wiki` owns maintained project-document writeback and durable project-loop memory.

## Workflow

1. Load `auto-handoff-protocol` and inspect the incoming canonical Frontier Packet.
2. If the packet is absent or incomplete, preserve the incoming legacy output as provisional
   evidence and invoke `auto-project` to initialize every canonical field from the active work item
   and current repo state. Perform no writeback until `auto-project` returns the complete packet to
   `llm-wiki`; if initialization is blocked, return that blocked packet without inventing state.
3. Orient from repo-level `AGENTS.md`, `.agents/AGENTS.md`, and the nearest relevant schema.
4. Read `LINEAR.md`, then the active issue or project document references it names.
5. Read the affected maintained project documents, source notes, or minimal repo docs.
6. Choose `ingest`, `query`, `lint`, or `writeback` and make the lightest durable update that
   preserves repo truth.
7. Update the same packet with the writeback location, evidence, decision, remaining gap, and next
   owner. Do not reconstruct packet state from chat.

## Operations

- `ingest`: add or update source notes, register references, and promote durable lessons.
- `query`: answer from maintained project documents first, then write back durable results if needed.
- `lint`: repair stale naming, dead paths, duplicate pages, weak provenance, or active/historical confusion.
- `writeback`: record durable branch/task/PR/run/CI/workflow outcomes in the relevant project document, Linear issue comment, Linear project update, or minimal repo doc.

## Writeback Location Rules

- chronology: update the relevant issue comment, project update, or execution ledger document
- navigation or read path: update `LINEAR.md` only when repo-level discovery changes
- durable external source: update the source or synthesis project document
- cross-source lesson: update the maintained synthesis document
- active product, design, or process truth: update the relevant project document
- branch, run, PR, release, or CI state: use the existing project memory document or issue comment
- PR-sized frontier state: update the project state document when the repo defines one

## Operation Details

For `ingest`, register provenance. For `query`, answer from maintained truth first. For `lint`, fix broken links, stale naming, duplicated truth, and active/historical confusion. For `writeback`, record decision, evidence, owner, and next read location.

## Required Output

- every canonical Frontier Packet field from `auto-handoff-protocol`
- writeback extension: `operation`, `pages_read`, `pages_changed`, `durable_truth_recorded`, and
  `writeback_complete`

Use the packet's `decision` for `written`, `no-op`, `reroute`, or `blocked`; record unresolved work
in `remaining_gap` instead of defining a separate gap field.

## Handoff

If writeback is incomplete, return the smallest unresolved gap and next owner. If writeback is complete, return the durable page, Linear issue comment, or project update a future worker should read first.

## References

- [references/operating-model.md](references/operating-model.md)
- [references/templates.md](references/templates.md)
- [references/lint-checklist.md](references/lint-checklist.md)

## Hard Boundaries

- Do not answer from raw sources first when maintained project-document truth exists.
- Do not duplicate the same content across layers without a clear reason.
- Do not turn every transient chat answer into a permanent page.
- Do not create new folders or templates without enough maintained substance.
- Do not replace `auto-project`, `auto-pm`, `auto-coding`, or `auto-qa`.
- Do not write from a legacy or partial handoff until `auto-project` has initialized the canonical
  packet from current evidence.
- Do not let durable decisions remain only in chat history.
