import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIndexSeo,buildStructuredData } from '../scripts/finalize-public-seo.mjs';

const productionOptions=Object.freeze({
  publicSiteUrl:'https://terminal.qellyintelligence.com',
  basePath:'/'
});

const countMatches=(source,pattern)=>(String(source).match(pattern)||[]).length;

function assertSingleOwnedMetadata(html){
  assert.equal(countMatches(html,/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<meta\b(?=[^>]*\bname=["']application-name["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<meta\b(?=[^>]*\bproperty=["']og:title["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<meta\b(?=[^>]*\bproperty=["']og:description["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<meta\b(?=[^>]*\bproperty=["']og:url["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<meta\b(?=[^>]*\bproperty=["']og:image["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<meta\b(?=[^>]*\bname=["']twitter:card["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<meta\b(?=[^>]*\bname=["']twitter:title["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<meta\b(?=[^>]*\bname=["']twitter:description["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<meta\b(?=[^>]*\bname=["']twitter:image["'])[^>]*>/gi),1);
  assert.equal(countMatches(html,/<script\b(?=[^>]*\bdata-qelly-public-schema=["']true["'])[^>]*>/gi),1);
}

test('public SEO finalizer replaces stale unmarked social metadata with one canonical owner block',()=>{
  const source=`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="description" content="Stale product description">
  <meta name="theme-color" content="#090909">
  <meta name="application-name" content="Legacy Qelly">
  <meta property="og:title" content="Legacy OG title">
  <meta property="og:description" content="Legacy OG description">
  <meta property="og:url" content="https://stale.example/">
  <meta property="og:image" content="https://stale.example/social.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Legacy Twitter title">
  <meta name="twitter:description" content="Legacy Twitter description">
  <meta name="twitter:image" content="https://stale.example/twitter.png">
  <link rel="canonical" href="https://stale.example/">
</head>
<body></body>
</html>`;

  const html=applyIndexSeo(source,productionOptions);
  assertSingleOwnedMetadata(html);
  assert.match(html,/<meta name="description" content="Qelly Intelligence: evidence-backed market discovery, quantitative research and Decision Intelligence with transparent source evidence\.">/);
  assert.match(html,/<meta property="og:description" content="Qelly Intelligence: evidence-backed market discovery, quantitative research and Decision Intelligence with transparent source evidence\.">/);
  assert.match(html,/<meta name="twitter:description" content="Qelly Intelligence: evidence-backed market discovery, quantitative research and Decision Intelligence with transparent source evidence\.">/);
  assert.match(html,/<meta name="theme-color" content="#090909">/);
  assert.match(html,/<link rel="canonical" href="https:\/\/terminal\.qellyintelligence\.com\/">/);
  assert.match(html,/<meta property="og:title" content="Qelly Intelligence · Verifiable Market Intelligence">/);
  assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
  assert.doesNotMatch(html,/Legacy Qelly|Legacy OG|Legacy Twitter|Stale product description|stale\.example/);
});

test('public SEO finalizer converges after repeated application',()=>{
  const source='<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';
  const once=applyIndexSeo(source,productionOptions);
  const twice=applyIndexSeo(once,productionOptions);

  assertSingleOwnedMetadata(twice);
  assert.equal(countMatches(twice,/<!-- QELLY_PUBLIC_SEO_START -->/g),1);
  assert.equal(countMatches(twice,/<!-- QELLY_PUBLIC_SEO_END -->/g),1);
  assert.doesNotMatch(twice,/\n\s*\n\s*\n\s*\n/);
});


test('public SEO structured data is canonical-origin owned and contains one truthful application graph',()=>{
  const schema=buildStructuredData(productionOptions);
  assert.match(schema,/type="application\/ld\+json"/);
  assert.match(schema,/data-qelly-public-schema="true"/);
  assert.match(schema,/"@type":"WebSite"/);
  assert.match(schema,/"@type":"SoftwareApplication"/);
  assert.match(schema,/"url":"https:\/\/terminal\.qellyintelligence\.com\/"/);
  assert.match(schema,/"applicationCategory":"FinanceApplication"/);
  assert.match(schema,/"isAccessibleForFree":true/);
  assert.doesNotMatch(schema,/SearchAction|potentialAction|investment advice|guaranteed/i);
});

test('public SEO removes stale owned structured data and converges to one schema graph',()=>{
  const source='<!doctype html><html><head><script type="application/ld+json" data-qelly-public-schema="true">{"@context":"https://schema.org","url":"https://stale.example/"}</script></head><body></body></html>';
  const once=applyIndexSeo(source,productionOptions);
  const twice=applyIndexSeo(once,productionOptions);
  assert.equal(countMatches(twice,/<script\b(?=[^>]*\bdata-qelly-public-schema=["']true["'])[^>]*>/gi),1);
  assert.doesNotMatch(twice,/stale\.example/);
  assert.match(twice,/terminal\.qellyintelligence\.com/);
});
