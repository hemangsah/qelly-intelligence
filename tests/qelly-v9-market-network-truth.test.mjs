import test from 'node:test';
import assert from 'node:assert/strict';
import {__test} from '../functions/_lib/market-network.js';

test('World Bank annual macro data is reference-only, never a live market observation',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(url)=>{
    assert.match(String(url),/api\.worldbank\.org/);
    return new Response(JSON.stringify([
      {page:1,pages:1,per_page:100,total:2},
      [
        {countryiso3code:'IND',country:{value:'India'},date:'2025',value:7.5},
        {countryiso3code:'USA',country:{value:'United States'},date:'2025',value:2.1}
      ]
    ]),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const source=await __test.worldBankMacro();
    assert.equal(source.id,'world-bank');
    assert.equal(source.state,'reference_external');
    assert.equal(source.observedAt,null,'annual year must not be promoted to an invented precise observation timestamp');
    assert.equal(source.data.length,2);
    assert.match(source.usage,/annual macro reference data, not real-time market data/i);
    assert.match(source.cadence,/annual GDP growth observation/i);
    assert.equal(String(source.state).startsWith('live'),false);
  }finally{
    globalThis.fetch=originalFetch;
  }
});
