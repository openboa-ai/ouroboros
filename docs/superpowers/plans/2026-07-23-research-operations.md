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
for port in 4273 5273; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    printf 'OURO-238 evidence port %s is already occupied:\n' "$port" >&2
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2
    exit 1
  fi
done
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

- [ ] Before the first tick, launch Desktop and Web in separate dedicated PTYs with the full environment repeated in each PTY. Desktop must reuse the external runtime and must not auto-respawn it during later degraded evidence. Capture the authoritative empty state now:

```bash
VITE_OUROBOROS_RUNTIME_URL=http://127.0.0.1:4273 \
VITE_OUROBOROS_OPERATOR_API_TOKEN=ouro-238-local-evidence \
OUROBOROS_OPERATOR_API_TOKEN=ouro-238-local-evidence \
OUROBOROS_DESKTOP_RUNTIME_HOST=127.0.0.1 \
OUROBOROS_DESKTOP_RUNTIME_PORT=4273 \
OUROBOROS_RUNTIME_BIN=/usr/bin/false \
npm run dev:operator-desktop
```

```bash
VITE_OUROBOROS_RUNTIME_URL=http://127.0.0.1:4273 \
VITE_OUROBOROS_OPERATOR_API_TOKEN=ouro-238-local-evidence \
npm run dev -w @ouroboros/operator-web -- --host 127.0.0.1 --port 5273 --strictPort
```

From the coordinating PTY, bounded-poll the Web listener and retain its exact PID for every later Web capture:

```bash
for attempt in {1..40}; do
  lsof -nP -t -iTCP:5273 -sTCP:LISTEN | sort -u \
    >"$OURO_RUN_ROOT/evidence/web-listener-pids.txt"
  [ "$(wc -l <"$OURO_RUN_ROOT/evidence/web-listener-pids.txt" | tr -d ' ')" -eq 1 ] && break
  sleep 0.25
done
test "$(wc -l <"$OURO_RUN_ROOT/evidence/web-listener-pids.txt" | tr -d ' ')" -eq 1
export OURO_WEB_PID="$(head -n1 "$OURO_RUN_ROOT/evidence/web-listener-pids.txt")"
kill -0 "$OURO_WEB_PID"
ps -p "$OURO_WEB_PID" -o command= >"$OURO_RUN_ROOT/evidence/web-listener-command.txt"
grep -F -- '--port 5273' "$OURO_RUN_ROOT/evidence/web-listener-command.txt"
grep -F -- '--strictPort' "$OURO_RUN_ROOT/evidence/web-listener-command.txt"
```

Do not globally export `PORT=5273`; Desktop also interprets generic `PORT`. Verify the native process plus `/health`, then capture empty Web at a true 390x844 viewport using the assertions below. Keep both UI processes for the populated and transport-degraded states.

- [ ] Submit one bounded `arena.tick` in a second PTY. While it runs, poll `/api/operator` once per second and require exact `queued`, `allocating`, or `running` rows. A queued row has no commitment or provider yet; require `codex_cli` only after a row becomes commitment-backed `running` or terminal. The third default selection should be observable as queued while two work items execute. Save the timeline and final response. One tick normally owns three sessions, and its nondeterministic terminal result may be admission, duplicate, quarantine, no-submission, or failed-closed:

```bash
./bin/ouroboros arena tick --json >"$OURO_RUN_ROOT/evidence/arena-tick.json" &
export OURO_TICK_REQUEST_PID=$!
while kill -0 "$OURO_TICK_REQUEST_PID" 2>/dev/null; do
  curl -fsS --connect-timeout 2 --max-time 15 \
    -H 'x-ouroboros-operator-token: ouro-238-local-evidence' \
    http://127.0.0.1:4273/api/operator \
  | jq -c '{observed_at:(now|todateiso8601),capacity:.operator.research_operations.capacity,sessions:(.operator.research_operations.sessions|map({research_work_item_id,status,provider,provider_availability,commitment_id,last_progress_at}))}' \
  >>"$OURO_RUN_ROOT/evidence/research-timeline.jsonl"
  sleep 1
done
wait "$OURO_TICK_REQUEST_PID"
curl -fsS -H 'x-ouroboros-operator-token: ouro-238-local-evidence' \
  http://127.0.0.1:4273/api/operator \
  >"$OURO_RUN_ROOT/evidence/operator-final.json"
jq -e '[.operator.research_operations.sessions[] | select(.provider == "codex_cli" and (.commitment_id | type) == "string")] | length > 0' \
  "$OURO_RUN_ROOT/evidence/operator-final.json"
```

- [ ] Extract a returned `research_work_item_id`, URI-encode it deterministically, and read exact detail:

```bash
export OURO_RESEARCH_ID="$(jq -er '.operator.research_operations.latest_session_id' "$OURO_RUN_ROOT/evidence/operator-final.json")"
export OURO_RESEARCH_ID_URI="$(jq -rn --arg value "$OURO_RESEARCH_ID" '$value|@uri')"
curl -fsS -H 'x-ouroboros-operator-token: ouro-238-local-evidence' \
  "http://127.0.0.1:4273/api/research/sessions/$OURO_RESEARCH_ID_URI" \
  >"$OURO_RUN_ROOT/evidence/research-detail.json"
jq -e --arg id "$OURO_RESEARCH_ID" '.research_session.research_work_item_id == $id' \
  "$OURO_RUN_ROOT/evidence/research-detail.json"
```

Verify trigger/methodology/provider/budget, checkpoint submission availability, selected artifact when present, terminal admission, controlled lifecycle events, degradation flags, and Arena handoff only when exact evidence exists. `/health.mode` is not provider evidence, and `fixture_seed` source provenance does not make a Codex provider session a fixture session.

- [ ] Produce failed-closed restart evidence in the isolated store: start another tick, record its request PID, and poll until an exact `running + codex_cli + commitment_id` row exists. Save that Operator response and the exact running session IDs before any signal. Resolve the single listener PID and cross-check it against the active persisted `runtime_supervisor` ownership record. Resolve provider process groups from active persisted `research_provider` ownership records whose `runtime_ref.id` matches the saved commitments; `pgrep -P` is insufficient because providers use detached process groups. Simulate process loss with `SIGKILL` only after these identity checks:

