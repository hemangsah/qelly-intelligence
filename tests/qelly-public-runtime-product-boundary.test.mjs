import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

const prohibitedPrimaryCopy=[
  'QELLY GLOBAL PUBLIC BETA',
  'VALIDATION STATE',
  'Unable to render this route.',
  'Retry foundation route',
  'AUTHENTICATION DEMO',
  'LOCAL DEMONSTRATION IDENTITY BOUNDARY',
  'STATE: DEFAULT',
  'Secure identity foundation'
];

test('production controller exposes a product header and market-first root',async()=>{
  const controller=await read('apps/web/public/assets/qelly-public-runtime.mjs');
  assert.match(controller,/Markets/);
  assert.match(controller,/Research/);
  assert.match(controller,/Formulas/);
  assert.match(controller,/Indicators/);
  assert.match(controller,/Calculators/);
  assert.match(controller,/Saved/);
  assert.match(controller,/Account/);
  assert.match(controller,/renderMarketHomepage/);
  assert.doesNotMatch(controller,/Release ·/);
  assert.doesNotMatch(controller,/Network · online/);
  assert.doesNotMatch(controller,/Authentication · active/);
});

test('normal production routes exclude QA and demo language',async()=>{
  const paths=[
    'apps/web/public/index.html',
    'apps/web/public/assets/qelly-public-runtime.mjs',
    'apps/web/public/assets/routes/auth-login.mjs',
    'apps/web/public/assets/routes/calculator-detail.mjs'
  ];
  const sources=await Promise.all(paths.map(read));
  for(const phrase of prohibitedPrimaryCopy){
    assert.equal(sources.some((source)=>source.includes(phrase)),false,`prohibited production copy: ${phrase}`);
  }
  assert.doesNotMatch(sources[0],/Preview application state/);
  assert.doesNotMatch(sources[0],/>State<\/span>/);
});

test('shell compatibility executes after brand correction and before app bootstrap',async()=>{
  const index=await read('apps/web/public/index.html');
  const brand=index.indexOf('src="./assets/qelly-brand-visual-correction.mjs"');
  const compat=index.indexOf('src="./assets/qelly-shell-compat.js"');
  const app=index.indexOf('src="./assets/app.js"');
  assert.ok(brand>=0&&compat>brand&&app>compat,{brand,compat,app});
  const bridge=await read('apps/web/public/assets/qelly-shell-compat.js');
  for(const id of ['rail','collapse-rail','rail-toggle','close-context','theme-shortcut','notification-button','command-button','state-selector','global-theme-selector'])assert.match(bridge,new RegExp(`['\"]${id}['\"]`));
});

test('static-preview branding is removed from production product mode',async()=>{
  const brand=await read('apps/web/public/assets/qelly-brand.mjs');
  assert.match(brand,/productionProduct/);
  assert.match(brand,/staticVisualPreview===false/);
  assert.match(brand,/\[data-qelly-brand-hero\],\[data-qelly-auth-brand\]/);
  assert.match(brand,/node\.remove\(\)/);
});

test('signed-out protected routes own a dedicated access gate',async()=>{
  const guard=await read('apps/web/public/assets/qelly-product-route-guard.mjs');
  assert.match(guard,/account-session/);
  assert.match(guard,/Sign in to continue/);
  assert.match(guard,/qelly\.returnTo/);
  assert.match(guard,/api\/v1\/auth\/status/);
  assert.match(guard,/Return home/);
});

test('calculator center is a human-facing structured tool catalog',async()=>{
  const source=await read('apps/web/public/assets/routes/calculator-center.mjs');
  assert.match(source,/Search calculators/);
  assert.match(source,/Start with a proven calculation/);
  assert.match(source,/calculator-detail/);
  assert.match(source,/structured inputs/i);
  assert.doesNotMatch(source,/Input JSON/);
  assert.doesNotMatch(source,/calculateFormula/);
  assert.doesNotMatch(source,/<textarea/);
});

