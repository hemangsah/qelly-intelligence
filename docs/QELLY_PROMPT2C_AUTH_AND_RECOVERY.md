# Qelly Prompt 2C Authentication, Verification and Recovery

## Provider

Supabase Auth is the preferred Free public-beta identity provider after normal dashboard authorization. Qelly does not implement a custom password database and does not place service-role credentials in the browser.

## Anonymous journey

A visitor can use deterministic calculators, formula/indicator libraries and local saved calculations without signing in. Anonymous use must not create a cloud identity silently.

## Sign-up and verification

1. User chooses Create account.
2. UI explains what is stored and that cloud sync is optional.
3. Auth provider creates the account and sends verification through its supported channel.
4. Redirect destination is exact-allowlisted.
5. Unverified accounts cannot perform protected cloud writes.
6. Errors never reveal whether another person's email exists beyond the auth provider's safe response.

## Sign-in and session

Secure provider-managed sessions are refreshed through the official SDK or server exchange. Cookies are Secure, HttpOnly where server-managed, SameSite=Lax or stricter and scoped to the minimum path/domain. CSRF proof is required for state-changing cookie-authenticated requests.

## Recovery

Recovery is single-use, time-limited and provider-managed. Redirects are allowlisted. Recovery tokens are never logged, placed in analytics or persisted in Git. After successful recovery, old sessions are revoked when supported.

## Sign-out and revocation

Sign-out clears local session state and calls the provider revocation path. Expired, revoked and malformed sessions fail closed while anonymous deterministic mode remains usable.

## Account export and deletion

Authenticated users can export profiles, workspace membership, saved calculations, revisions and pending sync operations. Account deletion first disables cloud writes, exports when requested, deletes user-owned records through database cascades/service workflow, removes storage objects and requests identity deletion. Completion is recorded without retaining financial payloads.

## Required activation evidence

Real activation remains `EXTERNAL_AUTHORIZATION_REQUIRED` until email verification, sign-in, sign-out, refresh, expiry, revocation, recovery, account export and deletion pass against the authorized project and cross-user RLS tests prove isolation.
