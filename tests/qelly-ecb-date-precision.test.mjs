import test from 'node:test';
import assert from 'node:assert/strict';
import {providerResult} from '../functions/_lib/providers.js';
import {ecbReferenceDate,withEcbReferenceDate} from '../functions/_lib/ecb-reference-date.js';
import {__financeIntelligenceTest,buildFinanceContext,groundedFallbackAnswer} from '../functions/_lib/finance-intelligence.js';
import {collectReadinessEvidence} from '../functions/_lib/readiness.js';
import {providerDisplayModel} from '../apps/web/public/assets/routes/platform-readiness.mjs';
const xml='<Cube time="2026-10-05">'+['USD','INR','JPY','GBP','CHF'].map(currency=>`<Cube currency="${currency}" rate="2"/>`).join('')+'</Cube>';
const context={env:{__fetch:async()=>new Response(xml,{headers:{'Content-Type':'application/xml'}})},waitUntil(){}};
test('official date-only XML never becomes an exact UTC publication timestamp',async()=>{
 const result=await providerResult(context,'ecb','fx-reference-rates','EUR');
 assert.equal(result.observationTime,null);assert.equal(result.observedAt,null);assert.equal(result.observationDate,'2026-10-05');assert.equal(result.observationTimePrecision,'date');
 assert.equal(result.data.rates.INR,2);assert.match(result.ingestionTime,/T/);
 const normalized=__financeIntelligenceTest.normalizeEcb(result);assert.equal(normalized.observedAt,null);assert.equal(normalized.observedDate,'2026-10-05');
 const answer=groundedFallbackAnswer('Explain ECB',{observations:{ecb:normalized},datasetSummary:{connected:1}});
 assert.match(answer,/reference date 2026-10-05 · exact publication time unavailable/);assert.doesNotMatch(answer,/2026-10-05T16:00/);
});
test('readiness uses reference-date age, rejects future/expired dates and never publishes a derived clock',async()=>{
 const runtime={publicSiteUrl:'https://terminal.qellyintelligence.com',capabilities:{authentication:false,emailDelivery:false,cloudSync:false,liveProviders:true}};
 for(const [offset,expected] of [[0,true],[-1,true],[1,false],[-8,false]]){
  const date=new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
  const evidence=await collectReadinessEvidence({env:{__fetch:async()=>new Response(xml.replace('2026-10-05',date),{headers:{'Content-Type':'application/xml'}})}},runtime);
  assert.equal(evidence.providerFreshness.proven,expected);assert.equal(evidence.providerFreshness.observedAt,null);assert.equal(evidence.providerFreshness.observedDate,date);
 }
 const row=providerDisplayModel({id:'ecb',enabled:true,truthState:'DELAYED',observedAt:'2026-10-05T16:00:00Z',observedDate:'2026-10-05',observationTimePrecision:'date'});
 assert.equal(row.observation,'Reference date 2026-10-05; exact publication time unavailable');
});
test('fresh and stale older cache payloads lose the derived clock while keeping reference dates and state',async()=>{
 const original=globalThis.caches;
 try{
  for(const stale of [false,true]){
   const payload={provider:'ecb-reference-rates',truthState:'delayed_provider',observationTime:'2026-10-05T16:00:00.000Z',ingestionTime:'2026-10-05T14:00:00Z',data:{base:'EUR',date:'2026-10-05',rates:{EUR:1,USD:2}}};
   globalThis.caches={default:{match:async()=>new Response(JSON.stringify({payload,cachedAt:'2026-10-05T14:00:00Z',freshUntil:new Date(Date.now()+(stale?-10000:10000)).toISOString(),staleUntil:new Date(Date.now()+60000).toISOString()}))}};
   const result=await providerResult({env:{__fetch:async()=>{throw Error('Unavailable')}},waitUntil(){}},'ecb','fx-reference-rates','EUR');
   assert.equal(result.truthState,stale?'stale_provider':'cached_provider');assert.equal(result.observationTime,null);assert.equal(result.observedAt,null);assert.equal(result.observationDate,'2026-10-05');assert.equal(result.ingestionTime,payload.ingestionTime);
  }
 }finally{if(original===undefined)delete globalThis.caches;else globalThis.caches=original;}
});
test('reference calendar dates validate and propagate into sources and India tool evidence',async()=>{
 for(const value of ['2026-02-30','2026-13-01','not-a-date',null,20261005])assert.equal(ecbReferenceDate(value),null);
 assert.equal(ecbReferenceDate('2024-02-29'),'2024-02-29');
 const provider=withEcbReferenceDate({truthState:'delayed_provider',data:{base:'EUR',date:'2026-10-05',rates:{EUR:1,INR:2}}});
 const finance=await buildFinanceContext({env:{}},'Explain ECB',{mode:'india',networkLoader:async()=>({sources:{}}),providerLoader:async()=>provider,worldBankLoader:async()=>({observations:[]})});
 const source=finance.citations.find(row=>row.id==='ecb-reference');assert.equal(source.observedAt,null);assert.equal(source.observedDate,'2026-10-05');
 const reference=finance.tools.find(row=>row.data?.ecbReference)?.data.ecbReference;assert.ok(reference);assert.equal(reference.observedAt,null);assert.equal(reference.observedDate,'2026-10-05');assert.equal(reference.observationTimePrecision,'date');
});
