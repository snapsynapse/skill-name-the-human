# Changelog

## 0.1.0, 2026-09-15

- Initial versioned release. All files inventoried and hashed in `MANIFEST.yaml`.
- Schema v0.3 (`references/schema.json`, notes in `references/schema.md`): adds `not-determinable-from-source`, `moves_personal_data`, `basis` under every judged field, stable ids, the manifest of scanned, excluded and proposed, the `triage` array, fixed four-key totals, and keeps `stop_authority.can_stop_alone` nested. Deltas from the v0.2 draft are tabulated in the schema notes with the run that motivated each.
- `scripts/harvest.mjs`: read-only harvest over four location classes (GitHub Actions schedules, Vercel crons, launchd agents, Claude Code and Codex hooks); refuses with no declared roots; records secret names only; lists every path read; proposes Workers crons, systemd timers, in-repo plists, installers and MCP registrations without walking them.
- `scripts/validate.mjs`: structural checks, stage rules (`harvest`, `judged`, `named`), recomputed totals, refusal of role names in `accountable`, `--diff` against a prior run.
- `scripts/render.mjs`: the nine-column table, four totals, triage list, manifest summary.
- `scripts/test.mjs`: fixture estate harvested twice, validator negatives, no-roots refusal.
- `SKILL.md`: scope rule, two modes, order of operations, Judge rules, eight refusals, model tiering, guards.
- `references/prompt.md`: the model-agnostic prompt for INTERVIEW mode.
- `assets/example/`: a synthetic estate after the Judge pass and after a placeholder human pass, JSON and rendered.
