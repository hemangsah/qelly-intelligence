# Qelly External Dependency Register

| Dependency | Purpose | Current state | Authentication | Licensing/terms | Release boundary |
|---|---|---|---|---|---|
| GitHub | Repository, Actions and review artifacts | Connected through user-authorized connector | OAuth/GitHub App | GitHub service terms | Repository operations only |
| GitHub Pages | Static frontend hosting | Pending exact post-merge verification | Repository configuration | GitHub Pages terms | Static/read-only truth label |
| IBM Plex Sans Variable | Canonical local product font | Implemented and governed | none | bundled licence evidence | Approved; no binary redistribution in review ZIPs |
| Playwright browsers | Browser validation | CI/test dependency | none | package/browser licences | Test and evidence only |
| External market providers | Future read-only data | Not connected | provider-specific | must be verified at implementation time | Cannot be called live |
| Broker/exchange/wallet APIs | Future read-only connections | Not connected | official OAuth/API/wallet flow | jurisdiction and terms review required | Trading scopes disabled |
| Error-reporting service | Future observability sink | Not connected | service credential | terms and retention review required | Local redacted interface only |

## Rules

- No unofficial or reverse-engineered source may become a hidden core production dependency.
- No scraping may bypass venue terms or licensed redistribution.
- Production secrets remain outside repository and review artifacts.
- Every external dependency requires owner, version, terms date, quota, failure behavior and rollback evidence before release.
