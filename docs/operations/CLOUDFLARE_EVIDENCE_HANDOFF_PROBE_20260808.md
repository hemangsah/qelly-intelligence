# Cloudflare evidence handoff probe — 2026-08-08

This branch-only document exists solely to create a disposable pull-request head for validating the default-branch Cloudflare evidence handoff automation tracked in issue #85.

Acceptance proof required before this probe is closed without merge:
- Cloudflare Pages publishes a preview for this exact probe head.
- The default-branch `Qelly Cloudflare Evidence Handoff` workflow starts automatically from the Cloudflare Pages deployment-result signal.
- The handoff resolves and checks out the same exact probe SHA.
- The governed Linux evidence run completes 70 routes / 140 renders plus accessibility and archive verification.
- The evidence workflow retains read-only repository permissions and has no merge/deploy capability.

This file must not be merged into `main`; the probe PR is validation-only.
