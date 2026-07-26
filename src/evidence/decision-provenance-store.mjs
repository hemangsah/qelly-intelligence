import crypto from 'node:crypto';
import { AtomicJsonStore } from '../platform/json-store.mjs';

const NODE_TYPES=new Set(['Asset','SourceRecord','ProviderObservation','NormalizedObservation','MarketMove','ResearchClaim','Hypothesis','Signal','AlertEvent','DecisionRecord','RiskAssessment','OutcomeRecord','ReviewRecord']);
const EDGE_TYPES=new Set(['sourced-from','normalized-from','reconciled-with','supports','contradicts','derived-from','triggered','affects','references','approved-by','supersedes','resulted-in','reviewed-by']);
const nowIso=()=>new Date().toISOString();
const id=(prefix)=>`${prefix}-${crypto.randomUUID()}`;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);

function assertScope(scope){
  if(!scope?.userId||!scope?.tenantId||!scope?.workspaceId)throw Object.assign(new Error('Evidence graph requires user, tenant, and workspace scope'),{status:400,code:'evidence_scope_invalid'});
}
function scoped(record,scope){return record.tenantId===scope.tenantId&&record.workspaceId===scope.workspaceId;}
function assertNodeType(type){if(!NODE_TYPES.has(type))throw Object.assign(new Error(`Unsupported evidence node type: ${type}`),{status:400,code:'evidence_node_type_invalid'});}
function assertEdgeType(type){if(!EDGE_TYPES.has(type))throw Object.assign(new Error(`Unsupported evidence edge type: ${type}`),{status:400,code:'evidence_edge_type_invalid'});}

export class DecisionProvenanceStore{
  constructor({filePath,auditLedger}={}){
    this.store=new AtomicJsonStore(filePath,()=>({version:1,graphs:[],nodes:[],edges:[],exports:[]}));
    this.auditLedger=auditLedger;
  }

  async list(scope,{limit=25}={}){
    assertScope(scope);const data=await this.store.read();
    const items=data.graphs.filter((item)=>scoped(item,scope)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,Math.max(1,Math.min(100,Number(limit)||25)));
    return {items,total:data.graphs.filter((item)=>scoped(item,scope)).length,truthBoundary:'Each graph is persisted in the active workspace. Automated prose is deterministic assembly from stored records, not an AI market prediction.'};
  }

