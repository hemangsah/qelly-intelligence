const STORAGE_KEY='qelly.intelligence.chat.v1';
const DECISION_DRAFT_KEY='qelly.decision.draft.v1';
const DECISION_CONTEXT_KEY='qelly.decision.chat-context.v1';
const MAX_MESSAGES=24;
const CHAT_MODES=Object.freeze([
  {id:'ask',label:'Ask'},{id:'research',label:'Research'},{id:'compare',label:'Compare'},{id:'explain',label:'Explain'},
  {id:'calculate',label:'Calculate'},{id:'decision',label:'Decision'},{id:'asset',label:'Asset'},{id:'india',label:'India'}
]);
const CHAT_ASSETS=Object.freeze(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const CHAT_TIMEFRAMES=Object.freeze(['1m','5m','15m','30m','1h','4h','1d']);
const CHAT_CALCULATORS=Object.freeze([
  ['cagr','CAGR'],['position-size','Position size'],['risk-reward','Risk / reward'],['black-scholes','Black–Scholes'],
  ['kelly-criterion','Kelly criterion'],['maximum-drawdown','Maximum drawdown'],['sip-future-value','SIP future value'],['loan-emi','Loan EMI']
]);
const MODE_SUGGESTIONS=Object.freeze({
  ask:['What is BTC trading at right now?','Which QELLY datasets are connected?','What evidence is unavailable for ETH?'],
  research:['Research the current market context for Bitcoin.','Build a source-aware Ethereum research brief.','What should I verify next for Solana?'],
  compare:['Compare BTC, ETH and SOL using available evidence.','Compare the evidence quality for BTC and ETH.','Which comparison dimensions are missing?'],
  explain:['Explain the current BTC market state step by step.','Explain the latest ECB reference-rate evidence.','Separate observation from inference for ETH.'],
  calculate:['Show me the input schema for this calculator.','Use the selected calculator with the JSON inputs I provide.','Open the full calculator library.'],
  decision:['Explain the current QELLY Decision Intelligence view.','Which evidence blocks a directional view?','What changes the invalidation condition?'],
  asset:['Summarize the supported BTC Asset Dossier evidence.','Which ETH evidence tracks are unavailable?','Show independent context and its limits.'],
  india:['What India evidence can QELLY verify now?','Separate live display coverage from delayed India reference data.','Explain the latest available India macro evidence.']
});

const esc=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const safeUrl=(value)=>{try{const url=new URL(String(value));return url.protocol==='https:'?url.toString():'#';}catch{return '#';}};
const suggestionsFor=(mode)=>MODE_SUGGESTIONS[mode]||MODE_SUGGESTIONS.ask;

function restore(){
  try{
    const value=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'[]');
    if(!Array.isArray(value))return [];
    return value.slice(-MAX_MESSAGES).filter((item)=>['user','assistant'].includes(item?.role)&&typeof item?.content==='string');
  }catch{return [];}
}

function persist(messages){
  try{
    sessionStorage.setItem(STORAGE_KEY,JSON.stringify(messages.slice(-MAX_MESSAGES).map(({
      id=null,role,content,sources=[],actions=[],truthState=null,generatedAt=null,evidence=null,inference=null,mode='ask',
      asset='BTC',timeframe='15m',tools=[],followUps=[],retryable=false,requestContext=null
    })=>({id,role,content,sources,actions,truthState,generatedAt,evidence,inference,mode,asset,timeframe,tools,followUps,retryable,requestContext}))));
  }catch{}
}

const truthLabel=(value)=>({
  conversational:'QELLY AI',grounded_model_inference:'GROUNDED AI',grounded_fallback:'DATASET ANSWER',
  grounding_validation_fallback:'VERIFIED DATASET ANSWER',grounded_registry_answer:'GOVERNED REGISTRY',
  model_unavailable_fallback:'MODEL DEGRADED',grounded_calculator:'DETERMINISTIC CALC',cancelled:'CANCELLED'
}[value]||'QELLY');

