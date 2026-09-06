import type { Profile, RecommendationReason } from '@/types/profile';

export type RecommendationSignals = {
  connectionGoals: string[];
  interestLabels: string[];
  languageCodes: string[];
};

function normalizedSet(values: string[]) {
  return new Set(values.map((value) => value.trim().toLocaleLowerCase()).filter(Boolean));
}

function overlapCount(values: string[], preferred: Set<string>) {
  return values.reduce(
    (count, value) => count + (preferred.has(value.trim().toLocaleLowerCase()) ? 1 : 0),
    0,
  );
}

export function rankDiscoveryProfiles(
  profiles: Profile[],
  signals: RecommendationSignals,
  now = Date.now(),
) {
  const goals = normalizedSet(signals.connectionGoals);
  const interests = normalizedSet(signals.interestLabels);
  const languages = normalizedSet(signals.languageCodes);

  return profiles
    .map((profile, index) => {
      const sharedGoals = overlapCount(profile.connectionGoals ?? [], goals);
      const sharedInterests = overlapCount(profile.interests, interests);
      const sharedLanguages = overlapCount(profile.languages, languages);
      const parsedLastActive = profile.lastActiveAt ? new Date(profile.lastActiveAt).getTime() : 0;
      const lastActiveMs = Number.isFinite(parsedLastActive) ? Math.min(parsedLastActive, now) : 0;
      const elapsedMs = lastActiveMs ? Math.max(0, now - lastActiveMs) : Number.POSITIVE_INFINITY;
      const activityTier =
        elapsedMs <= 5 * 60 * 1000
          ? 3
          : elapsedMs <= 24 * 60 * 60 * 1000
            ? 2
            : elapsedMs <= 7 * 24 * 60 * 60 * 1000
              ? 1
              : 0;
      const recentlyActive = activityTier >= 2;
      const reasons: RecommendationReason[] = [];
      if (sharedGoals > 0) reasons.push('shared_goals');
      if (sharedInterests > 0) reasons.push('shared_interests');
      if (sharedLanguages > 0) reasons.push('language_match');
      if (recentlyActive) reasons.push('recently_active');

      return {
        index,
        profile: { ...profile, recommendationReasons: reasons },
        activityTier,
        lastActiveMs,
        fitScore: sharedGoals * 4 + sharedInterests * 2 + sharedLanguages,
      };
    })
    .sort(
      (left, right) =>
        right.activityTier - left.activityTier ||
        right.lastActiveMs - left.lastActiveMs ||
        right.fitScore - left.fitScore ||
        left.index - right.index,
    )
    .map(({ profile }) => profile);
}
