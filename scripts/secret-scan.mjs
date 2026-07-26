import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excludedDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'runtime',
  'coverage',
  'preview',
  '__pycache__'
]);
const highConfidencePatterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['stripe-live-secret', /\bsk_live_[A-Za-z0-9]{16,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['npm-token', /\bnpm_[A-Za-z0-9]{30,}\b/]
];
const credentialUrlPattern = /\b(?:postgres(?:ql)?|redis|mysql|mongodb(?:\+srv)?|https?):\/\/([^/\s:@]+):([^/\s@]+)@/gi;
const assignmentPattern = /^[ \t]*(?:export[ \t]+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*)[ \t]*[:=][ \t]*["']?([^"'#\s,}]+)/gmi;

function lineNumber(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function safeFixture(value) {
  const normalized = String(value).trim();
  return normalized.length < 16
    || /\$\{|secrets\.|process\.env|crypto\.|createHash|replace|example|change-?me|placeholder|fixture|qelly-ci|release-a\d|test-|disabled|none|null/i.test(normalized);
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excludedDirectories.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full));
    else if (entry.isFile()) output.push(full);
  }
  return output;
}

export async function scanRepository(root = defaultRoot) {
  const findings = [];
  let filesScanned = 0;
  for (const file of await walk(root)) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const basename = path.basename(file);
    if (basename === '.env' || (/^\.env\./.test(basename) && !basename.endsWith('.example'))) {
      findings.push({ file: relative, line: 1, rule: 'committed-environment-file' });
    }
    if (/\.(?:key|pem|p12|pfx)$/i.test(basename) || /^id_(?:rsa|dsa|ecdsa|ed25519)/i.test(basename)) {
      findings.push({ file: relative, line: 1, rule: 'private-key-file' });
    }
    const info = await stat(file);
    if (info.size > 5 * 1024 * 1024) continue;
    const bytes = await readFile(file);
    if (bytes.includes(0)) continue;
    filesScanned += 1;
    const text = bytes.toString('utf8');
    for (const [rule, pattern] of highConfidencePatterns) {
      const match = pattern.exec(text);
      if (match) findings.push({ file: relative, line: lineNumber(text, match.index), rule });
    }
    for (const match of text.matchAll(credentialUrlPattern)) {
      if (!safeFixture(match[2])) {
        findings.push({ file: relative, line: lineNumber(text, match.index), rule: 'credential-bearing-url' });
      }
    }
    for (const match of text.matchAll(assignmentPattern)) {
      if (!relative.startsWith('tests/') && !safeFixture(match[2])) {
        findings.push({ file: relative, line: lineNumber(text, match.index), rule: 'literal-sensitive-assignment' });
      }
    }
  }
  return { filesScanned, findings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await scanRepository(defaultRoot);
  if (result.findings.length) {
    console.error(JSON.stringify({
      status: 'secret-scan-failed',
      filesScanned: result.filesScanned,
      findings: result.findings.map((finding) => ({ ...finding, value: 'REDACTED' }))
    }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    status: 'secret-scan-passed',
    filesScanned: result.filesScanned,
    highConfidenceFindings: 0
  }, null, 2));
}
