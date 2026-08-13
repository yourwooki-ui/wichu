import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/components/ThemeProvider';
import { radius, spacing } from '@/constants/theme';
import { AppLanguage, getAppLanguage, setAppLanguage, supportedLanguages } from '@/i18n';

type LanguagePickerProps = {
  dark?: boolean;
};

export function LanguagePicker({ dark = false }: LanguagePickerProps) {
  const theme = useAppTheme();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentLanguage = getAppLanguage();
  const currentLabel = supportedLanguages.find(({ code }) => code === currentLanguage)?.label;
  const sheetBackground = dark ? '#111114' : theme.colors.surface;
  const sheetText = dark ? '#FFFFFF' : theme.colors.text;
  const sheetMuted = dark ? '#A8A8B0' : theme.colors.textMuted;
  const sheetBorder = dark ? '#303036' : theme.colors.border;
  const optionBackground = dark ? '#19191D' : theme.colors.background;

  async function chooseLanguage(language: AppLanguage) {
    setOpen(false);
    await setAppLanguage(language);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.language')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: dark ? 'rgba(255,255,255,0.22)' : theme.colors.border,
            backgroundColor: dark ? 'rgba(17,17,17,0.7)' : theme.colors.surface,
            opacity: pressed ? 0.72 : 1,
          },
        ]}
      >
        <Ionicons name="globe-outline" size={16} color={dark ? '#FFFFFF' : theme.colors.text} />
        <Text style={[styles.triggerLabel, { color: dark ? '#FFFFFF' : theme.colors.text }]}>
          {currentLabel}
        </Text>
        <Ionicons name="chevron-down" size={14} color={dark ? '#FFFFFF' : theme.colors.textMuted} />
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel={t('auth.back')}
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <SafeAreaView
            edges={['bottom']}
            style={[styles.sheet, { backgroundColor: sheetBackground }]}
          >
            <View style={[styles.handle, { backgroundColor: sheetBorder }]} />
            <Text style={[styles.title, { color: sheetText }]}>{t('auth.chooseLanguage')}</Text>
            <Text style={[styles.hint, { color: sheetMuted }]}>{t('auth.languageHint')}</Text>

            <View style={styles.options}>
              {supportedLanguages.map((language) => {
                const selected = i18n.resolvedLanguage === language.code;
                return (
                  <Pressable
                    key={language.code}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => chooseLanguage(language.code)}
                    style={[
                      styles.option,
                      {
                        borderColor: selected ? theme.colors.primary : sheetBorder,
                        backgroundColor: selected ? `${theme.colors.primary}14` : optionBackground,
                      },
                    ]}
                  >
                    <Text style={[styles.optionLabel, { color: sheetText }]}>{language.label}</Text>
                    <View
                      style={[
                        styles.radio,
                        { borderColor: selected ? theme.colors.primary : sheetBorder },
                      ]}
                    >
                      {selected ? (
                        <View
                          style={[styles.radioDot, { backgroundColor: theme.colors.primary }]}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  triggerLabel: { fontSize: 12, fontWeight: '800' },
  modalRoot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.58)' },
  sheet: {
    width: '100%',
    maxWidth: 460,
    paddingTop: spacing.sm,
    paddingHorizontal: 22,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  handle: { width: 40, height: 4, alignSelf: 'center', borderRadius: 2 },
  title: { marginTop: spacing.lg, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  hint: { marginTop: spacing.xs, fontSize: 13, lineHeight: 19 },
  options: { marginTop: spacing.lg, gap: spacing.sm },
  option: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  optionLabel: { fontSize: 16, fontWeight: '800' },
  radio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 11,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
