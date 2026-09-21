import {HttpError,correlationId,enforceRateLimit,errorResponse,jsonBody,responseJson} from '../../../_lib/runtime.js';
import {DEFAULT_QELLY_AI_MODEL,buildFinanceContext,datasetRegistry,runGroundedFinanceInference,suggestedRoutes} from '../../../_lib/finance-intelligence.js';
import {CHAT_ASSETS,CHAT_MODES,CHAT_TIMEFRAMES,FEATURED_CALCULATORS,buildCalculatorToolReceipt,compactDecisionToolReceipt,normalizeChatAsset,normalizeChatMode,normalizeChatTimeframe} from '../../../_lib/qelly-chat-tools.js';
import {buildDecisionIntelligence} from '../decision-proven-graph.js';

const clientKey=(request)=>request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')||'unknown';
const safeHistory=(value)=>Array.isArray(value)?value.slice(-12).map((item)=>({role:item?.role==='assistant'?'assistant':'user',content:String(item?.content??'').trim().slice(0,2000)})).filter((item)=>item.content):[];
const requireSameOrigin=(request)=>{
  const origin=request.headers.get('origin');
  if(!origin)throw new HttpError(403,'csrf_origin_required','State-changing requests require an Origin header');
  let suppliedOrigin;
  try{suppliedOrigin=new URL(origin).origin;}catch{throw new HttpError(403,'csrf_origin_forbidden','Cross-origin state change blocked');}
  if(suppliedOrigin!==new URL(request.url).origin)throw new HttpError(403,'csrf_origin_forbidden','Cross-origin state change blocked');
};
const sameOriginResponseEnv=(request,env)=>({
  ...env,
  QELLY_ALLOWED_ORIGINS:[env.QELLY_ALLOWED_ORIGINS,new URL(request.url).origin].filter(Boolean).join(',')
});
const HORIZON_FOR_TIMEFRAME=Object.freeze({'1m':'1h','5m':'4h','15m':'4h','30m':'4h','1h':'12h','4h':'1d','1d':'3d'});
const followUps=(mode,asset)=>({
  ask:[`Explain the strongest evidence for ${asset}.`,`What evidence is unavailable for ${asset}?`,'Show me the relevant QELLY tools.'],
  research:[`Build a source-aware ${asset} research brief.`,`What would falsify the current ${asset} thesis?`,'Which source should I verify next?'],
  compare:[`Compare ${asset} with BTC using the same evidence dimensions.`,'Which comparison fields are missing?','Open the comparison workflow.'],
  explain:[`Explain the current ${asset} market state step by step.`,'Which claims are observed versus inferred?','What would change this explanation?'],
  calculate:['Which calculator matches this problem?','Show the registered input schema.','Open the full calculator library.'],
  decision:[`What evidence blocks a directional ${asset} view?`,'Explain the invalidation condition.','Open Decision Intelligence.'],
  asset:[`Which ${asset} evidence tracks are unavailable?`,'Show independent context and its limits.','Open the Asset Dossier.'],
  india:['Which India evidence is delayed versus display-only?','Show the latest available India macro reference evidence.','Open India Finance.']
}[mode]||[]).slice(0,3);
const calculatorAnswer=(tool)=>{
  const data=tool?.data||{};
  if(tool?.truthState==='deterministic'){
    const outputs=Object.entries(data.outputs||{}).map(([key,value])=>`• ${key}: ${String(value)}`).join('\n');
    return [`QELLY deterministic calculation · ${data.formulaId} · version ${data.formulaVersion}`,outputs||'No scalar output was returned.','','This result uses only the declared inputs and registered formula logic. It is not a forecast or recommendation.'].join('\n');
  }
  const definition=data.definition;
  if(tool?.truthState==='input_required'&&definition){
    return [`QELLY calculator ready: ${definition.name} (${definition.formulaId}).`,'Provide the calculator inputs as a JSON object. QELLY will not invent missing numeric assumptions.','',`Example: ${JSON.stringify(definition.example)}`].join('\n');
  }
  const error=data.validationError||data.validationErrors?.[0]?.message||data.reason||'The calculator inputs are not valid.';
  return `QELLY deterministic calculator could not produce a result: ${error} No substitute arithmetic was generated.`;
};
const decisionToolSources=(result)=>([
  result?.provenance?.documentation?{id:'decision-market',title:`${result.provenance.provider||'Market'} Decision Intelligence source`,url:result.provenance.documentation,truthState:result.truthState,observedAt:result.observedAt}:null,
  ...(result?.evidence?.news?.articles||[]).slice(0,4).map((item,index)=>item?.url?{id:`decision-news-${index+1}`,title:item.title,url:item.url,truthState:result.evidence.news.state,observedAt:item.publishedAt??null}:null)
]).filter(Boolean);

