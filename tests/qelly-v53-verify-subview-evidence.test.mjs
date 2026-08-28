import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const REGISTRY='apps/web/public/assets/route-registry.mjs';
const BOOTSTRAP='apps/web/public/assets/qelly-verify-bootstrap.mjs';
const PRODUCT='apps/web/public/assets/qelly-verify-product.mjs';
const SHELL='apps/web/public/assets/qelly-verify-shell-nav.mjs';
const CANONICAL='apps/web/public/assets/qelly-v53-verify-canonical.mjs';
const VERIFY_CSS='apps/web/public/assets/qelly-v53-verify-convergence.css';
const BROWSER='scripts/qelly-verify-browser-check.mjs';
const INDEX='apps/web/public/index.html';
const EVIDENCE='scripts/release-v53-verify-subview-evidence.py';
const WORKFLOW='.github/workflows/verify-evidence.yml';

test('Qelly Verify is a canonical public Evidence route while methodology remains a Market subview',async()=>{
  const [registry,bootstrap]=await Promise.all([read(REGISTRY),read(BOOTSTRAP)]);
  const routes=[...registry.matchAll(/route:'([^']+)'/g)].map(match=>match[1]);
  assert.equal(routes.length,71);
  assert.equal(routes.includes('qelly-verify'),true);
  assert.equal(routes.includes('evidence-methodology'),false);
  assert.match(registry,/route:'qelly-verify', label:'Qelly Verify'.*public:true/);
  assert.match(registry,/'qelly-verify':'evidence'/);
  assert.ok(bootstrap.includes('verify:/^#\\/(?:qelly-verify|market\\?[^#]*\\bview=qelly-verify(?:&|$))/i'));
  assert.ok(bootstrap.includes('methodology:/^#\\/(?:evidence-methodology|market\\?[^#]*\\bview=evidence-methodology(?:&|$))/i'));
  assert.match(bootstrap,/canonicalHashFor=view=>view==='methodology'\?'#\/market\?view=evidence-methodology':view==='verify'\?'#\/qelly-verify':null/);
  assert.match(bootstrap,/if\(initialView\)\{setRequested\(initialView,'initial-url'\);normalizeHash\(initialView\);\}/);
  assert.match(bootstrap,/const currentView=viewFor\(location\.hash\)/);
  assert.match(bootstrap,/if\(!currentView\)\{setRequested\(null,'handoff-navigation'\);return;\}/);
  assert.match(bootstrap,/Qelly Verify · Qelly Intelligence/);
  assert.match(bootstrap,/setRequested\(view,view\?'hash':'hash-navigation'\)/);
  assert.doesNotMatch(bootstrap,/else if\(state\.lastIntent==='navigation-link'\)/);
});

test('Verify product retains explicit local-only and execution-disabled boundaries',async()=>{
  const product=await read(PRODUCT);
  assert.match(product,/Local-only prototype evidence workflow/);
  assert.match(product,/Your file is processed in this browser and is not uploaded/);
  assert.match(product,/No live AI model, order execution or personalized financial recommendation is active/);
  assert.match(product,/<dt>Execution<\/dt><dd>Disabled<\/dd>/);
  assert.match(product,/Human validation remains required/);
});

