import { chromium, firefox, webkit } from 'playwright';

export const browserTypes = { chromium, firefox, webkit };
export const routeCases = new Map([
  ['calculator-center', { hash: 'calculator-center' }],
  ['india-finance', { hash: 'india-finance' }],
  ['indicator-library', { hash: 'indicator-library' }],
  ['formula-library', { hash: 'formula-library' }],
  ['saved-calculations', { hash: 'saved-calculations' }],
  ['formula-detail', { hash: 'formula-detail/fresh-present-value' }],
  ['indicator-detail', { hash: 'indicator-detail/fresh-price-momentum' }],
  ['calculator-detail', { hash: 'calculator-detail/fresh-present-value' }],
  ['saved-calculation-detail', { hash: 'saved-calculation-detail/prompt2b-review-saved' }]
]);
export const viewports = [[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,1000],[1728,1080],[1920,1080]];
export const themes = [
  { label: 'dark', persona: 'burgundy-command', colorScheme: 'dark' },
  { label: 'porcelain-light', persona: 'porcelain-burgundy', colorScheme: 'light' },
  { label: 'oled', persona: 'burgundy-night', colorScheme: 'dark' },
  { label: 'high-contrast', persona: 'high-contrast', colorScheme: 'dark' }
];
export const motions = ['full', 'reduced'];
export const EXPECTED_CASES = 9 * 4 * 2;
const slugify = value => value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

export const savedSeed = {
  schemaVersion: 2,
  items: [{
    id: 'prompt2b-review-saved',
    name: 'Prompt 2B Review Present Value',
    savedAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:05:00.000Z',
    schemaVersion: 2,
    version: 2,
    formulaVersion: '2.0.0',
    indicatorVersion: null,
    indiaRuleVersion: null,
    effectiveDate: '2026-07-30',
    result: {
      status: 'success',
      formulaId: 'fresh-present-value',
      formulaVersion: '2.0.0',
      engineVersion: '2.0.0',
      truthState: 'FRESH_REIMPLEMENTATION_2026',
      effectiveDate: '2026-07-30',
      outputs: { value: 100 },
      evidence: { provenanceStatus: 'FRESH_REIMPLEMENTATION_2026' }
    },
    notes: 'Exact browser review seed',
    tags: ['prompt2b', 'review'],
    favorite: true,
    truthState: 'DETERMINISTIC LOCAL',
    revisions: [
      {
        revisionId: 'prompt2b-r1', version: 1, createdAt: '2026-07-30T00:00:00.000Z', restoredFrom: null,
        name: 'Prompt 2B Review Present Value', result: { status: 'success', formulaId: 'fresh-present-value', formulaVersion: '2.0.0', outputs: { value: 100 }, truthState: 'FRESH_REIMPLEMENTATION_2026' },
        notes: 'Baseline', tags: ['prompt2b'], favorite: false, formulaVersion: '2.0.0', indicatorVersion: null, indiaRuleVersion: null, effectiveDate: '2026-07-30'
      },
      {
        revisionId: 'prompt2b-r2', version: 2, createdAt: '2026-07-30T00:05:00.000Z', restoredFrom: null,
        name: 'Prompt 2B Review Present Value', result: { status: 'success', formulaId: 'fresh-present-value', formulaVersion: '2.0.0', outputs: { value: 100 }, truthState: 'FRESH_REIMPLEMENTATION_2026' },
        notes: 'Exact browser review seed', tags: ['prompt2b', 'review'], favorite: true, formulaVersion: '2.0.0', indicatorVersion: null, indiaRuleVersion: null, effectiveDate: '2026-07-30'
      }
    ]
  }]
};
