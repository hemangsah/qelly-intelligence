const phases=[
 {phase:1,name:'Foundation schema',status:'contract-ready',systems:['PostgreSQL 17','migration ledger','tenant boundaries'],artifacts:['001_foundation.sql'],automaticExecution:false},
 {phase:2,name:'Workspace state',status:'contract-ready',systems:['watchlists','alerts','notifications','screeners','research'],artifacts:['002_workspace_state.sql'],automaticExecution:false},
 {phase:3,name:'Market data plane',status:'architecture-only',systems:['TimescaleDB or ClickHouse','Redis','object storage'],artifacts:['003_market_data_plane.sql'],automaticExecution:false},
 {phase:4,name:'Search and eventing',status:'architecture-only',systems:['OpenSearch','Kafka or Redpanda','transactional outbox'],artifacts:['004_search_eventing.sql'],automaticExecution:false}
];
export class MigrationPlanService{
 plan(){return {version:'21.0.0',source:'atomic-local-json',target:'production-polyglot-data-platform',phases,principles:['expand-contract migrations','tenant-scoped primary keys','immutable audit identifiers','transactional outbox','backfill checkpoints','reversible application releases'],productionExecution:false};}
 status(){return {mode:'contract-only',databaseConnected:false,migrationsExecuted:false,rollbackTested:false,backupRestoreTested:false,distributedLocks:false,requiredEnvironment:['DATABASE_URL','REDIS_URL','OBJECT_STORAGE_URL','EVENT_BROKER_URL'],gates:['approved data classification','secrets manager','encrypted backups','migration rehearsal','restore rehearsal','capacity test','security review']};}
}
