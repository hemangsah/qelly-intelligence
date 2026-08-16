import {bootstrapContext,enforceRateLimit,errorResponse,jsonBody,requireCsrf,requireOrigin,resolveSession,responseJson,restRequest} from '../../../_lib/runtime.js';

const DEFAULTS=Object.freeze({theme:'burgundy-command',density:'comfortable',motion:'full',fontScale:100,radiusPx:14,customAccent:null,route:'market'});
const ALLOWED=new Set(['theme','density','motion','fontScale','radiusPx','customAccent','route']);

const cleanPreferences=(value={})=>{
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const next={};
  for(const key of ALLOWED)if(source[key]!==undefined)next[key]=source[key];
  if(next.theme!==undefined)next.theme=String(next.theme).slice(0,80);
  if(next.density!==undefined&&!['compact','comfortable','spacious'].includes(String(next.density)))delete next.density;
  if(next.motion!==undefined&&!['full','reduced','none'].includes(String(next.motion)))delete next.motion;
  if(next.fontScale!==undefined)next.fontScale=Math.min(140,Math.max(80,Number(next.fontScale)||100));
  if(next.radiusPx!==undefined)next.radiusPx=Math.min(24,Math.max(0,Number(next.radiusPx)||0));
  if(next.customAccent!==undefined&&next.customAccent!==null)next.customAccent=String(next.customAccent).slice(0,32);
  if(next.route!==undefined)next.route=String(next.route).slice(0,120);
  return next;
};

async function preferenceRow(env,session,qelly){
  const params=new URLSearchParams({
    select:'preferences,schema_version,revision,updated_at',
    owner_id:`eq.${session.user.id}`,
    workspace_id:`eq.${qelly.workspace.workspaceId}`,
    limit:'1'
  });
  return (await restRequest(env,session.accessToken,`qelly_ui_preferences?${params.toString()}`))?.[0]||null;
}

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.headers.get('origin'))requireOrigin(request,env);
    const method=request.method.toUpperCase();
    if(!['GET','PATCH','PUT'].includes(method))return context.next();
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`user:${session.user.id}:preferences/layout`);
    const qelly=await bootstrapContext(env,session);
    const current=await preferenceRow(env,session,qelly);

    if(method==='GET'){
      return responseJson(request,env,{
        ...DEFAULTS,
        ...(current?.preferences||{}),
        revision:Number(current?.revision)||0,
        schemaVersion:Number(current?.schema_version)||3,
        persisted:Boolean(current),
        storage:'cloud-rls',
        updatedAt:current?.updated_at||null
      },200,{cookies:session.cookies,cache:'no-store'});
    }

    await requireCsrf(request);
    const body=await jsonBody(request);
    const incoming=cleanPreferences(body.preferences&&typeof body.preferences==='object'?body.preferences:body);
    const preferences={...DEFAULTS,...(current?.preferences||{}),...incoming};
    const nextRevision=(Number(current?.revision)||0)+1;
    const stored=await restRequest(env,session.accessToken,'qelly_ui_preferences?on_conflict=owner_id,workspace_id',{
      method:'POST',
      body:{
        owner_id:session.user.id,
        workspace_id:qelly.workspace.workspaceId,
        preferences,
        schema_version:3,
        revision:nextRevision,
        updated_at:new Date().toISOString()
      },
      prefer:'resolution=merge-duplicates,return=representation'
    });
    const row=stored?.[0]||{preferences,revision:nextRevision,schema_version:3,updated_at:new Date().toISOString()};
    return responseJson(request,env,{
      ...DEFAULTS,
      ...(row.preferences||preferences),
      revision:Number(row.revision)||nextRevision,
      schemaVersion:Number(row.schema_version)||3,
      persisted:true,
      storage:'cloud-rls',
      updatedAt:row.updated_at||null
    },200,{cookies:session.cookies,cache:'no-store'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __preferencesLayoutTest=Object.freeze({cleanPreferences,DEFAULTS});
