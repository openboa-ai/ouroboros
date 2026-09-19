import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(
  new URL("./package-company-ui.mjs", import.meta.url),
);
const product = fileURLToPath(new URL("../../../", import.meta.url));

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ouro-package-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, "input"),
    output = path.join(root, "output");
  fs.mkdirSync(input);
  fs.writeFileSync(path.join(input, "index.html"), "<p>Fixture</p>");
  const definition = path.join(root, "definition.json");
  fs.writeFileSync(definition, JSON.stringify({ id: "fixture" }));
  const run = (source = input, destination = output) =>
    spawnSync(process.execPath, [script, source, definition, destination], {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
    });
  return { root, input, output, run };
}

test("packages exact bytes from an unrelated working directory", (t) => {
  const f = fixture(t),
    result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const content = fs.readFileSync(path.join(f.output, "index.html"));
  const manifest = JSON.parse(
    fs.readFileSync(path.join(f.output, "manifest.json")),
  );
  assert.equal(
    manifest.files[0].sha256,
    createHash("sha256").update(content).digest("hex"),
  );
  assert.equal(content.toString(), "<p>Fixture</p>");
});

test("always rejects the actual product checkout as input or output", (t) => {
  const f = fixture(t);
  for (const result of [
    f.run(path.join(product, "apps/mac/public")),
    f.run(f.input, path.join(product, ".local/disallowed-package")),
  ]) {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /outside the product checkout/);
  }
  assert.equal(fs.existsSync(f.output), false);
});

test("rejects symlinked output parents into the product checkout", (t) => {
  const f = fixture(t),
    link = path.join(f.root, "product-link");
  fs.symlinkSync(product, link, "dir");
  const result = f.run(f.input, path.join(link, "disallowed-package"));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /resolves into product checkout/);
});

test("rejects symlink assets before copying", (t) => {
  const f = fixture(t);
  fs.symlinkSync(
    path.join(f.input, "index.html"),
    path.join(f.input, "alias.html"),
  );
  assert.match(f.run().stderr, /Symbolic links/);
  assert.equal(fs.existsSync(f.output), false);
});

test("rejects a named pipe without waiting for a writer", (t) => {
  const f = fixture(t);
  execFileSync("mkfifo", [path.join(f.input, "pipe.js")]);
  const result = f.run();
  assert.equal(result.error, undefined);
  assert.match(result.stderr, /regular files/);
  assert.equal(fs.existsSync(f.output), false);
});

test("rejects an oversized asset before reading or creating output", (t) => {
  const f = fixture(t),
    file = path.join(f.input, "oversized.js");
  fs.closeSync(fs.openSync(file, "w"));
  fs.truncateSync(file, 8 * 1024 * 1024 + 1);
  assert.match(f.run().stderr, /exceeds 8 MiB/);
  assert.equal(fs.existsSync(f.output), false);
});
