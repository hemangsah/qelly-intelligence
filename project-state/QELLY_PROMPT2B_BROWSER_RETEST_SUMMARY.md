# Qelly Prompt 2B Corrected Browser Retest Forensics

## Evidence identity

- Run: `30515801762`
- Exact head: `9b5d87e42e5ba2f9b1f49b53da392fcae2ea6f3b`
- Artifact ID: `8749246424`
- Artifact bytes: `63140064`
- Artifact SHA-256: `e880c3402bbd29276d7465f59582b7cd4346ca4904c6fde9aae8302cb97ff10e`
- ZIP entries: `371`
- ZIP CRC: passed

## Results

- Records: `1080`
- Failures: `343`
- Theme failures: `0`
- Performance failures: `0`
- Screenshots: `365`
- Failure families: `{'fixed-nav-clearance': 343}`
- Route distribution: `{'calculator-center': 78, 'india-finance': 70, 'indicator-library': 73, 'formula-library': 69, 'saved-calculations': 53}`
- Browser distribution: `{'chromium': 152, 'firefox': 76, 'webkit': 115}`
- Viewport distribution: `{'360x800': 91, '390x844': 91, '430x932': 88, '768x1024': 73}`
- Motion distribution: `{'full': 115, 'reduced': 228}`

## Confirmed root causes

1. Qelly's opening sequence is gated by `sessionStorage['qelly.brand.opening.v1']`; the prior harness wrote an unrelated local-storage key.
2. The document uses smooth scrolling; the prior harness measured before the actual scroll owner settled.

All 343 failures are individually recorded in `QELLY_PROMPT2B_BROWSER_RETEST_CLASSIFICATION.csv`. There were no console, page, required-resource, horizontal-overflow, font, truth-boundary, CLS, theme or performance failures. No waiver is issued.