const conversationalReply=(message)=>{
  const normalized=String(message??'').trim().toLowerCase().replace(/[.!?]+$/g,'').trim();
  if(/^(hi|hello|hey|hiya|good morning|good afternoon|good evening)$/.test(normalized))return 'Hi — I’m Qelly Intelligence AI. I can help you explore markets, compare assets and economies, explain financial concepts, run registered calculators, and inspect the sources behind data-backed answers. What would you like to research?';
  if(/^(who are you|what are you|what is qelly|tell me about yourself)$/.test(normalized))return 'I’m Qelly Intelligence AI, the evidence-first research assistant for Qelly Intelligence. I use connected, source-labelled datasets and bounded QELLY tools, and I disclose delayed, display-only, restricted or unavailable coverage.';
  if(/^(thanks|thank you|thankyou|cheers)$/.test(normalized))return 'You’re welcome. I’m ready to research, compare, explain, calculate with registered tools, review Decision Intelligence, or inspect an Asset Dossier.';
  return null;
};

function sourceList(sources=[]){
  const available=sources.filter((source)=>source?.truthState&&source.truthState!=='unavailable'&&safeUrl(source.url)!=='#');
  if(!available.length)return '';
  return `<details class="q-ai-message-sources"><summary>${available.length} ${available.length===1?'source':'sources'} and freshness</summary><div>${available.map((source,index)=>`<a href="${esc(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer nofollow"><span>${index+1}</span><strong>${esc(source.title)}</strong><small>${esc(source.truthState)}${source.observedAt?` · ${esc(source.observedAt)}`:''}</small></a>`).join('')}</div></details>`;
}

function toolList(tools=[]){
  if(!Array.isArray(tools)||!tools.length)return '';
  return `<details class="q-ai-message-tools-used"><summary>${tools.length} QELLY tool ${tools.length===1?'receipt':'receipts'}</summary><div>${tools.map((tool)=>`<article><span>${esc(tool.id)}</span><strong>${esc(tool.label||tool.id)}</strong><em data-state="${esc(tool.truthState||'unavailable')}">${esc(tool.truthState||'unavailable')}</em><small>${esc(tool.source||'QELLY')} · freshness ${esc(tool.freshness||tool.truthState||'unavailable')}${tool.observedAt?` · ${esc(tool.observedAt)}`:''}</small>${tool.limitations?.[0]?`<p>${esc(tool.limitations[0])}</p>`:''}</article>`).join('')}</div></details>`;
}

function actionList(actions=[],messageIndex=-1){
  if(!actions.length)return '';
  return `<div class="q-ai-message-actions">${actions.map((action)=>`<button type="button" data-q-ai-route="${esc(action.route)}" data-q-ai-action-message="${messageIndex}">${esc(action.label)} <span aria-hidden="true">→</span></button>`).join('')}</div>`;
}
function followUpList(items=[]){
  if(!items.length)return '';
  return `<div class="q-ai-followups" aria-label="Follow-up suggestions">${items.slice(0,3).map(item=>`<button type="button" data-q-ai-followup="${esc(item)}">${esc(item)}</button>`).join('')}</div>`;
}

