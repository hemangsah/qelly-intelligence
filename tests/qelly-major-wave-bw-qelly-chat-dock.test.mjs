import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CM supersedes the Wave BW Decision-only dock with one global owner',async()=>{
  const [route,chat,css]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/ai/qelly-chat.mjs'),
    read('apps/web/public/assets/ai/qelly-chat.css')
  ]);
  assert.doesNotMatch(route,/qellyChatDockMarkup|data-dpg-chat-dock|data-dpg-chat-quick|chatDockOpen/);
  assert.match(route,/qelly:chat-context/);
  assert.match(route,/qelly:chat-clearance/);
  for(const phrase of ["contextType:'decision'","actionLabel:primary.label","mode:'decision'","selection,previousSnapshot:state.previousSnapshot||null","Why NO TRADE?","Explain selected move"])assert.ok(route.includes(phrase),phrase);
  assert.equal((chat.match(/id="qelly-ai-assistant"/g)||[]).length,1);
  assert.doesNotMatch(chat,/decisionRouteActive/);
  assert.doesNotMatch(chat,/launcher\.hidden=decisionRouteActive/);
  assert.match(chat,/qelly:chat-context/);
  assert.match(chat,/qelly:chat-clearance/);
  assert.match(css,/left:0;/);
  assert.match(css,/right:0;/);
  assert.match(css,/margin-inline:auto/);
  assert.match(css,/bottom:max\(16px,env\(safe-area-inset-bottom/);
  assert.doesNotMatch(css,/@keyframes q-ai-dock-border/);
  assert.match(css,/\.q-ai-assistant\.is-thinking[^{}]*\{animation:q-ai-pulse/);
  assert.doesNotMatch(css,/\.q-ai-launcher[^{}]*\{[^}]*animation:/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Wave CM global dock consumes structured Decision context without scraping route prose',async()=>{
  const [route,chat]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/ai/qelly-chat.mjs')
  ]);
  for(const phrase of ['horizon:state.horizon','rr:state.rr','customRr:state.rr===\'custom\'?state.customRr:null','selection,previousSnapshot:state.previousSnapshot||null'])assert.ok(route.includes(phrase),phrase);
  assert.match(chat,/normalizeDockContext/);
  assert.match(chat,/normalizeDecisionContext\(value\.decisionContext\)/);
  assert.match(chat,/open\(dockContext\.prompt,dockContext\.mode/);
  assert.match(chat,/let dockPrefill=''/);
  assert.match(chat,/if\(!input\.value\|\|input\.value===dockPrefill\)\{input\.value=next;dockPrefill=next;\}/);
  assert.match(chat,/input\.addEventListener\('input',[\s\S]{0,120}dockPrefill=''/);
  assert.doesNotMatch(route,/document\.querySelector\([^\n]+\)\?\.(?:textContent|innerText)[^\n]+decisionContext/);
});

test('Wave CM dock is terminal-wide, centered, mobile safe and chart-clearance aware',async()=>{
  const css=await read('apps/web/public/assets/ai/qelly-chat.css');
  assert.match(css,/\.q-ai-launcher\{/);
  assert.match(css,/margin-inline:auto/);
  assert.match(css,/\.q-ai-launcher\{[\s\S]*?transform:none/);
  assert.doesNotMatch(css,/translateX\(-50%\)/);
  assert.match(css,/env\(safe-area-inset-bottom/);
  assert.match(css,/q-ai-root\[data-clearance="chart"\]/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.doesNotMatch(css,/data-production-route="decision-provenance"[^\n]*q-ai-launcher/);
});

test('Wave CM preserves one authoritative assistant handoff and open-state signal',async()=>{
  const chat=await read('apps/web/public/assets/ai/qelly-chat.mjs');
  assert.match(chat,/document\.dispatchEvent\(new CustomEvent\('qelly:chat-open-state'/);
  assert.match(chat,/document\.addEventListener\('qelly:open-ai'/);
  assert.match(chat,/decisionContext:event\.detail\?\.decisionContext\?\?null/);
  assert.match(chat,/globalThis\.__QELLY_CHAT_CONTEXT__/);
});


test('Wave CM deterministic browser fixture validates provider hosts exactly',async()=>{
  const browser=await read('scripts/qelly-decision-range-selection-e2e.mjs');
  assert.match(browser,/target\.protocol==='https:'&&target\.hostname==='api\.hyperliquid\.xyz'/);
  assert.match(browser,/target\.protocol==='https:'&&target\.hostname==='api\.gdeltproject\.org'/);
  assert.doesNotMatch(browser,/target\.includes\('api\.(?:hyperliquid\.xyz|gdeltproject\.org)'\)/);
});
