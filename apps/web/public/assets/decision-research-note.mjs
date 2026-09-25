const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const text=(value,fallback='Unavailable')=>{const valueText=String(value??'').trim();return valueText||fallback;};
const list=(value)=>Array.isArray(value)?value.filter(item=>item!=null):[];
const unique=(items)=>[...new Set(items.filter(Boolean))];
const ratioLabel=(value)=>{const number=finite(value);return number===null?null:'1:'+Number(number.toFixed(2));};

const thesisFor=(action,label)=>{
  const view=String(action||'NO TRADE').toUpperCase();
  if(view==='BUY')return 'Evidence-qualified upside research setup under the current observed snapshot. '+text(label,'');
  if(view==='SELL')return 'Evidence-qualified downside research setup under the current observed snapshot. '+text(label,'');
  if(view==='WAIT')return 'No directional edge currently clears the evidence threshold. '+text(label,'');
  return 'Directional research is withheld under the current evidence, calibration or risk gates. '+text(label,'');
};

const compactTarget=(item)=>({
  label:text(item?.label,'Target'),
  price:finite(item?.price??item?.target),
  ratio:finite(item?.ratio),
  feasibility:text(item?.feasibility,'UNAVAILABLE'),
  source:text(item?.source,'UNAVAILABLE')
});

const sourceInventory=(data)=>{
  const nodes=list(data?.evidenceGraph?.nodes||data?.decisionTrace?.nodes);
  const sources=[];
  const seen=new Set();
  const add=(value)=>{
    const source=text(value?.source,'');
    if(!source)return;
    const key=[source,value?.freshness||'',value?.directness||''].join('|');
    if(seen.has(key))return;
    seen.add(key);
    sources.push({
      source,
      label:text(value?.label,value?.id||'Evidence source'),
      freshness:text(value?.freshness,'UNAVAILABLE'),
      directness:text(value?.directness,'UNAVAILABLE'),
      reliability:text(value?.reliability,'UNAVAILABLE')
    });
  };
  nodes.forEach(add);
  if(data?.provenance?.provider)add({source:data.provenance.provider,label:'Primary market data',freshness:data.truthState,directness:'DIRECT',reliability:'VENUE_OBSERVED'});
  return sources.slice(0,20);
};

