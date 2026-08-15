import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const cleanupPath=new URL('../apps/web/public/assets/qelly-v53-lock-route-cleanup.mjs',import.meta.url);
const cssPath=new URL('../apps/web/public/assets/qelly-v53-real-market.css',import.meta.url);

test('Market joins Live Markets as a real-DOM route instead of receiving the simulated reference overlay',async()=>{
  const source=await readFile(cleanupPath,'utf8');
  assert.match(source,/DEDICATED_REAL_ROUTES=new Set\(\[[^\]]*'live-markets'[^\]]*'market'[^\]]*\]/s);
  assert.match(source,/synthetic&&isDedicatedRealRoute\(\)/);
  assert.match(source,/root\.dataset\.v53RealMarket='active'/);
  assert.match(source,/qelly-v53-real-market\.css/);
});

test('real Market density is route-scoped and keeps the functional analytical DOM visible',async()=>{
  const css=await readFile(cssPath,'utf8');
  assert.match(css,/html\[data-v53-real-market="active"\] #main > \.q-page/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\) 292px/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/grid-template-columns:1fr/);
  assert.match(css,/scroll-snap-type:x mandatory/);
  assert.doesNotMatch(css,/\.q-v53-lock-page/);
  assert.doesNotMatch(css,/display\s*:\s*none/);
});

test('real Market convergence does not introduce execution or custody affordances',async()=>{
  const css=await readFile(cssPath,'utf8');
  const source=await readFile(cleanupPath,'utf8');
  assert.doesNotMatch(`${css}\n${source}`,/trade-button|order-entry|wallet-connect|withdraw-button|execute-trade/i);
});
