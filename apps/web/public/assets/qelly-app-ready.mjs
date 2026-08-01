const root=document.documentElement;
const main=document.getElementById('main');
const config=window.__QELLY_CONFIG__||{};
let revealed=false;

const escapeHtml=(value)=>String(value??'').replace(/[&<>"']/g,(character)=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[character]));

const reveal=()=>{
  if(revealed)return;
  revealed=true;
  root.dataset.appReady='true';
};

const renderFailure=(diagnosticCode)=>{
  if(!main||main.childElementCount>0)return;
  const release=String(config.releaseSha||'unresolved');
  const support=String(config.supportUrl||'./support.html');
  main.innerHTML=`<section class="q-page q-startup-failure" aria-labelledby="qelly-startup-failure-title">
    <header class="q-page-head"><div><p class="q-eyebrow">Qelly Intelligence · safe startup state</p><h1 id="qelly-startup-failure-title">Qelly could not finish starting.</h1><p>The interface stopped before a usable route was available. No credential value has been displayed or logged.</p></div></header>
    <div class="q-empty-state q-error-state"><div><span aria-hidden="true">!</span><h2>Startup recovery required</h2><p>Diagnostic: <strong>${escapeHtml(diagnosticCode)}</strong><br>Release: <strong>${escapeHtml(release)}</strong></p><div class="q-page-actions"><button class="q-button q-button--primary" type="button" data-qelly-startup-retry>Retry Qelly</button><a class="q-button q-button--secondary" href="${escapeHtml(support)}">Support guidance</a></div></div></div>
  </section>`;
  main.querySelector('[data-qelly-startup-retry]')?.addEventListener('click',()=>location.reload());
};

const fail=(diagnosticCode)=>{
  renderFailure(diagnosticCode);
  reveal();
};

window.addEventListener('error',()=>fail('QELLY_STARTUP_SCRIPT_ERROR'),{capture:true});
window.addEventListener('unhandledrejection',()=>fail('QELLY_STARTUP_PROMISE_REJECTION'),{capture:true});

const routeReady=new Promise((resolve)=>{
  if(!main){resolve();return;}
  const complete=()=>main.childElementCount>0&&main.getAttribute('aria-busy')!=='true';
  if(complete()){resolve();return;}
  const observer=new MutationObserver(()=>{
    if(complete()){
      observer.disconnect();
      resolve();
    }
  });
  observer.observe(main,{attributes:true,childList:true,subtree:true,attributeFilter:['aria-busy']});
});

const startupTimeout=new Promise((resolve)=>{
  setTimeout(()=>{
    if(!main||main.childElementCount===0)renderFailure('QELLY_STARTUP_TIMEOUT');
    resolve();
  },12000);
});

try{
  await Promise.race([
    Promise.all([
      document.fonts?.load('400 1em "Qelly IBM Plex Sans"')??Promise.resolve(),
      routeReady
    ]),
    startupTimeout
  ]);
  await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}finally{
  reveal();
}
