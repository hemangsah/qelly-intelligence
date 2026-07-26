# ADR-024: Identity assurance, object storage and delivery adapters

Use adapter boundaries and local deterministic implementations for TOTP, object storage and outbound delivery. Do not claim external providers without credentials. Store only hashes for recovery codes in production repositories. Keep live financial actions absent.
