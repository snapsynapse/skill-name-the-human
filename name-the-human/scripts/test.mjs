#!/usr/bin/env node
// test.mjs: deterministic checks over the fixture estate and the committed example.
//
// 1. Copies assets/fixture to a temporary folder, substitutes the absolute
//    estate path into the plists, harvests twice, and checks the ids are the
//    expected set both times.
// 2. Validates the harvest output at stage harvest.
// 3. Validates the committed example at stage judged and renders it.
// 4. Checks that the harvest refuses to run with no roots.
//
// Exit 0 when everything holds, 1 otherwise. No network, no writes outside
// the temporary folder.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(here, "..");
const { harvest, loadConfig, extractWorkflowSchedules, codeownersMatch, parsePlistXml } = await import(path.join(here, "harvest.mjs"));
const { validate, diff } = await import(path.join(here, "validate.mjs"));
const { render } = await import(path.join(here, "render.mjs"));

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log(`ok   ${msg}`); else { failures++; console.log(`FAIL ${msg}`); } };
const eq = (a, b, msg) => { const same = JSON.stringify(a) === JSON.stringify(b); ok(same, msg + (same ? "" : `\n     expected ${JSON.stringify(b)}\n     got      ${JSON.stringify(a)}`)); };

// ---------- unit checks on the extractors ----------

const wf = extractWorkflowSchedules(fs.readFileSync(path.join(bundle, "assets/fixture/estate/example-site/.github/workflows/nightly-evals.yml"), "utf8"));
eq(wf.name, "nightly-evals", "workflow name extracted");
eq(wf.schedules.map((s) => s.cron), ["0 5 * * *", "30 5 * * 0"], "two cron entries from one workflow");
eq(wf.schedules.map((s) => s.line), [8, 9], "cron line numbers recorded");
const ci = extractWorkflowSchedules(fs.readFileSync(path.join(bundle, "assets/fixture/estate/example-site/.github/workflows/ci.yml"), "utf8"));
eq(ci.schedules.length, 0, "inline on: [push] carries no schedule");

const co = fs.readFileSync(path.join(bundle, "assets/fixture/estate/example-site/.github/CODEOWNERS"), "utf8");
eq(codeownersMatch(co, ".github/workflows/nightly-evals.yml")?.owners, ["@example-co/platform", "@example-co/evals"], "CODEOWNERS last matching pattern wins");
eq(codeownersMatch(co, "api/cron/drain-outbox.js")?.owners, ["@example-co/growth"], "CODEOWNERS directory pattern matches handler");
eq(codeownersMatch(co, "README.md")?.owners, ["@example-co/platform"], "CODEOWNERS catch-all matches");

const pl = parsePlistXml(fs.readFileSync(path.join(bundle, "assets/fixture/estate/launchagents/com.example.nightly-report.plist"), "utf8"));
eq(pl.Label, "com.example.nightly-report", "plist Label parsed");
eq(pl.StartCalendarInterval, { Hour: 3, Minute: 0 }, "plist StartCalendarInterval parsed");
eq(Object.keys(pl.EnvironmentVariables), ["REPORT_API_KEY"], "plist EnvironmentVariables keys parsed");

// ---------- fixture harvest, twice ----------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "name-the-human-test-"));
fs.cpSync(path.join(bundle, "assets/fixture"), tmp, { recursive: true });
const estate = path.join(tmp, "estate");
for (const f of fs.readdirSync(path.join(estate, "launchagents"))) {
  const p = path.join(estate, "launchagents", f);
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replaceAll("__ESTATE__", estate));
}
const cfg = loadConfig(path.join(tmp, "name-the-human.config.json"));
const run1 = harvest(cfg, { today: "2026-01-01" });
const run2 = harvest(cfg, { today: "2026-01-01" });

const expectedIds = [
  "gha:example-site/.github/workflows/nightly-evals.yml@0_5_*_*_*",
  "gha:example-site/.github/workflows/nightly-evals.yml@30_5_*_*_0",
  `hook:claude:${estate}/home/.claude/settings.json:PostToolUse:Bash:0.0`,
  `hook:claude:${estate}/home/.claude/settings.json:SessionEnd:*:0.0`,
  `hook:codex:${estate}/example-site/.codex/hooks.json:PostToolUse:Edit|Write:0.0`,
  "launchd:com.example.nightly-report@calendar:Hour=3,Minute=0",
  "launchd:com.example.vault-sync@interval:3600s",
  "vercel:example-site/vercel.json@/api/cron/drain-outbox@0_7_*_*_*",
].sort();
eq(run1.surfaces.map((s) => s.id), expectedIds, "fixture harvest finds exactly the expected surfaces");
eq(run2.surfaces.map((s) => s.id), run1.surfaces.map((s) => s.id), "second run returns the same ids");
eq(diff(run1, run2), { added: [], removed: [], changed: [] }, "two runs diff to nothing");

