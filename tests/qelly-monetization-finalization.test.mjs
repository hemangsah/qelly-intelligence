import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generatePublicCalculatorNetwork} from '../scripts/generate-public-calculator-network.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');

test('shared ad runtime is consent-gated, lazy, configured from production runtime and fails gracefully',async()=>{
  const [runtime,styles]=await Promise.all([
    read('apps/web/public/assets/qelly-ad-slot.mjs'),
    read('apps/web/public/assets/qelly-ad-slot.css')
  ]);
  assert.match(runtime,/__QELLY_CONFIG__\?\.ads/);
  assert.match(runtime,/qelly-consent-v1/);
  assert.match(runtime,/advertising===true/);
  assert.match(runtime,/IntersectionObserver/);
  assert.match(runtime,/rootMargin:'300px'/);
  assert.match(runtime,/qelly:ad/);
  assert.match(runtime,/data-qelly-ad-network/);
  assert.match(runtime,/Sponsored placement unavailable/);
  assert.match(runtime,/script\.addEventListener\('error'/);
  assert.match(styles,/min-height:118px/);
  assert.match(styles,/q-ad-slot--rectangle\{min-height:250px\}/);
});

test('production build exposes blank-by-default validated ad hooks and conditional ads.txt/CSP activation',async()=>{
  const source=await read('scripts/build-frontend.mjs');
  for(const name of [
    'QELLY_PUBLIC_AD_CLIENT',
    'QELLY_PUBLIC_AD_SLOT_MARKET',
    'QELLY_PUBLIC_AD_SLOT_DECISION',
    'QELLY_PUBLIC_AD_SLOT_RESEARCH',
    'QELLY_PUBLIC_AD_SLOT_CALCULATOR'
  ])assert.match(source,new RegExp(name));
  assert.match(source,/\^ca-pub-\\d\{16\}\$/);
  assert.match(source,/advertisingConfigured/);
  assert.match(source,/pagead2\.googlesyndication\.com/);
  assert.match(source,/googleads\.g\.doubleclick\.net/);
  assert.match(source,/google\.com, \$\{publisherId\}, DIRECT, f08c47fec0942fa0/);
  assert.match(source,/ads:Object\.freeze/);
  assert.doesNotMatch(source,/ca-pub-\d{16}/);
});

test('safe placements exist for market, Decision Intelligence, research and calculators',async()=>{
  const [market,decision,chat,generator]=await Promise.all([
    read('apps/web/public/assets/routes/market-v6.mjs'),
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/routes/qelly-chat-workspace.mjs'),
    read('scripts/generate-public-calculator-network.mjs')
  ]);
  assert.match(market,/adSlot\('market-intelligence-inline'\)/);
  assert.match(decision,/adSlot\('decision-intelligence-inline'\)/);
  assert.ok(decision.indexOf("adSlot('decision-intelligence-inline')")>decision.indexOf('QELLY VIEW'));
  assert.match(chat,/adSlot\('research-inline'\)/);
  assert.match(chat,/mountAdSlots\(main\)/);
  assert.match(generator,/data-qelly-ad-slot="calculator-side"/);
  assert.match(generator,/\/qelly-config\.js/);
  assert.match(generator,/calculator-ad-bootstrap\.mjs/);
  assert.doesNotMatch(generator,/Reserved sponsor space · no ad network configured/);
});

test('generated static calculators reserve a responsive sponsored side placement without hardcoded publisher identity',async()=>{
  const output=await mkdtemp(path.join(os.tmpdir(),'qelly-calculator-ads-'));
  try{
    await writeFile(path.join(output,'sitemap.xml'),'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    const result=await generatePublicCalculatorNetwork({output,environment:{QELLY_CANONICAL_SITE_URL:'https://terminal.qellyintelligence.com'}});
    assert.equal(result.calculators,36);
    const html=await readFile(path.join(output,'calculators','kelly-criterion-calculator','index.html'),'utf8');
    assert.match(html,/data-qelly-ad-slot="calculator-side"/);
    assert.match(html,/q-ad-slot--rectangle/);
    assert.match(html,/>Sponsored</);
    assert.match(html,/Personalized ads stay off until consent/);
    assert.match(html,/src="\/qelly-config\.js"/);
    assert.match(html,/src="\/assets\/calculator-ad-bootstrap\.mjs"/);
    assert.doesNotMatch(html,/ca-pub-\d{16}/);
    assert.doesNotMatch(html,/registered method is .* version/i);
  }finally{
    await rm(output,{recursive:true,force:true});
  }
});
