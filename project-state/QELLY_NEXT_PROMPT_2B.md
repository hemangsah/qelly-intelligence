# QELLY PROMPT 2B — CALCULATOR AND INDICATOR FOUNDATION

Read the complete Qelly Master Chat Continuity Handoff, the merged Prompt 2A audit records, `project-state/QELLY_CURRENT_HANDOFF.md`, `project-state/QELLY_PROMPT2B_STARTING_STATE.md`, `project-state/QELLY_FORMULA_CATALOG.csv`, `project-state/QELLY_DEPENDENCY_GRAPH.json`, `project-state/QELLY_SECURITY_RISK_REGISTER.csv`, and `project-state/QELLY_TEST_COVERAGE_MATRIX.csv` before acting.

Verify every live GitHub fact before mutation. Do not rely solely on chat memory.

## Objective

Execute **Wave 1 only** on branch `feature/calculator-and-indicator-foundation`: build the shared deterministic formula package, Quant Calculator Center, India Finance/SIP Center, and initial governed technical-indicator library across frontend, backend/local engines, persistence where appropriate, evidence metadata, responsive accessibility and tests.

## Mandatory starting guards

1. Verify repository identity, authenticated user, permissions, default branch, exact main head, all open/merged/closed PRs, branches, tags, Pages deployment, workflows, release, branch protection/rulesets and any existing Wave 1 branch/PR.
2. If live main differs from the approved Prompt 2A base, inspect every new commit and stop before overwriting unknown work.
3. Continue an existing Wave 1 branch only after comparing base/head and preserving valid work; never force-push.
4. Create/continue a draft PR titled `Qelly Prompt 2B — calculator and indicator foundation`; keep it draft and unmerged.

## Required implementation

- Shared versioned formula package with decimal/rounding/unit contracts.
- Position size, fixed risk, Kelly/fractional Kelly, risk/reward, expectancy, R-multiple, stop/target, leverage/margin/liquidation model, fees/slippage/breakeven, returns/risk/portfolio formulas, options/bond/futures/DeFi foundations listed for Wave 1.
- SIP, step-up SIP, lump sum, SWP, CAGR, XIRR, goal/retirement/FIRE, loan EMI/amortization/prepayment foundations.
- Effective-dated India tax, surcharge, cess, capital-gains, GST, brokerage/STT/CTT/exchange/SEBI/stamp/DP charge schemas. Do not hard-code a current rate without effective-date metadata and official-source reference.
- Initial indicator library: SMA, EMA, WMA, VWMA, RSI, MACD, ATR, Bollinger Bands, Donchian, Keltner, Supertrend, VWAP, OBV, MFI, realized volatility and clearly scoped additional Wave 1 indicators.
- Deterministic evidence metadata: formula version, assumptions, inputs, units, rounding, source/reference, observed/calculated time, confidence/limitations.
- Reachable responsive desktop/tablet/mobile UI, keyboard/screen-reader support, loading/empty/error/offline states, save/share/export contracts.
- Reference vectors, property tests, edge cases, schema tests, unit/integration/browser/accessibility/performance/security tests.

## Prohibited

Do not start Prompt 2C/Wave 2. Do not connect live providers, brokers, exchanges or wallets. Do not implement paper trading, strategy builder, backtesting, marketplace, order flow, liquidation heatmap, on-chain graph or governed AI. Do not enable real-money trading, custody, deposits/withdrawals, private-key/seed handling or autonomous execution. Do not modify protected main directly. Do not merge automatically.

## Truth standard

A route/card/schema/API/fixture/screenshot is not completion. Every implemented calculator/indicator must have executable formula logic, exact units, deterministic outputs, versioned methodology, edge-case behavior, tests and truthful UI labels. No silent fixture fallback and no decorative dead controls.

## Durable outputs

Update all canonical project-state files, formula catalog, feature/route/API/test matrices, decision log, progress ledger, validation history, current handoff, implementation manifest and a checksum-verified downloadable review artifact. Persist small auditable commits and exact SHAs.

Stop after Wave 1 with the PR draft and unmerged. Do not begin the next prompt automatically.

End with:

“All safe progress has been persisted in the repository and recorded in the Qelly durable handoff files. The exact current head, completed work, remaining work, validation state and next action are documented. No continuation should rely solely on chat memory.”
