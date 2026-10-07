import test from 'node:test';
import assert from 'node:assert/strict';
import {ecbReferenceDay,ecbReferenceCaption,ecbReferenceRates} from '../apps/web/public/assets/market-ecb-reference.mjs';
test('daily ECB reference does not inherit retrieval time or manufacture midnight',()=>{
 const source={observationDate:'2026-10-06',observationTime:null,ingestionTime:'2026-10-07T11:54:51.360Z',data:{date:'2026-10-06',rates:{USD:1.1}}};
 assert.equal(ecbReferenceDay(source),'2026-10-06');assert.equal(ecbReferenceCaption(source),'Reference date 2026-10-06 · daily');
 assert.doesNotMatch(ecbReferenceCaption(source),/2026-10-07|00:00/);
});
test('absent, invalid or contradictory reference dates remain unavailable',()=>{
 for(const source of [{ingestionTime:'2026-10-07T00:00:00Z'}, {observationDate:'2026-02-30'}, {observationDate:'2026-10-06',data:{date:'2026-10-07'}}, {observationDate:'2026-10-06T00:00:00Z'}]){assert.equal(ecbReferenceDay(source),null);assert.equal(ecbReferenceCaption(source),'Reference date not supplied');}
 assert.equal(ecbReferenceDay({data:{date:'2024-02-29'}}),'2024-02-29');assert.equal(ecbReferenceDay({data:{date:'2025-02-29'}}),null);
});
test('reference card values require positive finite numeric provider observations',()=>{
 assert.deepEqual(ecbReferenceRates({data:{rates:{USD:1.1,INR:'90',GBP:null,JPY:'',CHF:Infinity,CNY:0,CAD:-1,AUD:false,SGD:'bad'}}}),[['USD',1.1],['INR',90]]);
 assert.deepEqual(ecbReferenceRates({data:{rates:null}}),[]);
});
