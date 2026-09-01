import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {startServer as startLegacyServer} from '../src/server/server.mjs';
import {__profileRouteTest} from '../functions/api/v1/profile.js';
import {capabilityInventory} from '../functions/_lib/capability-registry.js';
import {providerDirectory,providerDirectorySummary} from '../functions/_lib/provider-directory.js';
import {buildPublicDexDiscovery} from '../functions/_lib/public-dex.js';
import {buildPublicGlobalCharts} from '../functions/_lib/public-global-charts.js';
import {buildPublicConverter} from '../functions/_lib/public-converter.js';
import {buildPublicAssetIntelligence} from '../functions/_lib/public-asset-intelligence.js';
import {buildPublicAdvancedChart} from '../functions/_lib/public-advanced-chart.js';
import {buildPublicFundamentalsEstimates} from '../functions/_lib/public-fundamentals-estimates.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const productionFrontend=path.join(root,'dist/frontend');
const EVIDENCE_USER_ID='00000000-0000-4000-8000-000000000001';
const EVIDENCE_WORKSPACE_ID='00000000-0000-4000-8000-000000000002';
const EVIDENCE_SESSION_ID='sess-local-primary';
const FIXED_TIME='2026-08-16T00:00:00.000Z';

const MIME=Object.freeze({
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'
});

function sendJson(response,status,body){
  const payload=JSON.stringify(body);
  response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(payload),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  response.end(payload);
}

function evidenceProfile(){
  return __profileRouteTest.profilePayload({
    user:{userId:EVIDENCE_USER_ID,email:'evidence@qelly.test',emailConfirmedAt:FIXED_TIME,displayName:'Qelly Evidence User'},
    profile:{display_name:'Qelly Evidence User',base_currency:'USD',timezone:'UTC',cloud_sync_opt_in:true,privacy_version:'evidence-v1',terms_version:'evidence-v1',created_at:FIXED_TIME,updated_at:FIXED_TIME},
    workspace:{workspaceId:EVIDENCE_WORKSPACE_ID,name:'Evidence Workspace'},
    session:{sessionId:EVIDENCE_SESSION_ID,authenticationMethod:'development-fixture',expiresAt:'2027-08-16T00:00:00.000Z',current:true,revokedAt:null}
  });
}

function evidenceDataPlane(){
  return {
    generatedAt:FIXED_TIME,canonicalRuntime:'evidence-cloudflare-contract-adapter',releaseSha:'evidence-fixture',environment:'test',canonicalSite:'https://qelly.test',
    dataPlane:{instrumentCount:0,seriesCount:0,pointCount:0,providerCount:3},items:[],releaseIdentity:null,
    releaseCongruence:{state:'UNVERIFIED',runtimeSha:'evidence-fixture',recordedSha:null,reason:'Evidence runtime intentionally has no production release identity.'},
    guardrails:{readOnly:true,execution:false,rawProviderCacheExposed:false,browserDirectPrivilegedTableAccess:false},
    evidenceBoundary:'deterministic-empty-contract-no-market-observations'
  };
}

const providerPolicies=()=>[
  {id:'binance',enabled:false,capabilities:['quote','candles'],termsState:'blocked_pending_redistribution_rights',reason:'provider_redistribution_rights_not_verified',termsUrl:'https://developers.binance.com/en/docs/introduction'},
  {id:'coinbase',enabled:false,capabilities:['quote','candles'],termsState:'blocked_pending_written_end_user_display_permission',reason:'provider_end_user_display_rights_not_verified',termsUrl:'https://www.coinbase.com/legal/market_data'},
  {id:'ecb',enabled:true,capabilities:['fx-reference-rates'],termsState:'conditionally_approved_attributed_reference_data',reason:null,termsUrl:'https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html'}
];

function evidencePublicMarketOverview(){
  return {
    generatedAt:FIXED_TIME,truthState:'UNAVAILABLE',reason:'Evidence runtime performs no external provider network requests.',providers:providerPolicies(),items:[],total:0,
    referenceRates:{provider:'ecb',state:'unavailable',count:0,observedAt:null,ingestedAt:FIXED_TIME,attribution:'European Central Bank',reason:'evidence_runtime_external_network_isolated'},
    guardrails:{execution:false,readOnly:true,fabricatedObservations:false,externalWidgetValuesConsumedByAnalytics:false}
  };
}

