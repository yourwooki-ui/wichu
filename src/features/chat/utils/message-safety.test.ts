import { describe, expect, it } from 'vitest';

import { assessMessageSafety } from './message-safety';

describe('assessMessageSafety', () => {
  it('flags money and scam language before other warning classes', () => {
    expect(assessMessageSafety('코인 투자 수익을 위해 계좌로 송금해줘')).toBe('money');
    expect(assessMessageSafety('Send money by wire transfer')).toBe('money');
  });

  it('flags contact details and messenger handles', () => {
    expect(assessMessageSafety('카카오톡 아이디 알려줄게')).toBe('contact');
    expect(assessMessageSafety('email me at hello@example.com')).toBe('contact');
    expect(assessMessageSafety('+82 10-1234-5678')).toBe('contact');
  });

  it('flags external links', () => {
    expect(assessMessageSafety('look at https://example.com/profile')).toBe('link');
    expect(assessMessageSafety('visit example.com')).toBe('link');
  });

  it('allows ordinary conversation', () => {
    expect(assessMessageSafety('주말에는 어떤 음악을 들어요?')).toBeNull();
  });
});
