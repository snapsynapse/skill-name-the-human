#!/usr/bin/env node
// harvest.mjs: the deterministic first pass of Name the Human.
//
// Reads declared roots and well-known machine locations for four classes of
// unattended trigger, and writes one JSON file of candidate surfaces with
// provenance. It fills nothing a person or a model is supposed to fill.
//
// Read-only by construction:
//   - opens files only under the declared roots, the launchd agents folder,
//     and the harness settings files listed in README "Every path it touches"
//   - records env and secret NAMES it sees referenced, never a value
//   - makes no network calls
//   - writes exactly one file, the --out path (default name-the-human.harvest.json)
//
// Usage:
//   node harvest.mjs --config name-the-human.config.json [--out file.json] [--dry-run]
//
// Exit codes: 0 ok, 2 no roots declared or config unreadable, 1 other error.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

export const HARVEST_VERSION = "harvest.mjs 0.1.0";
export const SCHEMA = "name-the-human/v0.3";
export const SCOPE_RULE = "A surface counts if something acts on its output without a human deciding first.";
export const CLASSES = ["github-actions-schedule", "vercel-cron", "launchd-agent", "harness-hook"];

// .claude and .codex are skipped by the walk because their settings files are read directly by the hook
// harvester, and because .claude/worktrees holds whole checkouts that would double every workflow row.
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", "_site", ".venv", "venv", "vendor", ".next", ".cache", "coverage", ".playwright-mcp", "tmp", ".claude", ".codex", ".vercel"]);
const SECRETISH = /(^|_)(API_KEY|KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?|AUTH|PAT|URI|DSN)($|_)/i;

// ---------- small helpers ----------

export function expandHome(p, home = os.homedir()) {
  if (p === "~") return home;
  if (p.startsWith("~/")) return path.join(home, p.slice(2));
  return p;
}

export function contractHome(p, home = os.homedir()) {
  if (p === home) return "~";
  if (p.startsWith(home + path.sep)) return "~" + p.slice(home.length);
  return p;
}

function readText(file, ctx) {
  ctx.pathsRead.add(file);
  return fs.readFileSync(file, "utf8");
}

function slugCron(s) {
  return String(s).trim().replace(/\s+/g, "_");
}

function isUnder(file, dirs) {
  return dirs.some((d) => file === d || file.startsWith(d.endsWith(path.sep) ? d : d + path.sep));
}

function walk(root, opts, visit) {
  const maxDepth = opts.maxDepth ?? 6;
  const excluded = opts.excludePaths ?? [];
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        if (isUnder(full, excluded)) continue;
        if (depth < maxDepth) stack.push({ dir: full, depth: depth + 1 });
      } else if (e.isFile()) {
        visit(full, dir);
      }
    }
  }
}

// The repo a file belongs to: nearest ancestor containing .git, else the root.
function repoOf(file, roots) {
  let dir = path.dirname(file);
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    if (roots.includes(dir)) return dir;
    dir = path.dirname(dir);
  }
  return roots.find((r) => isUnder(file, [r])) ?? path.dirname(file);
}

function relToRoots(file, roots) {
  for (const r of roots) {
    if (isUnder(file, [r])) return path.posix.join(path.basename(r), path.relative(r, file).split(path.sep).join("/"));
  }
  return contractHome(file);
}

// ---------- CODEOWNERS ----------

function codeownersFor(repo, ctx) {
  for (const rel of [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"]) {
    const f = path.join(repo, rel);
    if (fs.existsSync(f)) return { file: f, text: readText(f, ctx) };
  }
  return null;
}

function codeownersPatternToRegex(pattern) {
  let p = pattern;
  const anchored = p.startsWith("/");
  if (anchored) p = p.slice(1);
  const dirOnly = p.endsWith("/");
  if (dirOnly) p = p.slice(0, -1);
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "*") {
      if (p[i + 1] === "*") { re += ".*"; i++; if (p[i + 1] === "/") i++; }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (".+^${}()|[]\\".includes(c)) re += "\\" + c;
    else re += c;
  }
  const hasSlash = p.includes("/");
  const head = anchored || hasSlash ? "^" : "(^|/)";
  const tail = dirOnly ? "(/|$)" : "(/.*)?$";
  return new RegExp(head + re + tail);
}

