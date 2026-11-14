// Offline, range-only colour check. Mirrors classify() in backend/app/services/checkin_service.py, but uses ONLY
// the thresholds from the cached GET /checkin/guide response. It does not know the personal baseline, so it is
// always labelled provisional; the server status after sync is the real one.
import type { Color, Field, Guide, Provisional, ThresholdRow } from './types';

export const PROVISIONAL_LABEL =
  'Provisional (range check only, offline) — personal baseline applies after sync';

const RANK: Record<Color, number> = { green: 0, amber: 1, red: 2 };

function hit(value: number, t: ThresholdRow): boolean {
  if (t.direction === 'below') return value < t.value || (t.inclusive && value === t.value);
  return value > t.value || (t.inclusive && value === t.value);
}

/** Colour of one value: red thresholds first, then amber, else green (same order as the backend). */
export function classifyValue(value: number, rows: ThresholdRow[]): Color {
  for (const color of ['red', 'amber'] as const) {
    if (rows.some((t) => t.color === color && hit(value, t))) return color;
  }
  return 'green';
}

export function provisionalCheck(guide: Guide, values: Record<Field, number>): Provisional {
  const indicators = guide.indicators.map((ind) => {
    let color: Color = 'green';
    for (const f of ind.fields) {
      const c = classifyValue(values[f], ind.thresholds.filter((t) => t.field === f));
      if (RANK[c] > RANK[color]) color = c;
    }
    return { key: ind.key, label: ind.label, color };
  });
  const overall = indicators.reduce<Color>((w, i) => (RANK[i.color] > RANK[w] ? i.color : w), 'green');
  return { overall, indicators };
}

/**
 * Starting value for a stepper when the field is empty: the centre of the green band implied by the guide's
 * thresholds (highest "below" bound, lowest "above" bound). Falls back to the centre of the input limits.
 * Only a convenience for the +/- buttons; the user still confirms every value.
 */
export function stepperSeed(guide: Guide, field: Field, step: number): number {
  const rows = guide.indicators.flatMap((i) => i.thresholds).filter((t) => t.field === field);
  const below = rows.filter((t) => t.direction === 'below').map((t) => t.value);
  const above = rows.filter((t) => t.direction === 'above').map((t) => t.value);
  const lim = guide.input_limits[field];
  const lo = below.length ? Math.max(...below) : lim?.min ?? 0;
  const hi = above.length ? Math.min(...above) : lim?.max ?? lo;
  return roundTo((lo + hi) / 2, step);
}

export function roundTo(v: number, step: number): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number((Math.round(v / step) * step).toFixed(decimals));
}
