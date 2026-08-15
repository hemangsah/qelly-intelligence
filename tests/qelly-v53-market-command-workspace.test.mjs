import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const routePath=new URL('../apps/web/public/assets/routes/live-markets.mjs',import.meta.url);
const runtimePath=new URL('../apps/web/public/assets/qelly-ui-lock-v5-3.mjs',import.meta.url);
const cssPath=new URL('../apps/web/public/assets/qelly-v53-market-command-workspace.css',import.meta.url);
const correctionPath=new URL('../apps/web/public/assets/qelly-v53-market-command-workspace-correction.css',import.meta.url);
const read=(url)=>readFile(url,'utf8');
const stripComments=(source)=>source.replace(/\/\*[\s\S]*?\*\//g,'');

test('V5.3 Market Command is activated from the current runtime contract only',async()=>{
  const [runtime,css,correction]=await Promise.all([read(runtimePath),read(cssPath),read(correctionPath)]);
  assert.match(runtime,/qelly-v53-market-command-workspace\.css/);
  assert.match(runtime,/qelly-v53-market-command-workspace-correction\.css/);
  assert.match(runtime,/data-qelly-v53-market-command="wave2"/);
  assert.match(runtime,/data-qelly-v53-market-command-correction="wave2"/);
  assert.match(css,/html\[data-ui-lock-v53="active"\]\[data-v53-active-shell="wave1"\]/);
  assert.match(correction,/html\[data-ui-lock-v53="active"\]\[data-v53-active-shell="wave1"\]/);
  assert.doesNotMatch(css,/data-ui-lock-v5-3/);
  assert.doesNotMatch(correction,/data-ui-lock-v5-3/);
});

test('Market Command keeps all live-market truth and evidence surfaces',async()=>{
  const route=await read(routePath);
  for(const label of ['Last','Change','High','Low','Visible volume','Feed mode'])assert.match(route,new RegExp(`>${label}<`));
  for(const label of ['Source','Observed','Freshness','Confidence','Coverage','Execution'])assert.match(route,new RegExp(`>${label}<`));
  assert.match(route,/id="qelly-live-chart"/);
  assert.match(route,/Market pulse/);
  assert.match(route,/Provider matrix/);
  assert.match(route,/Provider rights/);
  assert.match(route,/Read-only safety lock/);
  assert.match(route,/No order placement, API keys, balances, transfers, withdrawals, private keys or wallet custody/);
  assert.match(route,/Demonstration watch universe/);
  assert.match(route,/values come from the selected governed feed after selection/);
  assert.match(route,/>governed demo<\/small>/);
  assert.match(route,/never labels blocked or simulated observations as live/);
});

test('Market Command workstation topology matches the institutional-density reference without slicing evidence',async()=>{
  const css=stripComments(await read(cssPath));
  assert.match(css,/\.q-live-layout\{[\s\S]*grid-template-columns:minmax\(0,1fr\) 292px/);
  assert.match(css,/\.q-live-chart-shell\{[\s\S]*grid-template-columns:42px minmax\(0,1fr\)/);
  assert.match(css,/PRIMARY ANALYTICAL WORKSPACE/);
  assert.match(css,/INTELLIGENCE INSPECTOR · SOURCE TRUTH/);
  assert.match(css,/\.q-v5-market-ribbon,[\s\S]*\.q-v5-evidence-ribbon\{[\s\S]*repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:900px\)[\s\S]*overflow-x:auto/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
  assert.doesNotMatch(css,/nth-child\([^)]*n\s*\+/);
  assert.doesNotMatch(css,/\.q-v5-(?:market-metric|evidence-cell)[^{]*\{[^}]*display\s*:\s*none/s);
  assert.doesNotMatch(css,/\.q-live-side-stack>\.q-panel[^{]*\{[^}]*display\s*:\s*none/s);
});

test('retained light-card inheritance is explicitly corrected to a fixed dark institutional surface',async()=>{
  const correction=stripComments(await read(correctionPath));
  assert.match(correction,/:where\(\.q-v5-market-metric,\.q-v5-evidence-cell\)[\s\S]*background:#141015!important/);
  assert.match(correction,/:where\(\.q-v5-market-metric,\.q-v5-evidence-cell\)[\s\S]*color:#f5edf1!important/);
  assert.doesNotMatch(correction,/:where\(\.q-v5-market-metric,\.q-v5-evidence-cell\)[\s\S]*background:var\(--q-v53-market-panel-2\)!important/);
  assert.match(correction,/\.q-live-side-stack \.q-panel-head[\s\S]*background:#100c10!important/);
  assert.match(correction,/\.q-tape-card[\s\S]*background:#120d11!important/);
});

test('Market Command layout does not introduce execution or custody controls',async()=>{
  const [css,correction,route]=await Promise.all([read(cssPath),read(correctionPath),read(routePath)]);
  assert.doesNotMatch(css,/trade-button|order-entry|wallet-connect|withdraw-button/i);
  assert.doesNotMatch(correction,/trade-button|order-entry|wallet-connect|withdraw-button/i);
  assert.doesNotMatch(route,/data-action="(?:buy|sell|execute|withdraw|transfer|connect-wallet)"/i);
  assert.match(route,/executionDisabled|Execution<\/span><strong>Disabled/);
});
