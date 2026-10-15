import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from './release-a5-evidence-server.mjs';

// Run only against the exact candidate's cloud-built dist/frontend. These
// synthetic read responses exercise presentation and never prove real sign-in,
// provider permissions, data freshness or production numerical correctness.
assert.equal(process.env.GITHUB_ACTIONS,'true','Run this diagnostic only in the official cloud Playwright job.');
const sourceSha=process.env.QELLY_SCREEN_EVIDENCE_SHA;
assert.match(sourceSha||'',/^[a-f0-9]{40}$/,'An exact candidate source SHA is required.');
const out='artifacts/uiux-operations-reference';
const fixtureId='operations-reference-isolated-synthetic-read-only-v1';
const appearances=['dark','light'],widths=[1440,1280,768,390,320];
const routes=[
  {route:'data-mesh',kind:'runtime',module:'/assets/routes/provider-runtime-v6.mjs',failurePath:'/api/v1/providers/runtime',errorTitle:'Provider runtime unavailable',surfaces:5},
  {route:'instrument-master',kind:'instrument',module:'/assets/routes/instrument-master-v6.mjs',failurePath:'/api/v1/instruments/summary',errorTitle:'Instrument registry unavailable',surfaces:3},
  {route:'timeseries-lab',kind:'series',module:'/assets/routes/time-series-v6.mjs',failurePath:'/api/v1/timeseries/summary',errorTitle:'Time-series service unavailable',surfaces:4}
];
const expectedCases=appearances.length*widths.length*(routes.length*2+1);
const errorReason='Isolated operations <unavailable> & "quoted" <img src=x onerror="window.__operationsReferenceInjection=true"> <script>window.__operationsReferenceInjection=true</script>';
const observedAt='2026-09-28T16:00:00.000Z',ingestedAt='2026-09-28T16:03:00.000Z';
const instruments=[
  {canonicalId:'FIXTURE-FX-EURINR',canonicalKey:'FIXTURE-FX-EURINR-REFERENCE-IDENTITY-WRAPPING-PROBE-000000000001',symbol:'EURINR',displayName:'Euro / Indian Rupee · isolated synthetic fixture <unavailable> & "quoted"',assetClass:'fx',venue:'ECB-REFERENCE',baseAsset:'EUR',quoteAsset:'INR',currency:'INR',seriesKey:'fixture:ecb:eurinr:1d',metric:'reference rate',value:93.125678,unit:'synthetic INR / EUR',truthState:'DELAYED',observedAt,ingestedAt},
  {canonicalId:'FIXTURE-FX-EURUSD',canonicalKey:'FIXTURE-FX-EURUSD-REFERENCE-0002',symbol:'EURUSD',displayName:'Euro / US Dollar · isolated synthetic fixture',assetClass:'fx',venue:'ECB-REFERENCE',baseAsset:'EUR',quoteAsset:'USD',currency:'USD',seriesKey:'fixture:ecb:eurusd:1d',metric:'reference rate',value:1.234567,unit:'synthetic USD / EUR',truthState:'CACHED',observedAt,ingestedAt},
  {canonicalId:'FIXTURE-EQUITY-ASTER',canonicalKey:'FIXTURE-EQUITY-ASTER-REFERENCE-0003',symbol:'ASTER',displayName:'Aster synthetic equity · presentation fixture only',assetClass:'equity',venue:'FIXTURE-VENUE',baseAsset:'ASTER',quoteAsset:'USD',currency:'USD',seriesKey:'fixture:aster:1d',metric:'diagnostic value',value:1234.56789,unit:'synthetic USD',truthState:'UNAVAILABLE',observedAt,ingestedAt}
];
const identity={
  user:{userId:'00000000-0000-4000-8000-000000000001',displayName:'Isolated synthetic operations fixture',email:'operations-fixture@example.invalid'},
  organization:{name:'Isolated synthetic UI fixture'},
  workspace:{workspaceId:'00000000-0000-4000-8000-000000000002',name:'Synthetic read-only operations fixture'},
  session:{sessionId:'operations-synthetic-ui-fixture',assurance:'isolated-synthetic-fixture'},mode:fixtureId
};
const format=value=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(value);
const pointsFor=(id,limit=65)=>Array.from({length:90},(_,index)=>({
  observedAt:new Date(Date.UTC(2026,6,1+index,16)).toISOString(),
  ingestedAt:new Date(Date.UTC(2026,6,1+index,16,3)).toISOString(),
  value:(1600+index*3+(index%7)*11)/16+(id==='FIXTURE-FX-EURUSD'?200:0),truthState:'DELAYED'
})).slice(-limit);
function historyResponse(id,limit){
  const instrument=instruments.find(item=>item.canonicalId===id);
  assert.ok(instrument,'Only an explicitly synthetic fixture series may be requested.');
  return {instrument,points:pointsFor(id,limit),series:{metric:'synthetic reference rate',unit:instrument.unit,methodology:'Synthetic diagnostic observations; no production analytics'},provider:{providerKey:'fixture-ecb',displayName:'Isolated synthetic ECB-shaped fixture',commercialRightsStatus:'fixture-only',redistributionRightsStatus:'not redistributed',attribution:'Synthetic UI diagnostic; not provider observations'},metadata:{freshnessClass:'DELAYED',fixtureId},guardrails:{readOnly:true,execution:false},evidenceBoundary:fixtureId};
}
const reads={
  '/api/v1/providers/runtime':{providers:[
    {id:'ecb',policyEnabled:true,runtimeState:'REFERENCE_ENABLED',capabilities:['synthetic fx reference fixture'],termsState:'conditionally_approved_attributed_reference_data',termsUrl:'https://www.ecb.europa.eu/'},
    {id:'binance',policyEnabled:false,runtimeState:'UNAVAILABLE',capabilities:['synthetic blocked-provider fixture'],termsState:'blocked_pending_redistribution_rights',termsUrl:'https://developers.binance.com/'},
    {id:'coinbase',policyEnabled:false,runtimeState:'UNAVAILABLE',capabilities:['synthetic blocked-provider fixture'],termsState:'blocked_pending_written_end_user_display_permission',termsUrl:'https://www.coinbase.com/legal/market_data'}
  ],evidenceBoundary:fixtureId},
  '/api/v1/data-quality/incidents':{items:[
    {eventType:'Synthetic freshness warning',status:'open',severity:'WARNING',detectedAt:observedAt},
    {eventType:'Synthetic schema review <unavailable> & "quoted"',status:'open',severity:'UNAVAILABLE',detectedAt:observedAt},
    {eventType:'Resolved synthetic incident must stay hidden',status:'resolved',severity:'PASS',detectedAt:observedAt}
  ]},
  '/api/v1/contracts/entitlements':{decision:'DENY',evaluation:'Synthetic deny-by-default UI fixture',dimensions:['fixture workspace','synthetic reference scope'],obligations:['fixture-only; no production rights asserted']},
  '/api/v1/platform/data-plane':{canonicalRuntime:'isolated-synthetic-ui-runtime',releaseSha:sourceSha,releaseCongruence:{state:'MATCH',recordedSha:sourceSha},dataPlane:{instrumentCount:3,seriesCount:2,pointCount:180,providerCount:3},items:instruments,guardrails:{readOnly:true,execution:false},evidenceBoundary:fixtureId},
  '/api/v1/instruments/summary':{instruments:3,venues:2,byAssetClass:[{assetClass:'fx',count:2},{assetClass:'equity',count:1}],productionReferenceData:false,systemOfRecord:fixtureId},
  '/api/v1/instruments/search':{items:instruments,evidenceBoundary:fixtureId},
  '/api/v1/timeseries/summary':{instruments:3,series:2,points:180,items:instruments,evidenceBoundary:fixtureId}
};
const requiredReads=Object.keys(reads);
const results=[],sessions=[];
let server,browser,active,activeCase,fatalError;

