import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { MotionIllustratedIcon } from '@/components/MotionIllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, pressFeedback, radius } from '@/constants/theme';
import { profileLocationService } from '@/features/profile/services/profile-location-service';
import { useAuthSession } from '@/hooks/use-auth-session';
import {
  notificationPermissionService,
  type AppPermissionState,
} from '../services/notification-permission-service';
import { notificationsService } from '../services/notifications-service';

type Step = 'location' | 'notifications';

export function AppPermissionOnboarding() {
  const { t } = useTranslation();
  const { profileCompleted, session } = useAuthSession();
  const pathname = usePathname();
  const router = useRouter();
  const userId = session?.user.id;
  const [step, setStep] = useState<Step | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const finish = useCallback(async () => {
    if (userId) await AsyncStorage.setItem(storageKey(userId), 'done').catch(() => undefined);
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
      if (result !== 'granted') setMessage(t('permissionOnboarding.notificationDenied'));
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
    <AppModal animationType="fade" onRequestClose={() => void finish()} transparent visible>
      <SafeAreaView style={styles.overlay}>
        <ScrollView
          accessibilityViewIsModal
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
          style={styles.card}
        >
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
              <MotionIllustratedIcon
                motion={isLocation ? 'float' : 'bell'}
                size={68}
                source={isLocation ? illustratedIcons.location : illustratedIcons.notification}
              />
            </View>
          </LinearGradient>
          <Text style={styles.eyebrow}>
            {t(
              isLocation
                ? 'permissionOnboarding.locationEyebrow'
                : 'permissionOnboarding.notificationEyebrow',
            )}
          </Text>
          <Text style={styles.title}>
            {t(
              isLocation
                ? 'permissionOnboarding.locationTitle'
                : 'permissionOnboarding.notificationTitle',
            )}
          </Text>
          <Text style={styles.description}>
            {t(
              isLocation
                ? 'permissionOnboarding.locationBody'
                : 'permissionOnboarding.notificationBody',
            )}
          </Text>
          <View style={styles.trustRow}>
            <IllustratedIcon size={20} source={illustratedIcons.safety} />
            <Text style={styles.trustText}>
              {t(
                isLocation
                  ? 'permissionOnboarding.locationTrust'
                  : 'permissionOnboarding.notificationTrust',
              )}
            </Text>
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable
            accessibilityLabel={t('permissionOnboarding.allowContinue')}
            accessibilityRole="button"
            accessibilityState={{ busy: working, disabled: working }}
            disabled={working}
            onPress={requestCurrentPermission}
            style={({ pressed }) => [styles.primary, (pressed || working) && styles.pressed]}
          >
            <Text style={styles.primaryText}>
              {t(working ? 'permissionOnboarding.checking' : 'permissionOnboarding.allowContinue')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t('permissionOnboarding.later')}
            accessibilityRole="button"
            accessibilityState={{ disabled: working }}
            disabled={working}
            onPress={skip}
            style={({ pressed }) => [styles.secondary, pressed && pressFeedback.control]}
          >
            <Text style={styles.secondaryText}>{t('permissionOnboarding.later')}</Text>
          </Pressable>
        </ScrollView>
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
    backgroundColor: 'rgba(17,17,19,0.22)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FAFAFC',
    borderRadius: 30,
    elevation: 16,
    maxHeight: '100%',
    maxWidth: 400,
    shadowColor: '#111113',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    width: '100%',
  },
  cardContent: { padding: 22 },
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
