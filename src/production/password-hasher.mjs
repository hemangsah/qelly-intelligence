import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { timingSafeEqualText } from './crypto-utils.mjs';

const scrypt=promisify(crypto.scrypt);
const DEFAULTS={N:1<<15,r:8,p:1,keylen:64,maxmem:128*1024*1024};

export function validatePasswordPolicy(password){
  const value=String(password??'');
  const errors=[];
  if(value.length<12)errors.push('minimum-12-characters');
  if(value.length>128)errors.push('maximum-128-characters');
  if(!/[a-z]/.test(value))errors.push('lowercase-required');
  if(!/[A-Z]/.test(value))errors.push('uppercase-required');
  if(!/[0-9]/.test(value))errors.push('number-required');
  if(!/[^A-Za-z0-9]/.test(value))errors.push('symbol-required');
  return {valid:errors.length===0,errors};
}

export async function hashPassword(password,{pepper='',params=DEFAULTS}={}){
  const policy=validatePasswordPolicy(password);
  if(!policy.valid)throw Object.assign(new Error(`Password policy failed: ${policy.errors.join(', ')}`),{status:400,code:'password_policy_failed',details:policy});
  const salt=crypto.randomBytes(24);
  const derived=await scrypt(`${password}${pepper}`,salt,params.keylen,{N:params.N,r:params.r,p:params.p,maxmem:params.maxmem});
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password,encoded,{pepper=''}={}){
  const parts=String(encoded??'').split('$');
  if(parts.length!==6||parts[0]!=='scrypt')return false;
  const [,n,r,p,saltText,hashText]=parts;
  const params={N:Number(n),r:Number(r),p:Number(p),keylen:Buffer.from(hashText,'base64url').length,maxmem:128*1024*1024};
  if(!Number.isInteger(params.N)||params.N<16384||params.N>262144)return false;
  const derived=await scrypt(`${password}${pepper}`,Buffer.from(saltText,'base64url'),params.keylen,{N:params.N,r:params.r,p:params.p,maxmem:params.maxmem});
  return timingSafeEqualText(Buffer.from(derived).toString('base64url'),hashText);
}
