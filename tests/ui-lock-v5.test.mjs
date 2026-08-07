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
  assert.ok(font>=0&&v5>font,'V5 CSS must load after canonical typography governance');
  assert.match(index,/qelly-ui-lock-v5\.mjs/);
  assert.match(css,/--q-v5-r-panel:18px/);
  assert.match(css,/--q-v5-motion-standard:280ms/);
  assert.match(css,/cubic-bezier\(\.16,1,\.3,1\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(motion,/root\.dataset\.uiLockV5='active'/);
  assert.match(motion,/prefers-reduced-motion: reduce/);
});

test('V5 preserves evidence-first and read-only safety semantics',async()=>{
  const [lock,css,motion]=await Promise.all([
    read('docs/design/UI_LOCK_V5_APPROVED_2026-08-07.md'),
    read('apps/web/public/assets/qelly-ui-lock-v5.css'),
    read('apps/web/public/assets/qelly-ui-lock-v5.mjs')
  ]);
  assert.match(lock,/Evidence-first truth model/);
  assert.match(lock,/No-silent-feature-removal rule/);
  assert.doesNotMatch(`${css}\n${motion}`,/place order|execute trade|connect wallet|deposit funds|withdraw funds|swap now/i);
});
