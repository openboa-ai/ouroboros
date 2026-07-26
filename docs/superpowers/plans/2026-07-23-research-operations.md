# Research Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` and `superpowers:test-driven-development` task by task.

**Goal:** Project every actual bounded Research allocation from the existing RA-03A persisted graph into authoritative `research_operations`, exact Research detail, and the Operator master/detail UI.

**Architecture:** This is a projection-only slice. The persisted allocation, trigger, preflight commitment, worker, direction, checkpoint, selected `SystemCode`, sealed Evaluation, admission, conformance, Finding, lineage, and terminal tick remain the only evidence authorities. Add an exact read-only active-tick plus per-work-item runtime registry to `CandidateArenaRunner` so queued, allocating, and running work can be distinguished from an older orphan without adding persistence. Non-selected development artifacts are not persisted on current `main`; the projection therefore exposes only the current tick's immutable checkpoint summaries and explicitly marks artifact identity unavailable instead of inventing `SystemCode` records or reading mutable workspaces.

**Tech Stack:** TypeScript, React 19, Fastify, Vitest, LocalStore, Tauri Desktop, shadcn/Radix primitives.

## Locked Scope

- Base commit: `3f50ca6598de676d66ec3606108356558eb89f6f`, equal to fetched `origin/main` when this plan was written.
- No new persisted record family, Research scheduler, provider behavior, evaluator policy, Arena rank, private data, order, or live authority.
- One row represents one `CandidateArenaResearchAllocation.selected_directions` item. Configured directions and compatibility tick rows never become sessions.
- `research_work_item_id` is `research-session-v1-` plus the full SHA-256 of canonical JSON `{research_allocation_id,direction_kind}`. It is a projection key, not a persisted authority.
- Terminal checkpoint/admission/tick evidence wins over runtime health. Runtime state is exact only when the selection belongs to `active_tick_id`: an unstarted active selection is `queued`, a registry entry is `allocating` or `running`, and any inactive incomplete allocation or commitment is `recovering`.
- Current `main` has no durable mid-session selection record. The projection keeps `awaiting_selection` and `sealed_admission` in the public lifecycle vocabulary but does not emit them without exact evidence.
- A missing historical trigger, methodology, worker, evaluation edge, or evidence artifact is explicit `unavailable`/`degraded`; no fallback text is presented as source evidence. Provider remains the persisted `ProviderKind` (`codex_cli`, `claude_code`, `local_process`, or `fixture_only`) rather than being rewritten as an AgentProfile provider.
- Every projected free-text field passes through `sanitizeResearchEvidenceText`, is bounded, and carries truncation/degradation state. Provider stdout/stderr, run-root notebooks, paths, URLs, credentials, manifests, and raw failure text are never read into the projection.
- Development and selected-artifact identity stay distinct. Checkpoint notebook entries can prove immutable summary/count history; only the exact selected `TradingEvaluationResultRecord.submitted_system_code_ref` and `submitted_artifact_digest` can identify a `SystemCode`.
- Five-second refresh stays hidden-document aware. Exact detail fetches are list-membership gated, request-sequenced, and retain only last-safe detail for the same selected ID.
- Responsive evidence covers 1440x960 and 1180x760 native Desktop plus 768px and 390px shared Web. Node/SSR tests prove content; rendered manual evidence proves focus, overlap, and overflow.
- Actual populated, empty, degraded-transport, and restart-recovery evidence uses one isolated store and a real managed Codex provider. No fixture capture substitutes for actual-session proof.

## Authoritative Status Precedence

For each allocation selection, resolve status in this order:

1. Exact `CandidateAdmissionDecision` bound directly to the same commitment yields `admitted`, `duplicate`, or `quarantined`, even in the post-admission/pre-checkpoint crash window; any checkpoint that exists must agree.
2. Exact terminal checkpoint yields `finished_without_submission` or `failed_closed`; `restart_recovery` additionally exposes recovery evidence, while `admission_recorded` must resolve the exact admission decision or degrade closed.
3. Exact completed tick-direction result closes pre-commit failures/no-submission and any terminal result whose checkpoint edge is unavailable. A compatibility `created`, `duplicate`, or `quarantined` result cannot create admission status without the exact decision.
4. An exact `CandidateArenaRunner.health().active_research_work_items` entry yields `allocating` before commitment, `running` after the matching commitment, or `failed_closed` for a pre-commit failure awaiting terminal tick persistence.
5. An allocation selection belonging to exact `active_tick_id` but not started because the concurrency batch is full yields `queued`.
6. Any remaining inactive incomplete allocation or commitment yields `recovering` with a degraded reason.

