import { createHash } from "node:crypto";

export type RuntimeSoakActionKind =
  | "clean_restart"
  | "crash"
  | "delayed_cleanup"
  | "provider_loss"
  | "sandbox_loss"
  | "gateway_unavailable"
  | "recovery"
  | "terminal_cleanup";

export type RuntimeSoakFaultKind = "runtime" | "cleanup" | "provider" | "sandbox" | "gateway";

export interface RuntimeSoakAction {
  action_id: string;
  kind: RuntimeSoakActionKind;
  at_ms: number;
  recovers?: RuntimeSoakFaultKind;
}

export interface RuntimeSoakScenario {
  version: 1;
  run_id: string;
  duration_ms: number;
  sample_interval_ms: number;
  actions: RuntimeSoakAction[];
}

export interface RuntimeSoakSample {
  version: 1;
  sampled_at: string;
  effects: Array<{ effect_id: string; occurrence_count: number }>;
  chains: Array<{
    chain_id: string;
    chain_kind: "ledger" | "evidence";
    entries: Array<{ sequence: number; digest: string; previous_digest?: string }>;
  }>;
  ownership: Array<{
    scope: string;
    active_owner_count: number;
    identity_status: "exact" | "absent" | "unknown" | "mismatched";
  }>;
  retries: Array<{
    lane: string;
    attempt_count: number;
    no_progress_count: number;
    retry_budget: number;
    status: "recovering" | "running" | "degraded" | "blocked" | "stopped";
  }>;
  paper_observations: Array<{
    stream_id: string;
    entries: Array<{
      sequence: number;
      emitted_order_request_count: number;
      no_order_recorded: boolean;
    }>;
  }>;
  sandboxes: Array<{
    sandbox_id: string;
    provider_generated: boolean;
    lifecycle_status: "requested" | "created" | "starting" | "running" | "stopping" | "stopped" | "failed" | "removed";
    egress_attestation_version?: number;
    egress_attestation_status?: "verified" | "missing" | "invalid";
  }>;
  resources: Array<{
    resource_id: string;
    resource_kind: string;
    status: "active" | "stopping" | "terminal";
    expected_status?: "active" | "terminal";
  }>;
}

export type RuntimeSoakInvariantKind =
  | "no_duplicate_effects"
  | "contiguous_chains"
  | "exact_ownership"
  | "bounded_retries"
  | "no_order_continuity"
  | "egress_attestation"
  | "required_resource_state"
  | "terminal_cleanup";

export interface RuntimeSoakInvariantFailure {
  kind: RuntimeSoakInvariantKind;
  subject: string;
  detail: string;
}

export type RuntimeSoakTerminalClassification =
  | "passed"
  | "invariant_failed"
  | "target_failed"
  | "duration_exhausted";

export interface RuntimeSoakManifest {
  record_kind: "runtime_soak_manifest";
  version: 1;
  run_id: string;
  duration_ms: number;
  sample_interval_ms: number;
  actions: RuntimeSoakAction[];
  scenario_digest: string;
  operational_test_evidence: true;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  private_exchange_authority: false;
  live_exchange_authority: false;
  authority_status: "operational_test_only";
}

export type RuntimeSoakEventPayload =
  | { event_type: "run_started"; scenario_digest: string }
  | { event_type: "action_started"; action_id: string; action_kind: RuntimeSoakActionKind }
  | { event_type: "action_completed"; action_id: string; action_kind: RuntimeSoakActionKind; evidence_digest: string }
  | { event_type: "sample_recorded"; terminal: boolean; sample: RuntimeSoakSample }
  | {
      event_type: "terminal";
      classification: RuntimeSoakTerminalClassification;
      reason_code?: string;
      failure?: RuntimeSoakInvariantFailure;
    };

export interface RuntimeSoakEventDraft {
  run_id: string;
  recorded_at: string;
  elapsed_ms: number;
  payload: RuntimeSoakEventPayload;
}

export interface RuntimeSoakEvent extends RuntimeSoakEventDraft {
  record_kind: "runtime_soak_event";
  version: 1;
  sequence: number;
  previous_event_digest?: string;
  event_digest: string;
  operational_test_evidence: true;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  private_exchange_authority: false;
  live_exchange_authority: false;
  authority_status: "operational_test_only";
}

export interface RuntimeSoakControlEvidence { evidence_digest: string }

