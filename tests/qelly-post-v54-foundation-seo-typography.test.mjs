import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyIndexSeo,
  applyStaticPageSeo,
  buildIndexSeoBlock,
  renderRobots,
  renderSitemap,
  seoStaticResources
} from '../scripts/finalize-public-seo.mjs';

const production={publicSiteUrl:'https://qelly.example',basePath:'/',staticVisualPreview:false};
const preview={publicSiteUrl:'',basePath:'/qelly-intelligence/',staticVisualPreview:true};

test('production SEO is origin-aware and exposes only real HTTP resources',()=>{
  const block=buildIndexSeoBlock(production);
  assert.match(block,/name="robots" content="index,follow/);
  assert.match(block,/rel="canonical" href="https:\/\/qelly\.example\/"/);
  assert.match(block,/property="og:image" content="https:\/\/qelly\.example\/social\/qelly-social-preview\.png"/);
  assert.match(block,/name="twitter:card" content="summary_large_image"/);

  const robots=renderRobots(production);
  assert.match(robots,/Sitemap: https:\/\/qelly\.example\/sitemap\.xml/);
  assert.match(robots,/Disallow: \/api\//);
  assert.match(robots,/Disallow: \/auth\//);
  assert.match(robots,/Disallow: \/account\//);
  assert.match(robots,/Disallow: \/saved-calculations\//);
  assert.match(robots,/Disallow: \/secure-import\//);
  assert.match(robots,/Disallow: \/quarantine-review\//);
  assert.match(robots,/Disallow: \/delivery-operations\//);

  const sitemap=renderSitemap(production);
  assert.equal((sitemap.match(/<url>/g)||[]).length,1+seoStaticResources.length);
  for(const resource of ['',...seoStaticResources])assert.match(sitemap,new RegExp(`https:\\/\\/qelly\\.example\\/${resource.replaceAll('.','\\.')}`));
  assert.doesNotMatch(sitemap,/#\//);
  assert.doesNotMatch(sitemap,/hemangsah\.github\.io/);
});

test('unconfigured and static-preview builds fail closed to noindex',()=>{
  const index=applyIndexSeo('<html><head><title>Qelly</title></head><body></body></html>',preview);
  assert.match(index,/noindex,nofollow,noarchive/);
  assert.doesNotMatch(index,/rel="canonical"/);
  assert.equal(renderRobots(preview),'User-agent: *\nDisallow: /\n');
  assert.equal((renderSitemap(preview).match(/<url>/g)||[]).length,0);
});

test('static public pages receive environment-correct canonical and robots policy',()=>{
  const source='<html><head><meta name="robots" content="index,follow"><link rel="canonical" href="https://qelly-intelligence.pages.dev/support.html"><title>Support</title></head><body></body></html>';
  const productionPage=applyStaticPageSeo(source,'support.html',production);
  assert.match(productionPage,/name="robots" content="index,follow"/);
  assert.match(productionPage,/rel="canonical" href="https:\/\/qelly\.example\/support\.html"/);
  assert.doesNotMatch(productionPage,/qelly-intelligence\.pages\.dev/);

  const previewPage=applyStaticPageSeo(source,'support.html',preview);
  assert.match(previewPage,/noindex,nofollow,noarchive/);
  assert.doesNotMatch(previewPage,/rel="canonical"/);
});

test('unsafe public origins and unknown sitemap resources are rejected',()=>{
  assert.throws(()=>buildIndexSeoBlock({publicSiteUrl:'http://qelly.example'}),/safe HTTPS URL/);
  assert.throws(()=>buildIndexSeoBlock({publicSiteUrl:'https://user:pass@qelly.example'}),/safe HTTPS URL/);
  assert.throws(()=>applyStaticPageSeo('<head></head>','missing.html',production),/Unsupported public SEO resource/);
});

const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('repository integration keeps SEO host-neutral until the trusted build origin is supplied',async()=>{
  const packageJson=JSON.parse(await readFile(path.join(repositoryRoot,'package.json'),'utf8'));
  assert.match(packageJson.scripts['build:frontend'],/finalize-public-seo\.mjs/);

  const robots=await readFile(path.join(repositoryRoot,'apps/web/public/robots.txt'),'utf8');
  const sitemap=await readFile(path.join(repositoryRoot,'apps/web/public/sitemap.xml'),'utf8');
  assert.doesNotMatch(robots,/hemangsah\.github\.io|qelly-intelligence\.pages\.dev/);
  for(const privatePath of ['/api/','/auth/','/account/','/saved-calculations/','/secure-import/','/quarantine-review/','/delivery-operations/']) assert.match(robots,new RegExp(`Disallow: ${privatePath.replaceAll('/','\\/')}`));
  assert.doesNotMatch(sitemap,/hemangsah\.github\.io|qelly-intelligence\.pages\.dev/);

  const fontGovernance=await readFile(path.join(repositoryRoot,'apps/web/public/assets/qelly-font-governance.css'),'utf8');
  assert.match(fontGovernance,/font-variant-numeric:tabular-nums lining-nums/);
});
