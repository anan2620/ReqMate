#!/usr/bin/env node
/**
 * Model drift guard: Rust DTOs vs the hand-written TypeScript mirrors.
 *
 * `packages/types` mirrors `apps/desktop/src-tauri/src/models`. Until the
 * types are generated (ts-rs), this script is what keeps them honest: it
 * parses both sides and fails when a serialized field exists on one side
 * only, because that either breaks the bridge at runtime or leaves dead
 * fields in the UI.
 *
 * Only names declared on both sides are compared; a struct/type that exists
 * on one side only is reported as informational.
 *
 * Usage: node scripts/check-model-drift.mjs [--verbose]
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUST_MODELS_DIR = join(root, "apps/desktop/src-tauri/src/models");
// Serialized DTOs that live outside models/ but cross the bridge as well.
const EXTRA_RUST_FILES = [
  "apps/desktop/src-tauri/src/storage/settings.rs",
  "apps/desktop/src-tauri/src/storage/history.rs",
];
const TS_TYPES_FILE = join(root, "packages/types/src/index.ts");
const verbose = process.argv.includes("--verbose");

// ─── helpers ────────────────────────────────────────────────────────────────

const toWords = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[_\s]+/)
    .filter(Boolean);

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

const toCamel = (s) =>
  toWords(s)
    .map((w, i) => (i === 0 ? w.toLowerCase() : cap(w)))
    .join("");

const toKebab = (s) => toWords(s).map((w) => w.toLowerCase()).join("-");

const applyRenameRule = (name, rule) => {
  switch (rule) {
    case "camelCase":
      return toCamel(name);
    case "kebab-case":
      return toKebab(name);
    case "PascalCase":
      return toWords(name).map(cap).join("");
    case "lowercase":
      return name.toLowerCase();
    case "UPPERCASE":
      return name.toUpperCase();
    default:
      return name;
  }
};

/** Index of the closing brace matching the one at `openIndex`. */
function matchBrace(src, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return src.length - 1;
}

/** Extract `rename_all = "..."` / `tag = "..."` from a serde attribute blob. */
function serdeOpt(attrsText, key) {
  const m = attrsText.match(new RegExp(`${key}\\s*=\\s*"([^"]+)"`));
  return m ? m[1] : null;
}

const isSkipped = (attrsText) =>
  /#\[serde\([^\]]*skip(?:ping)?\b/.test(attrsText);

// ─── Rust parsing ───────────────────────────────────────────────────────────

/** Parse `field: Type,` lines of a struct/variant body, honouring serde attrs. */
function parseFields(body, renameAll) {
  const fields = [];
  let attrs = [];
  let attrDepth = 0; // >0 while inside a multi-line #[serde(...)]

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (attrDepth > 0) {
      attrs.push(line);
      attrDepth += (line.match(/\[/g) ?? []).length - (line.match(/\]/g) ?? []).length;
      continue;
    }
    if (line.startsWith("#[")) {
      attrs.push(line);
      attrDepth = (line.match(/\[/g) ?? []).length - (line.match(/\]/g) ?? []).length;
      continue;
    }
    if (line.startsWith("///") || line.startsWith("//")) continue;

    const m = line.match(/^(?:pub\s+)?([a-z_][A-Za-z0-9_]*)\s*:\s*(.+?),?$/);
    if (!m) {
      attrs = [];
      continue;
    }

    const [, rustName, rustType] = m;
    const attrsText = attrs.join(" ");
    attrs = [];

    if (isSkipped(attrsText)) continue;

    const explicit = serdeOpt(attrsText, "rename");
    fields.push({
      name: explicit ?? applyRenameRule(rustName, renameAll),
      rustName,
      rustType: rustType.trim(),
      optional: attrsText.includes("default") || rustType.trim().startsWith("Option<"),
    });
  }

  return fields;
}

