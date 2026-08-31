const CURRENCY_LABELS=Object.freeze({AUD:'Australian dollar',BRL:'Brazilian real',CAD:'Canadian dollar',CHF:'Swiss franc',CNY:'Chinese yuan',CZK:'Czech koruna',DKK:'Danish krone',EUR:'Euro',GBP:'Pound sterling',HKD:'Hong Kong dollar',HUF:'Hungarian forint',IDR:'Indonesian rupiah',ILS:'Israeli new shekel',INR:'Indian rupee',ISK:'Icelandic krona',JPY:'Japanese yen',KRW:'South Korean won',MXN:'Mexican peso',MYR:'Malaysian ringgit',NOK:'Norwegian krone',NZD:'New Zealand dollar',PHP:'Philippine peso',PLN:'Polish zloty',RON:'Romanian leu',SEK:'Swedish krona',SGD:'Singapore dollar',THB:'Thai baht',TRY:'Turkish lira',USD:'US dollar',ZAR:'South African rand'});
const OFFICIAL_SOURCE='https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html';

const finitePositive=(value)=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
const normalizedTruth=(value)=>{
  const state=String(value||'unavailable').toLowerCase();
  if(state.includes('cached'))return 'cached-reference';
  if(state.includes('delayed')||state.includes('stale'))return 'delayed-reference';
  if(state.includes('live'))return 'current-reference';
  return 'unavailable';
};

export function buildPublicConverter(provider={}){
  const rawRates=provider?.data?.rates&&typeof provider.data.rates==='object'?provider.data.rates:{};
  const normalized={EUR:1};
  for(const [rawCode,rawRate] of Object.entries(rawRates)){
    const code=String(rawCode||'').toUpperCase();
    const rate=finitePositive(rawRate);
    if(/^[A-Z]{3}$/.test(code)&&rate!=null)normalized[code]=rate;
  }
  const currencies=Object.entries(normalized).sort(([a],[b])=>a.localeCompare(b)).map(([code,ratePerEur])=>({code,label:CURRENCY_LABELS[code]||code,ratePerEur}));
  const available=currencies.length>=2&&provider?.data!=null;
  const presetPairs=[['USD','INR','Everyday USD to INR reference'],['EUR','USD','ECB base to US dollar'],['GBP','JPY','Sterling to yen cross-rate'],['AUD','NZD','Australasian cross-rate']].filter(([from,to])=>normalized[from]&&normalized[to]).map(([from,to,label])=>({from,to,label}));
  return {
    version:'governed-fx-converter-v3',
    state:available?'reference-workbench-available':'unavailable',
    job:'Translate an amount on one official FX reference observation, then separate the mid-reference result from user-declared conversion costs.',
    summary:{currenciesAvailable:available?currencies.length:0,routesAvailable:available?currencies.length*(currencies.length-1):0,base:'EUR',calculatedQuotes:0},
    observation:{provider:'ecb-reference-rates',providerName:'European Central Bank',truthState:available?normalizedTruth(provider.truthState):'unavailable',observedAt:available?(provider.observationTime||provider.observedAt||null):null,ingestedAt:available?(provider.ingestionTime||provider.ingestedAt||null):null,freshness:available?(provider.freshness||'daily-working-day-reference'):'unavailable',quality:available?(provider.quality||'official-central-bank-reference'):'unavailable',attribution:provider.attribution||'European Central Bank euro foreign exchange reference rates',license:provider.license||null,sourceUrl:OFFICIAL_SOURCE},
    currencies:available?currencies:[],
    presetPairs,
    method:{version:'FX Reference Conversion Protocol 1.0',formula:'amount ÷ source-per-EUR × target-per-EUR',costOrder:['reference result','declared spread','declared fee','fixed target-currency cost'],precisionOptions:[2,4,6],inputsRemainLocal:true},
    boundaries:{singleObservation:true,syntheticRates:false,tradableQuote:false,execution:false,transfer:false,cardRate:false,remittanceRate:false,forecast:false,userDeclaredCosts:true,missingProviderFailsClosed:true}
  };
}

export const __test=Object.freeze({finitePositive,normalizedTruth});
