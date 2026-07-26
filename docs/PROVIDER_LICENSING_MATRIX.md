# Provider and licensing summary

Canonical current inventories:

- [`../QELLY_PROVIDER_MATRIX.csv`](../QELLY_PROVIDER_MATRIX.csv)
- [`../QELLY_LICENSING_MATRIX.csv`](../QELLY_LICENSING_MATRIX.csv)

The table below records repository integration intent only. It is not evidence that current commercial terms, attribution, caching, redistribution, derived-data, websocket, historical, or geographic rights were verified.

| Provider | Launch use | Authentication | Current implementation | Production boundary |
|---|---|---|---|---|
| Binance public market data | Read-only 24h ticker and candles | None in the current adapter | Adapter and normalized public launch responses | Disabled by default; current official policy, terms, attribution, caching, redistribution, and geography require review |
| CoinDCX public market data | Read-only candles fallback | None in the current adapter | Existing candle adapter | Disabled by default; current official policy, terms, attribution, caching, redistribution, and geography require review |
| Qelly deterministic fixture | Tests and degraded/offline fallback | None | Implemented | Always labelled simulated; never shown as live |
| TradingView Lightweight Charts | Chart rendering option | Library licensing/attribution applies | Provider-agnostic chart architecture and local fallback | Do not redistribute Advanced Charts without a licence |
| Investing.com | None | N/A | Not integrated | No scraping; only officially permitted widgets/licensed integration |

Credentials, when later required, remain server-side and are never embedded in frontend code. CoinGlass and CoinMarketCap are design/capability references only and are not Qelly data providers.
