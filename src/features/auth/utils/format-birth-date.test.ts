import { describe, expect, it } from 'vitest';

import { formatBirthDateInput } from './format-birth-date';

describe('birth date input formatter', () => {
  it('inserts separators while digits are entered', () => {
    expect(formatBirthDateInput('2000')).toBe('2000');
    expect(formatBirthDateInput('20001')).toBe('2000-1');
    expect(formatBirthDateInput('20000101')).toBe('2000-01-01');
  });

  it('removes non-digits and caps the value at eight digits', () => {
    expect(formatBirthDateInput('2000년 01월 01일 99')).toBe('2000-01-01');
  });
});
