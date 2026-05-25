const runtimeBaseUrl = process.env.OUROBOROS_RUNTIME_URL ?? "http://127.0.0.1:4173";

type ArenaCommand = "status" | "start" | "stop" | "tick";

async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));
  const endpoint = command === "status" ? "/api/candidate-arena" : `/api/candidate-arena/${command}`;
  const response = await fetch(`${runtimeBaseUrl}${endpoint}`, {
    method: command === "status" ? "GET" : "POST"
  });
  const body = await response.json() as unknown;
  if (!response.ok) {
    console.error(JSON.stringify(body, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(body, null, 2));
}

function parseCommand(args: string[]): ArenaCommand {
  const command = args[0] ?? "status";
  if (command === "status" || command === "start" || command === "stop" || command === "tick") {
    return command;
  }
  throw new Error("Usage: npm run trading:arena -- status|start|stop|tick");
}

await main();

export {};
