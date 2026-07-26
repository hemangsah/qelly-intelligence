import crypto from 'node:crypto';

const b64url=(value)=>Buffer.from(value).toString('base64url');
const unb64url=(value)=>Buffer.from(String(value),'base64url');
const derive=(value)=>crypto.createHash('sha256').update(String(value)).digest();

export class AesGcmSecretProtector{
  constructor({key,context='qelly-release-a3',nodeEnv=process.env.NODE_ENV}={}){
    if(!key){
      if(nodeEnv==='production')throw Object.assign(new Error('A production secret-protection key is required'),{code:'secret_protection_key_missing'});
      key='qelly-development-secret-protector-change-before-production-2026';
    }
    this.key=derive(key);
    this.context=String(context);
    this.mode=nodeEnv==='production'?'aes-256-gcm-configured':'aes-256-gcm-development';
  }
  protect(value,{purpose='generic'}={}){
    const iv=crypto.randomBytes(12);
    const cipher=crypto.createCipheriv('aes-256-gcm',this.key,iv);
    const aad=Buffer.from(`${this.context}:${purpose}`);
    cipher.setAAD(aad);
    const ciphertext=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
    const tag=cipher.getAuthTag();
    return `qelly:v1:${b64url(iv)}:${b64url(tag)}:${b64url(ciphertext)}`;
  }
  unprotect(envelope,{purpose='generic'}={}){
    const text=String(envelope??'');
    if(!text.startsWith('qelly:v1:'))return text;
    const [,version,ivEncoded,tagEncoded,cipherEncoded]=text.split(':');
    if(version!=='v1'||!ivEncoded||!tagEncoded||!cipherEncoded)throw Object.assign(new Error('Secret envelope is malformed'),{code:'secret_envelope_invalid'});
    const decipher=crypto.createDecipheriv('aes-256-gcm',this.key,unb64url(ivEncoded));
    decipher.setAAD(Buffer.from(`${this.context}:${purpose}`));
    decipher.setAuthTag(unb64url(tagEncoded));
    return Buffer.concat([decipher.update(unb64url(cipherEncoded)),decipher.final()]).toString('utf8');
  }
}

export class VersionedKeyringSecretProtector{
  constructor({keys,activeKeyId='dev-2026-01',context='qelly-release-a5',legacyKey=null,nodeEnv=process.env.NODE_ENV}={}){
    const normalized=new Map();
    for(const [keyId,value] of Object.entries(keys??{})){
      if(!/^[a-zA-Z0-9._-]{3,64}$/.test(keyId))throw Object.assign(new Error('Secret key ID is invalid'),{code:'secret_key_id_invalid'});
      if(String(value??'').length<24)throw Object.assign(new Error(`Secret key ${keyId} must contain at least 24 characters`),{code:'secret_key_material_invalid'});
      normalized.set(keyId,derive(value));
    }
    if(!normalized.size){
      if(nodeEnv==='production')throw Object.assign(new Error('A production secret keyring is required'),{code:'secret_keyring_missing'});
      normalized.set(activeKeyId,derive('qelly-development-keyring-active-key-change-before-production-2026'));
    }
    if(!normalized.has(activeKeyId))throw Object.assign(new Error('Active secret key is not present in the keyring'),{code:'secret_active_key_missing'});
    this.keys=normalized;this.activeKeyId=activeKeyId;this.context=String(context);this.legacy=legacyKey?new AesGcmSecretProtector({key:legacyKey,context:'qelly-release-a3',nodeEnv}):null;
    this.mode=nodeEnv==='production'?'aes-256-gcm-keyring-configured':'aes-256-gcm-keyring-development';
  }
  status(){return {mode:this.mode,activeKeyId:this.activeKeyId,keyIds:[...this.keys.keys()],keyCount:this.keys.size,envelopeVersion:'v2',rotationSupported:true,keyMaterialExposed:false};}
  keyIdOf(envelope){const parts=String(envelope??'').split(':');return parts[0]==='qelly'&&parts[1]==='v2'?parts[2]:parts[0]==='qelly'&&parts[1]==='v1'?'legacy-v1':'plaintext-or-unknown';}
  protect(value,{purpose='generic'}={}){
    const iv=crypto.randomBytes(12),key=this.keys.get(this.activeKeyId);
    const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(`${this.context}:${purpose}:${this.activeKeyId}`));
    const ciphertext=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]),tag=cipher.getAuthTag();
    return `qelly:v2:${this.activeKeyId}:${b64url(iv)}:${b64url(tag)}:${b64url(ciphertext)}`;
  }
  unprotect(envelope,{purpose='generic'}={}){
    const text=String(envelope??'');
    if(text.startsWith('qelly:v1:')){
      if(!this.legacy)throw Object.assign(new Error('Legacy envelope key is unavailable'),{code:'secret_legacy_key_unavailable'});
      return this.legacy.unprotect(text,{purpose});
    }
    if(!text.startsWith('qelly:v2:'))return text;
    const [,version,keyId,ivEncoded,tagEncoded,cipherEncoded]=text.split(':');
    if(version!=='v2'||!keyId||!ivEncoded||!tagEncoded||!cipherEncoded)throw Object.assign(new Error('Versioned secret envelope is malformed'),{code:'secret_envelope_invalid'});
    const key=this.keys.get(keyId);if(!key)throw Object.assign(new Error(`Secret key ${keyId} is unavailable`),{code:'secret_key_unavailable',details:{keyId}});
    const decipher=crypto.createDecipheriv('aes-256-gcm',key,unb64url(ivEncoded));decipher.setAAD(Buffer.from(`${this.context}:${purpose}:${keyId}`));decipher.setAuthTag(unb64url(tagEncoded));
    return Buffer.concat([decipher.update(unb64url(cipherEncoded)),decipher.final()]).toString('utf8');
  }
  rewrap(envelope,{purpose='generic'}={}){return this.protect(this.unprotect(envelope,{purpose}),{purpose});}
}

export function createSecretProtector({environment=process.env}={}){
  const raw=environment.QELLY_SECRET_KEYRING_JSON;
  if(raw){
    let keys;try{keys=JSON.parse(raw);}catch{throw Object.assign(new Error('QELLY_SECRET_KEYRING_JSON must be valid JSON'),{code:'secret_keyring_json_invalid'});}
    return new VersionedKeyringSecretProtector({keys,activeKeyId:environment.QELLY_SECRET_ACTIVE_KEY_ID??Object.keys(keys)[0],legacyKey:environment.QELLY_SECRET_PROTECTION_KEY??environment.QELLY_MFA_ENCRYPTION_KEY,nodeEnv:environment.NODE_ENV});
  }
  if(environment.QELLY_SECRET_ACTIVE_KEY_ID||environment.QELLY_SECRET_ROTATION_KEY){
    const activeKeyId=environment.QELLY_SECRET_ACTIVE_KEY_ID??'active-2026-01';
    return new VersionedKeyringSecretProtector({keys:{[activeKeyId]:environment.QELLY_SECRET_ROTATION_KEY??environment.QELLY_SECRET_PROTECTION_KEY??environment.QELLY_MFA_ENCRYPTION_KEY??'qelly-development-keyring-active-key-change-before-production-2026'},activeKeyId,legacyKey:environment.QELLY_SECRET_PROTECTION_KEY??environment.QELLY_MFA_ENCRYPTION_KEY,nodeEnv:environment.NODE_ENV});
  }
  return new AesGcmSecretProtector({key:environment.QELLY_SECRET_PROTECTION_KEY??environment.QELLY_MFA_ENCRYPTION_KEY,nodeEnv:environment.NODE_ENV});
}
