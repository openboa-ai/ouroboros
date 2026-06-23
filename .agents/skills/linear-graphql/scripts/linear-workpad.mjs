#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  DEFAULT_LINEAR_GRAPHQL_ENDPOINT,
  UsageError,
  executeLinearGraphql,
  resolveLinearApiKey
} from "./lib/linear-graphql-client.mjs";

const DEFAULT_MARKER = "## Codex Workpad";

const ISSUE_WORKPAD_QUERY = `query OuroborosIssueWorkpad($id: String!) {
  issue(id: $id) {
    id
    identifier
    comments(first: 50) {
      nodes {
        id
        body
        createdAt
        updatedAt
        user { id name }
      }
    }
  }
}`;

const UPDATE_WORKPAD_MUTATION = `mutation OuroborosUpdateWorkpad($id: String!, $body: String!) {
  commentUpdate(id: $id, input: { body: $body }) {
    success
    comment { id body updatedAt url }
  }
}`;

const CREATE_WORKPAD_MUTATION = `mutation OuroborosCreateWorkpad($issueId: String!, $body: String!) {
  commentCreate(input: { issueId: $issueId, body: $body }) {
    success
    comment { id url }
  }
}`;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run linear:workpad -- --issue OURO-158 --body-file <path>

Upserts one Linear issue comment marked "## Codex Workpad" through the repo-local GraphQL fallback.

Options:
  --issue <id>          Linear issue identifier or node id, for example OURO-158.
  --body-file <path>    Markdown body to create or update.
  --marker <text>       Existing comment marker. Default: ${DEFAULT_MARKER}
  --endpoint <url>      Test-only loopback override. Default: LINEAR_GRAPHQL_ENDPOINT or ${DEFAULT_LINEAR_GRAPHQL_ENDPOINT}

Auth:
  Reads LINEAR_API_KEY from the environment first, then local .env.
  LINEAR_ENV_FILE may point at an alternate env file for tests.
  Non-Linear endpoints require LINEAR_ALLOW_TEST_GRAPHQL_ENDPOINT=1 and a test-* token.
`);
  process.exit(0);
}

try {
  const args = parseArgs(process.argv.slice(2));
  const endpoint = args.endpoint ?? process.env.LINEAR_GRAPHQL_ENDPOINT ?? DEFAULT_LINEAR_GRAPHQL_ENDPOINT;
  const apiKey = await resolveLinearApiKey();
  const body = await readFile(args["body-file"], "utf8");
  const marker = args.marker ?? DEFAULT_MARKER;
  if (!body.startsWith(marker)) {
    throw new UsageError(`--body-file must start with the workpad marker: ${marker}`);
  }

  const lookup = await executeLinearGraphql({
    endpoint,
    apiKey,
    query: ISSUE_WORKPAD_QUERY,
    variables: {
      id: args.issue
    }
  });
  if (!lookup.success) {
    failJson(lookup);
  }

  const issue = lookup.response?.data?.issue;
  if (!issue?.id) {
    failJson({
      success: false,
      error: {
        code: "linear_issue_not_found",
        message: `Linear issue not found: ${args.issue}`
      }
    });
  }

  const comments = Array.isArray(issue.comments?.nodes) ? issue.comments.nodes : [];
  const existing = comments.find((comment) => typeof comment.body === "string" && comment.body.startsWith(marker));
  const mutation = existing ? UPDATE_WORKPAD_MUTATION : CREATE_WORKPAD_MUTATION;
  const variables = existing ? { id: existing.id, body } : { issueId: issue.id, body };
  const written = await executeLinearGraphql({
    endpoint,
    apiKey,
    query: mutation,
    variables
  });
  if (!written.success) {
    failJson(written);
  }

  const payload = existing ? written.response?.data?.commentUpdate : written.response?.data?.commentCreate;
  if (!payload?.success || !payload?.comment?.id) {
    failJson({
      success: false,
      error: {
        code: "linear_workpad_write_failed",
        message: "Linear workpad mutation did not return a successful comment payload.",
        response: written.response
      }
    });
  }

  console.log("Linear workpad");
  console.log(`issue=${issue.identifier ?? args.issue}`);
  console.log(`mode=${existing ? "updated" : "created"}`);
  console.log(`comment_id=${payload.comment.id}`);
  if (payload.comment.url) {
    console.log(`url=${payload.comment.url}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  failJson({
    success: false,
    error: {
      code: error instanceof UsageError ? "usage_error" : "linear_workpad_cli_error",
      message
    }
  });
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      throw new UsageError(`unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (!["issue", "body-file", "marker", "endpoint"].includes(key)) {
      throw new UsageError(`unknown option: --${key}`);
    }
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      throw new UsageError(`missing value for --${key}`);
    }
    parsed[key] = next;
    index += 1;
  }
  if (!parsed.issue) {
    throw new UsageError("--issue is required");
  }
  if (!parsed["body-file"]) {
    throw new UsageError("--body-file is required");
  }
  return parsed;
}

function failJson(payload) {
  console.error(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
}
