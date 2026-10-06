import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {PUBLIC_ASSET_RESEARCH} from './generate-public-asset-research.mjs';
import {publicCalculatorNavigation} from '../apps/web/public/assets/public-calculator-navigation.mjs';

export const STANDALONE_PUBLIC_PAGES=Object.freeze([
  ...PUBLIC_ASSET_RESEARCH.map(asset=>Object.freeze({path:`research/assets/${asset.slug}/index.html`,route:'asset',contextType:'asset',asset:asset.symbol,mode:'asset'})),
  ...['beta','privacy','risk','terms'].map(name=>Object.freeze({path:`legal/${name}.html`,route:'trust-center',contextType:'research',mode:'explain'})),
  Object.freeze({path:'support.html',route:'trust-center',contextType:'research',mode:'explain'})
]);
const safeJson=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const header='<a class="q-cn-skip" href="#main">Skip to main content</a><header class="q-cn-nav" aria-label="Qelly product navigation"><a class="q-cn-brand" href="/">QELLY <span>Intelligence</span></a>'+publicCalculatorNavigation()+'<button type="button" data-public-appearance aria-label="Change appearance">Appearance</button></header>';
const css='<link rel="stylesheet" href="/assets/ai/qelly-chat.css"><link rel="stylesheet" href="/assets/public-calculator-shell.css"><link rel="stylesheet" href="/assets/standalone-public-shell.css">';
export async function installStandalonePublicShell({output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist/frontend')}={}){
  let changed=0;
  for(const page of STANDALONE_PUBLIC_PAGES){
    const file=path.join(output,page.path);let html=await readFile(file,'utf8');
    if(html.includes('data-qelly-standalone-shell'))continue;
    const title=html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    if(!title||!/<main(?:\s|>)/.test(html)||!html.includes('</head>')||!html.includes('</body>'))throw Error('Standalone page contract missing: '+page.path);
    // This explicit allowlist never changes the authentication callback or reads
    // its parameters, forms, mailbox data, or private account contents.
    const context={...page,title};
    html=html.replace('<head>','<head><script src="/assets/qelly-prepaint-bootstrap.js"></script>');
    html=html.replace('</head>',css+'</head>');
    html=html.replace(/<header class="qar-nav">[\s\S]*?<\/header>/,'');
    html=html.replace(/<body([^>]*)>/,(_match,attributes)=>`<body${attributes} data-qelly-standalone-shell data-qelly-chat-route="${page.route}">${header}`);
    html=html.replace(/<main(?=\s|>)/,'<main id="main" tabindex="-1"');
    if(!html.includes('src="/qelly-config.js"'))html=html.replace('</body>','<script src="/qelly-config.js"></script></body>');
    html=html.replace('</body>','<script type="application/json" id="q-public-shell-context">'+safeJson(context)+'</script><span data-public-chat-status role="status"></span><script type="module" src="/assets/public-calculator-theme.mjs"></script><script type="module" src="/assets/standalone-public-shell.mjs"></script></body>');
    await writeFile(file,html);changed++;
  }
  return {pages:STANDALONE_PUBLIC_PAGES.length,changed,authenticationCallbackExcluded:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(await installStandalonePublicShell()));
