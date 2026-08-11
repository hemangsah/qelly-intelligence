let densityMedia=null;
let currentMain=null;
let mediaBound=false;

function setPresentation(element,styles,active){
  if(!element)return;
  for(const [name,value] of Object.entries(styles)){
    if(active)element.style.setProperty(name,value,'important');
    else element.style.removeProperty(name);
  }
}

function applyFundamentalsDensity(){
  const page=currentMain?.querySelector('.q-page');
  const issuer=page?.querySelector('#fundamental-asset');
  const annualGrid=page?.querySelector('#annual-grid');
  const filings=page?.querySelector('[data-action="open-filings"]');
  const compare=page?.querySelector('[data-action="compare"]');
  if(!issuer||!annualGrid||!filings||!compare)return false;

  const active=Boolean(densityMedia?.matches);
  const kpis=page.querySelector('.q-kpi-grid');
  const pairs=[...page.querySelectorAll(':scope > .q-two-column')];
  const recordPair=pairs.find((pair)=>pair.querySelectorAll(':scope > .q-panel > .q-panel-body.q-stack').length===2);
  const recordBodies=recordPair?[...recordPair.querySelectorAll(':scope > .q-panel > .q-panel-body.q-stack')]:[];
  const consensus=page.querySelector('.q-metric-grid');

  setPresentation(kpis,{'display':'grid','grid-template-columns':'repeat(2,minmax(0,1fr))','gap':'8px'},active);
  kpis?.querySelectorAll(':scope > .q-kpi').forEach((card)=>setPresentation(card,{'min-height':'0','padding':'11px'},active));

  for(const body of recordBodies){
    setPresentation(body,{'display':'grid','grid-template-columns':'repeat(2,minmax(0,1fr))','gap':'7px'},active);
    body.querySelectorAll(':scope > .q-record-row').forEach((row)=>setPresentation(row,{'display':'flex','flex-direction':'column','align-items':'flex-start','gap':'5px','min-width':'0','min-height':'0','padding':'10px'},active));
  }

  setPresentation(consensus,{'display':'grid','grid-template-columns':'repeat(3,minmax(0,1fr))','gap':'7px'},active);
  consensus?.querySelectorAll(':scope > .q-metric-card').forEach((card)=>setPresentation(card,{'min-width':'0','min-height':'0','padding':'10px'},active));

  page.dataset.fundamentalsMobileDensity=active?'active':'desktop';
  document.documentElement.dataset.fundamentalsDensity=active?'active':'desktop';
  return true;
}

export function installFundamentalsDensity(main){
  currentMain=main;
  densityMedia??=typeof globalThis.matchMedia==='function'?globalThis.matchMedia('(max-width: 620px)'):null;
  if(!mediaBound){
    densityMedia?.addEventListener?.('change',()=>applyFundamentalsDensity());
    mediaBound=true;
  }
  applyFundamentalsDensity();
}