export interface RuntimeSoakTargetPort {
  execute(action: RuntimeSoakAction): Promise<RuntimeSoakControlEvidence>;
  sample(): Promise<unknown>;
}

export interface RuntimeSoakJournalPort {
  initialize(manifest: RuntimeSoakManifest): Promise<RuntimeSoakManifest>;
  history(): Promise<RuntimeSoakEvent[]>;
  append(draft: RuntimeSoakEventDraft, expectedPreviousDigest?: string): Promise<RuntimeSoakEvent>;
}

export interface RuntimeSoakResult {
  run_id: string;
  classification: RuntimeSoakTerminalClassification;
  reason_code?: string;
  failure?: RuntimeSoakInvariantFailure;
  elapsed_ms: number;
  terminal_event_sequence: number;
  terminal_event_digest: string;
}

export class RuntimeSoakError extends Error {
  constructor(
    readonly code:
      | "runtime_soak_scenario_invalid"
      | "runtime_soak_sample_invalid"
      | "runtime_soak_report_invalid"
      | "runtime_soak_clock_invalid",
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "RuntimeSoakError";
  }
}

export class RuntimeSoakHarness {
  private readonly scenario: RuntimeSoakScenario;
  private readonly now: () => string;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private events: RuntimeSoakEvent[] = [];
  private startedAt = 0;

  constructor(private readonly options: {
    scenario: RuntimeSoakScenario;
    journal: RuntimeSoakJournalPort;
    target: RuntimeSoakTargetPort;
    now?: () => string;
    sleep?: (delayMs: number) => Promise<void>;
  }) {
    this.scenario = validateRuntimeSoakScenario(options.scenario);
    this.now = options.now ?? (() => new Date().toISOString());
    this.sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  }

  async run(): Promise<RuntimeSoakResult> {
    const manifest = createRuntimeSoakManifest(this.scenario);
    const storedManifest = await this.options.journal.initialize(manifest);
    if (storedManifest.scenario_digest !== manifest.scenario_digest) {
      throw reportInvalid("Runtime soak manifest does not match the configured scenario.");
    }
    this.events = await this.options.journal.history();
    if (this.events.length === 0) {
      const recordedAt = this.exactNow();
      await this.append({
        run_id: this.scenario.run_id,
        recorded_at: recordedAt,
        elapsed_ms: 0,
        payload: { event_type: "run_started", scenario_digest: manifest.scenario_digest }
      });
    }
    const first = this.events[0];
    if (!first || first.payload.event_type !== "run_started" ||
      first.payload.scenario_digest !== manifest.scenario_digest ||
      first.run_id !== this.scenario.run_id) {
      throw reportInvalid("Runtime soak report does not start with the configured run.");
    }
    this.startedAt = Date.parse(first.recorded_at);
    const terminals = this.events.filter((event) => event.payload.event_type === "terminal");
    if (terminals.length > 0) {
      const terminal = terminals[0]!;
      if (terminals.length !== 1 || terminal !== this.events.at(-1)) {
        throw reportInvalid("Runtime soak terminal event must be unique and final.");
      }
      return terminalResult(terminal);
    }
    const historicalFailure = firstRecordedFailure(this.events);
    if (historicalFailure) {
      return this.finish("invariant_failed", historicalFailure.kind, historicalFailure);
    }
    const reconstruction = reconstructActions(this.events, this.scenario);
    if (reconstruction.pending) {
      return this.finish(
        "target_failed",
        `ambiguous_incomplete_action:${reconstruction.pending.action_id}`
      );
    }

    const latest = this.events.at(-1);
    if (latest?.payload.event_type === "action_completed") {
      const sampled = await this.recordSample(latest.payload.action_kind === "terminal_cleanup");
      if (sampled) return sampled;
      if (latest.payload.action_kind === "terminal_cleanup") {
        return this.finishAfterTerminalEvidence();
      }
    } else if (reconstruction.completed.size === this.scenario.actions.length) {
      if (latest?.payload.event_type !== "sample_recorded" || !latest.payload.terminal) {
        throw reportInvalid("Completed runtime soak schedule lacks its terminal sample.");
      }
      return this.finishAfterTerminalEvidence();
    }

    if (!this.events.some((event) => event.payload.event_type === "sample_recorded")) {
      const initial = await this.recordSample(false);
      if (initial) return initial;
    }

    for (const action of this.scenario.actions) {
      if (reconstruction.completed.has(action.action_id)) continue;
      const waitingResult = await this.waitUntil(action.at_ms);
      if (waitingResult) return waitingResult;
      if (this.elapsed() >= this.scenario.duration_ms) {
        return this.finish("duration_exhausted", "scenario_duration_exhausted");
      }
      await this.appendNow({
        event_type: "action_started",
        action_id: action.action_id,
        action_kind: action.kind
      });
      let evidence: RuntimeSoakControlEvidence;
      try {
        evidence = await this.options.target.execute(structuredClone(action));
      } catch (error) {
        return this.finish("target_failed", `target_action_failed:${action.action_id}`);
      }
      if (!sha256(evidence.evidence_digest)) {
        return this.finish("target_failed", `target_action_evidence_invalid:${action.action_id}`);
      }
      await this.appendNow({
        event_type: "action_completed",
        action_id: action.action_id,
        action_kind: action.kind,
        evidence_digest: evidence.evidence_digest
      });
      const sampled = await this.recordSample(action.kind === "terminal_cleanup");
      if (sampled) return sampled;
      if (action.kind === "terminal_cleanup") return this.finishAfterTerminalEvidence();
    }

    const terminalSample = await this.recordSample(true);
    return terminalSample ?? this.finishAfterTerminalEvidence();
  }

