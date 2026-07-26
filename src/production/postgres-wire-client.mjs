import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const int32=(value)=>{const b=Buffer.alloc(4);b.writeInt32BE(value);return b;};
const cstring=(value)=>Buffer.concat([Buffer.from(String(value),'utf8'),Buffer.from([0])]);
const message=(type,payload=Buffer.alloc(0))=>Buffer.concat([Buffer.from(type),int32(payload.length+4),payload]);
const md5=(value)=>crypto.createHash('md5').update(value).digest('hex');
const hmac=(key,value)=>crypto.createHmac('sha256',key).update(value).digest();
const sha256=(value)=>crypto.createHash('sha256').update(value).digest();
const xor=(a,b)=>Buffer.from(a.map((value,index)=>value^b[index]));

export function parsePostgresUrl(urlText){
  const url=new URL(urlText);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  return {host:url.hostname,port:Number(url.port||5432),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:decodeURIComponent(url.pathname.slice(1)||url.username),ssl:['require','verify-ca','verify-full'].includes(url.searchParams.get('sslmode')??'prefer'),sslMode:url.searchParams.get('sslmode')??'prefer'};
}

function parseError(payload){
  const fields={};let offset=0;
  while(offset<payload.length&&payload[offset]!==0){const code=String.fromCharCode(payload[offset++]);const end=payload.indexOf(0,offset);fields[code]=payload.toString('utf8',offset,end);offset=end+1;}
  const error=new Error(fields.M||'PostgreSQL error');error.code=fields.C||'postgres_error';error.severity=fields.S;error.detail=fields.D;error.hint=fields.H;return error;
}

function readCString(buffer,offset){const end=buffer.indexOf(0,offset);return [buffer.toString('utf8',offset,end),end+1];}

