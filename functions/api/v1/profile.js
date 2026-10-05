import {HttpError,bootstrapContext,cleanText,enforceRateLimit,errorResponse,jsonBody,requireCsrf,resolveSession,responseJson,restRequest} from '../../_lib/runtime.js';
import {effectivePublicRuntimeConfig} from '../../_lib/email-capability.js';
import {canonicalTimezone,recognizedTimezone} from '../../_lib/timezone.js';
import {linkingProviders} from '../../_lib/qelly-identity-linking.js';

const BASE_CURRENCIES=Object.freeze(['USD','INR','EUR','GBP','SGD','AED','JPY']);
const IDENTITY_PROVIDER_LABELS=Object.freeze({email:'Email',google:'Google',apple:'Apple',linkedin_oidc:'LinkedIn',facebook:'Facebook'});
// The authenticated GoTrue /auth/v1/user response is the only evidence source.
// Never forward identity_data, raw provider subject identifiers or OAuth tokens.
const sanitizedLinkedIdentities=(identities,env={})=>{
  if(!Array.isArray(identities))return Object.freeze({state:'unavailable',items:Object.freeze([]),readOnly:true,linkingEnabled:false,unlinkingEnabled:false});
  const items=identities.slice(0,20).filter(entry=>entry&&Object.hasOwn(IDENTITY_PROVIDER_LABELS,String(entry.provider||''))).map(entry=>Object.freeze({
    provider:String(entry.provider),
    label:IDENTITY_PROVIDER_LABELS[entry.provider],
    linkedAt:typeof entry.created_at==='string'?entry.created_at:null,
    lastSignInAt:typeof entry.last_sign_in_at==='string'?entry.last_sign_in_at:null
  }));
  const availableProviders=linkingProviders(env).filter(provider=>!items.some(item=>item.provider===provider.supabaseProvider)).map(({id,label})=>({id,label}));
  return Object.freeze({state:'available',items:Object.freeze(items),readOnly:availableProviders.length===0,linkingEnabled:availableProviders.length>0,availableProviders,unlinkingEnabled:false});
};

const safeTimezone=(value)=>{
  const timezone=canonicalTimezone(value);
  if(!recognizedTimezone(timezone))throw new HttpError(400,'profile_timezone_invalid','Timezone is not recognized');
  return timezone;
};

const safeCurrency=(value)=>{
  const currency=String(value||'').trim().toUpperCase();
  if(!BASE_CURRENCIES.includes(currency))throw new HttpError(400,'profile_currency_invalid','Base currency is not supported');
  return currency;
};

// Only timestamps supplied by the authenticated GoTrue /auth/v1/user response.
// Missing or malformed identity dates remain null, never inferred from profile rows.
const identityDate=value=>{
  if(typeof value!=='string'||value.length>64||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
  const epoch=Date.parse(value);
  if(!Number.isFinite(epoch))return null;
  const normalized=new Date(epoch).toISOString();
  return normalized.slice(0,10)===value.slice(0,10)?normalized:null;
};
const verifiedIdentityDates=user=>Object.freeze({
  accountCreatedAt:identityDate(user?.created_at),
  lastSignInAt:identityDate(user?.last_sign_in_at)
});

const profilePayload=(context,runtime={capabilities:{}},identities,observedIdentity={},avatarVerified=false,env={})=>({
  user:{
    userId:context.user.userId,
    email:context.user.email,
    emailConfirmedAt:context.user.emailConfirmedAt,
    accountCreatedAt:observedIdentity.accountCreatedAt||null,
    lastSignInAt:observedIdentity.lastSignInAt||null,
    displayName:context.profile?.display_name||context.user.displayName||null
  },
  profile:{
    displayName:context.profile?.display_name||null,
    baseCurrency:context.profile?.base_currency||'USD',
    timezone:canonicalTimezone(context.profile?.timezone||'UTC'),
    cloudSyncOptIn:Boolean(context.profile?.cloud_sync_opt_in),
    privacyVersion:context.profile?.privacy_version||null,
    termsVersion:context.profile?.terms_version||null,
    createdAt:context.profile?.created_at||null,
    updatedAt:context.profile?.updated_at||null
  },
  workspace:{
    workspaceId:context.workspace.workspaceId,
    name:context.workspace.name
  },
  session:{...context.session},
  linkedIdentities:sanitizedLinkedIdentities(identities,runtime?.capabilities?.authentication===true?env:{}),
  capabilities:{
    profilePersistence:'cloud-rls',
    workspacePersistence:'cloud-rls',
    cloudSync:runtime?.capabilities?.cloudSync===true,
    globalSignOut:true,
    avatarStorage:avatarVerified===true?'private-rls':'unavailable',
    execution:false
  }
});

export async function onRequest(context){
  const {request,env}=context;
  try{
    const method=request.method.toUpperCase();
    if(!['GET','PATCH'].includes(method))throw new HttpError(405,'method_not_allowed','Profile endpoint supports GET and PATCH only');
    const session=await resolveSession(request,env,{required:true});
    await enforceRateLimit(env,`user:${session.user.id}:profile`,{limit:90});
    const runtime=effectivePublicRuntimeConfig(env,request.url);

    if(method==='GET'){
      const qelly=await bootstrapContext(env,session);
      return responseJson(request,env,profilePayload(qelly,runtime,session.user?.identities,verifiedIdentityDates(session.user),env.QELLY_PRIVATE_AVATARS_VERIFIED==='true',env),200,{cookies:session.cookies,cache:'private, no-store'});
    }

    await requireCsrf(request);
    const body=await jsonBody(request);
    const patch={updated_at:new Date().toISOString()};
    if(Object.hasOwn(body,'displayName')){
      const displayName=cleanText(body.displayName,80);
      if(!displayName)throw new HttpError(400,'profile_display_name_invalid','Display name is required');
      patch.display_name=displayName;
    }
    if(Object.hasOwn(body,'baseCurrency'))patch.base_currency=safeCurrency(body.baseCurrency);
    if(Object.hasOwn(body,'timezone'))patch.timezone=safeTimezone(body.timezone);
    if(Object.hasOwn(body,'cloudSyncOptIn'))patch.cloud_sync_opt_in=Boolean(body.cloudSyncOptIn);
    if(Object.keys(patch).length===1)throw new HttpError(400,'profile_patch_empty','No supported profile fields were supplied');

    const rows=await restRequest(env,session.accessToken,`qelly_profiles?user_id=eq.${session.user.id}`,{
      method:'PATCH',body:patch,prefer:'return=representation'
    });
    if(!rows?.length)throw new HttpError(404,'profile_not_found','Profile was not found');
    const qelly=await bootstrapContext(env,session);
    return responseJson(request,env,{updated:true,...profilePayload(qelly,runtime,session.user?.identities,verifiedIdentityDates(session.user),env.QELLY_PRIVATE_AVATARS_VERIFIED==='true',env)},200,{cookies:session.cookies,cache:'private, no-store'});
  }catch(error){return errorResponse(request,env,error);}
}

export const __profileRouteTest=Object.freeze({BASE_CURRENCIES,IDENTITY_PROVIDER_LABELS,sanitizedLinkedIdentities,safeTimezone,safeCurrency,identityDate,verifiedIdentityDates,profilePayload});
