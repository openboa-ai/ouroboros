# ouroboros

Repository foundation only. Product requirements and implementation are pending.

CI checks workflow syntax, whitespace and secrets. These checks do not validate product behavior.
No deployment target, deployment credentials or release pipeline is configured.

## Development entry

Start with a scoped specification and observable acceptance criteria before
product implementation. Product goals and runtime build/test commands remain
pending joint planning.

The [CI contract](docs/engineering/reusable-baseline/spec.md) describes the
installed original baseline and the separate, pinned trusted workflow. Both
inspect repository hygiene; neither establishes product correctness.

For a change, validate locally, open one reviewable PR, inspect both code and
security review results, address findings, and verify the final commit's checks.
Workflow and policy changes retain code-owner review. Confirm main-push checks
after merge; a PR check alone does not establish successful delivery.
