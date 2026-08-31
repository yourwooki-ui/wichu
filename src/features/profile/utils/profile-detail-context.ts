export type ProfileDetailContext = 'discover' | 'incoming-like' | 'matched' | 'visitor' | 'chat';

export type ProfileDetailAction = 'decision' | 'chat' | 'none';

export function resolveProfileContext(value?: string): ProfileDetailContext {
  if (value === 'incoming-like' || value === 'matched' || value === 'visitor' || value === 'chat') {
    return value;
  }
  return 'discover';
}

export function getProfileDetailAction(
  context: ProfileDetailContext,
  matchId?: string,
): ProfileDetailAction {
  if (context === 'matched' || context === 'chat') return matchId ? 'chat' : 'none';
  return 'decision';
}
