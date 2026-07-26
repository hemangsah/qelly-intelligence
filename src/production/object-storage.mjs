import {mkdir,writeFile,readFile,stat,rename,rm,rmdir} from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';

const safe=(s)=>String(s).replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120);
const sha256=(value,encoding='hex')=>crypto.createHash('sha256').update(value).digest(encoding);
const hmac=(key,value,encoding)=>crypto.createHmac('sha256',key).update(value).digest(encoding);
const truthy=(value,defaultValue=false)=>value==null?defaultValue:['1','true','yes','on'].includes(String(value).toLowerCase());

function normalizedInput(input,maxBytes){
  const buffer=Buffer.isBuffer(input.content)?input.content:Buffer.from(input.content??'');
  if(buffer.length>maxBytes)throw Object.assign(new Error(`File exceeds ${Math.floor(maxBytes/1024/1024)} MB limit`),{status:413,code:'file_too_large'});
  if(!input.tenantId||!input.workspaceId||!input.fileName)throw Object.assign(new Error('Object storage scope and filename are required'),{status:400,code:'object_input_invalid'});
  return {buffer,fileName:String(input.fileName),mimeType:input.mimeType??'application/octet-stream',tenantId:String(input.tenantId),workspaceId:String(input.workspaceId),sha256:sha256(buffer)};
}

export class FoundationMalwareScanner{
  constructor({blockedSignatures=['EICAR-STANDARD-ANTIVIRUS-TEST-FILE']}={}){this.blockedSignatures=blockedSignatures.map(x=>Buffer.from(x));this.mode='local-signature-foundation';}
  status(){return {mode:this.mode,configured:true,external:false,streaming:false,truthBoundary:'Deterministic local signature checks are not a substitute for a maintained malware-analysis service.'};}
  async health(){return {ok:true,...this.status(),liveProbe:false};}
  async scan(content){for(const signature of this.blockedSignatures)if(content.includes(signature))throw Object.assign(new Error('Malware signature detected'),{status:422,code:'malware_detected'});return {clean:true,scanner:this.mode,result:'clean'};}
}

export class ClamAvTcpScanner{
  constructor({host='127.0.0.1',port=3310,timeoutMs=10000,connect=net.createConnection}={}){this.host=host;this.port=Math.max(1,Math.min(Number(port)||3310,65535));this.timeoutMs=Math.max(1000,Math.min(Number(timeoutMs)||10000,60000));this.connect=connect;this.mode='clamav-tcp-instream';}
  status(){return {mode:this.mode,configured:true,external:true,host:this.host,port:this.port,streaming:true,truthBoundary:'Connectivity and signature freshness must be monitored in staging and production.'};}
  async health(){
    return new Promise((resolve)=>{
      let response='';const socket=this.connect({host:this.host,port:this.port});
      const finish=(result)=>{clearTimeout(timer);socket.destroy();resolve(result);};
      const timer=setTimeout(()=>finish({ok:false,...this.status(),error:'Malware scanner health check timed out'}),this.timeoutMs);
      socket.once('error',(error)=>finish({ok:false,...this.status(),error:`Malware scanner unavailable: ${error.message}`}));
      socket.on('data',(chunk)=>response+=chunk.toString('utf8'));
      socket.once('close',()=>finish(response.includes('PONG')?{ok:true,...this.status(),liveProbe:true}:{ok:false,...this.status(),error:'Malware scanner did not return PONG'}));
      socket.once('connect',()=>socket.end('zPING\0'));
    });
  }
  async scan(content){
    const buffer=Buffer.isBuffer(content)?content:Buffer.from(content);
    return new Promise((resolve,reject)=>{
      let response='';const socket=this.connect({host:this.host,port:this.port});
      const timer=setTimeout(()=>{socket.destroy();reject(Object.assign(new Error('Malware scanner timed out'),{status:503,code:'malware_scanner_timeout',retryable:true}));},this.timeoutMs);
      socket.once('error',error=>{clearTimeout(timer);reject(Object.assign(new Error(`Malware scanner unavailable: ${error.message}`),{status:503,code:'malware_scanner_unavailable',retryable:true}));});
      socket.on('data',chunk=>response+=chunk.toString('utf8'));
      socket.once('close',()=>{clearTimeout(timer);if(response.includes('FOUND'))reject(Object.assign(new Error('Malware scanner reported a threat'),{status:422,code:'malware_detected',details:{scannerResponse:response.trim()}}));else if(response.includes('OK'))resolve({clean:true,scanner:this.mode,result:response.trim()});else reject(Object.assign(new Error('Malware scanner returned an invalid response'),{status:502,code:'malware_scanner_response_invalid',details:{scannerResponse:response.trim()}}));});
      socket.once('connect',()=>{socket.write('zINSTREAM\0');for(let offset=0;offset<buffer.length;offset+=64*1024){const chunk=buffer.subarray(offset,offset+64*1024),size=Buffer.alloc(4);size.writeUInt32BE(chunk.length);socket.write(size);socket.write(chunk);}const end=Buffer.alloc(4);end.writeUInt32BE(0);socket.end(end);});
    });
  }
}

