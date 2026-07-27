# Qelly official-reference browser forensics

Date: 2026-07-27
Scope: Phase 0 visual reset for draft PR #11.

## Method and evidence boundary

The audit inspected current official public pages for CoinGlass, CoinMarketCap, and WorldQuant in a browser-oriented retrieval environment. Visible structure, hierarchy, navigation, content density, interaction affordances, and responsive patterns were recorded. The inspection environment did not expose a full DevTools protocol for every page, and several pages apply bot protection, client-side hydration, geolocation, or consent overlays. Exact proprietary fonts, private APIs, hidden datasets, and blocked computed values are therefore **not guessed**.

Official pages reviewed:

- CoinGlass: home, Liquidations, Liquidation Heatmap, Bitcoin options open interest, options volume, and Crypto API.
- CoinMarketCap: home, coins, trending, categories, exchange rankings, Bitcoin, global charts, and recently added.
- WorldQuant: home, How We Work, Who We Are, Ideas, and Careers.

## CoinGlass observations

### Visible patterns

- Derivatives categories are first-class navigation, not secondary analytics.
- Tables, heatmaps, tapes, and compact controls carry more visual weight than ornamental cards.
- OI, funding, liquidations, long/short, basis, options, and venue comparisons are grouped around the decision task.
- Dense toolbars use timeframe, asset, venue, threshold, and methodology controls close to the data.
- Color is functional: positive/negative, intensity, and risk—not a full-canvas brand wash.

### Qelly interpretation

Qelly adopts derivatives **density and task adjacency**, not CoinGlass layout, data, chart skin, API, wording, or trade dress. Asset Rankings therefore surfaces OI, funding, OI change, liquidation, volatility, source, freshness, confidence, and Explain This Move within the primary table.

## CoinMarketCap observations

### Visible patterns

- Discovery breadth is immediately legible through rankings, tabs, category filters, trending views, leaderboards, exchange views, search, and column controls.
- The ranking table is the main product surface and remains close to the initial viewport.
- Asset identity, price, percent changes, market cap, volume, supply, and sparklines are scanned horizontally.
- Mobile uses prioritized rows and progressive disclosure rather than reproducing the full desktop table.

### Qelly interpretation

Qelly adopts **discovery breadth, scanability, and table primacy**, while adding derivatives context, confidence, freshness, provider disagreement, and provenance actions. It does not copy CoinMarketCap branding, layout measurements, icons, data, copy, or proprietary ranking methodology.

## WorldQuant observations

### Visible patterns

- Public pages use restrained editorial composition, large statements, strong whitespace, deliberate pacing, and limited ornament.
- Brand sophistication comes from typography, sequencing, contrast, and motion rather than repeated dashboard cards.
- Research and ideas are presented as serious editorial material, with calm hierarchy and selective cinematic moments.

### Qelly interpretation

Qelly adopts **editorial restraint and narrative confidence** for public/research modes. Analytical routes remain compact and functional; cinematic behavior is not loaded into terminal workspaces.

## Synthesis

The original Qelly solution combines:

1. CoinMarketCap-level discovery breadth and ranking-table primacy.
2. CoinGlass-level derivatives context and control density.
3. WorldQuant-level editorial restraint and motion discipline.
4. Qelly-specific truth state, confidence, freshness, evidence, Explain This Move, and Decision Provenance.

## Legal and originality boundary

Qelly does not reproduce logos, brand names inside the product UI, proprietary artwork, exact CSS, exact animation sequences, private APIs, restricted datasets, slogans, chart skins, or trade dress. Every reference pattern is translated into a distinct Qelly composition with stronger accessibility and provenance disclosure.
