# Qelly External Dependency Register

| Dependency | Purpose | Current state | Authentication | Licensing/terms | Release boundary |
|---|---|---|---|---|---|
| GitHub | Repository, Actions, tags and artifacts | Connected through authorized GitHub integration | OAuth/GitHub App | GitHub service terms | Repository operations only |
| GitHub Pages | Static frontend hosting | Connected and verified for exact merge commit | Repository configuration | GitHub Pages terms | Static/read-only visual preview only |
| IBM Plex Sans Variable | Canonical local product font | Implemented and governed | none | bundled licence evidence | Approved; binaries excluded from downloadable review ZIPs |
| Playwright browsers | Browser validation | CI/test dependency | none | package/browser licences | Validation only |
| External market providers | Future read-only data | Not connected | provider-specific | current official terms required | Cannot be called live |
| Broker/exchange/wallet APIs | Future read-only connections | Not connected | official OAuth/API/wallet flow | jurisdiction and terms review required | Trading scopes disabled |
| Error-reporting service | Future observability sink | Not connected | service credential | retention and terms review required | Local redacted interface only |

No unofficial source may become a hidden core production dependency. No production secret is stored in repository or review artifacts.
