import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('final five synthetic routes own their real DOM',async()=>{
  const source=await read('../apps/web/public/assets/qelly-v53-lock-route-cleanup.mjs');
  assert.match(source,/REAL_FINAL_ROUTES=new Set\(\['security-setup','delivery-operations','notification-center','about-qelly','theme-lab'\]\)/);
  assert.match(source,/\.\.\.REAL_FINAL_ROUTES/);
  assert.match(source,/qelly-v53-real-final\.css/);
  assert.match(source,/root\.dataset\.v53RealFinal=route/);
  assert.match(source,/synthetic&&isDedicatedRealRoute\(\)/);
});

test('final real-route CSS is scoped, dense and mobile-collapsible',async()=>{
  const source=await read('../apps/web/public/assets/qelly-v53-real-final.css');
  assert.match(source,/html\[data-v53-real-final\] #main > \.q-page/);
  assert.match(source,/grid-template-columns:minmax\(0,1fr\) 292px/);
  assert.match(source,/q-v53-final-inspector/);
  assert.match(source,/data-v53-real-final="theme-lab"/);
  assert.match(source,/@media\(max-width:900px\)/);
  assert.match(source,/scroll-snap-type:x mandatory/);
  assert.match(source,/grid-template-columns:1fr/);
  assert.doesNotMatch(source,/\.q-v53-lock-page/);
  assert.doesNotMatch(source,/display\s*:\s*none/);
});

test('Security Setup exposes the canonical MFA unavailability boundary without financial authority',async()=>{
  const source=await read('../apps/web/public/assets/routes/security-setup.mjs');
  assert.match(source,/data-capability-state="UNAVAILABLE"/);
  assert.match(source,/data-capability="mfa"/);
  assert.match(source,/Authenticator MFA is unavailable/);
  assert.match(source,/Cloudflare Pages Functions/);
  assert.match(source,/Current authentication/);
  assert.match(source,/Email\/password session and supported recovery flow/);
  assert.match(source,/Financial authority/);
  assert.match(source,/never authorizes trading, custody, transfers, wallet signing or money movement/);
  assert.match(source,/No MFA operation will be attempted/);
  assert.doesNotMatch(source,/\/api\/v1\/auth\/mfa\//);
  assert.doesNotMatch(source,/\bapi\s*\(|\bfetch\s*\(/);
});

test('Delivery Operations separates configuration, attempts and external-delivery proof',async()=>{
  const source=await read('../apps/web/public/assets/routes/delivery-operations.mjs');
  assert.match(source,/q-v53-final-workspace/);
  assert.match(source,/q-v53-final-inspector/);
  assert.match(source,/external transmission only when configured/i);
  assert.match(source,/External delivery is never inferred from local sink evidence/);
  assert.match(source,/no market execution, custody, transfer or wallet-signing authority/i);
});

test('Notification Center does not infer external delivery from inbox persistence',async()=>{
  const source=await read('../apps/web/public/assets/routes/notification-center.mjs');
  assert.match(source,/q-v53-final-workspace/);
  assert.match(source,/q-v53-final-inspector/);
  assert.match(source,/Inbox state does not imply push, email or webhook delivery/);
  assert.match(source,/Verified separately in Provider Operations/);
  assert.match(source,/external delivery not inferred/i);
  assert.doesNotMatch(source,/signing service absent|service worker absent/i);
});

test('About Qelly uses the current product contract and avoids false live-market claims',async()=>{
  const source=await read('../apps/web/public/assets/routes/about-qelly.mjs');
  assert.match(source,/70<\/strong><span>Connected product routes/);
  assert.match(source,/qelly-symbol\.svg/);
  assert.match(source,/Read-only<\/strong>/);
  assert.match(source,/0<\/strong><span>Trade, transfer or wallet-signing routes enabled/);
  assert.match(source,/governed market context/i);
  assert.match(source,/demonstration feeds are live market truth/);
  assert.doesNotMatch(source,/47<\/strong><span>Integrated application screens/);
  assert.doesNotMatch(source,/Live and historical market structure/);
});

test('Theme Lab static market-shaped samples are explicitly guarded as demonstration data',async()=>{
  const source=await read('../apps/web/public/assets/qelly-v53-theme-preview-truth.mjs');
  const css=await read('../apps/web/public/assets/qelly-v53-theme-preview-truth.css');
  assert.match(source,/THEME DEMONSTRATION · STATIC SAMPLE VALUES · NOT LIVE MARKET DATA/);
  assert.match(source,/if\(value==='live'\)cell\.textContent='Preview sample'/);
  assert.match(source,/Preview delayed state/);
  assert.match(source,/Preview cached state/);
  assert.match(source,/MutationObserver/);
  assert.match(css,/data-qelly-preview-truth="demonstration"/);
  assert.doesNotMatch(source,/fetch\(|\/api\/v1\/live-markets/);
});
