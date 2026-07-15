import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSystemRuntimeProcessOwnershipStore } from "@ouroboros/local-store";
import { createTradingResearchCliInput } from "./run-trading-research";

describe("trading research CLI composition", () => {
  let storeRoot = "";

  afterEach(async () => {
    if (storeRoot) await rm(storeRoot, { recursive: true, force: true });
  });

  it("injects one durable process ownership store into the default Codex path", async () => {
    storeRoot = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-cli-"));

    const input = createTradingResearchCliInput([], { storeRoot });

    expect(input.process_ownership).toBeInstanceOf(FileSystemRuntimeProcessOwnershipStore);
    expect(input.agent_adapter).toBeDefined();
  });
});
