import { Ionicons } from '@expo/vector-icons';
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
  const update = <Key extends keyof ProfileDetails>(key: Key, next: ProfileDetails[Key]) => {
    onChange({ ...value, [key]: next });
  };

  if (section === 'basic') {
    return (
      <View style={styles.container}>
        <View style={styles.sectionIntro}>
          <Text style={styles.sectionIntroTitle}>나를 설명하는 기본 정보</Text>
          <Text style={styles.sectionIntroBody}>학력, 직장과 키는 선택해서 공개할 수 있어요.</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.fields}>
            <FormField
              autoCapitalize="words"
              label="직장·하는 일"
              maxLength={80}
              onChangeText={(next) => update('occupation', next)}
              placeholder="예: 브랜드 디자이너"
              value={value.occupation}
            />
            <FormField
              hint="120~220cm 사이에서 입력할 수 있어요."
              inputMode="numeric"
              keyboardType="number-pad"
              label="키"
              maxLength={3}
              onChangeText={(next) => {
                const digits = next.replace(/\D/g, '').slice(0, 3);
                update('heightCm', digits ? Number(digits) : null);
              }}
              placeholder="예: 170"
              value={value.heightCm ? String(value.heightCm) : ''}
            />
          </View>
        </View>
        <ChoiceSection
          icon="school-outline"
          label="학력"
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
          <Text style={styles.noticeTitle}>원하는 정보만 공개해요</Text>
          <Text style={styles.noticeBody}>
            모든 항목은 선택사항이며, 입력한 정보만 상대 프로필에 표시됩니다.
          </Text>
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
        label="음주"
        onChange={(next) => update('drinking', next as ProfileDetails['drinking'])}
        options={DRINKING_OPTIONS}
        value={value.drinking}
      />
      <ChoiceSection
        icon="ban-outline"
        label="흡연"
        onChange={(next) => update('smoking', next as ProfileDetails['smoking'])}
        options={SMOKING_OPTIONS}
        value={value.smoking}
      />
      <ChoiceSection
        icon="barbell-outline"
        label="운동"
        onChange={(next) => update('exercise', next as ProfileDetails['exercise'])}
        options={EXERCISE_OPTIONS}
        value={value.exercise}
      />
      <ChoiceSection
        icon="paw-outline"
        label="반려동물"
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
  return (
    <View style={styles.card}>
      <View style={styles.choiceHeading}>
        <View style={styles.choiceIcon}>
          <Ionicons color={palette.ink} name={icon} size={17} />
        </View>
        <Text style={styles.choiceTitle}>{label}</Text>
        <Text style={styles.optional}>선택</Text>
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
                {option.label}
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
