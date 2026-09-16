# PROJECT_CONTEXT.md

Context for content, docs and audit skills working on this repo.

## What this project is

Name the Human is a deployer-side accountability inventory for automated and AI systems, packaged as a portable agent skill. One row per surface that acts on its output without a person deciding first, and one question per row: if this is wrong, whose name is on it? A read-only harvest walks four location classes (GitHub Actions schedules, Vercel crons, launchd agents, harness hooks for Claude Code and Codex), a model judge assigns reach and detection with cited evidence, a human alone fills the five naming columns, and a validator recomputes the totals. It is not an agent registry, not a compliance artifact, and satisfies no regime on its own.

The repo has no hosted surface, no npm package, no MCP server and no docs site, all by decision recorded in `INTENT.md`. The bundle at `name-the-human/` is the whole distribution.

## Audience

Deployers running automations they did not individually approve: solo operators and small teams with an estate of crons, agents and hooks that accumulated. Secondary audience is any model in any harness, via `name-the-human/references/prompt.md`, which is the model-agnostic path for harnesses without the bundle installed.

## Style / tone

Direct, unhedged, short declarative sentences. Comfortable naming limits and trade-offs rather than smoothing them. The privacy statement is written as absolutes because strangers run the harvest against their own dotfiles, so any default a config can override must be labelled as a default rather than stated flat. Copy/paste blocks follow the `Literal` / `Customize` labelling convention with explicit `Replace:` lines. No marketing gloss; claims are mechanically checkable or they are softened.

## Invariants a docs change must not break

- Nothing the harvest reads may be omitted from the README's "Every path it touches" table.
- No script may fill a human field, transmit data, or read a secret value. A test that proves the boundary beats a sentence that promises it.
- A schema change bumps the schema version and adds a row to the "Changes from" table in `references/schema.md`.
- `node name-the-human/scripts/test.mjs` passes and committed rendered examples match `render.mjs` output.

## Key URLs

- Repo: https://github.com/snapsynapse/skill-name-the-human
- Schema `$id` (raw, dereferenceable): https://raw.githubusercontent.com/snapsynapse/skill-name-the-human/main/name-the-human/references/schema.json
- Prior art, the named-owner rule: https://sigsub.show/newsletter/the-handoff-gap/
- Show: https://sigsub.show/

## Current status

- Version 0.1.0, schema `name-the-human/v0.3`. Consistent across `package.json`, `name-the-human/MANIFEST.yaml` and `INTENT.md`. No tags, no GitHub Releases yet.
- Five scripts: `harvest.mjs`, `validate.mjs`, `render.mjs`, `test.mjs`, `manifest.mjs`. CI (`.github/workflows/validate.yml`) runs the fixture suite, the no-config refusal, and `manifest.mjs --check` across Node 22/24 on ubuntu and macOS.
- Built and self-tested on one macOS estate. Schema v0.3 has not been exercised from Codex since the bump; `MANIFEST.yaml` `tested_on` is authoritative for what ran where.
- INTERVIEW mode (empty `paths_read`, `provenance.file` of `"interview"`) has no committed fixture and is described in prose only, so it can drift between `SKILL.md` and `prompt.md`.
