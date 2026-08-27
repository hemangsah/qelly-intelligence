import "jsr:@supabase/functions-js@2.112.4/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const CANONICAL_SITE="https://qelly-intelligence.pages.dev";
const RELEASE_URL=`${CANONICAL_SITE}/qelly-release.json`;
const INTERNAL_KEY_SHA256="017a6898218742214c9f54f5ecc54847ad95b17f6ba169c5f6ce7938b3856fd5";
const headers={"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const digest=async(value:string)=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
const same=(a:string,b:string)=>{if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;};
const validSha=(value:unknown)=>/^[0-9a-f]{40}$/i.test(String(value||""));
const safeDate=(value:unknown)=>{const date=new Date(String(value||""));return Number.isNaN(date.getTime())?null:date.toISOString();};

Deno.serve(async(req)=>{
  if(req.method!=="POST")return reply(405,{ok:false,error:"METHOD_NOT_ALLOWED"});
  const internalKey=req.headers.get("x-qelly-scheduler-key")||"";
  if(internalKey.length<40||!same(await digest(internalKey),INTERNAL_KEY_SHA256))return reply(401,{ok:false,error:"INTERNAL_SCHEDULER_AUTH_REQUIRED"});

  const url=Deno.env.get("SUPABASE_URL");
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!serviceKey)return reply(503,{ok:false,error:"SERVICE_CONFIGURATION_MISSING"});
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

  let release:any;
  try{
    const releaseProbe=new URL(RELEASE_URL);
    releaseProbe.searchParams.set("verify",crypto.randomUUID());
    const response=await fetch(releaseProbe,{headers:{accept:"application/json","cache-control":"no-cache"},signal:AbortSignal.timeout(8000),cache:"no-store"});
    if(!response.ok)throw new Error(`Cloudflare release identity HTTP ${response.status}`);
    const type=(response.headers.get("content-type")||"").toLowerCase();
    if(type&&!type.includes("json"))throw new Error("Cloudflare release identity content type invalid");
    const text=await response.text();
    if(text.length>100000)throw new Error("Cloudflare release identity payload too large");
    release=JSON.parse(text);
  }catch(error){
    return reply(502,{ok:false,error:"CANONICAL_RELEASE_FETCH_FAILED",message:String((error as Error)?.message||error)});
  }

  if(!validSha(release?.releaseSha))return reply(409,{ok:false,error:"CANONICAL_RELEASE_SHA_INVALID"});
  if(release?.mode!=="cloudflare-pages-public-runtime")return reply(409,{ok:false,error:"CANONICAL_RELEASE_MODE_INVALID"});
  if(release?.publicSiteUrl!==CANONICAL_SITE)return reply(409,{ok:false,error:"CANONICAL_SITE_IDENTITY_MISMATCH"});
  if(release?.authentication!==true||release?.cloudSync!==true)return reply(409,{ok:false,error:"CANONICAL_RUNTIME_CAPABILITIES_INVALID"});

  const releasedAt=safeDate(release.deployedAt)||safeDate(release.buildTimestamp)||new Date().toISOString();
  const releaseKey=`cloudflare:${String(release.releaseSha).toLowerCase()}`;
  const metadata={
    workflowRun:release.workflowRun??null,
    deploymentId:release.deploymentId??null,
    buildTimestamp:safeDate(release.buildTimestamp),
    mode:release.mode,
    cloudMode:release.cloudMode??null,
    authentication:Boolean(release.authentication),
    emailDelivery:Boolean(release.emailDelivery),
    cloudSync:Boolean(release.cloudSync),
    liveProviders:Boolean(release.liveProviders),
    protectedWrites:Boolean(release.protectedWrites),
    publicSiteUrl:release.publicSiteUrl
  };
  const {data,error}=await admin.from("qelly_release_identity").upsert({
    environment:"production",
    release_key:releaseKey,
    source_revision:String(release.releaseSha).toLowerCase(),
    schema_version:"supabase-managed",
    frontend_version:"0.9.0-preview.1",
    backend_version:String(release.releaseSha).toLowerCase(),
    status:"recorded",
    metadata,
    released_at:releasedAt
  },{onConflict:"environment,release_key"}).select("environment,release_key,source_revision,status,released_at").single();
  if(error||!data)return reply(503,{ok:false,error:"RELEASE_IDENTITY_PERSIST_FAILED"});
  return reply(200,{ok:true,release:data,canonicalSite:CANONICAL_SITE});
});
