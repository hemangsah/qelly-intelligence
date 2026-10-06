# Economic input presentation boundaries

Structured calculator forms previously applied 0–100 to every numeric field
whose name contained Percent or Probability. A valid SIP loss scenario at −12%
was blocked by browser validity even though the registered engine calculated it.
FX quote-to-account multipliers and relative price ratios also displayed incorrect
percentage/currency units.

Signed economic rates now omit that invented presentation range. Loan interest
remains nonnegative; volatility and coupon rates remain nonnegative without the
invented 100% ceiling. Probability and risk fields retain their existing bounds.
Historical-tail confidence uses the engine's 99.99% maximum. Native schemas are
authoritative. Formula implementations and their domain validation are unchanged.
Calculator output actions now update native disabled and aria-disabled together;
the first browser run exposed stale aria-disabled=true after a successful result.

Independent cash-flow/compounding identities verify negative SIP and compound
interest results. Regression checks cover signed yields/rates, high volatility,
probability/confidence/loan rejection and FX dimensional correctness. A required
16-case Browser gate exercises structured forms in both themes and widths,
checks result values, output action/reset semantics and invalid-probability export guards, and writes no saved
calculations or chat messages. This is targeted input acceptance, not completion
of every calculator's scientific and UX acceptance.
