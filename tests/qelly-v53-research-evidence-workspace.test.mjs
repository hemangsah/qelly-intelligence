import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const routePath=new URL('../apps/web/public/assets/routes/research-workspace.mjs',import.meta.url);
const runtimePath=new URL('../apps/web/public/assets/qelly-ui-lock-v5-3.mjs',import.meta.url);
const cssPath=new URL('../apps/web/public/assets/qelly-v53-research-evidence-workspace.css',import.meta.url);
const storePath=new URL('../src/workspace/workspace-operations-store.mjs',import.meta.url);
const read=(url)=>readFile(url,'utf8');
const stripComments=(source)=>source.replace(/\/\*[\s\S]*?\*\//g,'');

test('V5.3 Research & Evidence is activated only through the current runtime contract',async()=>{
  const [runtime,css]=await Promise.all([read(runtimePath),read(cssPath)]);
  assert.match(runtime,/qelly-v53-research-evidence-workspace\.css/);
  assert.match(runtime,/data-qelly-v53-research-evidence="wave3"/);
  assert.match(css,/html\[data-ui-lock-v53="active"\]\[data-v53-active-shell="wave1"\]/);
  assert.doesNotMatch(css,/data-ui-lock-v5-3/);
});

test('Research workspace exposes only evidence fields supported by the authoritative store',async()=>{
  const [route,store]=await Promise.all([read(routePath),read(storePath)]);
  for(const field of ['researchWorkspaceId','revision','createdAt','updatedAt','items','referenceId','addedAt'])assert.match(store,new RegExp(field));
  for(const truth of ['Workspaces','Evidence items','References','Revision','Persistence','Contradictions'])assert.match(route,new RegExp(`>${truth}<`));
  assert.match(route,/Contradiction \/ falsification/);
  assert.match(route,/not modeled/i);
  assert.match(route,/does not store structured contradiction, hypothesis confidence or falsification records/);
  assert.doesNotMatch(store,/contradictionCount|hypothesisConfidence|falsificationScore/);
  assert.doesNotMatch(route,/87%|0\.78|Neutral|18 s|Q-MX 2\.4|Q5-003/);
});

test('Research evidence topology preserves real items, references, timestamps and production gates',async()=>{
  const route=await read(routePath);
  for(const marker of ['data-evidence="research-item"','data-evidence="research-reference"','data-provenance="workspace-truth"','data-provenance="source-references"','data-provenance="falsification-boundary"','data-provenance="production-gates"'])assert.match(route,new RegExp(marker));
  assert.match(route,/item\.referenceId\?\?'local-note'/);
  assert.match(route,/item\.addedAt/);
  assert.match(route,/workspace\.revision/);
  assert.match(route,/listing\.collaboration/);
  for(const deferred of ['Comments / presence','External sharing','Research export'])assert.match(route,new RegExp(deferred));
  assert.match(route,/They are not simulated as complete/);
});

test('Research workstation matches the institutional topology without hiding evidence',async()=>{
  const css=stripComments(await read(cssPath));
  assert.match(css,/\.q-research-workstation\{[\s\S]*grid-template-columns:218px minmax\(0,1fr\) 300px/);
  assert.match(css,/PRIMARY ANALYTICAL WORKSPACE \/ CONTEXT \/ INTELLIGENCE INSPECTOR/);
  assert.match(css,/\.q-research-evidence-grid\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:900px\)[\s\S]*\.q-research-evidence-grid\{[\s\S]*overflow-x:auto/);
  assert.match(css,/@media\(max-width:640px\)[\s\S]*\.q-research-kpi-strip\{[\s\S]*overflow-x:auto/);
  assert.match(css,/@media\(max-width:640px\)[\s\S]*\.q-research-inspector\{[\s\S]*overflow-x:auto/);
  assert.match(css,/font-variant-numeric:tabular-nums lining-nums/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
  assert.doesNotMatch(css,/\.q-research-evidence-card[^\{]*\{[^}]*display\s*:\s*none/s);
  assert.doesNotMatch(css,/nth-child\([^)]*n\s*\+/);
});

test('Research workspace remains read-only financial intelligence with no execution or custody controls',async()=>{
  const [route,css]=await Promise.all([read(routePath),read(cssPath)]);
  assert.doesNotMatch(route,/data-action="(?:buy|sell|execute|withdraw|transfer|connect-wallet|sign-wallet)"/i);
  assert.doesNotMatch(css,/trade-button|order-entry|wallet-connect|withdraw-button|transfer-button/i);
  assert.match(route,/navigate\('portfolio-analytics'\)/);
  assert.match(route,/navigate\('research-history'\)/);
});