Never apply a global `active_tick` boolean to every open commitment. The runner registers a selection only when its batched task starts, transitions that exact entry after commitment persistence, and removes it after persisted terminal evidence exists. A failure before commitment remains `failed_closed_pending_tick` in the registry until the terminal tick is recorded, preventing it from flashing back to queued while sibling directions finish. Clear only entries owned by the matching tick promise. Tests must include one new active tick beside an older orphan and three directions under concurrency two so the third remains queued.

## Projected Submission Semantics

- `ResearchDevelopmentSubmissionReadModel` is a projection, not a new record.
- Checkpoint notebooks are cumulative worker continuity. A session projects only retained entries whose `candidate_arena_tick_id` equals its commitment tick, exposes `iteration` as that session's submission sequence, and never relabels the worker-global `sequence` as a session sequence.
- Each retained current-tick checkpoint entry exposes decision, evaluator status, risk decision, net revenue, sanitized summary, and whether its `iteration` equals `TradingEvaluationResultRecord.selected_development_submission_sequence`.
- A selected entry exposes `selected_system_code_ref` and `selected_system_code_artifact_digest` only after the exact commitment-bound `TradingEvaluationResultRecord`, `ExperimentRun`, admission decision, and `SystemCode` agree.
- A non-selected entry exposes `artifact_availability: "not_persisted"`; it never borrows the selected digest.
- `submission_history_truncated` and omitted count are session-local: compare `development_budget.recorded_submission_count` with the retained current-tick entries. The cumulative notebook `total_entry_count` and cumulative budget counts never define this session's history.
- Active work with no checkpoint reports durable submission detail as unavailable. It does not read the mutable notebook file.
- Detail exposes record-derived `lifecycle_events` with exact source refs plus `provider_logs_availability: "not_persisted"`; it never labels those controlled events as captured provider output.

---

### Task 1: Freeze exact lifecycle identity and truthful read-model contracts

**Files:**
- Create: `packages/application/src/candidate/research-work-item.ts`
- Create: `packages/application/src/candidate/research-work-item.test.ts`
- Modify: `packages/application/src/candidate/arena.ts`
- Modify: `packages/application/src/candidate/arena-runner.test.ts`
- Modify: `apps/runtime/test/runtime-supervisor-lanes.test.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/research-arena-operations-read-model.test.ts`
- Modify: `apps/operator-web/src/app/operator-view-model.ts`
- Modify: `apps/operator-web/src/app/operator-view-model.test.ts`
- Modify: `docs/research-arena-product-loop.md`

**Produces:** exact `active_tick_id` and `active_research_work_items` phases `allocating | running | failed_closed_pending_tick`, hashed Research work-item identity with `identity_kind: "derived_projection"`, optional/availability-aware trigger/methodology/provider fields, typed status basis/projection health/degraded reasons, checkpoint-summary submission rows with recorded/projected/omitted counts, exact selected-artifact fields, record-derived lifecycle events, explicit provider-log unavailability, and a buildable compatibility mapper.

