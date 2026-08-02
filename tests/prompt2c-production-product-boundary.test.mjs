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
  const controller=await read('apps/web/public/assets/prompt2c-public-beta.mjs');
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
    'apps/web/public/assets/prompt2c-public-beta.mjs',
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

test('calculator defaults to structured fields while preserving advanced JSON',async()=>{
  const source=await read('apps/web/public/assets/routes/calculator-detail.mjs');
  assert.match(source,/Structured inputs/);
  assert.match(source,/Advanced JSON/);
  assert.match(source,/data-structured-field/);
  assert.match(source,/calculateFormula\(definition\.formulaId/);
  assert.doesNotMatch(source,/>Input JSON<\/span><textarea/);
  assert.doesNotMatch(source,/engine \$\{result\.engineVersion\}/);
});

test('production polish loads after product styles and suppresses legacy visual layers',async()=>{
  const [build,polish,browser]=await Promise.all([
    read('scripts/build-frontend.mjs'),
    read('apps/web/public/assets/qelly-production-polish.css'),
    read('scripts/validate-production-restoration-case.mjs')
  ]);
  const productStyle=build.indexOf('prompt2c-public-beta.css');
  const polishStyle=build.indexOf('qelly-production-polish.css');
  assert.ok(productStyle>=0&&polishStyle>productStyle,{productStyle,polishStyle});
  assert.match(polish,/q-worldclass-context\[data-qelly-product-boundary="suppressed"\]/);
  assert.match(polish,/q-scroll-progress/);
  assert.match(polish,/skip-link:focus-visible/);
  assert.match(polish,/q-panel-head/);
  assert.match(polish,/q-product-system/);
  assert.match(browser,/legacy_chrome_visible_/);
  assert.match(browser,/skip_link_visible_without_keyboard_focus/);
  assert.match(browser,/calculator_panel_header_too_bright_/);
  assert.match(browser,/mobile_technical_status_visible/);
});

test('production redirects are exact and contain no localhost or trailing bracket',async()=>{
  const backend=await read('functions/_lib/auth.js');
  const callback=await read('apps/web/public/assets/qelly-auth-callback.mjs');
  const build=await read('scripts/build-frontend.mjs');
  const combined=[backend,callback,build].join('\n');
  assert.doesNotMatch(combined,/http:\/\/localhost:3000\]?/);
  assert.match(backend,/\$\{config\.publicSiteUrl\}\/auth\/callback\.html/);
  assert.match(backend,/\$\{publicRuntimeConfig\(env,request\.url\)\.publicSiteUrl\}\/auth\/callback\.html\?flow=recovery/);
  assert.doesNotMatch(backend,/auth\/callback\.html\]/);
  assert.doesNotMatch(callback,/localhost/);
});

test('generated runtime finalizer rejects internal product copy',async()=>{
  const finalizer=await read('scripts/finalize-public-runtime.mjs');
  assert.match(finalizer,/prohibitedPrimaryCopy/);
  assert.match(finalizer,/QELLY GLOBAL PUBLIC BETA/);
  assert.match(finalizer,/Prohibited production copy/);
  assert.match(finalizer,/generatedConfig\.includes\('QELLY GLOBAL PUBLIC BETA'\)/);
});

test('public API defaults signed-out users to the market product',async()=>{
  const source=await read('functions/api/v1/[[path]].js');
  assert.match(source,/defaultRoute:'market'/);
  assert.doesNotMatch(source,/defaultRoute:context\?'market':'auth-login'/);
});
