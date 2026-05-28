#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const problems = [];
const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

function fail(message) {
  problems.push(message);
}

function requireText(file, terms) {
  const body = read(file);
  for (const term of terms) {
    if (!body.includes(term)) {
      fail(`${file}: missing architecture governance term ${JSON.stringify(term)}`);
    }
  }
}

function listFiles(dir) {
  const absolute = path.join(root, dir);
  if (!existsSync(absolute)) {
    return [];
  }
  return readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(relative);
      }
      return relative;
    });
}

function importLines(body) {
  return body
    .split("\n")
    .filter((line) => /^\s*(import|export)\s/.test(line));
}

function importSpecifiers(body) {
  return importLines(body)
    .map((line) => line.match(/from\s+["']([^"']+)["']/)?.[1] ?? line.match(/import\s+["']([^"']+)["']/)?.[1])
    .filter(Boolean);
}

requireText("ARCHITECTURE.md", [
  "Hexagonal Architecture",
  "Clean Architecture",
  "Layered Architecture",
  "Domain-Driven Design",
  "CQRS",
  "Strategy",
  "Factory",
  "Builder",
  "Adapter",
  "Decorator",
  "Observer",
  "Middleware",
  "Registry",
  "Plugin",
  "Dependency Injection"
]);

requireText("docs/project-direction.md", [
  "GitHub repository on `main` is the source of truth",
  "outcome-gradable",
  "CandidateArena",
  "parallel TradingSystem candidates",
  "selected candidate continuous paper trading evaluation",
  "Live trading, private account reads"
]);

requireText("docs/ouroboros-doctrine.md", [
  "AI agents improve over time",
  "outcome-gradable",
  "parallel TradingSystem candidates",
  "continuous paper trading evaluation",
  "revenue - cost",
  "selected paper evidence",
  "TradingSystem may include an internal agent runtime",
  "Researcher cannot grade",
  "Gateway binding changes, TradingSystem identity does not",
  "Candidate, Paper Evidence, and Live are separate states",
  "Replay/backtest is a research tool, not final evaluation authority",
  "Continuous paper trading is the evaluation authority",
  "Reference Lineage"
]);

requireText("docs/architecture-governance.md", [
  "Domain -> Application -> Adapters -> Controllers -> Interfaces",
  "Hexagonal Architecture",
  "Clean Architecture",
  "Layered Architecture",
  "Domain-Driven Design",
  "CQRS",
  "Strategy",
  "Factory",
  "Builder",
  "Adapter",
  "Decorator",
  "Observer",
  "Middleware",
  "Registry",
  "Plugin",
  "Dependency Injection"
]);

requireText("docs/api-command-contract.md", [
  "GET /api/operator",
  "POST /api/commands",
  "OUROBOROS_COMMAND_REGISTRY",
  "OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS",
  "OperatorReadModel"
]);

requireText("docs/interface-parity.md", [
  "CLI",
  "TUI",
  "Web UI",
  "GET /api/operator",
  "POST /api/commands",
  "OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS",
  "agent setup|login|probe|status",
  "local controller",
  "Candidate, Paper Evidence, and Live remain visibly separate states"
]);

requireText("docs/naming-taxonomy.md", [
  "Canonical Nouns",
  "`CandidateArena`",
  "`OuroborosCommand`",
  "`OperatorReadModel`"
]);

requireText("AGENTS.md", [
  "Architecture Pattern Selection",
  "Interfaces call controllers",
  "Controllers validate and dispatch only",
  "Services orchestrate use cases",
  "Adapters implement ports"
]);

for (const file of ["AGENTS.md", "README.md", "ARCHITECTURE.md", "LINEAR.md"]) {
  const body = read(file);
  for (const retired of [
    "Linear is the source of truth",
    "Linear owns product truth",
    "Linear owns project truth",
    "Linear Project Documents own",
    "Linear is the documentation and execution-state authority"
  ]) {
    if (body.includes(retired)) {
      fail(`${file}: retired Linear authority wording ${JSON.stringify(retired)}`);
    }
  }
}

requireText("packages/domain/src/index.ts", [
  "export const OUROBOROS_COMMAND_REGISTRY",
  "export const OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS",
  "export function getOuroborosCommandDescriptor",
  "command_descriptors: readonly OuroborosCommandDescriptor[]"
]);

requireText("packages/application/package.json", [
  "\"name\": \"@ouroboros/application\""
]);

requireText("packages/adapters/package.json", [
  "\"name\": \"@ouroboros/adapters\""
]);

requireText("apps/cli/package.json", [
  "\"name\": \"@ouroboros/cli\""
]);

