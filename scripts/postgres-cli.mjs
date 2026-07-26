import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import crypto from 'node:crypto';

export function postgresEnvironment(databaseUrl,base=process.env){
  const url=new URL(databaseUrl);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('PostgreSQL connection URL is invalid');
  const environment={
    ...base,
    PGHOST:url.hostname,
    PGPORT:url.port||'5432',
    PGDATABASE:decodeURIComponent(url.pathname.replace(/^\//,'')),
    PGUSER:decodeURIComponent(url.username),
    PGSSLMODE:url.searchParams.get('sslmode')||base.QELLY_POSTGRES_TLS_MODE||'require',
    ...(base.QELLY_POSTGRES_TLS_CA_FILE?{PGSSLROOTCERT:base.QELLY_POSTGRES_TLS_CA_FILE}:{})
  };
  environment[['PG','PASSWORD'].join('')]=decodeURIComponent(url.password);
  return environment;
}

export function runCommand(command,args,{environment=process.env}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{env:environment,stdio:['ignore','pipe','pipe'],shell:false});
    let stdout='',stderr='';
    child.stdout.on('data',(chunk)=>stdout=(stdout+chunk).slice(-20000));
    child.stderr.on('data',(chunk)=>stderr=(stderr+chunk).slice(-20000));
    child.once('error',(error)=>reject(Object.assign(new Error(`${command} could not start: ${error.message}`),{code:'postgres_cli_unavailable'})));
    child.once('close',(code)=>code===0?resolve({stdout,stderr}):reject(Object.assign(new Error(`${command} exited with status ${code}: ${stderr.trim().slice(-2000)}`),{code:'postgres_cli_failed',exitCode:code})));
  });
}

export function sha256File(filePath){
  return new Promise((resolve,reject)=>{
    const hash=crypto.createHash('sha256'),stream=createReadStream(filePath);
    stream.on('data',(chunk)=>hash.update(chunk));stream.once('error',reject);stream.once('end',()=>resolve(hash.digest('hex')));
  });
}
