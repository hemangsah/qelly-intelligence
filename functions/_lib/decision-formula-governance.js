const SCHEMA_VERSION='qelly.decision-formula-governance/1.0.0';
const clamp=(value,min=-1,max=1)=>Math.min(max,Math.max(min,Number(value)||0));
const round=(value,digits=4)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const direction=(score)=>score>.08?'UPSIDE':score<-.08?'DOWNSIDE':'NEUTRAL';
const availability=(value)=>value==null||value===''?'UNAVAILABLE':'AVAILABLE';
const reliabilityFromTruth=(truth)=>truth==='LIVE'?1:truth==='DELAYED'?0.82:truth==='STALE'?0.4:0.2;
const structureReliability=(state)=>({STRONG:1,MODERATE:.82,DEVELOPING:.62,WEAK:.42}[String(state||'').toUpperCase()]||.35);
const FAMILY_WEIGHTS=Object.freeze({structure:.24,trend:.17,momentum:.11,scenario:.18,mtf:.22,price_action:.08});

export const FORMULA_CATALOG=Object.freeze([
  Object.freeze({id:'trend-slope',label:'OLS trend slope',family:'trend',redundancyGroup:'trend-direction',role:'directional_evidence',definition:'Bounded per-bar price slope normalized to a directional research score.'}),
  Object.freeze({id:'roc14',label:'14-bar rate of change',family:'trend',redundancyGroup:'trend-direction',role:'directional_evidence',definition:'14-bar relative return normalized to a directional research score.'}),
  Object.freeze({id:'adx14',label:'ADX trend strength',family:'trend',redundancyGroup:'trend-strength',role:'relevance_modifier',definition:'Trend-strength context; it does not vote direction independently.'}),
  Object.freeze({id:'rsi14',label:'RSI momentum displacement',family:'momentum',redundancyGroup:'momentum-direction',role:'directional_evidence',definition:'Distance from neutral RSI, bounded and centered at 50.'}),
  Object.freeze({id:'return-z',label:'Return z-score',family:'momentum',redundancyGroup:'momentum-direction',role:'directional_evidence',definition:'Latest return standardized by recent return dispersion.'}),
  Object.freeze({id:'market-structure',label:'Deterministic market structure',family:'structure',redundancyGroup:'structure-direction',role:'directional_evidence',definition:'Confirmed swing-sequence / break / retest structure with explicit strength state.'}),
  Object.freeze({id:'smc-structure',label:'Deterministic SMC structure',family:'structure',redundancyGroup:'structure-direction',role:'directional_evidence',definition:'Rule-based BOS/CHOCH/displacement/liquidity-sweep state; shares the structure redundancy group to prevent double counting.'}),
  Object.freeze({id:'price-action-state',label:'Deterministic price action',family:'price_action',redundancyGroup:'price-action-direction',role:'directional_evidence',definition:'Rule-based breakout/retest/engulfing/pin/rejection/failed-breakout state.'}),
  Object.freeze({id:'scenario-balance',label:'Scenario balance',family:'scenario',redundancyGroup:'scenario-direction',role:'directional_evidence',definition:'Bull-minus-bear bootstrap scenario balance; separate from calibrated outcome probability.'}),
  Object.freeze({id:'mtf-agreement',label:'Multi-timeframe agreement',family:'mtf',redundancyGroup:'mtf-direction',role:'directional_evidence',definition:'Coverage-adjusted directional agreement across independently observed timeframes.'}),
  Object.freeze({id:'liquidity-depth',label:'Current L2 depth context',family:'liquidity',redundancyGroup:'liquidity-current',role:'risk_context',definition:'Current point-in-time depth/microprice context; never promoted to an independent directional vote.'}),
  Object.freeze({id:'funding-carry',label:'Funding carry context',family:'derivatives',redundancyGroup:'derivatives-carry',role:'risk_context',definition:'Current/settled funding context; descriptive only without verified positioning change.'}),
  Object.freeze({id:'cross-asset-relative',label:'Cross-asset relative strength',family:'cross_asset',redundancyGroup:'cross-asset-current',role:'context_only',definition:'Descriptive relative-performance context; no independent eligibility impact.'}),
  Object.freeze({id:'volatility-regime',label:'Volatility regime',family:'volatility',redundancyGroup:'volatility-regime',role:'risk_context',definition:'Observed volatility regime used for risk/relevance context, not direction.'})
]);

