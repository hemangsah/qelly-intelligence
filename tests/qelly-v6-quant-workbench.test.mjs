import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rewritePublicRuntimeAsset} from '../scripts/finalize-public-runtime.mjs';
import {__connectedSaveTest} from '../apps/web/public/assets/calculation/connected-save.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('connected save reports local, cloud, queued and conflict outcomes without hiding local durability',()=>{
  const {summarizeTransfer}=__connectedSaveTest;
  assert.equal(summarizeTransfer(null).state,'LOCAL');
  assert.equal(summarizeTransfer({conflicts:[{}],remaining:0}).state,'CONFLICT');
  assert.equal(summarizeTransfer({offline:true,remaining:1}).state,'QUEUED');
  assert.equal(summarizeTransfer({flushed:1,remaining:0,conflicts:[],failedBatches:[]}).state,'CLOUD');
  assert.match(summarizeTransfer({conflicts:[{}],remaining:0}).message,/nothing was silently overwritten/i);
});

test('calculator center presents deterministic computation rather than simulated market data',async()=>{
  const source=await read('apps/web/public/assets/routes/calculator-center.mjs');
  assert.match(source,/DETERMINISTIC LOCAL/);
  assert.match(source,/not simulated market data/i);
  assert.match(source,/Execution/);
  assert.match(source,/qelly-v6-quant-workbench\.css/);
  assert.doesNotMatch(source,/q-status--simulated/);
});

test('indicator library separates deterministic engine evidence from live market data',async()=>{
  const source=await read('apps/web/public/assets/routes/indicator-library.mjs');
  assert.match(source,/DETERMINISTIC ENGINE/);
  assert.match(source,/reference vector or a clearly labeled presentation sample/i);
  assert.match(source,/not live market data/i);
  assert.match(source,/Execution/);
  assert.doesNotMatch(source,/q-status--simulated/);
});

test('V6 calculator detail preserves the validated engine and adds cloud-aware post-save synchronization',async()=>{
  const source=await read('apps/web/public/assets/routes/calculator-detail-v6.mjs');
  assert.match(source,/renderLegacyCalculatorDetail/);
  assert.match(source,/DETERMINISTIC LOCAL/);
  assert.match(source,/syncSavedCalculationIfOptedIn/);
  assert.match(source,/listSavedCalculations/);
  assert.match(source,/conflicts are never silently overwritten/i);
  assert.doesNotMatch(source,/calculateFormula\(/);
});

test('V6 indicator detail preserves the validated engine and labels samples as evidence rather than live observations',async()=>{
  const source=await read('apps/web/public/assets/routes/indicator-detail-v6.mjs');
  assert.match(source,/renderLegacyIndicatorDetail/);
  assert.match(source,/GOVERNED REFERENCE VECTOR/);
  assert.match(source,/PRESENTATION SAMPLE/);
  assert.match(source,/not a live market feed/i);
  assert.match(source,/syncSavedCalculationIfOptedIn/);
  assert.doesNotMatch(source,/calculateIndicator\(/);
});

test('connected-save helper pushes only after authenticated cloud opt-in is proven',async()=>{
  const source=await read('apps/web/public/assets/calculation/connected-save.mjs');
  const authenticatedCheck=source.indexOf('if(!status.authenticated)');
  const optInCheck=source.indexOf('if(!status.optIn)');
  const push=source.indexOf('pushLocalToCloud(api,[item])');
  assert.ok(authenticatedCheck>=0&&optInCheck>authenticatedCheck&&push>optInCheck,'cloud push must occur only after auth and opt-in checks');
  assert.match(source,/Saved locally\. Cloud synchronization is currently opted out\./);
});

test('public-runtime finalizer replaces both legacy quant detail renderers and passes the authenticated API client',()=>{
  const legacy=[
    "case 'calculator-detail': await renderCalculatorDetail(main,{pageHead,stateBanner,escapeHtml,toast,navigate,id,query}); break;",
    "case 'indicator-detail': await renderIndicatorDetail(main,{pageHead,stateBanner,escapeHtml,toast,navigate,id}); break;"
  ].join('\n');
  const rewritten=rewritePublicRuntimeAsset(legacy,{file:'assets/app.js'});
  assert.doesNotMatch(rewritten,/await renderCalculatorDetail\(main/);
  assert.doesNotMatch(rewritten,/await renderIndicatorDetail\(main/);
  assert.match(rewritten,/calculator-detail-v6\.mjs/);
  assert.match(rewritten,/indicator-detail-v6\.mjs/);
  assert.match(rewritten,/renderCalculatorDetailV6\(main,\{api,pageHead/);
  assert.match(rewritten,/renderIndicatorDetailV6\(main,\{api,pageHead/);
});

test('shared V6 quant styling includes deterministic state, responsive density and reduced-motion containment',async()=>{
  const css=await read('apps/web/public/assets/qelly-v6-quant-workbench.css');
  assert.match(css,/q-status--deterministic/);
  assert.match(css,/q-v6-quant-kpis/);
  assert.match(css,/q-v6-result-evidence/);
  assert.match(css,/prefers-reduced-motion/);
});
