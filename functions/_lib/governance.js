import {
  cleanText,
  clearSessionCookies,
  fetcher,
  jsonBody,
  publicRuntimeConfig,
  requireCsrf,
  responseJson,
  restRequest,
  supabaseRequest
} from './runtime.js';

const resultObject=(payload)=>Array.isArray(payload)?(payload[0]||{}):(payload||{});
const policyVersion=(value,fallback)=>cleanText(value||fallback,64)||fallback;

export async function handleGovernance(context,path,method,session,qelly){
  const {request,env}=context;

  if(path==='cloud/opt-in'&&method==='POST'){
    await requireCsrf(request);
    const body=await jsonBody(request);
    const enabled=Boolean(body.enabled);
    const privacyVersion=policyVersion(body.privacyVersion,qelly.profile?.privacy_version||'2026-08-01');
    const termsVersion=policyVersion(body.termsVersion,qelly.profile?.terms_version||'2026-08-01');
    const evidence=resultObject(await restRequest(env,session.accessToken,'rpc/qelly_set_cloud_sync_consent',{
      method:'POST',
      body:{
        p_enabled:enabled,
        p_privacy_version:privacyVersion,
        p_terms_version:termsVersion
      }
    }));
    return responseJson(request,env,{enabled,evidence});
  }

  if(path==='account/delete'&&method==='POST'){
    await requireCsrf(request);
    const body=await jsonBody(request);
    const privacyVersion=policyVersion(body.privacyVersion,qelly.profile?.privacy_version||'2026-08-01');
    const termsVersion=policyVersion(body.termsVersion,qelly.profile?.terms_version||'2026-08-01');
    const requested=resultObject(await restRequest(env,session.accessToken,'rpc/qelly_request_account_deletion',{
      method:'POST',
      body:{
        p_reason:cleanText(body.reason,500)||null,
        p_privacy_version:privacyVersion,
        p_terms_version:termsVersion
      }
    }));

    let identityDeleted=false;
    let evidenceCompleted=false;
    let identityDeletionStatus=null;
    let evidenceError=null;
    const requestId=String(requested.requestId||requested.request_id||'');

    if(env.QELLY_SUPABASE_SERVICE_ROLE_KEY&&requestId){
      const config=publicRuntimeConfig(env,request.url);
      const serviceKey=String(env.QELLY_SUPABASE_SERVICE_ROLE_KEY);
      const response=await fetcher(env)(`${config.supabaseUrl}/auth/v1/admin/users/${session.user.id}`,{
        method:'DELETE',
        headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`}
      });
      identityDeletionStatus=response.status;
      identityDeleted=response.ok;

      if(identityDeleted){
        try{
          await supabaseRequest(env,'/rest/v1/rpc/qelly_complete_account_deletion',{
            method:'POST',
            token:serviceKey,
            headers:{apikey:serviceKey},
            body:{
              p_request_id:requestId,
              p_metadata:{
                identityDeletionStatus,
                completedBy:'qelly-cloudflare-facade'
              }
            }
          });
          evidenceCompleted=true;
        }catch(error){
          evidenceError=String(error?.code||'deletion_evidence_completion_failed');
        }
      }
    }

    const status=identityDeleted
      ?(evidenceCompleted?'completed':'identity_deleted_evidence_pending')
      :'requested';

    return responseJson(request,env,{
      requested:true,
      requestId:requestId||null,
      replayed:Boolean(requested.replayed),
      identityDeleted,
      identityDeletionStatus,
      evidenceCompleted,
      evidenceError,
      status
    },202,{cookies:clearSessionCookies()});
  }

  return null;
}
