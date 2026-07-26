import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { postgresEnvironment, runCommand, sha256File } from './postgres-cli.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=process.argv[2]?path.resolve(process.argv[2]):null;
if(!directory)throw new Error('Usage: npm run restore -- <backup-directory>');
const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
if(manifest.format!=='qelly-backup-v2')throw new Error('Backup manifest format is unsupported');
const item=manifest.files?.[0];
if(!item)throw new Error('Backup manifest contains no restorable file');
const source=path.resolve(directory,item.file);
if(!source.startsWith(`${directory}${path.sep}`))throw new Error('Backup file path escapes the backup directory');
const hash=manifest.mode==='postgres'?await sha256File(source):crypto.createHash('sha256').update(await readFile(source)).digest('hex');
if(hash!==item.sha256)throw Object.assign(new Error('Backup checksum mismatch'),{code:'backup_checksum_mismatch'});

if(manifest.mode==='postgres'){
  if(process.env.QELLY_RESTORE_CONFIRM!=='RESTORE_QELLY_DATABASE')throw new Error('Set QELLY_RESTORE_CONFIRM=RESTORE_QELLY_DATABASE for an intentional restore');
  const databaseUrl=process.env.QELLY_RESTORE_DATABASE_URL;
  if(!databaseUrl)throw new Error('QELLY_RESTORE_DATABASE_URL must identify the isolated restore target');
  const command=process.env.QELLY_PG_RESTORE_BIN??'pg_restore';
  const version=await runCommand(command,['--version'],{environment:postgresEnvironment(databaseUrl)});
  await runCommand(command,['--exit-on-error','--single-transaction','--clean','--if-exists','--no-owner','--no-acl',source],{environment:postgresEnvironment(databaseUrl)});
  console.log(JSON.stringify({restored:true,mode:'postgres',sha256:hash,postgresClient:version.stdout.trim(),target:'explicit-isolated-database',migration:manifest.migration},null,2));
}else if(manifest.mode==='sqlite'){
  const destination=path.resolve(process.env.QELLY_SQLITE_PATH??path.join(root,'runtime','qelly-production-dev.sqlite'));
  await mkdir(path.dirname(destination),{recursive:true});
  await copyFile(source,destination);
  console.log(JSON.stringify({restored:true,mode:'sqlite-development',destination:path.relative(root,destination),sha256:hash},null,2));
}else throw new Error(`Unsupported restore database mode: ${manifest.mode}`);
