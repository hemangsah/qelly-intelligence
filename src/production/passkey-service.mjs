import crypto from 'node:crypto';
import { addMsIso, normalizeEmail, randomToken } from './crypto-utils.mjs';

export const base64url=(value)=>Buffer.from(value).toString('base64url');
export const fromBase64url=(value)=>Buffer.from(String(value),'base64url');

function readLength(buffer,offset,additional){
  if(additional<24)return {length:additional,offset};
  if(additional===24)return {length:buffer.readUInt8(offset),offset:offset+1};
  if(additional===25)return {length:buffer.readUInt16BE(offset),offset:offset+2};
  if(additional===26)return {length:buffer.readUInt32BE(offset),offset:offset+4};
  if(additional===27){const n=buffer.readBigUInt64BE(offset);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('CBOR integer exceeds safe range');return {length:Number(n),offset:offset+8};}
  throw new Error('Indefinite CBOR lengths are not supported');
}

export function decodeCbor(buffer,start=0){
  const initial=buffer.readUInt8(start),major=initial>>5,additional=initial&31;
  let {length,offset}=readLength(buffer,start+1,additional);
  if(major===0)return {value:length,offset};
  if(major===1)return {value:-1-length,offset};
  if(major===2){const end=offset+length;return {value:buffer.subarray(offset,end),offset:end};}
  if(major===3){const end=offset+length;return {value:buffer.subarray(offset,end).toString('utf8'),offset:end};}
  if(major===4){const value=[];for(let i=0;i<length;i+=1){const decoded=decodeCbor(buffer,offset);value.push(decoded.value);offset=decoded.offset;}return {value,offset};}
  if(major===5){const value=new Map();for(let i=0;i<length;i+=1){const key=decodeCbor(buffer,offset);offset=key.offset;const item=decodeCbor(buffer,offset);offset=item.offset;value.set(key.value,item.value);}return {value,offset};}
  if(major===6){const tagged=decodeCbor(buffer,offset);return {value:tagged.value,offset:tagged.offset};}
  if(major===7){if(additional===20)return {value:false,offset};if(additional===21)return {value:true,offset};if(additional===22)return {value:null,offset};}
  throw new Error(`Unsupported CBOR major type ${major}`);
}

export function parseAuthenticatorData(buffer){
  if(buffer.length<37)throw new Error('Authenticator data is too short');
  const rpIdHash=buffer.subarray(0,32),flags=buffer.readUInt8(32),signCount=buffer.readUInt32BE(33);
  let offset=37,attestedCredential=null;
  if(flags&0x40){
    if(buffer.length<offset+18)throw new Error('Attested credential data is incomplete');
    const aaguid=buffer.subarray(offset,offset+16);offset+=16;
    const credentialIdLength=buffer.readUInt16BE(offset);offset+=2;
    const credentialId=buffer.subarray(offset,offset+credentialIdLength);offset+=credentialIdLength;
    const decoded=decodeCbor(buffer,offset);offset=decoded.offset;
    attestedCredential={aaguid,credentialId,coseKey:decoded.value};
  }
  return {rpIdHash,flags,signCount,attestedCredential,extensions:buffer.subarray(offset)};
}

function coseToJwk(cose){
  if(!(cose instanceof Map))throw new Error('COSE key is not a map');
  const kty=cose.get(1),alg=cose.get(3),crv=cose.get(-1),x=cose.get(-2),y=cose.get(-3);
  if(kty!==2||alg!==-7||crv!==1||!Buffer.isBuffer(x)||!Buffer.isBuffer(y))throw Object.assign(new Error('Only ES256 P-256 passkeys are supported in this release'),{status:400,code:'passkey_algorithm_unsupported'});
  return {kty:'EC',crv:'P-256',x:base64url(x),y:base64url(y),ext:true,key_ops:['verify']};
}

function parseClientData(encoded){
  let value;try{value=JSON.parse(fromBase64url(encoded).toString('utf8'));}catch{throw Object.assign(new Error('Passkey client data is malformed'),{status:400,code:'passkey_client_data_invalid'});}
  return value;
}

function assertExpected(value,expected,code,message){if(value!==expected)throw Object.assign(new Error(message),{status:400,code});}
function rpHash(rpId){return crypto.createHash('sha256').update(rpId).digest();}
function equalBuffer(a,b){return a.length===b.length&&crypto.timingSafeEqual(a,b);}

