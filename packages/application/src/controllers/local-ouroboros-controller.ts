import type { AgentProfileProviderKind } from "@ouroboros/domain";
import {
  listAgentProfileReadModels,
  probeAgentProfile,
  runAgentProfileDeviceLogin,
  setupAgentProfile,
  type AgentProfileExecFile,
  type AgentProfileSpawnFile
} from "../agent-profiles";

export interface LocalOuroborosControllerStore {
  listAgentProfiles: Parameters<typeof listAgentProfileReadModels>[0]["listAgentProfiles"];
  getAgentProfile: Parameters<typeof setupAgentProfile>[0]["store"]["getAgentProfile"];
  recordAgentProfile: Parameters<typeof setupAgentProfile>[0]["store"]["recordAgentProfile"];
  root(): string;
}

export interface LocalAgentProviderCommand {
  action: "status" | "setup" | "login" | "probe";
  provider: AgentProfileProviderKind;
}

export interface LocalOuroborosControllerOptions {
  store: Parameters<typeof listAgentProfileReadModels>[0];
  execFile?: AgentProfileExecFile;
  spawnFile?: AgentProfileSpawnFile;
}

export interface LocalOuroborosController {
  dispatchAgentProviderCommand(command: LocalAgentProviderCommand): Promise<unknown>;
}

export function createLocalOuroborosController(
  options: LocalOuroborosControllerOptions
): LocalOuroborosController {
  return {
    dispatchAgentProviderCommand: (command) => runLocalAgentProviderCommand(command, options)
  };
}

async function runLocalAgentProviderCommand(
  command: LocalAgentProviderCommand,
  options: LocalOuroborosControllerOptions
): Promise<unknown> {
  if (command.action === "status") {
    const profiles = await listAgentProfileReadModels(options.store);
    return {
      profile: profiles.find((profile) => profile.profile_id === command.provider)
    };
  }
  if (command.action === "setup") {
    return {
      profile: await setupAgentProfile({
        store: options.store,
        profileId: command.provider
      })
    };
  }
  if (command.action === "login") {
    return {
      profile: await runAgentProfileDeviceLogin({
        store: options.store,
        profileId: command.provider,
        spawnFile: options.spawnFile
      })
    };
  }
  return {
    profile: await probeAgentProfile({
      store: options.store,
      profileId: command.provider,
      execFile: options.execFile
    })
  };
}
