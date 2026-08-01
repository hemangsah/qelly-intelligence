# Qelly Prompt 2C Mandatory Release Gates

A deployment is not a verified global public beta until every applicable gate passes on one frozen exact head.

1. Exact release head matches the deployed source and artifact manifest.
2. Prompt 2B PR #23 remains open, draft and unmodified by Prompt 2C source commits.
3. Deterministic formula, indicator and saved-local results remain unchanged.
4. Unit, migration-contract, security, browser and accessibility checks pass without denominator reduction or retries that hide defects.
5. Fresh Postgres initialization, forward migration and rollback rehearsal pass.
6. Authentication sign-up, verification, sign-in, sign-out, expiry and recovery pass when cloud auth is activated.
7. Cross-user read, insert, update and delete attempts are denied by RLS.
8. Cloud sync proves explicit opt-in, upload, download, offline queue, conflict handling and resumed synchronization without data loss.
9. Provider responses prove official public read-only or normally authorized use and expose provenance, observation time, ingestion time, freshness, confidence, attribution, license and fallback.
10. No provider is labelled live because a mock, fixture or API contract exists.
11. CSP, HSTS where supported, referrer policy, permissions policy, frame denial, MIME protection, CORS and CSRF tests pass.
12. Malicious JSON, CSV injection, oversized import, extension mismatch, prototype pollution and unsafe URL fixtures are rejected.
13. Turnstile is validated server-side for protected public writes when activated; deterministic read-only tools remain accessible when it is unavailable.
14. No secret is committed, bundled into the browser, rendered in logs or exposed through diagnostics.
15. Privacy inventory, retention, account export and deletion journeys are implemented and truthfully described.
16. Terms, privacy, beta and financial-risk disclosures contain no guaranteed return, fiduciary, regulated-advice or provider-guarantee claim.
17. Mobile critical routes have no overflow, hidden controls, broken navigation or inaccessible dialog state.
18. New auth, sync, provider, quota and offline states have no critical accessibility blocker.
19. Performance budgets pass without hiding content or removing methodology/evidence.
20. Sitemap, robots, canonical and Open Graph metadata are correct; private state is not indexed.
21. Free-tier utilization is below stop-write thresholds and no payment method, paid plan, add-on or billable overage is enabled.
22. Rollback to the last accepted release is rehearsed and documented.
23. The public HTTPS URL is opened externally and critical routes return the expected application.
24. LinkedIn claims match the verified public URL and evidence; publication occurs only through official authenticated capability.