export function buildDecisionResearchNote(data,{requestedRr=null,customRr=null,targetTouchCalibration=null}={}){
  if(!data||typeof data!=='object')throw new TypeError('Decision snapshot is required');
  const view=data.qellyView||{};
  const contradiction=data.contradictionAnalysis||{};
  const trade=data.tradeResearch||{};
  const calibration=data.quant?.calibration||data.pastPresentFuture?.present?.calibration||{};
  const probabilities=data.forecast?.probabilities||data.pastPresentFuture?.future?.scenarios||{};
  const terminal=data.forecast?.terminal||data.pastPresentFuture?.future?.expectedRange||{};
  const eventRisk=data.evidence?.eventRisk||data.pastPresentFuture?.present?.eventRisk||{};
  const selected=trade.selected||null;
  const requested=requestedRr??trade.requestedRr??trade.requested??null;
  const support=list(contradiction.support).length?list(contradiction.support):list(view.why);
  const contradictions=list(contradiction.contradictions).length?list(contradiction.contradictions):list(view.contradictions);
  const targets=list(trade.targets).map(compactTarget);
  const sourceDocumentation=data.provenance?.documentation||null;
  const providerLimits=list(data.provenance?.model?.limitations).map(item=>text(item,'')).filter(Boolean);
  const targetTouch=targetTouchCalibration&&typeof targetTouchCalibration==='object'?targetTouchCalibration:null;
  const targetTouchMetrics=targetTouch?.metrics&&typeof targetTouch.metrics==='object'?targetTouch.metrics:{};
  const compactTargetTouchMetric=(key)=>{const item=targetTouchMetrics[key]||{},ci=item.confidenceInterval95||{};return {
    state:text(item.state,'UNAVAILABLE'),
    eligible:item.eligible===true,
    sampleSize:Number(item.sampleSize)||0,
    walkForwardSampleSize:Number(item.walkForwardSampleSize)||0,
    probability:item.eligible===true?finite(item.probability):null,
    confidenceInterval95:item.eligible===true?{low:finite(ci.low),high:finite(ci.high),width:finite(ci.width)}:{low:null,high:null,width:finite(ci.width)},
    brierScore:finite(item.brierScore),
    reliabilityGap:finite(item.reliabilityGap),
    reason:text(item.reason,'Calibration evidence unavailable.')
  };};
  const evidenceLimits=[];
  for(const key of ['eventRisk','liquidations','options','onChain']){
    const item=data.evidence?.[key];
    if(item&&String(item.state||'unavailable').toLowerCase()!=='available'&&String(item.state||'unavailable').toLowerCase()!=='live'){
      evidenceLimits.push(text(item.message||item.reason||item.boundary,key+' evidence unavailable'));
    }
  }
  const limitations=unique([
    'Research-only output. It is not investment advice, a trade instruction, execution authorization, or a guaranteed outcome.',
    'Evidence confidence is not a success probability. Target-touch probability is separate and remains unavailable unless the real observed-outcome calibration gate passes.',
    calibration.reason?text(calibration.reason,''):null,
    selected?.costReason?text(selected.costReason,''):null,
    ...providerLimits,
    ...evidenceLimits
  ]);
  return {
    schemaVersion:'qelly.decision-research-note/1.0.0',
    researchOnly:true,
    snapshot:{
      graphId:data.graphId||data.decisionSnapshot?.graphId||null,
      asset:text(data.asset),
      timeframe:text(data.interval),
      horizon:text(data.horizon),
      observedAt:data.observedAt||null,
      generatedAt:data.generatedAt||data.observedAt||null,
      truthState:text(data.truthState,'UNAVAILABLE'),
      provider:text(data.provenance?.provider,'UNAVAILABLE')
    },
    thesis:thesisFor(view.action,view.label),
    qellyView:{
      action:text(view.action,'NO TRADE'),
      label:text(view.label,''),
      evidenceConfidence:finite(view.confidence),
      evidenceQuality:finite(view.evidenceGate?.qualityScore),
      changesIf:text(view.changesIf,'Recompute when fresh evidence changes.'),
      directionalEligible:view.evidenceGate?.directionalEligible===true
    },
    evidence:{
      strongestSupport:contradiction.strongestSupport||support[0]||null,
      supporting:support.slice(0,12),
      strongestContradiction:contradiction.strongestContradiction||contradictions[0]||null,
      contradictions:contradictions.slice(0,12),
      conflictState:text(contradiction.state,'MIXED'),
      conflictScore:finite(contradiction.score)
    },
    setup:{
      status:text(trade.status,'NO_TRADE'),
      reason:text(trade.reason,'No evidence-qualified setup is available.'),
      lifecycle:trade.lifecycle||null,
      entry:trade.entry||null,
      stop:trade.stop||null,
      invalidation:trade.invalidation||null,
      expiryAt:trade.expiryAt||null,
      targets
    },
    riskReward:{
      requested:requested==null?null:String(requested),
      custom:requested==='custom'?finite(customRr):null,
      selected:selected?{
        label:text(selected.label,ratioLabel(selected.ratio)||'Selected R:R'),
        ratio:finite(selected.ratio),
        target:finite(selected.target),
        feasibility:text(selected.feasibility,'UNAVAILABLE'),
        reason:text(selected.feasibilityReason||selected.selectionReason,''),
        grossRr:finite(selected.grossRiskReward??selected.grossRr??selected.ratio),
        netRr:finite(selected.netRiskReward??selected.netRr),
        costState:text(selected.costState,'UNAVAILABLE'),
        costReason:text(selected.costReason,'')
      }:null,
      matrix:list(trade.matrix).map(item=>({
        label:text(item?.label,ratioLabel(item?.ratio)||'R:R'),ratio:finite(item?.ratio),target:finite(item?.target),
        feasibility:text(item?.feasibility,'UNAVAILABLE'),reason:text(item?.feasibilityReason,''),
        grossRr:finite(item?.grossRiskReward??item?.grossRr??item?.ratio),netRr:finite(item?.netRiskReward??item?.netRr),costState:text(item?.costState,'UNAVAILABLE')
      }))
    },
    calibration:{
      state:text(calibration.state,'UNCALIBRATED'),
      eligible:calibration.eligible===true,
      sampleSize:Number(calibration.sampleSize)||0,
      minimumSampleGate:Number(calibration.minimumSampleGate)||null,
      brierScore:finite(calibration.brierScore),
      skillScore:finite(calibration.skillScore),
      reliabilityGap:finite(calibration.reliabilityGap),
      diagnosticMetricsOnly:calibration.diagnosticMetricsOnly===true,
      reason:text(calibration.reason,'Calibration evidence unavailable.'),
      boundary:'Scenario calibration and real target-touch calibration are distinct. No individual outcome is guaranteed.',
      targetTouch:targetTouch?{
        state:text(targetTouch.state,'UNCALIBRATED'),eligible:targetTouch.eligible===true,
        eligibleResolvedSetups:Number(targetTouch.eligibleResolvedSetups)||0,minimumSampleGate:Number(targetTouch.minimumSampleGate)||null,
        T1:compactTargetTouchMetric('T1'),T2:compactTargetTouchMetric('T2'),T3:compactTargetTouchMetric('T3'),T4:compactTargetTouchMetric('T4'),INVALIDATION_FIRST:compactTargetTouchMetric('INVALIDATION_FIRST'),
        boundary:text(targetTouch.probabilityBoundary,'Real target-touch probability remains unavailable unless the authenticated observed-outcome sample clears its independent gates.')
      }:{state:'UNAVAILABLE',eligible:false,eligibleResolvedSetups:null,minimumSampleGate:null,T1:null,T2:null,T3:null,T4:null,INVALIDATION_FIRST:null,boundary:'Authenticated real target-touch calibration was not supplied to this note; it is not inferred from scenarios, analogs or candle depth.'}
    },
    scenarios:{
      bull:finite(probabilities.bull),base:finite(probabilities.base),bear:finite(probabilities.bear),
      p05:finite(terminal.p05),p50:finite(terminal.p50),p95:finite(terminal.p95),
      boundary:text(data.pastPresentFuture?.future?.boundary,'Scenario values are model research outputs, not guaranteed forecasts.')
    },
    eventRisk:{
      state:text(eventRisk.state,'UNAVAILABLE'),level:text(eventRisk.level,'UNAVAILABLE'),
      nextEventAt:eventRisk.nextEventAt||null,
      events:list(eventRisk.events).slice(0,10),
      boundary:text(eventRisk.gatingBoundary||eventRisk.calendarBoundary||eventRisk.reason,'Verified scheduled-event evidence is unavailable; it is not inferred from news.')
    },
    sources:{
      primaryDocumentation:sourceDocumentation,
      inventory:sourceInventory(data)
    },
    limitations
  };
}

