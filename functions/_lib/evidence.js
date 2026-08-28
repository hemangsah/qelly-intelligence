import {
  HttpError,
  UUID,
  cleanText,
  jsonBody,
  requireCsrf,
  responseJson,
  restRequest,
  stableUuid
} from './runtime.js';

const TRUTH_BOUNDARY='Workspace provenance is persisted through Supabase row-level security. User scenarios, assumptions and deterministic calculations are records of analysis—not live market observations, personalized advice or trade execution.';
const MAX_LIST=50;
const MAX_NODES=100;
const MAX_EDGES=300;
const NODE_TYPE_LABEL=Object.freeze({
  source:'SourceRecord',provider_observation:'ProviderObservation',normalized_observation:'NormalizedObservation',
  transformation:'NormalizedObservation',metric:'NormalizedObservation',chart_event:'MarketMove',market_move:'MarketMove',
  news_event:'SourceRecord',hypothesis:'Hypothesis',risk_assessment:'RiskAssessment',alternative:'Hypothesis',
  decision:'DecisionRecord',alert:'RiskAssessment',portfolio_action:'DecisionRecord',evidence_export:'SourceRecord',
  outcome:'OutcomeRecord',review:'ReviewRecord'
});

const textList=(value,{limit=20,max=1200}={})=>Array.isArray(value)?value.slice(0,limit).map((item)=>cleanText(typeof item==='string'?item:JSON.stringify(item),max)).filter(Boolean):[];
const UNSAFE_KEYS=new Set(['__proto__','prototype','constructor']);
const sanitizeJson=(value,depth=0)=>{
  if(depth>6)return null;
  if(value==null||typeof value==='boolean')return value;
  if(typeof value==='string')return cleanText(value,2000);
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(Array.isArray(value))return value.slice(0,40).map((item)=>sanitizeJson(item,depth+1));
  if(typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,60).filter(([key])=>!UNSAFE_KEYS.has(key)).map(([key,item])=>[cleanText(key,120),sanitizeJson(item,depth+1)]));
  return null;
};
const objectList=(value,{limit=20}={})=>Array.isArray(value)?value.slice(0,limit).filter((item)=>item&&typeof item==='object').map((item)=>sanitizeJson(item)):[];
const safeNumber=(value,{min=0,max=1,fallback=0}={})=>{const number=Number(value);return Number.isFinite(number)?Math.min(max,Math.max(min,number)):fallback;};

const canonicalize=(value)=>{
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonicalize(value[key])]));
  return value;
};

export const sha256Hex=async(value)=>{
  const encoded=new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoded));
  return Array.from(digest,(byte)=>byte.toString(16).padStart(2,'0')).join('');
};

const integrityFor=(nodes,edges)=>{
  const ids=new Set(nodes.map((node)=>node.nodeId));
  const orphanedEdgeIds=edges.filter((edge)=>!ids.has(edge.fromNodeId)||!ids.has(edge.toNodeId)).map((edge)=>edge.edgeId);
  return {valid:orphanedEdgeIds.length===0,nodeCount:nodes.length,edgeCount:edges.length,orphanedEdgeIds};
};

export function databaseGraph(decision,nodeRows=[],edgeRows=[]){
  const nodes=nodeRows.slice(0,MAX_NODES).map((node)=>({
    nodeId:node.id,
    type:NODE_TYPE_LABEL[node.node_type]||'SourceRecord',
    label:node.label,
    classification:node.payload?.classification||'workspace',
    revision:Number(node.payload?.revision)||1,
    createdAt:node.created_at,
    data:{...(node.payload||{}),evidence:node.evidence||{},truthState:node.truth_state,qualityState:node.truth_state,freshness:node.truth_state}
  }));
  const nodeIds=new Set(nodes.map((node)=>node.nodeId));
  const edges=edgeRows.slice(0,MAX_EDGES).filter((edge)=>nodeIds.has(edge.from_node_id)&&nodeIds.has(edge.to_node_id)).map((edge)=>({
    edgeId:edge.id,fromNodeId:edge.from_node_id,toNodeId:edge.to_node_id,type:edge.edge_type,evidence:edge.metadata||{},createdAt:edge.created_at
  }));
  const nodeById=new Map(nodes.map((node)=>[node.nodeId,node]));
  return {
    graphId:decision.id,
    title:decision.title,
    canonicalId:decision.evidence_summary?.canonicalId||null,
    status:decision.status,
    revision:Number(decision.current_revision)||1,
    createdAt:decision.created_at,
    updatedAt:decision.updated_at,
    truthBoundary:decision.evidence_summary?.truthBoundary||TRUTH_BOUNDARY,
    nodes,edges,
    integrity:integrityFor(nodes,edges),
    textAlternative:{
      title:decision.title,
      summary:`${nodes.length} evidence records and ${edges.length} governed relationships.`,
      steps:edges.map((edge)=>`${nodeById.get(edge.fromNodeId)?.label||edge.fromNodeId} ${edge.type} ${nodeById.get(edge.toNodeId)?.label||edge.toNodeId}`)
    }
  };
}

