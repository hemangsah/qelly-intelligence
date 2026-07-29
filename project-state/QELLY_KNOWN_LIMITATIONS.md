# Qelly Known Limitations

## Public/static application

- Static-preview values are deterministic demo records, not live provider observations.
- Authentication, persistence, external providers, workers and connected infrastructure are unavailable in the static preview.
- Some route shells are present before their backend or provider behavior is connected.
- A visual route or registry entry does not prove an implemented backend capability.

## Public-beta foundation

- Provider adapter interfaces exist, but no market, broker, exchange, bank or wallet provider is connected by this bootstrap.
- Observability events are defined and secret-redacted, but no production reporting sink is connected.
- Runtime configuration and feature flags are deterministic repository contracts; environment-specific production configuration remains external.
- Baseline API inventory includes source references that require executable verification before classification as connected.

## Deliberately excluded

- real-money trading;
- custody;
- deposits and withdrawals;
- private-key or seed-phrase storage;
- autonomous execution.

## Future gates

Prompt 2 must implement focused product foundations without weakening these truth boundaries. Prompt 3 must audit frontend, backend, databases, security, provider terms and public APIs before any connected public-beta release claim.
