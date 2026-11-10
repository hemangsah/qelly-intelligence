// Diagnostic-only deterministic metadata clock, applied equally to both builds.
// This is never copied into a production source tree or served to a browser.
const OriginalDate = globalThis.Date;
const timestamp = OriginalDate.parse(process.env.QELLY_SITEMAP_FIXED_TIME ?? '');
if (!Number.isFinite(timestamp)) throw new Error('An explicit diagnostic build time is required');
function DiagnosticDate(...args) {
  if (new.target) return Reflect.construct(OriginalDate, args.length ? args : [timestamp], new.target);
  return new OriginalDate(timestamp).toString();
}
Object.setPrototypeOf(DiagnosticDate, OriginalDate);
DiagnosticDate.prototype = OriginalDate.prototype;
Object.defineProperty(DiagnosticDate, 'now', { value: () => timestamp });
globalThis.Date = DiagnosticDate;
