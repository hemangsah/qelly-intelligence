# Qelly Prompt 2B Browser Failure Forensics — Run 30482255458

## Evidence identity

- Exact workflow head: `ff6a8ab2180527e3dc62e2cf4890338eef18aa96`
- GitHub artifact ID: `8736360914`
- Artifact bytes: `6034854`
- Artifact SHA-256: `15b6cdf2c9e500470f30629b40a41adc45bb2ef648e651c9bf51412c5e0ae8f7`
- ZIP entries: `23`
- ZIP CRC: passed
- Browser records: `420`
- Failed records: `379`
- Passed records: `41`
- Theme-comparison failures: `15`
- Performance failures: `0`
- Screenshots: `17`

## Complete classification

All 379 failures are individually represented in `QELLY_PROMPT2B_BROWSER_FAILURE_CLASSIFICATION.csv`. Every failed record had only the first assertion `fixed-nav-overlap:<count>`. No failed record contained a console error, page error, required-local-resource failure, horizontal overflow, font-loading failure, truth-boundary failure or CLS failure.

| Confirmed category | Count |
|---|---:|
| Test harness defect — fixed-navigation overlap measurement | 379 |
| Real product defect proven by this artifact | 0 |
| Unknown requiring reproduction | 0 |

- Browsers: `{'chromium': 140, 'firefox': 140, 'webkit': 99}`
- Routes: `{'calculator-center': 84, 'india-finance': 68, 'indicator-library': 84, 'formula-library': 71, 'saved-calculations': 72}`
- Viewports: `{'360x800': 58, '390x844': 60, '430x932': 56, '768x1024': 50, '1024x768': 56, '1440x1000': 50, '1920x1080': 49}`
- Requested themes: `{'dark': 93, 'light': 96, 'oled': 94, 'high-contrast': 96}`
- Overlap-count range: `5–44`

## Confirmed harness defect

The old harness counted all visible interactive rectangles intersecting a fixed bottom element. It counted bottom-navigation descendants and controls temporarily behind the bar after Playwright auto-scroll, evaluated an arbitrary post-action scroll position, and never tested whether final actionable content can scroll above the fixed navigation and receive focus without clipping.

The corrected harness must preserve a strict navigation-clearance assertion, exclude navigation descendants, scroll and focus final actionable content deterministically, and retain screenshots and first-error evidence.

## Theme failures

All 15 recorded theme failures are harness setup defects. The old review wrote unsupported generic appearance names to an unused local-storage key. Qelly themes are governed persona IDs applied through the application preference path. The corrected matrix must apply real IDs, assert the resolved ID, wait for fonts, and compare semantic tokens.

## Waivers

None. Every recorded failure remains open until exact-head retest passes.
