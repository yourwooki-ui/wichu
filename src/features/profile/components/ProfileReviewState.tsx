import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius } from '@/constants/theme';

type ProfileReviewStateProps = {
  status: 'pending' | 'rejected';
  note?: string | null;
  onBrowse: () => void;
  onRefresh?: () => Promise<void>;
  onEdit?: () => void;
};

export function ProfileReviewState({
  status,
  note,
  onBrowse,
  onRefresh,
  onEdit,
}: ProfileReviewStateProps) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const isPending = status === 'pending';

  async function refresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <BrandWordmark color={palette.ink} size={25} />
        <View style={styles.content}>
          <IllustratedIcon
            size={82}
            source={isPending ? illustratedIcons.photoReview : illustratedIcons.photoRejected}
          />
          <Text style={styles.eyebrow}>{t(`profileReview.${status}.eyebrow`)}</Text>
          <Text style={styles.title}>{t(`profileReview.${status}.title`)}</Text>
          <Text style={styles.body}>{t(`profileReview.${status}.body`)}</Text>

          {note ? (
            <View style={styles.noteCard}>
              <Text style={styles.noteLabel}>{t('profileReview.note')}</Text>
              <Text style={styles.note}>{note}</Text>
            </View>
          ) : null}

          {isPending ? (
            <View style={styles.steps}>
              <ReviewStep done label={t('profileReview.steps.submitted')} />
              <View style={styles.stepLine} />
              <ReviewStep label={t('profileReview.steps.reviewing')} />
              <View style={styles.stepLine} />
              <ReviewStep label={t('profileReview.steps.result')} />
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            label={t(isPending ? 'profileReview.browse' : 'profileReview.edit')}
            onPress={isPending ? onBrowse : () => onEdit?.()}
          />
          {isPending && onEdit ? (
            <Pressable accessibilityRole="button" onPress={onEdit} style={styles.editPendingButton}>
              <Text style={styles.editPendingText}>프로필 수정</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={refreshing}
            onPress={isPending ? () => void refresh() : onBrowse}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
              refreshing && styles.secondaryButtonDisabled,
            ]}
          >
            {isPending && refreshing ? (
              <Ionicons name="sync" size={16} color={palette.inkMuted} />
            ) : null}
            <Text style={styles.secondaryLabel}>
              {t(isPending ? 'profileReview.refresh' : 'profileReview.browse')}
            </Text>
          </Pressable>
          <Text style={styles.footerHint}>
            {t(isPending ? 'profileReview.pending.footer' : 'profileReview.rejected.footer')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ReviewStep({ done, label }: { done?: boolean; label: string }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepDot, done && styles.stepDotDone]}>
        {done ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
      </View>
      <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, alignItems: 'center', backgroundColor: '#F6F6F8' },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 20,
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 30 },
  eyebrow: {
    marginTop: 22,
    color: palette.pink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    marginTop: 8,
    color: palette.ink,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.7,
  },
  body: {
    maxWidth: 330,
    marginTop: 10,
    color: palette.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  noteCard: {
    width: '100%',
    marginTop: 22,
    gap: 6,
    padding: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
  noteLabel: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  note: { color: palette.inkMuted, fontSize: 12, lineHeight: 18 },
  steps: {
    width: '100%',
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  step: { width: 78, alignItems: 'center', gap: 7 },
  stepDot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.line,
    borderRadius: 12,
    backgroundColor: '#F6F6F8',
  },
  stepDotDone: { borderColor: palette.pink, backgroundColor: palette.pink },
  stepLabel: { color: palette.inkMuted, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  stepLabelDone: { color: palette.ink },
  stepLine: { width: 34, height: 2, marginTop: 11, backgroundColor: palette.line },
  footer: { gap: 10 },
  editPendingButton: { alignItems: 'center', minHeight: 42, justifyContent: 'center' },
  editPendingText: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  secondaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.white,
  },
  secondaryButtonPressed: { opacity: 0.64 },
  secondaryButtonDisabled: { opacity: 0.48 },
  secondaryLabel: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  footerHint: { color: palette.inkMuted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
