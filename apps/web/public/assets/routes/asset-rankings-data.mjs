const OBSERVED_AT='2026-07-27T00:00:00.000Z';

const ASSETS=Object.freeze([
  ['QI-CRYPTO-BTC','BTC','Bitcoin',65291.65,0.22,1.30,1.75,8.42,16.16e9,1.31e12,1.34e12,19.88e6,31.8e9,.0067,1.42,54.2e6,41.8,94],
  ['QI-CRYPTO-ETH','ETH','Ethereum',1955.03,0.31,3.70,5.25,11.42,8.11e9,235.7e9,237.4e9,120.6e6,14.2e9,.0054,2.28,29.8e6,48.2,92],
  ['QI-CRYPTO-SOL','SOL','Solana',176.25,-0.18,1.69,.04,6.16,3.19e9,84.46e9,101.2e9,479.2e6,4.9e9,.0108,3.11,13.1e6,57.4,88],
  ['QI-CRYPTO-XRP','XRP','XRP',1.10,.08,.58,1.38,4.21,1.68e9,69.18e9,109.4e9,62.9e9,2.4e9,.0032,.92,5.2e6,44.1,86],
  ['QI-CRYPTO-BNB','BNB','BNB',573.51,-.03,.51,1.49,3.82,821e6,76.34e9,76.36e9,133.1e6,3.2e9,.0041,1.08,7.8e6,36.7,90],
  ['QI-CRYPTO-DOGE','DOGE','Dogecoin',.17281,.41,.60,1.05,9.74,565.7e6,24.44e9,25.1e9,141.3e9,1.7e9,.0094,4.32,8.9e6,65.2,82],
  ['QI-CRYPTO-ADA','ADA','Cardano',.417,.15,1.20,2.60,7.28,352e6,14.9e9,18.7e9,35.8e9,.73e9,.0028,1.38,2.9e6,51.8,79],
  ['QI-CRYPTO-LINK','LINK','Chainlink',18.77,.52,3.88,4.57,12.14,634e6,11.56e9,18.7e9,616.1e6,.91e9,.0061,2.72,3.6e6,59.6,87],
  ['QI-CRYPTO-AVAX','AVAX','Avalanche',36.70,-.21,2.14,3.02,8.28,498e6,15.2e9,16.4e9,414.2e6,.67e9,.0058,1.82,2.7e6,54.1,83],
  ['QI-CRYPTO-SUI','SUI','Sui',3.72,.61,4.18,6.12,18.23,788e6,12.6e9,37.2e9,3.38e9,.88e9,.0111,4.64,4.1e6,68.8,80],
  ['QI-CRYPTO-HYPE','HYPE','Hyperliquid',60.34,.27,3.27,.57,21.42,408e6,20.24e9,60.1e9,335e6,2.7e9,.0148,5.92,9.6e6,71.2,84],
  ['QI-CRYPTO-AAVE','AAVE','Aave',300.49,.16,2.32,3.74,16.72,345e6,4.52e9,4.8e9,15.1e6,.46e9,.0049,2.08,1.9e6,61.9,89],
  ['QI-CRYPTO-TRX','TRX','TRON',.313,.02,.42,2.12,5.06,546e6,27.2e9,27.2e9,86.8e9,.82e9,.0017,.54,2.1e6,31.2,81],
  ['QI-CRYPTO-DOT','DOT','Polkadot',4.18,-.14,-.88,1.04,-2.76,228e6,6.7e9,6.9e9,1.6e9,.44e9,-.0021,-1.18,2.8e6,48.9,78],
  ['QI-CRYPTO-UNI','UNI','Uniswap',10.52,.38,2.81,5.44,14.02,379e6,6.6e9,10.5e9,628e6,.58e9,.0072,3.04,3.4e6,63.4,85],
  ['QI-CRYPTO-LTC','LTC','Litecoin',112.34,-.09,.72,1.92,4.18,412e6,8.5e9,9.4e9,75.6e6,.71e9,.0018,.62,2.6e6,38.4,88]
]);

