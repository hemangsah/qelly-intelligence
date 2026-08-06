import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');

test('premium reset uses neutral institutional foundations and rare gradients',async()=>{
  const [foundation,assembly,rankings]=await Promise.all([
    read('apps/web/public/assets/premium-foundations.css'),
    read('apps/web/public/assets/qelly-premium-reset.css'),
    read('apps/web/public/assets/premium-rankings.css')
  ]);
  for(const value of ['#070507','#0d0a0c','#121014','#171319','#1c171b','#5b0828','#8e1d4b'])assert.match(foundation,new RegExp(value,'i'));
  assert.match(assembly,/premium-foundations\.css/);
  assert.match(assembly,/premium-table\.css/);
  assert.match(assembly,/premium-chart\.css/);
  const gradients=(foundation.match(/linear-gradient/g)??[]).length+(rankings.match(/linear-gradient/g)??[]).length;
  assert.ok(gradients<=2,`Expected at most two application gradients, found ${gradients}`);
  assert.doesNotMatch(foundation,/radial-gradient/);
});

test('Asset Rankings uses realistic deterministic OHLC and table-first composition',async()=>{
  const [data,route,chart]=await Promise.all([
    read('apps/web/public/assets/routes/asset-rankings-data.mjs'),
    read('apps/web/public/assets/routes/asset-rankings-premium.mjs'),
    read('apps/web/public/assets/routes/asset-rankings-chart.mjs')
  ]);
  for(const field of ['open','high','low','close','volume','oi','funding'])assert.match(data,new RegExp(field));
  assert.match(data,/regime/);
  assert.match(data,/shock/);
  assert.match(chart,/candlestick/);
  assert.match(chart,/q-mi-crosshair/);
  assert.match(chart,/q-mi-chart-tooltip/);
  assert.ok(route.indexOf('${tableMarkup')<route.indexOf('${chartMarkup'),'Ranking table must be composed before the chart');
});

test('premium rankings expose Discovery Terminal Research and governed market columns',async()=>{
  const [route,data,table]=await Promise.all([
    read('apps/web/public/assets/routes/asset-rankings-premium.mjs'),
    read('apps/web/public/assets/routes/asset-rankings-data.mjs'),
    read('apps/web/public/assets/routes/asset-rankings-table.mjs')
  ]);
  for(const mode of ['discovery','terminal','research'])assert.match(route,new RegExp(`'${mode}'`));
  for(const label of ['Rank','Watchlist','Asset','Price','1h','24h','7d','30d','Sparkline','Volume','Market Cap','FDV','Supply','Liquidity','Funding','OI','OI Change','Liquidation','Volatility','Confidence','Source','Freshness','Explain'])assert.match(data,new RegExp(`'${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}'`));
  for(const interaction of ['data-mi-search','data-mi-filter-toggle','data-mi-columns-toggle','data-mi-density-select','data-mi-watch','data-mi-explain','data-sort','data-mi-view'])assert.match(table,new RegExp(interaction));
});

test('SVG icon registry replaces temporary glyph navigation',async()=>{
  const [registry,shell,index]=await Promise.all([
    read('apps/web/public/assets/icon-registry.mjs'),
    read('apps/web/public/assets/shell-foundations.mjs'),
    read('apps/web/public/index.html')
  ]);
  for(const name of ['explain','evidence','markets','derivatives','trust','discovery','terminal','research'])assert.match(registry,new RegExp(`${name}:`));
  assert.match(shell,/icon\('explain'/);
  assert.match(shell,/icon\('menu'/);
  assert.doesNotMatch(shell,/[☰⚙✓✣⌁◉]/);
  assert.match(index,/qelly-premium-reset\.css/);
  assert.doesNotMatch(index,/>☰<|>⌕<|>◐<|>♢</);
});

test('static preview truth is compact and mobile is purpose-built',async()=>{
  const [route,mobile]=await Promise.all([
    read('apps/web/public/assets/routes/asset-rankings-premium.mjs'),
    read('apps/web/public/assets/premium-mobile.css')
  ]);
  assert.match(route,/Static visual preview/);
  assert.match(route,/Deterministic demonstration/);
  assert.match(route,/fixed scenario observations/);
  assert.match(route,/no live provider blending/);
  assert.match(route,/no trading or persistence/);
  assert.match(mobile,/q-mi-mobile-rankings/);
  assert.match(mobile,/q-mi-mobile-row/);
  assert.match(mobile,/safe-area-inset-bottom/);
  assert.match(mobile,/q-mi-filter-sheet>section/);
  assert.match(mobile,/q-mobile-navigation/);
});

test('research Figma motion and originality deliverables exist',async()=>{
  const files=[
    'design/research/REFERENCE_UI_FORENSICS.md','design/research/REFERENCE_COMPUTED_STYLES.json','design/research/REFERENCE_LAYOUT_METRICS.json','design/research/REFERENCE_MOTION_INVENTORY.json','design/research/REFERENCE_FEATURE_INVENTORY.csv','design/research/QELLY_SYNTHESIS_DECISIONS.md','design/review/VISUAL_FAILURE_REPORT.md','design/icons/QELLY_ICON_GUIDE.md','design/figma/QELLY_FIGMA_MASTER_SPEC.md','design/figma/QELLY_FIGMA_SCREEN_MATRIX.csv','design/figma/QELLY_FIGMA_COMPONENT_MATRIX.csv','design/figma/QELLY_DESIGN_REVIEW_CHECKLIST.md','QELLY_MOTION_SYSTEM.md','QELLY_MOTION_TOKENS.json'
  ];
  const contents=await Promise.all(files.map(read));
  assert.ok(contents.every((value)=>value.length>20));
  const figma=await read('figma-plugin/code.js');
  assert.match(figma,/31 Handoff/);
  assert.match(figma,/Qelly Premium Semantic/);
  assert.match(figma,/MASTER_SCREENS/);
  assert.doesNotMatch(figma,/EXPECTED_FRAME_COUNT/);
});
