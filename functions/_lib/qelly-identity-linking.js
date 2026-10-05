import {HttpError,UUID} from './runtime.js';
import {approvedOAuthProvider,enabledOAuthProviders,oauthAuthorizeUrl} from './qelly-oauth-providers.js';
import {authenticationEvidence} from './qelly-session-evidence.js';
export {authenticationEvidence,sessionAuthenticationMethod} from './qelly-session-evidence.js';

export const LINK_TTL_MS=10*60*1000;
// Only claims from a session independently accepted by GoTrue may reach here.
// Token issuance/refresh and user metadata are not evidence of a recent sign-in.
export const linkingProviders=(env={})=>env.QELLY_MANUAL_IDENTITY_LINKING_VERIFIED==='true'?enabledOAuthProviders(env):[];
export const requireRecentLinkSession=(session,now=Date.now())=>{
  const evidence=authenticationEvidence(session?.claims,now);
  if(!UUID.test(String(session?.user?.id||''))||!UUID.test(String(session?.claims?.session_id||''))||session?.claims?.sub!==session.user.id||session?.user?.is_anonymous===true||session?.claims?.is_anonymous===true||!evidence||!['password','oauth','otp','magiclink'].includes(evidence.method)||now-evidence.timestamp*1000>LINK_TTL_MS){
    throw new HttpError(403,'identity_link_reauthentication_required','Sign in again before connecting another identity. A recent verified sign-in is required.');
  }
  return {userId:session.user.id,sessionId:session.claims.session_id};
};
export const assertLinkSession=(transaction,session,now=Date.now())=>{
  const binding=requireRecentLinkSession(session,now);
  if(transaction?.flow!=='oauth-link'||transaction.userId!==binding.userId||transaction.sessionId!==binding.sessionId||typeof transaction.issuedAt!=='number'||now-transaction.issuedAt>LINK_TTL_MS||transaction.issuedAt>now+30_000||!approvedOAuthProvider(transaction.provider)){
    throw new HttpError(403,'identity_link_session_mismatch','The linking transaction no longer belongs to this signed-in browser. Start again from your profile.');
  }
};
export const identityLinkAuthorizePath=(config,transaction,provider)=>{
  const url=new URL(oauthAuthorizeUrl(config,transaction,provider));
  url.pathname='/auth/v1/user/identities/authorize';
  const redirect=new URL(url.searchParams.get('redirect_to'));
  redirect.searchParams.set('flow','oauth-link');
  url.searchParams.set('redirect_to',redirect.toString());
  url.searchParams.set('skip_http_redirect','true');
  return url.pathname+url.search;
};
// GoTrue returns the provider consent URL, not the ordinary sign-in endpoint.
// Pin the consent destination, callback origin and an identity-only scope subset.
export const validatedIdentityConsentUrl=(value,provider,config)=>{
  const selected=approvedOAuthProvider(provider);
  if(!selected||typeof value!=='string'||value.length>16_384)throw new HttpError(502,'identity_link_consent_invalid','The identity consent destination could not be verified');
  let url;try{url=new URL(value);}catch{throw new HttpError(502,'identity_link_consent_invalid','The identity consent destination could not be verified');}
  const destinations={google:['https://accounts.google.com',/^\/o\/oauth2\/(?:v2\/)?auth$/],apple:['https://appleid.apple.com',/^\/auth\/authorize$/],linkedin:['https://www.linkedin.com',/^\/oauth\/v2\/authorization$/],facebook:['https://www.facebook.com',/^\/(?:v\d+\.\d+\/)?dialog\/oauth$/]};
  const [origin,path]=destinations[provider];
  const allowed=provider==='google'?new Set(['openid','email','profile','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile']):new Set(selected.scopes.split(' '));
  const scopes=String(url.searchParams.get('scope')||'').split(/[\s,]+/).filter(Boolean);
  const callback=new URL('/auth/v1/callback',config.supabaseUrl).toString();
  if(url.origin!==origin||!path.test(url.pathname)||url.username||url.password||url.hash||url.searchParams.getAll('scope').length!==1||!scopes.length||scopes.some(scope=>!allowed.has(scope))||url.searchParams.getAll('redirect_uri').length!==1||url.searchParams.get('redirect_uri')!==callback||!url.searchParams.get('state')||!url.searchParams.get('client_id'))throw new HttpError(502,'identity_link_consent_invalid','The identity consent destination or minimum scopes could not be verified');
  return url.toString();
};
