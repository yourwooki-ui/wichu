import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function MatchesRoute() {
  return (
    <Screen>
      <EmptyState
        icon="people-outline"
        title="Your matches"
        description="People you mutually like will appear here."
      />
    </Screen>
  );
}
