import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readDecisionAssetPreferences,saveDecisionAssetPreferences,toggleDecisionAssetFavorite,recordDecisionAssetRecent,decisionAssetSearchText} from '../apps/web/public/assets/decision-asset-picker.mjs';

const memoryStorage=()=>{
  const map=new Map();
  return {getItem:(key)=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),map};
};

test('Wave BX browser-only recent and favorites preferences are bounded and deterministic',()=>{
  const storage=memoryStorage();
  let favorites=toggleDecisionAssetFavorite([], 'btc');
  favorites=toggleDecisionAssetFavorite(favorites,'ETH');
  let recent=[];
  for(const symbol of ['BTC','ETH','SOL','XRP','HYPE','DOGE','BTC'])recent=recordDecisionAssetRecent(recent,symbol);
  const saved=saveDecisionAssetPreferences({favorites,recent},storage);
  assert.deepEqual(saved.favorites,['BTC','ETH']);
  assert.equal(saved.recent[0],'BTC');
  assert.equal(saved.recent.length,6);
  assert.deepEqual(readDecisionAssetPreferences(storage),saved);
  assert.deepEqual(toggleDecisionAssetFavorite(saved.favorites,'BTC'),['ETH']);
});

test('Wave BX search text covers symbol, category, venue and unavailable category reason',()=>{
  assert.match(decisionAssetSearchText({id:'crypto',label:'Crypto',state:'SUPPORTED'},{symbol:'BTC',name:'Bitcoin',category:'Layer 1',venue:'Hyperliquid'}),/btc.*bitcoin.*layer 1.*hyperliquid/);
  assert.match(decisionAssetSearchText({id:'metals',label:'Metals',state:'UNAVAILABLE',reason:'No governed provider'}),/metals.*unavailable.*governed provider/);
});

test('Wave BX Decision UI consumes the capability endpoint instead of a hard-coded six-item select',async()=>{
  const [route,css]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8')
  ]);
  assert.match(route,/\/api\/v1\/decision-assets/);
  assert.match(route,/PROVIDER-CAPABILITY UNIVERSE/);
  assert.match(route,/SUPPORTED DATA/);
  assert.match(route,/All categories/);
  assert.match(route,/Recent/);
  assert.match(route,/Favorites/);
  assert.match(route,/data-dpg-asset-search/);
  assert.match(route,/data-dpg-asset-select/);
  assert.match(route,/selectableSymbols\.includes\(symbol\)/);
  assert.match(route,/fallbackAssetCatalog/);
  assert.match(route,/Selected asset is unavailable under the current Decision capability contract/);
  assert.doesNotMatch(route,/select\('asset',\['BTC','ETH','SOL','HYPE','XRP','DOGE'\]\)/);
  assert.match(css,/\.q-dpg-asset-picker__panel/);
  assert.match(css,/@media\(max-width:760px\)/);
});


test('Wave BX stability and Browser E2E drive the real capability picker instead of the removed native asset select',async()=>{
  const [stability,e2e]=await Promise.all([
    readFile(new URL('../scripts/qelly-first-paint-stability.mjs',import.meta.url),'utf8'),
    readFile(new URL('../scripts/qelly-decision-range-selection-e2e.mjs',import.meta.url),'utf8')
  ]);
  assert.match(stability,/data-dpg-asset-picker-toggle/);
  assert.match(stability,/data-dpg-asset-select/);
  assert.doesNotMatch(stability,/selectOption\('\[data-dpg-asset\]'/);
  for(const token of ['asset-picker-capability','asset-picker-search','asset-picker-favorite','indian indices','global indices','unavailableSelectableCount'])assert.ok(e2e.includes(token),token);
});
