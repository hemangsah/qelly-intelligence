# ADR-026: Versioned secret protection and assurance drills

## Decision
Use versioned AES-256-GCM envelopes with a server-configured keyring and explicit governed rewrap. Keep quarantine objects unreleased until a scanner approves them. Represent staging as an executable topology contract while refusing to claim deployment without external evidence.

## Consequences
Legacy envelopes remain readable, browser key material is prohibited, and KMS/ClamAV/cloud integration stays partial until executed in staging.
