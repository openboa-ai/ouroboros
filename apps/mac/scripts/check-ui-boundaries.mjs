import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../src", import.meta.url));
const violations = [];
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
for (const file of walk(root).filter((f) => /\.(ts|tsx)$/.test(f))) {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  const source = fs.readFileSync(file, "utf8");
  const imports = [
    ...source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g),
  ].map((m) => m[1]);
  for (const imp of imports) {
    if (
      rel.startsWith("ui/") &&
      /^@\/(app|features|domains|development|data)\//.test(imp)
    )
      violations.push(`${rel}: UI layer imports ${imp}`);
    if (rel.startsWith("ui/") && /@tauri-apps|client|model/.test(imp))
      violations.push(`${rel}: UI layer imports transport ${imp}`);
    if (
      /^(features\/(company|conversations|library)|domains)\//.test(rel) &&
      /development\//.test(imp)
    )
      violations.push(`${rel}: screen imports sample source ${imp}`);
    if (
      /^(features|app|contracts|data)\//.test(rel) &&
      imp.startsWith("@/domains/")
    )
      violations.push(`${rel}: common feature imports investment ${imp}`);
  }
  if (
    /^(features|domains|app)\//.test(rel) &&
    /(?:text-\[(?:\d)|fontSize\s*:)/.test(source)
  )
    violations.push(`${rel}: ad hoc typography; use semantic roles`);
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log(
  "UI boundaries passed: tokens/primitives/components/layouts independent; screen and domain imports isolated.",
);
