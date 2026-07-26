import { createProductionRepository } from './repository-factory.mjs';
import { ProductionAuthService } from './auth-service.mjs';
import { IdentityGateway } from './identity-gateway.mjs';
import { ProductionJobQueue } from './job-queue.mjs';
import { MfaService } from './mfa-service.mjs';
import { createObjectStorage } from './object-storage.mjs';
import { createDeliveryService } from './delivery-service.mjs';
import { createSecretProtector } from './secret-protector.mjs';
import { PasskeyService } from './passkey-service.mjs';
import { AccountRecoveryService } from './account-recovery-service.mjs';
import { SecretRotationService } from './secret-rotation-service.mjs';
import { PlatformAssuranceService } from './platform-assurance-service.mjs';
import { PostgresDecisionProvenanceStore } from '../evidence/postgres-decision-provenance-store.mjs';
import { validateDeploymentEnvironment } from './deployment-environment.mjs';
import { PostgresDocumentStore } from './postgres-document-store.mjs';
import { PostgresAuditLedger } from './postgres-audit-ledger.mjs';
import { WorkspaceOperationsStore, emptyWorkspaceOperationsSeed } from '../workspace/workspace-operations-store.mjs';
import { PostgresPortfolioService } from '../portfolio/postgres-portfolio-service.mjs';

const truthy=(value,defaultValue=false)=>value==null?defaultValue:['1','true','yes','on'].includes(String(value).toLowerCase());

