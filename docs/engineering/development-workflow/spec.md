# Document the supported development workflow

Status: proposed; independent acceptance must precede implementation.
Repository: `openboa-ai/ouroboros`.
Intended path: `docs/engineering/development-workflow/spec.md`.

## Intent and authority

Make this repository's existing development foundation understandable and usable.
Product requirements and runtime implementation remain pending. This change creates
CONTRIBUTING and a README entry, using the adopted Hydra policy and actual CLI as
inputs. It does not define product behavior or grant new operating authority.

D1. Limit changes to `CONTRIBUTING.md`, the README entry and this specification's
folder. Preserve all workflows, checks, ownership, security instructions, deployment
settings and `.hydra.toml`. No product code, dependency, hosted service or credential
change is included. Public instructions contain only publishable development facts.

D2. Explain how to define a Goal, Scope and Acceptance in a ready Issue with one
`hydra` block naming the spec. Label names must match `.hydra.toml`. Explain that
independent spec acceptance happens before dependent implementation; a SHA, label
or progress comment is not evidence by itself. Include one complete example with
public-safe placeholder values and distinguish commands from illustrative markup.

D3. Document the delivered `hydra status --repos openboa-ai/ouroboros` command and
point to Hydra's current registration/host instructions for `run` or `serve`.
Do not invent runtime options, copy host-specific paths, create another daemon or
state store, or require a project-specific execution loop. Describe how paused,
decision and existing CI/review waits preserve work and release other work capacity.

D4. Show the exact registered local whitespace command for a checkpointed candidate.
Explain that repository CI checks workflow syntax, whitespace and secrets, not
product correctness. Local validation and independent diff review precede publication;
actual final-head CI and authenticated Code/Security Review are separate evidence.

D5. Preserve existing human boundaries: policy/CODEOWNERS changes need current-head
native human review, while this bounded ordinary documentation task has no added
human-approval ceremony. No branch/ruleset bypass, stale approval, green-name-only
check, model success message or progress marker can authorize delivery.

D6. Describe completion as observed protected merge of the exact reviewed head plus
both required main checks, followed by Issue closure. A PR, accepted request, waiting
merge or disabled automatic policy is not completion. Unknown effects, missing
verification, stale policy or ambiguous remote writes produce a recoverable wait.
Do not claim the registration or this guide establishes full unattended operation.

## Compatibility and recovery

Keep existing README content and the accepted CI contract accurate; add one concise
CONTRIBUTING link rather than duplicate the full guide. Do not rename existing docs.
Use current Hydra CLI help/source and observed repository settings for factual claims.
If those sources disagree, stop the affected claim and report the concrete gap.
A failed check returns the same owned branch to correction; reconcile remote state
before publication retry. No new work is started merely to discard a failed PR.

## Requirement-linked acceptance

- D1: inspect complete changed-path and rename-origin lists. Only the allowed docs
  change; workflows, policy, ownership and security content stay unchanged.
- D2-D3: independently inspect the actual Issue example, installed label/config
  values, delivered CLI syntax and links. Any external-link availability uncertainty
  is recorded rather than represented as a successful link check.
- D4: run registered whitespace verification through the host's resource provider,
  retain its actual result, then require both real CI jobs for the final PR head.
  These are documentation/hygiene checks, not product-test or behavior claims.
- D5: inspect exact-head authenticated Code and Security Review completion and
  resolved findings, plus whatever native GitHub requirements currently apply.
- D6: after eligible protected merge, confirm the resulting commit and successful
  original/trusted push jobs before closing the Issue. If policy adoption or production
  effect verification is still pending, preserve the PR and explicit wait.

The implementation is nonvisual documentation, so no application screen is created
or claimed. Review acceptance, local results, remote checks, merge and observed
operation remain distinct evidence. No custom validator framework is required.
