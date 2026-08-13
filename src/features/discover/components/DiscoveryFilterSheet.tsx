import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius } from '@/constants/theme';
import { CountryMultiSelectField } from '@/features/discover/components/CountryMultiSelectField';
import {
  DistanceLimitField,
  UNLIMITED_DISCOVERY_DISTANCE_KM,
} from '@/features/discover/components/DistanceLimitField';
import type { DiscoveryFilters } from '@/features/discover/services/discovery-service';
import { AgeRangeField } from '@/features/profile/components/AgeRangeField';

const GENDERS = [
  { value: 'woman', label: '여성' },
  { value: 'man', label: '남성' },
  { value: 'nonbinary', label: '논바이너리' },
  { value: 'other', label: '기타' },
];

type Props = {
  visible: boolean;
  value?: DiscoveryFilters;
  saving: boolean;
  onClose: () => void;
  onSave: (filters: DiscoveryFilters) => Promise<unknown>;
};

export function DiscoveryFilterSheet({ visible, value, saving, onClose, onSave }: Props) {
  if (!visible) return null;

  return (
    <DiscoveryFilterForm
      key={`${value?.minAge ?? 18}-${value?.maxAge ?? 29}-${value?.maxDistanceKm ?? UNLIMITED_DISCOVERY_DISTANCE_KM}-${value?.genders.join(',') ?? ''}-${value?.countryCodes?.join(',') ?? ''}`}
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      value={value}
    />
  );
}

function DiscoveryFilterForm({ value, saving, onClose, onSave }: Omit<Props, 'visible'>) {
  const [minAge, setMinAge] = useState(value?.minAge ?? 18);
  const [maxAge, setMaxAge] = useState(value?.maxAge ?? 29);
  const [genders, setGenders] = useState<string[]>(value?.genders ?? ['woman']);
  const [countryCodes, setCountryCodes] = useState<string[]>(value?.countryCodes ?? []);
  const [maxDistanceKm, setMaxDistanceKm] = useState(
    value?.maxDistanceKm ?? UNLIMITED_DISCOVERY_DISTANCE_KM,
  );
  const [error, setError] = useState<string | null>(null);

  const toggleGender = (gender: string) => {
    setGenders((current) =>
      current.includes(gender)
        ? current.length > 1
          ? current.filter((item) => item !== gender)
          : current
        : [...current, gender],
    );
  };

  const save = async () => {
    setError(null);
    try {
      await onSave({ minAge, maxAge, genders, countryCodes, maxDistanceKm });
      onClose();
    } catch {
      setError('탐색 조건을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>탐색 조건</Text>
              <Text style={styles.subtitle}>나에게 맞는 프로필만 발견해요.</Text>
            </View>
            <Pressable accessibilityLabel="탐색 조건 닫기" onPress={onClose} style={styles.close}>
              <Ionicons color={palette.ink} name="close" size={21} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View>
              <Text style={styles.sectionTitle}>만나고 싶은 사람</Text>
              <Text style={styles.hint}>한 개 이상 선택해주세요.</Text>
              <View style={styles.genderOptions}>
                {GENDERS.map((gender) => {
                  const selected = genders.includes(gender.value);
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      key={gender.value}
                      onPress={() => toggleGender(gender.value)}
                      style={[styles.genderOption, selected && styles.genderOptionSelected]}
                    >
                      <Text style={[styles.genderText, selected && styles.genderTextSelected]}>
                        {gender.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <AgeRangeField
              maxAge={maxAge}
              minAge={minAge}
              onChangeMax={setMaxAge}
              onChangeMin={setMinAge}
            />
            <DistanceLimitField onChange={setMaxDistanceKm} value={maxDistanceKm} />
            <CountryMultiSelectField onChange={setCountryCodes} value={countryCodes} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              disabled={saving}
              onPress={save}
              style={({ pressed }) => [styles.save, (pressed || saving) && styles.pressed]}
            >
              <Text style={styles.saveText}>{saving ? '저장 중…' : '이 조건으로 탐색'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(17,17,17,0.38)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: '#F8F8FA',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '92%',
    maxWidth: 460,
    overflow: 'hidden',
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: palette.line,
    borderRadius: 2,
    height: 4,
    marginBottom: 15,
    marginTop: 10,
    width: 38,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: { color: palette.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: palette.inkMuted, fontSize: 11, marginTop: 4 },
  close: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  content: { gap: 25, paddingBottom: 18, paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  hint: { color: palette.inkMuted, fontSize: 11, marginTop: 5 },
  genderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  genderOption: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  genderOptionSelected: { backgroundColor: palette.ink, borderColor: palette.ink },
  genderText: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  genderTextSelected: { color: palette.white },
  error: { color: palette.danger, fontSize: 11, lineHeight: 16 },
  footer: { borderTopColor: palette.line, borderTopWidth: StyleSheet.hairlineWidth, padding: 16 },
  save: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 52,
  },
  saveText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.68 },
});
