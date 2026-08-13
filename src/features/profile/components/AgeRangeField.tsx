import { useState } from 'react';
import {
  type GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { palette } from '@/constants/theme';

const MIN_AGE = 18;
const MAX_AGE = 90;
const HANDLE_SIZE = 28;

type DragStart = { age: number; pageX: number };

type AgeRangeFieldProps = {
  minAge: number;
  maxAge: number;
  onChangeMin: (value: number) => void;
  onChangeMax: (value: number) => void;
};

export function AgeRangeField({ minAge, maxAge, onChangeMin, onChangeMax }: AgeRangeFieldProps) {
  const { t } = useTranslation();
  const [trackWidth, setTrackWidth] = useState(0);
  const [minDrag, setMinDrag] = useState<DragStart | null>(null);
  const [maxDrag, setMaxDrag] = useState<DragStart | null>(null);
  const minPercent = ageToPercent(minAge);
  const maxPercent = ageToPercent(maxAge);

  function startDrag(
    event: GestureResponderEvent,
    age: number,
    setDrag: (value: DragStart) => void,
  ) {
    setDrag({ age, pageX: event.nativeEvent.pageX });
  }

  function moveMin(event: GestureResponderEvent) {
    if (!minDrag) return;
    onChangeMin(
      clamp(
        minDrag.age + distanceToYears(event.nativeEvent.pageX - minDrag.pageX, trackWidth),
        MIN_AGE,
        maxAge,
      ),
    );
  }

  function moveMax(event: GestureResponderEvent) {
    if (!maxDrag) return;
    onChangeMax(
      clamp(
        maxDrag.age + distanceToYears(event.nativeEvent.pageX - maxDrag.pageX, trackWidth),
        minAge,
        MAX_AGE,
      ),
    );
  }

  function moveNearestHandle(locationX: number) {
    if (!trackWidth) return;
    const selectedAge = clamp(
      Math.round(MIN_AGE + (locationX / trackWidth) * (MAX_AGE - MIN_AGE)),
      MIN_AGE,
      MAX_AGE,
    );
    if (Math.abs(selectedAge - minAge) <= Math.abs(selectedAge - maxAge)) {
      onChangeMin(Math.min(selectedAge, maxAge));
    } else {
      onChangeMax(Math.max(selectedAge, minAge));
    }
  }

  return (
    <View style={styles.section}>
      <View>
        <Text style={styles.label}>{t('profileSetup.ageRange.title')}</Text>
        <Text style={styles.hint}>{t('profileSetup.ageRange.hint')}</Text>
      </View>
      <View style={styles.values}>
        <Text style={styles.value}>{t('profileSetup.ageRange.minimumValue', { age: minAge })}</Text>
        <Text style={styles.value}>{t('profileSetup.ageRange.maximumValue', { age: maxAge })}</Text>
      </View>
      <Pressable
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onPress={(event) => moveNearestHandle(event.nativeEvent.locationX)}
        style={styles.touchTrack}
      >
        <View style={styles.track} />
        <View
          style={[styles.activeTrack, { left: `${minPercent}%`, right: `${100 - maxPercent}%` }]}
        />
        <View
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          accessibilityLabel={t('profileSetup.ageRange.minimum')}
          accessibilityRole="adjustable"
          accessibilityValue={{ min: MIN_AGE, max: maxAge, now: minAge }}
          onAccessibilityAction={(event) =>
            onChangeMin(
              clamp(
                minAge + (event.nativeEvent.actionName === 'increment' ? 1 : -1),
                MIN_AGE,
                maxAge,
              ),
            )
          }
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => startDrag(event, minAge, setMinDrag)}
          onResponderMove={moveMin}
          onResponderRelease={() => setMinDrag(null)}
          onResponderTerminate={() => setMinDrag(null)}
          onStartShouldSetResponder={() => true}
          style={[
            styles.handle,
            { transform: [{ translateX: (trackWidth * minPercent) / 100 - HANDLE_SIZE / 2 }] },
          ]}
        />
        <View
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          accessibilityLabel={t('profileSetup.ageRange.maximum')}
          accessibilityRole="adjustable"
          accessibilityValue={{ min: minAge, max: MAX_AGE, now: maxAge }}
          onAccessibilityAction={(event) =>
            onChangeMax(
              clamp(
                maxAge + (event.nativeEvent.actionName === 'increment' ? 1 : -1),
                minAge,
                MAX_AGE,
              ),
            )
          }
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => startDrag(event, maxAge, setMaxDrag)}
          onResponderMove={moveMax}
          onResponderRelease={() => setMaxDrag(null)}
          onResponderTerminate={() => setMaxDrag(null)}
          onStartShouldSetResponder={() => true}
          style={[
            styles.handle,
            { transform: [{ translateX: (trackWidth * maxPercent) / 100 - HANDLE_SIZE / 2 }] },
          ]}
        />
      </Pressable>
      <View style={styles.bounds}>
        <Text style={styles.bound}>18</Text>
        <Text style={styles.bound}>90</Text>
      </View>
    </View>
  );
}

function ageToPercent(age: number) {
  return ((age - MIN_AGE) / (MAX_AGE - MIN_AGE)) * 100;
}

function distanceToYears(distance: number, width: number) {
  return width ? Math.round((distance / width) * (MAX_AGE - MIN_AGE)) : 0;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  hint: { color: palette.inkMuted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  values: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  value: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  touchTrack: { height: 42, justifyContent: 'center', position: 'relative' },
  track: { backgroundColor: '#DADAE0', borderRadius: 3, height: 5, width: '100%' },
  activeTrack: { backgroundColor: palette.pink, borderRadius: 3, height: 5, position: 'absolute' },
  handle: {
    backgroundColor: palette.white,
    borderColor: palette.pink,
    borderRadius: HANDLE_SIZE / 2,
    borderWidth: 3,
    height: HANDLE_SIZE,
    left: 0,
    position: 'absolute',
    width: HANDLE_SIZE,
    ...Platform.select({
      web: { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.14)' },
      default: {
        elevation: 2,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 4,
      },
    }),
  },
  bounds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  bound: { color: palette.inkMuted, fontSize: 10, fontWeight: '700' },
});
