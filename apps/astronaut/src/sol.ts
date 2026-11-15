// Sol field of the check-in form: typed text -> whole number in [SOL_MIN, SOL_MAX].
// SOL_MAX matches the backend (CheckinIn.sol le=settings.EXTENDED_MISSION_SOLS = 1000).
export const SOL_MIN = 1;
export const SOL_MAX = 1000;

export type SolParse = { ok: true; sol: number } | { ok: false; error: string };

export function parseSol(text: string): SolParse {
  const s = text.trim();
  if (s === '') return { ok: false, error: 'Enter a Sol number.' };
  if (!/^\d+$/.test(s)) return { ok: false, error: 'Sol must be a whole number.' };
  const n = Number(s);
  if (n < SOL_MIN || n > SOL_MAX) return { ok: false, error: `Sol must be ${SOL_MIN}–${SOL_MAX}.` };
  return { ok: true, sol: n };
}

export const clampSol = (n: number) => Math.min(SOL_MAX, Math.max(SOL_MIN, Math.round(n)));

/** − / + buttons: step from the typed value (or from `fallback` when it is not a number), clamped to the range. */
export function stepSol(text: string, dir: 1 | -1, fallback: number): string {
  const s = text.trim();
  const cur = /^\d+$/.test(s) ? Number(s) : fallback - dir;
  return String(clampSol(cur + dir));
}
