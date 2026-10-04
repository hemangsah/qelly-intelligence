# Wave DK — immutable action completion and coupled CodeQL updates

Fresh inventory found moving `actions/checkout@v4` references in database and Design Activation dispatch jobs, and `actions/download-artifact@v4` in production restoration. Pin these to the official current v4 commits without changing their major versions.

Dependabot PR #513 changes only CodeQL initialization. Its required security run 37193120392 failed: `Loaded a configuration file for version '4.38.2', but running version '4.37.9'`. Update initialization and analysis together to official release commit `2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2` (v4.38.2). The annotated official tag was dereferenced through the authenticated GitHub API.

Regression checks scan all workflow action references, including optional/dispatch jobs, and require identical immutable CodeQL initialization/analysis revisions. Dependabot groups the CodeQL action family so future version updates remain coupled; see [GitHub's groups reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#groups).

All eleven required exact-head checks, mandatory Browser E2E, production workflow verification, runtime convergence and release-identity synchronization remain required. A successful local source check does not prove dispatch-only operations or external production restoration.
