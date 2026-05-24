# Ouroboros

Ouroboros is an automated weak-to-strong trading-system laboratory. Its first product proof is a single serious solo crypto operator evolving one agent-built `TradingSystem` through `SystemCode`, `Evaluation`, `Improvement`, `TradingRun`, `Sandbox`, `Gateway`, and `Ledger`.

## Source Of Truth

Linear is the source of truth for product, planning, project state, documentation, comments, project updates, and durable operating history.

Primary Linear surfaces:

- Project: https://linear.app/openboa/project/ouroboros-113fef53f6d1
- 00 Start Here - Ouroboros Documentation Index: https://linear.app/openboa/document/ouroboros-documentation-index-953f443725df
- 01 Product Strategy - Thesis, Market, Metrics: https://linear.app/openboa/document/ouroboros-product-strategy-0b56a519c964
- 02 MLP-01 Brief - Scope, JTBD, Cutline: https://linear.app/openboa/document/mlp-01-brief-and-cutline-b64af14949a6
- 03 MLP-01 Release Plan - Milestones and Slices: https://linear.app/openboa/document/mlp-01-release-plan-d3d83c35f208
- 04 Execution Ledger - Active Frontier and Handoff: https://linear.app/openboa/document/execution-ledger-and-active-frontier-9e036cf84011

See [LINEAR.md](LINEAR.md) for the full read order and document taxonomy.

## Repository Role

This repository owns implementation truth: code under `apps/` and `packages/`, tests, fixtures, package scripts, validation scripts, executable repo-local agent instructions under `.agents/`, and minimal developer entry points.

Long-form product, architecture, source, service, and project-memory material lives in Linear Project Documents. Do not reintroduce a parallel repo documentation tree.

## Current Technical Shape

- `apps/runtime` hosts the runtime API, candidate materialization, provider adapter seam, and local execution surfaces.
- `apps/operator-web` hosts the operator-facing web surface.
- `packages/domain` owns shared domain contracts.
- `packages/local-store` owns filesystem-backed local persistence.
- `.agents` owns reusable agent operating skills for this repo.

## Naming Surface

Use the same nouns in code, API, UI, and compact repo docs:

```text
TradingSystem -> SystemCode -> Evaluation -> Improvement -> TradingRun -> Sandbox -> Gateway -> Ledger
```

User-facing flow: Trading System -> System Code -> Evaluation -> Improvement -> Trading Run -> Sandbox -> Gateway -> Ledger.

`OrderRequest`, `GatewayResult`, and `ExecutionResult` are the Ledger chain. Docker, Compose,
Docker Sandboxes `sbx`, placement, adapter, and host paths are implementation details under
`Sandbox`, not product nouns. Older persisted names can appear only in compatibility reads or
tests that prove old records still load.

## Development Read Path

1. Read the active Linear issue, milestone, blockers, comments, and project updates.
2. Read [LINEAR.md](LINEAR.md) and the referenced Linear Project Documents.
3. Read [AGENTS.md](AGENTS.md) for repo-specific agent policy.
4. Read [ARCHITECTURE.md](ARCHITECTURE.md) for the compact local code map.
5. Inspect only the code and tests relevant to the current issue.

## Local Commands

```bash
npm install
npm run hooks:install
bash scripts/check-docs.sh
npm run check:naming
bash scripts/check-env-files.sh --tracked
bash scripts/check-secrets.sh
git diff --check
npm test
npm run typecheck
```

## Local Runtime Stack

The repo-owned stack files are development and validation tooling. Product state still lives in
the persisted records and Linear, not in Docker, Compose, or sandbox names.

Run the host services:

```bash
npm run dev:runtime
npm run dev:operator-web
```

Run the Compose stack:

```bash
docker compose build
docker compose up runtime operator-web
```

Prerequisites are a running Docker daemon and the Docker Compose v2 plugin.

Defaults:

