import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LINEAR_GRAPHQL_ENDPOINT = "https://api.linear.app/graphql";
const MAX_ERROR_BODY_LENGTH = 500;
const TEST_ENDPOINT_ENV = "LINEAR_ALLOW_TEST_GRAPHQL_ENDPOINT";

export async function resolveLinearApiKey(options = {}) {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const direct = stringValue(env.LINEAR_API_KEY);
  if (direct) {
    return direct;
  }

  const envFile = env.LINEAR_ENV_FILE ?? path.join(cwd, ".env");
  const values = await readEnvFile(envFile);
  return stringValue(values.LINEAR_API_KEY);
}

export async function executeLinearGraphql(input) {
  const endpoint = input.endpoint ?? DEFAULT_LINEAR_GRAPHQL_ENDPOINT;
  const apiKey = stringValue(input.apiKey);
  const variables = input.variables ?? {};
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;

  if (!apiKey) {
    return failure("missing_linear_api_key", "Linear GraphQL fallback is missing auth. Set LINEAR_API_KEY in the environment or local .env.");
  }
  if (!fetchImpl) {
    return failure("missing_fetch", "Linear GraphQL fallback requires a runtime with fetch support.");
  }

  const validation = validateGraphqlInput(input.query, variables);
  if (!validation.success) {
    return validation;
  }
  const endpointValidation = validateLinearEndpoint(endpoint, apiKey, input.env ?? process.env);
  if (!endpointValidation.success) {
    return endpointValidation;
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        query: input.query,
        variables
      })
    });
    const rawBody = await response.text();

    if (!response.ok) {
      return failure("linear_http_error", `Linear GraphQL request failed with HTTP ${response.status}.`, {
        status: response.status,
        body_summary: summarizeBody(rawBody)
      });
    }

    let responseBody;
    try {
      responseBody = rawBody ? JSON.parse(rawBody) : {};
    } catch (error) {
      return failure("linear_malformed_json", "Linear GraphQL response was not valid JSON.", {
        status: response.status,
        body_summary: summarizeBody(rawBody),
        reason: error instanceof Error ? error.message : String(error)
      });
    }

    return {
      success: !Array.isArray(responseBody.errors),
      status: response.status,
      response: responseBody
    };
  } catch (error) {
    return failure("linear_request_failed", "Linear GraphQL request failed before receiving a successful response.", {
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

function validateLinearEndpoint(endpoint, apiKey, env) {
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    return failure("invalid_linear_graphql_endpoint", "Linear GraphQL endpoint must be a valid URL.");
  }
  if (parsed.href === DEFAULT_LINEAR_GRAPHQL_ENDPOINT) {
    return { success: true };
  }
  const allowTestEndpoint = env?.[TEST_ENDPOINT_ENV] === "1" &&
    apiKey.startsWith("test-") &&
    parsed.protocol === "http:" &&
    ["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname);
  if (allowTestEndpoint) {
    return { success: true };
  }
  return failure(
    "unsafe_linear_graphql_endpoint",
    `Refusing to send LINEAR_API_KEY to a non-Linear endpoint. Use ${TEST_ENDPOINT_ENV}=1 only with test-* tokens and loopback test servers.`
  );
}

export function parseJsonObject(raw, label) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new UsageError(`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isPlainObject(parsed)) {
    throw new UsageError(`${label} must be a JSON object.`);
  }
  return parsed;
}

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

function validateGraphqlInput(query, variables) {
  if (!stringValue(query)) {
    return failure("invalid_query", "Linear GraphQL query must be a non-empty string.");
  }
  if (!isPlainObject(variables)) {
    return failure("invalid_variables", "Linear GraphQL variables must be a JSON object.");
  }

  const operations = stripGraphqlComments(query).match(/\b(query|mutation|subscription)\b/g) ?? [];
  if (operations.length !== 1) {
    return failure("invalid_operation_count", "Linear GraphQL fallback expects exactly one query, mutation, or subscription operation.");
  }
  return {
    success: true
  };
}

async function readEnvFile(envFile) {
  let body;
  try {
    body = await readFile(envFile, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw error;
  }

  const values = {};
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equalsIndex = withoutExport.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }
    const key = withoutExport.slice(0, equalsIndex).trim();
    const value = unquoteEnvValue(withoutExport.slice(equalsIndex + 1).trim());
    values[key] = value;
  }
  return values;
}

function unquoteEnvValue(value) {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1);
  }
  return value;
}

function stripGraphqlComments(query) {
  return query
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, ""))
    .join("\n");
}

function failure(code, message, extra = {}) {
  return {
    success: false,
    error: {
      code,
      message,
      ...extra
    }
  };
}

function summarizeBody(body) {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_ERROR_BODY_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_ERROR_BODY_LENGTH)}...<truncated>`;
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
