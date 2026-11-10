import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const BASE = '172eb87d5cd229a11eb751578fb26dfbe344b0db';
const BEFORE = 'cfefe0b5079610ff4d298eb82a669df322d9118eaf94d1880944d104b3fb90cd';
const AFTER = '1bc735dabbfa62147487c91c062a1277e675c2b4b7ba843e8bdefd47ec491cae';
const TEST = 'f04fe74edc6daa35dbd8bb588589f21da2231ebf984313419ee683da7e3e37c7';
const SCHEMA = 'fbec77e84467050d5667394a57cc5cdfe1239d80aca1d61e9e0827173c3d9df9';
const PRODUCT = 'scripts/generate-public-calculator-network.mjs';
const TEST_PATH = 'tests/public-sitemap-content.test.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const runnerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const head = process.env.QELLY_SITEMAP_DIAGNOSTIC_HEAD;
assert.match(head ?? '', /^[a-f0-9]{40}$/);
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const save = async (root, name, value) => writeFile(path.join(root, name), JSON.stringify(value, null, 2) + '\n');
const schemaPath = path.join(runnerRoot, 'work/nov10-sitemap-official-schema.xsd');
assert.equal(hash(await readFile(schemaPath)), SCHEMA);

function command(command, args, cwd, environment = process.env) {
  const result = spawnSync(command, args, { cwd, env: environment, encoding: 'utf8', maxBuffer: 20000000 });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

async function schema(root, arm, sitemap, independent = false) {
  const output = path.join(root, (independent ? 'independent-' : '') + arm + '-schema.json');
  const result = command('pwsh', ['-NoLogo', '-NoProfile', '-File', path.join(runnerRoot, 'work/nov10-sitemap-schema-cloud.ps1'), '-Sitemap', sitemap, '-Schema', schemaPath, '-ExpectedErrors', arm === 'red' ? '37' : '0', '-Output', output], runnerRoot);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const checked = await readJson(output);
  assert.equal(checked.schemaCompiled, true);
  assert.equal(checked.externalResolverDisabled, true);
  assert.equal(checked.actualErrors, arm === 'red' ? 37 : 0);
  assert.equal(checked.valid, arm === 'green');
  return checked;
}

function locations(xml) {
  const rows = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)].map(match => ({ url: match[1], lastmod: match[2] ?? null }));
  assert.equal(rows.length, 49);
  assert.equal(new Set(rows.map(row => row.url)).size, 49);
  for (const { url: raw } of rows) {
    const url = new URL(raw);
    assert.equal(url.origin, 'https://terminal.qellyintelligence.com');
    assert.equal(url.username + url.password + url.search + url.hash, '');
    assert.doesNotMatch(url.pathname, /\/(?:api|auth(?:-[a-z-]+)?|account(?:-[a-z-]+)?|saved-calculations?|secure-import|quarantine-review|delivery-operations)(?:\/|$)/i);
  }
  return rows;
}

