import crypto from 'node:crypto';

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1, Math.max(0, Math.ceil((p/100)*sorted.length)-1))];
}

export class ObservabilityService {
  constructor({ now = () => Date.now(), maxRecords = 500 } = {}) {
    this.now = now;
    this.maxRecords = maxRecords;
    this.startedAt = this.now();
    this.requests = [];
    this.traces = [];
    this.logs = [];
    this.counters = new Map();
  }

  increment(name, value = 1) { this.counters.set(name,(this.counters.get(name)??0)+value); }

  startRequest({ correlationId, method, path }) {
    const startedAt = this.now();
    const traceId = crypto.randomUUID();
    return ({ statusCode = 200, bytes = 0, errorCode = null } = {}) => {
      const durationMs = Math.max(0,this.now()-startedAt);
      const record = { traceId, correlationId, method, path, statusCode, durationMs, bytes, errorCode, startedAt:new Date(startedAt).toISOString(), endedAt:new Date(this.now()).toISOString() };
      this.requests.push(record); if(this.requests.length>this.maxRecords)this.requests.shift();
      this.traces.push({...record,spanName:`${method} ${path}`,service:'qelly-bff',kind:'server',attributes:{'http.request.method':method,'url.path':path,'http.response.status_code':statusCode}}); if(this.traces.length>this.maxRecords)this.traces.shift();
      this.increment('http.requests.total');
      if(statusCode>=500)this.increment('http.requests.errors.5xx'); else if(statusCode>=400)this.increment('http.requests.errors.4xx');
      if(durationMs>250)this.log('warn','request.slow',{correlationId,path,method,durationMs,statusCode});
      return record;
    };
  }

  log(level, event, details = {}) {
    const record = { logId:crypto.randomUUID(), at:new Date(this.now()).toISOString(), level, event, service:'qelly-local-runtime', details };
    this.logs.push(record); if(this.logs.length>this.maxRecords)this.logs.shift();
    this.increment(`logs.${level}`);
    return record;
  }

  metrics({ providerRuntime, streamGateway, timeSeriesSummary = null } = {}) {
    const durations = this.requests.map((item)=>item.durationMs);
    const errors = this.requests.filter((item)=>item.statusCode>=500).length;
    const statusGroups = this.requests.reduce((acc,item)=>{const group=`${Math.floor(item.statusCode/100)}xx`;acc[group]=(acc[group]??0)+1;return acc;},{});
    return {
      generatedAt:new Date(this.now()).toISOString(), uptimeSeconds:Math.floor((this.now()-this.startedAt)/1000),
      http:{requests:this.requests.length,statusGroups,errorRate:this.requests.length?Number((errors/this.requests.length).toFixed(4)):0,latencyMs:{p50:percentile(durations,50),p95:percentile(durations,95),p99:percentile(durations,99),max:durations.length?Math.max(...durations):0}},
      counters:Object.fromEntries(this.counters),
      providers:providerRuntime?.registry().map((item)=>({providerId:item.providerId,status:item.status,quality:item.quality,metrics:item.metrics,breaker:item.breaker,bulkhead:item.bulkhead}))??[],
      streaming:streamGateway?.stats()??null,
      timeSeries:timeSeriesSummary,
      telemetryBoundary:'Local in-process privacy-safe operational telemetry; no external exporter configured.'
    };
  }

  overview({ providerRuntime, streamGateway, timeSeriesSummary = null, auditIntegrity = null } = {}) {
    const metrics = this.metrics({providerRuntime,streamGateway,timeSeriesSummary});
    const enabledProviders = metrics.providers.filter((item)=>item.status==='enabled');
    const healthyProviders = enabledProviders.filter((item)=>item.quality.score>=80 && item.breaker.state!=='open');
    const dependencies = [
      {id:'identity-runtime',status:'healthy',mode:'local-atomic-json'},
      {id:'instrument-master',status:'healthy',mode:'local-atomic-json'},
      {id:'time-series',status:timeSeriesSummary?.instruments?'healthy':'degraded',mode:'local-atomic-json'},
      {id:'stream-journal',status:'healthy',mode:'local-atomic-json'},
      {id:'provider-runtime',status:enabledProviders.length===healthyProviders.length?'healthy':'degraded',mode:'deterministic-fixture'},
      {id:'audit-ledger',status:auditIntegrity?.valid===false?'critical':'healthy',mode:'hash-chained-ndjson'},
      {id:'external-telemetry-export',status:'disabled',mode:'not-configured'},
      {id:'external-providers',status:'disabled',mode:'production-credentials-not-configured'}
    ];
    const slos = [
      {id:'local-api-availability',target:'99.0%',window:'candidate-only',actual:metrics.http.requests?`${((1-metrics.http.errorRate)*100).toFixed(2)}%`:'N/A',status:metrics.http.errorRate<=0.01?'meeting':'at-risk'},
      {id:'local-api-p95',target:'<250ms',window:'candidate-only',actual:`${metrics.http.latencyMs.p95}ms`,status:metrics.http.latencyMs.p95<250?'meeting':'at-risk'},
      {id:'stream-gap-free',target:'99.9%',window:'candidate-only',actual:metrics.streaming?.gapSignals?`${metrics.streaming.gapSignals} gap signals`:'0 gap signals',status:metrics.streaming?.gapSignals?'at-risk':'meeting'},
      {id:'audit-integrity',target:'100%',window:'candidate-only',actual:auditIntegrity?.valid===false?'invalid':'valid',status:auditIntegrity?.valid===false?'breached':'meeting'}
    ];
    return { release:'27.0.0', mode:'local-observability-foundation', dependencies, slos, metrics, productionSloEnforcement:false, externalTelemetryExport:false };
  }

  recentTraces(limit=100) { return {items:this.traces.slice(-Math.max(1,Math.min(Number(limit)||100,500))).reverse()}; }
  recentLogs(limit=100) { return {items:this.logs.slice(-Math.max(1,Math.min(Number(limit)||100,500))).reverse()}; }
}
