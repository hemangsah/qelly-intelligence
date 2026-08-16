import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ECB_URL="https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const CACHE_KEY="reference-rates:daily";
const PROVIDER_KEY="ecb";
const INTERNAL_KEY_SHA256="017a6898218742214c9f54f5ecc54847ad95b17f6ba169c5f6ce7938b3856fd5";
const headers={"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const asIsoDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)?`${date}T00:00:00.000Z`:null;
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const digest=async(value:string)=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
const same=(a:string,b:string)=>{if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;};

function parseEcb(xml:string){
  const block=xml.match(/<Cube\s+time=['\"]([^'\"]+)['\"]>([\s\S]*?)<\/Cube>/i);
  if(!block)throw new Error("ECB observation date block missing");
  const observedAt=asIsoDate(block[1]);
  if(!observedAt)throw new Error("ECB observation date invalid");
  const rates:Record<string,number>={};
  const re=/<Cube\s+currency=['\"]([A-Z]{3})['\"]\s+rate=['\"]([0-9.]+)['\"]\s*\/?\s*>/gi;
  for(const match of block[2].matchAll(re)){
    const value=Number(match[2]);
    if(Number.isFinite(value)&&value>0)rates[match[1]]=value;
  }
  if(Object.keys(rates).length<10)throw new Error("ECB rate payload failed schema threshold");
  return {date:block[1],observedAt,rates};
}

Deno.serve(async(req)=>{
  if(req.method!=="POST")return reply(405,{ok:false,error:"METHOD_NOT_ALLOWED"});
  const url=Deno.env.get("SUPABASE_URL");
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!serviceKey)return reply(503,{ok:false,error:"SERVICE_CONFIGURATION_MISSING"});

  const internalKey=req.headers.get("x-qelly-ingestion-key")||"";
  const internalAuthorized=internalKey.length>=40&&same(await digest(internalKey),INTERNAL_KEY_SHA256);
  if(!internalAuthorized)return reply(401,{ok:false,error:"INTERNAL_INGESTION_AUTH_REQUIRED"});
  const actor="scheduler";
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

  const {data:provider,error:providerError}=await admin.from("qelly_providers")
    .select("id,provider_key,display_name,lifecycle_status,commercial_rights_status,redistribution_rights_status,attribution")
    .eq("provider_key",PROVIDER_KEY).single();
  if(providerError||!provider)return reply(503,{ok:false,error:"PROVIDER_REGISTRY_UNAVAILABLE"});
  if(provider.lifecycle_status!=="active"||provider.commercial_rights_status!=="allowed"||provider.redistribution_rights_status!=="allowed"){
    return reply(409,{ok:false,error:"PROVIDER_RIGHTS_NOT_ESTABLISHED",provider:PROVIDER_KEY});
  }

  const now=new Date();
  const {data:cached}=await admin.from("qelly_provider_cache")
    .select("observation_time,ingestion_time,expires_at,payload,truth_state")
    .eq("provider_id",PROVIDER_KEY).eq("cache_key",CACHE_KEY).maybeSingle();
  if(cached?.expires_at&&new Date(cached.expires_at).getTime()>now.getTime()){
    return reply(200,{ok:true,provider:PROVIDER_KEY,reused:true,truthState:cached.truth_state,observationTime:cached.observation_time,ingestionTime:cached.ingestion_time,count:Object.keys(cached.payload?.rates||{}).length,actor});
  }

  let parsed:{date:string;observedAt:string;rates:Record<string,number>};
  try{
    const upstream=await fetch(ECB_URL,{headers:{accept:"application/xml,text/xml;q=0.9"},signal:AbortSignal.timeout(8000)});
    if(!upstream.ok)throw new Error(`ECB HTTP ${upstream.status}`);
    parsed=parseEcb(await upstream.text());
  }catch(error){
    await admin.from("qelly_data_quality_events").insert({provider_id:provider.id,event_type:"error",severity:"material",truth_state:"error",details:{source:ECB_URL,error:String((error as Error)?.message||error),stage:"provider-ingestion",actor}});
    return reply(502,{ok:false,error:"UPSTREAM_PROVIDER_FAILURE",provider:PROVIDER_KEY});
  }

  const ingestedAt=new Date().toISOString();
  let persisted=0;
  for(const [quote,rate] of Object.entries(parsed.rates)){
    const canonicalKey=`fx:eur:${quote.toLowerCase()}`;
    const symbol=`EUR${quote}`;
    const {data:instrument,error:instrumentError}=await admin.from("qelly_instruments").upsert({
      canonical_key:canonicalKey,symbol,display_name:`Euro / ${quote}`,asset_class:"fx",venue:"ECB",currency:quote,base_asset:"EUR",quote_asset:quote,
      identifiers:{provider:PROVIDER_KEY,provider_symbol:`EUR/${quote}`},metadata:{source:"ECB euro foreign exchange reference rates",cadence:"daily",reference_base:"EUR"},active:true,updated_at:ingestedAt
    },{onConflict:"canonical_key"}).select("id").single();
    if(instrumentError||!instrument)throw new Error(`instrument upsert failed: ${symbol}`);

    const {data:mapping}=await admin.from("qelly_provider_instrument_mappings").select("id").eq("provider_id",provider.id).eq("instrument_id",instrument.id).maybeSingle();
    const mappingBody={provider_id:provider.id,instrument_id:instrument.id,provider_symbol:`EUR/${quote}`,provider_venue:"ECB reference rates",provider_identifier:{base:"EUR",quote},mapping_status:"verified",mapping_evidence:{source:ECB_URL,observation_date:parsed.date},verified_at:ingestedAt,updated_at:ingestedAt};
    if(mapping?.id)await admin.from("qelly_provider_instrument_mappings").update(mappingBody).eq("id",mapping.id);else await admin.from("qelly_provider_instrument_mappings").insert(mappingBody);

    const seriesKey=`ecb:fx:${symbol.toLowerCase()}:reference_rate:1d`;
    const {data:series,error:seriesError}=await admin.from("qelly_timeseries_series").upsert({
      series_key:seriesKey,provider_id:provider.id,instrument_id:instrument.id,metric:"reference_rate",interval_code:"1d",unit:`${quote}_per_EUR`,currency:quote,
      methodology:"ECB euro foreign exchange reference rate; one unit of EUR expressed in quote currency",source_timezone:"Europe/Frankfurt",
      freshness_policy:{cadence:"business-day",expected_delay:"daily-reference",stale_after_hours:96},lineage:{provider:PROVIDER_KEY,source:ECB_URL,attribution:provider.attribution},active:true,updated_at:ingestedAt
    },{onConflict:"series_key"}).select("id").single();
    if(seriesError||!series)throw new Error(`series upsert failed: ${symbol}`);

    const {error:pointError}=await admin.from("qelly_timeseries_points").upsert({
      series_id:series.id,observed_at:parsed.observedAt,ingested_at:ingestedAt,value_numeric:rate,truth_state:"delayed",source_revision:parsed.date,
      evidence:{provider:PROVIDER_KEY,source:ECB_URL,observation_date:parsed.date,attribution:provider.attribution,rights:{commercial:provider.commercial_rights_status,redistribution:provider.redistribution_rights_status}}
    },{onConflict:"series_id,observed_at"});
    if(pointError)throw new Error(`point upsert failed: ${symbol}`);
    persisted++;
  }

  const expiresAt=new Date(now.getTime()+36*60*60*1000).toISOString();
  const staleUntil=new Date(now.getTime()+7*24*60*60*1000).toISOString();
  const {error:cacheError}=await admin.from("qelly_provider_cache").upsert({
    provider_id:PROVIDER_KEY,cache_key:CACHE_KEY,payload:{base:"EUR",date:parsed.date,rates:parsed.rates,source:ECB_URL},truth_state:"delayed_provider",observation_time:parsed.observedAt,ingestion_time:ingestedAt,expires_at:expiresAt,stale_until:staleUntil,attribution:provider.attribution,
    license:"provider-registry:commercial_allowed+redistribution_allowed",updated_at:ingestedAt
  },{onConflict:"provider_id,cache_key"});
  if(cacheError)throw new Error("provider cache upsert failed");

  return reply(200,{ok:true,provider:PROVIDER_KEY,reused:false,truthState:"DELAYED",observationTime:parsed.observedAt,ingestionTime:ingestedAt,count:persisted,source:"ECB euro foreign exchange reference rates",actor});
});
