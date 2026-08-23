import { Image, type ImageSource } from 'expo-image';
import { type ImageStyle, type StyleProp, StyleSheet } from 'react-native';

type IllustratedIconProps = {
  size?: number;
  source: ImageSource;
  style?: StyleProp<ImageStyle>;
};

export function IllustratedIcon({ size = 40, source, style }: IllustratedIconProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      cachePolicy="memory-disk"
      contentFit="contain"
      source={source}
      style={[styles.icon, { height: size, width: size }, style]}
    />
  );
}

const styles = StyleSheet.create({
  icon: { flexShrink: 0 },
});
