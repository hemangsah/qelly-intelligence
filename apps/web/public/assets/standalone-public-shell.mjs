import {installQellyChat} from './ai/qelly-chat.mjs';
import {routeIdentityFor} from './route-registry.mjs';
import {createPublicCalculatorChatApi} from './public-calculator-chat-api.mjs';

// Build-time public metadata only. Never copy page content, query parameters,
// policy request details or rendered market observations into a Chat draft.
const context=JSON.parse(document.querySelector('#q-public-shell-context')?.textContent||'{}');
const asset=['BTC','ETH','SOL','HYPE','XRP','DOGE'].includes(context.asset)?context.asset:null;
const route=routeIdentityFor(context.route)?context.route:'trust-center';
globalThis.__QELLY_CHAT_CONTEXT__={route,contextType:asset?'asset':'research',stateLabel:asset?'QELLY RESEARCH':'QELLY INFORMATION',actionLabel:'Ask QELLY',meta:context.title,mode:asset?'asset':'explain',asset,
  prompt:asset?`Explain the governed evidence available for ${asset}. Distinguish current observations, source freshness, inference and unavailable data.`:'Explain how to use QELLY research and its evidence boundaries. Do not include private account information.'};
installQellyChat({api:createPublicCalculatorChatApi(),staticVisualPreview:globalThis.__QELLY_CONFIG__?.staticVisualPreview===true,
  navigate:(destination,symbol)=>{if(!routeIdentityFor(destination))return;const url=new URL('/#/'+destination,location.origin);if(['BTC','ETH','SOL','HYPE','XRP','DOGE'].includes(symbol))url.hash+='/'+symbol;location.assign(url);},
  toast:message=>{const status=document.querySelector('[data-public-chat-status]');if(status)status.textContent=message;}
});
document.querySelectorAll('.q-cn-global-categories details').forEach(menu=>{
  menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.q-cn-global-categories details').forEach(other=>{if(other!==menu)other.open=false;});});
  menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}});
});
