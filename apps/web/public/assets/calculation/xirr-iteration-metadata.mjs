const YEAR_MS=31557600000;
const MAX_ITERATIONS=200;
const NPV_TOLERANCE=1e-10;

export function actualXirrIterations(input={}){
  const cashflows=[...(input.cashflows??[])]
    .map((item)=>({amount:Number(item.amount),date:new Date(item.date)}))
    .sort((a,b)=>a.date-b.date);
  const base=cashflows[0].date;
  const npv=(rate)=>cashflows.reduce((total,flow)=>total+flow.amount/((1+rate)**((flow.date-base)/YEAR_MS)),0);
  let lo=-0.9999;
  let hi=10;
  while(npv(lo)*npv(hi)>0&&hi<1e6)hi*=2;
  for(let index=0;index<MAX_ITERATIONS;index++){
    const mid=(lo+hi)/2;
    const value=npv(mid);
    if(Math.abs(value)<NPV_TOLERANCE)return index+1;
    if(npv(lo)*value<=0)hi=mid;
    else lo=mid;
  }
  return MAX_ITERATIONS;
}
