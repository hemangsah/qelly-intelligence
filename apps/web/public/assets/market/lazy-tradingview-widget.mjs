import {mountTradingViewWidget} from './tradingview-display-widget.mjs';

export function mountLazyTradingViewWidget(container,options,{rootMargin='280px 0px'}={}){
  if(!(container instanceof HTMLElement))throw new TypeError('Lazy market widget container is required');
  let handle=null,destroyed=false,observer=null;
  const mount=()=>{
    if(destroyed||handle)return;
    handle=mountTradingViewWidget(container,options);
    container.dataset.lazyMarketWidget='mounted';
  };
  container.dataset.lazyMarketWidget='waiting';
  if('IntersectionObserver'in window){
    observer=new IntersectionObserver((entries)=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      observer=null;
      mount();
    },{rootMargin,threshold:0.01});
    observer.observe(container);
  }else mount();
  return {
    mount,
    mounted:()=>Boolean(handle),
    destroy(){
      destroyed=true;
      observer?.disconnect();
      observer=null;
      handle?.destroy?.();
      handle=null;
      delete container.dataset.lazyMarketWidget;
    }
  };
}
