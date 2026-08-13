import { useLocalSearchParams } from 'expo-router';

import { ChatRoomScreen } from '@/features/chat/screens/ChatRoomScreen';

export default function ChatRoomRoute() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  return <ChatRoomScreen matchId={matchId} />;
}
