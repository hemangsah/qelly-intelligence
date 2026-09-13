const STATIC_SECURITY=Object.freeze({
  'Content-Security-Policy':"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests",
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Cross-Origin-Opener-Policy':'same-origin',
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains; preload'
});
const LEGACY_PRODUCTION_HOST='qelly-intelligence.pages.dev';
const CANONICAL_PRODUCTION_ORIGIN='https://terminal.qellyintelligence.com';
const applySecurityHeaders=(response,context)=>{
  const next=new Response(response.body,response);
  for(const [name,value] of Object.entries(STATIC_SECURITY))if(!next.headers.has(name))next.headers.set(name,value);
  next.headers.set('X-Qelly-Release',String(context.env.QELLY_PUBLIC_RELEASE_SHA||context.env.CF_PAGES_COMMIT_SHA||'unresolved'));
  return next;
};
export async function onRequest(context){
  const requestUrl=new URL(context.request.url);
  if(requestUrl.hostname===LEGACY_PRODUCTION_HOST){
    const canonical=new URL(requestUrl.pathname+requestUrl.search,CANONICAL_PRODUCTION_ORIGIN);
    return applySecurityHeaders(new Response(null,{status:308,headers:{Location:canonical.toString(),'Cache-Control':'public, max-age=300'}}),context);
  }
  return applySecurityHeaders(await context.next(),context);
}
