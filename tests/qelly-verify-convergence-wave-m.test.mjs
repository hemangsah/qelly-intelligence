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
  assert.match(app,/const canonicalHash=\`#\/qelly-verify\$\{canonicalQuery\?\`\?\$\{canonicalQuery\}\`:''\}\`/);
  assert.match(app,/if\(location\.hash!==canonicalHash\)history\.replaceState\(null,'',canonicalHash\)/);
  assert.match(app,/if\(state\.route!=='qelly-verify'\)\{delete main\.dataset\.qellyVerifyOwner;delete document\.documentElement\.dataset\.qellyVerifySubview;\}/);
});

test('Verify product and accepted V5.3 convergence have no global render reconciliation',async()=>{
  const [product,canonical]=await Promise.all([
    read('apps/web/public/assets/qelly-verify-product.mjs'),
    read('apps/web/public/assets/qelly-v53-verify-canonical.mjs')
  ]);
  assert.match(product,/applyV53VerifyCanonical/);
  assert.match(canonical,/export function applyV53VerifyCanonical/);
  assert.match(canonical,/data\.v53VerifyWorkbench='accepted-lock'|dataset\.v53VerifyWorkbench='accepted-lock'/);
  assert.doesNotMatch(product,/MutationObserver/);
  assert.doesNotMatch(canonical,/MutationObserver/);
  assert.doesNotMatch(product,/window\.addEventListener\('hashchange'/);
  assert.doesNotMatch(product,/window\.addEventListener\('pageshow'/);
  assert.doesNotMatch(product,/for\(const delay of \[/);
  assert.doesNotMatch(product,/enhanceHomepage|installNavigation|function reconcile|function schedule/);
  assert.doesNotMatch(product,/#\/market\?view=evidence-methodology/);
  assert.match(product,/#\/qelly-verify\?view=methodology/);
  assert.match(product,/Local-only prototype evidence workflow/);
  assert.match(product,/No live AI model, order execution or personalized financial recommendation is active/);
});

test('source and build pipeline cannot restore global Verify executables',async()=>{
  const [index,worker,build]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/qelly-service-worker.js'),
    read('scripts/build-frontend.mjs')
  ]);
  assert.doesNotMatch(index,/qelly-verify-bootstrap\.mjs|qelly-verify-product\.mjs|qelly-verify-shell-nav\.mjs/);
  assert.doesNotMatch(worker,/qelly-verify-bootstrap\.mjs/);
  assert.match(worker,/qelly-verify-product\.mjs/);
  assert.match(worker,/qelly-verify-engine\.mjs/);
  assert.doesNotMatch(build,/index\.includes\('qelly-verify-bootstrap\.mjs'\)|qelly-verify-bootstrap\.mjs<\/script>/);
});
