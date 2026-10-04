# Verify theme and usable-width acceptance

Based on fetched production 7a7b8c4bb646fe413bf3f1ef0f6a842c03be859b after PR #502.

Verify convergence CSS retained dark backgrounds under the light shell, making outputs and reproducibility cards difficult to read. It also allocated three columns based on viewport width while expanded navigation reduced the actual workbench width. Semantic surfaces, text and border tokens now follow resolved appearance. Container queries place the formula panel across the usable row below 1100px and stack below 620px. Reference values wrap without clipping. The secondary evidence summary/boundary use 14px text; deterministic methods and upload/privacy boundaries are preserved.

The existing required Browser E2E upload scenario now verifies populated metric/result/context/evidence/activity text at >=4.5:1, no primary/reference/inspector overflow, and real formula switching with sensitivity updates. It captures both themes at 1440px, 1280px and 390px before exercising existing HTML/XLSX/CSV and rejection flows. This is focused Verify coverage, not certification of all terminal themes/routes.

Local suite: 2115 passed, one skipped, zero failures. In-app browser local production-mode shell confirmed light surfaces and Compound Interest sensitivity changes; screenshots preserved separately. Full required exact-head and deployed runtime gates remain required before release acceptance. Synthetic fixtures do not establish broker authenticity, real outcomes or calibration.
