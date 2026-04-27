import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@autokairos/local-store";
import { buildServer } from "../src/server";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "autokairos-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("runtime read-only API", () => {
  it("serves health and candidate read models", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const health = await server.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      status: "ok",
      mode: "fixture_convenience_mode"
    });

    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      candidates: [{ candidate_id: FIXTURE_CANDIDATE_ID }]
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      fixture_notice: { mode: "fixture_convenience_mode" },
      runtime: {
        authority_status: "not_live",
        memory_surface: {
          access_mode: "read_only",
          authority_status: "not_evidence"
        }
      }
    });

    await server.close();
  });

  it("returns 404 for an unknown candidate", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const response = await server.inject({ method: "GET", url: "/api/candidates/missing" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    await server.close();
  });

  it("does not expose runtime action routes", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const forbiddenPaths = [
      "/api/candidates/fixture-candidate-btc-perp-001/start",
      "/api/candidates/fixture-candidate-btc-perp-001/pause",
      "/api/provider-runs",
      "/api/evaluations",
      "/api/promotions",
      "/api/live/orders"
    ];

    for (const url of forbiddenPaths) {
      const response = await server.inject({ method: "POST", url });
      expect(response.statusCode).toBe(404);
    }

    await server.close();
  });
});
