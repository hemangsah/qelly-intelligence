import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionRecords,databaseGraph,sha256Hex,traverseGraph} from '../functions/_lib/evidence.js';

const workspaceId='11111111-1111-4111-8111-111111111111';
const userId='22222222-2222-4222-8222-222222222222';

test('Cloudflare evidence records are stable, bounded and execution-safe',async()=>{
  const input={
    body:{canonicalId:'QI-CRYPTO-BTC',consideredAction:'monitor-with-conditions',horizon:'7d',confidence:.65,thesis:'Momentum persists only while liquidity remains healthy.',invalidationCondition:'Two daily closes below the declared support level.',scenarioMove:-8,decisionScore:61.2,riskPosture:'Elevated',supports:['Declared scenario input'],contradictions:['No live provider observation'],assumptions:['User confidence is an assumption'],gates:[{id:'invalidation',state:'pass'}],counterfactuals:[{move:-10,score:48}],sourceRecords:[{provider:'Qelly fixed scenario library'}]},
    workspaceId,userId,idempotencyKey:'evidence-stable-create-0001'
  };
  const first=await buildDecisionRecords(input);
  const replay=await buildDecisionRecords(input);
  assert.equal(first.decision.id,replay.decision.id);
  assert.deepEqual(first.nodes.map((node)=>node.id),replay.nodes.map((node)=>node.id));
  assert.equal(first.decision.outcome.execution,false);
  assert.equal(first.nodes.find((node)=>node.node_type==='decision').payload.executionStatus,'disabled');
  assert.equal(first.nodes.some((node)=>node.truth_state==='fresh'),false);
  assert.equal(first.nodes.length,7);
  assert.equal(first.edges.length,7);
  assert.match(first.decision.evidence_summary.requestHash,/^[a-f0-9]{64}$/);
});

test('nested evidence metadata strips unsafe keys and non-finite values',async()=>{
  const records=await buildDecisionRecords({body:{canonicalId:'QI-CRYPTO-BTC',methodology:{id:'safe-method',constructor:{polluted:true},nested:{prototype:'blocked',kept:2}},gates:[{id:'gate',__proto__:{polluted:true},score:Infinity}]},workspaceId,userId,idempotencyKey:'evidence-sanitize-0001'});
  const method=records.nodes.find((node)=>node.node_type==='transformation').payload.methodology;
  assert.equal(Object.hasOwn(method,'constructor'),false);
  assert.equal(Object.hasOwn(method.nested,'prototype'),false);
  assert.equal(records.decision.learning.gates[0].score,null);
});

test('database graph validates relationships and traversal depth',()=>{
  const decision={id:'33333333-3333-4333-8333-333333333333',title:'BTC decision provenance',status:'draft',current_revision:2,created_at:'2026-08-29T00:00:00.000Z',updated_at:'2026-08-29T00:00:00.000Z',evidence_summary:{canonicalId:'QI-CRYPTO-BTC'}};
  const nodes=[
    {id:'44444444-4444-4444-8444-444444444444',node_type:'source',label:'Source',truth_state:'partial',payload:{classification:'declared-source'},evidence:{},created_at:decision.created_at},
    {id:'55555555-5555-4555-8555-555555555555',node_type:'decision',label:'Decision',truth_state:'partial',payload:{classification:'considered-not-executed'},evidence:{},created_at:decision.created_at}
  ];
  const edges=[{id:'66666666-6666-4666-8666-666666666666',from_node_id:nodes[0].id,to_node_id:nodes[1].id,edge_type:'supports',metadata:{},created_at:decision.created_at}];
  const graph=databaseGraph(decision,nodes,edges);
  assert.equal(graph.integrity.valid,true);
  assert.equal(graph.nodes[1].type,'DecisionRecord');
  const traversed=traverseGraph(graph,{nodeId:nodes[0].id,direction:'downstream',depth:1});
  assert.equal(traversed.nodes.length,2);
  assert.equal(traversed.edges.length,1);
});

test('evidence export digest is canonical across object key ordering',async()=>{
  assert.equal(await sha256Hex({b:2,a:{d:4,c:3}}),await sha256Hex({a:{c:3,d:4},b:2}));
});
