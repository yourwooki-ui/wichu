import { useQuery } from '@tanstack/react-query';

import { purchaseService } from '@/features/monetization/services/purchase-service';
import { useAuthSession } from '@/hooks/use-auth-session';

export function usePassEntitlement() {
  const { session } = useAuthSession();
  const userId = session?.user.id;
  return useQuery({
    enabled: Boolean(userId),
    queryFn: () => purchaseService.getEntitlement(userId!),
    queryKey: ['pass-entitlement', userId],
    staleTime: 60_000,
  });
}
