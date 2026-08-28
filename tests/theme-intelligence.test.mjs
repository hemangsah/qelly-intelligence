import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {THEME_FAMILIES,PERSONAS,ALPHA_INTENSITIES,ALPHA_PACKS,APPEARANCE_MODES,THEME_INTELLIGENCE_COUNTS,migrateThemeConfig,resolveTokens,tokenContrastAudit,validateAccent} from '../apps/web/public/assets/theme-intelligence.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');
const REQUIRED_THEMES=['Sovereign Obsidian','Porcelain Signal','Crimson Vector','Obsidian Strike','White Heat','Ember Protocol','Arctic Quant','Emerald Conviction','Cobalt Circuit','Violet Oracle','Gold Dominion','Monochrome Ledger','Signal Access'];
const REQUIRED_MINDSETS={
  'scalper-velocity':['Precision Pulse','Rapid Tape','Microstructure Focus','Velocity Grid'],
  'investor-compound':['Foundation','Long Horizon','Compounding Calm','Preservation First'],
  'aggressive-alpha':['Focused Edge','Tactical Surge','Conviction Strike','Redline Apex'],
  'quant-operator':['Model Discipline','Signal Lab','Vector Engine','Statistical Focus'],
  'research-oracle':['Thesis Mode','Evidence Depth','Contradiction Review','Oracle Synthesis'],
  'signal-access':['Clear Focus','Calm Reading','High Contrast','Reduced Complexity']
};