  private async waitUntil(atMs: number): Promise<RuntimeSoakResult | undefined> {
    while (this.elapsed() < atMs) {
      const remainingDuration = this.scenario.duration_ms - this.elapsed();
      if (remainingDuration <= 0) {
        return this.finish("duration_exhausted", "scenario_duration_exhausted");
      }
      await this.sleep(Math.min(
        this.scenario.sample_interval_ms,
        atMs - this.elapsed(),
        remainingDuration
      ));
      if (this.elapsed() >= this.scenario.duration_ms) {
        return this.finish("duration_exhausted", "scenario_duration_exhausted");
      }
      const sampled = await this.recordSample(false);
      if (sampled) return sampled;
    }
    return undefined;
  }

  private async recordSample(terminal: boolean): Promise<RuntimeSoakResult | undefined> {
    let sample: RuntimeSoakSample;
    try {
      sample = parseRuntimeSoakSample(await this.options.target.sample());
    } catch (error) {
      return this.finish("target_failed", "target_sample_failed");
    }
    await this.appendNow({ event_type: "sample_recorded", terminal, sample });
    const failure = evaluateRuntimeSoakInvariants(sample, { terminal });
    return failure
      ? this.finish("invariant_failed", failure.kind, failure)
      : undefined;
  }

  private async finish(
    classification: RuntimeSoakTerminalClassification,
    reasonCode?: string,
    failure?: RuntimeSoakInvariantFailure
  ): Promise<RuntimeSoakResult> {
    const event = await this.appendNow({
      event_type: "terminal",
      classification,
      ...(reasonCode ? { reason_code: reasonCode } : {}),
      ...(failure ? { failure } : {})
    });
    return terminalResult(event);
  }

  private finishAfterTerminalEvidence(): Promise<RuntimeSoakResult> {
    const latest = this.events.at(-1);
    if (latest?.payload.event_type !== "sample_recorded" || !latest.payload.terminal) {
      throw reportInvalid("Runtime soak cannot pass without terminal sample evidence.");
    }
    return latest.elapsed_ms >= this.scenario.duration_ms
      ? this.finish("duration_exhausted", "scenario_duration_exhausted")
      : this.finish("passed");
  }

  private async appendNow(payload: RuntimeSoakEventPayload): Promise<RuntimeSoakEvent> {
    const recordedAt = this.exactNow();
    return this.append({
      run_id: this.scenario.run_id,
      recorded_at: recordedAt,
      elapsed_ms: this.elapsedAt(recordedAt),
      payload
    });
  }

  private async append(draft: RuntimeSoakEventDraft): Promise<RuntimeSoakEvent> {
    const previous = this.events.at(-1);
    const event = await this.options.journal.append(draft, previous?.event_digest);
    this.events.push(event);
    return event;
  }

  private elapsed(): number {
    return this.elapsedAt(this.exactNow());
  }

  private elapsedAt(recordedAt: string): number {
    const elapsed = Date.parse(recordedAt) - this.startedAt;
    if (!Number.isSafeInteger(elapsed) || elapsed < 0) {
      throw new RuntimeSoakError("runtime_soak_clock_invalid", "Runtime soak clock moved backwards.");
    }
    return elapsed;
  }

