# Contributing

This repository contains a development foundation. Product planning, requirements
and runtime implementation remain pending. Start with [AGENTS.md](AGENTS.md), the
[CI contract](docs/engineering/reusable-baseline/spec.md) and the scoped specification
for the change. Infrastructure checks do not establish product correctness.

The adopted [Hydra contract](.hydra.toml) permits documentation changes to
`CONTRIBUTING.md`, `README.md` and `docs/engineering/development-workflow/`.
Changes to policy, ownership, workflows, security controls, credentials, deployment
or product code need their own authority and reviewed scope. An Issue cannot
expand the contract or weaken its checks.

## Prepare one ready Issue

Describe the **Goal**, **Scope** and observable **Acceptance** in a durable Issue.
Use exactly one `hydra` TOML block naming a `spec.md` within the registered scope.
The Issue author must be an authorized repository writer. The current ready label
is `hydra:ready`; `hydra:paused` and `hydra:decision` hold intake. Hydra maintains
`hydra:active` for unfinished work and recovery; it is not an acceptance label.

The following is illustrative Issue body markup, not a shell command or an
instruction to create duplicate work. Replace the sample goal and criteria with
the actual delegated outcome. This example has no dependency; list real Issue
URLs in `dependencies` when needed. Keep the spec path within the current policy.

````markdown
## Goal

Clarify a contributor's path from a documentation change to observed delivery.

## Scope

Update CONTRIBUTING.md, one README link and the development-workflow docs folder.
Keep product planning pending. Do not change policy, workflows, ownership,
security controls, dependencies, credentials or runtime code.

## Acceptance

- An independent reviewer accepts the actual scoped spec before implementation.
- Examples match the registered tools, labels and checks; links are inspected.
- Local verification and independent diff review pass.
- Both required CI jobs and authenticated Code and Security Review pass for the
  final head; findings are resolved.
- The exact reviewed head is protected-merged, both main checks pass, then the
  Issue is closed.

```hydra
spec = "docs/engineering/development-workflow/spec.md"
dependencies = []
priority = 0
```
````

The spec must record intent, allowed and prohibited behavior, authority and data
boundaries, failure/recovery cases, compatibility and requirement-linked evidence.
An independent reviewer inspects the actual revision before dependent edits.
If `spec_revision` is supplied, it must identify the real 40-character commit;
neither that SHA nor a label or progress comment proves acceptance. Changed scope
returns to specification review. Keep private paths, transcripts, research records,
credentials and personal data out of public artifacts; use the
[private security reporting route](SECURITY.md) for suspected vulnerabilities.

## Use the native Codex workflow

