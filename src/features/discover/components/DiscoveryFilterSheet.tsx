import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import {
  BottomSheetCloseButton,
  InteractiveBottomSheet,
} from '@/components/InteractiveBottomSheet';
import { palette, pressFeedback, radius } from '@/constants/theme';
import { CountryMultiSelectField } from '@/features/discover/components/CountryMultiSelectField';
import {
  DistanceLimitField,
  UNLIMITED_DISCOVERY_DISTANCE_KM,
} from '@/features/discover/components/DistanceLimitField';
import type { DiscoveryFilters } from '@/features/discover/services/discovery-service';
import { AgeRangeField } from '@/features/profile/components/AgeRangeField';

const GENDERS = ['woman', 'man', 'nonbinary', 'other'] as const;

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
      key={`${value?.minAge ?? 18}-${value?.maxAge ?? 29}-${value?.maxDistanceKm ?? UNLIMITED_DISCOVERY_DISTANCE_KM}-${value?.genders?.join(',') ?? ''}-${value?.countryCodes?.join(',') ?? ''}-${value?.excludeSameCountry ?? false}-${value?.connectionGoals?.join(',') ?? ''}`}
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
      setError(t('discoveryControls.filter.saveFailed'));
    }
  };

  return (
    <InteractiveBottomSheet
      accessibilityLabel={t('discoveryControls.filter.title')}
      dismissEnabled={!saving}
      onClose={onClose}
      sheetStyle={styles.sheet}
      visible
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('discoveryControls.filter.title')}</Text>
          <Text style={styles.subtitle}>{t('discoveryControls.filter.subtitle')}</Text>
        </View>
        <BottomSheetCloseButton
          accessibilityLabel={t('discoveryControls.filter.close')}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && pressFeedback.icon]}
        >
          <Ionicons color={palette.ink} name="close" size={21} />
        </BottomSheetCloseButton>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View>
          <Text style={styles.sectionTitle}>{t('discoveryControls.filter.desired')}</Text>
          <Text style={styles.hint}>{t('discoveryControls.filter.chooseOne')}</Text>
          <View style={styles.genderOptions}>
            {GENDERS.map((gender) => {
              const selected = genders.includes(gender);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={gender}
                  onPress={() => toggleGender(gender)}
                  style={[styles.genderOption, selected && styles.genderOptionSelected]}
                >
                  <Text style={[styles.genderText, selected && styles.genderTextSelected]}>
                    {t(`profileSetup.gender.${gender}`)}
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
            <Text style={styles.preferenceTitle}>{t('discoveryControls.filter.excludeTitle')}</Text>
            <Text style={styles.preferenceDescription}>
              {t('discoveryControls.filter.excludeBody')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t('discoveryControls.filter.excludeA11y')}
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
          accessibilityLabel={t('discoveryControls.filter.save')}
          accessibilityRole="button"
          accessibilityState={{ busy: saving, disabled: saving }}
          disabled={saving}
          onPress={save}
          style={({ pressed }) => [styles.save, (pressed || saving) && styles.pressed]}
        >
          <Text style={styles.saveText}>
            {saving ? t('discoveryControls.filter.saving') : t('discoveryControls.filter.save')}
          </Text>
        </Pressable>
      </View>
    </InteractiveBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#F8F8FA',
    height: '92%',
    maxWidth: 460,
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
  scroll: { flex: 1, minHeight: 0 },
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
