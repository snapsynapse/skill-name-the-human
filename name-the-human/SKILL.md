---
name: name-the-human
description: >
  Build a deployer-side accountability inventory of the automated and AI
  systems a person or team runs: one row per surface that acts on its output
  without a human deciding first, ending in a named person, a named fallback,
  and a yes-or-no on whether that person can stop it alone. The machine
  harvests candidates and judges their reach; it never fills a human field.
  Use whenever the user says "name the human", "accountability inventory",
  "who owns this automation", "which of my automations has nobody on it",
  "audit my scheduled jobs for an owner", "what runs without me", or asks
  who is accountable for a cron, workflow, launch agent, hook or agent. Also
  use when the user has a name-the-human config or inventory JSON and wants
  it harvested, judged, validated, rendered or diffed against a prior run.
---

# Name the Human

An inventory of the things that run without a person deciding first, and a single question per row: if this is wrong, whose name is on it?

Version 0.1. Schema `name-the-human/v0.3`, at `references/schema.json`. This document is the operating rules. The README carries the privacy statement, the prior art and the boundaries; read it once.

## The scope rule

A surface counts if something acts on its output without a human deciding first. A linter does not count. A scheduled job whose output someone reads and acts on does count. When in doubt, include it and let the human cut it.

## Four layers, one hard boundary

| Layer | Who | Deterministic | Fills |
|---|---|---|---|
| Harvest | `scripts/harvest.mjs` | yes | candidates with provenance; manifest of `scanned`, `excluded`, `proposed` |
| Judge | you, the model | no | `surface`, `unattended_action`, `detection`, `blast_radius`, `moves_personal_data`, `stop_authority.how`, `triage`, and proposals; each judgment with a `basis` |
| Name | a human, alone | no | `accountable`, `fallback`, `stop_authority.can_stop_alone`, `stop_authority.ever_tested`, `last_human_check`, every `verdict` |
| Validate | `scripts/validate.mjs` | yes | nothing; it checks the file and recomputes the totals |

**You may never fill a human field.** Not as a suggestion, not as a draft, not as "you probably mean". Not from commit history, CODEOWNERS, a registry, an on-call rotation or the user's own hint. They stay `null` and the verdict stays `unresolved` until the human pass. The emptiness is the finding. A tool that guesses who is accountable has destroyed the only load-bearing claim the artifact makes.

`existing_owner_signal` is what a repo or platform already claims, recorded verbatim by the harvest. It is evidence that someone once thought about ownership, it is almost always a team, and it is never the answer. Do not promote it.

## Two modes

**SCAN.** The user names roots and the harvest script is available. Run it, judge what it found, validate, render, stop.

**INTERVIEW.** No filesystem, or the user prefers to talk. Ask what runs without them touching it. At most three questions at a time. Keep going until they say stop. Build the same JSON by hand, with `manifest.scanned.roots` set to what they described (for example `["conversation"]`), `paths_read` empty, and every `provenance.file` set to `"interview"` with the user's words as the excerpt.

## Order of operations in SCAN mode

1. **Config.** A human declares the scope. If there is no `name-the-human.config.json`, write one from what the user tells you and show it to them before running. Never default to the home directory or the current directory. `roots` is the list of directories to walk; `location_classes` selects among the four v0.1 classes; `include_paths` lists extra places a launchd program may live (a notes vault, a tools folder) without walking them; `exclude_paths` lists folders under a root to skip, and each one is recorded in `manifest.excluded` so a missing surface can be told apart from an excluded one.
2. **Harvest.** `node scripts/harvest.mjs --config name-the-human.config.json --out name-the-human.harvest.json`. Read the summary line: candidates, files read, excluded, proposed. If it refuses, it is because no roots were declared; do not work around that.
3. **Judge.** Copy the harvest file to `name-the-human.json` and fill the judgment fields, one surface at a time, from the `provenance` excerpt and the files it points at. Rules below.
4. **Validate.** `node scripts/validate.mjs name-the-human.json --stage judged`. Fix every error. The stage check fails if any human field is non-null; that is the boundary working.
5. **Render.** `node scripts/render.mjs name-the-human.json --out name-the-human.md`.
6. **Stop.** Tell the user the table is ready and that the four columns on the right are theirs. The human pass is not yours to start, and you do not offer to start it.

On a later run, `node scripts/validate.mjs name-the-human.json --diff previous.json` reports surfaces added, surfaces gone, and rows whose name, fallback, verdict, schedule or stop mechanism changed. A re-run reports drift, not a fresh inventory.

## Judge rules

