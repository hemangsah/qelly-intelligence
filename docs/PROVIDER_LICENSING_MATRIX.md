# Provider and Licensing Matrix

| Provider | Launch use | Authentication | Current implementation | Production boundary |
|---|---|---|---|---|
| Binance public market data | Read-only 24h ticker and candles | None for documented public market endpoints | Adapter and normalized public launch responses | Respect rate limits, attribution and applicable terms |
| CoinDCX public market data | Read-only candles fallback | None for documented public candle endpoint | Existing candle adapter | Respect interval, limit and attribution requirements |
| Qelly deterministic fixture | Tests and degraded/offline fallback | None | Implemented | Always labelled simulated; never shown as live |
| TradingView Lightweight Charts | Chart rendering option | Library licensing/attribution applies | Provider-agnostic chart architecture and local fallback | Do not redistribute Advanced Charts without a licence |
| Investing.com | None | N/A | Not integrated | No scraping; only officially permitted widgets/licensed integration |

Credentials, when later required, remain server-side and are never embedded in frontend code.
