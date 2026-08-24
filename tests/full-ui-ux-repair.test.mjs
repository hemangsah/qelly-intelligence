import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('visual review waits for rendered UI instead of an impossible idle network', async () => {
  for (const file of ['scripts/ui-review.mjs', 'scripts/ui-review-premium.mjs']) {
    const source = await read(file);
    assert.doesNotMatch(source, /waitUntil:\s*['"]networkidle['"]/);
    assert.match(source, /waitUntil:\s*['"]domcontentloaded['"]/);
    assert.match(source, /locator\([^\n]+\)\.waitFor\(\{state:['"]visible['"]\}\)/);
  }
});

test('authoritative visual review follows current supported routes', async () => {
  const [orchestrator, current] = await Promise.all([
    read('scripts/ui-review-orchestrator.mjs'),
    read('scripts/ui-review-current.mjs')
  ]);
  assert.match(orchestrator, /authoritativePasses=\['scripts\/ui-review-current\.mjs'\]/);
  assert.match(orchestrator, /retiredLegacyPasses/);
  assert.match(current, /smallTargets/);
  assert.match(current, /smallText/);
  assert.match(current, /commandPalette/);
  assert.match(current, /html\[data-production-system="v8"\]/);
  assert.match(current, /startsWith\(`\$\{origin\}\/api\/`\)/);
});

test('static preview market hero retains one semantic page title', async () => {
  const brand = await read('apps/web/public/assets/qelly-brand.mjs');
  assert.match(brand, /routeTitle=\[\.\.\.main\.querySelectorAll\('h1'\)\]/);
  assert.match(brand, /document\.createElement\('h2'\)/);
});

test('shared world-class context meets mobile target and text floors', async () => {
  const source = await read('apps/web/public/assets/qelly-worldclass-uiux.css');
  assert.match(source, /\.q-worldclass-breadcrumb a\{[^}]*min-height:44px/);
  assert.match(source, /\.q-worldclass-related a\{[^}]*min-height:44px/);
  assert.match(source, /\.q-worldclass-method summary\{[^}]*min-height:44px/);
  assert.doesNotMatch(source, /q-worldclass[^\n{]*\{[^}]*font-size:(?:8|9|10|11)px/);
});

test('production mobile controls and research evidence remain tappable and readable', async () => {
  const [repairs, convergence] = await Promise.all([
    read('apps/web/public/assets/qelly-production-v8-route-repairs.css'),
    read('apps/web/public/assets/qelly-production-v9-route-convergence.css')
  ]);
  assert.match(repairs, /@media\(max-width:700px\)[\s\S]*--q-control-height:44px/);
  assert.match(convergence, /a\[class\*="button"\][\s\S]*min-height:44px/);
  assert.match(convergence, /q-worldclass-breadcrumb a,.q-worldclass-related a/);
  assert.match(convergence, /q-auth-footer \.q-button\{min-height:44px!important\}/);
  assert.match(convergence, /#main \.q-auth-page :where\([^}]+\)\{font-size:12px!important\}/);
  assert.match(convergence, /q-v7-provider-card a\)\{min-height:44px!important/);
  assert.doesNotMatch(repairs, /data-production-route="research-workspace"[^\n{]*\{[^}]*font-size:(?:8|9|10|11)px/);
});

test('production header and primary actions keep a 44 pixel touch floor', async () => {
  const [source, convergence] = await Promise.all([
    read('apps/web/public/assets/qelly-production-v8.css'),
    read('apps/web/public/assets/qelly-production-v9-route-convergence.css')
  ]);
  assert.match(source, /\.q-product-brand \{[\s\S]*?min-height: 44px !important/);
  assert.match(source, /\.q-product-nav a \{[\s\S]*?min-height: 44px !important/);
  assert.match(source, /\.q-product-search input \{[\s\S]*?height: 44px !important/);
  assert.match(source, /\.q-product-search button,[\s\S]*?\.q-product-system \{[\s\S]*?min-height: 44px !important/);
  assert.match(source, /\.q-button--primary,[\s\S]*?\.q-button\.is-primary \{[\s\S]*?min-height: 44px !important/);
  assert.match(convergence, /#main\[data-production-route="news-research"\] \.q-page-actions \.q-button\{min-height:44px!important/);
});

test('data grids expose a 44 pixel checkbox label target', async () => {
  const [grid, css] = await Promise.all([
    read('packages/data-grid/data-grid.mjs'),
    read('apps/web/public/assets/app.css')
  ]);
  assert.match(grid, /<label class="q-grid-checkbox-target"><input type="checkbox"/);
  assert.match(css, /\.q-grid-checkbox-target\{[^}]*width:44px;[^}]*height:44px/);
});

test('legacy market drawers and mobile rows keep valid geometry selectors', async () => {
  const css = await read('apps/web/public/assets/ui-rescue.css');
  assert.match(css, /\.qv-sheet>section\{[^}]*top:0;height:100%/);
  assert.match(css, /\.qv-mobile-row\{border-top:/);
  assert.match(css, /\.qv-mobile-row\.is-open \.mobile-detail/);
});

test('theme launcher and analytical graphics expose accessible mobile semantics', async () => {
  const [theme, advanced, comparison] = await Promise.all([
    read('apps/web/public/assets/theme-intelligence-visual-final-fixes.css'),
    read('apps/web/public/assets/routes/advanced-chart.mjs'),
    read('apps/web/public/assets/routes/comparison-lab.mjs')
  ]);
  assert.match(theme, /q-ti-launcher\{min-height:44px!important/);
  assert.match(theme, /width:44px!important;min-width:44px!important/);
  assert.match(advanced, /<svg aria-hidden="true" focusable="false"/);
  assert.match(comparison, /<svg aria-hidden="true" focusable="false"/);
});

test('theme and provider cards do not skip the level-two heading', async () => {
  const [theme, app] = await Promise.all([
    read('apps/web/public/assets/routes/theme-intelligence-studio.mjs'),
    read('apps/web/public/assets/app.js')
  ]);
  assert.match(theme, /q-ti-alpha-signal"><h2>/);
  assert.match(theme, /q-ti-semantic-card"><h2>/);
  assert.match(app, /q-provider-card-head"><div><h2>/);
});

test('route fallbacks keep URL ownership truthful and dynamic metadata readable', async () => {
  const [app, runtime, convergence, index] = await Promise.all([
    read('apps/web/public/assets/app.js'),
    read('apps/web/public/assets/qelly-production-v8.mjs'),
    read('apps/web/public/assets/qelly-production-v9-route-convergence.css'),
    read('apps/web/public/index.html')
  ]);
  assert.match(app, /if\(!allowed&&route!==state\.route\)history\.replaceState\(null,'',`#\/\$\{state\.route\}`\)/);
  assert.match(runtime, /function applyAccessibilityFloor\(\)/);
  assert.match(runtime, /document\.head\.querySelectorAll\('link\[rel="stylesheet"\]'\)/);
  assert.match(runtime, /size<12\)element\.classList\.add\('q-v8-text-floor'\)/);
  assert.match(convergence, /\.q-v8-text-floor:not\(\.sr-only\)\{font-size:12px!important/);
  assert.match(convergence, /q-v8-technical-identifiers>summary\{min-height:44px!important/);
  assert.match(convergence, /\.q-filter-chip\{min-width:44px!important/);
  assert.match(convergence, /q-v53-strategy-tools \.q-verify-upload-card code\)\{font-size:12px!important/);
  assert.match(index, /qelly-production-v8-route-repairs\.css" data-qelly-production-v8-route-repairs="true"/);
  assert.match(index, /qelly-production-v9-route-convergence\.css" data-qelly-production-v9-route-convergence="true"/);
});

test('production exposes the complete registry through one responsive feature navigator', async () => {
  const [runtime, convergence, registry] = await Promise.all([
    read('apps/web/public/assets/qelly-production-v8.mjs'),
    read('apps/web/public/assets/qelly-production-v9-route-convergence.css'),
    import('../apps/web/public/assets/route-registry.mjs')
  ]);
  const visibleRoutes=registry.routeDefinitions.filter((route)=>!route.hidden);
  assert.equal(visibleRoutes.length,64);
  assert.match(runtime, /import \{ productDomains, routeDefinitions \} from '\.\/route-registry\.mjs'/);
  assert.match(runtime, /const FEATURE_ROUTES=routeDefinitions\.filter\(\(route\)=>!route\.hidden\)/);
  assert.match(runtime, /aria-label="All Qelly features"/);
  assert.match(runtime, /placeholder="Filter \$\{FEATURE_ROUTES\.length\} features"/);
  assert.match(runtime, /data-feature-navigation-owner='true'|dataset\.featureNavigationOwner='true'/);
  assert.match(runtime, /event\.key==='Escape'/);
  assert.match(runtime, /syncFeatureNavigation\(\)/);
  assert.match(convergence, /\.q-feature-navigation\{[^}]*width:min\(286px,92vw\)/);
  assert.match(convergence, /min-height:46px/);
  assert.match(convergence, /@media\(min-width:1181px\)[\s\S]*margin-left:286px!important/);
  assert.match(convergence, /@media\(max-width:1180px\)[\s\S]*q-product-menu\[data-feature-navigation-owner="true"\][^}]*min-height:44px/);
  assert.match(convergence, /@media\(prefers-reduced-motion:reduce\)/);
});

test('modern production polish is globally loaded, curved, animated and motion-safe', async () => {
  const [index, css, motion, worker] = await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/qelly-modern-interaction-polish.css'),
    read('apps/web/public/assets/qelly-sovereign-motion.js'),
    read('apps/web/public/prompt2c-sw.js')
  ]);
  assert.match(index, /qelly-production-v9-route-convergence\.css[\s\S]*qelly-modern-interaction-polish\.css\?v=20260822-modern6/);
  assert.match(css, /--q-modern-radius-xl:32px/);
  assert.match(css, /header\.q-product-header[\s\S]*border-radius:0 0 var\(--q-modern-radius-lg\)/);
  assert.match(css, /:where\(button:not\(\.q-product-brand__mark\),a\.q-button,\[role="button"\],\[role="tab"\]\)[\s\S]*border-radius:999px!important/);
  assert.match(css, /#main \.q-page-actions \.q-button\{border-radius:999px!important/);
  assert.match(css, /\.q-product-search\{[\s\S]*border-radius:999px!important/);
  assert.match(css, /Designer pass: normalize every surviving legacy route family/);
  assert.match(css, /\.q-mn-card,[\s\S]*\.q-v7-provider-card,[\s\S]*\.q-mi-kpi/);
  assert.match(css, /\.q-grid-scroll,[\s\S]*\.q-mn-table-wrap/);
  assert.match(css, /\.q-is-scrolled body #app header\.q-product-header/);
  assert.match(css, /\.skip-link\{[\s\S]*transform:translateY\(calc\(-100% - 20px\)\)!important/);
  assert.match(css, /\.skip-link:focus-visible\{[\s\S]*transform:translateY\(0\)!important/);
  assert.match(css, /\.q-feature-navigation__group a:hover\{transform:translateX\(4px\)/);
  assert.match(css, /@keyframes q-modern-route-enter/);
  assert.match(css, /body>\.q-scroll-progress[\s\S]*display:block!important/);
  assert.match(css, /q-v53-lock-command\{[\s\S]*border-radius:var\(--q-modern-radius-lg\)!important/);
  assert.match(css, /q-v53-lock-contextbar\{[\s\S]*border-radius:var\(--q-modern-radius-md\)!important/);
  assert.match(css, /q-v53-lock-shell-nav a:hover[\s\S]*transform:translateX\(3px\)!important/);
  assert.match(css, /q-v7-boundary-ribbon,[\s\S]*q-v6-market-boundary[\s\S]*border-radius:var\(--q-modern-radius-lg\)!important/);
  assert.match(css, /\.q-setting,\.q-query-boundary\)\{[\s\S]*border-radius:var\(--q-modern-radius-md\)!important/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[\s\S]*animation:none!important/);
  assert.match(motion, /'\.q-it-hero'[\s\S]*'\.q-it-provider'/);
  assert.match(motion, /button:not\(\[disabled\]\),a\.q-button,\[role="button"\],\[role="tab"\]/);
  assert.match(motion, /root\.classList\.toggle\('q-is-scrolled', scrollY > 20\)/);
  assert.match(motion, /\.q-mn-card[\s\S]*\.q-v7-provider-card[\s\S]*\.q-mi-kpi/);
  assert.match(worker, /qelly-modern-interaction-polish\.css/);
});
