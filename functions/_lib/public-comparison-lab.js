const ASSETS=Object.freeze([
  Object.freeze({id:'QI-EQUITY-AAPL',symbol:'AAPL',name:'Apple Inc.',assetClass:'Equity'}),
  Object.freeze({id:'QI-EQUITY-NVDA',symbol:'NVDA',name:'NVIDIA Corporation',assetClass:'Equity'}),
  Object.freeze({id:'QI-EQUITY-MSFT',symbol:'MSFT',name:'Microsoft Corporation',assetClass:'Equity'}),
  Object.freeze({id:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',assetClass:'Crypto asset'}),
  Object.freeze({id:'QI-CRYPTO-ETH',symbol:'ETH',name:'Ethereum',assetClass:'Crypto asset'})
]);

const PROFILES=Object.freeze({
  Equity:Object.freeze([
    Object.freeze({label:'Revenue growth',unit:'%',direction:'higher',purpose:'Compare the same growth definition and fiscal period.'}),
    Object.freeze({label:'Operating margin',unit:'%',direction:'higher',purpose:'Compare operating profitability under one accounting perimeter.'}),
    Object.freeze({label:'Forward earnings multiple',unit:'x',direction:'lower',purpose:'Compare valuation burden using the same horizon and earnings definition.'})
  ]),
  'Crypto asset':Object.freeze([
    Object.freeze({label:'Liquidity depth',unit:'USD m',direction:'higher',purpose:'Compare executable market depth under the same venue and distance method.'}),
    Object.freeze({label:'Protocol fee generation',unit:'USD m',direction:'higher',purpose:'Compare like-for-like fee definitions over the same period.'}),
    Object.freeze({label:'Realized volatility',unit:'%',direction:'lower',purpose:'Compare risk using the same return interval and observation window.'})
  ])
});

const HORIZONS=Object.freeze([
  Object.freeze({id:'quarter',label:'Next quarter'}),Object.freeze({id:'year',label:'Next 12 months'}),Object.freeze({id:'three-year',label:'Three-year thesis'})
]);
const EVIDENCE_TYPES=Object.freeze([
  Object.freeze({id:'reported',label:'Reported fact'}),Object.freeze({id:'consensus',label:'Consensus estimate'}),Object.freeze({id:'assumption',label:'User assumption'}),Object.freeze({id:'observation',label:'Market or network observation'})
]);
const SOURCE_DOMAINS=Object.freeze(['sec.gov','apple.com','nvidia.com','microsoft.com','nasdaq.com','nyse.com','cmegroup.com','bitcoin.org','ethereum.org','github.com']);
const text=(value,max=500)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const number=(value)=>{if(value==null||String(value).trim()==='')return null;const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0&&parsed<=1e12?parsed:null;};
const integer=(value,fallback,min,max)=>{const parsed=Number.parseInt(String(value??''),10);return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback;};
const choice=(value,values,fallback)=>values.includes(value)?value:fallback;
const asset=(value,fallback)=>ASSETS.find((item)=>item.id===value||item.symbol===String(value||'').toUpperCase())||fallback;
const officialSource=(value)=>{try{const url=new URL(String(value||''));if(url.protocol!=='https:')return null;const hostname=url.hostname.toLowerCase();const authority=SOURCE_DOMAINS.find((domain)=>hostname===domain||hostname.endsWith(`.${domain}`));return authority?{url:url.href,authority}:null;}catch{return null;}};
const fingerprint=(value)=>{let hash=2166136261;for(const char of String(value||'')){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}return `fnv1a-${(hash>>>0).toString(16).padStart(8,'0')}`;};
const round=(value,digits=2)=>Number(Number(value).toFixed(digits));
const shares=(a,b,direction)=>{if(a==null||b==null)return {a:null,b:null};if(a+b===0)return {a:50,b:50};const aShare=direction==='lower'?b/(a+b)*100:a/(a+b)*100;return {a:round(aShare),b:round(100-aShare)};};

export function buildPublicComparisonLab(input={}){
  const candidateA=asset(input.candidateA,ASSETS[0]);
  const candidateB=asset(input.candidateB,ASSETS[1]);
  const compatible=candidateA.id!==candidateB.id&&candidateA.assetClass===candidateB.assetClass;
  const profile=PROFILES[candidateA.assetClass];
  const weights=[integer(input.weight1,34,1,100),integer(input.weight2,33,1,100),integer(input.weight3,33,1,100)];
  const criteria=profile.map((preset,index)=>{
    const slot=index+1;
    const direction=choice(text(input[`direction${slot}`],10),['higher','lower'],preset.direction);
    const valueA=number(input[`valueA${slot}`]);const valueB=number(input[`valueB${slot}`]);const score=shares(valueA,valueB,direction);
    return {
      slot,label:text(input[`label${slot}`],100)||preset.label,unit:text(input[`unit${slot}`],30)||preset.unit,period:text(input[`period${slot}`],80),direction,
      evidenceType:choice(text(input[`evidenceType${slot}`],20),EVIDENCE_TYPES.map((item)=>item.id),index===2?'consensus':'reported'),weight:weights[index],valueA,valueB,
      scoreA:score.a,scoreB:score.b,contributionA:score.a==null?null:round(score.a*weights[index]/100),contributionB:score.b==null?null:round(score.b*weights[index]/100),purpose:preset.purpose
    };
  });
  const sourceA=officialSource(input.sourceA);const sourceB=officialSource(input.sourceB);
  const declaration={question:text(input.question,420),horizon:choice(text(input.horizon,20),HORIZONS.map((item)=>item.id),'year'),owner:text(input.owner,100),invalidationRule:text(input.invalidationRule,420),sourceA:sourceA?.url??null,sourceB:sourceB?.url??null};
  const weightsTotal=weights.reduce((sum,value)=>sum+value,0);
  const definitionsReady=criteria.every((item)=>item.label&&item.unit&&item.period);
  const valuesReady=criteria.every((item)=>item.valueA!=null&&item.valueB!=null);
  const gates=[
    {id:'candidates',label:'Comparable candidates',state:compatible?'ready':'blocked',purpose:'Prevent duplicate or cross-asset-class coercion.',detail:compatible?`${candidateA.symbol} ↔ ${candidateB.symbol} · ${candidateA.assetClass}`:'Choose two distinct candidates from the same asset class.'},
    {id:'question',label:'Decision question',state:declaration.question?'ready':'blocked',purpose:'Define the choice this comparison is meant to inform.',detail:declaration.question||'Write one bounded comparison question.'},
    {id:'definitions',label:'Definitions & periods',state:definitionsReady?'ready':'blocked',purpose:'Require every row to share a declared metric, unit and period.',detail:definitionsReady?'All three comparison rows are definition-complete.':'Complete the period for every criterion.'},
    {id:'values',label:'Paired values',state:valuesReady?'ready':'blocked',purpose:'Require one non-negative declared value for each candidate and criterion.',detail:valuesReady?'Six declared values are available for normalization.':'Enter both candidate values for all three criteria.'},
    {id:'weights',label:'Weight integrity',state:weightsTotal===100?'ready':'blocked',purpose:'Make influence explicit and prevent hidden or overallocated criteria.',detail:`Declared weight total: ${weightsTotal}%${weightsTotal===100?'':' · must equal 100%'}`},
    {id:'direction',label:'Direction & evidence class',state:'ready',purpose:'State whether higher or lower is preferred and separate facts, consensus, assumptions and observations.',detail:'Every row has explicit direction and evidence classification.'},
    {id:'sources',label:'Primary sources',state:sourceA&&sourceB?'ready':'blocked',purpose:'Anchor each candidate to an approved issuer, regulator, exchange or protocol authority.',detail:sourceA&&sourceB?`${sourceA.authority} ↔ ${sourceB.authority}`:'Provide an approved HTTPS source for both candidates.'},
    {id:'accountability',label:'Owner & invalidation',state:declaration.owner&&declaration.invalidationRule?'ready':'blocked',purpose:'Assign review responsibility and declare when the comparison stops being decision-useful.',detail:declaration.owner&&declaration.invalidationRule?`${declaration.owner} owns the review.`:'Declare a review owner and invalidation rule.'}
  ];
  const readyGates=gates.filter((item)=>item.state==='ready').length;
  const complete=gates.every((item)=>item.state==='ready');
  const scoreA=compatible&&valuesReady&&weightsTotal===100?round(criteria.reduce((sum,item)=>sum+item.contributionA,0)):null;
  const scoreB=compatible&&valuesReady&&weightsTotal===100?round(criteria.reduce((sum,item)=>sum+item.contributionB,0)):null;
  const leader=!complete?null:scoreA===scoreB?'tie':scoreA>scoreB?candidateA.id:candidateB.id;
  const canonical=[candidateA.id,candidateB.id,declaration.question,declaration.horizon,declaration.owner,declaration.invalidationRule,declaration.sourceA||'',declaration.sourceB||'',...criteria.flatMap((item)=>[item.label,item.unit,item.period,item.direction,item.evidenceType,item.weight,item.valueA??'',item.valueB??''])].join('|');
  const integrity=fingerprint(canonical);
  const receipt={state:complete?'ready':'draft',comparisonId:complete?`${candidateA.symbol}-${candidateB.symbol}-${integrity.slice(-8)}`:null,fingerprint:integrity,scoreA,scoreB,leader,scoreMargin:complete?round(Math.abs(scoreA-scoreB)):null,weightsTotal,arithmeticOnly:true,userDeclared:true,persisted:false};
  return {
    version:'governed-comparison-lab-v2',state:complete?'comparison-ready':'comparison-setup-ready',
    job:'Compare two same-class candidates across three aligned, weighted and source-declared criteria without coercing incompatible definitions or presenting arithmetic as advice.',
    assets:ASSETS,profiles:PROFILES,horizons:HORIZONS,evidenceTypes:EVIDENCE_TYPES,sourceDomains:SOURCE_DOMAINS,candidateA,candidateB,compatible,declaration,criteria,receipt,gates,
    readiness:{readyGates,totalGates:gates.length,comparisonReady:complete,state:complete?'ready-for-human-review':'blocked-missing-comparison-fields'},
    coverage:{connectedSnapshots:0,registeredComparisons:complete?1:0,liveFeed:false,reason:'No approved production comparison dataset is connected. All metric values, periods, classifications and sources in this contract are user-declared.'},
    methodology:{normalization:'For each criterion, the two non-negative values are converted into direction-aware shares that sum to 100. Lower-is-better rows reverse the share.',composite:'Each direction-aware share is multiplied by its declared weight. Three weights must total exactly 100%; the two composite scores therefore sum to 100.',interpretation:'The arithmetic leader is not a recommendation. Review evidence quality, omitted variables, sensitivity and the invalidation rule before deciding.'},
    reviewProtocol:[
      {step:'01',label:'Resolve',job:'Choose two distinct candidates from the same asset class.'},
      {step:'02',label:'Align',job:'Lock one definition, unit, period, direction and evidence class per criterion.'},
      {step:'03',label:'Source',job:'Attach an approved primary-source authority to each candidate.'},
      {step:'04',label:'Weight',job:'Allocate exactly 100% influence before viewing the composite.'},
      {step:'05',label:'Challenge',job:'Test omitted variables, source quality and sensitivity to the largest weight.'},
      {step:'06',label:'Decide',job:'Send the receipt, owner and invalidation rule to Decision Provenance.'}
    ],
    handoffs:[
      {route:'fundamentals-estimates',label:'Fundamentals & Estimates',job:'Reconstruct operating definitions and assumptions before comparing issuer metrics.'},
      {route:'filing-workspace',label:'Filing Workspace',job:'Build exact citations for reported facts and definitions.'},
      {route:'news-research',label:'Qelly Chat & Research',job:'Investigate omitted variables and counter-evidence.'},
      {route:'decision-provenance',label:'Decision Provenance',job:'Attach the comparison receipt to a human choice and invalidation rule.'}
    ],
    boundaries:{fixtureSnapshots:false,marketDataFetched:false,sourceContentFetched:false,sourceContentVerified:false,userDeclaredValues:true,crossClassScoring:false,recommendation:false,execution:false,persistence:false}
  };
}

export const __test=Object.freeze({ASSETS,PROFILES,HORIZONS,EVIDENCE_TYPES,SOURCE_DOMAINS,text,number,integer,choice,asset,officialSource,fingerprint,shares});
