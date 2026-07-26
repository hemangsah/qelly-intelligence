import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { withLocalFileLock } from './local-file-lock.mjs';

export class AtomicJsonStore {
  constructor(filePath, seedFactory) {
    this.filePath = filePath;
    this.seedFactory = seedFactory;
    this.queue = Promise.resolve();
  }

  async #ensure() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try { await readFile(this.filePath, 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await withLocalFileLock(this.filePath, async () => {
        try { await readFile(this.filePath, 'utf8'); return; } catch {}
        const seed = typeof this.seedFactory === 'function' ? await this.seedFactory() : structuredClone(this.seedFactory ?? {});
        await this.#writeAtomic(seed);
      });
    }
  }

  async #writeAtomic(value) {
    const temp = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flush: true });
    await rename(temp, this.filePath);
  }

  async read() { await this.#ensure(); return JSON.parse(await readFile(this.filePath, 'utf8')); }

  async replace(value) {
    this.queue = this.queue.catch(() => undefined).then(async () => {
      await this.#ensure();
      return withLocalFileLock(this.filePath, async () => { await this.#writeAtomic(value); return structuredClone(value); });
    });
    return this.queue;
  }

  async update(mutator) {
    this.queue = this.queue.catch(() => undefined).then(async () => {
      await this.#ensure();
      return withLocalFileLock(this.filePath, async () => {
        const current = JSON.parse(await readFile(this.filePath, 'utf8'));
        const next = await mutator(structuredClone(current));
        if (next === undefined) throw new Error('AtomicJsonStore mutator must return a value');
        await this.#writeAtomic(next);
        return structuredClone(next);
      });
    });
    return this.queue;
  }
}
