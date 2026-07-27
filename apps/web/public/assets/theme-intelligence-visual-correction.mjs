import {VISUAL_FAMILY_META,miniProductPreview,visualIcon} from './theme-intelligence-visual-correction-data.mjs';

const HISTORY_KEY='qelly.command-history.visual-correction.v1';
const slug=(value)=>String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const readHistory=()=>{try{const value=JSON.parse(localStorage.getItem(HISTORY_KEY)??'[]');return Array.isArray(value)?value.slice(0,5):[];}catch{return [];}};
const writeHistory=(value)=>{try{localStorage.setItem(HISTORY_KEY,JSON.stringify(value.slice(0,5)));}catch{}};

function syncVisualDatasets(){
  const root=document.documentElement;
  root.dataset.visualAppearance=root.dataset.resolvedAppearance||root.dataset.appearance||'dark';
  root.dataset.alphaIntensitySlug=slug(root.dataset.alphaIntensity||'Focused Edge');
  root.dataset.alphaPackSlug=slug(root.dataset.alphaPack||'crimson-vector');
  const meta=VISUAL_FAMILY_META[root.dataset.themeFamily]??VISUAL_FAMILY_META['sovereign-obsidian'];
  root.dataset.themeTemperature=meta.character;
  root.dataset.themeDensity=meta.density.toLowerCase();
}

function openThemeDetail(id){
  const meta=VISUAL_FAMILY_META[id]??VISUAL_FAMILY_META['sovereign-obsidian'];
  const title=document.querySelector(`[data-theme-card="${CSS.escape(id)}"] h2`)?.textContent??id;
  const dialog=document.createElement('dialog');dialog.className='q-ti-modal q-ti-theme-detail';
  dialog.innerHTML=`<header><div><span class="q-ti-module-kicker">Theme family</span><h2>${esc(title)}</h2></div><button type="button" data-close aria-label="Close">×</button></header><section>${miniProductPreview(id)}<p>${esc(meta.character)}</p><dl><div><dt>Recommended persona</dt><dd>${esc(meta.persona)}</dd></div><div><dt>Recommended density</dt><dd>${esc(meta.density)}</dd></div><div><dt>Accessibility</dt><dd>${meta.score}/100</dd></div><div><dt>Modes</dt><dd>${esc(meta.modes)}</dd></div></dl></section>`;
  document.body.append(dialog);dialog.querySelector('[data-close]').addEventListener('click',()=>{dialog.close();dialog.remove();});dialog.addEventListener('cancel',()=>dialog.remove(),{once:true});dialog.showModal();
}

function enhanceGallery(root){
  root.querySelectorAll('.q-ti-theme-card:not([data-visual-corrected])').forEach((card,index)=>{
    const id=card.dataset.themeCard;const meta=VISUAL_FAMILY_META[id]??VISUAL_FAMILY_META['sovereign-obsidian'];card.dataset.visualCorrected='true';
    const preview=card.querySelector('.q-ti-theme-preview');if(preview){preview.className='q-ti-theme-preview q-ti-theme-preview--product';preview.innerHTML=miniProductPreview(id);}
    const header=card.querySelector('header');if(header){const oldBadge=header.querySelector(':scope > span');if(oldBadge)oldBadge.remove();header.insertAdjacentHTML('afterbegin',`<span class="q-ti-theme-index">${String(index+1).padStart(2,'0')}</span>`);header.insertAdjacentHTML('beforeend',`<span class="q-ti-mode-chip">${meta.mode}</span>`);}
    const footer=card.querySelector('footer');if(footer){footer.insertAdjacentHTML('afterbegin',`<button type="button" data-visual-details="${esc(id)}">Details</button><button type="button" data-visual-compare="${esc(id)}">Compare</button>`);}
    const metadata=document.createElement('dl');metadata.innerHTML=`<div><dt>Persona</dt><dd>${esc(meta.persona)}</dd></div><div><dt>Density</dt><dd>${esc(meta.density)}</dd></div><div><dt>Accessibility</dt><dd>${meta.score}/100</dd></div><div><dt>Modes</dt><dd>${esc(meta.modes)}</dd></div>`;footer?.before(metadata);
    card.querySelector('[data-visual-details]')?.addEventListener('click',()=>openThemeDetail(id));
    card.querySelector('[data-visual-compare]')?.addEventListener('click',()=>{window.QellyThemeIntelligence?.themeIntelligence?.preview({themeFamily:id});location.hash='#/theme-lab/compare';});
  });
}

