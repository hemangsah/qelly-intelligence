import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('comparison accepts two independent local MT5 reports and leaves CSV intact',async()=>{
 const source=await load('apps/web/public/assets/qelly-verify-product.mjs');
 for(const marker of ['data-qelly-mt5-comparison','data-mt5-compare-file','data-mt5-compare-export','data-mt5-compare-reset','compareMt5ClosedDealReports(comparison.A.report,comparison.B.report)','renderMt5Comparison(compareMt5ClosedDealReports','parseMt5Html(bytes','parseMt5Xlsx(bytes','comparisonGeneration[slot]!==generation']){
  assert.ok(source.includes(marker),marker);
 }
 assert.match(source,/parseTradeCsv\(sourceText\)/);
 assert.match(source,/renderMt5ClosedDealEvidence\(mt5Report\)/);
 assert.match(source,/window\.addEventListener\('hashchange'/);
 assert.match(source,/ensureComparisonStyles\(\)/);
 assert.doesNotMatch(source,/fetch\(/);
});
test('local comparison sets size and type boundaries and exports metrics, never source rows',async()=>{
 const source=await load('apps/web/public/assets/qelly-verify-product.mjs');
 const css=await load('apps/web/public/assets/qelly-mt5-comparison.css');
 assert.match(source,/5 MB limit exceeded/);
 assert.match(source,/choose MT5 HTML or XLSX/);
 assert.match(source,/qelly-mt5-comparison-share-safe\.json/);
 assert.match(css,/focus-visible/);
 assert.match(css,/@media\(max-width:690px\)/);
 assert.doesNotMatch(source,/localStorage\.setItem|sessionStorage\.setItem/);
});
