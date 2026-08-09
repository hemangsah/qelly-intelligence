import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SOURCE_REVISION="qelly-supabase-workspace-api-2026-08-08-v3";
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const fail=(status:number,code:string,message:string,details:unknown=null)=>response({status:"error",code,message,details,apiRevision:SOURCE_REVISION},status);
const text=(v:unknown,max=240)=>String(v??"").slice(0,max);
const maxLimit=(v:unknown)=>Math.min(100,Math.max(1,Number.isFinite(Number(v))?Math.trunc(Number(v)):50));

type ResourceSpec={table:string;write:boolean;fields:string[];owner?:boolean;workspace?:boolean};
const RESOURCES:Record<string,ResourceSpec>={
 research_projects:{table:"qelly_research_projects",write:true,owner:true,workspace:true,fields:["title","status","hypothesis","confidence","invalidation_conditions","metadata","deleted_at"]},
 research_evidence:{table:"qelly_research_evidence",write:true,owner:true,workspace:true,fields:["project_id","evidence_role","title","source_type","source_ref","source_url","observed_at","freshness","confidence","coverage","method","assumptions","contradictions","limitations","evidence_version","payload"]},
 research_project_revisions:{table:"qelly_research_project_revisions",write:false,workspace:true,fields:[]},
 decisions:{table:"qelly_decisions",write:true,owner:true,workspace:true,fields:["title","status","objective","alternatives","evidence_summary","assumptions","probabilities","risks","scenarios","counter_evidence","rationale","review_conditions","outcome","learning","confidence","deleted_at"]},
 decision_revisions:{table:"qelly_decision_revisions",write:false,workspace:true,fields:[]},
 provenance_nodes:{table:"qelly_provenance_nodes",write:true,owner:true,workspace:true,fields:["decision_id","node_type","label","truth_state","evidence","payload"]},
 provenance_edges:{table:"qelly_provenance_edges",write:true,owner:true,workspace:true,fields:["from_node_id","to_node_id","edge_type","metadata"]},
 verify_assessments:{table:"qelly_verify_assessments",write:true,owner:true,workspace:true,fields:["title","source_name","source_fingerprint","source_normalized_bytes","source_revision","methodology_version","engine_version","report_schema","truth_state","report_payload","report_hash","deleted_at"]},
 verify_assessment_revisions:{table:"qelly_verify_assessment_revisions",write:false,workspace:true,fields:[]},
 watchlists:{table:"qelly_watchlists",write:true,owner:true,workspace:true,fields:["name","description","settings","deleted_at"]},
 watchlist_items:{table:"qelly_watchlist_items",write:true,owner:true,workspace:true,fields:["watchlist_id","instrument_ref","instrument_type","notes","tags","rationale","metadata"]},
 portfolios:{table:"qelly_portfolios",write:true,owner:true,workspace:true,fields:["name","base_currency","source_kind","metadata","deleted_at"]},
 portfolio_positions:{table:"qelly_portfolio_positions",write:true,owner:true,workspace:true,fields:["portfolio_id","instrument_ref","instrument_type","source_kind","input_payload","provenance","observed_at"]},
 import_jobs:{table:"qelly_import_jobs",write:true,owner:true,workspace:true,fields:["file_name","import_type","status","source_kind","schema_mapping","validation_summary","provenance","completed_at"]},
 saved_views:{table:"qelly_saved_views",write:true,owner:true,workspace:true,fields:["name","route_id","view_type","query_definition","columns","sort_definition","density","shared","deleted_at"]},
 comments:{table:"qelly_workspace_comments",write:true,owner:true,workspace:true,fields:["entity_type","entity_id","parent_comment_id","body","evidence_refs","status"]},
 review_requests:{table:"qelly_review_requests",write:true,owner:true,workspace:true,fields:["entity_type","entity_id","requested_from","status","note","response_note","closed_at"]},
 dashboard_layouts:{table:"qelly_dashboard_layouts",write:true,owner:true,workspace:true,fields:["name","route_scope","persona","density","layout_definition","shared","deleted_at"]},
 dashboard_layout_revisions:{table:"qelly_dashboard_layout_revisions",write:false,workspace:true,fields:[]},
 alert_rules:{table:"qelly_alert_rules",write:true,owner:true,workspace:true,fields:["name","alert_type","target_type","target_ref","condition","delivery_preferences","evidence_requirement","deleted_at"]},
 alert_events:{table:"qelly_alert_events",write:false,workspace:true,fields:[]},
 notification_deliveries:{table:"qelly_notification_deliveries",write:false,workspace:true,fields:[]},
 audit_events:{table:"qelly_audit_events",write:false,workspace:true,fields:[]}
};
function specFor(resource:unknown){const key=text(resource,80);const spec=RESOURCES[key];if(!spec)throw Object.assign(new Error("Unknown resource"),{status:404,code:"resource_not_found"});return {key,spec};}
function sanitizeData(input:any,spec:ResourceSpec){if(!input||typeof input!=="object"||Array.isArray(input))throw Object.assign(new Error("data must be an object"),{status:400,code:"invalid_data"});const out:Record<string,unknown>={};for(const [key,value] of Object.entries(input)){if(!spec.fields.includes(key))throw Object.assign(new Error(`Field is not writable: ${key}`),{status:400,code:"field_not_writable"});out[key]=value;}return out;}
function safeCaughtFailure(error:any){const code=typeof error?.code==="string"?error.code:"workspace_api_error";if(code==="resource_not_found")return fail(404,code,"Unknown workspace resource");if(code==="invalid_data")return fail(400,code,"data must be an object");if(code==="field_not_writable")return fail(400,code,"Request contains a non-writable field");return fail(500,"workspace_api_error","Workspace API request failed safely");}

