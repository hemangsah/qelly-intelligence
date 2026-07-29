# Qelly Release Matrix

| Capability | Local | Test | Preview | Staging | Public GitHub Pages |
|---|---|---|---|---|---|
| Approved visual foundation | enabled | enabled | enabled | enabled | verified at exact merge commit |
| Static deterministic preview | enabled | enabled | enabled | optional | enabled and truth-labelled |
| Truth/evidence metadata | enabled | enabled | enabled | enabled | foundation only |
| Runtime safety validation | enabled | enabled | enabled | enabled | required |
| Provider adapter interface | enabled | enabled | enabled | enabled | interface only |
| Connected providers | unavailable | mocked only | unavailable | planned | unavailable |
| Read-only account connections | unavailable | mocked only | unavailable | planned | unavailable |
| Paper trading | unavailable | planned | unavailable | planned | unavailable |
| Real-money execution | disabled | disabled | disabled | disabled | disabled |
| Custody/deposits/withdrawals | disabled | disabled | disabled | disabled | disabled |
| Private keys/seed phrases | prohibited | prohibited | prohibited | prohibited | prohibited |

Promotion requires exact-commit validation, secret scan, dependency audit, browser matrix, accessibility, source/freshness truth, rollback evidence and deployment verification. The Pages deployment is not a connected production release.
