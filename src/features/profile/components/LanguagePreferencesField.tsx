import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { CountryFlag } from '@/components/CountryFlag';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import {
  getLanguageOptions,
  getRepresentativeCountryCode,
  type LanguageOption,
} from '@/constants/languages';
import { palette, pressFeedback, radius } from '@/constants/theme';
import type { LanguageLevel, SpokenLanguage } from '@/features/profile/types/language';

const LEVELS: LanguageLevel[] = ['beginner', 'intermediate', 'advanced', 'fluent'];

type LanguagePreferencesFieldProps = {
  nativeLanguage: string;
  spokenLanguages: SpokenLanguage[];
  onChangeNative: (code: string) => void;
  onChangeSpoken: (languages: SpokenLanguage[]) => void;
};

export function LanguagePreferencesField({
  nativeLanguage,
  spokenLanguages,
  onChangeNative,
  onChangeSpoken,
}: LanguagePreferencesFieldProps) {
  const { t, i18n } = useTranslation();
  const [pickerTarget, setPickerTarget] = useState<'native' | 'spoken' | null>(null);
  const [query, setQuery] = useState('');
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const options = useMemo(() => getLanguageOptions(locale), [locale]);
  const byCode = useMemo(() => new Map(options.map((option) => [option.code, option])), [options]);
  const normalizedQuery = normalize(query);
  const excluded = new Set([nativeLanguage, ...spokenLanguages.map((language) => language.code)]);
  const filteredOptions = options.filter((option) => {
    if (pickerTarget === 'spoken' && excluded.has(option.code)) return false;
    return (
      !normalizedQuery ||
      normalize(option.name).includes(normalizedQuery) ||
      option.code.includes(normalizedQuery)
    );
  });

  function closePicker() {
    setPickerTarget(null);
    setQuery('');
  }

  function selectLanguage(option: LanguageOption) {
    if (pickerTarget === 'native') {
      onChangeNative(option.code);
      onChangeSpoken(spokenLanguages.filter((language) => language.code !== option.code));
    } else {
      onChangeSpoken([...spokenLanguages, { code: option.code, level: 'intermediate' }]);
    }
    closePicker();
  }

  function updateLevel(code: string, level: LanguageLevel) {
    onChangeSpoken(
      spokenLanguages.map((language) =>
        language.code === code ? { ...language, level } : language,
      ),
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.block}>
        <Text style={styles.label}>{t('profileSetup.language.native')}</Text>
        <Text style={styles.hint}>{t('profileSetup.language.nativeHint')}</Text>
        <LanguageTrigger
          option={byCode.get(nativeLanguage)}
          placeholder={t('profileSetup.language.chooseNative')}
          onPress={() => setPickerTarget('native')}
        />
      </View>

      <View style={styles.block}>
        <View style={styles.spokenHeader}>
          <View style={styles.spokenCopy}>
            <Text style={styles.label}>{t('profileSetup.language.spoken')}</Text>
            <Text style={styles.hint}>{t('profileSetup.language.spokenHint')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={spokenLanguages.length >= 6}
            onPress={() => setPickerTarget('spoken')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons color={palette.pink} name="add" size={17} />
            <Text style={styles.addLabel}>{t('profileSetup.language.add')}</Text>
          </Pressable>
        </View>

        {spokenLanguages.length === 0 ? (
          <View style={styles.emptySpoken}>
            <Text style={styles.emptySpokenText}>{t('profileSetup.language.none')}</Text>
          </View>
        ) : null}
        {spokenLanguages.map((language) => (
          <View key={language.code} style={styles.languageCard}>
            <View style={styles.languageRow}>
              <CountryFlag
                countryCode={
                  byCode.get(language.code)?.countryCode ??
                  getRepresentativeCountryCode(language.code)
                }
                label={byCode.get(language.code)?.name ?? language.code}
              />
              <Text style={styles.languageName}>
                {byCode.get(language.code)?.name ?? language.code}
              </Text>
              <Pressable
                accessibilityLabel={t('profileSetup.language.remove')}
                hitSlop={8}
                onPress={() =>
                  onChangeSpoken(spokenLanguages.filter((item) => item.code !== language.code))
                }
              >
                <Ionicons color={palette.inkMuted} name="close" size={19} />
              </Pressable>
            </View>
            <View style={styles.levels}>
              {LEVELS.map((level) => {
                const selected = language.level === level;
                return (
                  <Pressable
                    key={level}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => updateLevel(language.code, level)}
                    style={[styles.level, selected && styles.levelSelected]}
                  >
                    <Text style={[styles.levelLabel, selected && styles.levelLabelSelected]}>
                      {t(`profileSetup.language.levels.${level}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <AppModal
        animationType="slide"
        onRequestClose={closePicker}
        transparent
        visible={pickerTarget !== null}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <Pressable onPress={closePicker} style={styles.scrim} />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {pickerTarget === 'native'
                    ? t('profileSetup.language.chooseNative')
                    : t('profileSetup.language.addSpoken')}
                </Text>
                <Text style={styles.sheetSubtitle}>{t('profileSetup.language.searchHint')}</Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={closePicker}
                style={({ pressed }) => [styles.closeButton, pressed && pressFeedback.icon]}
              >
                <Ionicons color={palette.ink} name="close" size={22} />
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <Ionicons color={palette.inkMuted} name="search" size={20} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                onChangeText={setQuery}
                placeholder={t('profileSetup.language.searchPlaceholder')}
                placeholderTextColor={palette.inkMuted}
                style={styles.searchInput}
                value={query}
              />
            </View>
            <FlatList
              contentContainerStyle={styles.listContent}
              data={filteredOptions}
              initialNumToRender={20}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityLabel={item.name}
                  accessibilityRole="button"
                  onPress={() => selectLanguage(item)}
                  style={styles.optionRow}
                >
                  <CountryFlag countryCode={item.countryCode} label={item.name} />
                  <Text style={styles.optionName}>{item.name}</Text>
                  <Ionicons color={palette.inkMuted} name="chevron-forward" size={18} />
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
            />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </AppModal>
    </View>
  );
}

function LanguageTrigger({
  option,
  placeholder,
  onPress,
}: {
  option?: LanguageOption;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={option?.name ?? placeholder}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
    >
      {option ? (
        <CountryFlag countryCode={option.countryCode} label={option.name} />
      ) : (
        <IllustratedIcon size={26} source={illustratedIcons.translation} />
      )}
      <Text style={[styles.triggerText, !option && styles.placeholder]}>
        {option?.name ?? placeholder}
      </Text>
      <Ionicons color={palette.inkMuted} name="chevron-down" size={18} />
    </Pressable>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().normalize('NFKD');
}

const styles = StyleSheet.create({
  section: { gap: 24 },
  block: { gap: 8 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  hint: { color: palette.inkMuted, fontSize: 11, lineHeight: 16 },
  trigger: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 15,
  },
  triggerText: { color: palette.ink, flex: 1, fontSize: 15, fontWeight: '700' },
  placeholder: { color: palette.inkMuted, fontWeight: '500' },
  spokenHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  spokenCopy: { flex: 1, gap: 5 },
  addButton: { alignItems: 'center', flexDirection: 'row', gap: 2, padding: 4 },
  addLabel: { color: palette.pink, fontSize: 12, fontWeight: '900' },
  emptySpoken: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: 16,
  },
  emptySpokenText: { color: palette.inkMuted, fontSize: 12 },
  languageCard: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  languageRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  languageName: { color: palette.ink, flex: 1, fontSize: 14, fontWeight: '800' },
  levels: { flexDirection: 'row', gap: 5 },
  level: { alignItems: 'center', borderRadius: radius.pill, flex: 1, paddingVertical: 7 },
  levelSelected: { backgroundColor: '#FFF0F5' },
  levelLabel: { color: palette.inkMuted, fontSize: 10, fontWeight: '800' },
  levelLabelSelected: { color: palette.pink },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,17,17,0.38)' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: '#F8F8FA',
    borderColor: palette.line,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    height: '84%',
    maxWidth: 460,
    overflow: 'hidden',
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: palette.line,
    borderRadius: 2,
    height: 4,
    marginBottom: 17,
    marginTop: 10,
    width: 38,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  sheetTitle: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  sheetSubtitle: { color: palette.inkMuted, fontSize: 12, marginTop: 4 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 13,
  },
  listContent: { paddingBottom: 20, paddingHorizontal: 12, paddingTop: 10 },
  optionRow: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
  },
  optionName: { color: palette.ink, flex: 1, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.65 },
});
