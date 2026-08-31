import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { tutorialState } from '@/features/onboarding/services/tutorial-state';

type ProductTutorialGateProps = {
  profileCompleted: boolean;
  userId?: string;
};

export function ProductTutorialGate({ profileCompleted, userId }: ProductTutorialGateProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!profileCompleted || !userId || pathname === '/tutorial') return;
    let active = true;
    void tutorialState
      .getProductTutorialStatus(userId)
      .then((status) => {
        if (active && status === 'required') router.replace('/tutorial');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [pathname, profileCompleted, router, userId]);

  return null;
}
