const ENGINE_VERSION='1.0.0';
const DEFAULT_PRECISION=12;
const DEFAULT_DISPLAY=6;
const now=()=>new Date().toISOString();

export class FormulaError extends Error{
  constructor(code,message,field=null){super(message);this.name='FormulaError';this.code=code;this.field=field;}
}

const finite=(value,field,{min=-Infinity,max=Infinity,exclusiveMin=false}={})=>{
  const number=typeof value==='number'?value:Number(value);
  if(!Number.isFinite(number))throw new FormulaError('invalid_number',`${field} must be a finite number`,field);
  if(exclusiveMin?number<=min:number<min)throw new FormulaError('out_of_range',`${field} must be ${exclusiveMin?'greater than':'at least'} ${min}`,field);
  if(number>max)throw new FormulaError('out_of_range',`${field} must be no more than ${max}`,field);
  return number;
};
const positive=(value,field)=>finite(value,field,{min:0,exclusiveMin:true});
const nonNegative=(value,field)=>finite(value,field,{min:0});
const percent=(value,field,{allowNegative=false,max=100000}={})=>finite(value,field,{min:allowNegative?-max:0,max});
const array=(value,field,{minLength=1}={})=>{if(!Array.isArray(value)||value.length<minLength)throw new FormulaError('invalid_array',`${field} must contain at least ${minLength} value(s)`,field);return value;};
const numbers=(value,field,options={})=>array(value,field,options).map((entry,index)=>finite(entry,`${field}[${index}]`));
const quantize=(value,decimals=DEFAULT_PRECISION)=>{
  if(!Number.isFinite(value))throw new FormulaError('non_finite_result','Calculation produced a non-finite result');
  const factor=10**Math.min(15,Math.max(0,decimals));
  return Math.round((value+Number.EPSILON*Math.sign(value))*factor)/factor;
};
const roundTo=(value,step=1,mode='floor')=>{const s=positive(step,'roundingStep');const ratio=value/s;return quantize((mode==='ceil'?Math.ceil(ratio):mode==='nearest'?Math.round(ratio):Math.floor(ratio))*s);};
const normalCdf=(x)=>0.5*(1+erf(x/Math.SQRT2));
const normalPdf=(x)=>Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI);
const erf=(x)=>{const sign=x<0?-1:1;const a=Math.abs(x);const t=1/(1+0.3275911*a);const y=1-((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-a*a);return sign*y;};
const sum=(values)=>values.reduce((total,value)=>total+value,0);
const mean=(values)=>sum(values)/values.length;
const sampleVariance=(values)=>{if(values.length<2)throw new FormulaError('insufficient_observations','At least two observations are required');const avg=mean(values);return sum(values.map(value=>(value-avg)**2))/(values.length-1);};
const populationVariance=(values)=>{const avg=mean(values);return sum(values.map(value=>(value-avg)**2))/values.length;};
const stdev=(values,{sample=true}={})=>Math.sqrt(sample?sampleVariance(values):populationVariance(values));
const covariance=(a,b)=>{if(a.length!==b.length||a.length<2)throw new FormulaError('length_mismatch','Series must have equal length of at least two');const ma=mean(a),mb=mean(b);return sum(a.map((v,i)=>(v-ma)*(b[i]-mb)))/(a.length-1);};
const ensureWeights=(weights,count)=>{const values=numbers(weights,'weights',{minLength:count});if(values.length!==count)throw new FormulaError('length_mismatch','weights length must match values');const total=sum(values);if(Math.abs(total)<1e-15)throw new FormulaError('invalid_weights','weights must not sum to zero');return values.map(value=>value/total);};
const yearlyPeriods={annual:1,semiannual:2,quarterly:4,monthly:12,weekly:52,daily:365};
const periodCount=(value)=>typeof value==='string'?(yearlyPeriods[value]??finite(value,'periodsPerYear',{min:1})):finite(value,'periodsPerYear',{min:1});
const safePow=(base,exponent,field='base')=>{if(base<0&&!Number.isInteger(exponent))throw new FormulaError('invalid_power',`${field} cannot be negative for a fractional exponent`,field);return base**exponent;};
const dateValue=(value,field)=>{const date=new Date(value);if(Number.isNaN(date.getTime()))throw new FormulaError('invalid_date',`${field} must be an ISO-compatible date`,field);return date;};

const definitions=[
  ['position-size','Position Size','trade-risk','Position quantity from account risk, entry, stop, multiplier and cost assumptions'],
  ['fixed-fractional-position-size','Fixed Fractional Position Size','trade-risk','Position quantity using a fixed percentage of account value'],
  ['kelly-criterion','Kelly Criterion','trade-risk','Full and fractional Kelly allocation with a configurable cap'],
  ['risk-reward','Risk / Reward','trade-risk','Reward-to-risk ratio for a proposed trade'],
  ['expectancy','Trade Expectancy','trade-risk','Expected return per trade from win rate and average outcomes'],
  ['r-multiple','R-Multiple','trade-risk','Realized or projected result expressed in initial risk units'],
  ['stop-loss-distance','Stop-Loss Distance','trade-risk','Absolute and percentage distance between entry and stop'],
  ['target-price','Target Price','trade-risk','Target price from entry, risk distance and desired R multiple'],
  ['breakeven-price','Breakeven Including Costs','costs','Breakeven price including fees, spread and slippage'],
  ['leverage','Leverage','margin','Position notional divided by equity'],
  ['initial-margin','Initial Margin','margin','Initial margin from notional and leverage or margin rate'],
  ['margin-utilization','Margin Utilization','margin','Used margin as a percentage of available equity'],
  ['isolated-liquidation-estimate','Isolated Liquidation Estimate','margin','Educational isolated-margin liquidation estimate with explicit assumptions'],
  ['round-trip-cost','Round-Trip Trading Cost','costs','Combined fees, spread, slippage and user-entered statutory costs'],
  ['absolute-return','Absolute Return','returns','Absolute and percentage return between start and end values'],
  ['annualized-return','Annualized Return','returns','Annualized holding-period return'],
  ['cagr','Compound Annual Growth Rate','returns','Compound annual growth rate'],
  ['time-weighted-return','Time-Weighted Return','returns','Geometrically linked sub-period returns'],
  ['xirr','XIRR','returns','Irregular cash-flow internal rate of return using bounded Newton/bisection solving'],
  ['sharpe-ratio','Sharpe Ratio','risk-statistics','Annualized excess-return ratio'],
  ['sortino-ratio','Sortino Ratio','risk-statistics','Annualized excess return divided by downside deviation'],
  ['maximum-drawdown','Maximum Drawdown','risk-statistics','Largest peak-to-trough decline and duration'],
  ['historical-var','Historical Value at Risk','risk-statistics','Empirical quantile loss with explicit confidence level'],
  ['expected-shortfall','Expected Shortfall','risk-statistics','Average loss beyond historical VaR'],
  ['portfolio-expected-return','Portfolio Expected Return','portfolio','Weighted expected return'],
  ['portfolio-volatility','Portfolio Volatility','portfolio','Volatility from weights and covariance matrix'],
  ['inverse-volatility-weights','Inverse Volatility Weights','portfolio','Normalized inverse-volatility allocation'],
  ['sip-future-value','SIP Future Value','india-finance','Future value of recurring monthly investments'],
  ['step-up-sip','Step-Up SIP','india-finance','Future value of annually increasing monthly contributions'],
  ['lump-sum-future-value','Lump Sum Future Value','india-finance','Compound future value of a one-time investment'],
  ['swp-schedule','Systematic Withdrawal Plan','india-finance','Deterministic withdrawal schedule and ending balance'],
  ['goal-planner','Goal Planner','india-finance','Required monthly contribution for an inflation-adjusted goal'],
  ['loan-emi','Loan EMI','india-finance','Reducing-balance monthly installment'],
  ['loan-amortization','Loan Amortization','india-finance','Monthly principal, interest and balance schedule'],
  ['loan-prepayment','Loan Prepayment','india-finance','Interest and tenure effect of a one-time prepayment'],
  ['simple-interest','Simple Interest','india-finance','Simple interest and maturity value'],
  ['compound-interest','Compound Interest','india-finance','Compound interest and maturity value'],
  ['apr-to-apy','APR to APY','crypto-defi','Nominal APR converted to effective APY'],
  ['apy-to-apr','APY to APR','crypto-defi','Effective APY converted to nominal APR'],
  ['impermanent-loss','Impermanent Loss','crypto-defi','Constant-product AMM impermanent loss from relative price change'],
  ['black-scholes','Black-Scholes European Option','options','European call/put value and Greeks; not valid for American exercise'],
  ['put-call-parity','Put-Call Parity','options','European put-call parity implied value'],
  ['bond-price','Bond Price','fixed-income','Present value of coupons and principal'],
  ['bond-duration','Bond Duration','fixed-income','Macaulay and modified duration plus DV01'],
  ['futures-pnl','Futures P&L','futures-fx','Contract profit/loss from price change and multiplier'],
  ['fx-pip-value','FX Pip Value','futures-fx','Pip value with user-supplied conversion rate'],
  ['minimum-variance-hedge-ratio','Minimum Variance Hedge Ratio','futures-fx','Covariance divided by futures variance'],
  ['correlation','Correlation','risk-statistics','Pearson correlation of two equal-length series'],
  ['beta','Beta','risk-statistics','Asset covariance with benchmark divided by benchmark variance'],
  ['realized-volatility','Annualized Realized Volatility','risk-statistics','Annualized standard deviation of periodic returns']
].map(([id,name,domain,description])=>Object.freeze({formulaId:id,name,domain,description,version:'1.0.0',engineVersion:ENGINE_VERSION,deterministic:true,externalProviderRequired:false,calculationPrecision:DEFAULT_PRECISION,displayPrecision:DEFAULT_DISPLAY,rounding:'half-away-from-zero-at-output',effectiveFrom:'2026-07-29',effectiveTo:null,jurisdiction:domain==='india-finance'?'IN':'GLOBAL',status:'IMPLEMENTED_DETERMINISTIC_LOCAL'}));
const definitionMap=new Map(definitions.map(definition=>[definition.formulaId,definition]));

const implementations={
  'position-size':(input)=>{
    const account=positive(input.accountValue,'accountValue');
    const riskAmount=input.riskAmount==null?account*percent(input.riskPercent,'riskPercent')/100:positive(input.riskAmount,'riskAmount');
    const entry=positive(input.entry,'entry'),stop=positive(input.stop,'stop'),multiplier=positive(input.multiplier??1,'multiplier');
    const distance=Math.abs(entry-stop)*multiplier;
    if(distance===0)throw new FormulaError('zero_risk_distance','entry and stop must differ','stop');
    const fees=nonNegative(input.estimatedFees??0,'estimatedFees'),slippage=nonNegative(input.slippagePerUnit??0,'slippagePerUnit')*multiplier;
    const riskPerUnit=distance+slippage;
    const rawUnits=Math.max(0,(riskAmount-fees)/riskPerUnit);
    const units=roundTo(rawUnits,input.quantityStep??1,input.roundingMode??'floor');
    const estimatedFees=fees+units*nonNegative(input.feePerUnit??0,'feePerUnit');
    const totalRisk=units*riskPerUnit+estimatedFees;
    return {riskAmount,riskPerUnit,rawUnits,units,estimatedFees,totalRisk,entry,stop,multiplier};
  },
  'fixed-fractional-position-size':(input)=>implementations['position-size']({...input,riskAmount:null}),
  'kelly-criterion':(input)=>{const p=percent(input.winProbability,'winProbability',{max:100})/100;const avgWin=positive(input.averageWin,'averageWin'),avgLoss=positive(input.averageLoss,'averageLoss');const b=avgWin/avgLoss;const full=(b*p-(1-p))/b;const fraction=finite(input.fraction??0.5,'fraction',{min:0,max:1});const cap=percent(input.maximumRiskPercent??25,'maximumRiskPercent',{max:100})/100;return {payoffRatio:b,fullKelly:full,fractionalKelly:Math.max(0,Math.min(cap,full*fraction)),maximumRiskCap:cap,sensitiveEstimateWarning:true};},
  'risk-reward':(input)=>{const entry=positive(input.entry,'entry'),stop=positive(input.stop,'stop'),target=positive(input.target,'target');const risk=Math.abs(entry-stop),reward=Math.abs(target-entry);if(risk===0)throw new FormulaError('zero_risk_distance','entry and stop must differ','stop');return {risk,reward,rewardRiskRatio:reward/risk,riskRewardRatio:risk/reward};},
  'expectancy':(input)=>{const p=percent(input.winProbability,'winProbability',{max:100})/100,win=finite(input.averageWin,'averageWin'),loss=Math.abs(finite(input.averageLoss,'averageLoss'));return {expectancy:p*win-(1-p)*loss,winProbability:p,lossProbability:1-p,payoffRatio:loss?win/loss:null};},
  'r-multiple':(input)=>{const result=finite(input.result,'result'),initialRisk=positive(input.initialRisk,'initialRisk');return {rMultiple:result/initialRisk,result,initialRisk};},
  'stop-loss-distance':(input)=>{const entry=positive(input.entry,'entry'),stop=positive(input.stop,'stop');const distance=Math.abs(entry-stop);return {distance,distancePercent:distance/entry*100,direction:stop<entry?'long':'short'};},
  'target-price':(input)=>{const entry=positive(input.entry,'entry'),stop=positive(input.stop,'stop'),r=positive(input.rMultiple,'rMultiple');const direction=input.direction??(stop<entry?'long':'short');const distance=Math.abs(entry-stop);return {target:direction==='short'?entry-distance*r:entry+distance*r,riskDistance:distance,rMultiple:r,direction};},
  'breakeven-price':(input)=>{const entry=positive(input.entry,'entry'),quantity=positive(input.quantity??1,'quantity'),cost=nonNegative(input.totalCosts??0,'totalCosts'),side=input.side==='short'?'short':'long';const perUnit=cost/quantity;return {breakeven:side==='short'?entry-perUnit:entry+perUnit,costPerUnit:perUnit,side};},
  'leverage':(input)=>{const notional=positive(input.notional,'notional'),equity=positive(input.equity,'equity');return {leverage:notional/equity,notional,equity};},
  'initial-margin':(input)=>{const notional=positive(input.notional,'notional');const margin=input.marginRatePercent!=null?notional*percent(input.marginRatePercent,'marginRatePercent')/100:notional/positive(input.leverage,'leverage');return {initialMargin:margin,notional,marginRatePercent:margin/notional*100};},
  'margin-utilization':(input)=>{const used=nonNegative(input.usedMargin,'usedMargin'),equity=positive(input.equity,'equity');return {utilizationPercent:used/equity*100,freeMargin:equity-used,usedMargin:used,equity};},
  'isolated-liquidation-estimate':(input)=>{const entry=positive(input.entry,'entry'),leverage=positive(input.leverage,'leverage'),maintenance=percent(input.maintenanceMarginPercent??0.5,'maintenanceMarginPercent')/100,fee=percent(input.closeFeePercent??0,'closeFeePercent')/100,side=input.side==='short'?'short':'long';const move=1/leverage-maintenance-fee;const price=side==='long'?entry*(1-move):entry*(1+move);return {estimatedLiquidationPrice:Math.max(0,price),distancePercent:Math.abs(price-entry)/entry*100,side,assumption:'isolated linear estimate',estimated:true};},
  'round-trip-cost':(input)=>{const notional=nonNegative(input.notional,'notional');const feeRate=percent(input.feeRatePercent??0,'feeRatePercent')/100,spread=percent(input.spreadPercent??0,'spreadPercent')/100,slippage=percent(input.slippagePercent??0,'slippagePercent')/100,statutory=nonNegative(input.statutoryCosts??0,'statutoryCosts'),fixed=nonNegative(input.fixedCosts??0,'fixedCosts');const fees=notional*feeRate*2,spreadCost=notional*spread,slippageCost=notional*slippage*2,total=fees+spreadCost+slippageCost+statutory+fixed;return {fees,spreadCost,slippageCost,statutoryCosts:statutory,fixedCosts:fixed,totalCost:total,breakevenMovePercent:notional?total/notional*100:0};},
  'absolute-return':(input)=>{const start=finite(input.startValue,'startValue'),end=finite(input.endValue,'endValue');if(start===0)throw new FormulaError('zero_denominator','startValue cannot be zero','startValue');return {absoluteReturn:end-start,returnPercent:(end/start-1)*100,startValue:start,endValue:end};},
  'annualized-return':(input)=>{const start=positive(input.startValue,'startValue'),end=nonNegative(input.endValue,'endValue'),days=positive(input.days,'days');return {annualizedReturnPercent:(safePow(end/start,365/days,'endValue')-1)*100,holdingPeriodReturnPercent:(end/start-1)*100,days};},
  'cagr':(input)=>{const start=positive(input.startValue,'startValue'),end=nonNegative(input.endValue,'endValue'),years=positive(input.years,'years');return {cagrPercent:(safePow(end/start,1/years,'endValue')-1)*100,years};},
  'time-weighted-return':(input)=>{const returns=numbers(input.returnsPercent,'returnsPercent');const linked=returns.reduce((factor,value)=>factor*(1+value/100),1);return {timeWeightedReturnPercent:(linked-1)*100,subperiods:returns.length};},
  'xirr':(input)=>{const cashflows=array(input.cashflows,'cashflows',{minLength:2}).map((item,index)=>({amount:finite(item.amount,`cashflows[${index}].amount`),date:dateValue(item.date,`cashflows[${index}].date`)})).sort((a,b)=>a.date-b.date);if(!cashflows.some(x=>x.amount<0)||!cashflows.some(x=>x.amount>0))throw new FormulaError('cashflow_signs','XIRR requires at least one negative and one positive cash flow');const base=cashflows[0].date;const npv=(rate)=>sum(cashflows.map(flow=>flow.amount/safePow(1+rate,(flow.date-base)/31557600000,'rate')));let lo=-0.9999,hi=10;while(npv(lo)*npv(hi)>0&&hi<1e6)hi*=2;if(npv(lo)*npv(hi)>0)throw new FormulaError('solver_no_bracket','Unable to bracket an XIRR solution');for(let i=0;i<200;i++){const mid=(lo+hi)/2,value=npv(mid);if(Math.abs(value)<1e-10){lo=hi=mid;break;}if(npv(lo)*value<=0)hi=mid;else lo=mid;}const rate=(lo+hi)/2;return {xirrPercent:rate*100,iterations:200,cashflowCount:cashflows.length,solver:'bounded-bisection'};},
  'sharpe-ratio':(input)=>{const values=numbers(input.returnsPercent,'returnsPercent',{minLength:2}).map(v=>v/100),periods=periodCount(input.periodsPerYear??252),rf=finite(input.riskFreeRatePercent??0,'riskFreeRatePercent')/100/periods;const excess=values.map(v=>v-rf),sd=stdev(excess);if(sd===0)throw new FormulaError('zero_volatility','Excess-return volatility is zero');return {sharpe:mean(excess)/sd*Math.sqrt(periods),annualizedExcessReturnPercent:mean(excess)*periods*100,annualizedVolatilityPercent:sd*Math.sqrt(periods)*100};},
  'sortino-ratio':(input)=>{const values=numbers(input.returnsPercent,'returnsPercent',{minLength:2}).map(v=>v/100),periods=periodCount(input.periodsPerYear??252),target=finite(input.targetReturnPercent??0,'targetReturnPercent')/100/periods;const downside=Math.sqrt(mean(values.map(v=>Math.min(0,v-target)**2)));if(downside===0)throw new FormulaError('zero_downside','Downside deviation is zero');return {sortino:(mean(values)-target)/downside*Math.sqrt(periods),annualizedDownsideDeviationPercent:downside*Math.sqrt(periods)*100};},
  'maximum-drawdown':(input)=>{const values=numbers(input.values,'values',{minLength:2});let peak=values[0],peakIndex=0,max=0,troughIndex=0,startIndex=0,recoveryIndex=null;for(let i=0;i<values.length;i++){if(values[i]>peak){peak=values[i];peakIndex=i;}const dd=peak===0?0:(peak-values[i])/Math.abs(peak);if(dd>max){max=dd;troughIndex=i;startIndex=peakIndex;recoveryIndex=null;}if(max>0&&recoveryIndex==null&&i>troughIndex&&values[i]>=values[startIndex])recoveryIndex=i;}return {maximumDrawdownPercent:max*100,peakIndex:startIndex,troughIndex,recoveryIndex,durationToTrough:troughIndex-startIndex,recoveryDuration:recoveryIndex==null?null:recoveryIndex-troughIndex};},
  'historical-var':(input)=>{const values=numbers(input.returnsPercent,'returnsPercent',{minLength:2}).sort((a,b)=>a-b),confidence=percent(input.confidencePercent??95,'confidencePercent',{max:99.99})/100,index=Math.max(0,Math.ceil((1-confidence)*values.length)-1),quantile=values[index];return {valueAtRiskPercent:Math.max(0,-quantile),quantileReturnPercent:quantile,confidencePercent:confidence*100,observations:values.length,method:'historical'};},
  'expected-shortfall':(input)=>{const values=numbers(input.returnsPercent,'returnsPercent',{minLength:2}).sort((a,b)=>a-b),confidence=percent(input.confidencePercent??95,'confidencePercent',{max:99.99})/100,count=Math.max(1,Math.ceil((1-confidence)*values.length)),tail=values.slice(0,count);return {expectedShortfallPercent:Math.max(0,-mean(tail)),tailObservations:count,confidencePercent:confidence*100,method:'historical'};},
  'portfolio-expected-return':(input)=>{const expected=numbers(input.expectedReturnsPercent,'expectedReturnsPercent'),weights=ensureWeights(input.weights,expected.length);return {expectedReturnPercent:sum(expected.map((value,index)=>value*weights[index])),normalizedWeights:weights};},
  'portfolio-volatility':(input)=>{const covarianceMatrix=array(input.covarianceMatrix,'covarianceMatrix'),n=covarianceMatrix.length,weights=ensureWeights(input.weights,n);if(covarianceMatrix.some(row=>!Array.isArray(row)||row.length!==n))throw new FormulaError('invalid_matrix','covarianceMatrix must be square');let variance=0;for(let i=0;i<n;i++)for(let j=0;j<n;j++)variance+=weights[i]*weights[j]*finite(covarianceMatrix[i][j],`covarianceMatrix[${i}][${j}]`);return {portfolioVolatility:Math.sqrt(Math.max(0,variance)),portfolioVariance:variance,normalizedWeights:weights};},
  'inverse-volatility-weights':(input)=>{const vols=numbers(input.volatilities,'volatilities').map((value,index)=>positive(value,`volatilities[${index}]`)),raw=vols.map(value=>1/value),total=sum(raw),weights=raw.map(value=>value/total);weights[weights.length-1]=1-sum(weights.slice(0,-1));return {weights};},
  'sip-future-value':(input)=>{const contribution=nonNegative(input.monthlyContribution,'monthlyContribution'),annual=finite(input.annualReturnPercent,'annualReturnPercent')/100,months=Math.round(positive(input.years,'years')*12),timing=input.timing==='beginning'?'beginning':'end',r=annual/12;const value=Math.abs(r)<1e-15?contribution*months:contribution*((safePow(1+r,months,'annualReturnPercent')-1)/r)*(timing==='beginning'?(1+r):1);return {futureValue:value,totalContributions:contribution*months,estimatedGrowth:value-contribution*months,months,timing};},
  'step-up-sip':(input)=>{let contribution=nonNegative(input.monthlyContribution,'monthlyContribution'),balance=0,total=0;const annual=finite(input.annualReturnPercent,'annualReturnPercent')/100,r=annual/12,years=Math.round(positive(input.years,'years')),step=finite(input.annualStepUpPercent??0,'annualStepUpPercent')/100;const schedule=[];for(let year=1;year<=years;year++){for(let month=1;month<=12;month++){balance=balance*(1+r)+contribution;total+=contribution;}schedule.push({year,monthlyContribution:contribution,balance,totalContributions:total});contribution*=1+step;}return {futureValue:balance,totalContributions:total,estimatedGrowth:balance-total,annualStepUpPercent:step*100,schedule};},
  'lump-sum-future-value':(input)=>{const principal=nonNegative(input.principal,'principal'),annual=finite(input.annualReturnPercent,'annualReturnPercent')/100,years=positive(input.years,'years'),n=periodCount(input.compoundsPerYear??1);const value=principal*safePow(1+annual/n,n*years,'annualReturnPercent');return {futureValue:value,principal,estimatedGrowth:value-principal,compoundsPerYear:n};},
  'swp-schedule':(input)=>{let balance=nonNegative(input.initialBalance,'initialBalance');const withdrawal=nonNegative(input.monthlyWithdrawal,'monthlyWithdrawal'),annual=finite(input.annualReturnPercent??0,'annualReturnPercent')/100,r=annual/12,months=Math.round(positive(input.months,'months')),schedule=[];let withdrawn=0;for(let month=1;month<=months;month++){const opening=balance,interest=opening*r;balance=Math.max(0,opening+interest-withdrawal);const actual=Math.min(withdrawal,opening+interest);withdrawn+=actual;schedule.push({month,openingBalance:opening,interest,withdrawal:actual,closingBalance:balance});if(balance===0)break;}return {endingBalance:balance,totalWithdrawn:withdrawn,monthsCompleted:schedule.length,schedule,depleted:balance===0};},
  'goal-planner':(input)=>{const current=nonNegative(input.currentSavings??0,'currentSavings'),goal=positive(input.goalAmount,'goalAmount'),inflation=finite(input.inflationPercent??0,'inflationPercent')/100,annual=finite(input.annualReturnPercent,'annualReturnPercent')/100,years=positive(input.years,'years'),months=Math.round(years*12),futureGoal=goal*safePow(1+inflation,years,'inflationPercent'),futureCurrent=current*safePow(1+annual/12,months,'annualReturnPercent'),r=annual/12,needed=Math.max(0,futureGoal-futureCurrent),monthly=Math.abs(r)<1e-15?needed/months:needed*r/(safePow(1+r,months,'annualReturnPercent')-1);return {futureGoal,requiredMonthlyContribution:monthly,currentSavingsFutureValue:futureCurrent,years};},
  'loan-emi':(input)=>{const principal=positive(input.principal,'principal'),annual=nonNegative(input.annualRatePercent,'annualRatePercent')/100,months=Math.round(positive(input.months,'months')),r=annual/12;const emi=Math.abs(r)<1e-15?principal/months:principal*r*safePow(1+r,months,'annualRatePercent')/(safePow(1+r,months,'annualRatePercent')-1);return {emi,principal,totalPayment:emi*months,totalInterest:emi*months-principal,months};},
  'loan-amortization':(input)=>{const base=implementations['loan-emi'](input);let balance=base.principal,totalInterest=0;const r=nonNegative(input.annualRatePercent,'annualRatePercent')/100/12,schedule=[];for(let month=1;month<=base.months;month++){const interest=balance*r,principalPaid=month===base.months?balance:Math.min(balance,base.emi-interest);const payment=principalPaid+interest;balance=Math.max(0,balance-principalPaid);totalInterest+=interest;schedule.push({month,openingBalance:balance+principalPaid,payment,principal:principalPaid,interest,closingBalance:balance});}return {...base,totalInterest,schedule};},
  'loan-prepayment':(input)=>{const original=implementations['loan-amortization'](input),at=Math.round(finite(input.prepaymentMonth,'prepaymentMonth',{min:1,max:original.months})),amount=nonNegative(input.prepaymentAmount,'prepaymentAmount'),row=original.schedule[at-1],remaining=Math.max(0,row.closingBalance-amount),annual=nonNegative(input.annualRatePercent,'annualRatePercent')/100,r=annual/12;let balance=remaining,interest=0,months=0;while(balance>1e-8&&months<original.months*2){const charge=balance*r,principal=Math.min(balance,original.emi-charge);if(principal<=0)throw new FormulaError('negative_amortization','EMI is insufficient after prepayment assumptions');balance-=principal;interest+=charge;months++;}const originalRemainingInterest=sum(original.schedule.slice(at).map(item=>item.interest));return {prepaymentMonth:at,prepaymentAmount:amount,remainingBalanceAfterPrepayment:remaining,newRemainingMonths:months,monthsSaved:Math.max(0,original.months-at-months),interestSaved:Math.max(0,originalRemainingInterest-interest)};},
  'simple-interest':(input)=>{const principal=nonNegative(input.principal,'principal'),rate=finite(input.annualRatePercent,'annualRatePercent')/100,years=nonNegative(input.years,'years'),interest=principal*rate*years;return {interest,maturityValue:principal+interest};},
  'compound-interest':(input)=>implementations['lump-sum-future-value']({principal:input.principal,annualReturnPercent:input.annualRatePercent,years:input.years,compoundsPerYear:input.compoundsPerYear??1}),
  'apr-to-apy':(input)=>{const apr=finite(input.aprPercent,'aprPercent')/100,n=periodCount(input.compoundsPerYear??12);return {apyPercent:(safePow(1+apr/n,n,'aprPercent')-1)*100,aprPercent:apr*100,compoundsPerYear:n};},
  'apy-to-apr':(input)=>{const apy=finite(input.apyPercent,'apyPercent')/100,n=periodCount(input.compoundsPerYear??12);return {aprPercent:n*(safePow(1+apy,1/n,'apyPercent')-1)*100,apyPercent:apy*100,compoundsPerYear:n};},
  'impermanent-loss':(input)=>{const ratio=positive(input.priceRatio,'priceRatio'),lp=2*Math.sqrt(ratio)/(1+ratio),loss=lp-1;return {impermanentLossPercent:loss*100,lpRelativeValuePercent:lp*100,priceRatio:ratio,model:'constant-product-50-50'};},
  'black-scholes':(input)=>{const S=positive(input.spot,'spot'),K=positive(input.strike,'strike'),T=positive(input.timeYears,'timeYears'),r=finite(input.riskFreeRatePercent,'riskFreeRatePercent')/100,q=finite(input.dividendYieldPercent??0,'dividendYieldPercent')/100,sigma=positive(input.volatilityPercent,'volatilityPercent')/100,type=input.optionType==='put'?'put':'call';const d1=(Math.log(S/K)+(r-q+sigma*sigma/2)*T)/(sigma*Math.sqrt(T)),d2=d1-sigma*Math.sqrt(T),discR=Math.exp(-r*T),discQ=Math.exp(-q*T);const call=S*discQ*normalCdf(d1)-K*discR*normalCdf(d2),put=K*discR*normalCdf(-d2)-S*discQ*normalCdf(-d1),price=type==='call'?call:put,delta=type==='call'?discQ*normalCdf(d1):discQ*(normalCdf(d1)-1),gamma=discQ*normalPdf(d1)/(S*sigma*Math.sqrt(T)),vega=S*discQ*normalPdf(d1)*Math.sqrt(T)/100,thetaCall=(-S*discQ*normalPdf(d1)*sigma/(2*Math.sqrt(T))-r*K*discR*normalCdf(d2)+q*S*discQ*normalCdf(d1))/365,thetaPut=(-S*discQ*normalPdf(d1)*sigma/(2*Math.sqrt(T))+r*K*discR*normalCdf(-d2)-q*S*discQ*normalCdf(-d1))/365,rho=type==='call'?K*T*discR*normalCdf(d2)/100:-K*T*discR*normalCdf(-d2)/100;return {optionType:type,price,callPrice:call,putPrice:put,delta,gamma,vega,theta:type==='call'?thetaCall:thetaPut,rho,d1,d2,model:'Black-Scholes European',americanExerciseSupported:false};},
  'put-call-parity':(input)=>{const S=positive(input.spot,'spot'),K=positive(input.strike,'strike'),T=positive(input.timeYears,'timeYears'),r=finite(input.riskFreeRatePercent,'riskFreeRatePercent')/100,q=finite(input.dividendYieldPercent??0,'dividendYieldPercent')/100,known=nonNegative(input.knownOptionPrice,'knownOptionPrice'),knownType=input.knownType==='put'?'put':'call',forwardTerm=S*Math.exp(-q*T)-K*Math.exp(-r*T);return knownType==='call'?{impliedPut:known-forwardTerm,knownType}:{impliedCall:known+forwardTerm,knownType};},
  'bond-price':(input)=>{const face=positive(input.faceValue,'faceValue'),couponRate=nonNegative(input.couponRatePercent,'couponRatePercent')/100,yieldRate=finite(input.yieldPercent,'yieldPercent')/100,years=positive(input.years,'years'),frequency=periodCount(input.frequency??2),periods=Math.round(years*frequency),coupon=face*couponRate/frequency,y=yieldRate/frequency;let price=0;for(let t=1;t<=periods;t++)price+=coupon/safePow(1+y,t,'yieldPercent');price+=face/safePow(1+y,periods,'yieldPercent');return {dirtyPrice:price,pricePer100:price/face*100,couponPerPeriod:coupon,periods,frequency};},
  'bond-duration':(input)=>{const face=positive(input.faceValue,'faceValue'),couponRate=nonNegative(input.couponRatePercent,'couponRatePercent')/100,yieldRate=finite(input.yieldPercent,'yieldPercent')/100,years=positive(input.years,'years'),frequency=periodCount(input.frequency??2),periods=Math.round(years*frequency),coupon=face*couponRate/frequency,y=yieldRate/frequency;let price=0,weighted=0;for(let t=1;t<=periods;t++){const cash=t===periods?coupon+face:coupon,pv=cash/safePow(1+y,t,'yieldPercent');price+=pv;weighted+=(t/frequency)*pv;}const macaulay=weighted/price,modified=macaulay/(1+y),dv01=modified*price*0.0001;return {price,macaulayDurationYears:macaulay,modifiedDurationYears:modified,dv01};},
  'futures-pnl':(input)=>{const entry=finite(input.entry,'entry'),exit=finite(input.exit,'exit'),contracts=finite(input.contracts,'contracts'),multiplier=positive(input.multiplier??1,'multiplier'),side=input.side==='short'?'short':'long',gross=(exit-entry)*contracts*multiplier*(side==='short'?-1:1),cost=nonNegative(input.totalCosts??0,'totalCosts');return {grossPnl:gross,totalCosts:cost,netPnl:gross-cost,side,contracts,multiplier};},
  'fx-pip-value':(input)=>{const units=positive(input.units,'units'),pipSize=positive(input.pipSize??0.0001,'pipSize'),conversion=positive(input.quoteToAccountRate??1,'quoteToAccountRate');return {pipValue:units*pipSize*conversion,units,pipSize,quoteToAccountRate:conversion};},
  'minimum-variance-hedge-ratio':(input)=>{const spot=numbers(input.spotReturns,'spotReturns',{minLength:2}),futures=numbers(input.futuresReturns,'futuresReturns',{minLength:2});if(spot.length!==futures.length)throw new FormulaError('length_mismatch','spotReturns and futuresReturns must have equal length');return {hedgeRatio:covariance(spot,futures)/sampleVariance(futures),observations:spot.length};},
  'correlation':(input)=>{const a=numbers(input.seriesA,'seriesA',{minLength:2}),b=numbers(input.seriesB,'seriesB',{minLength:2});if(a.length!==b.length)throw new FormulaError('length_mismatch','series lengths must match');const denominator=stdev(a)*stdev(b);if(denominator===0)throw new FormulaError('zero_variance','Both series must have non-zero variance');return {correlation:covariance(a,b)/denominator,observations:a.length};},
  'beta':(input)=>{const asset=numbers(input.assetReturns,'assetReturns',{minLength:2}),benchmark=numbers(input.benchmarkReturns,'benchmarkReturns',{minLength:2});if(asset.length!==benchmark.length)throw new FormulaError('length_mismatch','series lengths must match');return {beta:covariance(asset,benchmark)/sampleVariance(benchmark),observations:asset.length};},
  'realized-volatility':(input)=>{const values=numbers(input.returnsPercent,'returnsPercent',{minLength:2}).map(value=>value/100),periods=periodCount(input.periodsPerYear??252);return {annualizedVolatilityPercent:stdev(values)*Math.sqrt(periods)*100,periodsPerYear:periods,observations:values.length};}
};

const sanitize=(value)=>{
  if(Array.isArray(value))return value.map(sanitize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['__proto__','prototype','constructor'].includes(key)).map(([key,item])=>[key,sanitize(item)]));
  if(typeof value==='number')return quantize(value);
  return value;
};

