# Qelly Prompt 2B Theme Differentiation Forensics

Run: `30482255458`  
Exact head: `ff6a8ab2180527e3dc62e2cf4890338eef18aa96`

## Recorded result

- Browser × route dark/light pairs: `15`
- Failed pairs: `15`
- Dark and requested-light body background in every failed pair: `rgb(8, 9, 10)`

## Confirmed root cause

The harness did not activate Qelly themes. It wrote `dark`, `light`, `oled` and `high-contrast` to `localStorage['qelly-appearance']`, but the application uses governed persona preferences and `document.documentElement.dataset.theme`. Every requested appearance retained `burgundy-command`.

Correct mapping to verify in the replacement harness:

- dark → `burgundy-command`
- porcelain light → `porcelain-burgundy`
- OLED → verified governed low-luminance persona
- high contrast → `high-contrast`

Semantic canvas, surface, border, text, focus, chart-grid, positive and negative tokens must be compared. Raw body-background equality alone is insufficient.

## Disposition

- Product theme defect proven by run: 0
- Harness theme setup defects: 15
- Waivers: 0
- Retest: pending
