export function collectPublicCalculatorInputs(schema, elementFor) {
  const inputs = {}, required = new Set(schema.required || []);
  for (const [key, field] of Object.entries(schema.properties || {})) {
    const element = elementFor(key);
    const title = field.title || key;
    if (!element) throw new Error(`${title} is unavailable.`);
    if (field.type === 'boolean') { inputs[key] = element.checked; continue; }
    const value = String(element.value ?? '');
    if (element.validity?.badInput) throw new Error(`${title} must be a valid number.`);
    if (!value.trim()) {
      if (required.has(key)) throw new Error(`${title} is required.`);
      continue;
    }
    if (field.type === 'number' || field.type === 'integer') {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(`${title} must be a finite number.`);
      inputs[key] = number;
    } else if (field.type === 'array' || field.type === 'object') inputs[key] = JSON.parse(value);
    else inputs[key] = value;
  }
  return inputs;
}