function openChoiceSheet(select,title){
  const dialog=document.createElement('dialog');dialog.className='q-ti-mobile-sheet';
  dialog.innerHTML=`<div class="q-ti-sheet-handle"></div><header><div><span class="q-ti-module-kicker">Theme Studio</span><h2>${esc(title)}</h2></div><button type="button" data-close aria-label="Close">×</button></header><div class="q-ti-sheet-options">${[...select.options].map((option)=>`<button type="button" data-value="${esc(option.value)}" class="${option.selected?'is-active':''}"><span><strong>${esc(option.textContent)}</strong><small>${option.selected?'Current selection':'Preview this governed option'}</small></span><i aria-hidden="true"></i></button>`).join('')}</div>`;
  document.body.append(dialog);dialog.querySelector('[data-close]').addEventListener('click',()=>{dialog.close();dialog.remove();});dialog.querySelectorAll('[data-value]').forEach((button)=>button.addEventListener('click',()=>{select.value=button.dataset.value;select.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();dialog.remove();}));dialog.addEventListener('cancel',(event)=>{event.preventDefault();dialog.close();dialog.remove();});dialog.showModal();
}

function openPresetSheet(group){
  const dialog=document.createElement('dialog');dialog.className='q-ti-mobile-sheet';dialog.innerHTML=`<div class="q-ti-sheet-handle"></div><header><div><span class="q-ti-module-kicker">Theme Studio</span><h2>Preset tools</h2></div><button type="button" data-close aria-label="Close">×</button></header><div class="q-ti-sheet-options"><button data-action="export"><span><strong>Export preset</strong><small>Download validated JSON</small></span></button><button data-action="import"><span><strong>Import preset</strong><small>Validate before preview</small></span></button><button data-action="share"><span><strong>Share local configuration</strong><small>Copy a governed preview link</small></span></button></div>`;document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>{dialog.close();dialog.remove();};dialog.querySelectorAll('[data-action]').forEach((button)=>button.onclick=()=>{group.querySelector(`[data-ti-action="${button.dataset.action}"]`)?.click();dialog.close();dialog.remove();});dialog.showModal();
}

