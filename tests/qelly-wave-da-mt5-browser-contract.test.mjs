import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Browser E2E includes synthetic HTML/XLSX MT5 uploads, constrained analysis and local-only evidence',async()=>{
 const [workflow,source]=await Promise.all([readFile(new URL('../.github/workflows/browser-e2e.yml',import.meta.url),'utf8'),readFile(new URL('../scripts/qelly-mt5-upload-e2e.mjs',import.meta.url),'utf8')]);
 assert.match(workflow,/Verify local MT5 HTML and XLSX upload interactions/);
 assert.match(workflow,/node scripts\/qelly-mt5-upload-e2e\.mjs/);
 assert.match(workflow,/preview\/mt5-upload-e2e/);
 for(const marker of ["name==='desktop'","six-deals.xlsx","six-deals.html","two-deals.html","data-verify-file","q-verify-mt5-only","mt5ClosedDealAnalysis.metrics.sharpe","acceptDownloads:true","window.__qellyMt5UploadXss"]){assert.ok(source.includes(marker),marker);}
});
