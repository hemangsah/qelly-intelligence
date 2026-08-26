const STORAGE_KEY='qelly.intelligence.chat.v1';
const MAX_MESSAGES=24;

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
  try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(messages.slice(-MAX_MESSAGES).map(({role,content,sources=[],actions=[],truthState=null,generatedAt=null})=>({role,content,sources,actions,truthState,generatedAt}))));}catch{}
}

const truthLabel=(value)=>({grounded_model_inference:'GROUNDED AI',grounded_fallback:'DATASET ANSWER',model_unavailable_fallback:'MODEL DEGRADED'}[value]||'QELLY');

function sourceList(sources=[]){
  const available=sources.filter((source)=>source?.truthState&&source.truthState!=='unavailable');
  if(!available.length)return '';
  return `<details class="q-ai-message-sources"><summary>${available.length} ${available.length===1?'source':'sources'} and freshness</summary><div>${available.map((source,index)=>`<a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer nofollow"><span>${index+1}</span><strong>${esc(source.title)}</strong><small>${esc(source.truthState)}${source.observedAt?` · ${esc(source.observedAt)}`:''}</small></a>`).join('')}</div></details>`;
}

function actionList(actions=[]){
  if(!actions.length)return '';
  return `<div class="q-ai-message-actions">${actions.map((action)=>`<button type="button" data-q-ai-route="${esc(action.route)}">${esc(action.label)} <span aria-hidden="true">→</span></button>`).join('')}</div>`;
}

function messageMarkup(message){
  const assistant=message.role==='assistant';
  return `<article class="q-ai-message q-ai-message--${assistant?'assistant':'user'}" data-q-ai-message-role="${message.role}">
    <header><span>${assistant?'Qelly Intelligence':'You'}</span>${assistant&&message.truthState?`<em>${esc(truthLabel(message.truthState))}</em>`:''}</header>
    <div class="q-ai-message-copy">${esc(message.content)}</div>
    ${assistant?sourceList(message.sources):''}${assistant?actionList(message.actions):''}
  </article>`;
}

function shellMarkup(){
  return `<button class="q-ai-launcher" type="button" data-q-ai-launcher aria-controls="qelly-ai-assistant" aria-expanded="false"><img src="./assets/brand/qelly-symbol.svg" alt=""><span><strong>Ask Qelly</strong><small>Finance intelligence</small></span><i aria-hidden="true">⌘ /</i></button>
  <aside class="q-ai-assistant" id="qelly-ai-assistant" data-q-ai-assistant role="dialog" aria-label="Qelly Intelligence financial research assistant" aria-modal="false" hidden>
    <header class="q-ai-header"><div class="q-ai-brand"><img src="./assets/brand/qelly-symbol.svg" alt=""><span><strong>Qelly Intelligence</strong><small><i data-q-ai-status-dot></i><span data-q-ai-status>Connecting to datasets…</span></small></span></div><div><button type="button" data-q-ai-datasets aria-expanded="false" aria-controls="q-ai-dataset-panel">Datasets</button><button type="button" data-q-ai-close aria-label="Close Qelly Intelligence">×</button></div></header>
    <section class="q-ai-dataset-panel" id="q-ai-dataset-panel" data-q-ai-dataset-panel hidden><div><strong>Finance data coverage</strong><span data-q-ai-dataset-summary>Checking source registry…</span></div><div data-q-ai-dataset-list></div><p>Qelly connects only authorized sources. Restricted institutional datasets remain clearly labelled and are never scraped.</p></section>
    <div class="q-ai-thread" data-q-ai-thread aria-live="polite" aria-relevant="additions text"></div>
    <div class="q-ai-suggestions" data-q-ai-suggestions>${suggestions.map((item)=>`<button type="button" data-q-ai-suggestion="${esc(item)}">${esc(item)}</button>`).join('')}</div>
    <form class="q-ai-composer" data-q-ai-form><label><span class="q-visually-hidden">Ask Qelly a finance question</span><textarea name="message" rows="1" maxlength="2400" placeholder="Ask about markets, macro, FX, crypto, risk or datasets…" required></textarea></label><button type="submit" data-q-ai-send><span>Send</span><b aria-hidden="true">↑</b></button></form>
    <footer><span>Connected evidence + model inference</span><button type="button" data-q-ai-clear>Clear conversation</button><small>Research only · no trade execution</small></footer>
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

  const bindActions=()=>thread.querySelectorAll('[data-q-ai-route]').forEach((button)=>button.addEventListener('click',()=>{navigate?.(button.dataset.qAiRoute);close();}));
  const render=()=>{
    thread.innerHTML=messages.length?messages.map(messageMarkup).join(''):`<section class="q-ai-welcome"><span>Evidence-first finance AI</span><h2>Ask the market.<br>Inspect the sources.</h2><p>I can reason across Qelly’s connected crypto, macro and ECB observations, explain analytical methods, and identify the exact dataset or licence needed when coverage is unavailable.</p><div><b>LIVE</b> Hyperliquid</div><div><b>REFERENCE</b> World Bank · ECB</div></section>`;
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
  const open=(prompt='')=>{setOpen(true);if(prompt&&!input.value)input.value=String(prompt).slice(0,2400);};
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
    messages.push({role:'user',content:value,generatedAt:new Date().toISOString()});
    persist(messages);render();setBusy(true);input.value='';
    try{
      const result=await api('/api/v1/intelligence/chat',{method:'POST',body:JSON.stringify({message:value,history})});
      messages.push({role:'assistant',content:result.content,sources:result.sources||[],actions:result.actions||[],truthState:result.truthState,generatedAt:result.generatedAt});
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
  root.querySelector('[data-q-ai-clear]').addEventListener('click',()=>{messages=[];persist(messages);render();input.focus();});
  datasetButton.addEventListener('click',()=>{const expanded=datasetButton.getAttribute('aria-expanded')!=='true';datasetButton.setAttribute('aria-expanded',String(expanded));datasetPanel.hidden=!expanded;});
  document.addEventListener('qelly:open-ai',(event)=>open(event.detail?.prompt||''));
  window.addEventListener('keydown',(event)=>{if((event.ctrlKey||event.metaKey)&&event.key==='/'){event.preventDefault();panel.hidden?open():close();}if(event.key==='Escape'&&!panel.hidden)close();});
  render();
  loadCapability().catch(()=>{root.querySelector('[data-q-ai-status]').textContent=staticVisualPreview?'Static preview':'Dataset service reconnecting';root.querySelector('[data-q-ai-status-dot]').dataset.state='reference';});
}

export const __qellyChatTest=Object.freeze({STORAGE_KEY,MAX_MESSAGES,suggestions,truthLabel,safeUrl});
