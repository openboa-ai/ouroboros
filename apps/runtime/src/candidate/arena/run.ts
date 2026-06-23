import { runOuroborosCli } from "@ouroboros/cli";

type ArenaCommand = "status" | "start" | "stop" | "tick" | "cycle";

const { command, passthroughArgs } = parseCommand(process.argv.slice(2));
const result = await runOuroborosCli(["arena", command, ...passthroughArgs]);

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}
process.exitCode = result.exitCode;

function parseCommand(args: string[]): { command: ArenaCommand; passthroughArgs: string[] } {
  const command = args[0] ?? "status";
  if (
    command === "status"
    || command === "start"
    || command === "stop"
    || command === "tick"
    || command === "cycle"
  ) {
    return {
      command,
      passthroughArgs: args.slice(1)
    };
  }
  throw new Error("Usage: ouroboros arena status|start|stop|tick|cycle [--json]");
}
