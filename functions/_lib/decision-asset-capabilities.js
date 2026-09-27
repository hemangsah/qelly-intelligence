import {PUBLIC_CRYPTO_ASSETS} from './public-market-assets.js';
import {providerCatalog} from './providers.js';

export const DECISION_ASSET_SYMBOLS=Object.freeze(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
export const DECISION_ASSET_SET=new Set(DECISION_ASSET_SYMBOLS);
export const DECISION_PICKER_INTERVALS=Object.freeze(['1m','5m','15m','30m','1h','4h','1d']);

const HYPERLIQUID_DOCS='https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint';
const providerById=(id)=>providerCatalog().find((provider)=>provider.id===id)||null;
const unavailable=(id,label,reason)=>Object.freeze({id,label,assetClass:id,state:'UNAVAILABLE',selectable:false,provider:null,assets:Object.freeze([]),reason});
const providerProjection=(provider)=>provider?{
  id:provider.id,
  enabled:Boolean(provider.enabled),
  capabilities:[...(provider.capabilities||[])],
  termsState:provider.termsState||null,
  reason:provider.reason||null,
  termsUrl:provider.termsUrl||null
}:null;

export const decisionAssetCapabilities=()=>{
  const ecb=providerById('ecb');
  const cryptoBySymbol=new Map(PUBLIC_CRYPTO_ASSETS.map((asset)=>[asset.symbol,asset]));
  const cryptoAssets=DECISION_ASSET_SYMBOLS.map((symbol)=>cryptoBySymbol.get(symbol)).filter(Boolean).map((asset)=>({
    canonicalId:asset.canonicalId,
    symbol:asset.symbol,
    name:asset.name,
    assetClass:'crypto',
    category:asset.category,
    region:'global',
    venue:'Hyperliquid',
    marketStatus:'continuous',
    providerStatus:'SUPPORTED',
    supportedTimeframes:[...DECISION_PICKER_INTERVALS],
    capabilities:['candles','liquidity','derivatives','historical-funding','cross-asset-context'],
    selectable:true
  }));
  const groups=[
    {
      id:'crypto',
      label:'Crypto',
      assetClass:'crypto',
      state:'SUPPORTED',
      selectable:true,
      provider:{
        id:'hyperliquid-public',
        name:'Hyperliquid',
        state:'CURRENT_DECISION_SOURCE',
        sourceUrl:HYPERLIQUID_DOCS,
        coverageBoundary:'This is the existing public source used by QELLY Decision Intelligence; the picker does not introduce a new provider.'
      },
      assets:cryptoAssets,
      reason:null
    },
    {
      id:'forex',
      label:'Forex',
      assetClass:'fx',
      state:ecb?.enabled&&ecb?.capabilities?.includes('fx-reference-rates')?'REFERENCE_ONLY':'UNAVAILABLE',
      selectable:false,
      provider:providerProjection(ecb),
      assets:[],
      reason:ecb?.enabled?'ECB reference rates are available for contextual reference only. Decision-grade intraday candles and the full evidence stack are not connected, so FX pairs are not selectable.':'No governed FX source is enabled for Decision Intelligence.'
    },
    unavailable('indian-indices','Indian indices','No governed Decision-grade index candle/evidence provider is connected.'),
    unavailable('indian-equities','Indian stocks','No licensed Decision-grade Indian equity candle/evidence provider is connected.'),
    unavailable('global-equities','Global stocks','No licensed Decision-grade global equity candle/evidence provider is connected.'),
    unavailable('metals','Metals','No governed Decision-grade metals candle/evidence provider is connected.'),
    unavailable('commodities','Commodities','No governed Decision-grade commodities candle/evidence provider is connected.'),
    unavailable('global-indices','Global indices','No governed Decision-grade global-index candle/evidence provider is connected.')
  ];
  return {
    schemaVersion:'qelly.decision-asset-capabilities/1.0.0',
    truthState:'AUDIT',
    authority:'decision-runtime-capability-contract',
    supportedAssetCount:cryptoAssets.length,
    selectableSymbols:[...DECISION_ASSET_SYMBOLS],
    groups,
    guardrails:{
      readOnly:true,
      execution:false,
      unsupportedAssetsSelectable:false,
      referenceDataDoesNotImplyDecisionSupport:true,
      providerRightsBoundariesPreserved:true
    }
  };
};

export const __decisionAssetCapabilitiesTest=Object.freeze({providerProjection});
