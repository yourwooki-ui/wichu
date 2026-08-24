import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius } from '@/constants/theme';
import { profileLocationService } from '@/features/profile/services/profile-location-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import {
  notificationPermissionService,
  type AppPermissionState,
} from '../services/notification-permission-service';
import { notificationsService } from '../services/notifications-service';

type Step = 'location' | 'notifications';

export function AppPermissionOnboarding() {
  const { profileCompleted, session } = useAuthSession();
  const pathname = usePathname();
  const router = useRouter();
  const userId = session?.user.id;
  const [step, setStep] = useState<Step | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const finish = useCallback(async () => {
    if (userId) await AsyncStorage.setItem(storageKey(userId), 'done');
    setStep(null);
    if (pathname === '/profile-setup') router.replace('/(tabs)/discover');
  }, [pathname, router, userId]);

  useEffect(() => {
    if (!userId || !profileCompleted) return;
    let active = true;
    void (async () => {
      const onboardingDone = (await AsyncStorage.getItem(storageKey(userId))) === 'done';
      const currentNotificationStatus = await notificationPermissionService.getStatus();
      if (currentNotificationStatus === 'granted') {
        await notificationsService.register(userId).catch(() => null);
      }
      if (onboardingDone || !active) return;
      const [locationResult, notificationStatus] = await Promise.all([
        profileLocationService.syncCurrentLocation().catch(() => ({ status: 'error' as const })),
        Promise.resolve(currentNotificationStatus),
      ]);
      if (!active) return;
      if (locationResult.status === 'ready' && isSettled(notificationStatus)) {
        await finish();
        return;
      }
      setStep(
        locationResult.status === 'ready' || locationResult.status === 'error'
          ? 'notifications'
          : 'location',
      );
    })().catch(() => {
      if (active) setStep('location');
    });
    return () => {
      active = false;
    };
  }, [finish, profileCompleted, userId]);

  const requestCurrentPermission = async () => {
    if (!step || working) return;
    setMessage(null);

    if (step === 'location') {
      // 위치 권한 창과 좌표 획득은 운영체제/브라우저가 완료 시점을 결정한다.
      // 가입 흐름은 기다리지 않고 다음 단계로 진행하고, 좌표는 백그라운드에서 저장한다.
      setStep('notifications');
      void profileLocationService
        .syncCurrentLocation({ requestPermission: true })
        .catch(() => undefined);
      return;
    }

    setWorking(true);
    try {
      const result = await notificationPermissionService.request(userId);
      if (result !== 'granted') setMessage('알림은 나중에 기기 설정에서 허용할 수 있어요.');
      await finish();
    } catch {
      await finish();
    } finally {
      setWorking(false);
    }
  };

  const skip = async () => {
    if (step === 'location') {
      setMessage(null);
      setStep('notifications');
    } else {
      await finish();
    }
  };

  if (!step) return null;
  const isLocation = step === 'location';

  return (
    <AppModal animationType="fade" transparent visible>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: isLocation ? '50%' : '100%' }]} />
            </View>
            <Text style={styles.stepText}>{isLocation ? '1 / 2' : '2 / 2'}</Text>
          </View>
          <LinearGradient
            colors={isLocation ? ['#FFE5EE', '#FFF7FA'] : ['#FFF1B9', '#FFF9E8']}
            style={styles.visual}
          >
            <View style={[styles.iconCircle, !isLocation && styles.iconCircleYellow]}>
              <IllustratedIcon
                size={68}
                source={isLocation ? illustratedIcons.location : illustratedIcons.notification}
              />
            </View>
          </LinearGradient>
          <Text style={styles.eyebrow}>{isLocation ? '정확한 거리 탐색' : '놓치지 않는 연결'}</Text>
          <Text style={styles.title}>
            {isLocation
              ? '내 주변의 사람을\n더 정확하게 찾아요'
              : '새로운 픽과 메시지를\n바로 알려드릴게요'}
          </Text>
          <Text style={styles.description}>
            {isLocation
              ? '앱을 사용하는 동안의 위치로 프로필 간 거리만 계산해요. 정확한 좌표는 다른 사용자에게 공개되지 않아요.'
              : '매치, 메시지와 중요한 계정 알림만 보내요. 마케팅 알림은 기본으로 켜지지 않아요.'}
          </Text>
          <View style={styles.trustRow}>
            <IllustratedIcon size={20} source={illustratedIcons.safety} />
            <Text style={styles.trustText}>
              {isLocation ? '백그라운드 위치 추적 안 함' : '설정에서 언제든 변경 가능'}
            </Text>
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable
            disabled={working}
            onPress={requestCurrentPermission}
            style={({ pressed }) => [styles.primary, (pressed || working) && styles.pressed]}
          >
            <Text style={styles.primaryText}>{working ? '확인 중…' : '허용하고 계속'}</Text>
          </Pressable>
          <Pressable disabled={working} onPress={skip} style={styles.secondary}>
            <Text style={styles.secondaryText}>나중에</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </AppModal>
  );
}

function isSettled(status: AppPermissionState) {
  return status === 'granted' || status === 'denied' || status === 'unavailable';
}

function storageKey(userId: string) {
  return `wichu:permission-onboarding:v1:${userId}`;
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,19,0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: { backgroundColor: '#FAFAFC', borderRadius: 30, maxWidth: 400, padding: 22, width: '100%' },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  progressTrack: {
    backgroundColor: '#E5E5E9',
    borderRadius: 3,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  progressFill: { backgroundColor: palette.pink, height: '100%' },
  stepText: { color: palette.inkMuted, fontSize: 11, fontWeight: '900' },
  visual: {
    alignItems: 'center',
    borderRadius: 24,
    height: 142,
    justifyContent: 'center',
    marginTop: 18,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 38,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  iconCircleYellow: { backgroundColor: '#FFFDF7' },
  eyebrow: {
    color: palette.pink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginTop: 20,
  },
  title: {
    color: palette.ink,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 31,
    marginTop: 7,
  },
  description: { color: palette.inkMuted, fontSize: 13, lineHeight: 20, marginTop: 10 },
  trustRow: {
    alignItems: 'center',
    backgroundColor: '#EDF8E8',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  trustText: { color: '#176E4D', fontSize: 11, fontWeight: '900' },
  message: { color: palette.danger, fontSize: 11, lineHeight: 16, marginTop: 10 },
  primary: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 52,
  },
  primaryText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  secondary: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  secondaryText: { color: palette.inkMuted, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.68 },
});
