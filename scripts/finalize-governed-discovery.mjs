import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const appPath=path.join(root,'dist/frontend/assets/app.js');

const unavailable=(route)=>`case '${route}': await import('./routes/governed-discovery.mjs').then(({renderGovernedUnavailable})=>renderGovernedUnavailable(main,{api,pageHead,stateBanner,escapeHtml,navigate,toast,state},'${route}')); break;`;
const converter="case 'converter': await import('./routes/governed-utility-v2.mjs').then(({renderGovernedConverterV2})=>renderGovernedConverterV2(main,{api,pageHead,stateBanner,escapeHtml,navigate,toast,state})); break;";
const trustCenter="case 'trust-center': await import('./routes/governed-utility-v2.mjs').then(({renderGovernedTrustCenterV2})=>renderGovernedTrustCenterV2(main,{api,pageHead,stateBanner,escapeHtml,navigate,toast,state})); break;";
const migrations=Object.freeze([
  ["case 'discovery-hub': await renderDiscoveryHub(main); break;",unavailable('discovery-hub')],
  ["case 'search': await renderSearch(main); break;",unavailable('search')],
  ["case 'categories': await renderCategories(main); break;",unavailable('categories')],
  ["case 'category-detail': await renderCategoryDetail(main); break;",unavailable('category-detail')],
  ["case 'venues': await renderVenues(main); break;",unavailable('venues')],
  ["case 'venue-detail': await renderVenueDetail(main); break;",unavailable('venue-detail')],
  ["case 'dex-discovery': await renderDexDiscovery(main); break;",unavailable('dex-discovery')],
  ["case 'global-charts': await renderGlobalCharts(main); break;",unavailable('global-charts')],
  ["case 'news-research': await renderNewsResearch(main); break;",unavailable('news-research')],
  ["case 'research-article': await renderResearchArticle(main); break;",unavailable('research-article')],
  ["case 'asset': await renderAsset(main); break;",unavailable('asset')],
  ["case 'rankings': await renderLegacyRankings(main); break;",unavailable('rankings')],
  ["case 'converter': await renderConverter(main); break;",converter],
  ["case 'trust-center': await renderTrustCenter(main); break;",trustCenter]
]);

export function rewriteGovernedDiscovery(source){
  let text=String(source);
  for(const [legacy,replacement] of migrations){
    if(text.includes(legacy))text=text.replace(legacy,replacement);
  }
  return text;
}

export async function finalizeGovernedDiscovery({environment=process.env}={}){
  if(environment.QELLY_REQUIRE_PUBLIC_RUNTIME!=='true')return {status:'governed-discovery-finalizer-skipped'};
  const source=await readFile(appPath,'utf8');
  const output=rewriteGovernedDiscovery(source);
  await writeFile(appPath,output);
  for(const [legacy,replacement] of migrations){
    if(output.includes(legacy))throw new Error(`Legacy production renderer remains active: ${legacy}`);
    if(!output.includes(replacement))throw new Error(`Governed production renderer missing: ${replacement}`);
  }
  if(!output.includes("./routes/governed-discovery.mjs"))throw new Error('Governed discovery route module is not referenced by production app');
  if(!output.includes("./routes/governed-utility-v2.mjs"))throw new Error('Governed utility route module is not referenced by production app');
  return {status:'governed-discovery-finalized',migrations:migrations.length,governedDiscovery:true,governedUtilities:true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const result=await finalizeGovernedDiscovery();
  console.log(JSON.stringify(result));
}
