import {adSlot,mountAdSlots} from '../qelly-ad-slot.mjs';
import {peekResearchContext,storeDecisionContext} from '../decision-context-bridge.mjs';
const STYLESHEET=new URL('../qelly-chat-workspace.css',import.meta.url).href;
const MODES=Object.freeze([
  {id:'ask',step:'01',title:'Ask',copy:'Answer directly with connected evidence, QELLY tool receipts and explicit unavailable coverage.',prompt:'What is the strongest current evidence for Bitcoin, and what is unavailable?'},
  {id:'research',step:'02',title:'Research',copy:'Synthesize connected finance observations with source state, timestamps and explicit coverage gaps.',prompt:'Research the current market context for Bitcoin. Separate observations, inference, missing evidence and what I should verify next.'},
  {id:'compare',step:'03',title:'Compare',copy:'Contrast assets, economies or evidence on the same basis without hiding mismatched coverage.',prompt:'Compare Bitcoin, Ethereum and Solana using only available evidence. Show source freshness, disagreements and missing data.'},
  {id:'explain',step:'04',title:'Explain',copy:'Turn market or methodology questions into a transparent, evidence-linked explanation.',prompt:'Explain the current Bitcoin market state step by step. Separate observation, tool output and inference.'},
  {id:'calculate',step:'05',title:'Calculate',copy:'Use registered deterministic calculators instead of generative mental arithmetic.',prompt:'Show me the registered input schema for the selected deterministic calculator.'},
  {id:'decision',step:'06',title:'Decision review',copy:'Read the exact Decision Intelligence evidence gate, contradictions, risk state and invalidation.',prompt:'Explain the current Bitcoin Decision Intelligence view, including contradictions and what changes it.'},
  {id:'asset',step:'07',title:'Asset dossier',copy:'Summarize supported asset evidence while keeping missing tracks and independent context explicit.',prompt:'Summarize the supported Bitcoin Asset Dossier evidence and show which evidence tracks are unavailable.'},
  {id:'india',step:'08',title:'India',copy:'Use connected India reference evidence while separating TradingView display-only market coverage.',prompt:'What India Finance evidence can QELLY verify now? Separate delayed reference data from display-only market coverage.'}
]);

