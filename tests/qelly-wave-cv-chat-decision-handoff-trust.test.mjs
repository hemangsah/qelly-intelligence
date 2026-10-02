import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {storeDecisionContext,consumeDecisionContext,DECISION_CONTEXT_KEY,RESEARCH_CONTEXT_KEY} from '../apps/web/public/assets/decision-context-bridge.mjs';
const code=()=>readFile(new URL('../apps/web/public/assets/ai/qelly-chat.mjs',import.meta.url),'utf8');
test('Build decision uses the canonical TTL-bound handoff instead of an undefined private key',async()=>{
  const chat=await code();
  assert.match(chat,/const contextSaved=storeDecisionContext\(/);
  assert.match(chat,/source:'qelly-chat'/);
  assert.match(chat,/if\(!contextSaved\|\|!draftSaved\)toast\?/);
  assert.doesNotMatch(chat,/sessionStorage\.setItem\(DECISION_CONTEXT_KEY/);
  assert.match(chat,/sessionStorage\.setItem\(DECISION_DRAFT_KEY/);
  assert.doesNotMatch(chat,/Open Market Command/);
});
test('canonical decision handoff stores only bounded asset and timeframe and expires on consumption',()=>{
  const previous=globalThis.sessionStorage;
  const m=new Map();
  globalThis.sessionStorage={setItem:(k,v)=>m.set(k,v),getItem:k=>m.get(k)||null,removeItem:k=>m.delete(k)};
  try{
    assert.equal(storeDecisionContext({asset:'QI-CRYPTO-ETH',timeframe:'4h',source:'qelly-chat'}),true);
    const payload=JSON.parse(m.get(DECISION_CONTEXT_KEY));
    assert.equal(payload.asset,'ETH');assert.equal(payload.timeframe,'4h');assert.equal(payload.source,'qelly-chat');
    assert.ok(m.has(RESEARCH_CONTEXT_KEY));
    assert.deepEqual(consumeDecisionContext(),{asset:'ETH',interval:'4h'});
    assert.equal(m.has(DECISION_CONTEXT_KEY),false);
    assert.equal(storeDecisionContext({asset:'not-allowed',timeframe:'4h'}),false);
  }finally{if(previous===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=previous;}
});
test('evidence citations reject credential-bearing URL shapes and remain HTTPS only',async()=>{
 const chat=await code();
 assert.match(chat,/url\.protocol!=='https:'\|\|url\.username\|\|url\.password/);
 assert.match(chat,/token\|access_token\|api_key\|apikey\|key\|secret\|signature\|sig\|auth/);
 assert.match(chat,/return url\.toString\(\)/);
 assert.match(chat,/rel="noopener noreferrer nofollow"/);
});
test('composer preserves IME composition and modifier keys instead of accidentally submitting',async()=>{
 const chat=await code();
 for(const marker of ['!event.isComposing','!event.shiftKey','!event.ctrlKey','!event.metaKey','!event.altKey','aria-describedby="q-ai-composer-help"'])assert.ok(chat.includes(marker),marker);
});
