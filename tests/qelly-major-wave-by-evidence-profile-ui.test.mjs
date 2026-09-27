import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Wave BY Decision UI renders the active asset evidence profile in Advanced mode',async()=>{
  const [route,css]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8')
  ]);
  for(const token of ['ASSET-CLASS EVIDENCE PROFILE','data-dpg-evidence-profile','Evidence applicability and source requirements','weightingBoundary'])assert.ok(route.includes(token),token);
  assert.match(route,/assetEvidenceProfileMarkup\(data\)/);
  assert.match(css,/q-dpg-asset-evidence-profile__modules/);
  assert.match(css,/q-dpg-asset-evidence-profile__coverage/);
});
