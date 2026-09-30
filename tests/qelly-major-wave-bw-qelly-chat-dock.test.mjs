import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultQellyChatContext,normalizeQellyChatPageContext} from '../apps/web/public/assets/qelly-chat-context.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CM supersedes the route-local Decision dock with one terminal-wide QELLY dock',async()=>{
  const [route,chat,css]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/ai/qelly-chat.mjs'),
    read('apps/web/public/assets/ai/qelly-chat.css')
  ]);
  assert.match(route,/publishQellyChatContext/);
  assert.doesNotMatch(route,/q-dpg-chat-dock|data-dpg-chat-dock|chatDockOpen/);
  assert.doesNotMatch(chat,/decisionRouteActive|launcher\.hidden=decisionRouteActive/);
  assert.equal((chat.match(/id="qelly-ai-assistant"/g)||[]).length,1);
  assert.match(css,/\.q-ai-launcher\{left:50%;right:auto;bottom:max\(16px,env\(safe-area-inset-bottom\)\);transform:translateX\(-50%\)/);
  assert.match(css,/data-clearance="chart"/);
});

test('Wave CM uses bounded structured page context instead of scraping route prose',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ["route:'decision-provenance'","contextType:'decision'","mode:'decision'","asset:state.asset","timeframe:state.interval","decisionContext:{horizon:state.horizon","selection","previousSnapshot:state.previousSnapshot||null"])assert.ok(route.includes(phrase),phrase);
  const context=normalizeQellyChatPageContext({route:'decision-provenance',label:'Explain this setup',mode:'decision',asset:'BTC',timeframe:'15m',quickPrompts:['a','b']});
  assert.equal(context.mode,'decision');
  assert.equal(context.asset,'BTC');
  assert.deepEqual(context.quickPrompts,['a','b']);
  assert.equal(defaultQellyChatContext('market').label,'Summarize this Market Pulse');
});

test('Wave CM keeps Decision handoff fail closed and global assistant grounded',async()=>{
  const [chat,endpoint]=await Promise.all([
    read('apps/web/public/assets/ai/qelly-chat.mjs'),
    read('functions/api/v1/intelligence/chat.js')
  ]);
  for(const phrase of ['QELLY_CHAT_CONTEXT_EVENT','normalizeQellyChatPageContext','pageContext','decisionContext:pageContext.decisionContext','new AbortController()','Generation cancelled. No partial or unvalidated answer was accepted.'])assert.ok(chat.includes(phrase),phrase);
  assert.match(endpoint,/normalizeDecisionChatContext\(body\.decisionContext\)/);
  assert.match(endpoint,/unvalidatedStreaming:false/);
});

test('Wave CM Browser E2E proves global dock centering, context handoff, range context and chart clearance',async()=>{
  const e2e=await read('scripts/qelly-decision-range-selection-e2e.mjs');
  for(const phrase of ['qelly-global-dock-shell','qelly-global-dock-context','qelly-global-dock-range-context','qelly-global-dock-chart-clearance','qelly-global-dock-clearance-return','qelly-global-dock-close-hit-target','data-q-ai-launcher','data-q-ai-mode="decision"'])assert.ok(e2e.includes(phrase),phrase);
  assert.equal((e2e.match(/data-dpg-chat-dock/g)||[]).length,1);
  assert.match(e2e,/legacyDecisionChatControls/);
});
