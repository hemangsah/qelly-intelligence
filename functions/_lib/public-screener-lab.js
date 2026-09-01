const FIELDS=Object.freeze([
  Object.freeze({id:'price',label:'Price',unit:'currency',operators:['greater_than','greater_than_or_equal','less_than','less_than_or_equal','is_available','is_unavailable']}),
  Object.freeze({id:'change24h',label:'24-hour change',unit:'percent',operators:['greater_than','greater_than_or_equal','less_than','less_than_or_equal','is_available','is_unavailable']}),
  Object.freeze({id:'marketCap',label:'Market value',unit:'currency',operators:['greater_than','greater_than_or_equal','less_than','less_than_or_equal','is_available','is_unavailable']}),
  Object.freeze({id:'volatility30d',label:'30-day volatility',unit:'percent',operators:['greater_than','greater_than_or_equal','less_than','less_than_or_equal','is_available','is_unavailable']}),
  Object.freeze({id:'peRatio',label:'P/E ratio',unit:'multiple',operators:['greater_than','greater_than_or_equal','less_than','less_than_or_equal','is_available','is_unavailable']}),
  Object.freeze({id:'revenueGrowth',label:'Revenue growth',unit:'percent',operators:['greater_than','greater_than_or_equal','less_than','less_than_or_equal','is_available','is_unavailable']}),
  Object.freeze({id:'dividendYield',label:'Dividend yield',unit:'percent',operators:['greater_than','greater_than_or_equal','less_than','less_than_or_equal','is_available','is_unavailable']})
]);
const OPERATORS=Object.freeze([
  Object.freeze({id:'greater_than',label:'Greater than',symbol:'>'}),
  Object.freeze({id:'greater_than_or_equal',label:'At least',symbol:'≥'}),
  Object.freeze({id:'less_than',label:'Less than',symbol:'<'}),
  Object.freeze({id:'less_than_or_equal',label:'At most',symbol:'≤'}),
  Object.freeze({id:'is_available',label:'Is available',symbol:'available'}),
  Object.freeze({id:'is_unavailable',label:'Is unavailable',symbol:'unavailable'})
]);
const ASSET_CLASSES=Object.freeze([
  Object.freeze({id:'all',label:'All declared classes'}),Object.freeze({id:'equity',label:'Equity'}),Object.freeze({id:'crypto',label:'Crypto'}),
  Object.freeze({id:'fund',label:'Fund'}),Object.freeze({id:'commodity',label:'Commodity'}),Object.freeze({id:'index',label:'Index'}),Object.freeze({id:'fx',label:'FX'})
]);
const REGIONS=Object.freeze([
  Object.freeze({id:'global',label:'Global'}),Object.freeze({id:'us',label:'United States'}),Object.freeze({id:'india',label:'India'}),
  Object.freeze({id:'europe',label:'Europe'}),Object.freeze({id:'asia-pacific',label:'Asia Pacific'}),Object.freeze({id:'other',label:'Other declared region'})
]);
const MISSING_POLICIES=Object.freeze([
  Object.freeze({id:'exclude',label:'Exclude candidate',job:'A missing required observation fails only that candidate.'}),
  Object.freeze({id:'manual_review',label:'Route to manual review',job:'A missing required observation prevents automatic qualification.'}),
  Object.freeze({id:'fail_screen',label:'Block the screen',job:'Any missing required observation blocks this evaluation contract.'})
]);
const CADENCES=Object.freeze([
  Object.freeze({id:'event_driven',label:'Event-driven'}),Object.freeze({id:'daily',label:'Daily'}),Object.freeze({id:'weekly',label:'Weekly'}),Object.freeze({id:'monthly',label:'Monthly'})
]);
const clean=(value,max=500)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const number=(value)=>{if(value==null||String(value).trim()==='')return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;};
const integer=(value,fallback,min,max)=>{const parsed=Number.parseInt(String(value??''),10);return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback;};
const instant=(value)=>{const normalized=clean(value,40);if(!normalized)return null;const parsed=Date.parse(normalized);return Number.isFinite(parsed)?new Date(parsed).toISOString():null;};
const select=(value,items,fallback)=>items.some((item)=>item.id===value)?value:fallback;
const fingerprint=(value)=>{let hash=2166136261;for(const char of String(value||'')){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return `fnv1a-${(hash>>>0).toString(16).padStart(8,'0')}`;};
const compare=(actual,operator,threshold)=>{
  if(operator==='is_available')return actual!=null;
  if(operator==='is_unavailable')return actual==null;
  if(actual==null||threshold==null)return false;
  if(operator==='greater_than')return actual>threshold;
  if(operator==='greater_than_or_equal')return actual>=threshold;
  if(operator==='less_than')return actual<threshold;
  if(operator==='less_than_or_equal')return actual<=threshold;
  return false;
};

function normalizeRule(input,index){
  const fieldId=select(clean(input[`rule${index}Field`],40),FIELDS,index===1?'change24h':index===2?'volatility30d':'marketCap');
  const field=FIELDS.find((item)=>item.id===fieldId);
  const requestedOperator=clean(input[`rule${index}Operator`],40);
  const operatorId=field.operators.includes(requestedOperator)?requestedOperator:(index===2?'less_than_or_equal':'greater_than_or_equal');
  const operator=OPERATORS.find((item)=>item.id===operatorId);
  const threshold=number(input[`rule${index}Value`]);
  const observed=number(input[`rule${index}Observed`]);
  const thresholdRequired=!['is_available','is_unavailable'].includes(operatorId);
  const ready=Boolean(field&&operator&&(!thresholdRequired||threshold!=null));
  return {index,field,operator,threshold,observed,thresholdRequired,ready};
}

function evaluateRule(rule,missingPolicy){
  if(!rule.ready)return {...rule,state:'blocked',result:null,detail:'Complete the typed rule.'};
  const missing=rule.observed==null;
  if(missing&&!['is_available','is_unavailable'].includes(rule.operator.id)){
    const state=missingPolicy==='manual_review'?'manual-review':missingPolicy==='fail_screen'?'blocked':'failed';
    return {...rule,state,result:false,detail:missingPolicy==='manual_review'?'Required observation is missing; route to human review.':missingPolicy==='fail_screen'?'Required observation is missing; the screen contract is blocked.':'Required observation is missing; exclude this candidate.'};
  }
  const result=compare(rule.observed,rule.operator.id,rule.threshold);
  return {...rule,state:result?'passed':'failed',result,detail:`${rule.field.label}: ${rule.observed==null?'unavailable':rule.observed} ${rule.operator.symbol}${rule.thresholdRequired?` ${rule.threshold}`:''}`};
}

export function buildPublicScreenerLab(input={}){
  const assetClassId=select(clean(input.assetClass,40),ASSET_CLASSES,'all');
  const regionId=select(clean(input.region,40),REGIONS,'global');
  const candidateAssetClassId=select(clean(input.candidateAssetClass,40),ASSET_CLASSES,'all');
  const candidateRegionId=select(clean(input.candidateRegion,40),REGIONS,'global');
  const missingPolicyId=select(clean(input.missingPolicy,40),MISSING_POLICIES,'manual_review');
  const cadenceId=select(clean(input.reviewCadence,40),CADENCES,'weekly');
  const sortFieldId=select(clean(input.sortField,40),FIELDS,'marketCap');
  const direction=clean(input.direction,10)==='asc'?'asc':'desc';
  const maxAgeMinutes=integer(input.maxAgeMinutes,1440,1,525600);
  const resultLimit=integer(input.resultLimit,25,1,100);
  const snapshotAt=instant(input.snapshotAt),observedAt=instant(input.observedAt);
  const ageMinutes=snapshotAt&&observedAt?Number(((Date.parse(snapshotAt)-Date.parse(observedAt))/60000).toFixed(2)):null;
  const temporalOrder=ageMinutes!=null&&ageMinutes>=0;
  const fresh=temporalOrder&&ageMinutes<=maxAgeMinutes;
  const rules=[1,2,3].map((index)=>normalizeRule(input,index));
  const declaration={
    screenName:clean(input.screenName,120),researchQuestion:clean(input.researchQuestion,420),assetClass:assetClassId,region:regionId,
    sourceName:clean(input.sourceName,120),sourceLocator:clean(input.sourceLocator,300),snapshotAt,maxAgeMinutes,missingPolicy:missingPolicyId,
    sortField:sortFieldId,direction,resultLimit,owner:clean(input.owner,100),reviewCadence:cadenceId,invalidationCondition:clean(input.invalidationCondition,420),
    candidateId:clean(input.candidateId,100),symbol:clean(input.symbol,40).toUpperCase(),candidateAssetClass:candidateAssetClassId,candidateRegion:candidateRegionId,observedAt,
    candidateNote:clean(input.candidateNote,420)
  };
  const objectiveReady=Boolean(declaration.screenName&&declaration.researchQuestion);
  const universeReady=Boolean(assetClassId&&regionId);
  const evidenceReady=Boolean(declaration.sourceName&&declaration.sourceLocator&&snapshotAt&&observedAt&&temporalOrder);
  const rulesReady=rules.every((rule)=>rule.ready);
  const candidateReady=Boolean(declaration.candidateId&&declaration.symbol&&candidateAssetClassId!=='all'&&candidateRegionId!=='global');
  const outputReady=Boolean(sortFieldId&&direction&&resultLimit);
  const ownershipReady=Boolean(declaration.owner&&declaration.invalidationCondition&&cadenceId);
  const missingReady=Boolean(missingPolicyId);
  const gates=[
    {id:'objective',label:'Research objective',state:objectiveReady?'ready':'blocked',purpose:'Make the screen answer one explicit research question.',detail:objectiveReady?`${declaration.screenName} · ${declaration.researchQuestion}`:'Name the screen and declare the question it tests.'},
    {id:'universe',label:'Universe contract',state:universeReady?'ready':'blocked',purpose:'Bound the eligible asset class and region before filtering.',detail:`${ASSET_CLASSES.find((item)=>item.id===assetClassId).label} · ${REGIONS.find((item)=>item.id===regionId).label}`},
    {id:'evidence',label:'Evidence and freshness',state:evidenceReady&&fresh?'ready':'blocked',purpose:'Bind observations to a declared source, locator and time policy.',detail:!evidenceReady?'Declare source, locator, snapshot and candidate observation time.':!fresh?`Observation is ${ageMinutes} minutes old; policy allows ${maxAgeMinutes}.`:`${declaration.sourceName} · ${ageMinutes} minutes old · within ${maxAgeMinutes} minute policy`},
    {id:'rules',label:'Typed rule set',state:rulesReady?'ready':'blocked',purpose:'Require three complete typed predicates.',detail:`${rules.filter((rule)=>rule.ready).length}/3 rules complete · custom code unavailable`},
    {id:'missing',label:'Missing-data policy',state:missingReady?'ready':'blocked',purpose:'Declare what unavailable observations do to qualification.',detail:MISSING_POLICIES.find((item)=>item.id===missingPolicyId).job},
    {id:'candidate',label:'Candidate identity',state:candidateReady?'ready':'blocked',purpose:'Bind the test to one named candidate and comparable universe.',detail:candidateReady?`${declaration.symbol} · ${ASSET_CLASSES.find((item)=>item.id===candidateAssetClassId).label} · ${REGIONS.find((item)=>item.id===candidateRegionId).label}`:'Declare candidate ID, symbol, asset class and region.'},
    {id:'output',label:'Output contract',state:outputReady?'ready':'blocked',purpose:'Set ranking, direction and maximum review set.',detail:`Sort by ${FIELDS.find((item)=>item.id===sortFieldId).label} · ${direction} · limit ${resultLimit}`},
    {id:'ownership',label:'Review ownership',state:ownershipReady?'ready':'blocked',purpose:'Name the accountable owner, cadence and invalidation condition.',detail:ownershipReady?`${declaration.owner} · ${CADENCES.find((item)=>item.id===cadenceId).label}`:'Declare owner and invalidation condition.'}
  ];
  const readyGates=gates.filter((gate)=>gate.state==='ready').length;
  const complete=gates.every((gate)=>gate.state==='ready');
  const universeMatch=(assetClassId==='all'||candidateAssetClassId===assetClassId)&&(regionId==='global'||candidateRegionId===regionId);
  const evaluations=rules.map((rule)=>evaluateRule(rule,missingPolicyId));
  let outcome='blocked';
  if(complete){
    if(!universeMatch)outcome='outside-universe';
    else if(!fresh)outcome='review-required';
    else if(evaluations.some((item)=>item.state==='blocked'||item.state==='manual-review'))outcome='review-required';
    else if(evaluations.every((item)=>item.state==='passed'))outcome='qualified';
    else outcome='excluded';
  }
  const integrity=fingerprint([Object.values(declaration).join('|'),...rules.flatMap((rule)=>[rule.field.id,rule.operator.id,rule.threshold,rule.observed])].join('|'));
  const receipt={state:complete?'ready':'draft',screenId:complete?`SCR-${integrity.slice(-8).toUpperCase()}`:null,evaluationId:complete?`EVAL-${declaration.symbol.replace(/[^A-Z0-9]/g,'').slice(0,8)||'ITEM'}-${integrity.slice(-6).toUpperCase()}`:null,fingerprint:integrity,persisted:false,universeScanned:false,sourceVerified:false};
  return {
    version:'governed-screener-lab-v2',state:complete?'evaluation-ready':'definition-setup-ready',
    job:'Turn a research question into a typed, freshness-aware and reviewable screen definition, then test one declared candidate without inventing a market universe.',
    fields:FIELDS,operators:OPERATORS,assetClasses:ASSET_CLASSES,regions:REGIONS,missingPolicies:MISSING_POLICIES,cadences:CADENCES,
    declaration,rules,evaluations,gates,receipt,
    evaluation:{outcome,universeMatch,fresh,ageMinutes,passedRules:evaluations.filter((item)=>item.state==='passed').length,failedRules:evaluations.filter((item)=>item.state==='failed').length,humanReviewRequired:complete&&['qualified','review-required'].includes(outcome),automaticDecision:false},
    readiness:{readyGates,totalGates:gates.length,definitionReady:complete,state:complete?'ready-for-candidate-review':'blocked-missing-screen-fields'},
    coverage:{connectedUniverse:false,scannedRows:0,matchedRows:0,candidateEvaluations:complete?1:0,reason:'No approved public screener universe or saved-screen store is connected. Qelly validates one user-declared definition and candidate observation; it does not publish fixture matches.'},
    protocol:[
      {step:'01',label:'Frame',job:'Declare the research question before choosing fields.'},{step:'02',label:'Bound',job:'Define eligible asset class, region and evidence snapshot.'},
      {step:'03',label:'Type',job:'Choose supported fields and operators without arbitrary code.'},{step:'04',label:'Govern',job:'Declare freshness, missing-value and output policies.'},
      {step:'05',label:'Test',job:'Evaluate one declared candidate with an inspectable trace.'},{step:'06',label:'Review',job:'Send qualified candidates to evidence review, not automatic action.'}
    ],
    handoffs:[
      {route:'asset-rankings',label:'Asset Rankings',job:'Inspect a published governed ranking when you want a ready-made ordering.'},
      {route:'formula-screener',label:'Formula Screener',job:'Use bounded custom formulas when typed predicates cannot express the method.'},
      {route:'research-workspace',label:'Research Workspace',job:'Investigate the evidence behind a qualified candidate.'},
      {route:'decision-provenance',label:'Decision Provenance',job:'Record the accountable human decision after research.'}
    ],
    boundaries:{fixtureUniverse:false,userDeclaredCandidate:true,connectedUniverse:false,savedScreenStore:false,persistence:false,liveProvider:false,sourceVerified:false,customCode:false,brokerConnection:false,recommendation:false,execution:false}
  };
}

export const __test=Object.freeze({FIELDS,OPERATORS,ASSET_CLASSES,REGIONS,MISSING_POLICIES,CADENCES,clean,number,integer,instant,select,fingerprint,compare,normalizeRule,evaluateRule});
