import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const luminance=(hex)=>{
  const channels=hex.match(/[0-9a-f]{2}/gi).map(part=>parseInt(part,16)/255);
  const rgb=channels.map(c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4));
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
};
const contrast=(a,b)=>{
  const l1=luminance(a),l2=luminance(b);
  return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
};
const palette=(source)=>{
  const vars={};
  for(const [,key,hex] of source.matchAll(/--q-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi))vars[key]=hex;
  return vars;
};

test('Wave CP semantic layer is a single first-paint stylesheet loaded after competing legacy themes',async()=>{
  const [index,css]=await Promise.all([read('apps/web/public/index.html'),read('apps/web/public/assets/qelly-semantic-design-system.css')]);
  const first=index.indexOf('qelly-semantic-design-system.css');
  assert.ok(first>index.indexOf('qelly-growth-runtime.css'));
  assert.ok(first>index.indexOf('qelly-premium-theme.css'));
  assert.ok(first<index.indexOf('qelly-production-shell.mjs'));
  assert.equal(index.split('qelly-semantic-design-system.css').length-1,1);
  for(const key of ['bg','surface','surface-elevated','text','text-muted','border','accent','positive','negative','warning','info','focus','overlay','chart-grid']){
    assert.ok(css.includes('--'+key+':'),key);
  }
  assert.match(css,/:root\[data-appearance="light"\]/);
  assert.match(css,/:root\[data-resolved-appearance="light"\]/);
  assert.match(css,/:root\[data-appearance="high-contrast"\]/);
});

test('production palette seed keeps dark and light body, muted text and elevated cards WCAG AA',async()=>{
  const css=await read('apps/web/public/assets/qelly-production-shell.css');
  const dark=palette(css.slice(0,css.indexOf(':root[data-appearance="light"]')));
  const light=palette(css.slice(css.indexOf(':root[data-appearance="light"]'),css.indexOf('html {')));
  for(const [name,vars] of [['dark',dark],['light',light]]){
    for(const pair of [['text','canvas'],['muted','canvas'],['text','surface-elevated'],['muted','surface']]){
      const ratio=contrast(vars[pair[0]],vars[pair[1]]);
      assert.ok(ratio>=4.5,name+' '+pair.join('/')+' contrast '+ratio.toFixed(2));
    }
  }
});

test('global chat uses accessible theme colors and readable fonts outside route content',async()=>{
  const css=await read('apps/web/public/assets/qelly-semantic-design-system.css');
  for(const phrase of ['html .q-ai-root .q-ai-assistant','html .q-ai-root .q-ai-message--assistant','html .q-ai-root .q-ai-message--user','--q-ds-dialog:','--q-ds-chat-assistant:','background:var(--q-ds-dialog)','color:var(--text-muted)','font-size:14px','font-size:12px','min-height:44px']){
    assert.ok(css.includes(phrase),phrase);
  }
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/font-size:16px; \/\* avoid mobile zoom \*\//);
  assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/outline:2px solid var\(--focus\)/);
});
