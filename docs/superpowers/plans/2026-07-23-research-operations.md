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

find "$OUROBOROS_STORE_ROOT/runtime-process-ownership/active" -maxdepth 1 -type f -name '*.json' \
  -exec jq -c 'select(.process_kind == "runtime_supervisor" and .ownership_status == "active")' {} + \
  >"$OURO_RUN_ROOT/evidence/runtime-ownership-before-crash.jsonl"
jq -e -s --argjson pid "$OURO_RUNTIME_PID" '
  (length == 1)
  and (.[0].owner.process_id == $pid)
  and (.[0].owner.process_start_marker | type == "string" and length > 0)' \
  "$OURO_RUN_ROOT/evidence/runtime-ownership-before-crash.jsonl" >/dev/null

find "$OUROBOROS_STORE_ROOT/runtime-process-ownership/active" -maxdepth 1 -type f -name '*.json' \
  -exec jq -c --slurpfile commitments "$OURO_RUN_ROOT/evidence/interrupted-running-commitment-ids.json" \
    'select(.process_kind == "research_provider"
      and .ownership_status == "active"
      and .runtime_ref.record_kind == "research_preflight_commitment"
      and (.runtime_ref.id as $id | any($commitments[0][]; . == $id)))' {} + \
  >"$OURO_RUN_ROOT/evidence/provider-ownership-before-crash.jsonl"
jq -e -s --slurpfile commitments "$OURO_RUN_ROOT/evidence/interrupted-running-commitment-ids.json" '
  . as $owners
  | $commitments[0] as $commitments
  | (($commitments | length) > 0)
    and (($commitments | unique | length) == ($commitments | length))
    and (($owners | length) == ($commitments | length))
    and ($owners | all(.[];
      .process_kind == "research_provider"
      and .ownership_status == "active"
      and .runtime_ref.record_kind == "research_preflight_commitment"
      and (.owner.process_id | type == "number" and . > 0)
      and (.owner.process_start_marker | type == "string" and length > 0)))
    and (($owners | map(.runtime_ref.id) | sort) == ($commitments | sort))
    and (($owners | map(.runtime_ref.id) | unique | length) == ($owners | length))
    and (($owners | map(.owner.process_id) | unique | length) == ($owners | length))' \
  "$OURO_RUN_ROOT/evidence/provider-ownership-before-crash.jsonl" >/dev/null
jq -r '[.owner.process_id,.owner.process_start_marker] | @tsv' \
  "$OURO_RUN_ROOT/evidence/provider-ownership-before-crash.jsonl" | sort -n \
  >"$OURO_RUN_ROOT/evidence/provider-owner-identities.tsv"
export OURO_PROVIDER_OWNER_COUNT="$(wc -l <"$OURO_RUN_ROOT/evidence/provider-owner-identities.tsv" | tr -d ' ')"
test "$OURO_PROVIDER_OWNER_COUNT" -eq "$(jq 'length' "$OURO_RUN_ROOT/evidence/interrupted-running-commitment-ids.json")"
: >"$OURO_RUN_ROOT/evidence/provider-process-groups.txt"
while IFS=$'\t' read -r pid marker; do
  pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
  test -n "$marker"
  test "$pgid" = "$pid"
  printf '%s\n' "$pgid" >>"$OURO_RUN_ROOT/evidence/provider-process-groups.txt"
done <"$OURO_RUN_ROOT/evidence/provider-owner-identities.tsv"
test "$(wc -l <"$OURO_RUN_ROOT/evidence/provider-process-groups.txt" | tr -d ' ')" -eq "$OURO_PROVIDER_OWNER_COUNT"
test "$(sort -nu "$OURO_RUN_ROOT/evidence/provider-process-groups.txt" | wc -l | tr -d ' ')" -eq "$OURO_PROVIDER_OWNER_COUNT"

