import crypto from 'node:crypto';

export function randomToken(bytes=32){return crypto.randomBytes(bytes).toString('base64url');}
export function sha256(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
export function hmacSha256(key,value,encoding='base64url'){return crypto.createHmac('sha256',key).update(String(value)).digest(encoding);}
export function timingSafeEqualText(a,b){
  const left=Buffer.from(String(a)); const right=Buffer.from(String(b));
  if(left.length!==right.length)return false;
  return crypto.timingSafeEqual(left,right);
}
export function normalizeEmail(value){return String(value??'').trim().toLowerCase();}
export function nowIso(){return new Date().toISOString();}
export function addMsIso(ms){return new Date(Date.now()+ms).toISOString();}
