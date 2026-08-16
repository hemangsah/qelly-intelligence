import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__portfolioV6Test} from '../apps/web/public/assets/routes/portfolio-v6.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('portfolio helpers refuse to manufacture unavailable values',()=>{
  const {truth,number,money,list,stateOf}=__portfolioV6Test;
  assert.equal(truth(), 'UNAVAILABLE');
  assert.equal(number('not-a-number'),null);
  assert.equal(money(null,'USD'),'—');
  assert.deepEqual(list({items:[{id:1}]}),[{id:1}]);
  assert.equal(stateOf({truthState:'unavailable'}),'UNAVAILABLE');
});

test('V6 portfolio uses authenticated canonical portfolio APIs and never calls public market providers directly',async()=>{
  const source=await read('apps/web/public/assets/routes/portfolio-v6.mjs');
  for(const route of ['overview','holdings','performance','risk','attribution'])assert.match(source,new RegExp(`/api/v1/portfolio/${route}`));
  assert.match(source,/Qelly will not fabricate holdings, valuation or risk/i);
  assert.match(source,/does not substitute deterministic fixtures for missing portfolio prices/i);
  assert.match(source,/No governed position pricing coverage proven/i);
  assert.doesNotMatch(source,/api\.binance\.com|api\.exchange\.coinbase\.com|qelly-governed-demo|fixtureCandles/);
});

test('portfolio presentation separates supplied cost basis from governed pricing and execution remains off',async()=>{
  const source=await read('apps/web/public/assets/routes/portfolio-v6.mjs');
  assert.match(source,/User cost basis/);
  assert.match(source,/Pricing coverage/);
  assert.match(source,/Governed mark/);
  assert.match(source,/Analytic truth/);
  assert.match(source,/Execution/);
  assert.match(source,/Disabled by product constitution/);
});

test('V6 portfolio styling is responsive and reduced-motion safe',async()=>{
  const css=await read('apps/web/public/assets/routes/portfolio-v6.css');
  assert.match(css,/q-v6-portfolio-layout/);
  assert.match(css,/q-v6-portfolio-row/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/prefers-reduced-motion/);
});

test('portfolio V6 entry loads its dedicated stylesheet and renderer',async()=>{
  const source=await read('apps/web/public/assets/routes/portfolio-v6-entry.mjs');
  assert.match(source,/portfolio-v6\.css/);
  assert.match(source,/renderPortfolioV6/);
  assert.match(source,/data-qelly-portfolio-v6/);
});
