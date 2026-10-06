// Use only after GoTrue has independently verified the access token and user.
// Refresh time, email, linked-provider lists and user metadata do not prove the
// method or recency of this browser's authentication.
export const authenticationEvidence=(claims,now=Date.now())=>{
  const allowed=new Set(['password','oauth','otp','magiclink','sso/saml','recovery','invite','email/signup']);
  const rows=Array.isArray(claims?.amr)?claims.amr:[];
  const usable=rows.filter(row=>allowed.has(row?.method)&&typeof row.timestamp==='number'&&Number.isFinite(row.timestamp)&&row.timestamp>0&&row.timestamp*1000<=now+30_000);
  const latest=usable.reduce((a,b)=>!a||b.timestamp>a.timestamp?b:a,null);
  return latest?{method:latest.method,authenticatedAt:new Date(latest.timestamp*1000).toISOString(),timestamp:latest.timestamp}:null;
};
export const sessionAuthenticationMethod=claims=>{
  const method=authenticationEvidence(claims)?.method;
  return method==='password'?'supabase-email-password':method?`supabase-${method}`:null;
};