verify_owned_process_start_marker() {
  node --import tsx -e '
    import { processStartMarker } from "./packages/local-store/src/process-start-marker.ts";
    const pid = Number(process.argv[1]);
    const expected = process.argv[2];
    (async () => {
      if (!Number.isSafeInteger(pid) || pid <= 0 || !expected) {
        throw new Error("invalid persisted process identity");
      }
      const actual = await processStartMarker(pid);
      if (actual !== expected) {
        throw new Error(`process start marker mismatch for ${pid}: expected ${expected}, received ${actual ?? "unavailable"}`);
      }
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  ' "$1" "$2"
}

while IFS=$'\t' read -r pid marker; do
  kill -0 -- "-$pid"
  verify_owned_process_start_marker "$pid" "$marker"
done <"$OURO_RUN_ROOT/evidence/provider-owner-identities.tsv"
verify_owned_process_start_marker \
  "$OURO_RUNTIME_PID" \
  "$(jq -er '.owner.process_start_marker' "$OURO_RUN_ROOT/evidence/runtime-ownership-before-crash.jsonl")"
kill -0 "$OURO_CRASH_REQUEST_PID"
)
OURO_CRASH_PREFLIGHT_STATUS=$?
if [ "$OURO_CRASH_PREFLIGHT_STATUS" -ne 0 ]; then
  printf 'crash-target validation failed; no destructive signal was sent\n' >&2
  exit "$OURO_CRASH_PREFLIGHT_STATUS"
fi

export OURO_RUNTIME_PID="$(head -n1 "$OURO_RUN_ROOT/evidence/runtime-listener-pids.txt")"
if ! kill -KILL "$OURO_RUNTIME_PID"; then
  printf 'validated runtime PID could not be signaled: %s\n' "$OURO_RUNTIME_PID" >&2
  exit 1
fi
while IFS= read -r pgid; do
  if kill -0 -- "-$pgid" 2>/dev/null; then
    kill -KILL -- "-$pgid" 2>/dev/null || true
  fi
done <"$OURO_RUN_ROOT/evidence/provider-process-groups.txt"

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
- Restart-recovery detail: `research-session-v1-f15f5a3b4194c71f5c7afa7a9ef5c4860f86401d38be854b4a4d4014022fa5e5`, commitment `research-preflight-85c2e78689ff635e59a540a6`, in `evidence/research-detail-restart-recovery.json`. Readback required `failed_closed`, checkpoint-owned status basis, `Research failed closed during restart recovery.`, and lifecycle event `Research checkpoint restart_recovery.`. Persisted provider ownership was captured before loss and after owner-absent reconciliation.
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
  - `evidence/research-desktop-failed-closed-native-screen-1152x768.jpeg`
  - `evidence/research-desktop-restart-recovery-lifecycle-1152x768.jpeg`
  - adjacent `.metrics.json` files assert the exact session URL, `Failed Closed`, restart-recovery summary/checkpoint, `Codex Cli`, controlled lifecycle, and no projection degradation.
- Host-display constraint: the attached display exposed 1152x768 pixels, so the native captures truthfully record 1152x768 rather than relabeling them as the requested 1440x960 or 1180x760. Exact Web evidence covers 768x960 and 390x844; the native captures remain the actual Desktop proof.
- Post-fix keyboard evidence: `evidence/research-web-interaction-check-after-fix.json` and `evidence/research-web-interaction-after-fix-390x844.jpeg`. Browser-only `Tab`/`Enter` opened the exact failed-closed card, retained it across a 5.6-second refresh, activated `Back`, restored focus to the originating card after the route commit, and reported no horizontal overflow. All assertions are `true`.
- Cleanup: only the evidence-run Tauri, Web, runtime, and caffeinate sessions were stopped. Ports `4273` and `5273` no longer listened; the pre-existing OURO-237 service on `4173` remained untouched.
- Current-main validation after rebase to `28c8c9dde15609bfa098cfc4200ab3e31c0b162f`:
  - focused read-model/runtime: 5 files, 46 passed;
  - focused Research projection services: 2 files, 97 passed;
  - Research detail API: 4 passed, 42 skipped by the name filter;
  - focused App/Research UI: 3 files, 44 passed;
  - full Operator Web source: 15 files, 95 passed;
  - root `npm run typecheck`, `npm run build`, and `npm run check:repo-guards`: passed;
  - final exact `npm test` outside the managed sandbox: 236 files, 3,725 passed, 1 skipped.
- Environment-only validation notes: the managed sandbox denied local TCP/Unix-socket listeners and process-start inspection with `EPERM`, so its affected result was invalidated and rerun outside the sandbox as required. The first unsandboxed full run had one non-reproduced load-sensitive polling timeout in an unchanged autonomous-restart smoke; the exact test passed 1/1, its full file passed 19/19, and a second exact `npm test` completed green with the counts above.
- Independent Task 5 safety re-review: PASS. The standalone fail-fast preflight validates runtime/provider identities and start markers before any signal, uses `node --import tsx -e`, signals only still-live owned groups, and bounded-polls every exit.

## Plan Self-Review

- Scope is projection-only; no persisted contract, provider, scheduler, evaluator, rank, private/live, or order authority is added.
- Exact active identity prevents an unrelated active tick from reviving an orphan.
- Terminal and pre-commit failures precede runtime state; inactive incomplete work is recovery.
- Development snapshot digest and selected canonical `SystemCode` digest are never conflated.
- Missing trigger/methodology and non-selected artifact identity are explicit, not fabricated.
- Intermediate commits run root typecheck; the nonexistent Research screen test is correctly marked Create.
- Required build and 1440x960, 1180x760, 768px, and 390px evidence are included.
- Empty, populated, degraded-transport, and failed-closed restart evidence all remain bound to the isolated real Codex-backed run.
