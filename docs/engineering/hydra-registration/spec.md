# Register Hydra for bounded documentation work

Status: proposed enabling policy; not accepted, installed or activated.
External merge-effect boundary: pending verification; do not adopt before it is recorded.
Repository: `openboa-ai/ouroboros` (numeric ID `1411114385`).
Intended path: `docs/engineering/hydra-registration/spec.md`.

## Intent and scope

Give this repository the same GitHub-native development loop as other registered
projects, starting with development documentation. Product planning and product
implementation remain pending. Existing CI proves repository hygiene only.

R1. Add the proposed `.hydra.toml`, add `/.hydra.toml @SonSangjoon` to the effective
`.github/CODEOWNERS`, and retain this scoped specification. The first documentation
episode's proposed specification may be included at
`docs/engineering/development-workflow/spec.md` after independent spec review,
before its CONTRIBUTING implementation. Preserve every existing ownership rule,
workflow byte, required check, security instruction and merge setting.

R2. Bind repository identity, both observed workflow IDs/paths/jobs, their events,
Actions app `15368`, the immutable reusable source and the authenticated Codex
review provider. Read policy from protected default-branch content. Issue text and
candidate files cannot override verification or authority.

R3. Initially permit only `README.md`, `CONTRIBUTING.md` and
`docs/engineering/development-workflow/`. Hydra's built-in protected paths remain
protected, with the existing secret-scan and Git-hook policy paths explicitly added.
Do not add product features, dependencies, builds, credentials, deployment, release,
new checks or a different evaluator. A later scope expansion is a reviewed policy
change, not an interpretation of a ready label.

R4. Register labels `hydra:ready`, `hydra:paused`, `hydra:decision` after source
adoption. They select work or express a wait; they are never acceptance evidence.
Allow intake by the two configured existing repository writers. Keep independent
human review on policy/CODEOWNERS changes. Ordinary documentation retains existing
zero blanket human-approval requirements and still needs independent spec/change
review, authenticated Code and Security Review, required CI and resolved findings.

## One policy adoption and exact delivery boundary

R5. Adopt the complete docs-only enabling contract once through the existing policy
review: `automatic_merge = true`, `production_effect = false`, with the exact R3
allowlist and every existing gate retained. The submitted values describe the
proposed eligible boundary; they are not evidence that external effects are absent.
There is no required initial-disabled registration PR followed by a second enablement
PR, and no additional blanket approval of the already delegated merge intent.

Before that one policy head can be adopted, record the following actual facts in
this specification or its linked public-safe work record:

- The delivered Hydra source and actual write/recovery evidence support the scope,
  and the registered host prerequisites are available.
- Current repository identity, strict protection, CODEOWNERS, the two genuine CI
  producers and authenticated code/security review still match the contract.
- An authorized operator has established whether an external hosting/provider
  reacts to main pushes and the effect of the allowed documentation changes.
  The boundary must establish that these merges cause no unapproved production
  change or public release. Empty GitHub deployments/hooks, no deployment workflow
  or a README sentence alone are not proof of external connection absence.
- Existing required checks and authenticated reviews pass, and the exact policy
  head has the current-head native human review already required for these paths.

External hosting/provider effects are currently **pending**. Accordingly this
package is ready for review as a concrete proposal but is not ready for adoption.
If investigation finds a material effect, hold this policy and resolve only that
specific effect boundary; do not silently treat it as none or expand delivery scope.
No provisional policy must be merged merely to create another policy review later.

Once adopted, normal documentation episodes within R3 proceed through independent
spec/change review, final-head CI and authenticated Code/Security Review to immediate
expected-head protected squash merge and main-check observation. They require no
extra human approval ceremony. Native human review continues to apply to later
policy, ownership, workflow or evaluation changes. This contract grants no product
code, credential, deployment, public release or unattended-service authority.

## Verification and failure handling

R6. The registered local command checks the checkpointed candidate diff against
its checkout's `origin/main` for whitespace, without external diff or text conversion.
It is a small documentation check, not complete product verification. The two real
CI jobs must independently pass for the current PR/head and again on merged main;
provider identity, workflow identity and the shared pin are checked, not just names.
Reviewers inspect actual requirements, links and command examples. No model turn or
successful command alone completes this registration or the later episode.

R7. Missing/changed identity, dirty or foreign work, unavailable storage/auth/usage,
stale checks, unresolved review, changed policy or unknown external effects hold the
work. Preserve recoverable state, reconcile remote branch/PR/head before retry, and
never weaken a gate. Disabling ready intake or setting paused is reversible; do not
force-push, delete evidence or undo an already observed delivery by assumption.

## Requirement-linked acceptance

- R1-R3: independently review the spec before product edits, compare the exact diff
  with these paths, parse `.hydra.toml` using the delivered Hydra schema and inspect
  unchanged workflow/ownership rules plus the single policy ownership addition.
- R2/R4: live repo and collaborator observations, exact CI/provider bindings and
  label names match the adopted contract. Both configured actors must still be
  authorized repository writers when intake is evaluated.
- R5: inspect the single proposed true/false contract and the resolved effect
  boundary before adoption. Current-head native policy review, code/security review
  and required CI precede protected merge. Read back the installed policy and actual
  main-push checks after merge; missing effect evidence keeps this proposal pending.
- R6/R7: inspect deterministic runtime recovery evidence and actual first-episode
  results separately. Registration installation is not autonomous-delivery proof.

## Observed setup baseline

Read on 2026-10-10. Default branch is public `main` at `07120420a604c3e2f50fb119ac53791f73266b26`;
active ruleset `24759735` has no bypass actors, strict required checks,
squash-only integration and policy CODEOWNER review. General approval count is zero.
Both configured actors currently have repository writer authority. These facts must
be refreshed before adoption, not treated as a perpetual receipt.

The existing accepted repository CI spec has content SHA256
`e8be60af92c82becddaed327e1d0e78baf518097e5f54ac866f0034e46702ab4`.
The trusted workflow uses shared revision `83967987ca23cc8b8eda60975eda320e434fb7bd`.
Both required workflows passed for PR #2 and its merge; the authenticated provider
summary is [on PR #2](https://github.com/openboa-ai/ouroboros/pull/2#issuecomment-6074182170).
GitHub currently reports no configured environments, deployments or repository hooks,
and no Pages site. External hosting/provider connections have not been established.
