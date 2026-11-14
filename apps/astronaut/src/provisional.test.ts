import { describe, expect, it } from 'vitest';
import { classifyValue, provisionalCheck, stepperSeed } from './provisional';
import type { Guide, ThresholdRow } from './types';

// Minimal guide fixture in the backend's shape. Threshold values here are test inputs for the comparison logic
// only; the app itself always uses the thresholds from GET /checkin/guide.
const row = (field: string, color: 'amber' | 'red', direction: 'below' | 'above', value: number, inclusive = false): ThresholdRow =>
  ({ field, color, direction, value, inclusive, status: 'test', source: 'test' });

const guide = {
  disclaimer: '', routine: { when: '', order: [], why: '' }, baseline: { min_prior_entries: 5, flag_abs_z: 2 },
  status_rules: {}, input_limits: { a: { min: 0, max: 200 }, s: { min: 50, max: 260 }, d: { min: 20, max: 160 } },
  indicators: [
    { key: 'A', label: 'A', unit: 'u', fields: ['a'], thresholds: [row('a', 'red', 'below', 40), row('a', 'amber', 'below', 50),
      row('a', 'amber', 'above', 100), row('a', 'red', 'above', 120)] },
    { key: 'BP', label: 'BP', unit: 'mmHg', fields: ['s', 'd'], thresholds: [row('s', 'amber', 'above', 120, true),
      row('d', 'red', 'above', 90, true)] },
  ],
} as unknown as Guide;

describe('classifyValue (mirrors backend classify)', () => {
  const rows = guide.indicators[0].thresholds;
  it.each([[39, 'red'], [40, 'amber'], [49.9, 'amber'], [50, 'green'], [100, 'green'], [101, 'amber'], [121, 'red']])(
    '%s -> %s', (v, c) => expect(classifyValue(v as number, rows)).toBe(c));
  it('inclusive thresholds include the boundary', () => {
    expect(classifyValue(120, guide.indicators[1].thresholds.filter((t) => t.field === 's'))).toBe('amber');
  });
});

describe('provisionalCheck', () => {
  it('takes the worst field per indicator and the worst indicator overall', () => {
    const p = provisionalCheck(guide, { a: 70, s: 110, d: 95 } as never);
    expect(p.indicators).toEqual([{ key: 'A', label: 'A', color: 'green' }, { key: 'BP', label: 'BP', color: 'red' }]);
    expect(p.overall).toBe('red');
  });
});

describe('stepperSeed', () => {
  it('starts at the centre of the green band from the guide', () => {
    expect(stepperSeed(guide, 'a' as never, 1)).toBe(75);
  });
});
