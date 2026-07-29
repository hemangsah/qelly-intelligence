# Qelly Public Beta Bootstrap

Branch: `release/qelly-public-beta-v1`
Base foundation: `94fbd4ff91c0d61f87e42724038f03fa5c36f97a`

## Scope

This draft establishes reusable public-beta foundations only:

- durable project-state and handoff records;
- repository-grounded route and API inventories;
- local/test/preview/staging/production environment model;
- governed feature flags and hard safety boundaries;
- canonical truth-state and evidence metadata schemas;
- provider adapter interface;
- observability and error-event interfaces with secret redaction;
- runtime configuration validation;
- design-foundation freeze and automated governance tests;
- architecture decisions, dependency graph, migration and rollback structure;
- truthful beta-readiness dashboard.

## Excluded

This PR does not implement Prompt 2’s marketplace, calculators, indicators, paper trader, provider connections or mega-quant modules. It does not enable live trading, custody, deposits, withdrawals, private keys, seed phrases or autonomous execution.

## Review gates

The branch must pass complete repository CI, brand/typography/theme governance, public-beta contract tests, generated inventory reproducibility, secret scan, dependency audit and release checks. It remains draft until reviewed.

## Next dependency-ordered action

After Prompt 1 is durably complete, re-read the master execution pack and execute Prompt 2 only, beginning with the repository-grounded feature-gap audit and focused child-PR architecture.
