import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const exts = new Set([".js", ".mjs", ".cjs"]);
const roots = ["src", "tests", "scripts"];
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (exts.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
}

for (const root of roots) {
  walk(root);
}

if (!files.length) {
  console.log("No JS files found for linting.");
  process.exit(0);
}

let failed = false;
for (const file of files.sort()) {
  const check = spawnSync(process.execPath, ["--check", file], {
    stdio: "pipe",
    encoding: "utf8"
  });

  if (check.status !== 0) {
    failed = true;
    process.stderr.write(`\n[lint] Syntax error in ${file}\n`);
    process.stderr.write(check.stderr || check.stdout || "Unknown syntax error\n");
  }
}

if (failed) {
  process.exit(1);
}

console.log(`[lint] OK (${files.length} files)`);
