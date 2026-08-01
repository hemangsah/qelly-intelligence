import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/frontend');
const legacyPublicOrigin='https://hemangsah.github.io/qelly-intelligence';

const cleanSiteUrl=(value)=>{
  const url=new URL(String(value||''));
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('QELLY_PUBLIC_SITE_URL must be a clean HTTPS origin');
  return url.toString().replace(/\/$/,'');
};

export function rewritePublicIdentity(source,{siteUrl,file}){
  let text=String(source).replaceAll(legacyPublicOrigin,siteUrl);
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
  }
  return text;
}

export async function finalizePublicRuntime({environment=process.env}={}){
  const required=environment.QELLY_REQUIRE_PUBLIC_RUNTIME==='true';
  if(!required)return {status:'public-runtime-finalizer-skipped'};
  const siteUrl=cleanSiteUrl(environment.QELLY_PUBLIC_SITE_URL);
  const files=['index.html','legal/beta.html','legal/risk.html','legal/privacy.html','legal/terms.html','support.html','sitemap.xml','robots.txt','manifest.webmanifest'];
  for(const file of files){
    const target=path.join(output,file),source=await readFile(target,'utf8');
    await writeFile(target,rewritePublicIdentity(source,{siteUrl,file}));
  }
  const checks=await Promise.all(files.map(async(file)=>[file,await readFile(path.join(output,file),'utf8')]));
  for(const [file,text] of checks){
    if(text.includes(legacyPublicOrigin))throw new Error(`Legacy public origin remains in ${file}`);
  }
  const index=checks.find(([file])=>file==='index.html')[1];
  if(!index.includes(`<link rel="canonical" href="${siteUrl}/">`)||!index.includes(`<meta property="og:url" content="${siteUrl}/">`))throw new Error('Production canonical/Open Graph identity is incomplete');
  const headers=await readFile(path.join(output,'_headers'),'utf8');
  if(!/Cache-Control:\s*public, max-age=0, must-revalidate, no-transform/.test(headers))throw new Error('Public HTML must prevent unsolicited edge transformation');
  return {status:'public-runtime-finalized',siteUrl,files:files.length,legacyOrigins:0};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  console.log(JSON.stringify(await finalizePublicRuntime(),null,2));
}
