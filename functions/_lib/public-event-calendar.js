const ASSETS=Object.freeze([
  Object.freeze({id:'QI-EQUITY-AAPL',symbol:'AAPL',name:'Apple Inc.',assetClass:'Equity'}),
  Object.freeze({id:'QI-EQUITY-NVDA',symbol:'NVDA',name:'NVIDIA Corporation',assetClass:'Equity'}),
  Object.freeze({id:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',assetClass:'Crypto asset'})
]);

const EVENT_TYPES=Object.freeze([
  Object.freeze({id:'earnings',label:'Earnings & guidance',purpose:'Prepare for reported results, guidance changes and management explanation.',questions:['Which operating driver matters most?','Which definition or period could change?','What would invalidate the pre-event expectation?']}),
  Object.freeze({id:'macro',label:'Macro release or policy',purpose:'Map an official economic release or policy decision to a declared asset exposure.',questions:['Which official series or decision is observed?','Is the effect direct, second-order or only contextual?','Which horizon should absorb the information?']}),
  Object.freeze({id:'corporate-action',label:'Corporate action',purpose:'Track a dividend, split, vote, transaction or capital-allocation milestone.',questions:['What legal or board action is required?','Which date is record, effective or settlement?','What changes for ownership or valuation?']}),
  Object.freeze({id:'product-regulatory',label:'Product or regulatory milestone',purpose:'Separate a launch, approval, hearing or ruling from market speculation.',questions:['Which authority or issuer owns the milestone?','Is the date confirmed or only a declared window?','What exact outcome changes the thesis?']}),
  Object.freeze({id:'protocol',label:'Protocol or network event',purpose:'Plan review of a network upgrade, governance decision or issuance milestone.',questions:['Which repository or governance source is primary?','What activation condition must be met?','Which technical or market consequence is measurable?']})
]);

const DATE_CONFIDENCE=Object.freeze([
  Object.freeze({id:'confirmed',label:'Confirmed date',purpose:'The primary source states the exact date and time.'}),
  Object.freeze({id:'tentative',label:'Tentative date',purpose:'The date is provisional and must be rechecked before the event.'}),
  Object.freeze({id:'window',label:'Declared window',purpose:'Only a bounded period is known; do not present a precise forecast.'})
]);

const TIMEZONES=Object.freeze(['UTC','America/New_York','America/Los_Angeles','Europe/London','Asia/Kolkata']);
const APPROVED_SOURCE_DOMAINS=Object.freeze(['sec.gov','apple.com','nvidia.com','nasdaq.com','nyse.com','cmegroup.com','federalreserve.gov','bls.gov','bea.gov','github.com','bitcoin.org']);
const text=(value,max=500)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const date=(value)=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):null;
const time=(value)=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value||''))?String(value):null;
const choice=(value,catalog,fallback)=>catalog.some((item)=>item.id===value)?value:fallback;
const integer=(value,fallback,min,max)=>{const number=Number.parseInt(String(value??''),10);return Number.isFinite(number)?Math.min(max,Math.max(min,number)):fallback;};
const officialSource=(value)=>{try{const url=new URL(String(value||''));if(url.protocol!=='https:')return null;const hostname=url.hostname.toLowerCase();const authority=APPROVED_SOURCE_DOMAINS.find((domain)=>hostname===domain||hostname.endsWith(`.${domain}`));return authority?{url:url.href,authority}:null;}catch{return null;}};
const fingerprint=(value)=>{let hash=2166136261;for(const char of String(value||'')){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return `fnv1a-${(hash>>>0).toString(16).padStart(8,'0')}`;};
const shiftDate=(value,days)=>{if(!value)return null;const parsed=new Date(`${value}T12:00:00.000Z`);parsed.setUTCDate(parsed.getUTCDate()+days);return parsed.toISOString().slice(0,10);};

export function buildPublicEventCalendar(requestedAsset='QI-EQUITY-AAPL',input={}){
  const selected=ASSETS.find((item)=>item.id===requestedAsset||item.symbol===String(requestedAsset||'').toUpperCase())||ASSETS[0];
  const eventType=choice(text(input.eventType,30),EVENT_TYPES,'earnings');
  const dateConfidence=choice(text(input.dateConfidence,20),DATE_CONFIDENCE,'confirmed');
  const source=officialSource(input.sourceUrl);
  const declaration={
    eventType,dateConfidence,title:text(input.title,140),scheduledDate:date(input.scheduledDate),scheduledTime:time(input.scheduledTime),
    timezone:TIMEZONES.includes(input.timezone)?input.timezone:'UTC',windowDays:integer(input.windowDays,3,1,30),sourceUrl:source?.url??null,
    thesisExposure:text(input.thesisExposure,420),preEventQuestion:text(input.preEventQuestion,420),confirmationSignal:text(input.confirmationSignal,420),
    adverseSignal:text(input.adverseSignal,420),owner:text(input.owner,100)
  };
  const required={
    title:Boolean(declaration.title),scheduledDate:Boolean(declaration.scheduledDate),scheduledTime:Boolean(declaration.scheduledTime),officialSource:Boolean(source),
    thesisExposure:Boolean(declaration.thesisExposure),preEventQuestion:Boolean(declaration.preEventQuestion),outcomeMatrix:Boolean(declaration.confirmationSignal&&declaration.adverseSignal),owner:Boolean(declaration.owner)
  };
  const complete=Object.values(required).every(Boolean);
  const canonical=[selected.id,declaration.eventType,declaration.dateConfidence,declaration.title,declaration.scheduledDate||'',declaration.scheduledTime||'',declaration.timezone,declaration.windowDays,declaration.sourceUrl||'',declaration.thesisExposure,declaration.preEventQuestion,declaration.confirmationSignal,declaration.adverseSignal,declaration.owner].join('|');
  const integrity=fingerprint(canonical);
  const plan={
    state:complete?'ready':'draft',planId:complete?`${selected.symbol}-${declaration.eventType.toUpperCase()}-${declaration.scheduledDate}-${integrity.slice(-8)}`:null,
    fingerprint:integrity,...declaration,sourceAuthority:source?.authority??null,userDeclared:true,notificationScheduled:false,persisted:false
  };
  const gates=[
    {id:'identity',label:'Asset identity',state:'ready',purpose:'Keep the event attached to one resolved instrument.',detail:`${selected.id} · ${selected.name}`},
    {id:'event',label:'Event identity',state:required.title?'ready':'blocked',purpose:'Name one catalyst instead of mixing multiple milestones.',detail:declaration.title||'Give the event a precise title.'},
    {id:'schedule',label:'Date, time & zone',state:required.scheduledDate&&required.scheduledTime?'ready':'blocked',purpose:'Make the review window unambiguous across locations.',detail:required.scheduledDate&&required.scheduledTime?`${declaration.scheduledDate} · ${declaration.scheduledTime} · ${declaration.timezone}`:'Declare an exact date, time and timezone.'},
    {id:'source',label:'Primary source',state:required.officialSource?'ready':'blocked',purpose:'Anchor timing to an approved issuer, regulator, exchange or protocol authority.',detail:source?`${source.authority} · ${source.url}`:'Use an approved HTTPS primary-source domain.'},
    {id:'exposure',label:'Thesis exposure',state:required.thesisExposure?'ready':'blocked',purpose:'Explain why this event can change the current decision.',detail:declaration.thesisExposure||'Describe the thesis variable exposed to the event.'},
    {id:'question',label:'Pre-event question',state:required.preEventQuestion?'ready':'blocked',purpose:'Prevent post-event storytelling by recording the question in advance.',detail:declaration.preEventQuestion||'Write the question that must be answered.'},
    {id:'outcomes',label:'Two-sided outcomes',state:required.outcomeMatrix?'ready':'blocked',purpose:'Define confirming and adverse evidence before observing the result.',detail:required.outcomeMatrix?'Confirming and adverse signals declared.':'Declare both confirming and adverse signals.'},
    {id:'owner',label:'Review owner',state:required.owner?'ready':'blocked',purpose:'Assign responsibility for source verification and decision follow-up.',detail:declaration.owner||'Name the responsible reviewer.'}
  ];
  const readyGates=gates.filter((item)=>item.state==='ready').length;
  const selectedType=EVENT_TYPES.find((item)=>item.id===eventType);
  return {
    version:'governed-event-calendar-v2',state:complete?'monitoring-plan-ready':'event-registration-ready',
    job:'Turn one user-declared future catalyst into a sourced, two-sided and owned monitoring plan without inventing event coverage or sending notifications.',
    assets:ASSETS,selected,eventTypes:EVENT_TYPES,dateConfidence:DATE_CONFIDENCE,timezones:TIMEZONES,approvedSourceDomains:APPROVED_SOURCE_DOMAINS,
    declaration,plan,gates,readiness:{readyGates,totalGates:gates.length,planReady:complete,state:complete?'ready-for-monitoring-review':'blocked-missing-plan-fields'},
    coverage:{connectedEvents:0,registeredPlans:complete?1:0,liveFeed:false,reason:'No approved production event feed is connected. Qelly accepts a user-declared event plan only after primary-source, timing and outcome gates pass.'},
    eventGuide:selectedType,
    reviewTimeline:[
      {phase:'Prepare',when:`T-${declaration.windowDays}d`,job:'Recheck the primary source, date confidence, definitions and comparable baseline.'},
      {phase:'Freeze',when:'T-1d',job:'Freeze the pre-event question, thesis exposure and two-sided outcome criteria.'},
      {phase:'Observe',when:'T0',job:'Record only the official outcome and its stated period, scope and qualifiers.'},
      {phase:'Verify',when:'T+1d',job:'Compare the observed outcome with both predeclared signals and collect counter-evidence.'},
      {phase:'Decide',when:`T+${declaration.windowDays}d`,job:'Update the human decision record, invalidation rule and next review date.'}
    ],
    monitoringWindow:{start:shiftDate(declaration.scheduledDate,-declaration.windowDays),event:declaration.scheduledDate,end:shiftDate(declaration.scheduledDate,declaration.windowDays),days:declaration.windowDays,timezone:declaration.timezone},
    handoffs:[
      {route:'filing-workspace',label:'Filing Workspace',job:'Build claim-level citations from issuer or regulatory disclosures.'},
      {route:'news-research',label:'Qelly Chat & Research',job:'Investigate context and counter-evidence without changing the declared event.'},
      {route:'advanced-chart',label:'Advanced Chart Studio',job:'Freeze a reproducible pre-event market baseline.'},
      {route:'decision-provenance',label:'Decision Provenance',job:'Attach the monitoring receipt to a human decision and invalidation rule.'}
    ],
    boundaries:{fixtureEvents:false,datesInvented:false,sourceFetched:false,contentVerified:false,userDeclaredPlan:true,notificationDelivery:false,alertRuleCreated:false,recommendation:false,execution:false,persistence:false}
  };
}

export const __test=Object.freeze({ASSETS,EVENT_TYPES,DATE_CONFIDENCE,TIMEZONES,APPROVED_SOURCE_DOMAINS,text,date,time,choice,integer,officialSource,fingerprint,shiftDate});
