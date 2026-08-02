(()=>{
  let installing=false;
  const install=()=>{
    if(installing)return;
    installing=true;
    const app=document.getElementById('app')||document.body;
    const ensure=(tag,id,parent=app)=>{
      let node=document.getElementById(id);
      if(node)return node;
      node=document.createElement(tag);
      node.id=id;
      node.hidden=true;
      node.setAttribute('aria-hidden','true');
      node.tabIndex=-1;
      parent.append(node);
      return node;
    };
    const shell=document.querySelector('.q-shell')||ensure('div','qelly-shell-compat-root');
    shell.classList.add('q-shell');
    const rail=ensure('aside','rail',shell);
    ensure('nav','primary-nav',rail);
    ensure('button','collapse-rail',rail).type='button';
    ensure('button','rail-toggle').type='button';
    ensure('button','close-context').type='button';
    ensure('button','theme-shortcut').type='button';
    ensure('button','notification-button').type='button';
    ensure('button','command-button').type='button';
    const state=ensure('select','state-selector');
    if(!state.options.length){for(const value of ['default','loading','empty','partial','error','offline','stale','delayed','simulated'])state.add(new Option(value,value));}
    const themes=ensure('select','global-theme-selector');
    if(!themes.options.length){for(const value of ['burgundy-command','porcelain-burgundy','burgundy-night','graphite-terminal','midnight-research','high-contrast'])themes.add(new Option(value,value));}
    ensure('div','context-content',ensure('aside','context-drawer',shell));
    ensure('div','macro-strip');
    ensure('nav','persona-ribbon');
    ensure('div','context-shelf');
    ensure('aside','edge-dock',shell);
    ensure('div','compare-tray');
    ensure('nav','mobile-navigation');
    ensure('main','main',shell);
    document.querySelector('.q-product-account')?.setAttribute('aria-label','Open Qelly account');
    document.documentElement.dataset.shellCompat='ready';
    installing=false;
  };
  install();
  new MutationObserver(()=>queueMicrotask(install)).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',install);
})();
