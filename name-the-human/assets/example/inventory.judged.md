# Name the Human: example after the Judge pass

Generated 2026-09-15. Schema name-the-human/v0.3. A surface counts if something acts on its output without a human deciding first.

| Surface | Unattended action | If wrong, who finds out / how long | Reach | Accountable | Fallback | Can they stop it alone | Last human check | Verdict |
|---|---|---|---|---|---|---|---|---|
| Daily eval run against the live product, read-only | Runs the eval suite in readonly mode against production every morning and stores the scores | nobody / never | internal-draft | [ ] | [ ] | [ ] | [ ] | unresolved |
| Weekly eval run that writes synthetic records into the shared environment | Every Sunday runs the eval suite in synthetic-write mode, which creates synthetic records in an environment real users share | not-determinable-from-source / not-determinable-from-source | internal-decision, moves personal data | [ ] | [ ] | [ ] | [ ] | unresolved |
| Claude Code hook that records usage after every shell command | After every Bash tool call runs a capture script with a 15 second timeout | not-determinable-from-source / not-determinable-from-source | internal-draft | [ ] | [ ] | [ ] | [ ] | unresolved |
| Claude Code hook that captures every session's end into a notes folder | At the end of every session writes a capture record to a personal notes folder | nobody / never | internal-draft | [ ] | [ ] | [ ] | [ ] | unresolved |
| Codex hook that runs the test suite after every edit | Runs npm test after each file edit and prints the last three lines back into the session | the operator in the session / immediately | internal-draft | [ ] | [ ] | [ ] | [ ] | unresolved |
| Nightly summary emailed to a team alias | At 03:00 generates a report and mails it to a team alias | not-determinable-from-source / not-determinable-from-source | internal-decision | [ ] | [ ] | [ ] | [ ] | unresolved |
| Hourly sync of a personal notes folder into a shared folder | Every hour mirrors ~/notes into ~/shared/notes, so anything written privately is shared within the hour | nobody / never | internal-decision, moves personal data | [ ] | [ ] | [ ] | [ ] | unresolved |
| Morning cron that sends every email queued overnight | Reads the outbox and sends each queued email to its recipient with no human review between queue and send | recipients / immediately | external, moves personal data | [ ] | [ ] | [ ] | [ ] | unresolved |

**Reviewed 8. Named 0. Killed 0. Unnamed and still running 8.**

## Look at these first

1. `vercel:example-site/vercel.json@/api/cron/drain-outbox@0_7_*_*_*`: external reach, moves personal data, and the only check is the recipient
2. `gha:example-site/.github/workflows/nightly-evals.yml@30_5_*_*_0`: writes into a store with real cohorts and nothing in the source says who would notice
3. `launchd:com.example.vault-sync@interval:3600s`: personal notes become shared within the hour and nothing reads the log
4. `launchd:com.example.nightly-report@calendar:Hour=3,Minute=0`: a mailed report is read as fact and the source cannot say whether anyone reads it

## What was scanned

Roots: `~/code/example-site`, `~/code/tools`. Classes: github-actions-schedule, vercel-cron, launchd-agent, harness-hook. Files read: 12.

Excluded, with the reason each:

- `~/code/launchagents/com.example.retired.plist.disabled`: not an active plist (renamed or disabled)
- `~/code/launchagents/com.vendor.updater.plist`: program ~/code/elsewhere/updater/updater is outside declared roots and include_paths

Proposed, not walked. Add a location to the config and run again to include it:

- `~/code/example-site/wrangler.toml`: wrangler config declares cron triggers; Cloudflare Workers cron is not a v0.1 class (proposed by harvest)
- `~/code/example-site/scripts/install.sh`: installer script references launchctl, crontab or systemctl; it may create a trigger the harvest did not see (proposed by harvest)
- `~/code/example-site/scripts/run-evals.mjs`: the eval script names a third-party eval service by env var; that service may run its own schedule (proposed by judge)

## Evidence kept off the table

Each row in the JSON also carries `existing_owner_signal`, `stop_authority.how`, `stop_authority.ever_tested`, `secret_names_referenced`, `provenance`, and a `basis` line under every judged field. They are for the second pass and for whoever reads the record later.