- Runtime API: `http://127.0.0.1:${OUROBOROS_RUNTIME_PORT:-4173}`
- Operator web: `http://127.0.0.1:${OUROBOROS_OPERATOR_WEB_PORT:-5173}`
- Runtime container store root: `/data/ouroboros-store`
- Runtime persisted volume: `ouroboros-local_ouroboros-store`
- Compose network: `ouroboros-local_ouroboros-local`

Trading gateway environment variables do not select runtime behavior or paper market endpoints. In
MLP-01, runtime environments are `paper` and disabled `live`. Paper is pinned to Binance production
public market data from `https://fapi.binance.com` with a fake account, fake executor, and fake
Ledger. Demo/testnet URLs are test-only injected clients, not product runtime environments. Both
profile examples keep the same credential variable names for future compatibility, but the current
app reports `not_live`, does not require credentials for paper, and performs no live exchange calls.

Trading research can run from the CLI or the Operator web full-cycle action through the same
researcher runtime config. Normal runtime startup defaults to Codex, while tests can still inject
fixture adapters:

```bash
OUROBOROS_TRADING_RESEARCH_AGENT=codex
OUROBOROS_TRADING_RESEARCH_CODEX_BIN=codex
OUROBOROS_TRADING_RESEARCH_MODEL=
OUROBOROS_TRADING_RESEARCH_TIMEOUT_MS=120000
OUROBOROS_TRADING_RESEARCH_ITERATIONS=1
```

Use `npm run trading:research -- --agent codex` for CLI research runs, or select Codex in the
Operator web full-cycle controls. `fixture` remains an explicit dev/test fallback only.

Compose validation covers package-level checks in a clean container image:

```bash
docker compose --profile validation run --rm validation npm test
docker compose --profile validation run --rm validation npm run typecheck
docker compose --profile validation run --rm validation npm run build
```

Run `bash scripts/check-docs.sh`, `bash scripts/check-env-files.sh --tracked`,
`bash scripts/check-secrets.sh`, and `git diff --check` on the host or inside a Docker Sandbox
workspace with repository metadata available.

## Local Safety Hooks

Git hooks live in [.githooks](.githooks) and are enabled with `npm run hooks:install`. They block
staged or tracked real environment files and run `gitleaks` before commit and push.

Codex hooks live in [.codex/hooks.json](.codex/hooks.json). Review and trust them from Codex with
`/hooks` when prompted. They add a lighter pre-tool guard around `Bash` and `apply_patch` so agent
work cannot directly edit or stage real `.env`, `.env.*`, `.envrc`, or key/certificate files. The
post-tool hook reruns the repository environment-file guard against staged and tracked paths. These
hooks are a workflow guardrail; Git hooks plus `gitleaks` remain the final commit and push gate.

GitHub Actions mirrors the local gate: `ci` runs docs checks, environment-file guards, gitleaks,
whitespace checks, typecheck, tests, and build. GitHub-hosted runners keep the S5 unit and audit
coverage but skip the three host-lifecycle S5 `sbx` transcript tests that create long-running fake
runtime child processes; run `npm test -- apps/runtime/test/s5-sbx-validation-script.test.ts` on a
host to execute those lifecycle cases. Separate scheduled workflows keep full-history gitleaks
scanning and CodeQL code scanning active; CodeQL scans both GitHub Actions workflows and
JavaScript/TypeScript with the `security-and-quality` query suite.

Docker Sandboxes validation runs from the repository root with the host checks above, then the
same Compose commands when the sandbox has Compose available. The only durable result to record is
the command evidence and resulting records; sandbox IDs, host paths, and local agent configuration
are not project state.

Slice 5 real Docker Sandboxes validation is available as a separate harness because it creates and
cleans up named `sbx` runtimes:

```bash
npm run audit:s5-sbx
npm run audit:s5-sbx:completion
npm run audit:s5-sbx:promotion
npm run report:s5-sbx-blocker
npm run validate:s5-sbx:preflight
npm run validate:s5-sbx
npm run validate:s5-sbx -- --preflight-only
```

