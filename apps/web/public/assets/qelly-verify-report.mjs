import {
  QELLY_VERIFY_ENGINE_VERSION,
  QELLY_VERIFY_METHODOLOGY,
  QELLY_VERIFY_METHODOLOGY_VERSION,
  QELLY_VERIFY_REPORT_SCHEMA
} from './qelly-verify-methodology.mjs';

const freeze=value=>Object.freeze(value);
const text=value=>String(value??'');
const round=(value,digits=2)=>Number.isFinite(Number(value))?Number(Number(value).toFixed(digits)):null;
const normalizedSource=value=>text(value).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();

function fnv1a(value){
  let hash=2166136261;
  for(const character of value){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
}

export async function fingerprintSource(source){
  const normalized=normalizedSource(source);
  if(globalThis.crypto?.subtle&&globalThis.TextEncoder){
    const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));
    return freeze({algorithm:'SHA-256',value:[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join(''),normalizedBytes:new TextEncoder().encode(normalized).byteLength});
  }
  return freeze({algorithm:'FNV-1A-32-FALLBACK',value:fnv1a(normalized),normalizedBytes:normalized.length});
}

function postureFor(analysis){
  const quality=analysis.scores.strategyQuality.value;
  const robustness=analysis.scores.robustness.value;
  const overfitting=analysis.scores.overfittingRisk.value;
  const profitFactor=analysis.performance.profitFactor;
  if(profitFactor!=null&&profitFactor<1)return freeze({code:'negative-sample-edge',label:'Negative sample edge',tone:'critical',statement:'The uploaded sample does not demonstrate positive gross-profit-to-gross-loss evidence.'});
  if(quality<35||robustness<35)return freeze({code:'insufficient-internal-evidence',label:'Insufficient internal evidence',tone:'critical',statement:'The current sample requires material improvement or additional independent evidence before deployment assessment.'});
  if(overfitting>=70)return freeze({code:'high-validation-burden',label:'High validation burden',tone:'warning',statement:'Internal evidence is vulnerable to concentration, instability or limited sample support.'});
  if(quality>=70&&robustness>=65)return freeze({code:'promising-internal-evidence',label:'Promising internal evidence',tone:'positive',statement:'The uploaded sample has comparatively stronger internal evidence, but external validation remains required.'});
  return freeze({code:'mixed-internal-evidence',label:'Mixed internal evidence',tone:'neutral',statement:'The uploaded sample contains both supportive and limiting internal evidence.'});
}

function evidenceCoverage(analysis,validation){
  const computed=[
    ['data-validation','Data validation',`${validation.validRows} valid and ${validation.invalidRows} rejected rows recorded.`],
    ['performance','Performance evidence','Expectancy, profit factor, payoff, win/loss counts and outcome dispersion computed.'],
    ['observed-risk','Observed risk','Maximum drawdown, losing streak and concentration computed from the uploaded order.'],
    ['internal-stability','Internal stability','First-half versus second-half expectancy and bounded heuristics computed.'],
    ['sequence-stress','Sequence stress',`${analysis.stress.iterations} deterministic reorderings completed.`],
    ['allocation','Allocation research','Raw and constrained fractional-Kelly research ranges computed with a 5% cap.']
  ].map(([id,label,detail])=>freeze({id,label,state:id==='internal-stability'||id==='allocation'?'HEURISTIC':'COMPUTED',detail}));
  const notAssessed=QELLY_VERIFY_METHODOLOGY.notAssessed.map(entry=>freeze({id:entry.id,label:entry.label,state:'NOT ASSESSED',detail:entry.description}));
  return freeze({computed:freeze(computed),notAssessed:freeze(notAssessed),computedCount:computed.length,notAssessedCount:notAssessed.length});
}

function dataQuality(validation){
  const total=Math.max(1,Number(validation.totalRows)||0);
  const valid=Number(validation.validRows)||0;
  const ratio=valid/total;
  const issues=[];
  if(validation.invalidRows)issues.push(`${validation.invalidRows} row${validation.invalidRows===1?' was':'s were'} rejected because required numerical evidence was unavailable.`);
  if(!validation.detectedFields?.openedAt&&!validation.detectedFields?.closedAt)issues.push('No mapped timestamps: chronological and holding-period diagnostics are limited.');
  if(!validation.detectedFields?.fees)issues.push('No mapped fees: transaction-cost sensitivity is not assessed.');
  if(!validation.detectedFields?.symbol)issues.push('No mapped symbol: instrument-level concentration is not assessed.');
  if(!issues.length)issues.push('No primary parsing limitation fired; source authenticity and point-in-time integrity remain unverified.');
  return freeze({
    state:'COMPUTED',
    usableRowRate:round(ratio*100),
    totalRows:Number(validation.totalRows)||0,
    validRows:valid,
    invalidRows:Number(validation.invalidRows)||0,
    delimiter:validation.delimiter,
    pnlColumn:validation.detectedPnlColumn,
    mappedFields:freeze({...validation.detectedFields}),
    issues:freeze(issues)
  });
}

