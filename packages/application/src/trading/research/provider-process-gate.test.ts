import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProviderProcessGate } from "./provider-process-gate";

describe("provider process gate", () => {
  let tmpDir = "";

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it.runIf(process.platform !== "win32")(
    "passes the provider command as positional arguments instead of shell source",
    async () => {
      tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-provider-gate-"));
      const gate = await createProviderProcessGate({
        sessionToken: "session-token",
        root: tmpDir,
        platform: "linux"
      });
      const providerFile = "/tmp/provider;touch-not-allowed";
      const providerArgs = ["--model", "model $(touch-not-allowed)"];

      const command = gate.command(providerFile, providerArgs);

      expect(command.file).toBe("/bin/sh");
      expect(command.args).not.toContain("-c");
      expect(command.args.slice(1)).toEqual([
        gate.stateFile,
        providerFile,
        ...providerArgs
      ]);
      expect(await readFile(command.args[0]!, "utf8")).toContain('exec "$@"');
      await gate.cleanup();
    }
  );
});
