import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const handoff=await readFile('.github/workflows/release-evidence-handoff.yml','utf8');
const browser=await readFile('.github/workflows/browser-e2e.yml','utf8');
test('handoff reuses the complete, already validated Browser E2E evidence corpus',()=>{
 assert.match(handoff,/qelly-complete-all-screens-\$sha/);
 assert.match(handoff,/\.expired == false and \.size_in_bytes > 1000000/);
 assert.match(handoff,/browser:\{runId:\$browserRun,conclusion:"success"/);
 assert.match(handoff,/completeArchiveId:\$archiveId/);
 assert.match(handoff,/noDuplicateScreenshotCapture:true/);
 assert.doesNotMatch(handoff,/npm run browser:all|npm run a11y|playwright install|npm ci/);
});
test('source Browser E2E still enforces full route-derived, accessibility and archive contracts',()=>{
 assert.match(browser,/expectedRenders=expectedRoutes\*4/);
 assert.match(browser,/pngs\.length===expectedRenders/);
 assert.match(browser,/manifest\.routeCount===expectedRoutes/);
 assert.match(browser,/manifest\.status==='passed'/);
 assert.match(browser,/accessibility\.status==='passed'/);
 assert.match(browser,/archives\.length===1&&archives\[0\]===exactArchive&&archiveSize>0/);
});
