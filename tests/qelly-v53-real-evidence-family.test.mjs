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
  assert.match(source,/q-research-context-rail/);
  assert.match(source,/q-research-primary/);
  assert.match(source,/q-research-inspector/);
  assert.match(source,/Contradiction \/ falsification/);
  assert.match(source,/does not store structured contradiction, hypothesis confidence or falsification records/);
  assert.match(source,/Qelly will not infer them from note text/);
});

test('Portfolio Analytics exposes source, observed time, confidence, coverage and no-custody boundaries',async()=>{
  const source=await read('../apps/web/public/assets/routes/portfolio-analytics.mjs');
  assert.match(source,/q-v53-evidence-workspace/);
  assert.match(source,/q-v53-evidence-inspector/);
  assert.match(source,/Qelly deterministic portfolio performance fixture/);
  assert.match(source,/OBSERVED AT/);
  assert.match(source,/0\.82 chart evidence metadata/);
  assert.match(source,/COVERAGE/);
  assert.match(source,/No custodian or broker connection/);
  assert.match(source,/Research model only/);
  assert.doesNotMatch(source,/data-action="(?:execute|trade|order|wallet|withdraw)/i);
});

test('Workspace Watchlist separates persistent state from deterministic quote evidence',async()=>{
  const source=await read('../apps/web/public/assets/routes/workspace-watchlist.mjs');
  assert.match(source,/q-v53-evidence-workspace/);
  assert.match(source,/q-v53-evidence-inspector/);
  assert.match(source,/Workspace watchlist store \+ packaged quote fixture/);
  assert.match(source,/Quote observation time not supplied/);
  assert.match(source,/CONFIDENCE','Not supplied/);
  assert.match(source,/sharing private/i);
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
