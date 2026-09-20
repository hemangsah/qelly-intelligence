import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('shared sponsor runtime reads validated production config and remains consent gated',async()=>{
  const [slot,build]=await Promise.all([
    read('apps/web/public/assets/qelly-ad-slot.mjs'),
    read('scripts/build-frontend.mjs')
  ]);
  assert.match(slot,/__QELLY_CONFIG__\?\.ads/);
  assert.match(slot,/qelly-consent-v1/);
  assert.match(slot,/activation-required/);
  assert.match(slot,/settings\.enabled/);
  assert.match(slot,/IntersectionObserver/);
  assert.match(slot,/pagead2\.googlesyndication\.com/);
  assert.match(slot,/data-ad-state="requested"|dataset\.adState='requested'/);
  assert.doesNotMatch(slot,/ca-pub-\d{16}/);
  for(const name of [
    'QELLY_PUBLIC_AD_NETWORK_ENABLED',
    'QELLY_PUBLIC_ADSENSE_CSP_READY',
    'QELLY_PUBLIC_ADSENSE_CLIENT',
    'QELLY_PUBLIC_AD_SLOT_MARKET_INTELLIGENCE_INLINE',
    'QELLY_PUBLIC_AD_SLOT_DECISION_INTELLIGENCE_INLINE',
    'QELLY_PUBLIC_AD_SLOT_RESEARCH_INLINE',
    'QELLY_PUBLIC_AD_SLOT_CALCULATOR_INLINE'
  ])assert.match(build,new RegExp(name));
  assert.match(build,/ca-pub-\\d\{16\}/);
  assert.match(build,/ads:adConfig/);
  assert.match(build,/adConfig\.enabled/);
  assert.match(build,/Ad network activation requires a validated client/);
  assert.match(build,/adsConfigured:Boolean/);
});

test('research and calculator placements use the shared sponsor component away from critical controls',async()=>{
  const [chat,generator,calculator]=await Promise.all([
    read('apps/web/public/assets/routes/qelly-chat-workspace.mjs'),
    read('scripts/generate-public-calculator-network.mjs'),
    read('apps/web/public/assets/calculator-network.mjs')
  ]);
  assert.match(chat,/adSlot\('research-inline'\)/);
  assert.match(chat,/mountAdSlots\(main\)/);
  assert.match(generator,/adSlot\('calculator-inline',\{format:'rectangle'\}\)/);
  assert.match(generator,/qelly-ad-slot\.css/);
  assert.match(generator,/qelly-config\.js/);
  assert.match(calculator,/mountAdSlots\(document\)/);
  assert.match(calculator,/\.\/qelly-ad-slot\.mjs/);
  assert.doesNotMatch(generator,/Reserved sponsor space · no ad network configured/);
});

test('root SEO copy uses current consumer terminology',async()=>{
  const [index,finalizer]=await Promise.all([
    read('apps/web/public/index.html'),
    read('scripts/finalize-public-runtime.mjs')
  ]);
  assert.match(index,/Decision Intelligence with transparent source evidence/);
  assert.doesNotMatch(index,/transparent provider truth/);
  assert.match(finalizer,/quantitative tools and Decision Intelligence/);
  assert.doesNotMatch(finalizer,/quantitative tools and decision provenance/);
});

test('retired V5.3 lock shell stays deleted while family harmonization remains active',async()=>{
  const family=await read('apps/web/public/assets/qelly-v53-family-harmonization.mjs');
  assert.match(family,/qelly-v53-lock-route-cleanup\.mjs/);
  assert.match(family,/qelly-v53-family-harmonization\.css/);
  assert.doesNotMatch(family,/qelly-v53-lock-shell\.mjs/);
  await assert.rejects(()=>stat(new URL('../apps/web/public/assets/qelly-v53-lock-shell.mjs',import.meta.url)),{code:'ENOENT'});
});
