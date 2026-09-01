const ASSETS=Object.freeze([
  Object.freeze({id:'QI-EQUITY-AAPL',symbol:'AAPL',name:'Apple Inc.',assetClass:'Equity'}),
  Object.freeze({id:'QI-EQUITY-NVDA',symbol:'NVDA',name:'NVIDIA Corporation',assetClass:'Equity'}),
  Object.freeze({id:'QI-EQUITY-MSFT',symbol:'MSFT',name:'Microsoft Corporation',assetClass:'Equity'}),
  Object.freeze({id:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',assetClass:'Crypto asset'}),
  Object.freeze({id:'QI-CRYPTO-ETH',symbol:'ETH',name:'Ethereum',assetClass:'Crypto asset'})
]);
const METRICS=Object.freeze([
  Object.freeze({id:'price',label:'Price',unit:'USD',purpose:'Open a review when a declared price observation reaches a boundary.'}),
  Object.freeze({id:'change24h',label:'24-hour change',unit:'%',purpose:'Open a review when a declared rolling change leaves the expected range.'}),
  Object.freeze({id:'realizedVolatility',label:'Realized volatility',unit:'%',purpose:'Open a risk review when a declared volatility observation breaches tolerance.'}),
  Object.freeze({id:'volume',label:'Observed volume',unit:'USD m',purpose:'Open a liquidity review when declared activity changes materially.'}),
  Object.freeze({id:'evidenceConfidence',label:'Evidence confidence',unit:'%',purpose:'Open an evidence review when the declared confidence score falls below policy.'})
]);
const OPERATORS=Object.freeze([
  Object.freeze({id:'greater_than',label:'Greater than',needsPrevious:false,needsUpper:false}),
  Object.freeze({id:'less_than',label:'Less than',needsPrevious:false,needsUpper:false}),
  Object.freeze({id:'crosses_above',label:'Crosses above',needsPrevious:true,needsUpper:false}),
  Object.freeze({id:'crosses_below',label:'Crosses below',needsPrevious:true,needsUpper:false}),
  Object.freeze({id:'outside_band',label:'Outside band',needsPrevious:false,needsUpper:true})
]);
const SEVERITIES=Object.freeze([
  Object.freeze({id:'information',label:'Information',response:'Review in the normal research queue.'}),
  Object.freeze({id:'attention',label:'Attention',response:'Review within the declared operating session.'}),
  Object.freeze({id:'critical',label:'Critical',response:'Escalate to the named reviewer before any related decision.'})
]);
const CADENCES=Object.freeze([
  Object.freeze({id:'5m',label:'Every 5 minutes'}),Object.freeze({id:'15m',label:'Every 15 minutes'}),Object.freeze({id:'hourly',label:'Hourly'}),Object.freeze({id:'daily',label:'Daily review'})
]);
const SOURCE_DOMAINS=Object.freeze(['sec.gov','apple.com','nvidia.com','microsoft.com','nasdaq.com','nyse.com','cmegroup.com','bitcoin.org','ethereum.org','github.com']);
const clean=(value,max=500)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const number=(value)=>{if(value==null||String(value).trim()==='')return null;const parsed=Number(value);return Number.isFinite(parsed)&&Math.abs(parsed)<=1e12?parsed:null;};
const integer=(value,fallback,min,max)=>{const parsed=Number.parseInt(String(value??''),10);return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback;};
const choice=(value,items,fallback)=>items.some((item)=>item.id===value)?value:fallback;
const asset=(value)=>ASSETS.find((item)=>item.id===value||item.symbol===String(value||'').toUpperCase())||ASSETS[0];
const officialSource=(value)=>{try{const url=new URL(String(value||''));if(url.protocol!=='https:')return null;const hostname=url.hostname.toLowerCase();const authority=SOURCE_DOMAINS.find((domain)=>hostname===domain||hostname.endsWith(`.${domain}`));return authority?{url:url.href,authority}:null;}catch{return null;}};
const instant=(value)=>{const normalized=clean(value,40);if(!normalized)return null;const parsed=Date.parse(normalized);return Number.isFinite(parsed)?new Date(parsed).toISOString():null;};
const round=(value,digits=2)=>Number(Number(value).toFixed(digits));
const fingerprint=(value)=>{let hash=2166136261;for(const char of String(value||'')){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return `fnv1a-${(hash>>>0).toString(16).padStart(8,'0')}`;};
function evaluate({operator,previousValue,currentValue,threshold,upperThreshold}){
  if(currentValue==null||threshold==null)return null;
  if(operator==='greater_than')return currentValue>threshold;
  if(operator==='less_than')return currentValue<threshold;
  if(operator==='crosses_above')return previousValue==null?null:previousValue<=threshold&&currentValue>threshold;
  if(operator==='crosses_below')return previousValue==null?null:previousValue>=threshold&&currentValue<threshold;
  if(operator==='outside_band')return upperThreshold==null?null:currentValue<threshold||currentValue>upperThreshold;
  return null;
}

export function buildPublicAlertRules(input={}){
  const selected=asset(input.asset);
  const metricId=choice(clean(input.metric,30),METRICS,'price');
  const operatorId=choice(clean(input.operator,30),OPERATORS,'crosses_above');
  const severityId=choice(clean(input.severity,30),SEVERITIES,'attention');
  const cadenceId=choice(clean(input.cadence,20),CADENCES,'15m');
  const metric=METRICS.find((item)=>item.id===metricId);
  const operator=OPERATORS.find((item)=>item.id===operatorId);
  const severity=SEVERITIES.find((item)=>item.id===severityId);
  const cadence=CADENCES.find((item)=>item.id===cadenceId);
  const threshold=number(input.threshold),upperThreshold=number(input.upperThreshold),previousValue=number(input.previousValue),currentValue=number(input.currentValue);
  const observedAt=instant(input.observedAt),evaluatedAt=instant(input.evaluatedAt);
  const staleAfterMinutes=integer(input.staleAfterMinutes,60,1,10080);
  const cooldownMinutes=integer(input.cooldownMinutes,60,0,10080);
  const confirmationCount=integer(input.confirmationCount,2,1,10);
  const source=officialSource(input.sourceUrl);
  const ageMinutes=observedAt&&evaluatedAt?round((Date.parse(evaluatedAt)-Date.parse(observedAt))/60000):null;
  const temporalOrder=ageMinutes!=null&&ageMinutes>=0;
  const fresh=temporalOrder&&ageMinutes<=staleAfterMinutes;
  const thresholdReady=threshold!=null&&(!operator.needsUpper||(upperThreshold!=null&&upperThreshold>threshold));
  const observationReady=currentValue!=null&&(!operator.needsPrevious||previousValue!=null);
  const outcome=thresholdReady&&observationReady?evaluate({operator:operatorId,previousValue,currentValue,threshold,upperThreshold}):null;
  const declaration={
    ruleName:clean(input.ruleName,100),reviewQuestion:clean(input.reviewQuestion,420),triggerMeaning:clean(input.triggerMeaning,420),owner:clean(input.owner,100),reviewer:clean(input.reviewer,100),resetCondition:clean(input.resetCondition,420),sourceUrl:source?.url??null,observedAt,evaluatedAt,staleAfterMinutes,cooldownMinutes,confirmationCount
  };
  const gates=[
    {id:'identity',label:'Rule identity',state:declaration.ruleName?'ready':'blocked',purpose:'Give the trigger one unambiguous operational name.',detail:declaration.ruleName||'Name the rule.'},
    {id:'signal',label:'Signal definition',state:selected&&metric&&operator?'ready':'blocked',purpose:'Bind one instrument, measurable metric, unit and operator.',detail:`${selected.symbol} · ${metric.label} (${metric.unit}) · ${operator.label}`},
    {id:'threshold',label:'Threshold integrity',state:thresholdReady?'ready':'blocked',purpose:'Require a finite threshold and a valid ordered band when needed.',detail:thresholdReady?(operator.needsUpper?`${threshold}–${upperThreshold} ${metric.unit}`:`${operator.label} ${threshold} ${metric.unit}`):operator.needsUpper?'Enter a lower threshold and a greater upper threshold.':'Enter one finite threshold.'},
    {id:'observation',label:'Evaluation evidence',state:observationReady?'ready':'blocked',purpose:'Require the declared observation needed to test the chosen operator.',detail:observationReady?`${previousValue??'n/a'} → ${currentValue} ${metric.unit}`:operator.needsPrevious?'Declare both previous and current values.':'Declare the current value.'},
    {id:'source',label:'Source authority',state:source?'ready':'blocked',purpose:'Anchor the observation to an approved issuer, regulator, exchange or protocol authority.',detail:source?source.authority:'Provide an approved HTTPS source.'},
    {id:'freshness',label:'Freshness proof',state:fresh?'ready':'blocked',purpose:'Prevent stale or future-dated observations from opening a review.',detail:ageMinutes==null?'Declare observation and evaluation timestamps.':!temporalOrder?'Observation cannot occur after evaluation.':`${ageMinutes} minutes old · policy ${staleAfterMinutes} minutes`},
    {id:'intent',label:'Review intent',state:declaration.reviewQuestion&&declaration.triggerMeaning?'ready':'blocked',purpose:'Explain the question this trigger opens and why the breach matters.',detail:declaration.reviewQuestion&&declaration.triggerMeaning?'Question and trigger meaning declared.':'Declare the review question and trigger meaning.'},
    {id:'control',label:'Noise control',state:declaration.resetCondition&&confirmationCount>=1&&cooldownMinutes>=0?'ready':'blocked',purpose:'Define confirmations, cooldown and the reset condition before repeated alerts.',detail:declaration.resetCondition?`${confirmationCount} confirmation(s) · ${cooldownMinutes} minute cooldown`:'Declare the condition that resets the rule.'},
    {id:'accountability',label:'Ownership & escalation',state:declaration.owner&&declaration.reviewer?'ready':'blocked',purpose:'Assign rule maintenance and the human who reviews a qualified trigger.',detail:declaration.owner&&declaration.reviewer?`${declaration.owner} owns · ${declaration.reviewer} reviews`:'Declare an owner and reviewer.'}
  ];
  const readyGates=gates.filter((item)=>item.state==='ready').length;
  const complete=gates.every((item)=>item.state==='ready');
  const canonical=[selected.id,metricId,operatorId,severityId,cadenceId,threshold??'',upperThreshold??'',previousValue??'',currentValue??'',...Object.values(declaration)].join('|');
  const integrity=fingerprint(canonical);
  const evaluation={state:!complete?'blocked':outcome?'trigger-qualified':'condition-not-met',conditionMet:complete?outcome:null,reviewRequired:complete?outcome:false,previousValue,currentValue,threshold,upperThreshold,observationAgeMinutes:ageMinutes,fresh,notificationsCreated:0,externalDeliveryAttempted:false};
  const receipt={state:complete?'ready':'draft',ruleId:complete?`${selected.symbol}-${metricId.toUpperCase()}-${integrity.slice(-8)}`:null,fingerprint:integrity,persisted:false,scheduleRegistered:false,lastEvaluation:evaluation.state};
  return {
    version:'governed-alert-rules-v2',state:complete?'rule-ready':'rule-setup-ready',
    job:'Convert one measurable condition into an evidence-qualified review trigger with declared freshness, noise controls, ownership and escalation—without pretending a scheduler or delivery channel is connected.',
    assets:ASSETS,metrics:METRICS,operators:OPERATORS,severities:SEVERITIES,cadences:CADENCES,sourceDomains:SOURCE_DOMAINS,
    selected,metric,operator,severity,cadence,declaration,signal:{threshold,upperThreshold,previousValue,currentValue},evaluation,receipt,gates,
    readiness:{readyGates,totalGates:gates.length,ruleReady:complete,state:complete?'ready-for-human-registration':'blocked-missing-rule-fields'},
    coverage:{connectedRules:0,scheduledEvaluations:0,notificationsCreated:0,liveFeed:false,reason:'No approved production rule store, observation feed, scheduler or delivery worker is connected. The rule and observations in this contract are user-declared and evaluated deterministically on request.'},
    protocol:[
      {step:'01',label:'Define',job:'Bind one metric, unit and condition to one instrument.'},
      {step:'02',label:'Evidence',job:'Declare the observation, timestamp and approved source authority.'},
      {step:'03',label:'Qualify',job:'Apply freshness, confirmation and threshold integrity gates.'},
      {step:'04',label:'Suppress',job:'Use cooldown and reset semantics to prevent repeated noise.'},
      {step:'05',label:'Review',job:'Open the named human question; do not auto-decide or execute.'},
      {step:'06',label:'Escalate',job:'Carry qualified evidence to the reviewer and Decision Provenance.'}
    ],
    handoffs:[
      {route:'advanced-chart',label:'Advanced Chart Studio',job:'Reconstruct a technical observation and its parameters before declaring it.'},
      {route:'event-calendar',label:'Event Calendar',job:'Plan catalyst monitoring when the trigger is time-bound rather than threshold-bound.'},
      {route:'notification-center',label:'Notifications',job:'Triage delivered items after a production delivery channel is connected.'},
      {route:'decision-provenance',label:'Decision Provenance',job:'Attach a qualified trigger receipt to an accountable human decision.'}
    ],
    boundaries:{fixtureRules:false,liveObservationFetched:false,userDeclaredObservation:true,sourceContentFetched:false,sourceContentVerified:false,persistence:false,scheduler:false,backgroundEvaluation:false,email:false,sms:false,push:false,webhook:false,recommendation:false,execution:false}
  };
}

export const __test=Object.freeze({ASSETS,METRICS,OPERATORS,SEVERITIES,CADENCES,SOURCE_DOMAINS,clean,number,integer,choice,asset,officialSource,instant,evaluate,fingerprint});
