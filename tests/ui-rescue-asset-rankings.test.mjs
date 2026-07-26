import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');

test('Asset Rankings rescue retains the six required market signals',async()=>{
  const route=await read('apps/web/public/assets/routes/asset-rankings.mjs');
  const labels=[
    'Global Market Cap',
    '24h Volume',
    'Open Interest',
    'Liquidations',
    'Funding Regime',
    'Market Breadth'
  ];
  for(const label of labels)assert.match(route,new RegExp(`label:'${label}'`));
});

test('Asset Rankings rescue exposes the complete institutional table contract',async()=>{
  const route=await read('apps/web/public/assets/routes/asset-rankings.mjs');
  for(const label of ['Asset','Price','24h','7d','Volume','Market Cap','Funding','OI','Liquidation','Confidence','Source','Watchlist']){
    assert.match(route,new RegExp(`label:'${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}'`));
  }
  for(const interaction of ['data-mi-search','data-mi-density','data-mi-filter-toggle','data-mi-columns-toggle','data-mi-watch','data-mi-timeframe','data-mi-explain']){
    assert.match(route,new RegExp(interaction));
  }
});

test('Static visual truth boundary remains explicit throughout the rescued surface',async()=>{
  const route=await read('apps/web/public/assets/routes/asset-rankings.mjs');
  assert.match(route,/Static visual preview · deterministic demo observations · backend unavailable · no production trading or persistence/);
  assert.match(route,/Demo · not live/);
  assert.match(route,/not a live explanation or investment advice/);
  assert.match(route,/browser demo watchlist/);
});

test('Rescued shell implements progressive navigation and responsive market layout',async()=>{
  const [shell,css,app,index]=await Promise.all([
    read('apps/web/public/assets/shell-foundations.mjs'),
    read('apps/web/public/assets/ui-rescue.css'),
    read('apps/web/public/assets/app.js'),
    read('apps/web/public/index.html')
  ]);
  for(const label of ['Markets','Asset Intelligence','Derivatives','Research','Portfolio','Decision Provenance','Operations','Trust']){
    assert.match(shell,new RegExp(`label:'${label}'`));
  }
  assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:1280px\)/);
  assert.match(css,/@media\(max-width:920px\)/);
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(app,/renderAssetRankings/);
  assert.match(index,/assets\/ui-rescue\.css/);
});
