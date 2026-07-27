import { icon } from './icon-registry.mjs';
import { personaFor } from './persona-profiles.mjs';

const escapeHtml=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));

const previewDomains=Object.freeze([
  {id:'home',label:'Home',shortLabel:'Home',icon:'home',route:'feature-universe',active:['feature-universe']},
  {id:'markets',label:'Markets',shortLabel:'Markets',icon:'markets',route:'market',active:['market']},
  {id:'discovery',label:'Discovery',shortLabel:'Discover',icon:'discovery',route:'asset-rankings',active:['asset-rankings','asset']},
  {id:'derivatives',label:'Derivatives',shortLabel:'Deriv.',icon:'derivatives'},
  {id:'research',label:'Research',shortLabel:'Research',icon:'research'},
  {id:'portfolio',label:'Portfolio',shortLabel:'Portfolio',icon:'portfolio'},
  {id:'decision-provenance',label:'Decision Provenance',shortLabel:'Evidence',icon:'evidence',route:'decision-provenance',active:['decision-provenance']},
  {id:'operations',label:'Operations',shortLabel:'Ops',icon:'operations'},
  {id:'trust',label:'Trust',shortLabel:'Trust',icon:'trust'}
]);

const routeIcon=(route)=>({
  'feature-universe':'home',market:'markets','asset-rankings':'discovery','decision-provenance':'evidence','theme-personas':'operations'
}[route]??'assets');

