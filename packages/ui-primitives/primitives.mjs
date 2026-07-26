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
  live:{label:'Live',symbol:'●',tone:'live'},
  delayed:{label:'Delayed',symbol:'◷',tone:'delayed'},
  estimated:{label:'Estimated',symbol:'≈',tone:'warning'},
  derived:{label:'Derived',symbol:'ƒ',tone:'cached'},
  demo:{label:'Demo · not live',symbol:'◇',tone:'demo'},
  simulated:{label:'Simulated · not live',symbol:'◇',tone:'simulated'},
  fallback:{label:'Fallback · not live',symbol:'↺',tone:'fallback'},
  stale:{label:'Stale',symbol:'△',tone:'stale'},
  unavailable:{label:'Unavailable',symbol:'—',tone:'unavailable'},
  offline:{label:'Offline',symbol:'⌁',tone:'offline'},
  error:{label:'Error',symbol:'!',tone:'error'},
  positive:{label:'Positive',symbol:'↑',tone:'positive'},
  negative:{label:'Negative',symbol:'↓',tone:'negative'},
  warning:{label:'Warning',symbol:'△',tone:'warning'},
  cached:{label:'Cached',symbol:'◫',tone:'cached'}
});

export function dataStateIndicator({state='unavailable',label='',detail=''}={}){
  const definition=DATA_STATES[state]??DATA_STATES.unavailable;
  const visibleLabel=label||definition.label;
  const title=detail?`${visibleLabel}. ${detail}`:visibleLabel;
  return `<span class="q-data-state q-data-state--${definition.tone}" data-symbol="${definition.symbol}" aria-label="${escapeHtml(title)}" ${detail?`title="${escapeHtml(title)}"`:''}>${escapeHtml(visibleLabel)}</span>`;
}

export function sourceDisclosure({
  provider='Unavailable',
  state='unavailable',
  observedAt='Unavailable',
  receivedAt='Unavailable',
  confidence=null,
  methodology='Not specified'
}={}){
  const numericConfidence=confidence==null?null:Math.max(0,Math.min(1,Number(confidence)));
  const confidenceLabel=numericConfidence==null?'Confidence unavailable':`${Math.round(numericConfidence*100)}% confidence`;
  return `<div class="q-source-disclosure">${dataStateIndicator({state})}<div class="q-source-disclosure__meta"><strong>${escapeHtml(provider)}</strong><small>Observed ${escapeHtml(observedAt)} · received ${escapeHtml(receivedAt)}</small><small>Method ${escapeHtml(methodology)}</small><span class="q-confidence-meter"><progress max="1" value="${numericConfidence??0}" aria-label="${escapeHtml(confidenceLabel)}"></progress><small>${escapeHtml(confidenceLabel)}</small></span></div></div>`;
}

export function toast(message, { tone = 'neutral', timeout = 3200 } = {}) {
  let stack = document.getElementById('qelly-toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'qelly-toast-stack';
    stack.className = 'q-toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.append(stack);
  }
  const item = document.createElement('div');
  item.className = `q-toast q-toast--${tone}`;
  item.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" aria-label="Dismiss notification">×</button>`;
  item.querySelector('button').addEventListener('click', () => item.remove());
  stack.append(item);
  announce(message);
  setTimeout(() => item.remove(), timeout);
}

export function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'q-dialog';
    dialog.innerHTML = `<form method="dialog"><div class="q-dialog__header"><h2>${escapeHtml(title)}</h2><button value="cancel" class="q-icon-button" aria-label="Close dialog">×</button></div><div class="q-dialog__body">${body}</div><div class="q-dialog__footer"><button value="cancel" class="q-button q-button--secondary">Cancel</button><button value="confirm" class="q-button q-button--${danger ? 'danger' : 'primary'}">${escapeHtml(confirmLabel)}</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => { resolve(dialog.returnValue === 'confirm'); dialog.remove(); }, { once: true });
    openDialog(dialog);
  });
}

export function commandDialog(commands) {
  const dialog = document.createElement('dialog');
  dialog.className = 'q-dialog q-command-dialog';
  dialog.innerHTML = `<div class="q-dialog__header"><h2>Command palette</h2><button class="q-icon-button" data-close aria-label="Close command palette">×</button></div><div class="q-dialog__body"><label class="sr-only" for="q-command-input">Search routes and actions</label><input id="q-command-input" autofocus class="q-command-input" placeholder="Search routes, assets and actions"><div class="q-command-results" role="listbox"></div></div>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input');
  const results = dialog.querySelector('.q-command-results');
  let filtered = commands;
  let active = 0;
  const draw = () => {
    const query = input.value.trim().toLowerCase();
    filtered = commands.filter((item) => `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(query));
    active = Math.min(active, Math.max(0, filtered.length - 1));
    results.innerHTML = filtered.map((item, index) => `<button role="option" aria-selected="${index === active}" class="q-command-item ${index === active ? 'is-active' : ''}" data-index="${index}"><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.hint ?? '')}</small></button>`).join('') || '<p class="q-empty-inline">No matching command</p>';
    results.querySelectorAll('button').forEach((element) => element.addEventListener('click', () => select(Number(element.dataset.index))));
  };
  const select = (index) => {
    const item = filtered[index];
    if (!item) return;
    closeDialog(dialog); dialog.remove(); item.run();
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); active = (active + 1) % Math.max(1, filtered.length); draw(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); active = (active - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length); draw(); }
    if (event.key === 'Enter') { event.preventDefault(); select(active); }
  });
  dialog.querySelector('[data-close]').addEventListener('click', () => { closeDialog(dialog); dialog.remove(); });
  draw(); openDialog(dialog);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}
