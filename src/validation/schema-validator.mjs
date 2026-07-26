import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const typeMatches = (type, value) => {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return typeof value === type;
};

function validateNode(schema, value, pointer, errors) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.const !== undefined && value !== schema.const) errors.push({ pointer, keyword: 'const', message: `must equal ${JSON.stringify(schema.const)}` });
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) errors.push({ pointer, keyword: 'enum', message: `must be one of ${schema.enum.join(', ')}` });
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((type) => typeMatches(type, value))) { errors.push({ pointer, keyword: 'type', message: `must be ${allowed.join(' or ')}` }); return; }
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push({ pointer, keyword: 'minLength', message: `must contain at least ${schema.minLength} characters` });
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push({ pointer, keyword: 'maxLength', message: `must contain at most ${schema.maxLength} characters` });
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push({ pointer, keyword: 'pattern', message: `must match ${schema.pattern}` });
    if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) errors.push({ pointer, keyword: 'format', message: 'must be an ISO date-time' });
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errors.push({ pointer, keyword: 'minimum', message: `must be >= ${schema.minimum}` });
    if (schema.maximum != null && value > schema.maximum) errors.push({ pointer, keyword: 'maximum', message: `must be <= ${schema.maximum}` });
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push({ pointer, keyword: 'minItems', message: `must contain at least ${schema.minItems} items` });
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push({ pointer, keyword: 'maxItems', message: `must contain at most ${schema.maxItems} items` });
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push({ pointer, keyword: 'uniqueItems', message: 'must contain unique items' });
    if (schema.items) value.forEach((item, index) => validateNode(schema.items, item, `${pointer}/${index}`, errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push({ pointer: `${pointer}/${key}`, keyword: 'required', message: 'is required' });
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(value)) if (!(key in schema.properties)) errors.push({ pointer: `${pointer}/${key}`, keyword: 'additionalProperties', message: 'is not allowed' });
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) if (key in value) validateNode(child, value[key], `${pointer}/${key}`, errors);
  }
}

export class SchemaRegistry {
  constructor({ schemaDir }) { this.schemaDir = schemaDir; this.schemas = new Map(); this.enforced = new Map(); }
  async init() {
    const files = (await readdir(this.schemaDir)).filter((name) => name.endsWith('.json'));
    for (const file of files) this.schemas.set(file.replace(/\.schema\.json$/, ''), JSON.parse(await readFile(path.join(this.schemaDir, file), 'utf8')));
    return this;
  }
  registerEnforcement({ route, request = null, response = null }) { this.enforced.set(route, { route, request, response }); }
  validate(name, value, { status = 400, code = 'schema_validation_failed' } = {}) {
    const schema = this.schemas.get(name);
    if (!schema) throw Object.assign(new Error(`Schema not found: ${name}`), { status: 500, code: 'schema_not_found' });
    const errors = []; validateNode(schema, value, '', errors);
    if (errors.length) throw Object.assign(new Error(`Schema validation failed for ${name}`), { status, code, details: { schema: name, errors } });
    return value;
  }
  coverage() {
    return { engine: 'qelly-dependency-free-json-schema-subset', draft: '2020-12', schemasLoaded: this.schemas.size, enforcedRoutes: [...this.enforced.values()], limitations: ['No remote $ref resolution', 'No unevaluatedProperties', 'No conditional keywords'], productionValidatorRequired: true };
  }
}