export const COLUMN_DEFINITIONS=Object.freeze([
  ['rank','Rank'],['watchlist','Watchlist'],['asset','Asset'],['price','Price'],['change1h','1h'],['change24h','24h'],['change7d','7d'],['change30d','30d'],['sparkline','Sparkline'],['volume','Volume'],['marketCap','Market Cap'],['fdv','FDV'],['supply','Supply'],['liquidity','Liquidity'],['funding','Funding'],['openInterest','OI'],['oiChange','OI Change'],['liquidation','Liquidation'],['volatility','Volatility'],['confidence','Confidence'],['source','Source'],['freshness','Freshness'],['explain','Explain']
]);

export function deterministicRows(apiItems=[]){
  const bySymbol=new Map((apiItems??[]).map((item)=>[item.symbol,item]));
  return ASSETS.map((record,index)=>{
    const [id,symbol,name,price,change1h,change24h,change7d,change30d,volume,marketCap,fdv,supply,openInterest,funding,oiChange,liquidation,volatility,confidence]=record;
    const api=bySymbol.get(symbol)??{};
    const source=api.source??{};
    const resolvedPrice=Number(api.price??price);
    const resolvedVolume=Number(api.quoteVolume24h??api.volume24h??volume);
    const resolvedMarketCap=Number(api.marketCap??marketCap);
    return {
      rank:index+1,id:api.canonicalId??api.id??id,symbol,name:api.name??name,price:resolvedPrice,
      change1h,change24h:Number(api.change24h??change24h),change7d,change30d,
      volume:resolvedVolume,marketCap:resolvedMarketCap,fdv,supply,liquidity:resolvedVolume*.38,
      funding:Number(api.fundingRate??funding),openInterest:Number(api.openInterest??openInterest),oiChange,
      liquidation:Number(api.liquidation24h??liquidation),volatility,confidence:Math.round(Number(source.confidence??confidence/100)*100),
      source:source.providerName??source.provider??'Qelly deterministic composite',freshness:source.qualityState??source.freshness??'simulated',
      observedAt:source.observedAt??source.observationTime??OBSERVED_AT,
      sparkline:Array.from({length:22},(_,point)=>resolvedPrice*(1+Math.sin((point+index)*.47)*.018+Math.cos((point*3+index)*.13)*.008+point*.0007))
    };
  });
}

function seededNoise(index,seed){
  const value=Math.sin((index+1)*(12.9898+seed*.031))*43758.5453;
  return value-Math.floor(value)-.5;
}

export function deterministicOHLC({seed=65291.65,count=120,intervalSeconds=3600}={}){
  const points=[];
  let previous=seed;
  const start=Date.UTC(2026,6,22,0,0,0)/1000;
  for(let index=0;index<count;index+=1){
    const regime=index<30?-.0006:index<63?.0009:index<88?-.0002:.00135;
    const cycle=Math.sin(index*.34)*.0032+Math.sin(index*.087)*.0047;
    const shock=[24,25,66,89,90].includes(index)?seededNoise(index,seed)*.028:0;
    const movement=regime+cycle+seededNoise(index,seed)*.006+shock;
    const open=previous;
    const close=Math.max(seed*.72,open*(1+movement));
    const wick=.0028+Math.abs(seededNoise(index+20,seed))*.009;
    const high=Math.max(open,close)*(1+wick);
    const low=Math.min(open,close)*(1-wick*.86);
    const volume=2200*(.72+Math.abs(movement)*26+Math.abs(seededNoise(index+40,seed))*.7);
    const oi=31.1e9*(1+index*.0009+Math.sin(index*.14)*.018);
    const funding=.004+Math.sin(index*.18)*.006+movement*.14;
    points.push({time:start+index*intervalSeconds,open,high,low,close,volume,oi,funding});
    previous=close;
  }
  return points;
}

export const money=(value,{compact=false}={})=>value==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:compact?'compact':'standard',maximumFractionDigits:Math.abs(Number(value))<1?4:2}).format(Number(value));
export const compactNumber=(value)=>value==null?'—':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(Number(value));
export const percent=(value,digits=2)=>value==null?'—':`${Number(value)>0?'+':''}${Number(value).toFixed(digits)}%`;
export const tone=(value)=>Number(value)>0?'is-positive':Number(value)<0?'is-negative':'is-neutral';
export const observedAt=OBSERVED_AT;