function failureConditions(analysis,validation){
  const conditions=[];
  if(validation.validRows<30)conditions.push('Do not treat this sample as mature evidence while fewer than 30 valid trades are available.');
  if(analysis.performance.profitFactor!=null&&analysis.performance.profitFactor<1)conditions.push('The sample has negative gross edge; deployment assessment is unsupported.');
  if(analysis.performance.topThreeConcentration>45)conditions.push('Re-test without the three largest outcomes and obtain independent evidence before relying on the result.');
  if(Math.sign(analysis.performance.firstHalfExpectancy)!==Math.sign(analysis.performance.secondHalfExpectancy))conditions.push('Expectancy changes sign between sample halves; investigate temporal dependency.');
  if(analysis.scores.overfittingRisk.value>=70)conditions.push('High heuristic overfitting risk requires holdout, walk-forward and parameter-sensitivity evidence.');
  if(analysis.stress.stressMaxDrawdown>analysis.performance.maxDrawdown*1.35)conditions.push('Stress drawdown materially exceeds observed drawdown; capital assumptions must use the stress path, not the historical path alone.');
  if(!conditions.length)conditions.push('No primary prototype failure condition fired; this is not proof of live readiness.');
  return freeze(conditions);
}

export async function composeStrategyEvidenceReport({analysis,validation,sourceText='',sourceName}={}){
  if(!analysis?.performance||!analysis?.scores||!validation)throw Object.assign(new Error('A valid Qelly Verify analysis and validation record are required.'),{code:'verify_report_input_invalid'});
  const fingerprint=await fingerprintSource(sourceText);
  const generatedAt=new Date().toISOString();
  const posture=postureFor(analysis);
  const coverage=evidenceCoverage(analysis,validation);
  const reportId=`qv-${fingerprint.value.slice(0,16)}-${generatedAt.slice(0,10).replaceAll('-','')}`;
  return freeze({
    schema:QELLY_VERIFY_REPORT_SCHEMA,
    reportId,
    generatedAt,
    methodologyVersion:QELLY_VERIFY_METHODOLOGY_VERSION,
    engineVersion:QELLY_VERIFY_ENGINE_VERSION,
    product:'Qelly Verify',
    title:'Qelly Strategy Evidence Report',
    truthState:'DETERMINISTIC LOCAL EVIDENCE',
    source:freeze({
      name:text(sourceName||analysis.sourceName||'Local strategy CSV').slice(0,180),
      fingerprint,
      uploaded:false,
      retained:false,
      processingBoundary:'browser-local'
    }),
    executiveSummary:freeze({
      posture,
      strategyQuality:analysis.scores.strategyQuality,
      robustness:analysis.scores.robustness,
      overfittingRisk:analysis.scores.overfittingRisk,
      primaryWarning:analysis.warnings[0]||'No primary heuristic warning fired.',
      conclusionBoundary:'This report describes uploaded historical evidence. It does not predict performance, approve deployment or provide personalized financial advice.'
    }),
    dataQuality:dataQuality(validation),
    evidenceCoverage:coverage,
    performance:analysis.performance,
    sample:analysis.sample,
    scores:analysis.scores,
    observedRisk:freeze({
      maxDrawdown:analysis.performance.maxDrawdown,
      longestLosingStreak:analysis.performance.longestLosingStreak,
      topThreeConcentration:analysis.performance.topThreeConcentration,
      returnDispersion:analysis.performance.returnDispersion,
      state:'COMPUTED'
    }),
    internalStability:freeze({
      firstHalfExpectancy:analysis.performance.firstHalfExpectancy,
      secondHalfExpectancy:analysis.performance.secondHalfExpectancy,
      robustnessScore:analysis.scores.robustness,
      overfittingRisk:analysis.scores.overfittingRisk,
      state:'HEURISTIC',
      boundary:'A half-sample comparison is not walk-forward or out-of-sample validation.'
    }),
    sequenceStress:freeze({...analysis.stress,state:'COMPUTED',method:'deterministic-seeded-trade-order-shuffle'}),
    allocationResearch:freeze({...analysis.allocation,state:'HEURISTIC',boundary:'Not personalized position sizing; portfolio and execution context are not assessed.'}),
    warnings:freeze([...analysis.warnings]),
    failureConditions:failureConditions(analysis,validation),
    limitations:freeze([...analysis.limitations,...QELLY_VERIFY_METHODOLOGY.notAssessed.map(entry=>`${entry.label}: ${entry.description}`)]),
    provenance:freeze({
      reportSchema:QELLY_VERIFY_REPORT_SCHEMA,
      methodologyVersion:QELLY_VERIFY_METHODOLOGY_VERSION,
      engineVersion:QELLY_VERIFY_ENGINE_VERSION,
      sequenceSeedBoundary:'Derived deterministically from uploaded P&L values.',
      numericalReproducibility:'Identical normalized input and engine version produce identical numerical analysis; generation metadata may differ.',
      methodologyRoute:'#/market?view=evidence-methodology'
    }),
    rawAnalysis:analysis
  });
}

export function stableEvidenceCore(report){
  const {generatedAt,reportId,...rest}=report||{};
  return rest;
}
