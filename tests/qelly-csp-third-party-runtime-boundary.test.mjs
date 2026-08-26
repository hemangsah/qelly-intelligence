import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assetsRoot=path.join(root,'apps/web/public/assets');

async function browserSources(directory){
  const output=[];
  for(const entry of await readdir(directory)){
    const full=path.join(directory,entry);
    const info=await stat(full);
    if(info.isDirectory())output.push(...await browserSources(full));
    else if(/\.(?:mjs|js)$/i.test(entry))output.push(full);
  }
  return output;
}

test('browser asset runtime does not load JavaScript from general-purpose third-party CDNs',async()=>{
  const files=await browserSources(assetsRoot);
  const forbiddenHost=/https?:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh|skypack\.dev)\//i;
  const failures=[];
  for(const file of files){
    const source=await readFile(file,'utf8');
    if(forbiddenHost.test(source))failures.push(path.relative(root,file));
  }
  assert.deepEqual(failures,[],`Unapproved browser runtime script loaders found: ${failures.join(', ')}`);
});

test('production CSP keeps first-party JavaScript as the default and allowlists only approved external displays',async()=>{
  const headers=await readFile(path.join(root,'apps/web/public/_headers'),'utf8');
  const csp=headers.match(/Content-Security-Policy:\s*([^\n]+)/)?.[1]||'';
  const directive=(name)=>csp.split(';').map((value)=>value.trim()).find((value)=>value.startsWith(`${name} `))||'';
  assert.equal(directive('script-src'),"script-src 'self' https://s3.tradingview.com https://files.coinmarketcap.com https://platform.twitter.com");
  assert.equal(directive('connect-src'),"connect-src 'self' https://3rdparty-apis.coinmarketcap.com wss://api.hyperliquid.xyz");
  assert.equal(directive('frame-src'),'frame-src https://*.tradingview.com https://*.tradingview-widget.com https://platform.twitter.com https://syndication.twitter.com');
  assert.doesNotMatch(directive('script-src'),/'unsafe-inline'|'unsafe-eval'/);
  assert.doesNotMatch(directive('connect-src'),/tradingview|binance|coinbase|arkham|coinglass|forexfactory/i);
});
