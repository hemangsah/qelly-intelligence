import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { postgresEnvironment, runCommand, sha256File } from './postgres-cli.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const timestamp=new Date().toISOString().replaceAll(':','-');
const output=path.resolve(process.argv[2]??process.env.QELLY_BACKUP_DIRECTORY??path.join(root,'backups',timestamp));
const mode=process.env.QELLY_DATABASE_MODE??(process.env.DATABASE_URL?'postgres':'sqlite');
if(output===path.parse(output).root)throw new Error('Backup directory cannot be a filesystem root');
await mkdir(output,{recursive:true,mode:0o700});
const manifest={format:'qelly-backup-v2',productVersion:'0.9.0-preview.1',commit:process.env.QELLY_RELEASE_COMMIT??null,createdAt:new Date().toISOString(),mode,files:[],migration:process.env.QELLY_REQUIRED_MIGRATION??'106_deployment_runtime_state.sql'};

if(mode==='postgres'){
  const databaseUrl=process.env.QELLY_BACKUP_DATABASE_URL??process.env.DATABASE_URL;
  if(!databaseUrl)throw new Error('QELLY_BACKUP_DATABASE_URL or DATABASE_URL is required');
  const dump=path.join(output,'qelly-postgresql.dump');
  await access(dump).then(()=>{throw new Error('Backup dump already exists; choose a new directory');}).catch((error)=>{if(error.code!=='ENOENT')throw error;});
  const command=process.env.QELLY_PG_DUMP_BIN??'pg_dump';
  const version=await runCommand(command,['--version'],{environment:postgresEnvironment(databaseUrl)});
  await runCommand(command,['--format=custom','--compress=9','--no-owner','--no-acl','--file',dump],{environment:postgresEnvironment(databaseUrl)});
  manifest.postgresClient=version.stdout.trim();
  manifest.files.push({file:path.basename(dump),sha256:await sha256File(dump),purpose:'postgresql-custom-dump'});
}else if(mode==='sqlite'){
  const source=path.resolve(process.env.QELLY_SQLITE_PATH??path.join(root,'runtime','qelly-production-dev.sqlite'));
  const destination=path.join(output,'qelly-production-dev.sqlite');
  await copyFile(source,destination);
  manifest.files.push({file:path.basename(destination),sha256:crypto.createHash('sha256').update(await readFile(destination)).digest('hex'),purpose:'development-sqlite-copy'});
}else throw new Error(`Unsupported backup database mode: ${mode}`);

await writeFile(path.join(output,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`,{mode:0o600});
console.log(JSON.stringify({...manifest,output:path.relative(root,output)||'.'},null,2));
