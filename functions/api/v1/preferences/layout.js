import {bootstrapContext,enforceRateLimit,errorResponse,jsonBody,requireCsrf,requireOrigin,resolveSession,responseJson,restRequest} from '../../../_lib/runtime.js';
import {DEFAULT_UI_PREFERENCES,cleanUiPreferences,readUiPreferenceRow,uiPreferencesEnvelope} from '../../../_lib/ui-preferences.js';

export async function onRequest(context){
  const {request,env}=context;
  try{
    if(request.headers.get('origin'))requireOrigin(request,env);
    const method=request.method.toUpperCase();
    if(!['GET','PATCH','PUT'].includes(method))return context.next();
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`user:${session.user.id}:preferences/layout`);
    const qelly=await bootstrapContext(env,session);
    const current=await readUiPreferenceRow(env,session,qelly.workspace.workspaceId);

    if(method==='GET'){
      return responseJson(request,env,uiPreferencesEnvelope(current),200,{cookies:session.cookies,cache:'no-store'});
    }

    await requireCsrf(request);
    const body=await jsonBody(request);
    const incoming=cleanUiPreferences(body.preferences&&typeof body.preferences==='object'?body.preferences:body);
    const preferences={...DEFAULT_UI_PREFERENCES,...(current?.preferences||{}),...incoming};
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
    return responseJson(request,env,{...uiPreferencesEnvelope(row),persisted:true},200,{cookies:session.cookies,cache:'no-store'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __preferencesLayoutTest=Object.freeze({cleanPreferences:cleanUiPreferences,DEFAULTS:DEFAULT_UI_PREFERENCES});
