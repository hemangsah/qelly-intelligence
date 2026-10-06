import {installQellyChat} from './ai/qelly-chat.mjs';
import {routeIdentityFor} from './route-registry.mjs';
import {createPublicCalculatorChatApi} from './public-calculator-chat-api.mjs';

const config=JSON.parse(document.querySelector('#q-calculator-config')?.textContent||'{}');
const title=config.title||'Financial calculator library';
globalThis.__QELLY_CHAT_CONTEXT__={route:'calculator-center',contextType:'calculator',stateLabel:'QELLY CALCULATORS',
  actionLabel:'Ask QELLY',meta:title,mode:'explain',
  prompt:config.formulaId?`Explain the registered ${title} formula (${config.formulaId}), its assumptions and limits. Do not infer my inputs or treat an example as a recommendation.`:'Help me choose a registered calculator and understand its assumptions.'};
installQellyChat({api:createPublicCalculatorChatApi(),
  staticVisualPreview:globalThis.__QELLY_CONFIG__?.staticVisualPreview===true,
  navigate:(route,asset)=>{
    if(!routeIdentityFor(route))return;
    const url=new URL('/#/'+route,location.origin);
    if(asset&&['BTC','ETH','SOL','XRP','DOGE'].includes(asset))url.hash+='/'+asset;
    location.assign(url);
  },
  toast:message=>{const status=document.querySelector('[data-public-chat-status]');if(status)status.textContent=message;}
});
document.querySelectorAll('.q-cn-global-categories details').forEach(menu=>{
  menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.q-cn-global-categories details').forEach(other=>{if(other!==menu)other.open=false;});});
  menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;menu.querySelector('summary').focus();}});
});