```bash
./bin/ouroboros arena tick --json >"$OURO_RUN_ROOT/evidence/arena-crash-tick.json" &
export OURO_CRASH_REQUEST_PID=$!
# Keep this as a standalone subshell: wrapping it in `if` or `!` suppresses
# Bash errexit within the validation body.
(
  set -euo pipefail
: >"$OURO_RUN_ROOT/evidence/operator-before-crash.json"
for attempt in {1..120}; do
  if ! kill -0 "$OURO_CRASH_REQUEST_PID" 2>/dev/null; then
    wait "$OURO_CRASH_REQUEST_PID" 2>/dev/null || true
    printf 'second arena tick exited before a commitment-backed Codex session was running\n' >&2
    exit 1
  fi
  if curl -fsS --connect-timeout 2 --max-time 5 \
      -H 'x-ouroboros-operator-token: ouro-238-local-evidence' \
      http://127.0.0.1:4273/api/operator \
      >"$OURO_RUN_ROOT/evidence/operator-before-crash.poll.json" \
    && jq -e 'any(.operator.research_operations.sessions[]; .status == "running" and .provider == "codex_cli" and (.commitment_id | type) == "string")' \
      "$OURO_RUN_ROOT/evidence/operator-before-crash.poll.json" >/dev/null; then
    mv "$OURO_RUN_ROOT/evidence/operator-before-crash.poll.json" \
      "$OURO_RUN_ROOT/evidence/operator-before-crash.json"
    break
  fi
  sleep 1
done
test -s "$OURO_RUN_ROOT/evidence/operator-before-crash.json"
kill -0 "$OURO_CRASH_REQUEST_PID"
jq -e 'any(.operator.research_operations.sessions[]; .status == "running" and .provider == "codex_cli" and (.commitment_id | type) == "string")' \
  "$OURO_RUN_ROOT/evidence/operator-before-crash.json" >/dev/null

jq '[.operator.research_operations.sessions[] | select(.status == "running" and .provider == "codex_cli" and (.commitment_id | type) == "string") | {research_work_item_id,commitment_id}] | sort_by(.commitment_id)' \
  "$OURO_RUN_ROOT/evidence/operator-before-crash.json" \
  >"$OURO_RUN_ROOT/evidence/interrupted-running-sessions.json"
jq -e '. as $rows
  | (($rows | length) > 0)
    and (($rows | map(.research_work_item_id) | unique | length) == ($rows | length))
    and (($rows | map(.commitment_id) | unique | length) == ($rows | length))' \
  "$OURO_RUN_ROOT/evidence/interrupted-running-sessions.json" >/dev/null
jq -r '.[].research_work_item_id' \
  "$OURO_RUN_ROOT/evidence/interrupted-running-sessions.json" \
  >"$OURO_RUN_ROOT/evidence/interrupted-running-session-ids.txt"
jq -r '.[].commitment_id' \
  "$OURO_RUN_ROOT/evidence/interrupted-running-sessions.json" \
  >"$OURO_RUN_ROOT/evidence/interrupted-running-commitment-ids.txt"
jq '[.[].commitment_id]' \
  "$OURO_RUN_ROOT/evidence/interrupted-running-sessions.json" \
  >"$OURO_RUN_ROOT/evidence/interrupted-running-commitment-ids.json"

lsof -nP -t -iTCP:4273 -sTCP:LISTEN | sort -u >"$OURO_RUN_ROOT/evidence/runtime-listener-pids.txt"
test "$(wc -l <"$OURO_RUN_ROOT/evidence/runtime-listener-pids.txt" | tr -d ' ')" -eq 1
export OURO_RUNTIME_PID="$(head -n1 "$OURO_RUN_ROOT/evidence/runtime-listener-pids.txt")"

export OURO_OWNERSHIP_ACTIVE_DIR="$OUROBOROS_STORE_ROOT/runtime-process-ownership/active"
sanitize_legacy_ownership_copy() {
  local legacy_source="$1"
  local safe_output="$2"
  [ -f "$legacy_source" ] || return 0
  jq -c '{
    record_kind,version,runtime_process_ownership_id,process_kind,
    subject_ref:{record_kind:.subject_ref.record_kind,id:.subject_ref.id},
    runtime_ref:{record_kind:.runtime_ref.record_kind,id:.runtime_ref.id},
    owner:{
      host_id:.owner.host_id,
      process_id:.owner.process_id,
      process_start_marker:.owner.process_start_marker
    },
    executable,profile_digest,ownership_status,adoption_count,started_at,ownership_digest
  }
  + (if has("last_adopted_at") then {last_adopted_at} else {} end)
  + (if has("closed_at") then {closed_at} else {} end)
  + (if has("terminal_reason") then {terminal_reason} else {} end)' \
    "$legacy_source" >"$safe_output.pending"
  jq -e '[paths | select(.[-1] == "session_token")] | length == 0' \
    "$safe_output.pending" >/dev/null
  mv "$safe_output.pending" "$safe_output"
  rm -- "$legacy_source"
}

# Previous drafts copied complete ownership records into evidence. Convert only
# these exact legacy files to allowlisted witnesses, then remove the secret-
# bearing originals before this run root may be retained, attached, or shared.
sanitize_legacy_ownership_copy \
  "$OURO_RUN_ROOT/evidence/runtime-ownership-before-crash.jsonl" \
  "$OURO_RUN_ROOT/evidence/legacy-runtime-ownership-before-crash.witness.jsonl"
sanitize_legacy_ownership_copy \
  "$OURO_RUN_ROOT/evidence/provider-ownership-before-crash.jsonl" \
  "$OURO_RUN_ROOT/evidence/legacy-provider-ownership-before-crash.witness.jsonl"
sanitize_legacy_ownership_copy \
  "$OURO_RUN_ROOT/evidence/restart-recovery-provider-ownership-claimed.json" \
  "$OURO_RUN_ROOT/evidence/restart-recovery-provider-ownership-claimed.witness.jsonl"
sanitize_legacy_ownership_copy \
  "$OURO_RUN_ROOT/evidence/restart-recovery-provider-ownership-owner-absent.json" \
  "$OURO_RUN_ROOT/evidence/restart-recovery-provider-ownership-owner-absent.witness.jsonl"
sanitize_legacy_ownership_copy \
  "$OURO_RUN_ROOT/evidence/degraded-runtime-ownership.jsonl" \
  "$OURO_RUN_ROOT/evidence/degraded-runtime-ownership.witness.jsonl"

capture_ownership_signal_witnesses() {
  node --import tsx --input-type=module -e '
    import { execFileSync } from "node:child_process";
    import { readFile, readdir, writeFile } from "node:fs/promises";
    import path from "node:path";
    import { runtimeProcessOwnershipHasRuntimeShape } from "@ouroboros/domain";

    const [activeDirectory, commitmentsPath, runtimeOutput, providerOutput] =
      process.argv.slice(1);
    const exactRecordSha256 = (raw) => {
      const output = execFileSync("/usr/bin/shasum", ["-a", "256"], {
        input: raw,
        encoding: "utf8",
        timeout: 1_000,
        maxBuffer: 16_384
      }).trim();
      const digest = output.split(/\s+/)[0];
      if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("exact ownership hash unavailable");
      return `sha256:${digest}`;
    };
    const lineageWitness = (record) => ({
      record_kind: record.record_kind,
      version: record.version,
      runtime_process_ownership_id: record.runtime_process_ownership_id,
      process_kind: record.process_kind,
      subject_ref: record.subject_ref,
      runtime_ref: record.runtime_ref,
      owner: record.owner,
      executable: record.executable,
      profile_digest: record.profile_digest,
      ownership_status: record.ownership_status,
      adoption_count: record.adoption_count,
      started_at: record.started_at,
      ...(record.last_adopted_at === undefined
        ? {} : { last_adopted_at: record.last_adopted_at }),
      ownership_digest: record.ownership_digest
    });

    (async () => {
      const commitments = JSON.parse(await readFile(commitmentsPath, "utf8"));
      if (!Array.isArray(commitments) || commitments.length === 0 ||
        commitments.some((value) => typeof value !== "string" || !value)) {
        throw new Error("invalid interrupted commitment witness set");
      }
      const commitmentSet = new Set(commitments);
      const targets = [];
      for (const entry of await readdir(activeDirectory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const activeRecordPath = path.join(activeDirectory, entry.name);
        const raw = await readFile(activeRecordPath, "utf8");
        const record = JSON.parse(raw);
        if (!runtimeProcessOwnershipHasRuntimeShape(record)) {
          throw new Error(`active ownership metadata invalid: ${activeRecordPath}`);
        }
        if (record.ownership_status !== "active") continue;
        targets.push({
          active_record_path: activeRecordPath,
          exact_record_sha256: exactRecordSha256(raw),
          lineage: lineageWitness(record)
        });
      }
      const runtime = targets
        .filter((target) => target.lineage.process_kind === "runtime_supervisor")
        .sort((left, right) => left.lineage.runtime_process_ownership_id.localeCompare(
          right.lineage.runtime_process_ownership_id
        ));
      const providers = targets
        .filter((target) => target.lineage.process_kind === "research_provider" &&
          target.lineage.runtime_ref?.record_kind === "research_preflight_commitment" &&
          commitmentSet.has(target.lineage.runtime_ref.id))
        .sort((left, right) => left.lineage.runtime_ref.id.localeCompare(
          right.lineage.runtime_ref.id
        ));
      await writeFile(runtimeOutput, `${JSON.stringify(runtime, null, 2)}\n`, { mode: 0o600 });
      await writeFile(providerOutput, `${JSON.stringify(providers, null, 2)}\n`, { mode: 0o600 });
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  ' "$1" "$2" "$3" "$4"
}

# Persist only an allowlisted ownership witness. The exact-record hash covers
# every byte of the active record, including the in-memory-only session token,
# but the token and full RuntimeProcessOwnershipRecord are never written to the
# evidence directory or emitted to stdout/stderr.
capture_ownership_signal_witnesses \
  "$OURO_OWNERSHIP_ACTIVE_DIR" \
  "$OURO_RUN_ROOT/evidence/interrupted-running-commitment-ids.json" \
  "$OURO_RUN_ROOT/evidence/runtime-signal-targets.json" \
  "$OURO_RUN_ROOT/evidence/provider-signal-targets.json"
jq -c '.[].lineage' "$OURO_RUN_ROOT/evidence/runtime-signal-targets.json" \
  >"$OURO_RUN_ROOT/evidence/runtime-ownership-witness-before-crash.jsonl"
jq -c '.[].lineage' "$OURO_RUN_ROOT/evidence/provider-signal-targets.json" \
  >"$OURO_RUN_ROOT/evidence/provider-ownership-witness-before-crash.jsonl"
for ownership_witness in \
  "$OURO_RUN_ROOT/evidence/runtime-signal-targets.json" \
  "$OURO_RUN_ROOT/evidence/provider-signal-targets.json" \
  "$OURO_RUN_ROOT/evidence/runtime-ownership-witness-before-crash.jsonl" \
  "$OURO_RUN_ROOT/evidence/provider-ownership-witness-before-crash.jsonl"; do
  jq -e '[paths | select(.[-1] == "session_token")] | length == 0' \
    "$ownership_witness" >/dev/null
done

jq -e --argjson pid "$OURO_RUNTIME_PID" '
  (length == 1)
  and (.[0].active_record_path | type == "string" and length > 0)
  and (.[0].exact_record_sha256 | test("^sha256:[a-f0-9]{64}$"))
  and (.[0].lineage.owner.process_id == $pid)
  and (.[0].lineage.owner.process_start_marker | type == "string" and length > 0)' \
  "$OURO_RUN_ROOT/evidence/runtime-signal-targets.json" >/dev/null
jq -e --slurpfile commitments "$OURO_RUN_ROOT/evidence/interrupted-running-commitment-ids.json" '
  . as $targets
  | $commitments[0] as $commitments
  | (($commitments | length) > 0)
    and (($commitments | unique | length) == ($commitments | length))
    and (($targets | length) == ($commitments | length))
    and ($targets | all(.[];
      (.active_record_path | type == "string" and length > 0)
      and (.exact_record_sha256 | test("^sha256:[a-f0-9]{64}$"))
      and .lineage.process_kind == "research_provider"
      and .lineage.ownership_status == "active"
      and .lineage.runtime_ref.record_kind == "research_preflight_commitment"
      and (.lineage.owner.process_id | type == "number" and . > 0)
      and (.lineage.owner.process_start_marker | type == "string" and length > 0)))
    and (($targets | map(.lineage.runtime_ref.id) | sort) == ($commitments | sort))
    and (($targets | map(.lineage.runtime_ref.id) | unique | length) == ($targets | length))
    and (($targets | map(.lineage.owner.process_id) | unique | length) == ($targets | length))
    and (($targets | map(.lineage.runtime_process_ownership_id) | unique | length) == ($targets | length))' \
  "$OURO_RUN_ROOT/evidence/provider-signal-targets.json" >/dev/null
jq -r '.[].lineage.owner.process_id' \
  "$OURO_RUN_ROOT/evidence/provider-signal-targets.json" \
  >"$OURO_RUN_ROOT/evidence/provider-process-groups.txt"
export OURO_PROVIDER_OWNER_COUNT="$(jq 'length' "$OURO_RUN_ROOT/evidence/provider-signal-targets.json")"
test "$OURO_PROVIDER_OWNER_COUNT" -eq "$(jq 'length' "$OURO_RUN_ROOT/evidence/interrupted-running-commitment-ids.json")"
test "$(sort -nu "$OURO_RUN_ROOT/evidence/provider-process-groups.txt" | wc -l | tr -d ' ')" -eq "$OURO_PROVIDER_OWNER_COUNT"

# This helper owns the complete per-target check-and-signal critical section. It
# resolves the canonical scope path, reloads the exact record through the
# authoritative ownership store (including history), compares the complete
# snapshotted lineage, and rechecks live process identity plus listener/PGID
# immediately before calling process.kill. No cached runtime PID
# or provider PGID receives a destructive signal outside this body. Audit mode
# uses the same validation path but appends only a would-signal record, so guard
# regressions remain non-destructive.
signal_exact_active_owner() {
  node --import tsx --input-type=module -e '
    import { createHash } from "node:crypto";
    import { execFileSync } from "node:child_process";
    import { appendFile, readFile } from "node:fs/promises";
    import { hostname } from "node:os";
    import path from "node:path";
    import { isDeepStrictEqual } from "node:util";
    import { runtimeProcessOwnershipHasRuntimeShape } from "@ouroboros/domain";
    import { FileSystemRuntimeProcessOwnershipStore } from "@ouroboros/local-store";
    import { processStartMarker } from "./packages/local-store/src/process-start-marker.ts";

    const manifestPath = process.argv[1];
    const expectedOwnershipId = process.argv[2];
    const expectedKind = process.argv[3];
    const ownershipRoot = process.argv[4];
    const signalMode = process.env.OURO_OWNERSHIP_SIGNAL_MODE ?? "signal";
    const auditPath = process.env.OURO_OWNERSHIP_SIGNAL_AUDIT_PATH;

    const fail = (message) => {
      throw new Error(`ownership signal guard: ${message}`);
    };
    const exactRecordSha256 = (raw) =>
      `sha256:${createHash("sha256").update(raw).digest("hex")}`;
    const lineageWitness = (record) => ({
      record_kind: record.record_kind,
      version: record.version,
      runtime_process_ownership_id: record.runtime_process_ownership_id,
      process_kind: record.process_kind,
      subject_ref: record.subject_ref,
      runtime_ref: record.runtime_ref,
      owner: record.owner,
      executable: record.executable,
      profile_digest: record.profile_digest,
      ownership_status: record.ownership_status,
      adoption_count: record.adoption_count,
      started_at: record.started_at,
      ...(record.last_adopted_at === undefined
        ? {} : { last_adopted_at: record.last_adopted_at }),
      ownership_digest: record.ownership_digest
    });
    const processGroupId = (pid) => {
      let output;
      try {
        output = execFileSync("/bin/ps", ["-o", "pgid=", "-p", String(pid)], {
          encoding: "utf8",
          timeout: 1_000,
          maxBuffer: 16_384
        }).trim();
      } catch {
        fail(`provider owner ${pid} exited before signal`);
      }
      const pgid = Number(output);
      if (!Number.isSafeInteger(pgid) || pgid <= 0 || pgid !== pid) {
        fail(`provider PGID leader drift for ${pid}: received ${output || "unavailable"}`);
      }
      return pgid;
    };
    const assertRuntimeListener = (pid) => {
      let output;
      try {
        output = execFileSync(
          "/usr/sbin/lsof",
          ["-nP", "-t", "-iTCP:4273", "-sTCP:LISTEN"],
          { encoding: "utf8", timeout: 1_000, maxBuffer: 16_384 }
        );
      } catch {
        fail("runtime listener exited before signal");
      }
      const listeners = [...new Set(output.trim().split(/\s+/).filter(Boolean).map(Number))];
      if (listeners.length !== 1 || listeners[0] !== pid) {
        fail(`runtime listener ownership drift: expected ${pid}, received ${listeners.join(",") || "unavailable"}`);
      }
    };

    (async () => {
      if (!manifestPath || !expectedOwnershipId ||
        (expectedKind !== "runtime_supervisor" && expectedKind !== "research_provider") ||
        !ownershipRoot || !path.isAbsolute(ownershipRoot) ||
        (signalMode !== "signal" && signalMode !== "audit") ||
        (signalMode === "audit" && !auditPath)) {
        fail("invalid invocation");
      }

      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      const targets = Array.isArray(manifest)
        ? manifest.filter((candidate) =>
          candidate?.lineage?.runtime_process_ownership_id === expectedOwnershipId &&
          candidate?.lineage?.process_kind === expectedKind)
        : [];
      if (targets.length !== 1) {
        fail(`expected exactly one snapshotted ${expectedKind} lineage ${expectedOwnershipId}`);
      }
      const target = targets[0];
      const expected = target.lineage;
      if (expected.ownership_status !== "active" ||
        typeof target.active_record_path !== "string" || !target.active_record_path ||
        typeof target.exact_record_sha256 !== "string" ||
        !/^sha256:[a-f0-9]{64}$/.test(target.exact_record_sha256) ||
        typeof expected.ownership_digest !== "string" || !expected.ownership_digest ||
        expected.owner?.host_id !== hostname() ||
        !Number.isSafeInteger(expected.owner?.process_id) || expected.owner.process_id <= 0 ||
        typeof expected.owner?.process_start_marker !== "string" ||
        !expected.owner.process_start_marker) {
        fail(`invalid snapshotted ${expectedKind} lineage ${expectedOwnershipId}`);
      }
      if (expectedKind === "runtime_supervisor" && expected.runtime_ref.record_kind !== "local_store") {
        fail("runtime supervisor lineage is not bound to the isolated LocalStore");
      }
      if (expectedKind === "research_provider" &&
        expected.runtime_ref.record_kind !== "research_preflight_commitment") {
        fail("provider lineage is not bound to a ResearchPreflightCommitment");
      }

      const scopeKey = createHash("sha256").update([
        expectedKind,
        expected.subject_ref?.record_kind,
        expected.subject_ref?.id
      ].join(":")).digest("hex");
      const canonicalActivePath = path.join(ownershipRoot, "active", `${scopeKey}.json`);
      if (path.resolve(target.active_record_path) !== path.resolve(canonicalActivePath)) {
        fail(`snapshotted ${expectedKind} lineage is not at its canonical ownership path`);
      }
      const ownershipStore = new FileSystemRuntimeProcessOwnershipStore(ownershipRoot);
      const assertExactCanonicalOwnership = async () => {
        let raw;
        let record;
        try {
          raw = await readFile(canonicalActivePath, "utf8");
          record = JSON.parse(raw);
        } catch {
          fail("canonical active ownership record became unreadable");
        }
        if (!runtimeProcessOwnershipHasRuntimeShape(record) ||
          record.ownership_status !== "active") {
          fail("canonical active ownership metadata is invalid");
        }
        if (record.runtime_process_ownership_id !== expectedOwnershipId ||
          record.process_kind !== expectedKind ||
          exactRecordSha256(raw) !== target.exact_record_sha256 ||
          !isDeepStrictEqual(lineageWitness(record), expected)) {
          fail(`active ownership lineage ${expectedOwnershipId} changed before signal`);
        }
        let inspection;
        try {
          inspection = await ownershipStore.inspect({
            process_kind: record.process_kind,
            subject_ref: { ...record.subject_ref },
            runtime_ref: { ...record.runtime_ref },
            host_id: record.owner.host_id,
            executable: record.executable,
            profile_digest: record.profile_digest
          });
        } catch {
          fail("canonical ownership inspection failed");
        }
        if (inspection.status !== "owned") {
          fail(`canonical ownership is not currently owned (${inspection.status})`);
        }
        if (!isDeepStrictEqual(inspection.ownership, record)) {
          fail(`canonical ownership lineage ${expectedOwnershipId} changed during inspection`);
        }
        return record;
      };

      const pid = expected.owner.process_id;
      const assertLiveSignalTarget = async () => {
        try {
          process.kill(pid, 0);
        } catch {
          fail(`owned process ${pid} exited before signal`);
        }
        const marker = await processStartMarker(pid);
        if (marker !== expected.owner.process_start_marker) {
          fail(`process start marker changed for ${pid}: expected ${expected.owner.process_start_marker}, received ${marker ?? "unavailable"}`);
        }
        if (expectedKind === "runtime_supervisor") {
          assertRuntimeListener(pid);
          return pid;
        }
        const pgid = processGroupId(pid);
        try {
          process.kill(-pgid, 0);
        } catch {
          fail(`provider process group ${pgid} exited before signal`);
        }
        return -pgid;
      };

      // Revalidate twice through the canonical store. The final sequence is an
      // exact owned-state inspection followed immediately by OS identity and
      // the sole audit/signal sink.
      await assertExactCanonicalOwnership();
      await assertLiveSignalTarget();
      await assertExactCanonicalOwnership();
      const signalTarget = await assertLiveSignalTarget();
      const result = {
        signal_mode: signalMode,
        process_kind: expectedKind,
        runtime_process_ownership_id: expectedOwnershipId,
        runtime_ref: expected.runtime_ref,
        process_id: pid,
        signal_target: signalTarget
      };
      if (signalMode === "audit") {
        await appendFile(auditPath, `${JSON.stringify(result)}\n`);
      } else {
        process.kill(signalTarget, "SIGKILL");
      }
      console.log(JSON.stringify(result));
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  ' "$1" "$2" "$3" "$4"
}

# Non-destructive regression for the exact helper: all initial records come
# from FileSystemRuntimeProcessOwnershipStore.claim(), and audit mode writes
# only if the real signal line would be reached. Probe-only records (including
# their session tokens) live outside evidence and are removed before the
# token-free result report is retained.
export OURO_SIGNAL_PROBE_ROOT="$(mktemp -d /private/tmp/ouro-238-ownership-signal-guard.XXXXXX)"
export OURO_SIGNAL_PROBE_OWNERSHIP_ROOT="$OURO_SIGNAL_PROBE_ROOT/runtime-process-ownership"
OURO_SIGNAL_PROBE_PIDS=()
cleanup_signal_probes() {
  for probe_pid in "${OURO_SIGNAL_PROBE_PIDS[@]}"; do
    kill "$probe_pid" 2>/dev/null || true
    wait "$probe_pid" 2>/dev/null || true
  done
  case "$OURO_SIGNAL_PROBE_ROOT" in
    /private/tmp/ouro-238-ownership-signal-guard.*)
      rm -rf -- "$OURO_SIGNAL_PROBE_ROOT"
      ;;
    *)
      printf 'refusing unexpected signal-probe cleanup root: %s\n' \
        "$OURO_SIGNAL_PROBE_ROOT" >&2
      return 1
      ;;
  esac
}
trap cleanup_signal_probes EXIT

claim_signal_probe_owner() {
  node --import tsx --input-type=module -e '
    import { createHash, randomUUID } from "node:crypto";
    import { readFile, writeFile } from "node:fs/promises";
    import path from "node:path";
    import { hostname } from "node:os";
    import { FileSystemRuntimeProcessOwnershipStore } from "@ouroboros/local-store";

    const [
      ownershipRoot, processKind, subjectId, runtimeRecordKind, runtimeId,
      pidText, manifestPath
    ] = process.argv.slice(1);
    const profileDigest = "sha256:" + createHash("sha256")
      .update(["probe", processKind, subjectId].join(":")).digest("hex");
    const expected = {
      process_kind: processKind,
      subject_ref: { record_kind: processKind, id: subjectId },
      runtime_ref: { record_kind: runtimeRecordKind, id: runtimeId },
      host_id: hostname(),
      executable: "/bin/sleep",
      profile_digest: profileDigest
    };
    const lineageWitness = (record) => ({
      record_kind: record.record_kind,
      version: record.version,
      runtime_process_ownership_id: record.runtime_process_ownership_id,
      process_kind: record.process_kind,
      subject_ref: record.subject_ref,
      runtime_ref: record.runtime_ref,
      owner: record.owner,
      executable: record.executable,
      profile_digest: record.profile_digest,
      ownership_status: record.ownership_status,
      adoption_count: record.adoption_count,
      started_at: record.started_at,
      ...(record.last_adopted_at === undefined
        ? {} : { last_adopted_at: record.last_adopted_at }),
      ownership_digest: record.ownership_digest
    });

    const store = new FileSystemRuntimeProcessOwnershipStore(ownershipRoot);
    const record = await store.claim({
      expected,
      processId: Number(pidText),
      sessionToken: randomUUID(),
      startedAt: new Date().toISOString()
    });
    const key = createHash("sha256").update([
      record.process_kind,
      record.subject_ref.record_kind,
      record.subject_ref.id
    ].join(":")).digest("hex");
    const activeRecordPath = path.join(ownershipRoot, "active", key + ".json");
    const raw = await readFile(activeRecordPath, "utf8");
    await writeFile(manifestPath, JSON.stringify([{
      active_record_path: activeRecordPath,
      exact_record_sha256: "sha256:" + createHash("sha256").update(raw).digest("hex"),
      lineage: lineageWitness(record)
    }], null, 2) + "\n", { mode: 0o600 });
    console.log(record.runtime_process_ownership_id);
  ' "$1" "$2" "$3" "$4" "$5" "$6" "$7"
}

snapshot_signal_probe_record() {
  node --import tsx --input-type=module -e '
    import { createHash } from "node:crypto";
    import { readFile, writeFile } from "node:fs/promises";
    const [activeRecordPath, manifestPath] = process.argv.slice(1);
    const raw = await readFile(activeRecordPath, "utf8");
    const record = JSON.parse(raw);
    const lineage = {
      record_kind: record.record_kind,
      version: record.version,
      runtime_process_ownership_id: record.runtime_process_ownership_id,
      process_kind: record.process_kind,
      subject_ref: record.subject_ref,
      runtime_ref: record.runtime_ref,
      owner: record.owner,
      executable: record.executable,
      profile_digest: record.profile_digest,
      ownership_status: record.ownership_status,
      adoption_count: record.adoption_count,
      started_at: record.started_at,
      ...(record.last_adopted_at === undefined
        ? {} : { last_adopted_at: record.last_adopted_at }),
      ownership_digest: record.ownership_digest
    };
    await writeFile(manifestPath, JSON.stringify([{
      active_record_path: activeRecordPath,
      exact_record_sha256: "sha256:" + createHash("sha256").update(raw).digest("hex"),
      lineage
    }], null, 2) + "\n", { mode: 0o600 });
  ' "$1" "$2"
}

replace_signal_probe_record() {
  node --import tsx --input-type=module -e '
    import { randomUUID } from "node:crypto";
    import { readFile, writeFile } from "node:fs/promises";
    import { createRuntimeProcessOwnership } from "@ouroboros/domain";
    const activeRecordPath = process.argv[1];
    const before = JSON.parse(await readFile(activeRecordPath, "utf8"));
    const after = createRuntimeProcessOwnership({
      processKind: before.process_kind,
      subjectRef: before.subject_ref,
      runtimeRef: before.runtime_ref,
      owner: before.owner,
      executable: before.executable,
      profileDigest: before.profile_digest,
      sessionToken: randomUUID(),
      startedAt: new Date().toISOString()
    });
    await writeFile(activeRecordPath, JSON.stringify(after) + "\n", { mode: 0o600 });
  ' "$1"
}

add_signal_probe_history_conflict() {
  node --import tsx --input-type=module -e '
    import { createHash, randomUUID } from "node:crypto";
    import { readFile, writeFile } from "node:fs/promises";
    import path from "node:path";
    import { createRuntimeProcessOwnership } from "@ouroboros/domain";
    const [ownershipRoot, activeRecordPath] = process.argv.slice(1);
    const before = JSON.parse(await readFile(activeRecordPath, "utf8"));
    const conflict = createRuntimeProcessOwnership({
      processKind: before.process_kind,
      subjectRef: before.subject_ref,
      runtimeRef: before.runtime_ref,
      owner: before.owner,
      executable: before.executable,
      profileDigest: before.profile_digest,
      sessionToken: randomUUID(),
      startedAt: new Date().toISOString()
    });
    const key = createHash("sha256").update([
      before.process_kind,
      before.subject_ref.record_kind,
      before.subject_ref.id
    ].join(":")).digest("hex");
    await writeFile(
      path.join(ownershipRoot, "history", key, "zz-conflicting-open-record.json"),
      JSON.stringify(conflict) + "\n",
      { mode: 0o600 }
    );
  ' "$1" "$2"
}

assert_signal_guard_blocked() {
  local label="$1"
  local manifest_path="$2"
  local ownership_id="$3"
  local process_kind="$4"
  local expected_error="$5"
  local audit_path="$OURO_SIGNAL_PROBE_ROOT/$label-audit.jsonl"
  local error_path="$OURO_SIGNAL_PROBE_ROOT/$label-error.txt"
  : >"$audit_path"
  if OURO_OWNERSHIP_SIGNAL_MODE=audit \
      OURO_OWNERSHIP_SIGNAL_AUDIT_PATH="$audit_path" \
      signal_exact_active_owner \
        "$manifest_path" \
        "$ownership_id" \
        "$process_kind" \
        "$OURO_SIGNAL_PROBE_OWNERSHIP_ROOT" \
        2>"$error_path"; then
    printf '%s guard probe unexpectedly reached the signal sink\n' "$label" >&2
    exit 1
  fi
  if ! grep -F "$expected_error" "$error_path" >/dev/null; then
    sed -n '1,5p' "$error_path" >&2
    return 1
  fi
  test ! -s "$audit_path"
}
sleep 2 &
OURO_EXITED_PROBE_PID=$!
OURO_SIGNAL_PROBE_PIDS+=("$OURO_EXITED_PROBE_PID")
OURO_EXITED_PROBE_MANIFEST="$OURO_SIGNAL_PROBE_ROOT/owner-exit-manifest.json"
OURO_EXITED_PROBE_OWNERSHIP_ID="$(claim_signal_probe_owner \
  "$OURO_SIGNAL_PROBE_OWNERSHIP_ROOT" \
  runtime_supervisor \
  runtime-supervisor-owner-exit-probe \
  local_store \
  local-store-owner-exit-probe \
  "$OURO_EXITED_PROBE_PID" \
  "$OURO_EXITED_PROBE_MANIFEST")"
wait "$OURO_EXITED_PROBE_PID"
assert_signal_guard_blocked \
  owner-exit \
  "$OURO_EXITED_PROBE_MANIFEST" \
  "$OURO_EXITED_PROBE_OWNERSHIP_ID" \
  runtime_supervisor \
  'canonical ownership is not currently owned'

sleep 30 &
OURO_SWAPPED_PROBE_PID=$!
OURO_SIGNAL_PROBE_PIDS+=("$OURO_SWAPPED_PROBE_PID")
OURO_SWAPPED_PROBE_MANIFEST="$OURO_SIGNAL_PROBE_ROOT/record-swap-manifest.json"
OURO_SWAPPED_PROBE_OWNERSHIP_ID="$(claim_signal_probe_owner \
  "$OURO_SIGNAL_PROBE_OWNERSHIP_ROOT" \
  runtime_supervisor \
  runtime-supervisor-record-swap-probe \
  local_store \
  local-store-record-swap-probe \
  "$OURO_SWAPPED_PROBE_PID" \
  "$OURO_SWAPPED_PROBE_MANIFEST")"
OURO_SWAPPED_PROBE_ACTIVE="$(jq -er '.[0].active_record_path' \
  "$OURO_SWAPPED_PROBE_MANIFEST")"
replace_signal_probe_record "$OURO_SWAPPED_PROBE_ACTIVE"
assert_signal_guard_blocked \
  record-swap \
  "$OURO_SWAPPED_PROBE_MANIFEST" \
  "$OURO_SWAPPED_PROBE_OWNERSHIP_ID" \
  runtime_supervisor \
  'changed before signal'
kill "$OURO_SWAPPED_PROBE_PID"
wait "$OURO_SWAPPED_PROBE_PID" 2>/dev/null || true

sleep 30 &
OURO_MALFORMED_PROBE_PID=$!
OURO_SIGNAL_PROBE_PIDS+=("$OURO_MALFORMED_PROBE_PID")
OURO_MALFORMED_PROBE_MANIFEST="$OURO_SIGNAL_PROBE_ROOT/malformed-manifest.json"
OURO_MALFORMED_PROBE_OWNERSHIP_ID="$(claim_signal_probe_owner \
  "$OURO_SIGNAL_PROBE_OWNERSHIP_ROOT" \
  runtime_supervisor \
  runtime-supervisor-malformed-probe \
  local_store \
  local-store-malformed-probe \
  "$OURO_MALFORMED_PROBE_PID" \
  "$OURO_MALFORMED_PROBE_MANIFEST")"
OURO_MALFORMED_PROBE_ACTIVE="$(jq -er '.[0].active_record_path' \
  "$OURO_MALFORMED_PROBE_MANIFEST")"
jq '.evaluation_authority = true' "$OURO_MALFORMED_PROBE_ACTIVE" \
  >"$OURO_MALFORMED_PROBE_ACTIVE.changed"
mv "$OURO_MALFORMED_PROBE_ACTIVE.changed" "$OURO_MALFORMED_PROBE_ACTIVE"
snapshot_signal_probe_record \
  "$OURO_MALFORMED_PROBE_ACTIVE" \
  "$OURO_MALFORMED_PROBE_MANIFEST"
assert_signal_guard_blocked \
  stable-malformed \
  "$OURO_MALFORMED_PROBE_MANIFEST" \
  "$OURO_MALFORMED_PROBE_OWNERSHIP_ID" \
  runtime_supervisor \
  'canonical active ownership metadata is invalid'
kill "$OURO_MALFORMED_PROBE_PID"
wait "$OURO_MALFORMED_PROBE_PID" 2>/dev/null || true

sleep 30 &
OURO_PATH_PROBE_PID=$!
OURO_SIGNAL_PROBE_PIDS+=("$OURO_PATH_PROBE_PID")
OURO_PATH_PROBE_MANIFEST="$OURO_SIGNAL_PROBE_ROOT/canonical-path-manifest.json"
OURO_PATH_PROBE_OWNERSHIP_ID="$(claim_signal_probe_owner \
  "$OURO_SIGNAL_PROBE_OWNERSHIP_ROOT" \
  runtime_supervisor \
  runtime-supervisor-canonical-path-probe \
  local_store \
  local-store-canonical-path-probe \
  "$OURO_PATH_PROBE_PID" \
  "$OURO_PATH_PROBE_MANIFEST")"
OURO_PATH_PROBE_ACTIVE="$(jq -er '.[0].active_record_path' \
  "$OURO_PATH_PROBE_MANIFEST")"
OURO_PATH_PROBE_NONCANONICAL="$OURO_PATH_PROBE_ACTIVE.noncanonical"
mv "$OURO_PATH_PROBE_ACTIVE" "$OURO_PATH_PROBE_NONCANONICAL"
jq --arg active_record_path "$OURO_PATH_PROBE_NONCANONICAL" \
  '.[0].active_record_path = $active_record_path' \
  "$OURO_PATH_PROBE_MANIFEST" >"$OURO_PATH_PROBE_MANIFEST.changed"
mv "$OURO_PATH_PROBE_MANIFEST.changed" "$OURO_PATH_PROBE_MANIFEST"
assert_signal_guard_blocked \
  canonical-path \
  "$OURO_PATH_PROBE_MANIFEST" \
  "$OURO_PATH_PROBE_OWNERSHIP_ID" \
  runtime_supervisor \
  'not at its canonical ownership path'
kill "$OURO_PATH_PROBE_PID"
wait "$OURO_PATH_PROBE_PID" 2>/dev/null || true

sleep 30 &
OURO_HISTORY_PROBE_PID=$!
OURO_SIGNAL_PROBE_PIDS+=("$OURO_HISTORY_PROBE_PID")
OURO_HISTORY_PROBE_MANIFEST="$OURO_SIGNAL_PROBE_ROOT/history-conflict-manifest.json"
OURO_HISTORY_PROBE_OWNERSHIP_ID="$(claim_signal_probe_owner \
  "$OURO_SIGNAL_PROBE_OWNERSHIP_ROOT" \
  runtime_supervisor \
  runtime-supervisor-history-conflict-probe \
  local_store \
  local-store-history-conflict-probe \
  "$OURO_HISTORY_PROBE_PID" \
  "$OURO_HISTORY_PROBE_MANIFEST")"
OURO_HISTORY_PROBE_ACTIVE="$(jq -er '.[0].active_record_path' \
  "$OURO_HISTORY_PROBE_MANIFEST")"
add_signal_probe_history_conflict \
  "$OURO_SIGNAL_PROBE_OWNERSHIP_ROOT" \
  "$OURO_HISTORY_PROBE_ACTIVE"
assert_signal_guard_blocked \
  history-conflict \
  "$OURO_HISTORY_PROBE_MANIFEST" \
  "$OURO_HISTORY_PROBE_OWNERSHIP_ID" \
  runtime_supervisor \
  'canonical ownership'
kill "$OURO_HISTORY_PROBE_PID"
wait "$OURO_HISTORY_PROBE_PID" 2>/dev/null || true

OURO_PROVIDER_DRIFT_PID_FILE="$OURO_SIGNAL_PROBE_ROOT/provider-drift.pid"
/bin/sh -c '
  /bin/sleep 30 &
  child_pid=$!
  printf "%s\n" "$child_pid" >"$1"
  wait "$child_pid"
' signal-probe-wrapper "$OURO_PROVIDER_DRIFT_PID_FILE" \
  2>"$OURO_SIGNAL_PROBE_ROOT/provider-drift-wrapper-error.txt" &
OURO_PROVIDER_DRIFT_WRAPPER_PID=$!
OURO_SIGNAL_PROBE_PIDS+=("$OURO_PROVIDER_DRIFT_WRAPPER_PID")
for attempt in {1..40}; do
  test -s "$OURO_PROVIDER_DRIFT_PID_FILE" && break
  sleep 0.05
done
OURO_PROVIDER_DRIFT_PID="$(cat "$OURO_PROVIDER_DRIFT_PID_FILE")"
test "$OURO_PROVIDER_DRIFT_PID" -gt 0
OURO_SIGNAL_PROBE_PIDS+=("$OURO_PROVIDER_DRIFT_PID")
OURO_PROVIDER_DRIFT_PGID="$(ps -o pgid= -p "$OURO_PROVIDER_DRIFT_PID" | tr -d ' ')"
test "$OURO_PROVIDER_DRIFT_PGID" -gt 0
test "$OURO_PROVIDER_DRIFT_PGID" -ne "$OURO_PROVIDER_DRIFT_PID"
OURO_PROVIDER_DRIFT_MANIFEST="$OURO_SIGNAL_PROBE_ROOT/provider-pgid-drift-manifest.json"
OURO_PROVIDER_DRIFT_OWNERSHIP_ID="$(claim_signal_probe_owner \
  "$OURO_SIGNAL_PROBE_OWNERSHIP_ROOT" \
  research_provider \
  research-provider-pgid-drift-probe \
  research_preflight_commitment \
  research-preflight-provider-pgid-drift-probe \
  "$OURO_PROVIDER_DRIFT_PID" \
  "$OURO_PROVIDER_DRIFT_MANIFEST")"
assert_signal_guard_blocked \
  provider-pgid-drift \
  "$OURO_PROVIDER_DRIFT_MANIFEST" \
  "$OURO_PROVIDER_DRIFT_OWNERSHIP_ID" \
  research_provider \
  'provider PGID leader drift'
kill "$OURO_PROVIDER_DRIFT_PID"
wait "$OURO_PROVIDER_DRIFT_WRAPPER_PID" 2>/dev/null || true

jq -n '{
  owner_exit:"blocked_without_signal",
  active_record_swap:"blocked_without_signal",
  stable_malformed_record:"blocked_without_signal",
  canonical_path_conflict:"blocked_without_signal",
  canonical_history_conflict:"blocked_without_signal",
  provider_pgid_drift:"blocked_without_signal",
  retained_probe_secrets:false
}' >"$OURO_RUN_ROOT/evidence/ownership-signal-guard-regression.json"
cleanup_signal_probes
trap - EXIT
jq -e '
  .retained_probe_secrets == false and
  ([paths | select(.[-1] == "session_token")] | length == 0)
' "$OURO_RUN_ROOT/evidence/ownership-signal-guard-regression.json" >/dev/null

# Each real signal is issued only by the helper that just reloaded and
# revalidated that exact target. A failure aborts immediately; it is never
# converted to success and no later target is attempted.
kill -0 "$OURO_CRASH_REQUEST_PID"
: >"$OURO_RUN_ROOT/evidence/ownership-signals.jsonl"
export OURO_OWNERSHIP_SIGNAL_MODE=signal
unset OURO_OWNERSHIP_SIGNAL_AUDIT_PATH
signal_exact_active_owner \
  "$OURO_RUN_ROOT/evidence/runtime-signal-targets.json" \
  "$(jq -er '.[0].lineage.runtime_process_ownership_id' "$OURO_RUN_ROOT/evidence/runtime-signal-targets.json")" \
  runtime_supervisor \
  "$OUROBOROS_STORE_ROOT/runtime-process-ownership" \
  >>"$OURO_RUN_ROOT/evidence/ownership-signals.jsonl"
while IFS= read -r ownership_id; do
  signal_exact_active_owner \
    "$OURO_RUN_ROOT/evidence/provider-signal-targets.json" \
    "$ownership_id" \
    research_provider \
    "$OUROBOROS_STORE_ROOT/runtime-process-ownership" \
    >>"$OURO_RUN_ROOT/evidence/ownership-signals.jsonl"
done < <(jq -r '.[].lineage.runtime_process_ownership_id' \
  "$OURO_RUN_ROOT/evidence/provider-signal-targets.json")
)
OURO_CRASH_SIGNAL_STATUS=$?
if [ "$OURO_CRASH_SIGNAL_STATUS" -ne 0 ]; then
  printf 'crash-target guard aborted; the target that failed immediate revalidation was not signaled\n' >&2
  exit "$OURO_CRASH_SIGNAL_STATUS"
fi

for attempt in {1..40}; do
  ! lsof -nP -iTCP:4273 -sTCP:LISTEN >/dev/null 2>&1 && break
  sleep 0.25
done
if lsof -nP -iTCP:4273 -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'OURO-238 runtime listener still alive after SIGKILL\n' >&2
  exit 1
fi
for attempt in {1..80}; do
  ! kill -0 "$OURO_CRASH_REQUEST_PID" 2>/dev/null && break
  sleep 0.25
done
if kill -0 "$OURO_CRASH_REQUEST_PID" 2>/dev/null; then
  printf 'second arena tick request did not exit after runtime loss\n' >&2
  exit 1
fi
wait "$OURO_CRASH_REQUEST_PID" 2>/dev/null || true
for attempt in {1..40}; do
  live_provider_group=""
  while IFS= read -r pgid; do
    kill -0 -- "-$pgid" 2>/dev/null && live_provider_group="$pgid"
  done <"$OURO_RUN_ROOT/evidence/provider-process-groups.txt"
  [ -z "$live_provider_group" ] && break
  sleep 0.25
done
while IFS= read -r pgid; do
  if kill -0 -- "-$pgid" 2>/dev/null; then
    printf 'owned provider process group still alive: %s\n' "$pgid" >&2
    exit 1
  fi
done <"$OURO_RUN_ROOT/evidence/provider-process-groups.txt"
```