The `s5-sdx` npm scripts are compatibility aliases for operators who use `sdx` naming locally.
They still run the same Docker Sandboxes proof harness and still reject the macOS `/usr/bin/sdx`
Starkit utility unless the target emits Docker Sandboxes `sbx version` output:

```bash
npm run audit:s5-sdx
npm run report:s5-sdx-blocker
npm run login:s5-sdx-isolated
npm run resume:s5-sdx-isolated
npm run login:s5-sdx-local
npm run resume:s5-sdx-local
npm run recover:s5-sdx-daemon
npm run recover:s5-sdx-daemon:validate
npm run validate:s5-sdx:preflight
npm run validate:s5-sdx
```

On hosts where `sdx` resolves to the macOS Starkit utility, keep the `s5-sdx` operator naming but
point it at the Docker Sandboxes CLI explicitly:

```bash
OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes npm run validate:s5-sdx:preflight
OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes npm run validate:s5-sdx
OUROBOROS_SDX_BIN=/opt/homebrew/bin/sbx npm run validate:s5-sdx:preflight
OUROBOROS_SDX_BIN=/opt/homebrew/bin/sbx npm run validate:s5-sdx
```

The audit command checks repo-side S5 files, npm scripts, and help guardrails without mutating
sandbox state. Add `-- --host-probes` to include non-mutating host `sbx` preflight and recovery
dry-run checks. It exits `0` when readiness passes, `1` for repo readiness failures, and `2` when
repo readiness passes but host `sbx` preflight or run-control remains blocked. The validation
harness starts the runtime API with the real `docker_sandboxes_sbx` adapter, records the
`sbx` command transcript, checks sandbox status and logs, and stops/removes the test
sandboxes. The preflight command records `sbx` version, diagnose, daemon status, and a non-mutating
`sbx ls` run-control probe. Full validation creates named sandboxes and exits nonzero if the
host `sbx` daemon cannot complete the lifecycle. Validation exits `2` when the host `sbx`
preflight/run-control path is blocked before sandbox creation, and `1` for validation contract,
runtime API, or lifecycle assertion failures. Blocked validation transcripts print the next
default-daemon recovery command or isolated-home login/recovery command, depending on the selected
`OUROBOROS_SBX_HOME` mode. Isolated-home auth blockers also print the follow-on validation command
to run after login and isolated daemon recovery.

The completion audit is non-mutating. It checks the latest `.ouroboros/s5-sbx-evidence/validate-*.log`
transcript, or an explicit `-- --evidence <path>`, and exits `2` until a real `validate:s5-sbx`
run proves both clock sandboxes started, emitted direct sandbox log heartbeats, reported runtime API
status/log heartbeats, returned runtime API stop responses with a `stopped` lifecycle, and were
removed in lifecycle order. Direct sandbox log sections must contain the matching sandbox
id, `sbx diagnose` must report zero failures, and the transcript must not include a `RESULT:
failed` marker. The transcript must also show the real validation harness starting the runtime API
with the sbx adapter enabled. Completion audit also rejects Starkit or non-Docker-Sandboxes `sdx`
transcript evidence.
The promotion audit is also non-mutating and combines readiness plus completion evidence; do not
mark OURO-32 Done unless `npm run audit:s5-sbx:promotion -- --evidence <path>` exits `0`.

This validation uses Docker Sandboxes `sbx`. The macOS `/usr/bin/sdx` Starkit utility is unrelated
and is intentionally rejected by the S5 validation harness.
Full validation needs Hypervisor/libkrun access outside the Codex command sandbox; in Codex, start
the selected `sbx` daemon and run validation with approved/escalated execution if capability probes
fail with `Operation not permitted`.

Useful overrides:

- `OUROBOROS_SBX_BIN`: `sbx` binary path.
- `OUROBOROS_SDX_BIN`: compatibility alias used only when `OUROBOROS_SBX_BIN` is unset; the
  target must still emit Docker Sandboxes `sbx version` output.
