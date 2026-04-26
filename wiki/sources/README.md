# Sources

This directory is the source-first research base for autokairos.

Start with the URL ledger, then read the relevant source notes and synthesis before returning to
`wiki/architecture/`.

The current research pass tracks the supplied reference list in
[reference-ledger.md](reference-ledger.md). Cluster source notes may cover many URLs when the
sources belong to one product or documentation family, but every URL should stay auditable through
the ledger.

## Reading Order

1. [reference-ledger.md](reference-ledger.md)
2. [library/index.md](library/index.md)
3. the relevant per-source or cluster notes in `library/`
4. [synthesis/index.md](synthesis/index.md)
5. `wiki/architecture/`

Use it for:

- articles
- engineering essays
- research write-ups
- repository notes
- cross-source synthesis rooted in those notes

Rules:

- source notes are evidence files, not architecture pages
- keep one source note per single source or source cluster in `library/`
- preserve every supplied URL in [reference-ledger.md](reference-ledger.md), including duplicate
  aliases and localized variants
- keep cross-source interpretation in `synthesis/`
- prefer immutable provenance once a source note is adopted into `library/`
- update architecture only after the source notes and synthesis are good enough to support it
- use `inbox/` for newly dropped material
- use `library/` for normalized and stable source notes
- use `synthesis/` for derived comparison pages
