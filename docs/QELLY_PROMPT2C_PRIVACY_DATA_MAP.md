# Qelly Prompt 2C Privacy and Data Map

Qelly collects no wallet seed, private key, brokerage credential or custody information.

| Data class | Purpose | Storage | Retention | Analytics/logging |
|---|---|---|---|---|
| Email and auth subject | Account access, verification and recovery | Auth provider | Until account deletion plus provider-required security retention | Email excluded from product analytics; auth provider audit only |
| Display name | Optional account presentation | `qelly_profiles` | Until changed or deleted | Not sent to analytics |
| Workspace membership | Tenant authorization | Postgres | Until membership/workspace/account deletion | Role counts only, no names |
| Saved calculation inputs/results | User-requested cloud synchronization | Postgres, opt-in only | Until record or account deletion | Never sent to analytics or general logs |
| Revision snapshots | Restore and audit history | Postgres | Until calculation/account deletion | Never sent to analytics |
| Sync operations | Idempotency and conflict handling | Postgres | Short operational retention, then deletion/aggregation | Operation type and error class only |
| Provider cache | Quota protection and freshness | Server-side cache/Postgres | TTL plus bounded stale window | Provider, capability, latency and status only |
| Feedback message | User support | Postgres or official issue fallback | Until resolved plus defined support retention | No financial inputs; redacted before diagnostics |
| Account deletion request | Fulfil deletion | Postgres | Until completion evidence and minimal legal record | Status only |
| Audit event | Security and authorization evidence | Postgres | Minimum required public-beta security window | No payloads, secrets, tokens or calculation data |
| Page/feature events | Privacy-preserving adoption measurement | Optional analytics | Aggregated short retention | Allowlisted event names, route category, release SHA and coarse device class only |

## User controls

- Anonymous deterministic use requires no account.
- Cloud synchronization is off until explicit authenticated opt-in.
- Users can export their cloud records in a versioned JSON package.
- Users can delete individual cloud records and request account data deletion.
- Local browser records are controlled by the user and are not uploaded without opt-in.

## Redaction

Logs and analytics must remove emails, tokens, cookies, authorization headers, Turnstile responses, calculation inputs/results, imported file content and provider secrets. Correlation IDs must not encode identity.

## Cookies

Only strictly necessary authentication/session and CSRF cookies may be used when cloud auth is activated. Privacy-preserving analytics remains disabled by default and must not require cross-site advertising identifiers.
