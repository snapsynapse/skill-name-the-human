# INTENT: skill-name-the-human

Owns purpose, boundaries and exceptions for this repository. Decisions scoped to this component live here. Anything spanning the show or the wider portfolio lives elsewhere and is pointed at, not copied.

## What this product is

A deployer-side accountability inventory for automated and AI systems, packaged as an agent skill with three deterministic scripts (harvest, validate, render) and two that keep them honest (a test suite and a manifest checker). It produces one JSON file against a versioned schema (`name-the-human/v0.3`) and renders it as a one-page table with nine columns and four totals. The machine harvests candidate surfaces and judges their reach; a human, alone, fills the fields that name a person and a fallback and say whether that person can stop the thing.

## Why it exists

Nobody had joined a named individual, a named fallback and verified unilateral stop authority for AI systems. The pieces exist separately (SMCR, the pharmaceutical Qualified Person, CODEOWNERS, escalation policies) and the EU AI Act asks for stop capability and authority in two different articles without ever asking who. In April 2026 the US banking regulators' revised model risk guidance (SR 26-2) removed the word "owner" and excluded generative and agentic AI from scope in the same document. The README carries the primary citations. This repo is the method layer of a takeaway program at Signals & Subtractions; the show page is the takeaway that carries real numbers.

## Design invariants

1. The machine never fills a human field. `accountable`, `fallback`, `stop_authority.can_stop_alone`, `stop_authority.ever_tested`, `last_human_check` and every `verdict` are a person's to fill. The validator enforces this at `--stage judged`, and a team or role name in `accountable` fails at every stage.
2. A human declares the scope. The harvest refuses to run with no declared roots and has no default directory.
3. Read-only, and visibly so. One output file, no network, secret names only and never values, every path opened listed in the output, every path the harvest can touch listed in the README.
4. Every judgment carries its evidence. A judged field is `{value, basis}` and the basis quotes the line it came from.
5. Totals are recomputed, never trusted. The four totals are `reviewed`, `named`, `killed`, `unnamed_still_running` and the validator refuses a file where they disagree with the rows.
6. Proposal, then approval. A location the harvest or the Judge notices but was not given lands in `manifest.proposed` and is walked only after a human adds it to the config.
7. Stable ids across runs, so a re-run reports drift rather than a fresh inventory.
8. One page. Nine columns is the ceiling for the rendered table; evidence fields stay in the JSON.
9. No dependencies. Plain Node 22 scripts, so a stranger can read every line that runs against their dotfiles.

## Scope boundaries

In scope for v0.1: four location classes (GitHub Actions schedules, Vercel crons, launchd agents, harness hooks for Claude Code and Codex), the schema, the five scripts, a synthetic example, and the model-agnostic prompt for INTERVIEW mode.

Out of scope, by decision on 2026-09-15: an npm package, an MCP server, a docs site, a custom domain, a GitHub Action marketplace listing. Distribution comes back if someone other than the author asks. MCP server registrations, SaaS automations (Zapier, Substack, Resend schedules), Cloudflare Workers cron triggers and systemd timers are proposals, not classes, until a second estate needs them.

Not in this repo, ever: the author's real inventory. It is a map of every scheduled job across a private product with research participants, with the stop mechanism for each. It stays local and uncommitted, and the committed example is synthetic. The `.gitignore` refuses `name-the-human.*.json` outside the bundle's assets for the same reason.

Registration as a method at snapsynapse.com/tools/: not yet. The show's takeaway program registers a method only after two takeaways share its shape. Until then this repo is the schema's stable home and nothing else.

## Conformance philosophy

N/A because this is a tool with a schema, not an open specification. The schema is versioned and the validator is the conformance check; there is no ladder and no claim model.

## Admission criteria for changes

1. A schema change bumps the schema version and adds a row to the "Changes from" table in `references/schema.md` with the run that motivated it.
2. A new location class ships with a fixture in `assets/fixture/`, an expected id in `test.mjs`, a row in the README's path table, and the exact list of what it reads.
3. Nothing the harvest reads may be omitted from the README's "Every path it touches" table.
4. No change may let a script fill a human field, transmit data, or read a secret value. A test that proves the boundary is preferred to a sentence that promises it.
5. `node name-the-human/scripts/test.mjs` passes and the committed rendered examples match `render.mjs` output.

## Relationships to other PAICE standards

Non-binding. Skill Provenance tracks the bundle's version, hashes and changelog (`name-the-human/MANIFEST.yaml`). The repo layout follows `skill-a11y-audit` so repo-standards conformance is inherited rather than retrofitted. AIDR and Turnfile are adjacent (a decision record and a session protocol) and neither is integrated. The README cites EU AI Act Article 14 and Article 26 directly rather than through EveryAILaw records; EveryAILaw is not an adopted dependency of this repo.

## Exceptions to Repo Standards

- `CHANGELOG.md` lives in the bundle (`name-the-human/CHANGELOG.md`) rather than at the repo root, matching `skill-a11y-audit` and the Skill Provenance convention that the changelog travels with the bundle.
- No `CONTRIBUTING.md`, `SPONSORS.md`, docs site, `llms.txt` or `assistant-guide.txt`: not hosted, by decision above. Revisit if a hosted surface is added.
- The skill bundle sits at `name-the-human/` at the repo root rather than under `skills/` or as a root `SKILL.md`, matching `skill-a11y-audit`'s `a11y-audit/` shape. Repo Standards v0.9 codifies only the other two patterns; two repos now use this one.
- `PROJECT_CONTEXT.md` is at the repo root rather than inside the bundle, matching `aidr`, `turnfile`, `sigsubshow`, `ai-tool-watch` and `PAICE2`.
- `.gitignore` carries a negation for `name-the-human/assets/**/.claude/` and `.codex/` because the fixture estate must use the real file names the harvest looks for.

## Changelog

- 2026-09-15: Repository created from the Ep 12 handoff. Schema v0.3, the five scripts, fixture estate, synthetic examples, SKILL.md, prompt, README with the privacy statement and prior art. Version 0.1. Decisions recorded above: MIT, `skill-a11y-audit` layout, no distribution surfaces, real inventory never committed, method registration deferred to the two-instances rule.
- 2026-09-15: Audit pass (repo-standards, repo-hygiene, agent-readiness, doc-audit). Schema `$id` repointed from a `blob/` URL to a raw dereferenceable one; README corrected against `harvest.mjs` (three optional config keys, the `plutil` subprocess, `.playwright-mcp` in the skip list, the full proposal globs, `--dry-run`); `SKILL.md` column count corrected to five and `manifest.mjs` added to Files; script counts reconciled to five; the EveryAILaw citation claim softened to match what the README actually cites; `PROJECT_CONTEXT.md` added; `.perplexity-research/` ignored.