- [ ] **RED:** Add identity tests for stable canonical key order, allocation/direction separation, and the exact full-digest format. Add runner tests proving health exposes the exact active tick ID; registers only the two directions that actually start under concurrency two while the third stays queued; transitions the matching entry from allocating to running after commitment persistence; retains a pre-commit failure as failed-closed until tick persistence; removes entries only after persisted terminal evidence; clears matching state after settle/failure; isolates an older orphan; and never changes restored tick counts. Add domain/view-model tests proving missing historical trigger/methodology stays unavailable and non-selected submissions cannot carry a `SystemCode` ref.
- [ ] Run `npx vitest run packages/application/src/candidate/research-work-item.test.ts packages/application/src/candidate/arena-runner.test.ts packages/domain/src/research-arena-operations-read-model.test.ts apps/operator-web/src/app/operator-view-model.test.ts apps/runtime/test/runtime-supervisor-lanes.test.ts`; verify failure is caused by the missing contracts.
- [ ] **GREEN:** Track exact tick ID alongside `activeTick`. Pass a runner-owned internal observer into `runCandidateArenaTick`; register a direction when its batched task starts, attach the exact commitment ID immediately after successful persistence, retain sanitized pre-commit failure status until terminal tick persistence, remove only an entry with persisted terminal evidence, and clear only matching-tick state in `finally`. The observer is read-only runtime coordination and changes no provider/evaluator behavior.
- [ ] Make Research summary/detail availability explicit and keep the Web mapper buildable in this same task.
- [ ] Clarify in `docs/research-arena-product-loop.md` that non-selected immutable submission summaries come from the terminal checkpoint while their artifact identity is unavailable on the current persisted graph.
- [ ] Run the focused tests, then `npm run typecheck`; require pristine output.
- [ ] Commit: `feat(research): define truthful operations projection contracts`.

### Task 2: Derive authoritative Research list and exact detail

**Files:**
- Create: `packages/application/src/services/research-operations.ts`
- Create: `packages/application/src/services/research-operations.test.ts`
- Modify: `packages/application/src/ports/store.ts`
- Modify: `packages/application/src/index.ts`
- Modify: `packages/application/src/services/operator.ts`
- Modify: `packages/application/src/services/operator.test.ts`

**Consumes:** allocation, runner health, tick, commitment, worker, direction, evidence artifact, checkpoint, evaluation, ExperimentRun, `SystemCode`, admission, conformance, Finding, lineage, and candidate evidence already persisted by RA-03A.

**Produces:** `ResearchOperationsProjectionService.readOperations()` and `readSessionDetail(researchWorkItemId)` without adding write authority.

- [ ] **RED:** Cover authoritative empty; third selection queued behind concurrency; exact allocating and running entries; active concurrent commitments; older orphan beside a new active tick; inactive incomplete allocation/commitment recovery; pre-commit terminal failure; finished without submission; restart recovery; admitted/duplicate/quarantined; deterministic newest-first order; capacity; exact detail/not-found; cross-session isolation; malformed digest/ref rejection; missing trigger/evidence degradation; and absence of configured-direction rows. Add a same-worker second-session regression proving earlier tick entries stay out, `iteration` remains the session submission sequence, selected comparison uses `selected_development_submission_sequence`, and omitted count derives from `development_budget.recorded_submission_count` rather than cumulative notebook totals.
- [ ] Add privacy/bounds cases for POSIX/Windows paths, URLs, bearer tokens, credential assignments, PEM material, control characters, oversized summaries, raw failure text, more than 100 logs, and truncated checkpoint history.
- [ ] Run `npx vitest run packages/application/src/services/research-operations.test.ts`; verify the service is missing.
- [ ] **GREEN:** Expose LocalStore's existing read-only `listExperimentRuns()` and `listTradingEvaluationResults()` on `OuroborosStorePort` so a partial post-evaluation/pre-admission graph remains inspectable. Load list collections once, index exact IDs, use `getSystemCode()` for selected refs, validate every ref/digest before a join, and apply the locked status precedence. Add no Store write method or record family.
- [ ] Project evidence summaries only from persisted sanitized `ResearchEvidenceArtifactRecord`s. Derive bounded lifecycle events only from allocation, commitment, checkpoint, terminal tick, evaluation, admission, and conformance records; expose provider logs as not persisted.
- [ ] Resolve selected artifact only when Evaluation, ExperimentRun, admission, and `SystemCode` agree on the exact commitment and artifact digest. Project Finding via the admission ref and lineage via the selected child `SystemCode`.
- [ ] Compose the service in `OperatorService`. `readOperator()` always emits `research_operations`; add `readResearchSessionDetail()`. Do not fall back to `CandidateArenaReadModel.latest_ticks` as active sessions.
- [ ] Run `npx vitest run packages/application/src/services/research-operations.test.ts packages/application/src/services/operator.test.ts && npm run typecheck`; require pristine output.
- [ ] Commit: `feat(operator): project persisted Research operations`.

