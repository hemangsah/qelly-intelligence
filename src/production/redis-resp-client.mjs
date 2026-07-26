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

export function parseRedisUrl(urlText,{environment=process.env}={}){const url=new URL(urlText);if(!['redis:','rediss:'].includes(url.protocol))throw new Error('REDIS_URL must use redis:// or rediss://');const caEncoded=String(environment.QELLY_REDIS_TLS_CA_BASE64??'').trim();return {host:url.hostname,port:Number(url.port||6379),username:url.username?decodeURIComponent(url.username):null,password:url.password?decodeURIComponent(url.password):null,db:Number(url.pathname.slice(1)||0),tls:url.protocol==='rediss:',servername:environment.QELLY_REDIS_TLS_SERVERNAME??url.hostname,rejectUnauthorized:environment.QELLY_REDIS_TLS_REJECT_UNAUTHORIZED!=='false',ca:caEncoded?Buffer.from(caEncoded,'base64').toString('utf8'):undefined,connectTimeoutMs:Math.max(1000,Math.min(Number(environment.QELLY_REDIS_CONNECT_TIMEOUT_MS??10000),60000)),commandTimeoutMs:Math.max(1000,Math.min(Number(environment.QELLY_REDIS_COMMAND_TIMEOUT_MS??10000),60000))};}

export class RedisRespClient{
  constructor(config,options={}){this.config=typeof config==='string'?parseRedisUrl(config,options):config;this.socket=null;this.buffer=Buffer.alloc(0);this.pending=[];this.connected=false;this.connectPromise=null;}
  async connect(){
    if(this.connected&&this.socket&&!this.socket.destroyed)return this;
    if(this.connectPromise)return this.connectPromise;
    this.connectPromise=(async()=>{
      const socket=this.config.tls
        ?tls.connect({host:this.config.host,port:this.config.port,servername:this.config.servername??this.config.host,rejectUnauthorized:this.config.rejectUnauthorized!==false,...(this.config.ca?{ca:this.config.ca}:{})})
        :net.createConnection({host:this.config.host,port:this.config.port});
      await new Promise((resolve,reject)=>{
        const event=this.config.tls?'secureConnect':'connect';
        const timer=setTimeout(()=>{socket.destroy();reject(Object.assign(new Error('Redis connection timed out'),{code:'redis_connect_timeout'}));},this.config.connectTimeoutMs??10000);
        socket.once(event,()=>{clearTimeout(timer);resolve();});
        socket.once('error',(error)=>{clearTimeout(timer);reject(error);});
      });
      this.socket=socket;this.socket.setKeepAlive(true,10000);this.socket.setNoDelay(true);
      this.socket.on('data',(chunk)=>this.onData(chunk));this.socket.on('error',(error)=>this.fail(error));this.socket.on('close',()=>{this.connected=false;});
      this.connected=true;
      if(this.config.password)await this.command(this.config.username?['AUTH',this.config.username,this.config.password]:['AUTH',this.config.password]);
      if(this.config.db)await this.command(['SELECT',this.config.db]);
      return this;
    })();
    try{return await this.connectPromise;}
    catch(error){this.connected=false;this.socket?.destroy();this.socket=null;throw error;}
    finally{this.connectPromise=null;}
  }
  onData(chunk){this.buffer=Buffer.concat([this.buffer,chunk]);while(this.pending.length){const parsed=parseValue(this.buffer);if(!parsed)return;this.buffer=this.buffer.subarray(parsed.next);const pending=this.pending.shift();clearTimeout(pending.timer);parsed.error?pending.reject(parsed.value):pending.resolve(parsed.value);}}
  fail(error){while(this.pending.length){const pending=this.pending.shift();clearTimeout(pending.timer);pending.reject(error);}}
  async command(parts){await this.connect();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{const index=this.pending.findIndex((item)=>item.timer===timer);if(index>=0)this.pending.splice(index,1);this.socket?.destroy();reject(Object.assign(new Error('Redis command timed out'),{code:'redis_command_timeout'}));},this.config.commandTimeoutMs??10000);this.pending.push({resolve,reject,timer});this.socket.write(encodeCommand(parts));});}
  async health(){try{const value=await this.command(['PING']);return {ok:value==='PONG',driver:'redis-resp',endpoint:`${this.config.host}:${this.config.port}`,tls:Boolean(this.config.tls),certificateVerification:this.config.tls?this.config.rejectUnauthorized!==false:null};}catch(error){return {ok:false,driver:'redis-resp',tls:Boolean(this.config.tls),error:error.message};}}
  close(){this.socket?.end();this.connected=false;}
}

export const __respTest={encodeCommand,parseValue};
