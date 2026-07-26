import { hmacSha256, randomToken, timingSafeEqualText } from './crypto-utils.mjs';

export const SESSION_COOKIE='qelly_session';

export function parseCookies(header=''){
  const result={};
  for(const part of String(header).split(';')){
    const index=part.indexOf('='); if(index<1)continue;
    const key=part.slice(0,index).trim(); const raw=part.slice(index+1).trim();
    try{result[key]=decodeURIComponent(raw);}catch{result[key]=raw;}
  }
  return result;
}

export function signSessionToken(token,secret){return `${token}.${hmacSha256(secret,token)}`;}
export function verifySignedSession(value,secret){
  const text=String(value??''); const index=text.lastIndexOf('.'); if(index<1)return null;
  const token=text.slice(0,index),signature=text.slice(index+1); const expected=hmacSha256(secret,token);
  return timingSafeEqualText(signature,expected)?token:null;
}
export function issueSessionToken(secret){const token=randomToken(48);return {token,signed:signSessionToken(token,secret)};}
export function serializeSessionCookie(value,{secure=true,maxAgeSeconds=8*60*60,path='/',sameSite='Lax'}={}){
  const parts=[`${SESSION_COOKIE}=${encodeURIComponent(value)}`,`Path=${path}`,'HttpOnly',`SameSite=${sameSite}`,`Max-Age=${Math.max(0,Math.floor(maxAgeSeconds))}`];
  if(secure)parts.push('Secure');
  return parts.join('; ');
}
export function clearSessionCookie({secure=true,sameSite='Lax'}={}){return serializeSessionCookie('',{secure,sameSite,maxAgeSeconds:0});}
