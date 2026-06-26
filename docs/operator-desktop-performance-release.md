# Operator Desktop Performance And Release

Ouroboros Desktop is the primary Tauri operator app. It owns the local runtime lifecycle visibility,
macOS menu bar status, background execution, and packaged app release path while using the shared
Operator UI source currently built from `apps/operator-web`. CLI remains the complete baseline for
headless operation and automation. Desktop, CLI, TUI, and Web share the same runtime command/read
contract and store-backed session data; Desktop must not create a second product API.
On macOS it runs as a regular native app window with a menu bar runtime-status item, so the
operator window is visible when opened and can still be restored from the tray without turning
background operation into a separate web session.
Use `npm run open:operator-desktop` to launch the packaged app without opening a browser after the
bundle has been produced.
`npm run dev:operator-desktop` follows the same app-first rule for local development: it builds the
shared Operator UI into the Tauri `frontendDist` target and opens the native app without starting
the `apps/operator-web` dev server. Use `npm run dev:operator-web` only when directly developing the
shared browser/development surface.

## Runtime Packaging

The Desktop app starts the runtime in this order:

1. reuse an already reachable runtime at `OUROBOROS_DESKTOP_RUNTIME_HOST` and
   `OUROBOROS_DESKTOP_RUNTIME_PORT` (`127.0.0.1:4173` by default)
2. launch `OUROBOROS_RUNTIME_BIN` when an explicit packaged runtime executable is supplied
3. launch a bundled runtime sidecar launcher named `ouroboros-runtime` from the app resource
   directory when present
4. fall back to the repo-local `node_modules/.bin/tsx apps/runtime/src/main.ts` entrypoint for
   source-checkout development

The packaged runtime contract is recorded in
`apps/operator-desktop/src-tauri/resources/runtime/ouroboros-runtime.manifest.json`. The executable
launcher lives at `apps/operator-desktop/src-tauri/resources/runtime/ouroboros-runtime`. Both files
are bundled as Tauri resources under the app's `Contents/Resources/resources/runtime/` directory for
local packaged app runs. The shared Operator UI bundle still talks only to `GET /api/operator` and
`POST /api/commands`.

## Background Runtime Status

The Desktop app is the operator's visible runtime owner. Launching the app attempts to keep the
local runtime reachable in the background. Closing the window with the macOS window close control
does not quit Ouroboros; it hides the window and leaves the app process, menu bar item, and any
Desktop-spawned runtime process running.

The macOS menu bar item shows whether the product loop is actually operating, not only whether the
native window is open:

- `Ouroboros LOOP` means the configured runtime is reachable and `GET /api/operator` reports the
  Candidate Arena paper/research loop as running
- `Ouroboros RUN` means the configured runtime host and port are reachable, but the Candidate Arena
  loop is stopped or the Operator read model could not be read
- `Ouroboros OFF` means the configured runtime host and port are not reachable

The menu bar item refreshes from the same `runtime_reachable(host, port)` check used during startup,
so it reports both Desktop-spawned and already-running runtimes. The background monitor also uses
that check as a keepalive loop: when the configured runtime is no longer reachable, the Desktop app
reaps any finished child process and attempts to start the runtime again from the same packaged
sidecar/source-checkout order used at launch. `Open Operator` restores the window, `Hide Window` keeps the
background process alive, `Start Paper/Research Loop` and `Stop Paper/Research Loop` call the
shared `POST /api/commands` contract with `arena.start` and `arena.stop`, `Restart Runtime`
explicitly restarts the Desktop-owned runtime child
when needed, and `Quit Ouroboros` is the explicit shutdown path. Quitting only stops the child
runtime process that the Desktop app spawned; it does not kill an external runtime that was already
running before the app opened.

Runtime startup resumes the autonomous arena loop when the persisted command ledger says the last
successful arena control command was `arena.start`. A later successful `arena.stop` leaves the
runner stopped. Desktop owns runtime reachability and visibility; the runtime owns the
store-backed loop resume decision.

## Performance Measurement

Use:

```bash
npm run measure:operator-performance -- --check
```

The measurement covers runtime readiness, `/api/operator` latency and payload size, built shared UI
asset weight, desktop bundle size, and native Desktop app screenshot capture time on macOS.
The JSON output is the evidence packet. Thresholds can be tightened with:

- `OUROBOROS_PERF_MAX_RUNTIME_READY_MS`
- `OUROBOROS_PERF_MAX_OPERATOR_PAYLOAD_BYTES`
- `OUROBOROS_PERF_MAX_OPERATOR_FETCH_MS`
- `OUROBOROS_PERF_MAX_WEB_ASSET_BYTES`
- `OUROBOROS_PERF_MAX_DESKTOP_APP_SCREENSHOT_MS`

## UI Performance Policy

The shared Operator UI source must keep repeated views bounded:

- sidebar TradingSystem candidates are capped by `OPERATOR_SIDEBAR_CANDIDATE_LIMIT`
- Candidate Arena leaderboard rows are capped by `OPERATOR_LEADERBOARD_RENDER_LIMIT`
- market chart points are downsampled by `OPERATOR_MARKET_CHART_POINT_LIMIT`
- automatic refresh is skipped while the document is hidden

The selected candidate stays visible even when it is outside the first bounded page.

## Release Packaging

Use:

```bash
npm run package:operator-desktop
npm run open:operator-desktop
npm run verify:operator-desktop-release
```

The current release artifact is the local macOS app bundle:

```text
apps/operator-desktop/src-tauri/target/release/bundle/macos/Ouroboros Operator.app
```

The release verification command checks the app bundle, executable, Tauri bundle config, runtime
manifest resource, executable runtime sidecar launcher resource, Tauri dependency, and absence of
Electron. Developer ID signing, DMG installer creation, and Apple notarization remain explicit
release gates because they require external Apple credentials and signing policy.
