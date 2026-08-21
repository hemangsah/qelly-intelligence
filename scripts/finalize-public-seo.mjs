import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultOutput=path.join(repositoryRoot,'dist/frontend');

export const seoStaticResources=Object.freeze([
  'support.html',
  'legal/beta.html',
  'legal/risk.html',
  'legal/privacy.html',
  'legal/terms.html'
]);

const productTitle='Qelly Intelligence · Verifiable Market Intelligence';
const productDescription='Qelly Intelligence: evidence-backed market discovery, quantitative research and decision tools with transparent provider truth.';

const escapeAttribute=(value)=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const escapeXml=(value)=>escapeAttribute(value).replaceAll("'",'&apos;');

function normalizeBasePath(value='/'){
  const raw=String(value||'/').trim();
  const normalized=raw==='/'?'/':`/${raw.replace(/^\/+|\/+$/g,'')}/`;
  if(!/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(normalized)||normalized.includes('//')||normalized.includes('\\'))throw new Error('QELLY_PUBLIC_BASE_PATH must be a safe absolute path ending in /');
  return normalized;
}

function normalizePublicSiteUrl(value=''){
  const raw=String(value||'').trim();
  if(!raw)return '';
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('QELLY_PUBLIC_SITE_URL must be a safe HTTPS URL without credentials, query or fragment');
  return url.toString().replace(/\/$/,'');
}

function seoContext(options={}){
  const publicSiteUrl=normalizePublicSiteUrl(options.publicSiteUrl??'');
  const basePath=normalizeBasePath(options.basePath??'/');
  const staticVisualPreview=options.staticVisualPreview===true;
  const indexable=Boolean(publicSiteUrl)&&!staticVisualPreview;
  const publicBase=indexable?`${publicSiteUrl}${basePath}`:'';
  const publicUrl=(relative='')=>indexable?new URL(String(relative).replace(/^\/+/,''),publicBase).toString():'';
  return Object.freeze({publicSiteUrl,basePath,staticVisualPreview,indexable,publicUrl});
}

export function buildIndexSeoBlock(options={}){
  const context=seoContext(options);
  const robots=context.indexable?'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1':'noindex,nofollow,noarchive';
  const tags=[
    '<!-- QELLY_PUBLIC_SEO_START -->',
    `  <meta name="robots" content="${robots}">`,
    '  <meta name="application-name" content="Qelly Intelligence">',
    '  <meta property="og:type" content="website">',
    '  <meta property="og:site_name" content="Qelly Intelligence">',
    `  <meta property="og:title" content="${escapeAttribute(productTitle)}">`,
    `  <meta property="og:description" content="${escapeAttribute(productDescription)}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${escapeAttribute(productTitle)}">`,
    `  <meta name="twitter:description" content="${escapeAttribute(productDescription)}">`
  ];
  if(context.indexable){
    const canonical=context.publicUrl('');
    const socialImage=context.publicUrl('social/qelly-social-preview.png');
    tags.push(
      `  <link rel="canonical" href="${escapeAttribute(canonical)}">`,
      `  <meta property="og:url" content="${escapeAttribute(canonical)}">`,
      `  <meta property="og:image" content="${escapeAttribute(socialImage)}">`,
      '  <meta property="og:image:width" content="1200">',
      '  <meta property="og:image:height" content="630">',
      '  <meta property="og:image:alt" content="Qelly Intelligence institutional quantitative research interface">',
      `  <meta name="twitter:image" content="${escapeAttribute(socialImage)}">`,
      '  <meta name="twitter:image:alt" content="Qelly Intelligence institutional quantitative research interface">'
    );
  }
  tags.push('<!-- QELLY_PUBLIC_SEO_END -->');
  return tags.join('\n');
}