function evidenceMarketNetwork(){
  const isolated=(id,label,usage)=>({id,label,state:'unavailable',observedAt:null,fetchedAt:FIXED_TIME,data:null,attribution:label,usage,reason:'evidence_runtime_external_network_isolated'});
  return {
    generatedAt:FIXED_TIME,
    releaseSha:'evidence-fixture',
    sources:{
      'alternative-me':isolated('alternative-me','Alternative.me','External crypto reference API isolated in deterministic evidence runtime.'),
      hyperliquid:isolated('hyperliquid','Hyperliquid','External read-only info API isolated in deterministic evidence runtime.'),
      'world-bank':isolated('world-bank','World Bank','External macro reference API isolated in deterministic evidence runtime.'),
      imf:isolated('imf','IMF DataMapper','Official statistical reference API isolated in deterministic evidence runtime.'),
      ecb:{provider:'ecb',sourceIdentifier:'EUR',truthState:'unavailable',observationTime:null,ingestionTime:FIXED_TIME,freshness:'unavailable',quality:'evidence-network-isolated',confidence:0,attribution:'European Central Bank',license:null,fallbackReason:'evidence_runtime_external_network_isolated',termsState:'conditionally_approved_attributed_reference_data',cache:{hit:false,stale:false},data:null}
    },
    providerDirectory:providerDirectory(),
    providerDirectorySummary:providerDirectorySummary(),
    policy:{fabricatedFallback:false,execution:false,custody:false,sourceFailuresRemainUnavailable:true,cacheSeconds:90,staleWhileRevalidateSeconds:900},
    providerPolicy:{binance:'rights_blocked_or_unverified',coinbase:'rights_blocked_or_unverified',ecb:'governed_reference_data'},
    researchLinks:[
      {id:'tradingview',label:'TradingView',url:'https://www.tradingview.com/',mode:'display_or_outbound',note:'External research/display boundary; evidence runtime does not consume widget values.'},
      {id:'coinmarketcap',label:'CoinMarketCap',url:'https://coinmarketcap.com/',mode:'outbound',note:'Research link only in evidence runtime.'},
      {id:'coinpaprika',label:'CoinPaprika',url:'https://coinpaprika.com/',mode:'outbound',note:'Research link only in evidence runtime.'},
      {id:'defillama',label:'DefiLlama',url:'https://defillama.com/',mode:'outbound',note:'Research link only in evidence runtime.'},
      {id:'coinglass',label:'CoinGlass',url:'https://www.coinglass.com/',mode:'outbound',note:'Research link only in evidence runtime.'},
      {id:'hypurrscan',label:'Hypurrscan',url:'https://hypurrscan.io/',mode:'outbound',note:'Research link only in evidence runtime.'},
      {id:'x',label:'X / market community',url:'https://x.com/',mode:'outbound',note:'Research link only in evidence runtime.'},
      {id:'forex-factory',label:'Forex Factory',url:'https://www.forexfactory.com/calendar',mode:'outbound',note:'Research link only in evidence runtime.'},
      {id:'ecb',label:'European Central Bank',url:'https://www.ecb.europa.eu/',mode:'outbound',note:'Official source link.'},
      {id:'world-bank',label:'World Bank Data',url:'https://data.worldbank.org/',mode:'outbound',note:'Official source link.'}
    ],
    evidenceBoundary:'deterministic-empty-contract-no-market-observations'
  };
}

function evidenceEcb(){
  return {provider:'ecb',sourceIdentifier:'EUR',truthState:'unavailable',observationTime:null,ingestionTime:FIXED_TIME,freshness:'unavailable',quality:'evidence-network-isolated',confidence:0,attribution:'European Central Bank',license:null,fallbackReason:'evidence_runtime_external_network_isolated',termsState:'conditionally_approved_attributed_reference_data',cache:{hit:false,stale:false},data:null};
}

