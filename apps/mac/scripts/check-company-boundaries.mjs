import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const app = fileURLToPath(new URL("../", import.meta.url));
const fromApp = (relative) => path.join(app, relative);
import { execFileSync } from "node:child_process";
const errors = [];
const walk = (d) =>
  fs.existsSync(d)
    ? fs
        .readdirSync(d, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
        )
    : [];
for (const file of walk(fromApp("src")).filter((f) =>
  /\.(tsx?|json)$/.test(f),
)) {
  const text = fs.readFileSync(file, "utf8");
  if (
    /(?:from\s*|import\s*\(?)["'][^"']*(?:\/evidence\/|@\/company\/)/.test(text)
  )
    errors.push(`${file}: private publication import`);
  if (/Sangjoon|sangjoon|Ouroboros Capital/.test(text))
    errors.push(`${file}: personal/company identity in product source`);
  if (
    !file.includes("/development/") &&
    !file.includes("/fixtures/") &&
    !file.includes(".test.") &&
    /\b(?:Atlas|Nova)\b/.test(text)
  )
    errors.push(`${file}: sample identity in reusable code`);
}
for (const file of execFileSync(
  "git",
  [
    "ls-files",
    "--",
    "apps/mac/evidence",
    "apps/mac/src/company",
    "company-private",
  ],
  { cwd: path.resolve(app, "../.."), encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean))
  errors.push(`${file}: private material is tracked`);
if (process.argv.includes("--distribution")) {
  if (!fs.existsSync(fromApp("dist/index.html")))
    errors.push("Distribution missing");
  for (const file of walk(fromApp("dist")).filter((f) =>
    /\.(js|html|json|css)$/.test(f),
  )) {
    if (
      /Sangjoon|Ouroboros Capital|CompanyPulse|9dbb1695-2812-4db5-bfad-a2b8f944c258/.test(
        fs.readFileSync(file, "utf8"),
      )
    )
      errors.push(`${file}: private identity or artifact in distribution`);
  }
}
const cap = JSON.parse(
  fs.readFileSync(fromApp("src-tauri/capabilities/owner-console.json"), "utf8"),
);
if (
  cap.windows?.length ||
  JSON.stringify(cap.webviews) !== JSON.stringify(["main"])
)
  errors.push("Owner capability must target only the main WebView");
// A registered handler without generated/assigned permission silently fails at the IPC boundary.
const nativeSource = fs.readFileSync(fromApp("src-tauri/src/main.rs"), "utf8");
const manifestSource = fs.readFileSync(fromApp("src-tauri/build.rs"), "utf8");
const registered =
  nativeSource
    .match(/tauri::generate_handler!\[([\s\S]*?)\]/)?.[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean) ?? [];
const capabilities = walk(fromApp("src-tauri/capabilities"))
  .filter((f) => f.endsWith(".json"))
  .map((file) => JSON.parse(fs.readFileSync(file, "utf8")));
for (const command of registered) {
  if (!manifestSource.includes(`"${command}"`))
    errors.push(`${command}: missing native manifest registration`);
  const permission = `allow-${command.replaceAll("_", "-")}`;
  if (!capabilities.some((cap) => cap.permissions.includes(permission)))
    errors.push(`${command}: missing native capability permission`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  "Company boundaries passed: no private source/evidence imports; owner capabilities are WebView-scoped.",
);
