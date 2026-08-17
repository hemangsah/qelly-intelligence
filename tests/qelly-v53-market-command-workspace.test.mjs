import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const routePath=new URL('../apps/web/public/assets/routes/market-network.mjs',import.meta.url);
const wrapperPath=new URL('../apps/web/public/assets/routes/live-markets.mjs',import.meta.url);
const runtimePath=new URL('../apps/web/public/assets/qelly-ui-lock-v5-3.mjs',import.meta.url);
const legacyCssPath=new URL('../apps/web/public/assets/qelly-v53-market-command-workspace.css',import.meta.url);
const correctionPath=new URL('../apps/web/public/assets/qelly-v53-market-command-workspace-correction.css',import.meta.url);
const networkCssPath=new URL('../apps/web/public/assets/routes/market-network.css',import.meta.url);
const read=(url)=>readFile(url,'utf8');
const stripComments=(source)=>source.replace(/\/\*[\s\S]*?\*\//g,'');

test('V5.3 compatibility layers remain packaged while the current renderer has one explicit owner',async()=>{
  const [runtime,css,correction,wrapper]=await Promise.all([read(runtimePath),read(legacyCssPath),read(correctionPath),read(wrapperPath)]);
  assert.match(runtime,/qelly-v53-market-command-workspace\.css/);
  assert.match(runtime,/qelly-v53-market-command-workspace-correction\.css/);
  assert.match(css,/html\[data-ui-lock-v53="active"\]\[data-v53-active-shell="wave1"\]/);
  assert.match(correction,/html\[data-ui-lock-v53="active"\]\[data-v53-active-shell="wave1"\]/);
  assert.match(wrapper,/renderGlobalMarketNetwork/);
  assert.doesNotMatch(wrapper,/innerHTML/);
});

test('Global Market Network keeps governed truth, provenance and external-display boundaries without demo observations',async()=>{
  const route=await read(routePath);
  for(const label of ['Release','Fabricated fallback','Internal execution','Crypto provider rights'])assert.match(route,new RegExp(label));
  for(const label of ['Provider provenance','ECB governed FX reference','Global macro context','Official research network'])assert.match(route,new RegExp(label));
  assert.match(route,/id="q-market-network-chart"/);
  assert.match(route,/Coinbase \/ Binance blocked/);
  assert.match(route,/No fabricated fallback values/);
  assert.match(route,/TradingView is an external display boundary/);
  assert.match(route,/Qelly does not scrape or reuse widget values/);
  assert.match(route,/CoinPaprika Free is not used for commercial production redistribution/);
  assert.doesNotMatch(route,/Demonstration watch universe|governed demo|simulated observations as live/i);
});

test('Global Market Network workstation topology is responsive and preserves all evidence surfaces',async()=>{
  const css=stripComments(await read(networkCssPath));
  assert.match(css,/\.q-mn-workbench\{[\s\S]*grid-template-columns:minmax\(0,1\.55fr\) minmax\(320px,\.75fr\)/);
  assert.match(css,/\.q-mn-status-grid\{[\s\S]*repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/\.q-mn-source-grid\{[\s\S]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/\.q-mn-table-wrap\{overflow-x:auto\}/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
  assert.doesNotMatch(css,/nth-child\([^)]*n\s*\+/);
});

test('retained legacy light-card inheritance remains explicitly corrected for routes that still use it',async()=>{
  const correction=stripComments(await read(correctionPath));
  assert.match(correction,/:where\(\.q-v5-market-metric,\.q-v5-evidence-cell\)[\s\S]*background:#141015!important/);
  assert.match(correction,/:where\(\.q-v5-market-metric,\.q-v5-evidence-cell\)[\s\S]*color:#f5edf1!important/);
  assert.doesNotMatch(correction,/:where\(\.q-v5-market-metric,\.q-v5-evidence-cell\)[\s\S]*background:var\(--q-v53-market-panel-2\)!important/);
});

test('Global Market Network does not introduce execution or custody controls',async()=>{
  const [css,route]=await Promise.all([read(networkCssPath),read(routePath)]);
  assert.doesNotMatch(css,/trade-button|order-entry|wallet-connect|withdraw-button/i);
  assert.doesNotMatch(route,/data-action="(?:buy|sell|execute|withdraw|transfer|connect-wallet)"/i);
  assert.match(route,/Internal execution/);
  assert.match(route,/>DISABLED</);
  assert.match(route,/No fabricated fallback values/);
});
