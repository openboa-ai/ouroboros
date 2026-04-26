---
name: brain-autokairos
description: Use when explaining or checking autokairos product thesis, TraderSystemRuntime, control-plane ownership, weak-to-strong evaluation thesis, provider boundaries, or live gateway authority.
---

# Brain Autokairos

## Role

`brain-autokairos` is a framing utility for autokairos product and architecture meaning.

## Use When

- The user asks how the system works.
- A worker needs a product/runtime boundary check.
- PR slicing is being confused with product architecture.
- A durable explanation may need wiki writeback.

## Workflow

1. Read maintained repo truth before answering.
2. Explain the smallest relevant boundary.
3. State tradeoffs or design tensions.
4. Identify affected docs or owner.
5. Decide writeback status.

## Read First

Use targeted reads from:

1. `README.md`
2. `knowledge-index.md`
3. `wiki/architecture/00-system-map.md`
4. `wiki/architecture/08-runtime-authority-model.md`
5. `wiki/architecture/09-trader-system-runtime-operating-model.md`
6. relevant active specs

## Required Output

- concise thesis or boundary answer
- key tradeoffs
- affected docs or owner
- `writeback_needed`

## Handoff

If the explanation corrects or changes durable architecture understanding, route to `llm-wiki`.

## Hard Boundaries

- Do not invent architecture from chat memory.
- Do not treat PR slicing as product runtime architecture.
- Do not replace source-first design research for provider/runtime/evaluation changes.
