import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Linear GraphQL execution scripts", () => {
  it("fails without leaking secrets when Linear auth is missing", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-linear-graphql-"));
    try {
      const queryFile = path.join(tempDir, "viewer.graphql");
      await writeFile(queryFile, "query Viewer { viewer { id name } }\n", "utf8");

      const result = await runNode([".agents/skills/linear-graphql/scripts/linear-graphql.mjs", "--query-file", queryFile], {
        LINEAR_API_KEY: "",
        LINEAR_ENV_FILE: path.join(tempDir, "missing.env")
      });
      const parsed = JSON.parse(result.stdout);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(parsed).toMatchObject({
        success: false,
        error: {
          code: "missing_linear_api_key"
        }
      });
      expect(`${result.stdout}\n${result.stderr}`).not.toContain("test-linear-token");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("executes one GraphQL operation with variables against the configured endpoint", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-linear-graphql-"));
    const calls: CapturedCall[] = [];
    const server = await startLinearServer(calls, async () => ({
      status: 200,
      body: {
        data: {
          viewer: {
            id: "viewer-1",
            name: "Ouroboros Bot"
          }
        }
      }
    }));
    try {
      const queryFile = path.join(tempDir, "viewer.graphql");
      const variablesFile = path.join(tempDir, "variables.json");
      await writeFile(queryFile, "query Viewer($name: String!) { viewer { id name } }\n", "utf8");
      await writeFile(variablesFile, `${JSON.stringify({ name: "sjson" }, null, 2)}\n`, "utf8");

      const result = await runNode([
        ".agents/skills/linear-graphql/scripts/linear-graphql.mjs",
        "--query-file",
        queryFile,
        "--variables-file",
        variablesFile
      ], {
        LINEAR_API_KEY: "test-linear-token",
        LINEAR_GRAPHQL_ENDPOINT: server.url,
        LINEAR_ALLOW_TEST_GRAPHQL_ENDPOINT: "1",
        LINEAR_ENV_FILE: path.join(tempDir, "missing.env")
      });
      const parsed = JSON.parse(result.stdout);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(parsed).toMatchObject({
        success: true,
        response: {
          data: {
            viewer: {
              id: "viewer-1",
              name: "Ouroboros Bot"
            }
          }
        }
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        authorization: "test-linear-token",
        body: {
          query: "query Viewer($name: String!) { viewer { id name } }\n",
          variables: {
            name: "sjson"
          }
        }
      });
    } finally {
      await server.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("marks GraphQL errors as failed while preserving the response body", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-linear-graphql-"));
    const calls: CapturedCall[] = [];
    const server = await startLinearServer(calls, async () => ({
      status: 200,
      body: {
        errors: [
          {
            message: "Bad request"
          }
        ]
      }
    }));
    try {
      const queryFile = path.join(tempDir, "viewer.graphql");
      await writeFile(queryFile, "query Viewer { viewer { id } }\n", "utf8");

      const result = await runNode([".agents/skills/linear-graphql/scripts/linear-graphql.mjs", "--query-file", queryFile], {
        LINEAR_API_KEY: "test-linear-token",
        LINEAR_GRAPHQL_ENDPOINT: server.url,
        LINEAR_ALLOW_TEST_GRAPHQL_ENDPOINT: "1",
        LINEAR_ENV_FILE: path.join(tempDir, "missing.env")
      });
      const parsed = JSON.parse(result.stdout);

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(parsed).toMatchObject({
        success: false,
        response: {
          errors: [
            {
              message: "Bad request"
            }
          ]
        }
      });
    } finally {
      await server.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("updates an existing Codex Workpad comment instead of creating a duplicate", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-linear-workpad-"));
    const calls: CapturedCall[] = [];
    const server = await startLinearServer(calls, async (call) => {
      if (call.body.query.includes("query OuroborosIssueWorkpad")) {
        return {
          status: 200,
          body: {
            data: {
              issue: {
                id: "issue-1",
                identifier: "OURO-158",
                comments: {
                  nodes: [
                    {
                      id: "comment-1",
                      body: "## Codex Workpad\n\nold",
                      createdAt: "2026-05-25T00:00:00.000Z",
                      updatedAt: "2026-05-25T00:00:00.000Z",
                      user: {
                        id: "user-1",
                        name: "Codex"
                      }
                    }
                  ]
                }
              }
            }
          }
        };
      }
      return {
        status: 200,
        body: {
          data: {
            commentUpdate: {
              success: true,
              comment: {
                id: "comment-1",
                body: String(call.body.variables?.body ?? ""),
                updatedAt: "2026-05-25T01:00:00.000Z",
                url: "https://linear.app/openboa/issue/OURO-158#comment-1"
              }
            }
          }
        }
      };
    });
    try {
      const bodyFile = path.join(tempDir, "workpad.md");
      await writeFile(bodyFile, "## Codex Workpad\n\n### Validation\n- npm test\n", "utf8");

      const result = await runNode([
        ".agents/skills/linear-graphql/scripts/linear-workpad.mjs",
        "--issue",
        "OURO-158",
        "--body-file",
        bodyFile
      ], {
        LINEAR_API_KEY: "test-linear-token",
        LINEAR_GRAPHQL_ENDPOINT: server.url,
        LINEAR_ALLOW_TEST_GRAPHQL_ENDPOINT: "1",
        LINEAR_ENV_FILE: path.join(tempDir, "missing.env")
      });

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("Linear workpad");
      expect(result.stdout).toContain("mode=updated");
      expect(result.stdout).toContain("comment_id=comment-1");
      expect(calls).toHaveLength(2);
      expect(calls[1].body.query).toContain("mutation OuroborosUpdateWorkpad");
      expect(calls[1].body.variables).toMatchObject({
        id: "comment-1",
        body: "## Codex Workpad\n\n### Validation\n- npm test\n"
      });
    } finally {
      await server.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("creates a Codex Workpad comment when none exists", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-linear-workpad-"));
    const calls: CapturedCall[] = [];
    const server = await startLinearServer(calls, async (call) => {
      if (call.body.query.includes("query OuroborosIssueWorkpad")) {
        return {
          status: 200,
          body: {
            data: {
              issue: {
                id: "issue-1",
                identifier: "OURO-158",
                comments: {
                  nodes: []
                }
              }
            }
          }
        };
      }
      return {
        status: 200,
        body: {
          data: {
            commentCreate: {
              success: true,
              comment: {
                id: "comment-created",
                url: "https://linear.app/openboa/issue/OURO-158#comment-created"
              }
            }
          }
        }
      };
    });
    try {
      const bodyFile = path.join(tempDir, "workpad.md");
      await writeFile(bodyFile, "## Codex Workpad\n\nCreated by GraphQL.\n", "utf8");

      const result = await runNode([
        ".agents/skills/linear-graphql/scripts/linear-workpad.mjs",
        "--issue",
        "OURO-158",
        "--body-file",
        bodyFile
      ], {
        LINEAR_API_KEY: "test-linear-token",
        LINEAR_GRAPHQL_ENDPOINT: server.url,
        LINEAR_ALLOW_TEST_GRAPHQL_ENDPOINT: "1",
        LINEAR_ENV_FILE: path.join(tempDir, "missing.env")
      });

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("mode=created");
      expect(result.stdout).toContain("comment_id=comment-created");
      expect(calls).toHaveLength(2);
      expect(calls[1].body.query).toContain("mutation OuroborosCreateWorkpad");
      expect(calls[1].body.variables).toMatchObject({
        issueId: "issue-1",
        body: "## Codex Workpad\n\nCreated by GraphQL.\n"
      });
    } finally {
      await server.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("registers the npm Linear GraphQL commands", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["linear:graphql"])
      .toBe("node .agents/skills/linear-graphql/scripts/linear-graphql.mjs");
    expect(packageJson.scripts["linear:workpad"])
      .toBe("node .agents/skills/linear-graphql/scripts/linear-workpad.mjs");
  });
});

interface CapturedCall {
  authorization: string | undefined;
  body: {
    query: string;
    variables?: Record<string, unknown>;
  };
}

async function startLinearServer(
  calls: CapturedCall[],
  handler: (call: CapturedCall) => Promise<{ status: number; body: unknown }>
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const body = JSON.parse(await readRequestBody(request)) as CapturedCall["body"];
    const call = {
      authorization: request.headers.authorization,
      body
    };
    calls.push(call);
    const result = await handler(call);
    response.statusCode = result.status;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(result.body));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("expected local server address");
  }

  return {
    url: `http://127.0.0.1:${address.port}/graphql`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    })
  };
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      resolve(body);
    });
    request.on("error", reject);
  });
}

function runNode(args: string[], env: Record<string, string>) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.on("error", (error) => {
      resolve({ code: null, stdout, stderr: `${stderr}${error.message}` });
    });
  });
}

function scriptOutput(result: { stdout: string; stderr: string }): string {
  return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}
