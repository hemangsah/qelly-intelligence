import { PERSONA_PROFILES } from '../persona-profiles.mjs';

const accents={
  'burgundy-command':'#c44872',
  'porcelain-burgundy':'#8e1d4b',
  'burgundy-night':'#ec6b97',
  'graphite-terminal':'#d45d8f',
  'midnight-research':'#c44872',
  'high-contrast':'#6b0031'
};

const THEME_PERSONA_COMPACT_STYLES=Object.freeze([
  Object.freeze({selector:'.q-brand-lock-banner',styles:Object.freeze([
    ['min-height','0'],['padding','20px 18px'],['margin-bottom','14px'],['border-radius','26px 26px 26px 10px']
  ])}),
  Object.freeze({selector:'.q-persona-grid',styles:Object.freeze([
    ['grid-template-columns','repeat(2,minmax(0,1fr))'],['gap','12px'],['margin-bottom','14px']
  ])}),
  Object.freeze({selector:'.q-persona-card',styles:Object.freeze([
    ['min-height','0'],['padding','18px'],['border-radius','26px 26px 26px 10px']
  ])}),
  Object.freeze({selector:'.q-persona-glyph',styles:Object.freeze([
    ['width','48px'],['height','48px'],['margin-bottom','16px'],['border-radius','18px 18px 18px 7px']
  ])}),
  Object.freeze({selector:'.q-persona-card h2',styles:Object.freeze([
    ['font-size','23px'],['margin','6px 0']
  ])}),
  Object.freeze({selector:'.q-persona-card>p:not(.q-eyebrow)',styles:Object.freeze([
    ['min-height','0'],['line-height','1.55']
  ])}),
  Object.freeze({selector:'.q-persona-metrics',styles:Object.freeze([
    ['gap','7px'],['margin','14px 0']
  ])}),
  Object.freeze({selector:'.q-persona-metrics span',styles:Object.freeze([
    ['padding','10px'],['border-radius','12px 12px 12px 5px']
  ])}),
  Object.freeze({selector:'.q-persona-best',styles:Object.freeze([
    ['gap','5px'],['margin-bottom','14px']
  ])}),
  Object.freeze({selector:'.q-persona-comparison .q-panel-head',styles:Object.freeze([
    ['min-height','0'],['padding','14px 16px']
  ])}),
  Object.freeze({selector:'.q-persona-matrix-scroll',styles:Object.freeze([
    ['overflow-x','auto'],['overscroll-behavior-inline','contain'],['scrollbar-gutter','stable'],['padding','0']
  ])}),
  Object.freeze({selector:'.q-persona-table',styles:Object.freeze([
    ['min-width','820px']
  ])}),
  Object.freeze({selector:'.q-persona-table>div',styles:Object.freeze([
    ['padding','11px 14px'],['gap','10px']
  ])})
]);

const THEME_PERSONA_MOBILE_STYLES=Object.freeze([
  Object.freeze({selector:'.q-persona-grid',styles:Object.freeze([
    ['grid-template-columns','none'],['grid-auto-flow','column'],['grid-auto-columns','minmax(286px,84vw)'],
    ['overflow-x','auto'],['overflow-y','hidden'],['scroll-snap-type','x mandatory'],['overscroll-behavior-inline','contain'],
    ['scroll-padding-inline','2px'],['padding','2px max(18px,4vw) 14px 2px']
  ])}),
  Object.freeze({selector:'.q-persona-card',styles:Object.freeze([
    ['scroll-snap-align','start'],['scroll-snap-stop','always']
  ])})
]);

let personaCompactMedia=null;
let personaMobileMedia=null;
let personaDensityPage=null;

function setThemePersonaStyle(node,property,value){
  node.style.setProperty(property,value,'important');
}

function visitThemePersonaStyles(page,group,callback){
  group.forEach(({selector,styles})=>{
    page.querySelectorAll(selector).forEach((node)=>{
      styles.forEach(([property,value])=>callback(node,property,value));
    });
  });
}

function applyThemePersonaDensity(){
  const page=personaDensityPage;
  if(!page?.isConnected) return;
  const compact=Boolean(personaCompactMedia?.matches);
  const mobile=Boolean(personaMobileMedia?.matches);

  visitThemePersonaStyles(page,THEME_PERSONA_COMPACT_STYLES,(node,property)=>node.style.removeProperty(property));
  visitThemePersonaStyles(page,THEME_PERSONA_MOBILE_STYLES,(node,property)=>node.style.removeProperty(property));
  if(compact) visitThemePersonaStyles(page,THEME_PERSONA_COMPACT_STYLES,setThemePersonaStyle);
  if(mobile) visitThemePersonaStyles(page,THEME_PERSONA_MOBILE_STYLES,setThemePersonaStyle);

  page.dataset.personaDensity=mobile?'mobile-rail':compact?'tablet-grid':'desktop-grid';
}