function enhanceStudio(root){
  const controls=root.querySelector('.q-ti-controls');if(!controls||controls.dataset.visualCorrected==='true')return;controls.dataset.visualCorrected='true';
  const groups=[...controls.querySelectorAll(':scope > .q-ti-control-group')];
  groups.forEach((group,index)=>{
    if(group.tagName==='DETAILS')return;const heading=group.querySelector('h2');const description=group.querySelector('p');const details=document.createElement('details');details.className='q-ti-control-group';if(index<2)details.open=true;
    details.innerHTML=`<summary><span>${String(index+1).padStart(2,'0')}</span><div><strong>${esc(heading?.textContent||`Group ${index+1}`)}</strong><small>${esc(description?.textContent||'Governed workspace configuration')}</small></div></summary><div class="q-ti-group-body"></div>`;
    const body=details.querySelector('.q-ti-group-body');[...group.childNodes].forEach((node)=>{if(node!==heading&&node!==description)body.append(node);});group.replaceWith(details);
  });
  const theme=controls.querySelector('[data-ti-select="themeFamily"]');const persona=controls.querySelector('[data-ti-select="persona"]');
  const sticky=document.createElement('div');sticky.className='q-ti-mobile-preview-head';sticky.innerHTML=`<div><span>Live preview</span><strong>${esc(theme?.selectedOptions[0]?.textContent||'Qelly theme')}</strong><small>${esc(persona?.selectedOptions[0]?.textContent||'Governed persona')}</small></div><div><button type="button" data-proxy="cancel">Cancel</button><button type="button" class="is-primary" data-proxy="apply">Apply</button></div>`;controls.prepend(sticky);sticky.querySelector('[data-proxy="cancel"]').onclick=()=>controls.querySelector('[data-ti-action="cancel"]')?.click();sticky.querySelector('[data-proxy="apply"]').onclick=()=>controls.querySelector('[data-ti-action="apply"]')?.click();
  const choiceTitles={themeFamily:'Choose theme family',persona:'Choose persona',marketPalette:'Choose chart palette',tableDensity:'Choose table density'};
  for(const [key,title] of Object.entries(choiceTitles)){const select=controls.querySelector(`[data-ti-select="${key}"]`);if(!select)continue;const field=select.closest('.q-ti-field');field?.classList.add('q-ti-desktop-field');const button=document.createElement('button');button.type='button';button.className='q-ti-mobile-choice';button.innerHTML=`<span>${esc(title.replace('Choose ',''))}</span><strong>${esc(select.selectedOptions[0]?.textContent||select.value)}</strong><span aria-hidden="true">›</span>`;field?.before(button);button.onclick=()=>openChoiceSheet(select,title);}
  const preset=[...controls.querySelectorAll('.q-ti-control-group')].find((item)=>/Preset operations/i.test(item.textContent));if(preset){const button=document.createElement('button');button.type='button';button.className='q-ti-mobile-choice';button.innerHTML='<span>Preset tools</span><strong>Import · Export · Share</strong><span aria-hidden="true">›</span>';preset.querySelector('.q-ti-group-body')?.prepend(button);button.onclick=()=>openPresetSheet(preset);}
}

function commandKind(label){if(/login|account|security|passkey|recover/i.test(label))return 'security';if(/bitcoin|asset|dossier/i.test(label))return 'asset';if(/research|filing|provenance|thesis/i.test(label))return 'research';if(/market|chart|ranking|screener|portfolio/i.test(label))return 'chart';if(/preview|reset|export|create|toggle/i.test(label))return 'action';return 'navigation';}
function commandDescription(label,kind){if(kind==='security')return 'Open the protected identity and account workflow';if(kind==='asset')return 'Inspect canonical asset intelligence and evidence';if(kind==='research')return 'Open evidence-first research and provenance tools';if(kind==='chart')return 'Open governed market intelligence and analytical views';if(kind==='action')return 'Run a reversible workspace action';return `Open ${label} in the Qelly workspace`;}
function enhanceCommandPalette(dialog){
  if(dialog.dataset.visualCorrected==='true')return;dialog.dataset.visualCorrected='true';const results=dialog.querySelector('.q-command-results');if(!results)return;
  results.querySelectorAll('.q-command-group').forEach((group)=>{if(/^Recent$/i.test(group.querySelector('.q-command-group-title')?.textContent?.trim()||''))group.remove();});
  const seen=new Set();const items=[];results.querySelectorAll('.q-command-item').forEach((item)=>{const label=item.querySelector('strong')?.textContent?.trim();if(!label||seen.has(label.toLowerCase())){item.remove();return;}seen.add(label.toLowerCase());items.push(item);const kind=commandKind(label);const icon=item.querySelector('.q-command-item-icon');if(icon)icon.innerHTML=visualIcon(kind);const small=item.querySelector('small');if(small&&/^(?:Alt\s+\d+|Command|BTC|Validation|Default)$/i.test(small.textContent.trim()))small.textContent=commandDescription(label,kind);const shortcut=item.querySelector('.q-command-shortcut');if(shortcut)shortcut.textContent=kind==='chart'?'G then M':kind==='security'?'G then S':kind==='research'?'G then R':kind==='asset'?'B then T':'';item.addEventListener('click',()=>{const history=[label,...readHistory().filter((value)=>value!==label)];writeHistory(history);});});
  results.querySelectorAll('.q-command-group').forEach((group)=>{if(!group.querySelector('.q-command-item'))group.remove();});
  const history=readHistory();const recentItems=history.map((label)=>items.find((item)=>item.querySelector('strong')?.textContent?.trim()===label)).filter(Boolean);if(recentItems.length){const group=document.createElement('section');group.className='q-command-group';group.setAttribute('aria-label','Recent');group.innerHTML='<div class="q-command-group-title"><span>Recent</span><button type="button" data-clear-recent>Clear history</button></div>';recentItems.forEach((item)=>{item.dataset.originalGroup=item.closest('.q-command-group')?.getAttribute('aria-label')||'Navigation';group.append(item);});results.prepend(group);group.querySelector('[data-clear-recent]').onclick=()=>{writeHistory([]);group.remove();};}
  results.classList.toggle('is-compact',results.querySelectorAll('.q-command-item').length<=4);const count=dialog.querySelector('[data-command-count]');if(count)count.textContent=`${results.querySelectorAll('.q-command-item').length} unique results`;
}

