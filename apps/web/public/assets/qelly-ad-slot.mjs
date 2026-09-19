const STYLESHEET=new URL('./qelly-ad-slot.css',import.meta.url).href;
const installStyles=()=>{if(document.querySelector('link[data-qelly-ad-slot]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=STYLESHEET;link.dataset.qellyAdSlot='v1';document.head.append(link);};
const config=()=>{const runtime=globalThis.__QELLY_PUBLIC_CONFIG__?.ads||{};const meta=document.querySelector('meta[name="qelly-ad-client"]')?.content||'';return {client:String(runtime.client||meta).trim(),slots:runtime.slots||{}};};
const hasConsent=()=>{try{return JSON.parse(localStorage.getItem('qelly-consent-v1')||'{}')?.advertising===true;}catch{return false;}};
const emit=(name,detail)=>window.dispatchEvent(new CustomEvent('qelly:ad',{detail:{name,...detail}}));
export const adSlot=(placement,{format='horizontal',label='Sponsored'}={})=>'<aside class="q-ad-slot q-ad-slot--'+format+'" data-qelly-ad-slot="'+placement+'" aria-label="'+label+'"><span>'+label+'</span><div data-qelly-ad-stage><strong>Independent research, sustainably supported</strong><small>Advertising space is reserved without shifting the page. Personalized ads stay off until consent.</small></div></aside>';
export function mountAdSlots(root=document){
  installStyles();const settings=config();
  root.querySelectorAll('[data-qelly-ad-slot]').forEach(slot=>{if(slot.dataset.qellyAdMounted)return;slot.dataset.qellyAdMounted='true';const placement=slot.dataset.qellyAdSlot,stage=slot.querySelector('[data-qelly-ad-stage]'),id=settings.slots?.[placement];
    if(!settings.client||!id){slot.dataset.adState='reserved';emit('reserved',{placement});return;}
    if(!hasConsent()){slot.dataset.adState='consent-required';stage.innerHTML='<strong>Sponsored placement</strong><small>Advertising is paused until optional advertising consent is enabled.</small>';emit('consent_required',{placement});return;}
    const load=()=>{if(!document.querySelector('script[data-qelly-ad-network]')){const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(settings.client);script.dataset.qellyAdNetwork='adsense';document.head.append(script);}stage.innerHTML='<ins class="adsbygoogle" style="display:block" data-ad-client="'+settings.client+'" data-ad-slot="'+id+'" data-ad-format="auto" data-full-width-responsive="true"></ins>';try{(globalThis.adsbygoogle=globalThis.adsbygoogle||[]).push({});slot.dataset.adState='requested';emit('requested',{placement});}catch{slot.dataset.adState='unavailable';}};
    if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();load();}},{rootMargin:'300px'});observer.observe(slot);}else load();
  });
}
