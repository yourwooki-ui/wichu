import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius } from '@/constants/theme';

type Props = {
  name: string;
  onClose: () => void;
  onPick: (message?: string) => void;
  visible: boolean;
};

export function PickMessageSheet({ name, onClose, onPick, visible }: Props) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  if (!visible) return null;

  const submit = () => {
    const normalized = message.trim();
    onClose();
    onPick(normalized || undefined);
  };

  return (
    <AppModal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.heading}>
            <View style={styles.icon}>
              <IllustratedIcon size={44} source={illustratedIcons.connections} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={styles.title}>{t('experience.pickMessage.title')}</Text>
              <Text style={styles.body}>{t('experience.pickMessage.body', { name })}</Text>
            </View>
          </View>
          <TextInput
            autoFocus
            maxLength={300}
            multiline
            onChangeText={setMessage}
            placeholder={t('experience.pickMessage.placeholder')}
            placeholderTextColor={palette.inkMuted}
            style={styles.input}
            value={message}
          />
          <Text style={styles.count}>{message.length} / 300</Text>
          <Pressable onPress={submit} style={styles.primary}>
            <Text style={styles.primaryText}>
              {message.trim()
                ? t('experience.pickMessage.send')
                : t('experience.pickMessage.without')}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>{t('experience.common.cancel')}</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </AppModal>
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
    marginBottom: 17,
    marginTop: 10,
    width: 38,
  },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  icon: {
    alignItems: 'center',
    backgroundColor: '#FFEAF2',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  headingCopy: { flex: 1 },
  title: { color: palette.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  body: { color: palette.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  input: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 18,
    minHeight: 112,
    padding: 14,
    textAlignVertical: 'top',
  },
  count: { color: palette.inkMuted, fontSize: 11, marginTop: 6, textAlign: 'right' },
  primary: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 52,
  },
  primaryText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  cancelText: { color: palette.inkMuted, fontSize: 12, fontWeight: '800' },
});
