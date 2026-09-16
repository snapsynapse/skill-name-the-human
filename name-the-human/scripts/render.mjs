#!/usr/bin/env node
// render.mjs: turn a Name the Human inventory into the one-page table.
//
// JSON is the artifact. This is a view of it: nine columns, three totals,
// the triage list, and a short account of what was scanned, excluded and
// proposed. Nothing here is computed from anything but the file.
//
// Usage:
//   node render.mjs inventory.json [--out inventory.md] [--title "..."]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { recomputeTotals, derived } = await import(path.join(here, "validate.mjs"));

const BLANK = "[ ]"; // a human field nobody has filled. The emptiness is the finding, so it gets a mark rather than a blank cell.

function cell(v) {
  if (v === null || v === undefined || v === "") return BLANK;
  return String(v).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function yesNo(v) {
  if (v === null || v === undefined) return BLANK;
  return v ? "yes" : "no";
}

function reach(s) {
  const r = s.blast_radius?.value ?? null;
  const pd = s.moves_personal_data?.value;
  if (r === null) return BLANK;
  return pd ? `${r}, moves personal data` : r;
}

function detection(s) {
  const d = s.detection ?? {};
  if (d.who_finds_out === null || d.who_finds_out === undefined) return BLANK;
  return `${d.who_finds_out} / ${d.lag ?? BLANK}`;
}

function fallback(s) {
  const { bus_factor_one, orphan } = derived(s);
  const base = cell(s.fallback);
  return !orphan && bus_factor_one ? `${base} (bus factor one)` : base;
}

export function render(doc, { title = "Name the Human" } = {}) {
  const t = recomputeTotals(doc.surfaces ?? []);
  const lines = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`Generated ${doc.generated}. Schema ${doc.schema}. ${doc.scope_rule}`);
  lines.push("");
  lines.push("| Surface | Unattended action | If wrong, who finds out / how long | Reach | Accountable | Fallback | Can they stop it alone | Last human check | Verdict |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const s of doc.surfaces ?? []) {
    lines.push(`| ${cell(s.surface)} | ${cell(s.unattended_action?.value)} | ${detection(s)} | ${reach(s)} | ${cell(s.accountable)} | ${fallback(s)} | ${yesNo(s.stop_authority?.can_stop_alone)} | ${cell(s.last_human_check)} | ${cell(s.verdict)} |`);
  }
  lines.push("");
  lines.push(`**Reviewed ${t.reviewed}. Named ${t.named}. Killed ${t.killed}. Unnamed and still running ${t.unnamed_still_running}.**`);
  lines.push("");
  if (doc.triage?.length) {
    lines.push("## Look at these first");
    lines.push("");
    doc.triage.forEach((x, i) => lines.push(`${i + 1}. \`${x.id}\`: ${x.reason}`));
    lines.push("");
  }
  const m = doc.manifest ?? {};
  lines.push("## What was scanned");
  lines.push("");
  lines.push(`Roots: ${(m.scanned?.roots ?? []).map((r) => `\`${r}\``).join(", ") || "none"}. Classes: ${(m.scanned?.location_classes ?? []).join(", ") || "none"}. Files read: ${(m.scanned?.paths_read ?? []).length}.`);
  lines.push("");
  if (m.excluded?.length) {
    lines.push("Excluded, with the reason each:");
    lines.push("");
    for (const e of m.excluded) lines.push(`- \`${e.path}\`: ${e.reason}`);
    lines.push("");
  }
  if (m.proposed?.length) {
    lines.push("Proposed, not walked. Add a location to the config and run again to include it:");
    lines.push("");
    for (const p of m.proposed) lines.push(`- \`${p.location}\`: ${p.reason}${p.proposed_by ? ` (proposed by ${p.proposed_by})` : ""}`);
    lines.push("");
  }
  lines.push("## Evidence kept off the table");
  lines.push("");
  lines.push("Each row in the JSON also carries `existing_owner_signal`, `stop_authority.how`, `stop_authority.ever_tested`, `secret_names_referenced`, `provenance`, and a `basis` line under every judged field. They are for the second pass and for whoever reads the record later.");
  lines.push("");
  return lines.join("\n");
}

function parseArgs(argv) {
  const a = { file: null, out: null, title: "Name the Human" };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--out") a.out = argv[++i];
    else if (x.startsWith("--out=")) a.out = x.slice(6);
    else if (x === "--title") a.title = argv[++i];
    else if (x.startsWith("--title=")) a.title = x.slice(8);
    else if (x === "--help" || x === "-h") { console.log("usage: render.mjs inventory.json [--out inventory.md] [--title \"...\"]"); process.exit(0); }
    else if (x.startsWith("--")) { console.error(`unknown argument ${x}`); process.exit(1); }
    else a.file = x;
  }
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) { console.error("render.mjs: give me an inventory file"); process.exit(2); }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(args.file, "utf8")); } catch (e) { console.error(`render.mjs: cannot read ${args.file}: ${e.message}`); process.exit(2); }
  const md = render(doc, { title: args.title });
  if (args.out) { fs.writeFileSync(args.out, md); console.log(`wrote ${args.out}`); }
  else process.stdout.write(md);
}