export class PasskeyService{
  constructor({repository,auditLedger,rpId='localhost',rpName='Qelly Intelligence',allowedOrigins=['http://localhost:4480','http://127.0.0.1:4480'],challengeTtlMs=5*60*1000}={}){
    this.repository=repository;this.auditLedger=auditLedger;this.rpId=rpId;this.rpName=rpName;this.allowedOrigins=new Set(allowedOrigins);this.challengeTtlMs=challengeTtlMs;
  }
  normalizeOrigin(origin){const value=String(origin??'').replace(/\/$/,'');if(!this.allowedOrigins.has(value))throw Object.assign(new Error('Passkey origin is not allowed'),{status:400,code:'passkey_origin_invalid'});return value;}
  rpIdForOrigin(origin){const host=new URL(origin).hostname;if(['localhost','127.0.0.1'].includes(host))return host;if(host===this.rpId||host.endsWith(`.${this.rpId}`))return this.rpId;throw Object.assign(new Error('Origin is outside the configured relying-party domain'),{status:400,code:'passkey_rp_origin_invalid'});}
  async list(userId){const items=await this.repository.listPasskeys(userId);return items.map((item)=>({credentialId:item.credential_id,label:item.label,transports:item.transports??[],signCount:Number(item.sign_count??0),createdAt:item.created_at,lastUsedAt:item.last_used_at??null}));}
  async beginRegistration(user,{origin,label='Qelly passkey'}={}){
    const normalizedOrigin=this.normalizeOrigin(origin),relyingPartyId=this.rpIdForOrigin(normalizedOrigin),challenge=randomToken(32);
    const record=await this.repository.createAuthChallenge({userId:user.userId,email:user.primaryEmail,kind:'passkey-register',challenge,metadata:{origin:normalizedOrigin,rpId:relyingPartyId,label:String(label).slice(0,80)},expiresAt:addMsIso(this.challengeTtlMs)});
    const excludeCredentials=(await this.repository.listPasskeys(user.userId)).map((item)=>({type:'public-key',id:item.credential_id,transports:item.transports??[]}));
    return {challengeId:record.challenge_id,publicKey:{challenge,rp:{id:relyingPartyId,name:this.rpName},user:{id:base64url(user.userId),name:user.primaryEmail,displayName:user.displayName??user.primaryEmail},pubKeyCredParams:[{type:'public-key',alg:-7}],timeout:this.challengeTtlMs,attestation:'none',authenticatorSelection:{residentKey:'preferred',userVerification:'preferred'},excludeCredentials}};
  }
  async verifyRegistration(user,{challengeId,credential},correlationId){
    const challenge=await this.repository.getAuthChallenge(challengeId);if(!challenge||challenge.kind!=='passkey-register'||challenge.user_id!==user.userId||challenge.used_at||Date.parse(challenge.expires_at)<=Date.now())throw Object.assign(new Error('Passkey registration challenge is invalid or expired'),{status:400,code:'passkey_challenge_invalid'});
    const client=parseClientData(credential?.response?.clientDataJSON);assertExpected(client.type,'webauthn.create','passkey_type_invalid','Unexpected passkey ceremony type');assertExpected(client.challenge,challenge.challenge,'passkey_challenge_mismatch','Passkey challenge does not match');assertExpected(client.origin,challenge.metadata.origin,'passkey_origin_invalid','Passkey origin does not match');
    const attestation=decodeCbor(fromBase64url(credential?.response?.attestationObject)).value;if(!(attestation instanceof Map))throw Object.assign(new Error('Attestation object is malformed'),{status:400,code:'passkey_attestation_invalid'});
    const fmt=attestation.get('fmt'),authData=attestation.get('authData');if(fmt!=='none')throw Object.assign(new Error('This release accepts privacy-preserving none attestation only'),{status:400,code:'passkey_attestation_format_unsupported'});if(!Buffer.isBuffer(authData))throw Object.assign(new Error('Authenticator data is missing'),{status:400,code:'passkey_authenticator_data_invalid'});
    const parsed=parseAuthenticatorData(authData);if(!equalBuffer(parsed.rpIdHash,rpHash(challenge.metadata.rpId)))throw Object.assign(new Error('Passkey relying-party hash does not match'),{status:400,code:'passkey_rp_mismatch'});if(!(parsed.flags&0x01))throw Object.assign(new Error('Passkey user-presence flag is missing'),{status:400,code:'passkey_user_presence_missing'});if(!parsed.attestedCredential)throw Object.assign(new Error('Attested credential data is missing'),{status:400,code:'passkey_credential_missing'});
    const credentialId=base64url(parsed.attestedCredential.credentialId);if(credential?.id&&credential.id!==credentialId)throw Object.assign(new Error('Credential identifier mismatch'),{status:400,code:'passkey_credential_mismatch'});
    const stored=await this.repository.createPasskey({credentialId,userId:user.userId,publicKeyJwk:coseToJwk(parsed.attestedCredential.coseKey),signCount:parsed.signCount,transports:credential?.response?.transports??credential?.transports??[],label:challenge.metadata.label});await this.repository.consumeAuthChallenge(challengeId);
    await this.auditLedger?.append({eventType:'auth.passkey.registered.v1',correlationId,actor:{type:'user',id:user.userId},outcome:'success',details:{credentialId,algorithm:'ES256',attestation:'none'}});
    return {credentialId:stored.credential_id,label:stored.label,createdAt:stored.created_at};
  }
  async beginAuthentication({email,origin}){
    const normalizedEmail=normalizeEmail(email),user=await this.repository.findUserByEmail(normalizedEmail);const normalizedOrigin=this.normalizeOrigin(origin),relyingPartyId=this.rpIdForOrigin(normalizedOrigin);
    // Return the same public shape for unknown users to reduce account enumeration.
    const passkeys=user?await this.repository.listPasskeys(user.user_id):[];const challenge=randomToken(32);
    const record=await this.repository.createAuthChallenge({userId:user?.user_id??null,email:normalizedEmail,kind:'passkey-authenticate',challenge,metadata:{origin:normalizedOrigin,rpId:relyingPartyId},expiresAt:addMsIso(this.challengeTtlMs)});
    return {challengeId:record.challenge_id,publicKey:{challenge,rpId:relyingPartyId,timeout:this.challengeTtlMs,userVerification:'preferred',allowCredentials:passkeys.map((item)=>({type:'public-key',id:item.credential_id,transports:item.transports??[]}))}};
  }
  async verifyAuthentication({challengeId,credential},correlationId){
    const challenge=await this.repository.getAuthChallenge(challengeId);if(!challenge||challenge.kind!=='passkey-authenticate'||challenge.used_at||Date.parse(challenge.expires_at)<=Date.now())throw Object.assign(new Error('Passkey authentication challenge is invalid or expired'),{status:400,code:'passkey_challenge_invalid'});
    const credentialId=credential?.id??credential?.rawId;const stored=credentialId?await this.repository.getPasskey(credentialId):null;if(!stored||stored.user_id!==challenge.user_id)throw Object.assign(new Error('Passkey credential was not recognized'),{status:401,code:'passkey_credential_unknown'});
    const client=parseClientData(credential?.response?.clientDataJSON);assertExpected(client.type,'webauthn.get','passkey_type_invalid','Unexpected passkey ceremony type');assertExpected(client.challenge,challenge.challenge,'passkey_challenge_mismatch','Passkey challenge does not match');assertExpected(client.origin,challenge.metadata.origin,'passkey_origin_invalid','Passkey origin does not match');
    const authenticatorData=fromBase64url(credential?.response?.authenticatorData),parsed=parseAuthenticatorData(authenticatorData);if(!equalBuffer(parsed.rpIdHash,rpHash(challenge.metadata.rpId)))throw Object.assign(new Error('Passkey relying-party hash does not match'),{status:400,code:'passkey_rp_mismatch'});if(!(parsed.flags&0x01))throw Object.assign(new Error('Passkey user-presence flag is missing'),{status:400,code:'passkey_user_presence_missing'});
    const clientHash=crypto.createHash('sha256').update(fromBase64url(credential.response.clientDataJSON)).digest();const signed=Buffer.concat([authenticatorData,clientHash]);const key=crypto.createPublicKey({key:stored.publicKeyJwk,format:'jwk'});const valid=crypto.verify('sha256',signed,key,fromBase64url(credential.response.signature));if(!valid)throw Object.assign(new Error('Passkey signature verification failed'),{status:401,code:'passkey_signature_invalid'});
    const oldCount=Number(stored.sign_count??0);if(oldCount>0&&parsed.signCount>0&&parsed.signCount<=oldCount)throw Object.assign(new Error('Passkey signature counter did not advance'),{status:401,code:'passkey_counter_replay'});
    await this.repository.updatePasskeyCounter(credentialId,parsed.signCount);await this.repository.consumeAuthChallenge(challengeId);await this.auditLedger?.append({eventType:'auth.passkey.authenticated.v1',correlationId,actor:{type:'user',id:stored.user_id},outcome:'success',details:{credentialId,signCount:parsed.signCount}});return {userId:stored.user_id,credentialId,assurance:'high',authenticationMethod:'passkey'};
  }
  async revoke(user,credentialId,correlationId){const stored=await this.repository.getPasskey(credentialId);if(!stored||stored.user_id!==user.userId)throw Object.assign(new Error('Passkey not found'),{status:404,code:'passkey_not_found'});const result=await this.repository.revokePasskey({credentialId,userId:user.userId});await this.auditLedger?.append({eventType:'auth.passkey.revoked.v1',correlationId,actor:{type:'user',id:user.userId},outcome:'success',details:{credentialId}});return result;}
}