export function listFormulaDefinitions({domain=null}={}){
  return definitions.filter(definition=>!domain||definition.domain===domain).map(definition=>({...definition}));
}
export function getFormulaDefinition(formulaId){const definition=definitionMap.get(formulaId);if(!definition)throw new FormulaError('formula_not_found',`Unknown formula: ${formulaId}`,'formulaId');return {...definition};}
export function calculateFormula(formulaId,inputs={},options={}){
  const definition=getFormulaDefinition(formulaId),implementation=implementations[formulaId];
  if(!implementation)throw new FormulaError('formula_unavailable',`${formulaId} is registered but not executable`,'formulaId');
  const calculatedAt=options.calculatedAt??now();
  try{
    const outputs=sanitize(implementation(sanitize(inputs)));
    return {formulaId,formulaVersion:definition.version,engineVersion:ENGINE_VERSION,calculatedAt,inputs:sanitize(inputs),normalizedInputs:sanitize(inputs),outputs,outputUnits:options.outputUnits??{},assumptions:[definition.description,...(options.assumptions??[])],methodology:definition.description,effectiveDate:options.effectiveDate??definition.effectiveFrom,sourceReferences:options.sourceReferences??[],confidence:'deterministic',status:'success',warnings:[...(outputs.estimated?["Estimated result; venue-specific rules may differ."]:[]),...(outputs.sensitiveEstimateWarning?["Kelly output is highly sensitive to estimated win probability and payoff ratio."]:[])],validationErrors:[],truthState:'IMPLEMENTED_DETERMINISTIC_LOCAL',evidence:{schemaVersion:1,formulaId,formulaVersion:definition.version,engineVersion:ENGINE_VERSION,calculatedAt,deterministic:true,externalProviderRequired:false,jurisdiction:definition.jurisdiction,rounding:definition.rounding,calculationPrecision:definition.calculationPrecision}};
  }catch(error){if(error instanceof FormulaError)return {formulaId,formulaVersion:definition.version,engineVersion:ENGINE_VERSION,calculatedAt,inputs:sanitize(inputs),normalizedInputs:sanitize(inputs),outputs:null,outputUnits:{},assumptions:[definition.description],methodology:definition.description,effectiveDate:definition.effectiveFrom,sourceReferences:[],confidence:'invalid',status:'validation_error',warnings:[],validationErrors:[{code:error.code,message:error.message,field:error.field}],truthState:'IMPLEMENTED_DETERMINISTIC_LOCAL',evidence:{schemaVersion:1,formulaId,formulaVersion:definition.version,engineVersion:ENGINE_VERSION,calculatedAt,deterministic:true,externalProviderRequired:false}};throw error;}
}
export function calculateBatch(requests=[],options={}){return array(requests,'requests').map((request,index)=>calculateFormula(request.formulaId,request.inputs,{...options,calculatedAt:options.calculatedAt??now(),requestIndex:index}));}
export const formulaEngineMetadata=Object.freeze({engineVersion:ENGINE_VERSION,definitionCount:definitions.length,deterministic:true,externalProviderRequired:false,calculationPrecision:DEFAULT_PRECISION,displayPrecision:DEFAULT_DISPLAY});
