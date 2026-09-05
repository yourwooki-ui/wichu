import { describe, expect, it } from 'vitest';

import {
  createErrorFingerprint,
  createOperationalErrorGate,
  getOperationalErrorCode,
} from './operational-error-policy';

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

  it('reports a repeated fingerprint once and caps unique errors per session', () => {
    const shouldReport = createOperationalErrorGate(2);
    expect(shouldReport('ads:a')).toBe(true);
    expect(shouldReport('ads:a')).toBe(false);
    expect(shouldReport('purchase:b')).toBe(true);
    expect(shouldReport('profile:c')).toBe(false);
  });
});
