import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('Qelly Verify is a public registered route with a deterministic pre-shell renderer handoff',async()=>{
  const [html,registry,bootstrap,product]=await Promise.all([
    read('../apps/web/public/index.html'),
    read('../apps/web/public/assets/route-registry.mjs'),
    read('../apps/web/public/assets/qelly-verify-bootstrap.mjs'),
    read('../apps/web/public/assets/qelly-verify-product.mjs')
  ]);

  assert.match(registry,/route:'qelly-verify'[^\n]*public:true/);
  assert.match(bootstrap,/import \{renderMethodology,renderVerify\} from '\.\/qelly-verify-product\.mjs';/);
  assert.match(bootstrap,/import '\.\/qelly-v53-verify-route-loader\.mjs';/);
  assert.match(product,/export function renderVerify\(\)/);
  assert.match(product,/export function renderMethodology\(\)/);
  assert.match(product,/if\(view==='qelly-verify'&&route==='qelly-verify'\)return true/);

  const bootstrapScript=html.indexOf('./assets/qelly-verify-bootstrap.mjs');
  const appScript=html.indexOf('./assets/app.js');
  assert.ok(bootstrapScript>=0,'Verify bootstrap must be present in the application shell');
  assert.ok(appScript>bootstrapScript,'Verify bootstrap must execute before the main application dispatcher');
});

test('Qelly Verify canonical V5.3 workbench is reachable through the bootstrap loader chain',async()=>{
  const [loader,convergence,canonical]=await Promise.all([
    read('../apps/web/public/assets/qelly-v53-verify-route-loader.mjs'),
    read('../apps/web/public/assets/qelly-v53-verify-convergence.mjs'),
    read('../apps/web/public/assets/qelly-v53-verify-canonical.mjs')
  ]);

  assert.match(loader,/qelly-verify/);
  assert.match(loader,/import\('\.\/qelly-v53-verify-convergence\.mjs'\)/);
  assert.match(convergence,/import '\.\/qelly-v53-verify-canonical\.mjs';/);
  assert.match(canonical,/const canonicalRoute=\(\)=>location\.hash\.replace/);
  assert.match(canonical,/v53VerifyWorkbench/);
});
