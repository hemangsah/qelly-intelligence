import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FINANCE_DATASETS,buildFinanceContext,datasetCoverageAnswer,datasetRegistry,groundedFallbackAnswer,runGroundedFinanceInference,selectWorldBankQuery,suggestedRoutes,__financeIntelligenceTest} from '../functions/_lib/finance-intelligence.js';
import {handleIntelligenceChat} from '../functions/api/v1/intelligence/chat.js';

const SITE='https://qelly-intelligence.pages.dev';
const financeContext={generatedAt:'2026-08-26T00:00:00.000Z',observations:{hyperliquid:[{symbol:'BTC',mid:78000},{symbol:'ETH',mid:2500}],crypto:null,worldBank:{observations:[{countryId:'IND',country:'India',indicator:'GDP growth',value:6.5,unit:'%',year:'2025'}]},ecb:{rates:{USD:1.16,INR:111},observedAt:'2026-08-25'}},citations:[{id:'hyperliquid-public',title:'Hyperliquid public API',url:'https://example.com',truthState:'live'}],datasetSummary:{connected:4,catalogued:FINANCE_DATASETS.length},policy:{fabricatedFallback:false},tools:[]};

test('finance dataset registry is comprehensive but never claims universal access',()=>{
  const registry=datasetRegistry();
  assert.ok(registry.catalogued>=24);
  assert.equal(registry.connected,4);
  assert.ok(Number.isFinite(Date.parse(registry.generatedAt)));
  assert.equal(registry.policy.universalCoverageClaim,false);
  assert.ok(registry.items.some((item)=>item.id==='world-bank'&&item.access==='connected'));
  assert.ok(registry.items.some((item)=>item.id==='bloomberg'&&item.access==='enterprise_license_required'));
  assert.ok(registry.items.some((item)=>item.id==='coinglass'&&item.access==='paid_api_required'));
});

test('World Bank selection maps countries and finance indicators from a question',()=>{
  const selected=selectWorldBankQuery('Compare India and United States inflation with GDP growth');
  assert.deepEqual(selected.countries.map((item)=>item.id),['IND','USA']);
  assert.deepEqual(selected.indicators.map((item)=>item.id),['NY.GDP.MKTP.KD.ZG','FP.CPI.TOTL.ZG']);
});

test('grounded fallback reports only supplied observations and discloses model state',()=>{
  const answer=groundedFallbackAnswer('Compare markets',financeContext);
  assert.match(answer,/BTC 78,000/);
  assert.match(answer,/India GDP growth 6.5%/);
  assert.match(answer,/Generative inference is not available/);
  assert.doesNotMatch(answer,/guaranteed|buy now|sell now/i);
});

test('Workers AI inference receives a grounded system contract',async()=>{
  let request,runOptions;
  const env={AI:{async run(model,input,options){request={model,input};runOptions=options;return {response:'India growth is 6.5% [world-bank].'};}}};
  const result=await runGroundedFinanceInference(env,{message:'India growth?',history:[],financeContext});
  assert.equal(result.provider,'cloudflare-workers-ai');
  assert.equal(result.state,'grounded_model_inference');
  assert.match(result.answer,/world-bank/);
  assert.match(request.input.messages[0].content,/Never claim access to every financial dataset/);
  assert.match(request.input.messages.at(-1).content,/QELLY_GROUNDED_DATA_JSON/);
  assert.deepEqual(runOptions,{rejectIfBusy:true});
  assert.equal(__financeIntelligenceTest.AI_TIMEOUT_MS,12000);
});

test('unsupported model numbers are rejected in favor of deterministic evidence',async()=>{
  const env={AI:{async run(){return {response:'India growth was 99.9% in 2021 [world-bank].'};}}};
  const result=await runGroundedFinanceInference(env,{message:'India growth?',history:[],financeContext});
  assert.equal(result.provider,'qelly-dataset-engine');
  assert.equal(result.state,'grounding_validation_fallback');
  assert.match(result.answer,/India GDP growth 6.5%/);
  assert.doesNotMatch(result.answer,/99\.9|2021/);
});

test('dataset and license questions use the exact governed registry',async()=>{
  let modelCalled=false;
  const env={AI:{async run(){modelCalled=true;return {response:'invented coverage'};}}};
  const result=await runGroundedFinanceInference(env,{message:'Which datasets and licenses can Qelly access?',history:[],financeContext});
  assert.equal(modelCalled,false);
  assert.equal(result.state,'grounded_registry_answer');
  assert.equal(result.answer,datasetCoverageAnswer());
  assert.match(result.answer,/4 connected finance sources and 24 governed dataset entries/);
  assert.match(result.answer,/Bloomberg Data — enterprise license required/);
});

