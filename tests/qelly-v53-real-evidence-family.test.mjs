import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const cleanup=()=>read('../apps/web/public/assets/qelly-v53-lock-route-cleanup.mjs');
const css=()=>read('../apps/web/public/assets/qelly-v53-real-evidence.css');

test('evidence and portfolio routes own their real DOM instead of synthetic lock candidate surfaces',async()=>{
  const source=await cleanup();
  assert.match(source,/REAL_EVIDENCE_ROUTES=new Set\(\['research-workspace','portfolio-analytics','watchlist','saved-calculations','calculator-detail','decision-provenance'\]\)/);
  assert.match(source,/\.\.\.REAL_EVIDENCE_ROUTES/);
  assert.match(source,/qelly-v53-real-evidence\.css/);
  assert.match(source,/root\.dataset\.v53RealEvidence=route/);
  assert.match(source,/synthetic&&isDedicatedRealRoute\(\)/);
});

test('real evidence family layout is route-scoped, inspector-capable and mobile-collapsible',async()=>{
  const source=await css();
  assert.match(source,/html\[data-v53-real-evidence\] #main > \.q-page/);
  assert.match(source,/grid-template-columns:minmax\(0,1fr\) 292px/);
  assert.match(source,/q-v53-evidence-inspector/);
  assert.match(source,/data-v53-real-evidence="research-workspace"/);
  assert.match(source,/grid-template-columns:220px minmax\(0,1fr\) 300px/);
  assert.match(source,/@media\(max-width:900px\)/);
  assert.match(source,/grid-template-columns:1fr/);
  assert.match(source,/scroll-snap-type:x mandatory/);
  assert.doesNotMatch(source,/\.q-v53-lock-page/);
  assert.doesNotMatch(source,/display\s*:\s*none/);
});

test('Research Workspace retains genuine evidence, Inspector and falsification boundaries',async()=>{
  const source=await read('../apps/web/public/assets/routes/research-workspace.mjs');
  assert.match(source,/q-research-v2-charter/);
  assert.match(source,/q-research-v2-register/);
  assert.match(source,/q-research-v2-inspector/);
  assert.match(source,/Counter-evidence/);
  assert.match(source,/Invalidation conditions/);
  assert.match(source,/research completeness, not prediction accuracy/i);
  assert.match(source,/does not execute trades/);
  assert.match(source,/convert missing sources into facts/);
});

test('Portfolio Analytics separates Cloud RLS positions from unavailable market valuation and preserves no-custody boundaries',async()=>{
  const source=await read('../apps/web/public/assets/routes/portfolio-analytics.mjs');
  assert.match(source,/q-v53-evidence-workspace/);
  assert.match(source,/q-v53-evidence-inspector/);
  assert.match(source,/data-portfolio-persistence="CLOUD RLS"/);
  assert.match(source,/data-portfolio-valuation-truth="UNAVAILABLE"/);
  assert.match(source,/No approved valuation observation/);
  assert.match(source,/No governed valuation series/);
  assert.match(source,/Qelly does not invent prices, P&amp;L, performance or risk/);
  assert.match(source,/No custodian or broker connection/);
  assert.doesNotMatch(source,/deterministic portfolio performance fixture|scenario only|packaged performance history/i);
  assert.doesNotMatch(source,/data-action="(?:execute|trade|order|wallet|withdraw)/i);
});

test('Workspace Watchlist separates Cloud RLS persistence from unavailable quote truth',async()=>{
  const source=await read('../apps/web/public/assets/routes/workspace-watchlist.mjs');
  assert.match(source,/q-v53-evidence-workspace/);
  assert.match(source,/q-v53-evidence-inspector/);
  assert.match(source,/data-watchlist-persistence="CLOUD RLS"/);
  assert.match(source,/data-watchlist-quote-truth="UNAVAILABLE"/);
  assert.match(source,/Secure cloud · private workspace/);
  assert.match(source,/Not yet available/);
  assert.match(source,/Awaiting an approved market-data source/);
  assert.match(source,/Prices and daily changes will appear only when an approved market-data source is connected/i);
  assert.match(source,/Private to workspace members/);
  assert.doesNotMatch(source,/Supabase workspace-scoped|Authenticated Supabase workspace tables|RLS governed/i);
  assert.doesNotMatch(source,/packaged quote fixture|local JSON|fixture quotes|Watchlist created locally/i);
});

test('Saved Calculations remains explicit about local persistence, cloud opt-in and conflict handling',async()=>{
  const source=await read('../apps/web/public/assets/routes/saved-calculations.mjs');
  assert.match(source,/DETERMINISTIC LOCAL/);
  assert.match(source,/Local mode remains the default/);
  assert.match(source,/Nothing uploads until you explicitly enable cloud sync/);
  assert.match(source,/Conflicts stop automatic overwrite/);
  assert.match(source,/Offline batches are never silently discarded/);
});

test('Calculator Detail remains deterministic, documented and free of provider or execution calls',async()=>{
  const source=await read('../apps/web/public/assets/routes/calculator-detail.mjs');
  assert.match(source,/Calculations run locally using the documented Qelly formula/);
  assert.match(source,/No provider, broker or exchange call is made/);
  assert.match(source,/Method and assumptions/);
  assert.match(source,/calculateFormula/);
  assert.doesNotMatch(source,/data-action="(?:execute|trade|order|wallet|withdraw)/i);
});

test('Decision Provenance retains governed evidence traversal and human-control boundaries',async()=>{
  const source=await read('../apps/web/public/assets/routes/decision-provenance.mjs');
  assert.match(source,/Evidence graph · traversal mode/);
  assert.match(source,/Observed facts/);
  assert.match(source,/Contradicts/);
  assert.match(source,/Invalidation condition/);
  assert.match(source,/Execution disabled/);
  assert.match(source,/Human verification required/);
});
