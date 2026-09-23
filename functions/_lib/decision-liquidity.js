const finite=(value)=>Number.isFinite(Number(value))?Number(value):null;
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

export function normalizeDecisionLiquidity(payload,{asset='BTC',provider='Hyperliquid'}={}){
  const levels=Array.isArray(payload?.levels)?payload.levels:[];
  const bids=normalizeSide(levels[0],{descending:true});
  const asks=normalizeSide(levels[1],{descending:false});
  const unavailable=(reason)=>({
    state:'unavailable',
    provider,
    asset,
    currentOnly:true,
    reason,
    spreadState:'UNAVAILABLE',
    imbalanceState:'UNAVAILABLE',
    bestBid:null,
    bestAsk:null,
    mid:null,
    spread:null,
    spreadBps:null,
    top5BidDepthUsd:null,
    top5AskDepthUsd:null,
    top5Imbalance:null,
    bidLevels:bids.length,
    askLevels:asks.length,
    unavailableMetrics:['trade imbalance','aggressive buy/sell volume','volume delta','CVD','historical book depth']
  });
  if(!bids.length||!asks.length)return unavailable('A two-sided verified L2 book snapshot is unavailable.');
  const bestBid=bids[0].price,bestAsk=asks[0].price;
  if(!(bestAsk>bestBid))return unavailable('The verified L2 snapshot is crossed or invalid.');
  const mid=(bestBid+bestAsk)/2;
  const spread=bestAsk-bestBid;
  const spreadBps=mid>0?spread/mid*10_000:null;
  const bidDepth=notional(bids,5),askDepth=notional(asks,5),totalDepth=bidDepth+askDepth;
  const imbalance=totalDepth>0?(bidDepth-askDepth)/totalDepth:null;
  const spreadState=spreadBps===null?'UNAVAILABLE':spreadBps<=5?'TIGHT':spreadBps<=15?'NORMAL':'WIDE';
  const imbalanceState=imbalance===null?'UNAVAILABLE':imbalance>=.25?'BID_HEAVY':imbalance<=-.25?'ASK_HEAVY':'BALANCED';
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
    spread:round(spread,8),
    spreadBps:round(spreadBps,3),
    spreadState,
    top5BidDepthUsd:round(bidDepth,2),
    top5AskDepthUsd:round(askDepth,2),
    top5Imbalance:round(imbalance,4),
    imbalanceState,
    bidLevels:bids.length,
    askLevels:asks.length,
    method:'Current Hyperliquid L2 snapshot; top-five notional depth uses price × size on each side.',
    limitations:[
      'This is a point-in-time book snapshot, not historical order-flow evidence.',
      'CVD, aggressive trade flow and liquidation flow are unavailable unless separately connected.',
      'Book imbalance is risk context and does not independently create BUY or SELL eligibility.'
    ],
    unavailableMetrics:['trade imbalance','aggressive buy/sell volume','volume delta','CVD','historical book depth']
  };
}

export const __decisionLiquidityTest=Object.freeze({normalizeSide,notional});
