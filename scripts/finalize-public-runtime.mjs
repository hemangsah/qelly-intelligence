import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const legacyPublicOrigin='https://hemangsah.github.io/qelly-intelligence';
const productionPolishLink='<link rel="stylesheet" href="./assets/qelly-production-polish.css">';
const productionV6Link='<link rel="stylesheet" href="./assets/qelly-v6-production-convergence.css">';
const instrumentV6Link='<link rel="stylesheet" href="./assets/routes/instrument-master-v6.css">';
const marketV6Link='<link rel="stylesheet" href="./assets/routes/market-v6.css">';
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
const publicMarketRoute="case 'market': await import('./routes/market-v6.mjs').then(({renderMarketV6})=>renderMarketV6(main,{api,pageHead,stateBanner,escapeHtml})); break;";
const legacyDataMeshRoute="case 'data-mesh': await renderDataMesh(main); break;";
const publicDataMeshRoute="case 'data-mesh': await import('./routes/provider-runtime-v6.mjs').then(({renderProviderRuntimeV6})=>renderProviderRuntimeV6(main,{api,pageHead,stateBanner,escapeHtml})); break;";
const legacyInstrumentRoute="case 'instrument-master': await renderInstrumentMaster(main); break;";
const publicInstrumentRoute="case 'instrument-master': await import('./routes/instrument-master-v6.mjs').then(({renderInstrumentMasterV6})=>renderInstrumentMasterV6(main,{api,pageHead,stateBanner,escapeHtml})); break;";
const legacyTimeSeriesRoute="case 'timeseries-lab': await renderTimeSeriesLab(main); break;";
const publicTimeSeriesRoute="case 'timeseries-lab': await import('./routes/time-series-v6.mjs').then(({renderTimeSeriesV6})=>renderTimeSeriesV6(main,{api,pageHead,stateBanner,escapeHtml})); break;";
const legacyCalculatorDetailRoute="case 'calculator-detail': await renderCalculatorDetail(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute,id:state.asset,query:state.routeQuery}); break;";
const publicCalculatorDetailRoute="case 'calculator-detail': await import('./routes/calculator-detail-v6.mjs').then(({renderCalculatorDetailV6})=>renderCalculatorDetailV6(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute,id:state.asset,query:state.routeQuery})); break;";
const legacyIndicatorDetailRoute="case 'indicator-detail': await renderIndicatorDetail(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute,id:state.asset}); break;";
const publicIndicatorDetailRoute="case 'indicator-detail': await import('./routes/indicator-detail-v6.mjs').then(({renderIndicatorDetailV6})=>renderIndicatorDetailV6(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute,id:state.asset})); break;";
const legacyPortfolioRoute="case 'portfolio-analytics': await renderPortfolioAnalytics(main,{api,pageHead,stateBanner,escapeHtml,QellyDataGrid,QellyChartShell,formatCompact,navigate}); break;";
const publicPortfolioRoute="case 'portfolio-analytics': await import('./routes/portfolio-v6-entry.mjs').then(({renderPortfolioV6Entry})=>renderPortfolioV6Entry(main,{api,pageHead,stateBanner,escapeHtml,QellyDataGrid,QellyChartShell,formatCompact,navigate})); break;";
const legacyWorldclassEnhance="const enhance=async()=>{\n  if(!main||main.getAttribute('aria-busy')==='true'||!main.firstElementChild)return;";
const publicWorldclassEnhance="const enhance=async()=>{\n  if(window.__QELLY_CONFIG__?.dataMode==='public-runtime'){main?.querySelector(':scope > .q-worldclass-context')?.remove();if(main)main.dataset.worldclassRoute=parseHash().route;return;}\n  if(!main||main.getAttribute('aria-busy')==='true'||!main.firstElementChild)return;";

const appRouteMigrations=Object.freeze([
  [legacyMarketRoute,publicMarketRoute],
  [legacyDataMeshRoute,publicDataMeshRoute],
  [legacyInstrumentRoute,publicInstrumentRoute],
  [legacyTimeSeriesRoute,publicTimeSeriesRoute],
  [legacyCalculatorDetailRoute,publicCalculatorDetailRoute],
  [legacyIndicatorDetailRoute,publicIndicatorDetailRoute],
  [legacyPortfolioRoute,publicPortfolioRoute]
]);

const cleanSiteUrl=(value,name='QELLY_PUBLIC_SITE_URL')=>{
  const url=new URL(String(value||''));
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error(`${name} must be a clean HTTPS origin`);
  return url.toString().replace(/\/$/,'');
};

