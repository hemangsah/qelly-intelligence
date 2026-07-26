import net from 'node:net';
import { lookup } from 'node:dns/promises';

const blockedHosts=new Set(['localhost','localhost.localdomain','metadata.google.internal','metadata.azure.internal','169.254.169.254']);
function isPrivateV4(ip){
  const parts=String(ip).split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  const [a,b]=parts;
  return a===10||a===127||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a>=224);
}
function isPrivateV6(ip){const value=String(ip).toLowerCase();return value==='::1'||value==='::'||value.startsWith('fc')||value.startsWith('fd')||value.startsWith('fe8')||value.startsWith('fe9')||value.startsWith('fea')||value.startsWith('feb')||value.startsWith('ff');}
export function isBlockedAddress(address){const kind=net.isIP(address);return kind===4?isPrivateV4(address):kind===6?isPrivateV6(address):true;}

export class OutboundNetworkPolicy{
  constructor({allowedOrigins=[],allowHttp=false,allowPrivate=false,resolveHost=lookup}={}){
    this.allowedOrigins=new Set((allowedOrigins??[]).map(x=>String(x).replace(/\/$/,'')));
    this.allowHttp=Boolean(allowHttp);this.allowPrivate=Boolean(allowPrivate);this.resolveHost=resolveHost;
  }
  status(){return {policy:'deny-private-and-metadata',allowedOrigins:[...this.allowedOrigins],allowHttp:this.allowHttp,allowPrivate:this.allowPrivate,dnsValidation:true};}
  async validate(rawUrl,{purpose='outbound-request'}={}){
    let url;try{url=new URL(rawUrl);}catch{throw Object.assign(new Error('Destination URL is invalid'),{status:400,code:'outbound_url_invalid'});}
    if(!['https:','http:'].includes(url.protocol))throw Object.assign(new Error('Only HTTP(S) destinations are supported'),{status:400,code:'outbound_protocol_blocked'});
    if(url.username||url.password)throw Object.assign(new Error('Credentials in destination URLs are blocked'),{status:400,code:'outbound_url_credentials_blocked'});
    if(url.protocol!=='https:'&&!this.allowHttp)throw Object.assign(new Error('HTTPS is required for outbound delivery'),{status:400,code:'outbound_https_required'});
    const origin=url.origin.replace(/\/$/,'');if(this.allowedOrigins.size&&!this.allowedOrigins.has(origin))throw Object.assign(new Error('Destination origin is not allowlisted'),{status:403,code:'outbound_origin_not_allowed',details:{origin}});
    const host=url.hostname.toLowerCase().replace(/\.$/,'');if(blockedHosts.has(host)||host.endsWith('.local')||host.endsWith('.internal'))throw Object.assign(new Error('Private or metadata destination is blocked'),{status:403,code:'outbound_private_destination_blocked'});
    const literal=net.isIP(host)?[{address:host,family:net.isIP(host)}]:await this.resolveHost(host,{all:true,verbatim:true}).catch(()=>{throw Object.assign(new Error('Destination host could not be resolved'),{status:400,code:'outbound_dns_resolution_failed'});});
    if(!literal?.length)throw Object.assign(new Error('Destination host has no usable addresses'),{status:400,code:'outbound_dns_resolution_failed'});
    if(!this.allowPrivate&&literal.some(x=>isBlockedAddress(x.address)))throw Object.assign(new Error('Destination resolves to a private, loopback, link-local, or reserved address'),{status:403,code:'outbound_private_destination_blocked'});
    return {ok:true,purpose,url:url.toString(),origin,host,addresses:literal.map(x=>x.address)};
  }
}
