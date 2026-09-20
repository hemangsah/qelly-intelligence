import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultOutput=path.join(root,'dist/frontend');
const CANONICAL_DEFAULT='https://terminal.qellyintelligence.com';

export const PUBLIC_ASSET_RESEARCH=Object.freeze([
  Object.freeze({canonicalId:'QI-CRYPTO-BTC',symbol:'BTC',name:'Bitcoin',slug:'bitcoin-btc',category:'Layer 1',context:'Bitcoin is covered as a public crypto market asset. QELLY separates current provider observations from interpretation and does not turn this page into a price forecast.'}),
  Object.freeze({canonicalId:'QI-CRYPTO-ETH',symbol:'ETH',name:'Ethereum',slug:'ethereum-eth',category:'Smart-contract platforms',context:'Ethereum is covered as a public crypto market asset. Current observations are sourced at request time; unavailable provider data is shown as unavailable rather than replaced.'}),
  Object.freeze({canonicalId:'QI-CRYPTO-SOL',symbol:'SOL',name:'Solana',slug:'solana-sol',category:'Smart-contract platforms',context:'Solana is covered as a public crypto market asset. This research surface is a discovery page that hands live analysis to QELLY’s interactive tools.'}),
  Object.freeze({canonicalId:'QI-CRYPTO-XRP',symbol:'XRP',name:'XRP',slug:'xrp',category:'Payments',context:'XRP is covered as a public crypto market asset. QELLY displays source, observation time and freshness with live values instead of publishing unsupported static market claims.'}),
  Object.freeze({canonicalId:'QI-CRYPTO-HYPE',symbol:'HYPE',name:'Hyperliquid',slug:'hyperliquid-hype',category:'Exchange ecosystems',context:'Hyperliquid (HYPE) is covered as a public crypto market asset. Market observations and source state are loaded from QELLY’s approved public market contract.'}),
  Object.freeze({canonicalId:'QI-CRYPTO-DOGE',symbol:'DOGE',name:'Dogecoin',slug:'dogecoin-doge',category:'Meme assets',context:'Dogecoin is covered as a public crypto market asset. The page provides evidence-oriented market context without inventing catalysts, sentiment or future returns.'})
]);

const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const safeJson=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const site=value=>String(value||CANONICAL_DEFAULT).replace(/\/$/,'');
const researchPath=item=>'/research/assets/'+item.slug+'/';