export async function initializeProductionFoundation(runtime,{runtimeDir,environment=process.env}={}){
  const deploymentEnvironment=validateDeploymentEnvironment(environment);
  runtime.observability?.setDeploymentMode?.({structuredOutput:environment.NODE_ENV==='production'});
  const productionIdentityEnabled=truthy(environment.QELLY_PRODUCTION_IDENTITY_ENABLED,false);
  const developmentIdentityEnabled=truthy(environment.QELLY_DEVELOPMENT_IDENTITY_ENABLED,environment.NODE_ENV!=='production')&&environment.NODE_ENV!=='production';
  const foundationEnabled=truthy(environment.QELLY_PRODUCTION_FOUNDATION_ENABLED,true);
  let repository=null,authService=null,jobQueue=null,initializationError=null;
  if(foundationEnabled){
    try{
      repository=await createProductionRepository({runtimeDir,mode:environment.QELLY_DATABASE_MODE??(environment.NODE_ENV==='production'?'postgres':'sqlite'),databaseUrl:environment.DATABASE_URL,sqlitePath:environment.QELLY_SQLITE_PATH,nodeEnv:environment.NODE_ENV,allowSqliteInProduction:truthy(environment.QELLY_ALLOW_SQLITE_IN_PRODUCTION,false),environment});
      const secret=environment.QELLY_SESSION_SECRET??(environment.NODE_ENV==='production'?null:'qelly-development-session-secret-change-before-production-2026');
      jobQueue=new ProductionJobQueue({repository,redisUrl:environment.REDIS_URL,mode:environment.QELLY_JOB_QUEUE_MODE??(environment.NODE_ENV==='production'?'redis':'database'),nodeEnv:environment.NODE_ENV,allowDatabaseQueueInProduction:truthy(environment.QELLY_ALLOW_DATABASE_QUEUE_IN_PRODUCTION,false),environment,leaseMs:environment.QELLY_WORKER_LEASE_MS??60000});
      authService=new ProductionAuthService({repository,auditLedger:runtime.auditLedger,jobQueue,sessionSecret:secret,passwordPepper:environment.QELLY_PASSWORD_PEPPER??'',secureCookies:environment.NODE_ENV==='production',cookieSameSite:environment.QELLY_SESSION_COOKIE_SAME_SITE??'Lax'});
    }catch(error){initializationError=error;if(environment.NODE_ENV==='production'||productionIdentityEnabled)throw error;}
  }
  const secretProtector=repository?createSecretProtector({environment}):null;
  runtime.productionRepository=repository;
  runtime.corsAllowedOrigins=new Set(String(environment.QELLY_FRONTEND_ORIGINS??'').split(',').map((origin)=>origin.trim().replace(/\/$/,'')).filter(Boolean));
  if(repository?.constructor?.name==='PostgresProductionRepository'){
    runtime.auditLedger.use(new PostgresAuditLedger({repository}));
    runtime.decisionProvenanceStore=new PostgresDecisionProvenanceStore({repository,auditLedger:runtime.auditLedger});
    runtime.workspaceOperationsStore=new WorkspaceOperationsStore({
      auditLedger:runtime.auditLedger,
      persistenceMode:'postgresql-jsonb',
      storeFactory:(_scope,documentKey)=>new PostgresDocumentStore({repository,documentKey,documentType:'workspace-operations',seedFactory:emptyWorkspaceOperationsSeed})
    });
    runtime.portfolioService=new PostgresPortfolioService({repository,analytics:runtime.portfolioService});
  }
  runtime.productionAuthService=authService;
  runtime.jobQueue=jobQueue;
  runtime.secretProtector=secretProtector;
  runtime.mfaService=repository?new MfaService({repository,auditLedger:runtime.auditLedger,secretProtector}):null;
  runtime.passkeyService=repository?new PasskeyService({repository,auditLedger:runtime.auditLedger,rpId:environment.QELLY_WEBAUTHN_RP_ID??'localhost',rpName:environment.QELLY_WEBAUTHN_RP_NAME??'Qelly Intelligence',allowedOrigins:String(environment.QELLY_WEBAUTHN_ORIGINS??'http://localhost:4480,http://127.0.0.1:4480').split(',').map(x=>x.trim()).filter(Boolean)}):null;
  runtime.objectStorage=repository?createObjectStorage({runtimeDir,environment}):null;
  runtime.deliveryService=repository?createDeliveryService({repository,environment}):null;
  runtime.accountRecoveryService=repository?new AccountRecoveryService({repository,jobQueue,auditLedger:runtime.auditLedger,passwordPepper:environment.QELLY_PASSWORD_PEPPER??'',environment}):null;
  runtime.secretRotationService=repository?new SecretRotationService({repository,secretProtector,auditLedger:runtime.auditLedger}):null;
  runtime.platformAssuranceService=repository?new PlatformAssuranceService({runtimeDir,repository,jobQueue,objectStorage:runtime.objectStorage,deliveryService:runtime.deliveryService,secretRotationService:runtime.secretRotationService,auditLedger:runtime.auditLedger}):null;
  runtime.productionFoundation={enabled:foundationEnabled,nodeEnv:environment.NODE_ENV??'development',deploymentStage:deploymentEnvironment.stage,strictProductionDependencies:environment.NODE_ENV==='production'&&environment.QELLY_STRICT_PRODUCTION_DEPENDENCIES!=='false',requireActiveWorker:environment.NODE_ENV==='production'&&environment.QELLY_REQUIRE_ACTIVE_WORKER!=='false',requiredMigration:environment.QELLY_REQUIRED_MIGRATION??'106_deployment_runtime_state.sql',productionIdentityEnabled,developmentIdentityEnabled,initializationError:initializationError?.message??null,databaseMode:repository?.constructor?.name??'unavailable',databasePool:repository?.client?.stats?.()??null,runtimeStateMode:runtime.workspaceOperationsStore?.persistenceMode??'local-atomic-json',auditMode:runtime.auditLedger?.delegate?'postgresql-hash-chain':'local-hash-chain',jobQueueMode:jobQueue?.mode??'unavailable',mfa:Boolean(runtime.mfaService),passkeys:Boolean(runtime.passkeyService),secretProtection:secretProtector?.mode??'unavailable',secretRotation:Boolean(secretProtector?.status?.().rotationSupported),objectStorageMode:runtime.objectStorage?.mode??'unavailable',malwareScannerMode:runtime.objectStorage?.scanner?.mode??'unavailable',deliveryMode:runtime.deliveryService?.mode??'unavailable',accountRecovery:Boolean(runtime.accountRecoveryService),assuranceDrills:Boolean(runtime.platformAssuranceService)};
  runtime.identityService=new IdentityGateway({localIdentityService:runtime.localIdentityService??runtime.identityService,productionAuthService:authService,developmentEnabled:developmentIdentityEnabled,productionEnabled:productionIdentityEnabled,localCsrfTokens:runtime.csrfTokens});
  return runtime;
}

