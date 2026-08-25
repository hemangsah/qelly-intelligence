const AI_PROVIDERS=Object.freeze([
  {id:'chatgpt',name:'ChatGPT',maker:'OpenAI',url:'https://chatgpt.com/',accent:'#10a37f'},
  {id:'claude',name:'Claude',maker:'Anthropic',url:'https://claude.ai/new',accent:'#d97757'},
  {id:'deepseek',name:'DeepSeek',maker:'DeepSeek',url:'https://chat.deepseek.com/',accent:'#4d6bfe'},
  {id:'gemini',name:'Gemini',maker:'Google',url:'https://gemini.google.com/',accent:'#8e75ff'},
  {id:'perplexity',name:'Perplexity',maker:'Perplexity AI',url:'https://www.perplexity.ai/',accent:'#20b8cd'},
  {id:'mistral',name:'Le Chat',maker:'Mistral AI',url:'https://chat.mistral.ai/chat',accent:'#ff7a00'},
  {id:'copilot',name:'Copilot',maker:'Microsoft',url:'https://copilot.microsoft.com/',accent:'#2a7de1'},
  {id:'grok',name:'Grok',maker:'xAI',url:'https://x.com/i/grok',accent:'#c7c9d1'}
]);

const NEWS_SOURCES=Object.freeze([
  {name:'ECB',label:'Central-bank releases',url:'https://www.ecb.europa.eu/press/html/index.en.html',scope:'Official monetary-policy and statistics releases'},
  {name:'RBI',label:'India policy releases',url:'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx',scope:'Official Reserve Bank of India press releases'},
  {name:'SEC',label:'Regulatory newsroom',url:'https://www.sec.gov/newsroom',scope:'Official U.S. securities regulator announcements'},
  {name:'Reuters',label:'Markets newsroom',url:'https://www.reuters.com/markets/',scope:'External publisher; content remains on Reuters'}
]);

const COMMUNITY_LINKS=Object.freeze([
  {name:'X Market Search',url:'https://x.com/search?q=markets&src=typed_query',detail:'Open the live public conversation on X in a separate trust boundary.'},
  {name:'Reddit Investing',url:'https://www.reddit.com/r/investing/',detail:'Community discussion; verify every claim against primary evidence.'},
  {name:'Qelly on GitHub',url:'https://github.com/hemangsah/qelly-intelligence',detail:'Inspect source, releases and deployment evidence.'}
]);

const esc=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const external=(item,copy='Open')=>`<a class="q-it-external" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer nofollow"><span>${copy}</span><b aria-hidden="true">↗</b></a>`;
const stateTone=(value)=>value===true?'live':'unavailable';

function guide(prompt){
  const value=String(prompt||'').trim().toLowerCase();
  if(!value)return {title:'Start with a research question',body:'Describe the market, calculation, evidence or workspace you want to open.',route:'feature-universe',label:'Browse features'};
  if(/verify|evidence|source|fact|claim/.test(value))return {title:'Verify the evidence chain',body:'Open Qelly Verify to inspect source identity, timestamps and confidence boundaries.',route:'qelly-verify',label:'Open Qelly Verify'};
  if(/portfolio|watchlist|alert/.test(value))return {title:'Use a private workspace',body:'Portfolio, watchlist and alert data is workspace-scoped. Qelly will preserve the destination and request sign-in.',route:/portfolio/.test(value)?'portfolio-analytics':/alert/.test(value)?'alert-center':'watchlist',label:'Open workspace'};
  if(/sip|tax|india|emi/.test(value))return {title:'Use India finance tools',body:'Open the governed India calculator collection with explicit effective-date rules.',route:'india-finance',label:'Open India tools'};
  if(/calculate|formula|indicator|risk|return/.test(value))return {title:'Open quantitative tools',body:'Use the calculator, formula and indicator library for reproducible analysis.',route:'calculator-center',label:'Open calculators'};
  if(/news|research|community|social|ai|chat/.test(value))return {title:'Stay in the intelligence terminal',body:'Use the tabs below for governed sources, private notes and safe outbound AI launches.',route:'news-research',label:'Open terminal'};
  return {title:'Open market command',body:'Start with the governed market overview, then follow source and freshness evidence into deeper tools.',route:'market',label:'Open markets'};
}