Restart the same store only after those checks pass and the interrupted CLI request has exited. Invoke one new bounded `./bin/ouroboros arena tick --json` to trigger pre-effect recovery, save its output, and require every saved commitment-backed interrupted ID to close as checkpoint-owned `failed_closed` with the exact lifecycle summary `Research checkpoint restart_recovery.`. Drain that recovery-trigger tick completely before the next test. Do not submit another tick while the first server-side process may still be alive.
- [ ] Produce degraded transport evidence without corrupting persisted records: in one already-open Desktop/Web view, first load and verify an exact detail while the runtime is healthy. Re-resolve and ownership-check the external runtime listener, terminate only that listener, then keep the same visible view open through at least two five-second refreshes. Require the same-ID last-safe detail plus both `Operator refresh degraded` and `Research detail refresh degraded`. A newly launched browser after the outage is not retention evidence. Restart the same store afterward and require both warnings to clear.
- [ ] Verify the retained native Desktop is still attached to the restarted real store/runtime before populated capture:

```bash
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

Use Browser/Computer Use to navigate the native app to the exact Research row before capture and to verify its visible URL-backed selection; `screencapture -i` is an explicit interactive window capture, not whole-display proof. Verify and reuse the retained exact Web listener on the fixed port, then use Browser/Chrome viewport emulation for 768x960 and 390x844. On macOS, Chrome may keep a 500px minimum layout viewport while writing a 390px-wide screenshot, so `--window-size=390,844` plus `--screenshot` alone is not valid narrow evidence.

```bash
export OURO_WEB_PID="$(head -n1 "$OURO_RUN_ROOT/evidence/web-listener-pids.txt")"
kill -0 "$OURO_WEB_PID"
lsof -nP -t -iTCP:5273 -sTCP:LISTEN | sort -u \
  >"$OURO_RUN_ROOT/evidence/web-listener-pids-current.txt"