export async function productionFoundationHealth(runtime){
  const strict=Boolean(runtime.productionFoundation?.strictProductionDependencies);
  const [database,jobs,objectStorage,audit]=await Promise.all([
    runtime.productionRepository?runtime.productionRepository.health():{ok:false,driver:'unavailable',error:runtime.productionFoundation?.initializationError??'disabled'},
    runtime.jobQueue?runtime.jobQueue.health():{ok:false,driver:'unavailable',error:runtime.productionFoundation?.initializationError??'disabled'},
    runtime.objectStorage?runtime.objectStorage.health():{ok:false,driver:'unavailable',error:runtime.productionFoundation?.initializationError??'disabled'},
    runtime.auditLedger?.verify?.().catch?.((error)=>({valid:false,error:error.message}))??{valid:false,error:'Audit ledger unavailable'}
  ]);
  const providers=runtime.deliveryService?.providers?.()??null;
  const externalEmail=Boolean(providers?.email?.configured&&providers?.email?.external);
  const externalWebhook=Boolean(providers?.webhook?.configured&&providers?.webhook?.external);
  const delivery=strict?(runtime.deliveryService?await runtime.deliveryService.health():{ok:false,driver:'unavailable',providers,error:'Delivery service unavailable'}):{ok:Boolean(runtime.deliveryService),driver:'delivery-adapters',providers};
  const secrets=runtime.secretRotationService?await runtime.secretRotationService.status().catch((error)=>({protector:{mode:'unavailable'},protectedRecordCount:0,error:error.message})):{protector:{mode:'unavailable'},protectedRecordCount:0};
  const secretMode=String(secrets?.protector?.mode??'');
  const secretReady=!strict||secretMode.includes('configured');
  const scannerMode=String(objectStorage?.scannerStatus?.mode??objectStorage?.scanner??'');
  const scannerReady=!strict||Boolean(objectStorage?.scannerStatus?.ok&&scannerMode==='clamav-tcp-instream');
  const migrationReady=!strict||database.latestMigration===runtime.productionFoundation?.requiredMigration;
  const redisTlsReady=!strict||jobs.tls===true;
  const workerReady=!strict||!runtime.productionFoundation?.requireActiveWorker||Number(jobs.queue?.activeWorkers??0)>0;
  const privateStorageReady=!strict||Boolean(objectStorage.private&&objectStorage.anonymousListingDenied);
  const auditReady=!strict||Boolean(audit.valid&&audit.persistence==='postgresql');
  const identityReady=!strict||Boolean(runtime.productionFoundation?.productionIdentityEnabled&&!runtime.productionFoundation?.developmentIdentityEnabled);
  const productionPolicy={strict,secretReady,scannerReady,migrationReady,redisTlsReady,workerReady,privateStorageReady,auditReady,identityReady,externalEmail,externalWebhook,localFallbacksAllowed:!strict};
  const ready=Boolean(database.ok&&jobs.ok&&objectStorage.ok&&delivery.ok&&secretReady&&scannerReady&&migrationReady&&redisTlsReady&&workerReady&&privateStorageReady&&auditReady&&identityReady);
  return {mode:runtime.productionFoundation,dependencies:{database,jobs,objectStorage,delivery,secrets,audit},productionPolicy,ready};
}
