# Part 21 Onboarding, Automation, Attribution and Research History

## Architecture boundaries

Part 21 introduces seven independent service boundaries:

1. `OnboardingStore` — scoped profile, revision and completion state.
2. `NotificationScheduleStore` — schedule CRUD and deterministic due calculation.
3. Formula engine — tokenizer, parser and evaluator for bounded arithmetic only.
4. Portfolio attribution — deterministic contribution decomposition over model holdings.
5. `ImportService` — templates, validation and audited staging batches.
6. `ResearchVersionStore` — immutable snapshots, diffs and restore references.
7. `MigrationPlanService` — target architecture and operational gates without execution.

Each persistent service uses the inherited atomic local persistence foundation and user/tenant/workspace scope. Governed mutations use session-bound CSRF, authorization, runtime schema validation, idempotency and audit evidence.

## Onboarding decisions

Onboarding stores preferences and workspace intent, not credentials. Provider interests are descriptive only. Completing onboarding does not create production tenants, subscribe to data, connect a broker, provision infrastructure or initiate financial activity.

## Scheduling decisions

Schedules define `kind`, cadence, timezone, local time and next-run evidence. The runtime intentionally has no autonomous worker. An explicit API call evaluates due schedules and creates deterministic in-app notifications. This keeps the package testable and prevents false claims of reliable background delivery.

## Formula safety

The formula engine does not use `eval`, `Function`, dynamic imports or arbitrary property access. It accepts numeric literals, approved identifiers, arithmetic operators, parentheses and a small function catalogue. Expressions are parsed to an internal syntax tree and evaluated against normalized screener rows.

## Attribution decisions

Attribution reports holding, asset-class and sector contribution and reconciles rounded holding contributions to the total. The implementation is educational deterministic evidence; it does not process transaction lots, fees, taxes, currency effects, corporate-action restatements or broker statements.

## Import decisions

CSV content is supplied as bounded text, validated against per-kind templates and stored as a local staged batch. A staged batch is evidence for a later production import architecture. It does not mutate operational watchlists, portfolios or research records.

## Research-history decisions

Snapshots capture the complete scoped research workspace. Diffs compare stable item identifiers. Restore is idempotent and audited inside one mutation boundary. Collaborative merges, branching, conflict resolution and object-storage snapshots remain future production work.
