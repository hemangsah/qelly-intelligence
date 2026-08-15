# Qelly Intelligence — Data Provider and External Integration Contract

Status: design + implementation gate
Review date: 2026-08-15

This document defines how Qelly decides whether a provider can appear as live, delayed, reference, demonstration, or unavailable. Technical connectivity alone is not authorization to display or redistribute data to end users.

## Current production provider policy observed in repository

`functions/_lib/providers.js` currently governs three providers:

- Binance — implementation exists for quote/candles, but production policy is disabled with `blocked_pending_redistribution_rights` / `provider_redistribution_rights_not_verified`.
- Coinbase — implementation exists for quote/candles, but production policy is disabled with `blocked_pending_written_end_user_display_permission` / `provider_end_user_display_rights_not_verified`.
- ECB — enabled for attributed FX reference rates and correctly treated as delayed/reference data rather than live tradable FX.

Therefore the presence of Binance/Coinbase HTTP/WebSocket endpoints in code must not make the production UI say `live` while their policy entries remain disabled.

## Provider approval model

Every provider integration has two independent gates:

1. Technical gate
   - official endpoint/widget exists
   - expected symbols/markets supported
   - authentication/key configured where required
   - timeout/retry/cache behavior implemented
   - schema validated
   - provider health observability present
   - production Cloudflare egress/CSP compatible

2. Usage-rights gate
   - public display / end-user display right established
   - attribution requirements implemented
   - redistribution/syndication restrictions understood
   - market/exchange entitlements accounted for
   - storage/cache restrictions understood
   - commercial/public-beta use permitted

Only when both gates pass can Qelly use `live-public` or `licensed-live` as a user-facing provider mode.

## Verified integration candidates

### TradingView Widgets — approved integration candidate

Official documentation states that TradingView provides ready-to-use financial widgets that can be embedded in websites and that the widgets include TradingView-provided data. The widget catalog includes Advanced Chart, ticker/market overview, technical analysis, economic calendar and other market surfaces. Data level can differ by market (real-time, delayed or end-of-day), so Qelly must surface the widget/provider's actual data level rather than globally label every TradingView surface live.

Design mode: `official-widget`.
Implementation: isolated responsive widget component with TradingView attribution preserved, loading/error fallback and tightly scoped CSP allowances for official TradingView widget origins.
Primary use: Advanced Chart, market overview, technical-analysis companion, economic calendar/research module where official widget configuration supports the desired market.
Official documentation:
- https://www.tradingview.com/widget-docs/
- https://www.tradingview.com/widget-docs/getting-started/
- https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/

### Forex Factory — outbound/export integration candidate, not an iframe/content-republication source

Forex Factory's current Calendar provides weekly export options including ICS, CSV, JSON and XML. Its Notices page also states that copying, republication or redistribution of its copyrighted content, including calendar schedules/specs, is prohibited without prior written consent.

Design mode by default: `official-deep-link` to Calendar plus optional user-initiated official export workflow after terms review. Do not scrape, republish or iframe around restrictions.
Official surfaces:
- https://www.forexfactory.com/en/calendar/
- https://www.forexfactory.com/notices

### Coinbase market-data transport — technically live, display-right gate still required by current Qelly policy

Official Coinbase Advanced Trade WebSocket documentation describes a publicly available market-data feed with real-time order/trade updates. Most market-data channels do not require authentication; documented channels include candles, ticker, level2 and market trades.

This satisfies a technical-live candidate gate. It does not automatically override Qelly's current repository policy requiring end-user display permission. Provider policy remains the source of truth until the usage-rights gate is deliberately changed with supporting evidence.
Official documentation:
- https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/websocket/websocket-overview
- https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/websocket/websocket-channels

### CoinGecko — commercially usable under plan/attribution constraints; redistribution/white-label requires appropriate license

CoinGecko's current API product material states that commercial Basic/Analyst/Lite/Pro usage requires prominent `Data provided by CoinGecko` attribution/linking and restricts selling/re-distributing/syndicating API access. It separately describes enterprise licensing for public-facing display, redistribution and white-label cases.