  private exactNow(): string {
    const value = this.now();
    if (!exactIso(value)) {
      throw new RuntimeSoakError("runtime_soak_clock_invalid", "Runtime soak clock must return exact ISO time.");
    }
    return value;
  }
}

export function validateRuntimeSoakScenario(input: RuntimeSoakScenario): RuntimeSoakScenario {
  if (!object(input) || input.version !== 1 || !canonical(input.run_id) ||
    !positiveInteger(input.duration_ms) || !positiveInteger(input.sample_interval_ms) ||
    !Array.isArray(input.actions) || input.actions.length === 0) {
    throw scenarioInvalid("Runtime soak scenario metadata is invalid.");
  }
  const ids = new Set<string>();
  let previousAt = -1;
  for (const action of input.actions) {
    if (!actionShape(action) || ids.has(action.action_id) || action.at_ms < previousAt ||
      action.at_ms >= input.duration_ms) {
      throw scenarioInvalid("Runtime soak actions must be unique, ordered, and within duration.");
    }
    ids.add(action.action_id);
    previousAt = action.at_ms;
  }
  const kinds = new Set(input.actions.map((action) => action.kind));
  if (REQUIRED_ACTION_KINDS.some((kind) => !kinds.has(kind)) ||
    input.actions.at(-1)?.kind !== "terminal_cleanup" ||
    input.actions.filter((action) => action.kind === "terminal_cleanup").length !== 1) {
    throw scenarioInvalid("Runtime soak scenario does not cover the canonical fault schedule.");
  }
  for (const [index, action] of input.actions.entries()) {
    const fault = ACTION_FAULT[action.kind];
    if (fault && !input.actions.slice(index + 1).some((candidate) =>
      candidate.kind === "recovery" && candidate.recovers === fault
    )) {
      throw scenarioInvalid(`Runtime soak fault ${action.action_id} has no later recovery.`);
    }
  }
  return structuredClone(input);
}

export function createRuntimeSoakManifest(scenario: RuntimeSoakScenario): RuntimeSoakManifest {
  const valid = validateRuntimeSoakScenario(scenario);
  const manifest: RuntimeSoakManifest = {
    record_kind: "runtime_soak_manifest",
    version: 1,
    run_id: valid.run_id,
    duration_ms: valid.duration_ms,
    sample_interval_ms: valid.sample_interval_ms,
    actions: structuredClone(valid.actions),
    scenario_digest: pendingDigest(),
    ...authority()
  };
  manifest.scenario_digest = digestWithout(manifest, "scenario_digest");
  return manifest;
}

export function createRuntimeSoakEvent(
  draft: RuntimeSoakEventDraft,
  sequence: number,
  previous?: RuntimeSoakEvent
): RuntimeSoakEvent {
  const event: RuntimeSoakEvent = {
    record_kind: "runtime_soak_event",
    version: 1,
    run_id: draft.run_id,
    sequence,
    ...(previous ? { previous_event_digest: previous.event_digest } : {}),
    recorded_at: draft.recorded_at,
    elapsed_ms: draft.elapsed_ms,
    payload: structuredClone(draft.payload),
    event_digest: pendingDigest(),
    ...authority()
  };
  event.event_digest = runtimeSoakEventDigest(event);
  return event;
}

export function runtimeSoakEventDigest(event: RuntimeSoakEvent): string {
  return digestWithout(event, "event_digest");
}

