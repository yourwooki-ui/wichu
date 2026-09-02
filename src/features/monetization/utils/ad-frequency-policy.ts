export const DISCOVER_INTERSTITIAL_POLICY = Object.freeze({
  actionsPerAd: 12,
  minimumIntervalMs: 10 * 60 * 1000,
  dailyLimit: 3,
});

export const BROWSE_INTERSTITIAL_POLICY = Object.freeze({
  actionsPerAd: 10,
  minimumIntervalMs: 10 * 60 * 1000,
  dailyLimit: 5,
});

type InterstitialPolicy = {
  actionsPerAd: number;
  minimumIntervalMs: number;
  dailyLimit: number;
};

export type InterstitialFrequencyState = {
  actionsSinceLastAd: number;
  dailyCount: number;
  dayKey: string;
  lastShownAt: number | null;
};

export function getLocalDayKey(now: number) {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeFrequencyState(
  state: InterstitialFrequencyState | null,
  now: number,
): InterstitialFrequencyState {
  const dayKey = getLocalDayKey(now);
  if (!state || state.dayKey !== dayKey) {
    return {
      actionsSinceLastAd: state?.actionsSinceLastAd ?? 0,
      dailyCount: 0,
      dayKey,
      lastShownAt: state?.lastShownAt ?? null,
    };
  }
  return state;
}

export function registerDiscoverAction(previous: InterstitialFrequencyState | null, now: number) {
  return registerInterstitialAction(previous, now, DISCOVER_INTERSTITIAL_POLICY);
}

export function registerBrowseAction(previous: InterstitialFrequencyState | null, now: number) {
  const state = normalizeFrequencyState(previous, now);
  const intervalSatisfied =
    state.lastShownAt === null ||
    now - state.lastShownAt >= BROWSE_INTERSTITIAL_POLICY.minimumIntervalMs;
  const shouldShow =
    state.actionsSinceLastAd >= BROWSE_INTERSTITIAL_POLICY.actionsPerAd &&
    state.dailyCount < BROWSE_INTERSTITIAL_POLICY.dailyLimit &&
    intervalSatisfied;

  return {
    state: { ...state, actionsSinceLastAd: state.actionsSinceLastAd + 1 },
    shouldShow,
  };
}

function registerInterstitialAction(
  previous: InterstitialFrequencyState | null,
  now: number,
  policy: InterstitialPolicy,
) {
  const state = normalizeFrequencyState(previous, now);
  const next = { ...state, actionsSinceLastAd: state.actionsSinceLastAd + 1 };
  const intervalSatisfied =
    next.lastShownAt === null || now - next.lastShownAt >= policy.minimumIntervalMs;
  const shouldShow =
    next.actionsSinceLastAd >= policy.actionsPerAd &&
    next.dailyCount < policy.dailyLimit &&
    intervalSatisfied;

  return { state: next, shouldShow };
}

export function recordInterstitialShown(state: InterstitialFrequencyState, now: number) {
  return {
    ...normalizeFrequencyState(state, now),
    actionsSinceLastAd: 0,
    dailyCount: normalizeFrequencyState(state, now).dailyCount + 1,
    lastShownAt: now,
  };
}
