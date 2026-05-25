#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  DEFAULT_LINEAR_GRAPHQL_ENDPOINT,
  UsageError,
  executeLinearGraphql,
  parseJsonObject,
  resolveLinearApiKey
} from "./lib/linear-graphql-client.mjs";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run linear:graphql -- --query-file <path> [--variables-file <path>]
       npm run linear:graphql -- --query '<query>' [--variables '{"id":"OURO-158"}']

Executes one raw Linear GraphQL operation through the repo-local fallback path.

Options:
  --query <query>             Inline GraphQL query or mutation.
  --query-file <path>         File containing one GraphQL query or mutation.
  --variables <json>          Inline JSON object variables. Default: {}.
  --variables-file <path>     File containing a JSON object.
  --endpoint <url>            Override endpoint. Default: LINEAR_GRAPHQL_ENDPOINT or ${DEFAULT_LINEAR_GRAPHQL_ENDPOINT}

Auth:
  Reads LINEAR_API_KEY from the environment first, then local .env.
  LINEAR_ENV_FILE may point at an alternate env file for tests.
`);
  process.exit(0);
}

try {
  const args = parseArgs(process.argv.slice(2));
  const query = await readQuery(args);
  const variables = await readVariables(args);
  const endpoint = args.endpoint ?? process.env.LINEAR_GRAPHQL_ENDPOINT ?? DEFAULT_LINEAR_GRAPHQL_ENDPOINT;
  const apiKey = await resolveLinearApiKey();
  const result = await executeLinearGraphql({
    query,
    variables,
    endpoint,
    apiKey
  });

  console.log(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.success ? 0 : 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(`${JSON.stringify({
    success: false,
    error: {
      code: error instanceof UsageError ? "usage_error" : "linear_graphql_cli_error",
      message
    }
  }, null, 2)}\n`);
  process.exitCode = 1;
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      throw new UsageError(`unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (!["query", "query-file", "variables", "variables-file", "endpoint"].includes(key)) {
      throw new UsageError(`unknown option: --${key}`);
    }
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      throw new UsageError(`missing value for --${key}`);
    }
    parsed[key] = next;
    index += 1;
  }

  if (Boolean(parsed.query) === Boolean(parsed["query-file"])) {
    throw new UsageError("provide exactly one of --query or --query-file");
  }
  if (Boolean(parsed.variables) && Boolean(parsed["variables-file"])) {
    throw new UsageError("provide at most one of --variables or --variables-file");
  }
  return parsed;
}

async function readQuery(args) {
  if (args.query) {
    return args.query;
  }
  return readFile(args["query-file"], "utf8");
}

async function readVariables(args) {
  if (args.variables) {
    return parseJsonObject(args.variables, "--variables");
  }
  if (args["variables-file"]) {
    return parseJsonObject(await readFile(args["variables-file"], "utf8"), "--variables-file");
  }
  return {};
}