test('calculator defaults to structured fields while preserving advanced JSON',async()=>{
  const source=await read('apps/web/public/assets/routes/calculator-detail.mjs');
  assert.match(source,/Structured inputs/);
  assert.match(source,/Advanced JSON/);
  assert.match(source,/data-structured-field/);
  assert.match(source,/calculateFormula\(definition\.formulaId/);
  assert.doesNotMatch(source,/>Input JSON<\/span><textarea/);
  assert.doesNotMatch(source,/engine \$\{result\.engineVersion\}/);
});

test('indicator library is a human-facing study catalog',async()=>{
  const source=await read('apps/web/public/assets/routes/indicator-library.mjs');
  assert.match(source,/Search indicators/);
  assert.match(source,/Start with a familiar indicator/);
  assert.match(source,/indicator-detail/);
  assert.match(source,/required data/i);
  assert.doesNotMatch(source,/parameters \(JSON\)/i);
  assert.doesNotMatch(source,/calculateIndicator/);
  assert.doesNotMatch(source,/<textarea/);
});

test('indicator detail prioritizes methodology, visual evidence and exact values',async()=>{
  const source=await read('apps/web/public/assets/routes/indicator-detail.mjs');
  assert.match(source,/How this study works/);
  assert.match(source,/Interpretation boundary/);
  assert.match(source,/q-indicator-chart/);
  assert.match(source,/q-indicator-exact-table/);
  assert.match(source,/Advanced technical evidence/);
  assert.match(source,/calculateIndicator\(definition\.indicatorId/);
  assert.doesNotMatch(source,/Parameters<\/h3><pre/);
  assert.doesNotMatch(source,/Reference evidence[\s\S]*JSON\.stringify\(\{inputs,result\}/);
});

test('production polish loads after product styles and suppresses legacy visual layers',async()=>{
  const [build,polish,indicators,browser]=await Promise.all([
    read('scripts/build-frontend.mjs'),
    read('apps/web/public/assets/qelly-production-polish.css'),
    read('apps/web/public/assets/qelly-indicator-product.css'),
    read('scripts/validate-production-restoration-case.mjs')
  ]);
  const productStyle=build.indexOf('qelly-public-runtime.css');
  const polishStyle=build.indexOf('qelly-production-polish.css');
  const indicatorStyle=build.indexOf('qelly-indicator-product.css');
  assert.ok(productStyle>=0&&polishStyle>productStyle&&indicatorStyle>polishStyle,{productStyle,polishStyle,indicatorStyle});
  assert.match(polish,/q-worldclass-context\[data-qelly-product-boundary="suppressed"\]/);
  assert.match(polish,/q-scroll-progress/);
  assert.match(polish,/skip-link:focus-visible/);
  assert.match(polish,/q-panel-head/);
  assert.match(polish,/q-product-system/);
  assert.match(indicators,/q-indicator-detail-grid/);
  assert.match(indicators,/q-spark-bars/);
  assert.match(indicators,/q-technical-details/);
  assert.match(browser,/legacy_chrome_visible_/);
  assert.match(browser,/skip_link_visible_without_keyboard_focus/);
  assert.match(browser,/calculator_panel_header_too_bright_/);
  assert.match(browser,/mobile_technical_status_visible/);
});

test('production PKCE redirects are exact and contain no localhost or trailing bracket',async()=>{
  const backend=await read('functions/_lib/auth.js');
  const callback=await read('apps/web/public/assets/qelly-auth-callback.mjs');
  const build=await read('scripts/build-frontend.mjs');
  const combined=[backend,callback,build].join('\n');
  assert.doesNotMatch(combined,/http:\/\/localhost:3000\]?/);
  assert.match(backend,/new URL\('\/auth\/callback\.html',`\$\{config\.publicSiteUrl\}\/`\)/);
  assert.match(backend,/redirect\.searchParams\.set\('flow',transaction\.flow\)/);
  assert.match(backend,/redirect\.searchParams\.set\('state',transaction\.state\)/);
  assert.match(backend,/redirect\.searchParams\.set\('nonce',transaction\.nonce\)/);
  assert.match(backend,/callbackRedirect\(publicRuntimeConfig\(env,request\.url\),transaction\)/);
  assert.doesNotMatch(backend,/auth\/callback\.html\]/);
  assert.doesNotMatch(callback,/location\.hash|access_token|refresh_token|localhost/);
});

test('generated runtime finalizer rejects internal product copy',async()=>{
  const finalizer=await read('scripts/finalize-public-runtime.mjs');
  assert.match(finalizer,/prohibitedPrimaryCopy/);
  assert.match(finalizer,/QELLY GLOBAL PUBLIC BETA/);
  assert.match(finalizer,/Prohibited production copy/);
  assert.match(finalizer,/generatedConfig\.includes\('QELLY GLOBAL PUBLIC BETA'\)/);
});

test('public API defaults signed-out users to the market product',async()=>{
  const source=await read('functions/api/v1/config.js');
  assert.match(source,/defaultRoute:'market'/);
  assert.doesNotMatch(source,/defaultRoute:context\?'market':'auth-login'/);
});
