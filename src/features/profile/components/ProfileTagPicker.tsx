import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius } from '@/constants/theme';
import { PROFILE_TAG_CATEGORIES } from '@/features/profile/constants/profile-tags';
import type {
  ProfileTagCategory,
  ProfileTagSelections,
} from '@/features/profile/types/profile-tag';

type ProfileTagPickerProps = {
  value: ProfileTagSelections;
  onChange: (value: ProfileTagSelections) => void;
};

export function ProfileTagPicker({ value, onChange }: ProfileTagPickerProps) {
  const { t } = useTranslation();

  function toggle(category: ProfileTagCategory, item: string, maxSelections: number) {
    const selected = value[category];
    if (!selected.includes(item) && maxSelections > 1 && selected.length >= maxSelections) return;

    const next = selected.includes(item)
      ? selected.filter((selectedItem) => selectedItem !== item)
      : maxSelections === 1
        ? [item]
        : [...selected, item];

    onChange({ ...value, [category]: next });
  }

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <Ionicons name="sparkles" size={15} color={palette.pink} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{t('profileSetup.profileTags.title')}</Text>
          <Text style={styles.description}>{t('profileSetup.profileTags.description')}</Text>
        </View>
      </View>

      {PROFILE_TAG_CATEGORIES.map(({ category, values, maxSelections }) => (
        <View key={category} style={styles.category}>
          <View style={styles.categoryHeading}>
            <Text style={styles.categoryLabel}>
              {t(`profileSetup.profileTags.categories.${category}.label`)}
            </Text>
            <Text style={styles.selectionCount}>
              {value[category].length}/{maxSelections}
            </Text>
          </View>
          <Text style={styles.categoryHint}>
            {t(`profileSetup.profileTags.categories.${category}.hint`)}
          </Text>
          <View style={styles.options}>
            {values.map((item) => {
              const selected = value[category].includes(item);
              return (
                <Pressable
                  key={item}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggle(category, item, maxSelections)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  {selected ? <Ionicons name="checkmark" size={14} color={palette.pink} /> : null}
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                    {t(`profileSetup.profileTags.values.${item}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
  },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headingIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(255,45,111,0.09)',
  },
  headingCopy: { flex: 1, gap: 3 },
  title: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  description: { color: palette.inkMuted, fontSize: 11, lineHeight: 16 },
  category: { gap: 8 },
  categoryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryLabel: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  selectionCount: { color: palette.pink, fontSize: 11, fontWeight: '900' },
  categoryHint: { marginTop: -4, color: palette.inkMuted, fontSize: 10, lineHeight: 14 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: {
    minHeight: 37,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.pill,
    backgroundColor: '#FAFAFB',
  },
  optionSelected: { borderColor: palette.pink, backgroundColor: 'rgba(255,45,111,0.08)' },
  optionLabel: { color: palette.inkMuted, fontSize: 11, fontWeight: '800' },
  optionLabelSelected: { color: palette.pink },
  pressed: { opacity: 0.64 },
});