const feature=(id,{score=null,strength=0,freshness='UNAVAILABLE',reliability=0,relevance=1,contradiction='NONE',state='UNAVAILABLE',detail='',horizon='CURRENT',regimeApplicability='GENERAL'}={})=>{
  const meta=FORMULA_CATALOG.find(item=>item.id===id);
  const numeric=finite(score);
  return {...meta,state,numericScore:numeric,direction:numeric===null?'UNAVAILABLE':direction(numeric),strength:round(clamp(strength,0,1),3),freshness:String(freshness||'UNAVAILABLE'),reliability:round(clamp(reliability,0,1),3),relevance:round(clamp(relevance,0,1),3),contradiction:String(contradiction||'NONE'),horizon,regimeApplicability,detail,effectiveScore:null,contribution:null,suppressedBy:null};
};

const applyRedundancy=(features)=>{
  const groups=new Map();
  for(const item of features){
    if(!item.redundancyGroup||item.role!=='directional_evidence'||item.numericScore===null)continue;
    const score=Math.abs(item.numericScore)*item.strength*item.reliability*item.relevance;
    if(!groups.has(item.redundancyGroup))groups.set(item.redundancyGroup,[]);
    groups.get(item.redundancyGroup).push({item,score});
  }
  const primaryByGroup=new Map(),suppressed=[];
  for(const [group,items] of groups){
    items.sort((a,b)=>b.score-a.score||a.item.id.localeCompare(b.item.id));
    primaryByGroup.set(group,items[0]?.item?.id||null);
    for(const entry of items.slice(1))suppressed.push({id:entry.item.id,group,suppressedBy:items[0].item.id});
  }
  const suppressedById=new Map(suppressed.map(item=>[item.id,item.suppressedBy]));
  const resolved=features.map(item=>{
    if(item.role!=='directional_evidence'||item.numericScore===null)return {...item,effectiveScore:0,contribution:0};
    const suppressedBy=suppressedById.get(item.id)||null;
    const effective=suppressedBy?0:item.numericScore*item.strength*item.reliability*item.relevance;
    return {...item,suppressedBy,effectiveScore:round(effective,4),contribution:round(effective,4)};
  });
  return {features:resolved,redundancyGroups:[...groups.entries()].map(([group,items])=>({group,primary:primaryByGroup.get(group),members:items.map(entry=>entry.item.id),suppressed:items.slice(1).map(entry=>entry.item.id)})),suppressed};
};

