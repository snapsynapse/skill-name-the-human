#!/usr/bin/env node
// validate.mjs: the deterministic last pass of Name the Human.
//
// Checks an inventory file against schema v0.3 without trusting anything in
// it: totals are recomputed from the rows, human fields are checked for the
// stage you say you are at, and every judged field must carry the line it
// was judged from.
//
// Usage:
//   node validate.mjs inventory.json [--stage harvest|judged|named] [--diff previous.json] [--quiet]
//
// Stages:
//   harvest  every judgment field and every human field is null
//   judged   judgment fields filled with a basis; every human field still null; verdicts unresolved
//   named    human fields may be filled; totals must match the rows
//   (none)   structural checks plus totals; whatever stage the file is in
//
// Exit codes: 0 valid, 1 invalid, 2 unreadable input.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.join(here, "..", "references", "schema.json"), "utf8"));
const CLASSES = schema.$defs.location_class.enum;
const LAGS = schema.$defs.surface.properties.detection.properties.lag.enum.filter((v) => v !== null);
const RADII = schema.$defs.surface.properties.blast_radius.properties.value.enum.filter((v) => v !== null);
const VERDICTS = schema.$defs.surface.properties.verdict.enum;
const SURFACE_KEYS = Object.keys(schema.$defs.surface.properties);
const TOP_KEYS = Object.keys(schema.properties);
const HUMAN_FIELDS = ["accountable", "fallback", "stop_authority.can_stop_alone", "stop_authority.ever_tested", "last_human_check"];
const JUDGE_FIELDS = ["unattended_action", "detection", "blast_radius", "moves_personal_data"];
const ROLE_WORDS = /\b(team|on[- ]call|whoever|rotation|squad|department|dept|committee|owner|admin|ops|devops|platform|engineering|it)\b/i;

export function recomputeTotals(surfaces) {
  const reviewed = surfaces.length;
  const named = surfaces.filter((s) => typeof s.accountable === "string" && s.accountable.trim() !== "").length;
  const killed = surfaces.filter((s) => s.verdict === "kill").length;
  const unnamed_still_running = surfaces.filter((s) => !(typeof s.accountable === "string" && s.accountable.trim() !== "") && s.verdict !== "kill").length;
  return { reviewed, named, killed, unnamed_still_running };
}

export function gaps(surfaces) {
  const g = {};
  for (const f of HUMAN_FIELDS) g[f] = surfaces.filter((s) => get(s, f) === null || get(s, f) === undefined).length;
  g.verdict_unresolved = surfaces.filter((s) => s.verdict === "unresolved").length;
  return g;
}

export function derived(s) {
  const named = typeof s.accountable === "string" && s.accountable.trim() !== "";
  const fb = typeof s.fallback === "string" ? s.fallback.trim() : s.fallback;
  const bus_factor_one = named && (fb === null || fb === undefined || fb === "" || /^none$/i.test(fb) || fb.toLowerCase() === s.accountable.trim().toLowerCase());
  return { bus_factor_one, orphan: !named };
}

function get(obj, dotted) {
  return dotted.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function isDate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }

