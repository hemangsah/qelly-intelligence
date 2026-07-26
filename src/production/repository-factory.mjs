import path from 'node:path';
import { SqliteProductionRepository } from './sqlite-production-repository.mjs';
import { PostgresProductionRepository } from './postgres-production-repository.mjs';

export async function createProductionRepository({runtimeDir,mode=process.env.QELLY_DATABASE_MODE??(process.env.NODE_ENV==='production'?'postgres':'sqlite'),databaseUrl=process.env.DATABASE_URL,sqlitePath=process.env.QELLY_SQLITE_PATH,nodeEnv=process.env.NODE_ENV,allowSqliteInProduction=process.env.QELLY_ALLOW_SQLITE_IN_PRODUCTION==='true'}={}){
  if(mode==='postgres'){
    if(!databaseUrl)throw Object.assign(new Error('DATABASE_URL is required when QELLY_DATABASE_MODE=postgres'),{code:'database_configuration_missing'});
    const repository=new PostgresProductionRepository({databaseUrl});await repository.connect();return repository;
  }
  if(mode==='sqlite'){
    if(nodeEnv==='production'&&!allowSqliteInProduction)throw Object.assign(new Error('SQLite is development/test only. Production requires PostgreSQL.'),{code:'production_database_required'});
    return new SqliteProductionRepository({filePath:sqlitePath??path.join(runtimeDir,'qelly-production-dev.sqlite')});
  }
  throw Object.assign(new Error(`Unsupported database mode: ${mode}`),{code:'database_mode_invalid'});
}
