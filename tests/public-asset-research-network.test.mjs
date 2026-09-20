import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PUBLIC_ASSET_RESEARCH,generatePublicAssetResearch} from '../scripts/generate-public-asset-research.mjs';

const expected=['BTC','ETH','SOL','XRP','HYPE','DOGE'];

test('public asset research is bounded to the six live-evidence assets',()=>{
  assert.deepEqual(PUBLIC_ASSET_RESEARCH.map(item=>item.symbol),expected);
  assert.equal(new Set(PUBLIC_ASSET_RESEARCH.map(item=>item.slug)).size,6);
  assert.equal(PUBLIC_ASSET_RESEARCH.some(item=>item.symbol==='ADA'),false);
});

test('generator emits useful crawlable pages, preserves sitemap entries and converges on rerun',async()=>{
  const output=await mkdtemp(path.join(os.tmpdir(),'qelly-asset-research-'));
  try{
    await mkdir(output,{recursive:true});
    const existing='  <url><loc>https://terminal.qellyintelligence.com/calculators/volatility-calculator/</loc></url>';
    await writeFile(path.join(output,'sitemap.xml'),'<?xml version="1.0"?><urlset>'+existing+'</urlset>');
    const environment={QELLY_CANONICAL_SITE_URL:'https://terminal.qellyintelligence.com'};
    const first=await generatePublicAssetResearch({output,environment});
    const second=await generatePublicAssetResearch({output,environment});
    assert.equal(first.assets,6);assert.equal(second.assets,6);
    for(const item of PUBLIC_ASSET_RESEARCH){
      const file=path.join(output,'research','assets',item.slug,'index.html');
      await access(file);
      const html=await readFile(file,'utf8');
      for(const value of [
        '<h1>'+item.name,
        'data-qelly-asset-research="'+item.canonicalId+'"',
        'Current public observation',
        'Source &amp; freshness',
        'Interpretation boundary',
        'Evidence before interpretation',
        'Open live Asset Dossier',
        '/#/decision-provenance',
        '/#/news-research',
        '/calculators/volatility-calculator/',
        'application/ld+json',
        'BreadcrumbList',
        'https://terminal.qellyintelligence.com/research/assets/'+item.slug+'/'
      ])assert.ok(html.includes(value),'missing '+item.symbol+' page contract: '+value);
      assert.doesNotMatch(html,/pages\.dev|auth-login|sign in required|guaranteed return|price target/i);
    }
    const sitemap=await readFile(path.join(output,'sitemap.xml'),'utf8');
    assert.ok(sitemap.includes(existing));
    for(const item of PUBLIC_ASSET_RESEARCH){
      const url='https://terminal.qellyintelligence.com/research/assets/'+item.slug+'/';
      assert.equal(sitemap.split(url).length-1,1,'expected one sitemap entry for '+item.symbol);
    }
    assert.equal((sitemap.match(/\/research\/assets\//g)||[]).length,6);
    assert.doesNotMatch(sitemap,/cardano|\/ada\//i);
  }finally{await rm(output,{recursive:true,force:true});}
});

test('asset research runtime fails closed instead of inventing observations',async()=>{
  const runtime=await readFile(new URL('../apps/web/public/assets/asset-research.mjs',import.meta.url),'utf8');
  assert.match(runtime,/\/api\/v1\/public\/markets\/assets\//);
  assert.match(runtime,/No substitute price, trend or market narrative has been generated/);
  assert.match(runtime,/UNAVAILABLE · no fabricated fallback/);
  assert.doesNotMatch(runtime,/Math\.random|fallbackPrice|mockPrice|fixturePrice/);
});
