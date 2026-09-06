import { describe, expect, it } from 'vitest';

import {
  getQueueAgeLabel,
  getQueuePriority,
  getReportPriority,
  includesNormalizedSearch,
  matchesQueueFilter,
} from './operations-workspace';

const NOW = new Date('2026-09-06T12:00:00.000Z').getTime();

describe('operations workspace queue helpers', () => {
  it('always elevates high-risk report reasons', () => {
    expect(getReportPriority(['spam', 'underage'], '2026-09-06T11:50:00.000Z', NOW)).toBe('urgent');
    expect(getReportPriority(['scam'], '2026-09-06T11:50:00.000Z', NOW)).toBe('urgent');
  });

  it('marks a queue item overdue from 24 hours', () => {
    expect(getQueuePriority('2026-09-05T12:00:00.000Z', NOW)).toBe('overdue');
    expect(getQueuePriority('2026-09-05T13:00:00.000Z', NOW)).toBe('normal');
    expect(getQueueAgeLabel('2026-09-04T10:00:00.000Z', NOW)).toBe('2일 대기');
  });

  it('searches across nullable fields without case sensitivity', () => {
    expect(includesNormalizedSearch(['Mina', null, 'KR'], ' mina ')).toBe(true);
    expect(includesNormalizedSearch(['Mina', 'KR'], 'jp')).toBe(false);
    expect(includesNormalizedSearch([], '  ')).toBe(true);
  });

  it('keeps old urgent reports visible in the overdue filter', () => {
    expect(matchesQueueFilter('overdue', 'urgent', '2026-09-05T10:00:00.000Z', NOW)).toBe(true);
    expect(matchesQueueFilter('urgent', 'urgent', '2026-09-06T11:00:00.000Z', NOW)).toBe(true);
  });
});
