import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PUBLIC_CALCULATORS,generatePublicCalculatorNetwork} from '../scripts/generate-public-calculator-network.mjs';

test('calculator network declares the requested 36 distinct public utilities',()=>{
  assert.equal(PUBLIC_CALCULATORS.length,36);
  assert.equal(new Set(PUBLIC_CALCULATORS.map(item=>item.slug)).size,36);
  assert.ok(PUBLIC_CALCULATORS.some(item=>item.slug==='kelly-criterion-calculator'));
  assert.ok(PUBLIC_CALCULATORS.some(item=>item.slug==='sip-calculator'));
});

test('calculator generator emits a crawlable collection hub plus 36 substantive no-login pages',async()=>{
  const output=await mkdtemp(path.join(os.tmpdir(),'qelly-calculators-'));
  try{
    await mkdir(output,{recursive:true});
    await writeFile(path.join(output,'sitemap.xml'),'<?xml version="1.0"?><urlset></urlset>');
    const result=await generatePublicCalculatorNetwork({
      output,
      environment:{QELLY_CANONICAL_SITE_URL:'https://terminal.qellyintelligence.com'}
    });
    assert.equal(result.calculators,36);
    assert.equal(result.directory,true);
    assert.equal(result.sitemapEntries,37);

    const directory=await readFile(path.join(output,'calculators','index.html'),'utf8');
    for(const value of [
      '<link rel="canonical" href="https://terminal.qellyintelligence.com/calculators/">',
      'CollectionPage',
      'ItemList',
      '36 public, deterministic calculators',
      'Formula + assumptions',
      '/calculators/kelly-criterion-calculator/',
      '/calculators/sip-calculator/'
    ])assert.ok(directory.includes(value),`missing calculator directory contract: ${value}`);
    assert.equal((directory.match(/href="\/calculators\/[a-z0-9-]+\//g)||[]).length,36);
    assert.doesNotMatch(directory,/auth-login|signup|required account/i);

    const html=await readFile(path.join(output,'calculators','kelly-criterion-calculator','index.html'),'utf8');
    for(const value of [
      '<link rel="canonical"',
      'application/ld+json',
      'BreadcrumbList',
      'FAQPage',
      'Does this calculator require an account?',
      'Can I share my inputs?',
      'id="q-calculator-form" data-calculator-form',
      'form="q-calculator-form"',
      'Worked example',
      'Input glossary',
      'Assumptions and limits',
      'Edge cases',
      'Frequently asked questions',
      'data-qelly-ad-slot="calculator-inline"',
      '/assets/qelly-ad-slot.css',
      '/qelly-config.js',
      '<a href="/calculators/">Calculators</a>',
      'No. It works publicly without login'
    ])assert.ok(html.includes(value),`missing calculator page contract: ${value}`);
    assert.doesNotMatch(html,/auth-login|signup|required account|onclick=|Reserved sponsor space · no ad network configured/i);

    const sitemap=await readFile(path.join(output,'sitemap.xml'),'utf8');
    assert.equal((sitemap.match(/<url>/g)||[]).length,37);
    assert.match(sitemap,/<loc>https:\/\/terminal\.qellyintelligence\.com\/calculators\/<\/loc>/);
  }finally{
    await rm(output,{recursive:true,force:true});
  }
});

test('calculator sharing uses a privacy-safe URL fragment and restores only registered inputs',async()=>{
  const runtime=await readFile(new URL('../apps/web/public/assets/calculator-network.mjs',import.meta.url),'utf8');
  assert.match(runtime,/location\.hash\.startsWith\('#q='\)/);
  assert.match(runtime,/JSON\.parse\(decodeURIComponent\(raw\)\)/);
  assert.match(runtime,/Object\.entries\(config\.schema\.properties\|\|\{\}\)/);
  assert.match(runtime,/url\.hash=\`q=\$\{encoded\}\`/);
  assert.match(runtime,/inputs are stored only in the URL fragment, not on QELLY servers/);
  assert.match(runtime,/history\.replaceState\(null,'',location\.pathname\+location\.search\)/);
  assert.doesNotMatch(runtime,/url\.searchParams\.set|localStorage/);
});

test('calculator directory and educational sections remain mobile-contained',async()=>{
  const css=await readFile(new URL('../apps/web/public/assets/calculator-network.css',import.meta.url),'utf8');
  assert.match(css,/\.q-cn-directory-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.q-cn-input-guide\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:800px\)\{\.q-cn-example-grid,\.q-cn-input-guide\{grid-template-columns:1fr\}\.q-cn-directory-grid\{grid-template-columns:1fr\}\}/);
});
