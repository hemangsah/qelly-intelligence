import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';
import {routes as serverRoutes} from '../src/server/route-manifest.mjs';
import {renderMt5ReportAnalyzer} from '../apps/web/public/assets/qelly-mt5-analyzer-route.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('standalone MT5 Analyzer is a first-class public tool with coherent identity',()=>{
 const found=routeDefinitions.filter(x=>x.route==='mt5-report-analyzer');
 assert.equal(found.length,1);
 assert.equal(serverRoutes.length,72);
 assert.equal(serverRoutes.filter(route=>route==='mt5-report-analyzer').length,1);
 assert.deepEqual(new Set(serverRoutes),new Set(routeDefinitions.map(route=>route.route)));
 assert.equal(found[0].featureFlags.public,true);
 assert.equal(found[0].domain,'tools');assert.equal(found[0].category,'tools');
 assert.equal(found[0].pageTitle,'MT5 Report Analyzer');
 assert.equal(found[0].canonical,'#/mt5-report-analyzer');
 assert.equal(found[0].breadcrumbs.at(-1).route,'mt5-report-analyzer');
});
test('Release and smoke checks require the expanded canonical route set',async()=>{
 const [releaseCheck,smoke]=await Promise.all([read('scripts/release-check.mjs'),read('scripts/smoke.mjs')]);
 assert.match(releaseCheck,/routes\.length !== 72/);
 assert.match(smoke,/config\.routes\.length === 72/);
 assert.match(smoke,/config\.routes\.includes\('mt5-report-analyzer'\)/);
});
test('one authoritative route invokes dedicated renderer and clears local files before leaving',async()=>{
 const app=await read('apps/web/public/assets/app.js');
 assert.match(app,/renderMt5ReportAnalyzer=lazyRoute\('\.\/qelly-mt5-analyzer-route\.mjs','renderMt5ReportAnalyzer'\)/);
 assert.match(app,/case 'mt5-report-analyzer': await renderMt5ReportAnalyzer\(main\); break;/);
 assert.match(app,/window\.__qellyMt5AnalyzerCleanup\?\.\(\)/);
 assert.match(app,/window\.__qellyMt5AnalyzerCleanup=null/);
});
test('MT5 HTML/XLSX analysis reuses validated parser and never transports or persists source files',async()=>{
 const route=await read('apps/web/public/assets/qelly-mt5-analyzer-route.mjs');
 const processor=await read('apps/web/public/assets/qelly-mt5-local-analysis.mjs');
 const m=route+'\n'+processor;
 for(const token of ['parseMt5Html','parseMt5Xlsx','MT5_REPORT_LIMITS.rows','analyzeMt5ClosedDeals',
  'renderMt5ClosedDealEvidence','compareMt5ClosedDealReports',
  'renderMt5Comparison','MAX_BYTES=5*1024*1024','file.arrayBuffer()','createLocalMt5Task','tasks[slot]?.cancel()',
  'generation[slot]!==token','resetMt5ReportAnalyzer','data-mt5-route-drop']){
  assert.ok(m.includes(token),token);
 }
 assert.doesNotMatch(m,/localStorage|sessionStorage|indexedDB|navigator\.sendBeacon|fetch\(|XMLHttpRequest|service_role|password:/);
 const sharing=await read('apps/web/public/assets/qelly-mt5-share-safe.mjs');
 assert.match(sharing,/rawFilesRetained:false,sourceRowsIncluded:false,accountIdentifiersIncluded:false,uploaded:false/);
 assert.throws(()=>renderMt5ReportAnalyzer(null),/existing QELLY main/);
});
test('standalone UI has responsive keyboard-accessible upload and cleared memory state',async()=>{
 const [ui,css]=await Promise.all([read('apps/web/public/assets/qelly-mt5-analyzer-route.mjs'),read('apps/web/public/assets/qelly-mt5-analyzer.css')]);
 for(const token of ['data-mt5-route-input','data-mt5-route-reset','data-mt5-route-clear','data-mt5-route-export',
  'aria-describedby','role="status"','aria-live="polite"','owner=null','generation[slot]++','document.title']){
  assert.ok(ui.includes(token),token);
 }
 assert.match(css,/:focus-within/);assert.match(css,/:focus-visible/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css, /prefers-reduced-motion/);
});
test('browser acceptance exercises separate route without weakening QELLY Verify or sample governance',async()=>{
 const script=await read('scripts/qelly-mt5-upload-e2e.mjs');
 for(const s of ['#/qelly-verify','#/mt5-report-analyzer','data-mt5-route-input="A"',
  'data-mt5-route-input="B"','data-mt5-route-reset','qelly.mt5.share-safe-local/1.1',
  'window.__qellyMt5UploadXss','location.hash=\'#/market\'','q-mt5-route-empty','standalone-mt5.png']){
  assert.ok(script.includes(s),s);
 }
 assert.match(script,/assert\.deepEqual\(uploads,\[\]\)/);
});

test('full-screen browser evidence follows registered route count and exact archive head',async()=>{
 const workflow=await read('.github/workflows/browser-e2e.yml');
 assert.match(workflow,/routeDefinitions\.length/);
 assert.match(workflow,/expectedRenders=expectedRoutes\*2/);
 assert.match(workflow,/pngs\.length===expectedRenders/);
 assert.match(workflow,/manifest\.routeCount===expectedRoutes/);
 assert.match(workflow,/manifest\.expectedRenderCount===expectedRenders/);
 assert.match(workflow,/QELLY_SCREEN_EVIDENCE_SHA\.slice\(0,12\)/);
 assert.match(workflow,/accessibility\.status==='passed'/);
 assert.match(workflow,/Verify Decision selected-range interaction/);
 assert.doesNotMatch(workflow,/manifest\.routeCount===71|manifest\.renderCount===142/);
});
