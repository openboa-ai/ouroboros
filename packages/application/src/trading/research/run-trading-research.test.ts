import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runTradingResearchLoop } from "./run-trading-research";

describe("runTradingResearchLoop process ownership composition", () => {
  let repoRoot = "";

  afterEach(async () => {
    if (repoRoot) await rm(repoRoot, { recursive: true, force: true });
  });

  it("fails closed before default Codex execution when ownership is not injected", async () => {
    repoRoot = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-composition-"));

    await expect(runTradingResearchLoop({ repo_root: repoRoot })).rejects.toThrow(
      "research_provider_process_ownership_required"
    );
  });
});
