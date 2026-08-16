// V7 canonical terminal shell. Presentation/navigation only.
// Provider availability is route-governed; the shell never invents feed counts or simulation states.
const root=document.documentElement;
const STYLE=new URL('./qelly-v53-lock-shell.css',import.meta.url).href;
const ACCEPTED=Object.freeze({
 'live-markets':['MARKET COMMAND','Market Command','M'],market:['MARKET COMMAND','Market Command','M'],
 'advanced-chart':['ADVANCED CHART','Advanced Chart Studio','M'],
 'research-workspace':['RESEARCH & EVIDENCE','Research Workspace','R'],
 'qelly-verify':['QUANT & VERIFICATION','Qelly Verify','Q'],
 'screener-lab':['SCREENERS & QUANT','Screener Lab','Q'],
 'portfolio-analytics':['PORTFOLIO & RISK','Portfolio Risk','P'],
 'theme-lab':['THEME INTELLIGENCE','Theme Studio','S'],
 'saved-calculations':['CLOUD & ACCOUNT','Cloud Sync','S'],
 'security-setup':['IDENTITY & SECURITY','Security Center','S'],
 watchlist:['WORKSPACES & COLLABORATION','Collaboration Hub','R'],
 'delivery-operations':['OPERATIONS & GOVERNANCE','Provider Runtime','O'],
 'notification-center':['GLOBAL STATES','Truth-State Matrix','E'],
 'about-qelly':['PUBLIC / COMPANY','Enterprise Intelligence','S'],
 'calculator-detail':['FORMULAE & CALCULATORS','Formula Workbench','Q'],
 'decision-provenance':['DECISION PROVENANCE','Decision Provenance','E']
});
const PRIMARY=Object.freeze([
 ['M','Market','#/live-markets'],['R','Research','#/research-workspace'],['P','Portfolio','#/portfolio-analytics'],['Q','Quant','#/qelly-verify'],['E','Evidence','#/decision-provenance'],['O','Ops','#/delivery-operations'],['S','System','#/security-setup']
]);
const SECONDARY=Object.freeze([['T','Tools','#/calculator-center'],['A','Account','#/auth-login']]);

function style(){if(document.querySelector('link[data-v53-lock-shell]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=STYLE;link.dataset.v53LockShell='active';document.head.append(link)}
function state(){const raw=location.hash.replace(/^#\/?/,'');const [route='',query='']=raw.split('?');return{route:route.split('/')[0]||'live-markets',params:new URLSearchParams(query)}}
function spec(){const s=state();if(s.route==='market'&&['qelly-verify','evidence-methodology'].includes(s.params.get('view')))return null;return ACCEPTED[s.route]||null}
function routeActive(code){const current=spec();return current?.[2]===code}
function systemText(){return 'UTC REFERENCE  |  Provider truth: governed  |  Workspace: Institutional Research'}
function routeTruth(route){return ['market','live-markets','advanced-chart'].includes(route)?'MARKET DATA · GOVERNED PROVIDER TRUTH':'EVIDENCE · ROUTE-GOVERNED'}
function rail(){return `<aside class="q-v53-lock-shell-rail" aria-label="Qelly product domains"><a class="q-v53-lock-shell-brand" href="#/feature-universe" aria-label="Qelly Intelligence"><span aria-hidden="true">Q</span><span>QELLY</span></a><nav class="q-v53-lock-shell-nav">${PRIMARY.map(([code,label,href])=>`<a href="${href}" class="${routeActive(code)?'is-active':''}" ${routeActive(code)?'aria-current="page"':''}><strong>${code}</strong><span>${label}</span></a>`).join('')}</nav><nav class="q-v53-lock-shell-nav q-v53-lock-shell-nav-secondary">${SECONDARY.map(([code,label,href])=>`<a href="${href}"><strong>${code}</strong><span>${label}</span></a>`).join('')}</nav></aside>`}
function shell(current){const route=state().route;return `<div class="q-v53-lock-system"><span>${systemText()}</span><strong>READ ONLY · NO EXECUTION</strong></div><button type="button" class="q-v53-lock-command" data-v53-command aria-label="Search Qelly"><span aria-hidden="true">⌕</span><span>Search assets, routes, formulae, research, providers, audit…</span><kbd>CTRL K</kbd></button><div class="q-v53-lock-contextbar"><span>${current[0]} / ${current[1]}</span><span>${routeTruth(route)}</span></div>${rail()}`}
function clear(){root.querySelectorAll('.q-v53-lock-system,.q-v53-lock-command,.q-v53-lock-contextbar,.q-v53-lock-shell-rail').forEach(node=>node.remove());delete root.dataset.v53LockShell}
function install(){const current=spec();if(!current){clear();return}root.dataset.v53LockShell='true';style();clear();root.dataset.v53LockShell='true';document.body.insertAdjacentHTML('afterbegin',shell(current));document.querySelector('[data-v53-command]')?.addEventListener('click',()=>document.getElementById('command-button')?.click())}
let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;install()})}
window.addEventListener('hashchange',schedule);window.addEventListener('pageshow',schedule);install();
window.QellyV53LockShell=Object.freeze({schedule,spec});