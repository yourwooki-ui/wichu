import { StyleSheet, View } from 'react-native';

import { palette } from '@/constants/theme';

type BrandAtmosphereProps = {
  strength?: 'quiet' | 'vivid';
};

/**
 * 사진을 우선하는 중립 캔버스. 라임은 성공·접속 상태에만 사용한다.
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
      {vivid ? <View style={styles.keyline} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { backgroundColor: palette.paper, pointerEvents: 'none' },
  keyline: {
    backgroundColor: palette.pink,
    height: 3,
    left: 20,
    position: 'absolute',
    top: 0,
    width: 28,
  },
});
