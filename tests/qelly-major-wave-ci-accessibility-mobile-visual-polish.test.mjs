import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave CI exposes a complete spoken range summary and keyboard-equivalent controls',async()=>{
  const [route,chat]=await Promise.all([read('apps/web/public/assets/routes/decision-proven-graph.mjs'),read('apps/web/public/assets/ai/qelly-chat.mjs')]);
  assert.match(route,/data-dpg-range-announcement role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(route,/Selected range from/);
  assert.match(route,/aria-valuetext="/);
  assert.match(route,/aria-describedby="q-dpg-range-instructions"/);
  assert.match(route,/data-mode="'\+escapeHtml\(chartMode\)\+'"/);
});

test('Wave CI provides accessible Decision depth tabs and focus restoration',async()=>{
  const [route,chat]=await Promise.all([read('apps/web/public/assets/routes/decision-proven-graph.mjs'),read('apps/web/public/assets/ai/qelly-chat.mjs')]);
  assert.match(route,/id="qelly-decision-tab-'\+id\+'"/);
  assert.match(route,/aria-controls="qelly-decision-panel-'\+id\+'"/);
  assert.match(route,/tabindex="'\+\(state\.uiMode===id\?'0':'-1'\)\+'"/);
  for(const mode of ['simple','advanced','research']){
    assert.match(route,new RegExp('id="qelly-decision-panel-'+mode+'"'));
    assert.match(route,new RegExp('aria-labelledby="qelly-decision-tab-'+mode+'"'));
  }
  assert.match(route,/\['ArrowLeft','ArrowRight','Home','End'\]/);
  assert.match(route,/const focusedMode=main\.querySelector\('\[data-dpg-ui-mode\]:focus'\)\?\.dataset\.dpgUiMode\|\|null/);
  assert.match(route,/const focusedStableControl=main\.querySelector\('\[data-dpg-asset-picker-toggle\]:focus'\)\?'asset-picker'/);
  assert.match(route,/let chartGestureActive=false,chartGestureDeferredDraw=false,pendingFocusSelector=null/);
  assert.match(route,/const queueFocusAfterDraw=\(selector\)=>\{pendingFocusSelector=selector;\}/);
  assert.match(route,/const applyPendingFocus=\(\)=>\{[\s\S]{0,360}requestAnimationFrame[\s\S]{0,160}focus\(\{preventScroll:true\}\)/);
  assert.match(route,/if\(focusedMode\)main\.querySelector\('\[data-dpg-ui-mode="'[\s\S]{0,100}\?\.focus\(\)/);
  assert.match(route,/focusedStableControl==='asset-picker'[\s\S]{0,140}data-dpg-asset-picker-toggle[\s\S]{0,100}focus\(\{preventScroll:true\}\)/);
  assert.match(route,/applyPendingFocus\(\)/);
  assert.match(route,/data-dpg-chat-dock-close[\s\S]{0,260}data-dpg-chat-dock-toggle/);
  assert.match(route,/data-dpg-asset-picker-close[\s\S]{0,360}queueFocusAfterDraw\('\[data-dpg-asset-picker-toggle\]'\)/);
  assert.match(route,/data-dpg-asset-picker-panel[\s\S]{0,360}event\.key==='Escape'[\s\S]{0,220}event\.stopPropagation\(\)[\s\S]{0,220}queueFocusAfterDraw\('\[data-dpg-asset-picker-toggle\]'\)/);
  assert.match(route,/data-dpg-asset-search[\s\S]{0,300}event\.key==='Escape'[\s\S]{0,220}event\.stopPropagation\(\)[\s\S]{0,220}queueFocusAfterDraw\('\[data-dpg-asset-picker-toggle\]'\)/);
});

test('Wave CI respects reduced motion for programmatic scrolling',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/prefersReducedMotion/);
  assert.match(route,/motionBehavior/);
  assert.doesNotMatch(route,/scrollIntoView\(\{behavior:'smooth'/);
  assert.match(route,/scrollIntoView\(\{behavior:motionBehavior\(\)/);
});

test('Wave CI styles visible focus, safe areas, touch targets and collapsed composer semantics',async()=>{
  const [css,chatCss]=await Promise.all([read('apps/web/public/assets/qelly-decision-proven-graph.css'),read('apps/web/public/assets/ai/qelly-chat.css')]);
  assert.match(css,/Major Reinvention Wave CI: accessibility, mobile and visual polish/);
  assert.match(css,/\.q-dpg-sr-only\{/);
  assert.doesNotMatch(css,/q-dpg-chat-dock/);
  assert.match(chatCss,/\.q-ai-assistant\[hidden\]\{display:none!important\}/);
  assert.match(css,/:focus-visible\{outline:3px solid/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/safe-area-inset-left/);
  assert.match(css,/safe-area-inset-right/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(chatCss,/safe-area-inset-bottom/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/@media\(max-width:900px\)[\s\S]*?\.q-dpg-stage\{grid-template-columns:minmax\(0,1fr\)\}/);
});
