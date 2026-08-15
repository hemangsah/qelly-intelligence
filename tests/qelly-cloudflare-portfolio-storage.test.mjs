import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {positionToHolding,portfolioOverview,portfolioHoldings,portfolioPerformance,portfolioRisk,portfolioAttribution,__portfolioCloudTest} from '../functions/_lib/portfolio-cloud.js';
import {__portfolioRouteTest} from '../functions/api/v1/portfolio/[[route]].js';

const emptyEvidence={portfolios:[],portfolio:null,positions:[],holdings:[]};

test('portfolio mapping preserves persisted position inputs without inventing prices',()=>{
  const holding=positionToHolding({id:'11111111-1111-4111-8111-111111111111',instrument_ref:'QI-EQUITY-AAPL',instrument_type:'equity',source_kind:'user_entered',input_payload:{quantity:12,averageCost:180},provenance:{source:'manual'},observed_at:null,created_at:'2026-08-16T00:00:00Z',updated_at:'2026-08-16T00:00:00Z'});
  assert.equal(holding.symbol,'AAPL');
  assert.equal(holding.quantity,12);
  assert.equal(holding.userEnteredCost,180);
  assert.equal(holding.price,null);
  assert.equal(holding.marketValue,null);
  assert.equal(holding.unrealizedPnl,null);
  assert.equal(holding.marketTruthState,'UNAVAILABLE');
});

test('empty production portfolio produces truthful empty/unavailable analytics',()=>{
  const overview=portfolioOverview(emptyEvidence);
  const holdings=portfolioHoldings(emptyEvidence);
  const performance=portfolioPerformance(emptyEvidence,'1y');
  const risk=portfolioRisk(emptyEvidence);
  const attribution=portfolioAttribution(emptyEvidence,'1y');
  assert.equal(overview.portfolioCount,0);
  assert.equal(overview.totalValue,null);
  assert.equal(overview.valuationTruthState,'UNAVAILABLE');
  assert.deepEqual(holdings.items,[]);
  assert.deepEqual(performance.points,[]);
  assert.equal(risk.riskMetrics.valueAtRisk95OneDayPct,null);
  assert.deepEqual(risk.stressScenarios,[]);
  assert.equal(attribution.totalContributionPct,null);
  assert.deepEqual(attribution.byHolding,[]);
  assert.equal(overview.guardrails.execution,false);
  assert.equal(overview.guardrails.custody,false);
});

test('portfolio market evidence remains unavailable without rights-approved observations',()=>{
  const evidence=__portfolioCloudTest.unavailableMarketEvidence();
  assert.equal(evidence.truthState,'UNAVAILABLE');
  assert.equal(evidence.provider,null);
  assert.equal(evidence.observedAt,null);
  assert.match(evidence.attribution,/No rights-approved market observation/);
});

test('Cloudflare portfolio route exposes exact read paths under authenticated RLS',async()=>{
  assert.equal(__portfolioRouteTest.routePath({params:{route:'overview'}}),'overview');
  assert.equal(__portfolioRouteTest.routePath({params:{route:['performance']}}),'performance');
  const [service,route,analytics,attribution]=await Promise.all([
    readFile(new URL('../functions/_lib/portfolio-cloud.js',import.meta.url),'utf8'),
    readFile(new URL('../functions/api/v1/portfolio/[[route]].js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/portfolio-analytics.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/portfolio-attribution.mjs',import.meta.url),'utf8')
  ]);
  assert.match(service,/qelly_portfolios/);
  assert.match(service,/qelly_portfolio_positions/);
  assert.match(service,/restRequest\(env,session\.accessToken/);
  assert.doesNotMatch(service,/service[_ -]?role|SUPABASE_SERVICE/i);
  assert.match(route,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(analytics,/data-portfolio-persistence="CLOUD RLS"/);
  assert.match(analytics,/data-portfolio-valuation-truth="UNAVAILABLE"/);
  assert.match(attribution,/data-portfolio-attribution-truth/);
  assert.doesNotMatch(analytics,/deterministic portfolio performance fixture/i);
  assert.doesNotMatch(attribution,/deterministic contribution analysis|fixture/i);
});

test('unknown portfolio sub-capabilities remain unavailable instead of inheriting fake success',()=>{
  const source=portfolioRisk(emptyEvidence);
  assert.equal(source.truthState,'UNAVAILABLE');
  assert.match(source.methodology,/require governed valuations and return history/i);
});
