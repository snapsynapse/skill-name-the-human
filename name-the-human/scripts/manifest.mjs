#!/usr/bin/env node
// manifest.mjs: write or check MANIFEST.yaml for the bundle (Skill Provenance shape).
//
//   node manifest.mjs            rewrite MANIFEST.yaml with current SHA-256 hashes
//   node manifest.mjs --check    exit 1 if any hash in MANIFEST.yaml differs from the file on disk
//
// MANIFEST.yaml is not self-listed. Per-file versions are integers and are kept
// from the existing manifest when a file's hash is unchanged.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(here, "..");
const manifestPath = path.join(bundle, "MANIFEST.yaml");
const check = process.argv.includes("--check");

const HEADER = `bundle: name-the-human
bundle_version: 0.1.0
bundle_date: 2026-09-15
description: >
  Deployer-side accountability inventory for automated and AI systems. A
  read-only harvest over four location classes, a model judge that must cite
  its evidence, a human-only naming pass, and a validator that recomputes the
  totals. Schema name-the-human/v0.3.
frontmatter_mode: minimal

compatibility:
  node: ">=22"
  designed_for:
    platform: Portable skill bundle (Claude Code, Codex)
    surface: Code
  tested_on:
    - platform: Anthropic Claude
      model: Claude Fable 5.1
      surface: Code
      status: pass
      date: 2026-09-15
      skill_version: 1
      notes: >
        Built and self-tested on the author's macOS estate. Fixture suite
        passes; harvest run twice over the real estate with identical ids.
    - platform: OpenAI Codex
      surface: Code
      status: partial
      date: 2026-09-15
      skill_version: 1
      notes: >
        The v0.2 prompt was run through Codex against the same estate and
        produced the seventeen rows that motivated schema v0.3. The v0.3
        bundle itself has not yet been exercised from Codex.

deployments: []

files:
`;

function role(rel) {
  if (rel === "SKILL.md") return "skill";
  if (rel === "CHANGELOG.md") return "reference";
  if (rel.startsWith("scripts/")) return "script";
  if (rel.startsWith("references/")) return "reference";
  if (rel.startsWith("assets/")) return "asset";
  return "source";
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full, base));
    else if (e.isFile() && e.name !== "MANIFEST.yaml" && e.name !== ".DS_Store") out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

const sha = (rel) => crypto.createHash("sha256").update(fs.readFileSync(path.join(bundle, rel))).digest("hex");

const existing = new Map();
if (fs.existsSync(manifestPath)) {
  const text = fs.readFileSync(manifestPath, "utf8");
  for (const m of text.matchAll(/- path: (\S+)\n\s+role: \S+\n\s+version: (\d+)\n\s+hash: ([0-9a-f]{64})/g)) existing.set(m[1], { version: Number(m[2]), hash: m[3] });
}

const files = listFiles(bundle);
let drift = 0;
let body = "";
for (const rel of files) {
  const hash = sha(rel);
  const prev = existing.get(rel);
  const version = prev ? (prev.hash === hash ? prev.version : prev.version + 1) : 1;
  if (check) {
    if (!prev) { console.error(`not in manifest: ${rel}`); drift++; }
    else if (prev.hash !== hash) { console.error(`hash drift: ${rel}`); drift++; }
  }
  body += `  - path: ${rel}\n    role: ${role(rel)}\n    version: ${version}\n    hash: ${hash}\n`;
}
if (check) {
  for (const rel of existing.keys()) if (!files.includes(rel)) { console.error(`in manifest but missing on disk: ${rel}`); drift++; }
  if (drift) { console.error(`${drift} manifest drift(s); run node name-the-human/scripts/manifest.mjs`); process.exit(1); }
  console.log(`MANIFEST.yaml matches ${files.length} file(s)`);
} else {
  fs.writeFileSync(manifestPath, HEADER + body);
  console.log(`wrote MANIFEST.yaml with ${files.length} file(s)`);
}
