import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const ENHANCEMENT='apps/web/public/assets/routes/data-mesh-enhancement.mjs';
const APP='apps/web/public/assets/app.js';
const INDEX='apps/web/public/index.html';
const RESPONSIVE='scripts/release-v53-responsive-evidence.py';

function dataMeshRenderer(source){
  const normalized=source.replace(/\r\n/g,'\n');
  const start=normalized.indexOf('async function renderDataMesh(main)');
  const end=normalized.indexOf('\n\nasync function renderInstrumentMaster',start);
  assert.ok(start>=0,'Data Mesh renderer missing');
  assert.ok(end>start,'Data Mesh renderer boundary missing');
  return normalized.slice(start,end);
}

test('Data Mesh mobile density is semantic, phone-only, reversible and keyboard-scrollable',async()=>{
  const source=await read(ENHANCEMENT);
  assert.match(source,/matchMedia\('\(max-width: 620px\)'\)/);
  assert.match(source,/page\?\.querySelector\('\.q-provider-grid'\)/);
  assert.match(source,/page\?\.querySelector\('#runtime-result'\)/);
  assert.match(source,/page\?\.querySelector\('\[data-action="test-quote"\]'\)/);
  assert.match(source,/grid-template-columns':'repeat\(2,minmax\(0,1fr\)\)'/);
  assert.match(source,/scroll-snap-type':'x proximity'/);
  assert.match(source,/overscroll-behavior-inline':'contain'/);
  assert.match(source,/providerGrid\.tabIndex=0/);
  assert.match(source,/providerGrid\.setAttribute\('role','region'\)/);
  assert.match(source,/providerGrid\.setAttribute\('aria-label','Provider runtime registry'\)/);
  assert.match(source,/providerGrid\.removeAttribute\('tabindex'\)/);
  assert.match(source,/element\.style\.removeProperty\(name\)/);
  const presentation=source.slice(source.indexOf('const PHONE_PRESENTATION='),source.indexOf('const isDataMeshHash='));
  assert.doesNotMatch(presentation,/display['"]?\s*:\s*['"]none|visibility['"]?\s*:\s*['"]hidden|opacity['"]?\s*:\s*['"]0/);
});

test('Data Mesh keeps complete provider, capability, runtime and entitlement evidence',async()=>{
  const app=await read(APP);
  const block=dataMeshRenderer(app);
  assert.match(block,/api\('\/api\/v1\/providers\/runtime'\)/);
  assert.match(block,/api\('\/api\/v1\/data-quality\/incidents'\)/);
  assert.match(block,/api\('\/api\/v1\/contracts\/entitlements'\)/);
  assert.match(block,/providerData\.items\.map\(providerCard\)/);
  assert.equal((block.match(/<article class="q-kpi">/g)||[]).length,4);
  assert.match(block,/id="runtime-result"/);
  assert.match(block,/entitlementContract\.decision/);
  assert.doesNotMatch(block,/providerData\.items\.slice\s*\(/);
  assert.doesNotMatch(block,/providerData\.items\.splice\s*\(/);
  assert.match(app,/item\.capabilities\.map\(\(capability\)=>/);
  assert.match(app,/Breaker: <strong>/);
});

test('Data Mesh enhancement participates in app-ready gating and governed responsive evidence',async()=>{
  const index=await read(INDEX);
  const responsive=await read(RESPONSIVE);
  assert.match(index,/assets\/routes\/data-mesh-enhancement\.mjs/);
  assert.match(index,/window\.__qellyDataMeshEnhancementReady\?\?Promise\.resolve\(\)/);
  assert.match(responsive,/'data-mesh'/);
  for(const width of [360,390,430,768,1024,1280,1440,1728,1920]){
    assert.ok(responsive.includes(String(width)),`missing governed viewport ${width}`);
  }
});
