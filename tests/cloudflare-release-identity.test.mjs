import test from 'node:test';
import assert from 'node:assert/strict';
import { publicRuntimeConfig } from '../functions/_lib/runtime.js';

const baseEnvironment={
  QELLY_PUBLIC_SITE_URL:'https://qelly-intelligence.pages.dev',
  QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
  QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'publishable-test-key-1234567890'
};

test('Cloudflare deployment SHA overrides a stale manually pinned public release SHA',()=>{
  const config=publicRuntimeConfig({
    ...baseEnvironment,
    CF_PAGES_COMMIT_SHA:'cloudflare-current-commit',
    QELLY_PUBLIC_RELEASE_SHA:'stale-manual-commit'
  });

  assert.equal(config.releaseSha,'cloudflare-current-commit');
});

test('manual public release SHA remains a fallback outside Cloudflare Pages',()=>{
  const config=publicRuntimeConfig({
    ...baseEnvironment,
    QELLY_PUBLIC_RELEASE_SHA:'manual-release-commit'
  });

  assert.equal(config.releaseSha,'manual-release-commit');
});
