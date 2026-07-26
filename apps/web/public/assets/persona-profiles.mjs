export const PERSONA_PROFILES = Object.freeze([
  Object.freeze({
    id:'burgundy-command',
    name:'Scalper Velocity',
    shortName:'Scalper',
    glyph:'↯',
    intent:'Intraday market scanning',
    density:'compact',
    motion:'full',
    fontScale:100,
    defaultRoute:'market',
    defaultTimeframe:'4h',
    animationIntensity:'high',
    alertPosture:'rapid',
    terminology:'velocity',
    modulePriority:['liquidation','funding','order-flow','alerts','watchlists'],
    safeGuidance:'Prioritises fast-changing observations without hiding source, freshness, confidence, or risk.'
  }),
  Object.freeze({
    id:'porcelain-burgundy',
    name:'Investor Compound',
    shortName:'Investor',
    glyph:'◔',
    intent:'Long-horizon portfolio intelligence',
    density:'comfortable',
    motion:'subtle',
    fontScale:100,
    defaultRoute:'portfolio-analytics',
    defaultTimeframe:'5y',
    animationIntensity:'calm',
    alertPosture:'material-change',
    terminology:'compound',
    modulePriority:['fundamentals','portfolio','treasury','adoption','research'],
    safeGuidance:'Prioritises durable evidence, exposure, and long-horizon context.'
  }),
  Object.freeze({
    id:'burgundy-night',
    name:'Aggressive Alpha',
    shortName:'Alpha',
    glyph:'▲',
    intent:'Catalyst and volatility detection',
    density:'compact',
    motion:'full',
    fontScale:100,
    defaultRoute:'advanced-chart',
    defaultTimeframe:'7d',
    animationIntensity:'high',
    alertPosture:'catalyst',
    terminology:'asymmetry',
    modulePriority:['catalysts','volatility','events','funding-dislocation','scenarios'],
    safeGuidance:'Surfaces asymmetric scenarios while preserving uncertainty and downside boundaries.'
  }),
  Object.freeze({
    id:'graphite-terminal',
    name:'Quant Operator',
    shortName:'Quant',
    glyph:'ƒ',
    intent:'Systematic signal diagnostics',
    density:'terminal',
    motion:'subtle',
    fontScale:100,
    defaultRoute:'formula-screener',
    defaultTimeframe:'1y',
    animationIntensity:'precise',
    alertPosture:'model-diagnostic',
    terminology:'factor',
    modulePriority:['factors','signals','methodology','reproducibility','provenance'],
    safeGuidance:'Prioritises methodology, diagnostics, reproducibility, and evidence export.'
  }),
  Object.freeze({
    id:'midnight-research',
    name:'Research Oracle',
    shortName:'Research',
    glyph:'◈',
    intent:'Citation-rich research synthesis',
    density:'comfortable',
    motion:'subtle',
    fontScale:100,
    defaultRoute:'news-research',
    defaultTimeframe:'90d',
    animationIntensity:'low',
    alertPosture:'evidence-change',
    terminology:'evidence',
    modulePriority:['news','filings','citations','contradictions','topic-clusters'],
    safeGuidance:'Prioritises source quality, contradiction, citations, and research history.'
  }),
  Object.freeze({
    id:'high-contrast',
    name:'Signal Access',
    shortName:'Access',
    glyph:'◎',
    intent:'Accessibility-first prioritisation',
    density:'comfortable',
    motion:'reduced',
    fontScale:120,
    defaultRoute:'market',
    defaultTimeframe:'24h',
    animationIntensity:'none',
    alertPosture:'essential-only',
    terminology:'signal',
    modulePriority:['essential-signals','risk','source','freshness','confidence'],
    safeGuidance:'Uses larger text, high contrast, reduced motion, and fewer simultaneous modules.'
  })
]);

export function personaFor(id){
  return PERSONA_PROFILES.find((persona)=>persona.id===id)??PERSONA_PROFILES[0];
}

export function personaPreferencePatch(id){
  const persona=personaFor(id);
  return {
    theme:persona.id,
    density:persona.density,
    motion:persona.motion,
    fontScale:persona.fontScale
  };
}