async function verify(root, independent = false) {
  const r = await readJson(path.join(root, 'report.json'));
  assert.equal(r.schema, 'qelly.sitemap.pair/1.0');
  assert.equal(r.status, 'passed');
  assert.equal(r.base, BASE);
  assert.equal(r.candidatePatchHead, head);
  assert.equal(r.beforeProductSha256, BEFORE);
  assert.equal(r.afterProductSha256, AFTER);
  assert.equal(r.testSha256, TEST);
  assert.equal(r.officialSchemaSha256, SCHEMA);
  assert.equal(r.controlledSharedBuildClock, true);
  assert.equal(r.controlledSharedBuildIdentity, BASE);
  assert.equal(r.baselineTest.status, 1);
  assert.equal(r.candidateTest.status, 0);
  assert.equal(r.baselineInheritedTests.status, 0);
  assert.equal(r.candidateInheritedTests.status, 0);
  assert.equal(r.baselineBuild.status, 0);
  assert.equal(r.candidateBuild.status, 0);
  assert.equal(r.invalidDocumentVariants, 14);
  assert.equal(r.productionAccepted, false);
  assert.equal(r.fullUsWaveAccepted, false);
  const manifests = await readFile(path.join(root, 'file-manifest.json'));
  assert.equal(hash(manifests), r.fileManifestSha256);
  const files = JSON.parse(manifests);
  assert.equal(files.length, r.generatedFileCount);
  assert.ok(files.length > 49);
  assert.equal(files.filter(file => file.path.endsWith('.html')).length, r.htmlFileCount);
  assert.equal(files.filter(file => file.redSha256 !== file.greenSha256).length, 1);
  for (const file of files) {
    assert.match(file.redSha256, /^[a-f0-9]{64}$/);
    assert.match(file.greenSha256, /^[a-f0-9]{64}$/);
    if (file.path !== 'sitemap.xml') {
      assert.equal(file.redSha256, file.greenSha256, file.path);
      assert.equal(file.redBytes, file.greenBytes, file.path);
    }
  }
  const red = await readFile(path.join(root, 'red-sitemap.xml'), 'utf8');
  const green = await readFile(path.join(root, 'green-sitemap.xml'), 'utf8');
  assert.equal(red.replaceAll('\\n', '\n'), green);
  assert.equal((red.match(/\\n/g) ?? []).length, 37);
  assert.equal((green.match(/\\n/g) ?? []).length, 0);
  assert.deepEqual(locations(green), locations(red));
  assert.equal(Buffer.byteLength(red) - Buffer.byteLength(green), 37);
  const xml = files.find(file => file.path === 'sitemap.xml');
  assert.equal(hash(red), xml.redSha256);
  assert.equal(hash(green), xml.greenSha256);
  for (const [arm, expected] of [['red', r.redSchema], ['green', r.greenSchema]]) {
    const observed = await schema(root, arm, path.join(root, arm + '-sitemap.xml'), independent);
    assert.deepEqual(observed, expected);
  }
  for (const [name, expected] of Object.entries(r.logs)) {
    assert.equal(hash(await readFile(path.join(root, name))), expected.sha256);
  }
  const redTest = await readFile(path.join(root, 'red-test.log'), 'utf8');
  assert.match(redTest, /Sitemap separators must be real whitespace/);
  assert.match(redTest, /# pass 1\b/);
  assert.match(redTest, /# fail 1\b/);
  const greenTest = await readFile(path.join(root, 'green-test.log'), 'utf8');
  assert.match(greenTest, /# pass 2\b/);
  assert.match(greenTest, /# fail 0\b/);
  const receipt = { source: BASE, candidatePatchHead: head, generatedFilesChecked: files.length, htmlFilesChecked: r.htmlFileCount,
    allGeneratedFilesExceptSitemapByteIdentical: true, sourceProductChangedBytes: 2, generatedSeparatorBytesRemoved: 37,
    preservedPublicUrls: 49, redOfficialSchemaErrors: 37, greenOfficialSchemaErrors: 0,
    redTestFailsExpectedRegression: true, greenTestPasses: true, invalidDocumentVariantsRejected: 14,
    bothInheritedTestsAndBuildsPass: true, officialSchemaSha256: SCHEMA, fileManifestSha256: r.fileManifestSha256,
    controlledSharedBuildClock: true, controlledSharedBuildIdentity: BASE,
    independentPublicationVerification: independent, productionAccepted: false, fullUsWaveAccepted: false,
    boundary: 'Cloud controlled paired172-source builds with exact isolated candidate patch. Not an exact production-PR CI/deployment or fullUS acceptance.' };
  await save(root, independent ? 'independent-published-receipt.json' : 'capture-receipt.json', receipt);
  console.log(JSON.stringify(receipt));
}

if (process.argv[2] === '--verify') {
  await verify(path.resolve(process.argv[3]), true);
} else {
  const redRoot = path.resolve(process.env.QELLY_SITEMAP_RED_ROOT);
  const greenRoot = path.resolve(process.env.QELLY_SITEMAP_GREEN_ROOT);
  const out = path.resolve(process.env.QELLY_SITEMAP_OUTPUT);
  await mkdir(out, { recursive: true });
  const git = root => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(git(redRoot), BASE);
  assert.equal(git(greenRoot), BASE);
  assert.equal(git(runnerRoot), head);
  assert.equal(hash(await readFile(path.join(redRoot, PRODUCT))), BEFORE);
  assert.equal(hash(await readFile(path.join(greenRoot, PRODUCT))), BEFORE);
  assert.equal(hash(await readFile(path.join(runnerRoot, PRODUCT))), AFTER);
  assert.equal(hash(await readFile(path.join(runnerRoot, TEST_PATH))), TEST);
  await copyFile(path.join(runnerRoot, PRODUCT), path.join(greenRoot, PRODUCT));
  for (const root of [redRoot, greenRoot]) await copyFile(path.join(runnerRoot, TEST_PATH), path.join(root, TEST_PATH));
  const logs = {};
  async function run(name, executable, args, cwd, environment = process.env) {
    const result = command(executable, args, cwd, environment);
    const content = result.stdout + result.stderr;
    const file = name + '.log';
    await writeFile(path.join(out, file), content);
    logs[file] = { sha256: hash(content), bytes: Buffer.byteLength(content) };
    return { status: result.status };
  }
  for (const [arm, root] of [['red', redRoot], ['green', greenRoot]]) {
    const result = await run(arm + '-locked-install', 'npm', ['ci', '--ignore-scripts'], root);
    assert.equal(result.status, 0, arm + ' locked cloud install');
  }
  const baselineTest = await run('red-test', process.execPath, ['--test', TEST_PATH], redRoot);
  const candidateTest = await run('green-test', process.execPath, ['--test', TEST_PATH], greenRoot);
  assert.equal(baselineTest.status, 1);
  assert.equal(candidateTest.status, 0);
  const inherited = ['--test', 'tests/public-calculator-network.test.mjs', 'tests/public-asset-research-network.test.mjs', 'tests/public-seo-finalizer.test.mjs'];
  const baselineInheritedTests = await run('red-inherited-tests', process.execPath, inherited, redRoot);
  const candidateInheritedTests = await run('green-inherited-tests', process.execPath, inherited, greenRoot);
  assert.equal(baselineInheritedTests.status, 0);
  assert.equal(candidateInheritedTests.status, 0);
  const buildEnvironment = { ...process.env, CF_PAGES_COMMIT_SHA: BASE, GITHUB_SHA: BASE, QELLY_PUBLIC_RELEASE_SHA: BASE,
    QELLY_SITEMAP_FIXED_TIME: '2026-11-10T00:00:00.000Z',
    NODE_OPTIONS: '--import=' + pathToFileURL(path.join(runnerRoot, 'work/nov10-sitemap-fixed-build-clock.mjs')).href };
  const baselineBuild = await run('red-build', 'npm', ['run', 'build:frontend'], redRoot, buildEnvironment);
  const candidateBuild = await run('green-build', 'npm', ['run', 'build:frontend'], greenRoot, buildEnvironment);
  assert.equal(baselineBuild.status, 0);
  assert.equal(candidateBuild.status, 0);
  async function inventory(root, prefix = '') {
    const files = [];
    for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
      const relative = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isDirectory()) files.push(...await inventory(root, relative));
      else { assert.equal(entry.isFile(), true); const bytes = await readFile(path.join(root, relative)); files.push({ path: relative, bytes: bytes.length, sha256: hash(bytes) }); }
    }
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }
  const red = await inventory(path.join(redRoot, 'dist/frontend'));
  const green = await inventory(path.join(greenRoot, 'dist/frontend'));
  assert.deepEqual(red.map(file => file.path), green.map(file => file.path));
  const files = red.map((file, index) => ({ path: file.path, redBytes: file.bytes, redSha256: file.sha256, greenBytes: green[index].bytes, greenSha256: green[index].sha256 }));
  await save(out, 'file-manifest.json', files);
  for (const [arm, root] of [['red', redRoot], ['green', greenRoot]]) await copyFile(path.join(root, 'dist/frontend/sitemap.xml'), path.join(out, arm + '-sitemap.xml'));
  const redSchema = await schema(out, 'red', path.join(out, 'red-sitemap.xml'));
  const greenSchema = await schema(out, 'green', path.join(out, 'green-sitemap.xml'));
  const changedTracked = root => execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(changedTracked(redRoot), '');
  assert.equal(changedTracked(greenRoot), PRODUCT);
  await save(out, 'report.json', { schema: 'qelly.sitemap.pair/1.0', status: 'passed', base: BASE, candidatePatchHead: head,
    beforeProductSha256: BEFORE, afterProductSha256: AFTER, testSha256: TEST, officialSchemaSha256: SCHEMA,
    controlledSharedBuildClock: true, controlledSharedBuildIdentity: BASE, fixedBuildTime: buildEnvironment.QELLY_SITEMAP_FIXED_TIME,
    originalTrackedSourceUnchanged: true, candidateTrackedDiffExactlyProductOwner: true,
    baselineTest, candidateTest, baselineInheritedTests, candidateInheritedTests, baselineBuild, candidateBuild,
    invalidDocumentVariants: 14, generatedFileCount: files.length, htmlFileCount: files.filter(file => file.path.endsWith('.html')).length,
    fileManifestSha256: hash(await readFile(path.join(out, 'file-manifest.json'))), redSchema, greenSchema, logs,
    productionAccepted: false, fullUsWaveAccepted: false });
  await verify(out);
}
