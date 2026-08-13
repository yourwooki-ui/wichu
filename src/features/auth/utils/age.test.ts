import { describe, expect, it } from 'vitest';

import { isAdult, isValidBirthDate } from './age';

describe('birth date validation', () => {
  it('rejects impossible and incomplete dates', () => {
    expect(isValidBirthDate('2000-02-30')).toBe(false);
    expect(isValidBirthDate('20000101')).toBe(false);
  });

  it('accepts a real ISO birth date', () => {
    expect(isValidBirthDate('2000-02-29')).toBe(true);
  });
});

describe('18+ gate', () => {
  const today = new Date('2026-08-13T12:00:00Z');

  it('accepts the exact 18th birthday', () => {
    expect(isAdult('2008-08-13', today)).toBe(true);
  });

  it('rejects a user one day before the 18th birthday', () => {
    expect(isAdult('2008-08-14', today)).toBe(false);
  });
});