export function rewritePublicIdentity(source,{siteUrl,canonicalUrl=siteUrl,file}){
  // siteUrl owns local asset/runtime identity. canonicalUrl owns SEO/public authority.
  let text=String(source).replaceAll(legacyPublicOrigin,siteUrl);
  if(file==='qelly-config.js')text=text.replaceAll('QELLY GLOBAL PUBLIC BETA','QELLY');
  if(file==='index.html'){
    const canonical=`<link rel="canonical" href="${canonicalUrl}/">`;
    const social=[
      canonical,
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Qelly Intelligence">',
      '<meta property="og:title" content="Qelly Intelligence · Verifiable Market Intelligence">',
      '<meta property="og:description" content="Evidence-backed market discovery, quantitative tools and decision provenance.">',
      `<meta property="og:url" content="${canonicalUrl}/">`,
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="Qelly Intelligence · Verifiable Market Intelligence">',
      '<meta name="twitter:description" content="Evidence-backed market discovery, quantitative tools and decision provenance.">'
    ].join('\n  ');
    if(!text.includes('rel="canonical"'))text=text.replace('</title>',`</title>\n  ${social}`);
    else{
      text=text.replace(/<link rel="canonical"[^>]*>/,canonical);
      text=text.replace(/<meta property="og:url"[^>]*>/,`<meta property="og:url" content="${canonicalUrl}/">`);
    }
    if(!text.includes(productionPolishLink))text=text.replace('</head>',`  ${productionPolishLink}\n</head>`);
    if(!text.includes(productionV6Link))text=text.replace('</head>',`  ${productionV6Link}\n</head>`);
    if(!text.includes(instrumentV6Link))text=text.replace('</head>',`  ${instrumentV6Link}\n</head>`);
    if(!text.includes(marketV6Link))text=text.replace('</head>',`  ${marketV6Link}\n</head>`);
  }
  return text;
}

export function rewritePublicRuntimeAsset(source,{file}){
  let text=String(source);
  if(file==='assets/app.js'){
    for(const [legacyRoute,publicRoute] of appRouteMigrations){
      if(text.includes(legacyRoute))text=text.replace(legacyRoute,publicRoute);
    }
  }
  if(file==='assets/qelly-worldclass-uiux.mjs'){
    const lineEnding=text.includes('\r\n')?'\r\n':'\n';
    const normalized=text.replaceAll('\r\n','\n');
    if(normalized.includes(legacyWorldclassEnhance))text=normalized.replace(legacyWorldclassEnhance,publicWorldclassEnhance).replaceAll('\n',lineEnding);
  }
  return text;
}

