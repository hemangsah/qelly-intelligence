import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, '.prompt2a-bootstrap');
const sourceHead = process.env.QELLY_AUDIT_HEAD || process.env.GITHUB_SHA || 'unknown';
const repository = process.env.GITHUB_REPOSITORY || 'hemangsah/qelly-intelligence';
const token = process.env.GITHUB_TOKEN || '';
const now = new Date().toISOString();

const excludedDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  '.prompt2a-bootstrap',
  '.brand-review',
  '.brand-visual-correction',
  '.ui-review',
  '.theme-review',
  'coverage'
]);

const binaryExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.tgz', '.tar',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.wasm', '.bin',
  '.sqlite', '.db', '.lockb'
]);
const prohibitedFontExtensions = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);
const maxTextBytes = 4 * 1024 * 1024;

const patterns = [
  ['TODO', /\bTODO\b/gi],
  ['FIXME', /\bFIXME\b/gi],
  ['HACK', /\bHACK\b/gi],
  ['XXX', /\bXXX\b/gi],
  ['SKIPPED_TEST', /\b(?:test|it|describe)\.skip\b|\bskip:\s*true\b/gi],
  ['ONLY_TEST', /\b(?:test|it|describe)\.only\b/gi],
  ['DIRECT_FETCH', /\bfetch\s*\(/g],
  ['WEBSOCKET', /\bWebSocket\b|\bwss?:\/\//gi],
  ['EVENTSOURCE', /\bEventSource\b|text\/event-stream/gi],
  ['IFRAME', /<iframe\b|createElement\(['"]iframe['"]\)/gi],
  ['REDIRECT', /location\.(?:href|assign|replace)|window\.open\s*\(/gi],
  ['YAHOO', /yahoo|query[12]\.finance\.yahoo\.com|quoteSummary|yahoo-finance/gi],
  ['RAPIDAPI', /rapidapi/gi],
  ['SCRAPING', /puppeteer|playwright.*scrap|cheerio|html\s*pars|scrap(?:e|ing)/gi],
  ['FIXTURE_FALLBACK', /fixture|fallback.*(?:mock|demo|sample)|(?:mock|demo|sample).*fallback/gi],
  ['LIVE_LABEL', /\blive(?:\s+data|\s+market|\s+price|\s+feed)?\b/gi],
  ['SECRET_TERM', /password|passphrase|secret|token|private.?key|seed.?phrase|recovery.?phrase/gi],
  ['CATCH_SWALLOW', /catch\s*\([^)]*\)\s*\{\s*\}/g],
  ['HARDCODED_SAMPLE', /\b(?:AAPL|BTC|ETH|USDCHF|QI-CRYPTO-BTC|QI-EQUITY-AAPL)\b/g]
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return `${headers.join(',')}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\n')}\n`;
}

function categoryFor(relative) {
  if (relative.startsWith('apps/web/')) return 'frontend';
  if (relative.startsWith('apps/worker/')) return 'worker';
  if (relative.startsWith('src/server/')) return 'backend';
  if (relative.startsWith('src/')) return 'library';
  if (relative.startsWith('packages/')) return 'package';
  if (relative.startsWith('tests/')) return 'test';
  if (relative.startsWith('scripts/')) return 'script';
  if (relative.startsWith('.github/workflows/')) return 'workflow';
  if (relative.startsWith('infra/') || relative.startsWith('deploy/')) return 'infrastructure';
  if (relative.startsWith('project-state/')) return 'durable-state';
  if (relative.startsWith('docs/') || relative.startsWith('design/')) return 'documentation';
  if (relative.startsWith('config/')) return 'configuration';
  return 'other';
}

async function walk(directory, output = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (entry.isDirectory()) {
      await walk(absolute, output);
    } else if (entry.isFile()) {
      output.push({ absolute, relative });
    }
  }
  return output;
}

async function githubJson(endpoint) {
  const url = `https://api.github.com/repos/${repository}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'qelly-prompt2a-wave0-auditor',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return {
      url,
      status: response.status,
      ok: response.ok,
      headers: {
        etag: response.headers.get('etag'),
        rateLimitLimit: response.headers.get('x-ratelimit-limit'),
        rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
        rateLimitReset: response.headers.get('x-ratelimit-reset')
      },
      body
    };
  } catch (error) {
    return { url, status: 0, ok: false, error: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

await mkdir(out, { recursive: true });
await mkdir(path.join(out, '01-starting-state'), { recursive: true });
await mkdir(path.join(out, '02-repository-inventory'), { recursive: true });

const apiRequests = {
  repository: '',
  branches: '/branches?per_page=100',
  tags: '/tags?per_page=100',
  releases: '/releases?per_page=100',
  openPullRequests: '/pulls?state=open&per_page=100',
  allPullRequests: '/pulls?state=all&per_page=100',
  mainProtection: '/branches/main/protection',
  rulesets: '/rulesets?includes_parents=true&per_page=100',
  mainWorkflowRuns: '/actions/runs?branch=main&per_page=100',
  deployments: '/deployments?environment=github-pages&per_page=100',
  pages: '/pages'
};

const liveState = {
  schemaVersion: 1,
  capturedAt: now,
  repository,
  sourceHead,
  requests: {}
};
for (const [name, endpoint] of Object.entries(apiRequests)) {
  liveState.requests[name] = await githubJson(endpoint);
}
await writeFile(
  path.join(out, '01-starting-state', 'LIVE_GITHUB_STATE.json'),
  `${JSON.stringify(liveState, null, 2)}\n`
);

const files = await walk(root);
const inventory = [];
const matches = [];
const hostMap = new Map();
const routeCandidates = [];
let prohibitedFontCount = 0;

for (const file of files) {
  const info = await stat(file.absolute);
  const extension = path.extname(file.relative).toLowerCase();
  const binary = binaryExtensions.has(extension);
  if (prohibitedFontExtensions.has(extension)) prohibitedFontCount += 1;
  let bytes;
  try {
    bytes = await readFile(file.absolute);
  } catch {
    bytes = Buffer.alloc(0);
  }
  const record = {
    path: file.relative,
    category: categoryFor(file.relative),
    extension: extension || '[none]',
    bytes: info.size,
    line_count: '',
    sha256: sha256(bytes),
    binary: binary ? 'true' : 'false',
    prohibited_font_binary: prohibitedFontExtensions.has(extension) ? 'true' : 'false',
    risk: info.size > 10 * 1024 * 1024 ? 'large-file' : prohibitedFontExtensions.has(extension) ? 'governed-font-binary' : '',
    recommended_action: prohibitedFontExtensions.has(extension) ? 'keep governed; never include in downloadable review artifact' : 'audit'
  };

  if (!binary && info.size <= maxTextBytes) {
    const text = bytes.toString('utf8');
    const lines = text.split(/\r?\n/);
    record.line_count = lines.length;
    for (const [patternName, regex] of patterns) {
      regex.lastIndex = 0;
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        regex.lastIndex = 0;
        if (regex.test(line)) {
          matches.push({
            pattern: patternName,
            source_file: file.relative,
            line_number: index + 1,
            excerpt: line.trim().slice(0, 500),
            category: record.category,
            risk: ['SECRET_TERM', 'YAHOO', 'SCRAPING', 'FIXTURE_FALLBACK', 'LIVE_LABEL', 'CATCH_SWALLOW'].includes(patternName) ? 'review-required' : 'inventory',
            recommended_action: 'inspect exact context before classification'
          });
        }
      }
    }

    const urlRegex = /https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g;
    for (const match of text.matchAll(urlRegex)) {
      try {
        const value = match[0].replace(/[),.;'"`]+$/, '');
        const parsed = new URL(value);
        const lineNumber = text.slice(0, match.index).split(/\r?\n/).length;
        const key = `${parsed.hostname}|${file.relative}|${lineNumber}|${value}`;
        hostMap.set(key, {
          hostname: parsed.hostname,
          url: value,
          source_file: file.relative,
          line_number: lineNumber,
          category: record.category,
          scheme: parsed.protocol,
          status: 'DISCOVERED_UNVERIFIED',
          recommended_action: 'verify official ownership, terms, licensing, CORS and production eligibility'
        });
      } catch {
        // Ignore malformed URL-like text while preserving the source inventory.
      }
    }

    const routeRegex = /(?:#\/|route\s*[:=]\s*['"]|path\s*[:=]\s*['"]|navigate\s*\(\s*['"])(\/?[A-Za-z0-9_{}:\-./]+(?:\?[A-Za-z0-9_{}&=:\-./]+)?)/g;
    for (const match of text.matchAll(routeRegex)) {
      const lineNumber = text.slice(0, match.index).split(/\r?\n/).length;
      routeCandidates.push({
        route_candidate: match[1],
        source_file: file.relative,
        line_number: lineNumber,
        category: record.category,
        status: 'DISCOVERED_UNVERIFIED',
        recommended_action: 'reconcile with canonical route registry and executable browser evidence'
      });
    }
  }
  inventory.push(record);
}

