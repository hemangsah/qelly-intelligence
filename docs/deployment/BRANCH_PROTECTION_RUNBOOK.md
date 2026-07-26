# GitHub Main Protection

Configure this only after the hosted preview and its deployment configuration are stable.

- Require pull requests before merging.
- Require one approval and dismiss stale approvals.
- Require conversation resolution.
- Require the current checks: `Continuous Integration / validate`, `CodeQL / Analyze (javascript-typescript)`, every `Container Build / build` matrix result, and `Production Foundation Services / postgres-redis-integration`.
- Do not require a hosted-production-secret check on ordinary pull requests.
- Require the branch to be up to date before merge.
- Block force pushes and branch deletion.
- Restrict bypass to designated repository administrators.
- Keep workflow token permissions at read-only by default; grant `packages: write`, `security-events: write`, or `contents: write` only to the job that needs it.

Re-read the live check names from a successful pull request before saving the ruleset; GitHub displays matrix check names exactly as emitted by Actions.
