import {mountTradingViewWidget} from './tradingview-display-widget.mjs';

export function validateMarketWidgetPanels(panels){
  if(!Array.isArray(panels)||!panels.length)throw new TypeError('Market widget panels are required');
  const ids=new Set(),kinds=new Set();
  for(const panel of panels){
    if(!panel?.id||!panel?.kind)throw new TypeError('Every market widget panel needs id and kind');
    if(ids.has(panel.id))throw new TypeError('Duplicate market widget id: '+panel.id);
    if(kinds.has(panel.kind))throw new TypeError('Duplicate TradingView widget kind: '+panel.kind);
    ids.add(panel.id);kinds.add(panel.kind);
  }
  if(panels[0].kind!=='cryptoHeatmap')throw new TypeError('Crypto Heatmap must be the first market widget');
  return true;
}

export function mountTradingViewMarketGrid(root,{panels,context={},rootMargin='320px 0px'}={}){
  if(!(root instanceof HTMLElement))throw new TypeError('Market widget grid root is required');
  validateMarketWidgetPanels(panels);
  const definitions=new Map(panels.map(panel=>[panel.id,panel]));
  const cards=[...root.querySelectorAll('[data-market-widget-id]')];
  const handles=new Map();
  const mountedKinds=new Set();
  let currentContext={...context};
  let destroyed=false;

  const mountCard=(card)=>{
    if(destroyed||card.dataset.marketWidgetState==='mounted')return;
    const panel=definitions.get(card.dataset.marketWidgetId);
    const stage=card.querySelector('[data-market-widget-stage]');
    if(!panel||!stage)return;
    if(mountedKinds.has(panel.kind)){
      card.dataset.marketWidgetState='deduplicated';
      stage.innerHTML='<div class="q-market-widget-note"><strong>Available above</strong><span>This market view is already active on this page.</span></div>';
      return;
    }
    mountedKinds.add(panel.kind);
    card.dataset.marketWidgetState='mounting';
    const config=typeof panel.config==='function'?panel.config(currentContext):panel.config||{};
    const handle=mountTradingViewWidget(stage,{kind:panel.kind,label:panel.label,openUrl:panel.openUrl,config});
    handles.set(panel.id,handle);
    card.dataset.marketWidgetState='mounted';
  };

  const mountTimers=new Set();
  const scheduleCard=(card,delay=0)=>{
    if(destroyed||!card||card.dataset.marketWidgetState==='mounted')return;
    const timer=setTimeout(()=>{
      mountTimers.delete(timer);
      if(!destroyed&&card.isConnected)mountCard(card);
    },Math.max(0,delay));
    mountTimers.add(timer);
  };

  let observer=null;
  if('IntersectionObserver'in window){
    observer=new IntersectionObserver((entries)=>{
      const visible=entries
        .filter(entry=>entry.isIntersecting)
        .sort((a,b)=>cards.indexOf(a.target)-cards.indexOf(b.target));
      visible.forEach((entry,index)=>{
        observer.unobserve(entry.target);
        scheduleCard(entry.target,index*350);
      });
    },{rootMargin,threshold:0.01});
    cards.forEach(card=>observer.observe(card));
  }else cards.forEach((card,index)=>scheduleCard(card,index*350));

  return {
    update(next){
      currentContext={...currentContext,...next};
      for(const [id,handle] of handles){
        const panel=definitions.get(id);
        if(!panel?.dynamic)continue;
        handle?.destroy?.();
        handles.delete(id);
        mountedKinds.delete(panel.kind);
        const card=cards.find(node=>node.dataset.marketWidgetId===id);
        if(card){card.dataset.marketWidgetState='idle';mountCard(card);}
      }
    },
    refresh(){
      const mounted=[...handles.keys()];
      for(const id of mounted){
        const panel=definitions.get(id);
        const card=cards.find(node=>node.dataset.marketWidgetId===id);
        handles.get(id)?.destroy?.();handles.delete(id);mountedKinds.delete(panel.kind);
        if(card){card.dataset.marketWidgetState='idle';mountCard(card);}
      }
    },
    destroy(){
      destroyed=true;observer?.disconnect();
      for(const timer of mountTimers)clearTimeout(timer);
      mountTimers.clear();
      for(const handle of handles.values())handle?.destroy?.();
      handles.clear();mountedKinds.clear();
    },
    mountedIds(){return [...handles.keys()];}
  };
}
