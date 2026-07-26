# Part 19 Advanced Asset Intelligence Decisions

## Service boundaries

Part 19 adds `AdvancedAssetService` rather than extending the original Wave 6 service indefinitely. The service owns deterministic chart data, advanced studies, statements, earnings, estimates, corporate actions, filing documents, event calendars and comparison analytics.

`ChartLayoutStore` separately owns governed user/workspace chart state. It uses the inherited atomic JSON store, local file lock, audit ledger and idempotency boundary.

## Chart model

The chart response includes OHLCV bars, study arrays, pane metadata, capability flags and source metadata. Six studies are executable locally: SMA, EMA, Bollinger Bands, MACD, ATR and Stochastic. Candlestick, volume, multi-pane and comparison contracts are implemented. Drawings, replay, intraday/tick data and real-time provider streams remain deferred.

## Financial model

Annual and quarterly records preserve period and currency. Derived margins and revenue growth are calculated locally. Earnings actuals, consensus values, surprise percentages, estimate ranges and revision breadth are fixture evidence. These are not licensed statements or analyst feeds.

## Filing model

Filing index records lead to filing detail records. Each section has a stable citation identifier, source locator and retrieval timestamp. Original documents and live regulatory ingestion are absent. Client-side section filtering demonstrates workspace interaction without claiming semantic retrieval.

## Event and comparison model

Events support date-range and event-type filters. Comparison series are normalized to 100 at their first included point. Snapshot valuation fields are omitted for unsupported asset classes rather than coerced into misleading values.

## Safety

No Part 19 route performs an order, transfer, withdrawal, broker call, exchange call, wallet connection or key operation. All new data surfaces declare fixture and non-tradable boundaries.
