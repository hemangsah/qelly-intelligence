import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  applyIndexSeo,
  buildStructuredData,
  renderRobots,
  renderSitemap,
  seoStaticResources
} from '../scripts/finalize-public-seo.mjs';

const production={publicSiteUrl:'https://terminal.qellyintelligence.com',basePath:'/',staticVisualPreview:false};
const preview={publicSiteUrl:'',basePath:'/',staticVisualPreview:true};

test('Wave BJ keeps sitemap limited to real HTTP resources and excludes SPA fragment doorway URLs',()=>{
  const sitemap=renderSitemap(production);
  assert.equal((sitemap.match(/<url>/g)||[]).length,1+seoStaticResources.length);
  assert.doesNotMatch(sitemap,/#\//);
  assert.doesNotMatch(sitemap,/decision-provenance|market|formula-screener|calculator-center|asset-dossier/);
  for(const resource of seoStaticResources)assert.match(sitemap,new RegExp(resource.replaceAll('.','\\.')));
});

test('Wave BJ production robots indexes public HTTP resources but blocks API/private application surfaces',()=>{
  const robots=renderRobots(production);
  assert.match(robots,/User-agent: \*/);
  assert.match(robots,/Allow: \//);
  assert.match(robots,/Sitemap: https:\/\/terminal\.qellyintelligence\.com\/sitemap\.xml/);
  for(const path of ['/api/','/auth/','/account/','/saved-calculations/','/secure-import/','/quarantine-review/','/delivery-operations/']){
    assert.match(robots,new RegExp('Disallow: '+path.replaceAll('/','\\/')));
  }
});

test('Wave BJ preview and untrusted-origin builds fail closed to noindex and no structured data',()=>{
  const html=applyIndexSeo('<html><head><title>Qelly</title></head><body></body></html>',preview);
  assert.match(html,/noindex,nofollow,noarchive/);
  assert.doesNotMatch(html,/data-qelly-public-schema/);
  assert.equal(buildStructuredData(preview),'');
  assert.equal(renderRobots(preview),'User-agent: *\nDisallow: /\n');
});

test('Wave BJ root schema describes the actual web application without a fake search endpoint or financial promise',()=>{
  const schema=buildStructuredData(production);
  assert.match(schema,/"@type":"WebSite"/);
  assert.match(schema,/"@type":"SoftwareApplication"/);
  assert.match(schema,/"applicationSubCategory":"Market research and quantitative analysis"/);
  assert.match(schema,/"operatingSystem":"Web"/);
  assert.doesNotMatch(schema,/SearchAction|query-input|target.*search|guaranteed|recommendation|execution/i);
});

test('Wave BJ canonical SEO finalizer owns one metadata/schema block and does not create static hash-route doorway pages',async()=>{
  const [script,index]=await Promise.all([
    readFile(new URL('../scripts/finalize-public-seo.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/index.html',import.meta.url),'utf8')
  ]);
  assert.match(script,/QELLY_PUBLIC_SEO_START/);
  assert.match(script,/data-qelly-public-schema/);
  assert.match(script,/renderSitemap/);
  assert.match(index,/src="\.\/assets\/app\.js"/);
  assert.doesNotMatch(script,/decision-provenance\.html|market\.html|formula-screener\.html|calculator-center\.html|asset-dossier\.html/);
});
