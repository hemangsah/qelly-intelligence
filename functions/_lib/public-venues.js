const SOURCE_BY_VENUE=Object.freeze({'hyperliquid-exchange':'hyperliquid'});
const POLICY_BY_VENUE=Object.freeze({binance:'binance',coinbase:'coinbase'});

const sourceState=(source)=>{
  const value=String(source?.truthState||source?.state||'unavailable').toLowerCase();
  if(!source||source.data==null||value==='unavailable')return 'unavailable';
  if(value.includes('live'))return 'live';
  if(value.includes('cached'))return 'cached';
  if(value.includes('delayed')||value.includes('reference'))return 'delayed';
  return 'cached';
};

const typeCopy=Object.freeze({
  exchange:{purpose:'Inspect an exchange destination and its Qelly market-data boundary before venue-specific due diligence.',useCase:'Use when exchange structure, market access, data permissions, or venue concentration matters.',questions:['Which official evidence proves market availability and customer-display rights?','What operational, custody, concentration, or jurisdiction risk remains unverified?']},
  broker:{purpose:'Inspect a broker destination and the boundary between public research, account access, and execution.',useCase:'Use when broker coverage, regulation, pricing, or account eligibility needs separate verification.',questions:['Which jurisdiction, entity, product and client classification would apply?','What independent evidence is required for costs, execution quality, custody, and operational resilience?']}
});

function venueStage(venue,policies,sources){
  const sourceId=SOURCE_BY_VENUE[venue.id];
  const source=sourceId?sources[sourceId]:null;
  if(sourceId&&sourceState(source)!=='unavailable')return {id:'read-only-observation',label:'Read-only observations',tone:sourceState(source),sourceId,source};
  const policyId=POLICY_BY_VENUE[venue.id];
  const policy=policyId?policies.find((item)=>item.id===policyId):null;
  if(policy&&!policy.enabled)return {id:'rights-review',label:'Display rights review',tone:'unavailable',policyId,policy};
  if(policy?.enabled)return {id:'reference-enabled',label:'Approved reference access',tone:'delayed',policyId,policy};
  return {id:'directory-only',label:'Directory only',tone:'unavailable',source:null,policy:null};
}

function observationSymbols(source){
  const rows=Array.isArray(source?.data)?source.data:[];
  return [...new Set(rows.map((row)=>String(row?.symbol||'').toUpperCase()).filter(Boolean))];
}

function normalizeVenue(venue,policies,sources){
  const stage=venueStage(venue,policies,sources);
  const copy=typeCopy[venue.category]||typeCopy.exchange;
  const symbols=observationSymbols(stage.source);
  const capabilities={
    catalogued:true,
    officialDestination:Boolean(venue.url),
    readOnlyObservations:stage.id==='read-only-observation',
    customerDisplay:stage.id==='read-only-observation',
    persistence:false,
    accountConnection:false,
    orderRouting:false,
    execution:false,
    custody:false
  };
  const missingEvidence=stage.id==='read-only-observation'
    ?['Verified market completeness','Account eligibility','Order-routing authorization','Execution quality','Custody and reserve evidence','Jurisdiction-specific availability']
    :stage.id==='rights-review'
      ?['Written end-user display permission','Approved persistence rights','Current market coverage','Operational status','Jurisdiction-specific availability']
      :['Approved market-data integration','Customer-display rights','Current market coverage','Fee schedule','Operational status','Jurisdiction-specific availability'];
  return {
    id:venue.id,
    name:venue.name,
    venueType:venue.category,
    officialUrl:venue.url||null,
    directorySource:venue.source,
    directoryNote:venue.note,
    stage:{id:stage.id,label:stage.label,tone:stage.tone},
    purpose:copy.purpose,
    useCase:copy.useCase,
    questions:copy.questions,
    capabilities,
    observation:{sourceId:stage.sourceId??null,sourceLabel:stage.source?.label??stage.source?.attribution??null,truthState:stage.source?sourceState(stage.source):'unavailable',observedAt:stage.source?.observedAt??null,usage:stage.source?.usage??null,symbols,count:symbols.length},
    policy:stage.policy?{providerId:stage.policy.id,enabled:stage.policy.enabled,capabilities:[...(stage.policy.capabilities||[])],termsState:stage.policy.termsState,reason:stage.policy.reason,termsUrl:stage.policy.termsUrl}:null,
    missingEvidence
  };
}

function permissionRows(policies,sources){
  const hyperliquid=sources.hyperliquid;
  const rows=[{
    id:'hyperliquid',label:'Hyperliquid public API',role:'Read-only venue observation context',stage:sourceState(hyperliquid)==='unavailable'?'unavailable':'read-only-observation',truthState:sourceState(hyperliquid),display:sourceState(hyperliquid)!=='unavailable',persistence:false,execution:false,account:false,termsState:hyperliquid?.usage||'Public documented read endpoint; no trading actions.',termsUrl:hyperliquid?.docsUrl||null
  }];
  for(const policy of policies.filter((item)=>['binance','coinbase'].includes(item.id))){
    rows.push({id:policy.id,label:policy.id==='binance'?'Binance market data':'Coinbase market data',role:'Configured provider policy',stage:policy.enabled?'reference-enabled':'rights-review',truthState:policy.enabled?'delayed':'unavailable',display:Boolean(policy.enabled),persistence:false,execution:false,account:false,termsState:policy.termsState,termsUrl:policy.termsUrl});
  }
  return rows;
}

export function buildPublicVenues({directory=[],providerPolicies=[],sources={}}={}){
  const venues=directory.filter((item)=>item?.integration==='broker-or-exchange').map((venue)=>normalizeVenue(venue,providerPolicies,sources)).sort((left,right)=>left.name.localeCompare(right.name));
  const stages=Object.fromEntries(['read-only-observation','rights-review','directory-only','reference-enabled'].map((stage)=>[stage,venues.filter((venue)=>venue.stage.id===stage).length]));
  const byType=Object.fromEntries(['exchange','broker'].map((type)=>[type,venues.filter((venue)=>venue.venueType===type).length]));
  return {
    version:'governed-venue-intelligence-v1',
    state:venues.length?'available':'unavailable',
    job:'Determine where a market or data observation originates, what Qelly is permitted to display, and which venue facts still require verification.',
    purpose:'Explore venue and broker destinations through integration state, permission evidence, observation coverage, and explicit execution boundaries.',
    venues,
    summary:{total:venues.length,officialDestinations:venues.filter((venue)=>venue.officialUrl).length,observationReady:stages['read-only-observation'],rightsReview:stages['rights-review'],directoryOnly:stages['directory-only'],byType,byStage:stages},
    permissionMatrix:permissionRows(providerPolicies,sources),
    methodology:{version:'Qelly venue-access method 1.0',classification:'Entries are included only when the governed provider directory classifies them as a broker or exchange.',stageLogic:'Read-only observations require a usable configured source. Rights review requires a configured provider policy that blocks customer display. Every other venue remains directory-only.',comparison:'Capabilities compare Qelly integration truth, not venue quality, liquidity, solvency, regulation, fees, reserves, or execution performance.'},
    boundaries:{directoryIsNotEndorsement:true,currentVenueFactsNotVerified:true,noVenueRanking:true,noAccountConnection:true,noOrderRouting:true,noExecution:true,noCustody:true,fabricatedFallback:false}
  };
}

export const __venuesTest=Object.freeze({SOURCE_BY_VENUE,POLICY_BY_VENUE,sourceState,venueStage,observationSymbols});