  async graph(scope,graphId){
    assertScope(scope);const data=await this.store.read();const graph=data.graphs.find((item)=>item.graphId===graphId&&scoped(item,scope));
    if(!graph)throw Object.assign(new Error('Evidence graph not found'),{status:404,code:'evidence_graph_not_found'});
    const nodes=data.nodes.filter((item)=>item.graphId===graphId&&scoped(item,scope));
    const nodeIds=new Set(nodes.map((item)=>item.nodeId));
    const edges=data.edges.filter((item)=>item.graphId===graphId&&scoped(item,scope)&&nodeIds.has(item.fromNodeId)&&nodeIds.has(item.toNodeId));
    return {...graph,nodes,edges,integrity:this.#integrity(nodes,edges),textAlternative:this.#textAlternative(graph,nodes,edges)};
  }

  async explainMove(scope,{asset,thesis='',consideredAction='monitor',horizon='24h',confidence=0.5,notes=''},correlationId){
    assertScope(scope);
    if(!asset?.canonicalId||!asset?.source)throw Object.assign(new Error('A canonical public-market asset observation is required'),{status:400,code:'evidence_asset_invalid'});
    const action=clean(consideredAction,80)||'monitor';
    const safeConfidence=Math.max(0,Math.min(1,Number(confidence)||0));
    const createdAt=nowIso();const graphId=id('graph');
    const graph={graphId,userId:scope.userId,tenantId:scope.tenantId,workspaceId:scope.workspaceId,title:`Explain ${asset.symbol} move`,canonicalId:asset.canonicalId,status:'active',summaryMode:'deterministic-record-assembly',createdAt,updatedAt:createdAt,revision:1,truthBoundary:'This evidence package records source observations, transformations, user assumptions, risk boundaries, and a considered action. It does not provide personalized financial advice or guarantee an outcome.'};
    const nodes=[];const edges=[];
    const addNode=(type,label,data,classification='workspace')=>{assertNodeType(type);const node={nodeId:id('node'),graphId,userId:scope.userId,tenantId:scope.tenantId,workspaceId:scope.workspaceId,type,label:clean(label,160),classification,createdAt,revision:1,data};nodes.push(node);return node;};
    const addEdge=(type,from,to,evidence={})=>{assertEdgeType(type);const edge={edgeId:id('edge'),graphId,userId:scope.userId,tenantId:scope.tenantId,workspaceId:scope.workspaceId,type,fromNodeId:from.nodeId,toNodeId:to.nodeId,createdAt,evidence};edges.push(edge);return edge;};

    const assetNode=addNode('Asset',`${asset.name} (${asset.symbol})`,{canonicalId:asset.canonicalId,symbol:asset.symbol,name:asset.name,assetClass:asset.assetClass,categories:asset.categories??[]},'public');
    const sourceNode=addNode('SourceRecord',asset.source.attribution??asset.source.provider,{provider:asset.source.provider,attribution:asset.source.attribution,sourceUrl:asset.source.sourceUrl??null,entitlement:asset.source.entitlement,license:asset.source.license??null,retrievedAt:asset.source.ingestedAt,effectiveAt:asset.source.observedAt},'public');
    const providerNode=addNode('ProviderObservation',`${asset.symbol} provider observation`,{price:asset.price,change24h:asset.change24h,open24h:asset.open24h,high24h:asset.high24h,low24h:asset.low24h,volume24h:asset.volume24h,quoteVolume24h:asset.quoteVolume24h,observedAt:asset.source.observedAt,ingestedAt:asset.source.ingestedAt,freshness:asset.source.freshness,qualityState:asset.source.qualityState,confidence:asset.source.confidence,cacheState:asset.source.cacheState,degraded:asset.source.degraded,fallbackReason:asset.source.fallbackReason??null},'public');
    const normalizedNode=addNode('NormalizedObservation',`${asset.symbol} canonical observation`,{canonicalId:asset.canonicalId,price:asset.price,currency:asset.quoteCurrency??'USDT',change24h:asset.change24h,normalizationVersion:asset.source.normalizationVersion??'qelly-public-market-v1',qualityState:asset.source.qualityState},'workspace');
    const moveNode=addNode('MarketMove',`${asset.symbol} ${Number(asset.change24h??0)>=0?'advanced':'declined'} ${Math.abs(Number(asset.change24h??0)).toFixed(2)}%`,{window:'24h',changePercent:Number(asset.change24h??0),direction:Number(asset.change24h??0)>=0?'up':'down',price:asset.price,observedAt:asset.source.observedAt,uncertainty:asset.source.degraded?'Provider data is degraded or simulated; conclusions must be treated as provisional.':'Observation is public read-only data; causality is not inferred from price alone.'},'workspace');
    const riskNode=addNode('RiskAssessment','Evidence and execution boundaries',{marketDataQuality:asset.source.qualityState,providerDegraded:Boolean(asset.source.degraded),liveTrading:false,custody:false,transfers:false,personalizedAdvice:false,risks:['Market price can change rapidly','A price move does not establish causality','Provider or network degradation can affect freshness','User assumptions require independent review']},'restricted');
    addEdge('sourced-from',providerNode,sourceNode,{provider:asset.source.provider});
    addEdge('normalized-from',normalizedNode,providerNode,{normalizationVersion:asset.source.normalizationVersion??'qelly-public-market-v1'});
    addEdge('references',normalizedNode,assetNode,{canonicalId:asset.canonicalId});
    addEdge('derived-from',moveNode,normalizedNode,{calculation:'provider-reported 24-hour percentage change'});
    addEdge('affects',moveNode,assetNode,{scope:'canonical asset'});
    addEdge('references',riskNode,moveNode,{reason:'risk assessment is bound to the recorded observation state'});

    let hypothesisNode=null,decisionNode=null;
    if(clean(thesis,1200)){
      hypothesisNode=addNode('Hypothesis','User market hypothesis',{statement:clean(thesis,1200),horizon:clean(horizon,80)||'24h',confidence:safeConfidence,authorUserId:scope.userId,generatedByAi:false},'restricted');
      addEdge('references',hypothesisNode,moveNode,{userSupplied:true});
      addEdge('supports',normalizedNode,hypothesisNode,{scope:'observation only; does not prove causality'});
    }
    decisionNode=addNode('DecisionRecord',`Considered action: ${action}`,{action,horizon:clean(horizon,80)||'24h',confidence:safeConfidence,notes:clean(notes,1500),status:'considered-not-executed',liveExecution:false,createdBy:scope.userId},'restricted');
    addEdge('derived-from',decisionNode,hypothesisNode??moveNode,{userDecision:true});
    addEdge('references',decisionNode,riskNode,{riskAcknowledged:true});

    await this.store.update((data)=>{data.graphs.push(graph);data.nodes.push(...nodes);data.edges.push(...edges);return data;});
    await this.auditLedger?.append({eventType:'evidence.graph.created.v1',correlationId,actor:{type:'user',id:scope.userId},tenantId:scope.tenantId,workspaceId:scope.workspaceId,outcome:'success',classification:'restricted',details:{graphId,canonicalId:asset.canonicalId,nodeCount:nodes.length,edgeCount:edges.length,consideredAction:action,liveExecution:false}});
    return this.graph(scope,graphId);
  }

  async traverse(scope,graphId,{nodeId,direction='both',depth=2}={}){
    const graph=await this.graph(scope,graphId);const maxDepth=Math.max(0,Math.min(5,Number(depth)||2));
    const start=nodeId||graph.nodes[0]?.nodeId;if(!start||!graph.nodes.some((node)=>node.nodeId===start))throw Object.assign(new Error('Evidence start node not found'),{status:404,code:'evidence_node_not_found'});
    const visited=new Set([start]);let frontier=new Set([start]);const selectedEdges=[];
    for(let level=0;level<maxDepth&&frontier.size;level++){
      const next=new Set();
      for(const edge of graph.edges){
        const outward=frontier.has(edge.fromNodeId)&&(direction==='downstream'||direction==='both');
        const inward=frontier.has(edge.toNodeId)&&(direction==='upstream'||direction==='both');
        if(!outward&&!inward)continue;selectedEdges.push(edge);const candidate=outward?edge.toNodeId:edge.fromNodeId;if(!visited.has(candidate)){visited.add(candidate);next.add(candidate);}
      }
      frontier=next;
    }
    const edgeIds=new Set(selectedEdges.map((edge)=>edge.edgeId));
    return {graphId,startNodeId:start,direction,depth:maxDepth,nodes:graph.nodes.filter((node)=>visited.has(node.nodeId)),edges:graph.edges.filter((edge)=>edgeIds.has(edge.edgeId)),textAlternative:graph.textAlternative,truthBoundary:graph.truthBoundary};
  }

  async exportPackage(scope,graphId,correlationId){
    const graph=await this.graph(scope,graphId);const exportedAt=nowIso();const exportId=id('evidence-export');
    const value={format:'qelly-decision-evidence-package-v1',exportId,exportedAt,graph,verification:{nodeCount:graph.nodes.length,edgeCount:graph.edges.length,integrity:graph.integrity,sha256:null}};
    const canonical=JSON.stringify(value);value.verification.sha256=crypto.createHash('sha256').update(canonical).digest('hex');
    await this.store.update((data)=>{data.exports.push({exportId,graphId,userId:scope.userId,tenantId:scope.tenantId,workspaceId:scope.workspaceId,exportedAt,sha256:value.verification.sha256});return data;});
    await this.auditLedger?.append({eventType:'evidence.graph.exported.v1',correlationId,actor:{type:'user',id:scope.userId},tenantId:scope.tenantId,workspaceId:scope.workspaceId,outcome:'success',classification:'restricted',details:{graphId,exportId,sha256:value.verification.sha256}});
    return value;
  }

  #integrity(nodes,edges){
    const ids=new Set(nodes.map((node)=>node.nodeId));const orphaned=edges.filter((edge)=>!ids.has(edge.fromNodeId)||!ids.has(edge.toNodeId));
    return {valid:orphaned.length===0,nodeCount:nodes.length,edgeCount:edges.length,orphanedEdgeIds:orphaned.map((edge)=>edge.edgeId)};
  }
  #textAlternative(graph,nodes,edges){
    const nodeById=new Map(nodes.map((node)=>[node.nodeId,node]));
    return {title:graph.title,summary:`${nodes.length} evidence nodes and ${edges.length} governed relationships.`,steps:edges.map((edge)=>`${nodeById.get(edge.fromNodeId)?.label??edge.fromNodeId} ${edge.type} ${nodeById.get(edge.toNodeId)?.label??edge.toNodeId}`)};
  }
}
