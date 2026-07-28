# Qelly Post-Merge Foundation State

## Repository and approval state

- Authenticated owner: `hemangsah`
- Repository: `hemangsah/qelly-intelligence`
- Default branch: `main`
- Current and approved foundation main SHA: `239f6f0c7c663801662f4e5f940ca76fb6941bf1`
- PR #11: closed, merged and unchanged
- PR #11 approved head: `ca3d85898d6ce26dc4c2b2cda35b34e1810d2c1b`
- PR #11 merge timestamp: `2026-07-28T07:04:18Z`
- Foundation tag: `qelly-design-foundation-v1`
- Annotated tag object SHA: `058a17a0e7a0917b1c728b097618ed3d2e524a8c`
- Tag target: `239f6f0c7c663801662f4e5f940ca76fb6941bf1`
- Approved Theme Intelligence artifact SHA-256: `756841a7a9a3425413884b8954f6b5f5b689b888ec46e30313e8e0b775be99bf`

## Post-merge main workflows

All authoritative runs completed successfully on the exact merge commit:

| Workflow | Run | Event | Conclusion |
|---|---:|---|---|
| Continuous Integration | `30337023352` | push | success |
| Container Build | `30337023602` | push | success |
| Production Foundation Services | `30337023490` | push | success |
| CodeQL | `30337023524` | push | success |
| Static Visual Preview | `30337023344` | push | success |

## Approved-head specialist workflows

| Workflow | Run | Event | Conclusion |
|---|---:|---|---|
| Continuous Integration | `30334452355` | pull_request | success |
| Container Build | `30334452462` | pull_request | success |
| Production Foundation Services | `30334452368` | pull_request | success |
| CodeQL | `30334452358` | pull_request | success |
| Typography Governance Review | `30334452347` | pull_request | success |
| Qelly IBM Plex Governance Audit | `30334452443` | pull_request | success |
| Qelly UI Rescue Review | `30334452307` | pull_request | success |
| Qelly Theme Intelligence Review | `30334452416` | pull_request | success |
| Qelly Theme Intelligence Visual Correction Review | `30334452382` | pull_request | success |

## Independent live verification

- Public URL: `https://hemangsah.github.io/qelly-intelligence/`
- Verification workflow: `30349556583`
- Result: passed
- Browser: independent Chromium
- Live route/viewpoint captures: 54
- Tested viewports: `360×800`, `390×844`, `430×932`, `768×1024`, `1024×768`, `1280×800`, `1440×1000`, `1728×1080`, `1920×1080`
- Tested routes: root/Market Overview, Asset Rankings, Market Overview direct route, Asset Dossier, Theme Studio and Theme Gallery
- Correct `/qelly-intelligence/` base path: verified
- Local IBM Plex Sans Variable WOFF2: verified
- External font requests: zero
- Console errors: zero
- Failed resources: zero
- Document horizontal overflow: zero
- Layout shift gate: passed
- Dark, light, OLED and high-contrast appearances: verified
- Reduced-motion environment: verified
- Static-preview truth boundary: verified

## Preserved branches

- `agent/ui-rescue-asset-rankings` at `ca3d85898d6ce26dc4c2b2cda35b34e1810d2c1b`
- `agent/theme-intelligence-emergency-checkpoint` at `cfad5730d5acfc6c7db33f1552e8f4e04c3bb974`

Neither branch may be deleted during the logo-first review phase.