export async function finalizePublicRuntime({environment=process.env}={}){
  const required=environment.QELLY_REQUIRE_PUBLIC_RUNTIME==='true';
  if(!required)return {status:'public-runtime-finalizer-skipped'};
  const siteUrl=cleanSiteUrl(environment.QELLY_PUBLIC_SITE_URL);
  const canonicalUrl=cleanSiteUrl(environment.QELLY_CANONICAL_SITE_URL||siteUrl,'QELLY_CANONICAL_SITE_URL');
  const githubPagesMirror=environment.QELLY_GITHUB_PAGES_MIRROR==='true';
  const identityFiles=['index.html','qelly-config.js','legal/beta.html','legal/risk.html','legal/privacy.html','legal/terms.html','support.html','sitemap.xml','robots.txt','manifest.webmanifest'];
  for(const file of identityFiles){
    const target=path.join(output,file),source=await readFile(target,'utf8');
    await writeFile(target,rewritePublicIdentity(source,{siteUrl,canonicalUrl,file}));
  }
  const runtimeAssets=['assets/app.js','assets/qelly-worldclass-uiux.mjs'];
  for(const file of runtimeAssets){
    const target=path.join(output,file),source=await readFile(target,'utf8');
    await writeFile(target,rewritePublicRuntimeAsset(source,{file}));
  }
  const checks=await Promise.all(identityFiles.map(async(file)=>[file,await readFile(path.join(output,file),'utf8')]));
  if(!githubPagesMirror){
    for(const [file,text] of checks){
      if(text.includes(legacyPublicOrigin))throw new Error(`Legacy public origin remains in ${file}`);
    }
  }
  const runtimeChecks=await Promise.all(runtimeAssets.map(async(file)=>[file,await readFile(path.join(output,file),'utf8')]));
  const generatedApp=runtimeChecks.find(([file])=>file==='assets/app.js')[1];
  if(generatedApp.includes(legacyMarketRoute)||!generatedApp.includes(publicMarketRoute))throw new Error('Governed V6 market renderer is not active in connected public runtime');
  if(generatedApp.includes(legacyDataMeshRoute)||!generatedApp.includes(publicDataMeshRoute))throw new Error('Legacy provider fixture renderer remains active in connected public runtime');
  if(generatedApp.includes(legacyInstrumentRoute)||!generatedApp.includes(publicInstrumentRoute))throw new Error('Legacy synthetic instrument renderer remains active in connected public runtime');
  if(generatedApp.includes(legacyTimeSeriesRoute)||!generatedApp.includes(publicTimeSeriesRoute))throw new Error('Legacy synthetic time-series renderer remains active in connected public runtime');
  if(generatedApp.includes(legacyCalculatorDetailRoute)||!generatedApp.includes(publicCalculatorDetailRoute))throw new Error('Legacy calculator-detail renderer remains active in connected public runtime');
  if(generatedApp.includes(legacyIndicatorDetailRoute)||!generatedApp.includes(publicIndicatorDetailRoute))throw new Error('Legacy indicator-detail renderer remains active in connected public runtime');
  if(generatedApp.includes(legacyPortfolioRoute)||!generatedApp.includes(publicPortfolioRoute))throw new Error('V6 portfolio renderer is not active in connected public runtime');
  const generatedWorldclass=runtimeChecks.find(([file])=>file==='assets/qelly-worldclass-uiux.mjs')[1].replaceAll('\r\n','\n');
  if(generatedWorldclass.includes(legacyWorldclassEnhance)||!generatedWorldclass.includes(publicWorldclassEnhance))throw new Error('Legacy review layer remains active in connected public runtime');
  const primaryFiles=[
    'index.html',
    'qelly-config.js',
    'assets/prompt2c-public-beta.mjs',
    'assets/routes/auth-login.mjs',
    'assets/routes/auth-register.mjs',
    'assets/routes/auth-recovery.mjs',
    'assets/routes/calculator-center.mjs',
    'assets/routes/calculator-detail-v6.mjs',
    'assets/routes/indicator-library.mjs',
    'assets/routes/indicator-detail-v6.mjs',
    'assets/routes/provider-runtime-v6.mjs',
    'assets/routes/instrument-master-v6.mjs',
    'assets/routes/time-series-v6.mjs',
    'assets/routes/portfolio-v6-entry.mjs',
    'assets/routes/portfolio-v6.mjs',
    'assets/routes/market-v6.mjs'
  ];
  for(const file of primaryFiles){
    const text=await readFile(path.join(output,file),'utf8');
    for(const phrase of prohibitedPrimaryCopy){
      if(text.includes(phrase))throw new Error(`Prohibited production copy ${JSON.stringify(phrase)} remains in ${file}`);
    }
  }
  const index=checks.find(([file])=>file==='index.html')[1];
  if(!index.includes(`<link rel="canonical" href="${canonicalUrl}/">`)||!index.includes(`<meta property="og:url" content="${canonicalUrl}/">`))throw new Error('Production canonical/Open Graph identity is incomplete');
  if(!index.includes(productionPolishLink))throw new Error('Production polish stylesheet is not loaded after runtime hardening');
  if(!index.includes(productionV6Link))throw new Error('V6 production convergence stylesheet is not loaded');
  if(!index.includes(instrumentV6Link))throw new Error('V6 instrument master stylesheet is not loaded');
  if(!index.includes(marketV6Link))throw new Error('V6 market stylesheet is not loaded');
  const generatedConfig=checks.find(([file])=>file==='qelly-config.js')[1];
  if(!generatedConfig.includes('QELLY')||generatedConfig.includes('QELLY GLOBAL PUBLIC BETA'))throw new Error('Generated production product identity is incorrect');
  const headers=await readFile(path.join(output,'_headers'),'utf8');
  if(!/Cache-Control:\s*public, max-age=0, must-revalidate, no-transform/.test(headers))throw new Error('Public HTML must prevent unsolicited edge transformation');
  return {status:'public-runtime-finalized',siteUrl,canonicalUrl,githubPagesMirror,files:identityFiles.length,runtimeAssets:runtimeAssets.length,legacyOrigins:githubPagesMirror?'mirror-origin-retained':0,prohibitedPrimaryCopy:0,productionPolish:true,v6ProductionConvergence:true,instrumentMasterV6:true,marketV6:true,calculatorDetailV6:true,indicatorDetailV6:true,portfolioV6:true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  console.log(JSON.stringify(await finalizePublicRuntime(),null,2));
}
