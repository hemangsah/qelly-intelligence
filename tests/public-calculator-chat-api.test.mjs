import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicCalculatorChatApi} from '../apps/web/public/assets/public-calculator-chat-api.mjs';
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
test('public Chat capabilities are read-only and never collect calculator values',async()=>{
  const calls=[];const api=createPublicCalculatorChatApi({fetcher:async(...args)=>{calls.push(args);return response({datasets:{connected:2}});}});
  assert.equal(calls.length,0);await api('/api/v1/intelligence/chat');
  assert.equal(calls.length,1);assert.equal(calls[0][0],'/api/v1/intelligence/chat');assert.equal(calls[0][1].method,'GET');assert.equal(calls[0][1].body,undefined);
  await assert.rejects(api('https://untrusted.example/api/v1/intelligence/chat'),/Unsupported/);await assert.rejects(api('/api/v1/preferences/layout'),/Unsupported/);
  assert.equal(calls.length,1);
});
test('explicit Chat submission obtains current CSRF configuration and preserves cancellation',async()=>{
  const calls=[],signal=new AbortController().signal,body=JSON.stringify({message:'Explain the formula assumptions.'});
  const api=createPublicCalculatorChatApi({fetcher:async(...args)=>{calls.push(args);return response(calls.length===1?{csrf:{token:'synthetic-fixture'}}:{content:'Fixture response'});}});
  await api('/api/v1/intelligence/chat',{method:'POST',body,signal});
  assert.equal(calls.length,2);assert.equal(calls[0][0],'/api/v1/config');assert.equal(calls[0][1].signal,signal);
  assert.equal(calls[1][1].headers['X-Qelly-CSRF'],'synthetic-fixture');assert.equal(calls[1][1].body,body);assert.equal(calls[1][1].signal,signal);assert.equal(calls[1][1].credentials,'include');
});
test('failed session hydration sends no Chat mutation, and denial remains explicit',async()=>{
  const calls=[];const api=createPublicCalculatorChatApi({fetcher:async(...args)=>{calls.push(args);return response({},503);}});
  await assert.rejects(api('/api/v1/intelligence/chat',{method:'POST',body:'{}'}),/session configuration is unavailable/);assert.equal(calls.length,1);assert.equal(calls[0][0],'/api/v1/config');
  const denied=createPublicCalculatorChatApi({fetcher:async()=>response({error:{message:'Session expired'}},401)});
  await assert.rejects(denied('/api/v1/intelligence/chat'),error=>error.status===401&&error.message==='Session expired');
  const unprotected=[];const missingCsrf=createPublicCalculatorChatApi({fetcher:async(...args)=>{unprotected.push(args);return response({auth:{authenticated:false}});}});
  await assert.rejects(missingCsrf('/api/v1/intelligence/chat',{method:'POST',body:'{}'}),/session protection is unavailable/);assert.equal(unprotected.length,1);
});
