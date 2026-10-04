/* Wave CR — minimum identity-only social login contract.
   These flags are operational attestations, not claims inferred from a public
   client ID. OAuth stays disabled until the provider has been configured and
   its callback/redirect allowlist verified outside the application. */
export const OAUTH_PROVIDERS=Object.freeze({
  google:Object.freeze({id:'google',label:'Google',supabaseProvider:'google',scopes:'openid email profile',flag:'QELLY_OAUTH_GOOGLE_VERIFIED'}),
  apple:Object.freeze({id:'apple',label:'Apple',supabaseProvider:'apple',scopes:'email name',flag:'QELLY_OAUTH_APPLE_VERIFIED'}),
  linkedin:Object.freeze({id:'linkedin',label:'LinkedIn',supabaseProvider:'linkedin_oidc',scopes:'openid email profile',flag:'QELLY_OAUTH_LINKEDIN_VERIFIED'}),
  facebook:Object.freeze({id:'facebook',label:'Facebook',supabaseProvider:'facebook',scopes:'email public_profile',flag:'QELLY_OAUTH_FACEBOOK_VERIFIED'})
});
export const approvedOAuthProvider=(id)=>Object.hasOwn(OAUTH_PROVIDERS,String(id||''))?OAUTH_PROVIDERS[id]:null;
export const enabledOAuthProviders=(env={})=>Object.values(OAUTH_PROVIDERS).filter(provider=>env[provider.flag]==='true');
export const publicOAuthProviders=(env={})=>enabledOAuthProviders(env).map(({id,label})=>({id,label}));
export function oauthAuthorizeUrl({supabaseUrl,publicSiteUrl},transaction,provider){
  const selected=approvedOAuthProvider(provider);
  if(!selected)throw new TypeError('Unsupported social identity provider');
  const base=new URL(String(supabaseUrl||''));
  const app=new URL(String(publicSiteUrl||''));
  if(base.protocol!=='https:'||app.protocol!=='https:'||base.username||base.password||app.username||app.password)throw new TypeError('HTTPS OAuth provider and application origins are required');
  if(!/^[0-9a-f]{64}$/i.test(String(transaction?.state||''))||!/^[0-9a-f]{64}$/i.test(String(transaction?.nonce||''))||!/^[A-Za-z0-9_-]{43}$/.test(String(transaction?.challenge||'')))throw new TypeError('Bound PKCE challenge and state are required');
  const redirect=new URL('/auth/callback.html',app.origin);
  redirect.searchParams.set('flow','oauth');
  redirect.searchParams.set('state',transaction.state);
  redirect.searchParams.set('nonce',transaction.nonce);
  const url=new URL('/auth/v1/authorize',base.origin);
  url.searchParams.set('provider',selected.supabaseProvider);
  url.searchParams.set('redirect_to',redirect.toString());
  url.searchParams.set('scopes',selected.scopes);
  url.searchParams.set('code_challenge',transaction.challenge);
  url.searchParams.set('code_challenge_method','s256');
  return url.toString();
}
