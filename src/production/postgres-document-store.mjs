export class PostgresDocumentStore {
  constructor({ repository, documentKey, documentType = 'runtime-state', seedFactory = () => ({}) } = {}) {
    if (!repository) throw new Error('PostgreSQL repository is required');
    if (!/^[a-z0-9][a-z0-9._-]{2,119}$/i.test(String(documentKey ?? ''))) throw new Error('A stable document key is required');
    this.repository = repository;
    this.documentKey = String(documentKey);
    this.documentType = String(documentType);
    this.seedFactory = seedFactory;
    this.queue = Promise.resolve();
  }

  async seed() {
    return structuredClone(typeof this.seedFactory === 'function' ? await this.seedFactory() : this.seedFactory);
  }

  async read() {
    const existing = await this.repository.query('SELECT body_json FROM qelly_runtime_documents WHERE document_key=$1 LIMIT 1', [this.documentKey]);
    if (existing.rows[0]) return structuredClone(existing.rows[0].body_json);
    const seed = await this.seed();
    await this.repository.query(
      'INSERT INTO qelly_runtime_documents(document_key,document_type,body_json,revision) VALUES($1,$2,$3::jsonb,1) ON CONFLICT(document_key) DO NOTHING',
      [this.documentKey, this.documentType, JSON.stringify(seed)]
    );
    const created = await this.repository.query('SELECT body_json FROM qelly_runtime_documents WHERE document_key=$1 LIMIT 1', [this.documentKey]);
    return structuredClone(created.rows[0]?.body_json ?? seed);
  }

  async replace(value) {
    return this.update(() => structuredClone(value));
  }

  async update(mutator) {
    this.queue = this.queue.catch(() => undefined).then(() => this.repository.client.transaction(async () => {
      await this.repository.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`qelly-runtime-document:${this.documentKey}`]);
      const result = await this.repository.query('SELECT body_json FROM qelly_runtime_documents WHERE document_key=$1 FOR UPDATE', [this.documentKey]);
      const current = result.rows[0]?.body_json ?? await this.seed();
      const next = await mutator(structuredClone(current));
      if (next === undefined) throw new Error('PostgresDocumentStore mutator must return a value');
      await this.repository.query(
        `INSERT INTO qelly_runtime_documents(document_key,document_type,body_json,revision,created_at,updated_at)
         VALUES($1,$2,$3::jsonb,1,NOW(),NOW())
         ON CONFLICT(document_key) DO UPDATE SET body_json=EXCLUDED.body_json,document_type=EXCLUDED.document_type,revision=qelly_runtime_documents.revision+1,updated_at=NOW()`,
        [this.documentKey, this.documentType, JSON.stringify(next)]
      );
      return structuredClone(next);
    }));
    return this.queue;
  }
}
