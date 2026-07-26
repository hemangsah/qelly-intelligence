# Part 22 — Sovereign Brand and Live Market Architecture

## Permanent brand lock

Qelly Intelligence permanently retains the deepest-burgundy signature gradient:

`#080003 → #180008 → #310011 → #5B0828 → #8E1D4B`

It is used for global chrome, major page heroes, active navigation identity, primary actions and branded motion. White and porcelain are the primary analytical content islands. Persona themes can change density, motion, dark/light canvas balance and accent emphasis, but they cannot replace the gradient or financial semantic colors.

## Persona taxonomy

| Persona | Purpose | Density | Motion |
|---|---|---:|---:|
| Scalper Velocity | Live scanning, alerts, fast tape reading | Compact | Energetic |
| Investor Compound | Fundamentals, portfolio and long-horizon work | Spacious | Calm |
| Aggressive Alpha | Momentum, catalysts and volatility | Compact | High energy |
| Quant Operator | Data grids, formulas and operations | Dense | Precise |
| Research Oracle | Filings, research and comparative analysis | Spacious | Deliberate |
| Signal Access | High legibility and reduced motion | Standard | Minimal |

## Typography and polarity

- Display: Manrope/Avenir Next/SF Pro Display-style rounded geometric stack.
- Body: Plus Jakarta Sans/Manrope/Avenir Next-style stack.
- Data: JetBrains Mono/IBM Plex Mono-style stack.
- Light text is restricted to burgundy, graphite and midnight surfaces.
- Dark text is used on white, porcelain and soft-rose surfaces.
- Tabular numerals are used for price, percentage and volume information.

The package does not redistribute font files. It uses system-safe fallbacks when named fonts are unavailable.

## Motion system

Motion communicates hierarchy rather than decorating every object:

- progressive route and panel reveal;
- magnetic pointer response on primary controls;
- bounded card tilt and pointer glow;
- button ripple and shimmer;
- route transition blur/reveal;
- scroll progress;
- chart line/candle animation;
- contextual drawer spring motion;
- complete reduced-motion fallback.

## Live chart architecture

The Live Market Command route supports a TradingView Lightweight Charts-compatible adapter for candlestick, volume and SMA layers. If the optional external chart script is unavailable, Qelly renders a local SVG candlestick fallback.

Read-only provider adapters:

- Binance public candles and browser WebSocket kline stream;
- CoinDCX public candles and socket integration contract;
- Qelly deterministic fallback for offline operation or provider failure.

The architecture does not expose private account endpoints, API secrets, order creation, transfers or withdrawals. TradingView Advanced Charts is not redistributed. Investing.com is not scraped; only an optional embeddable-widget contract is documented.

## Product truth boundary

The visual redesign is complete across all packaged routes and themes, but production identity, licensed data, regulated execution, custody, broker connectivity and provider commercial agreements remain separate gated programs.
