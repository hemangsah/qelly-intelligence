# Qelly Final Immediate External Authorization

Recorded: 2026-08-01 18:52 Asia/Kolkata

## Status

`CLOUDFLARE_PAGES_OFFICIAL_AUTHORIZATION_REQUIRED`

The Cloudflare integration is installed at the account level, but no Cloudflare Pages project/deployment action is exposed to the current official tool runtime. The Wrangler executable is unavailable, package installation is unavailable, and the runtime has no outbound DNS. No API token, password, raw OAuth token or other secret is requested.

## One normal action

Authorize or reconnect Cloudflare through its normal official OAuth/dashboard flow so that Cloudflare Pages project and deployment actions are exposed. The target must remain a Free Pages project, without a purchased domain, payment method or paid overage.

After the connection is visible, continue in this exact order:

1. create or connect a Qelly-branded Pages Free project;
2. use `release/qelly-global-public-beta` as the production branch;
3. deploy exact accepted release SHA `603cece3091dc59cfb72680914e7056b40058022` unless a newer separately validated release head is frozen;
4. verify the truthful `pages.dev` hostname and HTTPS;
5. require public `qelly-release.json` to report the exact deployed SHA;
6. configure the final URL in Supabase Auth redirects;
7. run signup, email verification, login, logout, recovery and refresh;
8. repeat RLS and cloud lifecycle through two real browser identities;
9. verify Binance, Coinbase Exchange and ECB adapters from the deployed environment;
10. verify security headers, accessibility, performance, SEO, PWA and rollback;
11. update the LinkedIn package with the verified URL and publish only through official authenticated publishing capability.

GitHub Pages remains a continuity fallback. PR #23 and PR #25 remain open, draft and unmerged; main is unchanged.