Design mode: `candidate-provider`, disabled until chosen plan/license and attribution contract are documented in Qelly provider policy.
Official references:
- https://www.coingecko.com/en/api
- https://www.coingecko.com/en/api/pricing
- https://www.coingecko.com/en/api/enterprise/data-license

### ECB — reference-rate source, not live trading FX

ECB euro foreign-exchange reference rates are normally published around 16:00 CET on working days and are explicitly reference/information rates. Qelly must label them `reference` / `daily-working-day-reference`, not live spot FX.
Official reference:
- https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html

### FRED — macro/research candidate with series-level rights caveat

FRED provides REST APIs for economic data and requires API-key use. FRED's API terms explicitly warn that some underlying series are third-party copyrighted and that API availability does not override those owners' restrictions. Qelly must approve series/source families individually rather than assume every FRED series can be republished publicly.

Design mode: `macro-reference-candidate`.
Official references:
- https://fred.stlouisfed.org/docs/api/fred/overview.html
- https://fred.stlouisfed.org/docs/api/terms_of_use.html

## Required provider registry fields

Each provider entry must expose at minimum:

```json
{
  "id": "provider-id",
  "enabled": false,
  "capabilities": [],
  "assetClasses": [],
  "providerMode": "unavailable",
  "displayRights": "unverified",
  "attributionRequired": false,
  "termsState": "pending_review",
  "termsUrl": "https://official-provider.example/terms",
  "transport": ["rest"],
  "freshnessSlaSeconds": null,
  "cacheTtlSeconds": null,
  "staleWindowSeconds": null,
  "reason": "rights_or_configuration_reason"
}
```

Runtime and frontend must consume this registry; they must not maintain independent provider-name/availability lists.

## Provider health envelope

Successful provider responses return:
- provider
- source identifier
- truth state
- observation time
- ingestion time
- freshness
- quality
- confidence
- attribution
- terms/license summary
- cache state
- data payload

Failure/degradation additionally returns:
- fallback reason
- retryable flag where appropriate
- last successful observation when safely available
- stale-cache metadata if used

## External integration modules

### Advanced chart module
Preferred first-party-in-Qelly analytical path remains Qelly's own normalized data/evidence layer. TradingView's official Advanced Chart widget can be added as a clearly identified external research/chart module because its widget includes its own provider data. It must not silently replace Qelly source metadata.

### Economic-calendar module
Preferred layers:
1. Qelly-normalized licensed/approved economic-event provider when available.
2. Official TradingView Economic Calendar widget if suitable for the route.
3. Forex Factory canonical external Calendar link/export entry.

Do not copy Forex Factory event schedules into Qelly without permission.

### Source-link module
Instrument, venue, macro, filing, news and provider pages should include canonical source links where useful. Links are contextual evidence actions, not a random link directory.

## CSP / security rules for embeds

- Allow only reviewed official origins.
- No wildcard frame/script allowances solely to make a widget load.
- Use explicit `script-src`, `frame-src`, `connect-src`, `img-src` additions per integration.
- Keep external attribution intact.
- Bound widgets in Qelly-controlled layout containers.
- Provide no-JS/loading/error fallback and external canonical link.
- Never proxy a provider solely to bypass its frame or origin restrictions.

## Live-data rollout sequence

1. Audit current production endpoints and runtime config.
2. Establish at least one legally/permissibly displayable live or near-real-time market provider.
3. Implement provider adapter + caching + observability.
4. Expose capability through the single governed provider registry.
5. Make Live Markets default to the permitted provider only when healthy.
6. Retain demonstration provider as explicit opt-in/demo/fallback, not the apparent production default.
7. Add TradingView official modules as complementary external research/chart surfaces.
8. Add macro/reference providers with truthful cadence labels.
9. Run exact-origin authenticated browser tests and timestamp/freshness checks.
10. Capture desktop/mobile evidence showing provider name, mode, timestamp and degradation behavior.

## Acceptance rule

Qelly is allowed to say `Live` only when the currently selected source is technically receiving current observations and the provider policy authorizes that end-user display. If either condition is false, the UI must use the precise alternative: delayed, reference, cached, stale, demonstration, degraded or unavailable.