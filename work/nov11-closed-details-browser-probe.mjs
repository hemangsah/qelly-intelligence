// Serialized into a dedicated browser fixture. This is measurement instrumentation, not product code.
export function installClosedDetailsProbe(){
 const p=window.__QELLY_CLOSED_DETAILS_PROBE__={version:1,phase:'setup',calls:[],stack:[],events:[],observations:[],watchIds:[],captureActive:false,framesObserved:0,droppedObservations:0};
 const event=(kind,extra={})=>p.events.push({kind,now:performance.now(),phase:p.phase,...extra});
 p.enterFloor=scope=>{const c={id:p.calls.length+1,phase:p.phase,scopeId:scope?.id||null,scopeTag:scope?.tagName||null,start:performance.now(),rectangleReads:0,fontStyleReads:0,closestReads:0,containsReads:0,closedAncestorQueries:0,closedAncestorMatches:0,classAdds:0};p.calls.push(c);p.stack.push(c);event('floor-enter',{callId:c.id});return c;};
 p.exitFloor=c=>{c.end=performance.now();p.stack.pop();event('floor-exit',{callId:c.id});};
 const count=key=>{const c=p.stack.at(-1);if(c)c[key]++;};
 const closest=Element.prototype.closest;
 Element.prototype.closest=function(selector){count('closestReads');const result=Reflect.apply(closest,this,[selector]);const c=p.stack.at(-1);if(c&&selector==='details:not([open])'){c.closedAncestorQueries++;if(result)c.closedAncestorMatches++;}return result;};
 const rect=Element.prototype.getClientRects;
 Element.prototype.getClientRects=function(...args){count('rectangleReads');return Reflect.apply(rect,this,args);};
 const contains=Node.prototype.contains;
 Node.prototype.contains=function(...args){count('containsReads');return Reflect.apply(contains,this,args);};
 const style=window.getComputedStyle;
 window.getComputedStyle=function(...args){count('fontStyleReads');return Reflect.apply(style,this,args);};
 const add=DOMTokenList.prototype.add;
 DOMTokenList.prototype.add=function(...tokens){const c=p.stack.at(-1);if(c&&tokens.includes('q-v8-text-floor'))c.classAdds++;return Reflect.apply(add,this,tokens);};
 p.observe=stage=>{
  if(p.observations.length>=1000){p.droppedObservations++;return;}
  const targets=p.watchIds.map(id=>{const e=document.getElementById(id);if(!e)return{id,present:false};if(typeof e.checkVisibility!=='function')throw Error('Native visibility oracle unavailable');
   const s=getComputedStyle(e);return{id,present:true,paintEligible:e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),fontSize:Number.parseFloat(s.fontSize),floor:e.classList.contains('q-v8-text-floor'),display:s.display,visibility:s.visibility};
  });
  const sample={stage,phase:p.phase,now:performance.now(),timeOrigin:performance.timeOrigin,targets,openDetails:[...document.querySelectorAll('#main details')].map(d=>({id:d.id,open:d.open,pseudoContentVisibility:getComputedStyle(d,'::details-content').contentVisibility}))};
  p.observations.push(sample);return sample;
 };
 p.start=(phase,watchIds)=>{p.phase=phase;p.watchIds=watchIds;p.captureActive=true;p.framesObserved=0;const loop=()=>{if(!p.captureActive)return;p.framesObserved++;p.observe('raf-dom-observation');if(p.framesObserved<60)p.raf=requestAnimationFrame(loop);else{p.captureCapReached=true;p.captureActive=false;}};p.raf=requestAnimationFrame(loop);};
 p.stop=()=>{p.captureActive=false;cancelAnimationFrame(p.raf);p.observe('settled-dom-observation');};
 const main=document.getElementById('main');
 main.addEventListener('click',e=>{if(!p.captureActive)return;event('native-click',{trusted:e.isTrusted,target:e.target?.tagName,pointerType:e.pointerType||null});queueMicrotask(()=>{if(p.captureActive)p.observe('native-activation-microtask');});},true);
 main.addEventListener('keydown',e=>{if(p.captureActive)event('native-keydown',{trusted:e.isTrusted,key:e.key});},true);
 main.addEventListener('toggle',e=>event('native-toggle',{targetId:e.target?.id,open:Boolean(e.target?.open),trusted:e.isTrusted}),true);
 p.take=()=>JSON.parse(JSON.stringify(p,(key,value)=>['raf','captureActive'].includes(key)?undefined:value));
}
