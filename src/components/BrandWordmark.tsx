import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/theme';

type BrandWordmarkProps = {
  color?: string;
  size?: number;
};

export function BrandWordmark({ color = palette.white, size = 22 }: BrandWordmarkProps) {
  return (
    <View accessibilityRole="text" accessibilityLabel="WICHU" style={styles.container}>
      <Text style={[styles.wordmark, { color, fontSize: size, lineHeight: size + 4 }]}>WICHU</Text>
      <Text style={[styles.heart, { left: size * 1.53, top: -size * 0.28, fontSize: size * 0.48 }]}>
        ♥
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', alignSelf: 'flex-start' },
  wordmark: { fontWeight: '900', letterSpacing: -0.8 },
  heart: { position: 'absolute', color: palette.pink, lineHeight: 14 },
});
