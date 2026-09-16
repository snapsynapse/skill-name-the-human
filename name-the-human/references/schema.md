# Schema v0.3, field notes

The machine-readable schema is `schema.json`. This page is the field notes, in the order they bite, plus what changed from the v0.2 draft and why.

One object per surface. JSON is the artifact; the rendered table is a view of it.

## The record

```json
{
  "schema": "name-the-human/v0.3",
  "generated": "2026-09-15",
  "generator": { "harvest": "harvest.mjs 0.1.0", "judge": null },
  "scope_rule": "A surface counts if something acts on its output without a human deciding first.",
  "manifest": {
    "scanned": { "roots": ["~/code"], "location_classes": ["github-actions-schedule"], "paths_read": ["..."], "counts": {} },
    "excluded": [ { "path": "...", "reason": "..." } ],
    "proposed": [ { "location": "...", "reason": "...", "proposed_by": "harvest" } ]
  },
  "surfaces": [
    {
      "id": "gha:repo/.github/workflows/nightly.yml@0_5_*_*_*",
      "class": "github-actions-schedule",
      "surface": "What it is, in the words you would use to a colleague.",
      "location": "~/code/repo/.github/workflows/nightly.yml",
      "schedule": "0 5 * * *",
      "provenance": { "file": "...", "line": 8, "excerpt": "- cron: '0 5 * * *'", "program": null },
      "existing_owner_signal": "CODEOWNERS .github/CODEOWNERS:3 \"/.github/workflows/ @org/platform\"",
      "secret_names_referenced": ["EVAL_API_KEY"],
      "unattended_action": { "value": "...", "basis": "..." },
      "detection": { "who_finds_out": "nobody", "lag": "never", "basis": "..." },
      "blast_radius": { "value": "internal-decision", "basis": "..." },
      "moves_personal_data": { "value": false, "basis": "..." },
      "accountable": null,
      "fallback": null,
      "stop_authority": { "can_stop_alone": null, "how": { "value": "disable the workflow", "basis": "..." }, "ever_tested": null },
      "last_human_check": null,
      "verdict": "unresolved"
    }
  ],
  "triage": [ { "id": "...", "reason": "..." } ],
  "totals": { "reviewed": 1, "named": 0, "killed": 0, "unnamed_still_running": 1 }
}
```

## Field notes

- **`unattended_action`** is where people flatter themselves. "Drafts replies" and "sends replies" are two different rows and only one of them is frightening.
- **`detection.lag`** is the field most people's own failure lives in. A surface whose lag is `never` is not automated, it is unobserved. `not-determinable-from-source` is for when the source cannot say either way: no notification step, no named reader, no log consumer. It is a different fact from `nobody`, and a column with no variance was the first sign the v0.2 schema was missing it.
- **`blast_radius`** classifies by audience: who the output reaches before a person reviews it.
- **`moves_personal_data`** classifies by data movement, independent of audience. Three of the seventeen rows in the first real run were dangerous this way and hid behind `internal-decision`: a production database backup uploaded to third-party storage, a production backup restored into a drill environment, and synthetic writes into a pilot with real cohorts.
- **`basis`** sits under every judged field and quotes the line the judgment came from. It makes a bad classification a bad reading of a visible line rather than a vibe, and it lets a reader check the machine's work without re-reading the source.
- **`accountable`** is a person's name. Not a team, not a role, not an on-call rotation. An individual human whose name stays attached when the creator moves on. A role name is a blank, and the validator refuses it.
- **`fallback`** is who holds it when that person is sick, on leave, or gone. Three answers are the same answer: `null`, `"none"`, or the accountable person's own name. Each means the bus factor is one; the render derives that flag so nobody has to count it.
- **`stop_authority.can_stop_alone`** is the yes or no that separates this from every governance register ever filed. A named owner who has to raise a ticket to halt the thing is decoration.
- **`stop_authority.how`** is the mechanism, read from the source. It is a fact about the system, so the Judge may fill it. Whether the named person can operate that mechanism alone is a fact about the person, so that stays human.
- **`stop_authority.ever_tested`** is the difference between a claim and a fact. "Can they stop it" and "has anyone ever stopped it" are different questions, and only the second has survived contact. The precedent is the pharmaceutical Qualified Person: the certification is an act that has actually been performed, on every batch, by a person who could have refused.
- **`existing_owner_signal`** is what the system already claims. A CODEOWNERS entry, a Backstage `owner:` field, a row in someone's agent registry. Evidence that someone once thought about this; almost always a team; almost always about code review rather than runtime stop authority. The gap between it and the accountable column is itself a finding. It is never the answer.
- **`last_human_check`** is a date, or `"unknown"`. Open question from the first run: whether everyone writes `unknown` and it should become a boolean.
- **`verdict`** is `keep`, `name-it`, `kill`, or `unresolved`. Everything starts `unresolved`, and a pass that leaves everything there has told you something true.
- **`id`** is stable across runs: class, location and schedule. Run N diffs against run N-1, so a scheduled re-run reports drift (a new surface, a named human who left, a `keep` that lost its stop mechanism) rather than a fresh inventory.
- **`manifest`** is the boundary made visible. `scanned` says what was walked, `excluded` says what was seen and set aside with a reason each, `proposed` says what was noticed but not given. Without it, a surface that is missing from the list cannot be told apart from one that was excluded on purpose.
- **`triage`** is the ordered short list, by blast radius then detection lag. In the first run this was the most useful output and lived only in prose.
- **`totals`** are exactly four: `reviewed`, `named`, `killed`, `unnamed_still_running`. The validator recomputes them from the rows and refuses a file where they disagree. A per-field null count is useful and lives in the optional `gaps` object; it is not a substitute.

### Derived, not entered

- `bus_factor_one`: true when `accountable` is set and `fallback` is null, `"none"`, or the same name.
- `orphan`: true when `accountable` is null. These are the rows the fourth total counts, less the kills.

## The table it renders to

One page. Nine columns.

| Surface | Unattended action | If wrong, who finds out / how long | Reach | Accountable | Fallback | Can they stop it alone | Last human check | Verdict |
|---|---|---|---|---|---|---|---|---|

`moves_personal_data` folds into the Reach column. `existing_owner_signal`, `stop_authority.how`, `stop_authority.ever_tested`, `secret_names_referenced`, `provenance` and every `basis` stay in the JSON and off the page. Nine columns is the ceiling for a page that has to end in a decision.

## Changes from v0.2

All driven by the first real run: seventeen surfaces across a working estate, judged by a frontier model, then checked by hand.

| Change | Why |
|---|---|
| `detection.who_finds_out` gains `not-determinable-from-source` | all seventeen rows came back `nobody` / `never`, because the model knew the difference (it wrote "no evidenced detection path" five times in prose) and the schema gave it nowhere to put it |
| `moves_personal_data` boolean | three dangerous rows hid behind `internal-decision` |
| `basis` on every judged field | a judgment with no quoted line cannot be checked |
| stable `id` | so run N diffs against run N-1 |
| top-level `manifest` | the run's boundary existed only as prose; a known scheduled job did not appear and there was no way to tell excluded from missed |
| `triage` array | the ranked list was the most useful output and was prose |
| `totals` fixed to four keys, recomputed by the validator | the run invented its own totals shape |
| `stop_authority.can_stop_alone` stays nested | the run hoisted it to the top level; the validator now names that mistake |
| judged fields become `{value, basis}` objects | so the basis travels with the value it explains |

Kept from v0.2: `existing_owner_signal`, `stop_authority.ever_tested`, the four verdicts, the scope rule, and the rule that the machine never fills a human field.