requireText("apps/operator-tui/package.json", [
  "\"name\": \"@ouroboros/operator-tui\""
]);

requireText("packages/application/src/services/operator.ts", [
  "OperatorCommandHandlerRegistry",
  "SelectedCandidatePaperEvidencePort",
  "commandHandlers()"
]);

requireText("packages/application/src/ports/operator.ts", [
  "OperatorCommandHandlerRegistry",
  "SelectedCandidatePaperEvidencePort"
]);

requireText("packages/application/src/controllers/local-ouroboros.ts", [
  "createLocalOuroborosController",
  "dispatchAgentProviderCommand"
]);

requireText("apps/runtime/src/registry/routes.ts", [
  "registerRuntimeRouteModules",
  "RuntimeRouteModule"
]);

requireText("apps/runtime/src/controllers/core.ts", [
  "registerCoreControllerRoutes",
  "/api/commands"
]);

requireText("apps/runtime/src/controllers/resources.ts", [
  "registerResourceControllerRoutes",
  "/api/candidates",
  "/api/sandboxes"
]);

{
  const runtimeServer = read("apps/runtime/src/server.ts");
  if (/server\.(get|post|put|patch|delete)\s*(<|\()/m.test(runtimeServer)) {
    fail("apps/runtime/src/server.ts: route registration must live in apps/runtime/src/controllers route modules");
  }
}

const bannedControllerImports = [
  "@ouroboros/local-store",
  "../agent/",
  "../binance/",
  "../codex/",
  "../fixture/",
  "../provider/",
  "../providers/",
  "../sandbox/",
  "../sandboxes/",
  "../trading/",
  "../trading-research/",
  "../trading-substrate/",
  "../trading-gateway"
];

for (const file of listFiles("apps/runtime/src/controllers").filter((item) => item.endsWith(".ts"))) {
  const body = read(file);
  for (const banned of bannedControllerImports) {
    if (body.includes(banned)) {
      fail(`${file}: controller imports implementation boundary ${JSON.stringify(banned)}`);
    }
  }
}

const domainBannedImports = [
  "@ouroboros/application",
  "@ouroboros/adapters",
  "@ouroboros/local-store",
  "apps/",
  "fastify",
  "react",
  "ink",
  "@binance/"
];

const applicationBannedImports = [
  "@ouroboros/adapters",
  "@ouroboros/local-store",
  "fastify",
  "react",
  "ink",
  "@binance/"
];

for (const file of listFiles("packages/application/src").filter((item) =>
  item.endsWith(".ts") && !item.includes(".test.")
)) {
  const body = importSpecifiers(read(file)).join("\n");
  for (const banned of applicationBannedImports) {
    if (body.includes(banned)) {
      fail(`${file}: application imports outer implementation boundary ${JSON.stringify(banned)}`);
    }
  }
}

for (const file of listFiles("packages/domain/src").filter((item) => item.endsWith(".ts"))) {
  const body = importSpecifiers(read(file)).join("\n");
  for (const banned of domainBannedImports) {
    if (body.includes(banned)) {
      fail(`${file}: domain imports outer layer ${JSON.stringify(banned)}`);
    }
  }
}

const interfaceBannedImports = [
  "@ouroboros/adapters",
  "@ouroboros/local-store",
  "@binance/"
];

for (const dir of ["apps/operator-web/src", "apps/operator-tui/src"]) {
  for (const file of listFiles(dir).filter((item) =>
    (item.endsWith(".ts") || item.endsWith(".tsx")) && !item.includes(".test.")
  )) {
    const body = importSpecifiers(read(file)).join("\n");
    for (const banned of interfaceBannedImports) {
      if (body.includes(banned)) {
        fail(`${file}: interface imports implementation boundary ${JSON.stringify(banned)}`);
      }
    }
  }
}

const cliBody = read("apps/cli/src/ouroboros-cli.ts");
for (const banned of ["@ouroboros/adapters", "@binance/"]) {
  if (cliBody.includes(banned)) {
    fail(`apps/cli/src/ouroboros-cli.ts: CLI imports implementation boundary ${JSON.stringify(banned)}`);
  }
}

for (const expected of [
  "packages/application/src/controllers/operator.ts",
  "packages/application/src/services/operator.ts",
  "packages/adapters/src/codex/cli-provider.ts",
  "apps/cli/src/ouroboros-cli.ts",
  "apps/operator-tui/src/operator-tui.tsx"
]) {
  if (!existsSync(path.join(root, expected))) {
    fail(`missing layered architecture file: ${expected}`);
  }
}

if (problems.length) {
  console.error("Architecture governance check failed:");
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("Architecture governance checks passed");
