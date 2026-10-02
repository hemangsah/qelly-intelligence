import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const file=new URL('../.github/workflows/release-evidence-handoff.yml',import.meta.url);
test('Unrelated check completions cannot cancel the active Cloudflare screenshot capture',async()=>{
 const text=await readFile(file,'utf8');
 const group=/^  group: (.+)$/m.exec(text)?.[1]||'';
 assert.ok(group.includes("github.event.check_run.name == 'Cloudflare Pages'"));
 assert.ok(group.includes("github.event.check_run.app.slug == 'cloudflare-workers-and-pages'"));
 assert.ok(group.includes("github.event.check_run.conclusion == 'success'"));
 assert.ok(group.includes("github.event.check_run.head_sha != ''"));
 assert.ok(group.includes("format('qelly-cloudflare-evidence-{0}', github.event.check_run.head_sha)"));
 assert.ok(group.includes("format('qelly-unrelated-check-{0}', github.run_id)"));
 assert.doesNotMatch(group,/head_sha \|\| github\.run_id/);
 assert.match(text,/cancel-in-progress: true/);
 assert.match(text,/github\.event\.check_run\.app\.slug == 'cloudflare-workers-and-pages'/);
});