const repositoryHeaders = ['path', 'category', 'extension', 'bytes', 'line_count', 'sha256', 'binary', 'prohibited_font_binary', 'risk', 'recommended_action'];
await writeFile(path.join(out, '02-repository-inventory', 'REPOSITORY_INVENTORY.csv'), toCsv(repositoryHeaders, inventory));
await writeFile(path.join(out, '02-repository-inventory', 'CODE_PATTERN_MATCHES.csv'), toCsv(
  ['pattern', 'source_file', 'line_number', 'excerpt', 'category', 'risk', 'recommended_action'],
  matches
));
await writeFile(path.join(out, '02-repository-inventory', 'EXTERNAL_HOST_MATCHES.csv'), toCsv(
  ['hostname', 'url', 'source_file', 'line_number', 'category', 'scheme', 'status', 'recommended_action'],
  [...hostMap.values()]
));
await writeFile(path.join(out, '02-repository-inventory', 'ROUTE_CANDIDATES.csv'), toCsv(
  ['route_candidate', 'source_file', 'line_number', 'category', 'status', 'recommended_action'],
  routeCandidates
));

let packageJson = null;
try {
  packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
} catch {
  packageJson = null;
}
await writeFile(path.join(out, '02-repository-inventory', 'PACKAGE_SCRIPTS.json'), `${JSON.stringify(packageJson?.scripts || {}, null, 2)}\n`);

