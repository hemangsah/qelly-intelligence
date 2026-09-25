# QELLY Wave BO — Failure Injection Validation

Release base: `0b12eed92233f45cd668b8e78f19059972d59986`

## Purpose

Wave BO verifies that QELLY fails closed or degrades explicitly when real dependencies fail. This is a test-only fault-injection wave. It does **not** add a production chaos switch, alternate provider substitution, synthetic evidence, or hidden BUY/SELL fallback.

## Failure matrix

| Injected condition | Expected QELLY behavior | Scientific / reliability boundary |
| --- | --- | --- |
| Critical Hyperliquid candle timeout | Structured `provider_timeout` / 503; no Decision fabricated from missing candles | Core price history is mandatory |
| Optional benchmark candle timeout | Return `null`; no fake cross-asset evidence | Optional context may disappear, never substitute another provider |
| Derivatives timeout | `state=unavailable`; no funding/OI values fabricated | Risk context only |
| L2 liquidity timeout | `state=unavailable`; spread/imbalance remain unavailable | No synthetic order book |
| Funding-history timeout | Empty bounded history | Current derivatives context is not backfilled |
| Partial MTF timeout | Keep only fulfilled observed timeframes | Missing timeframe is not inferred |
| GDELT failure with bounded stale cache | Explicit `state=stale`, `cache.stale=true` | Stale contextual news is never relabeled fresh |
| ECB/macro failure | Explicit unavailable reference context | No DXY/yield/risk-regime proxy is manufactured |
| Supabase/database slowdown | Bounded retryable `supabase_timeout` | Public Decision/scanner do not block on database persistence |
| Scanner single-asset provider failure | Keep other verified assets; report failed asset separately | Failed asset never becomes a candidate |
| TradingView iframe timeout | Explicit unavailable fallback + retry/external link | No substitute/fabricated widget values |

## Expected user-visible behavior

- Critical market-data failure fails closed rather than producing a directional Decision.
- Optional evidence failure is labeled unavailable/stale according to its existing provider policy.
- Scanner partial failure preserves the remaining verified candidate set and exposes the unavailable asset count.
- TradingView failure stays display-only and does not affect QELLY calculations.
- Retry/freshness messaging remains explicit.
- No failure path converts unavailable evidence into fresh evidence.

## Tests

Focused suite: `tests/qelly-scientific-wave-bo-failure-injection.test.mjs`

The focused suite uses existing injection seams:
- provider `fetchImpl` functions;
- scanner `build` callback;
- Supabase `env.__fetch`;
- a minimal fake DOM for the official TradingView timeout path.

No production endpoint accepts a query parameter, header, cookie, or user control that enables these injected failures.

## Boundaries

This wave validates failure handling, not trading performance. It does not create target-touch observations, calibration samples, R:R performance data, MFE/MAE outcome evidence, or NO TRADE outcome labels.
