import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CountryFlag } from '@/components/CountryFlag';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette } from '@/constants/theme';
import { ConnectionProfile } from '@/features/matches/data/mock-connections';

type ConnectionAvatarProps = {
  profile: ConnectionProfile;
  onPress?: () => void;
  size?: 'medium' | 'large';
  showMeta?: boolean;
};

export function ConnectionAvatar({
  profile,
  onPress,
  size = 'medium',
  showMeta = true,
}: ConnectionAvatarProps) {
  const large = size === 'large';

  return (
    <Pressable
      accessibilityLabel={`${profile.name} 프로필 열기`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.root, large && styles.rootLarge, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.ring,
          large && styles.ringLarge,
          profile.isNew && styles.newRing,
          profile.isGoldPass && styles.goldRing,
        ]}
      >
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: profile.photo }}
          style={[styles.image, large && styles.imageLarge]}
          transition={160}
        />
        {profile.isOnline ? (
          <View style={[styles.onlineDot, large && styles.onlineDotLarge]} />
        ) : null}
        {profile.isGoldPass ? (
          <View style={styles.goldMark}>
            <IllustratedIcon size={22} source={illustratedIcons.goldPremium} />
          </View>
        ) : null}
      </View>
      {showMeta ? (
        <>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[styles.name, large && styles.nameLarge]}>
              {profile.name}
            </Text>
            <CountryFlag compact countryCode={profile.countryCode} style={styles.flag} />
          </View>
          <Text style={styles.meta}>{profile.isNew ? '새 매치' : profile.matchedAt}</Text>
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', width: 78 },
  rootLarge: { width: 112 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  ring: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 36,
    borderWidth: 2,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  ringLarge: { borderRadius: 51, height: 102, width: 102 },
  newRing: { borderColor: palette.pink },
  goldRing: { borderColor: '#DCAF2D' },
  goldMark: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: '#E9C35B',
    borderRadius: 12,
    borderWidth: 1.5,
    height: 26,
    justifyContent: 'center',
    left: -2,
    position: 'absolute',
    shadowColor: '#7A5400',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    top: -2,
    width: 26,
  },
  image: { borderRadius: 32, height: 64, width: 64 },
  imageLarge: { borderRadius: 47, height: 94, width: 94 },
  onlineDot: {
    backgroundColor: palette.lime,
    borderColor: palette.white,
    borderRadius: 7,
    borderWidth: 2.5,
    bottom: 3,
    height: 14,
    position: 'absolute',
    right: 2,
    width: 14,
  },
  onlineDotLarge: { bottom: 5, height: 16, right: 4, width: 16 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 7, maxWidth: '100%' },
  name: { color: palette.ink, flexShrink: 1, fontSize: 13, fontWeight: '800' },
  nameLarge: { fontSize: 15 },
  flag: { borderRadius: 3, height: 11, width: 16 },
  meta: {
    color: palette.inkMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 3,
  },
});
