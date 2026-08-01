window.__QELLY_CONFIG__=Object.freeze({
  apiBaseUrl:'',
  deploymentStage:'github-pages-public-beta-fallback',
  productMode:'QELLY GLOBAL PUBLIC BETA',
  publicBaseUrl:'https://hemangsah.github.io/qelly-intelligence/',
  releaseSha:'runtime-injected-by-release-workflow',
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
    supabase:'required',
    linkedinPublishing:'required'
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
  ensureMeta('meta[property="og:title"]',{property:'og:title',content:'Qelly Global Public Beta · Verifiable Market Intelligence'});
  ensureMeta('meta[property="og:description"]',{property:'og:description',content:'151 deterministic formulas, 54 indicators and local-first saved calculations with explicit data provenance and safe degraded modes.'});
  ensureMeta('meta[property="og:url"]',{property:'og:url',content:config.publicBaseUrl});
  ensureMeta('meta[property="og:image"]',{property:'og:image',content:new URL('social/qelly-social-preview.png',config.publicBaseUrl).href});
  ensureMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary_large_image'});
  ensureMeta('meta[name="robots"]',{name:'robots',content:'index,follow,max-image-preview:large'});
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='./assets/prompt2c-public-beta.css';document.head.append(stylesheet);
  const script=document.createElement('script');script.type='module';script.src='./assets/prompt2c-public-beta.mjs';document.head.append(script);
})();
