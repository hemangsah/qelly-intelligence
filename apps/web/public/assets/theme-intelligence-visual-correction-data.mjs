export const VISUAL_FAMILY_META=Object.freeze({
  'sovereign-obsidian':{persona:'Quant Operator',density:'Compact',score:96,modes:'Dark · Light · OLED · HC',mode:'dark',colors:['#08090A','#131617','#8F234D','#5EA8C8'],character:'Institutional neutral black and restrained burgundy'},
  'porcelain-signal':{persona:'Research Oracle',density:'Comfortable',score:97,modes:'Light · Dark · HC',mode:'light',colors:['#F8F6F1','#FFFFFF','#7C2445','#17677E'],character:'Editorial porcelain daylight and evidence clarity'},
  'crimson-vector':{persona:'Aggressive Alpha',density:'Compact',score:94,modes:'Dark · Light · OLED',mode:'dark',colors:['#09090A','#151617','#D32D5F','#66B7D8'],character:'Sharp crimson catalyst and momentum emphasis'},
  'obsidian-strike':{persona:'Scalper Velocity',density:'Terminal',score:96,modes:'Dark · OLED · Light',mode:'dark',colors:['#030405','#0D1012','#C23752','#7CA6BA'],character:'Near-monochrome graphite with tiny red signals'},
  'white-heat':{persona:'Aggressive Alpha',density:'Compact',score:97,modes:'Light · Dark · HC',mode:'light',colors:['#F7F7F5','#FFFFFF','#B8204E','#126985'],character:'Bright white, crisp black and controlled red'},
  'ember-protocol':{persona:'Research Oracle',density:'Comfortable',score:95,modes:'Dark · Light',mode:'dark',colors:['#0B0908','#191613','#C16632','#E2A94F'],character:'Charcoal, ember orange and warm amber'},
  'arctic-quant':{persona:'Quant Operator',density:'Compact',score:96,modes:'Dark · Light · OLED',mode:'dark',colors:['#051014','#0E2027','#1881A8','#35B7D6'],character:'Cool graphite, cyan and systematic blue'},
  'emerald-conviction':{persona:'Investor Compound',density:'Comfortable',score:96,modes:'Dark · Light',mode:'dark',colors:['#050B09','#0E1B18','#177B68','#62AEC7'],character:'Deep neutral with emerald portfolio emphasis'},
  'cobalt-circuit':{persona:'Quant Operator',density:'Terminal',score:95,modes:'Dark · Light · OLED',mode:'dark',colors:['#050712','#11172B','#344DB2','#34B9D1'],character:'Technical cobalt and developer-terminal precision'},
  'violet-oracle':{persona:'Research Oracle',density:'Comfortable',score:95,modes:'Dark · Light',mode:'dark',colors:['#090711','#181226','#7046C7','#6BACE0'],character:'Violet research and evidence hierarchy'},
  'gold-dominion':{persona:'Investor Compound',density:'Comfortable',score:96,modes:'Dark · Light',mode:'dark',colors:['#0C0D0D','#1B1E1D','#A98745','#6FA9BE'],character:'Muted champagne and executive warmth'},
  'monochrome-ledger':{persona:'Investor Compound',density:'Terminal',score:98,modes:'Dark · Light · OLED · HC',mode:'dark',colors:['#070707','#141414','#A0A4A7','#91A9B4'],character:'Greyscale ledger with protected market semantics'},
  'signal-access':{persona:'Signal Access',density:'Comfortable',score:100,modes:'Dark · Light · HC',mode:'light',colors:['#FFFFFF','#F4F4F4','#6B0031','#005A73'],character:'High clarity, strong focus and reduced complexity'}
});

export const miniProductPreview=(id)=>{
  const meta=VISUAL_FAMILY_META[id]??VISUAL_FAMILY_META['sovereign-obsidian'];
  const [canvas,panel,accent,info]=meta.colors;
  return `<div class="q-ti-mini-product" style="--mini-canvas:${canvas};--mini-panel:${panel};--mini-accent:${accent};--mini-info:${info}" aria-label="Miniature ${id} Qelly product preview"><div class="q-ti-mini-top"><strong>QELLY</strong><i></i><span>${meta.mode}</span></div><div class="q-ti-mini-rail"><span></span><span></span><span></span><span></span></div><div class="q-ti-mini-workspace"><div class="q-ti-mini-metric"><small>BTC</small><strong>$64,466</strong><em>+1.84%</em></div><svg viewBox="0 0 160 70" aria-hidden="true"><line x1="0" y1="18" x2="160" y2="18"/><line x1="0" y1="38" x2="160" y2="38"/><line x1="0" y1="58" x2="160" y2="58"/><path d="M2 58 25 47 46 51 67 33 88 39 110 21 132 27 158 10"/></svg><button type="button" tabindex="-1">Active</button><div class="q-ti-mini-row"><strong>ETH</strong><span>$3,412</span><em>+0.92%</em></div></div></div>`;
};

export const visualIcon=(kind='navigation')=>{
  const paths={navigation:'<path d="M5 19 19 5M8 5h11v11"/>',security:'<path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/>',asset:'<circle cx="12" cy="12" r="8"/><path d="M9 9.5h4.2a2 2 0 0 1 0 4H9m3-7v11"/>',research:'<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z"/><path d="M8 8h7M8 12h7M8 16h4"/>',chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',action:'<path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/>',recent:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'};
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[kind]??paths.navigation}</svg>`;
};
