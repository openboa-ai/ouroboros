import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  parseTradingResearchCliArgs,
  runTradingResearchLoop,
  type RunTradingResearchLoopInput
} from "@ouroboros/application/trading/research/run-trading-research";
import {
  FileSystemRuntimeProcessOwnershipStore,
  LocalStore
} from "@ouroboros/local-store";

export function createTradingResearchCliInput(
  args: string[],
  options: { storeRoot?: string } = {}
): RunTradingResearchLoopInput {
  const store = new LocalStore(options.storeRoot);
  const processOwnership = new FileSystemRuntimeProcessOwnershipStore(
    path.join(store.root(), "runtime-process-ownership")
  );
  return parseTradingResearchCliArgs(args, { processOwnership });
}

async function main(): Promise<void> {
  const result = await runTradingResearchLoop(
    createTradingResearchCliInput(process.argv.slice(2))
  );
  for (const entry of result.entries) {
    console.log(
      `iteration ${entry.iteration}: score ${entry.score.toFixed(3)} ${entry.decision} ${entry.agent_summary}`
    );
  }
  console.log(`notebook: ${result.notebook_path}`);
  if (result.best_artifact_dir) console.log(`best artifact: ${result.best_artifact_dir}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
