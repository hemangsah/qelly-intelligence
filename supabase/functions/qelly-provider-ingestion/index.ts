import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ECB_HISTORY_URL="https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
const CACHE_KEY="reference-rates:daily";
const PROVIDER_KEY="ecb";
const INTERNAL_KEY_SHA256="017a6898218742214c9f54f5ecc54847ad95b17f6ba169c5f6ce7938b3856fd5";
const headers={"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const digest=async(value:string)=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
const same=(a:string,b:string)=>{if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;};
const isoDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)?`${date}T00:00:00.000Z`:null;

function parseRates(block:string){
  const rates:Record<string,number>={};
  const re=/<Cube\s+currency=['\"]([A-Z]{3})['\"]\s+rate=['\"]([0-9.]+)['\"]\s*\/?\s*>/gi;
  for(const match of block.matchAll(re)){const value=Number(match[2]);if(Number.isFinite(value)&&value>0)rates[match[1]]=value;}
  return rates;
}
function parseHistory(xml:string){
  const days:Array<{date:string;observedAt:string;rates:Record<string,number>}>=[];
  const re=/<Cube\s+time=['\"](\d{4}-\d{2}-\d{2})['\"]>([\s\S]*?)<\/Cube>/gi;
  for(const match of xml.matchAll(re)){
    const observedAt=isoDate(match[1]);
    const rates=parseRates(match[2]);
    if(observedAt&&Object.keys(rates).length>=10)days.push({date:match[1],observedAt,rates});
  }
  days.sort((a,b)=>a.date.localeCompare(b.date));
  if(days.length<10)throw new Error("ECB 90-day history failed schema threshold");
  return days;
}

Deno.serve(async(req)=>{
  if(req.method!=="POST")return reply(405,{ok:false,error:"METHOD_NOT_ALLOWED"});
  const internalKey=req.headers.get("x-qelly-ingestion-key")||"";
  if(internalKey.length<40||!same(await digest(internalKey),INTERNAL_KEY_SHA256))return reply(401,{ok:false,error:"INTERNAL_INGESTION_AUTH_REQUIRED"});
  const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!serviceKey)return reply(503,{ok:false,error:"SERVICE_CONFIGURATION_MISSING"});
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

  const {data:provider,error:providerError}=await admin.from("qelly_providers").select("id,provider_key,display_name,lifecycle_status,commercial_rights_status,redistribution_rights_status,attribution").eq("provider_key",PROVIDER_KEY).single();
  if(providerError||!provider)return reply(503,{ok:false,error:"PROVIDER_REGISTRY_UNAVAILABLE"});
  if(provider.lifecycle_status!=="active"||provider.commercial_rights_status!=="allowed"||provider.redistribution_rights_status!=="allowed")return reply(409,{ok:false,error:"PROVIDER_RIGHTS_NOT_ESTABLISHED",provider:PROVIDER_KEY});

  const now=new Date();
  const {data:cached}=await admin.from("qelly_provider_cache").select("observation_time,ingestion_time,expires_at,payload,truth_state").eq("provider_id",PROVIDER_KEY).eq("cache_key",CACHE_KEY).maybeSingle();
  if(cached?.expires_at&&new Date(cached.expires_at).getTime()>now.getTime()&&cached.payload?.history90dBackfilled===true){
    return reply(200,{ok:true,provider:PROVIDER_KEY,reused:true,truthState:cached.truth_state,observationTime:cached.observation_time,ingestionTime:cached.ingestion_time,count:Object.keys(cached.payload?.rates||{}).length,historyDays:Number(cached.payload?.historyDays)||0,historyPointCount:Number(cached.payload?.historyPointCount)||0,actor:"scheduler"});
  }

  let history:Array<{date:string;observedAt:string;rates:Record<string,number>}>;
  try{
    const upstream=await fetch(ECB_HISTORY_URL,{headers:{accept:"application/xml,text/xml;q=0.9"},signal:AbortSignal.timeout(10000),cache:"no-store"});
    if(!upstream.ok)throw new Error(`ECB HTTP ${upstream.status}`);
    const text=await upstream.text();
    if(text.length>5000000)throw new Error("ECB history payload too large");
    history=parseHistory(text);
  }catch(error){
    await admin.from("qelly_data_quality_events").insert({provider_id:provider.id,event_type:"error",severity:"material",truth_state:"error",details:{source:ECB_HISTORY_URL,error:String((error as Error)?.message||error),stage:"provider-history-ingestion",actor:"scheduler"}});
    return reply(502,{ok:false,error:"UPSTREAM_PROVIDER_FAILURE",provider:PROVIDER_KEY});
  }

  const latest=history.at(-1)!;
  const currencies=Object.keys(latest.rates).sort();
  const ingestedAt=new Date().toISOString();
  const instrumentRows=currencies.map(quote=>({canonical_key:`fx:eur:${quote.toLowerCase()}`,symbol:`EUR${quote}`,display_name:`Euro / ${quote}`,asset_class:"fx",venue:"ECB",currency:quote,base_asset:"EUR",quote_asset:quote,identifiers:{provider:PROVIDER_KEY,provider_symbol:`EUR/${quote}`},metadata:{source:"ECB euro foreign exchange reference rates",cadence:"daily",reference_base:"EUR"},active:true,updated_at:ingestedAt}));
  const {data:instruments,error:instrumentError}=await admin.from("qelly_instruments").upsert(instrumentRows,{onConflict:"canonical_key"}).select("id,canonical_key,symbol,quote_asset");
  if(instrumentError||!instruments?.length)return reply(503,{ok:false,error:"INSTRUMENT_PERSIST_FAILED"});
  const instrumentByQuote=new Map(instruments.map((row:any)=>[String(row.quote_asset),row]));

  const {data:existingMappings}=await admin.from("qelly_provider_instrument_mappings").select("id,provider_symbol").eq("provider_id",provider.id);
  const mappingBySymbol=new Map((existingMappings||[]).map((row:any)=>[String(row.provider_symbol),row.id]));
  for(const quote of currencies){
    const instrument:any=instrumentByQuote.get(quote);if(!instrument)continue;
    const providerSymbol=`EUR/${quote}`;
    const body={provider_id:provider.id,instrument_id:instrument.id,provider_symbol:providerSymbol,provider_venue:"ECB reference rates",provider_identifier:{base:"EUR",quote},mapping_status:"verified",mapping_evidence:{source:ECB_HISTORY_URL,observation_date:latest.date,history_days:history.length},verified_at:ingestedAt,updated_at:ingestedAt};
    const existing=mappingBySymbol.get(providerSymbol);
    const operation=existing?admin.from("qelly_provider_instrument_mappings").update(body).eq("id",existing):admin.from("qelly_provider_instrument_mappings").insert(body);
    const {error}=await operation;if(error)return reply(503,{ok:false,error:"PROVIDER_MAPPING_PERSIST_FAILED",symbol:providerSymbol});
  }

  const seriesRows=currencies.map(quote=>{const instrument:any=instrumentByQuote.get(quote);return {series_key:`ecb:fx:eur${quote.toLowerCase()}:reference_rate:1d`,provider_id:provider.id,instrument_id:instrument.id,metric:"reference_rate",interval_code:"1d",unit:`${quote}_per_EUR`,currency:quote,methodology:"ECB euro foreign exchange reference rate; one unit of EUR expressed in quote currency",source_timezone:"Europe/Frankfurt",freshness_policy:{cadence:"business-day",expected_delay:"daily-reference",stale_after_hours:96},lineage:{provider:PROVIDER_KEY,source:ECB_HISTORY_URL,attribution:provider.attribution},active:true,updated_at:ingestedAt};});
  const {data:series,error:seriesError}=await admin.from("qelly_timeseries_series").upsert(seriesRows,{onConflict:"series_key"}).select("id,series_key,currency");
  if(seriesError||!series?.length)return reply(503,{ok:false,error:"SERIES_PERSIST_FAILED"});
  const seriesByQuote=new Map(series.map((row:any)=>[String(row.currency),row]));

  const points:any[]=[];
  for(const day of history){for(const [quote,rate] of Object.entries(day.rates)){const seriesRow:any=seriesByQuote.get(quote);if(!seriesRow)continue;points.push({series_id:seriesRow.id,observed_at:day.observedAt,ingested_at:ingestedAt,value_numeric:rate,truth_state:"delayed",source_revision:day.date,evidence:{provider:PROVIDER_KEY,source:ECB_HISTORY_URL,observation_date:day.date,attribution:provider.attribution,rights:{commercial:provider.commercial_rights_status,redistribution:provider.redistribution_rights_status},reference_only:true}});}}
  for(let index=0;index<points.length;index+=500){const {error}=await admin.from("qelly_timeseries_points").upsert(points.slice(index,index+500),{onConflict:"series_id,observed_at"});if(error)return reply(503,{ok:false,error:"TIMESERIES_POINT_PERSIST_FAILED",offset:index});}

  const expiresAt=new Date(now.getTime()+36*60*60*1000).toISOString(),staleUntil=new Date(now.getTime()+7*24*60*60*1000).toISOString();
  const {error:cacheError}=await admin.from("qelly_provider_cache").upsert({provider_id:PROVIDER_KEY,cache_key:CACHE_KEY,payload:{base:"EUR",date:latest.date,rates:latest.rates,source:ECB_HISTORY_URL,history90dBackfilled:true,historyDays:history.length,historyPointCount:points.length},truth_state:"delayed_provider",observation_time:latest.observedAt,ingestion_time:ingestedAt,expires_at:expiresAt,stale_until:staleUntil,attribution:provider.attribution,license:"provider-registry:commercial_allowed+redistribution_allowed",updated_at:ingestedAt},{onConflict:"provider_id,cache_key"});
  if(cacheError)return reply(503,{ok:false,error:"PROVIDER_CACHE_PERSIST_FAILED"});

  return reply(200,{ok:true,provider:PROVIDER_KEY,reused:false,truthState:"DELAYED",observationTime:latest.observedAt,ingestionTime:ingestedAt,count:currencies.length,historyDays:history.length,historyPointCount:points.length,source:"ECB euro foreign exchange reference rates · 90-day history",actor:"scheduler"});
});
