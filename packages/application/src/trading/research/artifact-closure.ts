import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { systemCodeArtifactClosureDigestInput } from "@ouroboros/domain";
import type { TradingSystemManifest } from "./types";

export type TradingArtifactClosureViolationCode =
  | "artifact_closure_manifest_invalid"
  | "artifact_closure_unexpected_entry";

export class TradingArtifactClosureViolationError extends Error {
  readonly candidate_rejection = true;

  constructor(
    readonly code: TradingArtifactClosureViolationCode,
    message: string
  ) {
    super(message);
    this.name = "TradingArtifactClosureViolationError";
  }
}

export interface SealedSingleFileTradingArtifactClosure {
  root: string;
  entrypoint_relative_path: string;
  entrypoint_digest: string;
  closure_digest: string;
  files: Array<{
    relative_path: string;
    bytes: Buffer;
  }>;
}

export async function assertSingleFileTradingArtifactClosure(
  artifactDir: string,
  manifest: TradingSystemManifest
): Promise<void> {
  await inspectSingleFileTradingArtifactClosure(artifactDir, manifest);
}

export async function sealSingleFileTradingArtifactClosure(
  artifactDir: string,
  manifest: TradingSystemManifest
): Promise<SealedSingleFileTradingArtifactClosure> {
  const inspected = await inspectSingleFileTradingArtifactClosure(artifactDir, manifest);
  const files = [
    {
      relative_path: "manifest.json",
      bytes: inspected.manifestBytes
    },
    {
      relative_path: inspected.entrypointRelativePath,
      bytes: inspected.entrypointBytes
    }
  ].sort((left, right) => left.relative_path === right.relative_path
    ? 0
    : left.relative_path < right.relative_path ? -1 : 1);
  return {
    root: inspected.root,
    entrypoint_relative_path: inspected.entrypointRelativePath,
    entrypoint_digest: digest(inspected.entrypointBytes),
    closure_digest: digest(Buffer.from(systemCodeArtifactClosureDigestInput(
      files.map((file) => ({
        relative_path: file.relative_path,
        content_digest: digest(file.bytes)
      }))
    ))),
    files
  };
}

export async function restoreSingleFileTradingArtifactClosure(
  sealed: SealedSingleFileTradingArtifactClosure
): Promise<boolean> {
  const root = path.resolve(sealed.root);
  await mkdir(root, { recursive: true });
  const expectedFiles = new Map(sealed.files.map((file) => [
    file.relative_path,
    file.bytes
  ]));
  const expectedDirectories = expectedArtifactDirectories(expectedFiles.keys());
  const entries = await listArtifactEntries(root).catch(() => []);
  let changed = false;

  for (const entry of [...entries].sort((left, right) =>
    right.relativePath.split("/").length - left.relativePath.split("/").length
  )) {
    const expected = entry.kind === "directory"
      ? expectedDirectories.has(entry.relativePath)
      : entry.kind === "file" && expectedFiles.has(entry.relativePath);
    if (!expected) {
      await rm(entry.absolutePath, { recursive: true, force: true });
      changed = true;
    }
  }

  for (const directory of [...expectedDirectories].sort()) {
    await mkdir(path.join(root, directory), { recursive: true });
  }
  for (const [relativePath, bytes] of expectedFiles) {
    const pathname = path.join(root, relativePath);
    const current = await readFile(pathname).catch(() => undefined);
    if (!current?.equals(bytes)) {
      await mkdir(path.dirname(pathname), { recursive: true });
      await writeFile(pathname, bytes);
      changed = true;
    }
  }
  return changed;
}