export function createMalwareScanner({environment=process.env}={}){
  const mode=environment.QELLY_MALWARE_SCANNER_MODE??'local-signature';
  if(mode==='clamav')return new ClamAvTcpScanner({host:environment.CLAMAV_HOST??'clamav',port:environment.CLAMAV_PORT??3310,timeoutMs:environment.CLAMAV_TIMEOUT_MS??10000});
  if(environment.NODE_ENV==='production'&&environment.QELLY_REQUIRE_EXTERNAL_MALWARE_SCANNER==='true'&&mode==='local-signature'&&environment.QELLY_ALLOW_FOUNDATION_SCANNER_IN_PRODUCTION!=='true')throw Object.assign(new Error('Production requires a configured malware-scanner provider'),{code:'production_malware_scanner_required'});
  return new FoundationMalwareScanner();
}

export class LocalObjectStorage{
  constructor({root,scanner=new FoundationMalwareScanner(),maxBytes=10*1024*1024}){this.root=root;this.scanner=scanner;this.maxBytes=maxBytes;this.mode='local-filesystem';}
  storagePath(key){const value=String(key);if(value.includes('..')||path.isAbsolute(value))throw Object.assign(new Error('Object key is invalid'),{status:400,code:'object_key_invalid'});const resolved=path.resolve(this.root,value);if(!resolved.startsWith(path.resolve(this.root)+path.sep))throw Object.assign(new Error('Object key is outside storage root'),{status:400,code:'object_key_invalid'});return resolved;}
  async cleanupQuarantineParents(key){const target=this.storagePath(key),root=path.resolve(this.root),quarantineRoot=path.join(root,'quarantine');let current=path.dirname(target);while(current.startsWith(quarantineRoot)&&current!==quarantineRoot){try{await rmdir(current);}catch(error){if(['ENOENT','ENOTEMPTY'].includes(error.code))break;throw error;}current=path.dirname(current);}}
  async quarantine(input){const item=normalizedInput(input,this.maxBytes);const key=`quarantine/${safe(item.tenantId)}/${safe(item.workspaceId)}/${crypto.randomUUID()}-${item.sha256}-${safe(item.fileName)}`;const target=this.storagePath(key);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,item.buffer,{flag:'wx'});return {key,fileName:item.fileName,mimeType:item.mimeType,size:item.buffer.length,sha256:item.sha256,scanner:this.scanner.mode,scanResult:'pending',status:'quarantined',quarantineStatus:'pending-review',provider:this.mode};}
  async rescan(key,{fileName=null,mimeType='application/octet-stream'}={}){if(!String(key).startsWith('quarantine/'))throw Object.assign(new Error('Only quarantined objects can be rescanned'),{status:409,code:'object_not_quarantined'});const source=this.storagePath(key),content=await readFile(source),scan=await this.scanner.scan(content),parts=String(key).split('/'),tenantId=parts[1],workspaceId=parts[2];const inferred=String(parts.at(-1)).split('-').slice(6).join('-')||'released-object.bin';const name=safe(fileName??inferred),hash=sha256(content),releasedKey=`released/${tenantId}/${workspaceId}/${hash}-${name}`,target=this.storagePath(releasedKey);await mkdir(path.dirname(target),{recursive:true});await rename(source,target).catch(async error=>{if(error.code==='EEXIST'){await rm(source,{force:true});return;}throw error;});await this.cleanupQuarantineParents(key);return {key:releasedKey,fileName:fileName??inferred,mimeType,size:content.length,sha256:hash,scanner:scan.scanner,scanResult:scan.result??'clean',status:'released',quarantineStatus:'released',provider:this.mode};}
  async discard(key){if(!String(key).startsWith('quarantine/'))throw Object.assign(new Error('Only quarantined objects can be discarded'),{status:409,code:'object_not_quarantined'});await rm(this.storagePath(key),{force:true});await this.cleanupQuarantineParents(key);return {key,status:'discarded'};}
  async put(input){const staged=await this.quarantine(input);return this.rescan(staged.key,{fileName:staged.fileName,mimeType:staged.mimeType});}
  async get(key){const target=this.storagePath(key);const [content,s]=await Promise.all([readFile(target),stat(target)]);return {content,size:s.size,provider:this.mode};}
  async delete(key){if(!String(key).startsWith('released/'))throw Object.assign(new Error('Only released objects can be deleted through this operation'),{status:409,code:'object_not_released'});await rm(this.storagePath(key),{force:true});return {key,status:'deleted'};}
  async signedDownload(key,{expiresSeconds=300}={}){if(!String(key).startsWith('released/'))throw Object.assign(new Error('Only released objects can be downloaded'),{status:409,code:'object_not_released'});return {mode:'authenticated-api-stream',key,expiresSeconds:Math.max(30,Math.min(Number(expiresSeconds)||300,900)),externalUrl:false};}
  async health(){try{await mkdir(this.root,{recursive:true});const scannerStatus=await this.scanner.health?.()??{ok:true,...this.scanner.status?.()};return {ok:Boolean(scannerStatus.ok),driver:this.mode,root:path.basename(this.root),scanner:this.scanner.mode,scannerStatus,quarantinePrefix:'quarantine/',releasedPrefix:'released/',private:true};}catch(error){return {ok:false,driver:this.mode,error:error.message};}}
}

