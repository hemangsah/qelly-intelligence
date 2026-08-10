import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PERSONA_PROFILES} from '../apps/web/public/assets/persona-profiles.mjs';

const routeSource=await readFile(new URL('../apps/web/public/assets/routes/theme-personas.mjs',import.meta.url),'utf8');

const presentationStart=routeSource.indexOf('const THEME_PERSONA_MOBILE_STYLES');
const presentationEnd=routeSource.indexOf('let personaDensityMedia');
const presentationSource=routeSource.slice(presentationStart,presentationEnd);

test('Theme Personas keeps every governed persona and comparison row',()=>{
  assert.equal(PERSONA_PROFILES.length,6);
  assert.equal(new Set(PERSONA_PROFILES.map((persona)=>persona.id)).size,6);
  assert.equal((routeSource.match(/PERSONA_PROFILES\.map/g)||[]).length,2);
  assert.match(routeSource,/data-persona="\$\{persona\.id\}"/);
  assert.match(routeSource,/data-apply-persona="\$\{persona\.id\}"/);
  assert.match(routeSource,/Governed behaviour matrix/);
});

test('Theme Personas owns a mobile-only horizontal evidence rail without hiding persona content',()=>{
  assert.ok(presentationStart>=0&&presentationEnd>presentationStart);
  assert.match(routeSource,/window\.matchMedia\('\(max-width: 620px\)'\)/);
  assert.match(presentationSource,/selector:'\.q-persona-grid'/);
  assert.match(presentationSource,/\['grid-auto-flow','column'\]/);
  assert.match(presentationSource,/\['grid-auto-columns','minmax\(286px,84vw\)'\]/);
  assert.match(presentationSource,/\['overflow-x','auto'\]/);
  assert.match(presentationSource,/\['scroll-snap-type','x mandatory'\]/);
  assert.match(presentationSource,/\['scroll-snap-align','start'\]/);
  assert.match(routeSource,/style\.setProperty\(property,value,'important'\)/);
  assert.match(routeSource,/page\.dataset\.personaDensity=active\?'mobile-rail':'desktop-grid'/);
  assert.doesNotMatch(presentationSource,/display[^\n]*none|visibility[^\n]*hidden|opacity[^\n]*['"]0['"]/i);
});

test('Theme Personas exposes keyboard-focusable scroll regions for cards and governed matrix',()=>{
  assert.match(routeSource,/class="q-persona-grid" role="region" aria-label="Qelly operating personas" tabindex="0"/);
  assert.match(routeSource,/class="q-panel-body q-persona-matrix-scroll" role="region" aria-label="Governed persona behaviour matrix" tabindex="0"/);
  assert.match(presentationSource,/selector:'\.q-persona-matrix-scroll'/);
  assert.match(presentationSource,/\['overscroll-behavior-inline','contain'\]/);
});
