import {HttpError} from './runtime.js';

const EVENTS=new Set(['route_view','calculator_open','calculator_complete','decision_open','decision_range_selected','decision_explain','qelly_view_interaction','asset_search','research_click','india_finance_use','ad_slot_eligibility','ad_slot_render','consent_status','degraded_state','client_error']);
const ROUTES=new Set(['market','asset-rankings','asset-intelligence','advanced-chart','decision-provenance','news-research','research-workspace','calculator-center','calculator-detail','india-finance','indicator-library','indicator-detail','formula-library','formula-detail','search','categories','venues','dex-discovery','global-charts','converter','event-calendar','comparison-lab']);
const PROPERTIES=new Set(['route','feature','action','state','surface','returning','count']);
const TOKEN=/^[a-z0-9][a-z0-9_.:-]{0,63}$/i;

export function normalizeAnalyticsBatch(payload,{now=Date.now()}={}){
  if(payload?.schemaVersion!==1||!Array.isArray(payload.events)||payload.events.length<1||payload.events.length>20)throw new HttpError(400,'invalid_analytics_batch','Analytics batches must contain 1–20 schema-version 1 events.');
  const cutoff=now+300000;
  return Object.freeze(payload.events.map((event)=>{
    const name=String(event?.name||'').toLowerCase();
    if(!EVENTS.has(name))throw new HttpError(400,'invalid_analytics_event','Analytics event is not allowlisted.');
    const occurredAt=new Date(event?.occurredAt||'');
    if(Number.isNaN(occurredAt.valueOf())||occurredAt.valueOf()>cutoff)throw new HttpError(400,'invalid_analytics_event','Analytics event timestamp is invalid.');
    const properties={};
    for(const [key,value] of Object.entries(event?.properties??{})){
      if(!PROPERTIES.has(key))throw new HttpError(400,'invalid_analytics_property','Analytics property is not allowlisted.');
      if(key==='returning'){properties.returning=value===true;continue;}
      if(key==='count'){properties.count=Math.max(1,Math.min(100,Math.trunc(Number(value)||1)));continue;}
      const token=String(value??'').toLowerCase();
      if(!TOKEN.test(token))throw new HttpError(400,'invalid_analytics_property','Analytics property value must be a coarse token.');
      if(key==='route'&&!ROUTES.has(token))throw new HttpError(400,'invalid_analytics_route','Analytics route is not allowlisted.');
      properties[key]=token;
    }
    return Object.freeze({name,properties:Object.freeze(properties),occurredAt:occurredAt.toISOString()});
  }));
}

export function summarizeAnalyticsBatch(events){
  const counts={};
  for(const event of events){
    const key=[event.name,event.properties.route||'none',event.properties.feature||'none'].join(':');
    counts[key]=(counts[key]||0)+(event.properties.count||1);
  }
  return Object.freeze({event:'qelly_product_analytics',schemaVersion:1,eventCount:events.length,counts,containsUserInputs:false,containsIdentifiers:false});
}
