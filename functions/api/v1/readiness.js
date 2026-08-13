import {publicRuntimeConfig,responseJson} from '../../_lib/runtime.js';

export async function onRequestGet({request,env}){
  const runtime=publicRuntimeConfig(env,request.url);
  const emailReady=runtime.capabilities.emailDelivery===true;
  return responseJson(request,env,{
    ready:false,
    status:'not_proven',
    reason:'RLS isolation and provider freshness canaries remain required before full production readiness can be asserted.',
    dependencies:{
      supabase:'configured_not_canaried',
      auth:emailReady?'email_delivery_configured':'email_delivery_not_configured',
      rls:'required_not_live_proven',
      providers:'restricted_by_rights_review'
    },
    releaseSha:runtime.releaseSha
  },503);
}
