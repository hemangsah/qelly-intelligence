const OUTPUT_PRECISION=12;

const quantize=(value)=>{
  const factor=10**OUTPUT_PRECISION;
  return Math.round((value+Number.EPSILON*Math.sign(value))*factor)/factor;
};

export function stableHistoricalTailCount(confidence,observations){
  const raw=(1-confidence)*observations;
  const nearest=Math.round(raw);
  const tolerance=Number.EPSILON*Math.max(1,observations)*16;
  const stable=Math.abs(raw-nearest)<=tolerance?nearest:raw;
  return Math.max(1,Math.ceil(stable));
}

export function correctHistoricalTailResult(formulaId,result){
  if(result?.status!=='success'||(formulaId!=='historical-var'&&formulaId!=='expected-shortfall'))return result;
  const values=[...(result.normalizedInputs?.returnsPercent??[])].map(Number).sort((a,b)=>a-b);
  if(values.length<2||values.some(value=>!Number.isFinite(value)))return result;
  const confidence=Number(result.normalizedInputs?.confidencePercent??95)/100;
  if(!Number.isFinite(confidence))return result;
  const count=stableHistoricalTailCount(confidence,values.length);
  if(formulaId==='historical-var'){
    const quantile=values[count-1];
    return {...result,outputs:{...result.outputs,valueAtRiskPercent:quantize(Math.max(0,-quantile)),quantileReturnPercent:quantize(quantile),confidencePercent:quantize(confidence*100),observations:values.length,method:'historical'}};
  }
  const tail=values.slice(0,count);
  const mean=tail.reduce((total,value)=>total+value,0)/tail.length;
  return {...result,outputs:{...result.outputs,expectedShortfallPercent:quantize(Math.max(0,-mean)),tailObservations:count,confidencePercent:quantize(confidence*100),method:'historical'}};
}
