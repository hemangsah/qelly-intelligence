/* Deterministic resampling of an OBSERVED MT5 deal sample, not forecasts. */
const round=(n,d=5)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
const quantile=(a,p)=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),at=(b.length-1)*p,left=Math.floor(at),right=Math.ceil(at);return b[left]+(b[right]-b[left])*(at-left);};
const seedValues=a=>{let h=2166136261>>>0;for(const x of a)h=Math.imul(h^(Math.round(x*1e4)|0),16777619)>>>0;return h;};
const rng=initial=>{let state=initial>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};};
const drawdown=a=>{let total=0,high=0,worst=0;for(const x of a){total+=x;high=Math.max(high,total);worst=Math.max(worst,high-total);}return worst;};
export function mt5SampleStatistics(values,{bootstrapRuns=320,reorderRuns=256}={}){
 if(!Array.isArray(values)||!values.length||values.length>100000||values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new TypeError('Finite observed deal P&L is required');
 const n=values.length,mean=avg(values),m2=values.reduce((s,x)=>s+(x-mean)**2,0)/n;
 const sd=n>1?Math.sqrt(m2*n/(n-1)):null;
 const skew=n>=8&&m2>0?values.reduce((s,x)=>s+(x-mean)**3,0)/n/m2**1.5:null;
 const kurt=n>=8&&m2>0?values.reduce((s,x)=>s+(x-mean)**4,0)/n/m2**2-3:null;
 const available=n>=30&&n<=5000;
 const base={sampleSize:n,meanPnl:round(mean),sampleSd:round(sd),descriptiveSkew:round(skew),descriptiveExcessKurtosis:round(kurt),
  status:available?'OBSERVED SAMPLE RESAMPLING':'INSUFFICIENT OR OVERSIZED SAMPLE',
  assumptions:['Deal outcomes are treated as exchangeable for internal resampling only.','Intervals describe this uploaded sample and are not predictive probabilities.','Trading regime, deposits, position exposure, slippage and broker account equity are unavailable.']};
 if(!available)return {...base,bootstrapMean95:null,reorderedDrawdown95:null,bootstrapRuns:0,reorderRuns:0};
 if(!Number.isInteger(bootstrapRuns)||bootstrapRuns<100||bootstrapRuns>1000||!Number.isInteger(reorderRuns)||reorderRuns<100||reorderRuns>1000)throw new RangeError('Bounded 100–1,000 iteration counts required');
 const random=rng(seedValues(values));const means=[];
 for(let i=0;i<bootstrapRuns;i++){let total=0;for(let j=0;j<n;j++)total+=values[Math.floor(random()*n)];means.push(total/n);}
 const dd=[];
 for(let i=0;i<reorderRuns;i++){
   const shuffled=values.slice();for(let j=n-1;j>0;j--){const k=Math.floor(random()*(j+1));[shuffled[j],shuffled[k]]=[shuffled[k],shuffled[j]];}
   dd.push(drawdown(shuffled));
 }
 return {...base,bootstrapRuns,reorderRuns,bootstrapMean95:[round(quantile(means,.025)),round(quantile(means,.975))],
  reorderedDrawdown95:round(quantile(dd,.95)),resamplingBoundary:'Internal bootstrap and sequence reshuffle only; no future certainty or risk-of-ruin estimate.'};
}
