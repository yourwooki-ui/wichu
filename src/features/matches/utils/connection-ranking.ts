import type {
  ConnectionProfile,
  ConversationPreview,
} from '@/features/matches/data/mock-connections';

function activityTime(profile: ConnectionProfile) {
  if (!profile.lastActiveAt) return 0;
  const value = new Date(profile.lastActiveAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function compareActivity(left: ConnectionProfile, right: ConnectionProfile) {
  return Number(right.isOnline) - Number(left.isOnline) || activityTime(right) - activityTime(left);
}

/** 실시간 접속과 최근 접속을 모든 부가 신호보다 먼저 적용한다. */
export function rankConnectionProfiles(profiles: ConnectionProfile[]) {
  return profiles
    .map((profile, index) => ({ index, profile }))
    .sort(
      (left, right) =>
        compareActivity(left.profile, right.profile) ||
        Number(Boolean(right.profile.isNew)) - Number(Boolean(left.profile.isNew)) ||
        Number(Boolean(right.profile.isGoldPass)) - Number(Boolean(left.profile.isGoldPass)) ||
        left.index - right.index,
    )
    .map(({ profile }) => profile);
}

/** Chat에서도 활동 상태가 우선이며, 동률일 때만 미확인 대화를 앞세운다. */
export function rankConversations(conversations: ConversationPreview[]) {
  return conversations
    .map((conversation, index) => ({ conversation, index }))
    .sort(
      (left, right) =>
        compareActivity(left.conversation.profile, right.conversation.profile) ||
        Number(Boolean(right.conversation.isTyping)) -
          Number(Boolean(left.conversation.isTyping)) ||
        Number(right.conversation.unreadCount > 0) - Number(left.conversation.unreadCount > 0) ||
        right.conversation.unreadCount - left.conversation.unreadCount ||
        left.index - right.index,
    )
    .map(({ conversation }) => conversation);
}