export function renderShellFoundations({
  routeDefinitions,productDomains,visibleRoutes,currentRoute,activeDomain,personaId,staticVisualPreview,
  onDomain,onRoute,onPersona,onCompare,onWatchlist,onExplain,onMenu,onUnavailable
}){
  const current=routeDefinitions.find((item)=>item.route===currentRoute)??visibleRoutes[0];
  const availableDomains=productDomains.filter((domain)=>visibleRoutes.some((route)=>route.domain===domain.id));
  const resolvedDomain=availableDomains.find((domain)=>domain.id===activeDomain)??availableDomains.find((domain)=>domain.id===current?.domain)??availableDomains[0];
  const siblings=visibleRoutes.filter((route)=>route.domain===resolvedDomain?.id);
  const persona=personaFor(personaId);
  const edge=document.getElementById('edge-dock');
  if(edge){
    const domains=staticVisualPreview
      ? previewDomains.map((item)=>`<button type="button" ${item.route?`data-preview-route="${item.route}"`:`data-preview-unavailable="${escapeHtml(item.label)}"`} class="${item.active?.includes(currentRoute)?'is-active':''}" aria-label="${escapeHtml(item.label)}${item.route?'':' — backend unavailable in static preview'}" aria-pressed="${item.active?.includes(currentRoute)??false}" title="${escapeHtml(item.label)}${item.route?'':' · backend unavailable'}"><span>${icon(item.icon,{size:18})}</span><small>${escapeHtml(item.shortLabel)}</small></button>`).join('')
      : availableDomains.map((domain)=>`<button type="button" data-domain="${domain.id}" class="${domain.id===resolvedDomain?.id?'is-active':''}" aria-label="${escapeHtml(domain.label)}" aria-pressed="${domain.id===resolvedDomain?.id}"><span>${icon(routeIcon(domain.defaultRoute),{size:18})}</span><small>${escapeHtml(domain.shortLabel)}</small></button>`).join('');
    edge.innerHTML=`<div class="q-edge-dock__brand" aria-hidden="true">Q</div><div class="q-edge-dock__domains">${domains}</div><div class="q-edge-dock__utilities"><button type="button" data-shell-action="explain" aria-label="Explain this move"><span>${icon('explain',{size:18})}</span><small>Explain</small></button><button type="button" data-shell-action="menu" aria-label="Open domain navigation" aria-expanded="false"><span>${icon('menu',{size:18})}</span><small>Menu</small></button></div>`;
    edge.querySelectorAll('[data-domain]').forEach((button)=>button.addEventListener('click',()=>onDomain(button.dataset.domain)));
    edge.querySelectorAll('[data-preview-route]').forEach((button)=>button.addEventListener('click',()=>onRoute(button.dataset.previewRoute)));
    edge.querySelectorAll('[data-preview-unavailable]').forEach((button)=>button.addEventListener('click',()=>onUnavailable(button.dataset.previewUnavailable)));
    edge.querySelector('[data-shell-action="explain"]')?.addEventListener('click',onExplain);
    edge.querySelector('[data-shell-action="menu"]')?.addEventListener('click',onMenu);
  }
  const ribbon=document.getElementById('persona-ribbon');
  if(ribbon){
    ribbon.innerHTML=`<span class="q-persona-ribbon__label">Operating mode</span><p class="q-persona-ribbon__context"><strong>${escapeHtml(persona.name)}</strong><span>${escapeHtml(persona.intent)}</span></p>`;
  }
  const shelf=document.getElementById('context-shelf');
  if(shelf){
    shelf.innerHTML=`<nav class="q-breadcrumbs" aria-label="Breadcrumb"><button type="button" data-domain-home="${resolvedDomain?.id??'markets'}">Qelly</button><span aria-hidden="true">/</span><strong>${escapeHtml(resolvedDomain?.label??'Markets')}</strong><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(current?.label??'Overview')}</span></nav><div class="q-category-shelf" aria-label="${escapeHtml(resolvedDomain?.label??'Product')} destinations">${siblings.slice(0,8).map((route)=>`<button type="button" data-shelf-route="${route.route}" class="${route.route===currentRoute?'is-active':''}" aria-current="${route.route===currentRoute?'page':'false'}">${escapeHtml(route.label)}</button>`).join('')}</div>`;
    shelf.querySelector('[data-domain-home]')?.addEventListener('click',()=>onDomain(resolvedDomain?.id??'markets'));
    shelf.querySelectorAll('[data-shelf-route]').forEach((button)=>button.addEventListener('click',()=>onRoute(button.dataset.shelfRoute)));
  }
  const mobile=document.getElementById('mobile-navigation');
  if(mobile){
    const mobileRoutes=['feature-universe','market','asset-rankings','decision-provenance','theme-personas'].map((route)=>visibleRoutes.find((item)=>item.route===route)).filter(Boolean);
    mobile.innerHTML=mobileRoutes.map((route)=>`<button type="button" data-mobile-route="${route.route}" class="${route.route===currentRoute?'is-active':''}" aria-current="${route.route===currentRoute?'page':'false'}">${icon(routeIcon(route.route),{size:18})}<small>${escapeHtml(route.label.replace('Decision Provenance','Evidence').replace('Theme Personas','More').replace('Asset Rankings','Discovery').replace('Feature Universe','Home'))}</small></button>`).join('');
    mobile.querySelectorAll('[data-mobile-route]').forEach((button)=>button.addEventListener('click',()=>onRoute(button.dataset.mobileRoute)));
  }
  const compare=document.getElementById('compare-tray');
  if(compare){
    const compareButton=compare.querySelector('[data-compare-open]');const watchlistButton=compare.querySelector('[data-watchlist-open]');const explainButton=compare.querySelector('[data-explain-open]');
    if(compareButton)compareButton.onclick=onCompare;if(watchlistButton)watchlistButton.onclick=onWatchlist;if(explainButton)explainButton.onclick=onExplain;
  }
  document.documentElement.dataset.persona=persona.id;
  document.documentElement.dataset.timeframe=persona.defaultTimeframe;
  document.documentElement.dataset.alertPosture=persona.alertPosture;
  document.documentElement.dataset.pageKind=current?.kind??'analytical';
  document.body.dataset.pageKind=current?.kind??'analytical';
  return {activeDomain:resolvedDomain?.id??'markets',persona,current,siblings};
}