export function codeownersMatch(text, relPath) {
  let winner = null;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return;
    const [pattern, ...owners] = t.split(/\s+/);
    if (!owners.length) return;
    if (codeownersPatternToRegex(pattern).test(relPath)) winner = { line: i + 1, pattern, owners };
  });
  return winner;
}

function ownerSignal(repo, file, ctx) {
  const co = codeownersFor(repo, ctx);
  if (!co) return null;
  const rel = path.relative(repo, file).split(path.sep).join("/");
  const m = codeownersMatch(co.text, rel);
  if (!m) return `CODEOWNERS present at ${contractHome(co.file)} but no pattern matches ${rel}`;
  return `CODEOWNERS ${contractHome(co.file)}:${m.line} "${m.pattern} ${m.owners.join(" ")}"`;
}

// ---------- class 1: GitHub Actions schedules ----------

// Line-based extraction of on.schedule[].cron. Deterministic, dependency-free,
// and it records the line number so the row carries its own evidence.
export function extractWorkflowSchedules(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let name = null;
  let inOn = false, onIndent = -1;
  let inSchedule = false, schedIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)[0].length;
    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch && indent === 0 && name === null) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
    if (indent === 0) {
      inOn = /^(on|"on"|'on'|true):\s*$/.test(line.trim()) || /^(on|"on"|'on'|true):\s*\{?/.test(line.trim());
      onIndent = 0;
      inSchedule = false;
      // inline form on: [push, ...] carries no schedule
      if (inOn && /^(on|"on"|'on'|true):\s*\[/.test(line.trim())) inOn = false;
      continue;
    }
    if (!inOn) continue;
    if (indent > onIndent && /^\s*schedule:\s*$/.test(line)) { inSchedule = true; schedIndent = indent; continue; }
    if (inSchedule) {
      if (indent <= schedIndent) { inSchedule = false; }
      else {
        const m = line.match(/^\s*-\s*cron:\s*(.+)$/);
        if (m) out.push({ cron: m[1].trim().replace(/^["']|["']$/g, ""), line: i + 1, excerpt: raw.trim() });
      }
    }
  }
  return { name, schedules: out };
}

function secretNamesInText(text) {
  const names = new Set();
  for (const m of text.matchAll(/secrets\.([A-Za-z_][A-Za-z0-9_]*)/g)) names.add(m[1]);
  for (const m of text.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:/gm)) if (SECRETISH.test(m[1])) names.add(m[1]);
  for (const m of text.matchAll(/\$\{?([A-Z][A-Z0-9_]*)\}?/g)) if (SECRETISH.test(m[1])) names.add(m[1]);
  return [...names].sort();
}

function harvestGitHubActions(roots, ctx) {
  const rows = [];
  for (const root of roots) {
    walk(root, ctx.walkOpts, (file) => {
      if (!/[\\/]\.github[\\/]workflows[\\/][^\\/]+\.ya?ml$/.test(file)) return;
      ctx.counts.workflows_read++;
      const text = readText(file, ctx);
      const { name, schedules } = extractWorkflowSchedules(text);
      if (!schedules.length) return;
      const repo = repoOf(file, roots);
      const rel = relToRoots(file, roots);
      const secrets = secretNamesInText(text);
      const owner = ownerSignal(repo, file, ctx);
      schedules.forEach((s) => {
        rows.push(makeSurface({
          id: `gha:${rel}@${slugCron(s.cron)}`,
          cls: "github-actions-schedule",
          surface: `GitHub Actions workflow "${name ?? path.basename(file)}" on schedule "${s.cron}"`,
          location: contractHome(file),
          schedule: s.cron,
          provenance: { file: contractHome(file), line: s.line, excerpt: s.excerpt, program: null },
          owner,
          secrets,
          how: { value: "disable the workflow in the repository's Actions settings, or delete the schedule entry", basis: `${path.basename(file)}:${s.line} ${s.excerpt}` },
        }));
      });
    });
  }
  return rows;
}

// ---------- class 2: Vercel crons ----------

function harvestVercel(roots, ctx) {
  const rows = [];
  for (const root of roots) {
    walk(root, ctx.walkOpts, (file) => {
      if (path.basename(file) !== "vercel.json") return;
      ctx.counts.vercel_json_read++;
      const text = readText(file, ctx);
      let json;
      try { json = JSON.parse(text); } catch (e) {
        ctx.excluded.push({ path: contractHome(file), reason: `vercel.json did not parse: ${e.message}` });
        return;
      }
      if (!Array.isArray(json.crons) || !json.crons.length) return;
      const repo = repoOf(file, roots);
      const rel = relToRoots(file, roots);
      const lines = text.split(/\r?\n/);
      json.crons.forEach((c) => {
        const idx = lines.findIndex((l) => l.includes(`"${c.path}"`));
        const handler = findHandler(path.dirname(file), c.path);
        let secrets = [];
        let owner = null;
        if (handler) {
          const ht = readText(handler, ctx);
          secrets = secretNamesInText(ht).concat(processEnvNames(ht)).filter((v, i, a) => a.indexOf(v) === i).sort();
          owner = ownerSignal(repo, handler, ctx);
        } else {
          owner = ownerSignal(repo, file, ctx);
        }
        rows.push(makeSurface({
          id: `vercel:${rel}@${c.path}@${slugCron(c.schedule)}`,
          cls: "vercel-cron",
          surface: `Vercel cron "${c.path}" on schedule "${c.schedule}"`,
          location: contractHome(file),
          schedule: String(c.schedule),
          provenance: { file: contractHome(file), line: idx >= 0 ? idx + 1 : null, excerpt: idx >= 0 ? lines[idx].trim() : JSON.stringify(c), program: handler ? contractHome(handler) : null },
          owner,
          secrets,
          how: { value: "remove the crons entry from vercel.json and redeploy, or disable the cron in the Vercel project settings", basis: `vercel.json crons entry "${c.path}"` },
        }));
      });
    });
  }
  return rows;
}

function processEnvNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) if (SECRETISH.test(m[1])) names.add(m[1]);
  return [...names];
}

function findHandler(dir, routePath) {
  const base = routePath.replace(/^\//, "");
  const candidates = [".js", ".mjs", ".ts", ".cjs", "/index.js", "/index.ts", "/route.js", "/route.ts"].map((ext) => path.join(dir, base + ext));
  candidates.push(path.join(dir, "app", base, "route.ts"), path.join(dir, "app", base, "route.js"), path.join(dir, "src", base + ".ts"), path.join(dir, "src", base + ".js"), path.join(dir, "src", "app", base, "route.ts"));
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

// ---------- class 3: launchd agents ----------

// Minimal XML plist reader: dict, array, string, integer, real, true, false.
// Enough for launchd agents, and it keeps the harvest portable and testable
// off macOS. Binary plists fall through to plutil, which exists only on macOS.
export function parsePlistXml(text) {
  const tokens = [...text.matchAll(/<(\/?)(dict|array|key|string|integer|real|true|false|date|data)\s*(\/?)>|([^<]+)/g)];
  let i = 0;
  const textOf = () => { let s = ""; while (i < tokens.length && tokens[i][4] !== undefined) s += tokens[i++][4]; return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim(); };
  const skipText = () => { while (i < tokens.length && tokens[i][4] !== undefined) i++; };
  function value() {
    skipText();
    const t = tokens[i++];
    if (!t) return undefined;
    const [, close, tag, selfClose] = t;
    if (close) return undefined;
    if (tag === "true") { if (!selfClose) i++; return true; }
    if (tag === "false") { if (!selfClose) i++; return false; }
    if (tag === "dict") {
      const d = {};
      for (;;) {
        skipText();
        const n = tokens[i];
        if (!n || (n[1] && n[2] === "dict")) { i++; return d; }
        if (n[2] === "key") { i++; const k = textOf(); i++; d[k] = value(); } else i++;
      }
    }
    if (tag === "array") {
      const a = [];
      for (;;) {
        skipText();
        const n = tokens[i];
        if (!n || (n[1] && n[2] === "array")) { i++; return a; }
        a.push(value());
      }
    }
    if (selfClose) return "";
    const s = textOf();
    i++; // closing tag
    if (tag === "integer") return parseInt(s, 10);
    if (tag === "real") return parseFloat(s);
    return s;
  }
  const start = text.indexOf("<plist");
  if (start < 0) return null;
  while (i < tokens.length && !(tokens[i][2] === "dict" && !tokens[i][1])) i++;
  return value() ?? null;
}

function readPlist(file, ctx) {
  ctx.pathsRead.add(file);
  const text = fs.readFileSync(file, "utf8");
  if (/^\s*<\?xml/.test(text) || text.includes("<plist")) {
    try { const data = parsePlistXml(text); if (data) return { data, text }; } catch { /* fall through to plutil */ }
  }
  // Binary plists: plutil handles them on macOS. Elsewhere they are excluded with a reason.
  try {
    const json = execFileSync("plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return { data: JSON.parse(json), text };
  } catch {
    return { data: null, text };
  }
}

function describeCalendar(cal) {
  const one = (c) => Object.entries(c).map(([k, v]) => `${k}=${v}`).join(",");
  return Array.isArray(cal) ? cal.map(one).join(";") : one(cal);
}

function harvestLaunchd(roots, includePaths, ctx, agentsDir) {
  const rows = [];
  if (!fs.existsSync(agentsDir)) {
    ctx.excluded.push({ path: contractHome(agentsDir), reason: "launch agents folder not present on this machine" });
    return rows;
  }
  const allowed = [...roots, ...includePaths];
  for (const name of fs.readdirSync(agentsDir).sort()) {
    const file = path.join(agentsDir, name);
    if (!name.endsWith(".plist")) {
      if (name.includes(".plist")) ctx.excluded.push({ path: contractHome(file), reason: "not an active plist (renamed or disabled)" });
      continue;
    }
    ctx.counts.plists_read++;
    const { data, text } = readPlist(file, ctx);
    if (!data) { ctx.excluded.push({ path: contractHome(file), reason: "plist could not be converted to JSON (plutil unavailable or malformed)" }); continue; }
    const args = data.ProgramArguments ?? (data.Program ? [data.Program] : []);
    const program = args.find((a) => typeof a === "string" && a.startsWith("/") && !/^\/(bin|usr\/bin|usr\/local\/bin|opt\/homebrew\/bin)\//.test(a)) ?? args[0] ?? null;
    const programAbs = program ? expandHome(program) : null;
    const inScope = programAbs && isUnder(programAbs, allowed);
    if (!inScope) {
      ctx.excluded.push({ path: contractHome(file), reason: program ? `program ${contractHome(program)} is outside declared roots and include_paths` : "no program path" });
      continue;
    }
    let schedule, trigger;
    if (data.StartInterval) { schedule = `interval:${data.StartInterval}s`; trigger = `StartInterval ${data.StartInterval}`; }
    else if (data.StartCalendarInterval) { schedule = `calendar:${describeCalendar(data.StartCalendarInterval)}`; trigger = `StartCalendarInterval ${describeCalendar(data.StartCalendarInterval)}`; }
    else if (data.WatchPaths) { schedule = `watch:${data.WatchPaths.join(",")}`; trigger = "WatchPaths"; }
    else if (data.RunAtLoad || data.KeepAlive) { schedule = "at-load"; trigger = data.KeepAlive ? "KeepAlive" : "RunAtLoad"; }
    else { schedule = "unknown"; trigger = "no StartInterval, StartCalendarInterval, WatchPaths, RunAtLoad or KeepAlive"; }
    const envNames = data.EnvironmentVariables ? Object.keys(data.EnvironmentVariables).filter((k) => SECRETISH.test(k)).sort() : [];
    const lineOf = (key) => { const i = text.split(/\r?\n/).findIndex((l) => l.includes(`<key>${key}</key>`)); return i >= 0 ? i + 1 : null; };
    rows.push(makeSurface({
      id: `launchd:${data.Label ?? name.replace(/\.plist$/, "")}@${slugCron(schedule)}`,
      cls: "launchd-agent",
      surface: `launchd agent "${data.Label ?? name}" running ${contractHome(program)} (${trigger})`,
      location: contractHome(file),
      schedule,
      provenance: { file: contractHome(file), line: lineOf("ProgramArguments") ?? lineOf("Program"), excerpt: `ProgramArguments: ${args.map(contractHome).join(" ")}`, program: contractHome(programAbs) },
      owner: null,
      secrets: envNames,
      how: { value: `launchctl unload ${contractHome(file)}, or delete the plist`, basis: `plist Label ${data.Label ?? name}` },
    }));
  }
  return rows;
}

// ---------- class 4: harness hooks ----------

function hookFiles(roots, home, excludePaths = []) {
  const files = [
    { file: path.join(home, ".claude", "settings.json"), harness: "claude" },
    { file: path.join(home, ".claude", "settings.local.json"), harness: "claude" },
    { file: path.join(home, ".codex", "hooks.json"), harness: "codex" },
  ];
  for (const root of roots) {
    // Project-level hooks live at the repo root; look one level down too, since a root may be a folder of repos.
    const dirs = [root];
    try { for (const e of fs.readdirSync(root, { withFileTypes: true })) if (e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith(".") && !isUnder(path.join(root, e.name), excludePaths)) dirs.push(path.join(root, e.name)); } catch { /* unreadable root */ }
    for (const d of dirs) {
      files.push({ file: path.join(d, ".claude", "settings.json"), harness: "claude" });
      files.push({ file: path.join(d, ".claude", "settings.local.json"), harness: "claude" });
      files.push({ file: path.join(d, ".codex", "hooks.json"), harness: "codex" });
    }
  }
  return files;
}

function harvestHooks(roots, ctx, home) {
  const rows = [];
  for (const { file, harness } of hookFiles(roots, home, ctx.walkOpts.excludePaths)) {
    if (!fs.existsSync(file)) continue;
    ctx.counts.hook_files_read++;
    const text = readText(file, ctx);
    let json;
    try { json = JSON.parse(text); } catch (e) { ctx.excluded.push({ path: contractHome(file), reason: `did not parse as JSON: ${e.message}` }); continue; }
    const hooks = json.hooks;
    if (!hooks || typeof hooks !== "object") continue;
    const lines = text.split(/\r?\n/);
    for (const [event, groups] of Object.entries(hooks)) {
      if (!Array.isArray(groups)) continue;
      groups.forEach((group, gi) => {
        const matcher = group.matcher || "*";
        (group.hooks ?? []).forEach((h, hi) => {
          const command = h.command ?? h.prompt ?? JSON.stringify(h);
          const idx = lines.findIndex((l) => l.includes(String(h.command ?? "").slice(0, 60)) && h.command);
          const cmdPath = String(h.command ?? "").split(/\s+/).find((t) => t.startsWith("/") || t.startsWith("~")) ?? null;
          rows.push(makeSurface({
            id: `hook:${harness}:${contractHome(file)}:${event}:${matcher}:${gi}.${hi}`,
            cls: "harness-hook",
            surface: `${harness} ${event} hook (matcher "${matcher}") running ${command.length > 80 ? command.slice(0, 77) + "..." : command}`,
            location: contractHome(file),
            schedule: `event:${event}${matcher !== "*" ? `:${matcher}` : ""}`,
            provenance: { file: contractHome(file), line: idx >= 0 ? idx + 1 : null, excerpt: idx >= 0 ? lines[idx].trim() : `${event} -> ${command.slice(0, 120)}`, program: cmdPath ? contractHome(expandHome(cmdPath)) : null },
            owner: null,
            secrets: secretNamesInText(command),
            how: { value: `remove the ${event} entry from ${contractHome(file)}`, basis: `hooks.${event}[${gi}].hooks[${hi}]` },
          }));
        });
      });
    }
  }
  return rows;
}

// ---------- proposals the harvest can make on its own ----------

function harvestProposals(roots, ctx, agentsDir) {
  const proposed = [];
  const seen = new Set();
  const add = (location, reason) => { if (!seen.has(location)) { seen.add(location); proposed.push({ location, reason, proposed_by: "harvest" }); } };
  for (const root of roots) {
    walk(root, ctx.walkOpts, (file) => {
      const base = path.basename(file);
      if (/^wrangler\.(toml|jsonc?)$/.test(base)) {
        const t = readText(file, ctx);
        if (/crons/.test(t)) add(contractHome(file), "wrangler config declares cron triggers; Cloudflare Workers cron is not a v0.1 class");
      } else if (base.endsWith(".timer")) {
        add(contractHome(file), "systemd timer unit; not a v0.1 class");
      } else if (base.endsWith(".plist") && !file.startsWith(agentsDir)) {
        // Only plists shaped like launchd jobs. Info.plist and entitlements files are not triggers.
        const t = readText(file, ctx);
        if (/<key>ProgramArguments<\/key>|<key>Program<\/key>/.test(t) && /<key>Label<\/key>/.test(t)) add(contractHome(file), "a launchd-shaped plist inside a root that is not installed under the launch agents folder; an installer may load it elsewhere, or on another machine");
      } else if (/^(install|setup|bootstrap)[^/]*\.(sh|bash|zsh)$/.test(base)) {
        const t = readText(file, ctx);
        if (/LaunchAgents|launchctl|crontab|systemctl/.test(t)) add(contractHome(file), "installer script references launchctl, crontab or systemctl; it may create a trigger the harvest did not see");
      } else if (base === ".mcp.json" || base === "mcp.json") {
        add(contractHome(file), "MCP server registration; not a v0.1 class");
      }
    });
  }
  return proposed;
}

// ---------- assembly ----------

function makeSurface({ id, cls, surface, location, schedule, provenance, owner, secrets, how }) {
  return {
    id,
    class: cls,
    surface,
    location,
    schedule,
    provenance,
    existing_owner_signal: owner ?? null,
    secret_names_referenced: secrets ?? [],
    unattended_action: { value: null, basis: null },
    detection: { who_finds_out: null, lag: null, basis: null },
    blast_radius: { value: null, basis: null },
    moves_personal_data: { value: null, basis: null },
    accountable: null,
    fallback: null,
    stop_authority: { can_stop_alone: null, how: how ?? { value: "unknown", basis: null }, ever_tested: null },
    last_human_check: null,
    verdict: "unresolved",
  };
}

export function loadConfig(configPath) {
  let text;
  try { text = fs.readFileSync(configPath, "utf8"); } catch (e) { throw Object.assign(new Error(`cannot read config ${configPath}: ${e.message}`), { code: 2 }); }
  let cfg;
  try { cfg = JSON.parse(text); } catch (e) { throw Object.assign(new Error(`config is not valid JSON: ${e.message}`), { code: 2 }); }
  if (!Array.isArray(cfg.roots) || cfg.roots.length === 0) {
    throw Object.assign(new Error("refusing to run: config declares no roots. A human names the directories to walk; there is no default."), { code: 2 });
  }
  const classes = cfg.location_classes ?? CLASSES;
  for (const c of classes) if (!CLASSES.includes(c)) throw Object.assign(new Error(`unknown location class "${c}". v0.1 knows: ${CLASSES.join(", ")}`), { code: 2 });
  // Relative paths resolve against the config file, so a config travels with the folder it describes.
  const base = path.dirname(path.resolve(configPath));
  const abs = (p) => path.resolve(base, expandHome(p));
  return {
    roots: cfg.roots.map(abs),
    location_classes: classes,
    include_paths: (cfg.include_paths ?? []).map(abs),
    exclude_paths: (cfg.exclude_paths ?? []).map(abs),
    max_depth: cfg.max_depth ?? 6,
    home: cfg.home ? abs(cfg.home) : os.homedir(),
    launch_agents_dir: cfg.launch_agents_dir ? abs(cfg.launch_agents_dir) : path.join(os.homedir(), "Library", "LaunchAgents"),
  };
}

export function harvest(cfg, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const ctx = {
    pathsRead: new Set(),
    excluded: [],
    counts: { workflows_read: 0, vercel_json_read: 0, plists_read: 0, hook_files_read: 0 },
    walkOpts: { maxDepth: cfg.max_depth, excludePaths: cfg.exclude_paths ?? [] },
  };
  for (const r of cfg.roots) if (!fs.existsSync(r)) ctx.excluded.push({ path: contractHome(r), reason: "declared root does not exist on this machine" });
  for (const x of cfg.exclude_paths ?? []) ctx.excluded.push({ path: contractHome(x), reason: "excluded by config exclude_paths; nothing under it was walked" });
  const roots = cfg.roots.filter((r) => fs.existsSync(r));
  let surfaces = [];
  if (cfg.location_classes.includes("github-actions-schedule")) surfaces.push(...harvestGitHubActions(roots, ctx));
  if (cfg.location_classes.includes("vercel-cron")) surfaces.push(...harvestVercel(roots, ctx));
  if (cfg.location_classes.includes("launchd-agent")) surfaces.push(...harvestLaunchd(roots, cfg.include_paths, ctx, cfg.launch_agents_dir));
  if (cfg.location_classes.includes("harness-hook")) surfaces.push(...harvestHooks(roots, ctx, cfg.home));
  const proposed = harvestProposals(roots, ctx, cfg.launch_agents_dir);

  // Stable order, stable ids. A duplicate id means two triggers collapsed; keep both visible with a suffix.
  surfaces.sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Map();
  for (const s of surfaces) {
    const n = (seen.get(s.id) ?? 0) + 1;
    seen.set(s.id, n);
    if (n > 1) s.id = `${s.id}#${n}`;
  }

  return {
    schema: SCHEMA,
    generated: today,
    generator: { harvest: HARVEST_VERSION, judge: null },
    scope_rule: SCOPE_RULE,
    manifest: {
      scanned: {
        roots: cfg.roots.map(contractHome),
        location_classes: cfg.location_classes,
        paths_read: [...ctx.pathsRead].map(contractHome).sort(),
        counts: { ...ctx.counts, candidates: surfaces.length },
      },
      excluded: ctx.excluded,
      proposed,
    },
    surfaces,
    triage: [],
    totals: { reviewed: surfaces.length, named: 0, killed: 0, unnamed_still_running: surfaces.length },
  };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { config: null, out: "name-the-human.harvest.json", dryRun: false, today: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--config") args.config = argv[++i];
    else if (a.startsWith("--config=")) args.config = a.slice(9);
    else if (a === "--out") args.out = argv[++i];
    else if (a.startsWith("--out=")) args.out = a.slice(6);
    else if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--today=")) args.today = a.slice(8);
    else if (a === "--help" || a === "-h") { console.log("usage: harvest.mjs --config name-the-human.config.json [--out file.json] [--dry-run]"); process.exit(0); }
    else { console.error(`unknown argument ${a}`); process.exit(1); }
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.config) { console.error("harvest.mjs: --config is required. There is no default scope."); process.exit(2); }
  let cfg;
  try { cfg = loadConfig(args.config); } catch (e) { console.error(`harvest.mjs: ${e.message}`); process.exit(e.code ?? 1); }
  const result = harvest(cfg, args.today ? { today: args.today } : {});
  const { counts } = result.manifest.scanned;
  const summary = `${result.surfaces.length} candidate surface(s) from ${result.manifest.scanned.roots.length} root(s); read ${result.manifest.scanned.paths_read.length} file(s); ${result.manifest.excluded.length} excluded; ${result.manifest.proposed.length} proposed. Counts: ${JSON.stringify(counts)}`;
  if (args.dryRun) {
    console.log(summary);
    for (const s of result.surfaces) console.log(`  ${s.id}`);
    process.exit(0);
  }
  fs.writeFileSync(args.out, JSON.stringify(result, null, 2) + "\n");
  console.log(`${summary}\nwrote ${args.out}`);
}
