import {HttpError,correlationId,enforceRateLimit,errorResponse,jsonBody,responseJson} from '../../../_lib/runtime.js';
import {DEFAULT_QELLY_AI_MODEL,buildFinanceContext,datasetRegistry,runGroundedFinanceInference,suggestedRoutes} from '../../../_lib/finance-intelligence.js';

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
      datasets:datasetRegistry(),
      policy:{conversationStorage:'browser_session_only',promptLogging:false,execution:false,custody:false,financialAdvice:false}
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
  const conversationalAnswer=conversationalReply(message);
  if(conversationalAnswer){
    return responseJson(request,sameOriginResponseEnv(request,env),{
      id:crypto.randomUUID(),
      role:'assistant',
      content:conversationalAnswer,
      generatedAt:new Date().toISOString(),
      truthState:'conversational',
      inference:{provider:'qelly-conversation-router',model:null,state:'conversational',reason:null},
      sources:[],
      datasets:{connected:0,catalogued:0,used:0},
      actions:[{route:'market',label:'Open Market Command'},{route:'research-workspace',label:'Open Research Workspace'}],
      disclaimer:'Research information only · not personalized financial advice · no execution',
      correlationId:correlationId(request)
    });
  }
  const contextBuilder=typeof env.__buildFinanceContext==='function'?env.__buildFinanceContext:buildFinanceContext;
  const financeContext=await contextBuilder(context,message);
  const inference=await runGroundedFinanceInference(env,{message,history,financeContext});
  return responseJson(request,sameOriginResponseEnv(request,env),{
    id:crypto.randomUUID(),
    role:'assistant',
    content:inference.answer,
    generatedAt:new Date().toISOString(),
    truthState:inference.state,
    inference:{provider:inference.provider,model:inference.model,state:inference.state,reason:inference.reason??null},
    sources:financeContext.citations,
    datasets:financeContext.datasetSummary,
    actions:suggestedRoutes(message),
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

export const __intelligenceChatTest=Object.freeze({clientKey,safeHistory,requireSameOrigin,sameOriginResponseEnv,conversationalReply});