Deno.serve(async(req:Request)=>{
 try{
  const authorization=req.headers.get("authorization");if(!authorization)return fail(401,"authorization_required","Authorization header is required");
  const urlBase=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY");if(!urlBase||!anon)return fail(503,"runtime_configuration_missing","Supabase runtime configuration is unavailable");
  const client=createClient(urlBase,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await client.auth.getUser();const user=userData?.user;if(userError||!user)return fail(401,"invalid_identity","Authenticated Qelly identity is required");
  const url=new URL(req.url),resource=url.searchParams.get("resource")??undefined,{key,spec}=specFor(resource);
  if(req.method==="GET"){
    const workspaceId=url.searchParams.get("workspaceId"),id=url.searchParams.get("id"),limit=maxLimit(url.searchParams.get("limit"));
    if(spec.workspace&&!workspaceId)return fail(400,"workspace_required","workspaceId is required");
    let query=client.from(spec.table).select("*").limit(limit);
    if(spec.workspace)query=query.eq("workspace_id",workspaceId!);
    if(id)query=query.eq("id",id).limit(1);
    const {data,error}=await query;if(error)return fail(400,"query_failed","Resource query failed safely",{resource:key,code:error.code});
    return response({status:"success",resource:key,items:data??[],count:(data??[]).length,apiRevision:SOURCE_REVISION});
  }
  if(!spec.write)return fail(405,"read_only_resource","This resource is read-only through the Qelly workspace API");
  let body:any={};if(req.method!=="DELETE"){try{body=await req.json();}catch{return fail(400,"invalid_json","Request body must be valid JSON");}}
  if(req.method==="POST"){
    const workspaceId=body?.workspaceId;if(spec.workspace&&typeof workspaceId!=="string")return fail(400,"workspace_required","workspaceId is required");
    const record=sanitizeData(body?.data??{},spec);if(spec.workspace)record.workspace_id=workspaceId;if(spec.owner)record.owner_id=user.id;
    const {data,error}=await client.from(spec.table).insert(record).select("*").single();if(error)return fail(400,"insert_failed","Resource insert failed safely",{resource:key,code:error.code});
    return response({status:"success",resource:key,item:data,apiRevision:SOURCE_REVISION},201);
  }
  if(req.method==="PATCH"){
    const id=body?.id;if(typeof id!=="string")return fail(400,"id_required","id is required");const patch=sanitizeData(body?.data??{},spec);if(Object.keys(patch).length===0)return fail(400,"empty_patch","At least one writable field is required");
    const {data,error}=await client.from(spec.table).update(patch).eq("id",id).select("*").single();if(error)return fail(400,"update_failed","Resource update failed safely",{resource:key,code:error.code});
    return response({status:"success",resource:key,item:data,apiRevision:SOURCE_REVISION});
  }
  if(req.method==="DELETE"){
    const id=url.searchParams.get("id");if(!id)return fail(400,"id_required","id query parameter is required");const {error}=await client.from(spec.table).delete().eq("id",id);if(error)return fail(400,"delete_failed","Resource deletion failed safely",{resource:key,code:error.code});return response({status:"success",resource:key,deleted:true,id,apiRevision:SOURCE_REVISION});
  }
  return fail(405,"method_not_allowed","Use GET, POST, PATCH or DELETE");
 }catch(error:any){return safeCaughtFailure(error);}
});
