const root=document.querySelector('[data-qelly-asset-research]');
const assetId=root?.dataset?.qellyAssetResearch||document.body?.dataset?.qellyAssetResearch||'';
const one=(selector)=>document.querySelector(selector);
const set=(selector,value)=>{const node=one(selector);if(node)node.textContent=String(value??'—');};
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const money=(value,currency='USD')=>value==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:value>100?2:6}).format(value);
const pct=value=>value==null?'—':${value>=0?'+':''}${value.toFixed(2)}%;
const observed=value=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'Not supplied':date.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});};
const stateClass=value=>['live','delayed','stale'].includes(String(value||'').toLowerCase())?String(value).toLowerCase():'unavailable';

async function load(){
  if(!assetId)return;
  const status=one('[data-status]');
  try{
    const response=await fetch(${/api/v1/public/markets/assets/${encodeURIComponent(assetId)}},{credentials:'same-origin',headers:{Accept:'application/json'}});
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(payload?.error?.message||${Current market observation unavailable (${response.status})});
    const price=finite(payload?.price),change=finite(payload?.change24h),high=finite(payload?.high24h),low=finite(payload?.low24h);
    const range=price>0&&high!=null&&low!=null?(high-low)/price*100:null;
    const freshness=String(payload?.source?.freshness||'unavailable').toLowerCase();
    set('[data-price]',money(price,payload?.currency||'USD'));
    set('[data-change]',pct(change));
    set('[data-high]',money(high,payload?.currency||'USD'));
    set('[data-low]',money(low,payload?.currency||'USD'));
    set('[data-range]',range==null?'—':${${range.toFixed(2)}%});
    set('[data-observed]',observed(payload?.source?.observationTime));
    set('[data-provider]',payload?.source?.providerName||'Provider not supplied');
    set('[data-freshness]',${${freshness} · ${payload?.source?.qualityState||'quality state unavailable'}});
    const truth=one('[data-truth-state]');
    if(truth){truth.textContent=String(payload?.source?.qualityState||freshness).toUpperCase();truth.className=${qar-state is-${stateClass(freshness)}};}
    if(status)status.textContent='Current provider-derived observation loaded. Values can change after the displayed observation time.';
    document.dispatchEvent(new CustomEvent('qelly:product-event',{detail:{name:'route_view',properties:{route:'asset-research',feature:'asset-research',action:'live-observation'}}}));
  }catch(error){
    set('[data-price]','Unavailable');set('[data-change]','Unavailable');set('[data-high]','Unavailable');set('[data-low]','Unavailable');set('[data-range]','Unavailable');set('[data-observed]','Unavailable');set('[data-provider]','Current provider observation unavailable');set('[data-freshness]','UNAVAILABLE · no fabricated fallback');
    const truth=one('[data-truth-state]');if(truth){truth.textContent='UNAVAILABLE';truth.className='qar-state is-unavailable';}
    if(status)status.textContent=${${String(error?.message||'Current market observation unavailable.')} No substitute price, trend or market narrative has been generated.};
  }
}
void load();
