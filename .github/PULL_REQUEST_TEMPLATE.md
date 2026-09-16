## Summary

## Checklist

- [ ] `node name-the-human/scripts/test.mjs` passes
- [ ] `node name-the-human/scripts/manifest.mjs --check` matches, or `manifest.mjs` was rerun and the result committed
- [ ] Nothing the harvest reads is missing from the README's "Every path it touches" table
- [ ] No script fills a human field, transmits anything, or reads a secret's value
- [ ] A new location class ships with a fixture, an expected id in `test.mjs`, and a README row
- [ ] A schema change bumps the schema version and adds a row to `references/schema.md`
- [ ] If this PR is part of a release, the `$id` in `references/schema.json` and the schema URL in `references/prompt.md` are repointed from the previous tag to the tag being cut, and that change lands in the commit the tag will point at
- [ ] `name-the-human/CHANGELOG.md` updated if this changes behaviour
- [ ] No real inventory, harvest output or config is included in the diff
