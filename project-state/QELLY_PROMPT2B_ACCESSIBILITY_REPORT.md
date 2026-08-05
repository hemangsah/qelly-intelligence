# Qelly Prompt 2B Accessibility Report

Updated: 2026-07-30  
Exact evidence head: `1109d9daa828886209b62493fb168b4392daa79c`  
Workflow run/job: `30540905856` / `90865188027`

## Result

- 36/36 route-viewport checks passed;
- 18 unique governed routes × 2 viewports (desktop 1440×1000 and mobile 390×844);
- desktop uses normal motion; mobile uses reduced motion;
- real `https://qelly.test` origin with storage APIs available;
- exact checked-in document fulfilled at the governed origin;
- exact compiled IBM Plex WOFF2 served from the locked frontend build;
- checker hard-fails if the compiled font is absent;
- zero console, page, HTTP and required-resource failures;
- valid language, title, skip link, single main landmark and H1;
- zero unlabeled controls, missing image alt, positive tabindex or duplicate IDs;
- keyboard entry passed;
- horizontal overflow stayed within the strict threshold;
- no waiver, ignored error, fallback font or weakened assertion.

The 36 result is 36 route-viewport checks, not 36 distinct routes. This report preserves that denominator exactly rather than overstating unique route coverage.

## Method limitation

The checker describes itself as automated semantic, keyboard-entry and responsive regression, not an independent WCAG certification. Native assistive-technology and comprehensive manual accessibility review remain outside this exact gate.