const value=(input,{percent=false}={})=>{
  const n=finite(input);
  if(n===null)return 'Unavailable';
  return percent?(n*100).toFixed(1)+'%':String(n);
};
const bulletList=(items,empty='None recorded')=>items.length?items.map(item=>'- '+text(typeof item==='string'?item:item?.title||item?.detail||JSON.stringify(item))).join('\n'):'- '+empty;

export function decisionResearchNoteMarkdown(note){
  if(!note||note.schemaVersion!=='qelly.decision-research-note/1.0.0')throw new TypeError('Valid research note is required');
  const s=note.snapshot,v=note.qellyView,e=note.evidence,setup=note.setup,rr=note.riskReward,cal=note.calibration,sc=note.scenarios,er=note.eventRisk;
  const targets=setup.targets.length?setup.targets.map(item=>'- '+item.label+': '+value(item.price)+' · '+item.feasibility+' · '+(item.ratio==null?'R:R unavailable':'1:'+item.ratio)).join('\n'):'- No evidence-qualified targets';
  const sources=note.sources.inventory.length?note.sources.inventory.map(item=>'- '+item.label+' — '+item.source+' · '+item.freshness+' · '+item.directness).join('\n'):'- Source inventory unavailable';
  return `# QELLY Decision Research Note

> Research only. Not investment advice, a trade instruction, execution authorization, or a guaranteed outcome.

## Snapshot
- Asset: ${s.asset}
- Timeframe: ${s.timeframe}
- Horizon: ${s.horizon}
- Observed: ${s.observedAt||'Unavailable'}
- Truth state: ${s.truthState}
- Provider: ${s.provider}

## Thesis
${note.thesis}

## QELLY VIEW
- Action: ${v.action}
- Evidence confidence: ${value(v.evidenceConfidence,{percent:true})}
- Evidence quality: ${value(v.evidenceQuality,{percent:true})}
- Directional eligible: ${v.directionalEligible?'yes':'no'}
- What changes the view: ${v.changesIf}

## Evidence
### Supporting
${bulletList(e.supporting,'No supporting evidence recorded')}

### Contradictions
${bulletList(e.contradictions,'No contradiction recorded')}

- Conflict state: ${e.conflictState}

## Entry / Invalidation / Targets
- Setup status: ${setup.status}
- Setup reason: ${setup.reason}
- Entry: ${setup.entry?JSON.stringify(setup.entry):'Unavailable'}
- Stop: ${setup.stop?JSON.stringify(setup.stop):'Unavailable'}
- Invalidation: ${setup.invalidation?JSON.stringify(setup.invalidation):'Unavailable'}
- Expiry: ${setup.expiryAt||'Unavailable'}
${targets}

## Risk / Reward
- Requested: ${rr.requested??'Unavailable'}${rr.custom!=null?' ('+rr.custom+')':''}
- Selected: ${rr.selected?.label||'Unavailable'}
- Feasibility: ${rr.selected?.feasibility||'Unavailable'}
- Gross R:R: ${value(rr.selected?.grossRr)}
- Net R:R: ${value(rr.selected?.netRr)}
- Cost state: ${rr.selected?.costState||'UNAVAILABLE'}

## Calibration
- State: ${cal.state}
- Eligible: ${cal.eligible?'yes':'no'}
- Sample: ${cal.sampleSize}${cal.minimumSampleGate?' / '+cal.minimumSampleGate:''}
- Brier: ${value(cal.brierScore)}
- Skill: ${value(cal.skillScore)}
- Reliability gap: ${value(cal.reliabilityGap)}
- Reason: ${cal.reason}
- Boundary: ${cal.boundary}
- Real target-touch: ${cal.targetTouch?.state||'UNAVAILABLE'}${cal.targetTouch?.eligibleResolvedSetups!=null?' · n='+cal.targetTouch.eligibleResolvedSetups+(cal.targetTouch.minimumSampleGate?' / '+cal.targetTouch.minimumSampleGate:''):''}
- Target-touch boundary: ${cal.targetTouch?.boundary||'Unavailable'}

## Scenarios
- Bull: ${value(sc.bull,{percent:true})}
- Base: ${value(sc.base,{percent:true})}
- Bear: ${value(sc.bear,{percent:true})}
- Terminal p05 / p50 / p95: ${value(sc.p05)} / ${value(sc.p50)} / ${value(sc.p95)}
- Boundary: ${sc.boundary}

## Event Risk
- State: ${er.state}
- Level: ${er.level}
- Next event: ${er.nextEventAt||'Unavailable'}
- Boundary: ${er.boundary}

## Sources
${sources}${note.sources.primaryDocumentation?'\n- Primary documentation: '+note.sources.primaryDocumentation:''}

## Limitations
${bulletList(note.limitations)}
`;
}

export function researchNoteFilename(note){
  const asset=text(note?.snapshot?.asset,'asset').toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
  const timeframe=text(note?.snapshot?.timeframe,'timeframe').toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
  return 'qelly-decision-research-note-'+asset+'-'+timeframe+'.md';
}

export function downloadDecisionResearchNote(note,{documentRef=globalThis.document,urlRef=globalThis.URL,BlobRef=globalThis.Blob}={}){
  if(!documentRef||!urlRef?.createObjectURL||!BlobRef)throw new Error('Browser download APIs are unavailable');
  const blob=new BlobRef([decisionResearchNoteMarkdown(note)],{type:'text/markdown;charset=utf-8'});
  const url=urlRef.createObjectURL(blob);
  const anchor=documentRef.createElement('a');
  anchor.href=url;anchor.download=researchNoteFilename(note);anchor.rel='noopener';
  anchor.click();
  setTimeout(()=>urlRef.revokeObjectURL(url),500);
  return anchor.download;
}

export const __decisionResearchNoteTest=Object.freeze({finite,thesisFor,compactTarget,sourceInventory});