async function inspectSingleFileTradingArtifactClosure(
  artifactDir: string,
  manifest: TradingSystemManifest
): Promise<{
  root: string;
  entrypointRelativePath: string;
  manifestBytes: Buffer;
  entrypointBytes: Buffer;
}> {
  const root = path.resolve(artifactDir);
  const entrypointRelativePath = normalizedEntrypointRelativePath(root, manifest);
  if (manifest.editable_paths.length !== 1 ||
    normalizedRelativePath(manifest.editable_paths[0] ?? "") !== entrypointRelativePath) {
    throw new TradingArtifactClosureViolationError(
      "artifact_closure_manifest_invalid",
      "TradingSystem manifest must declare only its single entrypoint as editable."
    );
  }

  const expectedFiles = new Set(["manifest.json", entrypointRelativePath]);
  const expectedDirectories = expectedArtifactDirectories(expectedFiles);
  const entries = await listArtifactEntries(root).catch((error) => {
    throw new TradingArtifactClosureViolationError(
      "artifact_closure_manifest_invalid",
      error instanceof Error ? error.message : String(error)
    );
  });
  const invalidEntry = entries.find((entry) => {
    if (entry.kind === "directory") return !expectedDirectories.has(entry.relativePath);
    return entry.kind !== "file" || !expectedFiles.has(entry.relativePath);
  });
  if (invalidEntry) {
    throw new TradingArtifactClosureViolationError(
      "artifact_closure_unexpected_entry",
      `TradingSystem artifact closure contains undeclared entry ${invalidEntry.relativePath}.`
    );
  }
  if (entries.filter((entry) => entry.kind === "file").length !== expectedFiles.size) {
    throw new TradingArtifactClosureViolationError(
      "artifact_closure_manifest_invalid",
      "TradingSystem artifact closure is missing its manifest or entrypoint."
    );
  }

  const manifestBytes = await readFile(path.join(root, "manifest.json")).catch(() => undefined);
  const entrypointBytes = await readFile(path.join(root, entrypointRelativePath)).catch(() => undefined);
  if (!manifestBytes || !entrypointBytes) {
    throw new TradingArtifactClosureViolationError(
      "artifact_closure_manifest_invalid",
      "TradingSystem artifact closure is missing readable manifest or entrypoint bytes."
    );
  }
  let storedManifest: unknown;
  try {
    storedManifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    storedManifest = undefined;
  }
  if (!isDeepStrictEqual(storedManifest, manifest)) {
    throw new TradingArtifactClosureViolationError(
      "artifact_closure_manifest_invalid",
      "TradingSystem manifest bytes do not match the evaluated manifest."
    );
  }
  return { root, entrypointRelativePath, manifestBytes, entrypointBytes };
}

function normalizedEntrypointRelativePath(
  root: string,
  manifest: TradingSystemManifest
): string {
  const entrypointPath = manifest.entrypoint[1];
  if (!entrypointPath) {
    throw new TradingArtifactClosureViolationError(
      "artifact_closure_manifest_invalid",
      "TradingSystem manifest entrypoint file is missing."
    );
  }
  const pathname = path.resolve(root, entrypointPath);
  const relativePath = path.relative(root, pathname);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new TradingArtifactClosureViolationError(
      "artifact_closure_manifest_invalid",
      "TradingSystem manifest entrypoint escapes its artifact closure."
    );
  }
  return normalizedRelativePath(relativePath);
}

function normalizedRelativePath(value: string): string {
  return path.normalize(value).split(path.sep).join("/");
}

function expectedArtifactDirectories(relativePaths: Iterable<string>): Set<string> {
  const directories = new Set<string>();
  for (const relativePath of relativePaths) {
    let directory = path.posix.dirname(relativePath);
    while (directory !== ".") {
      directories.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  return directories;
}

async function listArtifactEntries(root: string): Promise<Array<{
  absolutePath: string;
  relativePath: string;
  kind: "file" | "directory" | "symlink" | "other";
}>> {
  const entries: Array<{
    absolutePath: string;
    relativePath: string;
    kind: "file" | "directory" | "symlink" | "other";
  }> = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = normalizedRelativePath(path.relative(root, absolutePath));
      const kind = entry.isSymbolicLink()
        ? "symlink" as const
        : entry.isDirectory()
          ? "directory" as const
          : entry.isFile()
            ? "file" as const
            : "other" as const;
      entries.push({ absolutePath, relativePath, kind });
      if (kind === "directory") await visit(absolutePath);
    }
  };
  await visit(root);
  return entries;
}

function digest(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
