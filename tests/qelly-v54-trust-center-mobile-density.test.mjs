import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const SHELL='apps/web/public/assets/shell-foundations.mjs';
const APP='apps/web/public/assets/app.js';
const RESPONSIVE='scripts/release-v53-responsive-evidence.py';

function trustRenderer(source){
  const normalized=source.replace(/\r\n/g,'\n');
  const start=normalized.indexOf('async function renderTrustCenter(main)');
  const end=normalized.indexOf('\n\nasync function renderSecurityEvidence',start);
  assert.ok(start>=0,'Trust Center renderer missing');
  assert.ok(end>start,'Trust Center renderer boundary missing');
  return normalized.slice(start,end);
}

test('Trust Center phone density is route-scoped, reversible and keyboard-scrollable',async()=>{
  const shell=await read(SHELL);
  assert.match(shell,/const TRUST_CENTER_MOBILE_PRESENTATION=/);
  assert.match(shell,/trustCenterDensityMedia=.*matchMedia\('\(max-width: 620px\)'\)/);
  assert.match(shell,/page\?\.querySelector\('\.q-method-card'\)/);
  assert.match(shell,/page\?\.querySelector\('\.q-coverage-table'\)/);
  assert.match(shell,/page\?\.querySelector\('\.q-discovery-three'\)/);
  assert.match(shell,/q-trust-method-rail/);
  assert.match(shell,/grid-template-columns':'repeat\(2,minmax\(0,1fr\)\)'/);
  assert.match(shell,/scroll-snap-type':'x proximity'/);
  assert.match(shell,/overscroll-behavior-inline':'contain'/);
  assert.match(shell,/evidenceRail\.tabIndex=0/);
  assert.match(shell,/evidenceRail\.setAttribute\('role','region'\)/);
  assert.match(shell,/evidenceRail\.setAttribute\('aria-label','Trust Center component, incident, security and attestation evidence'\)/);
  assert.match(shell,/evidenceRail\.removeAttribute\('tabindex'\)/);
  assert.match(shell,/element\.style\.setProperty\(name,value,'important'\)/);
  assert.match(shell,/element\.style\.removeProperty\(name\)/);
  assert.match(shell,/document\.documentElement\.dataset\.trustCenterDensity=active\?'active':'desktop'/);
  assert.match(shell,/installTrustCenterDensity\(\)/);

  const presentation=shell.slice(shell.indexOf('const TRUST_CENTER_MOBILE_PRESENTATION='),shell.indexOf('function setTrustCenterPresentation'));
  assert.doesNotMatch(presentation,/display['"]?\s*:\s*['"]none|visibility['"]?\s*:\s*['"]hidden|opacity['"]?\s*:\s*['"]0/);
});

test('Trust Center keeps every methodology, coverage row and trust-status evidence record',async()=>{
  const app=await read(APP);
  const block=trustRenderer(app);
  assert.equal((block.match(/<article class="q-kpi">/g)||[]).length,4);
  for(const owner of [
    'methods.items.map',
    'coverage.assetClasses.map',
    'status.components.map',
    'status.incidents.map',
    'status.maintenance.map',
    'status.securityNotices.map',
    'status.attestations.map'
  ])assert.ok(block.includes(owner),`missing complete evidence owner ${owner}`);
  assert.doesNotMatch(block,/\.slice\s*\(/);
  assert.match(block,/production gated/);
  assert.match(block,/No external audit claim/);
  assert.match(block,/not a claim of complete or licensed global market data/);
});

test('Trust Center remains in governed nine-width responsive evidence',async()=>{
  const responsive=await read(RESPONSIVE);
  assert.match(responsive,/'trust-center'/);
  assert.match(responsive,/VIEWPORTS=\[/);
  for(const width of [360,390,430,768,1024,1280,1440,1728,1920]){
    assert.ok(responsive.includes(String(width)),`missing governed viewport ${width}`);
  }
});