### Task 3: Publish and refresh exact Research detail

**Files:**
- Modify: `packages/application/src/controllers/operator.ts`
- Modify: `apps/runtime/src/controllers/core.ts`
- Modify: `apps/runtime/test/server.test.ts`
- Modify: `apps/operator-web/src/api.ts`
- Modify: `apps/operator-web/src/app/use-operator-runtime.ts`
- Modify: `apps/operator-web/src/App.tsx`
- Modify: `apps/operator-web/src/App.test.tsx`
- Modify: `docs/api-command-contract.md`
- Modify: `docs/operator-desktop-performance-release.md`

**Produces:** authenticated `GET /api/research/sessions/:researchWorkItemId`, exact 404, and a symmetric but separately typed Web detail state.

- [ ] **RED:** Add runtime tests for authenticated 200, exact `research_session_not_found` 404, missing/invalid auth, sanitization, and authoritative empty. Add Web tests for encoded fetch, URL selection, authoritative list-membership gate, stale response rejection, same-ID last-safe detail on refresh error, five-second interval, and hidden-document skip.
- [ ] Run `npx vitest run apps/runtime/test/server.test.ts -t "Research session" apps/operator-web/src/App.test.tsx`; verify the route/detail path is absent.
- [ ] **GREEN:** Mirror Arena detail controller, read rate limit, authentication, and response conventions. Keep Arena and Research detail state separately typed; pass both selected IDs into `useOperatorRuntime`.
- [ ] Freeze the route in `docs/api-command-contract.md` and correct the Desktop resource list in `docs/operator-desktop-performance-release.md`.
- [ ] Run the focused tests plus `npm run typecheck && npm run check:architecture`; require pristine output.
- [ ] Commit: `feat(runtime): expose exact Research session detail`.

### Task 4: Render the Research evidence workspace

**Files:**
- Create: `apps/operator-web/src/screens/research-session-evidence.tsx`
- Create: `apps/operator-web/src/screens/research-session-evidence.test.tsx`
- Create: `apps/operator-web/src/screens/research-screen.test.tsx`
- Modify: `apps/operator-web/src/screens/research-screen.tsx`
- Modify as needed: `apps/operator-web/src/app/operator-view-model.ts`
- Modify as needed: `apps/operator-web/src/app/operator-view-model.test.ts`

**Produces:** dense authoritative master list and exact bounded evidence detail. Historical tick compatibility remains a separately labeled tab.

- [ ] **RED:** Server-render complete, partial, unavailable-trigger, admitted, finished-without-submission, failed-closed/restart, degraded-detail, truncated-log, and non-selected-artifact cases. Assert no raw secret/path text and an exact Arena handoff only for an admitted candidate.
- [ ] Add source/interaction-contract tests for URL-stable stale selection, narrow master hiding, Back clearing only `session`, deliberate detail focus, return focus to the originating row, semantic table headers, and responsive class contracts.
- [ ] Run `npx vitest run apps/operator-web/src/screens/research-screen.test.tsx apps/operator-web/src/screens/research-session-evidence.test.tsx`; verify the summary-only placeholder fails acceptance.
- [ ] **GREEN:** Render desktop columns for lifecycle, methodology, direction, trigger, provider, budget, submissions, result, and progress; retain accessible narrow cards where a table would overflow.
- [ ] Render ordered detail sections: identity/trigger/methodology; sanitized evidence inputs; checkpoint submission summaries and exact selection; admission/conformance/Finding/lineage/Arena handoff; notebook continuity; controlled logs; degradation/truncation alerts.
- [ ] Use text plus status badges, semantic headings/table labels, keyboard-visible selection, and full-width narrow detail with Back.
- [ ] Run `npx vitest run apps/operator-web/src && npm run typecheck -w @ouroboros/operator-web && npm run build -w @ouroboros/operator-web`; require pristine output.
- [ ] Commit: `feat(operator-web): inspect persisted Research sessions`.

