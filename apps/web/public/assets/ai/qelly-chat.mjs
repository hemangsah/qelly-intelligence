const STORAGE_KEY='qelly.intelligence.chat.v1';
const DECISION_DRAFT_KEY='qelly.decision.draft.v1';
const MAX_MESSAGES=24;
const CHAT_MODES=Object.freeze([
  {id:'research',label:'Research'},
  {id:'compare',label:'Compare'},
  {id:'explain',label:'Explain'},
  {id:'decision',label:'Decision'}
]);

const esc=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const safeUrl=(value)=>{try{const url=new URL(String(value));return url.protocol==='https:'?url.toString():'#';}catch{return '#';}};
const suggestions=Object.freeze([
  'Compare India, US and China GDP growth and inflation',
  'What are BTC, ETH and SOL trading at right now?',
  'Explain the latest ECB euro reference rates',
  'Which global finance datasets can Qelly access?'
]);

function restore(){
  try{
    const value=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'[]');
    if(!Array.isArray(value))return [];
    return value.slice(-MAX_MESSAGES).filter((item)=>['user','assistant'].includes(item?.role)&&typeof item?.content==='string');
  }catch{return [];}
}

function persist(messages){
  try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(messages.slice(-MAX_MESSAGES).map(({id=null,role,content,sources=[],actions=[],truthState=null,generatedAt=null,evidence=null,inference=null,mode='research'})=>({id,role,content,sources,actions,truthState,generatedAt,evidence,inference,mode}))));}catch{}
}

const truthLabel=(value)=>({conversational:'QELLY AI',grounded_model_inference:'GROUNDED AI',grounded_fallback:'DATASET ANSWER',grounding_validation_fallback:'VERIFIED DATASET ANSWER',grounded_registry_answer:'GOVERNED REGISTRY',model_unavailable_fallback:'MODEL DEGRADED'}[value]||'QELLY');

const conversationalReply=(message)=>{
  const normalized=String(message??'').trim().toLowerCase().replace(/[.!?]+$/g,'').trim();
  if(/^(hi|hello|hey|hiya|good morning|good afternoon|good evening)$/.test(normalized)){
    return 'Hi — I’m Qelly Intelligence AI. I can help you explore markets, compare assets and economies, explain financial concepts, and inspect the sources behind every data-backed answer. What would you like to research?';
  }
  if(/^(who are you|what are you|what is qelly|tell me about yourself)$/.test(normalized)){
    return 'I’m Qelly Intelligence AI, the evidence-first research assistant for Qelly Intelligence. I answer financial questions using connected, source-labelled datasets and clearly disclose when coverage is delayed, restricted, or unavailable.';
  }
  if(/^(thanks|thank you|thankyou|cheers)$/.test(normalized)){
    return 'You’re welcome. I’m ready whenever you want to explore a market, compare economies, inspect a source, or understand a financial concept.';
  }
  return null;
};

function sourceList(sources=[]){
  const available=sources.filter((source)=>source?.truthState&&source.truthState!=='unavailable');
  if(!available.length)return '';
  return `<details class="q-ai-message-sources"><summary>${available.length} ${available.length===1?'source':'sources'} and freshness</summary><div>${available.map((source,index)=>`<a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer nofollow"><span>${index+1}</span><strong>${esc(source.title)}</strong><small>${esc(source.truthState)}${source.observedAt?` · ${esc(source.observedAt)}`:''}</small></a>`).join('')}</div></details>`;
}

function actionList(actions=[]){
  if(!actions.length)return '';
  return `<div class="q-ai-message-actions">${actions.map((action)=>`<button type="button" data-q-ai-route="${esc(action.route)}">${esc(action.label)} <span aria-hidden="true">→</span></button>`).join('')}</div>`;
}