function installThemePersonaDensity(page){
  personaDensityPage=page;
  if(!personaCompactMedia){
    personaCompactMedia=window.matchMedia('(max-width: 860px)');
    personaCompactMedia.addEventListener?.('change',applyThemePersonaDensity);
  }
  if(!personaMobileMedia){
    personaMobileMedia=window.matchMedia('(max-width: 620px)');
    personaMobileMedia.addEventListener?.('change',applyThemePersonaDensity);
  }
  applyThemePersonaDensity();
}

export async function renderThemePersonas(main,deps){
  const {pageHead,stateBanner,escapeHtml,toast,applyPersona}=deps;
  const current=document.documentElement.dataset.persona??document.documentElement.dataset.theme;
  main.innerHTML=`<section class="q-page q-theme-persona-page">
    ${pageHead(
      'Qelly operating system · six governed personas',
      'Choose how Qelly prioritises intelligence',
      'Operating modes change density, default horizon, module priority, alert posture, motion, terminology and empty-state guidance. Required risk, source and provenance information remains visible.',
      '<button class="q-button q-button--ghost" data-action="reset-persona">Safe reset</button><button class="q-button q-button--primary" data-action="preview-persona">Preview active mode</button>'
    )}
    ${stateBanner()}
    <section class="q-brand-lock-banner">
      <div><p class="q-eyebrow">Original Qelly identity</p><h2>Dark burgundy intelligence. Porcelain analytical clarity.</h2><p>The signature gradient remains consistent while each mode changes the operating hierarchy—not merely the color palette.</p></div>
      <div class="q-gradient-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
    </section>
    <div class="q-persona-grid" role="region" aria-label="Qelly operating personas" tabindex="0">
      ${PERSONA_PROFILES.map((persona,index)=>`<article class="q-persona-card ${current===persona.id?'is-selected':''}" data-persona="${persona.id}" style="--persona-accent:${accents[persona.id]}">
        <div class="q-persona-index">0${index+1}</div>
        <div class="q-persona-glyph" aria-hidden="true">${persona.glyph}</div>
        <p class="q-eyebrow">${escapeHtml(persona.intent)}</p>
        <h2>${escapeHtml(persona.name)}</h2>
        <p>${escapeHtml(persona.safeGuidance)}</p>
        <div class="q-persona-metrics">
          <span><small>Density</small><strong>${escapeHtml(persona.density)}</strong></span>
          <span><small>Default horizon</small><strong>${escapeHtml(persona.defaultTimeframe)}</strong></span>
          <span><small>Motion</small><strong>${escapeHtml(persona.motion)}</strong></span>
          <span><small>Alert posture</small><strong>${escapeHtml(persona.alertPosture)}</strong></span>
        </div>
        <div class="q-persona-best">${persona.modulePriority.slice(0,5).map((item)=>`<span>${escapeHtml(item)}</span>`).join('')}</div>
        <button class="q-button q-button--persona" data-apply-persona="${persona.id}">${current===persona.id?'Active operating mode':'Activate mode'}</button>
      </article>`).join('')}
    </div>
    <section class="q-panel q-persona-comparison">
      <div class="q-panel-head"><div><h2>Governed behaviour matrix</h2><p>Mode changes are bounded; provenance, risk and truth labels never disappear.</p></div><span class="q-status q-status--cached">6 operating modes</span></div>
      <div class="q-panel-body q-persona-matrix-scroll" role="region" aria-label="Governed persona behaviour matrix" tabindex="0"><div class="q-persona-table">
        <div class="q-persona-table-head"><span>Persona</span><span>Module priority</span><span>Default</span><span>Motion</span><span>Alert posture</span></div>
        ${PERSONA_PROFILES.map((persona)=>`<div><strong>${escapeHtml(persona.name)}</strong><span>${escapeHtml(persona.modulePriority.slice(0,2).join(' + '))}</span><span>${escapeHtml(persona.defaultRoute)} · ${escapeHtml(persona.defaultTimeframe)}</span><span>${escapeHtml(persona.motion)}</span><span>${escapeHtml(persona.alertPosture)}</span></div>`).join('')}
      </div></div>
    </section>
  </section>`;

  const page=main.querySelector('.q-theme-persona-page');
  installThemePersonaDensity(page);

  const activate=async(id)=>{
    await applyPersona(id);
  };
  main.querySelectorAll('[data-apply-persona]').forEach((button)=>button.addEventListener('click',()=>activate(button.dataset.applyPersona)));
  main.querySelector('[data-action="reset-persona"]').addEventListener('click',()=>activate('burgundy-command'));
  main.querySelector('[data-action="preview-persona"]').addEventListener('click',()=>{
    const profile=PERSONA_PROFILES.find((persona)=>persona.id===current)??PERSONA_PROFILES[0];
    toast(`${profile.name}: ${profile.modulePriority.join(', ')}`,{tone:'neutral'});
  });
}