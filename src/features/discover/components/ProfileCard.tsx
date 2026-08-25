import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CountryFlag } from '@/components/CountryFlag';
import { GoldBadge } from '@/components/GoldBadge';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { elevation, palette, pressFeedback, radius, spacing, typography } from '@/constants/theme';
import { getProfilePresence } from '@/features/profile/utils/profile-display';
import { Profile } from '@/types/profile';

type ProfileCardProps = {
  accessibilityActions?: ComponentProps<typeof Pressable>['accessibilityActions'];
  profile: Profile;
  now: number;
  onAccessibilityAction?: ComponentProps<typeof Pressable>['onAccessibilityAction'];
  onPress?: () => void;
};

function ProfileCardComponent({
  accessibilityActions,
  profile,
  now,
  onAccessibilityAction,
  onPress,
}: ProfileCardProps) {
  const { t } = useTranslation();
  const [failedPhotoUri, setFailedPhotoUri] = useState<string | null>(null);
  const age = profile.age;
  const distanceLabel =
    profile.distanceKm != null
      ? t('experience.discover.distanceKm', { distance: profile.distanceKm })
      : null;
  const presence = getProfilePresence(profile.lastActiveAt, now);
  const presenceLabel = presence
    ? t(`discover.presence.${presence.kind}`, { count: presence.count })
    : null;
  const profileSignals = [
    ...(profile.connectionGoals ?? []).map((goal) => t(`profileSetup.profileTags.values.${goal}`)),
    ...profile.interests,
  ].slice(0, 3);
  const primaryPhoto = profile.photos[0];
  const photoFailed = failedPhotoUri === primaryPhoto;

  return (
    <Pressable
      accessibilityActions={accessibilityActions}
      accessibilityLabel={`${profile.name}, ${age}. ${presenceLabel ?? ''}. ${distanceLabel ?? ''}`}
      accessibilityRole="button"
      onAccessibilityAction={onAccessibilityAction}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        profile.isGoldPass && styles.goldCardBorder,
        pressed && styles.cardPressed,
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        cachePolicy="memory-disk"
        contentFit="cover"
        onError={() => setFailedPhotoUri(primaryPhoto)}
        priority="high"
        recyclingKey={profile.id}
        source={{ uri: primaryPhoto }}
        style={StyleSheet.absoluteFill}
        transition={180}
      />
      {photoFailed ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.photoFallback}
        >
          <IllustratedIcon size={72} source={illustratedIcons.profilePhotos} />
        </View>
      ) : null}
      {profile.photos.length > 1 ? (
        <View style={styles.photoProgress}>
          {profile.photos.map((photo, index) => (
            <View
              key={photo}
              style={[styles.photoProgressItem, index === 0 && styles.photoProgressActive]}
            />
          ))}
        </View>
      ) : null}
      <LinearGradient
        colors={['rgba(5,5,8,0.28)', 'rgba(5,5,8,0)']}
        style={[styles.gradientTop, styles.nonInteractive]}
      />
      <LinearGradient
        colors={['rgba(7,7,11,0)', 'rgba(7,7,11,0.12)', 'rgba(7,7,11,0.82)']}
        locations={[0, 0.32, 1]}
        style={[styles.gradientBottom, styles.nonInteractive]}
      />
      <View style={styles.badges}>
        {profile.isNew ? (
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>{t('experience.discover.newProfile')}</Text>
          </View>
        ) : null}
      </View>
      {profile.isGoldPass ? (
        <View style={styles.goldBadgeSlot}>
          <GoldBadge size="md" />
        </View>
      ) : null}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>
            {profile.name}, {age}
          </Text>
          <CountryFlag
            compact
            countryCode={profile.countryCode}
            label={profile.countryLabel}
            style={styles.nameFlag}
          />
          {profile.isPhotoReviewed && (
            <View
              accessibilityLabel={t('experience.trust.photoReviewedA11y')}
              style={styles.reviewedBadge}
            >
              <IllustratedIcon size={17} source={illustratedIcons.safety} />
              <Text style={styles.reviewedBadgeText}>{t('experience.trust.photoReviewed')}</Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          {presenceLabel ? (
            <View style={styles.presence}>
              <View
                style={[
                  styles.presenceDot,
                  presence?.kind === 'online' ? styles.presenceDotOnline : null,
                ]}
              />
              <Text style={styles.presenceText}>{presenceLabel}</Text>
            </View>
          ) : null}
          {presenceLabel ? <View style={styles.metaDivider} /> : null}
          {distanceLabel ? (
            <View style={styles.locationRow}>
              <IllustratedIcon size={18} source={illustratedIcons.location} />
              <Text style={styles.location}>{distanceLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.bio} numberOfLines={2}>
          {profile.bio}
        </Text>
        <View style={styles.interests}>
          {profileSignals.map((interest) => (
            <View key={interest} style={styles.interest}>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

export const ProfileCard = memo(ProfileCardComponent);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: '#D9D9E1',
    ...elevation.lg,
  },
  cardPressed: pressFeedback.surface,
  photoFallback: {
    alignItems: 'center',
    backgroundColor: '#F0F0F4',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  goldBadgeSlot: { position: 'absolute', right: 16, top: 19 },
  goldCardBorder: { borderColor: '#E8B936', borderWidth: 3 },
  nonInteractive: { pointerEvents: 'none' },
  gradientTop: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: '24%',
  },
  gradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
  },
  photoProgress: {
    position: 'absolute',
    top: 13,
    left: 16,
    right: 16,
    zIndex: 3,
    flexDirection: 'row',
    gap: 4,
  },
  photoProgressItem: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  photoProgressActive: { backgroundColor: '#FFFFFF' },
  badges: { position: 'absolute', top: 22, left: 18, flexDirection: 'row' },
  badge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(17,17,17,0.68)',
    borderColor: 'rgba(255,255,255,0.28)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.lime },
  badgeText: { color: palette.white, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  content: { position: 'absolute', left: 22, right: 22, bottom: 24 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.display, color: palette.white, flexShrink: 1, fontWeight: '800' },
  nameFlag: {
    borderColor: 'rgba(255,255,255,0.62)',
    borderRadius: 5,
    height: 20,
    width: 29,
  },
  reviewedBadge: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 11,
    flexDirection: 'row',
    gap: 3,
    height: 22,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  reviewedBadgeText: { color: palette.white, fontSize: 10, fontWeight: '900' },
  metaRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(9,9,12,0.28)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  presence: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  presenceDot: {
    backgroundColor: 'rgba(255,255,255,0.64)',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  presenceDotOnline: { backgroundColor: palette.lime },
  presenceText: { ...typography.label, color: 'rgba(255,255,255,0.9)' },
  metaDivider: {
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 1,
    height: 3,
    marginHorizontal: 8,
    width: 3,
  },
  locationRow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  location: { ...typography.label, color: 'rgba(255,255,255,0.86)', fontWeight: '600' },
  bio: { ...typography.body, color: palette.white, marginTop: 11 },
  interests: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  interest: {
    paddingHorizontal: 12,
    paddingVertical: 7.5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18,18,22,0.34)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  interestText: { color: palette.white, fontSize: 11, fontWeight: '700' },
});
