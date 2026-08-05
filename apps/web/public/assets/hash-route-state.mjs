export function parseHashRoute(hash,{fallback='market'}={}){
  const raw=String(hash??'').replace(/^#\/?/,'')||fallback;
  const queryIndex=raw.indexOf('?');
  const pathPart=queryIndex>=0?raw.slice(0,queryIndex):raw;
  const queryText=queryIndex>=0?raw.slice(queryIndex+1):'';
  const segments=pathPart.split('/').filter(Boolean);
  const route=decodeURIComponent(segments.shift()??fallback);
  const asset=segments.length?decodeURIComponent(segments.join('/')):null;
  return {route,asset,query:new URLSearchParams(queryText),queryText};
}

export function buildHashRoute(route,asset=null,query=null){
  const encodedRoute=encodeURIComponent(String(route));
  const encodedAsset=asset==null?'':`/${String(asset).split('/').map(encodeURIComponent).join('/')}`;
  const params=query instanceof URLSearchParams?query:new URLSearchParams(query??undefined);
  const suffix=params.toString()?`?${params}`:'';
  return `#/${encodedRoute}${encodedAsset}${suffix}`;
}