- `OUROBOROS_SBX_HOME`: optional HOME directory for isolated `sbx` daemon/auth state.
- `OUROBOROS_SBX_VALIDATE_NAME_SUFFIX`: optional suffix for the two validation sandbox names when
  rerunning against a host that may have stale runtime-volume names from prior probes.
- `OUROBOROS_SBX_VALIDATE_PORT`: temporary runtime API port for `validate:s5-sbx`.
- `OUROBOROS_SBX_VALIDATE_TIMEOUT_MS`: per-command validation timeout, defaulting to 60000ms so
  first-run sandbox image pulls are not cut off.
- `OUROBOROS_SBX_EVIDENCE_PATH`: optional file path to tee the validation transcript.
- `OUROBOROS_SBX_RECOVERY_TIMEOUT_MS`: per-command recovery dry-run timeout.
- `OUROBOROS_SBX_RUNTIME_STATE_DIR`: runtime metadata directory for recovery path checks.

If preflight fails at the `sbx ls` run-control probe or full validation hangs at the `sbx`
runtime endpoint, inspect the daemon state without changing it:

```bash
npm run recover:s5-sbx-daemon
```

For a Docker support handoff, keep the report local unless a human explicitly chooses to upload
diagnostics:

```bash
sbx diagnose --output github-issue
sw_vers
uname -m
sysctl kern.hv_support
HOMEBREW_NO_AUTO_UPDATE=1 brew info docker/tap/sbx
HOMEBREW_NO_AUTO_UPDATE=1 brew outdated --greedy --cask sbx
HOMEBREW_NO_AUTO_UPDATE=1 brew info docker/tap/sbx@nightly
sbx create --help
sbx template ls
sbx ls --json
codesign --verify --strict --verbose=4 "$(command -v sbx)"
spctl --assess --type execute -vvv "$(command -v sbx)"
xattr -lr /opt/homebrew/Caskroom/sbx/<version>
OUROBOROS_SBX_EVIDENCE_PATH=.ouroboros/s5-sbx-evidence/validate-<timestamp>-blocked.log npm run validate:s5-sbx
npm run audit:s5-sbx:completion -- --evidence .ouroboros/s5-sbx-evidence/validate-<timestamp>-blocked.log
npm run recover:s5-sbx-daemon
npm run report:s5-sbx-blocker -- --evidence .ouroboros/s5-sbx-evidence/validate-<timestamp>-blocked.log --report .ouroboros/s5-sbx-evidence/blocker-report-<timestamp>.md
npm run report:s5-sbx-blocker -- --write-default-report
OUROBOROS_ALLOW_SBX_CREATE_PROBE=1 npm run report:s5-sbx-blocker -- --include-create-probe --evidence .ouroboros/s5-sbx-evidence/validate-<timestamp>-blocked.log --report .ouroboros/s5-sbx-evidence/blocker-report-<timestamp>.md
```

Attach or paste the redacted outputs only after reviewing them. Do not run `sbx diagnose --upload`
from automation; it uploads diagnostics to Docker support and should be a separate human decision.
The local blocker report also reads the `sbx` daemon log and includes only redacted lines that
mention runtime-create VM start failures such as `krun_start_enter failed`.
Use `--write-default-report` to write a timestamped local report under `.ouroboros/s5-sbx-evidence/`
without choosing a report path manually.
The `--include-create-probe` report variant is not sandbox-state non-mutating; it requires
`OUROBOROS_ALLOW_SBX_CREATE_PROBE=1` and may create one uniquely named temporary sandbox, then
attempts to remove only that sandbox.

