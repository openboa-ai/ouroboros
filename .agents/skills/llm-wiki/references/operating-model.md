# Operating Model

This skill assumes a lightweight LLM-maintained wiki.

## Default shape

Start with three layers.

- raw sources
  Immutable input material.
- maintained wiki
  Markdown pages the LLM actively writes and updates.
- schema
  `AGENTS.md`, `.agents/AGENTS.md`, `CLAUDE.md`, or similar process rules.

This is the default.

Do not jump straight to a complex multi-layer hierarchy unless the repo already has enough
substance to justify it.

## Optional expansion

If the maintained wiki grows enough, it may be useful to separate:

- `workdocs/`
  Active synthesis and planning
- `engdocs/`
  Engineering contracts and implementation rules
- `docs/`
  Canonical and externally meaningful docs

But this is an optimization, not the starting point.

## Operating files

- `knowledge-index.md` or `index.md`
  Navigation and entry point into the wiki.
- `knowledge-log.md` or `log.md`
  Append-only chronology of meaningful wiki changes.

## Core principle

The wiki is the maintained artifact.

Raw sources are not the answer surface.
The schema is not the substance.
The maintained wiki is where knowledge compounds.
