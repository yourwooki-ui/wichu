import { describe, expect, it } from 'vitest';

import { getDefaultCallingCode, normalizePhoneNumber } from './phone-number';

describe('phone number normalization', () => {
  it('converts a Korean domestic number to E.164', () => {
    expect(normalizePhoneNumber('+82', '010-1234-5678')).toBe('+821012345678');
  });

  it('accepts common punctuation without changing the subscriber digits', () => {
    expect(normalizePhoneNumber('+1', '(415) 555-0123')).toBe('+14155550123');
  });

  it('preserves the significant Italian leading zero', () => {
    expect(normalizePhoneNumber('+39', '02 1234 5678')).toBe('+390212345678');
  });

  it('rejects malformed or out-of-range numbers', () => {
    expect(normalizePhoneNumber('', '01012345678')).toBeNull();
    expect(normalizePhoneNumber('+1234', '55550123')).toBeNull();
    expect(normalizePhoneNumber('+82', '123')).toBeNull();
  });

  it('uses the app language region as an editable default', () => {
    expect(getDefaultCallingCode('ko')).toBe('+82');
    expect(getDefaultCallingCode('pt-BR')).toBe('+55');
  });
});
