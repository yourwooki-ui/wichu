import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  BottomSheetCloseButton,
  InteractiveBottomSheet,
} from '@/components/InteractiveBottomSheet';
import { palette, pressFeedback, radius } from '@/constants/theme';

export const REPORT_REASONS = [
  { value: 'inappropriate_content', icon: 'images-outline' },
  { value: 'harassment', icon: 'alert-circle-outline' },
  { value: 'spam', icon: 'megaphone-outline' },
  { value: 'fake_profile', icon: 'person-remove-outline' },
  { value: 'underage', icon: 'shield-outline' },
  { value: 'scam', icon: 'card-outline' },
  { value: 'other', icon: 'ellipsis-horizontal-circle-outline' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];
export type ReportSubmission = { details?: string; reasons: ReportReason[] };

type ReportReasonSheetProps = {
  busy?: boolean;
  onClose: () => void;
  onSubmit: (submission: ReportSubmission) => void;
  visible: boolean;
};

export function ReportReasonSheet({ busy, onClose, onSubmit, visible }: ReportReasonSheetProps) {
  if (!visible) return null;
  return <VisibleReportReasonSheet busy={busy} onClose={onClose} onSubmit={onSubmit} />;
}

function VisibleReportReasonSheet({
  busy,
  onClose,
  onSubmit,
}: Omit<ReportReasonSheetProps, 'visible'>) {
  const { t } = useTranslation();
  const [details, setDetails] = useState('');
  const [selectedReasons, setSelectedReasons] = useState<ReportReason[]>([]);
  const [attempted, setAttempted] = useState(false);
  const otherNeedsDetails = selectedReasons.includes('other') && !details.trim();

  const toggleReason = (reason: ReportReason) => {
    setAttempted(false);
    setSelectedReasons((current) => {
      if (current.includes(reason)) return current.filter((item) => item !== reason);
      if (current.length >= 3) return current;
      return [...current, reason];
    });
  };

  const submit = () => {
    setAttempted(true);
    if (!selectedReasons.length || otherNeedsDetails || busy) return;
    onSubmit({
      details: details.trim() || undefined,
      reasons: selectedReasons,
    });
  };

  return (
    <InteractiveBottomSheet
      accessibilityLabel={t('safetySurfaces.report.label')}
      contentStyle={styles.sheetFrame}
      dismissEnabled={!busy}
      onClose={onClose}
      sheetStyle={styles.sheet}
      visible
    >
      <ScrollView
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Text style={styles.eyebrow}>{t('safetySurfaces.report.eyebrow')}</Text>
        <Text style={styles.title}>{t('safetySurfaces.report.title')}</Text>
        <Text style={styles.subtitle}>{t('safetySurfaces.report.body')}</Text>
        <Text style={styles.selectionHint}>
          {t('safetySurfaces.report.selectionHint', { count: selectedReasons.length })}
        </Text>
        <View style={styles.reasonList}>
          {REPORT_REASONS.map((reason) => {
            const selected = selectedReasons.includes(reason.value);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: busy }}
                disabled={busy}
                key={reason.value}
                onPress={() => toggleReason(reason.value)}
                style={({ pressed }) => [
                  styles.reason,
                  selected && styles.reasonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.reasonIcon, selected && styles.reasonIconSelected]}>
                  <Ionicons
                    color={selected ? palette.pink : palette.ink}
                    name={reason.icon as keyof typeof Ionicons.glyphMap}
                    size={19}
                  />
                </View>
                <Text style={styles.reasonLabel}>
                  {t(`safetySurfaces.report.reasons.${reason.value}`)}
                </Text>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? <Ionicons color={palette.white} name="checkmark" size={15} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.detailsLabel}>{t('safetySurfaces.report.detailsLabel')}</Text>
        <TextInput
          accessibilityLabel={t('safetySurfaces.report.detailsLabel')}
          editable={!busy}
          maxLength={1000}
          multiline
          onChangeText={(value) => {
            setDetails(value);
            setAttempted(false);
          }}
          placeholder={t('safetySurfaces.report.detailsPlaceholder')}
          placeholderTextColor="#9999A1"
          style={styles.detailsInput}
          textAlignVertical="top"
          value={details}
        />
        <View style={styles.detailsMeta}>
          <Text style={styles.validationText}>
            {attempted && otherNeedsDetails ? t('safetySurfaces.report.detailsRequired') : ' '}
          </Text>
          <Text style={styles.characterCount}>{details.length}/1000</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy || !selectedReasons.length }}
          disabled={busy || !selectedReasons.length}
          onPress={submit}
          style={({ pressed }) => [
            styles.submit,
            (busy || !selectedReasons.length) && styles.disabled,
            pressed && !busy && styles.pressed,
          ]}
        >
          <Text style={styles.submitText}>
            {busy ? t('safetySurfaces.report.submitting') : t('safetySurfaces.report.submit')}
          </Text>
        </Pressable>
        <BottomSheetCloseButton
          accessibilityLabel={t('safetySurfaces.report.cancel')}
          accessibilityRole="button"
          accessibilityState={{ busy: busy, disabled: busy }}
          disabled={busy}
          style={({ pressed }) => [styles.cancel, pressed && pressFeedback.control]}
        >
          <Text style={styles.cancelText}>
            {busy ? t('safetySurfaces.report.submitting') : t('safetySurfaces.report.cancel')}
          </Text>
        </BottomSheetCloseButton>
      </ScrollView>
    </InteractiveBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: palette.white,
  },
  sheetFrame: { minHeight: 0 },
  scroll: { flexShrink: 1, minHeight: 0 },
  sheetContent: {
    paddingBottom: 24,
    paddingHorizontal: 18,
  },
  eyebrow: { color: palette.pink, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: palette.ink, fontSize: 21, fontWeight: '900', marginTop: 4 },
  subtitle: { color: palette.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  selectionHint: { color: palette.pink, fontSize: 11, fontWeight: '900', marginTop: 10 },
  reasonList: { gap: 7, marginTop: 8 },
  reason: {
    alignItems: 'center',
    backgroundColor: '#F7F7F9',
    borderColor: '#EBEBEE',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: 10,
  },
  reasonSelected: { backgroundColor: '#FFF2F6', borderColor: '#FF8DB3' },
  reasonIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F1F3',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  reasonIconSelected: { backgroundColor: '#FFE4ED' },
  reasonLabel: { color: palette.ink, flex: 1, fontSize: 13, fontWeight: '800', marginLeft: 11 },
  checkbox: {
    alignItems: 'center',
    borderColor: '#CFCFD5',
    borderRadius: 8,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxSelected: { backgroundColor: palette.pink, borderColor: palette.pink },
  detailsLabel: { color: palette.ink, fontSize: 12, fontWeight: '900', marginTop: 16 },
  detailsInput: {
    backgroundColor: '#F7F7F9',
    borderColor: '#E5E5E9',
    borderRadius: 16,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    minHeight: 92,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  detailsMeta: { flexDirection: 'row', gap: 8, marginTop: 5 },
  validationText: { color: '#C43B53', flex: 1, fontSize: 10, fontWeight: '700' },
  characterCount: { color: palette.inkMuted, fontSize: 10 },
  submit: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 50,
  },
  submitText: { color: palette.white, fontSize: 14, fontWeight: '900' },
  cancel: {
    alignItems: 'center',
    backgroundColor: '#F0F0F2',
    borderRadius: radius.md,
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelText: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.58 },
});
