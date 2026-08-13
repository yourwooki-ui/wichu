import { Image } from 'expo-image';
import { useState } from 'react';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { palette } from '@/constants/theme';

type CountryFlagProps = {
  countryCode: string;
  compact?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function CountryFlag({ countryCode, compact = false, label, style }: CountryFlagProps) {
  const [failed, setFailed] = useState(false);
  const normalizedCode = countryCode.toLowerCase();

  return (
    <View style={[styles.badge, compact && styles.compact, style]}>
      {failed ? (
        <Text style={styles.fallback}>{countryCode.toUpperCase()}</Text>
      ) : (
        <Image
          accessibilityLabel={label}
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => setFailed(true)}
          recyclingKey={normalizedCode}
          source={{ uri: `https://flagcdn.com/w80/${normalizedCode}.png` }}
          style={styles.image}
          transition={120}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 42,
  },
  compact: {
    borderRadius: 7,
    height: 26,
    width: 38,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  fallback: {
    color: palette.inkMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
