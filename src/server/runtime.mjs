import path from 'node:path';
import { AuditLedger } from '../security/audit-ledger.mjs';
import { TokenBucketLimiter } from '../security/rate-limiter.mjs';
import { IdempotencyStore } from '../security/idempotency-store.mjs';
import { CsrfTokenStore } from '../security/csrf-token-store.mjs';
import { IdentityService } from '../identity/identity-service.mjs';
import { EntitlementEngine } from '../entitlements/entitlement-engine.mjs';
import { DataQualityEngine } from '../data-quality/quality-engine.mjs';
import { ProviderRuntime } from '../providers/provider-runtime.mjs';
import { InstrumentStore } from '../instruments/instrument-store.mjs';
import { TimeSeriesStore } from '../timeseries/timeseries-store.mjs';
import { StreamGateway } from '../streaming/stream-gateway.mjs';
import { ObservabilityService } from '../observability/observability-service.mjs';
import { DiscoveryService } from '../discovery/discovery-service.mjs';
import { SavedDiscoveryStore } from '../discovery/saved-discovery-store.mjs';
import { AssetIntelligenceService } from '../asset-intelligence/asset-intelligence-service.mjs';
import { AdvancedAssetService } from '../asset-intelligence/advanced-asset-service.mjs';
import { ChartLayoutStore } from '../asset-intelligence/chart-layout-store.mjs';
import { PreferenceStore } from './preferences-store.mjs';
import { SchemaRegistry } from '../validation/schema-validator.mjs';
import { WorkspaceOperationsStore } from '../workspace/workspace-operations-store.mjs';
import { ScreenerService } from '../workspace/screener-service.mjs';
import { PortfolioService } from '../portfolio/portfolio-service.mjs';
import { OnboardingStore } from '../onboarding/onboarding-store.mjs';
import { NotificationScheduleStore } from '../automation/notification-schedule-store.mjs';
import { ImportService } from '../imports/import-service.mjs';
import { ResearchVersionStore } from '../research/research-version-store.mjs';
import { MigrationPlanService } from '../platform/migration-plan-service.mjs';
import { LiveMarketService } from '../live-markets/live-market-service.mjs';
import { PublicMarketService } from '../markets/public-market-service.mjs';
import { DecisionProvenanceStore } from '../evidence/decision-provenance-store.mjs';
import { CalculationService, SavedCalculationStore } from '../calculations/calculation-service.mjs';

export function createRuntime({runtimeDir,packageDir}) {
  const auditLedger=new AuditLedger(path.join(runtimeDir,'audit-ledger.ndjson'));
  const entitlementEngine=new EntitlementEngine();
  const qualityEngine=new DataQualityEngine();
  const providerRuntime=new ProviderRuntime({entitlementEngine,qualityEngine,auditLedger});
  const timeSeriesStore=new TimeSeriesStore({filePath:path.join(runtimeDir,'timeseries-store.json'),auditLedger});
  const observability=new ObservabilityService();
  const streamGateway=new StreamGateway({filePath:path.join(runtimeDir,'stream-journal.json'),timeSeriesStore,providerRuntime,qualityEngine,auditLedger});
  const localIdentityService=new IdentityService({filePath:path.join(runtimeDir,'identity-runtime.json'),auditLedger});
  return {runtimeDir,auditLedger,entitlementEngine,qualityEngine,providerRuntime,timeSeriesStore,streamGateway,observability,localIdentityService,
    discoveryService:new DiscoveryService(),savedDiscoveryStore:new SavedDiscoveryStore({filePath:path.join(runtimeDir,'saved-discovery.json'),auditLedger}),assetIntelligenceService:new AssetIntelligenceService(),advancedAssetService:new AdvancedAssetService(),chartLayoutStore:new ChartLayoutStore({filePath:path.join(runtimeDir,'chart-layouts.json'),auditLedger}),workspaceOperationsStore:new WorkspaceOperationsStore({filePath:path.join(runtimeDir,'workspace-operations.json'),auditLedger}),screenerService:new ScreenerService(),portfolioService:new PortfolioService(),onboardingStore:new OnboardingStore({filePath:path.join(runtimeDir,'onboarding.json'),auditLedger}),notificationScheduleStore:new NotificationScheduleStore({filePath:path.join(runtimeDir,'notification-schedules.json'),auditLedger}),importService:new ImportService({filePath:path.join(runtimeDir,'import-batches.json'),auditLedger}),researchVersionStore:new ResearchVersionStore({filePath:path.join(runtimeDir,'research-versions.json'),auditLedger}),migrationPlanService:new MigrationPlanService(),liveMarketService:new LiveMarketService(),publicMarketService:new PublicMarketService(),decisionProvenanceStore:new DecisionProvenanceStore({filePath:path.join(runtimeDir,'decision-provenance.json'),auditLedger}),calculationService:new CalculationService(),savedCalculationStore:new SavedCalculationStore({filePath:path.join(runtimeDir,'saved-calculations.json'),auditLedger}),preferenceStore:new PreferenceStore(runtimeDir),csrfTokens:new CsrfTokenStore(),schemaRegistry:new SchemaRegistry({schemaDir:path.join(packageDir,'schemas')}),identityService:localIdentityService,instrumentStore:new InstrumentStore({filePath:path.join(runtimeDir,'instrument-master.json'),auditLedger}),requestLimiter:new TokenBucketLimiter({capacity:360,refillPerSecond:6}),idempotencyStore:new IdempotencyStore()};
}
