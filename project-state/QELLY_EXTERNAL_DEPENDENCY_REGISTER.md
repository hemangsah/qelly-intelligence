# Qelly External Dependency Register

| Dependency | Purpose | State | Auth / terms | Risk / blocker |
|---|---|---|---|---|
| GitHub | Repository, PR, workflow and artifact authority | Connected | OAuth connector; admin permission verified | Exact-head authorization mismatch |
| GitHub Actions | CI, security and browser evidence | Connected | Repository workflows | Post-merge runs unavailable until merge |
| Playwright browsers | Chromium, Firefox and WebKit evidence | Implemented deterministically in workflows | Locked project dependency | No current blocker |
| IBM Plex Sans Variable | Canonical Qelly typography | Implemented and governed | Locally governed with licence evidence | Must remain locked |
| Public deployment target | Internet baseline | Unavailable in this blocked phase | Not modified | Must be audited after authorized merge |
