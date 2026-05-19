import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CandidateMaterializationInput } from "@ouroboros/domain";
import { CodexCliProviderAdapter } from "../src/providers/codex-cli-provider";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-codex-provider-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("CodexCliProviderAdapter", () => {
  it("runs codex exec and parses the output file", async () => {
    const outputPath = path.join(tmpDir, "candidate-output.json");
    const calls: string[][] = [];
    const adapter = new CodexCliProviderAdapter({
      workingDirectory: tmpDir,
      outputPath,
      schemaPath: "schema.json",
      execFile: async (_file, args) => {
        calls.push(args);
        if (args[0] === "--version") {
          return { stdout: "codex-cli 0.125.0\n", stderr: "" };
        }
        await writeFile(outputPath, JSON.stringify(validMaterializationInput()), "utf8");
        return { stdout: "", stderr: "" };
      }
    });

    const result = await adapter.runCandidateGeneration({ prompt: "create one generic trading candidate" });

    expect(calls.map((args) => args[0])).toEqual(["--version", "exec"]);
    expect(result).toMatchObject({
      status: "succeeded",
      output: {
        idempotency_key: "codex-cli-provider-test-output"
      }
    });
  });

  it("records missing output as schema_missing", async () => {
    const outputPath = path.join(tmpDir, "missing-output.json");
    const adapter = new CodexCliProviderAdapter({
      workingDirectory: tmpDir,
      outputPath,
      execFile: async (_file, args) => {
        if (args[0] === "--version") {
          return { stdout: "codex-cli 0.125.0\n", stderr: "" };
        }
        return { stdout: "", stderr: "" };
      }
    });

    const result = await adapter.runCandidateGeneration({ prompt: "create one generic trading candidate" });

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "schema_missing"
    });
    if (result.status === "failed") {
      expect(result.artifact_refs.map((ref) => ref.record_kind)).toContain("codex_cli_command");
    }
    await expect(readFile(outputPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});

function validMaterializationInput(): CandidateMaterializationInput {
  return {
    idempotency_key: "codex-cli-provider-test-output",
    provider: {
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      invocation_surface: "codex exec --json --output-schema",
      agent_run_id: "agent-run-provider-test",
      agent_event_id: "agent-event-provider-test",
      trace_id: "trace-provider-test",
      output_artifact_hash: "sha256:provider-test"
    },
    candidate: {
      title: "generic market Perp Provider Test Candidate",
      system_summary: "A provider test candidate for materialization.",
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: "Provider test spec.",
      market: "ExternalTradingApiProvider",
      instrument: "generic trading instruments",
      supported_stage_binding_profiles: ["backtest", "paper"]
    },
    program: {
      summary: "Provider test program.",
      declared_runtime: "typescript-worker",
      declared_outputs: ["OrderRequest"]
    },
    capability_package: {
      summary: "Provider test capability package.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_market_data"],
      forbidden_contents: ["exchange_credentials"]
    },
    artifact_refs: []
  };
}
