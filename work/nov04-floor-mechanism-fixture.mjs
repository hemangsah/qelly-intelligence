// Existing governed Decision engine fixture adapter; exact checkout engine imports, synthetic GET responses only.
import {pathToFileURL} from 'node:url';
const {buildDecisionIntelligence}=await import(pathToFileURL(process.cwd()+'/functions/api/v1/decision-proven-graph.js'));
export const {decisionAssetCapabilities}=await import(pathToFileURL(process.cwd()+'/functions/_lib/decision-asset-capabilities.js'));
const {onRequest:newsContextRequest}=await import(pathToFileURL(process.cwd()+'/functions/api/v1/decision-news-context.js'));

const FIXTURE_INTERVAL_MS=Object.freeze({'1m':60_000,'3m':180_000,'5m':300_000,'15m':900_000,'30m':1_800_000,'1h':3_600_000,'2h':7_200_000,'4h':14_400_000,'8h':28_800_000,'12h':43_200_000,'1d':86_400_000});
const FIXTURE_ASSETS=Object.freeze(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const FIXTURE_BASE=Object.freeze({BTC:84_000,ETH:3_100,SOL:145,HYPE:42,XRP:2.6,DOGE:.22});
const fixtureNow=Date.now()-1_000;
const fixtureReferenceDate=new Date(fixtureNow).toISOString().slice(0,10);
const fixtureCandlesFor=(asset='BTC',interval='15m',endTime=fixtureNow,points=500)=>{
  const symbol=FIXTURE_ASSETS.includes(String(asset).toUpperCase())?String(asset).toUpperCase():'BTC';
  const step=FIXTURE_INTERVAL_MS[interval]||FIXTURE_INTERVAL_MS['15m'];
  const count=Math.max(180,Math.min(500,Number(points)||500));
  const base=FIXTURE_BASE[symbol]||100;
  return Array.from({length:count},(_,index)=>{
    const drift=(index-count*.55)*.0007;
    const wave=Math.sin(index/7)*.012+Math.sin(index/19)*.008;
    const close=base*(1+drift+wave);
    const open=close*(1-Math.sin(index/5)*.0018);
    const high=Math.max(open,close)*(1.0045+Math.abs(Math.sin(index/11))*.002);
    const low=Math.min(open,close)*(1-.0045-Math.abs(Math.cos(index/13))*.002);
    return {t:Number(endTime)-(count-1-index)*step,o:String(open),h:String(high),l:String(low),c:String(close),v:String(800+index*3),n:40+index};
  });
};
const fixtureProviderFetch=async(url,options={})=>{
  let target;
  try{target=new URL(String(url));}catch{return new Response(JSON.stringify({}),{status:400,headers:{'content-type':'application/json'}});}
  if(target.protocol==='https:'&&target.hostname==='www.ecb.europa.eu'&&target.pathname==='/stats/eurofxref/eurofxref-daily.xml')return new Response('<Cube time="'+fixtureReferenceDate+'"><Cube currency="USD" rate="1.1"/><Cube currency="INR" rate="90"/><Cube currency="GBP" rate="0.85"/><Cube currency="JPY" rate="160"/><Cube currency="CHF" rate="0.95"/></Cube>',{status:200,headers:{'content-type':'application/xml'}});
  if(target.protocol==='https:'&&target.hostname==='api.hyperliquid.xyz'){
    let body={};
    try{body=JSON.parse(options?.body||'{}');}catch{}
    if(body.type==='candleSnapshot'){
      const req=body.req||{},interval=String(req.interval||'15m'),endTime=Number(req.endTime)||fixtureNow,step=FIXTURE_INTERVAL_MS[interval]||FIXTURE_INTERVAL_MS['15m'];
      const requested=Math.ceil(Math.max(step,(endTime-(Number(req.startTime)||endTime-step*500)))/step);
      return new Response(JSON.stringify(fixtureCandlesFor(req.coin,interval,endTime,requested)),{status:200,headers:{'content-type':'application/json'}});
    }
    if(body.type==='metaAndAssetCtxs'){
      const universe=FIXTURE_ASSETS.map(name=>({name}));
      const contexts=FIXTURE_ASSETS.map((name,index)=>{
        const mark=FIXTURE_BASE[name]*(1+index*.001);
        return {funding:String(.00005+index*.00001),openInterest:String(900+index*120),markPx:String(mark),oraclePx:String(mark*.9995),dayNtlVlm:String(80_000_000+index*7_500_000),premium:String(.0001+index*.00002),prevDayPx:String(mark*.992)};
      });
      return new Response(JSON.stringify([{universe},contexts]),{status:200,headers:{'content-type':'application/json'}});
    }
    if(body.type==='l2Book'){
      const base=FIXTURE_BASE[String(body.coin||'BTC').toUpperCase()]||100;
      const bids=Array.from({length:20},(_,i)=>({px:String(base*(1-.0003*(i+1))),sz:String(3+i*.2),n:8+i}));
      const asks=Array.from({length:20},(_,i)=>({px:String(base*(1+.0003*(i+1))),sz:String(2.8+i*.18),n:7+i}));
      return new Response(JSON.stringify({time:fixtureNow,levels:[bids,asks]}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(body.type==='fundingHistory'){
      const start=Number(body.startTime)||fixtureNow-72*3_600_000,end=Number(body.endTime)||fixtureNow;
      const rows=Array.from({length:12},(_,i)=>({time:start+(end-start)*(i+1)/12,fundingRate:.00004+i*.000002,premium:.00008+i*.000003}));
      return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(target.protocol==='https:'&&target.hostname==='api.gdeltproject.org')return new Response(JSON.stringify({articles:[]}),{status:200,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}});
};
export const fixtureDecisionPayload=async(requestUrl)=>{
  const asset=String(requestUrl.searchParams.get('asset')||'BTC').toUpperCase();
  const interval=requestUrl.searchParams.get('interval')||'15m';
  const horizon=requestUrl.searchParams.get('horizon')||'4h';
  const requestedRr=requestUrl.searchParams.get('rr')||'auto';
  const customRr=requestUrl.searchParams.get('customRr');
  const nextBars=requestUrl.searchParams.get('nextBars');
  const selection=requestUrl.searchParams.has('selectionStart')||requestUrl.searchParams.has('selectionEnd')
    ?{start:Number(requestUrl.searchParams.get('selectionStart')),end:Number(requestUrl.searchParams.get('selectionEnd'))}
    :null;
  return buildDecisionIntelligence({__fetch:fixtureProviderFetch},{asset,interval,horizon,requestedRr,customRr,nextBars,selection,now:fixtureNow});
};

export const fixtureNewsResponse=requestUrl=>newsContextRequest({request:new Request(String(requestUrl)),env:{__fetch:fixtureProviderFetch}});

