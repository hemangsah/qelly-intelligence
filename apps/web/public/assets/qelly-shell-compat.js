import './qelly-verify-bootstrap.mjs';

(()=>{
  let installing=false;
  const compatibilityIds=['rail-toggle','command-button','state-selector','global-theme-selector','notification-button','theme-shortcut'];
  const providerIds=new Map([
    ['coinbase exchange','coinbase'],
    ['coinbase','coinbase'],
    ['european central bank','ecb'],
    ['ecb','ecb'],
    ['binance','binance']
  ]);
  const productionCorrections=`
    html[data-product-surface="production"] .q-worldclass-context{display:none!important}
    html[data-product-surface="production"] .q-panel{border-color:var(--q-product-line)!important;background:var(--q-product-surface)!important;color:var(--q-product-text)!important;box-shadow:var(--q-product-shadow)}
    html[data-product-surface="production"] .q-panel-head{border-color:var(--q-product-line)!important;background:linear-gradient(180deg,color-mix(in srgb,var(--q-product-surface-2) 72%,var(--q-product-surface)),var(--q-product-surface))!important;color:var(--q-product-text)!important}
    html[data-product-surface="production"] .q-panel-body{background:var(--q-product-surface)!important;color:var(--q-product-text)!important}
    html[data-product-surface="production"] .q-auth-secondary-link{justify-self:start!important;width:auto!important;min-height:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;color:var(--q-product-muted)!important;opacity:1!important;cursor:pointer}
    html[data-product-surface="production"] .skip-link{top:0;transform:translateY(-160%);transition:transform .16s ease}
    html[data-product-surface="production"] .skip-link:focus,html[data-product-surface="production"] .skip-link:focus-visible{top:12px;transform:translateY(0)}
    html[data-product-surface="production"] .q-formula-detail-page .q-calculator-layout{grid-template-columns:minmax(620px,1.25fr) minmax(360px,.75fr)!important;gap:clamp(18px,2.5vw,32px)!important;align-items:start}
    html[data-product-surface="production"] .q-formula-detail-page .q-calculator-layout>.q-panel{min-width:0}
    html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table{max-width:100%;overflow:auto;border:1px solid var(--q-product-line);border-radius:12px;background:color-mix(in srgb,var(--q-product-surface-2) 58%,var(--q-product-surface));scrollbar-gutter:stable}
    html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table table{width:100%;min-width:680px;table-layout:fixed;border-collapse:collapse}
    html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table th,html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table td{padding:12px 14px;border-bottom:1px solid var(--q-product-line);vertical-align:top;text-align:left;overflow-wrap:anywhere;word-break:normal}
    html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table thead th{background:var(--q-product-surface-2);color:var(--q-product-muted);font-size:12px;letter-spacing:.04em;text-transform:uppercase}
    html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody th{color:var(--q-product-text);font-weight:650}
    html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody tr:last-child>*{border-bottom:0}
    html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table :is(th,td):nth-child(1){width:22%}
    html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table :is(th,td):nth-child(2){width:13%}
    html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table :is(th,td):nth-child(3){width:18%}
    html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table :is(th,td):nth-child(4){width:47%}
    @media(max-width:1180px){
      html[data-product-surface="production"] .q-formula-detail-page .q-calculator-layout{display:flex!important;flex-direction:column!important;grid-template-columns:none!important;gap:16px!important;height:auto!important;min-height:0!important;overflow:visible!important}
      html[data-product-surface="production"] .q-formula-detail-page .q-calculator-layout>.q-panel{position:static!important;inset:auto!important;display:block!important;width:100%!important;max-width:none!important;margin:0!important;transform:none!important;visibility:visible!important;opacity:1!important;float:none!important}
      html[data-product-surface="production"] .q-formula-detail-page .q-calculator-layout>.q-panel+.q-panel{margin-top:0!important}
    }
    @media(max-width:560px){
      html[data-product-surface="production"] .q-product-system{display:none!important}
      html[data-product-surface="production"] .q-product-account{flex:1}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table{overflow:visible;scrollbar-gutter:auto;border:0;background:transparent}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table table,html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody{display:block;width:100%;min-width:0!important}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table thead{display:none}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody{display:grid;gap:10px}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;border:1px solid var(--q-product-line);border-radius:11px;background:color-mix(in srgb,var(--q-product-surface-2) 62%,var(--q-product-surface));padding:13px}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody :is(th,td){display:block;width:auto!important;border:0!important;padding:0!important;min-width:0}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody th{grid-column:1/-1;padding-bottom:9px!important;border-bottom:1px solid var(--q-product-line)!important;font-size:14px}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody td{color:var(--q-product-text);font-size:13px}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody td::before{display:block;margin-bottom:3px;color:var(--q-product-muted);font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody td:nth-child(2)::before{content:"Type"}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody td:nth-child(3)::before{content:"Unit"}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody td:nth-child(4){grid-column:1/-1;padding-top:9px!important;border-top:1px solid var(--q-product-line)!important;color:var(--q-product-muted)}
      html[data-product-surface="production"] .q-formula-detail-page .q-responsive-table tbody td:nth-child(4)::before{content:"Guidance"}
    }
  `;
  const conceal=(node)=>{
    if(!node)return node;
    node.hidden=true;
    node.setAttribute('aria-hidden','true');
    node.tabIndex=-1;
    return node;
  };
  const currentRoute=()=>location.hash.replace(/^#\/?/,'').split('?')[0].split('/')[0]||'market';
  const enforceProductBoundary=()=>{
    if(document.documentElement.dataset.productSurface!=='production')return;
    const main=document.getElementById('main');
    if(!main)return;
    for(const context of main.querySelectorAll(':scope > .q-worldclass-context')){
      conceal(context);
      context.style.setProperty('display','none','important');
      context.dataset.qellyProductBoundary='suppressed';
    }
    main.dataset.worldclassRoute=currentRoute();
    for(const card of main.querySelectorAll('.q-market-provider[data-provider]')){
      const canonical=providerIds.get(String(card.dataset.provider||'').trim().toLowerCase());
      if(canonical)card.dataset.provider=canonical;
    }
  };
  const installProductionCorrections=()=>{
    if(document.getElementById('qelly-production-corrections'))return;
    const style=document.createElement('style');
    style.id='qelly-production-corrections';
    style.textContent=productionCorrections;
    document.head.append(style);
  };
  const protectCommandBindings=()=>{
    const header=document.querySelector('.q-command-bar,.q-product-header');
    if(!header||header.dataset.qellyBindingProtection==='true')return;
    const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    if(!descriptor?.get||!descriptor?.set)return;
    Object.defineProperty(header,'innerHTML',{
      configurable:true,
      get(){return descriptor.get.call(this);},
      set(value){
        const fragment=document.createDocumentFragment();
        for(const id of compatibilityIds){
          const node=document.getElementById(id);
          if(node&&this.contains(node))fragment.append(node);
        }
        descriptor.set.call(this,value);
        if(fragment.childNodes.length){
          const host=conceal(document.createElement('div'));
          host.dataset.qellyShellCompatibility='preserved';
          host.append(fragment);
          this.prepend(host);
        }
      }
    });
    header.dataset.qellyBindingProtection='true';
  };
  const install=()=>{
    if(installing)return;
    installing=true;
    installProductionCorrections();
    const app=document.getElementById('app')||document.body;
    const ensure=(tag,id,parent=app)=>{
      let node=document.getElementById(id);
      if(node)return node;
      node=document.createElement(tag);
      node.id=id;
      conceal(node);
      parent.append(node);
      return node;
    };
    const shell=document.querySelector('.q-shell')||ensure('div','qelly-shell-compat-root');
    shell.classList.add('q-shell');
    const rail=conceal(ensure('aside','rail',shell));
    conceal(ensure('nav','primary-nav',rail));
    conceal(ensure('button','collapse-rail',rail)).type='button';
    conceal(ensure('button','rail-toggle')).type='button';
    conceal(ensure('button','close-context')).type='button';
    conceal(ensure('button','theme-shortcut')).type='button';
    conceal(ensure('button','notification-button')).type='button';
    conceal(ensure('button','command-button')).type='button';
    const state=conceal(ensure('select','state-selector'));
    if(!state.options.length){for(const value of ['default','loading','empty','partial','error','offline','stale','delayed','simulated'])state.add(new Option(value,value));}
    const themes=conceal(ensure('select','global-theme-selector'));
    if(!themes.options.length){for(const value of ['burgundy-command','porcelain-burgundy','burgundy-night','graphite-terminal','midnight-research','high-contrast'])themes.add(new Option(value,value));}
    conceal(ensure('div','context-content',conceal(ensure('aside','context-drawer',shell))));
    conceal(ensure('div','macro-strip'));
    conceal(ensure('nav','persona-ribbon'));
    conceal(ensure('div','context-shelf'));
    conceal(ensure('aside','edge-dock',shell));
    conceal(ensure('div','compare-tray'));
    conceal(ensure('nav','mobile-navigation'));
    ensure('main','main',shell).removeAttribute('aria-hidden');
    protectCommandBindings();
    enforceProductBoundary();
    document.querySelector('.q-global-strip')?.setAttribute('hidden','');
    document.querySelector('.q-product-account')?.setAttribute('aria-label','Open Qelly account');
    document.documentElement.dataset.shellCompat='ready';
    installing=false;
  };
  install();
  new MutationObserver(()=>queueMicrotask(install)).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>queueMicrotask(install));
  window.addEventListener('pageshow',install);
})();
