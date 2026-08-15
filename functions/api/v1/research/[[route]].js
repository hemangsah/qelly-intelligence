import {
  HttpError,
  UUID,
  bootstrapContext,
  cleanText,
  correlationId,
  enforceRateLimit,
  errorResponse,
  jsonBody,
  requireCsrf,
  requireOrigin,
  resolveSession,
  responseJson,
  restRequest
} from '../../../_lib/runtime.js';

const routePath=(context)=>{
  const value=context.params?.route;
  const raw=(Array.isArray(value)?value.join('/'):String(value||'')).replace(/^\/+|\/+$/g,'');
  if(raw==='workspaces')return '';
  if(raw.startsWith('workspaces/'))return raw.slice('workspaces/'.length);
  return raw;
};
const safeArray=(value,max=20)=>Array.isArray(value)?value.slice(0,max):[];
const cleanTags=(value)=>safeArray(value).map((item)=>cleanText(item,40)).filter(Boolean);
const ensureUuid=(value,label='Identifier')=>{
  const id=String(value||'');
  if(!UUID.test(id))throw new HttpError(400,'research_id_invalid',`${label} is invalid`);
  return id;
};
const metadataFor=(body,current={})=>({
  ...(current&&typeof current==='object'&&!Array.isArray(current)?current:{}),
  ...(body.description!==undefined?{description:cleanText(body.description,2000)}:{}),
  ...(body.tags!==undefined?{tags:cleanTags(body.tags)}:{})
});
const projectToWorkspace=(project,items=[])=>({
  researchWorkspaceId:project.id,
  name:project.title,
  description:project.metadata?.description||'',
  tags:Array.isArray(project.metadata?.tags)?project.metadata.tags:[],
  status:project.status,
  hypothesis:project.hypothesis,
  confidence:project.confidence,
  invalidationConditions:project.invalidation_conditions||[],
  revision:project.current_revision,
  createdAt:project.created_at,
  updatedAt:project.updated_at,
  cloudSync:true,
  localPersistence:false,
  collaboration:true,
  items:items.map((item)=>({
    itemId:item.id,
    type:item.source_type,
    title:item.title,
    note:item.payload?.note||'',
    referenceId:item.source_ref||null,
    sourceUrl:item.source_url||null,
    evidenceRole:item.evidence_role,
    freshness:item.freshness,
    confidence:item.confidence,
    coverage:item.coverage,
    method:item.method,
    assumptions:item.assumptions||[],
    contradictions:item.contradictions||[],
    limitations:item.limitations||[],
    auditId:item.audit_id,
    addedAt:item.created_at,
    updatedAt:item.updated_at
  }))
});
const revisionToVersion=(row)=>({
  versionId:row.id,
  sequence:row.revision_no,
  message:row.snapshot?.metadata?.manualCheckpoint?.message||`Revision ${row.revision_no}`,
  snapshotRevision:row.revision_no,
  capturedAt:row.created_at,
  snapshot:row.snapshot
});

async function projectRows(env,session,workspaceId,{projectId=null,limit=100}={}){
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,deleted_at:'is.null',order:'updated_at.desc',limit:String(limit)});
  if(projectId)params.set('id',`eq.${projectId}`);
  return restRequest(env,session.accessToken,`qelly_research_projects?${params.toString()}`);
}
async function evidenceRows(env,session,workspaceId,projectId){
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,project_id:`eq.${projectId}`,order:'created_at.asc',limit:'500'});
  return restRequest(env,session.accessToken,`qelly_research_evidence?${params.toString()}`);
}
async function revisionRows(env,session,workspaceId,projectId){
  const params=new URLSearchParams({select:'*',workspace_id:`eq.${workspaceId}`,project_id:`eq.${projectId}`,order:'revision_no.desc',limit:'200'});
  return restRequest(env,session.accessToken,`qelly_research_project_revisions?${params.toString()}`);
}
async function requireProject(env,session,qelly,projectId){
  const rows=await projectRows(env,session,qelly.workspace.workspaceId,{projectId,limit:1});
  if(!rows?.length)throw new HttpError(404,'research_workspace_not_found','Research workspace was not found');
  return rows[0];
}

