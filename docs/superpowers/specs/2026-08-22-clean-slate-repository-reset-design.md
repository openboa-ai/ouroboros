# Clean-Slate Repository Reset Design

## Decision

Ouroboros will restart from first principles in the existing GitHub repository. Git history remains
available, but the current implementation, schemas, APIs, commands, documentation, agent harness,
delivery integration, and compatibility promises are intentionally retired.

The reset does not define the replacement product. A later whitepaper will establish product truth
before new implementation begins.

## Why A Reset

The current repository encodes a research-first product direction, an enum-heavy state model, and
many speculative evidence and lifecycle schemas. Those choices obscure the intended core and make
incremental simplification less reliable than a clean restart.

This is an intentional discontinuity, not a migration:

- no persisted schema is preserved;
- no public or internal API is preserved;
- no CLI, UI, runtime, or command compatibility is preserved;
- no existing architecture or agent instruction remains authoritative;
- historical code remains recoverable only through Git history.

## Final Repository Baseline

The reset commit leaves only:

- `README.md`: states that clean-slate reconstruction is in progress;
- `SECURITY.md`: defines private vulnerability reporting and the reset-state security scope;
- `CODEOWNERS`: protects repository security and policy files;
- `.gitignore`: ignores only universal local, secret, generated, and worktree paths;
- `.github/pull_request_template.md`: requires context, decision, scope, security, validation, and
  follow-up evidence;
- `.github/dependabot.yml`: updates GitHub Actions dependencies monthly;
- `.github/workflows/ci.yml`: checks repository integrity without assuming a language or build;
- `.github/workflows/codeql.yml`: scans GitHub Actions until a replacement code stack exists;
- `.github/workflows/gitleaks.yml`: scans Git history for committed secrets.

Everything else tracked on `main` is removed.

## Security Baseline

- GitHub Actions receive read-only contents permission by default.
- Only CodeQL receives `security-events: write`.
- Third-party GitHub Actions are pinned to full commit SHAs.
- Gitleaks is downloaded from its official release and verified against its published checksum.
- CI rejects tracked private-key and local secret-file names.
- GitHub secret scanning and push protection remain enabled at repository level.
- No deployment, OIDC, package publication, repository write, trading, exchange, or credential
  authority exists after reset.

## Delivery

The branch is `codex/clean-slate-reset`. Linear is not used. The branch contains two commits:

1. this design and its implementation plan, preserving the reset rationale in Git history;
2. the reset itself, which deletes the historical implementation and leaves the minimal baseline.

The pull request explains the discontinuity, exact removal and preservation boundaries, security
controls, validation evidence, recovery through Git history, and whitepaper-first next step.

## Acceptance

- The final tree contains only the approved baseline files.
- No Linear reference, product code, schema, runtime, package manifest, build configuration, legacy
  documentation, or compatibility surface remains.
- Workflow YAML parses.
- GitHub Actions are pinned to full commit SHAs.
- Gitleaks reports no leaks over Git history.
- `git diff --check` succeeds.
- The branch is pushed and a pull request is opened with complete context.

