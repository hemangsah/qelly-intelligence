# Qelly Release Matrix

| Capability | Local | Test | Preview | Staging | Production/public beta |
|---|---|---|---|---|---|
| Approved visual foundation | enabled | enabled | enabled | enabled | enabled after verified deployment |
| Deterministic static preview | enabled | enabled | enabled | optional | truthful demo only |
| Truth/evidence metadata | enabled | enabled | enabled | enabled | required |
| Runtime safety validation | enabled | enabled | enabled | enabled | required |
| Provider adapter interface | enabled | enabled | enabled | enabled | interface only |
| Connected providers | unavailable | mocked only | unavailable | planned | blocked pending authorization/terms |
| Read-only account connections | unavailable | mocked only | unavailable | planned | blocked pending authorization |
| Paper trading | unavailable | planned | unavailable | planned | Prompt 2 scope |
| Real-money execution | disabled | disabled | disabled | disabled | disabled |
| Custody/deposits/withdrawals | disabled | disabled | disabled | disabled | disabled |
| Private keys/seed phrases | prohibited | prohibited | prohibited | prohibited | prohibited |

## Promotion gates

A target environment cannot be promoted unless configuration validation, tests, secret scan, dependency audit, browser matrix, accessibility, source/freshness truth, rollback procedure and deployment verification pass for the exact release commit.
