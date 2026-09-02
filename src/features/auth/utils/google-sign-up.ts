const GOOGLE_SIGN_UP_TTL_MS = 10 * 60 * 1000;

export type PendingGoogleSignUp = {
  birthDate: string;
  initiatedAt: number;
};

export type GoogleOAuthUser = {
  created_at?: string;
  user_metadata?: Record<string, unknown>;
};

export function readPendingGoogleSignUp(value: string): PendingGoogleSignUp | null {
  try {
    const candidate = JSON.parse(value) as Partial<PendingGoogleSignUp>;
    if (typeof candidate.birthDate !== 'string' || typeof candidate.initiatedAt !== 'number') {
      return null;
    }
    return { birthDate: candidate.birthDate, initiatedAt: candidate.initiatedAt };
  } catch {
    // Earlier releases stored only a date. Do not risk applying that stale value to another account.
    return null;
  }
}

export function shouldApplyPendingGoogleBirthDate(
  pending: PendingGoogleSignUp,
  user: GoogleOAuthUser,
  now = Date.now(),
) {
  const createdAt = Date.parse(user.created_at ?? '');
  return (
    Number.isFinite(createdAt) &&
    now - pending.initiatedAt <= GOOGLE_SIGN_UP_TTL_MS &&
    Math.abs(now - createdAt) <= GOOGLE_SIGN_UP_TTL_MS &&
    typeof user.user_metadata?.birth_date !== 'string'
  );
}
