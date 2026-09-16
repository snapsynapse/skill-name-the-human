# The prompt

Model-agnostic, two modes, one block. Paste it into whatever chat window you already trust. SCAN is for a harness that can read files; INTERVIEW is for one that cannot. Same schema out of both.

If you are running this inside a harness that has the skill installed, you do not need this: `SKILL.md` carries the same rules with the scripts wired in. This page exists for everyone else.

BEGIN PROMPT
```text
Help me build an accountability inventory of the automated things I run. This is not a security audit and not a compliance exercise. I am answering one question per surface: if this thing is wrong, whose name is on it?

A surface counts if something acts on its output without a human deciding first. A linter does not count. A scheduled job whose output someone reads and acts on does count. When in doubt, include it and let me cut it.

MODE
If you can read my files, work in SCAN mode over the directories I name, and only those. Do not walk my home directory or the current directory unless I name it. Find candidates by looking for: scheduled workflows and cron entries, Vercel crons, launch agents, harness hook files, registered MCP servers, webhooks and callbacks, anything holding an API key, and any script invoked on a timer or by another system. Read any CODEOWNERS file you find and record what it claims, as evidence only. List every file you opened, list what you excluded and why, and list anything you noticed but were not given as a proposal for me to add next time.
If you cannot read files, work in INTERVIEW mode. Ask me what runs without me touching it. Ask at most three questions at a time and keep going until I say stop.

FOR EACH SURFACE, GIVE ME
- id: stable across runs, built from where it lives and what triggers it
- surface: what it is, in the words I would use to a colleague
- location: path, URL, or platform
- schedule: the trigger as written
- existing_owner_signal: what the repo or platform already claims about ownership. A CODEOWNERS entry, a catalog owner field, a registry record. Report it verbatim as evidence. It is not an answer to the accountable question and you must not promote it into one
- secret_names_referenced: the NAMES of any env var or secret the source references. Never a value
- unattended_action: what it does when nobody is watching. "Drafts" and "sends" are different surfaces; do not merge them
- detection.who_finds_out: who notices if the output is wrong. A person, a system, "nobody", or "not-determinable-from-source" when the source shows no detection path either way. The last one is a correct answer, not a failure, and it is different from "nobody"
- detection.lag: immediately, next-run, a-quarter, never, or not-determinable-from-source
- blast_radius: internal-draft, internal-decision, or external
- moves_personal_data: true or false, independent of blast radius
- stop_authority.how: the actual mechanism to stop it, or "unknown"
- basis: under every one of the judged fields above, a short quote of the line you judged it from

RULES YOU DO NOT BREAK
1. Leave accountable and fallback as null. Always. You may not name a person, suggest a person, or infer one from commit history, file ownership, CODEOWNERS, or anything else. Those fields are mine to fill and the point of this exercise is that I can see where they are empty.
2. Leave last_human_check, stop_authority.can_stop_alone and stop_authority.ever_tested as null. Same reason.
3. Do not invent surfaces. Only what you actually found or what I told you.
4. If I answer with a team, a role, or "whoever is on call", tell me that is a blank and move on. Do not record it.
5. Do not set any verdict. Leave every one as "unresolved".
6. Do not soften anything. If detection is "nobody" and "never", write that down plainly.
7. Do not guess. When the source does not show a detection path, write "not-determinable-from-source".

OUTPUT
Valid JSON matching the schema name-the-human/v0.3 at https://github.com/snapsynapse/skill-name-the-human/blob/main/name-the-human/references/schema.json, with a manifest of what you scanned, excluded and proposed, and a totals object where reviewed is the count and the other three are zero and reviewed respectively: named 0, killed 0, unnamed_still_running equal to reviewed. Then render it as a markdown table, one row per surface, nine columns: surface, unattended action, who finds out and how long, reach, accountable, fallback, can they stop it alone, last human check, verdict. Leave the last five columns for me.
Finish with the shortest list you can of the surfaces I should look at first, ordered by blast radius and then by detection lag, and say why each one is on that list.

I do not need to give you any credentials, customer names, or secrets to do this, and you should not ask for any.
```
END PROMPT

## After the machine stops

The second pass is a person with the table open, filling five columns by hand: accountable, fallback, can they stop it alone, last human check, verdict. There is no shortcut and the absence of one is the message.

The third pass is the verdict on each row, and the kills actually executed rather than planned. A row that gets `kill` and stays running is still `unnamed_still_running`, and it counts in the debt.

Under the table, three numbers rather than one:

**Reviewed NN. Named NN. Killed NN. Unnamed and still running NN.**

That last number is the honest one. Most people finish a pass like this carrying a residue they are not willing to kill today, and an artifact that only offers a clean slate teaches them to fudge. State the debt.
