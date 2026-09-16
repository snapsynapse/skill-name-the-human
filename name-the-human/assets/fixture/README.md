# Fixture estate

A synthetic estate for `test.mjs`. Nothing here is real: the company, the paths, the hooks and the key names are invented so the harvest has something deterministic to walk in CI.

The three plists carry the placeholder `__ESTATE__` in their program paths. The test copies the estate to a temporary folder and substitutes the absolute path before harvesting, because launchd program paths are absolute and the fixture cannot know where it was cloned.

What the harvest should find here, and why each row exists:

| Expected row | Exercises |
|---|---|
| `nightly-evals.yml` twice | one workflow file, two schedules, two rows; CODEOWNERS pattern match with two teams |
| `vercel.json` cron | handler lookup, `process.env.*_API_KEY` recorded by name only |
| `com.example.vault-sync` | launchd `StartInterval`, program under a declared root via `/bin/sh` |
| `com.example.nightly-report` | launchd `StartCalendarInterval`, `EnvironmentVariables` key recorded by name only |
| `.codex/hooks.json` | project-level Codex hook |
| `home/.claude/settings.json` twice | user-level Claude Code hooks, one with a matcher |

What it should exclude, with a reason: `com.vendor.updater.plist` (program outside the roots), `com.example.retired.plist.disabled` (not an active plist).

What it should propose, not walk: `wrangler.toml` (Workers cron), `scripts/install.sh` (references launchctl).

`ci.yml` has no schedule. It is read and counted, and it is not a row.
