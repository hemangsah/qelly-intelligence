# Release A4 Release Notes

Release A4 closes critical production-foundation gaps without expanding financial execution. It adds recoverable account access, outbound destination controls, quarantine-first imports and consolidated platform readiness.

## Added
- Account Recovery frontend and APIs.
- Single-use recovery challenge lifecycle.
- OutboundNetworkPolicy with HTTPS, allowlist, DNS and private-network controls.
- Quarantine-before-release secure imports.
- Platform Readiness screen and API.
- Complete 57-route desktop/mobile screen evidence.

## Fixed
- Recovery actions now revoke all existing sessions.
- Outbound adapters no longer accept unsafe loopback/private/metadata destinations by default.
- Local secure imports are not exposed before scanning and atomic release.

## Remaining
External infrastructure and independent security validation remain deployment-dependent.
