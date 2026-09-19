import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScopedRefreshQueue } from "./scoped-refresh-queue";
import { invoke } from "@tauri-apps/api/core";
import {
  readCompanyComposition,
  validateComposition,
  type CompanyComposition,
  type ModuleDefinition,
} from "@/contracts/modules";
import type { CompositionActivationContext } from "@/modules/ModuleSettings";
import {
  publishedDocuments,
  type CatalogScope,
  type PublishedDocument,
} from "./catalog";
import { record, rows, str, type JsonRecord, type LiveSnapshot } from "./live";

const CONFIGURATION_PATH = "company-ui.json";
const LIMIT = 256 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface ConfigurationIdentity {
  environment: string;
  company: string;
  owner: string;
}
export interface ConfigurationCandidate {
  workspace: string;
  label: string;
  scope: CatalogScope;
  revision: number;
}
export interface ObservedConfiguration {
  composition: CompanyComposition;
  file: PublishedDocument;
  label: string;
  pendingPublication: boolean;
  writable: boolean;
}
export interface ConfigurationTransport {
  workspace(scope: CatalogScope, workspace: string): Promise<unknown>;
  read(file: PublishedDocument): Promise<unknown>;
  prepare(content: string): Promise<unknown>;
  upload(
    scope: CatalogScope,
    key: string,
    size: number,
    sha256: string,
  ): Promise<unknown>;
  content(
    scope: CatalogScope,
    upload: string,
    content: string,
  ): Promise<unknown>;
  publish(
    scope: CatalogScope,
    key: string,
    workspace: string,
    revision: number,
    files: Record<string, string>,
  ): Promise<unknown>;
  receipt(
    scope: CatalogScope,
    intent: string,
    reconcile: boolean,
  ): Promise<unknown>;
}
/** Every native scoped operation remains bound to the environment that started this flow. */
export function nativeTransport(
  identity: ConfigurationIdentity,
  connectionGeneration: string | undefined,
): ConfigurationTransport {
  const environment = identity.environment;
  const boundScope = (scope: CatalogScope) => ({
    ...scope,
    expected_environment_id: environment,
    connection_generation: connectionGeneration,
  });
  return {
    workspace: (scope, workspaceId) =>
      invoke("catalog_workspace", { scope: boundScope(scope), workspaceId }),
    read: (file) =>
      invoke("read_artifact", {
        artifact: {
          workspace_id: file.workspace,
          revision: file.revision,
          path: file.path,
          ...file.scope,
          expected_environment_id: environment,
          connection_generation: connectionGeneration,
        },
      }),
    prepare: (content) => invoke("prepare_catalog_upload", { content }),
    upload: (scope, requestKey, size, sha256) =>
      invoke("catalog_upload", {
        scope: boundScope(scope),
        requestKey,
        size,
        sha256,
      }),
    content: (scope, uploadId, content) =>
      invoke("catalog_upload_content", {
        scope: boundScope(scope),
        uploadId,
        content,
      }),
    publish: (scope, requestKey, workspaceId, expectedRevision, files) =>
      invoke("catalog_publish", {
        scope: boundScope(scope),
        requestKey,
        workspaceId,
        expectedRevision,
        files,
      }),
    receipt: (scope, intentId, reconcile) =>
      invoke("catalog_resource_receipt", {
        scope: boundScope(scope),
        intentId,
        reconcile,
      }),
  };
}
export type ConfigurationStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;
export function configurationIdentity(
  snapshot: Pick<LiveSnapshot, "environment_id" | "conditions">,
): ConfigurationIdentity {
  const environment = snapshot.environment_id,
    company = snapshot.conditions.firm_id,
    owner = snapshot.conditions.principal_id;
  if (
    typeof environment !== "string" ||
    !environment ||
    typeof company !== "string" ||
    !uuid.test(company) ||
    typeof owner !== "string" ||
    !uuid.test(owner)
  )
    throw new Error(
      "The environment and company identity must be observed before selecting company configuration.",
    );
  return { environment, company, owner };
}
export function configurationKey(identity: ConfigurationIdentity) {
  return `ouroboros.company-configuration.v1.${[identity.environment, identity.company, identity.owner].map(encodeURIComponent).join(".")}`;
}
function validScope(scope: CatalogScope) {
  return (
    uuid.test(scope.work_id) &&
    uuid.test(scope.delegation_id) &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(scope.target_id)
  );
}
export function configurationCandidates(
  snapshot: LiveSnapshot,
): ConfigurationCandidate[] {
  const candidates = new Map<string, ConfigurationCandidate>();
  for (const file of publishedDocuments(snapshot)) {
    if (
      file.path !== CONFIGURATION_PATH ||
      !uuid.test(file.workspace) ||
      !validScope(file.scope) ||
      !Number.isSafeInteger(file.revision) ||
      file.revision < 1
    )
      continue;
    const workspace = snapshot.observations
      .flatMap((observation) => rows(record(observation.workspaces).items))
      .find((workspace) => workspace.workspace_id === file.workspace);
    const work = rows(snapshot.work.items).find(
      (work) => work.id === file.scope.work_id,
    );
    candidates.set(file.workspace, {
      workspace: file.workspace,
      label: str(workspace?.label, str(work?.purpose, "Company configuration")),
      scope: file.scope,
      revision: file.revision,
    });
  }
  return [...candidates.values()];
}
function manifest(
  publication: JsonRecord,
  workspace: string,
  revision: number,
): Record<string, string> {
  if (
    publication.files_complete !== true ||
    !Array.isArray(publication.files) ||
    publication.files.length > 128 ||
    publication.file_count !== publication.files.length
  )
    throw new Error(
      "The complete published file list is required before changing this configuration.",
    );
  const result: Record<string, string> = Object.create(null);
  for (const file of rows(publication.files)) {
    const path = file.path,
      upload = file.upload_id;
    if (
      typeof path !== "string" ||
      !path ||
      path.includes("\\") ||
      path.includes("\0") ||
      path.split("/").some((part) => !part || part === "." || part === "..") ||
      Object.hasOwn(result, path) ||
      typeof upload !== "string" ||
      !uuid.test(upload) ||
      file.workspace_id !== workspace ||
      file.revision !== revision
    )
      throw new Error(
        "The observed publication manifest is incomplete or inconsistent.",
      );
    result[path] = upload;
  }
  return result;
}
function observedFile(
  value: unknown,
  candidate: ConfigurationCandidate,
): { file: PublishedDocument; writable: boolean; label: string } {
  const workspace = record(value),
    observation = record(workspace.publication_observation),
    publication = record(observation.latest_confirmed_publication);
  if (
    workspace.workspace_id !== candidate.workspace ||
    workspace.work_id !== candidate.scope.work_id ||
    workspace.target_id !== candidate.scope.target_id ||
    observation.source !== "core_publication_records" ||
    !Number.isSafeInteger(publication.revision) ||
    Number(publication.revision) < 1 ||
    !uuid.test(str(publication.intent_id, "")) ||
    publication.retirement_state === "confirmed"
  )
    throw new Error(
      "A current confirmed publication is unavailable for the selected workspace.",
    );
  const files = manifest(
    publication,
    candidate.workspace,
    Number(publication.revision),
  );
  if (!Object.hasOwn(files, CONFIGURATION_PATH))
    throw new Error(
      "The selected workspace no longer publishes company-ui.json.",
    );
  return {
    file: {
      workspace: candidate.workspace,
      revision: Number(publication.revision),
      path: CONFIGURATION_PATH,
      scope: candidate.scope,
      publication,
      observation,
    },
    writable:
      workspace.state === "active" &&
      publication.retirement_state === "none_recorded",
    label: str(workspace.label, candidate.label),
  };
}
export function hasPendingPublication(file: PublishedDocument) {
  // Missing evidence is not the same as an observed absence of pending effects.
  return (
    file.observation.has_pending_publication !== false ||
    file.observation.pending_has_more !== false ||
    !Array.isArray(file.observation.pending_publications) ||
    file.observation.pending_publications.length !== 0
  );
}
function parseDocument(
  value: unknown,
  file: PublishedDocument,
  company: string,
) {
  const reply = record(value),
    content = reply.content;
  if (
    reply.workspace_id !== file.workspace ||
    reply.revision !== file.revision ||
    reply.path !== file.path ||
    reply.target_id !== file.scope.target_id ||
    typeof content !== "string" ||
    new TextEncoder().encode(content).byteLength > LIMIT ||
    reply.size !== new TextEncoder().encode(content).byteLength ||
    !/^[a-f0-9]{64}$/.test(str(reply.sha256, ""))
  )
    throw new Error("The exact published configuration could not be verified.");
  const composition = readCompanyComposition(JSON.parse(content), company);
  // The document's self-declared provenance is not the observed Catalog publication.
  delete composition.publication;
  return { composition, content, sha256: str(reply.sha256) };
}
export async function loadCompanyConfiguration(
  candidate: ConfigurationCandidate,
  identity: ConfigurationIdentity,
  transport: ConfigurationTransport,
): Promise<ObservedConfiguration> {
  const observed = observedFile(
    await transport.workspace(candidate.scope, candidate.workspace),
    candidate,
  );
  const { composition } = parseDocument(
    await transport.read(observed.file),
    observed.file,
    identity.company,
  );
  return {
    ...observed,
    composition,
    pendingPublication: hasPendingPublication(observed.file),
  };
}
function encodedConfiguration(
  candidate: CompanyComposition,
  identity: ConfigurationIdentity,
  modules: readonly ModuleDefinition[],
) {
  const validated = validateComposition(candidate, identity.company, modules);
  delete validated.publication;
  const content = JSON.stringify(validated);
  if (new TextEncoder().encode(content).byteLength > LIMIT)
    throw new Error("The company configuration exceeds 256 KB.");
  return content;
}
export interface PendingConfiguration {
  schemaVersion: 1;
  identity: ConfigurationIdentity;
  workspace: string;
  label: string;
  scope: CatalogScope;
  requestKey: string;
  expectedCompanyRevision: number;
  expectedCatalogRevision: number;
  baseFiles: Record<string, string>;
  content: string;
  size: number;
  sha256: string;
  stage:
    | "upload-admission"
    | "upload-content"
    | "upload-complete"
    | "publication"
    | "observation";
  uploadIntent?: string;
  publicationIntent?: string;
}
function pendingKey(identity: ConfigurationIdentity) {
  return `${configurationKey(identity)}.pending`;
}
export function readPendingConfiguration(
  storage: ConfigurationStorage,
  identity: ConfigurationIdentity,
): PendingConfiguration | null {
  const raw = storage.getItem(pendingKey(identity));
  if (!raw) return null;
  const p = record(JSON.parse(raw));
  const scope = record(p.scope) as unknown as CatalogScope;
  if (
    p.schemaVersion !== 1 ||
    JSON.stringify(p.identity) !== JSON.stringify(identity) ||
    !uuid.test(str(p.workspace, "")) ||
    !validScope(scope) ||
    typeof p.requestKey !== "string" ||
    !/^[\x21-\x7e]{1,110}$/.test(p.requestKey) ||
    typeof p.content !== "string" ||
    new TextEncoder().encode(p.content).byteLength !== p.size ||
    Number(p.size) > LIMIT ||
    !/^[a-f0-9]{64}$/.test(str(p.sha256, "")) ||
    !Number.isSafeInteger(p.expectedCompanyRevision) ||
    Number(p.expectedCompanyRevision) < 1 ||
    !Number.isSafeInteger(p.expectedCatalogRevision) ||
    Number(p.expectedCatalogRevision) < 1 ||
    ![
      "upload-admission",
      "upload-content",
      "upload-complete",
      "publication",
      "observation",
    ].includes(str(p.stage, "")) ||
    (p.uploadIntent !== undefined && !uuid.test(str(p.uploadIntent, ""))) ||
    (p.publicationIntent !== undefined &&
      !uuid.test(str(p.publicationIntent, "")))
  )
    throw new Error(
      "The retained configuration request is invalid. It has not been submitted again.",
    );
  readCompanyComposition(JSON.parse(p.content), identity.company);
  const files = record(p.baseFiles);
  manifest(
    {
      files_complete: true,
      file_count: Object.keys(files).length,
      files: Object.entries(files).map(([path, upload_id]) => ({
        path,
        upload_id,
        workspace_id: p.workspace,
        revision: p.expectedCatalogRevision,
      })),
    },
    str(p.workspace),
    Number(p.expectedCatalogRevision),
  );
  return p as unknown as PendingConfiguration;
}
function fixedRequest(p: PendingConfiguration) {
  return JSON.stringify({
    identity: p.identity,
    workspace: p.workspace,
    scope: p.scope,
    requestKey: p.requestKey,
    expectedCompanyRevision: p.expectedCompanyRevision,
    expectedCatalogRevision: p.expectedCatalogRevision,
    baseFiles: p.baseFiles,
    content: p.content,
    size: p.size,
    sha256: p.sha256,
  });
}
function retain(storage: ConfigurationStorage, pending: PendingConfiguration) {
  const previous = readPendingConfiguration(storage, pending.identity);
  if (
    previous &&
    (fixedRequest(previous) !== fixedRequest(pending) ||
      (previous.uploadIntent &&
        previous.uploadIntent !== pending.uploadIntent) ||
      (previous.publicationIntent &&
        previous.publicationIntent !== pending.publicationIntent))
  )
    throw new Error(
      "The original configuration request must remain unchanged.",
    );
  storage.setItem(pendingKey(pending.identity), JSON.stringify(pending));
}
function receipt(
  value: unknown,
  pending: PendingConfiguration,
  operation: "file.upload" | "file.publish",
  intent: string,
) {
  const admission = record(value),
    reply = record(admission.reply),
    evidence = record(reply.receipt);
  if (
    admission.intent_id !== intent ||
    admission.target !== pending.scope.target_id ||
    admission.operation !== operation ||
    admission.state !== "succeeded" ||
    typeof reply.status !== "number" ||
    reply.status < 200 ||
    reply.status >= 300 ||
    reply.content_type !== "application/json" ||
    typeof reply.body !== "string" ||
    evidence.source !== "catalog"
  )
    throw new Error("The original resource effect is not confirmed.");
  const body = record(JSON.parse(reply.body));
  if (body.intent_id !== intent)
    throw new Error("The receipt does not match the original request.");
  if (operation === "file.upload") {
    if (
      body.upload_id !== intent ||
      body.sha256 !== pending.sha256 ||
      evidence.upload_receipt !== intent ||
      evidence.sha256 !== pending.sha256 ||
      evidence.size !== pending.size
    )
      throw new Error("The upload receipt does not match the fixed content.");
  } else if (
    record(admission.workspace).workspace_id !== pending.workspace ||
    body.revision !== pending.expectedCatalogRevision + 1 ||
    evidence.publication_receipt !== intent ||
    evidence.revision !== pending.expectedCatalogRevision + 1
  )
    throw new Error(
      "The publication receipt does not match the original workspace and revision.",
    );
}
export function publicationFiles(pending: PendingConfiguration) {
  if (!pending.uploadIntent)
    throw new Error("The original upload reference is missing.");
  return { ...pending.baseFiles, [CONFIGURATION_PATH]: pending.uploadIntent };
}
async function confirmPublication(
  pending: PendingConfiguration,
  transport: ConfigurationTransport,
  storage: ConfigurationStorage,
): Promise<ObservedConfiguration> {
  if (!pending.publicationIntent)
    throw new Error(
      "The publication response did not reveal its original intent. It cannot be resubmitted automatically.",
    );
  receipt(
    await transport.receipt(pending.scope, pending.publicationIntent, false),
    pending,
    "file.publish",
    pending.publicationIntent,
  );
  const originalRevision = pending.expectedCatalogRevision + 1;
  const originalFile: PublishedDocument = {
    workspace: pending.workspace,
    revision: originalRevision,
    path: CONFIGURATION_PATH,
    scope: pending.scope,
    publication: {
      intent_id: pending.publicationIntent,
      revision: originalRevision,
    },
    observation: { source: "original_resource_receipt" },
  };
  const original = parseDocument(
    await transport.read(originalFile),
    originalFile,
    pending.identity.company,
  );
  if (
    original.content !== pending.content ||
    original.sha256 !== pending.sha256
  )
    throw new Error(
      "The published configuration does not match the fixed request content.",
    );
  // This request is finished even if another publication has since replaced the current head.
  // The original receipt plus exact original bytes is the completion evidence, never the new head.
  storage.removeItem(pendingKey(pending.identity));

  const ref = {
    workspace: pending.workspace,
    label: pending.label,
    scope: pending.scope,
    revision: originalRevision,
  };
  const observed = observedFile(
    await transport.workspace(pending.scope, pending.workspace),
    ref,
  );
  if (observed.file.revision < originalRevision)
    throw new Error(
      "The request completed, but the latest workspace observation is older than its confirmed publication.",
    );
  if (observed.file.revision === originalRevision) {
    const files = manifest(
      observed.file.publication,
      pending.workspace,
      originalRevision,
    );
    if (
      observed.file.publication.intent_id !== pending.publicationIntent ||
      JSON.stringify(Object.entries(files).sort()) !==
        JSON.stringify(Object.entries(publicationFiles(pending)).sort())
    )
      throw new Error(
        "The request completed, but current publication metadata is inconsistent with its receipt.",
      );
    return {
      ...observed,
      composition: original.composition,
      pendingPublication: hasPendingPublication(observed.file),
    };
  }
  // Read the newer configuration independently. Never install the superseded candidate as current.
  const latest = parseDocument(
    await transport.read(observed.file),
    observed.file,
    pending.identity.company,
  );
  return {
    ...observed,
    composition: latest.composition,
    pendingPublication: hasPendingPublication(observed.file),
  };
}
interface ActivationOptions {
  identity: ConfigurationIdentity;
  selection: ConfigurationCandidate;
  candidate: CompanyComposition;
  context: CompositionActivationContext;
  modules: readonly ModuleDefinition[];
  storage: ConfigurationStorage;
  transport: ConfigurationTransport;
}
async function publishPrepared(
  pending: PendingConfiguration,
  storage: ConfigurationStorage,
  transport: ConfigurationTransport,
) {
  const current = await loadCompanyConfiguration(
    {
      workspace: pending.workspace,
      label: pending.label,
      scope: pending.scope,
      revision: pending.expectedCatalogRevision,
    },
    pending.identity,
    transport,
  );
  if (
    current.pendingPublication ||
    !current.writable ||
    current.file.revision !== pending.expectedCatalogRevision ||
    current.composition.revision !== pending.expectedCompanyRevision ||
    JSON.stringify(
      Object.entries(
        manifest(
          current.file.publication,
          pending.workspace,
          current.file.revision,
        ),
      ).sort(),
    ) !== JSON.stringify(Object.entries(pending.baseFiles).sort())
  )
    throw new Error(
      "The current configuration or publication changed before publishing. The prepared upload is retained.",
    );
  const submitted: PendingConfiguration = { ...pending, stage: "publication" };
  retain(storage, submitted); // Persist before crossing the effect boundary.
  const reply = record(
    await transport.publish(
      pending.scope,
      `${pending.requestKey}-publish`,
      pending.workspace,
      pending.expectedCatalogRevision,
      publicationFiles(pending),
    ),
  );
  if (!uuid.test(str(reply.intent_id, "")))
    throw new Error(
      "The publication outcome is unresolved; its request has not been repeated.",
    );
  const observed: PendingConfiguration = {
    ...submitted,
    stage: "observation",
    publicationIntent: str(reply.intent_id),
  };
  retain(storage, observed);
  return confirmPublication(observed, transport, storage);
}
export async function activateCompanyConfiguration(
  options: ActivationOptions,
): Promise<ObservedConfiguration> {
  const {
    identity,
    selection,
    candidate,
    context,
    modules,
    storage,
    transport,
  } = options;
  if (readPendingConfiguration(storage, identity))
    throw new Error(
      "An earlier configuration request must be checked before another change.",
    );
  if (!/^[\x21-\x7e]{1,110}$/.test(context.requestKey))
    throw new Error("A bounded stable request key is required.");
  const current = await loadCompanyConfiguration(
    selection,
    identity,
    transport,
  );
  if (current.pendingPublication || !current.writable)
    throw new Error(
      "The selected workspace has pending effects or is not writable.",
    );
  if (
    current.composition.revision !== context.expectedRevision ||
    candidate.revision <= current.composition.revision
  )
    throw new Error(
      "The company configuration changed. Refresh it before activating this candidate.",
    );
  const content = encodedConfiguration(candidate, identity, modules),
    prepared = record(await transport.prepare(content));
  if (
    prepared.size !== new TextEncoder().encode(content).byteLength ||
    !/^[a-f0-9]{64}$/.test(str(prepared.sha256, ""))
  )
    throw new Error("The fixed document bytes could not be prepared.");
  let pending: PendingConfiguration = {
    schemaVersion: 1,
    identity,
    workspace: selection.workspace,
    label: current.label,
    scope: selection.scope,
    requestKey: context.requestKey,
    expectedCompanyRevision: current.composition.revision,
    expectedCatalogRevision: current.file.revision,
    baseFiles: manifest(
      current.file.publication,
      selection.workspace,
      current.file.revision,
    ),
    content,
    size: Number(prepared.size),
    sha256: str(prepared.sha256),
    stage: "upload-admission",
  };
  retain(storage, pending);
  const admitted = record(
    await transport.upload(
      pending.scope,
      `${pending.requestKey}-upload`,
      pending.size,
      pending.sha256,
    ),
  );
  if (
    !uuid.test(str(admitted.upload_id, "")) ||
    admitted.intent_id !== admitted.upload_id
  )
    throw new Error(
      "The upload admission outcome is unresolved. No replacement upload has been started.",
    );
  pending = {
    ...pending,
    stage: "upload-content",
    uploadIntent: str(admitted.upload_id),
  };
  retain(storage, pending);
  await transport.content(
    pending.scope,
    pending.uploadIntent!,
    pending.content,
  );
  receipt(
    await transport.receipt(pending.scope, pending.uploadIntent!, false),
    pending,
    "file.upload",
    pending.uploadIntent!,
  );
  pending = { ...pending, stage: "upload-complete" };
  retain(storage, pending);
  return publishPrepared(pending, storage, transport);
}
export async function reconcileCompanyConfiguration(
  identity: ConfigurationIdentity,
  storage: ConfigurationStorage,
  reconcile: boolean,
  transport: ConfigurationTransport,
): Promise<ObservedConfiguration | null> {
  let pending = readPendingConfiguration(storage, identity);
  if (!pending) return null;
  const intent = pending.publicationIntent ?? pending.uploadIntent;
  if (!intent)
    throw new Error(
      "The response did not reveal the original intent. This connection cannot look up a resource by request key, so it has not been submitted again.",
    );
  if (reconcile) await transport.receipt(pending.scope, intent, true);
  if (pending.publicationIntent)
    return confirmPublication(pending, transport, storage);
  receipt(
    await transport.receipt(pending.scope, intent, false),
    pending,
    "file.upload",
    intent,
  );
  if (pending.stage === "publication")
    throw new Error(
      "The upload is confirmed, but the publication's original intent is unknown. No publication has been resubmitted.",
    );
  pending = { ...pending, stage: "upload-complete" };
  retain(storage, pending);
  return null; // Upload confirmation alone never activates company configuration.
}
export async function continueCompanyPublication(
  identity: ConfigurationIdentity,
  storage: ConfigurationStorage,
  transport: ConfigurationTransport,
) {
  const pending = readPendingConfiguration(storage, identity);
  if (
    !pending ||
    pending.stage !== "upload-complete" ||
    !pending.uploadIntent ||
    pending.publicationIntent
  )
    throw new Error(
      "There is no verified upload awaiting its first publication submission.",
    );
  receipt(
    await transport.receipt(pending.scope, pending.uploadIntent, false),
    pending,
    "file.upload",
    pending.uploadIntent,
  );
  return publishPrepared(pending, storage, transport);
}

