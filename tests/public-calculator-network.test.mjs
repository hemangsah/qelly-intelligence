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

test('calculator generator emits indexable no-login pages and sitemap coverage',async()=>{
  const output=await mkdtemp(path.join(os.tmpdir(),'qelly-calculators-'));
  try{
    await mkdir(output,{recursive:true});
    await writeFile(path.join(output,'sitemap.xml'),'<?xml version="1.0"?><urlset></urlset>');
    const result=await generatePublicCalculatorNetwork({
      output,
      environment:{QELLY_CANONICAL_SITE_URL:'https://terminal.qellyintelligence.com'}
    });
    assert.equal(result.calculators,36);
    const html=await readFile(path.join(output,'calculators','kelly-criterion-calculator','index.html'),'utf8');
    for(const value of [
      '<link rel="canonical"',
      'application/ld+json',
      'BreadcrumbList',
      'FAQPage',
      'Does this calculator require an account?',
      'id="q-calculator-form" data-calculator-form',
      'form="q-calculator-form"',
      'Frequently asked questions',
      'data-qelly-ad-slot="calculator-inline"',
      '/assets/qelly-ad-slot.css',
      '/qelly-config.js',
      'No. It works publicly without login'
    ])assert.ok(html.includes(value),`missing calculator page contract: ${value}`);
    assert.doesNotMatch(html,/auth-login|signup|required account|onclick=|Reserved sponsor space · no ad network configured/i);
    const sitemap=await readFile(path.join(output,'sitemap.xml'),'utf8');
    assert.equal((sitemap.match(/<url>/g)||[]).length,36);
  }finally{
    await rm(output,{recursive:true,force:true});
  }
});
