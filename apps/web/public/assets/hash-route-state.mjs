const ROUTE_ALIASES=Object.freeze({
  'quant-calculator':'calculator-center'
});

export function parseHashRoute(hash,{fallback='market'}={}){
  const raw=String(hash??'').replace(/^#\/?/,'')||fallback;
  const queryIndex=raw.indexOf('?');
  const pathPart=queryIndex>=0?raw.slice(0,queryIndex):raw;
  const queryText=queryIndex>=0?raw.slice(queryIndex+1):'';
  const segments=pathPart.split('/').filter(Boolean);
  const parsedRoute=decodeURIComponent(segments.shift()??fallback);
  const parsedAsset=segments.length?decodeURIComponent(segments.join('/')):null;
  const query=new URLSearchParams(queryText);
  const legacyVerify=parsedRoute==='methodology'&&parsedAsset==='verify';
  const legacyMethodology=parsedRoute==='evidence-methodology'||(parsedRoute==='market'&&query.get('view')==='evidence-methodology');
  const legacyMarketVerify=parsedRoute==='market'&&query.get('view')==='qelly-verify';
  const legacyDecisionMaker=parsedRoute==='market'&&query.get('view')==='decision-maker';
  const verifyAlias=legacyVerify||legacyMethodology||legacyMarketVerify;
  const route=verifyAlias?'qelly-verify':legacyDecisionMaker?'decision-provenance':(ROUTE_ALIASES[parsedRoute]??parsedRoute);
  const asset=verifyAlias||legacyDecisionMaker?null:parsedAsset;
  const clearQuery=()=>{for(const key of [...query.keys()])query.delete(key);};
  if(legacyMethodology){clearQuery();query.set('view','methodology');}
  if(legacyVerify||legacyMarketVerify||legacyDecisionMaker)clearQuery();
  return {route,asset,query,queryText:query.toString()};
}

export function buildHashRoute(route,asset=null,query=null){
  const encodedRoute=encodeURIComponent(String(route));
  const encodedAsset=asset==null?'':`/${String(asset).split('/').map(encodeURIComponent).join('/')}`;
  const params=query instanceof URLSearchParams?query:new URLSearchParams(query??undefined);
  const suffix=params.toString()?`?${params}`:'';
  return `#/${encodedRoute}${encodedAsset}${suffix}`;
}
