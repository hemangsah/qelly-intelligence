import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FINANCE_DATASETS,buildFinanceContext,datasetRegistry,groundedFallbackAnswer,runGroundedFinanceInference,selectWorldBankQuery,suggestedRoutes} from '../functions/_lib/finance-intelligence.js';
import {handleIntelligenceChat} from '../functions/api/v1/intelligence/chat.js';

const SITE='https://qelly-intelligence.pages.dev';
const financeContext={generatedAt:'2026-08-26T00:00:00.000Z',observations:{hyperliquid:[{symbol:'BTC',mid:78000},{symbol:'ETH',mid:2500}],crypto:null,worldBank:{observations:[{country:'India',indicator:'GDP growth',value:6.5,unit:'%',year:'2025'}]},ecb:{rates:{USD:1.16,INR:111},observedAt:'2026-08-25'}},citations:[{id:'hyperliquid-public',title:'Hyperliquid public API',url:'https://example.com',truthState:'live'}],datasetSummary:{connected:4,catalogued:FINANCE_DATASETS.length},policy:{fabricatedFallback:false}};

test('finance dataset registry is comprehensive but never claims universal access',()=>{
  const registry=datasetRegistry();
  assert.ok(registry.catalogued>=24);
  assert.equal(registry.connected,4);
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
  let request;
  const env={AI:{async run(model,input){request={model,input};return {response:'India growth is 6.5% [world-bank].'};}}};
  const result=await runGroundedFinanceInference(env,{message:'India growth?',history:[],financeContext});
  assert.equal(result.provider,'cloudflare-workers-ai');
  assert.equal(result.state,'grounded_model_inference');
  assert.match(result.answer,/world-bank/);
  assert.match(request.input.messages[0].content,/Never claim access to every financial dataset/);
  assert.match(request.input.messages.at(-1).content,/QELLY_GROUNDED_DATA_JSON/);
});

test('chat endpoint exposes capability and answers with sources without logging prompts',async()=>{
  const env={
    QELLY_PUBLIC_SITE_URL:SITE,
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
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/100dvh/);
  assert.match(app,/installQellyChat\(\{api,navigate,toast,staticVisualPreview\}\)/);
  assert.match(index,/assets\/ai\/qelly-chat\.css/);
  assert.equal(JSON.parse(wrangler).ai.binding,'AI');
  assert.match(endpoint,/promptLogged:false/);
  assert.match(endpoint,/limit:20/);
});