export function evaluateRuntimeSoakInvariants(
  sample: RuntimeSoakSample,
  options: { terminal: boolean }
): RuntimeSoakInvariantFailure | undefined {
  const effects = new Set<string>();
  for (const effect of sample.effects) {
    if (effects.has(effect.effect_id) || effect.occurrence_count !== 1) {
      return failure("no_duplicate_effects", effect.effect_id, "effect occurrence count is not exactly one");
    }
    effects.add(effect.effect_id);
  }
  const chainIds = new Set<string>();
  for (const chain of sample.chains) {
    if (chainIds.has(chain.chain_id)) {
      return failure("contiguous_chains", chain.chain_id, "chain identity is duplicated or forked");
    }
    chainIds.add(chain.chain_id);
    for (const [index, entry] of chain.entries.entries()) {
      const previous = chain.entries[index - 1];
      if ((index === 0 && (entry.sequence !== 1 || entry.previous_digest !== undefined)) ||
        (previous && (entry.sequence !== previous.sequence + 1 ||
          entry.previous_digest !== previous.digest))) {
        return failure("contiguous_chains", chain.chain_id, "chain sequence or predecessor is not contiguous");
      }
    }
  }
  const ownershipScopes = new Set<string>();
  for (const owner of sample.ownership) {
    if (ownershipScopes.has(owner.scope) || owner.active_owner_count > 1 ||
      (owner.active_owner_count === 1 && owner.identity_status !== "exact") ||
      (owner.active_owner_count === 0 && owner.identity_status !== "absent")) {
      return failure("exact_ownership", owner.scope, "active ownership is not singular and exact");
    }
    ownershipScopes.add(owner.scope);
  }
  const retryLanes = new Set<string>();
  for (const retry of sample.retries) {
    if (retryLanes.has(retry.lane) || retry.attempt_count > retry.retry_budget ||
      retry.no_progress_count > retry.retry_budget ||
      (retry.no_progress_count === retry.retry_budget && retry.status !== "blocked")) {
      return failure("bounded_retries", retry.lane, "retry counters exceed or contradict the bounded budget");
    }
    retryLanes.add(retry.lane);
  }
  const observationStreams = new Set<string>();
  for (const stream of sample.paper_observations) {
    if (observationStreams.has(stream.stream_id)) {
      return failure("no_order_continuity", stream.stream_id, "paper observation identity is duplicated or forked");
    }
    observationStreams.add(stream.stream_id);
    for (const [index, entry] of stream.entries.entries()) {
      if (entry.sequence !== index + 1 ||
        (entry.emitted_order_request_count === 0 && !entry.no_order_recorded)) {
        return failure("no_order_continuity", stream.stream_id, "paper observation continuity is incomplete");
      }
    }
  }
  for (const sandbox of sample.sandboxes) {
    if (sandbox.provider_generated && ACTIVE_SANDBOX_STATES.has(sandbox.lifecycle_status) &&
      (sandbox.egress_attestation_version !== 2 || sandbox.egress_attestation_status !== "verified")) {
      return failure("egress_attestation", sandbox.sandbox_id, "active generated Sandbox lacks verified v2 attestation");
    }
  }
  if (!options.terminal) {
    const resourceIds = new Set<string>();
    for (const resource of sample.resources) {
      if (resourceIds.has(resource.resource_id)) {
        return failure(
          "required_resource_state",
          resource.resource_id,
          "required resource identity is duplicated"
        );
      }
      resourceIds.add(resource.resource_id);
      if (resource.expected_status !== undefined &&
        resource.status !== resource.expected_status) {
        return failure(
          "required_resource_state",
          resource.resource_id,
          `required resource is ${resource.status}; expected ${resource.expected_status}`
        );
      }
    }
  }
  if (options.terminal) {
    const owner = sample.ownership.find((item) => item.active_owner_count !== 0);
    const resource = sample.resources.find((item) => item.status !== "terminal");
    const sandbox = sample.sandboxes.find((item) =>
      item.lifecycle_status !== "removed" && item.lifecycle_status !== "stopped"
    );
    if (owner || resource || sandbox) {
      return failure(
        "terminal_cleanup",
        owner?.scope ?? resource?.resource_id ?? sandbox!.sandbox_id,
        "terminal cleanup left an active owner, resource, or Sandbox"
      );
    }
  }
  return undefined;
}

