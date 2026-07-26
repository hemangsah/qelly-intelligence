import { marketRows, instruments } from '../../server/fixtures.mjs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class FixtureMarketAdapter {
  constructor({ providerId = 'qelly-fixture-primary', role = 'primary', latencyMs = 4, valueOffset = 0 } = {}) {
    this.providerId = providerId;
    this.role = role;
    this.latencyMs = latencyMs;
    this.valueOffset = valueOffset;
  }
  capabilities() { return ['search','quote','timeseries','stream','mapping','reference']; }
  async health() { return { status:'healthy', checkedAt:new Date().toISOString(), mode:'deterministic-fixture' }; }
  async #scenario(context) {
    if (context.scenario === `${this.providerId}:timeout`) await delay(context.deadlineMs + 25);
    if (context.scenario === `${this.providerId}:error`) throw Object.assign(new Error('Deterministic provider failure'), { code:'fixture_provider_failure', retryable:true });
    await delay(this.latencyMs);
  }
  async search(request, context) {
    await this.#scenario(context); const q=String(request.q ?? '').toLowerCase();
    return instruments.filter((item)=>!q||`${item.name} ${item.symbol} ${item.canonicalId}`.toLowerCase().includes(q)).slice(0,Number(request.limit ?? 20));
  }
  async quote(request, context) {
    await this.#scenario(context);
    const row=marketRows.find((item)=>item.id===request.canonicalId || item.symbol.toLowerCase()===String(request.symbol??'').toLowerCase());
    if(!row) throw Object.assign(new Error('Instrument quote not found'),{code:'provider_not_found',retryable:false,status:404});
    const value=Number((row.price*(1+this.valueOffset)).toFixed(8));
    const now=new Date().toISOString();
    return { canonicalEntityId:row.id,value:String(value),unit:row.currency,source:`${this.providerId} deterministic adapter`,providerId:this.providerId,observedAt:row.observedAt,receivedAt:now,freshnessClass:context.scenario==='stale'?'stale':'simulated',confidence:this.role==='validation'?0.9:0.96,qualityFlags:['deterministic-provider-adapter'],entitlementClass:'development-fixture',costUnits:1 };
  }
  async timeseries(request, context) {
    await this.#scenario(context); const quote=await this.quote(request,{...context,scenario:null});
    const points=Array.from({length:Math.min(Number(request.points??30),200)},(_,index)=>({at:new Date(Date.now()-(29-index)*86400000).toISOString(),value:String((Number(quote.value)*(0.94+index*0.002+Math.sin(index/3)*0.01)).toFixed(8))}));
    return { canonicalEntityId:quote.canonicalEntityId,interval:request.interval??'1d',points,metadata:{providerId:this.providerId,source:quote.source,freshnessClass:quote.freshnessClass,entitlementClass:'development-fixture',costUnits:points.length/10} };
  }
}
