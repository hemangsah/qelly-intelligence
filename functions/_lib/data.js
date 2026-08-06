import {
  HttpError,
  UUID,
  cleanText,
  clearSessionCookies,
  fetcher,
  jsonBody,
  publicRuntimeConfig,
  requireCsrf,
  responseJson,
  restRequest,
  stableUuid
} from './runtime.js';

const MAX_SYNC_BATCH_ITEMS=100;
const DEFAULT_PAGE_SIZE=50;
const MAX_PAGE_SIZE=100;
const MAX_PULL_REVISION_ROWS=500;

const localToCloud=(item,context)=>{
  if(!UUID.test(String(item.id||'')))throw new HttpError(400,'saved_id_invalid','Only UUID saved records can be synchronized');
  const result=item.result&&typeof item.result==='object'?item.result:{};
  const clientUpdatedAt=item.updatedAt||item.savedAt||null;
  return {
    id:item.id,
    workspace_id:context.workspace.workspaceId,
    owner_id:context.user.userId,
    title:cleanText(item.name||result.formulaId||result.indicatorId||'Calculation',160),
    formula_id:cleanText(result.formulaId||result.indicatorId||'calculation',160),
    input_payload:result.inputs&&typeof result.inputs==='object'?result.inputs:{},
    result_payload:result,
    provenance:{
      truthState:'DETERMINISTIC LOCAL',
      notes:cleanText(item.notes,2000),
      tags:Array.isArray(item.tags)?item.tags.slice(0,20).map(tag=>cleanText(tag,40)):[],
      favorite:Boolean(item.favorite),
      localVersion:Number(item.version)||1,
      formulaVersion:item.formulaVersion||null,
      indicatorVersion:item.indicatorVersion||null,
      indiaRuleVersion:item.indiaRuleVersion||null,
      effectiveDate:item.effectiveDate||null,
      localUpdatedAt:clientUpdatedAt
    },
    client_updated_at:clientUpdatedAt,
    deleted_at:item.deletedAt||null
  };
};

const cloudToLocal=(record,revisions=[])=>({
  id:record.id,
  name:record.title,
  result:record.result_payload||{},
  notes:record.provenance?.notes||'',
  tags:record.provenance?.tags||[],
  favorite:Boolean(record.provenance?.favorite),
  savedAt:record.created_at,
  updatedAt:record.updated_at,
  schemaVersion:2,
  version:record.current_revision,
  formulaVersion:record.provenance?.formulaVersion||null,
  indicatorVersion:record.provenance?.indicatorVersion||null,
  indiaRuleVersion:record.provenance?.indiaRuleVersion||null,
  effectiveDate:record.provenance?.effectiveDate||null,
  truthState:'CLOUD RLS',
  baseCloudRevision:record.current_revision,
  revisions:revisions.map(value=>({
    revisionId:value.id,
    version:value.revision_no,
    createdAt:value.created_at,
    restoredFrom:null,
    name:value.snapshot?.title||record.title,
    result:value.snapshot?.result||{},
    notes:value.snapshot?.provenance?.notes||'',
    tags:value.snapshot?.provenance?.tags||[],
    favorite:Boolean(value.snapshot?.provenance?.favorite),
    formulaVersion:value.snapshot?.provenance?.formulaVersion||null,
    indicatorVersion:value.snapshot?.provenance?.indicatorVersion||null,
    indiaRuleVersion:value.snapshot?.provenance?.indiaRuleVersion||null,
    effectiveDate:value.snapshot?.provenance?.effectiveDate||null
  }))
});

const canonicalize=(value)=>{
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalize(value[key])]));
  return value;
};

const sha256Hex=async(value)=>{
  const encoded=new TextEncoder().encode(JSON.stringify(canonicalize(value)));
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoded));
  return Array.from(digest,byte=>byte.toString(16).padStart(2,'0')).join('');
};

const base64UrlEncode=(value)=>{
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};

const base64UrlDecode=(value)=>{
  try{
    const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
    const binary=atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'='));
    const bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }catch{
    throw new HttpError(400,'cursor_invalid','Pagination cursor is invalid');
  }
};

const pageLimit=(url)=>{
  const requested=Number(url.searchParams.get('limit')||DEFAULT_PAGE_SIZE);
  if(!Number.isInteger(requested)||requested<1)return DEFAULT_PAGE_SIZE;
  return Math.min(requested,MAX_PAGE_SIZE);
};

