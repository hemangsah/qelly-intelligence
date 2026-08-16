import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('production index loads V7 identity/workbench convergence after legacy UI layers',async()=>{
  const source=await read('apps/web/public/index.html');
  const legacy=source.indexOf('./assets/qelly-ui-lock-v5-3.css');
  const v7=source.indexOf('./assets/qelly-v7-identity-workbench.css');
  assert.ok(legacy>=0);
  assert.ok(v7>legacy);
});

test('V7 identity styling replaces consumer-scale auth geometry with terminal-scale surfaces',async()=>{
  const css=await read('apps/web/public/assets/qelly-v7-identity-workbench.css');
  assert.match(css,/html\[data-product-surface="production"\] \.q-auth-page/);
  assert.match(css,/border-radius:8px!important/);
  assert.match(css,/font-size:clamp\(28px,3\.2vw,44px\)!important/);
  assert.match(css,/backdrop-filter:none!important/);
  assert.match(css,/\.q-password-toggle/);
  assert.doesNotMatch(css,/112px|font-size:clamp\(42px,5\.5vw,78px\)/);
});

test('V7 signed-in profile and deterministic workbench styling remains production-scoped and responsive',async()=>{
  const css=await read('apps/web/public/assets/qelly-v7-identity-workbench.css');
  assert.match(css,/\.q-v6-account-page/);
  assert.match(css,/\.q-calculator-center-page/);
  assert.match(css,/\.q-indicator-center-page/);
  assert.match(css,/min-height:164px!important/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css,/trade-button|order-entry|wallet-connect|withdraw-button|execute-trade/i);
});