function stripIndexOwnedSocialMetadata(source){
  let html=String(source);
  const ownedMetaPatterns=[
    /\s*<meta\b(?=[^>]*\bname=["']application-name["'])[^>]*>\s*/gi,
    /\s*<meta\b(?=[^>]*\bproperty=["']og:[^"']+["'])[^>]*>\s*/gi,
    /\s*<meta\b(?=[^>]*\bname=["']twitter:[^"']+["'])[^>]*>\s*/gi
  ];
  for(const pattern of ownedMetaPatterns)html=html.replace(pattern,'\n');
  return html;
}

export function applyIndexSeo(source,options={}){
  let html=String(source);
  html=html.replace(/\s*<!-- QELLY_PUBLIC_SEO_START -->[\s\S]*?<!-- QELLY_PUBLIC_SEO_END -->\s*/g,'\n');
  html=stripIndexOwnedSocialMetadata(html);
  html=html.replace(/\s*<meta\s+name=["']robots["'][^>]*>\s*/gi,'\n');
  html=html.replace(/\s*<link\s+rel=["']canonical["'][^>]*>\s*/gi,'\n');
  if(!/<\/head>/i.test(html))throw new Error('index.html is missing </head>');
  return html.replace(/<\/head>/i,`${buildIndexSeoBlock(options)}\n</head>`);
}

export function applyStaticPageSeo(source,resourcePath,options={}){
  const context=seoContext(options);
  const normalized=String(resourcePath||'').replace(/^\/+/, '');
  if(!seoStaticResources.includes(normalized))throw new Error(`Unsupported public SEO resource: ${normalized}`);
  let html=String(source);
  html=html.replace(/\s*<meta\s+name=["']robots["'][^>]*>\s*/gi,'');
  html=html.replace(/\s*<link\s+rel=["']canonical["'][^>]*>\s*/gi,'');
  const robots=context.indexable?'index,follow':'noindex,nofollow,noarchive';
  const tags=[`<meta name="robots" content="${robots}">`];
  if(context.indexable)tags.push(`<link rel="canonical" href="${escapeAttribute(context.publicUrl(normalized))}">`);
  if(!/<\/head>/i.test(html))throw new Error(`${normalized} is missing </head>`);
  return html.replace(/<\/head>/i,`${tags.join('')}</head>`);
}

export function renderRobots(options={}){
  const context=seoContext(options);
  if(!context.indexable)return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /auth/',
    'Disallow: /account/',
    'Disallow: /saved-calculations/',
    'Disallow: /secure-import/',
    'Disallow: /quarantine-review/',
    'Disallow: /delivery-operations/',
    `Sitemap: ${context.publicUrl('sitemap.xml')}`,
    ''
  ].join('\n');
}

export function renderSitemap(options={}){
  const context=seoContext(options);
  const locations=context.indexable?['',...seoStaticResources].map((resource)=>context.publicUrl(resource)):[];
  const body=locations.map((location)=>`  <url><loc>${escapeXml(location)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body?`\n${body}\n`:''}</urlset>\n`;
}

export async function finalizePublicSeo({output=defaultOutput,environment=process.env}={}){
  const options={
    publicSiteUrl:environment.QELLY_PUBLIC_SITE_URL??'',
    basePath:environment.QELLY_PUBLIC_BASE_PATH??'/',
    staticVisualPreview:environment.QELLY_STATIC_VISUAL_PREVIEW==='true'
  };
  const indexPath=path.join(output,'index.html');
  await writeFile(indexPath,applyIndexSeo(await readFile(indexPath,'utf8'),options));
  for(const resource of seoStaticResources){
    const file=path.join(output,resource);
    await writeFile(file,applyStaticPageSeo(await readFile(file,'utf8'),resource,options));
  }
  await writeFile(path.join(output,'robots.txt'),renderRobots(options));
  await writeFile(path.join(output,'sitemap.xml'),renderSitemap(options));
  const context=seoContext(options);
  return Object.freeze({
    status:'public-seo-finalized',
    indexable:context.indexable,
    publicSiteUrl:context.publicSiteUrl||null,
    basePath:context.basePath,
    staticVisualPreview:context.staticVisualPreview,
    sitemapResources:context.indexable?1+seoStaticResources.length:0
  });
}

const invokedPath=process.argv[1]?pathToFileURL(path.resolve(process.argv[1])).href:'';
if(invokedPath===import.meta.url)console.log(JSON.stringify(await finalizePublicSeo(),null,2));