export function traverseGraph(graph,{nodeId=null,direction='both',depth=2}={}){
  const normalizedDirection=['upstream','downstream','both'].includes(direction)?direction:'both';
  const maxDepth=Math.min(5,Math.max(0,Number.isInteger(Number(depth))?Number(depth):2));
  const start=nodeId||graph.nodes[0]?.nodeId;
  if(!start||!graph.nodes.some((node)=>node.nodeId===start))throw new HttpError(404,'evidence_node_not_found','Evidence start record was not found');
  const visited=new Set([start]);
  const selected=new Set();
  let frontier=new Set([start]);
  for(let level=0;level<maxDepth&&frontier.size;level+=1){
    const next=new Set();
    for(const edge of graph.edges){
      const outward=frontier.has(edge.fromNodeId)&&(normalizedDirection==='downstream'||normalizedDirection==='both');
      const inward=frontier.has(edge.toNodeId)&&(normalizedDirection==='upstream'||normalizedDirection==='both');
      if(!outward&&!inward)continue;
      selected.add(edge.edgeId);
      const candidate=outward?edge.toNodeId:edge.fromNodeId;
      if(!visited.has(candidate)){visited.add(candidate);next.add(candidate);}
    }
    frontier=next;
  }
  return {graphId:graph.graphId,startNodeId:start,direction:normalizedDirection,depth:maxDepth,nodes:graph.nodes.filter((node)=>visited.has(node.nodeId)),edges:graph.edges.filter((edge)=>selected.has(edge.edgeId)),textAlternative:graph.textAlternative,truthBoundary:graph.truthBoundary};
}

const queryGraph=async(env,session,qelly,graphId)=>{
  if(!UUID.test(String(graphId||'')))throw new HttpError(400,'evidence_graph_id_invalid','Evidence graph identifier is invalid');
  const workspaceId=qelly.workspace.workspaceId;
  const [decisions,nodes]=await Promise.all([
    restRequest(env,session.accessToken,`qelly_decisions?select=*&id=eq.${graphId}&workspace_id=eq.${workspaceId}&deleted_at=is.null&limit=1`),
    restRequest(env,session.accessToken,`qelly_provenance_nodes?select=*&decision_id=eq.${graphId}&workspace_id=eq.${workspaceId}&order=created_at.asc&limit=${MAX_NODES}`)
  ]);
  const decision=decisions?.[0];
  if(!decision)throw new HttpError(404,'evidence_graph_not_found','Evidence graph was not found');
  const nodeIds=new Set((nodes||[]).map((node)=>node.id));
  const edges=nodeIds.size?await restRequest(env,session.accessToken,`qelly_provenance_edges?select=*&workspace_id=eq.${workspaceId}&from_node_id=in.(${[...nodeIds].join(',')})&order=created_at.asc&limit=${MAX_EDGES}`):[];
  const scopedEdges=(edges||[]).filter((edge)=>nodeIds.has(edge.from_node_id)&&nodeIds.has(edge.to_node_id));
  return databaseGraph(decision,nodes||[],scopedEdges);
};