export function parseRuntimeSoakSample(value: unknown): RuntimeSoakSample {
  if (!sampleShape(value)) {
    throw new RuntimeSoakError("runtime_soak_sample_invalid", "Runtime soak probe sample is invalid.");
  }
  return {
    version: 1,
    sampled_at: value.sampled_at,
    effects: value.effects.map((effect) => ({
      effect_id: effect.effect_id,
      occurrence_count: effect.occurrence_count
    })),
    chains: value.chains.map((chain) => ({
      chain_id: chain.chain_id,
      chain_kind: chain.chain_kind,
      entries: chain.entries.map((entry) => ({
        sequence: entry.sequence,
        digest: entry.digest,
        ...(entry.previous_digest === undefined ? {} : { previous_digest: entry.previous_digest })
      }))
    })),
    ownership: value.ownership.map((item) => ({
      scope: item.scope,
      active_owner_count: item.active_owner_count,
      identity_status: item.identity_status
    })),
    retries: value.retries.map((item) => ({
      lane: item.lane,
      attempt_count: item.attempt_count,
      no_progress_count: item.no_progress_count,
      retry_budget: item.retry_budget,
      status: item.status
    })),
    paper_observations: value.paper_observations.map((stream) => ({
      stream_id: stream.stream_id,
      entries: stream.entries.map((entry) => ({
        sequence: entry.sequence,
        emitted_order_request_count: entry.emitted_order_request_count,
        no_order_recorded: entry.no_order_recorded
      }))
    })),
    sandboxes: value.sandboxes.map((item) => ({
      sandbox_id: item.sandbox_id,
      provider_generated: item.provider_generated,
      lifecycle_status: item.lifecycle_status,
      ...(item.egress_attestation_version === undefined
        ? {}
        : { egress_attestation_version: item.egress_attestation_version }),
      ...(item.egress_attestation_status === undefined
        ? {}
        : { egress_attestation_status: item.egress_attestation_status })
    })),
    resources: value.resources.map((item) => ({
      resource_id: item.resource_id,
      resource_kind: item.resource_kind,
      status: item.status,
      ...(item.expected_status === undefined
        ? {}
        : { expected_status: item.expected_status })
    }))
  };
}

const REQUIRED_ACTION_KINDS: RuntimeSoakActionKind[] = [
  "clean_restart", "crash", "delayed_cleanup", "provider_loss", "sandbox_loss",
  "gateway_unavailable", "recovery", "terminal_cleanup"
];
const ACTION_FAULT: Partial<Record<RuntimeSoakActionKind, RuntimeSoakFaultKind>> = {
  crash: "runtime",
  delayed_cleanup: "cleanup",
  provider_loss: "provider",
  sandbox_loss: "sandbox",
  gateway_unavailable: "gateway"
};
const ACTIVE_SANDBOX_STATES = new Set(["requested", "created", "starting", "running", "stopping"]);

function firstRecordedFailure(events: RuntimeSoakEvent[]): RuntimeSoakInvariantFailure | undefined {
  for (const event of events) {
    if (event.payload.event_type !== "sample_recorded") continue;
    const failure = evaluateRuntimeSoakInvariants(event.payload.sample, {
      terminal: event.payload.terminal
    });
    if (failure) return failure;
  }
  return undefined;
}

function reconstructActions(events: RuntimeSoakEvent[], scenario: RuntimeSoakScenario) {
  const byId = new Map(scenario.actions.map((action) => [action.action_id, action]));
  const pending = new Map<string, RuntimeSoakAction>();
  const completed = new Set<string>();
  for (const event of events) {
    if (event.payload.event_type !== "action_started" && event.payload.event_type !== "action_completed") continue;
    const action = byId.get(event.payload.action_id);
    if (!action || action.kind !== event.payload.action_kind) {
      throw reportInvalid("Runtime soak report references an unknown action.");
    }
    if (event.payload.event_type === "action_started") {
      if (pending.size > 0 || completed.has(action.action_id)) {
        throw reportInvalid("Runtime soak report contains overlapping or replayed action intent.");
      }
      pending.set(action.action_id, action);
    } else {
      if (!pending.delete(action.action_id) || completed.has(action.action_id)) {
        throw reportInvalid("Runtime soak action completion has no exact intent.");
      }
      completed.add(action.action_id);
    }
  }
  const completedPrefix = scenario.actions.slice(0, completed.size);
  if (completedPrefix.some((action) => !completed.has(action.action_id))) {
    throw reportInvalid("Runtime soak completed actions are not a schedule prefix.");
  }
  return { completed, pending: pending.values().next().value as RuntimeSoakAction | undefined };
}

function terminalResult(event: RuntimeSoakEvent): RuntimeSoakResult {
  if (event.payload.event_type !== "terminal") throw reportInvalid("Runtime soak terminal event is invalid.");
  return {
    run_id: event.run_id,
    classification: event.payload.classification,
    ...(event.payload.reason_code ? { reason_code: event.payload.reason_code } : {}),
    ...(event.payload.failure ? { failure: structuredClone(event.payload.failure) } : {}),
    elapsed_ms: event.elapsed_ms,
    terminal_event_sequence: event.sequence,
    terminal_event_digest: event.event_digest
  };
}

