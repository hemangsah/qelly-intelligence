import './qelly-brand-tokens.js';
export const FONT_STACK='"Qelly IBM Plex Sans",Arial,"Helvetica Neue",sans-serif';
export const TYPOGRAPHY_LOCK='IBM Plex Sans Variable permanent canonical font · GT Eesti inactive licence gate';
export const VERSION=2;
export const STORAGE_KEY='qelly.theme-intelligence.v2';
export const LEGACY_KEY='qelly.theme-profile';

export const freeze=(value)=>Object.freeze(value);
const palette=(values)=>freeze({...values,fontFamily:FONT_STACK});
const BRAND_DARK=globalThis.__QELLY_BRAND_TOKENS__.dark,BRAND_LIGHT=globalThis.__QELLY_BRAND_TOKENS__.light;

export const APPEARANCE_MODES=freeze(['dark','light','oled','high-contrast','system','scheduled']);
export const THEME_FAMILIES=freeze([
  freeze({id:'sovereign-obsidian',name:'Sovereign Obsidian',intent:'Canonical institutional Qelly',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#35C98C',negative:'#FF6678',warning:'#F4B860',info:'#6FB8D8'}),light:palette({...BRAND_LIGHT,positive:'#087A52',negative:'#C12F45',warning:'#8A5A00',info:'#136A85'})}),
  freeze({id:'porcelain-signal',name:'Porcelain Signal',intent:'Premium editorial research and daylight clarity',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#49D09B',negative:'#FF7586',warning:'#FFC36B',info:'#78C5DF'}),light:palette({...BRAND_LIGHT,positive:'#0A7653',negative:'#BA3047',warning:'#8B5A00',info:'#17677E'})}),
  freeze({id:'obsidian-strike',name:'Obsidian Strike',intent:'Dense keyboard-first execution and derivatives focus',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#2ED39A',negative:'#FF6175',warning:'#F0B45C',info:'#58B8DB'}),light:palette({...BRAND_LIGHT,positive:'#087A55',negative:'#BC2D44',warning:'#805500',info:'#126986'})}),
  freeze({id:'monochrome-ledger',name:'Monochrome Ledger',intent:'Low-distraction evidence and ledger workspace',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#35C997',negative:'#FF6A86',warning:'#EAB35B',info:'#6EAFE8'}),light:palette({...BRAND_LIGHT,positive:'#087553',negative:'#BB304B',warning:'#805500',info:'#27668E'})}),
  freeze({id:'white-heat',name:'White Heat',intent:'High-clarity light-led conviction workspace',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#3FD69E',negative:'#FF5D73',warning:'#FFC15F',info:'#69BFE0'}),light:palette({...BRAND_LIGHT,positive:'#087952',negative:'#C02441',warning:'#825300',info:'#126985'})}),
  freeze({id:'arctic-quant',name:'Arctic Quant',intent:'Cool high-clarity systematic monitoring',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#38CE96',negative:'#FF6E79',warning:'#F0B65B',info:'#5CC3E8'}),light:palette({...BRAND_LIGHT,positive:'#087A55',negative:'#BC3043',warning:'#805500',info:'#0C698C'})}),
  freeze({id:'ember-protocol',name:'Ember Protocol',intent:'Warm catalyst and protocol intelligence',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#45CC92',negative:'#FF6E76',warning:'#E8B15A',info:'#6BB7D5'}),light:palette({...BRAND_LIGHT,positive:'#087653',negative:'#B92F40',warning:'#7D5100',info:'#17647C'})}),
  freeze({id:'cobalt-circuit',name:'Cobalt Circuit',intent:'Low-glare derivatives and market-flow depth',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#34CB92',negative:'#FF657B',warning:'#E9B056',info:'#65BCE5'}),light:palette({...BRAND_LIGHT,positive:'#087752',negative:'#BB3046',warning:'#805500',info:'#176888'})}),
  freeze({id:'emerald-conviction',name:'Emerald Conviction',intent:'Long-horizon quality and conviction analysis',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#39D49B',negative:'#FF6B78',warning:'#EAB25A',info:'#62BBDD'}),light:palette({...BRAND_LIGHT,positive:'#087852',negative:'#BC3043',warning:'#805500',info:'#176784'})}),
  freeze({id:'violet-oracle',name:'Violet Oracle',intent:'Research synthesis and contradiction review',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#3ACF98',negative:'#FF6A82',warning:'#EDB45E',info:'#6BB7E4'}),light:palette({...BRAND_LIGHT,positive:'#087653',negative:'#BB3047',warning:'#805500',info:'#17688A'})}),
  freeze({id:'gold-dominion',name:'Gold Dominion',intent:'Treasury, fundamentals and capital stewardship',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#45C98B',negative:'#F56D74',warning:'#E3B04F',info:'#66B5CE'}),light:palette({...BRAND_LIGHT,positive:'#0A7650',negative:'#B8323F',warning:'#765000',info:'#17647B'})}),
  freeze({id:'signal-access',name:'Signal Access',intent:'Maximum readability, high contrast and reduced complexity',accent:'#6B0031',dark:palette({canvas:'#000000',surface:'#080808',panel:'#111111',raised:'#1A1A1A',overlay:'#000000',text:'#FFFFFF',secondary:'#F2F2F2',muted:'#CFCFCF',border:'#FFFFFF',divider:'#777777',accent:'#FF4B9B',accentText:'#000000',positive:'#34FF9A',negative:'#FF6173',warning:'#FFD84A',info:'#62D7FF',focus:'#FFFFFF',selected:'#5A1232',grid:'#666666'}),light:palette({canvas:'#FFFFFF',surface:'#FFFFFF',panel:'#F4F4F4',raised:'#FFFFFF',overlay:'#FFFFFF',text:'#000000',secondary:'#111111',muted:'#333333',border:'#000000',divider:'#666666',accent:'#6B0031',accentText:'#FFFFFF',positive:'#006B3D',negative:'#A60020',warning:'#6A4900',info:'#005A73',focus:'#000000',selected:'#FFD7E7',grid:'#777777'})}),
  freeze({id:'crimson-vector',name:'Crimson Vector',intent:'Catalyst, volatility and aggressive-alpha intelligence',accent:'#6F1838',dark:palette({...BRAND_DARK,positive:'#3AD39A',negative:'#FF4F68',warning:'#FFC05A',info:'#6ABDE0'}),light:palette({...BRAND_LIGHT,positive:'#087852',negative:'#C01F3E',warning:'#805300',info:'#126985'})})
]);

export const PERSONAS=freeze([
  freeze({id:'scalper-velocity',name:'Scalper Velocity',mindsets:['Precision Pulse','Rapid Tape','Microstructure Focus','Velocity Grid']}),
  freeze({id:'investor-compound',name:'Investor Compound',mindsets:['Foundation','Long Horizon','Compounding Calm','Preservation First']}),
  freeze({id:'aggressive-alpha',name:'Aggressive Alpha',mindsets:['Focused Edge','Tactical Surge','Conviction Strike','Redline Apex']}),
  freeze({id:'quant-operator',name:'Quant Operator',mindsets:['Model Discipline','Signal Lab','Vector Engine','Statistical Focus']}),
  freeze({id:'research-oracle',name:'Research Oracle',mindsets:['Thesis Mode','Evidence Depth','Contradiction Review','Oracle Synthesis']}),
  freeze({id:'signal-access',name:'Signal Access',mindsets:['Clear Focus','Calm Reading','High Contrast','Reduced Complexity']})
]);
export const ALPHA_INTENSITIES=freeze(['Focused Edge','Tactical Surge','Conviction Strike','Redline Apex']);
export const ALPHA_PACKS=freeze([
  freeze({id:'crimson-vector',name:'Crimson Vector',accent:'#6F1838',canvas:'#050405',surface:'#100C0F',positive:'#39D39A',negative:'#FF5069'}),
  freeze({id:'obsidian-strike',name:'Obsidian Strike',accent:'#6F1838',canvas:'#050405',surface:'#100C0F',positive:'#38CD91',negative:'#FF5D70'}),
  freeze({id:'white-heat',name:'White Heat',accent:'#6F1838',canvas:'#F8F5F2',surface:'#FFFCF9',positive:'#087A52',negative:'#BF2542'}),
  freeze({id:'ember-protocol',name:'Ember Protocol',accent:'#6F1838',canvas:'#050405',surface:'#100C0F',positive:'#46CD91',negative:'#FF645B'}),
  freeze({id:'apex-monochrome',name:'Apex Monochrome',accent:'#6F1838',canvas:'#050405',surface:'#100C0F',positive:'#D9FFF0',negative:'#FFB0B8'}),
  freeze({id:'scarlet-circuit',name:'Scarlet Circuit',accent:'#6F1838',canvas:'#050405',surface:'#100C0F',positive:'#35D39B',negative:'#FF435D'})
]);

export const DEFAULT_THEME_CONFIG=freeze({version:VERSION,appearance:'dark',themeFamily:'sovereign-obsidian',persona:'quant-operator',mindset:'Model Discipline',alphaIntensity:'Focused Edge',alphaPack:'crimson-vector',customAccent:null,tableDensity:'compact',dataEmphasis:'balanced',marketPalette:'semantic',borderVisibility:'subtle',selectedStrength:'medium',focusStyle:'ring',accentIntensity:70,motion:'subtle',fontScale:100,schedule:{enabled:false,lightAt:'07:00',darkAt:'19:00',timezone:'local',useSun:false,latitude:null,longitude:null}});
