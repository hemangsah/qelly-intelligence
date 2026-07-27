import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {THEME_FAMILIES,PERSONAS,ALPHA_INTENSITIES,ALPHA_PACKS,APPEARANCE_MODES,THEME_INTELLIGENCE_COUNTS,migrateThemeConfig,resolveTokens,tokenContrastAudit,validateAccent} from '../apps/web/public/assets/theme-intelligence.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');

test('Theme Intelligence inventory is complete and IBM Plex remains locked',async()=>{
  assert.deepEqual(THEME_INTELLIGENCE_COUNTS,{themes:13,personas:6,mindsets:24,alphaIntensities:4,alphaPacks:6,appearances:6});
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
    const config=migrateThemeConfig({themeFamily:'aggressive-alpha',persona:'aggressive-alpha',mindset:alphaIntensity,alphaIntensity,alphaPack:alphaPack.id,appearance});const audit=tokenContrastAudit(config);combinations++;
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

test('version migration recovers corrupt or legacy fields without changing font or market meaning',()=>{
  const legacy=migrateThemeConfig({version:1,theme:'porcelain-burgundy',customAccent:'broken',persona:'missing'});
  assert.equal(legacy.version,2);assert.equal(legacy.themeFamily,'porcelain-command');assert.equal(legacy.appearance,'light');assert.equal(legacy.customAccent,null);
  const tokens=resolveTokens(legacy);assert.equal(tokens.fontFamily,'"Qelly IBM Plex Sans",Arial,"Helvetica Neue",sans-serif');assert.notEqual(tokens.positive,tokens.negative);
});

test('Theme Studio has guarded import export overlays gallery and no hardcoded route palette',async()=>{
  const [route,css,index,bootstrap]=await Promise.all([read('apps/web/public/assets/routes/theme-intelligence-studio.mjs'),read('apps/web/public/assets/theme-intelligence.css'),read('apps/web/public/index.html'),read('apps/web/public/assets/theme-intelligence-bootstrap.mjs')]);
  for(const phrase of ['Theme Studio','Theme Gallery','Apply','Cancel','Reset','data-ti-overlay','importPreset','alphaIntensity','alphaPack'])assert.match(route,new RegExp(phrase));
  assert.doesNotMatch(route,/#[0-9a-fA-F]{6}/,'route UI must consume semantic theme data rather than hardcoded colors');
  for(const surface of ['q-command-dialog','q-mi-chart-tooltip','q-mi-table-scroll','q-ti-drawer','role="tooltip"'])assert.match(css,new RegExp(surface.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(index,/theme-intelligence\.css/);assert.match(index,/data-theme-ready="false"/);assert.match(index,/ibm-plex-sans-variable\.woff2/);
  assert.match(bootstrap,/renderThemeIntelligenceStudio/);assert.match(bootstrap,/themeIntelligence\.start/);assert.match(bootstrap,/stopImmediatePropagation/);
});

test('Figma generator contains governed Theme Intelligence collections and evidence pages',async()=>{
  const source=await read('figma-theme-plugin/code.js');
  assert.match(source,/const PAGES=/);assert.match(source,/const COLLECTIONS=/);assert.match(source,/COLLECTIONS.length/);
  assert.match(source,/Focused Edge/);assert.match(source,/Scarlet Circuit/);assert.match(source,/IBM Plex Sans Variable/);assert.match(source,/GT Eesti remains inactive/);
  for(const phrase of ['stringVariable','floatVariable','market/positive','responsive/viewport'])assert.match(source,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('review workflows remain pull-request only and cannot deploy',async()=>{
  for(const file of ['.github/workflows/theme-intelligence-review.yml','.github/workflows/typography-governance.yml']){
    const source=await read(file);assert.match(source,/pull_request:/);assert.doesNotMatch(source,/\n\s+push:/);assert.doesNotMatch(source,/deploy-pages|pages:\s*write|id-token:\s*write/);
  }
});
