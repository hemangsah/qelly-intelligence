import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PERSONA_PROFILES } from '../apps/web/public/assets/persona-profiles.mjs';
import { productDomains, routeDefinitions } from '../apps/web/public/assets/route-registry.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFile(path.join(root,file),'utf8');
const json=async(file)=>JSON.parse(await read(file));

const [tokens,motion,charts,screenMatrix,routeMatrix,componentMatrix,plugin,manifest,html,css,premiumCss,figmaScreenMatrix,figmaComponentMatrix,figmaSpec]=await Promise.all([
  json('QELLY_DESIGN_TOKENS.json'),json('QELLY_MOTION_TOKENS.json'),json('QELLY_CHART_TOKENS.json'),read('QELLY_SCREEN_MATRIX.csv'),read('QELLY_ROUTE_INVENTORY.csv'),read('QELLY_COMPONENT_INVENTORY.csv'),read('figma-plugin/code.js'),json('figma-plugin/manifest.json'),read('apps/web/public/index.html'),read('apps/web/public/assets/qelly-foundations.css'),read('apps/web/public/assets/premium-mobile.css'),read('design/figma/QELLY_FIGMA_SCREEN_MATRIX.csv'),read('design/figma/QELLY_FIGMA_COMPONENT_MATRIX.csv'),read('design/figma/QELLY_FIGMA_MASTER_SPEC.md')
]);

const requiredSemantics=['background','surface','surfaceElevated','border','divider','primaryText','secondaryText','mutedText','positive','negative','warning','informational','evidence','stale','fallback','unavailable','selected','focused','hovered','active','disabled','chartGrid','chartAxes','tooltip','sourceNode','observationNode','transformationNode','decisionNode','riskNode','outcomeNode'];
for(const key of requiredSemantics){
  const token=tokens.semanticTokens[key];
  assert.ok(token,`Missing semantic token: ${key}`);
  for(const mode of ['light','dark','highContrast'])assert.ok(token[mode],`Missing ${mode} value for ${key}`);
  assert.ok(token.contrastRule&&token.usage,`Missing governance for ${key}`);
}
assert.equal(Object.keys(tokens.typography.roles).length,24);
assert.equal(PERSONA_PROFILES.length,6);
assert.ok(PERSONA_PROFILES.every((persona)=>persona.defaultRoute&&persona.defaultTimeframe&&persona.modulePriority.length>=5));
assert.ok(productDomains.length>=8);
assert.equal(routeDefinitions.length,61);
assert.equal(routeMatrix.trim().split('\n').length-1,61);
assert.ok(screenMatrix.trim().split('\n').length-1>=61,'Canonical screen matrix must preserve route coverage');
assert.ok(componentMatrix.trim().split('\n').length-1>=40,'Canonical component inventory must remain comprehensive');

const pluginPages=plugin.match(/const PAGE_NAMES=\[([\s\S]*?)\];/)?.[1].match(/'\d{2} [^']+'/g)??[];
const masterScreens=plugin.match(/const MASTER_SCREENS=\[([\s\S]*?)\];/)?.[1].match(/\['/g)??[];
assert.equal(pluginPages.length,31,'Premium Figma generator must create 31 semantic pages');
assert.ok(masterScreens.length>=24,'Premium Figma generator must include desktop/mobile master screens');
assert.match(plugin,/createVariableCollection\('Qelly Premium Semantic'\)/);
assert.match(plugin,/createComponent\(\)/);
assert.match(plugin,/layoutMode='VERTICAL'/);
assert.match(plugin,/qellyMasterFrame/);
assert.doesNotMatch(plugin,/EXPECTED_FRAME_COUNT|Expected 411 frames/);
assert.match(figmaSpec,/opened and visually reviewed/i);
assert.ok(figmaScreenMatrix.trim().split('\n').length-1>=12);
assert.ok(figmaComponentMatrix.trim().split('\n').length-1>=10);

assert.equal(manifest.networkAccess.allowedDomains[0],'none');
assert.match(html,/id="edge-dock"/);
assert.match(html,/id="persona-ribbon"/);
assert.match(html,/id="context-shelf"/);
assert.match(html,/id="compare-tray"/);
assert.match(html,/id="mobile-navigation"/);
assert.match(html,/qelly-premium-reset\.css/);
assert.match(css,/prefers-reduced-motion/);
assert.match(premiumCss,/safe-area-inset-bottom/);
assert.equal(motion.reducedMotion.meaningPreserved,true);
assert.equal(charts.requirements.nonColorEncoding,true);

console.log(JSON.stringify({
  status:'design-foundations-validation-passed',routes:routeDefinitions.length,productDomains:productDomains.length,personas:PERSONA_PROFILES.length,governedSemantics:requiredSemantics.length,typographyRoles:Object.keys(tokens.typography.roles).length,figmaPages:pluginPages.length,figmaMasterScreens:masterScreens.length,figmaComponents:figmaComponentMatrix.trim().split('\n').length-1,canonicalComponents:componentMatrix.trim().split('\n').length-1
},null,2));
