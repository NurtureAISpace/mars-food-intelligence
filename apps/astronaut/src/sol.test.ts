import { describe, expect, it } from 'vitest';
import { parseSol, SOL_MAX, stepSol } from './sol';

describe('parseSol', () => {
  it('accepts whole numbers in range', () => {
    expect(parseSol('1')).toEqual({ ok: true, sol: 1 });
    expect(parseSol(' 42 ')).toEqual({ ok: true, sol: 42 });
    expect(parseSol(String(SOL_MAX))).toEqual({ ok: true, sol: SOL_MAX });
  });
  it('rejects empty, non-integer and out-of-range input', () => {
    for (const bad of ['', '  ', '0', '1001', '-3', '2.5', '1e2', 'abc', '12a']) {
      expect(parseSol(bad).ok).toBe(false);
    }
  });
});

describe('stepSol', () => {
  it('steps and clamps', () => {
    expect(stepSol('5', 1, 9)).toBe('6');
    expect(stepSol('5', -1, 9)).toBe('4');
    expect(stepSol('1', -1, 9)).toBe('1');
    expect(stepSol(String(SOL_MAX), 1, 9)).toBe(String(SOL_MAX));
  });
  it('restarts from the fallback when the text is not a number', () => {
    expect(stepSol('', 1, 9)).toBe('9');
    expect(stepSol('x', -1, 9)).toBe('9');
  });
});
