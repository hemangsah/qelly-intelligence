# Provider and licensing summary

The authoritative operational matrix is [`DATA_SOURCES.md`](DATA_SOURCES.md). Canonical generated inventories are:

- [`governance/QELLY_PROVIDER_MATRIX.csv`](governance/QELLY_PROVIDER_MATRIX.csv)
- [`governance/QELLY_LICENSING_MATRIX.csv`](governance/QELLY_LICENSING_MATRIX.csv)

This file is retained as a compatibility pointer for older handoffs. The generated CSVs record integration intent; they are not evidence that current commercial terms, attribution, caching, redistribution, derived-data, websocket, historical or geographic rights were verified.

| Provider | Launch use | Authentication | Current implementation | Production boundary |
|---|---|---|---|---|
| Alternative.me | Public crypto reference and Fear & Greed | None | Enabled in Pages Function | Required attribution; bounded cache |
| Hyperliquid | Public mid-price reference | None | Enabled in Pages Function | Read-only documented endpoint; no execution |
| World Bank | Annual GDP-growth reference | None | Enabled in Pages Function | Delayed macro reference, not a live market feed |
| ECB | Daily FX reference rates | None | Enabled and governed | Attributed reference use; not an executable price series |
| Binance | Quote/candle adapter | None | Policy-blocked | Enable only after redistribution rights are verified |
| Coinbase | Quote/candle adapter | None | Policy-blocked | Enable only after written end-user-display permission is verified |
| TradingView | Human-readable display and outbound research | Public widget/link boundary | Display only | Widget values are not ingested or persisted as Qelly data |
| Qelly deterministic fixtures | Tests and local demonstrations | None | Local-only | Always labelled simulated; never shown as live |

Credentials, when later required, remain server-side and are never embedded in frontend code. CoinGlass, CoinMarketCap and the other research destinations in `DATA_SOURCES.md` are links, not Qelly data providers.
