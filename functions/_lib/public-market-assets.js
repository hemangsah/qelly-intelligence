export const PUBLIC_CRYPTO_ASSETS=Object.freeze([
  Object.freeze({canonicalId:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',category:'Layer 1'}),
  Object.freeze({canonicalId:'QI-CRYPTO-ETH',symbol:'ETH',name:'Ethereum',category:'Smart-contract platforms'}),
  Object.freeze({canonicalId:'QI-CRYPTO-SOL',symbol:'SOL',name:'Solana',category:'Smart-contract platforms'}),
  Object.freeze({canonicalId:'QI-CRYPTO-XRP',symbol:'XRP',name:'XRP',category:'Payments'}),
  Object.freeze({canonicalId:'QI-CRYPTO-HYPE',symbol:'HYPE',name:'Hyperliquid',category:'Exchange ecosystems'}),
  Object.freeze({canonicalId:'QI-CRYPTO-DOGE',symbol:'DOGE',name:'Dogecoin',category:'Meme assets'})
]);

export const PUBLIC_CRYPTO_ASSET_MAP=new Map(PUBLIC_CRYPTO_ASSETS.flatMap((asset)=>[
  [asset.canonicalId.toUpperCase(),asset],
  [asset.symbol.toUpperCase(),asset]
]));
