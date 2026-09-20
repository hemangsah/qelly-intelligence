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

  const primary=cards.find(card=>card.dataset.marketWidgetPriority==='primary')||cards[0];
  const secondary=cards.filter(card=>card!==primary);
  const primaryFrame=requestAnimationFrame(()=>mountCard(primary));

  let observer=null;
  if('IntersectionObserver'in window){
    observer=new IntersectionObserver((entries)=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        observer.unobserve(entry.target);
        mountCard(entry.target);
      }
    },{rootMargin,threshold:0.01});
    secondary.forEach(card=>observer.observe(card));
  }else secondary.forEach(card=>mountCard(card));

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
      destroyed=true;cancelAnimationFrame(primaryFrame);observer?.disconnect();
      for(const handle of handles.values())handle?.destroy?.();
      handles.clear();mountedKinds.clear();
    },
    mountedIds(){return [...handles.keys()];}
  };
}
