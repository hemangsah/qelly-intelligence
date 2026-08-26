import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';
import {__intelligenceTerminalTest} from '../apps/web/public/assets/routes/intelligence-terminal.mjs';
import {rewriteGovernedDiscovery} from '../scripts/finalize-governed-discovery.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('AI, news and community terminal is a visible public product destination',()=>{
  const route=routeDefinitions.find((item)=>item.route==='news-research');
  assert.equal(route?.public,true);
  assert.equal(route?.label,'AI, News & Community');
  assert.equal(__intelligenceTerminalTest.AI_PROVIDERS.length,8);
  assert.ok(__intelligenceTerminalTest.NEWS_SOURCES.length>=4);
  assert.ok(__intelligenceTerminalTest.COMMUNITY_LINKS.some((item)=>item.name.includes('X')));
});

test('AI, news and community terminal remains available in disconnected preview mode',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  const preview=await read('apps/web/public/assets/static-preview-api.mjs');
  assert.match(app,/staticPreviewRoutes=new Set\(\[[^\]]*'news-research'/);
  assert.match(preview,/routes:\s*\[[^\]]*'news-research'/);
});

test('terminal keeps provider launches external and never inserts unsafe chat iframes',async()=>{
  const source=await read('apps/web/public/assets/routes/intelligence-terminal.mjs');
  const styles=await read('apps/web/public/assets/routes/intelligence-terminal.css');
  assert.doesNotMatch(source,/<iframe\b/i);
  assert.match(source,/noopener noreferrer nofollow/);
  assert.match(source,/No Qelly API credential or conversation access is claimed/);
  assert.doesNotMatch(source,/Gmail contains/i);
  assert.match(source,/Prompts stay private until you open an external provider/);
  assert.match(source,/providerPolicyMessage/);
  assert.doesNotMatch(source,/provider\.termsState\|\|provider\.reason/);
  assert.match(styles,/\.q-intelligence-terminal \.q-it-tabs button\{height:auto!important;min-height:44px!important\}/);
});

test('all protected destinations remain visible and preserve their requested route',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  assert.match(app,/sessionStorage\.setItem\('qelly\.returnTo',state\.route\)/);
  assert.match(app,/definition\.public!==true&&!definition\.anonymousOnly/);
  assert.match(app,/The feature is not missing/);
});

test('production finalizer preserves the working intelligence terminal',()=>{
  const source="case 'news-research': await renderNewsResearch(main); break;";
  const output=rewriteGovernedDiscovery(source);
  assert.match(output,/renderIntelligenceTerminal/);
  assert.doesNotMatch(output,/renderGovernedUnavailable/);
});

test('local Qelly Guide routes common intents without model inference',()=>{
  assert.equal(__intelligenceTerminalTest.guide('verify this claim').route,'qelly-verify');
  assert.equal(__intelligenceTerminalTest.guide('calculate a SIP').route,'india-finance');
  assert.equal(__intelligenceTerminalTest.guide('open my watchlist').route,'watchlist');
  assert.equal(__intelligenceTerminalTest.guide('show market conditions').route,'market');
});

test('Intelligence Terminal opens the native grounded Qelly assistant',async()=>{
  const source=await read('apps/web/public/assets/routes/intelligence-terminal.mjs');
  assert.match(source,/Finance research AI/);
  assert.match(source,/WORKERS AI ONLINE/);
  assert.match(source,/qelly:open-ai/);
  assert.match(source,/api\('\/api\/v1\/intelligence\/chat'\)/);
  assert.match(source,/source, freshness and licence boundaries/);
});
