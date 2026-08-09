import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const CSS='apps/web/public/assets/qelly-post-v53-convergence.css';
const RUNTIME='apps/web/public/assets/qelly-ui-lock-v5-3.mjs';
const ROUTES='apps/web/public/assets/route-registry.mjs';
const RESPONSIVE='scripts/release-v53-responsive-evidence.py';
const PORTFOLIO='apps/web/public/assets/routes/portfolio-analytics.mjs';
const FLAGSHIPS=['market','advanced-chart','research-workspace','screener-lab','portfolio-analytics','decision-provenance'];

test('post-V5.3 Wave 1 is explicitly activated by the governed V5.3 runtime',async()=>{
  const [css,runtime]=await Promise.all([read(CSS),read(RUNTIME)]);
  assert.match(runtime,/qelly-post-v53-convergence\.css/);
  assert.match(runtime,/dataset\.v53PostmergeConvergence='wave1'/);
  assert.match(runtime,/activatePostMergeConvergence\(\)/);
  assert.match(css,/post-V5\.3 convergence Wave 1/);
});

test('Wave 1 is limited to audited flagship routes and preserves Theme Studio',async()=>{
  const css=await read(CSS);
  for(const route of FLAGSHIPS)assert.ok(css.includes(`data-v53-route="${route}"`),`missing route ${route}`);
  assert.equal(css.includes('data-v53-route="theme-lab"'),false);
  assert.equal(css.includes('data-v53-route="theme-personas"'),false);
});

test('legacy Sovereign full-bleed hero geometry is reset on compact flagship headers',async()=>{
  const css=await read(CSS);
  assert.match(css,/\.q-page-head\{[^}]*min-height:0!important/);
  assert.match(css,/\.q-page-head\{[^}]*margin:0 0 8px!important/);
  assert.match(css,/\.q-page-head\{[^}]*width:auto!important/);
  assert.match(css,/\.q-page-head\{[^}]*background:none!important/);
  assert.match(css,/\.q-page-head\{[^}]*color:var\(--q-text\)!important/);
  assert.match(css,/\.q-page-head h1\{[^}]*color:var\(--q-text\)!important/);
  assert.match(css,/\.q-page-head p\{color:var\(--q-muted\)!important\}/);
  assert.doesNotMatch(css,/\.q-page-head\{[^}]*margin:-/);
});

test('responsive evidence rejects clipped content without banning legitimate full-bleed decoration',async()=>{
  const script=await read(RESPONSIVE);
  for(const route of FLAGSHIPS)assert.ok(script.includes(`'${route}'`),`responsive compact-header set missing ${route}`);
  assert.match(script,/COMPACT_HEADER_ROUTES=/);
  assert.match(script,/pageHeadContent/);
  assert.match(script,/pageActions/);
  assert.match(script,/compactPageHeadViewportBounds/);
  assert.match(script,/pageHeadContentViewportBounds/);
  assert.match(script,/pageActionsViewportBounds/);
  assert.match(script,/HEADER_BOUNDARY_TOLERANCE_PX=2/);
});

test('Market and Advanced Chart receive compact workstation geometry',async()=>{
  const css=await read(CSS);
  assert.match(css,/data-v53-route="market"[\s\S]*grid-template-columns:minmax\(0,2\.1fr\)/);
  assert.match(css,/#market-chart \.q-chart-shell\{min-height:390px!important\}/);
  assert.match(css,/data-v53-route="advanced-chart"[\s\S]*\.q-chart-stage\{height:420px;min-height:420px\}/);
  assert.match(css,/data-v53-route="advanced-chart"[\s\S]*\.q-two-column/);
});

test('Decision Provenance becomes a workstation grid without removing evidence',async()=>{
  const css=await read(CSS);
  assert.match(css,/q-decision-provenance-page\{display:grid;grid-template-columns:repeat\(12/);
  assert.match(css,/q-decision-maker-panel\{grid-column:span 7\}/);
  assert.match(css,/q-decision-graph-stack\{grid-column:1\/-1;display:grid/);
  assert.match(css,/q-decision-evidence-grid\{display:grid;grid-template-columns:repeat\(3/);
  assert.doesNotMatch(css,/visibility:hidden|content-visibility:hidden|opacity:0/);
});

test('mobile flagship summaries use horizontal task rails rather than stacked KPI walls',async()=>{
  const css=await read(CSS);
  assert.match(css,/@media\(max-width:768px\)/);
  assert.match(css,/\.q-kpi-grid\{display:flex!important;gap:7px;overflow-x:auto/);
  assert.match(css,/scroll-snap-type:x proximity/);
  assert.match(css,/q-decision-evidence-grid\{display:flex;overflow-x:auto;scroll-snap-type:x mandatory/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('Portfolio exposes broker state as a disabled boundary, not an action',async()=>{
  const source=await read(PORTFOLIO);
  assert.match(source,/Broker connections disabled/);
  assert.match(source,/disabled aria-disabled="true"/);
  assert.doesNotMatch(source,/>Connect broker</);
});

test('Wave 1 safety controls remain intact after canonical route expansion',async()=>{
  const [css,runtime,registry,portfolio]=await Promise.all([read(CSS),read(RUNTIME),read(ROUTES),read(PORTFOLIO)]);
  const routes=[...registry.matchAll(/route:'([^']+)'/g)].map(match=>match[1]);
  assert.equal(routes.length,71);
  const source=`${css}\n${runtime}\n${portfolio}`.toLowerCase();
  for(const phrase of ['place order','execute trade','buy now','sell now','connect wallet','private key','recovery phrase','withdraw funds','deposit funds']){
    assert.equal(source.includes(phrase),false,`forbidden control phrase: ${phrase}`);
  }
});
