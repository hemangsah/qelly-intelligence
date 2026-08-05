const examples=Object.freeze({
  'position-size':{accountValue:100000,riskPercent:1,entry:100,stop:95,multiplier:1,estimatedFees:10,slippagePerUnit:0.05,quantityStep:1,roundingMode:'floor'},
  'fixed-fractional-position-size':{accountValue:100000,riskPercent:1,entry:100,stop:95,multiplier:1,estimatedFees:10,slippagePerUnit:0.05,quantityStep:1},
  'kelly-criterion':{winProbability:55,averageWin:1.8,averageLoss:1,fraction:0.5,maximumRiskPercent:25},
  'risk-reward':{entry:100,stop:95,target:112},
  'expectancy':{winProbability:55,averageWin:180,averageLoss:100},
  'r-multiple':{result:250,initialRisk:100},
  'stop-loss-distance':{entry:100,stop:95},
  'target-price':{entry:100,stop:95,rMultiple:2,direction:'long'},
  'breakeven-price':{entry:100,quantity:10,totalCosts:5,side:'long'},
  'leverage':{notional:50000,equity:10000},
  'initial-margin':{notional:50000,leverage:5},
  'margin-utilization':{usedMargin:4000,equity:10000},
  'isolated-liquidation-estimate':{entry:65000,leverage:5,maintenanceMarginPercent:0.5,closeFeePercent:0.1,side:'long'},
  'round-trip-cost':{notional:100000,feeRatePercent:0.05,spreadPercent:0.02,slippagePercent:0.03,statutoryCosts:20,fixedCosts:5},
  'absolute-return':{startValue:10000,endValue:11800},
  'annualized-return':{startValue:10000,endValue:11800,days:365},
  'cagr':{startValue:10000,endValue:18000,years:5},
  'time-weighted-return':{returnsPercent:[2,-1,3.5,0.5]},
  'xirr':{cashflows:[{amount:-10000,date:'2024-01-01'},{amount:2500,date:'2024-09-01'},{amount:9000,date:'2025-08-01'}]},
  'sharpe-ratio':{returnsPercent:[1.2,-0.4,0.8,1.6,-0.2,0.9],periodsPerYear:252,riskFreeRatePercent:5},
  'sortino-ratio':{returnsPercent:[1.2,-0.4,0.8,1.6,-0.2,0.9],periodsPerYear:252,targetReturnPercent:0},
  'maximum-drawdown':{values:[100,105,102,94,98,110]},
  'historical-var':{returnsPercent:[-2.1,1.2,-0.8,0.4,1.5,-3.2,0.7],confidencePercent:95},
  'expected-shortfall':{returnsPercent:[-2.1,1.2,-0.8,0.4,1.5,-3.2,0.7],confidencePercent:95},
  'portfolio-expected-return':{expectedReturnsPercent:[8,12,6],weights:[0.4,0.35,0.25]},
  'portfolio-volatility':{covarianceMatrix:[[0.04,0.01],[0.01,0.09]],weights:[0.6,0.4]},
  'inverse-volatility-weights':{volatilities:[12,18,9]},
  'sip-future-value':{monthlyContribution:10000,annualReturnPercent:12,years:10,timing:'end'},
  'step-up-sip':{monthlyContribution:10000,annualReturnPercent:12,years:10,annualStepUpPercent:10},
  'lump-sum-future-value':{principal:500000,annualReturnPercent:10,years:10,compoundsPerYear:1},
  'swp-schedule':{initialBalance:2000000,monthlyWithdrawal:15000,annualReturnPercent:8,months:120},
  'goal-planner':{currentSavings:500000,goalAmount:5000000,inflationPercent:6,annualReturnPercent:10,years:10},
  'loan-emi':{principal:5000000,annualRatePercent:8.5,months:240},
  'loan-amortization':{principal:5000000,annualRatePercent:8.5,months:240},
  'loan-prepayment':{principal:5000000,annualRatePercent:8.5,months:240,prepaymentMonth:24,prepaymentAmount:500000},
  'simple-interest':{principal:100000,annualRatePercent:8,years:3},
  'compound-interest':{principal:100000,annualRatePercent:8,years:3,compoundsPerYear:4},
  'apr-to-apy':{aprPercent:12,compoundsPerYear:12},
  'apy-to-apr':{apyPercent:12.68,compoundsPerYear:12},
  'impermanent-loss':{priceRatio:2},
  'black-scholes':{spot:100,strike:105,timeYears:0.5,riskFreeRatePercent:5,dividendYieldPercent:0,volatilityPercent:25,optionType:'call'},
  'put-call-parity':{spot:100,strike:105,timeYears:0.5,riskFreeRatePercent:5,dividendYieldPercent:0,knownOptionPrice:7,knownType:'call'},
  'bond-price':{faceValue:1000,couponRatePercent:7,yieldPercent:8,years:5,frequency:2},
  'bond-duration':{faceValue:1000,couponRatePercent:7,yieldPercent:8,years:5,frequency:2},
  'futures-pnl':{entry:65000,exit:67000,contracts:2,multiplier:1,side:'long',totalCosts:40},
  'fx-pip-value':{units:100000,pipSize:0.0001,quoteToAccountRate:1},
  'minimum-variance-hedge-ratio':{spotReturns:[1,-0.5,0.7,-1.2,0.4],futuresReturns:[0.9,-0.4,0.6,-1,0.3]},
  'correlation':{seriesA:[1,2,3,4,5],seriesB:[1.1,1.9,3.2,3.8,5.1]},
  'beta':{assetReturns:[1,-0.5,0.8,-1.1,0.6],benchmarkReturns:[0.8,-0.4,0.5,-0.9,0.4]},
  'realized-volatility':{returnsPercent:[1.2,-0.4,0.8,1.6,-0.2,0.9],periodsPerYear:252}
});

