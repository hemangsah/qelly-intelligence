import net from 'node:net';
import tls from 'node:tls';

function encodeCommand(parts){
  const buffers=[Buffer.from(`*${parts.length}\r\n`)];
  for(const part of parts){const value=Buffer.from(String(part));buffers.push(Buffer.from(`$${value.length}\r\n`),value,Buffer.from('\r\n'));}
  return Buffer.concat(buffers);
}

function parseValue(buffer,offset=0){
  if(offset>=buffer.length)return null;
  const type=String.fromCharCode(buffer[offset]);const lineEnd=buffer.indexOf('\r\n',offset);
  if(lineEnd<0)return null;
  const line=buffer.toString('utf8',offset+1,lineEnd);let next=lineEnd+2;
  if(type==='+')return {value:line,next};
  if(type==='-'){const error=new Error(line);error.code='redis_error';return {value:error,next,error:true};}
  if(type===':')return {value:Number(line),next};
  if(type==='$'){
    const length=Number(line);if(length===-1)return {value:null,next};if(buffer.length<next+length+2)return null;
    return {value:buffer.toString('utf8',next,next+length),next:next+length+2};
  }
  if(type==='*'){
    const count=Number(line);if(count===-1)return {value:null,next};const values=[];
    for(let index=0;index<count;index+=1){const parsed=parseValue(buffer,next);if(!parsed)return null;if(parsed.error)return parsed;values.push(parsed.value);next=parsed.next;}
    return {value:values,next};
  }
  throw new Error(`Unsupported Redis response type ${type}`);
}

export function parseRedisUrl(urlText){const url=new URL(urlText);if(!['redis:','rediss:'].includes(url.protocol))throw new Error('REDIS_URL must use redis:// or rediss://');return {host:url.hostname,port:Number(url.port||6379),username:url.username?decodeURIComponent(url.username):null,password:url.password?decodeURIComponent(url.password):null,db:Number(url.pathname.slice(1)||0),tls:url.protocol==='rediss:'};}

export class RedisRespClient{
  constructor(config){this.config=typeof config==='string'?parseRedisUrl(config):config;this.socket=null;this.buffer=Buffer.alloc(0);this.pending=[];this.connected=false;}
  async connect(){if(this.connected&&this.socket&&!this.socket.destroyed)return this;const base=net.createConnection({host:this.config.host,port:this.config.port});await new Promise((resolve,reject)=>{base.once('connect',resolve);base.once('error',reject);});this.socket=this.config.tls?tls.connect({socket:base,servername:this.config.host}):base;if(this.config.tls)await new Promise((resolve,reject)=>{this.socket.once('secureConnect',resolve);this.socket.once('error',reject);});this.socket.on('data',(chunk)=>this.onData(chunk));this.socket.on('error',(error)=>this.fail(error));this.socket.on('close',()=>{this.connected=false;});this.connected=true;if(this.config.password)await this.command(this.config.username?['AUTH',this.config.username,this.config.password]:['AUTH',this.config.password]);if(this.config.db)await this.command(['SELECT',this.config.db]);return this;}
  onData(chunk){this.buffer=Buffer.concat([this.buffer,chunk]);while(this.pending.length){const parsed=parseValue(this.buffer);if(!parsed)return;this.buffer=this.buffer.subarray(parsed.next);const pending=this.pending.shift();parsed.error?pending.reject(parsed.value):pending.resolve(parsed.value);}}
  fail(error){while(this.pending.length)this.pending.shift().reject(error);}
  async command(parts){await this.connect();return new Promise((resolve,reject)=>{this.pending.push({resolve,reject});this.socket.write(encodeCommand(parts));});}
  async health(){try{const value=await this.command(['PING']);return {ok:value==='PONG',driver:'redis-resp',endpoint:`${this.config.host}:${this.config.port}`};}catch(error){return {ok:false,driver:'redis-resp',error:error.message};}}
  close(){this.socket?.end();this.connected=false;}
}

export const __respTest={encodeCommand,parseValue};
