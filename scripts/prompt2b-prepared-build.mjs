import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const command = process.argv[2];
const exactHead = process.env.QELLY_REVIEW_HEAD ?? process.env.GITHUB_SHA ?? 'unknown';
const root = path.resolve('dist/frontend');
const manifestPath = path.resolve('prompt2b-prepared/PREPARED_BUILD.json');
const sha256 = body => createHash('sha256').update(body).digest('hex');
const walk = async directory => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
};
if (command === 'create') {
  const files = [];
  for (const file of (await walk(root)).sort()) {
    const body = await readFile(file);
    files.push({ path: path.relative(root, file).replaceAll('\\','/'), bytes: (await stat(file)).size, sha256: sha256(body) });
  }
  const aggregate = sha256(Buffer.from(files.map(item => `${item.path}\0${item.bytes}\0${item.sha256}`).join('\n')));
  const document = { schemaVersion: 1, head: exactHead, root: 'dist/frontend', fileCount: files.length, aggregateSha256: aggregate, files };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(JSON.stringify({ command, head: exactHead, fileCount: files.length, aggregateSha256: aggregate }, null, 2));
} else if (command === 'verify') {
  const document = JSON.parse(await readFile(manifestPath, 'utf8'));
  const missing = [], mismatches = [];
  for (const item of document.files) {
    const file = path.join(root, item.path);
    try {
      const body = await readFile(file);
      if (body.length !== item.bytes || sha256(body) !== item.sha256) mismatches.push(item.path);
    } catch { missing.push(item.path); }
  }
  const aggregate = sha256(Buffer.from(document.files.map(item => `${item.path}\0${item.bytes}\0${item.sha256}`).join('\n')));
  const ok = document.head === exactHead && document.fileCount === document.files.length && document.aggregateSha256 === aggregate && !missing.length && !mismatches.length;
  console.log(JSON.stringify({ command, expectedHead: exactHead, manifestHead: document.head, fileCount: document.fileCount, aggregateSha256: aggregate, missing, mismatches, ok }, null, 2));
  if (!ok) process.exit(1);
} else {
  throw new Error('Usage: node scripts/prompt2b-prepared-build.mjs <create|verify>');
}
