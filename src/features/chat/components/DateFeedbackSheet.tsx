import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  BottomSheetCloseButton,
  InteractiveBottomSheet,
} from '@/components/InteractiveBottomSheet';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { palette, radius } from '@/constants/theme';
import {
  matchesService,
  type DateFeedbackInput,
} from '@/features/matches/services/matches-service';
import { reportOperationalError } from '@/services/operational-error-service';
import { productAnalyticsService } from '@/services/product-analytics-service';

type Props = {
  matchId: string;
  matchName: string;
  mock?: boolean;
  onClose: () => void;
  onSafetyConcern: () => void;
  visible: boolean;
};

export function DateFeedbackSheet({
  matchId,
  matchName,
  mock = false,
  onClose,
  onSafetyConcern,
  visible,
}: Props) {
  const { t } = useTranslation();
  const [met, setMet] = useState<boolean | null>(null);
  const [meetAgain, setMeetAgain] = useState<boolean | null>(null);
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || mock) return;
    let active = true;
    void matchesService
      .getDateFeedback(matchId)
      .then((saved) => {
        if (!active || !saved) return;
        setMet(saved.met);
        setMeetAgain(saved.meet_again);
        setSafetyConcern(saved.safety_concern);
        setNotes(saved.notes ?? '');
      })
      .catch((loadError) =>
        reportOperationalError('date_feedback_load', loadError, `/chat/${matchId}`),
      );
    return () => {
      active = false;
    };
  }, [matchId, mock, visible]);

  if (!visible) return null;
  const canSubmit = met !== null && (!met || meetAgain !== null);

  async function submit() {
    if (!canSubmit || met === null) return;
    const input: DateFeedbackInput = { met, meetAgain, safetyConcern, notes };
    setBusy(true);
    setError(null);
    try {
      if (!mock) await matchesService.submitDateFeedback(matchId, input);
      productAnalyticsService.track(
        'date_feedback_submitted',
        { met, meet_again: meetAgain ?? 'not_applicable', safety_concern: safetyConcern },
        `/chat/${matchId}`,
      );
      onClose();
      if (safetyConcern) onSafetyConcern();
    } catch (submitError) {
      reportOperationalError('date_feedback_submit', submitError, `/chat/${matchId}`);
      setError(t('relationship.dateFeedback.saveError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <InteractiveBottomSheet
      accessibilityLabel={t('relationship.dateFeedback.title')}
      contentStyle={styles.sheetFrame}
      dismissEnabled={!busy}
      onClose={onClose}
      sheetStyle={styles.sheet}
      visible
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardFocusOffset={24}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Text style={styles.title}>{t('relationship.dateFeedback.title')}</Text>
        <Text style={styles.body}>{t('relationship.dateFeedback.body', { name: matchName })}</Text>

        <Question label={t('relationship.dateFeedback.met')}>
          <BooleanChoice value={met} onChange={setMet} />
        </Question>
        {met ? (
          <Question label={t('relationship.dateFeedback.meetAgain')}>
            <BooleanChoice value={meetAgain} onChange={setMeetAgain} />
          </Question>
        ) : null}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: safetyConcern }}
          onPress={() => setSafetyConcern((current) => !current)}
          style={[styles.safetyChoice, safetyConcern && styles.safetyChoiceSelected]}
        >
          <Text style={[styles.safetyChoiceText, safetyConcern && styles.safetyChoiceTextSelected]}>
            {t('relationship.dateFeedback.safetyConcern')}
          </Text>
        </Pressable>
        <TextInput
          maxLength={500}
          multiline
          onChangeText={setNotes}
          placeholder={t('relationship.dateFeedback.notesPlaceholder')}
          placeholderTextColor={palette.inkMuted}
          style={styles.input}
          textAlignVertical="top"
          value={notes}
        />
        <Text style={styles.privacy}>{t('relationship.dateFeedback.privacy')}</Text>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <BottomSheetCloseButton
            accessibilityLabel={t('relationship.common.cancel')}
            disabled={busy}
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>{t('relationship.common.cancel')}</Text>
          </BottomSheetCloseButton>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy, disabled: !canSubmit || busy }}
            disabled={!canSubmit || busy}
            onPress={() => void submit()}
            style={[styles.submit, (!canSubmit || busy) && styles.disabled]}
          >
            <Text style={styles.submitText}>
              {busy ? t('relationship.common.saving') : t('relationship.common.save')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </InteractiveBottomSheet>
  );
}

function Question({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.question}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function BooleanChoice({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.choiceRow}>
      {[true, false].map((option) => (
        <Pressable
          key={String(option)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={[styles.choice, value === option && styles.choiceSelected]}
        >
          <Text style={[styles.choiceText, value === option && styles.choiceTextSelected]}>
            {t(option ? 'relationship.common.yes' : 'relationship.common.no')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: '#F8F8FA', maxWidth: 480 },
  sheetFrame: { minHeight: 0 },
  scroll: { flexShrink: 1, minHeight: 0 },
  content: { paddingBottom: 18, paddingHorizontal: 20 },
  title: { color: palette.ink, fontSize: 21, fontWeight: '900' },
  body: { color: palette.inkMuted, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 18 },
  question: { gap: 8, marginBottom: 14 },
  label: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  choiceSelected: { backgroundColor: '#FFF0F5', borderColor: palette.pink },
  choiceText: { color: palette.inkMuted, fontSize: 13, fontWeight: '800' },
  choiceTextSelected: { color: palette.pink },
  safetyChoice: {
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 12,
    padding: 13,
  },
  safetyChoiceSelected: { backgroundColor: '#FFF0F1', borderColor: palette.danger },
  safetyChoiceText: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  safetyChoiceTextSelected: { color: '#C92943' },
  input: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: 1,
    color: palette.ink,
    minHeight: 82,
    padding: 12,
  },
  privacy: { color: palette.inkMuted, fontSize: 11, lineHeight: 16, marginTop: 9 },
  error: { color: palette.danger, fontSize: 12, fontWeight: '700', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  cancel: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelText: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  submit: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flex: 1.4,
    justifyContent: 'center',
    minHeight: 50,
  },
  submitText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.38 },
});