### Task 5: Prove actual runtime, restart, and responsive UI evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-07-23-research-operations.md` only after evidence exists.

- [ ] Verify ports `4273` and `5273` are free. Do not reuse the OURO-237 services on default ports `4173`/`5173` as OURO-238 evidence:

```bash
lsof -nP -iTCP:4273 -sTCP:LISTEN
lsof -nP -iTCP:5273 -sTCP:LISTEN
```

- [ ] Create one isolated real-provider root. Record the printed path and reuse it verbatim; never copy an existing credential file:

```bash
export OURO_RUN_ROOT="$(mktemp -d /private/tmp/ouro-238.XXXXXX)"
printf '%s\n' "$OURO_RUN_ROOT"
export OUROBOROS_STORE_ROOT="$OURO_RUN_ROOT/store"
export OUROBOROS_RUNTIME_URL=http://127.0.0.1:4273
export OUROBOROS_OPERATOR_API_TOKEN=ouro-238-local-evidence
export OUROBOROS_TRADING_RESEARCH_AGENT=codex
export OUROBOROS_TRADING_RESEARCH_TIMEOUT_MS=120000
export OUROBOROS_SBX_HOME="$OURO_RUN_ROOT/sbx-home"
unset OUROBOROS_SBX_BIN
export OUROBOROS_SDX_BIN="$PWD/scripts/sdx-docker-sandboxes"
mkdir -p "$OUROBOROS_STORE_ROOT" "$OURO_RUN_ROOT/evidence"
npm run login:s5-sdx-isolated
npm run validate:s5-sdx:preflight
./bin/ouroboros agent setup codex --json
./bin/ouroboros agent login codex
./bin/ouroboros agent probe codex --json
```

Require the probe to report `authenticated`. If managed device login or Sandbox preflight is unavailable, report that external blocker; fixture evidence cannot replace this gate.

- [ ] Start runtime in its own PTY with `HOST=127.0.0.1 PORT=4273 ./bin/ouroboros runtime serve`, record that exact PID/session, wait for `/health`, select Codex, and save the authoritative empty Research response:

```bash
./bin/ouroboros researcher provider set codex --json
curl -fsS -H 'x-ouroboros-operator-token: ouro-238-local-evidence' http://127.0.0.1:4273/api/operator >"$OURO_RUN_ROOT/evidence/operator-empty.json"
```

- [ ] Submit one bounded `arena.tick` in a second PTY. While it runs, poll `/api/operator` once per second and require exact `queued`, `allocating`, or `running` rows with provider `codex_cli`; the third default selection should be observable as queued while two work items execute. Save the timeline and final response. One tick normally owns three sessions, and its nondeterministic terminal result may be admission, duplicate, quarantine, no-submission, or failed-closed:

```bash
./bin/ouroboros arena tick --json >"$OURO_RUN_ROOT/evidence/arena-tick.json" &
export OURO_TICK_REQUEST_PID=$!
while kill -0 "$OURO_TICK_REQUEST_PID" 2>/dev/null; do
  curl -fsS --connect-timeout 2 --max-time 15 \
    -H 'x-ouroboros-operator-token: ouro-238-local-evidence' \
    http://127.0.0.1:4273/api/operator \
  | jq -c '{observed_at:(now|todateiso8601),active_tick_id:.operator.candidate_arena.runner_health.active_tick_id,sessions:(.operator.research_operations.sessions|map({research_work_item_id,status,provider,last_progress_at}))}' \
  >>"$OURO_RUN_ROOT/evidence/research-timeline.jsonl"
  sleep 1
done
wait "$OURO_TICK_REQUEST_PID"
curl -fsS -H 'x-ouroboros-operator-token: ouro-238-local-evidence' \
  http://127.0.0.1:4273/api/operator \
  >"$OURO_RUN_ROOT/evidence/operator-final.json"
jq -e '[.operator.research_operations.sessions[] | select(.provider == "codex_cli")] | length > 0' \
  "$OURO_RUN_ROOT/evidence/operator-final.json"
```

- [ ] Extract a returned `research_work_item_id`, URI-encode it deterministically, and read exact detail:

