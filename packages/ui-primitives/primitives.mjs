import { announce, openDialog, closeDialog } from '../accessibility/accessibility.mjs';

export function button(label, { variant = 'secondary', icon = '', disabled = false, pressed, title = '' } = {}) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `q-button q-button--${variant}`;
  element.disabled = disabled;
  if (pressed !== undefined) element.setAttribute('aria-pressed', String(pressed));
  if (title) element.title = title;
  element.innerHTML = `${icon ? `<span aria-hidden="true" class="q-button__icon">${icon}</span>` : ''}<span>${label}</span>`;
  return element;
}

export function statusBadge(label, state = 'cached', detail = '') {
  const span = document.createElement('span');
  span.className = `q-status q-status--${state}`;
  span.textContent = label;
  if (detail) { span.title = detail; span.setAttribute('aria-label', `${label}. ${detail}`); }
  return span;
}

const DATA_STATES=Object.freeze({
  live:{label:'Live',symbol:'●',tone:'live'},delayed:{label:'Delayed',symbol:'◷',tone:'delayed'},estimated:{label:'Estimated',symbol:'≈',tone:'warning'},derived:{label:'Derived',symbol:'ƒ',tone:'cached'},demo:{label:'Demo · not live',symbol:'◇',tone:'demo'},simulated:{label:'Simulated · not live',symbol:'◇',tone:'simulated'},fallback:{label:'Fallback · not live',symbol:'↺',tone:'fallback'},stale:{label:'Stale',symbol:'△',tone:'stale'},unavailable:{label:'Unavailable',symbol:'—',tone:'unavailable'},offline:{label:'Offline',symbol:'⌁',tone:'offline'},error:{label:'Error',symbol:'!',tone:'error'},positive:{label:'Positive',symbol:'↑',tone:'positive'},negative:{label:'Negative',symbol:'↓',tone:'negative'},warning:{label:'Warning',symbol:'△',tone:'warning'},cached:{label:'Cached',symbol:'◫',tone:'cached'}
});

export function dataStateIndicator({state='unavailable',label='',detail=''}={}){
  const definition=DATA_STATES[state]??DATA_STATES.unavailable;
  const visibleLabel=label||definition.label;
  const title=detail?`${visibleLabel}. ${detail}`:visibleLabel;
  return `<span class="q-data-state q-data-state--${definition.tone}" data-symbol="${definition.symbol}" aria-label="${escapeHtml(title)}" ${detail?`title="${escapeHtml(title)}"`:''}>${escapeHtml(visibleLabel)}</span>`;
}

export function sourceDisclosure({provider='Unavailable',state='unavailable',observedAt='Unavailable',receivedAt='Unavailable',confidence=null,methodology='Not specified'}={}){
  const numericConfidence=confidence==null?null:Math.max(0,Math.min(1,Number(confidence)));
  const confidenceLabel=numericConfidence==null?'Confidence unavailable':`${Math.round(numericConfidence*100)}% confidence`;
  return `<div class="q-source-disclosure">${dataStateIndicator({state})}<div class="q-source-disclosure__meta"><strong>${escapeHtml(provider)}</strong><small>Observed ${escapeHtml(observedAt)} · received ${escapeHtml(receivedAt)}</small><small>Method ${escapeHtml(methodology)}</small><span class="q-confidence-meter"><progress max="1" value="${numericConfidence??0}" aria-label="${escapeHtml(confidenceLabel)}"></progress><small>${escapeHtml(confidenceLabel)}</small></span></div></div>`;
}

export function toast(message, { tone = 'neutral', timeout = 3200 } = {}) {
  let stack = document.getElementById('qelly-toast-stack');
  if (!stack) {stack=document.createElement('div');stack.id='qelly-toast-stack';stack.className='q-toast-stack';stack.setAttribute('aria-live','polite');document.body.append(stack);}
  const item=document.createElement('div');item.className=`q-toast q-toast--${tone}`;item.innerHTML=`<span>${escapeHtml(message)}</span><button type="button" aria-label="Dismiss notification">×</button>`;item.querySelector('button').addEventListener('click',()=>item.remove());stack.append(item);announce(message);setTimeout(()=>item.remove(),timeout);
}

export function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const dialog=document.createElement('dialog');dialog.className='q-dialog';dialog.innerHTML=`<form method="dialog"><div class="q-dialog__header"><h2>${escapeHtml(title)}</h2><button value="cancel" class="q-icon-button" aria-label="Close dialog">×</button></div><div class="q-dialog__body">${body}</div><div class="q-dialog__footer"><button value="cancel" class="q-button q-button--secondary">Cancel</button><button value="confirm" class="q-button q-button--${danger?'danger':'primary'}">${escapeHtml(confirmLabel)}</button></div></form>`;document.body.append(dialog);dialog.addEventListener('close',()=>{resolve(dialog.returnValue==='confirm');dialog.remove();},{once:true});openDialog(dialog);
  });
}

