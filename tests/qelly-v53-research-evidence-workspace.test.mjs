import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__researchWorkspaceV2Test as ui} from '../apps/web/public/assets/routes/research-workspace.mjs';
import {__researchCloudflareTest as api} from '../functions/api/v1/research/[[route]].js';

const routePath=new URL('../apps/web/public/assets/routes/research-workspace.mjs',import.meta.url);
const cssPath=new URL('../apps/web/public/assets/research-workspace-v2.css',import.meta.url);
const backendPath=new URL('../functions/api/v1/research/[[route]].js',import.meta.url);
const read=(url)=>readFile(url,'utf8');

test('Research Operating System activates its dedicated responsive surface',async()=>{
  const [route,css]=await Promise.all([read(routePath),read(cssPath)]);
  assert.match(route,/research-workspace-v2\.css/);
  assert.match(route,/data-qelly-research-v2/);
  assert.match(css,/\.q-research-v2-layout\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(290px,340px\)/);
  assert.match(css,/\.q-research-v2-evidence-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:1180px\)[\s\S]*\.q-research-v2-layout\{grid-template-columns:1fr\}/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.q-research-v2-kpis\{display:flex;overflow-x:auto/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.q-research-v2-evidence-grid[^}]*grid-template-columns:1fr/);
  assert.doesNotMatch(css,/visibility\s*:\s*hidden/);
});

test('Research charter and evidence capture preserve the advanced governed fields',async()=>{
  const [route,backend]=await Promise.all([read(routePath),read(backendPath)]);
  for(const field of ['hypothesis','invalidationConditions','confidence','evidenceRole','referenceId','sourceUrl','method','assumptions','contradictions','limitations']){
    assert.match(`${route}\n${backend}`,new RegExp(field),`missing governed field: ${field}`);
  }
  for(const feature of ['Research charter','Evidence register','Counter-evidence','Decision readiness','Recent evidence','Official source launchpad']){
    assert.match(route,new RegExp(feature),`missing research capability: ${feature}`);
  }
  assert.match(route,/Confidence is analyst-declared/);
  assert.match(route,/research completeness, not prediction accuracy/i);
});

test('Research completeness is deterministic and does not misread a missing confidence value',()=>{
  const empty=ui.readinessFor({hypothesis:'',invalidationConditions:[],confidence:null},[]);
  assert.equal(empty.score,0);
  assert.equal(empty.checks.find((check)=>check.id==='confidence').pass,false);
  const complete=ui.readinessFor({hypothesis:'Rates decline',invalidationConditions:['Rates rise'],confidence:.6},[
    {evidenceRole:'supporting',referenceId:'ECB-1',method:'Official release',limitations:[],assumptions:[]},
    {evidenceRole:'counter',sourceUrl:'https://example.com/counter',limitations:['Lagged'],assumptions:[]}
  ]);
  assert.equal(complete.score,100);
  assert.equal(complete.label,'Review ready');
});

test('Research API validates evidence roles, HTTPS sources and bounded structured lists',()=>{
  assert.equal(api.safeEvidenceRole('counter'),'counter');
  assert.throws(()=>api.safeEvidenceRole('optimistic'),/Evidence role is invalid/);
  assert.equal(api.safeSourceUrl('https://example.com/record'),'https://example.com/record');
  assert.throws(()=>api.safeSourceUrl('http://example.com/record'),/must use HTTPS/);
  assert.throws(()=>api.safeSourceUrl('https://user:secret@example.com/record'),/must use HTTPS/);
  assert.deepEqual(api.cleanList(['  one  ','',42]),['one','42']);
});

test('Research handoffs connect Qelly Chat, revision history and Decision Provenance',async()=>{
  const route=await read(routePath);
  assert.match(route,/qelly:open-ai/);
  assert.match(route,/mode:'research'/);
  assert.match(route,/navigate\('research-history'\)/);
  assert.match(route,/qelly\.decision\.draft\.v1/);
  assert.match(route,/navigate\('decision-provenance'\)/);
  assert.match(route,/invalidationCondition/);
  assert.match(route,/evidenceConfidence/);
});

test('Research remains intelligence-only with no execution, custody or hidden ingestion',async()=>{
  const [route,css]=await Promise.all([read(routePath),read(cssPath)]);
  assert.doesNotMatch(route,/data-action="(?:buy|sell|execute|withdraw|transfer|connect-wallet|sign-wallet)"/i);
  assert.doesNotMatch(css,/trade-button|order-entry|wallet-connect|withdraw-button|transfer-button/i);
  assert.match(route,/execution disabled/);
  assert.match(route,/does not execute trades/);
  assert.match(route,/no automatic ingestion/);
});
