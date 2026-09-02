import { describe, expect, it } from 'vitest';

import { createAnalyticsSessionId } from './product-analytics-session';

describe('product analytics session id', () => {
  it('always creates a UUID v4 compatible value without a native crypto dependency', () => {
    const ids = Array.from({ length: 100 }, createAnalyticsSessionId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});
