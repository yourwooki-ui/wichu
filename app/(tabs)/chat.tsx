import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function ChatListRoute() {
  return (
    <Screen>
      <EmptyState
        icon="chatbubble-ellipses-outline"
        title="Start a conversation"
        description="Chats become available after you match."
      />
    </Screen>
  );
}
