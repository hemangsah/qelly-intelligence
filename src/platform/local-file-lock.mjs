import { mkdir, open, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WINDOWS_LOCK_CONTENTION_CODES = new Set(['EPERM', 'EACCES']);

export async function isLocalFileLockContention(error, lockPath, { platform = process.platform } = {}) {
  if (error?.code === 'EEXIST') return true;
  if (platform !== 'win32' || !WINDOWS_LOCK_CONTENTION_CODES.has(error?.code)) return false;
  return stat(lockPath).then(() => true).catch(() => false);
}

export async function withLocalFileLock(targetPath, handler, { timeoutMs = 2500, staleMs = 15000 } = {}) {
  const lockPath = `${targetPath}.lock`;
  await mkdir(path.dirname(targetPath), { recursive: true });
  const started = Date.now();
  while (true) {
    let handle;
    try {
      handle = await open(lockPath, 'wx', 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
      try { return await handler(); }
      finally { await handle.close().catch(() => {}); await rm(lockPath, { force: true }).catch(() => {}); }
    } catch (error) {
      await handle?.close().catch(() => {});
      if (!(await isLocalFileLockContention(error, lockPath))) throw error;
      const age = await stat(lockPath).then((value) => Date.now() - value.mtimeMs).catch(() => 0);
      if (age > staleMs) { await rm(lockPath, { force: true }).catch(() => {}); continue; }
      if (Date.now() - started >= timeoutMs) {
        throw Object.assign(new Error('Local persistence lock timeout'), { status: 503, code: 'persistence_lock_timeout', retryable: true });
      }
      await sleep(12 + Math.floor(Math.random() * 18));
    }
  }
}
