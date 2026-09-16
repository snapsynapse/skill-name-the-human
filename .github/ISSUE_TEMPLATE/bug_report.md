---
name: Bug report
about: Something the harvest, validator or renderer got wrong
title: ''
labels: ''
assignees: ''
---

**Do not paste your inventory file, your harvest output, or your config.** Any of the three is a map of what runs on your machine. Quote the one line that matters and redact the rest.

## What happened

## What you expected

## The smallest thing that reproduces it

A path shape, a workflow snippet, or a plist fragment with real names removed. If the problem is a path being read that the README's "Every path it touches" table does not list, that is a security bug, not a normal one: see SECURITY.md.

## Which script and which stage

- [ ] `harvest.mjs`
- [ ] `validate.mjs`
- [ ] `render.mjs`
- [ ] the model judge (which harness and model)
- [ ] `references/prompt.md` in a harness without the bundle

## Environment

- OS and version:
- Node version (`node --version`):
- Bundle version (`name-the-human/MANIFEST.yaml` `bundle_version`):
- Schema version in your output (`schema` field):