export function validate(doc, { stage = null } = {}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  if (!doc || typeof doc !== "object" || Array.isArray(doc)) { err("top level must be an object"); return { errors, warnings }; }
  for (const k of Object.keys(doc)) if (!TOP_KEYS.includes(k)) err(`unknown top-level key "${k}"`);
  for (const k of schema.required) if (!(k in doc)) err(`missing top-level key "${k}"`);
  if (doc.schema !== schema.properties.schema.const) err(`schema must be "${schema.properties.schema.const}", got ${JSON.stringify(doc.schema)}`);
  if (!isDate(doc.generated)) err(`generated must be YYYY-MM-DD, got ${JSON.stringify(doc.generated)}`);
  if (typeof doc.scope_rule !== "string" || !doc.scope_rule.trim()) err("scope_rule must be a non-empty string");

  // manifest
  const m = doc.manifest;
  if (!m || typeof m !== "object") err("manifest must be an object");
  else {
    const sc = m.scanned;
    if (!sc || typeof sc !== "object") err("manifest.scanned must be an object");
    else {
      if (!Array.isArray(sc.roots) || !sc.roots.length) err("manifest.scanned.roots must be a non-empty array: a human declares the scope");
      if (!Array.isArray(sc.location_classes)) err("manifest.scanned.location_classes must be an array");
      else for (const c of sc.location_classes) if (!CLASSES.includes(c)) err(`manifest.scanned.location_classes has unknown class "${c}"`);
      if (!Array.isArray(sc.paths_read)) err("manifest.scanned.paths_read must be an array");
    }
    for (const [key, req] of [["excluded", ["path", "reason"]], ["proposed", ["location", "reason"]]]) {
      if (!Array.isArray(m[key])) err(`manifest.${key} must be an array`);
      else m[key].forEach((e, i) => { for (const r of req) if (typeof e?.[r] !== "string" || !e[r].trim()) err(`manifest.${key}[${i}].${r} must be a non-empty string`); });
    }
  }

  // surfaces
  const surfaces = Array.isArray(doc.surfaces) ? doc.surfaces : [];
  if (!Array.isArray(doc.surfaces)) err("surfaces must be an array");
  const ids = new Map();
  surfaces.forEach((s, i) => {
    const at = `surfaces[${i}]${s?.id ? ` (${s.id})` : ""}`;
    if (!s || typeof s !== "object") { err(`${at} must be an object`); return; }
    for (const k of Object.keys(s)) {
      if (!SURFACE_KEYS.includes(k)) {
        if (k === "can_stop_alone" || k === "ever_tested" || k === "how") err(`${at}: "${k}" must be nested under stop_authority, not at the surface level`);
        else err(`${at}: unknown key "${k}"`);
      }
    }
    for (const k of schema.$defs.surface.required) if (!(k in s)) err(`${at}: missing "${k}"`);
    if (typeof s.id !== "string" || !s.id.trim()) err(`${at}: id must be a non-empty string`);
    else { ids.set(s.id, (ids.get(s.id) ?? 0) + 1); if (ids.get(s.id) > 1) err(`duplicate id "${s.id}"`); }
    if (!CLASSES.includes(s.class)) err(`${at}: class must be one of ${CLASSES.join(", ")}`);
    for (const k of ["surface", "location", "schedule"]) if (typeof s[k] !== "string" || !s[k].trim()) err(`${at}: ${k} must be a non-empty string`);
    const p = s.provenance;
    if (!p || typeof p !== "object") err(`${at}: provenance must be an object`);
    else {
      if (typeof p.file !== "string" || !p.file) err(`${at}: provenance.file must be a string`);
      if (!(p.line === null || (Number.isInteger(p.line) && p.line >= 1))) err(`${at}: provenance.line must be a positive integer or null`);
      if (typeof p.excerpt !== "string") err(`${at}: provenance.excerpt must be a string`);
    }
    if (!(s.existing_owner_signal === null || typeof s.existing_owner_signal === "string")) err(`${at}: existing_owner_signal must be a string or null`);
    if (!Array.isArray(s.secret_names_referenced) || s.secret_names_referenced.some((n) => typeof n !== "string")) err(`${at}: secret_names_referenced must be an array of strings`);
    else for (const n of s.secret_names_referenced) if (/[=:]\s*\S/.test(n) || n.length > 80) err(`${at}: secret_names_referenced entry looks like a value, not a name: "${n.slice(0, 20)}..."`);

    // judged fields: value plus basis
    const judged = (name, obj, check) => {
      if (!obj || typeof obj !== "object" || !("value" in obj) || !("basis" in obj)) { err(`${at}: ${name} must be {value, basis}`); return; }
      if (obj.value !== null && obj.value !== undefined) {
        check(obj.value);
        if (typeof obj.basis !== "string" || !obj.basis.trim()) err(`${at}: ${name}.value is set but ${name}.basis is empty; quote the line it was judged from`);
      } else if (obj.basis !== null && obj.basis !== undefined && obj.basis !== "") warn(`${at}: ${name}.basis is set while value is null`);
    };
    judged("unattended_action", s.unattended_action, (v) => { if (typeof v !== "string" || !v.trim()) err(`${at}: unattended_action.value must be a non-empty string`); });
    judged("blast_radius", s.blast_radius, (v) => { if (!RADII.includes(v)) err(`${at}: blast_radius.value must be one of ${RADII.join(", ")}`); });
    judged("moves_personal_data", s.moves_personal_data, (v) => { if (typeof v !== "boolean") err(`${at}: moves_personal_data.value must be boolean`); });
    const d = s.detection;
    if (!d || typeof d !== "object" || !("who_finds_out" in d) || !("lag" in d) || !("basis" in d)) err(`${at}: detection must be {who_finds_out, lag, basis}`);
    else {
      const set = d.who_finds_out !== null || d.lag !== null;
      if (d.who_finds_out !== null && (typeof d.who_finds_out !== "string" || !d.who_finds_out.trim())) err(`${at}: detection.who_finds_out must be a string or null`);
      if (d.lag !== null && !LAGS.includes(d.lag)) err(`${at}: detection.lag must be one of ${LAGS.join(", ")}`);
      if (set && (typeof d.basis !== "string" || !d.basis.trim())) err(`${at}: detection is set but detection.basis is empty`);
      if (d.who_finds_out !== null && d.lag === null) err(`${at}: detection.who_finds_out is set but lag is null`);
      if (d.lag !== null && d.who_finds_out === null) err(`${at}: detection.lag is set but who_finds_out is null`);
    }

    // stop_authority
    const sa = s.stop_authority;
    if (!sa || typeof sa !== "object") err(`${at}: stop_authority must be an object`);
    else {
      for (const k of Object.keys(sa)) if (!["can_stop_alone", "how", "ever_tested"].includes(k)) err(`${at}: stop_authority has unknown key "${k}"`);
      if (!(sa.can_stop_alone === null || typeof sa.can_stop_alone === "boolean")) err(`${at}: stop_authority.can_stop_alone must be boolean or null`);
      if (!(sa.ever_tested === null || typeof sa.ever_tested === "boolean")) err(`${at}: stop_authority.ever_tested must be boolean or null`);
      judged("stop_authority.how", sa.how, (v) => { if (typeof v !== "string" || !v.trim()) err(`${at}: stop_authority.how.value must be a non-empty string or null`); });
    }

    // human fields
    if (!(s.accountable === null || typeof s.accountable === "string")) err(`${at}: accountable must be a string or null`);
    if (typeof s.accountable === "string") {
      if (!s.accountable.trim()) err(`${at}: accountable is an empty string; use null`);
      else if (ROLE_WORDS.test(s.accountable) || s.accountable.trim().startsWith("@")) err(`${at}: accountable "${s.accountable}" reads as a team, role or handle. A role name is a blank; put a person's name or null`);
    }
    if (!(s.fallback === null || typeof s.fallback === "string")) err(`${at}: fallback must be a string or null`);
    if (!(s.last_human_check === null || typeof s.last_human_check === "string")) err(`${at}: last_human_check must be a string or null`);
    if (!VERDICTS.includes(s.verdict)) err(`${at}: verdict must be one of ${VERDICTS.join(", ")}`);
    if (s.verdict !== "unresolved" && s.accountable === null && s.verdict !== "kill") err(`${at}: verdict "${s.verdict}" on a surface with no accountable person; only kill or unresolved fit an unnamed row`);

    // stage rules
    if (stage === "harvest" || stage === "judged") {
      for (const f of HUMAN_FIELDS) if (get(s, f) !== null) err(`${at}: ${f} must be null at stage ${stage}; the machine never fills a human field`);
      if (s.verdict !== "unresolved") err(`${at}: verdict must be "unresolved" at stage ${stage}`);
    }
    if (stage === "harvest") {
      for (const f of JUDGE_FIELDS) {
        const v = f === "detection" ? (s.detection?.who_finds_out ?? null) : (s[f]?.value ?? null);
        if (v !== null) err(`${at}: ${f} must be null at stage harvest`);
      }
    }
    if (stage === "judged" || stage === "named") {
      for (const f of JUDGE_FIELDS) {
        const v = f === "detection" ? (s.detection?.who_finds_out ?? null) : (s[f]?.value ?? null);
        if (v === null) err(`${at}: ${f} is still null at stage ${stage}; the Judge must fill it or write not-determinable-from-source`);
      }
    }
  });

  // triage
  if (!Array.isArray(doc.triage)) err("triage must be an array");
  else {
    doc.triage.forEach((t, i) => {
      if (!t || typeof t.id !== "string" || typeof t.reason !== "string" || !t.reason.trim()) err(`triage[${i}] must be {id, reason}`);
      else if (!ids.has(t.id)) err(`triage[${i}] names unknown id "${t.id}"`);
    });
    if ((stage === "judged" || stage === "named") && surfaces.length && !doc.triage.length) warn("triage is empty; the Judge should order the surfaces by blast radius then detection lag");
  }

  // totals, recomputed rather than trusted
  const want = recomputeTotals(surfaces);
  if (!doc.totals || typeof doc.totals !== "object") err("totals must be an object");
  else {
    for (const k of Object.keys(doc.totals)) if (!(k in want)) err(`totals has unknown key "${k}"; the four totals are reviewed, named, killed, unnamed_still_running`);
    for (const k of Object.keys(want)) if (doc.totals[k] !== want[k]) err(`totals.${k} is ${JSON.stringify(doc.totals[k])} but the rows say ${want[k]}`);
  }
  if (doc.gaps) {
    const g = gaps(surfaces);
    for (const [k, v] of Object.entries(doc.gaps)) if (k in g && g[k] !== v) err(`gaps.${k} is ${v} but the rows say ${g[k]}`);
  }

  return { errors, warnings, totals: want, gaps: gaps(surfaces) };
}