const summary = {
  schemaVersion: 1,
  generatedAt: now,
  repository,
  sourceHead,
  fileCount: inventory.length,
  textFileCount: inventory.filter((item) => item.binary === 'false').length,
  binaryFileCount: inventory.filter((item) => item.binary === 'true').length,
  prohibitedFontBinaryCountInRepository: prohibitedFontCount,
  patternMatchCount: matches.length,
  uniqueExternalHostnames: new Set([...hostMap.values()].map((item) => item.hostname)).size,
  externalUrlReferenceCount: hostMap.size,
  routeCandidateCount: routeCandidates.length,
  note: 'Inventory presence is not implementation, connectivity, licensing or production-readiness evidence.'
};
await writeFile(path.join(out, 'BOOTSTRAP_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`);

const manifestEntries = [];
for (const file of await walk(out, [])) {
  const bytes = await readFile(file.absolute);
  manifestEntries.push({ path: path.relative(out, file.absolute).split(path.sep).join('/'), bytes: bytes.length, sha256: sha256(bytes) });
}
manifestEntries.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(path.join(out, 'BOOTSTRAP_MANIFEST.json'), `${JSON.stringify({ schemaVersion: 1, generatedAt: now, repository, sourceHead, entries: manifestEntries }, null, 2)}\n`);

console.log(`QELLY_PROMPT2A_BOOTSTRAP=${JSON.stringify(summary)}`);