const parseCursor=(url)=>{
  const encoded=url.searchParams.get('cursor');
  if(!encoded)return null;
  const cursor=base64UrlDecode(encoded);
  if(!cursor||!UUID.test(String(cursor.id||''))||Number.isNaN(new Date(cursor.updatedAt).valueOf()))throw new HttpError(400,'cursor_invalid','Pagination cursor is invalid');
  return {id:String(cursor.id),updatedAt:new Date(cursor.updatedAt).toISOString()};
};

const nextCursorFor=(records,limit)=>{
  if(records.length<limit)return null;
  const last=records.at(-1);
  return last?base64UrlEncode({id:last.id,updatedAt:last.updated_at}):null;
};

const calculationPagePath=(workspaceId,url)=>{
  const limit=pageLimit(url);
  const cursor=parseCursor(url);
  const params=new URLSearchParams({
    select:'*',
    workspace_id:`eq.${workspaceId}`,
    order:'updated_at.desc,id.desc',
    limit:String(limit)
  });
  if(cursor)params.set('or',`(updated_at.lt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.lt.${cursor.id}))`);
  return {limit,path:`qelly_saved_calculations?${params.toString()}`};
};

const revisionPagePath=(records)=>{
  const ids=records.map(record=>record.id).filter(id=>UUID.test(String(id)));
  if(!ids.length)return null;
  const params=new URLSearchParams({
    select:'id,calculation_id,revision_no,created_at,snapshot',
    calculation_id:`in.(${ids.join(',')})`,
    order:'created_at.desc,id.desc',
    limit:String(MAX_PULL_REVISION_ROWS)
  });
  return `qelly_saved_calculation_revisions?${params.toString()}`;
};

const revisionsForRecords=async(env,session,records)=>{
  const path=revisionPagePath(records);
  if(!path)return {rows:[],partial:false};
  const rows=await restRequest(env,session.accessToken,path);
  return {rows:rows||[],partial:(rows?.length||0)>=MAX_PULL_REVISION_ROWS};
};

const cloudStatus=async(env,session,context)=>{
  const [calculations,pending]=await Promise.all([
    restRequest(env,session.accessToken,`qelly_saved_calculations?select=id&workspace_id=eq.${context.workspace.workspaceId}&deleted_at=is.null&limit=1000`),
    restRequest(env,session.accessToken,'qelly_sync_operations?select=id&status=in.(pending,conflict)&limit=1000')
  ]);
  return {
    available:true,
    optIn:Boolean(context.profile?.cloud_sync_opt_in),
    cloudRecordCount:calculations?.length||0,
    pendingOperationCount:pending?.length||0,
    countsCappedAt:1000,
    workspaceId:context.workspace.workspaceId,
    userId:context.user.userId
  };
};

const atomicSyncItems=async(rawItems,body,key,qelly)=>Promise.all(rawItems.map(async item=>{
  const record=localToCloud(item,qelly);
  const baseRevision=body.baseRevisions?.[record.id]??item.baseCloudRevision??null;
  return {
    id:record.id,
    operationId:await stableUuid(`${key}:${record.id}`),
    baseRevision,
    record
  };
}));

