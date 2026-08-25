import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius } from '@/constants/theme';
import { productAnalyticsService } from '@/services/product-analytics-service';

type Props = {
  matchName: string;
  onClose: () => void;
  visible: boolean;
};

export function DatePlanShareSheet({ matchName, onClose, visible }: Props) {
  const { t } = useTranslation();
  const [when, setWhen] = useState('');
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const canShare = Boolean(when.trim() || place.trim());

  if (!visible) return null;

  const share = async () => {
    if (!canShare) return;
    const rows = [
      t('experience.dateShare.messageTitle', { name: matchName }),
      when.trim() ? t('experience.dateShare.messageWhen', { value: when.trim() }) : null,
      place.trim() ? t('experience.dateShare.messagePlace', { value: place.trim() }) : null,
      note.trim() ? t('experience.dateShare.messageNote', { value: note.trim() }) : null,
      '',
      t('experience.dateShare.messageSafety'),
    ].filter((row): row is string => Boolean(row));

    const result = await Share.share({ message: rows.join('\n') });
    if (result.action === Share.sharedAction) {
      productAnalyticsService.track('date_plan_shared', {
        has_note: Boolean(note.trim()),
        has_place: Boolean(place.trim()),
        has_time: Boolean(when.trim()),
      });
      onClose();
    }
  };

  return (
    <AppModal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel={t('experience.common.cancel')}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.hero}>
            <View style={styles.iconWrap}>
              <IllustratedIcon size={48} source={illustratedIcons.safety} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>{t('experience.dateShare.title')}</Text>
              <Text style={styles.body}>{t('experience.dateShare.body')}</Text>
            </View>
          </View>

          <View style={styles.fields}>
            <Field
              label={t('experience.dateShare.when')}
              onChangeText={setWhen}
              placeholder={t('experience.dateShare.whenPlaceholder')}
              value={when}
            />
            <Field
              label={t('experience.dateShare.place')}
              onChangeText={setPlace}
              placeholder={t('experience.dateShare.placePlaceholder')}
              value={place}
            />
            <Field
              label={t('experience.dateShare.note')}
              multiline
              onChangeText={setNote}
              placeholder={t('experience.dateShare.notePlaceholder')}
              value={note}
            />
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>{t('experience.dateShare.privacy')}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel={t('experience.common.cancel')}
              accessibilityRole="button"
              onPress={onClose}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>{t('experience.common.cancel')}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={t('experience.dateShare.share')}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canShare }}
              disabled={!canShare}
              onPress={() => void share()}
              style={[styles.shareButton, !canShare && styles.shareButtonDisabled]}
            >
              <Text style={styles.shareText}>{t('experience.dateShare.share')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </AppModal>
  );
}

function Field({
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        maxLength={multiline ? 160 : 80}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.inkMuted}
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(17,17,20,0.42)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: '#F8F8FA',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxWidth: 480,
    paddingBottom: 12,
    paddingHorizontal: 18,
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: palette.line,
    borderRadius: 2,
    height: 4,
    marginBottom: 16,
    marginTop: 10,
    width: 38,
  },
  hero: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    borderRadius: 19,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  heroCopy: { flex: 1 },
  title: { color: palette.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  body: { color: palette.inkMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  fields: { gap: 11, marginTop: 20 },
  field: { gap: 6 },
  label: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  input: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 16,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top' },
  notice: {
    backgroundColor: '#FFF8E7',
    borderRadius: 14,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: { color: '#6F5C2F', fontSize: 11, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  cancelButton: {
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
  shareButton: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flex: 1.4,
    justifyContent: 'center',
    minHeight: 50,
  },
  shareButtonDisabled: { opacity: 0.38 },
  shareText: { color: palette.white, fontSize: 13, fontWeight: '900' },
});
