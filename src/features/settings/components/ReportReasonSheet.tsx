import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

type ReportReasonSheetProps = {
  busy?: boolean;
  onClose: () => void;
  onSelect: (reason: ReportReason) => void;
  visible: boolean;
};

export function ReportReasonSheet({ busy, onClose, onSelect, visible }: ReportReasonSheetProps) {
  const { t } = useTranslation();

  return (
    <InteractiveBottomSheet
      accessibilityLabel={t('safetySurfaces.report.label')}
      contentStyle={styles.sheetFrame}
      dismissEnabled={!busy}
      onClose={onClose}
      sheetStyle={styles.sheet}
      visible={visible}
    >
      <ScrollView
        contentContainerStyle={styles.sheetContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Text style={styles.eyebrow}>{t('safetySurfaces.report.eyebrow')}</Text>
        <Text style={styles.title}>{t('safetySurfaces.report.title')}</Text>
        <Text style={styles.subtitle}>{t('safetySurfaces.report.body')}</Text>
        <View style={styles.reasonList}>
          {REPORT_REASONS.map((reason) => (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              key={reason.value}
              onPress={() => onSelect(reason.value)}
              style={({ pressed }) => [styles.reason, pressed && styles.pressed]}
            >
              <View style={styles.reasonIcon}>
                <Ionicons
                  color={palette.ink}
                  name={reason.icon as keyof typeof Ionicons.glyphMap}
                  size={19}
                />
              </View>
              <Text style={styles.reasonLabel}>
                {t(`safetySurfaces.report.reasons.${reason.value}`)}
              </Text>
              <Ionicons color="#A3A3AA" name="chevron-forward" size={17} />
            </Pressable>
          ))}
        </View>
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
  reasonList: { marginTop: 13 },
  reason: {
    alignItems: 'center',
    borderBottomColor: '#ECECEF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
  },
  reasonIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F1F3',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  reasonLabel: { color: palette.ink, flex: 1, fontSize: 13, fontWeight: '800', marginLeft: 11 },
  cancel: {
    alignItems: 'center',
    backgroundColor: '#F0F0F2',
    borderRadius: radius.md,
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelText: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.58 },
});
