import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette, radius } from '@/constants/theme';
import {
  MAX_PROFILE_PROMPT_ANSWER_LENGTH,
  MAX_PROFILE_PROMPTS,
  PROFILE_PROMPT_KEYS,
} from '@/features/profile/constants/profile-prompts';
import type { ProfilePrompt, ProfilePromptKey } from '@/types/profile';

// This editor is mounted only inside profile-setup's KeyboardAwareScrollView.

type Props = {
  value: ProfilePrompt[];
  onChange: (value: ProfilePrompt[]) => void;
};

export function ProfilePromptEditor({ value, onChange }: Props) {
  const { t } = useTranslation();
  const usedKeys = new Set(value.map((prompt) => prompt.promptKey));

  function addPrompt(promptKey: ProfilePromptKey) {
    if (value.length >= MAX_PROFILE_PROMPTS || usedKeys.has(promptKey)) return;
    onChange([...value, { promptKey, answer: '', position: value.length }]);
  }

  function updateAnswer(index: number, answer: string) {
    onChange(value.map((prompt, current) => (current === index ? { ...prompt, answer } : prompt)));
  }

  function removePrompt(index: number) {
    onChange(
      value
        .filter((_, current) => current !== index)
        .map((prompt, position) => ({ ...prompt, position })),
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <Ionicons name="chatbubble-ellipses" size={15} color={palette.pink} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{t('relationship.profilePrompts.title')}</Text>
          <Text style={styles.description}>{t('relationship.profilePrompts.description')}</Text>
        </View>
        <Text style={styles.count}>
          {value.length}/{MAX_PROFILE_PROMPTS}
        </Text>
      </View>

      {value.map((prompt, index) => (
        <View key={prompt.promptKey} style={styles.answerCard}>
          <View style={styles.answerHeading}>
            <Text style={styles.promptLabel}>
              {t(`relationship.profilePrompts.options.${prompt.promptKey}`)}
            </Text>
            <Pressable
              accessibilityLabel={t('relationship.profilePrompts.remove')}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => removePrompt(index)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="close" size={20} color={palette.inkMuted} />
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel={t(`relationship.profilePrompts.options.${prompt.promptKey}`)}
            maxLength={MAX_PROFILE_PROMPT_ANSWER_LENGTH}
            multiline
            onChangeText={(answer) => updateAnswer(index, answer)}
            placeholder={t('relationship.profilePrompts.answerPlaceholder')}
            placeholderTextColor={palette.inkMuted}
            style={styles.input}
            textAlignVertical="top"
            value={prompt.answer}
          />
          <Text style={styles.answerCount}>
            {prompt.answer.length}/{MAX_PROFILE_PROMPT_ANSWER_LENGTH}
          </Text>
        </View>
      ))}

      {value.length < MAX_PROFILE_PROMPTS ? (
        <View style={styles.options}>
          {PROFILE_PROMPT_KEYS.filter((key) => !usedKeys.has(key)).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => addPrompt(key)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={15} color={palette.pink} />
              <Text style={styles.optionLabel}>
                {t(`relationship.profilePrompts.options.${key}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
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
  count: { color: palette.pink, fontSize: 11, fontWeight: '900' },
  answerCard: { gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: '#FAFAFB' },
  answerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  promptLabel: { flex: 1, color: palette.ink, fontSize: 12, fontWeight: '900' },
  input: {
    minHeight: 74,
    padding: 11,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.sm,
    color: palette.ink,
    backgroundColor: palette.white,
    fontSize: 13,
    lineHeight: 19,
  },
  answerCount: { alignSelf: 'flex-end', color: palette.inkMuted, fontSize: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.pill,
    backgroundColor: '#FAFAFB',
  },
  optionLabel: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.62 },
});
