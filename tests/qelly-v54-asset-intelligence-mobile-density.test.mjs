import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const routeSource=await readFile(new URL('../apps/web/public/assets/routes/asset-intelligence.mjs',import.meta.url),'utf8');
const presentationStart=routeSource.indexOf('const ASSET_INTELLIGENCE_MOBILE_PRESENTATION');
const presentationEnd=routeSource.indexOf('let assetIntelligenceDensityMedia');
const presentationSource=routeSource.slice(presentationStart,presentationEnd);

test('Asset Intelligence preserves the full contract-first evidence surface',()=>{
  assert.equal((routeSource.match(/<article class="q-kpi">/g)||[]).length,4);
  assert.match(routeSource,/metricEntries\.map\(\(\[key,value\]\)=>/);
  assert.match(routeSource,/events\.items\.map\(\(item\)=>/);
  assert.match(routeSource,/filings\.items\.map\(\(item\)=>/);
  assert.match(routeSource,/rows:peers\.items/);
  for(const gate of ['Advanced charting','Fundamentals','Filings','Advice boundary']) assert.match(routeSource,new RegExp(`>${gate}<`));
  assert.match(routeSource,/Licensed fundamentals, live filings and investment advice remain disabled\./);
  assert.match(routeSource,/no recommendations, orders, trading or execution/);
});

test('Asset Intelligence owns a phone-only 2x2 density mode for KPI, metric, and gate evidence',()=>{
  assert.ok(presentationStart>=0&&presentationEnd>presentationStart);
  assert.match(routeSource,/window\.matchMedia\('\(max-width: 620px\)'\)/);
  for(const selector of ['.q-kpi-grid','.q-metric-grid','.q-gate-grid']) assert.ok(presentationSource.includes(`selector:'${selector}'`));
  assert.equal((presentationSource.match(/\['grid-template-columns','repeat\(2,minmax\(0,1fr\)\)'\]/g)||[]).length,3);
  assert.match(routeSource,/style\.setProperty\(property,value,'important'\)/);
  assert.match(routeSource,/style\.removeProperty\(property\)/);
  assert.match(routeSource,/page\.dataset\.assetIntelligenceDensity=active\?'mobile-grid':'desktop-default'/);
  assert.doesNotMatch(presentationSource,/display[^\n]*none|visibility[^\n]*hidden|opacity[^\n]*['"]0['"]/i);
});

test('Asset Intelligence density is scoped to its route root and leaves analytical engines untouched',()=>{
  assert.match(routeSource,/class="q-page q-asset-intelligence-page"/);
  assert.match(routeSource,/main\.querySelector\('\.q-asset-intelligence-page'\)/);
  assert.match(routeSource,/installAssetIntelligenceDensity\(page\)/);
  assert.match(routeSource,/QellyChartShell/);
  assert.match(routeSource,/QellyDataGrid/);
  assert.match(routeSource,/technical-study engine/);
  assert.doesNotMatch(presentationSource,/position|transform|scale|zoom/i);
});
