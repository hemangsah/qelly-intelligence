import http from 'node:http';
import { startServer as startLegacyServer } from '../src/server/server.mjs';
import { __profileRouteTest } from '../functions/api/v1/profile.js';
import { capabilityInventory } from '../functions/_lib/capability-registry.js';

const EVIDENCE_USER_ID = '00000000-0000-4000-8000-000000000001';
const EVIDENCE_WORKSPACE_ID = '00000000-0000-4000-8000-000000000002';
const EVIDENCE_SESSION_ID = 'sess-local-primary';
const FIXED_TIME = '2026-08-16T00:00:00.000Z';

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(payload);
}

function evidenceProfile() {
  return __profileRouteTest.profilePayload({
    user: {
      userId: EVIDENCE_USER_ID,
      email: 'evidence@qelly.test',
      emailConfirmedAt: FIXED_TIME,
      displayName: 'Qelly Evidence User',
    },
    profile: {
      display_name: 'Qelly Evidence User',
      base_currency: 'USD',
      timezone: 'UTC',
      cloud_sync_opt_in: true,
      privacy_version: 'evidence-v1',
      terms_version: 'evidence-v1',
      created_at: FIXED_TIME,
      updated_at: FIXED_TIME,
    },
    workspace: {
      workspaceId: EVIDENCE_WORKSPACE_ID,
      name: 'Evidence Workspace',
    },
    session: {
      sessionId: EVIDENCE_SESSION_ID,
      authenticationMethod: 'development-fixture',
      expiresAt: '2027-08-16T00:00:00.000Z',
      current: true,
      revokedAt: null,
    },
  });
}

function evidenceDataPlane() {
  return {
    generatedAt: FIXED_TIME,
    canonicalRuntime: 'evidence-cloudflare-contract-adapter',
    releaseSha: 'evidence-fixture',
    environment: 'test',
    canonicalSite: 'https://qelly.test',
    dataPlane: {
      instrumentCount: 0,
      seriesCount: 0,
      pointCount: 0,
      providerCount: 0,
    },
    items: [],
    releaseIdentity: null,
    releaseCongruence: {
      state: 'UNVERIFIED',
      runtimeSha: 'evidence-fixture',
      recordedSha: null,
      reason: 'Evidence runtime intentionally has no production release identity.',
    },
    guardrails: {
      readOnly: true,
      execution: false,
      rawProviderCacheExposed: false,
      browserDirectPrivilegedTableAccess: false,
    },
    evidenceBoundary: 'deterministic-empty-contract-no-market-observations',
  };
}

function hasEvidenceSession(request) {
  return request.headers['x-qelly-session-id'] === EVIDENCE_SESSION_ID;
}

function sessionRequired(response, message) {
  return sendJson(response, 401, {
    error: {
      code: 'session_required',
      message,
    },
  });
}

function proxyToLegacy(request, response, upstreamPort) {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: upstreamPort,
      path: request.url,
      method: request.method,
      headers: request.headers,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on('error', (error) => {
    if (!response.headersSent) {
      sendJson(response, 502, {
        error: {
          code: 'evidence_upstream_failed',
          message: error.message,
        },
      });
    } else {
      response.destroy(error);
    }
  });
  request.pipe(upstream);
}

export async function startServer(options = {}) {
  const legacy = await startLegacyServer({ ...options, port: 0 });
  const host = options.host ?? '127.0.0.1';

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? '127.0.0.1'}`);

    if (request.method === 'GET' && url.pathname === '/api/v1/platform/capabilities') {
      return sendJson(response, 200, capabilityInventory());
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/profile') {
      if (!hasEvidenceSession(request)) {
        return sessionRequired(response, 'The evidence profile contract requires an authenticated fixture session.');
      }
      return sendJson(response, 200, evidenceProfile());
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/platform/data-plane') {
      if (!hasEvidenceSession(request)) {
        return sessionRequired(response, 'The evidence data-plane contract requires an authenticated fixture session.');
      }
      return sendJson(response, 200, evidenceDataPlane());
    }

    return proxyToLegacy(request, response, legacy.port);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, resolve);
  });

  return {
    server,
    host,
    port: server.address().port,
    runtime: legacy.runtime,
    evidenceUpstream: legacy,
  };
}