function evidenceMarkup(message){
  if(message.role!=='assistant')return '';
  const used=Number(message.evidence?.used??message.sources?.filter((source)=>source?.truthState&&source.truthState!=='unavailable').length??0);
  const time=message.generatedAt?new Date(message.generatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'now';
  return `<div class="q-ai-message-evidence"><span>${used} evidence source${used===1?'':'s'}</span><span>${esc(message.mode||'research')} mode</span><span>${esc(time)}</span></div>`;
}

function messageMarkup(message,index){
  const assistant=message.role==='assistant';
  return `<article class="q-ai-message q-ai-message--${assistant?'assistant':'user'}" data-q-ai-message-role="${message.role}" data-q-ai-message-index="${index}">
    <header><span>${assistant?'Qelly Intelligence':'You'}</span>${assistant&&message.truthState?`<em>${esc(truthLabel(message.truthState))}</em>`:''}</header>
    <div class="q-ai-message-copy">${esc(message.content)}</div>
    ${assistant?evidenceMarkup(message):''}${assistant?sourceList(message.sources):''}${assistant?actionList(message.actions):''}
    ${assistant?`<div class="q-ai-message-tools"><button type="button" data-q-ai-copy="${index}">Copy</button><button type="button" data-q-ai-verify="${index}">Verify evidence</button><button type="button" data-q-ai-decision="${index}">Build decision</button></div>`:''}
  </article>`;
}

function shellMarkup(){
  return `<button class="q-ai-launcher" type="button" data-q-ai-launcher aria-controls="qelly-ai-assistant" aria-expanded="false"><img src="./assets/brand/qelly-symbol.svg" width="38" height="38" alt=""><span><strong>Ask Qelly</strong><small>Finance intelligence</small></span><i aria-hidden="true">⌘ /</i></button>
  <aside class="q-ai-assistant" id="qelly-ai-assistant" data-q-ai-assistant role="dialog" aria-label="Qelly Intelligence financial research assistant" aria-modal="false" hidden>
    <header class="q-ai-header"><div class="q-ai-brand"><img src="./assets/brand/qelly-symbol.svg" width="36" height="36" alt=""><span><strong>Qelly Intelligence</strong><small><i data-q-ai-status-dot></i><span data-q-ai-status>Connecting to datasets…</span></small></span></div><div><button type="button" data-q-ai-new>New</button><button type="button" data-q-ai-expand aria-pressed="false">Expand</button><button type="button" data-q-ai-datasets aria-expanded="false" aria-controls="q-ai-dataset-panel">Evidence</button><button type="button" data-q-ai-close aria-label="Close Qelly Intelligence">×</button></div></header>
    <section class="q-ai-dataset-panel" id="q-ai-dataset-panel" data-q-ai-dataset-panel hidden><div><strong>Finance data coverage</strong><span data-q-ai-dataset-summary>Checking source registry…</span></div><div data-q-ai-dataset-list></div><p>Qelly connects only authorized sources. Restricted institutional datasets remain clearly labelled and are never scraped.</p></section>
    <div class="q-ai-modebar" role="toolbar" aria-label="Qelly analysis mode">${CHAT_MODES.map((item)=>`<button type="button" data-q-ai-mode="${item.id}" aria-pressed="${item.id==='research'?'true':'false'}">${item.label}</button>`).join('')}</div>
    <div class="q-ai-thread" data-q-ai-thread aria-live="polite" aria-relevant="additions text"></div>
    <div class="q-ai-suggestions" data-q-ai-suggestions>${suggestions.map((item)=>`<button type="button" data-q-ai-suggestion="${esc(item)}">${esc(item)}</button>`).join('')}</div>
    <form class="q-ai-composer" data-q-ai-form><label><span class="q-visually-hidden">Ask Qelly a finance question</span><textarea name="message" rows="1" maxlength="2400" placeholder="Ask about markets, macro, FX, crypto, risk or datasets…" required></textarea></label><button type="submit" data-q-ai-send><span>Send</span><b aria-hidden="true">↑</b></button></form>
    <footer><span>Connected evidence + model inference</span><div><button type="button" data-q-ai-export>Export</button><button type="button" data-q-ai-clear>Clear</button></div><small>Research only · no trade execution</small></footer>
  </aside>`;
}

export function installQellyChat({api,navigate,toast,staticVisualPreview=false}={}){
  if(document.querySelector('[data-q-ai-launcher]'))return;
  const root=document.createElement('div');
  root.className='q-ai-root';
  root.innerHTML=shellMarkup();
  document.body.append(root);
  const launcher=root.querySelector('[data-q-ai-launcher]');
  const panel=root.querySelector('[data-q-ai-assistant]');
  const closeButton=root.querySelector('[data-q-ai-close]');
  const form=root.querySelector('[data-q-ai-form]');
  const input=form.querySelector('textarea');
  const send=form.querySelector('[data-q-ai-send]');
  const thread=root.querySelector('[data-q-ai-thread]');
  const suggestionsNode=root.querySelector('[data-q-ai-suggestions]');
  const datasetButton=root.querySelector('[data-q-ai-datasets]');
  const datasetPanel=root.querySelector('[data-q-ai-dataset-panel]');
  let messages=restore();
  let sending=false;
  let capability=null;
  let mode='research';

  const bindActions=()=>{
    thread.querySelectorAll('[data-q-ai-route]').forEach((button)=>button.addEventListener('click',()=>{navigate?.(button.dataset.qAiRoute);close();}));
    thread.querySelectorAll('[data-q-ai-copy]').forEach((button)=>button.addEventListener('click',async()=>{const message=messages[Number(button.dataset.qAiCopy)];if(!message)return;try{await navigator.clipboard.writeText(message.content);toast?.('Qelly answer copied',{tone:'success'});}catch{toast?.('Copy is unavailable in this browser.',{tone:'danger'});}}));
    thread.querySelectorAll('[data-q-ai-verify]').forEach((button)=>button.addEventListener('click',()=>{const message=messages[Number(button.dataset.qAiVerify)];try{sessionStorage.setItem('qelly.verify.chat-evidence.v1',JSON.stringify({createdAt:new Date().toISOString(),content:message?.content,sources:message?.sources||[]}));}catch{}navigate?.('qelly-verify');close();}));
    thread.querySelectorAll('[data-q-ai-decision]').forEach((button)=>button.addEventListener('click',()=>{const message=messages[Number(button.dataset.qAiDecision)];try{sessionStorage.setItem(DECISION_DRAFT_KEY,JSON.stringify({createdAt:new Date().toISOString(),thesis:message?.content||'',sources:message?.sources||[],truthState:message?.truthState||null}));}catch{}navigate?.('decision-provenance');close();}));
  };
  const render=()=>{
    thread.innerHTML=messages.length?messages.map(messageMarkup).join(''):`<section class="q-ai-welcome"><span>Qelly flagship intelligence workspace</span><h2>Ask. Verify.<br>Decide with provenance.</h2><p>I can research connected finance observations, compare evidence, explain methods and hand a sourced thesis directly into the Decision Command Center.</p><div><b>GROUNDED</b> Every available current claim carries source state</div><div><b>GOVERNED</b> Missing or restricted evidence remains visible</div><div><b>CONNECTED</b> One-click decision and verification handoff</div></section>`;
    suggestionsNode.hidden=messages.length>0;
    bindActions();
    requestAnimationFrame(()=>{thread.scrollTop=thread.scrollHeight;});
  };
  const setOpen=(open)=>{
    panel.hidden=!open;
    launcher.setAttribute('aria-expanded',String(open));
    launcher.classList.toggle('is-hidden',open);
    document.documentElement.classList.toggle('q-ai-open',open&&matchMedia('(max-width:640px)').matches);
    if(open)setTimeout(()=>input.focus(),50);
  };
  const setMode=(next)=>{mode=CHAT_MODES.some((item)=>item.id===next)?next:'research';root.querySelectorAll('[data-q-ai-mode]').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.qAiMode===mode)));};
  const open=(prompt='',requestedMode='')=>{setOpen(true);if(requestedMode)setMode(requestedMode);if(prompt&&!input.value)input.value=String(prompt).slice(0,2400);};
  const close=()=>setOpen(false);
  const setBusy=(value)=>{sending=value;send.disabled=value;input.disabled=value;send.querySelector('span').textContent=value?'Thinking…':'Send';panel.classList.toggle('is-thinking',value);};

  const loadCapability=async()=>{
    if(staticVisualPreview)throw new Error('Static preview');
    capability=await api('/api/v1/intelligence/chat');
    const assistant=capability.assistant||{};
    root.querySelector('[data-q-ai-status]').textContent=assistant.inferenceAvailable?'Workers AI · grounded':'Grounded dataset mode';
    root.querySelector('[data-q-ai-status-dot]').dataset.state=assistant.inferenceAvailable?'live':'reference';
    const datasets=capability.datasets||{};
    root.querySelector('[data-q-ai-dataset-summary]').textContent=`${datasets.connected||0} connected · ${datasets.catalogued||0} governed entries`;
    root.querySelector('[data-q-ai-dataset-list]').innerHTML=(datasets.items||[]).slice(0,8).map((item)=>`<article><span>${esc(item.category)}</span><strong>${esc(item.name)}</strong><em data-state="${item.access==='connected'?'live':'restricted'}">${esc(item.access.replaceAll('_',' '))}</em></article>`).join('');
  };

  const submit=async(message)=>{
    const value=String(message||'').trim();
    if(!value||sending)return;
    const history=messages.slice(-10).map(({role,content})=>({role,content}));
    messages.push({role:'user',content:value,mode,generatedAt:new Date().toISOString()});
    persist(messages);render();input.value='';
    const conversationalAnswer=conversationalReply(value);
    if(conversationalAnswer){
      messages.push({role:'assistant',content:conversationalAnswer,sources:[],actions:[],truthState:'conversational',generatedAt:new Date().toISOString()});
      persist(messages);render();input.focus();
      return;
    }
    setBusy(true);
    try{
      const result=await api('/api/v1/intelligence/chat',{method:'POST',body:JSON.stringify({message:value,history,mode})});
      messages.push({id:result.id,role:'assistant',content:result.content,sources:result.sources||[],actions:result.actions||[],truthState:result.truthState,generatedAt:result.generatedAt,evidence:result.evidence||{used:result.datasets?.used||0},inference:result.inference||null,mode:result.mode||mode});
      persist(messages);render();
    }catch(error){
      messages.push({role:'assistant',content:`I could not reach the Qelly intelligence service. ${error.message||'Please try again.'}`,sources:[],actions:[{route:'market',label:'Open Market Command'}],truthState:'model_unavailable_fallback',generatedAt:new Date().toISOString()});
      persist(messages);render();toast?.('Qelly Intelligence could not complete that request.',{tone:'danger'});
    }finally{setBusy(false);input.focus();}
  };

  launcher.addEventListener('click',()=>open());
  closeButton.addEventListener('click',close);
  form.addEventListener('submit',(event)=>{event.preventDefault();submit(input.value);});
  input.addEventListener('keydown',(event)=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
  root.querySelectorAll('[data-q-ai-suggestion]').forEach((button)=>button.addEventListener('click',()=>submit(button.dataset.qAiSuggestion)));
  root.querySelectorAll('[data-q-ai-mode]').forEach((button)=>button.addEventListener('click',()=>setMode(button.dataset.qAiMode)));
  root.querySelector('[data-q-ai-new]').addEventListener('click',()=>{messages=[];persist(messages);setMode('research');render();input.value='';input.focus();});
  root.querySelector('[data-q-ai-expand]').addEventListener('click',(event)=>{const expanded=panel.classList.toggle('is-expanded');event.currentTarget.setAttribute('aria-pressed',String(expanded));event.currentTarget.textContent=expanded?'Compact':'Expand';});
  root.querySelector('[data-q-ai-export]').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({schemaVersion:'qelly.chat.export/1.0.0',exportedAt:new Date().toISOString(),messages},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`qelly-chat-${new Date().toISOString().slice(0,10)}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast?.('Qelly conversation exported',{tone:'success'});});
  root.querySelector('[data-q-ai-clear]').addEventListener('click',()=>{messages=[];persist(messages);render();input.focus();});
  datasetButton.addEventListener('click',()=>{const expanded=datasetButton.getAttribute('aria-expanded')!=='true';datasetButton.setAttribute('aria-expanded',String(expanded));datasetPanel.hidden=!expanded;});
  document.addEventListener('qelly:open-ai',(event)=>open(event.detail?.prompt||'',event.detail?.mode||''));
  window.addEventListener('keydown',(event)=>{if((event.ctrlKey||event.metaKey)&&event.key==='/'){event.preventDefault();panel.hidden?open():close();}if(event.key==='Escape'&&!panel.hidden)close();});
  render();
  loadCapability().catch(()=>{root.querySelector('[data-q-ai-status]').textContent=staticVisualPreview?'Static preview':'Dataset service reconnecting';root.querySelector('[data-q-ai-status-dot]').dataset.state='reference';});
}

export const __qellyChatTest=Object.freeze({STORAGE_KEY,DECISION_DRAFT_KEY,MAX_MESSAGES,CHAT_MODES,suggestions,truthLabel,safeUrl,conversationalReply});
