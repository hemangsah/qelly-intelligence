import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('production finalizer contains no placeholder or truncated probe content',async()=>{
  const source=await read('scripts/finalize-public-runtime.mjs');
  assert.doesNotMatch(source,/^PLACEHOLDER\s*$/m);
  assert.match(source,/export function rewritePublicRuntimeAsset/);
  assert.match(source,/export async function finalizePublicRuntime/);
  assert.match(source,/QELLY_REQUIRE_PUBLIC_RUNTIME/);
  assert.match(source,/QELLY_PUBLIC_SITE_URL/);
});

test('production finalizer owns every V6 migration currently required by Cloudflare',async()=>{
  const source=await read('scripts/finalize-public-runtime.mjs');
  for(const module of [
    'provider-runtime-v6.mjs',
    'instrument-master-v6.mjs',
    'time-series-v6.mjs',
    'calculator-detail-v6.mjs',
    'indicator-detail-v6.mjs',
    'portfolio-v6-entry.mjs'
  ])assert.match(source,new RegExp(module.replaceAll('.','\\.')));
  assert.match(source,/Legacy provider fixture renderer remains active/);
  assert.match(source,/Legacy synthetic instrument renderer remains active/);
  assert.match(source,/Legacy synthetic time-series renderer remains active/);
  assert.match(source,/Legacy calculator-detail renderer remains active/);
  assert.match(source,/Legacy indicator-detail renderer remains active/);
  assert.match(source,/V6 portfolio renderer is not active/);
});

test('Cloudflare production finalizer preserves canonical identity and no-transform cache policy',async()=>{
  const source=await read('scripts/finalize-public-runtime.mjs');
  assert.match(source,/rel=\"canonical\"/);
  assert.match(source,/og:url/);
  assert.match(source,/public, max-age=0, must-revalidate, no-transform/);
  assert.match(source,/Legacy public origin remains/);
});

test('Portfolio finalization preserves route cancellation and retry dependencies at the actual V6 entry',async()=>{
  const {rewritePublicRuntimeAsset}=await import('../scripts/finalize-public-runtime.mjs');
  const common='pageHead,stateBanner,escapeHtml,QellyDataGrid,QellyChartShell,formatCompact,navigate';
  for(const forward of ['', 'signal:controller.signal,renderRoute,']){
    const source="case 'portfolio-analytics': await renderPortfolioAnalytics(main,{api,"+forward+common+"}); break;";
    const result=rewritePublicRuntimeAsset(source,{file:'assets/app.js'});
    assert.ok(result.includes("import('./routes/portfolio-v6-entry.mjs')"));
    assert.ok(result.includes('renderPortfolioV6Entry(main,{api,'+forward+common+'})'));
    assert.doesNotMatch(result,/await renderPortfolioAnalytics\(main/);
  }
});
