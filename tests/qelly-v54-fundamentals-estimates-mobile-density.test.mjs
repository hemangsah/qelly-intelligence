import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const ENHANCEMENT='apps/web/public/assets/routes/fundamentals-estimates-enhancement.mjs';
const ROUTE='apps/web/public/assets/routes/fundamentals-estimates.mjs';
const RESPONSIVE='scripts/release-v53-responsive-evidence.py';

test('Fundamentals phone density is semantic, reversible and evidence-preserving',async()=>{
  const source=await read(ENHANCEMENT);
  assert.match(source,/matchMedia\('\(max-width: 620px\)'\)/);
  assert.match(source,/querySelector\('#fundamental-asset'\)/);
  assert.match(source,/querySelector\('#annual-grid'\)/);
  assert.match(source,/\[data-action="open-filings"\]/);
  assert.match(source,/\[data-action="compare"\]/);
  assert.match(source,/grid-template-columns':'repeat\(2,minmax\(0,1fr\)\)'/);
  assert.match(source,/grid-template-columns':'repeat\(3,minmax\(0,1fr\)\)'/);
  assert.match(source,/element\.style\.removeProperty\(name\)/);
  const body=source.slice(source.indexOf('function applyFundamentalsDensity'),source.indexOf('export function installFundamentalsDensity'));
  assert.doesNotMatch(body,/display['"]?\s*:\s*['"]none|visibility['"]?\s*:\s*['"]hidden|opacity['"]?\s*:\s*['"]0/);
});

test('Fundamentals keeps every financial request and mapped evidence collection',async()=>{
  const route=await read(ROUTE);
  for(const endpoint of [
    '/overview',
    '/financials?frequency=annual',
    '/financials?frequency=quarterly',
    '/earnings',
    '/estimates',
    '/corporate-actions'
  ])assert.ok(route.includes(endpoint),`missing endpoint ${endpoint}`);
  assert.match(route,/annual\.statements\.map/);
  assert.match(route,/quarterly\.statements\.map/);
  assert.match(route,/earnings\.items\.map/);
  assert.match(route,/actions\.items\.map/);
  assert.match(route,/quarterly\.derived/);
  assert.match(route,/revisionBreadth/);
  assert.match(route,/analystCount/);
  assert.doesNotMatch(route,/annual\.statements\.slice\s*\(/);
  assert.doesNotMatch(route,/quarterly\.statements\.slice\s*\(/);
  assert.doesNotMatch(route,/earnings\.items\.slice\s*\(/);
  assert.doesNotMatch(route,/actions\.items\.slice\s*\(/);
});

test('Fundamentals annual grid and truth labels remain unchanged',async()=>{
  const route=await read(ROUTE);
  assert.match(route,/new QellyDataGrid\(document\.getElementById\('annual-grid'\)/);
  assert.match(route,/licensed provider required/);
  assert.match(route,/deterministic fixtures, not licensed statements/);
  assert.match(route,/estimate fixture/);
  assert.match(route,/not live/);
  assert.match(route,/caption:'Annual financial statement fixtures'/);
});

test('Fundamentals installs density synchronously from the route and stays in governed responsive evidence',async()=>{
  const route=await read(ROUTE);
  const responsive=await read(RESPONSIVE);
  assert.match(route,/import \{installFundamentalsDensity\} from '\.\/fundamentals-estimates-enhancement\.mjs'/);
  assert.match(route,/installFundamentalsDensity\(main\)/);
  assert.ok(route.indexOf('installFundamentalsDensity(main)')<route.indexOf("new QellyDataGrid(document.getElementById('annual-grid')"));
  assert.match(responsive,/'fundamentals-estimates'/);
  for(const width of [360,390,430,768,1024,1280,1440,1728,1920]){
    assert.ok(responsive.includes(String(width)),`missing governed viewport ${width}`);
  }
});
