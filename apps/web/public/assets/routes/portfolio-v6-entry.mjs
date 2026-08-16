import {renderPortfolioV6} from './portfolio-v6.mjs';

const STYLESHEET=new URL('./portfolio-v6.css',import.meta.url).href;
function ensureStyles(){
  if(document.querySelector('link[data-qelly-portfolio-v6="active"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=STYLESHEET;
  link.dataset.qellyPortfolioV6='active';
  document.head.append(link);
}

export async function renderPortfolioV6Entry(main,deps){
  ensureStyles();
  return renderPortfolioV6(main,deps);
}