function positionTooltip(stage,clientX,clientY){const tooltip=stage.querySelector('[data-mi-chart-tooltip]:not([hidden])');if(!tooltip)return;const rect=stage.getBoundingClientRect();tooltip.style.transform='none';tooltip.style.visibility='hidden';tooltip.style.left='0px';tooltip.style.top='0px';const tip=tooltip.getBoundingClientRect();const gap=10,pad=8;const anchorX=Number.isFinite(clientX)?clientX-rect.left:rect.width*.76;const anchorY=Number.isFinite(clientY)?clientY-rect.top:rect.height*.28;const minX=Math.max(pad,pad-rect.left);const maxX=Math.max(minX,Math.min(rect.width-tip.width-pad,innerWidth-rect.left-tip.width-pad));let left=anchorX+gap<=maxX?anchorX+gap:anchorX-tip.width-gap;left=Math.max(minX,Math.min(maxX,left));const minY=Math.max(pad,pad-rect.top);const maxY=Math.max(minY,Math.min(rect.height-tip.height-pad,innerHeight-rect.top-tip.height-pad));let top=anchorY-tip.height-gap; if(top<minY)top=anchorY+gap;top=Math.max(minY,Math.min(maxY,top));tooltip.style.left=`${Math.round(left)}px`;tooltip.style.top=`${Math.round(top)}px`;tooltip.style.visibility='visible';tooltip.dataset.placement=left<anchorX?'left':'right';}
function bindTooltip(stage){if(stage.dataset.edgeSafe==='true')return;stage.dataset.edgeSafe='true';const schedule=(event)=>requestAnimationFrame(()=>positionTooltip(stage,event?.clientX,event?.clientY));stage.addEventListener('pointermove',schedule,true);stage.addEventListener('pointerdown',schedule,true);stage.addEventListener('pointerenter',schedule,true);stage.addEventListener('keydown',()=>requestAnimationFrame(()=>positionTooltip(stage)),true);new MutationObserver(()=>requestAnimationFrame(()=>positionTooltip(stage))).observe(stage.querySelector('[data-mi-chart-tooltip]')??stage,{attributes:true,attributeFilter:['hidden','style']});requestAnimationFrame(()=>positionTooltip(stage));}

export function enhanceThemeIntelligenceVisuals(root=document){syncVisualDatasets();const scope=root instanceof Element||root instanceof Document?root:document;const page=scope.querySelector?.('.q-ti-page')??(scope.matches?.('.q-ti-page')?scope:null);if(page){enhanceGallery(page);enhanceStudio(page);}scope.querySelectorAll?.('dialog.q-command-dialog').forEach(enhanceCommandPalette);scope.querySelectorAll?.('.q-mi-chart-stage').forEach(bindTooltip);}

let queued=false;const queue=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhanceThemeIntelligenceVisuals(document);});};
new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-resolved-appearance','data-theme-family','data-alpha-intensity','data-alpha-pack']});
addEventListener('hashchange',queue);addEventListener('resize',queue,{passive:true});queue();
