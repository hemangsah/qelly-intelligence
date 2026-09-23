import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHashRoute} from '../apps/web/public/assets/hash-route-state.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Verify aliases converge to one qelly-verify route owner',()=>{
  let parsed=parseHashRoute('#/qelly-verify');
  assert.equal(parsed.route,'qelly-verify');
  assert.equal(parsed.query.get('view'),null);

  parsed=parseHashRoute('#/methodology/verify');
  assert.equal(parsed.route,'qelly-verify');
  assert.equal(parsed.query.get('view'),null);

  parsed=parseHashRoute('#/market?view=qelly-verify');
  assert.equal(parsed.route,'qelly-verify');
  assert.equal(parsed.query.get('view'),null);

  parsed=parseHashRoute('#/evidence-methodology');
  assert.equal(parsed.route,'qelly-verify');
  assert.equal(parsed.query.get('view'),'methodology');

  parsed=parseHashRoute('#/market?view=evidence-methodology');
  assert.equal(parsed.route,'qelly-verify');
  assert.equal(parsed.query.get('view'),'methodology');
});

test('app.js is the sole first-view owner for Verify and methodology',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  assert.match(app,/const renderQellyVerify=lazyRoute\('\.\/qelly-verify-product\.mjs','renderVerify'\)/);
  assert.match(app,/const renderQellyVerifyMethodology=lazyRoute\('\.\/qelly-verify-product\.mjs','renderMethodology'\)/);
  assert.match(app,/case 'qelly-verify':/);
  assert.match(app,/state\.routeQuery\?\.get\?\.\('view'\)==='methodology'/);
  assert.match(app,/if\(state\.route!=='qelly-verify'\)delete main\.dataset\.qellyVerifyOwner/);
});

test('Verify product has no global render reconciliation or Market-home takeover',async()=>{
  const product=await read('apps/web/public/assets/qelly-verify-product.mjs');
  assert.doesNotMatch(product,/MutationObserver/);
  assert.doesNotMatch(product,/window\.addEventListener\('hashchange'/);
  assert.doesNotMatch(product,/window\.addEventListener\('pageshow'/);
  assert.doesNotMatch(product,/for\(const delay of \[/);
  assert.doesNotMatch(product,/enhanceHomepage|installNavigation|function reconcile|function schedule/);
  assert.doesNotMatch(product,/#\/market\?view=evidence-methodology/);
  assert.match(product,/#\/qelly-verify\?view=methodology/);
  assert.match(product,/Local-only prototype evidence workflow/);
  assert.match(product,/No live AI model, order execution or personalized financial recommendation is active/);
});

test('base HTML no longer starts global Verify executables',async()=>{
  const [index,worker]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/qelly-service-worker.js')
  ]);
  assert.doesNotMatch(index,/qelly-verify-bootstrap\.mjs|qelly-verify-product\.mjs|qelly-verify-shell-nav\.mjs/);
  assert.doesNotMatch(worker,/qelly-verify-bootstrap\.mjs/);
  assert.match(worker,/qelly-verify-product\.mjs/);
  assert.match(worker,/qelly-verify-engine\.mjs/);
});
