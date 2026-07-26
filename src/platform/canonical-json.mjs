const normalize = (value, seen) => {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
    return value;
  }
  if (seen.has(value)) throw new TypeError('Canonical JSON cannot encode circular references');
  seen.add(value);
  let normalized;
  if (Array.isArray(value)) normalized = value.map((item) => normalize(item, seen));
  else if (value instanceof Date) normalized = value.toISOString();
  else {
    normalized = {};
    for (const key of Object.keys(value).sort()) {
      const next = value[key];
      if (next !== undefined) normalized[key] = normalize(next, seen);
    }
  }
  seen.delete(value);
  return normalized;
};

export function canonicalize(value) {
  return JSON.stringify(normalize(value, new WeakSet()));
}