const conversationalReply=(message)=>{
  const normalized=String(message??'').trim().toLowerCase().replace(/[.!?]+$/g,'').trim();
  if(/^(hi|hello|hey|hiya|good morning|good afternoon|good evening)$/.test(normalized)){
    return 'Hi — I’m Qelly Intelligence AI. I can help you explore markets, compare assets and economies, explain financial concepts, and inspect the sources behind every data-backed answer. What would you like to research?';
  }
  if(/^(who are you|what are you|what is qelly|tell me about yourself)$/.test(normalized)){
    return 'I’m Qelly Intelligence AI, the evidence-first research assistant for Qelly Intelligence. I answer financial questions using connected, source-labelled datasets and clearly disclose when coverage is delayed, restricted, or unavailable.';
  }
  if(/^(thanks|thank you|thankyou|cheers)$/.test(normalized)){
    return 'You’re welcome. I’m ready whenever you want to explore a market, compare economies, inspect a source, or understand a financial concept.';
  }
  return null;
};

export async function handleIntelligenceChat(context){
  const {request,env}=context;
  const method=request.method.toUpperCase();
  if(method==='GET'){
    await enforceRateLimit(env,`intelligence-capability:${clientKey(request)}`,{limit:60});
    return responseJson(request,env,{
      assistant:{id:'qelly-intelligence',name:'Qelly Intelligence',available:true,inferenceAvailable:typeof env.AI?.run==='function',provider:typeof env.AI?.run==='function'?'cloudflare-workers-ai':'qelly-dataset-engine',model:typeof env.AI?.run==='function'?String(env.QELLY_AI_MODEL||DEFAULT_QELLY_AI_MODEL):null},
      modes:CHAT_MODES,
      controls:{assets:CHAT_ASSETS,timeframes:CHAT_TIMEFRAMES,calculators:FEATURED_CALCULATORS},
      datasets:datasetRegistry(),
      tools:{marketData:true,assetDossier:true,formulaScreener:'on-demand-read-only',calculators:true,decisionIntelligence:true,search:true,eventCalendar:'planning-only-no-live-feed',indiaFinance:true,publicResearch:true,qellyVerify:'input-required-local-analysis'},
      policy:{conversationStorage:'browser_session_only',promptLogging:false,execution:false,custody:false,financialAdvice:false,unvalidatedStreaming:false}
    });
  }
  if(method!=='POST')throw new HttpError(405,'method_not_allowed','Use GET or POST for the Qelly Intelligence assistant.');
  requireSameOrigin(request);
  await enforceRateLimit(env,`intelligence-chat:${clientKey(request)}`,{limit:20,windowMs:60_000});
  const body=await jsonBody(request,40_000);
  const message=String(body.message??'').trim();
  if(message.length<2)throw new HttpError(400,'chat_message_required','Enter a financial research question.');
  if(message.length>2400)throw new HttpError(400,'chat_message_too_long','Keep the research question under 2,400 characters.');
  const history=safeHistory(body.history);
  const mode=normalizeChatMode(body.mode);
  const asset=normalizeChatAsset(body.asset);
  const timeframe=normalizeChatTimeframe(body.timeframe);
  const conversationalAnswer=conversationalReply(message);
  if(conversationalAnswer){
    return responseJson(request,sameOriginResponseEnv(request,env),{
      id:crypto.randomUUID(),
      role:'assistant',
      content:conversationalAnswer,
      generatedAt:new Date().toISOString(),
      mode,
      asset,
      timeframe,
      truthState:'conversational',
      inference:{provider:'qelly-conversation-router',model:null,state:'conversational',reason:null},
      sources:[],
      datasets:{connected:0,catalogued:0,used:0},
      actions:[{route:'market',label:'Open Market Command'},{route:'research-workspace',label:'Open Research Workspace'}],
      followUps:followUps(mode,asset),
      tools:[],
      disclaimer:'Research information only · not personalized financial advice · no execution',
      correlationId:correlationId(request)
    });
  }
  if(mode==='calculate'){
    const calculator=buildCalculatorToolReceipt(body.calculator||{formulaId:FEATURED_CALCULATORS[0]});
    return responseJson(request,sameOriginResponseEnv(request,env),{
      id:crypto.randomUUID(),role:'assistant',content:calculatorAnswer(calculator),generatedAt:new Date().toISOString(),
      mode,asset,timeframe,truthState:'grounded_calculator',inference:{provider:'qelly-formula-engine',model:null,state:calculator.truthState,reason:null},
      sources:[],datasets:{connected:0,catalogued:0,used:0},tools:[calculator],actions:suggestedRoutes(message,mode),followUps:followUps(mode,asset),
      evidence:{used:calculator.truthState==='deterministic'?1:0,available:calculator.truthState==='deterministic'?[calculator.id]:[],unavailable:calculator.truthState==='deterministic'?[]:[calculator.id],generatedAt:new Date().toISOString(),noFabricatedFallback:true},
      disclaimer:'Deterministic educational calculation · not personalized financial advice · no execution',correlationId:correlationId(request)
    });
  }
  const contextBuilder=typeof env.__buildFinanceContext==='function'?env.__buildFinanceContext:buildFinanceContext;
  const financeContext=await contextBuilder(context,message,{mode,asset});
  const tools=[...(Array.isArray(financeContext.tools)?financeContext.tools:[])];
  let extraSources=[];
  if(mode==='decision'){
    const decisionBuilder=typeof env.__buildDecisionIntelligence==='function'?env.__buildDecisionIntelligence:buildDecisionIntelligence;
    try{
      const decision=await decisionBuilder(env,{asset,interval:timeframe,horizon:HORIZON_FOR_TIMEFRAME[timeframe]||'4h'});
      tools.push(compactDecisionToolReceipt(decision));
      extraSources=decisionToolSources(decision);
    }catch(error){
      tools.push({...compactDecisionToolReceipt(null),data:{reason:String(error?.message||'Decision Intelligence unavailable').slice(0,240)}});
    }
  }
  const groundedContext={...financeContext,tools};
  const inference=await runGroundedFinanceInference(env,{message,history,financeContext:groundedContext,mode});
  const sources=[...(financeContext.citations||[]),...extraSources];
  const availableSources=sources.filter((source)=>source?.truthState&&source.truthState!=='unavailable');
  const availableTools=tools.filter((tool)=>tool?.truthState&&!['unavailable','invalid_input','input_required'].includes(tool.truthState));
  return responseJson(request,sameOriginResponseEnv(request,env),{
    id:crypto.randomUUID(),
    role:'assistant',
    content:inference.answer,
    generatedAt:new Date().toISOString(),
    mode,asset,timeframe,
    truthState:inference.state,
    inference:{provider:inference.provider,model:inference.model,state:inference.state,reason:inference.reason??null},
    sources,
    datasets:financeContext.datasetSummary,
    tools,
    actions:suggestedRoutes(message,mode),
    followUps:followUps(mode,asset),
    evidence:{used:availableSources.length+availableTools.length,available:[...availableSources.map((source)=>source.id),...availableTools.map((tool)=>tool.id)],unavailable:[...sources.filter((source)=>source?.truthState==='unavailable').map((source)=>source.id),...tools.filter((tool)=>tool?.truthState==='unavailable').map((tool)=>tool.id)],generatedAt:financeContext.generatedAt,noFabricatedFallback:financeContext.policy.fabricatedFallback===false},
    disclaimer:'Research information only · not personalized financial advice · no execution',
    correlationId:correlationId(request)
  });
}

export async function onRequest(context){
  const started=Date.now();
  let response;
  try{response=await handleIntelligenceChat(context);return response;}
  catch(error){response=errorResponse(context.request,sameOriginResponseEnv(context.request,context.env),error);return response;}
  finally{
    try{console.log(JSON.stringify({event:'qelly_intelligence_chat',correlationId:correlationId(context.request),method:context.request.method,status:response?.status??500,durationMs:Date.now()-started,promptLogged:false,bodyLogged:false}));}catch{}
  }
}

export const __intelligenceChatTest=Object.freeze({CHAT_MODES,CHAT_ASSETS,CHAT_TIMEFRAMES,FEATURED_CALCULATORS,HORIZON_FOR_TIMEFRAME,clientKey,safeHistory,requireSameOrigin,sameOriginResponseEnv,conversationalReply,followUps,calculatorAnswer,decisionToolSources});