function page(item,base){
  const url=base+researchPath(item);
  const dossier='/#/asset/'+encodeURIComponent(item.canonicalId);
  const description=item.name+' ('+item.symbol+') public market research: live source and freshness state, 24h market context, methodology and handoffs to QELLY analysis tools.';
  const structured={'@context':'https://schema.org','@graph':[
    {'@type':'WebPage',name:item.name+' ('+item.symbol+') Market Research | QELLY Intelligence',description,url,isPartOf:{'@type':'WebSite',name:'QELLY Intelligence',url:base+'/'}},
    {'@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'QELLY',item:base+'/'},
      {'@type':'ListItem',position:2,name:'Research',item:base+'/#/news-research'},
      {'@type':'ListItem',position:3,name:item.name+' ('+item.symbol+')',item:url}
    ]}
  ]};
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+esc(item.name)+' ('+esc(item.symbol)+') Market Research | QELLY Intelligence</title>'+
    '<meta name="description" content="'+esc(description)+'"><meta name="robots" content="index,follow,max-image-preview:large">'+
    '<link rel="canonical" href="'+url+'"><meta property="og:type" content="website"><meta property="og:site_name" content="QELLY Intelligence">'+
    '<meta property="og:title" content="'+esc(item.name)+' ('+esc(item.symbol)+') Market Research | QELLY Intelligence"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+url+'">'+
    '<meta name="twitter:card" content="summary"><meta name="twitter:title" content="'+esc(item.name)+' ('+esc(item.symbol)+') Market Research"><meta name="twitter:description" content="'+esc(description)+'">'+
    '<link rel="stylesheet" href="/assets/asset-research.css"><script type="application/ld+json">'+safeJson(structured)+'</script></head>'+
    '<body data-qelly-asset-research="'+esc(item.canonicalId)+'"><header class="qar-nav"><a class="qar-brand" href="/">QELLY <span>Intelligence</span></a><nav aria-label="Primary"><a href="/#/market">Markets</a><a href="/#/news-research">Research</a><a href="/#/calculator-center">Tools</a></nav></header>'+
    '<main><nav class="qar-crumbs" aria-label="Breadcrumb"><a href="/">QELLY</a><span>/</span><a href="/#/news-research">Research</a><span>/</span><span>'+esc(item.name)+' ('+esc(item.symbol)+')</span></nav>'+
    '<section class="qar-hero"><p class="qar-eyebrow">Public asset research · '+esc(item.category)+'</p><h1>'+esc(item.name)+' <span>'+esc(item.symbol)+'</span></h1><p>'+esc(item.context)+'</p><div class="qar-actions"><a class="qar-primary" href="'+dossier+'">Open live Asset Dossier</a><a href="/#/decision-provenance">Open Decision Intelligence</a></div></section>'+
    '<section class="qar-grid" aria-label="Current market snapshot"><article class="qar-card qar-snapshot"><div class="qar-card-head"><div><p class="qar-eyebrow">Current public observation</p><h2>Market snapshot</h2></div><span data-truth-state class="qar-state">LOADING</span></div>'+
    '<p data-status class="qar-status" aria-live="polite">Loading the latest approved public observation. No fallback value will be generated if the provider is unavailable.</p>'+
    '<dl class="qar-stats"><div><dt>Price</dt><dd data-price>—</dd></div><div><dt>24h direction</dt><dd data-change>—</dd></div><div><dt>24h high</dt><dd data-high>—</dd></div><div><dt>24h low</dt><dd data-low>—</dd></div><div><dt>Range width vs price</dt><dd data-range>—</dd></div><div><dt>Observed</dt><dd data-observed>Pending</dd></div></dl>'+
    '<div class="qar-source"><strong>Source &amp; freshness</strong><p><span data-provider>Pending provider response</span> · <span data-freshness>truth state pending</span></p></div><noscript><p class="qar-unavailable">JavaScript is disabled, so current market observations cannot be requested. Open the live Asset Dossier when scripting is available; no static market value is substituted here.</p></noscript></article>'+
    '<article class="qar-card"><p class="qar-eyebrow">Interpretation boundary</p><h2>What this page tells you</h2><p>QELLY uses current provider-derived price, 24h change and observed high/low range when available. Direction describes the observed 24h move; range width is descriptive context, not a volatility forecast.</p><p>Derivatives, liquidation and options claims are not asserted on this discovery page unless a current authorized QELLY evidence contract supplies them. Use Decision Intelligence for evidence that is actually available.</p></article></section>'+
    '<section class="qar-card qar-method"><p class="qar-eyebrow">Methodology</p><h2>Evidence before interpretation</h2><div class="qar-columns"><div><h3>Source</h3><p>The live snapshot calls QELLY’s same-origin public Asset Dossier API, whose approved asset universe is deliberately bounded. The current market provider and observation timestamp are displayed with the value.</p></div><div><h3>Freshness</h3><p>LIVE, DELAYED, STALE and UNAVAILABLE states are kept visible. Provider outage or stale evidence does not trigger fabricated replacement prices, trends or market narratives.</p></div><div><h3>Scope</h3><p>This is a crawlable discovery and methodology surface. Interactive charting, deeper evidence and decision support remain in the live terminal.</p></div></div></section>'+
    '<section class="qar-card"><p class="qar-eyebrow">Continue research</p><h2>Live tools and related research</h2><div class="qar-links"><a href="'+dossier+'"><strong>Asset Dossier</strong><span>Current price history, evidence and freshness.</span></a><a href="/#/decision-provenance"><strong>Decision Intelligence</strong><span>Weigh available evidence with uncertainty visible.</span></a><a href="/#/news-research"><strong>News &amp; research</strong><span>Open QELLY’s current research workspace.</span></a><a href="/#/event-calendar"><strong>Events</strong><span>Review relevant scheduled-event context where available.</span></a><a href="/calculators/volatility-calculator/"><strong>Volatility Calculator</strong><span>Calculate volatility from your own declared return series.</span></a><a href="/calculators/risk-reward-calculator/"><strong>Risk–Reward Calculator</strong><span>Compare target and stop distances without execution.</span></a></div></section>'+
    '<section class="qar-disclosure"><strong>Research boundary.</strong> This page is read-only educational research, not investment advice, a recommendation, a forecast or an execution service. Current values can change after the displayed observation time.</section></main>'+
    '<footer>QELLY public research network · live observations requested at visit time · <a href="/legal/risk.html">Risk disclosure</a> · <a href="/legal/privacy.html">Privacy</a></footer><script src="/qelly-config.js"></script><script type="module" src="/assets/asset-research.mjs"></script></body></html>';
}

function escapeRegex(value){return String(value).replace(/[.*+?^$()|[\]\\]/g,'\\$&');}
function removeOwnedEntries(sitemap,base){
  let next=String(sitemap);
  for(const item of PUBLIC_ASSET_RESEARCH){
    const url=escapeRegex(base+researchPath(item));
    next=next.replace(new RegExp('\\s*<url><loc>'+url+'</loc>(?:<lastmod>[^<]+</lastmod>)?</url>','g'),'');
  }
  return next;
}

export async function generatePublicAssetResearch({output=defaultOutput,environment=process.env}={}){
  const base=site(environment.QELLY_CANONICAL_SITE_URL||environment.QELLY_PUBLIC_SITE_URL||CANONICAL_DEFAULT);
  for(const item of PUBLIC_ASSET_RESEARCH){
    const directory=path.join(output,'research','assets',item.slug);
    await mkdir(directory,{recursive:true});
    await writeFile(path.join(directory,'index.html'),page(item,base));
  }
  const sitemapPath=path.join(output,'sitemap.xml');
  let sitemap=await readFile(sitemapPath,'utf8');
  sitemap=removeOwnedEntries(sitemap,base);
  const entries=PUBLIC_ASSET_RESEARCH.map(item=>'  <url><loc>'+base+researchPath(item)+'</loc><lastmod>2026-09-20</lastmod></url>').join('\n');
  if(!sitemap.includes('</urlset>'))throw new Error('sitemap.xml is missing </urlset>');
  sitemap=sitemap.replace('</urlset>',entries+'\n</urlset>');
  await writeFile(sitemapPath,sitemap);
  return Object.freeze({status:'public-asset-research-generated',assets:PUBLIC_ASSET_RESEARCH.length,indexable:true,sitemapEntries:PUBLIC_ASSET_RESEARCH.length,base});
}

const invoked=process.argv[1]?pathToFileURL(path.resolve(process.argv[1])).href:'';
if(invoked===import.meta.url)console.log(JSON.stringify(await generatePublicAssetResearch(),null,2));
