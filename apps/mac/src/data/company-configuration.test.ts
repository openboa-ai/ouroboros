import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import {
  activateCompanyConfiguration,
  configurationIdentity,
  configurationKey,
  continueCompanyPublication,
  loadCompanyConfiguration,
  nativeTransport,
  readPendingConfiguration,
  reconcileCompanyConfiguration,
  type ConfigurationIdentity,
  type ConfigurationStorage,
  type ConfigurationTransport,
} from "./company-configuration";
import type { CompanyComposition, ModuleDefinition } from "@/contracts/modules";
import type { LiveSnapshot } from "./live";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const identity: ConfigurationIdentity = {
  environment: "gateway-a",
  company: id(1),
  owner: id(2),
};
const scope = { work_id: id(3), delegation_id: id(4), target_id: "catalog" };
const selection = {
  workspace: id(5),
  label: "Company views",
  scope,
  revision: 2,
};
const original: CompanyComposition = {
  schemaVersion: 1,
  companyId: identity.company,
  revision: 1,
  author: "Agent",
  pages: [
    {
      id: "pulse",
      title: "Pulse",
      module: "agent-pulse",
      widgets: [
        { id: "summary", widget: "agent-pulse.summary", size: "small" },
      ],
    },
  ],
};
const candidate: CompanyComposition = {
  ...original,
  revision: 2,
  pages: [{ ...original.pages[0], title: "Updated pulse" }],
};
const modules: ModuleDefinition[] = [
  {
    id: "agent-pulse",
    name: "Company pulse",
    version: "1",
    pages: [],
    widgets: [
      {
        id: "agent-pulse.summary",
        title: "Summary",
        description: "",
        provider: "Company",
        sizes: ["small"],
        Component: () => null,
      },
    ],
  },
];
const hash = (content: string) =>
  createHash("sha256").update(content).digest("hex");
function memory(): ConfigurationStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
function fixture() {
  const calls: string[] = [],
    storage = memory();
  let content = "",
    published = false,
    confirmed = true,
    lostPublication = false,
    lostUpload = false,
    pending = false,
    complete = true,
    lostContent = false;
  let publishedFiles: Record<string, string> | null = null;
  const manifest = (revision: number) => [
    {
      workspace_id: selection.workspace,
      revision,
      path: "company-ui.json",
      upload_id: published ? id(8) : id(6),
    },
    {
      workspace_id: selection.workspace,
      revision,
      path: "CompanyPulse.tsx",
      upload_id: id(7),
    },
  ];
  const workspace = () => ({
    workspace_id: selection.workspace,
    work_id: scope.work_id,
    target_id: scope.target_id,
    label: selection.label,
    state: "active",
    publication_observation: {
      source: "core_publication_records",
      has_pending_publication: pending,
      pending_has_more: false,
      pending_publications: pending ? [{ intent_id: id(99) }] : [],
      latest_confirmed_publication: {
        intent_id: published ? id(9) : id(10),
        revision: published ? 3 : 2,
        retirement_state: "none_recorded",
        file_count: 2,
        files_complete: complete,
        files: manifest(published ? 3 : 2),
      },
    },
  });
  const transport: ConfigurationTransport = {
    workspace: async () => {
      calls.push("workspace");
      return workspace();
    },
    read: async (file) => {
      calls.push(`read:${file.revision}`);
      const bytes = file.revision === 2 ? JSON.stringify(original) : content;
      return {
        workspace_id: file.workspace,
        revision: file.revision,
        path: file.path,
        target_id: scope.target_id,
        size: new TextEncoder().encode(bytes).byteLength,
        sha256: hash(bytes),
        content: bytes,
      };
    },
    prepare: async (bytes) => {
      calls.push("prepare");
      return {
        size: new TextEncoder().encode(bytes).byteLength,
        sha256: hash(bytes),
      };
    },
    upload: async () => {
      calls.push("upload");
      if (lostUpload) throw new Error("Reply lost");
      return { upload_id: id(8), intent_id: id(8), state: "accepted" };
    },
    content: async (_scope, _id, bytes) => {
      calls.push("content");
      content = bytes;
      if (lostContent) throw new Error("Content reply lost");
      return { intent_id: id(8), upload_id: id(8), sha256: hash(bytes) };
    },
    publish: async (_scope, _key, workspace, revision, files) => {
      calls.push("publish");
      expect(workspace).toBe(selection.workspace);
      expect(revision).toBe(2);
      publishedFiles = files;
      published = true;
      if (lostPublication) throw new Error("Publication reply lost");
      return { intent_id: id(9), revision: 3 };
    },
    receipt: async (_scope, intent, reconcile) => {
      calls.push(`receipt:${intent}:${reconcile}`);
      const upload = intent === id(8);
      return {
        intent_id: intent,
        target: scope.target_id,
        operation: upload ? "file.upload" : "file.publish",
        state: upload || confirmed ? "succeeded" : "claimed",
        workspace: upload ? null : { workspace_id: selection.workspace },
        reply: upload
          ? {
              status: 200,
              content_type: "application/json",
              body: JSON.stringify({
                intent_id: intent,
                upload_id: intent,
                sha256: hash(content),
              }),
              receipt: {
                source: "catalog",
                upload_receipt: intent,
                sha256: hash(content),
                size: new TextEncoder().encode(content).byteLength,
              },
            }
          : confirmed
            ? {
                status: 200,
                content_type: "application/json",
                body: JSON.stringify({ intent_id: intent, revision: 3 }),
                receipt: {
                  source: "catalog",
                  publication_receipt: intent,
                  revision: 3,
                },
              }
            : null,
      };
    },
  };
  const activate = (
    extra: Partial<Parameters<typeof activateCompanyConfiguration>[0]> = {},
  ) =>
    activateCompanyConfiguration({
      identity,
      selection,
      candidate,
      context: { expectedRevision: 1, requestKey: "configuration-request" },
      modules,
      storage,
      transport,
      ...extra,
    });
  return {
    calls,
    storage,
    transport,
    activate,
    get files() {
      return publishedFiles;
    },
    set confirmed(value: boolean) {
      confirmed = value;
    },
    set lostPublication(value: boolean) {
      lostPublication = value;
    },
    set lostUpload(value: boolean) {
      lostUpload = value;
    },
    set pending(value: boolean) {
      pending = value;
    },
    set complete(value: boolean) {
      complete = value;
    },
    set lostContent(value: boolean) {
      lostContent = value;
    },
  };
}