test('Theme Intelligence inventory uses the exact approved identities and IBM Plex remains locked',async()=>{
  assert.deepEqual(THEME_INTELLIGENCE_COUNTS,{themes:13,personas:6,mindsets:24,alphaIntensities:4,alphaPacks:6,appearances:6});
  assert.deepEqual(THEME_FAMILIES.map((item)=>item.name),REQUIRED_THEMES);
  assert.deepEqual(Object.fromEntries(PERSONAS.map((item)=>[item.id,[...item.mindsets]])),REQUIRED_MINDSETS);
  assert.deepEqual(ALPHA_INTENSITIES,['Focused Edge','Tactical Surge','Conviction Strike','Redline Apex']);
  assert.deepEqual(ALPHA_PACKS.map((item)=>item.name),['Crimson Vector','Obsidian Strike','White Heat','Ember Protocol','Apex Monochrome','Scarlet Circuit']);
  const source=await read('apps/web/public/assets/theme-intelligence.mjs');
  assert.match(source,/Qelly IBM Plex Sans/);assert.match(source,/GT Eesti inactive licence gate/);
  assert.doesNotMatch(source,/fontFamily\s*:\s*["'](?:Inter|Geist|Manrope|GT Eesti)/);
});

test('all curated palettes and Aggressive Alpha combinations pass contrast and semantic separation',()=>{
  let combinations=0;
  for(const theme of THEME_FAMILIES)for(const appearance of ['dark','light','oled','high-contrast']){
    const config=migrateThemeConfig({themeFamily:theme.id,appearance});const audit=tokenContrastAudit(config);combinations++;
    assert.equal(audit.passed,true,`${theme.id}/${appearance}`);assert.notEqual(audit.tokens.positive,audit.tokens.negative);
  }
  for(const alphaIntensity of ALPHA_INTENSITIES)for(const alphaPack of ALPHA_PACKS)for(const appearance of ['dark','light','oled','high-contrast']){
    const config=migrateThemeConfig({themeFamily:'crimson-vector',persona:'aggressive-alpha',mindset:alphaIntensity,alphaIntensity,alphaPack:alphaPack.id,appearance});const audit=tokenContrastAudit(config);combinations++;
    assert.equal(audit.passed,true,`${alphaIntensity}/${alphaPack.id}/${appearance}`);assert.notEqual(audit.tokens.positive,audit.tokens.negative);
  }
  assert.equal(combinations,148);
});

test('system scheduled OLED and high contrast appearances resolve independently',()=>{
  assert.equal(resolveTokens(migrateThemeConfig({appearance:'system'}),{prefersDark:false,prefersContrast:false}).appearance,'light');
  assert.equal(resolveTokens(migrateThemeConfig({appearance:'system'}),{prefersDark:true,prefersContrast:false}).appearance,'dark');
  assert.equal(resolveTokens(migrateThemeConfig({appearance:'system'}),{prefersDark:true,prefersContrast:true}).appearance,'high-contrast');
  assert.equal(resolveTokens(migrateThemeConfig({appearance:'scheduled',schedule:{enabled:true,lightAt:'07:00',darkAt:'19:00'}}),{now:new Date('2026-07-27T12:00:00')}).appearance,'light');
  assert.equal(resolveTokens(migrateThemeConfig({appearance:'scheduled',schedule:{enabled:true,useSun:true,latitude:19.076,longitude:72.8777,lightAt:'07:00',darkAt:'19:00'}}),{now:new Date('2026-07-27T12:00:00')}).appearance,'light');
  assert.equal(resolveTokens(migrateThemeConfig({appearance:'oled'})).canvas,'#000000');
});

test('custom accent validation cannot replace protected semantics',()=>{
  assert.equal(validateAccent('#7A4BD6').valid,true);
  assert.equal(validateAccent('red').valid,false);
  assert.equal(validateAccent('#35C98C').valid,false);
});

test('version migration preserves user intent while canonicalizing legacy identities',()=>{
  const legacy=migrateThemeConfig({version:1,theme:'porcelain-burgundy',customAccent:'broken',persona:'missing'});
  assert.equal(legacy.version,2);assert.equal(legacy.themeFamily,'porcelain-signal');assert.equal(legacy.appearance,'light');assert.equal(legacy.customAccent,null);
  const migratedQuant=migrateThemeConfig({themeFamily:'graphite-terminal',persona:'quant-operator',mindset:'Factor Lab'});
  assert.equal(migratedQuant.themeFamily,'obsidian-strike');assert.equal(migratedQuant.mindset,'Model Discipline');
  const migratedAlpha=migrateThemeConfig({themeFamily:'aggressive-alpha',persona:'aggressive-alpha',mindset:'Redline Apex'});
  assert.equal(migratedAlpha.themeFamily,'crimson-vector');assert.equal(migratedAlpha.mindset,'Redline Apex');
  const tokens=resolveTokens(legacy);assert.equal(tokens.fontFamily,'"Qelly IBM Plex Sans",Arial,"Helvetica Neue",sans-serif');assert.notEqual(tokens.positive,tokens.negative);
});

test('Theme Studio has guarded import export overlays gallery and no hardcoded route palette',async()=>{
  const [route,css,index,bootstrap,fontGovernance,build,app,enhancements]=await Promise.all([read('apps/web/public/assets/routes/theme-intelligence-studio.mjs'),read('apps/web/public/assets/theme-intelligence.css'),read('apps/web/public/index.html'),read('apps/web/public/assets/theme-intelligence-bootstrap.mjs'),read('apps/web/public/assets/qelly-font-governance.css'),read('scripts/build-frontend.mjs'),read('apps/web/public/assets/app.js'),read('apps/web/public/assets/theme-intelligence-enhancements.mjs')]);
  for(const phrase of ['Theme Studio','Theme Gallery','Apply','Cancel','Reset','data-ti-overlay','importPreset','alphaIntensity','alphaPack'])assert.match(route,new RegExp(phrase));
  assert.doesNotMatch(route,/#[0-9a-fA-F]{6}/,'route UI must consume semantic theme data rather than hardcoded colors');
  for(const surface of ['q-command-dialog','q-mi-chart-tooltip','q-mi-table-scroll','q-ti-drawer','role="tooltip"'])assert.match(css,new RegExp(surface.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(index,/theme-intelligence\.css/);assert.match(index,/data-theme-ready="false"/);assert.doesNotMatch(index,/rel=["']preload["'][^>]*ibm-plex-sans-variable\.woff2/i);assert.match(fontGovernance,/ibm-plex-sans-variable\.woff2/);assert.match(build,/ibm-plex-sans-variable\.woff2/);
  assert.match(bootstrap,/renderThemeIntelligenceStudio/);assert.match(bootstrap,/themeIntelligence\.start/);assert.match(bootstrap,/stopImmediatePropagation/);assert.match(bootstrap,/themeFamily:'crimson-vector'/);
  assert.match(route,/DESIGN TOKEN SAMPLE · NO MARKET OBSERVATIONS/);
  assert.match(route,/No provider observation is attached/);
  assert.match(route,/document\.title=`\$\{view===/);
  assert.match(route,/view==='gallery'\?'Theme Gallery':view==='compare'\?'Theme Compare':'Theme Studio'/);
  assert.match(app,/if\(!\/\^#\\\/theme-lab\(\?:\\\/\|\$\)\/\.test\(location\.hash\)\)document\.title/);
  for(const label of ['Light starts','Dark starts','Latitude','Longitude','Custom accent','Accent intensity','Persona','Mindset','Aggressive Alpha level','Visual pack'])assert.match(route,new RegExp(`aria-label="${label}"`));
  assert.match(route,/select aria-label="\$\{label\}" data-ti-select="\$\{key\}"/);
  assert.match(route,/patch\.themeFamily='crimson-vector'/);
  assert.doesNotMatch(route,/patch\.themeFamily='aggressive-alpha'/);
  assert.match(enhancements,/migrateThemeConfig\(\{\.\.\.this\.config,\.\.\.input\}\)/);
  assert.doesNotMatch(route,/\b(?:BTC|ETH|SOL|AAPL|GOLD)\b|\bLive\b|64,466|3,412|2,431|180\.19M/);
});

test('cross-browser title line box remains non-clipping',async()=>{
  const css=await read('apps/web/public/assets/theme-intelligence-studio.css');
  assert.match(css,/\.q-ti-hero h1\{[^}]*line-height:1\.08/);
  assert.match(css,/\.q-ti-page h1,\.q-ti-page h2\{overflow:visible/);
  assert.doesNotMatch(css,/\.q-ti-hero h1\{[^}]*line-height:\.98/);
});

test('Figma generator contains governed Theme Intelligence collections and evidence pages',async()=>{
  const source=await read('design/figma/plugins/theme/code.js');
  assert.match(source,/const PAGES=/);assert.match(source,/const COLLECTIONS=/);assert.match(source,/COLLECTIONS.length/);
  assert.match(source,/Focused Edge/);assert.match(source,/Scarlet Circuit/);assert.match(source,/IBM Plex Sans Variable/);assert.match(source,/GT Eesti remains inactive/);
  for(const phrase of ['stringVariable','floatVariable','market/positive','responsive/viewport'])assert.match(source,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('review workflows remain pull-request only and cannot deploy',async()=>{
  for(const file of ['.github/workflows/theme-intelligence-review.yml','.github/workflows/typography-governance.yml']){
    const source=await read(file);assert.match(source,/pull_request:/);assert.doesNotMatch(source,/\n\s+push:/);assert.doesNotMatch(source,/deploy-pages|pages:\s*write|id-token:\s*write/);
  }
});