async function focusEvidence(page,control){
  // Establish keyboard modality before programmatic focus so :focus-visible
  // is measured as the user reaches the native control with a keyboard.
  await page.keyboard.press('Tab');await control.focus();
  const measured=await control.evaluate(node=>({outlineWidth:parseFloat(getComputedStyle(node).outlineWidth),outlineStyle:getComputedStyle(node).outlineStyle,height:node.getBoundingClientRect().height,width:node.getBoundingClientRect().width}));
  assert.ok(measured.outlineWidth>=2&&measured.outlineStyle!=='none',JSON.stringify(measured));
  assert.ok(measured.height>=44,JSON.stringify(measured));
  return measured;
}
async function readEvidence(locator){
  return locator.evaluate(node=>Object.fromEntries([...node.querySelectorAll('dt')].map(dt=>[dt.textContent.trim(),dt.nextElementSibling?.textContent.trim()])));
}
async function assertEscaping(page,root,reason){
  assert.equal(await root.locator('img,script,unavailable').count(),0);
  assert.equal(await page.evaluate(()=>window.__operationsReferenceInjection),false);
  if(reason)assert.equal(await root.locator('.q-reference-empty-state p').innerText(),reason);
}
async function measurePresentation(page,root){
  const measured=await root.evaluate(root=>{
    const visible=node=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0;};
    const style=node=>{const computed=getComputedStyle(node);return {class:node.className,borders:[computed.borderTopWidth,computed.borderRightWidth,computed.borderBottomWidth,computed.borderLeftWidth],radius:computed.borderRadius,shadow:computed.boxShadow,backgroundImage:computed.backgroundImage};};
    return {
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      rootWidth:root.getBoundingClientRect().width,
      legacyClasses:[...root.querySelectorAll('[class]')].flatMap(node=>[...node.classList]).filter(name=>/^q-(?:panel(?:-|$)|kpi(?:-|$)|v6-(?:runtime|instrument|release|evidence))/.test(name)),
      surfaces:[...root.querySelectorAll('.q-reference-surface')].filter(visible).map(style),
      ordinary:[...root.querySelectorAll('.q-reference-runtime-kpis>div,.q-reference-series-summary>div,.q-reference-release-strip,.q-reference-runtime-provider,.q-reference-runtime-row,.q-reference-series-row,.q-reference-instrument-card,.q-reference-empty-state,.q-reference-status')].filter(visible).map(style),
      numeric:[...root.querySelectorAll('.q-reference-runtime-kpis strong,.q-reference-series-summary strong,.q-reference-release-strip strong,.q-reference-series-latest,#v6-series-range strong,.q-reference-instrument-card b')].filter(visible).map(node=>({text:node.textContent.trim(),clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,textOverflow:getComputedStyle(node).textOverflow}))
    };
  });
  assert.equal(measured.overflow,false,'Document overflow: '+JSON.stringify(measured));
  assert.ok(measured.rootWidth>=Math.min(240,page.viewportSize().width*.7));
  assert.deepEqual(measured.legacyClasses,[]);
  assert.ok(measured.surfaces.length>0);
  for(const surface of measured.surfaces){
    assert.deepEqual(surface.borders,['0px','0px','0px','0px'],surface.class);
    assert.equal(surface.radius,'0px',surface.class);assert.equal(surface.shadow,'none',surface.class);assert.equal(surface.backgroundImage,'none',surface.class);
  }
  for(const item of measured.ordinary){
    // A one-edge reading divider is allowed; a decorative perimeter is not.
    assert.ok(item.borders.some(value=>value==='0px'),item.class);
    assert.equal(item.radius,'0px',item.class);assert.equal(item.shadow,'none',item.class);assert.equal(item.backgroundImage,'none',item.class);
  }
  for(const number of measured.numeric){assert.ok(number.scrollWidth<=number.clientWidth+1,JSON.stringify(number));assert.notEqual(number.textOverflow,'ellipsis',JSON.stringify(number));}
  return measured;
}
async function navigate(page,site,spec,appearance){
  await page.goto(site+'/#/about-qelly',{waitUntil:'domcontentloaded'});
  await page.locator('.q-about-v2-page').waitFor();
  await page.locator('#main[aria-busy="false"]').waitFor();
  await page.goto(site+'/#/'+spec.route,{waitUntil:'domcontentloaded'});
  const root=page.locator('#main .q-reference-page.q-reference-'+spec.kind+'-page');
  await root.waitFor();await page.locator('#main[aria-busy="false"]').waitFor();
  await page.waitForFunction(a=>document.documentElement.dataset.resolvedAppearance===a,appearance);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('link[rel="stylesheet"]')).every(link=>link.sheet));
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(new URL(page.url()).hash,'#/'+spec.route);
  assert.equal(await root.locator('.q-access-gate,.q-capability-boundary').count(),0);
  assert.equal(await page.evaluate(()=>window.__QELLY_SESSION_STATE__?.identity?.mode),fixtureId);
  return root;
}
async function verifyRuntime(root){
  assert.equal(await root.locator('.q-reference-runtime-provider').count(),3);
  assert.deepEqual(await root.locator('.q-reference-runtime-kpis strong').allTextContents(),['3','2','180','3','2','Verified']);
  const providers=await root.locator('.q-reference-runtime-provider').evaluateAll(nodes=>nodes.map(node=>({id:node.querySelector('strong').textContent,status:node.querySelector('.q-reference-status').textContent})));
  assert.deepEqual(providers,[{id:'ECB',status:'Approved reference'},{id:'BINANCE',status:'Awaiting approval'},{id:'COINBASE',status:'Awaiting approval'}]);
  assert.equal(await root.locator('.q-reference-runtime-row').count(),5);
  assert.equal((await root.innerText()).includes('Resolved synthetic incident must stay hidden'),false);
  assert.ok((await root.innerText()).includes('Synthetic schema review <unavailable> & "quoted"'));
  const entitlement=root.locator('.q-reference-surface').filter({hasText:'Entitlement boundary'});
  const evidence=await readEvidence(entitlement);
  for(const key of ['Execution','Custody','Money movement'])assert.equal(evidence[key],'DENY');
  assert.equal(await root.locator('a[href="#/live-markets"]').count(),1);
  assert.equal(await root.locator('a[href="#/live-markets"]').innerText(),'Global Market Network');
  assert.equal(await root.locator('a[href="#/timeseries-lab"]').count(),2);
  const releaseStrip=await root.locator('.q-reference-release-strip').innerText();
  assert.ok(releaseStrip.includes('Verified'));assert.equal(/Runtime SHA|Recorded SHA/.test(releaseStrip),false);
  assert.equal((await root.innerText()).includes(sourceSha),false);
  const externalLinks=await root.locator('a[target="_blank"]').evaluateAll(nodes=>nodes.map(node=>({href:node.href,rel:node.rel})));
  assert.equal(externalLinks.length,6);
  for(const link of externalLinks)for(const rel of ['noopener','noreferrer','nofollow'])assert.ok(link.rel.split(' ').includes(rel),JSON.stringify(link));
  return {providerAvailabilityPreserved:true,incidentFilteringPreserved:true,entitlementDenyPreserved:true,navigationLinksPreserved:true,releaseIdentityReadable:true,rawReleaseHashesOmitted:true,externalLinks};
}
async function verifyInstruments(page,root){
  const query=root.locator('#v6-instrument-filter'),classes=root.locator('#v6-instrument-class'),count=root.locator('#v6-instrument-count'),rows=root.locator('.q-reference-instrument-card');
  assert.equal(await rows.count(),3);assert.equal(await count.innerText(),'3 records');
  const focus=await focusEvidence(page,query);await focusEvidence(page,classes);
  await query.fill('  EURO  ');assert.equal(await count.innerText(),'2 records');
  await classes.selectOption('equity');assert.equal(await count.innerText(),'0 records');
  assert.equal(await root.locator('#v6-instrument-grid').innerText(),'No governed instrument matches this filter.');
  await query.fill('');assert.equal(await count.innerText(),'1 records');
  assert.equal(await rows.locator('strong').innerText(),'ASTER');
  await classes.selectOption('fx');await query.fill('rupee');assert.equal(await count.innerText(),'1 records');
  assert.equal(await rows.locator('strong').innerText(),'EURINR');
  await query.fill('FIXTURE-FX-EURUSD-REFERENCE');assert.equal(await count.innerText(),'1 records');
  assert.equal(await rows.locator('strong').innerText(),'EURUSD');
  await query.fill('');await classes.selectOption('');assert.equal(await rows.count(),3);
  await focusEvidence(page,rows.nth(2));await rows.nth(2).press('Enter');
  let evidence=await readEvidence(root.locator('#v6-instrument-evidence'));
  assert.equal(evidence['Canonical key'],instruments[2].canonicalKey);assert.equal(evidence.Symbol,'ASTER');assert.equal(evidence['Latest value'],format(instruments[2].value));
  assert.equal(evidence['Truth state'],'UNAVAILABLE');assert.equal(evidence.Execution,'Disabled');
  assert.equal(await root.locator('.q-reference-instrument-card.is-selected').count(),1);
  assert.equal(await rows.nth(2).getAttribute('aria-pressed'),'true');
  await rows.first().focus();await rows.first().press('Space');
  evidence=await readEvidence(root.locator('#v6-instrument-evidence'));
  assert.equal(evidence['Canonical key'],instruments[0].canonicalKey);assert.equal(evidence.Name,instruments[0].displayName);assert.equal(evidence['Latest value'],format(instruments[0].value));
  assert.equal(evidence['Truth state'],'DELAYED');assert.equal(evidence['Base / Quote'],'EUR / INR');
  assert.equal(await rows.first().getAttribute('class'),'q-reference-instrument-card is-selected');
  assert.equal(await rows.first().getAttribute('aria-pressed'),'true');assert.equal(await rows.nth(2).getAttribute('aria-pressed'),'false');
  assert.equal(await root.locator('#v6-instrument-evidence').getAttribute('aria-live'),'polite');
  assert.equal(await root.locator('a[href="#/data-mesh"]').count(),1);assert.equal(await root.locator('a[href="#/timeseries-lab"]').count(),1);
  return {searchCaseAndWhitespacePreserved:true,canonicalKeySearchPreserved:true,assetClassIntersectionPreserved:true,emptyFilterPreserved:true,keyboardEnterAndSpaceInspection:true,evidence,focus};
}
async function assertSeries(page,root,id,limit){
  const points=pointsFor(id,limit),last=points.at(-1),first=points[0],values=points.map(point=>point.value),low=Math.min(...values),high=Math.max(...values),net=last.value-first.value;
  await page.waitForFunction(({id,limit,latest})=>document.querySelector('#v6-series-symbol')?.value===id&&document.querySelector('#v6-series-count')?.textContent===limit+' points'&&document.querySelector('#v6-series-latest')?.textContent===latest&&document.querySelector('#v6-series-status')?.textContent==='DELAYED',{id,limit,latest:format(last.value)});
  assert.equal(await root.locator('#v6-series-title').innerText(),instruments.find(item=>item.canonicalId===id).symbol+' · synthetic reference rate');
  const expectedRange=[format(first.value),format(last.value),format(low),format(high),(net>=0?'+':'')+format(net)];
  assert.deepEqual(await root.locator('#v6-series-range strong').allTextContents(),expectedRange);
  const chart=await root.locator('#v6-series-chart svg').evaluate(svg=>({viewBox:svg.getAttribute('viewBox'),role:svg.getAttribute('role'),label:svg.getAttribute('aria-label'),path:svg.querySelector('.q-v6-series-line')?.getAttribute('d'),last:{x:Number(svg.querySelector('.q-v6-series-last')?.getAttribute('cx')),y:Number(svg.querySelector('.q-v6-series-last')?.getAttribute('cy'))}}));
  assert.equal(chart.viewBox,'0 0 920 310');assert.equal(chart.role,'img');assert.equal(chart.label,'Governed reference-rate history');
  const coordinates=[...chart.path.matchAll(/[ML] ([-\d.]+) ([-\d.]+)/g)].map(match=>({x:Number(match[1]),y:Number(match[2])}));
  assert.equal(coordinates.length,limit);assert.equal(coordinates[0].x,34);assert.equal(coordinates.at(-1).x,886);
  assert.ok(Math.abs(Math.min(...coordinates.map(point=>point.y))-26)<=.01);assert.ok(Math.abs(Math.max(...coordinates.map(point=>point.y))-284)<=.01);
  // Fixed SVG plotting bounds plus fixture values independently establish the
  // expected plot. This catches changed values, ordering, scaling and extrema.
  for(let index=0;index<points.length;index++){
    assert.ok(Math.abs(coordinates[index].x-(34+852*index/(limit-1)))<=.01);
    assert.ok(Math.abs(coordinates[index].y-(284-258*(values[index]-low)/(high-low)))<=.01);
  }
  assert.equal(chart.last.x,886);assert.equal(chart.last.y,coordinates.at(-1).y);
  assert.equal(await root.locator('.q-reference-series-row').count(),Math.min(30,limit));
  assert.equal(await root.locator('.q-reference-series-row strong').first().innerText(),format(last.value));
  assert.equal(await root.locator('.q-reference-series-row strong').last().innerText(),format(points.at(-Math.min(30,limit)).value));
  const evidence=await readEvidence(root.locator('#v6-series-evidence'));
  assert.equal(evidence['Truth state'],'DELAYED');assert.equal(evidence.Provider,'Isolated synthetic ECB-shaped fixture');assert.equal(evidence.Rights,'fixture-only / not redistributed');assert.equal(evidence.Execution,'Disabled');
  return {id,limit,points:points.length,range:expectedRange,chartCoordinates:coordinates.length,latest:format(last.value),chartEndpoint:chart.last};
}
async function verifySeries(page,root,requestLog){
  const symbol=root.locator('#v6-series-symbol'),history=root.locator('#v6-series-limit');
  assert.deepEqual(await symbol.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value)),['FIXTURE-FX-EURINR','FIXTURE-FX-EURUSD']);
  assert.deepEqual(await history.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value)),['30','65','90']);
  const states=[await assertSeries(page,root,'FIXTURE-FX-EURINR',65)];
  const focus=await focusEvidence(page,symbol);await focusEvidence(page,history);
  for(const limit of [30,90]){await history.selectOption(String(limit));states.push(await assertSeries(page,root,'FIXTURE-FX-EURINR',limit));}
  await symbol.selectOption('FIXTURE-FX-EURUSD');states.push(await assertSeries(page,root,'FIXTURE-FX-EURUSD',90));
  await history.selectOption('65');states.push(await assertSeries(page,root,'FIXTURE-FX-EURUSD',65));
  await symbol.selectOption('FIXTURE-FX-EURINR');states.push(await assertSeries(page,root,'FIXTURE-FX-EURINR',65));
  const requests=requestLog.filter(read=>read.path.startsWith('/api/v1/timeseries/'));
  for(const limit of ['30','65','90'])assert.ok(requests.some(read=>read.limit===limit&&read.interval==='1d'));
  return {historySelectorPreserved:true,seriesSelectorPreserved:true,fxOnlySelectorPreserved:true,rangeMathPreserved:true,svgGeometryPreserved:true,reverseLatestTablePreserved:true,states,focus};
}

