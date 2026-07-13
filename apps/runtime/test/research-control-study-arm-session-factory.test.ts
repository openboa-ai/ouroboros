import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { SandboxAdapterRegistryPort } from
  "@ouroboros/application/ports/sandbox";
import type { SystemCodeArtifactResolverPort } from
  "@ouroboros/application/ports/system-code-artifact";
import { PaperTradingSessionService } from
  "@ouroboros/application/trading/paper/session-service";
import type { CandidateInspectReadModel } from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  createResearchControlStudyArmSessionFactory
} from "../src/candidate/arena/research-control-study-arm-session-factory";

describe("ResearchControlStudy arm session factory", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-study-arm-sessions-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates distinct services bound to each exact arm Store", async () => {
    const adaptiveStore = new RoutedStore(path.join(root, "adaptive"));
    const controlStore = new RoutedStore(path.join(root, "control"));
    await Promise.all([adaptiveStore.initialize(), controlStore.initialize()]);
    const dependencyContexts: string[] = [];
    const createSessions = createResearchControlStudyArmSessionFactory({
      marketData: {} as GatewayMarketDataPort,
      createSandboxAdapters(context) {
        dependencyContexts.push(`sandbox:${context.armKind}:${context.root}`);
        return {} as SandboxAdapterRegistryPort;
      },
      createArtifactResolver(context) {
        dependencyContexts.push(`artifact:${context.armKind}:${context.root}`);
        return missingArtifactResolver();
      }
    });

    const adaptive = await createSessions({
      root: adaptiveStore.root(),
      armKind: "adaptive_treatment",
      store: adaptiveStore
    });
    const control = await createSessions({
      root: controlStore.root(),
      armKind: "static_control",
      store: controlStore
    });

    expect(adaptive).toBeInstanceOf(PaperTradingSessionService);
    expect(control).toBeInstanceOf(PaperTradingSessionService);
    expect(adaptive).not.toBe(control);
    await expect(adaptive.prepare(missingPreparation("adaptive-run")))
      .rejects.toMatchObject({ code: "trading_run_not_found" });
    await expect(control.prepare(missingPreparation("control-run")))
      .rejects.toMatchObject({ code: "trading_run_not_found" });
    expect(adaptiveStore.requestedRuns).toEqual(["adaptive-run"]);
    expect(controlStore.requestedRuns).toEqual(["control-run"]);
    expect(dependencyContexts).toEqual([
      `sandbox:adaptive_treatment:${adaptiveStore.root()}`,
      `artifact:adaptive_treatment:${adaptiveStore.root()}`,
      `sandbox:static_control:${controlStore.root()}`,
      `artifact:static_control:${controlStore.root()}`
    ]);
  });

  it("rejects a mismatched Store root before creating dependencies", async () => {
    const store = new RoutedStore(path.join(root, "actual"));
    await store.initialize();
    let dependencyCalls = 0;
    const createSessions = createResearchControlStudyArmSessionFactory({
      marketData: {} as GatewayMarketDataPort,
      createSandboxAdapters() {
        dependencyCalls += 1;
        return {} as SandboxAdapterRegistryPort;
      },
      createArtifactResolver() {
        dependencyCalls += 1;
        return missingArtifactResolver();
      }
    });

    await expect(createSessions({
      root: path.join(root, "other"),
      armKind: "adaptive_treatment",
      store
    })).rejects.toMatchObject({
      code: "research_control_study_arm_session_store_root_mismatch"
    });
    expect(dependencyCalls).toBe(0);
  });
});

class RoutedStore extends LocalStore {
  readonly requestedRuns: string[] = [];

  override async getCandidateForTradingRun(
    tradingRunId: string
  ): Promise<CandidateInspectReadModel | undefined> {
    this.requestedRuns.push(tradingRunId);
    return undefined;
  }
}

function missingPreparation(tradingRunId: string) {
  return {
    candidateId: `${tradingRunId}-candidate`,
    candidateVersionId: `${tradingRunId}-version`,
    tradingRunId,
    evidencePurpose: "research_feedback" as const,
    clock: "external" as const
  };
}

function missingArtifactResolver(): SystemCodeArtifactResolverPort {
  return {
    async resolveArtifactDigest() {
      throw new Error("unexpected artifact resolution");
    }
  };
}