async function handleResearch(context,relative,method,session,qelly){
  const {request,env}=context;
  const segments=relative.split('/').filter(Boolean);
  const workspaceId=qelly.workspace.workspaceId;
  const ownerId=qelly.user.userId;

  if(!relative&&method==='GET'){
    const rows=await projectRows(env,session,workspaceId,{limit:100});
    return responseJson(request,env,{
      items:(rows||[]).map((row)=>projectToWorkspace(row)),
      updatedAt:new Date().toISOString(),
      cloudSync:true,
      localPersistence:false,
      collaboration:true,
      truthState:'CLOUD RLS'
    });
  }

  if(!relative&&method==='POST'){
    await requireCsrf(request);
    const body=await jsonBody(request);
    const name=cleanText(body.name,160);
    if(name.length<2)throw new HttpError(400,'research_name_required','Research workspace name is required');
    const rows=await restRequest(env,session.accessToken,'qelly_research_projects',{
      method:'POST',
      body:{
        workspace_id:workspaceId,
        owner_id:ownerId,
        title:name,
        status:'draft',
        hypothesis:body.hypothesis?cleanText(body.hypothesis,4000):null,
        confidence:body.confidence==null?null:Number(body.confidence),
        invalidation_conditions:safeArray(body.invalidationConditions,50),
        metadata:metadataFor(body,{})
      },
      prefer:'return=representation'
    });
    return responseJson(request,env,{item:projectToWorkspace(rows?.[0])},201);
  }

  const projectId=ensureUuid(segments[0],'Research workspace identifier');
  const suffix=segments.slice(1).join('/');

  if(!suffix&&method==='GET'){
    const project=await requireProject(env,session,qelly,projectId);
    const items=await evidenceRows(env,session,workspaceId,projectId);
    return responseJson(request,env,projectToWorkspace(project,items||[]));
  }

  if(!suffix&&method==='PATCH'){
    await requireCsrf(request);
    const project=await requireProject(env,session,qelly,projectId);
    const body=await jsonBody(request);
    const patch={};
    if(body.name!==undefined){const name=cleanText(body.name,160);if(name.length<2)throw new HttpError(400,'research_name_required','Research workspace name is required');patch.title=name;}
    if(body.status!==undefined)patch.status=cleanText(body.status,40);
    if(body.hypothesis!==undefined)patch.hypothesis=body.hypothesis?cleanText(body.hypothesis,4000):null;
    if(body.confidence!==undefined)patch.confidence=body.confidence==null?null:Number(body.confidence);
    if(body.invalidationConditions!==undefined)patch.invalidation_conditions=safeArray(body.invalidationConditions,50);
    if(body.description!==undefined||body.tags!==undefined)patch.metadata=metadataFor(body,project.metadata||{});
    if(!Object.keys(patch).length)return responseJson(request,env,{item:projectToWorkspace(project)});
    const rows=await restRequest(env,session.accessToken,`qelly_research_projects?id=eq.${projectId}&workspace_id=eq.${workspaceId}`,{method:'PATCH',body:patch,prefer:'return=representation'});
    return responseJson(request,env,{item:projectToWorkspace(rows?.[0]||project)});
  }

  if(!suffix&&method==='DELETE'){
    await requireCsrf(request);
    await requireProject(env,session,qelly,projectId);
    await restRequest(env,session.accessToken,`qelly_research_projects?id=eq.${projectId}&workspace_id=eq.${workspaceId}`,{method:'PATCH',body:{deleted_at:new Date().toISOString()},prefer:'return=minimal'});
    return responseJson(request,env,{deleted:true,researchWorkspaceId:projectId});
  }

  if(suffix==='items'&&method==='POST'){
    await requireCsrf(request);
    await requireProject(env,session,qelly,projectId);
    const body=await jsonBody(request);
    const title=cleanText(body.title,240);
    const type=cleanText(body.type||'note',40).toLowerCase();
    if(title.length<1)throw new HttpError(400,'research_item_title_required','Evidence item title is required');
    if(!['note','asset','filing','chart','event','reference'].includes(type))throw new HttpError(400,'research_item_type_invalid','Evidence item type is invalid');
    const referenceId=body.referenceId?cleanText(body.referenceId,500):null;
    const sourceUrl=body.sourceUrl?cleanText(body.sourceUrl,1000):null;
    const rows=await restRequest(env,session.accessToken,'qelly_research_evidence',{
      method:'POST',
      body:{
        project_id:projectId,
        workspace_id:workspaceId,
        owner_id:ownerId,
        evidence_role:'supporting',
        title,
        source_type:type,
        source_ref:referenceId,
        source_url:sourceUrl,
        observed_at:body.observedAt||null,
        freshness:referenceId||sourceUrl?'unverified-reference':'missing',
        confidence:body.confidence==null?null:Number(body.confidence),
        coverage:body.coverage==null?null:Number(body.coverage),
        method:body.method?cleanText(body.method,500):null,
        assumptions:safeArray(body.assumptions,50),
        contradictions:safeArray(body.contradictions,50),
        limitations:safeArray(body.limitations,50),
        payload:{note:cleanText(body.note,4000)}
      },
      prefer:'return=representation'
    });
    const item=rows?.[0];
    return responseJson(request,env,{item:item?projectToWorkspace({id:projectId,title:'',metadata:{},status:'draft',current_revision:1,created_at:null,updated_at:null},[item]).items[0]:null},201);
  }

  if(suffix==='versions'&&method==='GET'){
    await requireProject(env,session,qelly,projectId);
    const rows=await revisionRows(env,session,workspaceId,projectId);
    return responseJson(request,env,{items:(rows||[]).map(revisionToVersion),truthState:'AUDIT',automaticSnapshots:true});
  }

  if(suffix==='versions'&&method==='POST'){
    await requireCsrf(request);
    const project=await requireProject(env,session,qelly,projectId);
    const body=await jsonBody(request);
    const message=cleanText(body.message||`Checkpoint ${project.current_revision+1}`,240);
    const metadata={...(project.metadata||{}),manualCheckpoint:{message,capturedAt:new Date().toISOString()}};
    const rows=await restRequest(env,session.accessToken,`qelly_research_projects?id=eq.${projectId}&workspace_id=eq.${workspaceId}`,{method:'PATCH',body:{metadata},prefer:'return=representation'});
    const updated=rows?.[0];
    if(!updated)throw new HttpError(409,'research_checkpoint_failed','Research checkpoint could not be captured');
    const revisions=await restRequest(env,session.accessToken,`qelly_research_project_revisions?select=*&project_id=eq.${projectId}&revision_no=eq.${updated.current_revision}&limit=1`);
    return responseJson(request,env,{item:revisions?.[0]?revisionToVersion(revisions[0]):null,revision:updated.current_revision},201);
  }

  if(segments[1]==='versions'&&segments[2]&&segments[3]==='restore'&&method==='POST'){
    await requireCsrf(request);
    await requireProject(env,session,qelly,projectId);
    const versionId=ensureUuid(segments[2],'Research version identifier');
    const versions=await restRequest(env,session.accessToken,`qelly_research_project_revisions?select=*&id=eq.${versionId}&project_id=eq.${projectId}&workspace_id=eq.${workspaceId}&limit=1`);
    if(!versions?.length)throw new HttpError(404,'research_version_not_found','Research version was not found');
    const snapshot=versions[0].snapshot||{};
    const patch={
      title:cleanText(snapshot.title||'Research workspace',160),
      status:cleanText(snapshot.status||'draft',40),
      hypothesis:snapshot.hypothesis?cleanText(snapshot.hypothesis,4000):null,
      confidence:snapshot.confidence??null,
      invalidation_conditions:safeArray(snapshot.invalidationConditions,50),
      metadata:{...(snapshot.metadata||{}),restoredFromVersionId:versionId,restoredAt:new Date().toISOString()},
      deleted_at:snapshot.deletedAt||null
    };
    const rows=await restRequest(env,session.accessToken,`qelly_research_projects?id=eq.${projectId}&workspace_id=eq.${workspaceId}`,{method:'PATCH',body:patch,prefer:'return=representation'});
    return responseJson(request,env,{item:projectToWorkspace(rows?.[0]),restoredFromVersionId:versionId,revision:rows?.[0]?.current_revision||null});
  }

  throw new HttpError(404,'research_route_not_found','Research API route was not found');
}

export async function onRequest(context){
  const {request,env}=context;
  const method=request.method.toUpperCase();
  const relative=routePath(context);
  let response;
  const started=Date.now();
  try{
    if(method==='OPTIONS')return context.next();
    if(!['GET','HEAD'].includes(method))requireOrigin(request,env);
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`research:${session.user.id}:${relative||'root'}`,{limit:90});
    const qelly=await bootstrapContext(env,session);
    response=await handleResearch(context,relative,method,session,qelly);
    return response;
  }catch(error){
    response=errorResponse(request,env,error);
    return response;
  }finally{
    try{console.log(JSON.stringify({event:'qelly_research_request',correlationId:correlationId(request),method,path:new URL(request.url).pathname,status:response?.status??500,durationMs:Date.now()-started,bodyLogged:false}));}catch{}
  }
}

export const __researchCloudflareTest=Object.freeze({routePath,metadataFor,projectToWorkspace,revisionToVersion});