export function diff(prev, next) {
  const a = new Map((prev.surfaces ?? []).map((s) => [s.id, s]));
  const b = new Map((next.surfaces ?? []).map((s) => [s.id, s]));
  const added = [...b.keys()].filter((id) => !a.has(id));
  const removed = [...a.keys()].filter((id) => !b.has(id));
  const changed = [];
  for (const [id, s] of b) {
    const p = a.get(id);
    if (!p) continue;
    const notes = [];
    if (p.accountable !== s.accountable) notes.push(`accountable ${JSON.stringify(p.accountable)} -> ${JSON.stringify(s.accountable)}`);
    if (p.fallback !== s.fallback) notes.push(`fallback ${JSON.stringify(p.fallback)} -> ${JSON.stringify(s.fallback)}`);
    if (p.verdict !== s.verdict) notes.push(`verdict ${p.verdict} -> ${s.verdict}`);
    if ((p.stop_authority?.how?.value ?? null) !== (s.stop_authority?.how?.value ?? null)) notes.push(`stop mechanism changed`);
    if (p.verdict === "keep" && s.stop_authority?.can_stop_alone === false && p.stop_authority?.can_stop_alone === true) notes.push("a keep lost its stop authority");
    if (p.schedule !== s.schedule) notes.push(`schedule ${p.schedule} -> ${s.schedule}`);
    if (notes.length) changed.push({ id, notes });
  }
  return { added, removed, changed };
}

