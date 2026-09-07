import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '@/constants/theme';

export type BrandArtworkKind = 'pick' | 'connection' | 'chat';

/** Resolution-independent brand art. Decorative only; no photos, downloads or animation loops. */
export const BrandArtwork = memo(function BrandArtwork({
  kind = 'pick',
}: {
  kind?: BrandArtworkKind;
}) {
  const connected = kind === 'connection';
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.stage}
    >
      <View style={styles.orbit} />
      <View style={[styles.card, styles.left]}>
        <Ionicons color={palette.pink} name={kind === 'chat' ? 'chatbubble' : 'person'} size={34} />
        <View style={styles.line} />
        <View style={[styles.line, styles.shortLine]} />
      </View>
      <View style={[styles.card, styles.right]}>
        <Ionicons
          color={connected ? palette.lime : palette.white}
          name={kind === 'chat' ? 'chatbubble-ellipses' : 'person'}
          size={34}
        />
        <View style={styles.line} />
        <View style={[styles.line, styles.shortLine]} />
      </View>
      <View style={[styles.join, connected && styles.joinConnected]}>
        <Ionicons
          color={connected ? palette.ink : palette.white}
          name={connected ? 'checkmark' : 'heart'}
          size={18}
        />
      </View>
      <View style={styles.spark}>
        <Ionicons color={palette.pink} name="sparkles" size={19} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    height: 160,
    justifyContent: 'center',
    pointerEvents: 'none',
    width: 220,
  },
  orbit: {
    borderColor: palette.line,
    borderRadius: 100,
    borderWidth: 1,
    height: 130,
    position: 'absolute',
    transform: [{ rotate: '-22deg' }],
    width: 204,
  },
  card: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderColor: '#424246',
    borderRadius: 17,
    borderWidth: 1,
    height: 108,
    justifyContent: 'center',
    position: 'absolute',
    width: 78,
  },
  left: { left: 34, top: 22, transform: [{ rotate: '-12deg' }] },
  right: { right: 32, top: 29, transform: [{ rotate: '12deg' }] },
  line: { backgroundColor: '#64646A', borderRadius: 2, height: 3, marginTop: 9, width: 34 },
  shortLine: { marginTop: 5, width: 23 },
  join: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderColor: palette.paper,
    borderRadius: 22,
    borderWidth: 4,
    bottom: 18,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    width: 42,
  },
  joinConnected: { backgroundColor: palette.lime },
  spark: { position: 'absolute', right: 17, top: 13 },
});
