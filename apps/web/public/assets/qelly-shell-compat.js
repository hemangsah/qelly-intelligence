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
      if(context.dataset.qellyProductBoundary!=='suppressed'){
        context.replaceChildren();
        conceal(context);
        context.dataset.qellyProductBoundary='suppressed';
      }
    }
    if(main.querySelector(':scope > .q-worldclass-context[data-qelly-product-boundary="suppressed"]'))main.dataset.worldclassRoute=currentRoute();
    for(const card of main.querySelectorAll('.q-market-provider[data-provider]')){
      const canonical=providerIds.get(String(card.dataset.provider||'').trim().toLowerCase());
      if(canonical)card.dataset.provider=canonical;
    }
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
