import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LiveMarketService } from '../src/live-markets/live-market-service.mjs';
import { startServer } from '../src/server/server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('Part 22 permanently locks the sovereign burgundy gradient and six persona themes',async()=>{
  const lock=JSON.parse(await readFile(path.join(root,'packages/design-tokens/brand-lock.json'),'utf8'));
  assert.equal(lock.version,'22.0.0');
  assert.equal(lock.lockStatus,'permanent-unless-founder-explicitly-revokes');
  assert.match(lock.signatureGradient.css,/#080003/);
  assert.match(lock.signatureGradient.css,/#8e1d4b/i);
  assert.deepEqual(lock.personas.map(item=>item.name),['Scalper Velocity','Investor Compound','Aggressive Alpha','Quant Operator','Research Oracle','Signal Access']);
});

test('Part 22 live market service is public read-only and deterministic when live mode is disabled',async()=>{
  const service=new LiveMarketService({enabled:false});
  const catalog=service.catalog();
  assert.equal(catalog.guardrails.publicMarketDataOnly,true);
  assert.equal(catalog.guardrails.trading,false);
  assert.equal(catalog.guardrails.investingComScraping,false);
  const result=await service.candles({provider:'binance',symbol:'BTCUSDT',interval:'5m',limit:80,mode:'live'});
  assert.equal(result.provider,'fixture');
  assert.equal(result.requestedProvider,'binance');
  assert.equal(result.points.length,80);
  assert.equal(result.guardrails.executionDisabled,true);
  assert.ok(result.points.every(point=>point.high>=Math.max(point.open,point.close)&&point.low<=Math.min(point.open,point.close)));
});

test('Part 22 ticker summarizes candles without exposing order execution',async()=>{
  const service=new LiveMarketService({enabled:false});
  const result=await service.ticker({provider:'coindcx',symbol:'ETHUSDT',interval:'1m'});
  assert.equal(result.points,undefined);
  assert.equal(typeof result.summary.last,'number');
  assert.equal(result.guardrails.readOnly,true);
});

test('Part 22 chart adapter includes TradingView-compatible and local fallback renderers',async()=>{
  const source=await readFile(path.join(root,'apps/web/public/assets/market/tradingview-live-chart.mjs'),'utf8');
  assert.match(source,/lightweight-charts/);
  assert.match(source,/fallbackChart/);
  assert.match(source,/candlestick/i);
  assert.match(source,/volume/i);
});

test('Part 22 modular experience routes are packaged',async()=>{
  for(const file of ['live-markets.mjs','theme-personas.mjs','about-qelly.mjs','feature-universe.mjs']){
    const source=await readFile(path.join(root,'apps/web/public/assets/routes',file),'utf8');
    assert.match(source,/export async function render/);
  }
});

test('Part 22 motion system binds interactions once and preserves reduced motion',async()=>{
  const source=await readFile(path.join(root,'apps/web/public/assets/qelly-sovereign-motion.js'),'utf8');
  assert.match(source,/motionBound/);
  assert.match(source,/magneticBound/);
  assert.match(source,/prefers-reduced-motion/);
  assert.match(source,/q-button-ripple/);
});

test('Part 22 server exposes 47 routes, live market APIs and the sovereign contract',async()=>{
  const started=await startServer({port:0});
  const base=`http://${started.host}:${started.port}`;
  try{
    const config=await (await fetch(base+'/api/v1/config')).json();
    assert.equal(config.release,'27.0.0');
    assert.ok(config.routes.length>=60);
    assert.match(config.waveStatus.part22,/locked sovereign burgundy gradient/);
    for(const endpoint of ['/api/v1/live-markets/catalog','/api/v1/live-markets/status','/api/v1/live-markets/candles?provider=fixture&symbol=BTCUSDT&interval=1m&limit=60','/api/v1/live-markets/ticker?provider=fixture&symbol=ETHUSDT','/api/v1/contracts/sovereign-live-markets']){
      const response=await fetch(base+endpoint);
      assert.equal(response.status,200,endpoint);
    }
    const candles=await (await fetch(base+'/api/v1/live-markets/candles?provider=fixture&symbol=BTCUSDT&limit=60')).json();
    assert.equal(candles.points.length,60);
    assert.equal(candles.guardrails.executionDisabled,true);
  } finally { await new Promise(resolve=>started.server.close(resolve)); }
});
