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

test('calculator defaults to structured fields while preserving advanced JSON',async()=>{
  const source=await read('apps/web/public/assets/routes/calculator-detail.mjs');
  assert.match(source,/Structured inputs/);
  assert.match(source,/Advanced JSON/);
  assert.match(source,/data-structured-field/);
  assert.match(source,/calculateFormula\(definition\.formulaId/);
  assert.doesNotMatch(source,/>Input JSON<\/span><textarea/);
  assert.doesNotMatch(source,/engine \$\{result\.engineVersion\}/);
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

test('public API defaults signed-out users to the market product',async()=>{
  const source=await read('functions/api/v1/[[path]].js');
  assert.match(source,/defaultRoute:'market'/);
  assert.doesNotMatch(source,/defaultRoute:context\?'market':'auth-login'/);
});
