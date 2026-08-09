import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const REGISTRY='apps/web/public/assets/route-registry.mjs';
const BOOTSTRAP='apps/web/public/assets/qelly-verify-bootstrap.mjs';
const PRODUCT='apps/web/public/assets/qelly-verify-product.mjs';
const SHELL='apps/web/public/assets/qelly-verify-shell-nav.mjs';
const INDEX='apps/web/public/index.html';
const EVIDENCE='scripts/release-v53-verify-subview-evidence.py';
const WORKFLOW='.github/workflows/qelly-v53-verify-subview-evidence.yml';

test('Qelly Verify remains two governed Market subviews, not canonical routes',async()=>{
  const [registry,bootstrap]=await Promise.all([read(REGISTRY),read(BOOTSTRAP)]);
  const routes=[...registry.matchAll(/route:'([^']+)'/g)].map(match=>match[1]);
  assert.equal(routes.length,70);
  assert.equal(routes.includes('qelly-verify'),false);
  assert.equal(routes.includes('evidence-methodology'),false);
  assert.ok(bootstrap.includes('verify:/^#\\/(?:qelly-verify|market\\?[^#]*\\bview=qelly-verify(?:&|$))/i'));
  assert.ok(bootstrap.includes('methodology:/^#\\/(?:evidence-methodology|market\\?[^#]*\\bview=evidence-methodology(?:&|$))/i'));
  assert.match(bootstrap,/#\/market\?view=qelly-verify/);
  assert.match(bootstrap,/#\/market\?view=evidence-methodology/);
});

test('Verify product retains explicit local-only and execution-disabled boundaries',async()=>{
  const product=await read(PRODUCT);
  assert.match(product,/Local-only prototype evidence workflow/);
  assert.match(product,/Your file is processed in this browser and is not uploaded/);
  assert.match(product,/No live AI model, order execution or personalized financial recommendation is active/);
  assert.match(product,/<dt>Execution<\/dt><dd>Disabled<\/dd>/);
  assert.match(product,/Human validation remains required/);
});

test('current shell exposes Verify and Evidence through native navigation primitives',async()=>{
  const [shell,index]=await Promise.all([read(SHELL),read(INDEX)]);
  assert.match(shell,/document\.getElementById\('primary-nav'\)/);
  assert.match(shell,/#context-shelf \.q-category-shelf/);
  assert.match(shell,/class="q-nav-link" data-qelly-verify-link="shell"/);
  assert.match(shell,/class="q-nav-link" data-qelly-methodology-link="shell"/);
  assert.match(shell,/#\/market\?view=\$\{view\}/);
  assert.match(shell,/shelf\.firstElementChild!==verify/);
  assert.match(shell,/shelf\.insertBefore\(method,verify\.nextElementSibling\)/);
  assert.match(shell,/MutationObserver/);
  const productPosition=index.indexOf('./assets/qelly-verify-product.mjs');
  const shellPosition=index.indexOf('./assets/qelly-verify-shell-nav.mjs');
  assert.ok(productPosition>=0,'Verify product runtime missing from index');
  assert.ok(shellPosition>productPosition,'shell nav bridge must load after Verify product runtime');
});

test('dedicated evidence harness adds 18 subview renders without changing existing route denominators',async()=>{
  const [script,workflow]=await Promise.all([read(EVIDENCE),read(WORKFLOW)]);
  for(const width of [360,390,430,768,1024,1280,1440,1728,1920])assert.ok(script.includes(String(width)),`missing width ${width}`);
  assert.match(script,/'id':'qelly-verify'/);
  assert.match(script,/'id':'evidence-methodology'/);
  assert.match(script,/canonical route count changed unexpectedly/);
  assert.match(script,/Qelly Verify subviews must not become canonical routes/);
  assert.match(script,/primaryVerify/);
  assert.match(script,/shelfMethodology/);
  assert.match(script,/shelfVerifyBounds/);
  assert.match(script,/shelfMethodologyBounds/);
  assert.match(script,/outside the visible shelf viewport/);
  assert.match(script,/aliasNormalized/);
  assert.match(workflow,/manifest\.canonicalRouteCount===70/);
  assert.match(workflow,/manifest\.renderCount===18/);
  assert.match(workflow,/manifest\.expectedRenderCount===18/);
  assert.match(workflow,/manifest\.aliasNormalized===true/);
});

test('Wave 2 does not weaken the existing complete-route and responsive denominators',async()=>{
  const [allScreens,responsive]=await Promise.all([
    read('.github/workflows/qelly-all-screens-evidence.yml'),
    read('.github/workflows/qelly-v53-responsive-evidence.yml')
  ]);
  assert.match(allScreens,/manifest\.routeCount===70/);
  assert.match(allScreens,/manifest\.renderCount===140/);
  assert.match(allScreens,/pngs\.length===140/);
  assert.match(responsive,/manifest\.canonicalRouteCount===70/);
  assert.match(responsive,/manifest\.representativeRouteCount===15/);
  assert.match(responsive,/manifest\.renderCount===135/);
  assert.match(responsive,/pngs\.length===135/);
});

test('Wave 2 introduces no execution, custody, wallet or secret-collection capability',async()=>{
  const [shell,evidence]=await Promise.all([read(SHELL),read(EVIDENCE)]);
  const source=`${shell}\n${evidence}`.toLowerCase();
  for(const phrase of ['place order','execute trade','buy now','sell now','connect wallet','private key','recovery phrase','withdraw funds','deposit funds']){
    assert.equal(source.includes(phrase),false,`forbidden capability phrase: ${phrase}`);
  }
});