export async function buildDecisionRecords({body,workspaceId,userId,idempotencyKey}){
  const canonicalId=cleanText(body.canonicalId,160);
  if(!canonicalId)throw new HttpError(400,'evidence_asset_invalid','A canonical asset identifier is required');
  const thesis=cleanText(body.thesis,1200);
  const invalidationCondition=cleanText(body.invalidationCondition,1200);
  const action=cleanText(body.consideredAction,80)||'monitor-with-conditions';
  const horizon=cleanText(body.horizon,80)||'24h';
  const confidence=safeNumber(body.confidence,{fallback:0});
  const score=safeNumber(body.decisionScore,{min:0,max:100,fallback:0});
  const riskPosture=cleanText(body.riskPosture,120)||'Unassessed';
  const scenarioMove=safeNumber(body.scenarioMove,{min:-100,max:100,fallback:0});
  const supports=textList(body.supports);
  const contradictions=textList(body.contradictions);
  const assumptions=textList(body.assumptions);
  const gates=objectList(body.gates);
  const counterfactuals=objectList(body.counterfactuals);
  const sourceRecords=objectList(body.sourceRecords,{limit:12});
  const notes=cleanText(body.notes,2000);
  const requestHash=await sha256Hex(sanitizeJson(body));
  const decisionId=await stableUuid(`qelly:evidence:${workspaceId}:${idempotencyKey}`);
  const nodeId=async(label)=>stableUuid(`qelly:evidence:${decisionId}:node:${label}`);
  const ids=Object.fromEntries(await Promise.all(['source','hypothesis','scenario','method','risk','decision','review'].map(async(label)=>[label,await nodeId(label)])));
  const createdAt=new Date().toISOString();
  const common={workspace_id:workspaceId,owner_id:userId,decision_id:decisionId};
  const node=(id,node_type,label,truth_state,classification,payload={},evidence={})=>({id,...common,node_type,label:cleanText(label,320)||'Evidence record',truth_state,evidence,payload:{classification,revision:1,...payload}});
  const sourceLabel=cleanText(sourceRecords[0]?.provider||sourceRecords[0]?.sourceId,160)||'Declared analysis source package';
  const nodes=[
    node(ids.source,'source',sourceLabel,sourceRecords.length?'partial':'missing','declared-source',{canonicalId,sourceRecords},{limitations:['No live provider freshness or agreement is asserted by this record.']}),
    node(ids.hypothesis,'hypothesis',thesis||'Human thesis not supplied',thesis?'partial':'missing','human-input',{statement:thesis||null,horizon,confidence,generatedByAi:false}),
    node(ids.scenario,'market_move',`${scenarioMove>=0?'+':''}${scenarioMove}% declared scenario`, 'partial','scenario-input',{canonicalId,scenarioMove,observed:false,liveProvider:false}),
    node(ids.method,'transformation',cleanText(body.methodology?.id||body.methodologyId,160)||'Qelly deterministic decision method','partial','versioned-method',{methodology:sanitizeJson(body.methodology)||null,score}),
    node(ids.risk,'risk_assessment',`${riskPosture} research risk posture`,'partial','derived-inference',{riskPosture,contradictions,assumptions,execution:false}),
    node(ids.decision,'decision',`Considered action: ${action}`,'partial','considered-not-executed',{action,horizon,confidence,score,notes,gates,counterfactuals,humanOverrideRequired:true,executionStatus:'disabled'}),
    node(ids.review,'review',invalidationCondition||'Invalidation condition missing',invalidationCondition?'partial':'missing','falsification-gate',{condition:invalidationCondition||null,state:invalidationCondition?'recorded':'blocked'})
  ];
  const edgeDefinitions=[
    ['supports','source','method',{scope:'declared input only'}],
    ['considered-in','scenario','method',{scenario:true}],
    ['considered-in','hypothesis','decision',{humanSupplied:Boolean(thesis)}],
    ['derived-from','risk','method',{deterministic:true}],
    ['affects','risk','decision',{execution:false}],
    ['supports','method','decision',{score}],
    ['verified-by','decision','review',{falsificationGate:true}]
  ];
  const edges=[];
  for(const [edge_type,from,to,metadata] of edgeDefinitions)edges.push({id:await stableUuid(`qelly:evidence:${decisionId}:edge:${edge_type}:${from}:${to}`),workspace_id:workspaceId,owner_id:userId,from_node_id:ids[from],to_node_id:ids[to],edge_type,metadata});
  return {
    decision:{
      id:decisionId,workspace_id:workspaceId,owner_id:userId,title:cleanText(`${canonicalId} decision provenance`,240),status:'draft',
      objective:thesis||`Evaluate ${canonicalId} under a ${horizon} scenario`,
      alternatives:textList(body.alternatives,{limit:12,max:320}),
      evidence_summary:{schemaVersion:'qelly.decision-evidence/2.0.0',canonicalId,idempotencyKey,requestHash,truthBoundary:TRUTH_BOUNDARY,sourceRecordCount:sourceRecords.length,supports,execution:false,createdAt},
      assumptions,probabilities:{confidence},risks:contradictions,scenarios:[{horizon,scenarioMove,riskPosture},...counterfactuals],counter_evidence:contradictions,
      rationale:cleanText(body.rationale||notes||`${action} was recorded as considered and not executed.`,2000),
      review_conditions:invalidationCondition?[invalidationCondition]:[],outcome:{status:'considered-not-executed',execution:false},learning:{decisionScore:score,gates},confidence
    },nodes,edges
  };
}

