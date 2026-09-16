# Changelog

## 0.1.0, 2026-09-15

- Initial versioned release. All files inventoried and hashed in `MANIFEST.yaml`.
- The schema `$id` and the URL in `references/prompt.md` resolve to a raw, tag-pinned path. A model following the prompt in a harness without this bundle installed can dereference the schema it is told to match, and what it fetches at `v0.1.0` cannot change underneath it.
- Schema v0.3 (`references/schema.json`, notes in `references/schema.md`): adds `not-determinable-from-source`, `moves_personal_data`, `basis` under every judged field, stable ids, the manifest of scanned, excluded and proposed, the `triage` array, fixed four-key totals, and keeps `stop_authority.can_stop_alone` nested. Deltas from the v0.2 draft are tabulated in the schema notes with the run that motivated each.
- `scripts/harvest.mjs`: read-only harvest over four location classes (GitHub Actions schedules, Vercel crons, launchd agents, Claude Code and Codex hooks); refuses with no declared roots; records secret names only; lists every path read; proposes Workers crons, systemd timers, in-repo plists, installers and MCP registrations without walking them.
- `scripts/validate.mjs`: structural checks, stage rules (`harvest`, `judged`, `named`), recomputed totals, refusal of role names in `accountable`, `--diff` against a prior run.
- `scripts/render.mjs`: the nine-column table, four totals, triage list, manifest summary.
- `scripts/test.mjs`: fixture estate harvested twice, validator negatives, no-roots refusal.
- `scripts/manifest.mjs`: per-file version and SHA-256 inventory; `--check` is a CI gate across Node 22 and 24 on ubuntu and macOS.
- `SKILL.md`: scope rule, two modes, order of operations, Judge rules, eight refusals, model tiering, guards. The stop instruction names the five human columns that `render.mjs` actually emits, and `scripts/manifest.mjs` is listed among the files.
- `references/prompt.md`: the model-agnostic prompt for INTERVIEW mode.
- `assets/example/`: a synthetic estate after the Judge pass and after a placeholder human pass, JSON and rendered.
- Repository surfaces: the README documents every configurable default the harvest accepts (`max_depth`, `launch_agents_dir`, `home`), the `plutil` subprocess used for binary plists, the full skip list and proposal globs, and `--dry-run`. `SECURITY.md` discloses the same subprocess. Issue and pull request templates carry the no-inventory-file rule and the `INTENT.md` admission criteria to the point of filing.
