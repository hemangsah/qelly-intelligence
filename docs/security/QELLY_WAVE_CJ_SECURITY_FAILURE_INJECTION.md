# QELLY Wave CJ — Security & Failure Injection

## Scope

This wave closes the Post-PR423 Decision Intelligence security/failure-injection acceptance surface without changing market-provider coverage, model logic, or trade eligibility.

## Failure-injection matrix

| Case | Control / evidence | Expected state |
| --- | --- | --- |
| News timeout/provider failure | Existing Wave BO bounded stale-cache test | No crash; stale is labeled stale; no fabricated freshness |
| Macro timeout | Existing Wave BO macro degradation test | UNAVAILABLE reference context; no inferred series |
| Asset provider down | Existing critical candle/provider timeout test | Fail closed with explicit provider error |
| Liquidity unavailable | Existing Wave BO optional liquidity degradation test | UNAVAILABLE/PARTIAL; no substitute values |
| Range query aborted | Decision range request controller/request-id supersession | Old response cannot overwrite newer range state |
| Scanner partial failure | Existing Wave BO partial scanner test | Failed asset excluded; no fabricated valid setup |

## Security matrix

| Case | Control / evidence |
| --- | --- |
| Malicious headline HTML / XSS | All Decision headline/timeline fields are rendered through `escapeHtml`; Browser E2E uses an `<img onerror>` fixture |
| Invalid symbol | Decision asset capability allowlist rejects before provider fetch |
| Oversized range | Selection/range endpoints reject >90-day windows before provider fetch |
| SSRF-shaped asset input | Asset allowlist rejects URL/path-shaped symbols before provider fetch |
| Rate abuse | Decision graph, range evidence, and scanner retain explicit per-IP rate limits |
| Embed origin | TradingView outbound/fallback URLs are restricted to HTTPS `www.tradingview.com` |
| CSP | Existing `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`; no `unsafe-eval` |

## Boundaries

- This wave does not claim immunity from all web attacks.
- TradingView remains a display-only external provider; QELLY does not read widget values into Decision Intelligence.
- Existing Supabase leaked-password-protection status remains an external/manual control and is not fabricated as fixed in code.
- Failure injection must degrade explicitly and must never manufacture provider observations, headlines, liquidity, trades, or probabilities.