Every judged field is `{ "value": ..., "basis": "..." }`. The basis is a short quote of the line that produced the judgment: a cron entry, a script line, a plist key, a handler call. A bad classification should be a bad reading of a visible line, not a vibe. `"basis": "uploads to third-party storage"` next to `"internal-decision"` contradicts itself on the page, and that is the point.

**`surface`.** Rewrite the harvest's mechanical placeholder in the words the user would use to a colleague. One line.

**`unattended_action`.** What it does when nobody is watching. "Drafts" and "sends" are different rows. If one trigger does two things, say both; if one file carries two schedules, the harvest already split them.

**`detection.who_finds_out` and `detection.lag`.** Who notices when the output is wrong, and how long that takes. A person, a system, `"nobody"`, or `"not-determinable-from-source"`. Use the last one whenever the source shows no detection path either way: no notification step, no reader named, no log consumer. It is a correct answer, not a failure, and it is a different fact from `"nobody"`. `"nobody"` means the source shows there is no one. Lag is one of `immediately`, `next-run`, `a-quarter`, `never`, `not-determinable-from-source`.

**`blast_radius`.** `internal-draft` when the output is read by a person before anything acts on it. `internal-decision` when the output is acted on inside the organisation without that review: a report read as fact, a sync into a shared folder, a write into a shared store. `external` when it reaches a customer, a recipient, a public page, a third-party system.

**`moves_personal_data`.** Boolean. Independent of blast radius. A daily production backup uploaded to third-party storage is `internal-decision` by audience and `true` here; the second flag is what makes it visible.

**`stop_authority.how`.** The actual mechanism, read from the source: disable the workflow, unload the plist, remove the hook entry, revoke the key. The harvest proposes one per class; correct it when the source shows something better or worse. `"unknown"` is allowed. This is a fact about the mechanism, not about a person, which is why it is not a human field.

**`triage`.** An ordered list of surface ids with one line each: by blast radius (external first), then by detection lag (never and not-determinable first), with `moves_personal_data` breaking ties. Keep it to the surfaces a person should open first. This list is the most useful thing the pass produces.

**Proposals.** Anything you noticed that the harvest was not given: an installer that implies a launch agent, a reference to a cron on a platform not in the config, a webhook, an MCP server, a SaaS automation. Append to `manifest.proposed` with `"proposed_by": "judge"` and a reason. Proposals go nowhere until a human adds them to the config; you do not walk them.

## Refusals

1. Leave `accountable` and `fallback` as `null`. Always. You may not name a person, suggest a person, or infer one from commit history, file ownership, CODEOWNERS or anything else.
2. Leave `last_human_check`, `stop_authority.can_stop_alone` and `stop_authority.ever_tested` as `null`. Same reason.
3. Do not invent surfaces. Only what the harvest found or what the user told you.
4. If the user answers with a team, a role, or "whoever is on call", tell them that is a blank and move on. Do not record it. The validator refuses it anyway.
5. Do not set any `verdict`. Every one stays `"unresolved"`.
6. Do not soften anything. If detection is nobody and never, write that down plainly.
7. Do not guess. When the source does not show a detection path, write `not-determinable-from-source`.
8. Do not ask for credentials, customer names or secrets. None are needed. If the user pastes one, say so and do not carry it into the file.

## Model tiering

Effort proportionate to consequence, which is the artifact's own thesis.

- Enumeration is a small-model job under a strict schema and a validator; the harvest already did most of it.
- The judgment fields want a mid-tier model if the classifications are going to be defended in public.
- A high-effort pass is worth it only on the subset that came back `external` or `moves_personal_data: true`. On the estate this was built against that was about five rows of seventeen.

## Guards

- **One page.** Longer than that and it is an inventory, and inventories get filed. If the harvest returns a hundred rows, say so and ask the user to narrow the roots; do not thin the rows yourself.
- **Partial runs are a win.** Three named surfaces with real stop authority is a better week than the user had before. Never scold an incomplete table.
- **No credentials, ever.** Say so before the first question.
- **The naming stays human.** Every other rule follows from this one.

## Files

- `scripts/harvest.mjs`: read-only candidate harvest; refuses with no declared roots
- `scripts/validate.mjs`: schema, stage rules, recomputed totals, `--diff`
- `scripts/render.mjs`: the one-page table
- `scripts/test.mjs`: fixture estate, twice, plus validator negatives
- `references/schema.json`: schema v0.3
- `references/schema.md`: field notes in the order they bite
- `references/prompt.md`: the model-agnostic prompt for INTERVIEW mode or a harness without this skill
- `assets/example/`: a synthetic estate judged, and the same estate after a placeholder human pass
