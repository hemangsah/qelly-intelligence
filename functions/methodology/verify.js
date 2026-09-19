export function onRequest({request,env}){
  const url=new URL(request.url);
  const target=new URL('/#/qelly-verify',url.origin);
  const headers=new Headers({
    Location:target.toString(),
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'X-Qelly-Release':String(env.QELLY_PUBLIC_RELEASE_SHA||env.CF_PAGES_COMMIT_SHA||'unresolved')
  });
  return new Response(null,{status:308,headers});
}
