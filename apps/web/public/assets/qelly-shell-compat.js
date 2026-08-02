(()=>{
  let installing=false;
  const conceal=(node)=>{
    if(!node)return node;
    node.hidden=true;
    node.setAttribute('aria-hidden','true');
    node.tabIndex=-1;
    return node;
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
    document.querySelector('.q-global-strip')?.setAttribute('hidden','');
    document.querySelector('.q-product-account')?.setAttribute('aria-label','Open Qelly account');
    document.documentElement.dataset.shellCompat='ready';
    installing=false;
  };
  install();
  new MutationObserver(()=>queueMicrotask(install)).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',install);
})();
