import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const legacyPublicOrigin='https://hemangsah.github.io/qelly-intelligence';
const productionPolishLink='<link rel="stylesheet" href="./assets/qelly-production-polish.css">';
const prohibitedPrimaryCopy=[
  'QELLY GLOBAL PUBLIC BETA',
  'VALIDATION STATE',
  'Retry foundation route',
  'AUTHENTICATION DEMO',
  'LOCAL DEMONSTRATION IDENTITY BOUNDARY',
  'STATE: DEFAULT',
  'Secure identity foundation'
];
const legacyMarketRoute="case 'market': await renderMarket(main); break;";
const publicMarketRoute="case 'market': if(runtimeConfig.dataMode!=='public-runtime')await renderMarket(main); break;";
const legacyWorldclassEnhance="const enhance=async()=>{\n  if(!main||main.getAttribute('aria-busy')==='true'||!main.firstElementChild)return;";
const publicWorldclassEnhance="const enhance=async()=>{\n  if(window.__QELLY_CONFIG__?.dataMode==='public-runtime'){main?.querySelector(':scope > .q-worldclass-context')?.remove();if(main)main.dataset.worldclassRoute=parseHash().route;return;}\n  if(!main||main.getAttribute('aria-busy')==='true'||!main.firstElementChild)return;";

const cleanSiteUrl=(value)=>{
  const url=new URL(String(value||''));
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('QELLY_PUBLIC_SITE_URL must be a clean HTTPS origin');
  return url.toString().replace(/\/$/,'');
};

export function rewritePublicIdentity(source,{siteUrl,file}){
  let text=String(source).replaceAll(legacyPublicOrigin,siteUrl);
  if(file==='qelly-config.js')text=text.replaceAll('QELLY GLOBAL PUBLIC BETA','QELLY');
  if(file==='index.html'){
    const canonical=`<link rel="canonical" href="${siteUrl}/">`;
    const social=[
      canonical,
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Qelly Intelligence">',
      '<meta property="og:title" content="Qelly Intelligence · Verifiable Market Intelligence">',
      '<meta property="og:description" content="Evidence-backed market discovery, quantitative tools and decision provenance.">',
      `<meta property="og:url" content="${siteUrl}/">`,
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="Qelly Intelligence · Verifiable Market Intelligence">',
      '<meta name="twitter:description" content="Evidence-backed market discovery, quantitative tools and decision provenance.">'
    ].join('\n  ');
    if(!text.includes('rel="canonical"'))text=text.replace('</title>',`</title>\n  ${social}`);
    else text=text.replace(/<link rel="canonical"[^>]*>/,canonical);
    if(!text.includes(productionPolishLink))text=text.replace('</head>',`  ${productionPolishLink}\n</head>`);
  }
  return text;
}

export function rewritePublicRuntimeAsset(source,{file}){
  let text=String(source);
  if(file==='assets/app.js'){
    if(text.includes(legacyMarketRoute))text=text.replace(legacyMarketRoute,publicMarketRoute);
    if(!text.includes(publicMarketRoute))throw new Error('Connected public runtime market ownership boundary is missing');
  }
  if(file==='assets/qelly-worldclass-uiux.mjs'){
    if(text.includes(legacyWorldclassEnhance))text=text.replace(legacyWorldclassEnhance,publicWorldclassEnhance);
    if(!text.includes(publicWorldclassEnhance))throw new Error('Connected public runtime review-layer boundary is missing');
  }
  return text;
}

export async function finalizePublicRuntime({environment=process.env}={}){
  const required=environment.QELLY_REQUIRE_PUBLIC_RUNTIME==='true';
  if(!required)return {status:'public-runtime-finalizer-skipped'};
  const siteUrl=cleanSiteUrl(environment.QELLY_PUBLIC_SITE_URL);
  const identityFiles=['index.html','qelly-config.js','legal/beta.html','legal/risk.html','legal/privacy.html','legal/terms.html','support.html','sitemap.xml','robots.txt','manifest.webmanifest'];
  for(const file of identityFiles){
    const target=path.join(output,file),source=await readFile(target,'utf8');
    await writeFile(target,rewritePublicIdentity(source,{siteUrl,file}));
  }
  const runtimeAssets=['assets/app.js','assets/qelly-worldclass-uiux.mjs'];
  for(const file of runtimeAssets){
    const target=path.join(output,file),source=await readFile(target,'utf8');
    await writeFile(target,rewritePublicRuntimeAsset(source,{file}));
  }
  const checks=await Promise.all(identityFiles.map(async(file)=>[file,await readFile(path.join(output,file),'utf8')]));
  for(const [file,text] of checks){
    if(text.includes(legacyPublicOrigin))throw new Error(`Legacy public origin remains in ${file}`);
  }
  const runtimeChecks=await Promise.all(runtimeAssets.map(async(file)=>[file,await readFile(path.join(output,file),'utf8')]));
  const generatedApp=runtimeChecks.find(([file])=>file==='assets/app.js')[1];
  if(generatedApp.includes(legacyMarketRoute)||!generatedApp.includes(publicMarketRoute))throw new Error('Legacy market renderer remains active in connected public runtime');
  const generatedWorldclass=runtimeChecks.find(([file])=>file==='assets/qelly-worldclass-uiux.mjs')[1];
  if(generatedWorldclass.includes(legacyWorldclassEnhance)||!generatedWorldclass.includes(publicWorldclassEnhance))throw new Error('Legacy review layer remains active in connected public runtime');
  const primaryFiles=[
    'index.html',
    'qelly-config.js',
    'assets/prompt2c-public-beta.mjs',
    'assets/routes/auth-login.mjs',
    'assets/routes/auth-register.mjs',
    'assets/routes/auth-recovery.mjs',
    'assets/routes/calculator-detail.mjs'
  ];
  for(const file of primaryFiles){
    const text=await readFile(path.join(output,file),'utf8');
    for(const phrase of prohibitedPrimaryCopy){
      if(text.includes(phrase))throw new Error(`Prohibited production copy ${JSON.stringify(phrase)} remains in ${file}`);
    }
  }
  const index=checks.find(([file])=>file==='index.html')[1];
  if(!index.includes(`<link rel="canonical" href="${siteUrl}/">`)||!index.includes(`<meta property="og:url" content="${siteUrl}/">`))throw new Error('Production canonical/Open Graph identity is incomplete');
  if(!index.includes(productionPolishLink))throw new Error('Production polish stylesheet is not loaded after runtime hardening');
  const generatedConfig=checks.find(([file])=>file==='qelly-config.js')[1];
  if(!generatedConfig.includes('QELLY')||generatedConfig.includes('QELLY GLOBAL PUBLIC BETA'))throw new Error('Generated production product identity is incorrect');
  const headers=await readFile(path.join(output,'_headers'),'utf8');
  if(!/Cache-Control:\s*public, max-age=0, must-revalidate, no-transform/.test(headers))throw new Error('Public HTML must prevent unsolicited edge transformation');
  return {status:'public-runtime-finalized',siteUrl,files:identityFiles.length,runtimeAssets:runtimeAssets.length,legacyOrigins:0,prohibitedPrimaryCopy:0,productionPolish:true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  console.log(JSON.stringify(await finalizePublicRuntime(),null,2));
}