test('canonical V5.3 Verify is the sole first-view owner while preserving the CSV analyzer as secondary',async()=>{
  const [canonical,css,browser]=await Promise.all([read(CANONICAL),read(VERIFY_CSS),read(BROWSER)]);
  assert.match(canonical,/workbench\.dataset\.v53VerifyWorkbench='accepted-lock'/);
  assert.match(canonical,/Qelly Verify/);
  assert.match(canonical,/Formula validation, assumptions, sensitivity and reproducibility\./);
  assert.match(canonical,/data-v53-verify-primary/);
  assert.match(canonical,/data-v53-verify-context/);
  assert.match(canonical,/data-v53-verify-inspector/);
  assert.match(canonical,/data-v53-verify-activity/);
  assert.match(canonical,/data-v53-verify-formula/);
  assert.match(canonical,/Reproducibility sequence/);
  assert.doesNotMatch(canonical,/<time>00:00:00<\/time>/);
  assert.match(canonical,/No formula-specific assumptions are declared/);
  assert.match(canonical,/const assumptionSummary=assumptions\.length/);
  assert.match(canonical,/Strategy evidence tools · CSV analysis/);
  assert.match(canonical,/q-v53-strategy-tools/);
  assert.match(canonical,/const boundary=hero\?\.querySelector\('\.q-verify-boundary'\)/);
  assert.match(canonical,/if\(boundary\)details\.append\(boundary\)/);
  assert.match(css,/html\[data-qelly-verify-subview="qelly-verify"\] #main>\.q-worldclass-context\{display:none!important\}/);
  assert.match(css,/\.q-v53-verify-actions \.q-button\{min-height:44px/);
  assert.match(css,/\.q-v53-verify-evidence div\{grid-template-columns:minmax\(84px,\.65fr\) minmax\(0,1\.35fr\)\}/);
  assert.doesNotMatch(css,/q-v53-verify-inspector \.q-v53-verify-tabs[^}]*display:none/);
  assert.match(browser,/syntheticLockCount/);
  assert.match(browser,/worldclassContextVisible/);
  assert.match(browser,/visibleVerifyHeroCount/);
  assert.match(browser,/verify_not_first_view_owner/);
});

test('current shell exposes canonical Verify and methodology through governed navigation without making a mobile shelf an acceptance dependency',async()=>{
  const [shell,index]=await Promise.all([read(SHELL),read(INDEX)]);
  assert.match(shell,/document\.getElementById\('primary-nav'\)/);
  assert.match(shell,/\[data-route="qelly-verify"\]/);
  assert.match(shell,/canonicalVerify\.dataset\.qellyVerifyLink='shell'/);
  assert.match(shell,/data-qelly-methodology-link="shell"/);
  assert.match(shell,/view==='qelly-verify'\?'#\/qelly-verify'/);
  assert.match(shell,/verify\.href='#\/qelly-verify'/);
  assert.match(shell,/method\.textContent='Evidence'/);
  assert.match(shell,/route!=='market'&&route!=='qelly-verify'/);
  assert.match(shell,/responsiveShell\.addEventListener\?\.\('change',schedule\)/);
  assert.match(shell,/MutationObserver/);
  const productPosition=index.indexOf('./assets/qelly-verify-product.mjs');
  const bootstrapPosition=index.indexOf('./assets/qelly-verify-bootstrap.mjs');
  const appPosition=index.indexOf('./assets/app.js');
  const shellPosition=index.indexOf('./assets/qelly-verify-shell-nav.mjs');
  assert.ok(bootstrapPosition>=0&&bootstrapPosition<appPosition,'Verify route bootstrap must load before the application router');
  assert.ok(productPosition>=0,'Verify product runtime missing from index');
  assert.ok(shellPosition>productPosition,'shell nav bridge must load after Verify product runtime');
});

test('dedicated evidence harness proves alias normalization and accepted Verify workstation geometry across nine widths',async()=>{
  const [script,workflow]=await Promise.all([read(EVIDENCE),read(WORKFLOW)]);
  for(const width of [360,390,430,768,1024,1280,1440,1728,1920])assert.ok(script.includes(String(width)),`missing width ${width}`);
  assert.match(script,/'id':'qelly-verify'/);
  assert.match(script,/'hostRoute':'qelly-verify'/);
  assert.match(script,/'inputHash':'#\/market\?view=qelly-verify'/);
  assert.match(script,/'canonicalHash':'#\/qelly-verify'/);
  assert.match(script,/'id':'evidence-methodology'/);
  assert.match(script,/canonical route count changed unexpectedly/);
  assert.match(script,/canonical Qelly Verify route missing/);
  assert.match(script,/Evidence Methodology must remain a governed Market subview/);
  assert.match(script,/data-v53-verify-workbench=\"accepted-lock\"/);
  assert.match(script,/data-v53-verify-primary/);
  assert.match(script,/data-v53-verify-context/);
  assert.match(script,/data-v53-verify-inspector/);
  assert.match(script,/data-v53-verify-activity/);
  assert.match(script,/data-v53-verify-formula/);
  assert.match(script,/Verify KPI strip is incomplete/);
  assert.match(script,/Verify Inspector evidence is incomplete/);
  assert.match(script,/task-first accepted-lock composition; no duplicate mobile top shelf required/);
  assert.doesNotMatch(script,/shellMode:innerWidth<=920\?'shelf':'worldclass'/);
  assert.match(script,/aliasNormalized/);
  assert.match(workflow,/manifest\.canonicalRouteCount===71/);
  assert.match(workflow,/manifest\.canonicalRoute==='qelly-verify'/);
  assert.match(workflow,/manifest\.methodologyHostRoute==='market'/);
  assert.match(workflow,/manifest\.renderCount===18/);
  assert.match(workflow,/manifest\.expectedRenderCount===18/);
  assert.match(workflow,/manifest\.aliasNormalized===true/);
});

test('Wave 4 raises complete-route denominators without weakening representative responsive coverage',async()=>{
  const [allScreens,windows,responsive]=await Promise.all([
    read('.github/workflows/browser-e2e.yml'),
    read('.github/workflows/browser-e2e-windows.yml'),
    read('.github/workflows/responsive-e2e.yml')
  ]);
  assert.match(allScreens,/manifest\.routeCount===71/);
  assert.match(allScreens,/manifest\.renderCount===142/);
  assert.match(allScreens,/pngs\.length===142/);
  assert.match(windows,/manifest\.routeCount -ne 71/);
  assert.match(windows,/manifest\.renderCount -ne 142/);
  assert.match(windows,/pngCount -ne 142/);
  assert.match(responsive,/manifest\.canonicalRouteCount===71/);
  assert.match(responsive,/manifest\.representativeRouteCount===manifest\.routes\.length/);
  assert.match(responsive,/manifest\.representativeRouteCount>=17/);
  assert.match(responsive,/manifest\.routes\.includes\('asset-intelligence'\)/);
  assert.match(responsive,/manifest\.routes\.includes\('fundamentals-estimates'\)/);
  assert.match(responsive,/const expectedRenderCount=manifest\.representativeRouteCount\*manifest\.viewportCount/);
  assert.match(responsive,/manifest\.renderCount===expectedRenderCount/);
  assert.match(responsive,/manifest\.expectedRenderCount===expectedRenderCount/);
  assert.match(responsive,/pngs\.length===expectedRenderCount/);
  assert.doesNotMatch(responsive,/manifest\.representativeRouteCount===15|manifest\.representativeRouteCount===16|manifest\.renderCount===135|manifest\.renderCount===144|pngs\.length===135|pngs\.length===144/);
});

test('Wave 4 introduces no execution, custody, wallet or secret-collection capability',async()=>{
  const [shell,evidence]=await Promise.all([read(SHELL),read(EVIDENCE)]);
  const source=`${shell}\n${evidence}`.toLowerCase();
  for(const phrase of ['place order','execute trade','buy now','sell now','connect wallet','private key','recovery phrase','withdraw funds','deposit funds']){
    assert.equal(source.includes(phrase),false,`forbidden capability phrase: ${phrase}`);
  }
});