export class PostgresWireClient extends EventEmitter{
  constructor(config){super();this.config=typeof config==='string'?parsePostgresUrl(config):config;this.socket=null;this.buffer=Buffer.alloc(0);this.queue=[];this.current=null;this.ready=false;this.parameters={};this.backendKey=null;this.scram=null;}
  async connect(){
    if(this.socket&&!this.socket.destroyed)return this;
    let socket=net.createConnection({host:this.config.host,port:this.config.port});
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
    if(this.config.ssl){
      const sslRequest=Buffer.concat([int32(8),int32(80877103)]);socket.write(sslRequest);
      const response=await new Promise((resolve,reject)=>{socket.once('data',resolve);socket.once('error',reject);});
      if(response[0]===0x53){socket=tls.connect({socket,servername:this.config.host,rejectUnauthorized:this.config.sslMode==='verify-full'});await new Promise((resolve,reject)=>{socket.once('secureConnect',resolve);socket.once('error',reject);});}
      else if(this.config.sslMode!=='prefer')throw new Error('PostgreSQL server refused TLS');
    }
    this.socket=socket;socket.on('data',(chunk)=>this.onData(chunk));socket.on('error',(error)=>this.failAll(error));socket.on('close',()=>{this.ready=false;this.emit('close');});
    const params=Buffer.concat([cstring('user'),cstring(this.config.user),cstring('database'),cstring(this.config.database),cstring('client_encoding'),cstring('UTF8'),Buffer.from([0])]);
    socket.write(Buffer.concat([int32(params.length+8),int32(196608),params]));
    await new Promise((resolve,reject)=>{const done=()=>{cleanup();resolve();};const fail=(error)=>{cleanup();reject(error);};const cleanup=()=>{this.off('ready',done);this.off('error',fail);};this.on('ready',done);this.on('error',fail);});
    return this;
  }
  close(){if(this.socket&&!this.socket.destroyed){this.socket.write(message('X'));this.socket.end();}}
  failAll(error){if(this.current){this.current.reject(error);this.current=null;}while(this.queue.length)this.queue.shift().reject(error);this.emit('error',error);}
  onData(chunk){this.buffer=Buffer.concat([this.buffer,chunk]);while(this.buffer.length>=5){const type=String.fromCharCode(this.buffer[0]);const length=this.buffer.readInt32BE(1);if(this.buffer.length<1+length)return;const payload=this.buffer.subarray(5,1+length);this.buffer=this.buffer.subarray(1+length);try{this.handle(type,payload);}catch(error){this.failAll(error);}}}
  handle(type,payload){
    if(type==='R')return this.handleAuth(payload);
    if(type==='S'){let offset=0;const [key,next]=readCString(payload,offset);offset=next;const [value]=readCString(payload,offset);this.parameters[key]=value;return;}
    if(type==='K'){this.backendKey={pid:payload.readInt32BE(0),secret:payload.readInt32BE(4)};return;}
    if(type==='E'){const error=parseError(payload);if(this.current)this.current.error=error;else this.emit('error',error);return;}
    if(type==='Z'){
      this.ready=true;
      if(this.current){const current=this.current;this.current=null;if(current.error)current.reject(current.error);else current.resolve({rows:current.rows,rowCount:current.rowCount,command:current.command,fields:current.fields});this.startNext();}
      else this.emit('ready');return;
    }
    if(!this.current)return;
    if(type==='T'){
      const count=payload.readInt16BE(0);let offset=2;this.current.fields=[];
      for(let index=0;index<count;index+=1){const [name,next]=readCString(payload,offset);offset=next;const tableOid=payload.readInt32BE(offset);offset+=4;const column=payload.readInt16BE(offset);offset+=2;const typeOid=payload.readInt32BE(offset);offset+=4;const typeSize=payload.readInt16BE(offset);offset+=2;const modifier=payload.readInt32BE(offset);offset+=4;const format=payload.readInt16BE(offset);offset+=2;this.current.fields.push({name,tableOid,column,typeOid,typeSize,modifier,format});}
      return;
    }
    if(type==='D'){
      const count=payload.readInt16BE(0);let offset=2;const row={};
      for(let index=0;index<count;index+=1){const length=payload.readInt32BE(offset);offset+=4;const field=this.current.fields[index];if(length===-1)row[field.name]=null;else{row[field.name]=payload.toString('utf8',offset,offset+length);offset+=length;}}
      this.current.rows.push(row);return;
    }
    if(type==='C'){const [command]=readCString(payload,0);this.current.command=command;const match=command.match(/\s(\d+)$/);this.current.rowCount=match?Number(match[1]):0;}
  }
  handleAuth(payload){
    const code=payload.readInt32BE(0);
    if(code===0)return;
    if(code===3){this.socket.write(message('p',cstring(this.config.password)));return;}
    if(code===5){const salt=payload.subarray(4,8);const digest=`md5${md5(Buffer.concat([Buffer.from(md5(`${this.config.password}${this.config.user}`)),salt]))}`;this.socket.write(message('p',cstring(digest)));return;}
    if(code===10){
      const mechanisms=payload.subarray(4).toString('utf8').split('\0').filter(Boolean);if(!mechanisms.includes('SCRAM-SHA-256'))throw new Error('PostgreSQL server does not offer SCRAM-SHA-256');
      const nonce=crypto.randomBytes(18).toString('base64');const username=this.config.user.replaceAll('=','=3D').replaceAll(',', '=2C');const clientFirstBare=`n=${username},r=${nonce}`;const clientFirst=`n,,${clientFirstBare}`;this.scram={nonce,clientFirstBare};const initial=Buffer.from(clientFirst);
      this.socket.write(message('p',Buffer.concat([cstring('SCRAM-SHA-256'),int32(initial.length),initial])));return;
    }
    if(code===11){
      const serverFirst=payload.subarray(4).toString('utf8');const attrs=Object.fromEntries(serverFirst.split(',').map((part)=>[part[0],part.slice(2)]));if(!attrs.r?.startsWith(this.scram.nonce))throw new Error('Invalid SCRAM server nonce');
      const salt=Buffer.from(attrs.s,'base64'),iterations=Number(attrs.i);const salted=crypto.pbkdf2Sync(Buffer.from(this.config.password),salt,iterations,32,'sha256');const clientKey=hmac(salted,'Client Key');const storedKey=sha256(clientKey);const clientFinalWithoutProof=`c=biws,r=${attrs.r}`;const authMessage=`${this.scram.clientFirstBare},${serverFirst},${clientFinalWithoutProof}`;const clientSignature=hmac(storedKey,authMessage);const proof=xor(clientKey,clientSignature).toString('base64');const serverKey=hmac(salted,'Server Key');this.scram.expectedServerSignature=hmac(serverKey,authMessage).toString('base64');this.socket.write(message('p',Buffer.from(`${clientFinalWithoutProof},p=${proof}`)));return;
    }
    if(code===12){const final=payload.subarray(4).toString('utf8');const attrs=Object.fromEntries(final.split(',').map((part)=>[part[0],part.slice(2)]));if(attrs.e)throw new Error(`SCRAM authentication failed: ${attrs.e}`);if(attrs.v!==this.scram.expectedServerSignature)throw new Error('SCRAM server signature mismatch');return;}
    throw new Error(`Unsupported PostgreSQL authentication code ${code}`);
  }
  query(text){return new Promise((resolve,reject)=>{this.queue.push({text,resolve,reject,rows:[],fields:[],rowCount:0,command:null,error:null});this.startNext();});}
  startNext(){if(!this.ready||this.current||!this.queue.length)return;this.current=this.queue.shift();this.ready=false;this.socket.write(message('Q',cstring(this.current.text)));}
  async transaction(fn){await this.query('BEGIN');try{const value=await fn(this);await this.query('COMMIT');return value;}catch(error){try{await this.query('ROLLBACK');}catch{}throw error;}}
}

export function sqlLiteral(value){
  if(value===null||value===undefined)return 'NULL';
  if(typeof value==='number'&&Number.isFinite(value))return String(value);
  if(typeof value==='boolean')return value?'TRUE':'FALSE';
  return `'${String(value).replaceAll("'","''")}'`;
}
