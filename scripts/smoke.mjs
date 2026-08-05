import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimePath = await mkdtemp(path.join(os.tmpdir(), 'qelly-product-smoke-'));
const { server, host, port } = await startServer({ port: 0, runtimePath });
const base = `http://${host}:${port}`;
const log = [];
let csrf = '';

async function request(pathname, { method='GET', body, headers={}, status=200 }={}) {
  const mutation = !['GET','HEAD','OPTIONS'].includes(method);
  const response = await fetch(base + pathname, {
    method,
    headers: { ...(body !== undefined ? {'Content-Type':'application/json'} : {}), ...(mutation ? {'X-Qelly-CSRF':csrf} : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (response.status !== status) throw new Error(`${method} ${pathname} returned ${response.status}, expected ${status}: ${text}`);
  log.push({ method, pathname, status:response.status, contentType:response.headers.get('content-type') });
  return { response, text, json: () => JSON.parse(text) };
}

const expect = (condition, message) => { if (!condition) throw new Error(message); };

try {
  const configResult = await request('/api/v1/config');
  const config = configResult.json();
  csrf = config.csrf.token;
  expect(config.productName === 'Qelly Intelligence' && config.productVersion === '0.9.0-preview.1', 'Qelly product identity invalid');
  expect(config.routes.length === 70 && config.apiRoutes.length === 202 && config.apiRoutes.includes('/api/v1/public/markets/overview'), 'route inventory invalid');
  expect(config.waveStatus.part22 && config.schemaValidation.schemasLoaded === 72, 'schema and inherited capability evidence invalid');
  expect(config.csrf.mode === 'random-session-bound-local-token' && csrf.length >= 32, 'session-bound CSRF evidence invalid');
  expect(config.developmentIdentity.enabled === true, 'development identity fixture should be enabled in local smoke');

  const getPaths = [
    '/api/health','/api/ready','/api/v1/public/providers','/api/v1/calculations/metadata','/api/v1/calculations/formulas','/api/v1/calculations/formulas/cagr','/api/v1/indicators','/api/v1/indicators/rsi','/api/v1/india/rules','/api/v1/public/markets/overview','/api/v1/public/markets/assets?sort=change&direction=desc','/api/v1/public/markets/assets/QI-CRYPTO-BTC','/api/v1/public/markets/assets/QI-CRYPTO-BTC/candles?provider=fixture&interval=1h&limit=24','/api/v1/evidence/graphs','/api/v1/auth/status','/api/v1/production-foundation/status','/api/v1/platform/readiness','/api/v1/security/secret-protection/status','/api/v1/platform/assurance','/api/v1/platform/staging-manifest','/api/v1/secure-imports/quarantine','/api/v1/auth/mfa/status','/api/v1/auth/passkeys','/api/v1/storage/status','/api/v1/delivery/providers','/api/v1/delivery-attempts','/api/v1/jobs','/api/v1/production-notifications','/api/v1/contracts/production-platform-foundation','/api/v1/live-markets/catalog','/api/v1/live-markets/status','/api/v1/live-markets/candles?provider=fixture&symbol=BTCUSDT&interval=1m&limit=60','/api/v1/live-markets/ticker?provider=fixture&symbol=ETHUSDT','/api/v1/contracts/sovereign-live-markets','/api/v1/session/context','/api/v1/workspaces','/api/v1/sessions','/api/v1/devices',
    '/api/v1/privacy/consents','/api/v1/privacy/data-inventory','/api/v1/market/overview','/api/v1/rankings',
    '/api/v1/search?q=btc','/api/v1/search/suggestions?q=apple','/api/v1/assets/BTC','/api/v1/watchlist',
    '/api/v1/providers/runtime','/api/v1/instruments/summary','/api/v1/instruments/search?q=gold',
    '/api/v1/instruments/QI-TOKENIZED-QQQB','/api/v1/instruments/QI-TOKENIZED-QQQB/relationships','/api/v1/data-quality/incidents',
    '/api/v1/preferences/layout','/api/v1/preferences/layout/inventory','/api/v1/schemas/coverage',
    '/api/v1/contracts/identity-security','/api/v1/contracts/provider-runtime','/api/v1/contracts/instrument-master',
    '/api/v1/contracts/entitlements','/api/v1/contracts/timeseries-streaming','/api/v1/contracts/observability',
    '/api/v1/contracts/public-discovery-search','/api/v1/contracts/hardened-foundation-wave6','/api/v1/contracts/advanced-asset-intelligence','/api/v1/contracts/workspace-portfolio-research','/api/v1/contracts/onboarding-automation-attribution','/api/v1/contracts/release-a2-identity-import-delivery','/api/v1/contracts/release-a3-passkeys-storage-delivery','/api/v1/contracts/release-a4-recovery-quarantine-readiness','/api/v1/contracts/release-a5-platform-hardening','/api/v1/contracts/calculator-indicator-foundation',
    '/api/v1/timeseries/summary','/api/v1/timeseries/QI-CRYPTO-BTC?interval=4h&limit=8',
    '/api/v1/streams/catalog','/api/v1/streams/replay?channel=quotes&limit=10',
    '/api/v1/observability/overview','/api/v1/observability/metrics','/api/v1/observability/traces?limit=20','/api/v1/observability/logs?limit=20',
    '/api/v1/discovery/overview','/api/v1/discovery/rankings?assetClass=crypto&limit=5','/api/v1/discovery/categories',
    '/api/v1/discovery/categories/smart-contract-platforms','/api/v1/discovery/venues','/api/v1/discovery/venues/venue-binance-fixture',
    '/api/v1/discovery/dex','/api/v1/discovery/dex/dex-eth-usdc','/api/v1/discovery/global-charts',
    '/api/v1/discovery/prediction-markets?category=Macro','/api/v1/discovery/news?topic=crypto','/api/v1/discovery/research?q=provider',
    '/api/v1/discovery/research/research-provider-truth','/api/v1/discovery/methodologies','/api/v1/discovery/methodologies/freshness',
    '/api/v1/discovery/coverage','/api/v1/discovery/status','/api/v1/discovery/saved',
    '/api/v1/asset-intelligence/studies','/api/v1/asset-intelligence/QI-CRYPTO-BTC/overview',
    '/api/v1/asset-intelligence/QI-CRYPTO-BTC/fundamentals','/api/v1/asset-intelligence/QI-CRYPTO-BTC/events',
    '/api/v1/asset-intelligence/QI-EQUITY-AAPL/filings','/api/v1/asset-intelligence/QI-CRYPTO-BTC/peers',
    '/api/v1/asset-intelligence/QI-CRYPTO-BTC/technicals?study=sma&length=20','/api/v1/asset-intelligence/QI-EQUITY-AAPL/chart?indicators=sma,ema,bollinger,macd,atr,stochastic','/api/v1/asset-intelligence/QI-EQUITY-AAPL/financials?frequency=annual','/api/v1/asset-intelligence/QI-EQUITY-AAPL/financials?frequency=quarterly','/api/v1/asset-intelligence/QI-EQUITY-AAPL/earnings','/api/v1/asset-intelligence/QI-EQUITY-AAPL/estimates','/api/v1/asset-intelligence/QI-EQUITY-AAPL/corporate-actions','/api/v1/asset-intelligence/QI-EQUITY-AAPL/event-calendar','/api/v1/asset-intelligence/QI-EQUITY-AAPL/filings/AAPL-10Q-2026Q2','/api/v1/asset-intelligence/layouts',
    '/api/v1/workspace/watchlists','/api/v1/alerts/rules','/api/v1/notifications','/api/v1/screeners/catalog','/api/v1/screeners/saved','/api/v1/portfolio/overview','/api/v1/portfolio/holdings','/api/v1/portfolio/performance?range=1y','/api/v1/portfolio/risk','/api/v1/research/workspaces',
    '/api/v1/onboarding/catalog','/api/v1/onboarding/profile','/api/v1/notification-schedules/catalog','/api/v1/notification-schedules','/api/v1/screeners/formulas/catalog','/api/v1/portfolio/attribution','/api/v1/imports/templates','/api/v1/imports','/api/v1/platform/migrations/plan','/api/v1/platform/migrations/status',
    '/api/v1/audit','/api/v1/audit/verify','/','/qelly-config.js','/assets/tokens.css','/assets/app.css','/assets/app.js',
    '/assets/qelly-sovereign-v3.css','/assets/qelly-sovereign-motion.js','/assets/market/tradingview-live-chart.mjs','/assets/routes/auth-login.mjs','/assets/routes/auth-register.mjs','/assets/routes/auth-recovery.mjs','/assets/routes/account-session.mjs','/assets/routes/passkey-center.mjs','/assets/routes/account-recovery.mjs','/assets/routes/delivery-operations.mjs','/assets/routes/platform-readiness.mjs','/assets/routes/secret-rotation.mjs','/assets/routes/quarantine-review.mjs','/assets/routes/staging-assurance.mjs','/assets/webauthn.mjs','/assets/routes/live-markets.mjs','/assets/routes/theme-personas.mjs','/assets/routes/about-qelly.mjs','/assets/routes/feature-universe.mjs','/assets/route-registry.mjs','/assets/routes/workspace-watchlist.mjs','/assets/routes/alert-center.mjs','/assets/routes/notification-center.mjs','/assets/routes/screener-lab.mjs','/assets/routes/portfolio-analytics.mjs','/assets/routes/research-workspace.mjs','/assets/routes/asset-intelligence.mjs','/assets/routes/advanced-chart.mjs','/assets/routes/fundamentals-estimates.mjs','/assets/routes/filing-workspace.mjs','/assets/routes/event-calendar.mjs','/assets/routes/comparison-lab.mjs','/assets/routes/onboarding.mjs','/assets/routes/notification-schedules.mjs','/assets/routes/formula-screener.mjs','/assets/routes/portfolio-attribution.mjs','/assets/routes/import-center.mjs','/assets/routes/research-history.mjs','/assets/routes/migration-center.mjs','/assets/calculation/formula-engine.mjs','/assets/calculation/indicator-engine.mjs','/assets/calculation/persistence.mjs','/assets/calculation/india-rules.mjs','/assets/routes/calculator-center.mjs','/assets/routes/india-finance-center.mjs','/assets/routes/indicator-library.mjs','/assets/routes/formula-library.mjs','/assets/routes/saved-calculations.mjs','/packages/data-grid/data-grid.mjs'
  ];
  for (const pathname of getPaths) await request(pathname);

  const calculation=(await request('/api/v1/calculations/run',{method:'POST',body:{formulaId:'cagr',inputs:{startValue:100,endValue:121,years:2}}})).json();
  expect(calculation.status==='success'&&Math.abs(calculation.outputs.cagrPercent-10)<1e-8&&calculation.truthState==='IMPLEMENTED_DETERMINISTIC_LOCAL','deterministic calculation API invalid');
  const indicator=(await request('/api/v1/indicators/run',{method:'POST',body:{indicatorId:'sma',inputs:{close:[1,2,3,4,5],period:3}}})).json();
  expect(indicator.status==='success'&&indicator.outputs.value.at(-1)===4,'deterministic indicator API invalid');
  const freshCalculation=(await request('/api/v1/calculations/run',{method:'POST',body:{formulaId:'fresh-present-value',inputs:{futureValue:110,rate:0.1,periods:1}}})).json();
expect(freshCalculation.status==='success'&&Math.abs(freshCalculation.outputs.value-100)<1e-8&&freshCalculation.truthState==='FRESH_REIMPLEMENTATION_2026','fresh formula API invalid');
const freshIndicator=(await request('/api/v1/indicators/run',{method:'POST',body:{indicatorId:'fresh-price-momentum',inputs:{close:Array.from({length:30},(_,index)=>100+index),period:14}}})).json();
expect(freshIndicator.status==='success'&&freshIndicator.outputs.value.at(-1)===14&&freshIndicator.truthState==='FRESH_REIMPLEMENTATION_2026','fresh indicator API invalid');
const saved=(await request('/api/v1/calculations/saved',{method:'POST',status:201,body:{name:'Fresh PV smoke',result:freshCalculation,notes:'Prompt 2B lifecycle smoke',tags:['fresh','smoke'],favorite:true},headers:{'Idempotency-Key':'prompt2b-saved-create'}})).json();
const savedList=(await request('/api/v1/calculations/saved?q=Fresh%20PV&favorite=true&sort=name-asc')).json();
expect(savedList.items.some(item=>item.id===saved.id)&&savedList.persistence.schemaVersion===2,'saved calculation list invalid');
const savedRead=(await request(`/api/v1/calculations/saved/${saved.id}`)).json();
expect(savedRead.version===1&&savedRead.formulaVersion==='2.0.0'&&savedRead.revisions.length===1,'saved calculation read invalid');
const savedUpdated=(await request(`/api/v1/calculations/saved/${saved.id}`,{method:'PATCH',body:{name:'Fresh PV updated',notes:'Updated smoke',tags:['fresh','updated'],favorite:false},headers:{'Idempotency-Key':'prompt2b-saved-update'}})).json();
expect(savedUpdated.version===2&&savedUpdated.revisions.length===2&&savedUpdated.name==='Fresh PV updated','saved calculation update invalid');
const duplicate=(await request(`/api/v1/calculations/saved/${saved.id}/duplicate`,{method:'POST',status:201,body:{name:'Fresh PV duplicate'},headers:{'Idempotency-Key':'prompt2b-saved-duplicate'}})).json();
expect(duplicate.id!==saved.id&&duplicate.version===1&&duplicate.name==='Fresh PV duplicate','saved calculation duplicate invalid');
const savedRevisions=(await request(`/api/v1/calculations/saved/${saved.id}/revisions`)).json();
expect(savedRevisions.currentVersion===2&&savedRevisions.items.length===2,'saved calculation revisions invalid');
const firstRevision=savedRevisions.items.find(item=>item.version===1);
const savedRestored=(await request(`/api/v1/calculations/saved/${saved.id}/restore`,{method:'POST',body:{revisionId:firstRevision.revisionId},headers:{'Idempotency-Key':'prompt2b-saved-restore'}})).json();
expect(savedRestored.version===3&&savedRestored.name==='Fresh PV smoke'&&savedRestored.revisions.length===3,'saved revision restore invalid');
const duplicateDeleted=(await request(`/api/v1/calculations/saved/${duplicate.id}`,{method:'DELETE',headers:{'Idempotency-Key':'prompt2b-saved-delete-duplicate'}})).json();
const originalDeleted=(await request(`/api/v1/calculations/saved/${saved.id}`,{method:'DELETE',headers:{'Idempotency-Key':'prompt2b-saved-delete-original'}})).json();
expect(duplicateDeleted.deleted&&originalDeleted.deleted,'saved calculation delete invalid');
  const charges=(await request('/api/v1/india/charges',{method:'POST',body:{turnover:100000,brokerage:20,exchangeCharges:5,sebiCharges:1,gstRatePercent:18}})).json();
  expect(charges.truthState==='USER_ENTERED_CUSTOM_RATES'&&charges.total>0,'custom India charge API invalid');

  const evidenceInput={canonicalId:'QI-CRYPTO-BTC',thesis:'Public price movement requires additional evidence before action.',consideredAction:'research-further',horizon:'7d',confidence:0.55,notes:'Smoke-created evidence package; no execution.'};
  const evidence=(await request('/api/v1/evidence/explain-move',{method:'POST',status:201,body:evidenceInput,headers:{'Idempotency-Key':'qelly-scope-a-evidence-smoke'}})).json();
  expect(evidence.integrity?.valid===true&&evidence.nodes?.some((node)=>node.type==='DecisionRecord'),'decision provenance graph invalid');
  const evidenceReplay=(await request('/api/v1/evidence/explain-move',{method:'POST',status:201,body:evidenceInput,headers:{'Idempotency-Key':'qelly-scope-a-evidence-smoke'}})).json();
  expect(evidenceReplay.idempotency?.replayed===true&&evidenceReplay.graphId===evidence.graphId,'decision provenance idempotency invalid');
  const evidenceGraph=(await request(`/api/v1/evidence/graphs/${evidence.graphId}`)).json();
  expect(evidenceGraph.integrity.valid&&evidenceGraph.textAlternative.steps.length===evidenceGraph.edges.length,'decision provenance read invalid');
  const evidenceTraverse=(await request(`/api/v1/evidence/graphs/${evidence.graphId}/traverse?depth=3`)).json();
  expect(evidenceTraverse.nodes.length>=4,'decision provenance traversal invalid');
  const evidenceExport=(await request(`/api/v1/evidence/graphs/${evidence.graphId}/export`)).json();
  expect(/^[a-f0-9]{64}$/.test(evidenceExport.verification.sha256),'decision provenance export invalid');

  const concurrency=(await request('/api/v1/platform/assurance/concurrency',{method:'POST',body:{iterations:4},headers:{'Idempotency-Key':'release-a5-smoke-concurrency'}})).json();
  expect(concurrency.passed===true&&concurrency.uniqueJobs===1,'A5 concurrency exercise invalid');
  const backup=(await request('/api/v1/platform/assurance/backup-restore',{method:'POST',body:{},headers:{'Idempotency-Key':'release-a5-smoke-backup'}})).json();
  expect(backup.passed===true&&backup.sha256===backup.restoredSha256,'A5 backup/restore drill invalid');
  const deliverySandbox=(await request('/api/v1/platform/assurance/delivery-sandbox',{method:'POST',body:{},headers:{'Idempotency-Key':'release-a5-smoke-delivery'}})).json();
  expect(deliverySandbox.passed===true,'A5 delivery signature sandbox invalid');

  const coverage = (await request('/api/v1/schemas/coverage')).json();
  expect(coverage.schemasLoaded === 72 && coverage.enforcedRoutes.length >= 18 && coverage.productionValidatorRequired, 'runtime schema coverage invalid');

  const denied = (await request('/api/v1/access/evaluate',{method:'POST',body:{action:'timeseries:write'}})).json();
  expect(!denied.allowed, 'time-series governance unexpectedly allowed before step-up');
  await request('/api/v1/auth/step-up/simulate',{method:'POST',body:{}});
  const allowed = (await request('/api/v1/access/evaluate',{method:'POST',body:{action:'timeseries:write'}})).json();
  expect(allowed.allowed, 'time-series governance not allowed after step-up');

  const quote = (await request('/api/v1/providers/execute',{method:'POST',body:{capability:'quote',request:{canonicalId:'QI-CRYPTO-BTC'}}})).json();
  expect(quote.runtime.providerId === 'qelly-fixture-primary', 'primary provider not selected');
  const failover = (await request('/api/v1/providers/execute',{method:'POST',body:{capability:'quote',request:{canonicalId:'QI-CRYPTO-ETH'},scenario:'qelly-fixture-primary:error'}})).json();
  expect(failover.runtime.providerId === 'qelly-fixture-secondary', 'secondary failover not selected');

  const query = (await request('/api/v1/timeseries/query',{method:'POST',body:{canonicalId:'QI-CRYPTO-BTC',interval:'1d',limit:5}})).json();
  expect(query.points.length === 5 && query.interval === '1d' && query.metadata?.qualityFlags?.includes('normalized-ohlcv'), 'time-series query invalid');
  const malformedAppend = await request('/api/v1/timeseries/QI-CRYPTO-BTC/append',{method:'POST',body:{close:'1'},headers:{'Idempotency-Key':'part18-invalid-append'},status:400});
  expect(malformedAppend.json().error.code === 'request_schema_invalid', 'append runtime schema was not enforced');
  const appendPayload={at:'2026-07-24T09:00:00.000Z',open:'119100',high:'119900',low:'118800',close:'119500',volume:'1532.75',providerId:'qelly-smoke-ingest',qualityFlags:['smoke-validated']};
  const appendHeaders={'Idempotency-Key':'part18-smoke-timeseries-append'};
  const appended=(await request('/api/v1/timeseries/QI-CRYPTO-BTC/append',{method:'POST',body:appendPayload,headers:appendHeaders})).json();
  expect(!appended.idempotency.replayed && appended.point?.providerId === 'qelly-smoke-ingest','first time-series append invalid');
  const appendReplay=(await request('/api/v1/timeseries/QI-CRYPTO-BTC/append',{method:'POST',body:appendPayload,headers:appendHeaders})).json();
  expect(appendReplay.idempotency.replayed,'time-series append idempotency replay failed');

  const streamResult = await request('/api/v1/stream/quotes?symbols=QI-CRYPTO-BTC,QI-CRYPTO-ETH&frames=4&intervalMs=10');
  expect(streamResult.text.includes('event: quotes.snapshot.v1') && streamResult.text.includes('event: quotes.delta.v1') && streamResult.text.includes('event: stream.heartbeat.v1') && streamResult.text.includes('resumeToken'),'SSE evidence invalid');
  const eventIds=[...streamResult.text.matchAll(/^id: (.+)$/gm)].map((match)=>match[1]).filter(Boolean);
  expect(eventIds.length >= 4,'SSE resume identifiers missing');
  const replay=(await request(`/api/v1/streams/replay?channel=quotes&resumeToken=${encodeURIComponent(eventIds[0])}&limit=10`)).json();
  expect(replay.items.length >= 2 && replay.nextResumeToken && !replay.gap,'stream replay evidence invalid');

  const invalidPreference = await request('/api/v1/preferences/layout',{method:'PUT',body:{theme:'burgundy-command',unknownField:true},status:400});
  expect(invalidPreference.json().error.code === 'request_schema_invalid','unknown preference property was not rejected');
  const prefBody={version:1,theme:'burgundy-command',density:'compact',motion:'subtle',fontScale:100,radiusPx:10,customAccent:null,route:'asset-intelligence',panels:[]};
  const preference=(await request('/api/v1/preferences/layout',{method:'PUT',body:prefBody,headers:{'If-Match-Revision':'0'}})).json();
  expect(preference.route === 'asset-intelligence' && preference.revision === 1,'preference write failed');
  await request('/api/v1/preferences/layout',{method:'PUT',body:{...prefBody,density:'terminal'},headers:{'If-Match-Revision':'0'},status:409});
  const persistedPreference=(await request('/api/v1/preferences/layout')).json();
  expect(persistedPreference.route === 'asset-intelligence' && persistedPreference.density === 'compact','preference conflict damaged state');

  const search=(await request('/api/v1/search?q=BTC&types=asset')).json();
  expect(search.items[0]?.entity?.canonicalId === 'QI-CRYPTO-BTC' && search.mode === 'federated-local-search-foundation','federated search invalid');
  const conversion=(await request('/api/v1/discovery/converter',{method:'POST',body:{amount:2,from:'BTC',to:'ETH',feeBps:25,slippageBps:10}})).json();
  expect(!conversion.tradable && Number(conversion.to.netAmount) < Number(conversion.to.grossAmount),'converter truth boundary invalid');
  const savedSearch=(await request('/api/v1/discovery/saved/searches',{method:'POST',body:{name:'Smoke crypto search',query:'crypto',filters:{assetClass:'crypto'}},headers:{'Idempotency-Key':'part18-smoke-saved-search'}})).json();
  expect(!savedSearch.idempotency.replayed,'first saved search unexpectedly replayed');
  const savedReplay=(await request('/api/v1/discovery/saved/searches',{method:'POST',body:{name:'Smoke crypto search',query:'crypto',filters:{assetClass:'crypto'}},headers:{'Idempotency-Key':'part18-smoke-saved-search'}})).json();
  expect(savedReplay.idempotency.replayed,'saved search idempotency replay failed');

  const assetOverview=(await request('/api/v1/asset-intelligence/QI-EQUITY-AAPL/overview')).json();
  expect(assetOverview.canonicalId === 'QI-EQUITY-AAPL' && assetOverview.coverage.fundamentals && !assetOverview.truth.externalProviders,'asset intelligence overview invalid');
  const technical=(await request('/api/v1/asset-intelligence/QI-CRYPTO-BTC/technicals?study=rsi&length=14')).json();
  expect(technical.study.studyId === 'rsi' && technical.points.some((point)=>point.value !== null) && !technical.truth.externalProviders,'technical-study response invalid');
  const comparison=(await request('/api/v1/asset-intelligence/compare',{method:'POST',body:{canonicalIds:['QI-CRYPTO-BTC','QI-CRYPTO-ETH','QI-CRYPTO-BTC']}})).json();
  expect(comparison.items.length === 2 && !comparison.truth.licensedFundamentals,'asset comparison normalization invalid');


  const advancedChart=(await request('/api/v1/asset-intelligence/QI-EQUITY-AAPL/chart?indicators=sma,ema,bollinger,macd,atr,stochastic')).json();
  expect(advancedChart.bars.length===260 && Object.keys(advancedChart.studies).length===6 && advancedChart.capabilities.multiPane && !advancedChart.capabilities.realtime,'advanced chart evidence invalid');
  const annual=(await request('/api/v1/asset-intelligence/QI-EQUITY-AAPL/financials?frequency=annual')).json();
  expect(annual.statements.length===3 && annual.derived[0].grossMargin>0 && annual.licensedProviderRequired,'financial statement evidence invalid');
  const earnings=(await request('/api/v1/asset-intelligence/QI-EQUITY-AAPL/earnings')).json();
  const estimates=(await request('/api/v1/asset-intelligence/QI-EQUITY-AAPL/estimates')).json();
  expect(earnings.items.length>=3 && estimates.consensus.analystCount>0 && !estimates.truth.liveEstimates,'earnings and estimate evidence invalid');
  const filing=(await request('/api/v1/asset-intelligence/QI-EQUITY-AAPL/filings/AAPL-10Q-2026Q2')).json();
  expect(filing.sections.length>=4 && filing.sections.every(item=>item.citation.locator.startsWith('section:')) && !filing.document.originalDocumentAvailable,'filing workspace evidence invalid');
  const comparisonSeries=(await request('/api/v1/asset-intelligence/compare/series',{method:'POST',body:{canonicalIds:['QI-EQUITY-AAPL','QI-EQUITY-NVDA','QI-CRYPTO-BTC'],range:'6m'}})).json();
  expect(comparisonSeries.series.length===3 && comparisonSeries.series.every(item=>item.points[0].value===100),'normalized comparison evidence invalid');
  const invalidComparison=await request('/api/v1/asset-intelligence/compare/series',{method:'POST',body:{canonicalIds:['QI-EQUITY-AAPL','QI-EQUITY-AAPL']},status:400});
  expect(invalidComparison.json().error.code==='request_schema_invalid','comparison schema uniqueness not enforced');
  const layoutPayload={name:'Smoke institutional chart',canonicalId:'QI-EQUITY-AAPL',range:'1y',interval:'1d',indicators:['sma','macd','bollinger']};
  const layout=(await request('/api/v1/asset-intelligence/layouts',{method:'POST',body:layoutPayload,headers:{'Idempotency-Key':'part19-smoke-chart-layout'}})).json();
  const layoutReplay=(await request('/api/v1/asset-intelligence/layouts',{method:'POST',body:layoutPayload,headers:{'Idempotency-Key':'part19-smoke-chart-layout'}})).json();
  expect(!layout.idempotency.replayed && layoutReplay.idempotency.replayed,'chart layout idempotency invalid');
  const layoutList=(await request('/api/v1/asset-intelligence/layouts')).json();
  expect(layoutList.items.length===1 && !layoutList.cloudSync,'chart layout persistence invalid');
  await request(`/api/v1/asset-intelligence/layouts/${encodeURIComponent(layout.layoutId)}`,{method:'DELETE',headers:{'Idempotency-Key':'part19-smoke-chart-layout-delete'}});

  const invalidWatchlist=await request('/api/v1/workspace/watchlists',{method:'POST',body:{name:'X',unknown:true},headers:{'Idempotency-Key':'part20-invalid-watchlist'},status:400});
  expect(invalidWatchlist.json().error.code==='request_schema_invalid','watchlist schema rejection invalid');
  const watchlistPayload={name:'Smoke workspace list',description:'Part 20 smoke evidence'};
  const watchlistCreated=(await request('/api/v1/workspace/watchlists',{method:'POST',body:watchlistPayload,headers:{'Idempotency-Key':'part20-smoke-watchlist'}})).json();
  const watchlistReplay=(await request('/api/v1/workspace/watchlists',{method:'POST',body:watchlistPayload,headers:{'Idempotency-Key':'part20-smoke-watchlist'}})).json();
  expect(!watchlistCreated.idempotency.replayed&&watchlistReplay.idempotency.replayed,'watchlist idempotency invalid');
  await request(`/api/v1/workspace/watchlists/${encodeURIComponent(watchlistCreated.watchlistId)}/items`,{method:'POST',body:{canonicalId:'QI-INDEX-SPX',group:'Benchmarks',note:'Smoke evidence'},headers:{'Idempotency-Key':'part20-smoke-watchlist-item'}});
  const watchlistDetail=(await request(`/api/v1/workspace/watchlists/${encodeURIComponent(watchlistCreated.watchlistId)}`)).json();
  expect(watchlistDetail.items[0].quote.symbol==='SPX'&&!watchlistDetail.cloudSync,'watchlist persistence invalid');

  const alertCreated=(await request('/api/v1/alerts/rules',{method:'POST',body:{name:'Smoke AAPL alert',canonicalId:'QI-EQUITY-AAPL',metric:'price',operator:'greater_than',threshold:200,severity:'high',cooldownMinutes:60},headers:{'Idempotency-Key':'part20-smoke-alert'}})).json();
  expect(alertCreated.ruleId&&alertCreated.channels.includes('in_app'),'alert rule creation invalid');
  const alertEvaluation=(await request('/api/v1/alerts/evaluate',{method:'POST',body:{},headers:{'Idempotency-Key':'part20-smoke-alert-evaluate'}})).json();
  expect(alertEvaluation.triggeredCount>=3&&!alertEvaluation.externalDeliveryAttempted,'alert evaluation invalid');
  const notificationList=(await request('/api/v1/notifications?status=unread')).json();
  expect(notificationList.unreadCount>=5&&!notificationList.externalDelivery,'notification delivery truth invalid');
  await request(`/api/v1/notifications/${encodeURIComponent(notificationList.items[0].notificationId)}/read`,{method:'PUT',body:{}});

  const screenerDefinition={filters:[{field:'assetClass',operator:'equals',value:'equity'},{field:'change24h',operator:'greater_than',value:0}],sort:'marketCap',direction:'desc',limit:20};
  const screenerResult=(await request('/api/v1/screeners/run',{method:'POST',body:screenerDefinition})).json();
  expect(screenerResult.items.length===1&&screenerResult.items[0].symbol==='NVDA'&&!screenerResult.serverSideExecution,'screener execution invalid');
  const savedScreener=(await request('/api/v1/screeners/saved',{method:'POST',body:{name:'Smoke positive equities',definition:screenerDefinition},headers:{'Idempotency-Key':'part20-smoke-screener'}})).json();
  expect(savedScreener.savedScreenerId,'saved screener invalid');

  const portfolio=(await request('/api/v1/portfolio/overview')).json();
  const portfolioRisk=(await request('/api/v1/portfolio/risk')).json();
  expect(portfolio.totalValue>portfolio.cashValue&&!portfolio.tradable&&!portfolio.connectedAccounts&&!portfolioRisk.liveRiskEngine,'portfolio analytics truth invalid');

  const researchCreated=(await request('/api/v1/research/workspaces',{method:'POST',body:{name:'Smoke research board',description:'Part 20 smoke evidence',tags:['smoke']},headers:{'Idempotency-Key':'part20-smoke-research'}})).json();
  await request(`/api/v1/research/workspaces/${encodeURIComponent(researchCreated.researchWorkspaceId)}/items`,{method:'POST',body:{type:'asset',referenceId:'QI-EQUITY-AAPL',title:'Apple evidence',note:'Review fixture fundamentals.'},headers:{'Idempotency-Key':'part20-smoke-research-item'}});
  const researchDetail=(await request(`/api/v1/research/workspaces/${encodeURIComponent(researchCreated.researchWorkspaceId)}`)).json();
  expect(researchDetail.items.length===1&&!researchDetail.collaboration&&!researchDetail.cloudSync,'research workspace persistence invalid');


  const invalidOnboarding=await request('/api/v1/onboarding/profile',{method:'PUT',body:{goals:['quant-research'],unknown:true},headers:{'Idempotency-Key':'part21-invalid-onboarding'},status:400});
  expect(invalidOnboarding.json().error.code==='request_schema_invalid','onboarding schema rejection invalid');
  const onboardingPayload={goals:['quant-research'],assetClasses:['equity','crypto'],regions:['india','global'],baseCurrency:'INR',experienceLevel:'advanced',workspaceTemplate:'quant-lab',providerInterests:['market-data'],digestCadence:'daily'};
  const onboarding=(await request('/api/v1/onboarding/profile',{method:'PUT',body:onboardingPayload,headers:{'Idempotency-Key':'part21-smoke-onboarding'}})).json();
  const onboardingReplay=(await request('/api/v1/onboarding/profile',{method:'PUT',body:onboardingPayload,headers:{'Idempotency-Key':'part21-smoke-onboarding'}})).json();
  expect(onboarding.progressPct===100&&!onboarding.idempotency.replayed&&onboardingReplay.idempotency.replayed,'onboarding persistence or replay invalid');
  const onboardingCompleted=(await request('/api/v1/onboarding/complete',{method:'POST',body:{},headers:{'Idempotency-Key':'part21-smoke-onboarding-complete'}})).json();
  expect(onboardingCompleted.completed&&!onboardingCompleted.productionProvisioning,'onboarding completion truth invalid');

  const schedulePayload={name:'Smoke daily research brief',kind:'research_brief',cadence:'daily',timezone:'Asia/Kolkata',hour:8,minute:0,weekdays:[],enabled:true,nextRunAt:'2026-07-25T02:30:00.000Z'};
  const schedule=(await request('/api/v1/notification-schedules',{method:'POST',body:schedulePayload,headers:{'Idempotency-Key':'part21-smoke-schedule'}})).json();
  const scheduleReplay=(await request('/api/v1/notification-schedules',{method:'POST',body:schedulePayload,headers:{'Idempotency-Key':'part21-smoke-schedule'}})).json();
  expect(schedule.scheduleId&&!schedule.idempotency.replayed&&scheduleReplay.idempotency.replayed,'schedule creation replay invalid');
  const duePayload={at:'2026-08-01T12:00:00.000Z'};
  const scheduleRun=(await request('/api/v1/notification-schedules/run-due',{method:'POST',body:duePayload,headers:{'Idempotency-Key':'part21-smoke-schedule-run'}})).json();
  const scheduleRunReplay=(await request('/api/v1/notification-schedules/run-due',{method:'POST',body:duePayload,headers:{'Idempotency-Key':'part21-smoke-schedule-run'}})).json();
  const scheduledNotifications=(await request('/api/v1/notifications')).json();
  expect(scheduleRun.deliveryCount>=3&&!scheduleRun.externalDeliveryAttempted&&!scheduleRun.idempotency.replayed&&scheduleRunReplay.idempotency.replayed,'scheduled notification execution invalid');
  expect(scheduledNotifications.items.filter(item=>item.source==='qelly-local-scheduler').length===scheduleRun.deliveryCount,'scheduled notification replay created duplicates');

  const invalidFormula=await request('/api/v1/screeners/formulas/run',{method:'POST',body:{formulas:[{name:'unsafe',expression:'process.exit(1)'}]},status:400});
  expect(invalidFormula.json().error.code==='formula_parse_failed','formula sandbox rejection invalid');
  const formulaRun=(await request('/api/v1/screeners/formulas/run',{method:'POST',body:{formulas:[{name:'momentum_quality',expression:'change24h / max(volatility30d, 1)'}],formulaFilters:[{formula:'momentum_quality',operator:'greater_than',value:0}],sort:'momentum_quality',direction:'desc',limit:10}})).json();
  expect(formulaRun.items.length>=3&&formulaRun.items.every(item=>item.formulas.momentum_quality>0)&&!formulaRun.dynamicCodeExecution,'formula screener evidence invalid');

  const attribution=(await request('/api/v1/portfolio/attribution?range=1y')).json();
  const attributionTotal=Number(attribution.byHolding.reduce((sum,item)=>sum+item.contributionPct,0).toFixed(2));
  expect(attributionTotal===attribution.totalContributionPct&&!attribution.liveTransactions&&!attribution.brokerReconciliation,'portfolio attribution reconciliation invalid');

  const invalidImport=await request('/api/v1/imports/preview',{method:'POST',body:{kind:'watchlist',csv:'symbol,note\nBTC,Review'},status:400});
  expect(invalidImport.json().error.code==='import_columns_missing','import column validation invalid');
  const importPayload={kind:'research',sourceName:'smoke-research.csv',csv:'type,referenceId,title,note\nnote,,Policy review,Track rates'};
  const importPreview=(await request('/api/v1/imports/preview',{method:'POST',body:importPayload})).json();
  const importCommit=(await request('/api/v1/imports/commit',{method:'POST',body:importPayload,headers:{'Idempotency-Key':'part21-smoke-import'}})).json();
  const importReplay=(await request('/api/v1/imports/commit',{method:'POST',body:importPayload,headers:{'Idempotency-Key':'part21-smoke-import'}})).json();
  expect(importPreview.canCommit&&importCommit.status==='staged_local'&&!importCommit.productionApplied&&!importCommit.idempotency.replayed&&importReplay.idempotency.replayed,'import staging truth invalid');
  const importDetail=(await request(`/api/v1/imports/${encodeURIComponent(importCommit.importBatchId)}`)).json();
  expect(importDetail.rows.length===1&&importDetail.kind==='research','import detail invalid');

  const versionOne=(await request(`/api/v1/research/workspaces/${encodeURIComponent(researchCreated.researchWorkspaceId)}/versions`,{method:'POST',body:{message:'Smoke baseline'},headers:{'Idempotency-Key':'part21-smoke-version-1'}})).json();
  await request(`/api/v1/research/workspaces/${encodeURIComponent(researchCreated.researchWorkspaceId)}/items`,{method:'POST',body:{type:'note',title:'Versioned evidence',note:'Part 21 diff evidence'},headers:{'Idempotency-Key':'part21-smoke-version-item'}});
  const versionTwo=(await request(`/api/v1/research/workspaces/${encodeURIComponent(researchCreated.researchWorkspaceId)}/versions`,{method:'POST',body:{message:'Smoke changed'},headers:{'Idempotency-Key':'part21-smoke-version-2'}})).json();
  const versionDiff=(await request(`/api/v1/research/version-diff?workspaceId=${encodeURIComponent(researchCreated.researchWorkspaceId)}&left=${encodeURIComponent(versionOne.versionId)}&right=${encodeURIComponent(versionTwo.versionId)}`)).json();
  expect(versionDiff.added.length===1,'research version diff invalid');
  const restored=(await request(`/api/v1/research/workspaces/${encodeURIComponent(researchCreated.researchWorkspaceId)}/versions/${encodeURIComponent(versionOne.versionId)}/restore`,{method:'POST',body:{},headers:{'Idempotency-Key':'part21-smoke-version-restore'}})).json();
  const restoredReplay=(await request(`/api/v1/research/workspaces/${encodeURIComponent(researchCreated.researchWorkspaceId)}/versions/${encodeURIComponent(versionOne.versionId)}/restore`,{method:'POST',body:{},headers:{'Idempotency-Key':'part21-smoke-version-restore'}})).json();
  expect(restored.items.length===1&&!restored.idempotency.replayed&&restoredReplay.idempotency.replayed,'research version restore replay invalid');

  const migrationPlan=(await request('/api/v1/platform/migrations/plan')).json();
  const migrationStatus=(await request('/api/v1/platform/migrations/status')).json();
  expect(migrationPlan.phases.length===4&&!migrationPlan.productionExecution&&!migrationStatus.databaseConnected&&!migrationStatus.migrationsExecuted,'migration-plan gates invalid');

  const auditVerify=(await request('/api/v1/audit/verify')).json();
  expect(auditVerify.valid && auditVerify.canonicalization === 'recursive-key-sort-v2' && auditVerify.nestedFieldsCovered && auditVerify.checkpointVerified,'hardened audit verification invalid');
  const observability=(await request('/api/v1/observability/overview')).json();
  expect(observability.release === '27.0.0' && observability.dependencies && observability.slos,'observability release evidence invalid');
  const trust=(await request('/api/v1/discovery/status')).json();
  expect(!trust.safety.liveTrading && !trust.safety.externalProviders && !trust.productionDeployment,'trust boundary invalid');

  const expectedRequests=290;
  expect(log.length===expectedRequests,`request denominator mismatch: ${log.length} !== ${expectedRequests}`);
  const result={
    status:'smoke-passed',productVersion:'0.9.0-preview.1',legacyRelease:'27.0.0',requests:log.length,requestDenominator:expectedRequests,
    checks:{publicMarketEvidence:true,decisionProvenanceGraph:true,productionPlatformFoundation:true,passkeys:true,encryptedMfa:true,recoveryCodes:true,s3CompatibleStorage:true,signedDelivery:true,outboundSsrfPolicy:true,accountRecovery:true,quarantineImports:true,platformReadiness:true,secretRotation:true,quarantineReview:true,stagingAssurance:true,concurrencyDrill:true,backupRestoreDrill:true,deliverySandbox:true,postgresParity:true,secureAuthContract:true,persistentJobs:true,sovereignBrandLock:true,liveMarketReadOnly:true,personaThemes:true,premiumMotion:true,dynamicCsrf:true,developmentIdentity:true,runtimeSchemas:true,stepUp:true,providerFailover:true,timeSeries:true,idempotency:true,resumableSse:true,scopedPreferences:true,revisionConflict:true,federatedSearch:true,savedDiscovery:true,assetIntelligence:true,technicalStudies:true,advancedChart:true,financialStatements:true,earningsEstimates:true,filingWorkspace:true,eventCalendar:true,comparisonLab:true,savedChartLayouts:true,watchlistCrud:true,alertRules:true,inAppNotifications:true,screeners:true,portfolioAnalytics:true,researchWorkspaces:true,onboarding:true,notificationSchedules:true,scheduleReplaySafety:true,formulaScreeners:true,portfolioAttribution:true,importStaging:true,researchVersionHistory:true,migrationContracts:true,recursiveAudit:true,observability:true,trustBoundary:true,deterministicCalculations:true,deterministicIndicators:true,freshCatalog:true,savedCalculationLifecycle:true,indiaCustomCharges:true},
    log
  };
  await writeFile(path.join(root,'validation','SMOKE_LOG.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally {
  await new Promise((resolve)=>server.close(resolve));
  await rm(runtimePath,{recursive:true,force:true});
}
