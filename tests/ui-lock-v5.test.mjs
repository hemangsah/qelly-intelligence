import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('approved UI_LOCK_V5 is durable and keeps release authorization separate',async()=>{
  const lock=await read('docs/design/UI_LOCK_V5_APPROVED_2026-08-07.md');
  assert.match(lock,/Status: \*\*APPROVED \/ ACTIVE\*\*/);
  assert.match(lock,/74ad171d0d191ab192e975d38c838b85ec288c4c48c2ad3628bf197f4694336a/);
  assert.match(lock,/2,067 lossless PNGs/);
  assert.match(lock,/does \*\*not\*\* authorize/);
  assert.match(lock,/no custody, wallet signing, deposits, withdrawals, transfers or live order execution/i);
});

test('V5 frontend foundation is loaded after legacy visual layers',async()=>{
  const [index,css,motion]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/qelly-ui-lock-v5.css'),
    read('apps/web/public/assets/qelly-ui-lock-v5.mjs')
  ]);
  const font=index.indexOf('qelly-font-governance.css');
  const v5=index.indexOf('qelly-ui-lock-v5.css');
  const markets=index.indexOf('qelly-ui-lock-v5-markets.css');
  assert.ok(font>=0&&v5>font,'V5 CSS must load after canonical typography governance');
  assert.ok(markets>v5,'V5 market pilot must layer after the V5 foundation');
  assert.match(index,/qelly-ui-lock-v5\.mjs/);
  assert.match(css,/--q-v5-r-panel:18px/);
  assert.match(css,/--q-v5-motion-standard:280ms/);
  assert.match(css,/cubic-bezier\(\.16,1,\.3,1\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(motion,/root\.dataset\.uiLockV5='active'/);
  assert.match(motion,/cancelLegacyRouteAnimation/);
  assert.match(motion,/getAnimations\(\{subtree:false\}\)/);
  assert.match(motion,/prefers-reduced-motion: reduce/);
});

test('V5 Live Market Command exposes truthful market and evidence ribbons',async()=>{
  const [route,marketCss]=await Promise.all([
    read('apps/web/public/assets/routes/live-markets.mjs'),
    read('apps/web/public/assets/qelly-ui-lock-v5-markets.css')
  ]);
  for(const phrase of [
    'q-v5-market-ribbon',
    'q-v5-evidence-ribbon',
    'live-evidence-source',
    'live-evidence-observed',
    'live-evidence-truth',
    'Display reuse</span><strong>PROHIBITED',
    'Execution</span><strong>Disabled',
    'TradingView values are not read, scraped, persisted or used by Qelly analytics.'
  ])assert.ok(route.includes(phrase),`missing V5 live-market contract: ${phrase}`);
  assert.match(route,/Fabricated fallback<\/span><strong>OFF/);
  assert.match(route,/No Qelly-generated fallback values/);
  assert.match(route,/Missing internal market data remains visibly unavailable/);
  assert.doesNotMatch(route,/live-evidence-freshness|const freshness=|const confidence=|governed demo/i);
  assert.match(marketCss,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(marketCss,/scroll-snap-type:x mandatory/);
  assert.doesNotMatch(route,/confidence[^\n]{0,80}(?:100|95|90|high)/i,'live market must not fabricate confidence');
});

test('V5 preserves evidence-first and read-only safety semantics',async()=>{
  const [lock,css,motion,marketCss]=await Promise.all([
    read('docs/design/UI_LOCK_V5_APPROVED_2026-08-07.md'),
    read('apps/web/public/assets/qelly-ui-lock-v5.css'),
    read('apps/web/public/assets/qelly-ui-lock-v5.mjs'),
    read('apps/web/public/assets/qelly-ui-lock-v5-markets.css')
  ]);
  assert.match(lock,/Evidence-first truth model/);
  assert.match(lock,/No-silent-feature-removal rule/);
  assert.doesNotMatch(`${css}\n${motion}\n${marketCss}`,/place order|execute trade|connect wallet|deposit funds|withdraw funds|swap now/i);
});
