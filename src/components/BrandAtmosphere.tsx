import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { palette } from '@/constants/theme';

type BrandAtmosphereProps = {
  strength?: 'quiet' | 'vivid';
};

/**
 * WICHU의 핑크·라임을 사진과 콘텐츠 뒤에 아주 옅게 남기는 장식 레이어.
 * 정보나 조작을 담지 않는 순수 시각 자산이라 접근성 트리와 터치에서 제외한다.
 */
export function BrandAtmosphere({ strength = 'quiet' }: BrandAtmosphereProps) {
  const vivid = strength === 'vivid';

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.layer]}
    >
      <LinearGradient
        colors={vivid ? ['#FFF6F9', '#F7F6F8', '#F5F9ED'] : ['#FFF9FB', palette.paper, '#F7F9F2']}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.pinkOrb, vivid && styles.pinkOrbVivid]} />
      <View style={[styles.orb, styles.limeOrb, vivid && styles.limeOrbVivid]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { pointerEvents: 'none' },
  orb: { borderRadius: 999, position: 'absolute' },
  pinkOrb: {
    backgroundColor: 'rgba(255,45,111,0.055)',
    height: 250,
    right: -126,
    top: 70,
    width: 250,
  },
  pinkOrbVivid: { backgroundColor: 'rgba(255,45,111,0.085)' },
  limeOrb: {
    backgroundColor: 'rgba(201,255,46,0.09)',
    bottom: 18,
    height: 220,
    left: -128,
    width: 220,
  },
  limeOrbVivid: { backgroundColor: 'rgba(201,255,46,0.14)' },
});
