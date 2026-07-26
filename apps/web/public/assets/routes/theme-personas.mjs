import { PERSONA_PROFILES } from '../persona-profiles.mjs';

const accents={
  'burgundy-command':'#c44872',
  'porcelain-burgundy':'#8e1d4b',
  'burgundy-night':'#ec6b97',
  'graphite-terminal':'#d45d8f',
  'midnight-research':'#c44872',
  'high-contrast':'#6b0031'
};

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
    <div class="q-persona-grid">
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
      <div class="q-panel-body"><div class="q-persona-table">
        <div class="q-persona-table-head"><span>Persona</span><span>Module priority</span><span>Default</span><span>Motion</span><span>Alert posture</span></div>
        ${PERSONA_PROFILES.map((persona)=>`<div><strong>${escapeHtml(persona.name)}</strong><span>${escapeHtml(persona.modulePriority.slice(0,2).join(' + '))}</span><span>${escapeHtml(persona.defaultRoute)} · ${escapeHtml(persona.defaultTimeframe)}</span><span>${escapeHtml(persona.motion)}</span><span>${escapeHtml(persona.alertPosture)}</span></div>`).join('')}
      </div></div>
    </section>
  </section>`;

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