export async function handleData(context,path,segments,method,session,qelly){
  const {request,env}=context;
  const url=new URL(request.url);

  if(path==='cloud/status'&&method==='GET')return responseJson(request,env,await cloudStatus(env,session,qelly));

  if(path==='cloud/opt-in'&&method==='POST'){
    await requireCsrf(request);
    const body=await jsonBody(request);
    const enabled=Boolean(body.enabled);
    await restRequest(env,session.accessToken,`qelly_profiles?user_id=eq.${session.user.id}`,{
      method:'PATCH',
      body:{cloud_sync_opt_in:enabled},
      prefer:'return=representation'
    });
    return responseJson(request,env,{enabled});
  }

  if(path==='sync/push'&&method==='POST'){
    await requireCsrf(request);
    const body=await jsonBody(request);
    const key=String(request.headers.get('idempotency-key')||'').trim();
    if(key.length<8||key.length>128)throw new HttpError(400,'idempotency_key_required','A valid Idempotency-Key header between 8 and 128 characters is required');
    const rawItems=Array.isArray(body.items)?body.items:[];
    if(rawItems.length<1||rawItems.length>MAX_SYNC_BATCH_ITEMS)throw new HttpError(400,'sync_batch_size_invalid',`Cloud synchronization accepts 1 to ${MAX_SYNC_BATCH_ITEMS} records per atomic batch`);
    const items=await atomicSyncItems(rawItems,body,key,qelly);
    const requestHash=await sha256Hex({workspaceId:qelly.workspace.workspaceId,items});
    const result=await restRequest(env,session.accessToken,'rpc/qelly_sync_push_batch',{
      method:'POST',
      body:{
        p_workspace_id:qelly.workspace.workspaceId,
        p_idempotency_key:key,
        p_request_hash:requestHash,
        p_items:items
      }
    });
    return responseJson(request,env,result);
  }

  if(path==='sync/pull'&&method==='GET'){
    const page=calculationPagePath(qelly.workspace.workspaceId,url);
    const records=await restRequest(env,session.accessToken,page.path);
    const revisionPage=await revisionsForRecords(env,session,records||[]);
    const byCalculation=new Map();
    for(const row of revisionPage.rows){
      if(!byCalculation.has(row.calculation_id))byCalculation.set(row.calculation_id,[]);
      byCalculation.get(row.calculation_id).push(row);
    }
    for(const revisions of byCalculation.values())revisions.sort((left,right)=>Number(left.revision_no)-Number(right.revision_no));
    const nextCursor=nextCursorFor(records||[],page.limit);
    return responseJson(request,env,{
      items:(records||[]).filter(record=>!record.deleted_at).map(record=>cloudToLocal(record,byCalculation.get(record.id)||[])),
      deleted:(records||[]).filter(record=>record.deleted_at).map(record=>({id:record.id,deletedAt:record.deleted_at})),
      nextCursor,
      hasMore:Boolean(nextCursor),
      pageSize:page.limit,
      revisionHistoryPartial:revisionPage.partial,
      revisionRowsReturned:revisionPage.rows.length,
      revisionRowsLimit:MAX_PULL_REVISION_ROWS,
      pulledAt:new Date().toISOString()
    });
  }

  if(path==='saved-calculations'&&method==='GET'){
    const page=calculationPagePath(qelly.workspace.workspaceId,url);
    const items=await restRequest(env,session.accessToken,page.path);
    const nextCursor=nextCursorFor(items||[],page.limit);
    return responseJson(request,env,{items:items||[],nextCursor,hasMore:Boolean(nextCursor),pageSize:page.limit});
  }

  if(path==='saved-calculations'&&method==='POST'){
    await requireCsrf(request);
    const body=await jsonBody(request);
    const record=localToCloud({...body,id:body.id||crypto.randomUUID()},qelly);
    const stored=await restRequest(env,session.accessToken,'qelly_saved_calculations',{
      method:'POST',
      body:record,
      prefer:'return=representation'
    });
    return responseJson(request,env,{item:stored?.[0]||null},201);
  }

  if(segments[0]==='saved-calculations'&&UUID.test(segments[1]||'')){
    const id=segments[1];
    const suffix=segments.slice(2).join('/');

    if(!suffix&&method==='GET'){
      const rows=await restRequest(env,session.accessToken,`qelly_saved_calculations?select=*&id=eq.${id}&limit=1`);
      if(!rows?.length)throw new HttpError(404,'saved_not_found','Saved calculation was not found');
      return responseJson(request,env,{item:rows[0]});
    }

    if(!suffix&&method==='PATCH'){
      await requireCsrf(request);
      const body=await jsonBody(request);
      const allowed={};
      for(const key of ['result_payload','input_payload','provenance','client_updated_at'])if(body[key]!==undefined)allowed[key]=body[key];
      if(body.title!==undefined)allowed.title=cleanText(body.title,160);
      const rows=await restRequest(env,session.accessToken,`qelly_saved_calculations?id=eq.${id}`,{
        method:'PATCH',
        body:allowed,
        prefer:'return=representation'
      });
      return responseJson(request,env,{item:rows?.[0]||null});
    }

    if(!suffix&&method==='DELETE'){
      await requireCsrf(request);
      await restRequest(env,session.accessToken,`qelly_saved_calculations?id=eq.${id}`,{
        method:'PATCH',
        body:{deleted_at:new Date().toISOString()},
        prefer:'return=minimal'
      });
      return responseJson(request,env,{deleted:true,id});
    }

    if(suffix==='restore'&&method==='POST'){
      await requireCsrf(request);
      const rows=await restRequest(env,session.accessToken,`qelly_saved_calculations?id=eq.${id}`,{
        method:'PATCH',
        body:{deleted_at:null},
        prefer:'return=representation'
      });
      return responseJson(request,env,{item:rows?.[0]||null});
    }

    if(suffix==='revisions'&&method==='GET'){
      const limit=Math.min(Math.max(Number(url.searchParams.get('limit'))||50,1),100);
      return responseJson(request,env,{items:await restRequest(env,session.accessToken,`qelly_saved_calculation_revisions?select=*&calculation_id=eq.${id}&order=revision_no.desc&limit=${limit}`),pageSize:limit});
    }

    if(suffix==='revisions/restore'&&method==='POST'){
      await requireCsrf(request);
      const body=await jsonBody(request);
      const revision=Number(body.revision);
      if(!Number.isInteger(revision)||revision<1)throw new HttpError(400,'revision_invalid','Revision number is invalid');
      const rows=await restRequest(env,session.accessToken,`qelly_saved_calculation_revisions?select=*&calculation_id=eq.${id}&revision_no=eq.${revision}&limit=1`);
      if(!rows?.length)throw new HttpError(404,'revision_not_found','Revision was not found');
      const snapshot=rows[0].snapshot||{};
      const stored=await restRequest(env,session.accessToken,`qelly_saved_calculations?id=eq.${id}`,{
        method:'PATCH',
        body:{
          title:snapshot.title,
          result_payload:snapshot.result||{},
          input_payload:snapshot.input||{},
          provenance:snapshot.provenance||{},
          deleted_at:snapshot.deletedAt||null
        },
        prefer:'return=representation'
      });
      return responseJson(request,env,{item:stored?.[0]||null,restoredRevision:revision});
    }
  }

  if(path==='feedback'&&method==='POST'){
    await requireCsrf(request);
    const body=await jsonBody(request);
    const category=cleanText(body.category,32);
    const message=cleanText(body.message,4000);
    const pagePath=cleanText(body.pagePath,500);
    if(!['bug','accessibility','data-quality','privacy','support','feature'].includes(category)||message.length<10)throw new HttpError(400,'feedback_invalid','Feedback category or message is invalid');
    const rows=await restRequest(env,session.accessToken,'qelly_feedback',{
      method:'POST',
      body:{owner_id:session.user.id,category,message,page_path:pagePath||null},
      prefer:'return=representation'
    });
    return responseJson(request,env,{accepted:true,item:rows?.[0]||null},201);
  }

  if(path==='account/export'&&method==='GET'){
    const [profile,workspaces,calculations,revisions,pending]=await Promise.all([
      restRequest(env,session.accessToken,`qelly_profiles?select=*&user_id=eq.${session.user.id}`),
      restRequest(env,session.accessToken,'qelly_workspaces?select=*'),
      restRequest(env,session.accessToken,'qelly_saved_calculations?select=*&limit=1000'),
      restRequest(env,session.accessToken,'qelly_saved_calculation_revisions?select=*&limit=5000'),
      restRequest(env,session.accessToken,'qelly_sync_operations?select=*&status=in.(pending,conflict)&limit=1000')
    ]);
    return responseJson(request,env,{
      schemaVersion:1,
      exportedAt:new Date().toISOString(),
      partial:Boolean((calculations?.length||0)>=1000||(revisions?.length||0)>=5000),
      limits:{calculations:1000,revisions:5000,pending:1000},
      profile,
      workspaces,
      calculations,
      revisions,
      pending
    });
  }

  if(path==='account/delete'&&method==='POST'){
    await requireCsrf(request);
    await restRequest(env,session.accessToken,'qelly_account_deletion_requests?on_conflict=owner_id',{
      method:'POST',
      body:{owner_id:session.user.id,status:'requested',requested_at:new Date().toISOString()},
      prefer:'resolution=merge-duplicates,return=representation'
    });
    let identityDeleted=false;
    if(env.QELLY_SUPABASE_SERVICE_ROLE_KEY){
      const config=publicRuntimeConfig(env,request.url);
      const response=await fetcher(env)(`${config.supabaseUrl}/auth/v1/admin/users/${session.user.id}`,{
        method:'DELETE',
        headers:{
          apikey:env.QELLY_SUPABASE_SERVICE_ROLE_KEY,
          Authorization:`Bearer ${env.QELLY_SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
      identityDeleted=response.ok;
    }
    return responseJson(request,env,{requested:true,identityDeleted,status:identityDeleted?'completed':'requested'},202,{cookies:clearSessionCookies()});
  }

  return null;
}

export const __dataTest=Object.freeze({
  localToCloud,
  cloudToLocal,
  cloudStatus,
  canonicalize,
  sha256Hex,
  pageLimit,
  parseCursor,
  nextCursorFor,
  calculationPagePath,
  revisionPagePath,
  revisionsForRecords,
  atomicSyncItems,
  MAX_PULL_REVISION_ROWS
});
