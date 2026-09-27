import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave BW replaces legacy Decision chat buttons with one contextual bottom-center dock',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ['QELLY CONTEXT DOCK','Ask QELLY about selected range','Explain this setup','Why NO TRADE?','What changed?','Ask QELLY about this move'])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/data-dpg-chat-dock/);
  assert.match(route,/data-dpg-chat-form/);
  assert.doesNotMatch(route,/data-dpg-open-chat/);
  assert.doesNotMatch(route,/data-dpg-range-action="chat"/);
  assert.doesNotMatch(route,/mode:'decision-range'/);
});

test('Wave BW hands the current Decision context into the existing authoritative QELLY chat path',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ['qelly:open-ai',"mode:'decision'",'decisionContext:{','horizon:state.horizon','rr:state.rr','selection:state.selection||state.draft||null','previousSnapshot:state.previousSnapshot||null'])assert.ok(route.includes(phrase),phrase);
  assert.doesNotMatch(route,/\/api\/v1\/intelligence\/chat/);
  assert.match(route,/Existing QELLY Chat · current Decision evidence/);
});

test('Wave BW hides only the generic launcher on Decision without creating a second assistant',async()=>{
  const [chat,css]=await Promise.all([
    read('apps/web/public/assets/ai/qelly-chat.mjs'),
    read('apps/web/public/assets/ai/qelly-chat.css')
  ]);
  assert.match(chat,/decisionRouteActive/);
  assert.match(chat,/launcher\.hidden=decisionRouteActive\(\)/);
  assert.match(chat,/window\.addEventListener\('hashchange',syncLauncherRoute\)/);
  assert.match(css,/q-ai-launcher\[hidden\]/);
  assert.match(css,/data-production-route="decision-provenance"/);
  assert.equal((chat.match(/id="qelly-ai-assistant"/g)||[]).length,1);
});

test('Wave BW dock is centered, mobile safe, animated and reduced-motion aware',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  assert.match(css,/\.q-dpg-chat-dock\{position:fixed;left:50%;bottom:max\(16px,env\(safe-area-inset-bottom/);
  assert.match(css,/transform:translateX\(-50%\)/);
  assert.match(css,/@keyframes q-dpg-chat-border/);
  assert.match(css,/@keyframes q-dpg-chat-rise/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/env\(safe-area-inset-bottom/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Wave BW Browser E2E proves desktop/mobile shell, handoff and selected-range context',async()=>{
  const e2e=await read('scripts/qelly-decision-range-selection-e2e.mjs');
  for(const phrase of ['qelly-dock-shell','qelly-dock-composer','qelly-dock-handoff','qelly-dock-range-context','qelly-dock-range-action','data-dpg-chat-quick="view"','data-dpg-chat-quick="selected"'])assert.ok(e2e.includes(phrase),phrase);
});