```bash
export OURO_RESEARCH_ID="$(jq -er '.operator.research_operations.sessions | sort_by(.last_progress_at // .allocated_at) | last | .research_work_item_id' "$OURO_RUN_ROOT/evidence/operator-final.json")"
export OURO_RESEARCH_ID_URI="$(jq -rn --arg value "$OURO_RESEARCH_ID" '$value|@uri')"
curl -fsS -H 'x-ouroboros-operator-token: ouro-238-local-evidence' \
  "http://127.0.0.1:4273/api/research/sessions/$OURO_RESEARCH_ID_URI" \
  >"$OURO_RUN_ROOT/evidence/research-detail.json"
jq -e --arg id "$OURO_RESEARCH_ID" '.research_session.research_work_item_id == $id' \
  "$OURO_RUN_ROOT/evidence/research-detail.json"
```

Verify trigger/methodology/provider/budget, checkpoint submission availability, selected artifact when present, terminal admission, controlled lifecycle events, degradation flags, and Arena handoff only when exact evidence exists. `/health.mode` is not provider evidence, and `fixture_seed` source provenance does not make a Codex provider session a fixture session.

- [ ] Produce failed-closed restart evidence in the isolated store: start another tick, record both its request PID and the exact runtime PID, and poll until an exact commitment-backed row is running. Snapshot the runtime's exact direct child PIDs, simulate process loss with `kill -KILL "$OURO_RUNTIME_PID"` (not SIGINT/SIGTERM, which drain the active tick), and preserve the interrupted request output:

```bash
export OURO_PROVIDER_PIDS="$(pgrep -P "$OURO_RUNTIME_PID" | tr '\n' ' ' || true)"
kill -KILL "$OURO_RUNTIME_PID"
wait "$OURO_RUNTIME_PID" 2>/dev/null || true
for pid in $OURO_PROVIDER_PIDS; do
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "$pid"
  fi
done
for attempt in {1..40}; do
  live_child=""
  for pid in $OURO_PROVIDER_PIDS; do
    kill -0 "$pid" 2>/dev/null && live_child="$pid"
  done
  [ -z "$live_child" ] && break
  sleep 0.25
done
for pid in $OURO_PROVIDER_PIDS; do
  if kill -0 "$pid" 2>/dev/null; then
    printf 'owned provider child still alive: %s\n' "$pid" >&2
    exit 1
  fi
done
if lsof -nP -iTCP:4273 -sTCP:LISTEN; then
  printf 'OURO-238 runtime listener still alive\n' >&2
  exit 1
fi
```

Restart the same store only after those checks pass and the interrupted CLI request has exited. Invoke one new bounded `./bin/ouroboros arena tick --json` to trigger pre-effect recovery, save its output, and require the interrupted session to close as `failed_closed` with `restart_recovery`. Do not submit another tick while the first server-side process may still be alive.
- [ ] Produce degraded transport evidence without corrupting persisted records: load an exact detail, terminate only the recorded isolated runtime, wait through one five-second refresh, and verify the same-ID last-safe detail remains with a visible read error. Restart the same store afterward.
- [ ] Launch native Desktop against the real store/runtime:

```bash
export VITE_OUROBOROS_RUNTIME_URL=http://127.0.0.1:4273
export VITE_OUROBOROS_OPERATOR_API_TOKEN=ouro-238-local-evidence
export OUROBOROS_DESKTOP_RUNTIME_HOST=127.0.0.1
export OUROBOROS_DESKTOP_RUNTIME_PORT=4273
npm run dev:operator-desktop
pgrep -fl ouroboros-operator-desktop
curl -fsS http://127.0.0.1:4273/health
```

- [ ] Open exact `#/research?session=$OURO_RESEARCH_ID_URI`, capture and share actual populated detail at native 1440x960 before PR publication, then set and inspect native 1180x760. Save explicit output paths:

```bash
osascript -e 'tell application "System Events" to tell process "ouroboros-operator-desktop" to set size of front window to {1440, 960}'
screencapture -i "$OURO_RUN_ROOT/evidence/research-desktop-1440x960.png"
osascript -e 'tell application "System Events" to tell process "ouroboros-operator-desktop" to set size of front window to {1180, 760}'
screencapture -i "$OURO_RUN_ROOT/evidence/research-desktop-1180x760.png"
```