interface ConfigurationViewState {
  key: string;
  selectedWorkspace: string;
  observed: ObservedConfiguration | null;
  pending: PendingConfiguration | null;
  busy: boolean;
  error: string;
}
const emptyState = (key: string): ConfigurationViewState => ({
  key,
  selectedWorkspace: "",
  observed: null,
  pending: null,
  busy: false,
  error: "",
});
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Company configuration could not be observed. No request was automatically repeated.";
/** Mount once at the connected workspace boundary. Company pages consume current, never local JSON. */
export function useCompanyConfiguration(
  snapshot: LiveSnapshot,
  moduleSource:
    readonly ModuleDefinition[] | (() => readonly ModuleDefinition[]),
) {
  const availableModules = () =>
    typeof moduleSource === "function" ? moduleSource() : moduleSource;
  const environment_id = snapshot.environment_id,
    firm_id = snapshot.conditions.firm_id,
    principal_id = snapshot.conditions.principal_id;
  const identity = useMemo(() => {
    try {
      return configurationIdentity({
        environment_id,
        conditions: { firm_id, principal_id },
      });
    } catch {
      return null;
    }
  }, [environment_id, firm_id, principal_id]);
  const transport = useMemo(
    () =>
      identity
        ? nativeTransport(identity, snapshot.connection_generation)
        : null,
    [identity, snapshot.connection_generation],
  );
  const key = identity ? configurationKey(identity) : "unconnected";
  const candidatesJSON = JSON.stringify(configurationCandidates(snapshot));
  const candidates = useMemo(
    () => JSON.parse(candidatesJSON) as ConfigurationCandidate[],
    [candidatesJSON],
  );
  const [state, setState] = useState<ConfigurationViewState>(() =>
    emptyState(key),
  );
  const activity = useRef(new ScopedRefreshQueue());
  const visible = state.key === key ? state : emptyState(key);

  const refresh = useCallback(
    async (reconcile = false) => {
      if (!identity || !transport) return;
      const ticket = activity.current.begin();
      if (!ticket) return;
      let selectedWorkspace = "",
        observed: ObservedConfiguration | null = null,
        pending: PendingConfiguration | null = null,
        error = "";
      setState((previous) => ({
        ...(previous.key === key ? previous : emptyState(key)),
        busy: true,
        error: "",
      }));
      try {
        selectedWorkspace = localStorage.getItem(key) ?? "";
        if (selectedWorkspace && !uuid.test(selectedWorkspace))
          throw new Error(
            "The saved workspace reference is invalid. Select an observed workspace again.",
          );
        pending = readPendingConfiguration(localStorage, identity);
        if (pending) {
          try {
            const completed = await reconcileCompanyConfiguration(
              identity,
              localStorage,
              reconcile,
              transport,
            );
            if (completed && completed.file.workspace === selectedWorkspace)
              observed = completed;
          } catch (problem) {
            error = message(problem);
          }
          pending = readPendingConfiguration(localStorage, identity);
        }
        if (selectedWorkspace && !observed) {
          const selection = candidates.find(
            (candidate) => candidate.workspace === selectedWorkspace,
          );
          if (!selection)
            throw new Error(
              "The selected workspace is outside the current observations. Its saved reference is retained.",
            );
          observed = await loadCompanyConfiguration(
            selection,
            identity,
            transport,
          );
        }
      } catch (problem) {
        error = message(problem);
      } finally {
        if (activity.current.isCurrent(ticket))
          setState((previous) => ({
            key,
            selectedWorkspace,
            observed:
              observed ??
              (error &&
              previous.key === key &&
              previous.selectedWorkspace === selectedWorkspace
                ? previous.observed
                : null),
            pending,
            busy: false,
            error,
          }));
        activity.current.finish(ticket);
      }
    },
    [identity, key, candidates, transport],
  );

  useEffect(() => {
    const queue = activity.current;
    // Only identity changes/unmount invalidate in-flight state delivery.
    return () => queue.invalidate();
  }, [key, snapshot.connection_generation]);
  useEffect(() => {
    // Candidate changes queue one latest read after an active operation completes.
    activity.current.request(() => {
      void refresh(false);
    });
  }, [refresh]);

  async function select(workspace: string) {
    if (!identity || !transport || activity.current.isBusy) return;
    if (readPendingConfiguration(localStorage, identity))
      throw new Error(
        "Check the retained configuration request before switching its workspace.",
      );
    const selection = candidates.find(
      (candidate) => candidate.workspace === workspace,
    );
    if (!selection)
      throw new Error("Choose a workspace from the observed publications.");
    const ticket = activity.current.begin();
    if (!ticket) return;
    setState((previous) => ({
      ...(previous.key === key ? previous : emptyState(key)),
      busy: true,
      error: "",
    }));
    try {
      const observed = await loadCompanyConfiguration(
        selection,
        identity,
        transport,
      );
      // The only durable display preference is a reference, never a second company configuration.
      localStorage.setItem(key, workspace);
      if (activity.current.isCurrent(ticket))
        setState({
          key,
          selectedWorkspace: workspace,
          observed,
          pending: null,
          busy: false,
          error: "",
        });
    } catch (error) {
      if (activity.current.isCurrent(ticket))
        setState((previous) => ({
          ...previous,
          busy: false,
          error: message(error),
        }));
    } finally {
      activity.current.finish(ticket);
    }
  }
  async function activate(
    candidate: CompanyComposition,
    context: CompositionActivationContext,
  ) {
    if (!identity || !transport || activity.current.isBusy)
      throw new Error("Company configuration is not ready for a change.");
    const selection = candidates.find(
      (candidate) => candidate.workspace === visible.selectedWorkspace,
    );
    if (!selection)
      throw new Error("Select an observed company configuration first.");
    const ticket = activity.current.begin();
    if (!ticket)
      throw new Error(
        "A company configuration operation is already in progress.",
      );
    setState((previous) => ({ ...previous, busy: true, error: "" }));
    try {
      const observed = await activateCompanyConfiguration({
        identity,
        selection,
        candidate,
        context,
        modules: availableModules(),
        storage: localStorage,
        transport,
      });
      if (activity.current.isCurrent(ticket))
        setState({
          key,
          selectedWorkspace: selection.workspace,
          observed,
          pending: null,
          busy: false,
          error: "",
        });
      return observed.composition;
    } catch (error) {
      let pending: PendingConfiguration | null = null;
      try {
        pending = readPendingConfiguration(localStorage, identity);
      } catch {
        /* Invalid retained data blocks future submission. */
      }
      if (activity.current.isCurrent(ticket))
        setState((previous) => ({
          ...previous,
          busy: false,
          pending,
          error: message(error),
        }));
      throw error;
    } finally {
      activity.current.finish(ticket);
    }
  }
  async function continuePublication() {
    if (!identity || !transport || activity.current.isBusy) return;
    const ticket = activity.current.begin();
    if (!ticket) return;
    setState((previous) => ({ ...previous, busy: true, error: "" }));
    try {
      const pending = readPendingConfiguration(localStorage, identity);
      if (!pending) throw new Error("No original request is retained.");
      validateComposition(
        JSON.parse(pending.content),
        identity.company,
        availableModules(),
      );
      const observed = await continueCompanyPublication(
        identity,
        localStorage,
        transport,
      );
      if (activity.current.isCurrent(ticket))
        setState({
          key,
          selectedWorkspace: observed.file.workspace,
          observed,
          pending: null,
          busy: false,
          error: "",
        });
    } catch (error) {
      if (activity.current.isCurrent(ticket))
        setState((previous) => ({
          ...previous,
          busy: false,
          pending: readPendingConfiguration(localStorage, identity),
          error: message(error),
        }));
    } finally {
      activity.current.finish(ticket);
    }
  }
  return {
    identity,
    modules: availableModules(),
    candidates,
    ...visible,
    current: visible.observed?.composition ?? null,
    canActivate:
      !!identity &&
      !!visible.observed?.writable &&
      !visible.observed.pendingPublication &&
      !visible.pending &&
      !visible.busy &&
      !visible.error,
    error: identity
      ? visible.error
      : "The connected environment and company identity are not available.",
    refresh: () => refresh(false),
    checkPending: () => refresh(true),
    select,
    activate,
    continuePublication,
  };
}
export type CompanyConfigurationController = ReturnType<
  typeof useCompanyConfiguration
>;