function providerCards(providers=[]){
  const approvedReference=providers.filter((item)=>item.enabled===true).map((item)=>String(item.id||'').toUpperCase());
  return AI_PROVIDERS.map((item)=>`<article class="q-it-provider" style="--provider-accent:${item.accent}"><div class="q-it-provider__mark" aria-hidden="true">${esc(item.name.slice(0,2).toUpperCase())}</div><div><p>${esc(item.maker)}</p><h3>${esc(item.name)}</h3><span class="q-status q-status--cached">EXTERNAL LAUNCH</span></div>${external(item,'Open chat')}<small>No Qelly API credential or conversation access is claimed. Prompts leave Qelly only after you open the provider.</small></article>`).join('')+`<article class="q-it-provider q-it-provider--qelly"><div class="q-it-provider__mark" aria-hidden="true">QI</div><div><p>Qelly providers</p><h3>Governed data plane</h3><span class="q-status q-status--${stateTone(approvedReference.length>0)}">${approvedReference.length?`${esc(approvedReference.join(', '))} REFERENCE`:'UNAVAILABLE'}</span></div><a class="q-it-external" href="#/data-mesh"><span>Provider status</span><b aria-hidden="true">→</b></a><small>Provider rights and truth state remain attached to Qelly observations.</small></article>`;
}

function renderPrivateNotes(container,notes){
  container.innerHTML=notes.length?notes.map((note,index)=>`<article class="q-it-note"><header><span>Private research note</span><time>${esc(note.at)}</time></header><p>${esc(note.text)}</p><button type="button" data-note-remove="${index}">Remove</button></article>`).join(''):'<div class="q-empty-state"><strong>Your private stream is empty.</strong><p>Add a note above. Notes stay only in this browser tab and are never published as community claims.</p></div>';
}

