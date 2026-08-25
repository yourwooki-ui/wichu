import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { palette, pressFeedback, radius } from '@/constants/theme';
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

const CONNECTION_GOALS = ['dating', 'friends', 'language_exchange', 'travel_buddy'] as const;

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
      key={`${value?.minAge ?? 18}-${value?.maxAge ?? 29}-${value?.maxDistanceKm ?? UNLIMITED_DISCOVERY_DISTANCE_KM}-${value?.genders.join(',') ?? ''}-${value?.countryCodes?.join(',') ?? ''}-${value?.excludeSameCountry ?? false}-${value?.connectionGoals.join(',') ?? ''}`}
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      value={value}
    />
  );
}

function DiscoveryFilterForm({ value, saving, onClose, onSave }: Omit<Props, 'visible'>) {
  const { t } = useTranslation();
  const [minAge, setMinAge] = useState(value?.minAge ?? 18);
  const [maxAge, setMaxAge] = useState(value?.maxAge ?? 29);
  const [genders, setGenders] = useState<string[]>(value?.genders ?? ['woman']);
  const [countryCodes, setCountryCodes] = useState<string[]>(value?.countryCodes ?? []);
  const [maxDistanceKm, setMaxDistanceKm] = useState(
    value?.maxDistanceKm ?? UNLIMITED_DISCOVERY_DISTANCE_KM,
  );
  const [excludeSameCountry, setExcludeSameCountry] = useState(value?.excludeSameCountry ?? false);
  const [connectionGoals, setConnectionGoals] = useState<string[]>(value?.connectionGoals ?? []);
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

  const toggleConnectionGoal = (goal: string) => {
    setConnectionGoals((current) =>
      current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal],
    );
  };

  const save = async () => {
    setError(null);
    try {
      await onSave({
        minAge,
        maxAge,
        genders,
        countryCodes,
        maxDistanceKm,
        excludeSameCountry,
        connectionGoals,
      });
      onClose();
    } catch {
      setError('탐색 조건을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <AppModal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>탐색 조건</Text>
              <Text style={styles.subtitle}>나에게 맞는 프로필만 발견해요.</Text>
            </View>
            <Pressable
              accessibilityLabel="탐색 조건 닫기"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && pressFeedback.icon]}
            >
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
            <View>
              <Text style={styles.sectionTitle}>
                {t('profileSetup.profileTags.categories.connection_goal.label')}
              </Text>
              <Text style={styles.hint}>{t('experience.discover.connectionGoalHint')}</Text>
              <View style={styles.genderOptions}>
                {CONNECTION_GOALS.map((goal) => {
                  const selected = connectionGoals.includes(goal);
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      key={goal}
                      onPress={() => toggleConnectionGoal(goal)}
                      style={[styles.goalOption, selected && styles.goalOptionSelected]}
                    >
                      <Text style={[styles.goalText, selected && styles.goalTextSelected]}>
                        {t(`profileSetup.profileTags.values.${goal}`)}
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
            <View style={styles.preferenceCard}>
              <View style={styles.preferenceIcon}>
                <Ionicons color={palette.pinkPressed} name="flag-outline" size={19} />
              </View>
              <View style={styles.preferenceCopy}>
                <Text style={styles.preferenceTitle}>같은 국적 프로필 만나지 않기</Text>
                <Text style={styles.preferenceDescription}>
                  내 프로필에 설정한 국가와 같은 사용자를 탐색에서 제외해요.
                </Text>
              </View>
              <Switch
                accessibilityLabel="같은 국적 프로필 탐색에서 제외"
                accessibilityRole="switch"
                ios_backgroundColor="#DADAE0"
                onValueChange={setExcludeSameCountry}
                thumbColor={palette.white}
                trackColor={{ false: '#DADAE0', true: palette.pink }}
                value={excludeSameCountry}
              />
            </View>
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
    </AppModal>
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
  goalOption: {
    backgroundColor: '#FFF0F5',
    borderColor: '#FFD0DF',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  goalOptionSelected: { backgroundColor: palette.pink, borderColor: palette.pink },
  goalText: { color: palette.pinkPressed, fontSize: 11, fontWeight: '800' },
  goalTextSelected: { color: palette.white },
  preferenceCard: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  preferenceIcon: {
    alignItems: 'center',
    backgroundColor: '#FFE8F0',
    borderRadius: 14,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  preferenceCopy: { flex: 1, marginHorizontal: 11 },
  preferenceTitle: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  preferenceDescription: {
    color: palette.inkMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
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
