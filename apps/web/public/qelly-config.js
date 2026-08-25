const qellyPublicBase=new URL('./',location.href).href;
window.__QELLY_CONFIG__=Object.freeze({
  apiBaseUrl:'',
  deploymentStage:'static-fallback',
  productMode:'QELLY',
  publicBaseUrl:qellyPublicBase,
  publicSiteUrl:location.origin,
  releaseSha:'runtime-injected-by-release-workflow',
  staticVisualPreview:true,
  capabilities:Object.freeze({
    deterministicLocal:true,
    authentication:false,
    cloudSync:false,
    protectedWrites:false,
    liveProviders:false,
    offlineShell:true
  }),
  externalAuthorization:Object.freeze({
    cloudflare:'required',
    supabase:'required'
  })
});

(()=>{
  const config=window.__QELLY_CONFIG__;
  const ensureMeta=(selector,attributes)=>{
    let node=document.head.querySelector(selector);
    if(!node){node=document.createElement(attributes.tag||'meta');document.head.append(node);}
    for(const [name,value] of Object.entries(attributes))if(name!=='tag')node.setAttribute(name,value);
  };
  ensureMeta('link[rel="canonical"]',{tag:'link',rel:'canonical',href:config.publicBaseUrl});
  ensureMeta('meta[property="og:type"]',{property:'og:type',content:'website'});
  ensureMeta('meta[property="og:title"]',{property:'og:title',content:'Qelly Intelligence · Verifiable Market Intelligence'});
  ensureMeta('meta[property="og:description"]',{property:'og:description',content:'Evidence-backed market observations, 151 deterministic formulas, 54 indicators and local-first saved calculations.'});
  ensureMeta('meta[property="og:url"]',{property:'og:url',content:config.publicBaseUrl});
  ensureMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary'});
  ensureMeta('meta[name="robots"]',{name:'robots',content:'index,follow,max-image-preview:large'});
  if(!document.querySelector('link[href$="qelly-public-runtime.css"]')){const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='./assets/qelly-public-runtime.css';document.head.append(stylesheet);}
  if(!document.querySelector('script[src$="qelly-public-runtime.mjs"]')){const script=document.createElement('script');script.type='module';script.src='./assets/qelly-public-runtime.mjs';document.head.append(script);}
})();
