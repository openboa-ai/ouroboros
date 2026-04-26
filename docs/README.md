# Service Docs

This directory is the future home for user-facing service documentation.

It is intentionally light right now, but it now has a minimal publishing spine so later work does
not drift back into internal architecture notes.

## Intended Use

Use `docs/` later for material such as:

- product or service documentation for external users
- onboarding guides for operators or customers
- public-facing usage explanations
- support-oriented documentation

The intended external documentation layers are:

1. [getting-started/README.md](getting-started/README.md)
   First-run and first-value documentation for new operators or customers.
2. [concepts/README.md](concepts/README.md)
   Product concepts explained in user language rather than internal architecture language.
3. [operators/README.md](operators/README.md)
   Operational guides for inspection, intervention, and routine service use.
4. [reference/README.md](reference/README.md)
   Reference-style material such as settings, limits, exposed interfaces, or config surfaces.
5. [policies/README.md](policies/README.md)
   Product-visible rules around live promotion, limits, trust, audit, and intervention.

## Not The Current Wiki

The maintained internal design and research wiki now lives under:

- [../wiki/index.md](../wiki/index.md)

That includes:

- source grounding
- product definition through `MLP` and `PRD`
- architecture
- specs
- ADRs

## Rule

Do not grow `docs/` into the internal architecture wiki again.

Put internal design knowledge in `wiki/`.

Write `docs/` for external readers.

If a page is mainly about:

- source grounding
- internal architecture
- specs
- ADRs
- design exploration

then it belongs in `wiki/`, not here.
