/** Packages already-built firm files. Does not execute them, install dependencies or publish. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
const [inputArg, definitionArg, outputArg] = process.argv.slice(2);
if (!inputArg || !definitionArg || !outputArg)
  throw new Error(
    "Usage: node package-company-ui.mjs <compiled-directory> <definition.json> <new-output-directory>",
  );
const input = fs.realpathSync(inputArg),
  output = path.resolve(outputArg),
  repo = fs.realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));
if (
  input === repo ||
  input.startsWith(repo + path.sep) ||
  output === repo ||
  output.startsWith(repo + path.sep)
)
  throw new Error(
    "Firm package input/output must be outside the product checkout.",
  );
let ancestor = path.dirname(output);
while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
const actualAncestor = fs.realpathSync(ancestor);
if (actualAncestor === repo || actualAncestor.startsWith(repo + path.sep))
  throw new Error("Output resolves into product checkout");
const manifest = JSON.parse(fs.readFileSync(definitionArg, "utf8"));
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};
const files = [];
let totalBytes = 0;
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink())
      throw new Error("Symbolic links are not package inputs");
    if (entry.isDirectory()) {
      scan(file);
      continue;
    }
    if (!entry.isFile())
      throw new Error("Package inputs must be regular files");
    const type = mime[path.extname(file)];
    if (!type) throw new Error("Unsupported asset " + file);
    const size = fs.statSync(file).size;
    if (size > 8 * 1024 * 1024) throw new Error("Asset exceeds 8 MiB");
    if (files.length >= 128 || totalBytes + size > 32 * 1024 * 1024)
      throw new Error("Package exceeds bounds");
    const bytes = fs.readFileSync(file);
    if (bytes.length !== size)
      throw new Error("Package input changed during read");
    totalBytes += bytes.length;
    files.push({
      path: path.relative(input, file).split(path.sep).join("/"),
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      mime: type,
      bytes,
    });
  }
}
scan(input);
if (files.some((f) => !/^[A-Za-z0-9/._-]+$/.test(f.path)))
  throw new Error("Package paths must be URL-safe");
if (
  files.length > 128 ||
  files.reduce((n, f) => n + f.bytes.length, 0) > 32 * 1024 * 1024
)
  throw new Error("Package exceeds bounds");
if (fs.existsSync(output)) throw new Error("Output must be a new directory");
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
for (const f of files) {
  const dest = path.join(output, f.path);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, f.bytes);
}
const result = {
  ...manifest,
  schemaVersion: 1,
  sdkVersion: 1,
  files: files.map(({ path, sha256, mime }) => ({ path, sha256, mime })),
};
fs.writeFileSync(
  path.join(output, "manifest.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  "Packaged " +
    files.length +
    " immutable input files. Publish through the company Gateway; this did not activate a release.",
);
