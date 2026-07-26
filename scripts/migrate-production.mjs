import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PostgresWireClient, sqlLiteral } from '../src/production/postgres-wire-client.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migrationDir=path.join(root,'packages/migrations');
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required');
const client=new PostgresWireClient(databaseUrl);await client.connect();
try{
  await client.query(`CREATE TABLE IF NOT EXISTS qelly_migration_history(migration_id text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now(),runtime text NOT NULL)`);
  const files=(await readdir(migrationDir)).filter((name)=>/^\d+.*\.sql$/.test(name)).sort();
  const applied=[];
  for(const file of files){
    const sql=await readFile(path.join(migrationDir,file),'utf8');const checksum=crypto.createHash('sha256').update(sql).digest('hex');
    const prior=await client.query(`SELECT checksum FROM qelly_migration_history WHERE migration_id=${sqlLiteral(file)} LIMIT 1`);
    if(prior.rows[0]){if(prior.rows[0].checksum!==checksum)throw new Error(`Migration checksum drift: ${file}`);continue;}
    await client.query(sql);await client.query(`INSERT INTO qelly_migration_history(migration_id,checksum,runtime) VALUES(${sqlLiteral(file)},${sqlLiteral(checksum)},'qelly-release-a3')`);applied.push(file);
  }
  console.log(JSON.stringify({ok:true,applied},null,2));
}finally{client.close();}
