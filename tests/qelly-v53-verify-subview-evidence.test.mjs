import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const REGISTRY='apps/web/public/assets/route-registry.mjs';
const BOOTSTRAP='apps/web/public/assets/qelly-verify-bootstrap.mjs';
const PRODUCT='apps/web/public/assets/qelly-verify-product.mjs';
const SHELL='apps/web/public/assets/qelly-verify-shell-nav.mjs';
const INDEX='apps/web/public/index.html';
const EVIDENCE='scripts/release-v53-verify-subview-evidence.py';
const WORKFLOW='.github/workflows/qelly-v53-verify-subview-evidence.yml';

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
  assert.match(bootstrap,/canonicalHash=view==='methodology'\?'#\/market\?view=evidence-methodology':'#\/qelly-verify'/);
  assert.match(bootstrap,/Qelly Verify · Qelly Intelligence/);
});

test('Verify product retains explicit local-only and execution-disabled boundaries',async()=>{
  const product=await read(PRODUCT);
  assert.match(product,/Local-only prototype evidence workflow/);
  assert.match(product,/Your file is processed in this browser and is not uploaded/);
  assert.match(product,/No live AI model, order execution or personalized financial recommendation is active/);
  assert.match(product,/<dt>Execution<\/dt><dd>Disabled<\/dd>/);
  assert.match(product,/Human validation remains required/);
});

test('current shell exposes canonical Verify and methodology through responsive native navigation primitives',async()=>{
  const [shell,index]=await Promise.all([read(SHELL),read(INDEX)]);
  assert.match(shell,/document\.getElementById\('primary-nav'\)/);
  assert.match(shell,/#context-shelf \.q-category-shelf/);
  assert.match(shell,/#main \.q-worldclass-context \.q-worldclass-related/);
  assert.match(shell,/MOBILE_SHELL_QUERY='\(max-width: 920px\)'/);
  assert.match(shell,/\[data-route="qelly-verify"\]/);
  assert.match(shell,/canonicalVerify\.dataset\.qellyVerifyLink='shell'/);
  assert.match(shell,/data-qelly-methodology-link="shell"/);
  assert.match(shell,/verify\.dataset\.qellyVerifyLink='worldclass'/);
  assert.match(shell,/method\.dataset\.qellyMethodologyLink='worldclass'/);
  assert.match(shell,/view==='qelly-verify'\?'#\/qelly-verify'/);
  assert.match(shell,/verify\.href='#\/qelly-verify'/);
  assert.match(shell,/shelf\.style\.setProperty\('display','flex','important'\)/);
  assert.match(shell,/shelf\.style\.removeProperty\('display'\)/);
  assert.match(shell,/method\.textContent='Evidence'/);
  assert.match(shell,/method\.setAttribute\('aria-label','Evidence Methodology'\)/);
  assert.match(shell,/related\.firstElementChild!==verify/);
  assert.match(shell,/route!=='market'&&route!=='qelly-verify'/);
  assert.match(shell,/responsiveShell\.addEventListener\?\.\('change',schedule\)/);
  assert.match(shell,/MutationObserver/);
  const productPosition=index.indexOf('./assets/qelly-verify-product.mjs');
  const shellPosition=index.indexOf('./assets/qelly-verify-shell-nav.mjs');
  assert.ok(productPosition>=0,'Verify product runtime missing from index');
  assert.ok(shellPosition>productPosition,'shell nav bridge must load after Verify product runtime');
});

test('dedicated evidence harness proves legacy Verify alias forwards to canonical route across nine widths',async()=>{
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
  assert.match(script,/primaryVerify/);
  assert.match(script,/shellMode:innerWidth<=920\?'shelf':'worldclass'/);
  assert.match(script,/shelfVerifyBounds/);
  assert.match(script,/contextVerifyBounds/);
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
    read('.github/workflows/qelly-all-screens-evidence.yml'),
    read('.github/workflows/qelly-all-screens-windows.yml'),
    read('.github/workflows/qelly-v53-responsive-evidence.yml')
  ]);
  assert.match(allScreens,/manifest\.routeCount===71/);
  assert.match(allScreens,/manifest\.renderCount===142/);
  assert.match(allScreens,/pngs\.length===142/);
  assert.match(windows,/manifest\.routeCount -ne 71/);
  assert.match(windows,/manifest\.renderCount -ne 142/);
  assert.match(windows,/pngCount -ne 142/);
  assert.match(responsive,/manifest\.canonicalRouteCount===71/);
  assert.match(responsive,/manifest\.representativeRouteCount===15/);
  assert.match(responsive,/manifest\.renderCount===135/);
  assert.match(responsive,/pngs\.length===135/);
});

test('Wave 4 introduces no execution, custody, wallet or secret-collection capability',async()=>{
  const [shell,evidence]=await Promise.all([read(SHELL),read(EVIDENCE)]);
  const source=`${shell}\n${evidence}`.toLowerCase();
  for(const phrase of ['place order','execute trade','buy now','sell now','connect wallet','private key','recovery phrase','withdraw funds','deposit funds']){
    assert.equal(source.includes(phrase),false,`forbidden capability phrase: ${phrase}`);
  }
});
