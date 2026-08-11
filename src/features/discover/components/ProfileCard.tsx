import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { Profile } from '@/types/profile';

type ProfileCardProps = {
  profile: Profile;
  onPress?: () => void;
};

function ProfileCardComponent({ profile, onPress }: ProfileCardProps) {
  const age = new Date().getFullYear() - profile.birthYear;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image
        source={{ uri: profile.photos[0] }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={180}
      />
      <View style={styles.photoProgress}>
        {profile.photos.map((photo, index) => (
          <View
            key={photo}
            style={[styles.photoProgressItem, index === 0 && styles.photoProgressActive]}
          />
        ))}
      </View>
      <View style={styles.gradientTop} />
      <View style={styles.gradientBottom} />
      <View style={styles.badges}>
        {profile.isNew && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NEW</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>
            {profile.name}, {age}
          </Text>
          {profile.isVerified && <Ionicons name="checkmark-circle" size={21} color="#A996FF" />}
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={styles.location}>
            {profile.city}, {profile.countryLabel}
          </Text>
        </View>
        <Text style={styles.bio} numberOfLines={2}>
          {profile.bio}
        </Text>
        <View style={styles.interests}>
          {profile.interests.slice(0, 3).map((interest) => (
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
    borderRadius: radius.lg,
    backgroundColor: '#D9D9E1',
    shadowColor: '#151419',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: '70%',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  gradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
    backgroundColor: 'rgba(8,8,13,0.58)',
  },
  photoProgress: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    zIndex: 3,
    flexDirection: 'row',
    gap: 5,
  },
  photoProgressItem: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  photoProgressActive: { backgroundColor: '#FFFFFF' },
  badges: { position: 'absolute', top: 28, left: 16, flexDirection: 'row' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(21,21,28,0.68)',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  content: { position: 'absolute', left: 20, right: 20, bottom: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  locationRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  location: { color: 'rgba(255,255,255,0.92)', fontSize: 14, fontWeight: '600' },
  bio: { marginTop: 10, color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  interests: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  interest: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  interestText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
