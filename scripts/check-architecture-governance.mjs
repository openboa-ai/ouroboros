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

requireText("AGENTS.md", [
  "Architecture Pattern Selection",
  "Interfaces call controllers",
  "Controllers validate and dispatch only",
  "Services orchestrate use cases",
  "Adapters implement ports"
]);

requireText("packages/domain/src/index.ts", [
  "export const OUROBOROS_COMMAND_REGISTRY",
  "export function getOuroborosCommandDescriptor",
  "command_descriptors: readonly OuroborosCommandDescriptor[]"
]);

requireText("apps/runtime/src/services/operator-service.ts", [
  "OperatorCommandHandlerRegistry",
  "SelectedCandidatePaperEvidencePort",
  "commandHandlers()"
]);

requireText("apps/runtime/src/ports/operator-ports.ts", [
  "OperatorCommandHandlerRegistry",
  "SelectedCandidatePaperEvidencePort"
]);

const bannedControllerImports = [
  "@ouroboros/local-store",
  "../agent-profiles",
  "../providers/",
  "../sandboxes/",
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

if (problems.length) {
  console.error("Architecture governance check failed:");
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("Architecture governance checks passed");