Use Browser/Computer Use to navigate the native app to the exact Research row before capture and to verify its visible URL-backed selection; `screencapture -i` is an explicit interactive window capture, not whole-display proof. Launch shared Web on the fixed port for 768px and 390px:

```bash
npm run dev -w @ouroboros/operator-web -- --host 127.0.0.1 --port 5273 --strictPort
export OURO_RESEARCH_URL="http://127.0.0.1:5273/#/research?session=$OURO_RESEARCH_ID_URI"
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new \
  --user-data-dir="$OURO_RUN_ROOT/chrome-768" --force-device-scale-factor=1 \
  --window-size=768,960 --virtual-time-budget=10000 \
  --run-all-compositor-stages-before-draw \
  --screenshot="$OURO_RUN_ROOT/evidence/research-web-768x960.png" "$OURO_RESEARCH_URL"
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new \
  --user-data-dir="$OURO_RUN_ROOT/chrome-390" --force-device-scale-factor=1 \
  --window-size=390,844 --virtual-time-budget=10000 \
  --run-all-compositor-stages-before-draw \
  --screenshot="$OURO_RUN_ROOT/evidence/research-web-390x844.png" "$OURO_RESEARCH_URL"
sips -g pixelWidth -g pixelHeight \
  "$OURO_RUN_ROOT/evidence/research-web-768x960.png" \
  "$OURO_RUN_ROOT/evidence/research-web-390x844.png"
```

Capture authoritative empty before the first tick, populated terminal detail, same-ID degraded transport, and failed-closed restart recovery across the required viewports. Browser captures do not replace native Desktop evidence.

- [ ] Manually verify Back/focus return, keyboard selection, URL stability, at least one five-second refresh, no overlap, no horizontal page overflow, no clipped controls, and status text independent of color.
- [ ] Quit Desktop through its tray, stop only the exact Web/runtime sessions started here, and verify ports `4273`/`5273` no longer listen. Retain `$OURO_RUN_ROOT/evidence` and the isolated store until review closes; do not touch OURO-237 processes or pre-existing stores/profiles.

### Task 6: Validate, review, publish, and land

- [ ] Run focused suites, then:

```bash
npm run typecheck
npm run build
npm run check:repo-guards
npm test
```

Process-ownership tests that need `/bin/ps` must be rerun outside the managed sandbox when sandbox execution returns `EPERM`; sandbox denial is neither a product pass nor a product failure.

- [ ] Request an independent task review after every task and a whole-branch review after Task 5. Resolve all Critical/Important findings and rerun covering tests.
- [ ] Append exact commands/results, actual session ID, detail readback status, capture paths, viewport checks, and environment-only notes to this plan.
- [ ] Add a final local verification commit with this trailer: `Scope-Rationale: OURO-238 is one projection-only vertical slice because persisted graph derivation, exact detail API, and Operator inspection jointly prove the issue claim.`
- [ ] Publish a PR titled `[OURO-238] ...` with body exactly `OURO-238`. Move Linear to `In Review` only after local evidence and the PR exist.
- [ ] Land only after current-head required checks, CodeQL/gitleaks where configured, unresolved-thread readback, mergeability, rendered UI evidence, and current-head Codex review are clean.

## Plan Self-Review

- Scope is projection-only; no persisted contract, provider, scheduler, evaluator, rank, private/live, or order authority is added.
- Exact active identity prevents an unrelated active tick from reviving an orphan.
- Terminal and pre-commit failures precede runtime state; inactive incomplete work is recovery.
- Development snapshot digest and selected canonical `SystemCode` digest are never conflated.
- Missing trigger/methodology and non-selected artifact identity are explicit, not fabricated.
- Intermediate commits run root typecheck; the nonexistent Research screen test is correctly marked Create.
- Required build and 1440x960, 1180x760, 768px, and 390px evidence are included.
- Empty, populated, degraded-transport, and failed-closed restart evidence all remain bound to the isolated real Codex-backed run.