describe("connected company configuration", () => {
  it("uses observed company identity and separates environment and owner preferences", () => {
    const snapshot: LiveSnapshot = {
      schema_version: 2,
      source: "gateway",
      environment_id: identity.environment,
      conditions: { firm_id: identity.company, principal_id: identity.owner },
      work: { items: [] },
      observations: [],
      coverage: "Test fixture",
    };
    expect(configurationIdentity(snapshot)).toEqual(identity);
    expect(configurationKey(identity)).not.toBe(
      configurationKey({ ...identity, environment: "gateway-b" }),
    );
    expect(configurationKey(identity)).not.toBe(
      configurationKey({ ...identity, owner: id(55) }),
    );
    expect(() =>
      configurationIdentity({ ...snapshot, environment_id: undefined }),
    ).toThrow(/environment/);
  });
  it("checks exact Gateway bytes and company identity before loading pages", async () => {
    const f = fixture();
    expect(
      (await loadCompanyConfiguration(selection, identity, f.transport))
        .composition,
    ).toEqual(original);
    await expect(
      loadCompanyConfiguration(
        selection,
        { ...identity, company: id(88) },
        f.transport,
      ),
    ).rejects.toThrow(/identity/);
    const transport = {
      ...f.transport,
      read: async () => ({
        content: JSON.stringify(original),
        workspace_id: selection.workspace,
        revision: 99,
      }),
    };
    await expect(
      loadCompanyConfiguration(selection, identity, transport),
    ).rejects.toThrow(/exact published/);
  });
  it("publishes one bounded document while preserving every other manifest upload reference", async () => {
    const f = fixture(),
      result = await f.activate();
    expect(result.composition).toEqual(candidate);
    expect(result.file.revision).toBe(3);
    expect(f.files).toEqual({
      "company-ui.json": id(8),
      "CompanyPulse.tsx": id(7),
    });
    for (const operation of ["upload", "content", "publish"])
      expect(f.calls.filter((call) => call === operation)).toHaveLength(1);
    expect(f.calls).toContain("read:3");
    expect(readPendingConfiguration(f.storage, identity)).toBeNull();
  });
  it("blocks stale company revisions, pending publications, incomplete manifests and unknown modules before uploading", async () => {
    const stale = fixture();
    await expect(
      stale.activate({
        context: { expectedRevision: 9, requestKey: "unchanged" },
      }),
    ).rejects.toThrow(/changed/);
    expect(stale.calls).not.toContain("upload");
    const pending = fixture();
    pending.pending = true;
    await expect(pending.activate()).rejects.toThrow(/pending/);
    expect(pending.calls).not.toContain("upload");
    const incomplete = fixture();
    incomplete.complete = false;
    await expect(incomplete.activate()).rejects.toThrow(/complete/);
    expect(incomplete.calls).not.toContain("upload");
    const missing = fixture();
    await expect(missing.activate({ modules: [] })).rejects.toThrow(
      /unavailable/,
    );
    expect(missing.calls).not.toContain("upload");
  });
  it("does not resolve activation from a publication submission alone", async () => {
    const f = fixture();
    f.confirmed = false;
    await expect(f.activate()).rejects.toThrow(/not confirmed/);
    const pending = readPendingConfiguration(f.storage, identity)!;
    expect(pending.stage).toBe("observation");
    expect(pending.publicationIntent).toBe(id(9));
    expect(JSON.parse(pending.content)).toEqual(candidate);
    await expect(f.activate()).rejects.toThrow(/earlier/);
    f.confirmed = true;
    const observed = await reconcileCompanyConfiguration(
      identity,
      f.storage,
      false,
      f.transport,
    );
    expect(observed?.composition).toEqual(candidate);
    expect(f.calls.filter((call) => call === "publish")).toHaveLength(1);
    expect(readPendingConfiguration(f.storage, identity)).toBeNull();
  });
  it("finishes the exact original publication when a later configuration has superseded it", async () => {
    const f = fixture();
    f.confirmed = false;
    await expect(f.activate()).rejects.toThrow(/not confirmed/);
    const originalWorkspace = f.transport.workspace,
      originalRead = f.transport.read;
    const newer = {
      ...candidate,
      revision: 3,
      pages: [{ ...candidate.pages[0], title: "Newer company decision" }],
    };
    f.transport.workspace = async (...args) => {
      const value = (await originalWorkspace(...args)) as {
        publication_observation: {
          latest_confirmed_publication: {
            revision: number;
            intent_id: string;
            files: Record<string, unknown>[];
          };
        };
      };
      const publication =
        value.publication_observation.latest_confirmed_publication;
      publication.revision = 4;
      publication.intent_id = id(12);
      publication.files = publication.files.map((file) => ({
        ...file,
        revision: 4,
        ...(file.path === "company-ui.json" ? { upload_id: id(11) } : {}),
      }));
      return value;
    };
    f.transport.read = async (file) => {
      const value = (await originalRead(file)) as Record<string, unknown>;
      if (file.revision !== 4) return value;
      const content = JSON.stringify(newer);
      return {
        ...value,
        content,
        size: new TextEncoder().encode(content).byteLength,
        sha256: hash(content),
      };
    };
    f.confirmed = true;
    const observed = await reconcileCompanyConfiguration(
      identity,
      f.storage,
      false,
      f.transport,
    );
    expect(observed?.composition).toEqual(newer);
    expect(observed?.file.revision).toBe(4);
    expect(f.calls.indexOf("read:3")).toBeLessThan(f.calls.indexOf("read:4"));
    expect(readPendingConfiguration(f.storage, identity)).toBeNull();
    expect(f.calls.filter((call) => call === "publish")).toHaveLength(1);
  });
  it("does not substitute a newer head for missing exact original completion evidence", async () => {
    const f = fixture();
    f.confirmed = false;
    await expect(f.activate()).rejects.toThrow(/not confirmed/);
    f.confirmed = true;
    const read = f.transport.read;
    f.transport.read = async (file) => {
      if (file.revision === 3) throw new Error("Original revision unavailable");
      return read(file);
    };
    await expect(
      reconcileCompanyConfiguration(identity, f.storage, false, f.transport),
    ).rejects.toThrow(/Original revision unavailable/);
    expect(
      readPendingConfiguration(f.storage, identity)?.publicationIntent,
    ).toBe(id(9));
    expect(f.calls.filter((call) => call === "publish")).toHaveLength(1);
  });
  it("binds every scoped native call to the environment captured at flow start", async () => {
    vi.mocked(invoke).mockClear();
    const source = { ...identity },
      transport = nativeTransport(source, "connection-1");
    source.environment = "a-different-environment";
    const spoofedScope = {
      ...scope,
      expected_environment_id: "not-the-starting-environment",
      connection_generation: "other-connection",
    };
    await transport.workspace(spoofedScope, selection.workspace);
    await transport.upload(spoofedScope, "upload-key", 2, "a".repeat(64));
    await transport.content(spoofedScope, id(8), "{}");
    await transport.publish(
      spoofedScope,
      "publish-key",
      selection.workspace,
      2,
      { "company-ui.json": id(8) },
    );
    await transport.receipt(spoofedScope, id(9), true);
    await transport.read({
      workspace: selection.workspace,
      revision: 3,
      path: "company-ui.json",
      scope: spoofedScope,
      publication: {},
      observation: {},
    });
    const calls = vi.mocked(invoke).mock.calls;
    expect(calls).toHaveLength(6);
    for (const [command, args] of calls) {
      const value = args as {
        scope?: {
          expected_environment_id: string;
          connection_generation: string;
        };
        artifact?: {
          expected_environment_id: string;
          connection_generation: string;
        };
      };
      expect(
        command === "read_artifact"
          ? value.artifact?.expected_environment_id
          : value.scope?.expected_environment_id,
      ).toBe(identity.environment);
      expect(
        command === "read_artifact"
          ? value.artifact?.connection_generation
          : value.scope?.connection_generation,
      ).toBe("connection-1");
    }
  });
  it("retains an unknown publication outcome and never repeats a request without its original intent", async () => {
    const f = fixture();
    f.lostPublication = true;
    await expect(f.activate()).rejects.toThrow(/reply lost/i);
    const pending = readPendingConfiguration(f.storage, identity)!;
    expect(pending.stage).toBe("publication");
    expect(pending.publicationIntent).toBeUndefined();
    await expect(
      reconcileCompanyConfiguration(identity, f.storage, false, f.transport),
    ).rejects.toThrow(/original intent is unknown/);
    await expect(f.activate()).rejects.toThrow(/earlier/);
    expect(f.calls.filter((call) => call === "publish")).toHaveLength(1);
    expect(readPendingConfiguration(f.storage, identity)?.content).toBe(
      pending.content,
    );
  });
  it("retains the request when exact published bytes differ despite a successful receipt", async () => {
    const f = fixture(),
      originalRead = f.transport.read;
    f.transport.read = async (file) => {
      if (file.revision === 2) return originalRead(file);
      const content = JSON.stringify({
        ...candidate,
        author: "Different content",
      });
      return {
        workspace_id: file.workspace,
        revision: file.revision,
        path: file.path,
        target_id: scope.target_id,
        size: new TextEncoder().encode(content).byteLength,
        sha256: hash(content),
        content,
      };
    };
    await expect(f.activate()).rejects.toThrow(/does not match/);
    expect(
      readPendingConfiguration(f.storage, identity)?.publicationIntent,
    ).toBe(id(9));
  });
  it("does not start an effect when the fixed request cannot be retained", async () => {
    const f = fixture();
    const storage: ConfigurationStorage = {
      ...f.storage,
      setItem: () => {
        throw new Error("Storage unavailable");
      },
    };
    await expect(f.activate({ storage })).rejects.toThrow(
      /Storage unavailable/,
    );
    expect(f.calls).not.toContain("upload");
    expect(f.calls).not.toContain("publish");
  });
  it("never replaces an upload when its admission response is lost", async () => {
    const f = fixture();
    f.lostUpload = true;
    await expect(f.activate()).rejects.toThrow(/reply lost/i);
    await expect(
      reconcileCompanyConfiguration(identity, f.storage, false, f.transport),
    ).rejects.toThrow(/cannot look up/);
    expect(f.calls.filter((call) => call === "upload")).toHaveLength(1);
    expect(f.calls).not.toContain("content");
    expect(f.calls).not.toContain("publish");
  });
  it("can verify a completed upload after a lost reply without publishing until an explicit continuation", async () => {
    const f = fixture();
    f.lostContent = true;
    await expect(f.activate()).rejects.toThrow(/reply lost/i);
    expect(
      await reconcileCompanyConfiguration(
        identity,
        f.storage,
        true,
        f.transport,
      ),
    ).toBeNull();
    expect(readPendingConfiguration(f.storage, identity)?.stage).toBe(
      "upload-complete",
    );
    expect(f.calls).not.toContain("publish");
    expect(
      (await continueCompanyPublication(identity, f.storage, f.transport))
        .composition,
    ).toEqual(candidate);
    expect(f.calls.filter((call) => call === "content")).toHaveLength(1);
    expect(f.calls.filter((call) => call === "publish")).toHaveLength(1);
  });
  it("resumes the original upload with its captured native connection binding", async () => {
    const f = fixture();
    f.lostContent = true;
    await expect(f.activate()).rejects.toThrow(/reply lost/i);
    await reconcileCompanyConfiguration(identity, f.storage, true, f.transport);
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockClear();
    invokeMock.mockImplementationOnce(async (command, args) => {
      expect(command).toBe("catalog_resource_receipt");
      expect(args).toEqual({
        scope: {
          ...scope,
          expected_environment_id: identity.environment,
          connection_generation: "connection-before-resume",
        },
        intentId: id(8),
        reconcile: false,
      });
      throw new Error("Observation unavailable");
    });
    await expect(
      continueCompanyPublication(
        identity,
        f.storage,
        nativeTransport(identity, "connection-before-resume"),
      ),
    ).rejects.toThrow("Observation unavailable");
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(readPendingConfiguration(f.storage, identity)?.uploadIntent).toBe(
      id(8),
    );
    expect(f.calls).not.toContain("publish");
  });
});
