import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DecisionProvenanceStore } from '../src/evidence/decision-provenance-store.mjs';
import { startServer } from '../src/server/server.mjs';

const scope={userId:'user-1',tenantId:'tenant-1',workspaceId:'workspace-1'};
const asset={canonicalId:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',assetClass:'crypto',categories:['store-of-value'],price:80000,change24h:2.5,open24h:78000,high24h:81000,low24h:77000,volume24h:100,quoteVolume24h:8000000,quoteCurrency:'USDT',source:{provider:'binance-public',attribution:'Binance public market data',sourceUrl:'https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT',entitlement:'public-read',license:'provider-terms-apply',observedAt:'2026-07-25T10:00:00.000Z',ingestedAt:'2026-07-25T10:00:01.000Z',freshness:'live',qualityState:'live-public',confidence:0.96,cacheState:'miss',degraded:false,normalizationVersion:'qelly-public-market-v1'}};

test('decision provenance store persists an integrity-valid source-to-decision chain',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'qelly-evidence-store-'));
  const events=[];const store=new DecisionProvenanceStore({filePath:path.join(dir,'evidence.json'),auditLedger:{append:async(event)=>events.push(event)}});
  try{
    const graph=await store.explainMove(scope,{asset,thesis:'Price increased while public market volume remained elevated.',consideredAction:'research-further',horizon:'7d',confidence:0.6,notes:'Verify macro and news evidence before changing a position.'},'corr-1');
    assert.equal(graph.integrity.valid,true);
    assert.ok(graph.nodes.some((node)=>node.type==='SourceRecord'));
    assert.ok(graph.nodes.some((node)=>node.type==='DecisionRecord'&&node.data.status==='considered-not-executed'));
    assert.ok(graph.edges.some((edge)=>edge.type==='normalized-from'));
    assert.ok(graph.textAlternative.steps.length===graph.edges.length);
    const list=await store.list(scope);assert.equal(list.total,1);
    const traversed=await store.traverse(scope,graph.graphId,{nodeId:graph.nodes.find((node)=>node.type==='MarketMove').nodeId,direction:'both',depth:3});
    assert.ok(traversed.nodes.length>=4);
    const exported=await store.exportPackage(scope,graph.graphId,'corr-2');
    assert.match(exported.verification.sha256,/^[a-f0-9]{64}$/);
    assert.equal(events.filter((event)=>event.eventType==='evidence.graph.created.v1').length,1);
    assert.equal(events.filter((event)=>event.eventType==='evidence.graph.exported.v1').length,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('decision provenance store enforces tenant and workspace isolation',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'qelly-evidence-scope-'));const store=new DecisionProvenanceStore({filePath:path.join(dir,'evidence.json')});
  try{
    const graph=await store.explainMove(scope,{asset,consideredAction:'monitor'},'corr-3');
    const other={userId:'user-2',tenantId:'tenant-2',workspaceId:'workspace-2'};
    assert.equal((await store.list(other)).total,0);
    await assert.rejects(()=>store.graph(other,graph.graphId),(error)=>error.code==='evidence_graph_not_found');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('decision provenance API creates, reads, traverses and exports a governed package',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'qelly-evidence-api-'));
  const started=await startServer({port:0,runtimePath:dir,environment:{...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'false',QELLY_DEVELOPMENT_IDENTITY_ENABLED:'true',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',QELLY_SESSION_SECRET:'evidence-api-test-session-secret-00000001',QELLY_PUBLIC_MARKET_DATA_ENABLED:'false',QELLY_LIVE_MARKET_ENABLED:'false'}});
  const base=`http://${started.host}:${started.port}`;
  try{
    const config=await (await fetch(base+'/api/v1/config')).json();const headers={'Content-Type':'application/json','X-Qelly-CSRF':config.csrf.token,'Idempotency-Key':'evidence-api-create-0001'};
    const createdResponse=await fetch(base+'/api/v1/evidence/explain-move',{method:'POST',headers,body:JSON.stringify({canonicalId:'QI-CRYPTO-BTC',thesis:'A user-supplied hypothesis.',consideredAction:'monitor',horizon:'24h',confidence:0.4})});
    assert.equal(createdResponse.status,201);const created=await createdResponse.json();assert.equal(created.integrity.valid,true);assert.equal(created.idempotency.replayed,false);
    const replay=await (await fetch(base+'/api/v1/evidence/explain-move',{method:'POST',headers,body:JSON.stringify({canonicalId:'QI-CRYPTO-BTC',thesis:'A user-supplied hypothesis.',consideredAction:'monitor',horizon:'24h',confidence:0.4})})).json();assert.equal(replay.idempotency.replayed,true);assert.equal(replay.graphId,created.graphId);
    const listed=await (await fetch(base+'/api/v1/evidence/graphs')).json();assert.equal(listed.total,1);
    const traversed=await (await fetch(`${base}/api/v1/evidence/graphs/${created.graphId}/traverse?depth=3`)).json();assert.ok(traversed.nodes.length>=4);
    const exportedResponse=await fetch(`${base}/api/v1/evidence/graphs/${created.graphId}/export`);assert.equal(exportedResponse.status,200);assert.match(exportedResponse.headers.get('content-disposition'),/qelly-evidence/);const exported=await exportedResponse.json();assert.match(exported.verification.sha256,/^[a-f0-9]{64}$/);
  }finally{
    await new Promise((resolve)=>started.server.close(resolve));started.runtime.productionRepository?.close?.();await rm(dir,{recursive:true,force:true});
  }
});

test('frontend registers the Decision Provenance route and real API consumer',async()=>{
  const [registry,app,route]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/route-registry.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/app.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/routes/decision-provenance.mjs',import.meta.url),'utf8')
  ]);
  assert.match(registry,/route:'decision-provenance'/);
  assert.match(app,/renderDecisionProvenance/);
  assert.match(route,/\/api\/v1\/evidence\/explain-move/);
  assert.match(route,/Accessible text alternative/);
  assert.match(route,/considered-not-executed|considered decisions only/);
});
