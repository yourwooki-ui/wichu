export const CHAT_BOTTOM_THRESHOLD = 96;

type ChatScrollMetrics = {
  contentHeight: number;
  offsetY: number;
  viewportHeight: number;
};

type AutoScrollDecision = {
  isNearBottom: boolean;
  latestMessageIsMine: boolean;
  nextCount: number;
  previousCount: number;
};

export function isNearChatBottom(
  { contentHeight, offsetY, viewportHeight }: ChatScrollMetrics,
  threshold = CHAT_BOTTOM_THRESHOLD,
) {
  return offsetY + viewportHeight >= contentHeight - threshold;
}

export function shouldAutoScrollChat({
  isNearBottom,
  latestMessageIsMine,
  nextCount,
  previousCount,
}: AutoScrollDecision) {
  if (nextCount === 0 || nextCount <= previousCount) return false;
  if (previousCount === 0) return true;
  if (nextCount > previousCount + 1) return false;
  return isNearBottom || latestMessageIsMine;
}
