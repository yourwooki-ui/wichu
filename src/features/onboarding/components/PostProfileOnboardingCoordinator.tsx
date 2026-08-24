import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppPermissionOnboarding } from '@/components/AppPermissionOnboarding';
import { tutorialState } from '@/features/onboarding/services/tutorial-state';

type PostProfileOnboardingCoordinatorProps = {
  profileCompleted: boolean;
  userId?: string;
};

type OnboardingPhase = 'checking' | 'tutorial' | 'permissions';

export function PostProfileOnboardingCoordinator({
  profileCompleted,
  userId,
}: PostProfileOnboardingCoordinatorProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [phase, setPhase] = useState<OnboardingPhase>('checking');

  useEffect(() => {
    if (!profileCompleted || !userId) return;

    let active = true;

    void tutorialState
      .getProductTutorialStatus(userId)
      .then((status) => {
        if (!active) return;
        if (status === 'required') {
          setPhase('tutorial');
          if (pathname !== '/tutorial') router.replace('/tutorial');
          return;
        }
        setPhase('permissions');
      })
      .catch(() => {
        if (active) setPhase('permissions');
      });

    return () => {
      active = false;
    };
  }, [pathname, profileCompleted, router, userId]);

  if (!profileCompleted || !userId) return null;
  return phase === 'permissions' ? <AppPermissionOnboarding /> : null;
}
