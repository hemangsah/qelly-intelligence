const finite=(value)=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const round=(value,digits=6)=>Number.isFinite(value)?Number(value.toFixed(digits)):null;

const normalizeSide=(rows,{descending=false}={})=>(Array.isArray(rows)?rows:[])
  .map(item=>({
    price:finite(item?.px??item?.price),
    size:finite(item?.sz??item?.size),
    orders:Math.max(0,Math.floor(finite(item?.n??item?.orders)??0))
  }))
  .filter(item=>item.price>0&&item.size>0)
  .sort((a,b)=>descending?b.price-a.price:a.price-b.price)
  .slice(0,20);

const notional=(levels,count=5)=>levels.slice(0,count).reduce((sum,item)=>sum+item.price*item.size,0);
const depthStats=(bids,asks,count)=>{
  const bid=notional(bids,count),ask=notional(asks,count),total=bid+ask;
  return {bid,ask,imbalance:total>0?(bid-ask)/total:null};
};
const imbalanceState=(value)=>value===null?'UNAVAILABLE':value>=.25?'BID_HEAVY':value<=-.25?'ASK_HEAVY':'BALANCED';
const depthConsensus=(values)=>{
  const valid=values.filter(Number.isFinite);
  if(valid.length<2)return 'UNAVAILABLE';
  const bid=valid.filter(value=>value>=.25).length,ask=valid.filter(value=>value<=-.25).length;
  if(bid===valid.length)return 'BID_HEAVY_CONSENSUS';
  if(ask===valid.length)return 'ASK_HEAVY_CONSENSUS';
  if(bid>=2)return 'BID_LEAN';
  if(ask>=2)return 'ASK_LEAN';
  if(bid&&ask)return 'MIXED';
  return 'BALANCED';
};

export function normalizeDecisionLiquidity(payload,{asset='BTC',provider='Hyperliquid'}={}){
  const levels=Array.isArray(payload?.levels)?payload.levels:[];
  const bids=normalizeSide(levels[0],{descending:true});
  const asks=normalizeSide(levels[1],{descending:false});
  const unavailableMetrics=['trade imbalance','aggressive buy/sell volume','volume delta','CVD','historical book depth','liquidation flow'];
  const unavailable=(reason)=>({
    state:'unavailable',
    provider,
    asset,
    currentOnly:true,
    reason,
    spreadState:'UNAVAILABLE',
    imbalanceState:'UNAVAILABLE',
    depthConsensus:'UNAVAILABLE',
    bestBid:null,
    bestAsk:null,
    mid:null,
    microprice:null,
    micropriceBiasBps:null,
    spread:null,
    spreadBps:null,
    top1BidDepthUsd:null,
    top1AskDepthUsd:null,
    top1Imbalance:null,
    top5BidDepthUsd:null,
    top5AskDepthUsd:null,
    top5Imbalance:null,
    top10BidDepthUsd:null,
    top10AskDepthUsd:null,
    top10Imbalance:null,
    depthConcentrationTop1:null,
    bidLevels:bids.length,
    askLevels:asks.length,
    unavailableMetrics
  });
  if(!bids.length||!asks.length)return unavailable('A two-sided verified L2 book snapshot is unavailable.');
  const bestBid=bids[0].price,bestAsk=asks[0].price;
  if(!(bestAsk>bestBid))return unavailable('The verified L2 snapshot is crossed or invalid.');
  const mid=(bestBid+bestAsk)/2;
  const spread=bestAsk-bestBid;
  const spreadBps=mid>0?spread/mid*10_000:null;
  const d1=depthStats(bids,asks,1),d5=depthStats(bids,asks,5),d10=depthStats(bids,asks,10);
  const top10Total=d10.bid+d10.ask,top1Total=d1.bid+d1.ask;
  const concentration=top10Total>0?top1Total/top10Total:null;
  const bestBidSize=bids[0].size,bestAskSize=asks[0].size,sizeTotal=bestBidSize+bestAskSize;
  const microprice=sizeTotal>0?(bestAsk*bestBidSize+bestBid*bestAskSize)/sizeTotal:null;
  const micropriceBiasBps=mid>0&&microprice!==null?(microprice-mid)/mid*10_000:null;
  const spreadState=spreadBps===null?'UNAVAILABLE':spreadBps<=5?'TIGHT':spreadBps<=15?'NORMAL':'WIDE';
  const consensus=depthConsensus([d1.imbalance,d5.imbalance,d10.imbalance]);
  const observedAt=Number.isFinite(Number(payload?.time))?new Date(Number(payload.time)).toISOString():null;
  return {
    state:'live',
    provider,
    asset,
    currentOnly:true,
    observedAt,
    bestBid:round(bestBid,8),
    bestAsk:round(bestAsk,8),
    mid:round(mid,8),
    microprice:round(microprice,8),
    micropriceBiasBps:round(micropriceBiasBps,3),
    spread:round(spread,8),
    spreadBps:round(spreadBps,3),
    spreadState,
    top1BidDepthUsd:round(d1.bid,2),
    top1AskDepthUsd:round(d1.ask,2),
    top1Imbalance:round(d1.imbalance,4),
    top1ImbalanceState:imbalanceState(d1.imbalance),
    top5BidDepthUsd:round(d5.bid,2),
    top5AskDepthUsd:round(d5.ask,2),
    top5Imbalance:round(d5.imbalance,4),
    imbalanceState:imbalanceState(d5.imbalance),
    top10BidDepthUsd:round(d10.bid,2),
    top10AskDepthUsd:round(d10.ask,2),
    top10Imbalance:round(d10.imbalance,4),
    top10ImbalanceState:imbalanceState(d10.imbalance),
    depthConsensus:consensus,
    depthConcentrationTop1:round(concentration,4),
    bidLevels:bids.length,
    askLevels:asks.length,
    method:'Current Hyperliquid L2 snapshot; top-1, top-5 and top-10 notional depth use price × size. Microprice uses best-level displayed size and is descriptive marketability context.',
    limitations:[
      'This is a point-in-time book snapshot, not historical order-flow evidence.',
      'Displayed depth can change or cancel rapidly and is not evidence of institutional intent.',
      'Microprice and depth imbalance are marketability context; they do not independently create BUY or SELL eligibility.',
      'CVD, aggressive trade flow, historical depth and liquidation flow remain unavailable unless separately sourced.'
    ],
    unavailableMetrics
  };
}

export const __decisionLiquidityTest=Object.freeze({normalizeSide,notional,depthStats,imbalanceState,depthConsensus});
