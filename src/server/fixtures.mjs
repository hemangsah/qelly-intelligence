const observedAt = '2026-07-24T08:30:00.000Z';
const receivedAt = '2026-07-24T08:30:01.120Z';

function display(canonicalEntityId, value, unit, source, freshnessClass = 'simulated', confidence = 0.93, qualityFlags = ['deterministic-fixture']) {
  return { canonicalEntityId, value: value == null ? null : String(value), unit, currency: unit === 'USD' ? 'USD' : null, provider: 'qelly-fixture', source, venue: null, observedAt, receivedAt, freshnessClass, confidence, qualityFlags, entitlementClass: 'development-fixture', methodologyVersion: null };
}

export const instruments = [
  { canonicalId:'QI-CRYPTO-BTC', assetClass:'crypto', name:'Bitcoin', symbol:'BTC', symbols:[{symbol:'BTC',venue:'QELLY-GLOBAL',validFrom:'2009-01-03',validTo:null}], currency:'USD', precision:8, status:'active', relationships:[], jurisdiction:'Global', sourceLineage:['Qelly deterministic instrument fixture'] },
  { canonicalId:'QI-CRYPTO-ETH', assetClass:'crypto', name:'Ethereum', symbol:'ETH', symbols:[{symbol:'ETH',venue:'QELLY-GLOBAL',validFrom:'2015-07-30',validTo:null}], currency:'USD', precision:8, status:'active', relationships:[], jurisdiction:'Global', sourceLineage:['Qelly deterministic instrument fixture'] },
  { canonicalId:'QI-EQUITY-AAPL', assetClass:'equity', name:'Apple Inc.', symbol:'AAPL', symbols:[{symbol:'AAPL',venue:'XNAS',validFrom:'1980-12-12',validTo:null}], currency:'USD', precision:4, status:'active', relationships:[{type:'issuer',targetCanonicalId:'QI-ISSUER-APPLE'}], jurisdiction:'US', sourceLineage:['Qelly deterministic instrument fixture'] },
  { canonicalId:'QI-EQUITY-NVDA', assetClass:'equity', name:'NVIDIA Corporation', symbol:'NVDA', symbols:[{symbol:'NVDA',venue:'XNAS',validFrom:'1999-01-22',validTo:null}], currency:'USD', precision:4, status:'active', relationships:[{type:'issuer',targetCanonicalId:'QI-ISSUER-NVIDIA'}], jurisdiction:'US', sourceLineage:['Qelly deterministic instrument fixture'] },
  { canonicalId:'QI-FX-USDINR', assetClass:'fx', name:'US Dollar / Indian Rupee', symbol:'USDINR', symbols:[{symbol:'USDINR',venue:'QELLY-REFERENCE',validFrom:'1993-03-01',validTo:null}], currency:'INR', precision:6, status:'active', relationships:[{type:'pair-base',targetCanonicalId:'QI-CURRENCY-USD'},{type:'pair-quote',targetCanonicalId:'QI-CURRENCY-INR'}], jurisdiction:'Global', sourceLineage:['Qelly deterministic instrument fixture'] },
  { canonicalId:'QI-COMMODITY-GOLD', assetClass:'commodity', name:'Gold Spot', symbol:'XAUUSD', symbols:[{symbol:'XAUUSD',venue:'QELLY-REFERENCE',validFrom:'1971-08-15',validTo:null}], currency:'USD', precision:4, status:'active', relationships:[], jurisdiction:'Global', sourceLineage:['Qelly deterministic instrument fixture'] },
  { canonicalId:'QI-INDEX-SPX', assetClass:'index', name:'S&P 500 Index', symbol:'SPX', symbols:[{symbol:'SPX',venue:'QELLY-REFERENCE',validFrom:'1957-03-04',validTo:null}], currency:'USD', precision:4, status:'active', relationships:[], jurisdiction:'US', sourceLineage:['Qelly deterministic instrument fixture'] },
  { canonicalId:'QI-FUND-QQQ', assetClass:'fund', name:'Invesco QQQ Trust', symbol:'QQQ', symbols:[{symbol:'QQQ',venue:'XNAS',validFrom:'1999-03-10',validTo:null}], currency:'USD', precision:4, status:'active', relationships:[{type:'underlying',targetCanonicalId:'QI-INDEX-NDX'}], jurisdiction:'US', sourceLineage:['Qelly deterministic instrument fixture'] }
];