function evidenceMarkup(message){
  if(message.role!=='assistant')return '';
  const used=Number(message.evidence?.used??message.sources?.filter((source)=>source?.truthState&&source.truthState!=='unavailable').length??0);
  const time=message.generatedAt?new Date(message.generatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'now';
  return `<div class="q-ai-message-evidence"><span>${used} evidence item${used===1?'':'s'}</span><span>${esc(message.mode||'ask')} mode</span><span>${esc(message.asset||'BTC')} · ${esc(message.timeframe||'15m')}</span><span>${esc(time)}</span></div>`;
}

function messageMarkup(message,index){
  const assistant=message.role==='assistant';
  return `<article class="q-ai-message q-ai-message--${assistant?'assistant':'user'}" data-q-ai-message-role="${message.role}" data-q-ai-message-index="${index}">
    <header><span>${assistant?'Qelly Intelligence':'You'}</span>${assistant&&message.truthState?`<em>${esc(truthLabel(message.truthState))}</em>`:''}</header>
    <div class="q-ai-message-copy">${esc(message.content)}</div>
    ${assistant?evidenceMarkup(message):''}${assistant?toolList(message.tools):''}${assistant?sourceList(message.sources):''}${assistant?actionList(message.actions,index):''}${assistant?followUpList(message.followUps):''}
    ${assistant?`<div class="q-ai-message-tools"><button type="button" data-q-ai-copy="${index}">Copy</button>${message.sources?.some(source=>safeUrl(source.url)!=='#')?`<button type="button" data-q-ai-copy-sources="${index}">Copy citations</button>`:''}<button type="button" data-q-ai-compact="${index}">Compact</button><button type="button" data-q-ai-verify="${index}">Verify evidence</button><button type="button" data-q-ai-decision="${index}">Build decision</button>${message.retryable?`<button type="button" data-q-ai-retry="${index}">Retry</button>`:''}</div>`:''}
  </article>`;
}

function shellMarkup(){
  return `<button class="q-ai-launcher" type="button" data-q-ai-launcher aria-controls="qelly-ai-assistant" aria-expanded="false"><img src="./assets/brand/qelly-symbol.svg" width="38" height="38" alt=""><span><strong>Ask Qelly</strong><small>Finance intelligence</small></span><i aria-hidden="true">⌘ /</i></button>
  <aside class="q-ai-assistant" id="qelly-ai-assistant" data-q-ai-assistant role="dialog" aria-label="Qelly Intelligence financial research assistant" aria-modal="false" hidden>
    <header class="q-ai-header"><div class="q-ai-brand"><img src="./assets/brand/qelly-symbol.svg" width="36" height="36" alt=""><span><strong>Qelly Intelligence</strong><small><i data-q-ai-status-dot></i><span data-q-ai-status>Connecting to datasets…</span></small></span></div><div><button type="button" data-q-ai-new>New</button><button type="button" data-q-ai-expand aria-pressed="false">Expand</button><button type="button" data-q-ai-datasets aria-expanded="false" aria-controls="q-ai-dataset-panel">Evidence</button><button type="button" data-q-ai-close aria-label="Close Qelly Intelligence">×</button></div></header>
    <section class="q-ai-dataset-panel" id="q-ai-dataset-panel" data-q-ai-dataset-panel hidden><div><strong>Finance data coverage</strong><span data-q-ai-dataset-summary>Checking source registry…</span></div><div data-q-ai-dataset-list></div><p>Qelly connects only authorized sources. Restricted institutional datasets remain clearly labelled and are never scraped.</p></section>
    <div class="q-ai-modebar" role="toolbar" aria-label="Qelly analysis mode">${CHAT_MODES.map((item)=>`<button type="button" data-q-ai-mode="${item.id}" aria-pressed="${item.id==='ask'?'true':'false'}">${item.label}</button>`).join('')}</div>
    <div class="q-ai-contextbar" aria-label="Qelly research context"><label><span>Asset</span><select data-q-ai-asset>${CHAT_ASSETS.map(item=>`<option value="${item}">${item}</option>`).join('')}</select></label><label><span>Timeframe</span><select data-q-ai-timeframe>${CHAT_TIMEFRAMES.map(item=>`<option value="${item}" ${item==='15m'?'selected':''}>${item}</option>`).join('')}</select></label><label data-q-ai-calculator-field hidden><span>Calculator</span><select data-q-ai-calculator>${CHAT_CALCULATORS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label></div>
    <div class="q-ai-thread" data-q-ai-thread aria-live="polite" aria-relevant="additions text"></div>
    <div class="q-ai-suggestions" data-q-ai-suggestions></div>
    <form class="q-ai-composer" data-q-ai-form><label><span class="q-visually-hidden">Ask Qelly a finance question</span><textarea name="message" rows="1" maxlength="2400" placeholder="Ask about markets, evidence, risk or QELLY tools…" required></textarea></label><button type="button" data-q-ai-stop hidden><span>Stop</span><b aria-hidden="true">■</b></button><button type="submit" data-q-ai-send><span>Send</span><b aria-hidden="true">↑</b></button></form>
    <footer><span>Connected evidence + QELLY tool receipts + model inference</span><div><button type="button" data-q-ai-export>Export</button><button type="button" data-q-ai-clear>Clear</button></div><small>Research only · no trade execution · unvalidated streaming disabled</small></footer>
  </aside>`;
}

export function installQellyChat({api,navigate,toast,staticVisualPreview=false}={}){
  if(document.querySelector('[data-q-ai-launcher]'))return;
  const root=document.createElement('div');root.className='q-ai-root';root.innerHTML=shellMarkup();document.body.append(root);
  const launcher=root.querySelector('[data-q-ai-launcher]'),panel=root.querySelector('[data-q-ai-assistant]'),closeButton=root.querySelector('[data-q-ai-close]');
  const form=root.querySelector('[data-q-ai-form]'),input=form.querySelector('textarea'),send=root.querySelector('[data-q-ai-send]'),stop=root.querySelector('[data-q-ai-stop]');
  const thread=root.querySelector('[data-q-ai-thread]'),suggestionsNode=root.querySelector('[data-q-ai-suggestions]');
  const datasetButton=root.querySelector('[data-q-ai-datasets]'),datasetPanel=root.querySelector('[data-q-ai-dataset-panel]');
  const assetSelect=root.querySelector('[data-q-ai-asset]'),timeframeSelect=root.querySelector('[data-q-ai-timeframe]'),calculatorSelect=root.querySelector('[data-q-ai-calculator]'),calculatorField=root.querySelector('[data-q-ai-calculator-field]');
  let messages=restore(),sending=false,capability=null,mode='ask',asset='BTC',timeframe='15m',activeController=null;

  const requestContext=()=>({mode,asset,timeframe,calculatorId:calculatorSelect.value});
  const applyContext=(context={})=>{
    mode=CHAT_MODES.some(item=>item.id===context.mode)?context.mode:mode;
    asset=CHAT_ASSETS.includes(context.asset)?context.asset:asset;
    timeframe=CHAT_TIMEFRAMES.includes(context.timeframe)?context.timeframe:timeframe;
    if(CHAT_CALCULATORS.some(([id])=>id===context.calculatorId))calculatorSelect.value=context.calculatorId;
    assetSelect.value=asset;timeframeSelect.value=timeframe;
    root.querySelectorAll('[data-q-ai-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.qAiMode===mode)));
    calculatorField.hidden=mode!=='calculate';
    input.placeholder=mode==='calculate'?'Describe the calculation, or enter a JSON input object for the selected calculator…':'Ask about markets, evidence, risk or QELLY tools…';
    renderSuggestions();
  };

  const retryFrom=(index)=>{
    for(let i=Number(index)-1;i>=0;i-=1){
      const candidate=messages[i];
      if(candidate?.role==='user'){const context=candidate.requestContext||{};applyContext(context);submit(candidate.content,{context});return;}
    }
  };

  const bindActions=()=>{
    thread.querySelectorAll('[data-q-ai-route]').forEach(button=>button.addEventListener('click',()=>{
      const route=button.dataset.qAiRoute;
      const message=messages[Number(button.dataset.qAiActionMessage)];
      if(route==='decision-provenance'&&message){
        try{sessionStorage.setItem(DECISION_CONTEXT_KEY,JSON.stringify({createdAt:new Date().toISOString(),asset:message.asset||asset,timeframe:message.timeframe||timeframe}));}catch{}
      }
      const contextualAsset=message?.asset&&message.asset!=='HYPE'&&['advanced-chart','comparison-lab','asset'].includes(route)?message.asset:null;
      navigate?.(route,contextualAsset);
      close();
    }));
    thread.querySelectorAll('[data-q-ai-copy]').forEach(button=>button.addEventListener('click',async()=>{const message=messages[Number(button.dataset.qAiCopy)];if(!message)return;try{await navigator.clipboard.writeText(message.content);toast?.('Qelly answer copied',{tone:'success'});}catch{toast?.('Copy is unavailable in this browser.',{tone:'danger'});}}));
    thread.querySelectorAll('[data-q-ai-copy-sources]').forEach(button=>button.addEventListener('click',async()=>{const message=messages[Number(button.dataset.qAiCopySources)];const text=(message?.sources||[]).filter(source=>safeUrl(source.url)!=='#').map((source,index)=>`[${index+1}] ${source.title} · ${source.truthState}${source.observedAt?` · ${source.observedAt}`:''}\n${safeUrl(source.url)}`).join('\n\n');if(!text)return;try{await navigator.clipboard.writeText(text);toast?.('Citation links copied',{tone:'success'});}catch{toast?.('Copy is unavailable in this browser.',{tone:'danger'});}}));
    thread.querySelectorAll('[data-q-ai-compact]').forEach(button=>button.addEventListener('click',()=>{const article=button.closest('.q-ai-message');const compact=article.classList.toggle('is-compact');button.textContent=compact?'Expand':'Compact';}));
    thread.querySelectorAll('[data-q-ai-verify]').forEach(button=>button.addEventListener('click',()=>{const message=messages[Number(button.dataset.qAiVerify)];try{sessionStorage.setItem('qelly.verify.chat-evidence.v1',JSON.stringify({createdAt:new Date().toISOString(),content:message?.content,sources:message?.sources||[],tools:message?.tools||[]}));}catch{}navigate?.('qelly-verify');close();}));
    thread.querySelectorAll('[data-q-ai-decision]').forEach(button=>button.addEventListener('click',()=>{const message=messages[Number(button.dataset.qAiDecision)];try{const createdAt=new Date().toISOString();sessionStorage.setItem(DECISION_DRAFT_KEY,JSON.stringify({createdAt,thesis:message?.content||'',sources:message?.sources||[],tools:message?.tools||[],truthState:message?.truthState||null}));sessionStorage.setItem(DECISION_CONTEXT_KEY,JSON.stringify({createdAt,asset:message?.asset||asset,timeframe:message?.timeframe||timeframe}));}catch{}navigate?.('decision-provenance');close();}));
    thread.querySelectorAll('[data-q-ai-retry]').forEach(button=>button.addEventListener('click',()=>retryFrom(button.dataset.qAiRetry)));
    thread.querySelectorAll('[data-q-ai-followup]').forEach(button=>button.addEventListener('click',()=>submit(button.dataset.qAiFollowup)));
  };

  const render=()=>{
    thread.innerHTML=messages.length?messages.map(messageMarkup).join(''):`<section class="q-ai-welcome"><span>Qelly flagship intelligence workspace</span><h2>Ask. Ground.<br>Verify. Decide.</h2><p>Qelly can research connected finance observations, call bounded read-only QELLY tools, run registered calculators and hand sourced evidence into Decision Intelligence.</p><div><b>GROUNDED</b> Current claims must map to connected evidence or tool receipts</div><div><b>GOVERNED</b> Missing, delayed and display-only coverage remains explicit</div><div><b>NON-EXECUTING</b> Research support never becomes a trading bot</div></section>`;
    suggestionsNode.hidden=messages.length>0;
    bindActions();
    requestAnimationFrame(()=>{thread.scrollTop=thread.scrollHeight;});
  };
  function renderSuggestions(){
    suggestionsNode.innerHTML=suggestionsFor(mode).map(item=>`<button type="button" data-q-ai-suggestion="${esc(item)}">${esc(item)}</button>`).join('');
    suggestionsNode.querySelectorAll('[data-q-ai-suggestion]').forEach(button=>button.addEventListener('click',()=>submit(button.dataset.qAiSuggestion)));
  }

  const setOpen=(open)=>{panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));launcher.classList.toggle('is-hidden',open);document.documentElement.classList.toggle('q-ai-open',open&&matchMedia('(max-width:640px)').matches);if(open)setTimeout(()=>input.focus(),50);};
  const open=(prompt='',requestedMode='',expand=false,context={})=>{setOpen(true);applyContext({...context,mode:requestedMode||context.mode||mode});if(prompt&&!input.value)input.value=String(prompt).slice(0,2400);if(expand&&!matchMedia('(max-width:640px)').matches){panel.classList.add('is-expanded');const button=root.querySelector('[data-q-ai-expand]');button?.setAttribute('aria-pressed','true');if(button)button.textContent='Compact';}};
  const close=()=>setOpen(false);
  const setBusy=(value)=>{sending=value;send.disabled=value;input.disabled=value;assetSelect.disabled=value;timeframeSelect.disabled=value;calculatorSelect.disabled=value;send.hidden=value;stop.hidden=!value;panel.classList.toggle('is-thinking',value);};

  const loadCapability=async()=>{
    if(staticVisualPreview)throw new Error('Static preview');
    capability=await api('/api/v1/intelligence/chat');
    const assistant=capability.assistant||{};
    root.querySelector('[data-q-ai-status]').textContent=assistant.inferenceAvailable?'Workers AI · grounded tools':'Grounded tool + dataset mode';
    root.querySelector('[data-q-ai-status-dot]').dataset.state=assistant.inferenceAvailable?'live':'reference';
    const datasets=capability.datasets||{};
    root.querySelector('[data-q-ai-dataset-summary]').textContent=`${datasets.connected||0} connected · ${datasets.catalogued||0} governed entries`;
    root.querySelector('[data-q-ai-dataset-list]').innerHTML=(datasets.items||[]).slice(0,8).map(item=>`<article><span>${esc(item.category)}</span><strong>${esc(item.name)}</strong><em data-state="${item.access==='connected'?'live':'restricted'}">${esc(item.access.replaceAll('_',' '))}</em></article>`).join('');
  };

  async function submit(message,{context=null}={}){
    const value=String(message||'').trim();if(!value||sending)return;
    if(context)applyContext(context);
    const ctx=requestContext();
    let calculator=null;
    if(mode==='calculate'){
      let inputs=null;
      if(value.startsWith('{')){
        try{inputs=JSON.parse(value);if(!inputs||typeof inputs!=='object'||Array.isArray(inputs))throw new Error('Use a JSON object.');}
        catch(error){messages.push({role:'user',content:value,mode,asset,timeframe,requestContext:ctx,generatedAt:new Date().toISOString()},{role:'assistant',content:`Calculator input is not valid JSON: ${error.message}`,sources:[],tools:[],actions:[{route:'calculator-center',label:'Open calculators'}],followUps:['Show me the registered input schema.'],truthState:'grounded_calculator',mode,asset,timeframe,generatedAt:new Date().toISOString(),retryable:false});persist(messages);render();return;}
      }
      calculator={formulaId:ctx.calculatorId,inputs};
    }
    const history=messages.slice(-10).map(({role,content})=>({role,content}));
    messages.push({role:'user',content:value,mode,asset,timeframe,requestContext:ctx,generatedAt:new Date().toISOString()});persist(messages);render();input.value='';
    const conversationalAnswer=conversationalReply(value);
    if(conversationalAnswer){
      messages.push({role:'assistant',content:conversationalAnswer,sources:[],tools:[],actions:[],followUps:suggestionsFor('ask'),truthState:'conversational',generatedAt:new Date().toISOString(),mode,asset,timeframe});
      persist(messages);render();input.focus();return;
    }
    activeController=new AbortController();setBusy(true);
    try{
      const result=await api('/api/v1/intelligence/chat',{method:'POST',signal:activeController.signal,body:JSON.stringify({message:value,history,mode,asset,timeframe,calculator})});
      messages.push({id:result.id,role:'assistant',content:result.content,sources:result.sources||[],actions:result.actions||[],truthState:result.truthState,generatedAt:result.generatedAt,evidence:result.evidence||{used:result.datasets?.used||0},inference:result.inference||null,mode:result.mode||mode,asset:result.asset||asset,timeframe:result.timeframe||timeframe,tools:result.tools||[],followUps:result.followUps||[],retryable:false});
      persist(messages);render();
    }catch(error){
      const cancelled=error?.name==='AbortError';
      messages.push({role:'assistant',content:cancelled?'Generation cancelled. No partial or unvalidated answer was accepted.':`Qelly could not complete that request. ${error.message||'Please retry.'}`,sources:[],tools:[],actions:[{route:'market',label:'Open Market Command'}],followUps:cancelled?[]:['Retry the last question.','Inspect available evidence first.'],truthState:cancelled?'cancelled':'model_unavailable_fallback',generatedAt:new Date().toISOString(),mode,asset,timeframe,retryable:!cancelled});
      persist(messages);render();if(!cancelled)toast?.('Qelly Intelligence could not complete that request.',{tone:'danger'});
    }finally{activeController=null;setBusy(false);input.focus();}
  }

  launcher.addEventListener('click',()=>open());closeButton.addEventListener('click',close);
  form.addEventListener('submit',event=>{event.preventDefault();submit(input.value);});
  stop.addEventListener('click',()=>activeController?.abort());
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
  root.querySelectorAll('[data-q-ai-mode]').forEach(button=>button.addEventListener('click',()=>applyContext({mode:button.dataset.qAiMode})));
  assetSelect.addEventListener('change',()=>{asset=assetSelect.value;});
  timeframeSelect.addEventListener('change',()=>{timeframe=timeframeSelect.value;});
  root.querySelector('[data-q-ai-new]').addEventListener('click',()=>{activeController?.abort();messages=[];persist(messages);mode='ask';asset='BTC';timeframe='15m';applyContext({mode,asset,timeframe});render();input.value='';input.focus();});
  root.querySelector('[data-q-ai-expand]').addEventListener('click',event=>{const expanded=panel.classList.toggle('is-expanded');event.currentTarget.setAttribute('aria-pressed',String(expanded));event.currentTarget.textContent=expanded?'Compact':'Expand';});
  root.querySelector('[data-q-ai-export]').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({schemaVersion:'qelly.chat.export/1.1.0',exportedAt:new Date().toISOString(),messages},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`qelly-chat-${new Date().toISOString().slice(0,10)}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast?.('Qelly conversation exported',{tone:'success'});});
  root.querySelector('[data-q-ai-clear]').addEventListener('click',()=>{activeController?.abort();messages=[];persist(messages);render();input.focus();});
  datasetButton.addEventListener('click',()=>{const expanded=datasetButton.getAttribute('aria-expanded')!=='true';datasetButton.setAttribute('aria-expanded',String(expanded));datasetPanel.hidden=!expanded;});
  document.addEventListener('qelly:open-ai',event=>open(event.detail?.prompt||'',event.detail?.mode||'',event.detail?.expand===true,{asset:event.detail?.asset||asset,timeframe:event.detail?.timeframe||timeframe}));
  window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='/'){event.preventDefault();panel.hidden?open():close();}if(event.key==='Escape'&&!panel.hidden)close();});
  renderSuggestions();applyContext({mode,asset,timeframe});render();
  loadCapability().catch(()=>{root.querySelector('[data-q-ai-status]').textContent=staticVisualPreview?'Static preview':'Dataset service reconnecting';root.querySelector('[data-q-ai-status-dot]').dataset.state='reference';});
}

export const __qellyChatTest=Object.freeze({STORAGE_KEY,DECISION_DRAFT_KEY,DECISION_CONTEXT_KEY,MAX_MESSAGES,CHAT_MODES,CHAT_ASSETS,CHAT_TIMEFRAMES,CHAT_CALCULATORS,MODE_SUGGESTIONS,truthLabel,safeUrl,conversationalReply,suggestionsFor});
