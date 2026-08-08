# Cloudflare evidence handoff probe — 2026-08-08

This branch-only document exists solely to create a disposable pull-request head for validating the default-branch Cloudflare evidence handoff automation tracked in issue #85.

Acceptance proof required before this probe is closed without merge:
- Cloudflare Pages publishes a preview for this exact probe head.
- The default-branch `Qelly Cloudflare Evidence Handoff` workflow starts automatically from the Cloudflare Pages deployment-result signal.
- The handoff authoritatively verifies the Cloudflare check-run and resolves the same open pull request.
- The Cloudflare check `head_sha`, current pull-request head, and checked-out evidence SHA are identical.
- The governed Linux evidence run completes 70 routes / 140 renders plus accessibility and archive verification.
- The evidence workflow retains read-only repository permissions and has no merge/deploy capability.

Probe attempt 1 proved the `check_run` trigger fires, but exposed brittle job-level event-field checks. PR #89 moved those checks into an authoritative GitHub API verification step on the default branch.

Probe attempt 2 is this commit. It must validate the corrected default-branch behavior end to end.

This file must not be merged into `main`; the probe PR is validation-only.
