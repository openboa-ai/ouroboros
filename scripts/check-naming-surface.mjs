#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const listed = (args) => execFileSync("git", args, { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

const files = Array.from(new Set([
  ...listed(["ls-files"]),
  ...listed(["ls-files", "--others", "--exclude-standard"])
]))
  .filter((path) => existsSync(path))
  .filter((path) => !path.includes("node_modules/"))
  .filter((path) => path !== "package-lock.json");

const text = (path) => readFileSync(path, "utf8");
const s = (...parts) => parts.join("");
const problems = [];

function fail(path, lineNumber, message) {
  problems.push(`${path}:${lineNumber}: ${message}`);
}

function checkForbiddenText(path, terms) {
  const body = text(path);
  body.split("\n").forEach((line, index) => {
    for (const term of terms) {
      if (line.includes(term)) {
        fail(path, index + 1, `uses retired naming ${JSON.stringify(term)}`);
      }
    }
  });
}

function checkForbiddenPath(path, terms) {
  for (const term of terms) {
    if (path.includes(term)) {
      fail(path, 1, `path uses retired naming ${JSON.stringify(term)}`);
    }
  }
}

function checkRequired(path, terms) {
  const body = text(path);
  for (const term of terms) {
    if (!body.includes(term)) {
      problems.push(`${path}: missing canonical naming surface ${JSON.stringify(term)}`);
    }
  }
}

const retiredTerms = [
  s("Runtime", "Authority"),
  s("Runtime", " ", "Authority"),
  s("Bounded", "Runtime", "Authority"),
  s("Bounded", " ", "Runtime", " ", "Authority"),
  s("Replay", "Runtime", "Authority"),
  s("Replay", " ", "Runtime", " ", "Authority"),
  s("Trading", "Ledger"),
  s("Runnable", "Artifact"),
  s("Trading", "System", "Runtime"),
  s("Sandbox", "Runtime", "Instance"),
  s("Runtime", "Instance"),
  s("Runtime", "Placement"),
  s("Order", "Intent", "Draft"),
  s("Gateway", "Decision"),
  s("Execution", "Attempt"),
  s("Artifact", "Change", "Proposal"),
  s("Artifact", "Improvement", "Loop"),
  s("runtime", " authority"),
  s("bounded", " authority"),
  s("replay", " runtime"),
  s("trading", " ledger"),
  s("runnable", " artifact"),
  s("trading", " system ", "runtime"),
  s("sandbox", " runtime ", "instance"),
  s("runtime", " ", "instance"),
  s("runtime", " ", "placement"),
  s("order", " intent ", "draft"),
  s("gateway", " ", "decision"),
  s("execution", " ", "attempt"),
  s("artifact", " change ", "proposal"),
  s("artifact", "_change", "_proposal"),
  s("artifact", "-change", "-proposal"),
  s("runtime", "_authority"),
  s("bounded", "_authority"),
  s("trading", "_ledger"),
  s("runnable", "_artifact"),
  s("trading", "_system", "_runtime"),
  s("sandbox", "_runtime", "_instance"),
  s("runtime", "_instance"),
  s("runtime", "_placement"),
  s("order", "_intent", "_draft"),
  s("gateway", "_decision"),
  s("execution", "_attempt"),
  s("runtime", "-authority"),
  s("trading", "-loop"),
  s("improvement", "-loop"),
  s("runtime", "-control"),
  s("runtime", "-instances"),
  s("runnable", "-artifact")
];

const retiredPathTerms = [
  s("artifact", "-change", "-proposal"),
  s("runtime", "-authority"),
  s("runtime", "-control"),
  s("runtime", "-instances"),
  s("runnable", "-artifact"),
  s("trading", "-loop"),
  s("improvement", "-loop"),
  s("sandbox", "-runtime")
];

const scannedExtensions = /\.(md|mjs|js|ts|tsx|json|py|sh|toml|yaml|yml)$/;
for (const path of files) {
  checkForbiddenPath(path, retiredPathTerms);
  if (scannedExtensions.test(path)) {
    checkForbiddenText(path, retiredTerms);
  }
}