const byId = Object.fromEntries(run1.surfaces.map((s) => [s.id, s]));
const gha = byId[expectedIds[0]];
eq(gha.secret_names_referenced, ["EVAL_API_KEY"], "workflow secret recorded by name only");
ok(gha.existing_owner_signal?.includes("@example-co/platform @example-co/evals"), "workflow row carries its CODEOWNERS line as evidence");
eq(gha.provenance.line, 8, "workflow row provenance line");
const vercel = byId[expectedIds[7]];
eq(vercel.secret_names_referenced, ["RESEND_API_KEY"], "vercel handler env recorded by name only");
ok(vercel.provenance.program?.endsWith("api/cron/drain-outbox.js"), "vercel row names its handler");
ok(vercel.existing_owner_signal?.includes("@example-co/growth"), "vercel row CODEOWNERS from handler path");
const report = byId[expectedIds[5]];
eq(report.secret_names_referenced, ["REPORT_API_KEY"], "plist env var recorded by name only");
ok(!JSON.stringify(run1).includes("not-a-real-value"), "no env value leaks into the output");
for (const s of run1.surfaces) {
  ok(s.accountable === null && s.fallback === null && s.stop_authority.can_stop_alone === null && s.stop_authority.ever_tested === null && s.last_human_check === null && s.verdict === "unresolved", `human fields null after harvest: ${s.id}`);
}

const exclReasons = run1.manifest.excluded.map((e) => `${path.basename(e.path)}: ${e.reason.split(" ")[0]}`).sort();
ok(run1.manifest.excluded.some((e) => e.path.endsWith("com.vendor.updater.plist") && /outside declared roots/.test(e.reason)), "plist outside roots excluded with a reason");
ok(run1.manifest.excluded.some((e) => e.path.endsWith(".plist.disabled")), "disabled plist listed as excluded, not skipped silently");
ok(run1.manifest.proposed.some((p) => p.location.endsWith("wrangler.toml")), "wrangler crons proposed, not walked");
ok(run1.manifest.proposed.some((p) => p.location.endsWith("scripts/install.sh")), "installer referencing launchctl proposed");
eq(run1.manifest.scanned.counts.workflows_read, 2, "both workflow files read, one is not a row");
ok(run1.manifest.scanned.paths_read.every((p) => p.startsWith(tmp) || p.startsWith("~")), "every path read is under the fixture");
if (exclReasons.length === 0) ok(false, "expected some exclusions");

const v1 = validate(run1, { stage: "harvest" });
eq(v1.errors, [], "harvest output validates at stage harvest");
eq(v1.totals, { reviewed: 8, named: 0, killed: 0, unnamed_still_running: 8 }, "totals after harvest");

// ---------- the committed example ----------

const example = JSON.parse(fs.readFileSync(path.join(bundle, "assets/example/inventory.judged.json"), "utf8"));
const v2 = validate(example, { stage: "judged" });
eq(v2.errors, [], "committed judged example validates at stage judged");
ok(example.surfaces.every((s) => s.blast_radius.basis && s.detection.basis && s.moves_personal_data.basis && s.unattended_action.basis), "every judged field in the example carries a basis");
const rendered = render(example, { title: "Name the Human: example after the Judge pass" });
const committedMd = fs.readFileSync(path.join(bundle, "assets/example/inventory.judged.md"), "utf8");
eq(rendered, committedMd, "committed rendered example matches render.mjs output");

const named = JSON.parse(fs.readFileSync(path.join(bundle, "assets/example/inventory.named.json"), "utf8"));
const v3 = validate(named, { stage: "named" });
eq(v3.errors, [], "committed named example validates at stage named");
const namedMd = render(named, { title: "Name the Human: example after the human pass" });
eq(namedMd, fs.readFileSync(path.join(bundle, "assets/example/inventory.named.md"), "utf8"), "committed named render matches render.mjs output");
const v3judged = validate(named, { stage: "judged" });
ok(v3judged.errors.length > 0, "a named file fails stage judged (human fields are filled)");

// ---------- negative checks on the validator ----------

const bad = structuredClone(example);
bad.totals.named = 99;
ok(validate(bad).errors.some((e) => /totals\.named/.test(e)), "validator refuses totals that disagree with the rows");
const hoisted = structuredClone(example);
hoisted.surfaces[0].can_stop_alone = true;
ok(validate(hoisted).errors.some((e) => /nested under stop_authority/.test(e)), "validator catches can_stop_alone hoisted to the surface level");
const role = structuredClone(example);
role.surfaces[0].accountable = "platform team";
ok(validate(role).errors.some((e) => /team, role or handle/.test(e)), "validator refuses a team as accountable");
const nobasis = structuredClone(example);
nobasis.surfaces[0].blast_radius.basis = "";
ok(validate(nobasis).errors.some((e) => /blast_radius\.basis is empty/.test(e)), "validator refuses a judgment without a basis");

// ---------- refusal with no roots ----------

const noRoots = path.join(tmp, "no-roots.json");
fs.writeFileSync(noRoots, JSON.stringify({ roots: [] }));
const r = spawnSync(process.execPath, [path.join(here, "harvest.mjs"), "--config", noRoots, "--dry-run"], { encoding: "utf8" });
eq(r.status, 2, "harvest exits 2 with no declared roots");
ok(/refusing to run/.test(r.stderr), "harvest says why it refused");
const r2 = spawnSync(process.execPath, [path.join(here, "harvest.mjs"), "--dry-run"], { encoding: "utf8" });
eq(r2.status, 2, "harvest exits 2 with no config at all");

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
