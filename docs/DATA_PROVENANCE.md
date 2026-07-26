# Data Provenance

Every normalized public-market observation includes:

- canonical Qelly instrument ID;
- provider and provider display name;
- provider symbol;
- source URL where permitted;
- observation time;
- ingestion time;
- freshness;
- quality state;
- confidence;
- cache state;
- entitlement state;
- degraded flag and fallback reason.

Market capitalization remains unavailable when the chosen exchange ticker does not provide a defensible supply-backed value. Qelly does not substitute zero or fabricate a number.

Deterministic fixtures are test/development fallbacks and are labelled `simulated`. Provider observations are labelled `live-public` only after a successful documented public endpoint response.
