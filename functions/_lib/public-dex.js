const DEX_CANDIDATES=new Set(['defillama','dexpaprika','chainlink-data-feeds']);
const STAGES=Object.freeze({
  'terms-review':{id:'rights-review',label:'Rights review',rank:1},
  'key-required':{id:'configuration-required',label:'Configuration required',rank:2},
  'paid-or-contract':{id:'contract-required',label:'Commercial contract required',rank:3},
  'external-research':{id:'external-research',label:'External research only',rank:4}
});

const role=(source)=>{
  if(source.id==='defillama')return 'Protocol and chain aggregate research candidate';
  if(source.id==='dexpaprika')return 'DEX market and pool discovery candidate';
  if(source.id==='chainlink-data-feeds')return 'Oracle dependency research candidate';
  if(source.id.includes('scan'))return 'Contract and transaction explorer destination';
  if(source.integration==='key-required')return 'Configured on-chain data provider candidate';
  if(source.integration==='paid-or-contract')return 'Institutional on-chain risk provider candidate';
  return 'External on-chain research destination';
};

const nextAction=(integration)=>({
  'terms-review':'Approve current display, attribution, rate-limit and redistribution terms.',
  'key-required':'Configure a server-side credential, quota policy and approved data purpose.',
  'paid-or-contract':'Complete commercial coverage, entitlement and redistribution review.',
  'external-research':'Open the official destination and cite evidence manually; do not scrape or embed.'
}[integration]||'Complete provider governance review.');

export function buildPublicDexDiscovery(directory=[]){
  const sources=directory.filter((item)=>item?.category==='on-chain'||DEX_CANDIDATES.has(item?.id)).map((item)=>{
    const stage=STAGES[item.integration]||{id:'unassessed',label:'Unassessed',rank:9};
    return {id:item.id,name:item.name,role:role(item),officialUrl:item.url||null,integration:item.integration,stage:{id:stage.id,label:stage.label},note:item.note,source:item.source,nextAction:nextAction(item.integration),capabilities:{directory:true,externalResearch:item.integration==='external-research',customerDisplay:false,persistence:false,walletConnection:false,transactionSubmission:false,execution:false}};
  }).sort((a,b)=>(STAGES[a.integration]?.rank??9)-(STAGES[b.integration]?.rank??9)||a.name.localeCompare(b.name));
  const counts=Object.fromEntries(['rights-review','configuration-required','contract-required','external-research','unassessed'].map((stage)=>[stage,sources.filter((item)=>item.stage.id===stage).length]));
  return {
    version:'governed-dex-research-v1',state:sources.length?'research-directory-available':'unavailable',
    job:'Turn a DEX or liquidity-pool question into a bounded on-chain evidence plan before interpreting price, liquidity, yield or risk.',
    purpose:'Research protocols, chains, pools, contracts, oracle dependencies and transaction evidence without connecting a wallet or inventing market measurements.',
    sources,summary:{total:sources.length,byStage:counts,displayEnabled:0,walletEnabled:0,executionEnabled:0},
    workflow:[
      {id:'identity',label:'Resolve identity',purpose:'Confirm chain, protocol, pool, token contracts and official interfaces.'},
      {id:'mechanism',label:'Map mechanism',purpose:'Document pool model, fee path, pricing curve, LP accounting and withdrawal behavior.'},
      {id:'dependencies',label:'Trace dependencies',purpose:'Identify oracles, bridges, routers, admin controls and upgrade authority.'},
      {id:'observations',label:'Collect observations',purpose:'Acquire timestamped liquidity, volume, price-impact and transaction evidence from approved sources.'},
      {id:'stress',label:'Stress the thesis',purpose:'Test liquidity exits, depeg, oracle failure, bridge failure, governance and smart-contract scenarios.'},
      {id:'decision',label:'Record boundary',purpose:'Name verified claims, missing evidence, invalidation conditions and the human decision owner.'}
    ],
    evidenceFields:['Chain and network','Protocol and official interface','Pool or market identifier','Token contract addresses','Pool mechanism and fee path','Liquidity composition and concentration','Timestamped volume and price-impact observations','Oracle and bridge dependencies','Admin, pause and upgrade controls','Audit and incident evidence','Wallet and transaction trace','Jurisdiction and access restrictions'],
    boundaries:{noPoolRanking:true,noTvlClaim:true,noVolumeClaim:true,noAprClaim:true,noWalletConnection:true,noTransactionSubmission:true,noExecution:true,noCustody:true,fabricatedFallback:false},
    methodology:{version:'Qelly DEX research method 1.0',classification:'Sources come only from the governed provider directory and are grouped by their current integration or research boundary.',measurement:'No TVL, volume, APR, liquidity, slippage, reserve, audit or safety value is displayed until an approved source returns timestamped evidence.',comparison:'This workspace compares evidence readiness and research gaps—not protocol quality, yield, liquidity or safety.'}
  };
}

export const __dexTest=Object.freeze({DEX_CANDIDATES,STAGES,role,nextAction});
