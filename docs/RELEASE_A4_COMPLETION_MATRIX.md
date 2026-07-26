# Release A4 Completion Matrix

## Frontend

| Capability | Status | Evidence |
|---|---|---|
| Existing application routes | Implemented local | 55 inherited routes retained |
| Public Account Recovery | Implemented local | `auth-recovery` route and recovery APIs |
| Platform Readiness | Implemented local | `platform-readiness` route and readiness API |
| Desktop/mobile screen evidence | Implemented local | 114/114 renders, zero console errors |
| Focused accessibility regression | Implemented local | 30/30 checks |
| Firefox/Safari/assistive-technology certification | Partial contract | Requires independent/device lab |
| Cloud staging deployment | Blocked by credentials | No cloud account or connector |

## Backend

| Capability | Status | Evidence |
|---|---|---|
| Account-recovery request/reset | Implemented local | Expiry, attempt limit, single use, audit |
| Password reset and session revocation | Implemented local | Transactional repository methods and tests |
| Outbound destination policy | Implemented local | HTTPS, allowlist, DNS and private-network denial |
| Secure-import quarantine | Implemented local | Scan-before-release and atomic rename |
| Platform readiness API | Implemented local | Consolidated dependency and safety state |
| PostgreSQL/Redis/MinIO live execution | Deployment-dependent | Adapters/topology exist; services unavailable here |
| Cloud KMS/HSM | Partial contract | Local AES-GCM protector retained |
| Full malware scanning provider | Partial contract | Foundation signature scanner only |
| External delivery sandbox | Blocked by credentials | No external endpoint/credential verification |
| Live trading/custody/transfers | Disabled for safety | Routes and enabling flags absent/false |

## Roadmap estimate

- Frontend Release A production-foundation scope: **88%**.
- Backend Release A production-foundation scope: **93%**.

These are dependency-roadmap estimates, not coverage or commercial-readiness percentages.
