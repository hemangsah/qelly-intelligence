import {FreshFormulaError,finite,positive,nonNegative,nums,sum,mean,variance,stdev,covariance,quantile,normalCdf,normalPdf,combination,buildDefinition} from './fresh-formula-core.mjs';
const ROWS=[["fresh-fee-inclusive-return","Fee-Inclusive Return","cost-fee-tax","fee_inclusive_return",{"startingValue":1000,"endingValue":1100,"fees":20},8.0],["fresh-india-tax-gross-up","User-Entered India Tax Gross-Up","india-finance","tax_gross_up",{"netAmount":900,"taxRate":0.1},1000.0],["fresh-enterprise-value","Enterprise Value","accounting-valuation","enterprise_value",{"marketCap":1000,"debt":200,"preferredStock":20,"minorityInterest":10,"cash":100},1130],["fresh-binomial-probability","Binomial Probability","probability-distribution","binomial_probability",{"trials":5,"successes":2,"probability":0.5},0.3125],["fresh-scenario-pnl","Scenario P&L","scenario-stress","scenario_pnl",{"positionValue":100000,"shockPercent":-5,"cashFlow":500},-4500.0],["fresh-min-max-normalize","Min-Max Normalize","data-normalization","minmax",{"value":15,"minimum":10,"maximum":20},0.5]];
export const definitions=Object.freeze(ROWS.map(buildDefinition));
const ids=new Set(definitions.map(x=>x.formulaId));
export const owns=id=>ids.has(id);
export const calculate=(spec,input)=>{switch(spec.operation){
 case 'fee_inclusive_return':return (finite(input.endingValue,'endingValue')-positive(input.startingValue,'startingValue')-nonNegative(input.fees,'fees'))/positive(input.startingValue,'startingValue')*100;
 case 'tax_gross_up':{const r=finite(input.taxRate,'taxRate',{min:0,max:.999999});return nonNegative(input.netAmount,'netAmount')/(1-r);}
 case 'enterprise_value':return nonNegative(input.marketCap,'marketCap')+nonNegative(input.debt,'debt')+nonNegative(input.preferredStock,'preferredStock')+nonNegative(input.minorityInterest,'minorityInterest')-nonNegative(input.cash,'cash');
 case 'binomial_probability':{const n=Math.trunc(finite(input.trials,'trials',{min:0,max:1000})),k=Math.trunc(finite(input.successes,'successes',{min:0,max:n})),p=finite(input.probability,'probability',{min:0,max:1});return combination(n,k)*p**k*(1-p)**(n-k);}
 case 'scenario_pnl':return finite(input.positionValue,'positionValue')*finite(input.shockPercent,'shockPercent')/100+finite(input.cashFlow??0,'cashFlow');
 case 'minmax':{const lo=finite(input.minimum,'minimum'),hi=finite(input.maximum,'maximum');if(hi<=lo)throw new FreshFormulaError('invalid_range','maximum must exceed minimum');return (finite(input.value,'value')-lo)/(hi-lo);}
 default:throw new FreshFormulaError('formula_unavailable',`Unsupported fresh operation: ${spec.operation}`,'formulaId');
}};