cmp -s \
  "$OURO_RUN_ROOT/evidence/web-listener-pids.txt" \
  "$OURO_RUN_ROOT/evidence/web-listener-pids-current.txt"
export OURO_RESEARCH_URL="http://127.0.0.1:5273/#/research?session=$OURO_RESEARCH_ID_URI"
# For each viewport, set the browser viewport before navigation, wait for the
# exact selected ID and expected status text, then assert in page context:
#   window.innerWidth === expectedWidth
#   document.documentElement.clientWidth === expectedWidth
#   document.documentElement.scrollWidth <= expectedWidth
#   document.body.scrollWidth <= expectedWidth
# Save those values beside the screenshot as *.metrics.json. Capture the
# viewport itself without a narrower clip rectangle, then verify image pixels.
```

Capture authoritative empty before the first tick, populated terminal detail, same-ID degraded transport, and failed-closed restart recovery across the required viewports. Table-container-local horizontal scrolling is allowed; document-level horizontal overflow is not. Browser captures do not replace native Desktop evidence.

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

### Execution evidence — 2026-07-26

- Isolated run root: `/private/tmp/ouro-238.2JdMAp`. The selected researcher provider was `codex`; persisted session detail reported `codex_cli`.
- Terminal no-selection detail: `research-session-v1-db0c9aa52e0c03a57c83e668bc9e6c9c122ed4ce0f95a1aef5e190d3482bb7b9` in `evidence/research-detail.json`.
- Restart-recovery detail: `research-session-v1-f15f5a3b4194c71f5c7afa7a9ef5c4860f86401d38be854b4a4d4014022fa5e5`, commitment `research-preflight-85c2e78689ff635e59a540a6`, in `evidence/research-detail-restart-recovery.json`. Readback required `failed_closed`, checkpoint-owned status basis, `Research failed closed during restart recovery.`, and lifecycle event `Research checkpoint restart_recovery.`. Revised ownership evidence is an allowlisted witness before loss and after owner-absent reconciliation; a complete `RuntimeProcessOwnershipRecord` is store state, not an evidence artifact.
- Ownership-artifact safety: the earlier local files `restart-recovery-provider-ownership-claimed.json`, `restart-recovery-provider-ownership-owner-absent.json`, and `degraded-runtime-ownership.jsonl` were invalidated because they retained complete ownership records. On 2026-07-26 they were converted in place to the allowlisted `*.witness.jsonl` files named by the runnable block, and the original names were removed. The witnesses retain only bounded refs, PID/start marker, status, terminal reason when present, and non-secret digests. `jq` validated each witness and `rg -l '"session_token"'` returned no JSON/JSONL match anywhere under `evidence/`; the run root became eligible for bounded review sharing after those checks.
- Authoritative Web evidence and adjacent metric files:
  - `evidence/research-web-empty-authoritative-390x844.jpg`
  - `evidence/research-web-populated-390x844.jpg`
  - `evidence/research-web-populated-768x960.jpg`
  - `evidence/research-web-restart-recovery-failed-closed-390x844.jpg`
  - `evidence/research-web-degraded-baseline-768x960.jpg`
  - `evidence/research-web-degraded-transport-768x960.jpg`
  - `evidence/research-web-degraded-recovered-768x960.jpg`
- The same visible 768x960 tab retained the exact failed-closed detail for 13 seconds after the ownership-validated runtime listener was stopped. Both degraded warnings appeared, and both cleared after restart. Every capture asserted the exact requested viewport and no document/body horizontal overflow.
- Actual native Tauri evidence used the unique bundle `ai.openboa.ouroboros.operator.ouro238` and exact URL-backed restart-recovery detail:
  - `evidence/research-desktop-post-review-1440x960.png`
  - `evidence/research-desktop-post-review-1180x760.png`
  - `evidence/research-desktop-post-review-metrics.json` records exact window and pixel sizes, the exact session route, `failed_closed`, checkpoint-owned status basis, restart-recovery summary/checkpoint, provider-log unavailability, and `required_sizes_exact: true`.
  - SHA-256: `6ae501b895aa741c695777a1404d4b731ba961a91a3bf8d357a09739c1d62904` (1440x960), `eca47d6e40c0efbac21b4fbcad0e49cc9287e748ee7ab9dd34ebb051a1925cf2` (1180x760), and `649a8db4fdef79c50d904f2b82274ac179796722c6770ca0c96eef7cb5d64c0e` (metrics).
- Post-fix keyboard evidence: `evidence/research-web-interaction-check-after-fix.json` and `evidence/research-web-interaction-after-fix-390x844.jpeg`. Browser-only `Tab`/`Enter` opened the exact failed-closed card, retained it across a 5.6-second refresh, activated `Back`, restored focus to the originating card after the route commit, and reported no horizontal overflow. All assertions are `true`.
- Post-review real-browser behavior evidence is `evidence/research-web-post-review-accessibility.json` (SHA-256 `9c24db111d3da0e688f8424bb4344e5a94fbe8ef6cabaf0e9b7d5b7666060c93`) and `evidence/research-web-post-review-layout-390x844.jpeg` (SHA-256 `460ea44c59cd541b9c4f503e78534c3db99eb571fc08e23cf21396c58ee72039`). At one unchanged URL selection, `research-session-v1-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`, `document.activeElement` moved from the loading `H3` to its unavailable replacement `H3`; the exact loaded recovery session separately focused its detail `H3`. At an exact 390x844 viewport the long terminal card measured 389px wide, its 357px heading occupied the full row, the 293.515625px wrapped badge row began 8px below the heading, no bounds overlapped, and both document/body scroll widths were 390px. The evidence is bound to `research-screen.tsx` SHA-256 `74db04d6ffefaa5e664eebfe3e48c6e52d763ab4e08914f953eb43fe75dc2bd9` and `research-screen.test.tsx` SHA-256 `c0a6416c67d608d3f4950cb8f5833fc1cc97cadd19034e997e082338a9ec1484`; neither scoped file changed after capture. After the latest-main rebase, those exact source bindings are commit `1c820411289833c1612704f32a556ccb5e29e410` with tree `2386a986aa92644e1571ad834b47cd082ce3ee5a` before the ledger-only binding update.
- The final current-head UI review found that a cold URL-selected session outside the summary could render a first-load `503` or transport failure as the distinct `404` projection-miss state. Commit `424f8456708950810d71c3a6128125f417092cdf` (tree `95f0074cb38bd256a88855deec0f9307963c94e2`) closes that gap: the client maps only HTTP `404` to absence, reports every other non-success through a status-only sanitized error, and renders unavailable evidence before the true missing-session branch. Focused App/Research tests passed 42/42, full Operator Web source passed 99/99, Operator Web typecheck/build passed, and the independent fix review returned PASS. The real-browser regression capture is `evidence/research-web-cold-detail-unavailable-post-fix-390x844.jpeg` (SHA-256 `6f2878ce4bda553dfbe1f0460475f699cfb7f30629509308f2c9f944a6e5552c`) with `evidence/research-web-cold-detail-unavailable-post-fix-metrics.json` (SHA-256 `f5d68c502d3a2f94db4ab8687dd9f7c5a3b219d0ce4df29c48f54a5e7800a395`). It records exact 390x844 inner/client dimensions, 390px document/body scroll widths, the unavailable heading and `503` status, and absence of both projection-miss claims. Source SHA-256 bindings are `abcc302dcb09d1b32d53b6cee38d2ee19e426f20b207bb70947595f0b420b436` (`App.test.tsx`), `32a64d16005f25830660e6f3f246d4444ba5517fe0d85463cd5eb25b91183c5c` (`api.ts`), `a8f4fcbd153ff6df45a97f3a6e5356810e933a60dc1e126d873f7036a4733565` (`research-screen.test.tsx`), and `6ac5a4dd2d90f31e553b330cafec76436b171d50ce4aa6de43d32a6482c0f33b` (`research-screen.tsx`).
- Cleanup remains pending until PR review and merge evidence close. Stop only the evidence-run Tauri, Web, runtime, and caffeinate sessions, verify ports `4273` and `5273` are free, and leave the pre-existing service on `4173` untouched.
- Current-main validation after rebase to `e4fccd33f80e3c4a16f5fffb8fb7043706b9d4f1`:
  - focused read-model/runtime: 5 files, 46 passed;
  - focused Research projection services: 2 files, 97 passed;
  - Research detail API: 4 passed, 42 skipped by the name filter;
  - focused App/Research UI: 3 files, 44 passed;
  - full Operator Web source after the final cold-detail UI fix: 15 files, 99 passed;
  - root `npm run typecheck`, `npm run build`, and `npm run check:repo-guards`: passed;
  - final exact `npm test` outside the managed sandbox after the cold-detail fix: 236 files, 3,729 passed, 1 skipped in 192.69 seconds;
  - final exact root `npm run typecheck`, `npm run build`, and `npm run check:repo-guards` after that test: passed.
- Environment-only validation notes: the managed sandbox denied local TCP/Unix-socket listeners and process-start inspection with `EPERM`, so its affected result was invalidated and rerun outside the sandbox as required. The first unsandboxed full run had one non-reproduced load-sensitive polling timeout in an unchanged autonomous-restart smoke; the exact test passed 1/1, its full file passed 19/19, and a second exact `npm test` completed green with the counts above.
- Task 5 signal-guard verification: `bash -n` passed for the extracted final helper/probe block, and its non-destructive audit run passed outside the managed sandbox. The helper now requires the canonical active path, `runtimeProcessOwnershipHasRuntimeShape`, and an exact `FileSystemRuntimeProcessOwnershipStore.inspect()` result of `owned` (including consistent open history) immediately before marker/listener-or-PGID revalidation and the sole signal sink. Canonically claimed fixtures proved owner exit, exact record swap, stable malformed metadata, non-canonical active path, conflicting open history, and provider PGID drift all returned nonzero with empty audit sinks. Probe stores were created only under validated `/private/tmp/ouro-238-ownership-signal-guard.*` roots and removed before retaining the token-free `evidence/ownership-signal-guard-regression.json` (SHA-256 `af711c42e88a6ec94ee28f160629ad12efb4c1336453d7a1bb7b62248fb4e99e`). The earlier destructive restart evidence predates this canonical-store revision; the revised real-signal path was not replayed, so this entry claims no new `SIGKILL`/restart artifact. Independent final safety sign-off remains the current-head review gate.

## Plan Self-Review

- Scope is projection-only; no persisted contract, provider, scheduler, evaluator, rank, private/live, or order authority is added.
- Exact active identity prevents an unrelated active tick from reviving an orphan.
- Terminal and pre-commit failures precede runtime state; inactive incomplete work is recovery.
- Development snapshot digest and selected canonical `SystemCode` digest are never conflated.
- Missing trigger/methodology and non-selected artifact identity are explicit, not fabricated.
- Intermediate commits run root typecheck; the nonexistent Research screen test is correctly marked Create.
- Required build and 1440x960, 1180x760, 768px, and 390px evidence are included.
- Empty, populated, degraded-transport, and failed-closed restart evidence all remain bound to the isolated real Codex-backed run.
