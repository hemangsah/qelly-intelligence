import {ensureRouteStylesheet} from '../route-stylesheet-readiness.mjs';
import {renderPortfolioV6} from './portfolio-v6.mjs';

const STYLESHEET=new URL('./portfolio-v6.css',import.meta.url).href;
async function ensureStyles(signal){await ensureRouteStylesheet(STYLESHEET,{attribute:'data-qelly-portfolio-v6',value:'active',signal});}

export async function renderPortfolioV6Entry(main,deps){
  const {signal,renderRoute}=deps;
  try{await ensureStyles(signal);}catch(error){if(error?.name==='AbortError')throw error;main.innerHTML=`<section class="q-page"><header class="q-page-head"><div><p class="q-eyebrow">Your portfolio</p><h1>The workspace could not open.</h1><p>Workspace styles could not load. Please retry.</p></div></header><button class="q-button q-button--primary" type="button" data-portfolio-v6-entry-style-retry>Retry workspace</button></section>`;main.querySelector('[data-portfolio-v6-entry-style-retry]').addEventListener('click',()=>renderRoute?.());return;}
  return renderPortfolioV6(main,deps);
}
