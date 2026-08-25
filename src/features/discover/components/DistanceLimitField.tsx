import { useRef, useState } from 'react';
import { type GestureResponderEvent, Platform, StyleSheet, Text, View } from 'react-native';

import { palette, radius } from '@/constants/theme';
import { formatNumber } from '@/lib/intl-format';

export const MIN_DISCOVERY_DISTANCE_KM = 1;
export const MAX_DISCOVERY_DISTANCE_KM = 16_000;
export const UNLIMITED_DISCOVERY_DISTANCE_KM = 0;

const HANDLE_SIZE = 30;
const DISTANCE_STEPS = [
  1,
  2,
  3,
  4,
  5,
  10,
  20,
  30,
  40,
  50,
  100,
  500,
  1_000,
  2_000,
  3_000,
  4_000,
  5_000,
  6_000,
  7_000,
  8_000,
  9_000,
  10_000,
  11_000,
  12_000,
  13_000,
  14_000,
  15_000,
  16_000,
  UNLIMITED_DISCOVERY_DISTANCE_KM,
];

type DistanceLimitFieldProps = {
  value: number;
  onChange: (value: number) => void;
};

export function DistanceLimitField({ value, onChange }: DistanceLimitFieldProps) {
  const trackRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [trackPageX, setTrackPageX] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<{ index: number; pageX: number } | null>(null);
  const stepIndex = getNearestStepIndex(value);
  const percent = (stepIndex / (DISTANCE_STEPS.length - 1)) * 100;
  const isUnlimited = value === UNLIMITED_DISCOVERY_DISTANCE_KM;
  const availableTrackWidth = Math.max(0, trackWidth - HANDLE_SIZE);

  const stepIndexFromPageX = (pageX: number) => {
    if (!availableTrackWidth || trackPageX == null) return null;
    const position = clamp((pageX - trackPageX - HANDLE_SIZE / 2) / availableTrackWidth, 0, 1);
    return Math.round(position * (DISTANCE_STEPS.length - 1));
  };

  const beginInteraction = (event: GestureResponderEvent) => {
    const pageX = event.nativeEvent.pageX;
    const touchedIndex = stepIndexFromPageX(pageX);
    if (touchedIndex == null) return;

    const handleCenter =
      HANDLE_SIZE / 2 + (stepIndex / (DISTANCE_STEPS.length - 1)) * availableTrackWidth;
    const localX = pageX - (trackPageX ?? 0);
    const touchedHandle = Math.abs(localX - handleCenter) <= HANDLE_SIZE / 2 + 6;
    const startIndex = touchedHandle ? stepIndex : touchedIndex;

    if (!touchedHandle) onChange(DISTANCE_STEPS[touchedIndex]);
    setDragStart({ index: startIndex, pageX });
  };

  const moveHandle = (event: GestureResponderEvent) => {
    if (!dragStart || !availableTrackWidth) return;
    const stepDelta = Math.round(
      ((event.nativeEvent.pageX - dragStart.pageX) / availableTrackWidth) *
        (DISTANCE_STEPS.length - 1),
    );
    const nextIndex = clamp(dragStart.index + stepDelta, 0, DISTANCE_STEPS.length - 1);
    onChange(DISTANCE_STEPS[nextIndex]);
  };

  const adjustByOneStep = (direction: 1 | -1) => {
    const nextIndex = clamp(stepIndex + direction, 0, DISTANCE_STEPS.length - 1);
    onChange(DISTANCE_STEPS[nextIndex]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>거리</Text>
          <Text style={styles.hint}>내 위치를 기준으로 가까운 사람부터 만나요.</Text>
        </View>
        <View style={styles.valuePill}>
          <Text style={styles.value}>{isUnlimited ? '무제한' : formatDistance(value)}</Text>
          {!isUnlimited ? <Text style={styles.qualifier}> 이하</Text> : null}
        </View>
      </View>
      <View
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityLabel="최대 탐색 거리"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: MIN_DISCOVERY_DISTANCE_KM,
          max: MAX_DISCOVERY_DISTANCE_KM,
          now: isUnlimited ? MAX_DISCOVERY_DISTANCE_KM : value,
          text: isUnlimited ? '무제한' : `${formatDistance(value)} 이하`,
        }}
        onAccessibilityAction={(event) =>
          adjustByOneStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)
        }
        onLayout={(event) => {
          setTrackWidth(event.nativeEvent.layout.width);
          trackRef.current?.measureInWindow((pageX) => setTrackPageX(pageX));
        }}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={beginInteraction}
        onResponderMove={moveHandle}
        onResponderRelease={() => setDragStart(null)}
        onResponderTerminate={() => setDragStart(null)}
        onStartShouldSetResponder={() => true}
        ref={trackRef}
        style={styles.touchTrack}
      >
        <View style={styles.track} />
        <View style={[styles.activeTrack, { width: availableTrackWidth * (percent / 100) }]} />
        <View
          style={[
            styles.handle,
            { transform: [{ translateX: availableTrackWidth * (percent / 100) }] },
          ]}
        >
          <View style={styles.handleCore} />
        </View>
      </View>
      <View style={styles.bounds}>
        <Text style={styles.bound}>1km</Text>
        <Text style={styles.bound}>무제한</Text>
      </View>
      <Text style={styles.scaleHint}>1,000km부터 16,000km까지는 1,000km 단위로 조절돼요.</Text>
    </View>
  );
}

function getNearestStepIndex(value: number) {
  if (value === UNLIMITED_DISCOVERY_DISTANCE_KM) return DISTANCE_STEPS.length - 1;
  let nearestIndex = 0;
  let nearestDifference = Number.POSITIVE_INFINITY;
  DISTANCE_STEPS.slice(0, -1).forEach((step, index) => {
    const difference = Math.abs(step - value);
    if (difference < nearestDifference) {
      nearestIndex = index;
      nearestDifference = difference;
    }
  });
  return nearestIndex;
}

function formatDistance(value: number) {
  return `${formatNumber('ko-KR', value)}km`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  hint: { color: palette.inkMuted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  valuePill: {
    alignItems: 'baseline',
    backgroundColor: '#FFE5EE',
    borderRadius: radius.pill,
    flexDirection: 'row',
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  value: { color: palette.pinkPressed, fontSize: 13, fontWeight: '900' },
  qualifier: { color: palette.pinkPressed, fontSize: 10, fontWeight: '800' },
  touchTrack: { height: 44, justifyContent: 'center', position: 'relative' },
  track: {
    backgroundColor: '#DADAE0',
    borderRadius: 3,
    height: 5,
    left: HANDLE_SIZE / 2,
    position: 'absolute',
    right: HANDLE_SIZE / 2,
  },
  activeTrack: {
    backgroundColor: palette.pink,
    borderRadius: 3,
    height: 5,
    left: HANDLE_SIZE / 2,
    position: 'absolute',
  },
  handle: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.pink,
    borderRadius: HANDLE_SIZE / 2,
    borderWidth: 3,
    height: HANDLE_SIZE,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    width: HANDLE_SIZE,
    ...Platform.select({
      web: { boxShadow: '0 2px 5px rgba(0, 0, 0, 0.15)' },
      default: {
        elevation: 2,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
    }),
  },
  handleCore: { backgroundColor: palette.pink, borderRadius: 4, height: 8, width: 8 },
  bounds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  bound: { color: palette.inkMuted, fontSize: 10, fontWeight: '700' },
  scaleHint: { color: '#9A9AA2', fontSize: 10, marginTop: 1 },
});