const enumValues=Object.freeze({
  direction:['long','short'],side:['long','short'],timing:['end','beginning'],roundingMode:['floor','nearest','ceil'],optionType:['call','put'],knownType:['call','put'],frequency:[1,2,4,12],compoundsPerYear:[1,2,4,12,365],periodsPerYear:[252,365,52,12]
});
const titleOverrides=Object.freeze({accountValue:'Account value',riskPercent:'Risk percentage',riskAmount:'Risk amount',entry:'Entry price',stop:'Stop-loss price',multiplier:'Contract multiplier',estimatedFees:'Estimated fees',slippagePerUnit:'Slippage per unit',quantityStep:'Quantity step',annualReturnPercent:'Annual return',annualRatePercent:'Annual interest rate',returnsPercent:'Periodic returns',confidencePercent:'Confidence level',riskFreeRatePercent:'Risk-free rate',dividendYieldPercent:'Dividend yield',volatilityPercent:'Volatility',timeYears:'Time to expiry',knownOptionPrice:'Known option price',faceValue:'Face value',couponRatePercent:'Coupon rate',yieldPercent:'Yield to maturity',quoteToAccountRate:'Quote-to-account conversion rate'});
const descriptionOverrides=Object.freeze({accountValue:'Total account equity used as the risk base.',riskPercent:'Maximum account percentage allocated to this calculation.',entry:'Planned entry price.',stop:'Price at which the risk assumption ends.',multiplier:'Value represented by one unit or contract.',estimatedFees:'Estimated fixed fees included in the risk budget.',slippagePerUnit:'Expected adverse price movement per unit.',quantityStep:'Smallest tradable quantity increment.',returnsPercent:'Enter a JSON array of periodic percentage returns.',cashflows:'Enter a JSON array of amount and ISO-date objects.',covarianceMatrix:'Enter a square JSON covariance matrix.',weights:'Enter a JSON array of portfolio weights.'});
const humanize=(value)=>String(value).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').replace(/^./,(character)=>character.toUpperCase());
const unitFor=(key)=>/percent|rate|probability|volatility|yield/i.test(key)?'%':/price|value|amount|notional|equity|fee|cost|principal|payment|income|salary|balance|contribution|withdrawal|goal|spot|strike|pnl/i.test(key)?'currency':/years|timeYears/i.test(key)?'years':/months|tenure/i.test(key)?'months':/days/i.test(key)?'days':/quantity|units|contracts|shares/i.test(key)?'units':'';
const typeFor=(value)=>Array.isArray(value)?'array':value&&typeof value==='object'?'object':typeof value==='number'?'number':typeof value==='boolean'?'boolean':'string';

export function inputContractFor(definition){
  const nativeSchema=definition?.inputSchema;
  const nativeExample=definition?.referenceVector?.inputs;
  if(nativeSchema?.properties&&Object.keys(nativeSchema.properties).length)return{schema:nativeSchema,example:nativeExample||examples[definition.formulaId]||{}};
  const example=nativeExample&&Object.keys(nativeExample).length?nativeExample:examples[definition?.formulaId]||{};
  const properties=Object.fromEntries(Object.entries(example).map(([key,value])=>[key,{type:typeFor(value),title:titleOverrides[key]||humanize(key),description:descriptionOverrides[key]||`Enter ${humanize(key).toLowerCase()} for this calculation.`,unit:unitFor(key),...(enumValues[key]?{enum:enumValues[key]}:{}),...(typeof value==='number'&&/percent|probability/i.test(key)?{minimum:0,maximum:100}:{}),example:value}]));
  return{schema:{type:'object',required:Object.keys(example).filter((key)=>!['estimatedFees','slippagePerUnit','quantityStep','roundingMode','feePerUnit','riskAmount','fraction','maximumRiskPercent','dividendYieldPercent','totalCosts','fixedCosts','statutoryCosts','timing','direction','side','periodsPerYear','compoundsPerYear','frequency','targetReturnPercent','riskFreeRatePercent','annualStepUpPercent','currentSavings','inflationPercent','maintenanceMarginPercent','closeFeePercent','quoteToAccountRate'].includes(key)),properties},example};
}

export function listFoundationPresentationContracts(){return Object.entries(examples).map(([formulaId,example])=>({formulaId,example}));}
