# Name the Human

[![Validate](https://github.com/snapsynapse/skill-name-the-human/actions/workflows/validate.yml/badge.svg)](https://github.com/snapsynapse/skill-name-the-human/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A deployer-side accountability inventory for automated and AI systems. One row per thing that acts on its output without a person deciding first, and one question per row: if this is wrong, whose name is on it?

**Version 0.1.** Schema `name-the-human/v0.3`. Built for one estate first and revised in public after. Expect rough edges on machines that are not the author's; report them.

## What it is not

Say this to your legal team in one sentence, because they will ask. It is not an agent registry. It is not a compliance artifact and satisfies no regime on its own; it maps onto EU AI Act Article 14 (human oversight) and Article 26 (deployer obligations) without claiming to discharge either. It is not RACI for AI: RACI assigns four letters to a project, this asks one question of one running system and ends in a count of things turned off.

## Privacy, before anything else

The harvest reads dotfiles, and strangers will run it. From the first commit:

- It reads only. It writes exactly one file, the `--out` path, and nothing else.
- It never transmits anything. No network calls exist in any script.
- It never reads a secret's value. It records that a name like `EVAL_API_KEY` is referenced, never what it holds. The test suite checks that a fixture value cannot appear in the output.
- It refuses to run with no declared roots. There is no default to your home directory or the current directory. A human names the scope.
- It runs one external binary. Binary plists are not readable as text, so `plutil -convert json` is invoked on them and its stdout is parsed in memory. Nothing is written, no other subprocess exists, and the same secret-names-only rule applies to what comes back. Where `plutil` is absent the file is excluded with a reason rather than read another way.
- Every file it opened is listed in the output under `manifest.scanned.paths_read`, so you can see exactly what was touched.

### Every path it touches

Under each declared root, walked to a depth of six (the default; `max_depth` in the config overrides it), skipping anything under a config `exclude_paths` entry and the folders `.git`, `node_modules`, `dist`, `build`, `_site`, `vendor`, `.venv`, `venv`, `.next`, `.cache`, `coverage`, `.playwright-mcp`, `tmp`, `.vercel`, `.claude`, `.codex` (the last two hold whole worktree checkouts; their settings files are read directly, below):

| Read | For |
|---|---|
| `.github/workflows/*.yml`, `*.yaml` | GitHub Actions schedules |
| `.github/CODEOWNERS`, `CODEOWNERS`, `docs/CODEOWNERS` | the existing owner signal, verbatim |
| `vercel.json`, and the handler file each cron names | Vercel crons |
| `.claude/settings.json`, `.claude/settings.local.json`, `.codex/hooks.json` at the root and one level down | project-level harness hooks |
| `wrangler.toml`, `wrangler.json`, `wrangler.jsonc`, `*.timer`, `*.plist`, `install*.sh`, `setup*.sh`, `bootstrap*.sh` (also `.bash`, `.zsh`), `.mcp.json`, `mcp.json` | proposals only; noted, never walked |

Outside the roots, at well-known locations:

| Read | For |
|---|---|
| `~/Library/LaunchAgents/*.plist` (the default; `launch_agents_dir` in the config overrides it) | launchd agents, kept only when the program path falls under a root or an `include_paths` entry; everything else is listed as excluded with the reason |
| `~/.claude/settings.json`, `~/.claude/settings.local.json`, `~/.codex/hooks.json` | user-level harness hooks |

Nothing else. If you find the harvest reading a path not on this list, that is a bug; open an issue.

## The four location classes in v0.1

1. **GitHub Actions schedules.** `on.schedule` in a workflow file. One row per schedule entry, because one file can carry two different unattended actions.
2. **Vercel crons.** `crons` in `vercel.json`, paired with the handler file each one names.
3. **launchd agents.** `~/Library/LaunchAgents/*.plist`, filtered to programs under a declared root or an `include_paths` entry. `ProgramArguments`, `StartInterval`, `StartCalendarInterval`, `WatchPaths` are read; `EnvironmentVariables` contributes names only.
4. **Harness hooks.** `hooks` in Claude Code settings files and Codex `hooks.json` files, user-level and project-level. A session-end hook that writes to a notes folder and a post-tool hook that captures every shell call are both unattended actions that write data.

Everything else is a proposal. The harvest itself proposes Cloudflare Workers crons, systemd timers, in-repo plists, installers that mention `launchctl` or `crontab`, and MCP registrations when it sees them. The Judge can propose more. Proposals go into `manifest.proposed` with a reason and go nowhere until a human adds them to the config. The machine proposes, the human arms, the next run executes.

## How it works

Four layers with a hard boundary between the second and the third.

| Layer | Who | Deterministic | Output |
|---|---|---|---|
| Harvest | `harvest.mjs` | yes | candidates with provenance, plus a manifest of `scanned`, `excluded` (reason each) and `proposed` |
| Judge | a model, under `SKILL.md` | no | the judgment fields, each carrying a `basis` string quoting the line it used |
| Name | a human, alone | no | `accountable`, `fallback`, `stop_authority.can_stop_alone`, `stop_authority.ever_tested`, `last_human_check`, every `verdict` |
| Validate | `validate.mjs` | yes | schema conformance, human fields still null after the Judge, totals recomputed rather than trusted |

**The model may never fill a human field.** Not as a suggestion, not as a draft. A tool that guesses who is accountable has destroyed the only load-bearing claim the artifact makes. The emptiness is the finding. The validator enforces it: `--stage judged` fails on any non-null human field, and a team or role name in `accountable` fails at every stage.

Under the table, three numbers rather than one: **Reviewed. Named. Killed. Unnamed and still running.** The last one is the debt, and the validator recomputes all four from the rows.

## Run it

Requires Node.js 22 or later. No dependencies.

Declare the scope. This is the file the harvest refuses to run without.

Customize

Replace: `~/code` -> the directory or directories you want walked. Add more entries to `roots` for more.
Replace: `~/notes` -> any place a launch agent's script lives outside a root, or remove the entry.
Replace: `~/code/_others` -> a folder under a root you want skipped and recorded as excluded (upstream clones, archives), or remove the entry.

```json
{
  "roots": ["~/code"],
  "location_classes": ["github-actions-schedule", "vercel-cron", "launchd-agent", "harness-hook"],
  "include_paths": ["~/notes"],
  "exclude_paths": ["~/code/_others"]
}
```

Three further keys are optional and change what the table above describes, so they are worth knowing before you trust the defaults. `max_depth` sets the walk depth, default six. `launch_agents_dir` relocates the launch agents folder, default `~/Library/LaunchAgents`. `home` relocates the home directory the well-known paths hang off, default the real one. The fixture estate sets all three, which is how the test suite walks a fake estate without touching yours.

Save it as `name-the-human.config.json` next to where you want the output, outside any repository you intend to commit.

Harvest. Reads everything above, writes one file.

Literal

```bash
node name-the-human/scripts/harvest.mjs --config name-the-human.config.json --out name-the-human.harvest.json
```

Add `--dry-run` to that command to print the result to stdout and write nothing, which is the honest way to see what it would read before you let it write.

Judge. Open the harvest file in the harness of your choice with `SKILL.md` loaded, or paste `references/prompt.md` into any chat window. Save the result as `name-the-human.json`. Then check that the machine stayed on its side of the line:

Literal

```bash
node name-the-human/scripts/validate.mjs name-the-human.json --stage judged
```

Render the one-page table:

Literal

```bash
node name-the-human/scripts/render.mjs name-the-human.json --out name-the-human.md
```

Name. Fill the five right-hand columns yourself. There is no shortcut and the absence of one is the message. Then validate at the last stage and render again:

Literal

```bash
node name-the-human/scripts/validate.mjs name-the-human.json --stage named
```

Re-run later and see what moved:

Customize

Replace: `last-month.json` -> the inventory file from the previous run.

```bash
node name-the-human/scripts/validate.mjs name-the-human.json --diff last-month.json
```

Install as a skill for Claude Code (`.claude/skills/`) or Codex (`.agents/skills/`) by copying or symlinking the `name-the-human/` folder.

## Example

`name-the-human/assets/example/` holds a synthetic estate after the Judge pass ([inventory.judged.md](name-the-human/assets/example/inventory.judged.md)) and the same estate after a placeholder human pass ([inventory.named.md](name-the-human/assets/example/inventory.named.md)). The names in it are placeholders. Nothing in it is drawn from a real inventory.

## Why

Nobody had joined three things for AI systems: a named individual, a named fallback, and verified unilateral stop authority. The pieces exist separately. The UK Senior Managers and Certification Regime names each senior manager in a Statement of Responsibilities and requires cover for absence. The EU pharmaceutical Qualified Person personally certifies each batch and can refuse. GitHub CODEOWNERS is a machine-readable owner file with a catch-all fallback; PagerDuty escalation policies are an ordered fallback chain by design. EU AI Act Article 14 asks for a stop capability and Article 26 asks for authority, and neither asks who.

In April 2026 the US banking regulators replaced their model risk guidance. SR 26-2 (Federal Reserve, OCC and FDIC, dated 2026-04-17) supersedes SR 11-7. SR 11-7 used "model owner" six times and gave that role "ultimate accountability for model use and performance". SR 26-2 contains the word "owner" zero times, keeps "responsible", and in footnote 3 places generative and agentic AI outside its scope. Read the primary text: the [letter](https://federalreserve.gov/supervisionreg/srletters/SR2602.htm) and the [attachment](https://federalreserve.gov/supervisionreg/srletters/SR2602a1.pdf). The footnote also says a banking organization's own governance should determine controls for what is not covered, so this is not a loophole. It is the most mature model-accountability regime in US banking declining to extend itself to the fastest-moving category, and dropping the owner in the same edit.

The 2025 and 2026 agent registries (AWS, Microsoft Entra, Google Cloud, Collibra, Credo AI, the MCP Registry, A2A Agent Cards) are the crowded neighbour. Three differences: they are per-platform, and the automation nobody registered anywhere is the actual problem; owner is one field among many and nothing tests whether that owner can stop the thing today, alone; and every one of them is additive. Registries register. This ends in a count of things turned off.

The named-owner rule itself is older than this repo. Sam Rogers published it in [The Handoff Gap](https://sigsub.show/newsletter/the-handoff-gap/) (2026-01-26): a named owner at creation, an individual human whose name stays attached when the creator moves on, or it is abandonment with extra steps. This tool is that rule finally run against live automations instead of documents.

## Tested with

Claude Code and OpenAI Codex, on one macOS estate, by the author. Schema v0.3 has not been exercised from Codex since the bump; `MANIFEST.yaml` records what was run where. Nothing more has been run. If it works for you elsewhere, or does not, say so in an issue.

## Credit

The responsibility-versus-accountability distinction this turns on came out of a conversation with Omar Ladak ahead of Signals & Subtractions Ep 12. The columns, the schema and the prior art are Sam's. Ep 12 and the show's own page for this will be linked here once they ship.

## Where this fits

The method layer of a takeaway program at Signals & Subtractions. The show page for the takeaway is the layer that carries real numbers from a real pass; this repo is the schema's stable home and the tooling. Owned by Snap Synapse LLC, MIT licensed.
