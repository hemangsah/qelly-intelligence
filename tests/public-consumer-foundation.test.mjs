import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');

test('primary public consumer surfaces do not expose operator implementation language',async()=>{
  const [app,market,home,about]=await Promise.all([
    read('apps/web/public/assets/app.js'),
    read('apps/web/public/assets/routes/market-v6.mjs'),
    read('apps/web/public/assets/routes/feature-universe.mjs'),
    read('apps/web/public/assets/routes/about-qelly.mjs')
  ]);
  const asset=app.slice(app.indexOf('async function renderAsset(main) {'),app.indexOf('async function renderWatchlist(main) {'));
  assert.doesNotMatch(asset,/Canonical public asset|<dt>Ingestion<\/dt>|<dt>Cache<\/dt>|<dt>Entitlement<\/dt>|Inspect JSON/i);
  assert.match(asset,/Market snapshot/);
  assert.match(asset,/24h range risk/);
  assert.match(asset,/Evidence &amp; freshness/);
  assert.match(asset,/Decision Intelligence/);
  assert.match(asset,/News &amp; research/);
  assert.match(asset,/Events/);

  assert.doesNotMatch(market,/Embedded research suite|External intelligence dock|Governed Market Terminal|External display boundary|Analytics boundary/);
  assert.match(market,/'Market Pulse'/);
  assert.match(market,/Live market context/);

  assert.doesNotMatch(home,/identity-access|data-mesh|instrument-master|timeseries-lab|stream-operations|observability|security-evidence|migration-center/);
  assert.match(home,/Decision Intelligence/);
  assert.match(home,/Formula Screener/);
  assert.match(home,/Quant tools/);

  assert.doesNotMatch(about,/Governance reviewer|Production capability truth|Supabase-backed private persistence|market intelligence operating system/i);
  assert.match(about,/India market researcher/);
  assert.match(about,/Decision Intelligence/);
  assert.match(about,/Public research destinations/);
});

test('Home and About count only consumer-oriented public destinations',async()=>{
  const [home,about]=await Promise.all([
    read('apps/web/public/assets/routes/feature-universe.mjs'),
    read('apps/web/public/assets/routes/about-qelly.mjs')
  ]);
  assert.doesNotMatch(home,/name:'Govern'/);
  assert.match(home,/name:'Discover'/);
  assert.match(home,/name:'Analyse'/);
  assert.match(home,/name:'Quant tools'/);
  assert.match(home,/name:'Research'/);
  assert.match(about,/route\.public&&!route\.hidden&&!route\.route\.startsWith\('auth-'\)/);
});


test('public production shell navigation exposes only public non-hidden destinations',async()=>{
  const shell=await read('apps/web/public/assets/qelly-production-shell.mjs');
  assert.match(shell,/const FEATURE_ROUTES=routeDefinitions\.filter\(\(route\)=>route\.public===true&&!route\.hidden\)/);
  assert.match(shell,/const FEATURE_DOMAINS=productDomains\.filter\(\(domain\)=>FEATURE_ROUTES\.some/);
  assert.match(shell,/const groups=FEATURE_DOMAINS\.map/);
  assert.match(shell,/const filters=FEATURE_DOMAINS\.map/);
});


test('public route guidance and recovery states use consumer language',async()=>{
  const [registry,recovery]=await Promise.all([
    read('apps/web/public/assets/route-registry.mjs'),
    read('apps/web/public/assets/qelly-public-recovery.mjs')
  ]);
  for(const term of [
    "purpose:'Survey cross-asset market coverage, freshness and source availability.'",
    "purpose:'Start broad market discovery from available market coverage.'",
    "purpose:'Understand sources, methodology, freshness and coverage limits.'",
    "purpose:'Review cross-asset market context, charts and research sources in one place.'",
    "label:'Decision Intelligence'"
  ])assert.ok(registry.includes(term),term);
  assert.doesNotMatch(recovery,/qelly-intelligence\.pages\.dev|governed degraded mode|No authorized provider observation|no-fabrication boundary|Open governed Market Command/i);
  assert.match(recovery,/terminal\.qellyintelligence\.com/);
  assert.match(recovery,/No verified observation available/);
  assert.match(recovery,/No substitute data generated/);
});
