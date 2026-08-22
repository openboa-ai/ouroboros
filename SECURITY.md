# Security Policy

## Supported State

Ouroboros is in a clean-slate reconstruction state and currently ships no product runtime. Security
coverage applies to repository configuration, GitHub Actions, source integrity, committed history,
and any new material added during reconstruction.

## Reporting a Vulnerability

Do not open a public issue or discussion. Use GitHub's private
[Report a vulnerability](https://github.com/openboa-ai/ouroboros/security/advisories/new) flow.
Include the affected path or revision, realistic impact, reproduction details, and relevant
integrity evidence. Do not include credentials or unnecessary exploit detail.

## Baseline Invariants

- Secrets and private keys must not be committed.
- GitHub Actions use minimum permissions and pinned third-party action revisions.
- Only CodeQL may receive `security-events: write`; no workflow receives deployment, OIDC, package
  publication, or repository write authority.
- Product, exchange, trading, credential, and capital authority do not exist in the reset baseline.
- Security boundaries for the replacement system must be defined before its implementation.