const activateStyles=()=>{
  if(document.querySelector('link[data-qelly-chat-workspace]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=STYLESHEET;link.dataset.qellyChatWorkspace='active';document.head.append(link);
};

const modeCards=(escapeHtml)=>MODES.map((mode)=>`<article class="q-chat-mode-card"><span>${mode.step}</span><h2>${escapeHtml(mode.title)}</h2><p>${escapeHtml(mode.copy)}</p><button class="q-button q-button--secondary" type="button" data-chat-mode="${mode.id}" data-chat-prompt="${escapeHtml(mode.prompt)}">Start ${escapeHtml(mode.title)}</button></article>`).join('');

export async function renderQellyChatWorkspace(main,{api,pageHead,stateBanner,escapeHtml,navigate}){
  activateStyles();
  const researchContext=peekResearchContext();
  const contextAsset=researchContext.asset||null;
  const contextTimeframe=researchContext.timeframe||'15m';
  const contextFormula=researchContext.formulaId||null;
  let capability=null;
  try{capability=await api('/api/v1/intelligence/chat');}catch{}
  const datasets=capability?.datasets||{};
  const assistant=capability?.assistant||{};
  const policy=capability?.policy||{};
  const connected=Number(datasets.connected)||0;
  const catalogued=Number(datasets.catalogued)||0;
  const provider=assistant.inferenceAvailable?'AI-assisted research with connected evidence':'Connected-evidence research engine';
  const registryTime=(()=>{const value=new Date(datasets.generatedAt||'');return Number.isNaN(value.getTime())?'time unavailable':value.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});})();
  const items=(datasets.items||[]).slice(0,8);
  const contextMarkup=contextAsset?`<div class="q-truth-callout is-compact"><span class="q-status q-status--cached">research context</span><p>Continuing <strong>${escapeHtml(contextAsset)}</strong> · ${escapeHtml(contextTimeframe)} from ${escapeHtml(String(researchContext.source||'prior research').replaceAll('-',' '))}${contextFormula?` · formula ${escapeHtml(contextFormula)}`:''}. Context guides handoff only; every current market claim is still re-grounded in QELLY evidence/tools.</p></div>`:'';
  main.innerHTML=`<section class="q-page q-chat-workspace">${pageHead('Qelly flagship intelligence workspace','Qelly Chat','Research, compare, explain and decide with connected evidence. Every available current claim exposes its source state; every missing source stays visible.',`<button class="q-button q-button--secondary" type="button" data-chat-action="evidence">Inspect evidence</button><button class="q-button q-button--primary" type="button" data-chat-action="open">Open full Qelly Chat</button>`)}${stateBanner()}${contextMarkup}
    <section class="q-chat-hero" aria-label="Qelly Chat workflow"><div class="q-chat-hero__copy"><p class="q-eyebrow">Ask → Tool → Ground → Verify → Decide</p><h2>From question to an auditable decision path.</h2><p>Qelly routes each mode through bounded read-only tools first, then keeps source-backed observations, deterministic output, model inference and unavailable coverage separate before verification or Decision Intelligence.</p><div class="q-chat-hero__actions"><button class="q-button q-button--primary" type="button" data-chat-action="decision">Build a decision with Qelly</button><button class="q-button q-button--secondary" type="button" data-chat-action="research">Start evidence research</button></div></div><div class="q-chat-runtime"><span class="q-status q-status--${capability?'live':'unavailable'}">${capability?'available':'reconnecting'}</span><dl><div><dt>Research engine</dt><dd>${escapeHtml(provider)}</dd></div><div><dt>Connected sources</dt><dd>${connected} of ${catalogued} listed sources</dd></div><div><dt>Conversation storage</dt><dd>${escapeHtml(policy.conversationStorage||'browser session only')}</dd></div><div><dt>Tool modes</dt><dd>${escapeHtml(String((capability?.modes||MODES.map(mode=>mode.id)).length))} bounded workflows</dd></div><div><dt>Execution</dt><dd>Disabled · research only</dd></div></dl></div></section>
    <section class="q-chat-mode-grid" aria-label="Qelly Chat modes">${modeCards(escapeHtml)}</section>
    ${adSlot('research-inline')}
    <section class="q-panel q-chat-evidence-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Research sources</p><h2>Available coverage, without substitute data</h2><p>Source list updated ${escapeHtml(registryTime)}. Availability reflects connection state; current observation timestamps appear in Qelly answer source receipts.</p></div><span class="q-status q-status--${connected?'cached':'unavailable'}">${connected} sources connected</span></div><div class="q-panel-body"><div class="q-chat-dataset-grid">${items.length?items.map((item)=>`<article><span>${escapeHtml(item.category)}</span><strong>${escapeHtml(item.name)}</strong><small class="q-status q-status--${item.access==='connected'?'cached':'unavailable'}">${escapeHtml(String(item.access||'unavailable').replaceAll('_',' '))}</small><small>Source list updated · ${escapeHtml(registryTime)}</small><small>Source status · ${escapeHtml(String(item.truthState||'unavailable').replaceAll('_',' '))}</small></article>`).join(''):'<div class="q-empty"><h3>Research sources reconnecting</h3><p>You can still open Qelly Chat; unavailable coverage will remain explicit.</p></div>'}</div></div></section>
    <section class="q-chat-handoff"><div><span>Evidence</span><strong>Inspect source state</strong><button type="button" data-route="qelly-verify">Open Verify</button></div><div><span>Dossier</span><strong>Review the selected asset</strong><button type="button" data-route="asset" ${contextAsset?'':'disabled'}>Open Asset Dossier</button></div><div><span>Decision</span><strong>Review the research view</strong><button type="button" data-route="decision-provenance">Open Decision Intelligence</button></div><div><span>Formula</span><strong>Test quantitative evidence</strong><button type="button" data-route="formula-screener">Open Formula Screener</button></div></section>
    <div class="q-truth-callout"><span class="q-status q-status--unavailable">human in control</span><p>Qelly Chat provides research support, not personalized financial advice. It cannot place orders, move assets or execute a decision.</p></div>
  </section>`;
  mountAdSlots(main);
  const open=(mode='ask',prompt='')=>document.dispatchEvent(new CustomEvent('qelly:open-ai',{detail:{mode,prompt,expand:true,asset:contextAsset||undefined,timeframe:contextTimeframe}}));
  main.querySelector('[data-chat-action="open"]')?.addEventListener('click',()=>open('ask'));
  main.querySelector('[data-chat-action="decision"]')?.addEventListener('click',()=>open('decision',MODES.find((mode)=>mode.id==='decision').prompt));
  main.querySelector('[data-chat-action="research"]')?.addEventListener('click',()=>open('research',MODES[0].prompt));
  main.querySelector('[data-chat-action="evidence"]')?.addEventListener('click',()=>navigate('qelly-verify'));
  main.querySelectorAll('[data-chat-mode]').forEach((button)=>button.addEventListener('click',()=>open(button.dataset.chatMode,button.dataset.chatPrompt)));
  main.querySelectorAll('[data-route]').forEach((button)=>button.addEventListener('click',()=>{
    const route=button.dataset.route;
    if(route==='asset'&&contextAsset){navigate('asset','QI-CRYPTO-'+contextAsset);return;}
    if(route==='decision-provenance'&&contextAsset)storeDecisionContext({asset:contextAsset,timeframe:contextTimeframe,source:'qelly-chat-workspace',formulaId:contextFormula});
    navigate(route);
  }));
}

export const __qellyChatWorkspaceTest=Object.freeze({MODES,peekResearchContext,storeDecisionContext});
