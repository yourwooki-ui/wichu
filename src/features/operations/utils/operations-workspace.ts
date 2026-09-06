export type QueuePriority = 'urgent' | 'overdue' | 'normal';

const URGENT_REPORT_REASONS = new Set(['underage', 'scam']);
const HOUR_MS = 60 * 60 * 1000;

export function getReportPriority(reasons: string[], createdAt: string, now = Date.now()) {
  if (reasons.some((reason) => URGENT_REPORT_REASONS.has(reason))) return 'urgent' as const;
  return getQueuePriority(createdAt, now);
}

export function getQueuePriority(createdAt: string, now = Date.now()): QueuePriority {
  return getQueueAgeHours(createdAt, now) >= 24 ? 'overdue' : 'normal';
}

export function getQueueAgeLabel(createdAt: string, now = Date.now()) {
  const hours = getQueueAgeHours(createdAt, now);
  if (hours < 1) return '1시간 이내';
  if (hours < 24) return `${hours}시간 대기`;
  return `${Math.floor(hours / 24)}일 대기`;
}

export function matchesQueueFilter(
  filter: 'all' | QueuePriority,
  priority: QueuePriority,
  createdAt: string,
  now = Date.now(),
) {
  if (filter === 'all') return true;
  if (filter === 'overdue') return getQueuePriority(createdAt, now) === 'overdue';
  return priority === filter;
}

export function includesNormalizedSearch(values: (string | null | undefined)[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
  if (!normalizedQuery) return true;
  return values.some((value) => value?.toLocaleLowerCase('ko-KR').includes(normalizedQuery));
}

function getQueueAgeHours(createdAt: string, now: number) {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((now - timestamp) / HOUR_MS));
}