export async function renderIntelligenceTerminal(main,deps){
  const {api,pageHead,stateBanner,navigate,toast}=deps;
  const [providersResult,networkResult,healthResult]=await Promise.allSettled([
    api('/api/v1/providers/status'),
    api('/api/v1/market/network'),
    api('/api/v1/health')
  ]);
  const providers=providersResult.status==='fulfilled'?(providersResult.value.providers||[]):[];
  const network=networkResult.status==='fulfilled'?networkResult.value:{};
  const health=healthResult.status==='fulfilled'?healthResult.value:{};
  const sources=Object.entries(network.sources||{}).slice(0,8);
  main.innerHTML=`<section class="q-page q-intelligence-terminal" data-intelligence-terminal="v1">
    ${pageHead('Qelly Intelligence · AI, news and community','Intelligence Terminal','One evidence-first command surface for Qelly research, provider-safe AI launches, official newsrooms and a private community-style research stream.',`<a class="q-button q-button--primary" href="#/market">Open Market Command</a>`)}${stateBanner()}
    <section class="q-it-hero"><div class="q-it-hero__grid" aria-hidden="true"></div><div class="q-it-hero__copy"><span class="q-it-kicker"><i></i> SYSTEM ${health.status==='ok'?'ONLINE':'DEGRADED'}</span><h2>Ask. Route. Verify.<br><em>Never fabricate.</em></h2><p>Qelly Guide routes your request locally. External AI providers open separately because no approved server-side AI credentials are configured and third-party chat sites do not provide safe embedded sessions.</p></div><div class="q-it-radar" aria-hidden="true"><span>Q</span><i style="--i:0">AI</i><i style="--i:1">NEWS</i><i style="--i:2">DATA</i><i style="--i:3">COMMUNITY</i></div></section>
    <section class="q-it-guide" aria-labelledby="q-it-guide-title"><div><p class="q-eyebrow">Qelly Guide · local route intelligence</p><h2 id="q-it-guide-title">What do you want to investigate?</h2><p>This assistant performs no model inference and sends no prompt to a third party.</p></div><form data-it-guide><label><span class="q-visually-hidden">Research request</span><textarea name="prompt" rows="2" maxlength="500" placeholder="Try: verify a market claim, calculate SIP returns, open my watchlist…"></textarea></label><button class="q-button q-button--primary" type="submit">Route my request</button></form><div class="q-it-guide__answer" data-it-answer aria-live="polite"><strong>Ready for a research request.</strong><span>Suggestions remain inside Qelly until you explicitly open an external provider.</span></div></section>
    <div class="q-it-tabs" role="tablist" aria-label="Intelligence terminal sections"><button type="button" role="tab" aria-selected="true" aria-controls="q-it-ai" id="q-it-tab-ai" data-it-tab="ai">AI Network</button><button type="button" role="tab" aria-selected="false" aria-controls="q-it-news" id="q-it-tab-news" data-it-tab="news">Newsroom</button><button type="button" role="tab" aria-selected="false" aria-controls="q-it-community" id="q-it-tab-community" data-it-tab="community">Community Desk</button><button type="button" role="tab" aria-selected="false" aria-controls="q-it-evidence" id="q-it-tab-evidence" data-it-tab="evidence">Provider Evidence</button></div>
    <section id="q-it-ai" class="q-it-panel" role="tabpanel" aria-labelledby="q-it-tab-ai" data-it-panel="ai"><header><div><p class="q-eyebrow">Provider launchpad</p><h2>Choose the right intelligence surface</h2></div><span class="q-status q-status--cached">NO SHARED PROMPTS</span></header><div class="q-it-provider-grid">${providerCards(providers)}</div></section>
    <section id="q-it-news" class="q-it-panel" role="tabpanel" aria-labelledby="q-it-tab-news" data-it-panel="news" hidden><header><div><p class="q-eyebrow">Official and external newsrooms</p><h2>News without a fake feed</h2></div><span class="q-status q-status--delayed">OUTBOUND SOURCES</span></header><div class="q-it-news-grid">${NEWS_SOURCES.map((item)=>`<article><span>${esc(item.name)}</span><h3>${esc(item.label)}</h3><p>${esc(item.scope)}</p>${external(item,'Open newsroom')}</article>`).join('')}</div><div class="q-truth-callout"><span class="q-status q-status--unavailable">CONTENT RIGHTS</span><p>Headlines and articles remain on their publishers. Qelly does not scrape, reproduce or generate substitute news content.</p></div></section>
    <section id="q-it-community" class="q-it-panel" role="tabpanel" aria-labelledby="q-it-tab-community" data-it-panel="community" hidden><header><div><p class="q-eyebrow">Community-style research stream</p><h2>Think publicly. Draft privately.</h2></div><span class="q-status q-status--cached">BROWSER PRIVATE</span></header><div class="q-it-community-grid"><form data-it-note-form><label><span>Add a private market note</span><textarea name="note" maxlength="600" rows="4" placeholder="Capture a thesis, contradiction or question…"></textarea></label><div><small>Not published · not synced · not financial advice</small><button class="q-button q-button--primary" type="submit">Add to stream</button></div></form><aside><h3>Community connections</h3>${COMMUNITY_LINKS.map((item)=>`<article><div><strong>${esc(item.name)}</strong><p>${esc(item.detail)}</p></div>${external(item,'Open')}</article>`).join('')}</aside></div><div class="q-it-note-stream" data-it-notes aria-live="polite"></div></section>
    <section id="q-it-evidence" class="q-it-panel" role="tabpanel" aria-labelledby="q-it-tab-evidence" data-it-panel="evidence" hidden><header><div><p class="q-eyebrow">Source coverage</p><h2>Every provider state, clearly explained</h2></div><span class="q-status q-status--${stateTone(providersResult.status==='fulfilled')}">${providersResult.status==='fulfilled'?'CURRENT':'REFRESHING'}</span></header><div class="q-it-evidence-grid">${providers.map((provider)=>{const availability=providerAvailability(provider);return `<article><div><strong>${esc(String(provider.id||'provider').toUpperCase())}</strong><span class="q-status q-status--${availability.tone}">${esc(availability.label)}</span></div><p>${esc(providerPolicyMessage(provider))}</p></article>`;}).join('')||'<div class="q-empty-state"><strong>Source status is refreshing.</strong><p>The terminal remains available for research and external sources.</p></div>'}${sources.map(([id,source])=>`<article><div><strong>${esc(String(id).toUpperCase())}</strong><span class="q-status q-status--cached">${esc(truthLabel(source?.truthState||source?.state))}</span></div><p>${esc(source?.attribution||source?.name||'External source')}</p></article>`).join('')}</div><details class="q-it-json"><summary>About this terminal</summary><div class="q-v7-evidence-strip"><span>${providers.length} registered sources</span><span>${sources.length} connected research sources</span><span>Prompts stay private until you open an external provider</span><span>No trade execution</span></div></details></section>
  </section>`;

  const tabs=[...main.querySelectorAll('[data-it-tab]')];
  const panels=[...main.querySelectorAll('[data-it-panel]')];
  const activate=(name)=>{tabs.forEach((tab)=>{const active=tab.dataset.itTab===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});panels.forEach((panel)=>{panel.hidden=panel.dataset.itPanel!==name;});};
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>activate(tab.dataset.itTab));tab.addEventListener('keydown',(event)=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const delta=event.key==='ArrowRight'?1:-1;const next=tabs[(index+delta+tabs.length)%tabs.length];activate(next.dataset.itTab);next.focus();});});

  const form=main.querySelector('[data-it-guide]');
  form?.addEventListener('submit',(event)=>{event.preventDefault();const result=guide(new FormData(form).get('prompt'));const answer=main.querySelector('[data-it-answer]');answer.innerHTML=`<strong>${esc(result.title)}</strong><span>${esc(result.body)}</span><button type="button" class="q-button q-button--secondary" data-it-route="${esc(result.route)}">${esc(result.label)} →</button>`;answer.querySelector('[data-it-route]')?.addEventListener('click',()=>navigate(result.route));});

  let notes=[];
  try{notes=JSON.parse(sessionStorage.getItem('qelly.privateResearchStream')||'[]');if(!Array.isArray(notes))notes=[];}catch{notes=[];}
  const notesContainer=main.querySelector('[data-it-notes]');
  const persist=()=>{sessionStorage.setItem('qelly.privateResearchStream',JSON.stringify(notes.slice(0,20)));renderPrivateNotes(notesContainer,notes);notesContainer.querySelectorAll('[data-note-remove]').forEach((button)=>button.addEventListener('click',()=>{notes.splice(Number(button.dataset.noteRemove),1);persist();}));};
  main.querySelector('[data-it-note-form]')?.addEventListener('submit',(event)=>{event.preventDefault();const note=String(new FormData(event.currentTarget).get('note')||'').trim();if(!note){toast?.('Write a note before adding it to the private stream.',{tone:'danger'});return;}notes.unshift({text:note,at:new Date().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})});event.currentTarget.reset();persist();toast?.('Private research note added to this browser tab.',{tone:'success'});});
  persist();
}

export const __intelligenceTerminalTest=Object.freeze({AI_PROVIDERS,NEWS_SOURCES,COMMUNITY_LINKS,guide});
import {providerAvailability,providerPolicyMessage,truthLabel} from '../customer-copy.mjs';