function parseArgs(argv) {
  const a = { file: null, stage: null, diff: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--stage") a.stage = argv[++i];
    else if (x.startsWith("--stage=")) a.stage = x.slice(8);
    else if (x === "--diff") a.diff = argv[++i];
    else if (x.startsWith("--diff=")) a.diff = x.slice(7);
    else if (x === "--quiet") a.quiet = true;
    else if (x === "--help" || x === "-h") { console.log("usage: validate.mjs inventory.json [--stage harvest|judged|named] [--diff previous.json] [--quiet]"); process.exit(0); }
    else if (x.startsWith("--")) { console.error(`unknown argument ${x}`); process.exit(1); }
    else a.file = x;
  }
  if (a.stage && !["harvest", "judged", "named"].includes(a.stage)) { console.error(`--stage must be harvest, judged or named`); process.exit(1); }
  return a;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { console.error(`validate.mjs: cannot read ${file}: ${e.message}`); process.exit(2); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) { console.error("validate.mjs: give me an inventory file"); process.exit(2); }
  const doc = readJson(args.file);
  const { errors, warnings, totals, gaps: g } = validate(doc, { stage: args.stage });
  for (const w of warnings) console.error(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  if (args.diff) {
    const d = diff(readJson(args.diff), doc);
    console.log(`diff against ${args.diff}: ${d.added.length} added, ${d.removed.length} removed, ${d.changed.length} changed`);
    for (const id of d.added) console.log(`  + ${id}`);
    for (const id of d.removed) console.log(`  - ${id}`);
    for (const c of d.changed) console.log(`  ~ ${c.id}: ${c.notes.join("; ")}`);
  }
  if (!args.quiet && totals) console.log(`Reviewed ${totals.reviewed}. Named ${totals.named}. Killed ${totals.killed}. Unnamed and still running ${totals.unnamed_still_running}.${g ? ` Gaps: ${JSON.stringify(g)}` : ""}`);
  if (errors.length) { console.error(`${args.file}: ${errors.length} error(s)${args.stage ? ` at stage ${args.stage}` : ""}`); process.exit(1); }
  console.log(`${args.file}: valid${args.stage ? ` at stage ${args.stage}` : ""}${warnings.length ? ` with ${warnings.length} warning(s)` : ""}`);
}