Use the installed Hydra SDLC skill and
[native setup and recovery guide](https://github.com/openboa-ai/hydra/blob/679c3d0cd7d71beaa9cbfe33b35e8818e1d14c4e/docs/native-codex.md).
These tool names are native calls, not terminal commands:

1. `hydra_status` reads current registered work and waiting reasons. Reconcile
   recovery and pending delivery before selecting a new delegated ready Issue.
2. `hydra_begin` takes the real Issue URL and returns the managed worktree and
   bounded assignment. Retain its `attempt_id`, `step_id`, `head` and
   `contract_revision`; follow its phase, prompt and read/write mode.
3. Perform only that assignment. Use visible outcome-sized Codex chats linked to
   the Issue when task creation/delegation is authorized, with one development
   writer. Independent reviewers inspect actual spec/diff and verification without
   editing. Preserve unrelated work and use the returned checkout.
4. `hydra_checkpoint` submits the exact assignment identity with `candidate_ready`,
   `failed` or `needs_decision`. Hydra checkpoints owned edits and returns the next
   assignment or continuation. Use the returned current head for subsequent calls;
   a consumed step cannot be replayed. Do not manually commit, push, create another
   PR or merge alongside Hydra.
5. `hydra_verify` and `hydra_deliver` continue the guarded workflow using the current
   Issue, attempt, head and contract revision. Follow any returned assignment and
   wait for actual remote evidence. These calls do not override delivery gates.

`candidate_ready` is a bounded judgment about the assigned artifact. It does not
mean the PR is approved, merged, deployed or complete.

For an actual new product or authority decision, checkpoint `needs_decision`
before asking the native question in the outcome chat. Present the decision,
options and recommendation. Preserve partial work; record only the publishable
actual answer in the Issue from an authorized actor, with
`hydra: decision ATTEMPT_UUID resolved` (replace `ATTEMPT_UUID` with that exact
attempt). Reconcile before resuming. A chat answer, a Codex permission dialog and
GitHub's required native human review are separate mechanisms. Routine authorized
documentation work needs no extra blanket approval question.

## Verify and review the candidate

Hydra runs the registered local verification through the host's storage/resource
provider after checkpointing the candidate. Its exact command, from the owned
worktree root, is:

```sh
git diff --check --no-ext-diff --no-textconv origin/main HEAD --
```

The command checks the committed diff, not uncommitted edits, and has a registered
30-second timeout. The host provider must be available; do not bypass it with a
replacement storage location. Retain the actual result and independently inspect
the changed paths, rename origins, requirements, examples and links before
publication. A successful whitespace check is not a complete document review.

Both required GitHub jobs inspect workflow syntax, whitespace and secrets:

| Required job | Source and PR event |
| --- | --- |
| `Repository baseline` | `.github/workflows/ci.yml`, `pull_request` |
| `trusted-baseline / Trusted repository baseline` | `.github/workflows/trusted-baseline.yml`, `pull_request_target` |

Both also run on main `push`. Hydra checks the registered workflow and producer
identities, exact head/base and immutable reusable workflow pin. A green check name
alone is insufficient. These are repository hygiene checks, not product tests.

Local verification and independent diff review precede publication. After
publication, inspect both authenticated **Code Review** and **Security Review**
from the configured Codex provider for the final PR head, along with both genuine
CI results. Correct findings as coherent updates on the owned branch, then obtain
fresh affected verification and review. Resolve findings using actual fixes and
read-back evidence, not a model success message or an old approval.

Policy and CODEOWNERS changes retain current-head native human review and all
existing GitHub requirements. This bounded ordinary documentation scope adds no
blanket human-approval ceremony. Never bypass branch/ruleset protection or change
an evaluator to make delivery appear successful.

## Wait, recover and finish

`hydra:paused` stops intake; it does **not** release an active native assignment.
An interrupted assignment retains host admission even if its Issue is closed or
the service restarts. Inspect and confirm termination of the old task and its
owned processes before submitting `stopped` with its original Issue, attempt,
step, head and contract identity. Preserve edits. Do not infer shutdown from a
timeout or heartbeat, clear a ticket manually, or stop unknown processes. A new
assignment receives a new step identity and rejects late results from the old one.

Decision and remote CI/review waits can release capacity only after their
checkpoint and assignment end are confirmed. Keep the Issue, branch and PR;
reconcile their current state before retrying or resuming. Missing verification,
changed policy, foreign work, unavailable host prerequisites or ambiguous remote
writes are recoverable waits. An unknown publication or merge result is not
permission to create a replacement PR or retry blindly. A failed check returns
the same owned work to correction; report a runtime/policy gap without weakening it.

Completion requires observation of the protected merge of the exact reviewed
head, then success of **both** registered push jobs for the resulting main commit,
followed by Issue closure. Keep local verification, current remote CI/reviews,
merge, main checks and recovery evidence distinct. An open PR, accepted merge
request, waiting merge, disabled automatic policy or progress marker is not
completion. Registration and this guide do not establish full unattended
operation; delivery, restart/resumption and scheduling require separate evidence.

## Standalone CLI alternative

On an already configured host, read status with:

```sh
hydra status --repos openboa-ai/ouroboros
```

For standalone execution, follow the delivered
[`run` and `serve` instructions](https://github.com/openboa-ai/hydra/blob/679c3d0cd7d71beaa9cbfe33b35e8818e1d14c4e/README.md#standalone-cli)
and the native setup guide above. Their example Issue numbers, repositories,
absolute paths and host aliases are placeholders to replace with the authorized
Issue and installed host values. Native and CLI execution must share the host
lock, owned workspace root and registered lifecycle/storage providers. Do not
start a competing worker, create a project-specific loop, add another state store
or activate a service/schedule as part of an ordinary documentation change.
