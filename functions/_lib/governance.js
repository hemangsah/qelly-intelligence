import {
  cleanText,
  clearSessionCookies,
  jsonBody,
  requireCsrf,
  responseJson,
  restRequest
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

    // The database RPC is SECURITY DEFINER but can only target auth.uid().
    // This keeps the privileged operation inside Supabase and avoids exposing a
    // service-role credential to the Cloudflare Pages runtime.
    const deletion=resultObject(await restRequest(env,session.accessToken,'rpc/qelly_self_delete_account',{
      method:'POST',
      body:{
        p_reason:cleanText(body.reason,500)||null,
        p_privacy_version:privacyVersion,
        p_terms_version:termsVersion
      }
    }));

    return responseJson(request,env,{
      requested:deletion.requested===true,
      requestId:deletion.requestId||deletion.request_id||null,
      replayed:Boolean(deletion.replayed),
      identityDeleted:deletion.identityDeleted===true,
      identityDeletionStatus:deletion.identityDeletionStatus??null,
      evidenceCompleted:deletion.evidenceCompleted===true,
      evidenceError:deletion.evidenceError??null,
      status:deletion.status||'requested',
      completedAt:deletion.completedAt||null
    },202,{cookies:clearSessionCookies()});
  }

  return null;
}