function parseRustFile(src) {
  const structs = new Map();
  const enums = new Map();

  const itemRe = /pub\s+(struct|enum)\s+([A-Za-z0-9_]+)[^;{]*\{/g;
  let match;
  while ((match = itemRe.exec(src)) !== null) {
    const [, kind, name] = match;
    const openIndex = match.index + match[0].length - 1;
    const closeIndex = matchBrace(src, openIndex);
    const body = src.slice(openIndex + 1, closeIndex);

    // serde attributes sit between the previous item and this keyword
    const attrStart = Math.max(0, src.lastIndexOf("}", match.index) + 1);
    const itemAttrs = src.slice(attrStart, match.index);
    const itemRenameAll = serdeOpt(itemAttrs, "rename_all") ?? "none";

    if (kind === "struct") {
      // Nested generics/newlines in types are rare here; line-based is enough.
      const fields = parseFields(body, itemRenameAll);
      if (fields.length > 0) structs.set(name, { name, fields });
      itemRe.lastIndex = closeIndex;
      continue;
    }

    // ── tagged enum ──
    const tag = serdeOpt(itemAttrs, "tag");
    const variants = [];
    let pendingAttrs = [];
    let depth = 0;
    let current = null;
    let variantBodyStart = -1;

    const lines = body.split("\n");
    let offset = 0;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const lineStart = offset;
      offset += rawLine.length + 1;

      if (depth === 0) {
        if (!line || line.startsWith("//") || line.startsWith("#[")) {
          if (line.startsWith("#[")) pendingAttrs.push(line);
          continue;
        }
        const vm = line.match(/^([A-Z][A-Za-z0-9_]*)\s*(\{|\(|,|$)/);
        if (vm) {
          const explicit = serdeOpt(pendingAttrs.join(" "), "rename");
          current = {
            rustName: vm[1],
            tagValue: explicit ?? applyRenameRule(vm[1], serdeOpt(pendingAttrs.join(" "), "rename_all") ?? itemRenameAll),
            fields: [],
          };
          pendingAttrs = [];
          variants.push(current);
          if (vm[2] === "{") variantBodyStart = lineStart + rawLine.indexOf("{") + 1;
        }
      } else if (current && variantBodyStart >= 0) {
        // closed below
      }

      depth += (rawLine.match(/\{/g) ?? []).length;
      depth -= (rawLine.match(/\}/g) ?? []).length;

      if (current && variantBodyStart >= 0 && depth === 0) {
        const variantBody = body.slice(variantBodyStart, lineStart + rawLine.lastIndexOf("}"));
        current.fields = parseFields(variantBody, itemRenameAll);
        variantBodyStart = -1;
      }
    }

    if (tag) enums.set(name, { name, tag, variants, renameAll: itemRenameAll });
    itemRe.lastIndex = closeIndex;
  }

  return { structs, enums };
}

function collectRustModels() {
  const structs = new Map();
  const enums = new Map();

  const sources = [
    ...readdirSync(RUST_MODELS_DIR)
      .filter((f) => f.endsWith(".rs"))
      .map((f) => join(RUST_MODELS_DIR, f)),
    ...EXTRA_RUST_FILES.map((f) => join(root, f)),
  ];

  for (const path of sources) {
    const src = readFileSync(path, "utf8");
    const parsed = parseRustFile(src);
    for (const [name, value] of parsed.structs) structs.set(name, { ...value, file: path });
    for (const [name, value] of parsed.enums) enums.set(name, { ...value, file: path });
  }

  return { structs, enums };
}

// ─── TypeScript parsing ─────────────────────────────────────────────────────

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "{" || ch === "(" || ch === "[" || ch === "<") depth++;
    if (ch === "}" || ch === ")" || ch === "]" || ch === ">") depth--;
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function parseTsFields(body) {
  const fields = [];
  const cleaned = body
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
  for (const piece of splitTopLevel(cleaned, ";")) {
    const m = piece.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\??)\s*:/);
    if (m) fields.push({ name: m[1], optional: m[2] === "?" });
  }
  return fields;
}