async function createGraph(context,session,qelly){
  const {request,env}=context;
  await requireCsrf(request);
  const key=cleanText(request.headers.get('idempotency-key'),128);
  if(key.length<8)throw new HttpError(400,'idempotency_key_required','A valid Idempotency-Key header between 8 and 128 characters is required');
  const body=await jsonBody(request,96_000);
  const records=await buildDecisionRecords({body,workspaceId:qelly.workspace.workspaceId,userId:qelly.user.userId,idempotencyKey:key});
  const existing=await restRequest(env,session.accessToken,`qelly_decisions?select=id,evidence_summary&id=eq.${records.decision.id}&workspace_id=eq.${qelly.workspace.workspaceId}&limit=1`);
  if(existing?.length){
    if(existing[0].evidence_summary?.requestHash!==records.decision.evidence_summary.requestHash)throw new HttpError(409,'idempotency_conflict','The Idempotency-Key was already used with a different decision payload');
    const graph=await queryGraph(env,session,qelly,records.decision.id);return responseJson(request,env,{...graph,idempotency:{key,replayed:true}},200);
  }
  try{
    await restRequest(env,session.accessToken,'qelly_decisions',{method:'POST',body:records.decision,prefer:'return=representation'});
    await restRequest(env,session.accessToken,'qelly_provenance_nodes',{method:'POST',body:records.nodes,prefer:'return=representation'});
    await restRequest(env,session.accessToken,'qelly_provenance_edges',{method:'POST',body:records.edges,prefer:'return=representation'});
  }catch(error){
    try{await restRequest(env,session.accessToken,`qelly_decisions?id=eq.${records.decision.id}&workspace_id=eq.${qelly.workspace.workspaceId}`,{method:'DELETE',prefer:'return=minimal'});}catch{}
    throw error;
  }
  const graph=await queryGraph(env,session,qelly,records.decision.id);
  return responseJson(request,env,{...graph,idempotency:{key,replayed:false}},201);
}

export async function handleEvidence(context,path,segments,method,session,qelly){
  const {request,env}=context;
  if(path==='evidence/graphs'&&method==='GET'){
    const workspaceId=qelly.workspace.workspaceId;
    const rows=await restRequest(env,session.accessToken,`qelly_decisions?select=id,title,status,evidence_summary,current_revision,created_at,updated_at&workspace_id=eq.${workspaceId}&deleted_at=is.null&order=updated_at.desc&limit=${MAX_LIST}`);
    const items=(rows||[]).map((row)=>({graphId:row.id,title:row.title,status:row.status,canonicalId:row.evidence_summary?.canonicalId||null,revision:Number(row.current_revision)||1,createdAt:row.created_at,updatedAt:row.updated_at,truthState:'workspace-rls'}));
    return responseJson(request,env,{mode:'supabase-rls',total:items.length,items,truthBoundary:TRUTH_BOUNDARY});
  }
  if(path==='evidence/explain-move'&&method==='POST')return createGraph(context,session,qelly);
  if(segments[0]==='evidence'&&segments[1]==='graphs'&&segments[2]){
    const graph=await queryGraph(env,session,qelly,segments[2]);
    if(segments.length===3&&method==='GET')return responseJson(request,env,graph);
    if(segments[3]==='traverse'&&method==='GET')return responseJson(request,env,traverseGraph(graph,{nodeId:new URL(request.url).searchParams.get('nodeId'),direction:new URL(request.url).searchParams.get('direction')||'both',depth:new URL(request.url).searchParams.get('depth')||2}));
    if(segments[3]==='export'&&method==='GET'){
      const exportedAt=new Date().toISOString();
      const value={format:'qelly-decision-evidence-package-v2',exportedAt,graph,verification:{nodeCount:graph.nodes.length,edgeCount:graph.edges.length,integrity:graph.integrity,sha256:null}};
      value.verification.sha256=await sha256Hex(value);
      return responseJson(request,env,value);
    }
  }
  return null;
}

export const __evidenceTest=Object.freeze({TRUTH_BOUNDARY,MAX_LIST,MAX_NODES,MAX_EDGES,NODE_TYPE_LABEL,integrityFor,canonicalize,textList,safeNumber,sanitizeJson});
