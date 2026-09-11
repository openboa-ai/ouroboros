# Security Policy

## Supported State

Ouroboros implements a first external execution environment in Rust. Its synthetic tests and
installation candidates are development evidence, not authorization for production operation,
real accounts, trading, or capital use. Security coverage includes the control, gateway, runtime,
resource and credential boundaries, installation/recovery tools, and repository delivery pipeline.

## Reporting a Vulnerability

Do not open a public issue or discussion. Use GitHub's private
[Report a vulnerability](https://github.com/openboa-ai/ouroboros/security/advisories/new) flow.
Include the affected path or revision, realistic impact, reproduction details, and relevant
integrity evidence. Do not include credentials or unnecessary exploit detail.

## Baseline Invariants

- Secrets, private keys, personal environment paths and private research must not be committed.
- Candidate code executes on disposable hosted runners without operating secrets or write tokens.
- Actions use least privilege and complete commit SHA pins. Default workflow tokens are read-only;
  workflows cannot approve pull requests.
- CodeQL alone receives `security-events: write`. The main-only provenance job receives
  `id-token: write` and `attestations: write`, consumes the current run's verified archive, and
  never executes it. This grants no deployment or financial authority.
- The existing Dependabot metadata-only job may request GitHub native auto-merge for Actions
  minor/patch updates. It never checks out candidate code, grants approval, or bypasses rules.
- All main changes use a pull request, required checks and squash merge. Sensitive changes need
  a technical code-owner review; sovereign actions still require the separate explicit record
  specified in [SOVEREIGN.md](SOVEREIGN.md).
- A failed or incomplete mandatory test is not a pass. Native kernel requirements cannot be
  replaced with mocks or a developer's machine to make CI green.

See the [GitHub delivery contract](.github/README.md) for checks, retention and transition rules.