function parseTsTypes(src) {
  const interfaces = new Map();
  const unions = new Map();

  const ifaceRe = /export\s+interface\s+([A-Za-z0-9_]+)([^{]*)\{/g;
  let match;
  while ((match = ifaceRe.exec(src)) !== null) {
    const name = match[1];
    const heritage = match[2] ?? "";
    const openIndex = match.index + match[0].length - 1;
    const closeIndex = matchBrace(src, openIndex);
    if (!heritage.includes("extends")) {
      interfaces.set(name, parseTsFields(src.slice(openIndex + 1, closeIndex)));
    }
    ifaceRe.lastIndex = closeIndex;
  }

  // Discriminated unions: `export type X = | {...} | {...};` — the RHS contains
  // `;` inside object literals, so scan to the next top-level `export` instead.
  const unionRe = /export\s+type\s+([A-Za-z0-9_]+)\s*=/g;
  while ((match = unionRe.exec(src)) !== null) {
    const name = match[1];
    const rhsStart = match.index + match[0].length;
    const remainder = src.slice(rhsStart);
    const nextExport = remainder.search(/\nexport\s/);
    const rhs = nextExport === -1 ? remainder : remainder.slice(0, nextExport);

    if (!rhs.includes("{")) continue;

    const members = splitTopLevel(rhs, "|")
      .map((part) => part.trim())
      .filter((part) => part.startsWith("{"));

    if (members.length === 0) continue;

    const variants = [];
    for (const member of members) {
      const body = member.replace(/^\{/, "").replace(/\}$/, "");
      const tagMatch = body.match(/\btype\s*:\s*"([^"]+)"/);
      if (!tagMatch) continue;
      variants.push({
        tagValue: tagMatch[1],
        fields: parseTsFields(body).filter((f) => f.name !== "type"),
      });
    }
    if (variants.length > 0) unions.set(name, variants);
  }

  return { interfaces, unions };
}

// ─── comparison ─────────────────────────────────────────────────────────────

function compareFieldSets(label, rustFields, tsFields, problems) {
  const rustNames = new Set(rustFields.map((f) => f.name));
  const tsNames = new Set(tsFields.map((f) => f.name));

  for (const name of rustNames) {
    if (!tsNames.has(name)) {
      problems.push(`${label}: field "${name}" is serialized by Rust but missing in TypeScript`);
    }
  }
  for (const name of tsNames) {
    if (!rustNames.has(name)) {
      problems.push(`${label}: field "${name}" exists in TypeScript but not in Rust`);
    }
  }

  if (verbose) {
    const shared = [...rustNames].filter((n) => tsNames.has(n)).length;
    console.log(`  ${label}: ${shared} shared fields`);
  }
}

const rust = collectRustModels();
const ts = parseTsTypes(readFileSync(TS_TYPES_FILE, "utf8"));

const problems = [];
let comparedStructs = 0;
let comparedEnums = 0;

for (const [name, model] of rust.structs) {
  const fields = ts.interfaces.get(name);
  if (!fields) continue;
  comparedStructs++;
  compareFieldSets(name, model.fields, fields, problems);
}

for (const [name, model] of rust.enums) {
  const variants = ts.unions.get(name);
  if (!variants) continue;
  comparedEnums++;

  const rustTags = new Map(model.variants.map((v) => [v.tagValue, v]));
  const tsTags = new Map(variants.map((v) => [v.tagValue, v]));

  for (const [tag, variant] of rustTags) {
    const tsVariant = tsTags.get(tag);
    if (!tsVariant) {
      problems.push(`${name}: variant "${tag}" is serialized by Rust but missing in TypeScript`);
      continue;
    }
    compareFieldSets(`${name}["${tag}"]`, variant.fields, tsVariant.fields, problems);
  }
  for (const tag of tsTags.keys()) {
    if (!rustTags.has(tag)) {
      problems.push(`${name}: variant "${tag}" exists in TypeScript but not in Rust`);
    }
  }
}

if (verbose) {
  console.log(
    `\nCompared ${comparedStructs} structs and ${comparedEnums} tagged enums ` +
      `(${rust.structs.size} structs / ${rust.enums.size} enums on the Rust side).`,
  );
}

if (problems.length > 0) {
  console.error("Rust ↔ TypeScript model drift detected:\n");
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(
    `\n${problems.length} mismatch(es). Fix packages/types/src/index.ts (or the Rust DTO) so both sides agree.`,
  );
  process.exit(1);
}

console.log(
  `Rust ↔ TypeScript models agree (${comparedStructs} structs, ${comparedEnums} tagged enums compared).`,
);