const prices = {
 'QI-CRYPTO-BTC': { price: 118420.32, change: 2.84, marketCap: 2358000000000, volume: 67200000000, freshness:'simulated', source:'Qelly deterministic cross-asset fixture' },
 'QI-CRYPTO-ETH': { price: 3821.44, change: 1.62, marketCap: 461000000000, volume: 28400000000, freshness:'simulated', source:'Qelly deterministic cross-asset fixture' },
 'QI-EQUITY-AAPL': { price: 224.91, change: -0.34, marketCap: 3380000000000, volume: 51100000, freshness:'delayed', source:'Qelly delayed equity fixture' },
 'QI-EQUITY-NVDA': { price: 176.28, change: 3.15, marketCap: 4300000000000, volume: 189000000, freshness:'delayed', source:'Qelly delayed equity fixture' },
 'QI-FX-USDINR': { price: 86.42, change: 0.08, marketCap: null, volume: null, freshness:'cached', source:'Qelly reference FX fixture' },
 'QI-COMMODITY-GOLD': { price: 3388.20, change: 0.77, marketCap: null, volume: null, freshness:'cached', source:'Qelly commodity reference fixture' },
 'QI-INDEX-SPX': { price: 6382.71, change: 0.44, marketCap: null, volume: null, freshness:'delayed', source:'Qelly delayed index fixture' },
 'QI-FUND-QQQ': { price: 586.35, change: 0.91, marketCap: 360000000000, volume: 42800000, freshness:'delayed', source:'Qelly delayed fund fixture' }
};

export const marketRows = instruments.map((instrument, index) => {
  const quote = prices[instrument.canonicalId];
  return {
    id: instrument.canonicalId,
    rank: index + 1,
    symbol: instrument.symbol,
    name: instrument.name,
    assetClass: instrument.assetClass,
    price: quote.price,
    currency: instrument.currency,
    change24h: quote.change,
    marketCap: quote.marketCap,
    volume24h: quote.volume,
    source: quote.source,
    freshnessClass: quote.freshness,
    observedLabel: quote.freshness === 'delayed' ? '15 min delayed' : quote.freshness === 'cached' ? 'cached reference' : 'deterministic simulation',
    observedAt,
    receivedAt,
    confidence: quote.freshness === 'simulated' ? 0.91 : 0.88
  };
});

export const marketOverview = {
  mode: 'deterministic-fixture',
  truthBoundary: 'All values are explicitly simulated, delayed or cached fixture data. No live provider call was performed.',
  kpis: [
    { label:'Tracked market value', value:display('QI-METRIC-TRACKED-VALUE','8.63','USD-trillion','Qelly cross-asset fixture','simulated',0.87) },
    { label:'Risk appetite', value:display('QI-METRIC-RISK-APPETITE','64','index','Qelly methodology fixture','simulated',0.78,['deterministic-fixture','methodology-demo']) },
    { label:'Advancers', value:display('QI-METRIC-ADVANCERS','62','percent','Qelly breadth fixture','simulated',0.85) },
    { label:'Provider coverage', value:display('QI-METRIC-PROVIDER-COVERAGE','83','percent','Qelly provider registry fixture','cached',0.96) }
  ],
  rows: marketRows,
  sectors: [
    { name:'Digital assets', value:2.3, tone:'positive' },{ name:'AI semiconductors', value:1.8, tone:'positive' },{ name:'US mega-cap', value:0.4, tone:'positive' },{ name:'Precious metals', value:0.8, tone:'positive' },{ name:'India FX', value:-0.1, tone:'negative' },{ name:'Rates', value:-0.3, tone:'negative' }
  ],
  macro: [
    { label:'US 10Y', value:'4.18%', state:'cached' },{ label:'DXY', value:'98.42', state:'delayed' },{ label:'USD/INR', value:'86.42', state:'cached' },{ label:'VIX', value:'16.8', state:'delayed' }
  ]
};

export const chartSeries = Array.from({ length: 64 }, (_, index) => ({
  label: `D${index + 1}`,
  value: Number((102 + index * 0.52 + Math.sin(index / 3.2) * 4.8 + Math.cos(index / 7) * 2.1).toFixed(2))
}));