function sampleShape(value: unknown): value is RuntimeSoakSample {
  if (!object(value) || value.version !== 1 || !exactIso(value.sampled_at) ||
    !arrays(value, ["effects", "chains", "ownership", "retries", "paper_observations", "sandboxes", "resources"])) return false;
  const effects = value.effects as unknown[];
  const chains = value.chains as unknown[];
  const ownership = value.ownership as unknown[];
  const retries = value.retries as unknown[];
  const observations = value.paper_observations as unknown[];
  const sandboxes = value.sandboxes as unknown[];
  const resources = value.resources as unknown[];
  return effects.every((item) => object(item) && canonical(item.effect_id) && positiveInteger(item.occurrence_count)) &&
    chains.every((chain) => object(chain) && canonical(chain.chain_id) &&
      (chain.chain_kind === "ledger" || chain.chain_kind === "evidence") && Array.isArray(chain.entries) &&
      chain.entries.every((entry) => object(entry) && positiveInteger(entry.sequence) && sha256(entry.digest) &&
        (entry.previous_digest === undefined || sha256(entry.previous_digest)))) &&
    ownership.every((item) => object(item) && canonical(item.scope) && nonNegativeInteger(item.active_owner_count) &&
      ["exact", "absent", "unknown", "mismatched"].includes(String(item.identity_status))) &&
    retries.every((item) => object(item) && canonical(item.lane) && nonNegativeInteger(item.attempt_count) &&
      nonNegativeInteger(item.no_progress_count) && positiveInteger(item.retry_budget) &&
      ["recovering", "running", "degraded", "blocked", "stopped"].includes(String(item.status))) &&
    observations.every((stream) => object(stream) && canonical(stream.stream_id) && Array.isArray(stream.entries) &&
      stream.entries.every((entry) => object(entry) && positiveInteger(entry.sequence) &&
        nonNegativeInteger(entry.emitted_order_request_count) && typeof entry.no_order_recorded === "boolean")) &&
    sandboxes.every((item) => object(item) && canonical(item.sandbox_id) && typeof item.provider_generated === "boolean" &&
      ["requested", "created", "starting", "running", "stopping", "stopped", "failed", "removed"].includes(String(item.lifecycle_status)) &&
      (item.egress_attestation_version === undefined || positiveInteger(item.egress_attestation_version)) &&
      (item.egress_attestation_status === undefined || ["verified", "missing", "invalid"].includes(String(item.egress_attestation_status)))) &&
    resources.every((item) => object(item) && canonical(item.resource_id) && canonical(item.resource_kind) &&
      ["active", "stopping", "terminal"].includes(String(item.status)) &&
      (item.expected_status === undefined ||
        ["active", "terminal"].includes(String(item.expected_status))));
}

function actionShape(value: unknown): value is RuntimeSoakAction {
  if (!object(value) || !canonical(value.action_id) || !REQUIRED_ACTION_KINDS.includes(value.kind as RuntimeSoakActionKind) ||
    !nonNegativeInteger(value.at_ms)) return false;
  return value.kind === "recovery"
    ? ["runtime", "cleanup", "provider", "sandbox", "gateway"].includes(String(value.recovers))
    : value.recovers === undefined;
}

function arrays(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => Array.isArray(value[key]));
}

function authority() {
  return {
    operational_test_evidence: true as const,
    evaluation_authority: false as const,
    promotion_authority: false as const,
    order_submission_authority: false as const,
    private_exchange_authority: false as const,
    live_exchange_authority: false as const,
    authority_status: "operational_test_only" as const
  };
}

function failure(kind: RuntimeSoakInvariantKind, subject: string, detail: string): RuntimeSoakInvariantFailure {
  return { kind, subject, detail };
}

function digestWithout(value: object, key: string): string {
  const payload = { ...(value as Record<string, unknown>) };
  delete payload[key];
  return `sha256:${createHash("sha256").update(canonicalJson(payload)).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  ).join(",")}}`;
  return JSON.stringify(value);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonical(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 240 && value.trim() === value;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function exactIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

function pendingDigest(): string { return `sha256:${"0".repeat(64)}`; }
function scenarioInvalid(message: string) { return new RuntimeSoakError("runtime_soak_scenario_invalid", message); }
function reportInvalid(message: string) { return new RuntimeSoakError("runtime_soak_report_invalid", message); }
