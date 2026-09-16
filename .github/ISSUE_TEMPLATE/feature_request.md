---
name: Feature request
about: A location class, a field, or a change to the boundary
title: ''
labels: ''
assignees: ''
---

## The problem

What runs unattended that this cannot currently see, or what the table fails to tell you once it does.

## Proposed change

If this is a new location class, note that `INTENT.md` requires it to ship with a fixture in `assets/fixture/`, an expected id in `test.mjs`, a row in the README's path table, and the exact list of what it reads.

If this asks a script to fill a field the human fills, say so plainly. That boundary is the point of the tool and the answer is likely no, but the reasoning is worth having in the open.

## Alternatives considered

## Does this change the schema

- [ ] No
- [ ] Yes, and I understand it bumps the schema version and adds a row to the "Changes from" table in `references/schema.md`
