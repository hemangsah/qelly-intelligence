import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('orphaned first-party chart module is physically retired',async()=>{
  await assert.rejects(access(new URL('../apps/web/public/assets/market/tradingview-live-chart.mjs',import.meta.url)));
  const tree=await read('artifacts/QELLY_SOURCE_TREE.txt');
  assert.doesNotMatch(tree,/tradingview-live-chart\.mjs/);
});

test('live market routes use only owned TradingView widget modules',async()=>{
  const [market,network,india,index,worker,build]=await Promise.all([
    read('apps/web/public/assets/routes/market-v6.mjs'),
    read('apps/web/public/assets/routes/market-network.mjs'),
    read('apps/web/public/assets/routes/india-finance-center.mjs'),
    read('apps/web/public/index.html'),
    read('apps/web/public/qelly-service-worker.js'),
    read('scripts/build-frontend.mjs')
  ]);
  const source=`${market}\n${network}\n${india}\n${index}\n${worker}\n${build}`;
  assert.doesNotMatch(source,/tradingview-live-chart\.mjs|mountLiveMarketChart/);
  assert.match(market,/tradingview-display-widget\.mjs/);
  assert.match(market,/tradingview-market-grid\.mjs/);
  assert.match(market,/external-intelligence-widgets\.mjs/);
  assert.match(network,/lazy-tradingview-widget\.mjs/);
  assert.match(india,/lazy-tradingview-widget\.mjs/);
});
