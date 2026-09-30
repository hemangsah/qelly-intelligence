import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultQellyChatContext,normalizeQellyChatPageContext,routeFromHash,__qellyChatContextTest} from '../apps/web/public/assets/qelly-chat-context.mjs';

test('global QELLY chat context has explicit safe defaults for key first-party surfaces',()=>{
  assert.equal(defaultQellyChatContext('decision-provenance').mode,'decision');
  assert.equal(defaultQellyChatContext('market').label,'Summarize this Market Pulse');
  assert.equal(defaultQellyChatContext('asset').contextType,'asset-dossier');
  assert.equal(defaultQellyChatContext('calculator-center').mode,'calculate');
  assert.equal(defaultQellyChatContext('unknown-route').label,'Explain this page');
});

test('page context bounds labels and prompt arrays without accepting arbitrary top-level fields',()=>{
  const value=normalizeQellyChatPageContext({route:'decision-provenance',mode:'not-a-mode',label:'x'.repeat(500),quickPrompts:['a'.repeat(900),'b','c','d','e'],secret:'must-not-pass'});
  assert.equal(value.mode,'decision');
  assert.equal(value.label.length,120);
  assert.equal(value.quickPrompts.length,4);
  assert.equal(value.quickPrompts[0].length,420);
  assert.equal(Object.hasOwn(value,'secret'),false);
  assert.equal(__qellyChatContextTest.CHAT_MODES.has('decision'),true);
});

test('hash route parsing remains deterministic',()=>{
  assert.equal(routeFromHash('#/decision-provenance/BTC?interval=15m'),'decision-provenance');
  assert.equal(routeFromHash('#/market'),'market');
});
