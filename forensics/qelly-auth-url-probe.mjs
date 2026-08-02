import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const PUBLIC_URL = 'https://qelly-intelligence.pages.dev';
const EXPECTED_RELEASE = '150025b9662404e5f98cd397c74c5d8be386460c';
const MAIL_API = 'https://api.mail.tm';
const OUT = 'dist/qelly-auth-url-probe';
const result = {
  observedAt: new Date().toISOString(),
  publicUrl: PUBLIC_URL,
  expectedReleaseSha: EXPECTED_RELEASE,
  releaseSha: null,
  registrationStatus: null,
  verificationRequired: null,
  confirmationMailReceived: false,
  verifyStatus: null,
  redirect: null,
  expectedRedirect: {
    origin: PUBLIC_URL,
    pathname: '/auth/callback.html'
  },
  callbackCorrect: false,
  cleanupUserIds: [],
  mailboxDeleted: false,
  error: null
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const password = () => `Qe!${randomBytes(20).toString('base64url')}8a`;
const collection = (value, fields = []) => {
  if (Array.isArray(value)) return value;
  for (const field of ['hydra:member', 'member', 'items', ...fields]) {
    if (Array.isArray(value?.[field])) return value[field];
  }
  return [];
};
const safeError = (error) => String(error?.code || error?.message || error || 'unknown_error')
  .replace(/https?:\/\/\S+/g, '[URL_REDACTED]')
  .replace(/[A-Za-z0-9_-]{28,}/g, '[VALUE_REDACTED]')
  .slice(0, 400);

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${MAIL_API}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Qelly-Auth-URL-Probe/1.0',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw Object.assign(new Error(`mail_http_${response.status}`), { code: `mail_http_${response.status}` });
  return data;
}

async function createMailbox() {
  const domains = collection(await api('/domains?page=1'), ['domains']);
  const domain = domains.find((item) => item?.domain && item.isActive !== false)?.domain;
  if (!domain) throw new Error('mail_domain_unavailable');
  const address = `qelly-url-${Date.now().toString(36)}-${randomBytes(5).toString('hex')}@${domain}`;
  const mailPassword = password();
  const account = await api('/accounts', { method: 'POST', body: { address, password: mailPassword } });
  const token = await api('/token', { method: 'POST', body: { address, password: mailPassword } });
  return { id: account.id, address, password: mailPassword, token: token.token, seen: new Set() };
}

async function deleteMailbox(mailbox) {
  try {
    await api(`/accounts/${mailbox.id}`, { method: 'DELETE', token: mailbox.token });
    return true;
  } catch {
    return false;
  }
}

function extractUrls(message) {
  const text = [message?.text, message?.html, message?.intro]
    .flat(Infinity)
    .filter(Boolean)
    .join('\n')
    .replaceAll('&amp;', '&');
  return [...text.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((match) => match[0].replace(/[),.;]+$/, ''));
}

async function waitForConfirmation(mailbox) {
  const started = Date.now();
  while (Date.now() - started < 180000) {
    const messages = collection(await api('/messages?page=1', { token: mailbox.token }), ['messages']);
    for (const item of messages) {
      if (!item?.id || mailbox.seen.has(item.id)) continue;
      mailbox.seen.add(item.id);
      const message = await api(`/messages/${item.id}`, { token: mailbox.token });
      for (const value of extractUrls(message)) {
        try {
          const url = new URL(value);
          if (url.hostname === 'ssdgfgqnjlwzkgukzeef.supabase.co' && url.pathname === '/auth/v1/verify' && url.searchParams.get('type') === 'signup') {
            return value;
          }
        } catch {}
      }
    }
    await delay(3000);
  }
  throw new Error('confirmation_mail_timeout');
}

await mkdir(OUT, { recursive: true });
let mailbox;
try {
  const releaseResponse = await fetch(`${PUBLIC_URL}/qelly-release.json?probe=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  const release = await releaseResponse.json();
  result.releaseSha = release.releaseSha;
  if (release.releaseSha !== EXPECTED_RELEASE) throw new Error('release_sha_mismatch');

  mailbox = await createMailbox();
  const registration = await fetch(`${PUBLIC_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { Origin: PUBLIC_URL, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: mailbox.address,
      password: password(),
      displayName: 'Qelly URL Verification',
      workspaceName: 'Qelly URL Verification',
      baseCurrency: 'USD',
      timezone: 'Asia/Kolkata'
    }),
    signal: AbortSignal.timeout(45000)
  });
  result.registrationStatus = registration.status;
  const registrationBody = await registration.json().catch(() => ({}));
  result.verificationRequired = registrationBody?.verificationRequired === true;
  if (registrationBody?.user?.id) result.cleanupUserIds.push(registrationBody.user.id);
  if (registration.status !== 202 || !result.verificationRequired) throw new Error(`registration_${registration.status}`);

  const confirmationUrl = await waitForConfirmation(mailbox);
  result.confirmationMailReceived = true;
  const verification = await fetch(confirmationUrl, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  result.verifyStatus = verification.status;
  const location = verification.headers.get('location');
  if (!location) throw new Error('confirmation_redirect_missing');
  const redirect = new URL(location);
  const hash = new URLSearchParams(redirect.hash.replace(/^#/, ''));
  result.redirect = {
    origin: redirect.origin,
    pathname: redirect.pathname,
    searchParameterNames: [...redirect.searchParams.keys()].sort(),
    hasAccessToken: Boolean(hash.get('access_token')),
    hasRefreshToken: Boolean(hash.get('refresh_token')),
    errorCode: hash.get('error_code') || redirect.searchParams.get('error_code') || null
  };
  result.callbackCorrect = redirect.origin === PUBLIC_URL && redirect.pathname === '/auth/callback.html';
} catch (error) {
  result.error = safeError(error);
} finally {
  if (mailbox) result.mailboxDeleted = await deleteMailbox(mailbox);
  await writeFile(`${OUT}/result.json`, JSON.stringify(result, null, 2));
  await writeFile(`${OUT}/cleanup-user-ids.json`, JSON.stringify({ userIds: result.cleanupUserIds }, null, 2));
}

console.log(`QELLY_AUTH_URL_PROBE=${JSON.stringify({
  releaseSha: result.releaseSha,
  registrationStatus: result.registrationStatus,
  verificationRequired: result.verificationRequired,
  confirmationMailReceived: result.confirmationMailReceived,
  verifyStatus: result.verifyStatus,
  redirect: result.redirect,
  callbackCorrect: result.callbackCorrect,
  mailboxDeleted: result.mailboxDeleted,
  error: result.error
})}`);

if (!result.callbackCorrect) process.exit(2);