function amzDate(date=new Date()){return date.toISOString().replace(/[:-]|\.\d{3}/g,'');}
function encodePath(value){return String(value).split('/').map(segment=>encodeURIComponent(segment).replace(/%2F/g,'/')).join('/');}
const awsEncode=(value)=>encodeURIComponent(String(value)).replace(/[!'()*]/g,(character)=>`%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const canonicalQuery=(parameters)=>[...parameters.entries()].map(([key,value])=>[awsEncode(key),awsEncode(value)]).sort(([aKey,aValue],[bKey,bValue])=>aKey.localeCompare(bKey)||aValue.localeCompare(bValue)).map(([key,value])=>`${key}=${value}`).join('&');

export class S3CompatibleObjectStorage{
  constructor({endpoint,bucket,region='us-east-1',accessKeyId,secretAccessKey,pathStyle=true,scanner=new FoundationMalwareScanner(),fetchImpl=globalThis.fetch,maxBytes=10*1024*1024}={}){
    if(!endpoint||!bucket||!accessKeyId||!secretAccessKey)throw Object.assign(new Error('S3 endpoint, bucket and credentials are required'),{code:'s3_configuration_missing'});this.endpoint=new URL(endpoint);this.bucket=bucket;this.region=region;this.accessKeyId=accessKeyId;this.secretAccessKey=secretAccessKey;this.pathStyle=pathStyle;this.scanner=scanner;this.fetch=fetchImpl;this.maxBytes=maxBytes;this.mode='s3-compatible-sigv4';
  }
  bucketUrl(){const url=new URL(this.endpoint);if(this.pathStyle)url.pathname=`/${encodePath(this.bucket)}/`;else url.hostname=`${this.bucket}.${url.hostname}`;return url;}
  objectUrl(key){const url=new URL(this.endpoint);if(this.pathStyle){url.pathname=`/${encodePath(this.bucket)}/${encodePath(key)}`;}else{url.hostname=`${this.bucket}.${url.hostname}`;url.pathname=`/${encodePath(key)}`;}return url;}
  signedHeaders({method,url,payloadHash,date=new Date(),contentType=null}){const timestamp=amzDate(date),day=timestamp.slice(0,8),host=url.host;const headers={'host':host,'x-amz-content-sha256':payloadHash,'x-amz-date':timestamp};if(contentType)headers['content-type']=contentType;const names=Object.keys(headers).sort();const canonicalHeaders=names.map(name=>`${name}:${String(headers[name]).trim()}\n`).join('');const canonicalRequest=[method,url.pathname,url.searchParams.toString(),canonicalHeaders,names.join(';'),payloadHash].join('\n');const scope=`${day}/${this.region}/s3/aws4_request`;const stringToSign=['AWS4-HMAC-SHA256',timestamp,scope,sha256(canonicalRequest)].join('\n');const kDate=hmac(Buffer.from(`AWS4${this.secretAccessKey}`),day);const kRegion=hmac(kDate,this.region);const kService=hmac(kRegion,'s3');const kSigning=hmac(kService,'aws4_request');const signature=hmac(kSigning,stringToSign,'hex');const authorization=`AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;const output={'Host':host,'X-Amz-Content-Sha256':payloadHash,'X-Amz-Date':timestamp,'Authorization':authorization};if(contentType)output['Content-Type']=contentType;return output;}
  async request(method,key,{body=null,mimeType=null,urlOverride=null}={}){const url=urlOverride??this.objectUrl(key),payload=body??Buffer.alloc(0),payloadHash=sha256(payload),headers=this.signedHeaders({method,url,payloadHash,contentType:mimeType});const response=await this.fetch(url,{method,headers,body:['GET','DELETE','HEAD'].includes(method)?undefined:payload,signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Object.assign(new Error(`S3 request failed with HTTP ${response.status}`),{status:502,code:'object_storage_request_failed',details:{status:response.status}});return response;}
  async quarantine(input){const item=normalizedInput(input,this.maxBytes),key=`quarantine/${safe(item.tenantId)}/${safe(item.workspaceId)}/${crypto.randomUUID()}-${item.sha256}-${safe(item.fileName)}`;await this.request('PUT',key,{body:item.buffer,mimeType:item.mimeType});return {key,fileName:item.fileName,mimeType:item.mimeType,size:item.buffer.length,sha256:item.sha256,scanner:this.scanner.mode,scanResult:'pending',status:'quarantined',quarantineStatus:'pending-review',provider:this.mode,bucket:this.bucket};}
  async rescan(key,{fileName=null,mimeType='application/octet-stream'}={}){if(!String(key).startsWith('quarantine/'))throw Object.assign(new Error('Only quarantined objects can be rescanned'),{status:409,code:'object_not_quarantined'});const staged=await this.get(key),scan=await this.scanner.scan(staged.content),parts=String(key).split('/'),tenantId=parts[1],workspaceId=parts[2],inferred=String(parts.at(-1)).split('-').slice(6).join('-')||'released-object.bin',name=safe(fileName??inferred),hash=sha256(staged.content),releasedKey=`released/${tenantId}/${workspaceId}/${hash}-${name}`;await this.request('PUT',releasedKey,{body:staged.content,mimeType});await this.request('DELETE',key);return {key:releasedKey,fileName:fileName??inferred,mimeType,size:staged.content.length,sha256:hash,scanner:scan.scanner,scanResult:scan.result??'clean',status:'released',quarantineStatus:'released',provider:this.mode,bucket:this.bucket};}
  async discard(key){if(!String(key).startsWith('quarantine/'))throw Object.assign(new Error('Only quarantined objects can be discarded'),{status:409,code:'object_not_quarantined'});await this.request('DELETE',key);return {key,status:'discarded'};}
  async put(input){const staged=await this.quarantine(input);try{return await this.rescan(staged.key,{fileName:staged.fileName,mimeType:staged.mimeType});}catch(error){error.details={...(error.details??{}),quarantineKey:staged.key,releaseBlocked:true};throw error;}}
  async get(key){const response=await this.request('GET',key);const content=Buffer.from(await response.arrayBuffer());return {content,size:content.length,provider:this.mode,bucket:this.bucket};}
  async delete(key){if(!String(key).startsWith('released/'))throw Object.assign(new Error('Only released objects can be deleted through this operation'),{status:409,code:'object_not_released'});await this.request('DELETE',key);return {key,status:'deleted'};}
  presignGet(key,{expiresSeconds=300,date=new Date()}={}){
    if(!String(key).startsWith('released/'))throw Object.assign(new Error('Only released objects can be downloaded'),{status:409,code:'object_not_released'});
    const expires=Math.max(30,Math.min(Number(expiresSeconds)||300,900)),url=this.objectUrl(key),timestamp=amzDate(date),day=timestamp.slice(0,8),scope=`${day}/${this.region}/s3/aws4_request`;
    url.searchParams.set('X-Amz-Algorithm','AWS4-HMAC-SHA256');url.searchParams.set('X-Amz-Credential',`${this.accessKeyId}/${scope}`);url.searchParams.set('X-Amz-Date',timestamp);url.searchParams.set('X-Amz-Expires',String(expires));url.searchParams.set('X-Amz-SignedHeaders','host');
    const canonicalRequest=['GET',url.pathname,canonicalQuery(url.searchParams),`host:${url.host}\n`,'host','UNSIGNED-PAYLOAD'].join('\n'),stringToSign=['AWS4-HMAC-SHA256',timestamp,scope,sha256(canonicalRequest)].join('\n'),kDate=hmac(Buffer.from(`AWS4${this.secretAccessKey}`),day),kRegion=hmac(kDate,this.region),kService=hmac(kRegion,'s3'),kSigning=hmac(kService,'aws4_request'),signature=hmac(kSigning,stringToSign,'hex');url.searchParams.set('X-Amz-Signature',signature);
    return {url:url.toString(),expiresAt:new Date(date.getTime()+expires*1000).toISOString(),expiresSeconds:expires,method:'GET'};
  }
  async signedDownload(key,options={}){return this.presignGet(key,options);}
  async health(){
    try{
      const bucketUrl=this.bucketUrl();
      await this.request('HEAD','',{urlOverride:bucketUrl});
      const anonymousUrl=new URL(bucketUrl);anonymousUrl.searchParams.set('list-type','2');anonymousUrl.searchParams.set('max-keys','1');
      const anonymous=await this.fetch(anonymousUrl,{method:'GET',signal:AbortSignal.timeout(10000),redirect:'error'});
      const privateBucket=[401,403,404].includes(anonymous.status);
      const scannerStatus=await this.scanner.health?.()??{ok:true,...this.scanner.status?.()};
      return {ok:Boolean(privateBucket&&scannerStatus.ok),driver:this.mode,endpoint:bucketUrl.origin,bucket:this.bucket,region:this.region,authenticatedProbe:true,anonymousListingDenied:privateBucket,private:privateBucket,scanner:this.scanner.mode,scannerStatus,quarantinePrefix:'quarantine/',releasedPrefix:'released/'};
    }catch(error){return {ok:false,driver:this.mode,error:error.message,scanner:this.scanner.mode};}
  }
}

export function createObjectStorage({runtimeDir,environment=process.env}={}){
  const allowLocal=truthy(environment.QELLY_ALLOW_LOCAL_OBJECT_STORAGE_IN_PRODUCTION,false),mode=environment.QELLY_OBJECT_STORAGE_MODE??(environment.NODE_ENV==='production'&&!allowLocal?'s3':'local'),scanner=createMalwareScanner({environment});
  if(mode==='s3')return new S3CompatibleObjectStorage({endpoint:environment.S3_ENDPOINT,bucket:environment.S3_BUCKET,region:environment.S3_REGION??'us-east-1',accessKeyId:environment.S3_ACCESS_KEY_ID,secretAccessKey:environment.S3_SECRET_ACCESS_KEY,pathStyle:truthy(environment.S3_PATH_STYLE,true),scanner});
  if(environment.NODE_ENV==='production'&&!allowLocal)throw Object.assign(new Error('Production requires S3-compatible object storage'),{code:'production_object_storage_required'});
  return new LocalObjectStorage({root:path.join(runtimeDir,'object-storage'),scanner});
}