function evidenceLiveCatalog(){
  return {
    chartRuntime:'external-display-separated-from-governed-data',externalDisplay:{provider:'TradingView',usage:'display-only',url:'https://www.tradingview.com/',consumedByAnalytics:false},
    governedReferenceData:{provider:'ecb',name:'European Central Bank reference rates',enabled:true,cadence:'daily-working-day-reference',termsState:'conditionally_approved_attributed_reference_data'},
    liveModeEnabled:false,
    providers:[
      {id:'binance',name:'Binance Public Market Data',transport:['REST','WebSocket'],symbols:['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT'],intervals:['1m','5m','15m','30m','1h','4h','1d'],enabled:false,realtime:false,realtimeAuthorized:false,termsState:'blocked_pending_redistribution_rights',reason:'provider_redistribution_rights_not_verified'},
      {id:'coinbase',name:'Coinbase Exchange Market Data',transport:['REST'],symbols:['BTC-USD','ETH-USD','SOL-USD','XRP-USD','ADA-USD'],intervals:['1m','5m','15m','1h','6h','1d'],enabled:false,realtime:false,realtimeAuthorized:false,termsState:'blocked_pending_written_end_user_display_permission',reason:'provider_end_user_display_rights_not_verified'}
    ],
    guardrails:{publicMarketDataOnly:true,privateAccountEndpoints:false,trading:false,transfers:false,withdrawals:false,credentialsRequired:false,blockedProvidersNeverPresentedAsLive:true,fabricatedFallback:false}
  };
}

function evidenceLiveUnavailable(url){
  const provider=url.searchParams.get('provider')||'binance';
  const symbol=url.searchParams.get('symbol')||(provider==='coinbase'?'BTC-USD':'BTCUSDT');
  const interval=url.searchParams.get('interval')||'1m';
  return {provider,requestedProvider:provider,symbol,interval,points:[],summary:{last:null,change:null,changePercent:null,high:null,low:null,volume:null},source:{name:provider==='coinbase'?'Coinbase Exchange Market Data':'Binance Public Market Data',providerId:provider,attribution:null,mode:'unavailable',observedAt:null,fallbackReason:'evidence_runtime_has_no_rights_authorized_crypto_feed',termsState:provider==='coinbase'?'blocked_pending_written_end_user_display_permission':'blocked_pending_redistribution_rights',realtimeAuthorized:false},correlationId:'evidence-market-contract',guardrails:{readOnly:true,publicMarketDataOnly:true,executionDisabled:true,live:false,fabricatedObservations:false}};
}

function hasEvidenceSession(request){return request.headers['x-qelly-session-id']===EVIDENCE_SESSION_ID;}
function sessionRequired(response,message){return sendJson(response,401,{error:{code:'session_required',message}});}

async function serveProductionFile(request,response,url){
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/'||pathname==='/index.html')pathname='/index.html';
  let target=path.resolve(productionFrontend,`.${pathname}`);
  if(!target.startsWith(`${productionFrontend}${path.sep}`)&&target!==path.join(productionFrontend,'index.html'))return false;
  try{
    const info=await stat(target);
    if(!info.isFile())throw new Error('not-file');
  }catch{
    if(pathname.startsWith('/api/'))return false;
    target=path.join(productionFrontend,'index.html');
  }
  const body=await readFile(target);
  response.writeHead(200,{'Content-Type':MIME[path.extname(target).toLowerCase()]||'application/octet-stream','Content-Length':body.length,'Cache-Control':target.endsWith('index.html')?'no-store':'public, max-age=60','X-Qelly-Evidence-Artifact':'dist/frontend'});
  response.end(body);
  return true;
}

function proxyToLegacy(request,response,upstreamPort){
  const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:request.url,method:request.method,headers:request.headers},(upstreamResponse)=>{response.writeHead(upstreamResponse.statusCode??502,upstreamResponse.headers);upstreamResponse.pipe(response);});
  upstream.on('error',(error)=>{if(!response.headersSent)sendJson(response,502,{error:{code:'evidence_upstream_failed',message:error.message}});else response.destroy(error);});
  request.pipe(upstream);
}

