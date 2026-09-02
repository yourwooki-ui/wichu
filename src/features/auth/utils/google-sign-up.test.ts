import { describe, expect, it } from 'vitest';

import { shouldApplyPendingGoogleBirthDate } from './google-sign-up';

const now = Date.parse('2026-09-02T03:00:00.000Z');

describe('Google sign-up metadata safety', () => {
  it('applies a recent birth date only to a newly-created account', () => {
    expect(
      shouldApplyPendingGoogleBirthDate(
        { birthDate: '1995-04-12', initiatedAt: now - 60_000 },
        { created_at: new Date(now - 30_000).toISOString(), user_metadata: {} },
        now,
      ),
    ).toBe(true);
  });

  it('does not overwrite an existing Google account', () => {
    expect(
      shouldApplyPendingGoogleBirthDate(
        { birthDate: '1995-04-12', initiatedAt: now - 60_000 },
        { created_at: '2025-01-01T00:00:00.000Z', user_metadata: {} },
        now,
      ),
    ).toBe(false);
  });

  it('does not overwrite birth date metadata already on the account', () => {
    expect(
      shouldApplyPendingGoogleBirthDate(
        { birthDate: '1995-04-12', initiatedAt: now - 60_000 },
        {
          created_at: new Date(now - 30_000).toISOString(),
          user_metadata: { birth_date: '1990-01-01' },
        },
        now,
      ),
    ).toBe(false);
  });
});
