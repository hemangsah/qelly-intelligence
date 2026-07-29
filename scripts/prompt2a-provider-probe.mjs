import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const out=path.join(process.cwd(),'.prompt2a-final','07-apis-providers');await mkdir(out,{recursive:true});
const checks=[
 {id:'binance-public',url:'https://data-api.binance.vision/api/v3/ping',schema:x=>x&&typeof x==='object'},
 {id:'coindcx-public',url:'https://public.coindcx.com/market_data/trade_history?pair=B-BTC_USDT&limit=1',schema:x=>Array.isArray(x)||typeof x==='object'},
 {id:'coingecko',url:'https://api.coingecko.com/api/v3/ping',schema:x=>typeof x?.gecko_says==='string'},
 {id:'coinbase-exchange',url:'https://api.exchange.coinbase.com/products/BTC-USD/ticker',schema:x=>x&&('price'in x||'message'in x)},
 {id:'kraken-public',url:'https://api.kraken.com/0/public/Time',schema:x=>Array.isArray(x?.error)&&x?.result},
 {id:'openfigi',url:'https://api.openfigi.com/v3/mapping',method:'POST',body:[{idType:'TICKER',idValue:'IBM',exchCode:'US'}],schema:x=>Array.isArray(x)},
 {id:'sec-edgar',url:'https://data.sec.gov/submissions/CIK0000320193.json',headers:{'User-Agent':'Qelly Intelligence audit hemangsah.dn@gmail.com'},schema:x=>x&&x.cik&&x.filings},
 {id:'world-bank',url:'https://api.worldbank.org/v2/country/IN/indicator/NY.GDP.MKTP.CD?format=json&date=2023',schema:x=>Array.isArray(x)},
 {id:'frankfurter',url:'https://api.frankfurter.dev/v2/rate/USD/EUR',schema:x=>x&&('rate'in x||Array.isArray(x))},
 {id:'gdelt',url:'https://api.gdeltproject.org/api/v2/doc/doc?query=markets&mode=artlist&maxrecords=1&format=json',schema:x=>x&&typeof x==='object'},
 {id:'polymarket',url:'https://gamma-api.polymarket.com/markets?limit=1',schema:x=>Array.isArray(x)}
];
const results=[];
for(const c of checks){const started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(c.url,{method:c.method||'GET',headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'Qelly-Prompt2A-Audit/1.0',...(c.headers||{})},body:c.body?JSON.stringify(c.body):undefined,signal:controller.signal,redirect:'follow'});const text=await response.text();let json=null;try{json=JSON.parse(text);}catch{}const schemaPassed=Boolean(json&&c.schema(json));results.push({providerId:c.id,url:c.url,httpStatus:response.status,ok:response.ok,contentType:response.headers.get('content-type'),elapsedMs:Date.now()-started,schemaPassed,sample:text.slice(0,240),classification:response.ok&&schemaPassed?'VIABLE_PUBLIC_ENDPOINT':'FAILED_OR_SCHEMA_MISMATCH'});}catch(e){results.push({providerId:c.id,url:c.url,httpStatus:null,ok:false,elapsedMs:Date.now()-started,schemaPassed:false,error:e.name+': '+e.message,classification:'UNAVAILABLE_AT_AUDIT_TIME'});}finally{clearTimeout(timer);}}
const report={schemaVersion:1,generatedAt:new Date().toISOString(),head:process.env.QELLY_AUDIT_HEAD||'local',note:'Endpoint viability is not licensing, redistribution, production-readiness or connectivity evidence.',results};
await writeFile(path.join(out,'PUBLIC_API_LIVE_PROBE.json'),JSON.stringify(report,null,2)+'\n');
const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
await writeFile(path.join(out,'PUBLIC_API_LIVE_PROBE.csv'),['provider_id,url,http_status,ok,content_type,elapsed_ms,schema_passed,classification,error',...results.map(r=>[r.providerId,r.url,r.httpStatus,r.ok,r.contentType,r.elapsedMs,r.schemaPassed,r.classification,r.error].map(esc).join(','))].join('\n')+'\n');
console.log(JSON.stringify(report,null,2));