The recovery helper is dry-run by default. Its `--apply` mode restarts the `sbx` daemon and can
interrupt active sandbox sessions, so it requires `OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1`. If
active `sbx exec` sessions are present, apply mode also requires
`OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION=1`. It also rejects non-Docker-Sandboxes binaries
before inspecting or restarting the daemon. Dry-run output includes a redacted runtime metadata path
check that reports missing workspace paths without printing embedded credentials or raw metadata.
It also summarizes active `sbx exec` and app-server session counts and whether the active-session
interruption gate is required, without printing raw process command lines.
It also summarizes daemon log hints for each runtime metadata entry, including SDK health-check
failures, mount-policy denials, container inspect requests that have no matching completion log,
and container stop requests that have no matching completion log.
When runtime metadata includes a Docker-compatible socket path, recovery also runs a bounded
non-mutating Docker socket probe and prints only server/list/inspect status summaries.
After apply, recovery exits nonzero if `sbx ls` is still broken; `--validate-after-apply` then runs
`npm run validate:s5-sbx` only after post-restart runtime listing succeeds, followed by
`npm run audit:s5-sbx:completion -- --evidence <path>` and
`npm run audit:s5-sbx:promotion -- --evidence <path>`. Automatic validation passes
`OUROBOROS_SBX_EVIDENCE_PATH` through to the validation harness and audits; when it is not already
set, the transcript defaults under `.ouroboros/s5-sbx-evidence/validate-*.log`.

When active sandbox sessions may be interrupted and that risk is explicitly accepted:

```bash
승인: active sbx exec app-server 세션 중단 위험을 이해했고, sbx daemon 재시작 및 active session interruption을 허용함
OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1 OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION=1 npm run recover:s5-sbx-daemon:validate
```

If `sbx ls` is blocked and you need to prove whether `sbx create` is blocked by the same
run-control path, run the optional direct create-path probe. It creates one uniquely named
temporary sandbox only when the explicit gate is set, then attempts `exec` and `rm --force` for
that same temporary name. The same gated probe can also be included in the local blocker report
with `report:s5-sbx-blocker -- --include-create-probe`:

```bash
OUROBOROS_ALLOW_SBX_CREATE_PROBE=1 npm run recover:s5-sbx-daemon -- --probe-create-path
```

An isolated `sbx` daemon can be targeted without changing the repo process home by setting
`OUROBOROS_SBX_HOME`. The isolated home must already be authenticated with Docker Sandboxes before
real validation can create sandboxes. Recovery apply with `OUROBOROS_SBX_HOME` targets only that
isolated home and does not require the default-daemon active-session interruption gate. Do not copy
Docker Sandboxes auth stores or `secretpass` files between HOME directories; authenticate the
isolated home with `HOME=<path> sbx login`. Recovery dry-run restart and validation command hints
preserve the same `OUROBOROS_SBX_HOME` prefix so they do not accidentally target the default daemon.
Then run repo validation with `OUROBOROS_SBX_HOME`:

```bash
OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sbx-home npm run login:s5-sbx-isolated
OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sbx-home npm run resume:s5-sbx-isolated
OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sbx-home npm run validate:s5-sbx:preflight
OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sbx-home npm run validate:s5-sbx
```

The same isolated-home path can be driven through the `s5-sdx` aliases when `OUROBOROS_SDX_BIN`
points at a Docker-Sandboxes-compatible CLI:

```bash
OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes npm run login:s5-sdx-isolated
OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes npm run resume:s5-sdx-isolated
OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes npm run validate:s5-sdx:preflight
OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes npm run validate:s5-sdx
```

If an absolute binary path is preferred, use the same isolated-home commands with
`OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home OUROBOROS_SDX_BIN=/opt/homebrew/bin/sbx`.

For the repo-local default isolated SDX environment, the shortest recovery path is:

```bash
npm run login:s5-sdx-local
npm run resume:s5-sdx-local
npm run validate:s5-sdx-local:preflight
npm run validate:s5-sdx-local
npm run audit:s5-sdx-local:promotion -- --evidence .ouroboros/s5-sbx-evidence/validate-<timestamp>.log
```

## Documentation Policy

Repo-originated durable product, architecture, source, service, or project-memory updates go to Linear. Linear content is not synced back into repo documentation. Update repo docs only when developer or agent execution would be wrong without the local hint.