export const providers = [
  { providerId:'qelly-fixture', displayName:'Qelly Deterministic Fixture', mode:'fixture', capabilities:['search','quote','timeseries','reference','news','filings','stream','mapping'], health:'healthy', entitlement:'development', credentialReference:null, quality:{latencyMs:2,confidence:.96,freshnessClass:'simulated'}, lastUpdatedAt:receivedAt },
  { providerId:'coingecko', displayName:'CoinGecko', mode:'disabled', capabilities:['search','quote','timeseries'], health:'disabled', entitlement:'public-read', credentialReference:null, quality:{latencyMs:0,confidence:0,freshnessClass:'unavailable'}, lastUpdatedAt:receivedAt },
  { providerId:'coinbase-public', displayName:'Coinbase Exchange Public', mode:'disabled', capabilities:['quote','stream'], health:'disabled', entitlement:'public-read', credentialReference:null, quality:{latencyMs:0,confidence:0,freshnessClass:'unavailable'}, lastUpdatedAt:receivedAt },
  { providerId:'kraken-public', displayName:'Kraken Public', mode:'disabled', capabilities:['quote','stream'], health:'disabled', entitlement:'public-read', credentialReference:null, quality:{latencyMs:0,confidence:0,freshnessClass:'unavailable'}, lastUpdatedAt:receivedAt },
  { providerId:'licensed-equities', displayName:'Licensed Equities Provider', mode:'planned', capabilities:['search','quote','timeseries','stream'], health:'planned', entitlement:'licensed-required', credentialReference:null, quality:{latencyMs:0,confidence:0,freshnessClass:'unavailable'}, lastUpdatedAt:receivedAt },
  { providerId:'openfigi', displayName:'OpenFIGI', mode:'disabled', capabilities:['mapping'], health:'disabled', entitlement:'public-read', credentialReference:null, quality:{latencyMs:0,confidence:0,freshnessClass:'unavailable'}, lastUpdatedAt:receivedAt }
];

export const watchlist = marketRows.slice(0, 6).map((row, index) => ({ ...row, group:index < 2 ? 'Digital core' : index < 4 ? 'US growth' : 'Macro hedges', note:index === 0 ? 'Watch institutional flow and volatility regime.' : '' }));

export function assetDossier(idOrSymbol) {
  const instrument = instruments.find((item) => item.canonicalId === idOrSymbol || item.symbol.toLowerCase() === String(idOrSymbol).toLowerCase()) ?? instruments[0];
  const quote = prices[instrument.canonicalId];
  return {
    instrument,
    quote: display(instrument.canonicalId, quote.price, instrument.currency, quote.source, quote.freshness, quote.freshness === 'simulated' ? .91 : .88),
    change24h: quote.change,
    stats: [
      { label:'24h volume', value:quote.volume == null ? null : String(quote.volume), unit:instrument.currency },
      { label:'Market value', value:quote.marketCap == null ? null : String(quote.marketCap), unit:instrument.currency },
      { label:'Data confidence', value:String(Math.round((quote.freshness === 'simulated' ? .91 : .88) * 100)), unit:'percent' },
      { label:'Instrument precision', value:String(instrument.precision), unit:'decimals' }
    ],
    chart:{ series:chartSeries, metadata:{ source:quote.source, observedAt, receivedAt, freshnessClass:quote.freshness, confidence:quote.freshness === 'simulated' ? .91 : .88 } },
    events:[
      { at:'2026-07-24T06:30:00Z', title:'Fixture market snapshot refreshed', type:'data' },
      { at:'2026-07-23T18:00:00Z', title:'Methodology review marker', type:'methodology' },
      { at:'2026-07-22T12:00:00Z', title:'Source entitlement remains development-only', type:'entitlement' }
    ]
  };
}

export const identityContext = {
  mode:'simulated-contract', userId:'user-demo-hemang', organizationId:'org-qelly-labs', workspaceId:'ws-institutional-research', roles:['analyst','workspace-admin'], attributes:{ environment:'paper', dataEntitlement:'development-fixture', region:'IN', riskTier:'standard' }, session:{ id:'session-local-demo', assuranceLevel:'AAL1', deviceTrusted:false, stepUpRequired:false }, productionIdentityEnabled:false
};