const paletteIcon=(name='command')=>{
  const paths={search:'<circle cx="11" cy="11" r="6.4"/><path d="m16 16 4 4"/>',navigation:'<path d="M5 19 19 5M8 5h11v11"/>',asset:'<circle cx="12" cy="12" r="8"/><path d="M9 9.5h4.2a2 2 0 0 1 0 4H9m3-7v11m-3-4h4.8a2 2 0 0 1 0 4H9"/>',action:'<path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>',recent:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',command:'<path d="M8 8h8v8H8z"/><path d="M4 8h1M19 8h1M4 16h1M19 16h1M8 4v1M16 4v1M8 19v1M16 19v1"/>'};
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name]??paths.command}</svg>`;
};

export function commandDialog(commands) {
  const dialog=document.createElement('dialog');dialog.className='q-dialog q-command-dialog';
  dialog.innerHTML=`<div class="q-command-shell"><header class="q-command-context"><div><span>Qelly Intelligence</span><strong>Search the workspace</strong></div><button type="button" class="q-command-close" data-close aria-label="Close command palette">${paletteIcon('command')}</button></header><label class="q-command-search" for="q-command-input">${paletteIcon('search')}<span class="sr-only">Search routes, assets and actions</span><input id="q-command-input" autocomplete="off" spellcheck="false" class="q-command-input" placeholder="Search assets, research, routes and actions"><kbd>Esc</kbd></label><div class="q-command-results" role="listbox" aria-label="Command results"></div><footer class="q-command-footer"><span><span><kbd>↑↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span></span><span data-command-count aria-live="polite"></span></footer></div>`;
  document.body.append(dialog);
  const input=dialog.querySelector('input');const results=dialog.querySelector('.q-command-results');const counter=dialog.querySelector('[data-command-count]');
  let filtered=commands;let active=0;
  const normalized=(item,index)=>({group:item.group??(item.kind==='asset'?'Assets':item.kind==='action'?'Actions':'Navigation'),kind:item.kind??'navigation',description:item.description??item.hint??'',shortcut:item.shortcut??(index<9?`⌥${index+1}`:''),...item});
  const draw=()=>{
    const query=input.value.trim().toLowerCase();
    filtered=commands.map(normalized).filter((item)=>`${item.label} ${item.description} ${item.group}`.toLowerCase().includes(query));
    active=Math.min(active,Math.max(0,filtered.length-1));
    const groups=new Map();for(const [index,item] of filtered.entries()){if(!groups.has(item.group))groups.set(item.group,[]);groups.get(item.group).push({item,index});}
    results.innerHTML=filtered.length?[...groups].map(([group,items])=>`<section class="q-command-group" aria-label="${escapeHtml(group)}"><div class="q-command-group-title">${escapeHtml(group)}</div>${items.map(({item,index})=>`<button type="button" role="option" aria-selected="${index===active}" class="q-command-item ${index===active?'is-active':''}" data-index="${index}"><span class="q-command-item-icon">${item.icon??paletteIcon(item.kind)}</span><span class="q-command-item-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.description)}</small></span>${item.shortcut?`<kbd class="q-command-shortcut">${escapeHtml(item.shortcut)}</kbd>`:''}</button>`).join('')}</section>`).join(''):'<div class="q-command-empty">No matching command. Try an asset, route or action.</div>';
    counter.textContent=`${filtered.length} result${filtered.length===1?'':'s'}`;
    results.querySelectorAll('[data-index]').forEach((element)=>{element.addEventListener('click',()=>select(Number(element.dataset.index)));element.addEventListener('mousemove',()=>{const next=Number(element.dataset.index);if(next!==active){active=next;draw();}});});
  };
  const select=(index)=>{const item=filtered[index];if(!item)return;closeDialog(dialog);dialog.remove();item.run();};
  const close=()=>{closeDialog(dialog);dialog.remove();};
  input.addEventListener('input',()=>{active=0;draw();announce(`${filtered.length} command results`);});
  input.addEventListener('keydown',(event)=>{if(event.key==='ArrowDown'){event.preventDefault();active=(active+1)%Math.max(1,filtered.length);draw();results.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});}if(event.key==='ArrowUp'){event.preventDefault();active=(active-1+Math.max(1,filtered.length))%Math.max(1,filtered.length);draw();results.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});}if(event.key==='Enter'){event.preventDefault();select(active);}if(event.key==='Escape'){event.preventDefault();close();}});
  dialog.querySelector('[data-close]').addEventListener('click',close);dialog.addEventListener('cancel',(event)=>{event.preventDefault();close();},{once:true});
  draw();openDialog(dialog);input.focus({preventScroll:true});
}

export function escapeHtml(value) {return String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));}
