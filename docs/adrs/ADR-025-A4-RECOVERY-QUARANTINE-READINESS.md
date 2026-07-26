# ADR-025 - Account Recovery, Quarantine and Outbound Network Policy

## Decision
Use hashed, expiring and single-use account-recovery challenges; revoke all sessions after a successful reset; require HTTPS and explicit destination policy for outbound adapters; quarantine local imports until scanning succeeds; expose a consolidated readiness view.

## Rationale
These controls close dependency-critical production-foundation gaps without enabling custody or financial execution.

## Consequences
External delivery requires explicit allowlisting. Production storage must integrate a full malware scanner. Recovery delivery still depends on a configured provider.