export async function startServer(options={}){
  await stat(path.join(productionFrontend,'index.html')).catch(()=>{throw new Error('Production evidence artifact missing: run npm run build:frontend before browser capture.');});
  const legacy=await startLegacyServer({...options,port:0});
  const host=options.host??'127.0.0.1';
  const server=http.createServer(async(request,response)=>{
    const url=new URL(request.url,`http://${request.headers.host??'127.0.0.1'}`);
    if(request.method==='GET'&&url.pathname==='/api/v1/platform/capabilities')return sendJson(response,200,capabilityInventory());
    if(request.method==='GET'&&url.pathname==='/api/v1/providers/status')return sendJson(response,200,{providers:providerPolicies(),releaseSha:'evidence-fixture'});
    if(request.method==='GET'&&url.pathname==='/api/v1/providers/ecb')return sendJson(response,200,evidenceEcb());
    if(request.method==='GET'&&url.pathname==='/api/v1/public/markets/overview')return sendJson(response,200,evidencePublicMarketOverview());
    if(request.method==='GET'&&url.pathname==='/api/v1/market/network')return sendJson(response,200,evidenceMarketNetwork());
    if(request.method==='GET'&&url.pathname==='/api/v1/discovery/dex')return sendJson(response,200,{...buildPublicDexDiscovery(providerDirectory()),releaseSha:'evidence-fixture'});
    if(request.method==='GET'&&url.pathname==='/api/v1/discovery/global-charts')return sendJson(response,200,{...buildPublicGlobalCharts(providerDirectory()),releaseSha:'evidence-fixture'});
    if(request.method==='GET'&&url.pathname==='/api/v1/discovery/converter')return sendJson(response,200,{...buildPublicConverter(evidenceEcb()),releaseSha:'evidence-fixture'});
    if(request.method==='GET'&&url.pathname==='/api/v1/discovery/asset-intelligence')return sendJson(response,200,{...buildPublicAssetIntelligence(evidenceMarketNetwork().sources,url.searchParams.get('asset')||'QI-CRYPTO-BTC'),releaseSha:'evidence-fixture'});
    if(request.method==='GET'&&url.pathname==='/api/v1/discovery/advanced-chart')return sendJson(response,200,{...buildPublicAdvancedChart(evidenceMarketNetwork().sources,url.searchParams.get('asset')||'QI-CRYPTO-BTC',Object.fromEntries(url.searchParams)),releaseSha:'evidence-fixture'});
    if(request.method==='GET'&&url.pathname==='/api/v1/discovery/fundamentals-estimates')return sendJson(response,200,{...buildPublicFundamentalsEstimates(url.searchParams.get('issuer')||'QI-EQUITY-AAPL',Object.fromEntries(url.searchParams)),releaseSha:'evidence-fixture'});
    if(request.method==='GET'&&url.pathname==='/api/v1/auth/status')return sendJson(response,200,{authenticated:hasEvidenceSession(request),mode:'evidence-fixture'});
    if(request.method==='GET'&&url.pathname==='/api/v1/profile'){
      if(!hasEvidenceSession(request))return sessionRequired(response,'The evidence profile contract requires an authenticated fixture session.');
      return sendJson(response,200,evidenceProfile());
    }
    if(request.method==='GET'&&url.pathname==='/api/v1/platform/data-plane'){
      if(!hasEvidenceSession(request))return sessionRequired(response,'The evidence data-plane contract requires an authenticated fixture session.');
      return sendJson(response,200,evidenceDataPlane());
    }
    if(request.method==='GET'&&url.pathname==='/api/v1/live-markets/catalog'){
      if(!hasEvidenceSession(request))return sessionRequired(response,'The evidence live-market contract requires an authenticated fixture session.');
      return sendJson(response,200,evidenceLiveCatalog());
    }
    if(request.method==='GET'&&['/api/v1/live-markets/status','/api/v1/live-markets/asset','/api/v1/live-markets/candles','/api/v1/live-markets/ticker'].includes(url.pathname)){
      if(!hasEvidenceSession(request))return sessionRequired(response,'The evidence live-market contract requires an authenticated fixture session.');
      const unavailable=evidenceLiveUnavailable(url);
      if(url.pathname.endsWith('/ticker'))delete unavailable.points;
      return sendJson(response,200,unavailable);
    }
    if(!url.pathname.startsWith('/api/')){
      try{if(await serveProductionFile(request,response,url))return;}catch(error){return sendJson(response,500,{error:{code:'evidence_static_failed',message:error.message}});}
    }
    return proxyToLegacy(request,response,legacy.port);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port??0,host,resolve);});
  return {server,host,port:server.address().port,runtime:legacy.runtime,evidenceUpstream:legacy,staticRoot:productionFrontend};
}

export const __evidenceServerTest=Object.freeze({providerPolicies,evidencePublicMarketOverview,evidenceMarketNetwork,evidenceEcb,evidenceLiveCatalog,evidenceLiveUnavailable,productionFrontend});