checkRequired("README.md", [
  "Candidate Arena -> Trading System -> System Code -> Evaluation -> selected Trading Run -> Sandbox -> Gateway -> Ledger"
]);
checkRequired("ARCHITECTURE.md", [
  "Candidate Arena -> Trading System -> System Code -> Evaluation -> selected Trading Run -> Sandbox -> Gateway -> Ledger"
]);
checkRequired("docs/project-direction.md", [
  "CandidateArena",
  "TradingSystem",
  "Evaluation",
  "parallel TradingSystem candidates",
  "revenue - cost",
  "Gateway",
  "Ledger",
  "GitHub repository on `main` is the source of truth"
]);
checkRequired("docs/ouroboros-doctrine.md", [
  "CandidateArena",
  "TradingSystem",
  "TradingSystem may include an internal agent runtime",
  "Researcher cannot grade",
  "Gateway binding changes, TradingSystem identity does not",
  "Candidate, Paper Evidence, and Live are separate states",
  "Evaluation",
  "Finding",
  "Lineage",
  "PaperEvidence",
  "Gateway",
  "Ledger",
  "Ouroboros"
]);
checkRequired("docs/api-command-contract.md", [
  "GET /api/operator",
  "POST /api/commands",
  "OuroborosCommand",
  "OperatorReadModel",
  "OUROBOROS_COMMAND_REGISTRY",
  "arena.tick",
  "candidate.select",
  "candidate.paper_evidence.run"
]);
checkRequired("docs/naming-taxonomy.md", [
  "`CandidateArena`",
  "`ResearchWorker`",
  "`ResearchDirection`",
  "`CandidateArenaTick`",
  "`TradingSystem`",
  "internal agent runtime",
  "`SystemCode`",
  "`Evaluation`",
  "`Finding`",
  "`Lineage`",
  "`PaperEvidence`",
  "`TradingRun`",
  "`Sandbox`",
  "`Gateway`",
  "`Ledger`",
  "`OuroborosCommand`",
  "`OperatorReadModel`",
  "`AgentProfile`"
]);
checkRequired("AGENTS.md", [
  "`CandidateArena`",
  "`ResearchWorker`",
  "`ResearchDirection`",
  "`CandidateArenaTick`",
  "`TradingSystem`",
  "`SystemCode`",
  "`TradingRun`",
  "`Sandbox`",
  "`Ledger`"
]);
checkRequired("packages/domain/src/index.ts", [
  "export interface LedgerReadModel",
  "export interface TradingRunRecord",
  "export type SystemCodeRecord",
  "export interface SandboxIndexProjection",
  "export interface StartSandboxInput",
  "export interface ImprovementReadModel",
  "export type OuroborosCommandKind",
  "export const OUROBOROS_COMMAND_REGISTRY",
  "export interface OperatorReadModel"
]);
checkRequired("apps/runtime/src/controllers/core-controller.ts", [
  "/api/operator",
  "/api/commands",
  "/api/gateway/environment"
]);
checkRequired("apps/runtime/src/controllers/resource-controller.ts", [
  "/api/candidates",
  "/api/candidates/:candidate_id",
  "/api/candidates/:candidate_id/evaluations",
  "/api/evaluations/:evaluation_id",
  "/api/candidates/:candidate_id/replay-runs",
  "/api/replay-runs/:run_id",
  "/api/replay-runs/:run_id/validation-state",
  "/api/replay-runs/:run_id/comparison",
  "/api/trading-runs/:run_id",
  "/api/sandboxes",
  "/api/sandboxes/:sandbox_id",
  "/api/sandboxes/:sandbox_id/logs",
  "/api/trading-substrate/order-fill/latest",
  "/api/trading-substrate/public-market/latest",
  "/api/trading-substrate/private-readiness/latest",
  "/api/trading-substrate/private-readiness-posture/latest",
  "/api/trading-substrate/account-position-risk/latest"
]);
checkRequired("apps/operator-web/src/App.tsx", [
  "Start trading run",
  "Ledger",
  "Improvement",
  "Run Control"
]);

if (problems.length) {
  console.error("Naming surface check failed:");
  console.error(problems.slice(0, 300).join("\n"));
  process.exit(1);
}

console.log("Naming surface checks passed");
