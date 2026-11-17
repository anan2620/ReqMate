#!/usr/bin/env node
/**
 * Version consistency guard.
 *
 * Single source of truth: the `version` field of the root package.json.
 * Every manifest that ships or is published must match it, otherwise the
 * updater endpoint, release tags and package-manager manifests drift apart.
 *
 * Usage: node scripts/check-versions.mjs   (exit code 1 on mismatch)
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relPath) => readFileSync(resolve(root, relPath), "utf8");

/** package.json files that are published or that pin the app version. */
const PACKAGE_JSONS = [
  "package.json",
  "apps/desktop/package.json",
  "apps/web/package.json",
  "apps/vscode-extension/package.json",
  "apps/cli/npm/package.json",
  "packages/types/package.json",
  "packages/importer/package.json",
];

/** Cargo manifests: [manifestPath, packageNameInLockFile, lockPath]. */
const CARGO_MANIFESTS = [
  [
    "apps/desktop/src-tauri/Cargo.toml",
    "reqmate",
    "apps/desktop/src-tauri/Cargo.lock",
  ],
  ["apps/cli/Cargo.toml", "reqmate-cli", "apps/cli/Cargo.lock"],
  ["apps/mcp-server/Cargo.toml", "reqmate-mcp", "apps/mcp-server/Cargo.lock"],
];

const TAURI_CONFIG = "apps/desktop/src-tauri/tauri.conf.json";

const problems = [];
const checked = [];

function expect(where, actual, expected) {
  checked.push(where);
  if (actual !== expected) {
    problems.push(`${where}: ${actual} (expected ${expected})`);
  }
}

// 1. Root package.json is the source of truth.
const expected = JSON.parse(read("package.json")).version;
if (!/^\d+\.\d+\.\d+/.test(expected)) {
  console.error(`Root package.json has an invalid version: ${expected}`);
  process.exit(1);
}

// 2. Every package.json must match.
for (const file of PACKAGE_JSONS) {
  expect(file, JSON.parse(read(file)).version, expected);
}

// 3. Cargo manifests — only the [package] version, not dependency versions.
for (const [manifest, crateName, lockPath] of CARGO_MANIFESTS) {
  const toml = read(manifest);
  const inPackageSection = toml.split(/^\[/m).find((s) => s.startsWith("package]"));
  const cargoVersion = inPackageSection?.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  expect(`${manifest} [package].version`, cargoVersion ?? "<missing>", expected);

  // 4. The matching lock file entry, so `cargo --locked` stays green.
  const lock = read(lockPath);
  const locked = lock.match(
    new RegExp(`name = "${crateName}"\\nversion = "([^"]+)"`),
  )?.[1];
  expect(`${lockPath} entry "${crateName}"`, locked ?? "<missing>", expected);
}

// 5. Tauri config drives the packaged installer + updater version.
expect(TAURI_CONFIG, JSON.parse(read(TAURI_CONFIG)).version, expected);

if (problems.length > 0) {
  console.error("Version mismatch detected (source of truth: root package.json):\n");
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(
    `\n${problems.length} of ${checked.length} checked manifests drifted from ${expected}.`,
  );
  process.exit(1);
}

console.log(`All ${checked.length} manifests are on version ${expected}.`);