export function buildDecisionFormulaGovernance(graph,{multiTimeframe=null,derivatives=null,liquidity=null,crossAsset=null}={}){
  const truth=String(graph?.truthState||'UNAVAILABLE').toUpperCase(),freshnessReliability=reliabilityFromTruth(truth);
  const trend=graph?.quant?.trend||{},structure=graph?.quant?.structure||{},forecast=graph?.forecast?.probabilities||{},metrics=graph?.metrics||{};
  const agreement=multiTimeframe?.agreement||{},total=Math.max(0,Number(agreement.total)||0),aligned=Math.max(0,Number(agreement.aligned)||0);
  const mtfDirection=String(agreement.direction||'MIXED'),mtfSign=mtfDirection==='BUY'?1:mtfDirection==='SELL'?-1:0;
  const structureSign=String(structure.bias||'MIXED')==='UPSIDE'?1:String(structure.bias||'MIXED')==='DOWNSIDE'?-1:0;
  const scenarioScore=clamp(((finite(forecast.bull)??0)-(finite(forecast.bear)??0))/.25);
  const trendSlope=finite(metrics.trendPerBarPct),roc14=finite(trend.roc14Pct),adx14=finite(trend.adx14),rsi14=finite(metrics.rsi14),returnZ=finite(metrics.returnZScore);
  const structureStrength=structureReliability(structure.strengthState),regime=String(graph?.quant?.regime||'UNKNOWN');
  const smc=graph?.quant?.smc||{},priceAction=graph?.quant?.priceAction||{},smcScore=finite(smc.directionalScore),priceActionScore=finite(priceAction.directionalScore);
  const raw=[
    feature('trend-slope',{score:trendSlope===null?null:clamp(trendSlope/.04),strength:trendSlope===null?0:Math.min(1,Math.abs(trendSlope)/.04),freshness:truth,reliability:freshnessReliability,state:availability(trendSlope),detail:'trendPerBarPct='+String(trendSlope??'unavailable'),regimeApplicability:regime}),
    feature('roc14',{score:roc14===null?null:clamp(roc14/4),strength:roc14===null?0:Math.min(1,Math.abs(roc14)/4),freshness:truth,reliability:freshnessReliability,state:availability(roc14),detail:'roc14Pct='+String(roc14??'unavailable'),regimeApplicability:regime}),
    feature('adx14',{score:null,strength:adx14===null?0:clamp((adx14-12)/28,0,1),freshness:truth,reliability:freshnessReliability,state:availability(adx14),detail:'adx14='+String(adx14??'unavailable'),regimeApplicability:regime}),
    feature('rsi14',{score:rsi14===null?null:clamp((rsi14-50)/22),strength:rsi14===null?0:Math.min(1,Math.abs(rsi14-50)/22),freshness:truth,reliability:freshnessReliability,state:availability(rsi14),detail:'rsi14='+String(rsi14??'unavailable'),regimeApplicability:regime}),
    feature('return-z',{score:returnZ===null?null:clamp(returnZ/2.5),strength:returnZ===null?0:Math.min(1,Math.abs(returnZ)/2.5),freshness:truth,reliability:freshnessReliability,state:availability(returnZ),detail:'returnZScore='+String(returnZ??'unavailable'),regimeApplicability:regime}),
    feature('market-structure',{score:structureSign||0,strength:structureSign?structureStrength:0,freshness:truth,reliability:freshnessReliability,state:structureSign?'AVAILABLE':'NEUTRAL',detail:'bias='+String(structure.bias||'MIXED')+' · strength='+String(structure.strengthState||'UNAVAILABLE'),regimeApplicability:regime}),
    feature('smc-structure',{score:smcScore,strength:smcScore===null?0:Math.min(1,Math.abs(smcScore)),freshness:truth,reliability:freshnessReliability,state:smc?.state==='DERIVED'?'AVAILABLE':'UNAVAILABLE',detail:'BOS='+String(smc.breakOfStructure||'NONE')+' · CHOCH='+String(smc.changeOfCharacter||'NONE')+' · sweep='+String(smc.liquiditySweep||'NONE'),regimeApplicability:regime}),
    feature('price-action-state',{score:priceActionScore,strength:priceActionScore===null?0:Math.min(1,Math.abs(priceActionScore)),freshness:truth,reliability:freshnessReliability,state:priceAction?.state==='DERIVED'?'AVAILABLE':'UNAVAILABLE',detail:'breakout='+String(priceAction.breakout||'NONE')+' · retest='+String(priceAction.retest||'NONE')+' · engulfing='+String(priceAction.engulfing||'NONE')+' · pin='+String(priceAction.pinBar||'NONE'),regimeApplicability:regime}),
    feature('scenario-balance',{score:scenarioScore,strength:Math.min(1,Math.abs(scenarioScore)),freshness:truth,reliability:freshnessReliability,state:Number.isFinite(Number(forecast.bull))&&Number.isFinite(Number(forecast.bear))?'AVAILABLE':'UNAVAILABLE',detail:'bull='+String(forecast.bull??'unavailable')+' · bear='+String(forecast.bear??'unavailable'),horizon:String(graph?.horizonBars||'CURRENT')+' bars',regimeApplicability:regime}),
    feature('mtf-agreement',{score:total?mtfSign*(aligned/total):null,strength:total?aligned/total:0,freshness:total?'OBSERVED':'UNAVAILABLE',reliability:total?Math.min(1,total/4):0,state:total?'AVAILABLE':'UNAVAILABLE',detail:'direction='+mtfDirection+' · aligned='+aligned+'/'+total,horizon:'MULTI_TIMEFRAME',regimeApplicability:'GENERAL'}),
    feature('liquidity-depth',{score:null,strength:liquidity?.state==='live'?Math.min(1,Math.abs(finite(liquidity?.top5Imbalance)??0)):0,freshness:liquidity?.state==='live'?'LIVE':'UNAVAILABLE',reliability:liquidity?.state==='live'?1:0,state:liquidity?.state==='live'?'AVAILABLE':'UNAVAILABLE',detail:'depth='+String(liquidity?.depthConsensus||'UNAVAILABLE')+' · spreadBps='+String(liquidity?.spreadBps??'unavailable')}),
    feature('funding-carry',{score:null,strength:derivatives?.state==='live'?Math.min(1,Math.abs(finite(derivatives?.fundingPct)??0)*100):0,freshness:derivatives?.state==='live'?'LIVE':'UNAVAILABLE',reliability:derivatives?.state==='live'?1:0,state:derivatives?.state==='live'?'AVAILABLE':'UNAVAILABLE',detail:'fundingPct='+String(derivatives?.fundingPct??'unavailable')}),
    feature('cross-asset-relative',{score:null,strength:crossAsset?.state==='available'?Math.min(1,Math.abs(finite(crossAsset?.relativeStrengthPct)??0)/3):0,freshness:crossAsset?.state==='available'?'OBSERVED':'UNAVAILABLE',reliability:crossAsset?.state==='available'?1:0,state:crossAsset?.state==='available'?'AVAILABLE':'UNAVAILABLE',detail:'relativeStrengthPct='+String(crossAsset?.relativeStrengthPct??'unavailable')+' · benchmark='+String(crossAsset?.benchmark||'unavailable')}),
    feature('volatility-regime',{score:null,strength:graph?.quant?.volatility?.regime==='HIGH'?1:graph?.quant?.volatility?.regime==='ELEVATED'?0.75:0.4,freshness:truth,reliability:freshnessReliability,state:graph?.quant?.volatility?.regime?'AVAILABLE':'UNAVAILABLE',detail:'regime='+String(graph?.quant?.volatility?.regime||'UNAVAILABLE')})
  ];
  const redundancy=applyRedundancy(raw);
  const directional=redundancy.features.filter(item=>item.role==='directional_evidence'&&!item.suppressedBy&&item.state!=='UNAVAILABLE'&&Number.isFinite(item.effectiveScore));
  const families=Object.entries(FAMILY_WEIGHTS).map(([family,weight])=>{
    const members=directional.filter(item=>item.family===family);
    const score=members.length?members.reduce((sum,item)=>sum+item.effectiveScore,0)/members.length:null;
    return {family,weight,state:members.length?'ACTIVE':'UNAVAILABLE',score:round(score,4),direction:score===null?'UNAVAILABLE':direction(score),members:members.map(item=>item.id)};
  });
  const active=families.filter(item=>item.state==='ACTIVE'&&Number.isFinite(item.score));
  const activeWeight=active.reduce((sum,item)=>sum+item.weight,0);
  const net=activeWeight?active.reduce((sum,item)=>sum+item.score*item.weight,0)/activeWeight:0;
  const baseAction=String(graph?.qellyView?.action||'NO TRADE'),baseSign=baseAction==='BUY'?1:baseAction==='SELL'?-1:0;
  const baseSupport=baseSign?net*baseSign:null;
  const severeContradiction=Boolean(baseSign&&active.length>=3&&baseSupport<=-.35);
  const contributors=redundancy.features.filter(item=>item.state!=='UNAVAILABLE').map(item=>({
    id:item.id,label:item.label,family:item.family,role:item.role,direction:item.direction,
    contribution:item.role==='directional_evidence'&&activeWeight?round((item.effectiveScore||0)*(FAMILY_WEIGHTS[item.family]||0)/activeWeight,4):0,
    strength:item.strength,freshness:item.freshness,reliability:item.reliability,relevance:item.relevance,contradiction:item.contradiction,suppressedBy:item.suppressedBy,detail:item.detail
  })).sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)||b.strength-a.strength||a.id.localeCompare(b.id));
  return {
    schemaVersion:SCHEMA_VERSION,
    state:active.length>=3?'GOVERNED':active.length?'PARTIAL':'UNAVAILABLE',
    baseAction,
    netDirectionalScore:round(net,4),
    netDirection:direction(net),
    baseActionSupport:round(baseSupport,4),
    severeContradiction,
    activeDirectionalFamilies:active.length,
    familyWeights:{...FAMILY_WEIGHTS},
    families,
    topContributors:contributors.slice(0,8),
    features:redundancy.features,
    redundancyGroups:redundancy.redundancyGroups,
    suppressedFeatureCount:redundancy.suppressed.length,
    boundary:'Formula governance validates and attributes the existing Decision engine. Correlated features are capped by deterministic redundancy groups; context-only modules never become independent directional votes. This layer may veto a severe contradiction but does not create BUY or SELL direction on its own.',
    methodology:'Directional families are structure, trend, momentum, scenario balance, multi-timeframe agreement and deterministic price action. Within each redundancy group only the strongest bounded feature contributes; family weights are normalized across available families. Liquidity, derivatives, cross-asset and volatility remain risk/context evidence.'
  };
}

export const __decisionFormulaGovernanceTest=Object.freeze({applyRedundancy,direction,structureReliability,FAMILY_WEIGHTS});