test('chat endpoint exposes capability and answers with sources without logging prompts',async()=>{
  const env={
    AI:{async run(){return {response:'BTC is 78,000 in the supplied observation [hyperliquid-public].'};}},
    async __buildFinanceContext(){return financeContext;}
  };
  const getResponse=await handleIntelligenceChat({request:new Request(`${SITE}/api/v1/intelligence/chat`),env});
  const capability=await getResponse.json();
  assert.equal(capability.assistant.inferenceAvailable,true);
  assert.equal(capability.datasets.connected,4);
  const postResponse=await handleIntelligenceChat({request:new Request(`${SITE}/api/v1/intelligence/chat`,{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json'},body:JSON.stringify({message:'What is BTC now?',history:[]})}),env});
  assert.equal(postResponse.status,200);
  const answer=await postResponse.json();
  assert.equal(answer.truthState,'grounded_model_inference');
  assert.equal(answer.sources[0].id,'hyperliquid-public');
  assert.equal(answer.inference.provider,'cloudflare-workers-ai');

  await assert.rejects(
    ()=>handleIntelligenceChat({request:new Request(`${SITE}/api/v1/intelligence/chat`,{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:JSON.stringify({message:'What is BTC now?'})}),env}),
    (error)=>error?.status===403&&error?.code==='csrf_origin_forbidden'
  );
});

test('short social messages use the immediate Qelly conversational path',async()=>{
  let contextBuilt=false;
  let modelCalled=false;
  const env={
    AI:{async run(){modelCalled=true;return {response:'should not run'};}},
    async __buildFinanceContext(){contextBuilt=true;return financeContext;}
  };
  const response=await handleIntelligenceChat({request:new Request(`${SITE}/api/v1/intelligence/chat`,{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json'},body:JSON.stringify({message:'Hello!'})}),env});
  assert.equal(response.status,200);
  const answer=await response.json();
  assert.equal(answer.truthState,'conversational');
  assert.equal(answer.inference.provider,'qelly-conversation-router');
  assert.match(answer.content,/I’m Qelly Intelligence AI/);
  assert.deepEqual(answer.sources,[]);
  assert.equal(contextBuilt,false);
  assert.equal(modelCalled,false);
});

test('finance context composes governed providers and route suggestions',async()=>{
  const context=await buildFinanceContext({env:{}},'India inflation',{
    networkLoader:async()=>({sources:{hyperliquid:{data:[{symbol:'BTC',mid:1}],truthState:'live'},'alternative-me':{data:null,truthState:'unavailable'}}}),
    providerLoader:async()=>({data:{base:'EUR',rates:{USD:1.1}},observedAt:'2026-08-25',attribution:'ECB'}),
    worldBankLoader:async()=>({truthState:'delayed',observations:[{country:'India',indicator:'Inflation',value:4,unit:'%',year:'2025'}]})
  });
  assert.equal(context.observations.hyperliquid[0].symbol,'BTC');
  assert.equal(context.observations.ecb.rates.USD,1.1);
  assert.equal(suggestedRoutes('verify this source')[0].route,'qelly-verify');
});

test('decision chat mode preserves governed evidence and opens the decision command center',async()=>{
  const result=await runGroundedFinanceInference({}, {message:'Challenge this thesis',history:[],financeContext,mode:'decision'});
  assert.ok(result.answer.length>0);
  assert.equal(suggestedRoutes('Challenge this thesis','decision')[0].route,'decision-provenance');
});

test('frontend installs an accessible global chat drawer and Cloudflare AI binding',async()=>{
  const [chat,css,app,index,wrangler,endpoint]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/ai/qelly-chat.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/ai/qelly-chat.css',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/app.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8'),
    readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'),
    readFile(new URL('../functions/api/v1/intelligence/chat.js',import.meta.url),'utf8')
  ]);
  assert.match(chat,/role="dialog"/);
  assert.match(chat,/aria-live="polite"/);
  assert.match(chat,/sessionStorage/);
  assert.match(chat,/maxlength="2400"/);
  assert.match(chat,/const conversationalAnswer=conversationalReply\(value\)/);
  assert.match(chat,/truthState:'conversational'/);
  assert.match(chat,/Hi — I’m Qelly Intelligence AI/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/100dvh/);
  assert.match(app,/installQellyChat\(\{api,navigate,toast,staticVisualPreview\}\)/);
  assert.match(index,/assets\/ai\/qelly-chat\.css/);
  assert.equal(JSON.parse(wrangler).ai.binding,'AI');
  assert.match(endpoint,/promptLogged:false/);
  assert.match(endpoint,/limit:20/);
});


test('Workers AI busy state falls back to grounded tool evidence',async()=>{
  const env={AI:{async run(){throw new Error('Workers AI busy');}}};
  const context={...financeContext,tools:[{id:'asset-dossier',truthState:'live',source:'Provider',data:{symbol:'BTC',observation:{priceUsd:78000}},limitations:[]}]};
  const result=await runGroundedFinanceInference(env,{message:'Explain BTC',history:[],financeContext:context,mode:'asset'});
  assert.equal(result.provider,'qelly-dataset-engine');
  assert.equal(result.state,'model_unavailable_fallback');
  assert.match(result.answer,/Asset Dossier: BTC/);
  assert.match(result.reason,/busy/i);
});

test('chat capability exposes eight modes, context controls and tool boundaries',async()=>{
  const response=await handleIntelligenceChat({request:new Request('https://qelly-intelligence.pages.dev/api/v1/intelligence/chat'),env:{}});
  const capability=await response.json();
  assert.deepEqual(capability.modes,['ask','research','compare','explain','calculate','decision','asset','india']);
  assert.deepEqual(capability.controls.assets,['BTC','ETH','SOL','HYPE','XRP','DOGE']);
  assert.ok(capability.controls.timeframes.includes('1d'));
  assert.ok(capability.controls.calculators.includes('cagr'));
  assert.equal(capability.tools.eventCalendar,'planning-only-no-live-feed');
  assert.equal(capability.tools.qellyVerify,'input-required-local-analysis');
  assert.equal(capability.tools.publicResearch,true);
  assert.equal(capability.tools.formulaScreener,'on-demand-read-only');
  assert.equal(capability.policy.unvalidatedStreaming,false);
});

test('calculate mode uses deterministic formula engine and never calls the model',async()=>{
  let modelCalled=false,contextBuilt=false;
  const env={AI:{async run(){modelCalled=true;return {response:'should not run'};}},async __buildFinanceContext(){contextBuilt=true;return financeContext;}};
  const request=new Request('https://qelly-intelligence.pages.dev/api/v1/intelligence/chat',{method:'POST',headers:{Origin:'https://qelly-intelligence.pages.dev','Content-Type':'application/json'},body:JSON.stringify({message:'Calculate CAGR',mode:'calculate',calculator:{formulaId:'cagr',inputs:{startValue:100,endValue:121,years:2}}})});
  const response=await handleIntelligenceChat({request,env});
  assert.equal(response.status,200);
  const answer=await response.json();
  assert.equal(answer.truthState,'grounded_calculator');
  assert.equal(answer.inference.provider,'qelly-formula-engine');
  assert.equal(answer.tools[0].id,'calculator');
  assert.equal(answer.tools[0].truthState,'deterministic');
  assert.equal(modelCalled,false);
  assert.equal(contextBuilt,false);
  assert.match(answer.content,/deterministic calculation/i);
});

test('decision mode consumes the exact Decision Intelligence builder and returns a tool receipt',async()=>{
  const decision={asset:'BTC',interval:'15m',horizon:'4h',truthState:'LIVE',observedAt:'2026-09-21T00:00:00Z',market:{lastPrice:80000,currentState:{label:'range · neutral momentum'}},qellyView:{action:'NO TRADE',confidence:.66,riskState:{label:'Moderate short-term range',atrPct:1},scenario:{bull:.4,base:.3,bear:.3,gap:.1},evidenceGate:{directionalEligible:false},contradictions:['Mixed timeframes'],changesIf:'Wait for alignment.'},multiTimeframe:{agreement:{direction:'MIXED',aligned:1,total:4}},confidence:{calibration:'Evidence confidence is not a success probability.'},evidence:{news:{state:'no-matches',provider:'GDELT',articles:[]},derivatives:{state:'unavailable'}},provenance:{provider:'Hyperliquid',documentation:'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint',model:{limitations:['Research only.']}}};
  const env={AI:{async run(){return {response:'The decision evidence is mixed.'};}},async __buildFinanceContext(){return financeContext;},async __buildDecisionIntelligence(){return decision;}};
  const request=new Request('https://qelly-intelligence.pages.dev/api/v1/intelligence/chat',{method:'POST',headers:{Origin:'https://qelly-intelligence.pages.dev','Content-Type':'application/json'},body:JSON.stringify({message:'Review BTC decision evidence',mode:'decision',asset:'BTC',timeframe:'15m'})});
  const response=await handleIntelligenceChat({request,env});
  assert.equal(response.status,200);
  const answer=await response.json();
  const tool=answer.tools.find(item=>item.id==='decision-intelligence');
  assert.ok(tool);
  assert.equal(tool.data.action,'NO TRADE');
  assert.deepEqual(tool.data.contradictions,['Mixed timeframes']);
  assert.equal(answer.actions[0].route,'decision-provenance');
});

test('India finance context exposes delayed/reference evidence and display-only limits',async()=>{
  const context=await buildFinanceContext({env:{}},'India inflation',{networkLoader:async()=>({sources:{hyperliquid:{data:[{symbol:'BTC',mid:1}],truthState:'live'},'alternative-me':{data:null,truthState:'unavailable'}}}),providerLoader:async()=>({data:{base:'EUR',rates:{USD:1.1,INR:90}},observedAt:'2026-08-25',attribution:'ECB'}),worldBankLoader:async()=>({truthState:'delayed',observations:[{countryId:'IND',country:'India',indicator:'Inflation',value:4,unit:'%',year:'2025'}]}),mode:'india',asset:'BTC'});
  assert.equal(context.tools[0].id,'india-finance');
  assert.match(context.tools[0].limitations.join(' '),/display-only/i);
  assert.match(context.tools[0].limitations.join(' '),/India VIX/i);
});
