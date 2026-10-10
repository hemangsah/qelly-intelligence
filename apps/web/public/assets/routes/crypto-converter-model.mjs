// Reference conversion only. Provider observations are never executable quotes.
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const usable=state=>/^(live(?:_provider)?|cached(?:_provider|-reference)?|current-reference)$/.test(String(state||'').toLowerCase());
export function referenceCatalog(network={},fx={},now=Date.now()){
  const entries=[],source=network?.sources?.['alternative-me'];
  const rows=Array.isArray(source?.data?.assets)?source.data.assets:[];
  const symbols=new Map();
  for(const row of rows){const symbol=String(row.symbol||'').toUpperCase();if(/^[A-Z0-9]{1,15}$/.test(symbol))symbols.set(symbol,(symbols.get(symbol)||0)+1);}
  for(const row of rows){
    const symbol=String(row.symbol||'').toUpperCase(),at=Date.parse(row.updatedAt);
    if(symbols.get(symbol)!==1)continue;
    const fresh=Number.isFinite(at)&&now-at>=-60000&&now-at<=30*60000;
    entries.push({id:'crypto:'+String(row.id),code:symbol,name:String(row.name||symbol),kind:'crypto',usd:usable(source.truthState)&&fresh&&positive(row.priceUsd)?row.priceUsd:null,observed:row.updatedAt||null,provider:'Alternative.me',truthState:source.truthState||'unavailable',reason:!usable(source.truthState)?'Source unavailable':!fresh?'Price timestamp is missing, stale or in the future':!positive(row.priceUsd)?'Positive USD price unavailable':null});
  }
  const date=fx?.observation?.observedDate,at=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)?Date.parse(date+'T00:00:00Z'):NaN;
  const validDate=Number.isFinite(at)&&new Date(at).toISOString().slice(0,10)===date&&now-at>=0&&now-at<=7*86400000;
  const currencies=Array.isArray(fx?.currencies)?fx.currencies:[],usd=currencies.find(x=>x.code==='USD')?.ratePerEur;
  const fxReady=fx.state==='reference-workbench-available'&&usable(fx?.observation?.truthState)&&validDate&&positive(usd);
  const fxReason=fx.state!=='reference-workbench-available'?'ECB observation unavailable':!usable(fx?.observation?.truthState)?'ECB source status does not qualify: '+String(fx?.observation?.truthState||'unavailable'):!validDate?'ECB reference date is invalid, in the future or older than seven days':!positive(usd)?'ECB USD reference denominator unavailable':null;
  const codes=new Set();
  for(const row of currencies){if(!/^[A-Z]{3}$/.test(row.code)||codes.has(row.code))continue;codes.add(row.code);entries.push({id:'fiat:'+row.code,code:row.code,name:String(row.label||row.code),kind:'fiat',usd:fxReady&&positive(row.ratePerEur)?usd/row.ratePerEur:null,observed:date||null,provider:'European Central Bank',truthState:fx?.observation?.truthState||'unavailable',reason:fxReady&&positive(row.ratePerEur)?null:fxReason||'Positive reference rate unavailable'});}
  if(!entries.some(x=>x.kind==='crypto'&&x.code==='ONDO'))entries.push({id:'unsupported:ONDO',code:'ONDO',name:'Ondo — source coverage unavailable',kind:'crypto',usd:null,observed:null,provider:'No governed observation',reason:'ONDO is not supplied by the current governed feed. No price substituted.'});
  return entries;
}
export function convertReference(entries,fromId,toId,rawAmount){
  if(typeof rawAmount!=='string'||!rawAmount.trim())return{ok:false,reason:'Enter an amount.'};
  const amount=Number(rawAmount),from=entries.find(x=>x.id===fromId),to=entries.find(x=>x.id===toId);
  if(!Number.isFinite(amount)||amount<0||amount>1e15)return{ok:false,reason:'Use a finite amount from zero to 1,000,000,000,000,000.'};
  if(!from||!to||!positive(from.usd)||!positive(to.usd))return{ok:false,reason:from?.usd==null?from?.reason||'Source asset unavailable':to?.reason||'Target asset unavailable'};
  const rate=from.usd/to.usd,result=amount*rate;
  if(!Number.isFinite(result)||!positive(rate)||(amount>0&&result===0))return{ok:false,reason:'Conversion exceeds safe numeric precision.'};
  return{ok:true,amount,rate,result,from,to,mixedCadence:from.kind!==to.kind};
}