await mkdir(out,{recursive:true});
try{
  server=await startServer({port:0,host:'127.0.0.1'});
  const site='http://127.0.0.1:'+server.port;
  browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const appearance of appearances)for(const width of widths){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
    const writes=[],externalRequests=[],requestLog=[],pageErrors=[],assetResponses=[];let failurePath=null;
    sessions.push({appearance,width,fixtureId,protectedWrites:writes,blockedExternalRequests:externalRequests,pageErrors,sourceAssets:assetResponses,apiReads:requestLog,syntheticSession:true,realAuthenticationTested:false});
    await context.addInitScript(({appearance,fixtureId})=>{
      localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance}));
      window.__operationsReferenceInjection=false;
      window.__operationsReferenceDiagnostic=Object.freeze({fixtureId,syntheticSession:true,readOnly:true,realAuthenticationTested:false});
    },{appearance,fixtureId});
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      if(!['GET','HEAD','OPTIONS'].includes(request.method())){writes.push({method:request.method(),path,origin:url.origin});return route.abort();}
      if(url.origin!==site){externalRequests.push({method:request.method(),origin:url.origin,path});return route.abort();}
      if(!path.startsWith('/api/'))return route.continue();
      requestLog.push({path,query:url.search,interval:url.searchParams.get('interval'),limit:url.searchParams.get('limit')});
      if(path===failurePath)return route.fulfill({status:503,json:{error:{code:'operations_fixture_unavailable',message:errorReason},evidenceBoundary:fixtureId}});
      if(path==='/api/v1/session/context'||path==='/api/v1/identity/context')return route.fulfill({json:identity});
      if(path==='/api/v1/auth/status')return route.fulfill({json:{authenticated:true,mode:fixtureId}});
      if(path==='/api/v1/config'){
        const response=await route.fetch(),data=await response.json();
        return route.fulfill({response,json:{...data,auth:{...data.auth,authenticated:true},evidenceBoundary:fixtureId}});
      }
      if(path==='/api/v1/preferences/layout'){
        const response=await route.fetch(),data=await response.json();
        return route.fulfill({response,json:{...data,appearance}});
      }
      if(Object.hasOwn(reads,path))return route.fulfill({json:reads[path]});
      if(path.startsWith('/api/v1/timeseries/')){
        const id=decodeURIComponent(path.slice('/api/v1/timeseries/'.length)),limit=Number(url.searchParams.get('limit'));
        assert.equal(url.searchParams.get('interval'),'1d');assert.ok([30,65,90].includes(limit));
        return route.fulfill({json:historyResponse(id,limit)});
      }
      // Shell reads remain on the isolated loopback evidence server. Browser
      // writes and every remote origin have already been blocked above.
      return route.continue();
    });
    const page=active=await context.newPage();
    page.on('pageerror',error=>pageErrors.push({message:error.message,stack:error.stack}));
    page.on('response',response=>{const path=new URL(response.url()).pathname;if(routes.some(spec=>spec.module===path)||path==='/assets/routes/instrument-master-v6.css')assetResponses.push({path,status:response.status()});});
    await page.goto(site+'/#/about-qelly',{waitUntil:'domcontentloaded'});
    await page.locator('.q-about-v2-page').waitFor();
    await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&window.__QELLY_SESSION_STATE__?.authenticated===true);
    for(const spec of routes){
      activeCase={route:spec.route,state:'populated',appearance,width};
      failurePath=null;const root=await navigate(page,site,spec,appearance);
      assert.equal(await root.locator('.q-reference-surface').count(),spec.surfaces);
      const behavior=spec.kind==='runtime'?await verifyRuntime(root):spec.kind==='instrument'?await verifyInstruments(page,root):await verifySeries(page,root,requestLog);
      await assertEscaping(page,root);
      const measured=await measurePresentation(page,root);
      assert.equal(writes.length,0,JSON.stringify(writes));assert.equal(externalRequests.length,0,JSON.stringify(externalRequests));
      await page.evaluate(()=>scrollTo(0,0));
      const screenshot=out+'/'+spec.route+'-populated-'+appearance+'-'+width+'.png';
      await page.screenshot({path:screenshot,fullPage:true});
      results.push({...activeCase,screenshot,...measured,...behavior,syntheticSession:true,realAuthenticationTested:false,protectedWrites:0});
      activeCase={route:spec.route,state:'unavailable',appearance,width,status:503};
      failurePath=spec.failurePath;
      const failedRoot=await navigate(page,site,spec,appearance);
      assert.equal(await failedRoot.locator('.q-reference-empty-state strong').innerText(),spec.errorTitle);
      assert.equal(await failedRoot.locator('.q-reference-surface').count(),1);
      await assertEscaping(page,failedRoot,errorReason);
      const failedMeasured=await measurePresentation(page,failedRoot);
      const failedScreenshot=out+'/'+spec.route+'-unavailable-503-'+appearance+'-'+width+'.png';
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:failedScreenshot,fullPage:true});
      results.push({...activeCase,screenshot:failedScreenshot,...failedMeasured,failedRead:failurePath,errorEscapingPreserved:true,protectedWrites:0,syntheticSession:true,realAuthenticationTested:false});
    }
    activeCase={route:'timeseries-lab',state:'history-unavailable',appearance,width,status:503};
    failurePath='/api/v1/timeseries/FIXTURE-FX-EURINR';
    const root=await navigate(page,site,routes[2],appearance);
    await page.waitForFunction(()=>document.querySelector('#v6-series-status')?.textContent==='UNAVAILABLE');
    assert.equal(await root.locator('#v6-series-chart .q-reference-empty-state strong').innerText(),'Series unavailable');
    assert.equal(await root.locator('#v6-series-chart svg').count(),0);
    await assertEscaping(page,root,errorReason);
    const measured=await measurePresentation(page,root);
    const screenshot=out+'/timeseries-lab-history-unavailable-503-'+appearance+'-'+width+'.png';
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:screenshot,fullPage:true});
    results.push({...activeCase,screenshot,...measured,failedRead:failurePath,errorEscapingPreserved:true,nestedHistoryFailurePreserved:true,protectedWrites:0,syntheticSession:true,realAuthenticationTested:false});
    for(const path of requiredReads)assert.ok(requestLog.some(read=>read.path===path),'Missing integrated source API read '+path);
    assert.ok(requestLog.some(read=>read.path==='/api/v1/instruments/search'&&read.limit==='200'),'Instrument search endpoint contract changed.');
    assert.ok(requestLog.some(read=>read.path==='/api/v1/platform/data-plane'&&read.limit==='12'),'Data-plane endpoint contract changed.');
    for(const {module:path} of routes)assert.ok(assetResponses.some(response=>response.path===path&&response.status===200),'Missing integrated source module '+path);
    assert.ok(assetResponses.some(response=>response.path==='/assets/routes/instrument-master-v6.css'&&response.status===200),'Owned instrument stylesheet was not loaded by the full application.');
    assert.equal(writes.length,0,JSON.stringify(writes));assert.equal(externalRequests.length,0,JSON.stringify(externalRequests));assert.deepEqual(pageErrors,[]);
    await context.unrouteAll({behavior:'wait'});await context.close();active=null;
  }
  assert.equal(results.length,expectedCases);
}catch(error){
  fatalError={message:error.message,stack:error.stack,activeCase};
  await active?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});
  throw error;
}finally{
  const passed=!fatalError&&results.length===expectedCases;
  await writeFile(out+'/report.json',JSON.stringify({sourceSha,status:passed?'passed':'failed',expectedCases,cases:results.length,populatedCases:results.filter(result=>result.state==='populated').length,topLevelFailureCases:results.filter(result=>result.state==='unavailable').length,nestedHistoryFailureCases:results.filter(result=>result.state==='history-unavailable').length,fixtureId,results,sessions,fatalError,fullIntegratedSourceApplication:true,syntheticSessionFixtures:true,syntheticProviderAndSeriesReadFixtures:true,realAuthenticationTested:false,backendCapabilitiesActivated:false,productionRightsAsserted:false,newProvidersEnabled:false,numericalEnginesChanged:false,chartHelperChanged:false,protectedWritesAllowed:false,sourceModulePaths:routes.map(spec=>spec.module),ownedStylesheet:'/assets/routes/instrument-master-v6.css'},null,2)+'\n');
  await browser?.close();
  if(server){await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));}
  console.log(JSON.stringify({status:passed?'passed':'failed',cases:results.length,expectedCases,out,sourceSha,syntheticSession:true,realAuthenticationTested:false}));
}
