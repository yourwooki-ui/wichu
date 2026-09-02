import { describe, expect, it } from 'vitest';

import { createErrorFingerprint, getOperationalErrorCode } from './operational-error-policy';

describe('operational error classification', () => {
  it('normalizes volatile ids and large numbers into a stable fingerprint', () => {
    expect(createErrorFingerprint('row 123456 failed')).toBe(
      createErrorFingerprint('row 987654 failed'),
    );
  });

  it('classifies network and schema failures without exposing raw messages', () => {
    expect(getOperationalErrorCode(new Error('Network request failed'))).toBe('network');
    expect(getOperationalErrorCode({ code: 'PGRST205' })).toBe('schema_mismatch');
  });
});
