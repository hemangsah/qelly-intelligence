import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {matchUnavailableCapability} from '../functions/_lib/capability-registry.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot=path.join(root,'apps/web/public');

async function browserSources(directory){const output=[];for(const entry of await readdir(directory)){const full=path.join(directory,entry);const info=await stat(full);if(info.isDirectory())output.push(...await browserSources(full));else if(/\.(?:mjs|js|html)$/i.test(entry))output.push(full);}return output;}
function normalizeApiPath(raw){let value=String(raw||'').trim();if(!value.startsWith('/api/v1/'))return null;value=value.replace(/\$\{[^}]+\}/g,':param').split('?')[0].split('#')[0].replace(/\/+$/,'');return value||'/api/v1';}
function extractApiCalls(source){const calls=[];const quoted=/(?:\bapi|\bfetch)\s*\(\s*(['"])(\/api\/v1\/[^'"\n]*)\1/g;const templated=/(?:\bapi|\bfetch)\s*\(\s*`(\/api\/v1\/[^`]*)`/g;for(const match of source.matchAll(quoted))calls.push(match[2]);for(const match of source.matchAll(templated))calls.push(match[1]);return calls.map(normalizeApiPath).filter(Boolean);}

const EXACT_IMPLEMENTED=new Set(['/api/v1/config','/api/v1/health','/api/v1/readiness','/api/v1/platform/readiness','/api/v1/platform/data-plane','/api/v1/platform/capabilities','/api/v1/auth/email-capability','/api/v1/auth/register','/api/v1/auth/login','/api/v1/auth/callback','/api/v1/auth/session','/api/v1/auth/status','/api/v1/auth/refresh','/api/v1/auth/logout','/api/v1/auth/recovery/request','/api/v1/auth/recovery/status','/api/v1/auth/recovery/reset','/api/v1/cloud/opt-in','/api/v1/cloud/status','/api/v1/account/delete','/api/v1/account/export','/api/v1/profile','/api/v1/providers/status','/api/v1/providers/runtime','/api/v1/public/providers','/api/v1/market/overview','/api/v1/market/network','/api/v1/public/markets/overview','/api/v1/public/markets/assets','/api/v1/session/context','/api/v1/preferences/layout','/api/v1/sessions','/api/v1/sync/push','/api/v1/sync/pull','/api/v1/saved-calculations','/api/v1/feedback','/api/v1/live-markets/catalog','/api/v1/live-markets/status','/api/v1/live-markets/candles','/api/v1/live-markets/ticker','/api/v1/research/workspaces','/api/v1/workspace/watchlists','/api/v1/portfolio/overview','/api/v1/portfolio/holdings','/api/v1/portfolio/performance','/api/v1/portfolio/risk','/api/v1/portfolio/attribution','/api/v1/instruments/search','/api/v1/instruments/summary','/api/v1/instruments/resolve','/api/v1/data-quality/status','/api/v1/data-quality/events','/api/v1/data-quality/incidents','/api/v1/data-quality/providers','/api/v1/contracts/entitlements','/api/v1/entitlements/evaluate','/api/v1/timeseries/summary']);
const RETIRED_DEAD_CODE=new Set(['/api/v1/watchlist']);

function cloudflareImplementationState(apiPath){
 if(RETIRED_DEAD_CODE.has(apiPath))return 'retired-dead-code';
 if(EXACT_IMPLEMENTED.has(apiPath))return 'implemented';
 if(/^\/api\/v1\/providers\/(?:binance|coinbase|ecb)$/.test(apiPath))return 'implemented';
 if(/^\/api\/v1\/public\/markets\/assets\/[^/]+(?:\/candles)?$/.test(apiPath))return 'implemented';
 if(/^\/api\/v1\/saved-calculations\/[^/]+(?:\/(?:restore|revisions|revisions\/restore))?$/.test(apiPath))return 'implemented';
 if(/^\/api\/v1\/research\/workspaces\/[^/]+(?:\/(?:items|versions(?:\/[^/]+\/restore)?))?$/.test(apiPath))return 'implemented';
 if(/^\/api\/v1\/workspace\/watchlists\/[^/]+(?:\/items(?:\/[^/]+)?)?$/.test(apiPath))return 'implemented';
 if(/^\/api\/v1\/instruments\/[^/]+(?:\/relationships)?$/.test(apiPath))return 'implemented';
 if(/^\/api\/v1\/timeseries\/[^/]+$/.test(apiPath))return 'implemented';
 const relative=String(apiPath||'').replace(/^\/api\/v1\//,'');
 if(matchUnavailableCapability(relative))return 'unavailable';
 return 'unowned';
}
function cloudflareOwns(apiPath){return ['implemented','unavailable'].includes(cloudflareImplementationState(apiPath));}

test('every reachable literal browser API dependency is implemented or explicitly governed unavailable in canonical Cloudflare',async()=>{const files=await browserSources(publicRoot);const dependencies=new Map();for(const file of files){const source=await readFile(file,'utf8');for(const apiPath of extractApiCalls(source)){if(!dependencies.has(apiPath))dependencies.set(apiPath,new Set());dependencies.get(apiPath).add(path.relative(root,file));}}const unowned=[...dependencies.entries()].filter(([apiPath])=>cloudflareImplementationState(apiPath)==='unowned').map(([apiPath,filesForPath])=>({apiPath,files:[...filesForPath].sort()})).sort((left,right)=>left.apiPath.localeCompare(right.apiPath));assert.deepEqual(unowned,[],`Browser API paths without any canonical Cloudflare ownership/truth state:\n${unowned.map(item=>`- ${item.apiPath} <- ${item.files.join(', ')}`).join('\n')}`);});
test('legacy /api/v1/watchlist literal is provably retired dead code, not a production API alias',async()=>{const source=await readFile(path.join(root,'apps/web/public/assets/app.js'),'utf8');assert.equal(cloudflareImplementationState('/api/v1/watchlist'),'retired-dead-code');assert.equal(cloudflareOwns('/api/v1/watchlist'),false);assert.match(source,/case 'watchlist':\s*await renderWorkspaceWatchlist\(/);assert.equal((source.match(/\brenderWatchlist\s*\(/g)||[]).length,1,'legacy renderWatchlist must have no callsite');assert.equal((source.match(/['"]\/api\/v1\/watchlist['"]/g)||[]).length,1,'legacy endpoint literal must remain isolated to dead code until safely removed');});
test('coverage distinguishes implementation, governed capability debt and retired dead code',()=>{for(const endpoint of ['/api/v1/profile','/api/v1/market/network','/api/v1/portfolio/overview','/api/v1/portfolio/holdings','/api/v1/portfolio/performance','/api/v1/portfolio/risk','/api/v1/portfolio/attribution','/api/v1/platform/data-plane','/api/v1/instruments/search','/api/v1/instruments/summary','/api/v1/instruments/resolve','/api/v1/data-quality/incidents','/api/v1/instruments/QI-TOKENIZED-QQQB/relationships','/api/v1/contracts/entitlements','/api/v1/entitlements/evaluate','/api/v1/timeseries/summary','/api/v1/timeseries/EURINR'])assert.equal(cloudflareImplementationState(endpoint),'implemented');assert.equal(cloudflareImplementationState('/api/v1/portfolio/import'),'unavailable');assert.equal(cloudflareImplementationState('/api/v1/watchlist'),'retired-dead-code');assert.equal(cloudflareImplementationState('/api/v1/auth/mfa/status'),'unavailable');assert.equal(cloudflareImplementationState('/api/v1/streams/market'),'unavailable');assert.equal(cloudflareImplementationState('/api/v1/calculators/catalog'),'unowned');assert.equal(cloudflareImplementationState('/api/v1/admin/anything'),'unowned');});
export const __cloudflareBrowserParityTest=Object.freeze({normalizeApiPath,extractApiCalls,cloudflareOwns,cloudflareImplementationState});
