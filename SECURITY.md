# Security

This tool reads dotfiles and settings files on the machine it runs on. That is its job, and it is why the boundary matters more than usual.

## What it promises

- Reads only. Writes one file, the `--out` path.
- No network calls in any script.
- Secret names only, never values. `EnvironmentVariables` in a plist contributes its keys; `secrets.NAME` in a workflow contributes `NAME`; a handler's `process.env.NAME` contributes `NAME`.
- No default scope. The harvest refuses to run without declared roots.
- One external binary, `plutil`, for binary plists only. Invoked as `plutil -convert json -o - <file>`, stdout parsed in memory, nothing written. If it is unavailable the file is excluded with a reason. No other subprocess is spawned.
- Every file opened is listed in the output.

## Reporting

If the harvest reads a path not listed in the README's "Every path it touches" table, writes anything other than its output file, contacts the network, or carries a secret value into its output, that is a security bug. Open a GitHub issue with the path and the script line, or if the report itself would expose something, email security@snapsynapse.com.

Do not include your own inventory file in a report. It is a map of what runs on your machine.
