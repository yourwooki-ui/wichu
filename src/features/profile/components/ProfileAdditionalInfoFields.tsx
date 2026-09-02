import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/FormField';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius } from '@/constants/theme';
import {
  DRINKING_OPTIONS,
  EDUCATION_OPTIONS,
  EXERCISE_OPTIONS,
  PERSONALITY_OPTIONS,
  PET_OPTIONS,
  SMOKING_OPTIONS,
} from '@/features/profile/constants/profile-details';
import type { ProfileDetails } from '@/features/profile/types/profile-details';

type ProfileAdditionalInfoFieldsProps = {
  onChange: (value: ProfileDetails) => void;
  section: 'basic' | 'additional';
  value: ProfileDetails;
};

export function ProfileAdditionalInfoFields({
  onChange,
  section,
  value,
}: ProfileAdditionalInfoFieldsProps) {
  const { t } = useTranslation();
  const update = <Key extends keyof ProfileDetails>(key: Key, next: ProfileDetails[Key]) => {
    onChange({ ...value, [key]: next });
  };

  if (section === 'basic') {
    return (
      <View style={styles.container}>
        <View style={styles.sectionIntro}>
          <Text style={styles.sectionIntroTitle}>{t('profileEditor.details.introTitle')}</Text>
          <Text style={styles.sectionIntroBody}>{t('profileEditor.details.introBody')}</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.fields}>
            <FormField
              autoCapitalize="words"
              label={t('profileEditor.details.occupation')}
              maxLength={80}
              onChangeText={(next) => update('occupation', next)}
              placeholder={t('profileEditor.details.occupationPlaceholder')}
              value={value.occupation}
            />
            <FormField
              hint={t('profileEditor.details.heightHint')}
              inputMode="numeric"
              keyboardType="number-pad"
              label={t('profileEditor.details.height')}
              maxLength={3}
              onChangeText={(next) => {
                const digits = next.replace(/\D/g, '').slice(0, 3);
                update('heightCm', digits ? Number(digits) : null);
              }}
              placeholder={t('profileEditor.details.heightPlaceholder')}
              value={value.heightCm ? String(value.heightCm) : ''}
            />
          </View>
        </View>
        <ChoiceSection
          icon="school-outline"
          label={t('profileEditor.details.education')}
          onChange={(next) => update('educationLevel', next as ProfileDetails['educationLevel'])}
          options={EDUCATION_OPTIONS}
          value={value.educationLevel}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.notice}>
        <View style={styles.noticeIcon}>
          <IllustratedIcon size={26} source={illustratedIcons.discoveryVisible} />
        </View>
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>{t('profileEditor.details.privacyTitle')}</Text>
          <Text style={styles.noticeBody}>{t('profileEditor.details.privacyBody')}</Text>
        </View>
      </View>

      <ChoiceSection
        icon="color-wand-outline"
        label="MBTI"
        onChange={(next) => update('personalityType', next)}
        options={PERSONALITY_OPTIONS.map((item) => ({ value: item, label: item }))}
        value={value.personalityType}
      />
      <ChoiceSection
        icon="wine-outline"
        label={t('profileEditor.details.drinking')}
        onChange={(next) => update('drinking', next as ProfileDetails['drinking'])}
        options={DRINKING_OPTIONS}
        value={value.drinking}
      />
      <ChoiceSection
        icon="ban-outline"
        label={t('profileEditor.details.smoking')}
        onChange={(next) => update('smoking', next as ProfileDetails['smoking'])}
        options={SMOKING_OPTIONS}
        value={value.smoking}
      />
      <ChoiceSection
        icon="barbell-outline"
        label={t('profileEditor.details.exercise')}
        onChange={(next) => update('exercise', next as ProfileDetails['exercise'])}
        options={EXERCISE_OPTIONS}
        value={value.exercise}
      />
      <ChoiceSection
        icon="paw-outline"
        label={t('profileEditor.details.pets')}
        onChange={(next) => update('pets', next as ProfileDetails['pets'])}
        options={PET_OPTIONS}
        value={value.pets}
      />
    </View>
  );
}

function ChoiceSection({
  icon,
  label,
  onChange,
  options,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onChange: (value: string | null) => void;
  options: readonly { label: string; value: string }[];
  value: string | null;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.choiceHeading}>
        <View style={styles.choiceIcon}>
          <Ionicons color={palette.ink} name={icon} size={17} />
        </View>
        <Text style={styles.choiceTitle}>{label}</Text>
        <Text style={styles.optional}>{t('profileEditor.details.optional')}</Text>
      </View>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onChange(selected ? null : option.value)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {option.value.length <= 4 && option.value.toUpperCase() === option.value
                  ? option.label
                  : t(`me.detail.values.${option.value}`, { defaultValue: option.label })}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  notice: {
    alignItems: 'center',
    backgroundColor: '#FFF1F6',
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: 11,
    padding: 14,
  },
  noticeIcon: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  noticeBody: { color: palette.inkMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  sectionIntro: { paddingHorizontal: 2, paddingTop: 4 },
  sectionIntroTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  sectionIntroBody: { color: palette.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  card: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  fields: { gap: 16 },
  choiceHeading: { alignItems: 'center', flexDirection: 'row' },
  choiceIcon: {
    alignItems: 'center',
    backgroundColor: '#F2F2F4',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  choiceTitle: { color: palette.ink, flex: 1, fontSize: 14, fontWeight: '900', marginLeft: 10 },
  optional: { color: palette.inkMuted, fontSize: 10, fontWeight: '800' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  option: {
    alignItems: 'center',
    backgroundColor: '#F7F7F8',
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 13,
  },
  optionSelected: { backgroundColor: '#FFF0F5', borderColor: palette.pink },
  optionLabel: { color: palette.inkMuted, fontSize: 11, fontWeight: '800' },
  optionLabelSelected: { color: palette.pink, fontWeight: '900' },
  pressed: { opacity: 0.64 },
});
