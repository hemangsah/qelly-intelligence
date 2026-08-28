const STYLESHEET=new URL('../qelly-chat-workspace.css',import.meta.url).href;
const MODES=Object.freeze([
  {id:'research',step:'01',title:'Research',copy:'Synthesize connected finance observations with source state, timestamps and explicit coverage gaps.',prompt:'Research the current market context for Bitcoin. Separate observations, inference, missing evidence and what I should verify next.'},
  {id:'compare',step:'02',title:'Compare',copy:'Contrast assets, economies or datasets without hiding unavailable or mismatched evidence.',prompt:'Compare Bitcoin, Ethereum and Solana using only available evidence. Show source freshness, disagreements and missing data.'},
  {id:'explain',step:'03',title:'Explain',copy:'Turn market or methodology questions into a transparent, evidence-linked explanation.',prompt:'Explain the latest available ECB reference-rate evidence, its effective date, limitations and what can be inferred.'},
  {id:'decision',step:'04',title:'Decide',copy:'Stress a thesis, expose contradictions and hand the result into Decision Provenance for human judgment.',prompt:'Help me frame a falsifiable Bitcoin decision thesis. Include supporting evidence, contradictions, uncertainty and an invalidation condition.'}
]);

const activateStyles=()=>{
  if(document.querySelector('link[data-qelly-chat-workspace]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=STYLESHEET;link.dataset.qellyChatWorkspace='active';document.head.append(link);
};

const modeCards=(escapeHtml)=>MODES.map((mode)=>`<article class="q-chat-mode-card"><span>${mode.step}</span><h2>${escapeHtml(mode.title)}</h2><p>${escapeHtml(mode.copy)}</p><button class="q-button q-button--secondary" type="button" data-chat-mode="${mode.id}" data-chat-prompt="${escapeHtml(mode.prompt)}">Start ${escapeHtml(mode.title)}</button></article>`).join('');

export async function renderQellyChatWorkspace(main,{api,pageHead,stateBanner,escapeHtml,navigate}){
  activateStyles();
  let capability=null;
  try{capability=await api('/api/v1/intelligence/chat');}catch{}
  const datasets=capability?.datasets||{};
  const assistant=capability?.assistant||{};
  const policy=capability?.policy||{};
  const connected=Number(datasets.connected)||0;
  const catalogued=Number(datasets.catalogued)||0;
  const provider=assistant.inferenceAvailable?'Cloudflare Workers AI + governed datasets':'Governed dataset answer engine';
  const items=(datasets.items||[]).slice(0,8);
  main.innerHTML=`<section class="q-page q-chat-workspace">${pageHead('Qelly flagship intelligence workspace','Qelly Chat','Research, compare, explain and decide with connected evidence. Every available current claim exposes its source state; every missing source stays visible.',`<button class="q-button q-button--secondary" type="button" data-chat-action="evidence">Inspect evidence</button><button class="q-button q-button--primary" type="button" data-chat-action="open">Open full Qelly Chat</button>`)}${stateBanner()}
    <section class="q-chat-hero" aria-label="Qelly Chat workflow"><div class="q-chat-hero__copy"><p class="q-eyebrow">Ask → Ground → Verify → Decide</p><h2>From question to an auditable decision path.</h2><p>Qelly keeps source-backed observations, model inference, user assumptions and unavailable coverage separate—then hands a sourced thesis directly to verification or the Decision Command Center.</p><div class="q-chat-hero__actions"><button class="q-button q-button--primary" type="button" data-chat-action="decision">Build a decision with Qelly</button><button class="q-button q-button--secondary" type="button" data-chat-action="research">Start evidence research</button></div></div><div class="q-chat-runtime"><span class="q-status q-status--${capability?'live':'unavailable'}">${capability?'available':'reconnecting'}</span><dl><div><dt>Answer runtime</dt><dd>${escapeHtml(provider)}</dd></div><div><dt>Connected datasets</dt><dd>${connected} of ${catalogued} governed entries</dd></div><div><dt>Conversation storage</dt><dd>${escapeHtml(policy.conversationStorage||'browser session only')}</dd></div><div><dt>Execution</dt><dd>Disabled · research only</dd></div></dl></div></section>
    <section class="q-chat-mode-grid" aria-label="Qelly Chat modes">${modeCards(escapeHtml)}</section>
    <section class="q-panel q-chat-evidence-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Evidence registry</p><h2>Connected coverage, without fabricated fallback</h2><p>Restricted institutional sources remain labelled. Qelly does not scrape or imply access it does not have.</p></div><span class="q-status q-status--${connected?'cached':'unavailable'}">${connected} connected</span></div><div class="q-panel-body"><div class="q-chat-dataset-grid">${items.length?items.map((item)=>`<article><span>${escapeHtml(item.category)}</span><strong>${escapeHtml(item.name)}</strong><small class="q-status q-status--${item.access==='connected'?'live':'unavailable'}">${escapeHtml(String(item.access||'unavailable').replaceAll('_',' '))}</small></article>`).join(''):'<div class="q-empty"><h3>Dataset registry reconnecting</h3><p>You can still open Qelly Chat; unavailable coverage will remain explicit.</p></div>'}</div></div></section>
    <section class="q-chat-handoff"><div><span>Evidence</span><strong>Inspect source state</strong><button type="button" data-route="qelly-verify">Open Verify</button></div><div><span>Decision</span><strong>Trace human judgment</strong><button type="button" data-route="decision-provenance">Open Decision Provenance</button></div><div><span>Research</span><strong>Organize the dossier</strong><button type="button" data-route="research-workspace">Open Research Workspace</button></div></section>
    <div class="q-truth-callout"><span class="q-status q-status--unavailable">human in control</span><p>Qelly Chat provides research support, not personalized financial advice. It cannot place orders, move assets or execute a decision.</p></div>
  </section>`;
  const open=(mode='research',prompt='')=>document.dispatchEvent(new CustomEvent('qelly:open-ai',{detail:{mode,prompt,expand:true}}));
  main.querySelector('[data-chat-action="open"]')?.addEventListener('click',()=>open());
  main.querySelector('[data-chat-action="decision"]')?.addEventListener('click',()=>open('decision',MODES.find((mode)=>mode.id==='decision').prompt));
  main.querySelector('[data-chat-action="research"]')?.addEventListener('click',()=>open('research',MODES[0].prompt));
  main.querySelector('[data-chat-action="evidence"]')?.addEventListener('click',()=>navigate('qelly-verify'));
  main.querySelectorAll('[data-chat-mode]').forEach((button)=>button.addEventListener('click',()=>open(button.dataset.chatMode,button.dataset.chatPrompt)));
  main.querySelectorAll('[data-route]').forEach((button)=>button.addEventListener('click',()=>navigate(button.dataset.route)));
}

export const __qellyChatWorkspaceTest=Object.freeze({MODES});
